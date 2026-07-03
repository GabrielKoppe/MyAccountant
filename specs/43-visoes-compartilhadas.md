# Spec 43 — Visões Compartilhadas (Por Membro)

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Colaboração
> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`dashboards-charts`](../skills/dashboards-charts/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md)

---

## 1. Problema

- **VIS-01**: `Transaction.responsibleUserId` já existe (`prisma/schema.prisma:370`), indicando quem é o responsável por uma transação, mas não há nenhum conceito de **propriedade/ownership** estrutural ("esta seção/transação é minha / de outro membro / compartilhada do household"). O responsável é uma dimensão de análise, não um rótulo de a quem aquele dado pertence.
- **VIS-02**: Não existe um **filtro de perspectiva** global. O usuário não consegue alternar a visão da aplicação entre "só o que é meu", "só o que é do membro X" e "tudo da casa (household)" de forma que dashboards, KPIs e listas reprocessem juntos. Hoje cada widget/lista só filtra por responsável de forma isolada (Spec 35 — análise por membro), sem um seletor único de perspectiva.
- **VIS-03**: Não há herança de ownership. Mesmo que existisse um rótulo por transação, marcar dezenas de transações uma a uma seria inviável; falta um default por `Section` que a transação herde, com override pontual. (É a feature "Shared Views" do Monarch, generalizada para N membros, não só casal.)

---

## 2. Solução

### 2.1 Rótulo de ownership herdado (VIS-01, VIS-03)

`Section` ganha um ownership default; `Transaction` ganha um override opcional. O ownership efetivo de uma transação é: `transaction.ownership ?? section.defaultOwnership ?? shared`.

```prisma
enum OwnershipScope {
  personal  // pertence a um membro específico (ownerUserId)
  shared    // compartilhado do household (todos os membros)

  @@map("ownership_scope")
}
```

```prisma
// Em Section:
defaultOwnership OwnershipScope @default(shared) @map("default_ownership")
defaultOwnerUserId String?      @map("default_owner_user_id") // membro dono quando personal

// Em Transaction:
ownership    OwnershipScope? @map("ownership")          // override; null = herda da seção
ownerUserId  String?         @map("owner_user_id")      // membro dono quando ownership=personal
```

- `ownerUserId` é independente de `responsibleUserId`: responsável é "quem lança/cuida"; owner é "de quem é o dinheiro/conta". Podem coincidir, mas não são a mesma coisa.
- Override por transação cobre o caso "esta seção é compartilhada, mas esta linha específica é só minha".

### 2.2 Filtro global de perspectiva (VIS-02)

- Seletor de **perspectiva** no topo da área logada com 3 modos: `mine` (ownership efetivo = personal && ownerUserId = usuário atual), `member:<userId>` (personal de outro membro) e `household` (tudo da Account — comportamento atual, default).
- A perspectiva é estado de **sessão/cliente** (não persiste como dado da Account; é preferência de visualização do usuário), propagado a dashboards, KPIs e listas. As queries de leitura (RSC) recebem o predicado de ownership derivado e o aplicam **em adição** ao filtro obrigatório de `accountId`.
- Widgets de dashboard (Spec 33/36) e listas de transação leem a perspectiva ativa e reprocessam seus dados; nenhum dado é mutado ao trocar de perspectiva.

## 3. User Stories

- Como membro de um household, quero alternar a visão entre "minhas finanças" e "as da casa", para entender meu impacto pessoal sem sair da Account compartilhada.
- Como membro, quero marcar uma seção inteira como "minha" por padrão, para não rotular cada transação manualmente.
- Como membro, quero sobrescrever o ownership de uma transação específica, para tratar uma exceção dentro de uma seção compartilhada.
- Como usuário, quero que dashboards e KPIs reflitam a perspectiva selecionada, para ver os mesmos números sob o recorte que escolhi.

## 4. Critérios de Aceitação

