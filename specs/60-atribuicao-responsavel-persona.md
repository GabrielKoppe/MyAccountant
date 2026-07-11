# Spec 60 — Atribuição de Responsável por Persona (conjunta e não-membros)

> Status: implemented (entregue 2026-07-11)
> Insumo: análise de solução (2026-07-03) — pilar Colaboração · revisão de código em `prisma/schema.prisma` (`Transaction.responsibleUserId:370`, `AccountSettings.defaultResponsibleUserId:239`, `TableTemplateItem.responsibleUserId:512`), `src/server/queries/member-analytics.ts` · review de arquitetura (architect-reviewer, veredito sound-with-changes)
> Skills: [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md)

---

## 1. Problema

- **RESP-01**: `Transaction.responsibleUserId` (`prisma/schema.prisma:370`, relação `:393`, `onDelete: SetNull`) é FK para `User` com cardinalidade **1**. Não representa **responsabilidade conjunta**: uma despesa do casal (ex.: aluguel de R$ 3.000, sem dividir quem deve o quê) precisa ser lançada no nome de um único membro, distorcendo qualquer análise "quem gastou o quê".
- **RESP-02**: `responsibleUserId` referencia `User`, portanto só aceita **quem tem login**. Não há como atribuir uma despesa a uma pessoa **fora da Account** (ex.: um filho sem conta, um dependente). O usuário não consegue nem registrar nem analisar gastos dessas pessoas.
- **RESP-03**: A resolução de identidade do responsável em `src/server/queries/member-analytics.ts:37-39,67,175-181,431-437` já carrega um caso frágil: quando o responsável **saiu da Account** (`AccountMember` removido mas `User` existe), o nome é resolvido por uma segunda query em `users` e rotulado "(ex-membro)". Isso acopla a análise histórica à existência do `User` e não sobrevive a uma futura remoção de `User`.
- **RESP-05**: O responsável hoje é sempre um `User`, exibido só como avatar/inicial (`TransactionRow.tsx:391-402`). Não há representação visual escolhível — uma persona conjunta ("Casal") ou externa ("Filho") não tem como se distinguir visualmente de forma rápida numa lista densa de transações.
- **RESP-04**: O conceito de responsável está espalhado como FK escalar para `User` em múltiplas superfícies que precisam mudar juntas: `AccountSettings.defaultResponsibleUserId` (`:239`), `TableTemplateItem.responsibleUserId` (`:512`, propagado na cópia template→transação em `src/server/services/month-service.ts:127`), o mapeamento de importação CSV (`src/lib/csv-parser.ts:317-325`, texto→userId), e o contrato REST/serializer (`src/lib/serializers/transaction.ts:24,61`).

> **Fronteira de escopo (crítica).** Esta spec trata de **atribuição** — *QUEM* é o responsável por uma transação, para agrupar, exibir e analisar. **Não** trata de **rateio de valores** — *QUEM DEVE QUANTO* em reais — que é responsabilidade exclusiva da **Spec 42** (`ExpenseSplit`, `debtorUserId`, só membros). Ver §5 e §6 DD-06.

---

## 2. Solução

### 2.1 Entidade `ResponsibleParty` (RESP-01, RESP-02)

Nova entidade **`ResponsibleParty`** (persona), sempre pertencente a uma Account (isolamento por tenant). Uma party pode ser um membro, um grupo de membros, ou uma pessoa externa sem login. `Transaction.responsibleUserId` é **substituído** por `Transaction.responsiblePartyId` (FK → `ResponsibleParty`), mantendo **cardinalidade 1** — cada transação tem no máximo uma party responsável.

```prisma
enum ResponsiblePartyKind {
  personal   // envolve exatamente 1 membro (via ResponsiblePartyMember)
  group      // envolve N membros (ex.: "Casal") — bucket de análise, nunca acesso/perspectiva
  external   // pessoa sem login (ex.: um filho); nenhum member-link

  @@map("responsible_party_kind")
}

model ResponsibleParty {
  id         String               @id @default(cuid())
  accountId  String               @map("account_id")
  name       String                                       // snapshot; para `personal` o display resolve via link (ver 2.4)
  kind       ResponsiblePartyKind
  icon       String?                                      // emoji único (ex.: "🏠", "👶") para representação visual; null → avatar/inicial derivada
  archivedAt DateTime?            @map("archived_at")      // arquivada: some dos seletores, permanece em dados históricos
  createdAt  DateTime             @default(now()) @map("created_at")
  updatedAt  DateTime             @updatedAt @map("updated_at")

  account      Account                  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  members      ResponsiblePartyMember[]
  transactions Transaction[]            @relation("TransactionResponsibleParty")

  @@unique([accountId, name])
  @@index([accountId])
  @@map("responsible_parties")
}

model ResponsiblePartyMember {
  partyId String @map("party_id")
  userId  String @map("user_id")

  party ResponsibleParty @relation(fields: [partyId], references: [id], onDelete: Cascade)
  user  User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([partyId, userId])
  @@index([userId])
  @@map("responsible_party_members")
}
```

