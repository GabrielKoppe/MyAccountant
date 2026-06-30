# Spec 44 — Privacidade Granular e Papel Contador

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Colaboração
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md)

---

## 1. Problema

- **PRIV-01**: Os papéis são grossos: o enum `AccountMemberRole` tem apenas `owner` / `editor` / `viewer` (`prisma/schema.prisma:17-23`). Um `viewer` enxerga **tudo** da Account. Não há como ocultar uma seção sensível (ex: "Terapia", "Presente surpresa") de um membro específico mantendo o resto compartilhado. Honeydue oferece privacidade por conta (tudo / só saldo / oculto) — o MyAccountant não tem equivalente.
- **PRIV-02**: Não existe um papel profissional restrito. Um contador convidado para fechar o mês precisa hoje ser `viewer`, o que lhe dá acesso ao detalhe transação a transação. Falta um papel que veja **apenas relatórios agregados e export**, sem o detalhe individual.
- **PRIV-03**: A privacidade, quando existir, precisa de critérios de isolamento **verificáveis** — não basta esconder na UI; o serviço/queries DEVEM negar o dado, senão a API REST (`/api/v1/`) e o export vazariam o que a UI esconde.

---

## 2. Solução

### 2.1 Visibilidade por seção e membro (PRIV-01)

Novo modelo `SectionVisibility`: override de visibilidade de uma `Section` para um membro específico. Sem registro = visibilidade total (default atual preservado).

```prisma
enum SectionVisibilityLevel {
  visible    // vê tudo (detalhe + valores) — comportamento atual
  aggregate  // vê só totais agregados da seção, não as transações individuais
  hidden     // não vê a seção nem seus valores

  @@map("section_visibility_level")
}

model SectionVisibility {
  id        String                 @id @default(cuid())
  accountId String                 @map("account_id")
  sectionId String                 @map("section_id")
  userId    String                 @map("user_id")   // membro alvo da restrição
  level     SectionVisibilityLevel
  createdAt DateTime               @default(now()) @map("created_at")

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  section Section @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  user    User    @relation("SectionVisibilityUser", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([sectionId, userId])
  @@index([accountId])
  @@index([accountId, userId])
  @@map("section_visibilities")
}
```

- Só `owner` pode criar/alterar `SectionVisibility` (definir quem vê o quê).
- `owner` da Account nunca pode ser restrito (sempre `visible`).

### 2.2 Papel `accountant` (PRIV-02)

Novo valor no enum `AccountMemberRole`:

```prisma
enum AccountMemberRole {
  owner
  editor
  viewer
  accountant   // acesso somente a relatórios agregados e export; sem detalhe de transação

  @@map("account_member_role")
}
```

- `accountant` é um `viewer` ainda mais restrito: vê dashboards/relatórios agregados e pode usar o export (Spec 22), mas **não** acessa a lista/painel de detalhe de transações individuais nem o detalhe de transação via API.

### 2.3 Isolamento verificável (PRIV-03)

- A restrição é aplicada na **camada de serviço**, não na UI: um helper de autorização resolve a visibilidade efetiva e remove/agrega dados **antes** de retornar, cobrindo igualmente RSC, Server Actions, API REST (`/api/v1/`) e export.

## 3. User Stories

- Como dono da Account, quero ocultar uma seção sensível de um membro específico, para manter privacidade dentro de uma Account compartilhada.
- Como dono, quero permitir que um membro veja só os totais de uma seção (não as transações), para dar contexto sem expor detalhe.
- Como dono, quero convidar meu contador com um papel que só vê relatórios e export, para fechar o mês sem expor cada lançamento.
- Como contador, quero acessar relatórios agregados e exportar dados, sem ver o detalhe individual que não me cabe.

## 4. Critérios de Aceitação