**VIS-01 / VIS-03 (ownership):**
- QUANDO uma transação não tem `ownership` definido, O SISTEMA DEVE usar o `defaultOwnership` da sua `Section` como ownership efetivo.
- QUANDO uma transação tem `ownership = personal` mas `ownerUserId` nulo, O SERVIÇO DEVE rejeitar a gravação (personal exige dono).
- QUANDO o `ownerUserId` (de seção ou transação) não é membro da Account, O SERVIÇO DEVE rejeitar.

**VIS-02 (perspectiva):**
- QUANDO a perspectiva é `mine`, AS LEITURAS DEVEM retornar apenas dados cujo ownership efetivo seja `personal` com `ownerUserId` = usuário atual.
- QUANDO a perspectiva é `member:<userId>`, AS LEITURAS DEVEM retornar apenas dados cujo ownership efetivo seja `personal` com `ownerUserId` = o membro selecionado.
- QUANDO a perspectiva é `household` (default), AS LEITURAS DEVEM retornar todos os dados da Account (comportamento atual inalterado).
- QUANDO o usuário troca a perspectiva, DASHBOARDS, KPIs E LISTAS DEVEM reprocessar com o mesmo recorte sem nenhuma mutação de dados.

**Multi-tenancy:**
- ENQUANTO qualquer perspectiva está ativa, O FILTRO de `accountId` DEVE permanecer aplicado — a perspectiva é um filtro **adicional**, nunca substitui o isolamento por tenant.
- QUANDO a perspectiva referencia `member:<userId>` de um usuário fora da Account, O SISTEMA DEVE ignorar e cair em `household` (sem vazamento).

## 5. Fora de Escopo

- Permissões/privacidade (ocultar dados de um membro) — coberto pela Spec 44; aqui ownership é só rótulo de visão, não controle de acesso.
- Divisão de despesas entre membros — Spec 42.
- Persistência da perspectiva como configuração da Account — é preferência de visualização do usuário (sessão/cliente).
- Ownership a nível de `FinanceTable` ou `Month` — granularidade fica em Section (herança) + Transaction (override).
- Migração automática de `responsibleUserId` para `ownerUserId` — são dimensões distintas; backfill default `shared`.

> **Nota de fronteira (Spec 60 — Atribuição por Persona, ready).** `responsible` (agora `responsiblePartyId`, party) e `ownership` (`ownerUserId` + `personal|shared`) permanecem **eixos distintos**: responsável = quem cuida/analisa; ownership = de quem é o dado / perspectiva. A party `group` da Spec 60 ("Casal") é **bucket de análise**, NÃO equivale a `ownership = shared` (household) nem substitui a perspectiva. Após Spec 60 + 42 + 43, uma transação terá três eixos de pessoa: `responsiblePartyId` (atribuição), `ownerUserId`/`ownership` (perspectiva), `ExpenseSplit.debtorUserId` (dívida). Ver `specs/60-...md`.

## 6. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| VIS-01/03 schema | `prisma/schema.prisma` (enum `OwnershipScope`; campos em `Section` e `Transaction`) |
| Migration | `prisma/migrations/` (`add_ownership_scope`, default `shared`) |
| Validação | `src/lib/schemas/section.ts`, `src/lib/schemas/transaction.ts` (personal exige owner) |
| Ownership efetivo + predicado de perspectiva | `src/server/services/ownership-service.ts` (helper `effectiveOwnership`, `perspectiveWhere`) |
| Estado de perspectiva (client) | `src/components/providers/PerspectiveProvider.tsx` + seletor no AppBar |
| Leitura RSC com perspectiva | `src/server/services/transaction-service.ts`, queries de dashboard (Spec 33/36) |
| Mensagens | `src/lib/messages/pt-BR.ts` ("Minha visão", "Visão da casa", "Visão de [membro]") |
| Testes | `src/server/services/ownership-service.test.ts` (herança, override, predicado por perspectiva, multi-tenancy) |