Cardinalidade de `ResponsiblePartyMember` por `kind` (invariante de serviço, não expressável em `@@unique`):

| kind | member-links | atende |
|---|---|---|
| `personal` | exatamente 1 | membro individual (caso comum) |
| `group` | N ≥ 2 | responsabilidade conjunta (ex.: "Casal") — **RESP-01** |
| `external` | 0 | pessoa sem login — **RESP-02** |

### 2.2 Substituição do campo na transação (RESP-01, RESP-04)

- `Transaction.responsibleUserId` → **`Transaction.responsiblePartyId String? @map("responsible_party_id")`** com relação `onDelete: SetNull` (preserva a transação e o bucket "Sem responsável", espelhando o comportamento atual de `:393`).
- `AccountSettings.defaultResponsibleUserId` → **`defaultResponsiblePartyId`** (FK → `ResponsibleParty`, `onDelete: SetNull`).
- `TableTemplateItem.responsibleUserId` → **`responsiblePartyId`** (`:512`); a cópia template→transação em `month-service.ts:127` passa a copiar `responsiblePartyId`.
- Como a cardinalidade continua **1**, `groupBy(["responsiblePartyId"])` substitui `groupBy(["responsibleUserId"])` em `member-analytics.ts:115,120,271,373,378` de forma mecânica; o invariante do `sharePercent` (denominador = Σ dos grupos, cada transação contada uma única vez → shares somam 100%) é **preservado** sem reescrita algorítmica.

### 2.3 Group como bucket de análise, nunca acesso (RESP-01)

- Na análise por membro (Spec 35), uma party `group` ("Casal") aparece como **uma única linha/série própria**, com o total das transações atribuídas a ela.
- **Non-goal explícito** (ver §5): a analytics **NUNCA** explode uma party `group` de volta nos membros constituintes. Fan-out do total de um grupo para seus membros seria ponderação de valor = rateio = Spec 42.
- `group` é **exclusivamente** dimensão de análise. **Não** é construto de acesso, propriedade ou perspectiva — isso é `ownership` (Spec 43). Ver §6 DD-05.

### 2.4 Precedência de nome de exibição (RESP-03)

O display do responsável NÃO lê cegamente `party.name`. Precedência:

1. Party `personal` cujo member-link aponta para um **`AccountMember` atual** → nome resolvido **ao vivo** via `ResponsiblePartyMember → User` (`User.name` ?? `User.email`). Renome de membro continua refletindo.
2. Party `external` ou `group` → usa `party.name` (snapshot editável pelo usuário).
3. Party `personal` cujo member-link aponta para `User` **que saiu da Account** → `party.name` (snapshot) + sufixo "(ex-membro)" (`m.dashboards.members.formerMemberSuffix`). Substitui a segunda query em `users` de `member-analytics.ts:166-173,421-429` — a party carrega o nome e sobrevive à remoção do `User`.
4. `responsiblePartyId = null` → bucket "Sem responsável" (`m.dashboards.members.unassigned`), inalterado.

### 2.5 CRUD de parties e seleção (RESP-01, RESP-02)

- Nova seção **"Responsáveis"** em Account Settings (Spec 05): listar/criar/editar/arquivar parties. Criar `group` = nome + emoji + seleção de ≥ 2 membros; criar `external` = nome + emoji. Parties `personal` são geridas automaticamente (§3, uma por membro) e não editáveis manualmente exceto arquivamento e escolha de emoji.
- **Emoji/ícone (RESP-05).** Ao criar/editar uma party, o usuário pode escolher um emoji (`icon`) para representá-la visualmente. `null` → fallback: party `personal` usa avatar/inicial do membro (comportamento atual de `TransactionRow.tsx:391-402`); `group`/`external` usam inicial do nome. O emoji aparece no seletor, nos chips de filtro e na exibição da transação.
- O seletor de responsável em `NewTransactionRow.tsx:289`, `TransactionRowEditor.tsx:279` e `TransactionDetailDialog.tsx` passa a listar **parties** (não membros), agrupadas: pessoais (membros) → grupos → externas, cada uma com seu emoji/avatar, com ação inline "+ Criar responsável" (abre `DialogShell`). Parties arquivadas não aparecem no seletor mas continuam exibindo em transações históricas.
- Default em `GeneralSettingsForm.tsx:107` passa a ser um select de party.