**PRIV-01 (visibilidade por seção/membro):**
- QUANDO existe `SectionVisibility(level = hidden)` para (seção, membro), AS LEITURAS para esse membro NÃO DEVEM retornar a seção, suas tabelas, suas transações nem seus totais — em RSC, API REST e export.
- QUANDO existe `SectionVisibility(level = aggregate)` para (seção, membro), AS LEITURAS para esse membro DEVEM retornar apenas os totais agregados da seção e NÃO DEVEM retornar transações individuais.
- QUANDO não existe registro de `SectionVisibility` para (seção, membro), O MEMBRO DEVE ver a seção integralmente (default atual preservado).
- QUANDO um membro que não é `owner` tenta criar/alterar `SectionVisibility`, A ACTION DEVE rejeitar.
- O `owner` da Account NÃO DEVE poder ser restrito por nenhum `SectionVisibility` (sempre `visible`).

**PRIV-02 (papel accountant):**
- QUANDO um membro `accountant` acessa dashboards/relatórios agregados ou o export, O SISTEMA DEVE permitir.
- QUANDO um membro `accountant` tenta acessar a lista ou o detalhe de transação (UI, Server Action ou API REST), O SISTEMA DEVE negar.
- QUANDO um membro `accountant` tenta qualquer mutação (criar/editar/deletar transação, seção, etc.), A ACTION DEVE rejeitar.

**PRIV-03 / Multi-tenancy:**
- QUANDO qualquer leitura/mutação roda, A ACTION DEVE começar com `requireAccountAccess(accountId)` e toda query DEVE filtrar por `accountId`, somando a restrição de visibilidade ao filtro de tenant.
- QUANDO a restrição de visibilidade é aplicada, ELA DEVE valer igualmente em RSC, Server Action, API REST e export (não pode ser só client-side).
- QUANDO um `SectionVisibility` referencia seção ou usuário de outra Account, O SERVIÇO DEVE rejeitar a criação.

## 5. Fora de Escopo

- Ocultar **transações individuais** (não a seção inteira) de um membro — granularidade fica em Section; transação fora de escopo nesta spec.
- Mascaramento parcial de valores (ex: mostrar "•••") — `aggregate` mostra total, `hidden` esconde tudo; não há nível intermediário de máscara.
- Papel `accountant` com permissão de comentar/anexar (Spec 30) — accountant é estritamente leitura agregada + export.
- Convite específico de contador por e-mail com fluxo próprio — reutiliza o fluxo de `AccountInvite` existente, apenas com `role = accountant`.
- Auditoria de quem viu o quê (access log) — fora do escopo.

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Onde aplicar a privacidade | Camada de serviço (não UI) | Cobre RSC, API REST e export de uma vez; UI sozinha vazaria |
| DD-02 | Granularidade da visibilidade | Por `Section` × membro | Seção é a unidade natural de organização; transação individual seria custosa e ruidosa |
| DD-03 | Papel contador | Novo valor `accountant` no enum existente | Menos atrito que um sistema de permissões custom; encaixa no `AccountMemberRole` atual |
| DD-04 | Default sem registro | Visibilidade total | Não quebra Accounts existentes; privacidade é opt-in pelo owner |

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| PRIV-01 schema | `prisma/schema.prisma` (enum `SectionVisibilityLevel`, model `SectionVisibility`, relações em `Account`, `Section`, `User`) |
| PRIV-02 schema | `prisma/schema.prisma` (valor `accountant` em `AccountMemberRole`) |
| Migration | `prisma/migrations/` (`add_section_visibility_and_accountant_role`) |
| Autorização/visibilidade efetiva | `src/server/api/define-action.ts` (estender `requireAccountAccess` para checar papel), `src/server/services/visibility-service.ts` |
| Aplicação nas leituras | `src/server/services/transaction-service.ts`, queries de dashboard/relatório, `src/app/api/v1/` (route handlers) |
| Export | `src/server/services/export-service.ts` (Spec 22) — respeitar visibilidade e papel `accountant` |
| Validação | `src/lib/schemas/section-visibility.ts` |
| Mensagens | `src/lib/messages/pt-BR.ts` (níveis de visibilidade, papel "Contador") |
| Testes | `src/server/services/visibility-service.test.ts` (hidden/aggregate/visible, owner imune, accountant nega detalhe, multi-tenancy) |