---

## 3. Migração de dados (RESP-04)

Migração de dados idempotente e re-executável, por Account (isolamento por tenant):

1. **Criar parties `personal`.** Para cada `AccountMember` atual **e** cada `responsibleUserId` legado distinto presente em `transactions`/`table_template_items`/`account_settings` daquela Account, criar uma `ResponsibleParty` `personal` (se ainda não existir) com um `ResponsiblePartyMember` para aquele `userId`. `name` = snapshot de `User.name ?? User.email`.
   - **Dedup obrigatória por `(accountId, userId)`**: um `userId` que é membro atual **e** aparece como responsável legado gera **uma só** party. Guard de idempotência = existência do link `personal (accountId, userId)`.
   - Um mesmo `User` em N Accounts → N parties (uma por `accountId`). O `accountId` da party garante o isolamento.
   - Responsáveis legados que já saíram da Account (ex-membros) geram party `personal` normalmente (nome via `User`); ficam disponíveis para o display item 2.4.3.
2. **Backfill `Transaction.responsiblePartyId`** = id da party `personal` do `responsibleUserId` legado (via mapa `(accountId, userId) → partyId`). `responsibleUserId = null` → `responsiblePartyId = null`.
3. **Backfill `TableTemplateItem.responsiblePartyId`** análogo.
4. **Backfill `AccountSettings.defaultResponsiblePartyId`** = party `personal` de `defaultResponsibleUserId` naquela Account; se o user não resolve para nenhuma party (sem membership e sem transação) → `null`.
5. **Depreciação do campo legado.** Em migração inicial, manter a coluna `responsibleUserId` (nullable) para rollback. Remover em migração posterior, após validação. O contrato REST (`/api/v1`, Spec 14) e `serializers/transaction.ts:24,61` expõem `responsibleUserId` — tratar como **breaking change de API**: expor `responsibleParty` novo e depreciar `responsibleUserId` com janela de versão, não rename silencioso.

Nenhuma party `group`/`external` é criada por migração — são criadas pelo usuário sob demanda.

---

## 4. Critérios de Aceitação

**RESP-01 (atribuição conjunta):**
- QUANDO o usuário cria uma party `group` com N membros, O SERVIÇO DEVE exigir N ≥ 2 `ResponsiblePartyMember` e rejeitar (`ActionResult` erro) se N < 2.
- QUANDO uma transação é atribuída a uma party `group`, A ANÁLISE POR MEMBRO (Spec 35) DEVE exibir essa party como **uma única linha/série** com o total integral da transação, e NÃO DEVE distribuir o valor entre os membros do grupo.
- QUANDO qualquer análise agrega despesa por responsável, A SOMA dos `sharePercent` dos grupos DEVE permanecer 100% (cada transação contada uma vez, pois a cardinalidade transação→party é 1).

**RESP-02 (não-membros):**
- QUANDO o usuário cria uma party `external`, O SERVIÇO DEVE aceitar apenas nome (sem `userId`) e criar a party com **zero** `ResponsiblePartyMember`.
- QUANDO uma transação é atribuída a uma party `external`, O SISTEMA DEVE permitir exibir e analisar essa despesa normalmente, sem exigir que exista um `User`/`AccountMember` correspondente.
- SE alguém tenta ratear (Spec 42) uma transação cuja responsável é `external`, A SPEC 42 DEVE rejeitar (o devedor precisa ser `AccountMember`) — atribuição a não-membro não implica dívida.

**RESP-03 (identidade robusta):**
- QUANDO o display resolve o nome de uma party `personal` cujo membro é `AccountMember` atual, O SISTEMA DEVE usar o nome **ao vivo** do `User` (name ?? email), refletindo renomes.
- QUANDO o membro de uma party `personal` saiu da Account, O SISTEMA DEVE exibir `party.name` (snapshot) + sufixo "(ex-membro)".
- QUANDO um `User` referenciado por um member-link é deletado, A PARTY DEVE sobreviver (o link é removido via `onDelete: Cascade` no link, não na party), preservando a atribuição histórica.

**RESP-05 (emoji/ícone):**
- QUANDO o usuário cria/edita uma party, O SISTEMA DEVE permitir escolher um emoji (`icon`) opcional; SE nenhum for escolhido, O DISPLAY DEVE cair no fallback (avatar/inicial do membro p/ `personal`, inicial do nome p/ `group`/`external`).
- QUANDO uma party com `icon` é exibida no seletor, nos chips de filtro ou na linha da transação, O SISTEMA DEVE renderizar o emoji escolhido.
- O CAMPO `icon` DEVE aceitar apenas um único caractere de emoji (validação Zod), NÃO uma string arbitrária.

**RESP-04 (cardinalidade e invariantes de kind):**
- QUANDO uma party `personal` é criada/editada, O SERVIÇO DEVE garantir exatamente 1 member-link; `group` ≥ 2; `external` = 0.
- QUANDO uma transação, item de template ou default é gravado com um `responsiblePartyId`, O SERVIÇO DEVE rejeitar se a party pertencer a outra Account.

**Multi-tenancy:**
- QUANDO qualquer action de CRUD de party/atribuição é chamada, A ACTION DEVE começar com `requireAccountAccess(accountId)` e toda query Prisma DEVE filtrar por `accountId`.
- QUANDO um `responsiblePartyId` informado pertence a outra Account, O SERVIÇO DEVE rejeitar (sem vazamento entre tenants).

**Migração:**
- QUANDO a migração roda, CADA `(accountId, userId)` DEVE gerar no máximo uma party `personal` (dedup), e re-executar a migração NÃO DEVE criar duplicatas.
- QUANDO a migração termina, TODA transação com `responsibleUserId` não-nulo DEVE ter `responsiblePartyId` apontando para a party `personal` correspondente.

---

## 5. Fora de Escopo

- **Rateio de valores — quem deve quanto — ver Spec 42** (`ExpenseSplit`, `debtorUserId`). Esta spec é atribuição (quem é responsável), não divisão de dívida. Uma transação pode ter party `group` como responsável **e** splits de dívida entre membros — eixos ortogonais.
- **Fan-out do total de uma party `group` para seus membros** na analytics — seria ponderação de valor = rateio (Spec 42).
- **Ownership / perspectiva** (`ownership = shared`, `ownerUserId`, filtro "minhas finanças / da casa") — é a Spec 43, eixo distinto. `group` desta spec ≠ `shared` da 43.
- **Privacidade / controle de acesso a dados de um membro** — Spec 44.
- **Múltiplas parties por transação (N:N)** — rejeitado; quebraria o invariante do `sharePercent` sem virar rateio. Cardinalidade permanece 1.
- **Hierarquia/aninhamento de parties** (grupo dentro de grupo) — não previsto.

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Modelo de atribuição conjunta + não-membro | Entidade `ResponsibleParty` (persona) com cardinalidade 1 na transação | Único modelo que atende conjunta E não-membros com uma abstração; preserva `groupBy` e o invariante do `sharePercent`. N:N quebraria o denominador da análise sem virar rateio. |
| DD-02 | Rejeição de multi-responsável (N:N) | Descartado | Uma despesa conjunta contada para 2 membros faz Σ membros > `grandTotal` (`member-analytics.ts:183,439`) → shares > 100%; corrigir = ratear = Spec 42. |
| DD-03 | Composição da party | Join `ResponsiblePartyMember` (personal=1, group=N, external=0) | O link `personal→membro` é consumido pela resolução de nome ao vivo (2.4). Links de `group` são descritivos (composição), sem consumidor de fan-out. |
| DD-04 | Resolução de nome | Ao vivo via link para membros atuais; snapshot `party.name` para external/group/desanexadas | Evita trocar o bug "(ex-membro)" atual por nomes congelados; corrige RESP-03 preservando renomes. |
| DD-05 | `group` vs `ownership = shared` (Spec 43) | Manter `group` como **bucket de análise**, com non-goal explícito de nunca ser acesso/perspectiva | Decisão do desenvolvedor (2026-07-03): atende atribuição conjunta como rótulo positivo ("Casal"); ownership é eixo distinto (de quem é o dado), ainda draft. |
| DD-06 | Fronteira com Spec 42 | `responsiblePartyId` (atribuição) e `ExpenseSplit.debtorUserId` (dívida, member-only) não se referenciam | Eixos ortogonais no schema. O **pagador** do split (Spec 42 §2.1) NÃO pode ser derivado de `responsiblePartyId` (ambíguo p/ `group`, inexistente p/ `external`) — deve usar `createdById` ou campo de pagador explícito. |
| DD-07 | onDelete | party→account Cascade; tx→party SetNull; link→party Cascade; link→user Cascade (remove o link, não a party) | Remoção de membro/User nunca apaga party; atribuição histórica sobrevive. Espelha o SetNull atual de `schema:393`. |
| DD-08 | Coluna legada + API | Manter `responsibleUserId` nullable p/ rollback; remover em migração posterior; API depreca campo com versão | Rename direto é breaking change no contrato `/api/v1` (Spec 14) e serializers. |
| DD-09 | Representação visual da party | Campo `icon` (emoji único, opcional) + fallback avatar/inicial | Distingue personas (conjunta/externa) numa lista densa; emoji único (não string livre) evita abuso e mantém layout. |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar | Anchor atual |
|---|---|---|
| RESP-01/02/04 schema | `prisma/schema.prisma` (enum `ResponsiblePartyKind`; models `ResponsibleParty`, `ResponsiblePartyMember`; `Transaction.responsiblePartyId`; `AccountSettings.defaultResponsiblePartyId`; `TableTemplateItem.responsiblePartyId`; relações em `Account`, `User`) | `:239`, `:370`, `:393`, `:512`; `Account:163`, `User:83` |
| Migração de dados | `prisma/migrations/` (`add_responsible_party` + backfill idempotente + `drop_responsible_user_id` posterior) | §3 |
| Domain model | `specs/01-domain-model.md` (novo agregado `ResponsibleParty`) | CLAUDE.md §7 exige atualizar ao criar campo/entidade |
| Validação | `src/lib/schemas/responsible-party.ts` (novo: kind, membros por kind, nome, `icon` = emoji único), `src/lib/schemas/transaction.ts:34` (`responsibleUserId`→`responsiblePartyId`), `src/lib/schemas/settings.ts:9`, `src/lib/schemas/table-template.ts:15`, `src/lib/schemas/csv-import.ts:25,31` | blast radius |
| RESP-05 emoji | picker de emoji na UI "Responsáveis" e no "+ Criar responsável" (`DialogShell`); render de `icon` no seletor, chips (`ActiveFilterChips.tsx`) e `TransactionRow.tsx:391-402` (fallback avatar) | — |
| Lógica | `src/server/services/responsible-party-service.ts` (novo: CRUD, invariantes de kind, multi-tenancy) | — |
| Actions | `src/actions/responsible-parties.ts` (novo, `defineAction`) | — |
| Analytics (rename mecânico) | `src/server/queries/member-analytics.ts` (`groupBy(["responsiblePartyId"])` + resolução de nome via party, 2.4) | `:115,120,271,373,378`; `:37-39,67,166-181,421-437`; `sharePercent :56,183,439` |
| Filtros/KPI/sandbox/budget | `src/server/queries/kpi-custom.ts:38`, `filtered-transactions.ts:26`, `sandbox.ts:201,257`, `budgets.ts:218`, `src/server/services/budget-service.ts:132` | rename campo |
| Serviços | `src/server/services/transaction-service.ts:60,101-102,189`, `month-service.ts:127` (copy), `account-settings-service.ts:13,27`, `finance-table-service.ts:92,146`, `table-template-service.ts:46,76,104,217,297`, `csv-import-service.ts:148,262,374` | rename campo |
| Import CSV | `src/lib/csv-parser.ts:75,317-321` (`responsibleUserMappings` texto→`partyId`; ganha poder de mapear texto→party `external`), `src/components/csv-import/StepMapping.tsx:233-237,888-974` | melhoria |
| Contrato/serializer | `src/lib/serializers/transaction.ts:24,61` + rotas `/api/v1` (Spec 14) — deprecação versionada, não rename | DD-08 |
| UI seleção | `src/components/transactions/NewTransactionRow.tsx:289`, `TransactionRowEditor.tsx:279`, `TransactionRow.tsx:391-402`, `TransactionDetailDialog.tsx:153,296-298`, `TransactionFilterDrawer.tsx:114-118,408-435` (via `DialogShell`, tokens semânticos) | seletor party |
| UI settings | `src/app/(app)/[accountId]/settings/general/GeneralSettingsForm.tsx:107` (default party); nova UI "Responsáveis" (via `PageHeader`/`EmptyState`/`DialogShell`) | Spec 05 |
| Mensagens | `src/lib/messages/pt-BR.ts` (labels de kind, "Responsáveis", "Grupo", "Externo", "+ Criar responsável"; reaproveitar `:651,741,304-305,1196-1204`) | i18n central |
| Testes | `responsible-party-service.test.ts` (kinds, invariantes, multi-tenancy, migração idempotente), atualizar `member-analytics.test.ts:28-236` (groupBy por party, shares 100%), `export-service.test.ts`, `csv-parser.test.ts:327-357` | Spec 13 |
