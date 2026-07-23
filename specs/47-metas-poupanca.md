# Spec 47 — Metas de Poupança e Hub de Planejamento

> Status: approved
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Profundidade Financeira; refinado por entrevista de produto + arquitetura (2026-07-22); entrevista de refinamento com aterramento no código (2026-07-22)
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`dashboards-charts`](../skills/dashboards-charts/SKILL.md) · [`dashboard-widgets`](../skills/dashboard-widgets/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md) · [`ui-feedback`](../skills/ui-feedback/SKILL.md)

---

## 1. Problema

- **GOAL-01**: A spec 25 (`Budget`, `prisma/schema.prisma:620`) entrega **limites de gasto** — "não gastar mais que X". Não existe o conceito oposto: **meta de acúmulo** ("juntar R$ 20.000 para a viagem até dezembro"), com valor-alvo e prazo.
- **GOAL-02**: Sem meta de acúmulo, não há **acompanhamento de progresso** (quanto já foi guardado vs. alvo) nem projeção de conclusão no ritmo atual. Goals é feature central em YNAB e Monarch.
- **GOAL-03**: Não há suporte **colaborativo** a metas: numa account com vários membros (casal/família), é impossível rastrear quanto cada membro contribuiu para uma meta conjunta. O `Budget` filtra por membro, mas não acumula contribuições.
- **GOAL-04** (IA / colisão de rótulo): o que a UI chama **"Metas"** hoje é o `Budget` (`m.budgets.nav = "Metas"`, `pt-BR.ts:1586`), enterrado em **settings** (`settings/budgets/page.tsx`). A account tem duas páginas hero *forward-looking* — **Patrimônio** (`/net-worth`, spec 46) e **Projeção** (`/forecast`, spec 48) — mas **planejamento** (limites + metas) não tem superfície primária: vive escondido em configurações. Introduzir "meta de acúmulo" também chamada "Metas" criaria **dois "Metas"** ambíguos.
- **GOAL-05**: a dimensão opcional de uma meta (`sectionId`/`categoryId`) — pensada "para sugerir contribuições a partir de transações relacionadas" — ficaria **inerte** sem uma superfície que a ative.
- **GOAL-06**: uma barra de progresso sozinha responde "quanto", não "**estou no ritmo?**". Sem destacar o ritmo (adiantado/atrasado) e a trajetória vs. o ideal, o dado mais acionável fica escondido — mesmo problema que a spec 48 resolveu para o fluxo de caixa (FC-04/05).

---

## 2. Solução

Introduzir **`Goal`** (meta de acúmulo com alvo e prazo) e **`GoalContribution`** (aportes rastreados por membro), e **elevar planejamento a superfície primária** via um **hub "Planejamento"** com duas abas — **Metas** (acúmulo, esta spec) e **Orçamento** (limites, comportamento do `Budget` da spec 25). Valores em `BigInt` centavos. Progresso é **derivado** (soma de contribuições), nunca persistido.

> **Esta spec (47) é a fonte única da superfície de planejamento.** O hub, as abas, os rótulos, as metas e a superfície de orçamento nascem/moram aqui. A spec 25 fica **superseded na superfície** (gestão migra para a aba Orçamento); o *comportamento* do `Budget` (modelo, cálculo, dimensões, combinações) permanece documentado na 25 como **referência**, sem duplicação (DRY) — ver §3.5.

### 2.1 Domínio (GOAL-01/02/03)

- **GOAL-01**: modelo `Goal` com `targetCents`, `deadline` opcional, dimensão opcional (`sectionId`/`categoryId`) e `archivedAt` opcional (ciclo de vida — ver §6 DD-02).
- **GOAL-02**: progresso = Σ `GoalContribution.amountCents`; **derivado por leitura** (§4). Widget/página exibem barra, %, aporte mensal necessário e **projeção de conclusão** no ritmo atual.
- **GOAL-03**: `GoalContribution` carrega `byUserId` (membro que aportou — base do split) e, opcionalmente, `responsiblePartyId` (persona/party, herdada da transação vinculada — consistência com spec 60) e `transactionId` (vínculo ao lançamento).

```prisma
model Goal {
  id          String    @id @default(cuid())
  accountId   String    @map("account_id")
  name        String                              // "Viagem ao Japão", "Reserva de emergência"
  targetCents BigInt    @map("target_cents")
  deadline    DateTime? @db.Date                  // prazo opcional
  sectionId   String?   @map("section_id")        // dimensão opcional p/ sugerir aportes (GOAL-05)
  categoryId  String?   @map("category_id")
  isAchieved  Boolean   @default(false) @map("is_achieved")   // auto-flag ao cruzar o alvo (DD-06)
  archivedAt  DateTime? @map("archived_at")        // null = ativa; preenchido = fora do agregado, histórico preservado (DD-02)
  createdById String    @map("created_by_id")      // scalar (padrão BalanceAccount, spec 46) — sem relação
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  account       Account            @relation(fields: [accountId], references: [id], onDelete: Cascade)
  section       Section?           @relation(fields: [sectionId], references: [id], onDelete: SetNull)
  category      Category?          @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  contributions GoalContribution[]

  @@index([accountId])
  @@map("goals")
}

model GoalContribution {
  id                String   @id @default(cuid())
  accountId         String   @map("account_id")
  goalId            String   @map("goal_id")
  amountCents       BigInt   @map("amount_cents")
  contributedOn     DateTime @map("contributed_on") @db.Date
  byUserId          String   @map("by_user_id")            // membro que aportou (base do split, GOAL-03)
  responsiblePartyId String? @map("responsible_party_id")  // persona/party opcional (herda da tx vinculada — spec 60)
  transactionId     String?  @map("transaction_id")        // vínculo opcional ao lançamento
  notes             String?
  createdAt         DateTime @default(now()) @map("created_at")

  account         Account          @relation(fields: [accountId], references: [id], onDelete: Cascade)
  goal            Goal             @relation(fields: [goalId], references: [id], onDelete: Cascade)
  byUser          User             @relation("GoalContributor", fields: [byUserId], references: [id], onDelete: Restrict)
  responsibleParty ResponsibleParty? @relation(fields: [responsiblePartyId], references: [id], onDelete: SetNull)
  transaction     Transaction?     @relation(fields: [transactionId], references: [id], onDelete: SetNull)

  @@index([accountId])
  @@index([goalId])
  @@map("goal_contributions")
}
```

Relações inversas: `Account` ganha `goals Goal[]` e `goalContributions GoalContribution[]`; `User` ganha `goalContributions GoalContribution[] @relation("GoalContributor")`; `ResponsibleParty` (`schema.prisma:292`) ganha `goalContributions GoalContribution[]`; `Transaction` (`schema.prisma:433`) ganha `goalContributions GoalContribution[]`; `Section` ganha `goals Goal[]`; `Category` ganha `goals Goal[]`.

> **Atribuição do aporte (DD-01)**: `byUserId` é a base do "split por membro" (colaboradores = `User` reais, via `AccountMember`; `schema.prisma:222`). `responsiblePartyId` é **opcional** e serve à consistência com o modelo de atribuição de transação do app (`Transaction.responsiblePartyId`, `schema.prisma:449` → `ResponsibleParty`, persona/party da spec 60) — preenchido **apenas** quando o aporte é criado a partir de uma transação vinculada (herda a party dela). Não há seletor manual de party no v1.

### 2.2 Hub "Planejamento" — superfície primária (GOAL-04)

Espelha o par **página hero + item no AppBar** já consolidado por Patrimônio (spec 46) e Projeção (spec 48), combinado com o **sub-nav** de settings:

- **Rota `/[accountId]/planning`** — hub com **abas** (route-driven): **Metas** (`/planning/goals`) e **Orçamento** (`/planning/budgets`). `/planning` redireciona para `/planning/goals`.
- **Item no AppBar** "Planejamento" (`AppBarNavButtons.tsx`), inserido entre "Membros" e "Patrimônio", formando o cluster de heros *forward-looking*: **Planejamento · Patrimônio · Projeção**.
- **Aba Metas**: nova (esta spec) — hero agregado + cards de meta + detalhe por meta.
- **Aba Orçamento**: superfície de gestão do `Budget` **reconstruída com a linguagem da aba Metas** (cards, hero de KPIs, `StatusBadge`, `PageHeader`), substituindo a tela de `settings/budgets`. **Reusa o comportamento intacto** do Budget (service, queries, schema, dimensões, cálculo); só a **apresentação** é harmonizada e a **rota** muda. Coeso com a aba Metas — uma superfície única de planejamento.

### 2.3 Nomenclatura (GOAL-04)

- O rótulo pt-BR do `Budget` migra de **"Metas" → "Orçamento"** (o termo correto de mercado; a própria spec 25 se intitula "Metas de Orçamento"). Namespace `m.budgets.*` mantido, **valores** renomeados (§11 tabela C13).
- **"Metas"** passa a designar exclusivamente as metas de acúmulo desta spec, em um **namespace novo `m.goals.*`**.
- Nomes de modelo/código permanecem em inglês (`Budget`, `Goal`) — regra §5.10 do CLAUDE.md. A mudança é só de **rótulo de UI**.

### 2.4 Ativação da dimensão e ritmo (GOAL-05/06)

- **GOAL-05**: **aportes sugeridos** — na aba Metas, uma meta com dimensão sugere vincular transações relacionadas ainda não aportadas. Reusa o **padrão de mapeamento dimensão→where** do Budget (`budget-service.ts:127-138`); a **query é nova** (não há query genérica de "transações por dimensão não-vinculadas" a reusar — `getBudgetsWithProgress` agrega por-orçamento, não serve). É **sugestão confirmável**, nunca aporte automático.
- **GOAL-06**: **badge de ritmo** (adiantado/no prazo/atrasado/atingida/sem aportes) + **gráfico glide-path** (acúmulo real vs. ritmo ideal) — a leitura visual do "estou no caminho?".

### 2.5 Widget secundário (opt-in)

Widget `goal-progress` no dashboard **`yearly`**, `defaultVisible: false` — espelha `net-worth-evolution`/`cashflow-forecast`. Reflete as metas ativas da account; **sem config por-instância**. Conteúdo por `renderMode` (§5.10). Superfície secundária; a casa canônica é a aba Metas.

---

## 3. Como interage com o que existe hoje

Âncoras `arquivo:linha` verificadas no código (entrevista de refinamento, 2026-07-22). **Nenhum dado novo é inventado além de `Goal`/`GoalContribution`** — o resto lê/combina o que já existe.

### 3.1 Grafo de dados

| Campo novo | Pluga em | Existente? |
|---|---|---|
| `Goal.sectionId` / `categoryId` | FK → `Section` (`schema.prisma:382`) / `Category` (`:493`) | sim — mesmas dimensões do `Budget` |
| `GoalContribution.byUserId` | FK → `User` (membro; `AccountMember.userId` `:224` é a identidade) | sim |
| `GoalContribution.responsiblePartyId?` | FK → `ResponsibleParty` (`:292`, persona/party — spec 60) | sim |
| `GoalContribution.transactionId?` | FK → `Transaction` (`:433`), `onDelete: SetNull` | sim |
| progresso | Σ `GoalContribution.amountCents` | derivado (não persiste) |

> **Modelo de atribuição do app** (aterrado): a `Transaction` atribui por **`responsiblePartyId`** (`schema.prisma:449` → `ResponsibleParty`), **não** por `responsibleUserId` (campo inexistente; o texto da spec 25 está defasado). `ResponsibleParty` (`enum ResponsiblePartyKind { personal, group, external }`, `:284`) mapeia a `User` via `ResponsiblePartyMember` (`:315`). Por isso o split da meta usa `byUserId` (membro real), e `responsiblePartyId` fica opcional (herdado da tx) — o split "por membro" não seria join-consistente com a tx só com party.

### 3.2 Reuso do par hero+widget (Patrimônio como template)

A feature inteira espelha arquivos reais do Patrimônio:

| Novo | Espelha / reusa |
|---|---|
| `planning/goals/page.tsx` (RSC) | `net-worth/page.tsx:10-37` (`params` Promise, `requireAccountAccess`, `Promise.all`, `canEdit` por role) |
| `GoalsManager.tsx` (client) | `net-worth/NetWorthManager.tsx:79-85` (props `{ accountId, overview, canEdit }` + tipos derivados `Awaited<ReturnType<…>>`) |
| queries `goals.ts` | `src/server/queries/net-worth.ts:49,66,82` (`cache()`, multi-tenant, cents-as-string) |
| serializer | `src/lib/serializers/balance-account.ts` (`BigInt→string`, `Date→"YYYY-MM-DD"`) |
| actions `goals.ts` | `src/actions/net-worth.ts:15-22` (`defineAction`, `EDITOR_ROLES`, `revalidateGoals` em `@/server/api/revalidate`) |
| chart glide-path | `src/components/net-worth/NetWorthEvolutionChart.tsx:15` + wrapper `dynamic({ ssr:false })` (`NetWorthManager.tsx:66-72`) |
| widget `goal-progress` | `NetWorthEvolutionWidget.tsx` + registry `widget-registry.ts:532-539` + icon `widget-icons.ts:98` + wiring `YearlyDashboardClient.tsx:254-258` + gate `dashboards/yearly/[year]/page.tsx:98,117,147` |

### 3.3 Shell do hub

- **Roteamento**: app usa `src/app/(app)/[accountId]/…` — **sem** segmento `[locale]` (pt-BR hardcoded). A spec 25 cita `[locale]` por defasagem.
- **AppBar**: `AppBarNavButtons.tsx:24` monta rotas inline `` `/${accountId}/…` ``; itens em `:26-73` (Patrimônio `:48-51`, Projeção `:59-62`), renderizado por `[accountId]/layout.tsx:72`.
- **Abas**: `planning/layout.tsx` espelha `settings/layout.tsx:24-39` (array `{href,label}` → nav) mas renderiza **`<Tabs>`** (`PlanningNav`) em vez do `SettingsNav`. Redirect de `/planning` espelha `dashboards/page.tsx:17`.

### 3.4 Aportes sugeridos (GOAL-05) — reuso e limite

`getBudgetTransactions`/`getBudgetsWithProgress` (`budget-service.ts:105`, `budgets.ts:149`) agregam **por dimensão de um orçamento específico** — não existe query genérica reusável. O que se reusa é o **mapeamento dimensão→where** (`budget-service.ts:127-138`: `sectionId`→`where.sectionId`, `categoryId`→`where.categoryId`, gasto = `amountCents > 0n` em `:124`). A query de sugestões é **nova**: `findMany` de transações da dimensão da meta, no mês fiscal corrente, com `amountCents > 0` e **não vinculadas a nenhuma `GoalContribution`**.

> **Semântica**: a dimensão da meta deve apontar para uma section/categoria que representa o **ato de poupar** (transferência para poupança/investimento), não uma categoria de gasto. A sugestão usa a **magnitude** (`abs`) — consistente com a convenção de "gasto positivo" do repo (`calculateMonthTotal`, `month-service.ts:215`; `SectionCountType` `:34`). `byUserId` = usuário logado (editável); `responsiblePartyId` herdado da transação.

### 3.5 Budget (spec 25) — superseded na superfície, comportamento intocado

Esta spec (47) passa a ser a **fonte única da superfície de planejamento**. A spec 25 fica *superseded na superfície*.

- **Muda (superfície)**: a gestão do Budget sai de `settings/budgets` e é **reconstruída** como a aba Orçamento em `/planning/budgets`, com a **mesma linguagem visual da aba Metas** (§5.9). A entrada `{ href: "budgets" }` sai de `settings/layout.tsx:35`; rótulos pt-BR "Meta(s)" → "Orçamento(s)" (§11 C13); **3 sites de código** com rota absoluta viram `/planning/budgets` (§11 blast radius).
- **NÃO muda (comportamento intacto — referência na 25)**: modelo `Budget`, `budget-service.ts`, `src/actions/budgets.ts`, `src/lib/schemas/budget.ts`, cálculo de progresso, dimensões, combinações, `alertThresholdPercent`, `isRecurring`, `showInSummary`, os widgets `budgets`/`kpi-budget-health` (monthly/month_summary), e a criação de orçamento a partir do dashboard mensal. A nova superfície **reusa** service/queries/schema — nada da lógica é reescrito ou duplicado na 47.
- **Efeito na spec 25**: recebe um header de status "superseded na superfície — ver spec 47" e tem o critério §4 (gerir em settings) reescrito para o hub. As seções de **comportamento** da 25 continuam válidas como referência (§12 Fase 12). Não é só ponteiro — o critério aprovado muda, mas o comportamento não.

---

## 4. Modelo de cálculo

Separação (convenção do repo): `queries/` = acesso a dados + `React.cache`; `services/` = lógica pura testável. `goal-service.ts` concentra a matemática (sem Prisma, unit-testável), `queries/goals.ts` carrega e serializa.

Tudo em `bigint`; divisão via `BigInt(Math.round(Number(x) / n))` (skill money-handling — nunca `bigint / bigint`, que trunca). `*Cents` serializados como `string` na fronteira. **Só metas com `archivedAt = null` entram no agregado e nas listas ativas** (DD-02).

### 4.1 Progresso e conclusão

```
progressCents      = Σ contributions.amountCents                        (por meta)
remainingCents     = max(0, targetCents − progressCents)
percent            = Number(progressCents) / Number(targetCents) * 100   (render only; barra cap 100%, DD-05)
isAchieved         = progressCents ≥ targetCents                          (grava/recomputa na escrita, DD-06)
```

### 4.2 Aporte mensal necessário (se `deadline`)

```
monthsToDeadline    = max(1, mesesFiscais(currentFiscal → deadline))     (getCurrentFiscalMonth, month_start_day)
requiredMonthlyCents= remainingCents > 0 ? BigInt(round(Number(remainingCents)/monthsToDeadline)) : 0n
```

### 4.3 Projeção de conclusão no ritmo atual + badge de ritmo (GOAL-06)

```
firstMonth      = menor contributedOn (fiscal); elapsed = max(1, mesesFiscais(firstMonth → currentFiscal)+1)
avgMonthlyCents = progressCents > 0 ? BigInt(round(Number(progressCents)/elapsed)) : 0n
monthsToComplete= avgMonthlyCents > 0 ? ceil(Number(remainingCents)/Number(avgMonthlyCents)) : null
projectedMonth  = monthsToComplete != null ? addMonths(currentFiscal, monthsToComplete) : null

pace =
  isAchieved                                   → "achieved"
  sem contribuições                            → "no_contribution"
  sem deadline                                 → "on_track"
  projectedMonth ≤ deadline                    → (avgMonthly > requiredMonthly*1.05 ? "ahead" : "on_track")
  senão                                        → "behind"
```

### 4.4 Glide-path (série do gráfico)

Para cada mês fiscal do intervalo [início da meta … deadline (ou projeção)]:
- **`cumulativeCents`** = Σ contribuições com `contributedOn` ≤ fim do mês (carry-forward, espelha `net-worth-service` `buildMonthlySeries`).
- **`idealCents`** (só se `deadline`) = linear de `0` no início a `targetCents` no `deadline`.
- **`targetCents`** = linha de referência horizontal constante.

### 4.5 Split por membro (GOAL-03)

`Σ amountCents` agrupado por `byUserId` → `{ userId, userName, totalCents, percent }[]`. `userName` via relação `byUser`. **Split é por membro (`User`), não por persona** (fronteira com spec 42/60, §8).

### 4.6 Agregado da aba Metas (hero) — só metas ativas (não-arquivadas)

```
totalSavedCents  = Σ progressCents das metas ativas
totalTargetCents = Σ targetCents das metas ativas
contributedThisMonthCents = Σ amountCents com contributedOn no mês fiscal corrente
nextDeadlineGoal = meta ativa com deadline mais próximo (não atingida)
counts           = { onTrack (on_track+ahead), behind, achieved, noContribution }   (entre as ativas; os 4 buckets reconciliam com o total de metas ativas — noContribution = não-iniciada)
```

---

## 5. UX / UI

### 5.1 Shell do hub

```
┌ AppBar: [Dashboards][Membros][Planejamento▸][Patrimônio][Projeção][Config] ┐
│ PageHeader "Planejamento"                                                    │
│ Tabs:  ● Metas    ○ Orçamento                                                │
└─────────────────────────────────────────────────────────────────────────┘
```
`PlanningNav` = MUI `<Tabs>` route-driven (`router.push` do segmento; aba ativa por `usePathname`). `PageHeader` com ação contextual: "Nova meta" (aba Metas) / "Novo orçamento" (aba Orçamento).

### 5.2 Aba Metas

```
┌ Hero KPIs (KpiCard, mono tabular-nums) ─────────────────────────────────┐
│ Guardado R$14.000 / R$50.000 (28%) · Este mês +R$3.500 · Próxima: Japão dez│
└─────────────────────────────────────────────────────────────────────────┘
┌ Viagem Japão ────────────────┐ ┌ Reserva emergência ─┐
│ ▓▓▓▓▓░░░░░░░ 45%              │ │ ▓▓▓▓▓▓▓▓░░ 72%       │
│ R$9.000 / R$20.000           │ │ R$7.200 / R$10.000   │
│ 🟡 Atrasado · R$1.833/mês     │ │ 🟢 No prazo          │
│ [Aportar]              [⋮]    │ │ [Aportar]      [⋮]   │
└──────────────────────────────┘ └──────────────────────┘   [ + Nova meta ]
```

- **Hero**: `KpiCard`s (guardado/alvo + %, aportado no mês, próxima a vencer, contagem no prazo/atrasadas) — só metas ativas.
- **Cards** (grid responsivo): nome · barra de progresso · alvo · **badge de ritmo** (`StatusBadge`) · aporte mensal necessário (se `deadline`) · ação `Aportar` (primária) + menu `⋮` (editar / detalhe / **arquivar** / excluir).
- Card clica → **drawer de detalhe** (§5.3).
- **Metas arquivadas** em seção/filtro separado ("Arquivadas"), fora do agregado; permitem desarquivar.
- 0 metas ativas → `<EmptyState icon={<SavingsIcon/>} title description action>`.
- `viewer` → sem `Aportar`/`Nova meta`/`⋮` de mutação (só leitura; sugestões ocultas).

### 5.3 Detalhe da meta (drawer via `DialogShell`)

```
Viagem Japão                                    [Editar] [Arquivar] [Excluir]
R$9.000 / R$20.000 (45%) · vence dez/2026 · 🟡 Atrasado · faltam R$1.833/mês
──────────────── Glide-path (chart) ────────────────
 acúmulo real (sólido) vs ritmo ideal (tracejado) · linha-alvo
── Split por membro ──   Gabriel R$5.400 (60%) ▓▓▓▓▓▓ · Ana R$3.600 (40%) ▓▓▓▓
── Aportes sugeridos ──  R$500 em [Poupança] este mês, não vinculados  [Vincular]
── Histórico ──          15/jul Gabriel +R$1.000 🔗TED · 02/jul Ana +R$800
```

### 5.4 Gráfico glide-path

Espelha `NetWorthEvolutionChart` (recharts, lazy `ssr:false`, `getChartColors(mode)`, `ChartTooltip`, **zero hex**):
- **Área/linha sólida** (`palette[0]`) = `cumulativeCents`.
- **Linha tracejada** (`strokeDasharray="5 4"`) = `idealCents` — só se há `deadline`.
- **`ReferenceLine` horizontal** = `targetCents` (`stroke=theme.palette.divider`).
- Tooltip → `formatCentsToBrl(BigInt(raw))`. `Number(BigInt(str))/100` **só** no render.
- Testar **light e dark**.

### 5.5 Badge de ritmo (cor = significado)

| `pace` | `StatusBadge` | Texto |
|---|---|---|
| `achieved` | `success` | "Atingida" + microcelebração (marcos 25/50/75/100%) |
| `on_track` | `success` | "No prazo" |
| `ahead` | `success` | "Adiantado" |
| `behind` | `warning` | "Atrasado" |
| `no_contribution` | `neutral` | "Sem aportes" |

Cor pareada com texto/ícone (§5.11 CLAUDE.md) — nunca vermelho decorativo.

### 5.6 Fluxos (dialogs — `DialogShell` + RHF + `zodResolver`)

| Dialog | Campos | Padrão |
|---|---|---|
| **Criar/editar meta** | nome · alvo (`NumericFormat`) · deadline opcional (`TextField type="date"`) · dimensão opcional (`Select` section/categoria via `Controller`) | `CreateInstallmentDialog` |
| **Aportar** | valor (`NumericFormat`) · data (`type=date`, default hoje) · notas opcional · vínculo a transação opcional · `byUserId` = usuário logado (auto) · `responsiblePartyId` herdado da tx (sem seletor manual) | idem |
| **Vincular sugerido** | 1 clique → cria `GoalContribution { amountCents: abs(tx), transactionId, responsiblePartyId: tx.responsiblePartyId, byUserId: ctx.userId, contributedOn }`; confirma antes | inline no drawer |

Datas: **não há DatePicker no projeto** — `<TextField type="date" InputLabelProps={{ shrink: true }}>`. Dinheiro: `NumericFormat` + `customInput={TextField}`, máscara BRL → `BigInt` centavos na borda.

### 5.7 Display de valores

Alvo/progresso em **mono tabular-nums** neutro (KPI); a **barra** carrega a cor semântica e satura em 100% mesmo com over-aporte (DD-05), com o excedente exibido ("R$ X acima do alvo"). Poupança é positiva → sem o problema de "passivo verde" do net worth; `MoneyValue` cru serve para aportes.

### 5.8 Estados obrigatórios

Loading (`ChartSkeleton`/skeleton) · empty (`EmptyState`) · **light + dark** (`getChartColors`) · role (`viewer` read-only, `EDITOR_ROLES` nas mutações).

### 5.9 Aba Orçamento (harmonizada)

Superfície de gestão do Budget **reconstruída** com a linguagem da aba Metas: `PageHeader` (ação "Novo orçamento"), hero de KPIs (ex.: total orçado, em risco, ultrapassados), **cards de orçamento** com barra de progresso + `StatusBadge` (ok/atenção/ultrapassado, reusando os limiares do Budget), `EmptyState`, dialog criar/editar via `DialogShell` (reusa `BudgetFormDialog`/schema). **Cálculo, dimensões e combinações do Budget intactos** — só a apresentação muda. Rótulos "Meta(s)" → "Orçamento(s)" (§11 C13). Widgets `budgets`/`kpi-budget-health` (monthly/month_summary) seguem intactos, só rótulo.

### 5.10 Widget `goal-progress` — conteúdo por `renderMode` (≥3 variantes)

| `renderMode` | Conteúdo |
|---|---|
| `compact` | Top 3 metas ativas (por deadline mais próximo): mini-barra + % · sem legenda |
| `default` | Todas as metas ativas: barra + badge de ritmo + alvo |
| `expanded` | + glide-path da meta mais próxima do prazo + "aportado no mês" |

Cada variante adiciona conteúdo real (regra do skill `dashboard-widgets`). Componente lê `renderMode`, nunca `w`/`h`. `WidgetContainer` + `EmptyState` quando sem metas ativas.

---

## 6. User Stories

- Como usuário, quero criar uma meta de poupança com valor-alvo e prazo (ex: "R$ 20.000 até dez/2026"), para ter um objetivo claro de acúmulo.
- Como usuário, quero registrar aportes para uma meta, para ver o progresso aumentar em direção ao alvo.
- Como membro de uma account colaborativa, quero que minha contribuição a uma meta conjunta seja registrada no meu nome, para sabermos quanto cada um aportou.
- Como usuário, quero ver uma barra de progresso, o aporte mensal necessário e a estimativa de quando atingirei a meta no ritmo atual, para me planejar.
- Como usuário, quero acessar planejamento (metas e orçamentos) numa página primária dedicada, não escondido em configurações, para tratá-lo como parte central do app.
- Como usuário, quero arquivar uma meta atingida ou abandonada sem apagá-la, para limpar a lista ativa mantendo o histórico.
- **(GOAL-05)** Como usuário, quero que o app sugira vincular como aporte as transações relacionadas à dimensão da meta, para não redigitar valores que já lancei.
- **(GOAL-06)** Como usuário, quero saber num relance se estou adiantado ou atrasado em relação ao prazo, para agir a tempo.

---

## 7. Critérios de Aceitação

**GOAL-01 — Meta**
- QUANDO o usuário cria uma `Goal`, O SISTEMA DEVE exigir `name` e `targetCents` (`BigInt`, > 0, centavos); `deadline` é opcional. NÃO DEVE usar `Float`.
- QUANDO o usuário cria/edita/arquiva/exclui `Goal` ou registra/exclui `GoalContribution`, O SISTEMA DEVE exigir papel `owner` ou `editor`; `viewer` só lê.
- QUANDO o usuário arquiva uma `Goal` (`archivedAt` preenchido), ela NÃO DEVE entrar no agregado nem nas listas ativas, MAS seu histórico de contribuições DEVE ser preservado; desarquivar (`archivedAt = null`) DEVE reativá-la.

**GOAL-02 — Progresso e conclusão**
- QUANDO o progresso é lido, O SISTEMA DEVE calcular Σ `GoalContribution.amountCents` **derivado** (não persistir campo de progresso).
- QUANDO Σ contribuições ≥ `targetCents`, O SISTEMA DEVE marcar `isAchieved = true`; QUANDO cai abaixo (edição de alvo para cima, exclusão de aporte), DEVE recomputar para `false`.
- QUANDO o progresso ultrapassa o alvo, A BARRA DEVE saturar em 100% e O SISTEMA DEVE exibir o percentual real e o excedente.
- SE a `Goal` possui `deadline`, O SISTEMA DEVE expor o aporte mensal necessário (`remaining / mesesRestantes`) e a projeção de conclusão no ritmo atual (§4.3).

**GOAL-03 — Colaborativo**
- QUANDO o usuário registra uma `GoalContribution`, O SISTEMA DEVE gravar `amountCents` (`BigInt`), `contributedOn` (`date`) e `byUserId` = usuário autenticado (nunca do body).
- O SISTEMA DEVE expor o split por membro (Σ por `byUserId`, com nome e percentual). O split NÃO DEVE ser por persona.
- QUANDO uma `GoalContribution` é vinculada a `transactionId`, O SISTEMA DEVE validar que a transação pertence à mesma account e DEVE herdar `responsiblePartyId` da transação; SE a transação não pertencer, DEVE rejeitar.
- SE `responsiblePartyId` for informado, O SISTEMA DEVE validar que pertence à mesma account (IDOR).

**GOAL-04 — Hub / nomenclatura**
- O SISTEMA DEVE expor `/[accountId]/planning` com abas Metas (`/planning/goals`) e Orçamento (`/planning/budgets`); `/planning` DEVE redirecionar para `/planning/goals`.
- O AppBar DEVE conter o item "Planejamento".
- A gestão de `Budget` DEVE ser acessível pela aba Orçamento e NÃO DEVE mais aparecer em `settings` (entrada removida de `settings/layout.tsx`); os 3 sites de código com rota absoluta (`insights-service.ts:175`, `revalidate.ts:56`, e o teste `insights-service.test.ts:13`) DEVEM apontar para `/planning/budgets`.
- O rótulo pt-BR do `Budget` DEVE ser "Orçamento(s)"; "Metas" DEVE designar apenas as metas de acúmulo (namespace `m.goals.*`). O modelo/código `Budget` NÃO DEVE ser renomeado.
- A reconstrução da superfície de Orçamento NÃO DEVE alterar o cálculo, as dimensões, as combinações nem os schemas do `Budget` — DEVE reusar o comportamento existente; só a apresentação e a rota mudam.

**GOAL-05 — Aportes sugeridos**
- SE a `Goal` tem dimensão (`sectionId`/`categoryId`), O SISTEMA DEVE sugerir transações relacionadas do mês fiscal corrente, com `amountCents > 0`, ainda não vinculadas a nenhuma `GoalContribution`, reusando o mapeamento de dimensão do `Budget`.
- O aporte a partir de sugestão DEVE ser **confirmado pelo usuário** (nunca automático), usar a magnitude (`abs`) da transação e herdar seu `responsiblePartyId`.

**GOAL-06 — Ritmo**
- O SISTEMA DEVE expor o `pace` (`achieved`/`on_track`/`ahead`/`behind`/`no_contribution`, §4.3) e o widget/página DEVE exibi-lo como `StatusBadge` com cor por significado.
- O gráfico glide-path DEVE renderizar acúmulo real (sólido), ritmo ideal (tracejado, se `deadline`) e linha-alvo, com cores do tema em **light e dark**, nunca hex.

**Multi-tenancy**
- QUANDO qualquer query lê/grava `Goal`/`GoalContribution`, ela DEVE filtrar por `accountId`. Um usuário NÃO DEVE aportar em/ler meta de outra account, mesmo informando um `goalId`/`transactionId`/`responsiblePartyId` válido de terceiro. `accountId` sempre de `ctx`; todo FK recebido validado por account.

---

## 8. Fora de Escopo

- **Dedução automática do patrimônio líquido** ao aportar — integração com spec 46 fica para spec futura. O aporte é registro isolado; **não** escreve `BalanceSnapshot`.
- **Movimentação real de dinheiro / saldo bancário** — aporte é registro, não transfere saldo (Open Finance = spec 52).
- **Criação/edição de `Transaction`** — a meta só **lê** e **vincula** transações; nunca cria.
- **Split por persona/party** — o split da meta é por **membro (`User`)**; recortes por persona ficam com spec 60. Não confundir com **divisão de despesas entre membros** (spec 42) — são features distintas.
- **Seletor manual de `responsiblePartyId` no aporte** — a party só é preenchida por herança da transação vinculada no v1.
- **Sub-metas / metas aninhadas** — uma meta é plana neste escopo.
- **Aporte automático por regra** — só sugestão confirmável; automação de categorização é spec 50. O recurso de aportes sugeridos fica **inerte** se a meta não tiver dimensão ou se o usuário não modela poupança como seção/categoria.
- **Lembretes/notificações push de aporte ou de atraso** — spec 29; aqui o badge de ritmo é anotação **passiva**.
- **Metas de redução de dívida** — spec 51.
- **Projeção geral de fluxo de caixa** — spec 48; a meta responde só "quando atinjo *este* alvo", que a 48 §8 explicitamente cede à 47.
- **Mudança de comportamento/modelo do `Budget`** — a spec 47 só **reconstrói a superfície** (apresentação + rota + rótulos) do Budget e reusa a lógica; o comportamento (modelo, cálculo, dimensões, combinações) fica intocado e documentado na spec 25 como referência (25 fica *superseded na superfície*, não no comportamento — §12 Fase 12).
- **Metas anuais de orçamento / outras mudanças na 25** — permanecem como a spec 25 define.
- **Multi-moeda** — assume a `currency` da account (BRL).

---

## 9. Portas abertas para o futuro

- **Dedução no patrimônio**: ao atingir/aportar, refletir em `BalanceSnapshot` (integração 46) — troca de efeito, mesmo contrato de aporte.
- **Vínculo pelo painel de transação** (spec 27): botão "atribuir a meta" no detalhe da transação, criando `GoalContribution` — sem tocar o modelo.
- **Split/análise por persona** (spec 60): `responsiblePartyId` já gravado habilita recortes por persona sem migration.
- **Notificação de meta atingida/atrasada** (spec 29): o `pace`/`isAchieved` já expostos viram gatilho.
- **Sub-metas / cofrinhos** e **alocação por classe** — extensões futuras sobre o mesmo `Goal`.

---

## 10. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Atribuição do aporte | `byUserId` obrigatório + `responsiblePartyId` opcional (herda da tx) | Split é sobre membros reais (`User`); personas incluem group/external. Party opcional dá consistência com o modelo de atribuição de tx (spec 60) sem forçar persona no split |
| DD-02 | Ciclo de vida | `archivedAt DateTime?` (espelha `BalanceAccount`) | Ativa = não-arquivada; arquivada sai do agregado, histórico preservado (glide-path honesto). Padrão provado (spec 46) |
| DD-03 | Progresso | Derivado de Σ `GoalContribution` | Evita campo redundante propenso a divergir; espelha net worth (derivado de snapshots) |
| DD-04 | Widget `goal-progress` | `yearly`, `defaultVisible:false`, lista→glide-path por `renderMode` | Espelha 46/48; mostra o conjunto de relance; casa canônica é a aba Metas |
| DD-05 | Over-aporte | Barra satura 100%; % real + excedente exibidos | Progresso pode passar do alvo; barra > 100% quebra layout |
| DD-06 | `isAchieved` | Auto-flag recomputado em toda escrita (aporte, exclusão, edição de alvo) | Fonte única derivada; evita flag preso a estado velho |
| DD-07 | Aporte sugerido | Reusa só o mapeamento dimensão→where; query nova; confirmável; `abs` | Não há query genérica reusável; automação seria spec 50; magnitude bate com "gasto positivo" |
| DD-08 | `Goal` vs `Budget` | Modelos separados | Acúmulo (alvo) ≠ limite (teto); conceitos opostos |
| DD-09 | Superfície | Hub "Planejamento" unificado (abas Metas + Orçamento), primário | Planejamento merece hero como Patrimônio/Projeção; não pode viver em settings |
| DD-10 | Nomenclatura | `Budget` rótulo → "Orçamento"; "Metas" → acúmulo (`m.goals.*`) | Vocabulário de mercado (YNAB/Monarch); desfaz colisão de rótulo |
| DD-11 | Superfície do `Budget` | Reconstruída na aba Orçamento com a linguagem da aba Metas; comportamento reusado, não duplicado | Coesão pro usuário (uma superfície de planejamento) sem reescrever/duplicar a lógica estável do Budget |
| DD-12 | Ritmo ideal | Linear (0→alvo no `deadline`) | Explicável; suficiente para orientar sem modelo estatístico |
| DD-13 | Centralização | 47 = fonte única da superfície; 25 superseded na superfície, comportamento como referência | Atende "tudo numa coisa só" sem violar DRY nem arriscar divergência do código estável da 25 |

---

## 11. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Modelos `Goal`/`GoalContribution` + relações + migration `add_goals` | `prisma/schema.prisma` |
| Schemas Zod (meta + aporte + arquivar) | `src/lib/schemas/goal.ts` (novo) |
| Service (CRUD + arquivar + progresso/ritmo/glide-path/split/sugestões) | `src/server/services/goal-service.ts` (novo) |
| Queries (overview, detalhe, sugestões, série do widget) | `src/server/queries/goals.ts` (novo) |
| Serializer `BigInt`/`Date` → string | `src/lib/serializers/goal.ts` (novo) |
| Actions | `src/actions/goals.ts` (novo) + `revalidateGoals` em `src/server/api/revalidate.ts` |
| Hub shell | `src/app/(app)/[accountId]/planning/{layout,page}.tsx` + `PlanningNav` (novos) |
| Aba Metas | `planning/goals/page.tsx` + `GoalsManager.tsx` (novos) |
| Aba Orçamento | `planning/budgets/page.tsx` (novo) → renderiza `BudgetsManager` (movido) |
| Gráfico glide-path | `src/components/goals/GoalGlidePathChart.tsx` (novo) |
| Widget `goal-progress` | `widget-registry.ts` (yearly) · `widget-icons.ts` · `panels/GoalProgressWidget.tsx` · `YearlyDashboardClient.tsx` · `dashboards/yearly/[year]/page.tsx` (gate) · `queries/dashboards.ts` |
| Nav AppBar | `src/components/ui/AppBarNavButtons.tsx` |
| Remoção de settings | `src/app/(app)/[accountId]/settings/layout.tsx:35` |
| **Blast radius rota absoluta** | `src/server/services/insights-service.ts:175` · `src/server/api/revalidate.ts:56` · `src/server/services/insights-service.test.ts:13` (`settings/budgets` → `planning/budgets`) |
| Atribuição/persona (consumir) | `Transaction.responsiblePartyId` `schema.prisma:449` · `ResponsibleParty` `:292` · `personalPartyIdsForUsers` `src/server/queries/responsible-party-filter.ts:11` |
| Mapeamento dimensão (reusar padrão) | `budget-service.ts:127-138` (spend `amountCents > 0n` `:124`) |
| Labels | `src/lib/messages/pt-BR.ts` (novo `m.goals.*` + rename `m.budgets.*` — tabela C13) |
| Superseded da spec 25 | `specs/25-budget-targets.md` (header de status + reescrever critério §4: settings → aba Orçamento; comportamento permanece) |

### Padrões de referência

**Multi-tenancy por re-fetch + validação de FKs (service, espelha `net-worth`/`institution-service`):**
```ts
async function assertGoalOwned(id: string, ctx: ActionContext) {
  const row = await prisma.goal.findUnique({ where: { id }, select: { accountId: true } });
  if (!row || row.accountId !== ctx.accountId) throw new NotFoundError("Meta");
}
// aporte: accountId SEMPRE de ctx. Validar transactionId E responsiblePartyId (se houver) pela mesma account (IDOR).
// isAchieved recomputado após create/delete de aporte e após update de targetCents (DD-06).
```

**Aportes sugeridos — query NOVA (reusa só o mapeamento de dimensão, `budget-service.ts:127-138`):**
```ts
// transações da dimensão da meta, mês fiscal corrente, gasto positivo, NÃO vinculadas a NENHUMA meta.
const where = { accountId: ctx.accountId, monthId, amountCents: { gt: 0n },
  ...(goal.sectionId ? { sectionId: goal.sectionId } : {}),
  ...(goal.categoryId ? { categoryId: goal.categoryId } : {}),
  goalContributions: { none: {} } };            // ✅ ainda não aportadas
// ao vincular: amountCents = abs(tx.amountCents); responsiblePartyId = tx.responsiblePartyId; byUserId = ctx.userId.
```

**Fronteira BigInt (serializer, espelha `transaction.ts`):**
```ts
export type SerializedGoal = {
  id: string; name: string; targetCents: string; progressCents: string;
  percent: number; deadline: string | null; isAchieved: boolean; archivedAt: string | null;
  pace: "achieved" | "on_track" | "ahead" | "behind" | "no_contribution";
  requiredMonthlyCents: string | null; projectedMonth: string | null;
  sectionId: string | null; categoryId: string | null;
};
// BigInt→.toString(); date-only→.toISOString().slice(0,10). No client: parseLocalDate (nunca new Date("YYYY-MM-DD")).
```

**Nav AppBar (espelha bloco "Patrimônio", `AppBarNavButtons.tsx:48-51`):**
```tsx
<Tooltip title={m.goals.navLabel}>            {/* "Planejamento" */}
  <IconButton component={Link} href={`/${accountId}/planning`}><SavingsIcon /></IconButton>
</Tooltip>
// inserir entre "Membros" (:37-40) e "Patrimônio" (:48-51) → cluster Planejamento·Patrimônio·Projeção.
```

**Rename sweep (exemplo — `pt-BR.ts`):**
```ts
// ❌ antes                          →  ✅ depois
budgets: { nav: "Metas",            →  budgets: { nav: "Orçamento",
  createButton: "Nova meta",        →    createButton: "Novo orçamento",
  progress: { goalsTitle: "Metas do mês" } }  →  progress: { goalsTitle: "Orçamentos do mês" } }
// novo namespace, sem colisão:
goals: { navLabel: "Planejamento", title: "Metas", newGoal: "Nova meta", contribute: "Aportar", /* … */ }
```

---

## 12. Plano de Implementação (centralizado)

> Guia de execução (§1–11 são a fonte da verdade). **Executar só após `Status: approved`.** Todo dev roda **dentro do container** (`docker compose exec app …`) — sem `pnpm` no host. **Não** criar branch/worktree nem rodar git; trabalhar na working tree. Ao terminar cada fase: `typecheck` + `lint` (arquivos novos limpos) + testes da fase; marcar o checkbox e atualizar status.

**Convenções fixadas** (consistência entre fases): service `goal-service.ts`; queries `goals.ts`; actions `goals.ts`; serializer `SerializedGoal`/`serializeGoal`; widget id `"goal-progress"`; rota `/${accountId}/planning`; namespace `m.goals.*`; `EDITOR_ROLES = ["owner","editor"]`.

### Fase 0 — Schema & migration · *Haiku*
Colar `Goal` (com `archivedAt`) + `GoalContribution` (com `responsiblePartyId`) (§2.1) + relações inversas (`Account`, `User`, `ResponsibleParty`, `Transaction`, `Section`, `Category`). `prisma format && validate`; `migrate dev --name add_goals`; `generate`. **DoD**: `onDelete` explícito em todas as relações (`byUser` Restrict; `responsibleParty`/`transaction`/`section`/`category` SetNull; `account`/`goal` Cascade); migration aplicada.

### Fase 1 — Schemas Zod · *Sonnet*
`src/lib/schemas/goal.ts`: `createGoalSchema` (name, targetCents>0, deadline? não-passada, sectionId?/categoryId?), `updateGoalSchema`, `archiveGoalSchema` (goalId, archived:boolean), `addContributionSchema` (goalId, amountCents>0, contributedOn não-futura, transactionId?, responsiblePartyId?, notes?), `deleteContributionSchema`. **Testes**: alvo ≤0 falha; deadline/contributedOn inválidas; amountCents `BigInt`. **DoD**: `typecheck` + testes verdes.

### Fase 2 — Service + testes · *Sonnet (Opus se glide-path travar)*
`goal-service.ts`: CRUD (multi-tenancy por re-fetch), `archiveGoal`, `addContribution` (valida `transactionId` **e** `responsiblePartyId` na account; herda party da tx; recalcula `isAchieved`), `deleteContribution` (recalcula `isAchieved`), e **puros**: `computeProgress`, `computePace`/projeção (§4.3), `buildGlidePath` (§4.4), `computeMemberSplit`, `computeGoalsOverview` (só ativas). **Testes**: cross-account (goal/tx/party) → `NotFoundError` + mutação `not.toHaveBeenCalled`; `isAchieved` ao cruzar alvo e ao cair (delete/edição); over-aporte; `pace` (behind/on_track/ahead/no_contribution); glide-path carry-forward; arquivada fora do agregado; divisão BigInt sem truncar. **DoD**: partes puras sem `import prisma`; testes verdes.

### Fase 3 — Serializer · *Haiku*
`src/lib/serializers/goal.ts` (`SerializedGoal`, §11, com `archivedAt`). **DoD**: `typecheck` ok; nenhum `BigInt`/`Date` cru.

### Fase 4 — Queries + revalidate · *Sonnet*
`src/server/queries/goals.ts` (`cache()`, multi-tenant, filtram `archivedAt: null` para ativas): `getGoalsOverview`, `getArchivedGoals`, `getGoalDetail(goalId)` (glide-path + split + histórico), `getGoalSuggestions(goalId)` (§3.4/§11, query nova), `getGoalProgressForYear(accountId, year)` (widget). `revalidateGoals` em `revalidate.ts`. **DoD**: toda query filtra `accountId`; cents como string.

### Fase 5 — Actions + testes · *Sonnet*
`src/actions/goals.ts` (`defineAction` + `EDITOR_ROLES` + `revalidateGoals`): create/update/delete/archive goal, addContribution, deleteContribution, linkSuggestedContribution. **Testes** (padrão `net-worth.test.ts`): viewer → `FORBIDDEN`; input inválido → `VALIDATION`; cross-account (goal/tx/party) → `NotFoundError`. **DoD**: testes verdes.

### Fase 6 — Labels + Nav · *Haiku*
Adicionar `m.goals.*` (navLabel "Planejamento", title "Metas", cards, dialogs, pace, empty, tooltip glide-path, "Arquivar"/"Arquivadas"). Adicionar item "Planejamento" no `AppBarNavButtons.tsx` (§11, entre Membros e Patrimônio, `SavingsIcon`). **DoD**: sem string hardcoded; ícone no AppBar.

### Fase 7 — Hub shell · *Sonnet*
`planning/layout.tsx` (`PageHeader` + `PlanningNav` `<Tabs>` route-driven), `planning/page.tsx` (redirect → `goals`). **DoD**: abas navegam por rota; aba ativa por `usePathname`; light+dark.

### Fase 8 — Aba Metas (página + manager) · *Sonnet*
`planning/goals/page.tsx` (RSC, `requireAccountAccess`, `getGoalsOverview` + `getArchivedGoals`, `canEdit`) + `GoalsManager.tsx` (hero KPIs, grid de cards, badge de ritmo, seção Arquivadas, `EmptyState`, dialogs criar/editar/aportar/arquivar via `DialogShell`+RHF, estado otimista + `useActionFeedback` + `useTransition`). **DoD**: criar/aportar/arquivar funciona; viewer read-only; light+dark; empty state; over-aporte satura barra.

### Fase 9 — Glide-path chart + detalhe · *Sonnet*
`src/components/goals/GoalGlidePathChart.tsx` (§5.4, lazy `ssr:false`) + drawer de detalhe (glide-path + split por membro + aportes sugeridos + histórico + vincular sugerido). **DoD**: chart em light+dark, tooltip `formatCentsToBrl`, sem hex; vínculo sugerido cria contribuição herdando party da tx.

### Fase 10 — Widget `goal-progress` (yearly) · *Sonnet (checklist 6 passos do skill)*
Registrar `goal-progress` em `widget-registry.ts` (yearly, `defaultVisible:false`, ≥3 `sizeVariants` §5.10) · label+desc em `pt-BR.ts` · ícone (`SavingsIcon`) em `widget-icons.ts` · `queries/dashboards.ts` (`getGoalProgressForYear`) · `panels/GoalProgressWidget.tsx` (adapta por `renderMode`: compact/default/expanded, §5.10) · wiring em `YearlyDashboardClient.tsx` · fetch **gated** em `dashboards/yearly/[year]/page.tsx`. **DoD**: aparece na paleta yearly; some quando não visível (fetch gated); 3 variantes com conteúdo real.

### Fase 11 — Aba Orçamento harmonizada + rename sweep · *Sonnet*
1. **Superfície nova** `planning/budgets/page.tsx` + manager harmonizado (linguagem da aba Metas — §5.9), **reusando** `budget-service`, queries de budget, `src/lib/schemas/budget.ts` e `BudgetFormDialog` (restilizar/reusar). **Não** reescrever a lógica do Budget. Aposentar a tela `settings/budgets`.
2. Remover `{ href: "budgets" }` de `settings/layout.tsx:35`.
3. **Blast radius**: `insights-service.ts:175` (`budgetsHref`), `revalidate.ts:56` (`revalidatePath`) e o teste `insights-service.test.ts:13` → `/planning/budgets`.
4. **Rename sweep** `pt-BR.ts` (tabela C13): "Meta(s)" → "Orçamento(s)".
**DoD**: Orçamento gerido na aba (visual coeso com Metas); ausente em settings; `grep` "Metas" nos rótulos do budget zerado; testes do budget (incl. `insights-service.test.ts`) verdes; comportamento do Budget inalterado (mesmos testes de `budget-service` passam sem edição).

**Tabela C13 — chaves a renomear** (`src/lib/messages/pt-BR.ts`):

| chave | linha | de → para |
|---|---|---|
| `budgets.title` | 1585 | "Metas de Orçamento" → "Orçamentos" |
| `budgets.nav` | 1586 | "Metas" → "Orçamento" |
| `budgets.createButton` / `createTitle` | 1587–1588 | "Nova meta" → "Novo orçamento" |
| `budgets.editTitle` / `deleteTitle` | 1589–1590 | "…meta" → "…orçamento" |
| `budgets.deleteConfirm` | 1591 | "…esta meta?" → "…este orçamento?" |
| `budgets.noMetas` / `noMetasHint` | 1592–1593 | "…meta(s)…" → "…orçamento(s)…" |
| `budgets.created/updated/deleted` | 1594–1596 | "Meta …" → "Orçamento …" |
| `budgets.progress.goal` | 1616 | "Meta" → "Orçamento" |
| `budgets.progress.goalsTitle` | 1620 | "Metas do mês" → "Orçamentos do mês" |
| `budgets.progress.summaryTitle` | 1621 | "Metas" → "Orçamentos" |
| `budgets.progress.noGoals` | 1622 | "…meta ativa…" → "…orçamento ativo…" |
| `budgets.progress.addGoal` | 1623 | "Adicionar meta" → "Adicionar orçamento" |
| `budgets.progress.collapse/expandGoals` | 1624–1625 | "…metas" → "…orçamentos" |
| widget config `showOnlyAll` | 241 | "Todas as metas" → "Todos os orçamentos" |
| `viewBudgetAction` | 1144 | "Ver metas" → "Ver orçamentos" |
| widget label `budgets` (monthly/summary) | 1161, 1207 | "Metas de Orçamento" → "Orçamentos" |
| widget desc `budgets` | 1229, 1275 | "…metas de orçamento" → "…orçamentos" |
| widget desc `kpi-budget-health` | 1243 | "…metas de orçamento" → "…orçamentos" |
| insights desc | 1236, 1281 | "…metas em risco…" → "…orçamentos em risco…" |

### Fase 12 — Amendment spec 25, skill & verificação final · *Sonnet*
1. **Spec 25 superseded na superfície**: adicionar header de status no topo da 25 — "Superseded na superfície pela spec 47: gestão, superfície e rótulos migraram para o hub `/planning` (aba Orçamento); o comportamento do Budget documentado abaixo permanece a referência." Reescrever o critério §4 ("criar/editar/deletar metas na página de configurações, sub-seção 'Metas'") → "gerir orçamentos na aba Orçamento do hub `/planning`". Corrigir o path `[locale]` → `(app)`. As seções de **comportamento** da 25 permanecem intactas.
2. Estender `skills/dashboards-charts` com o padrão glide-path (linha real + ideal + alvo).
3. `docker compose exec app pnpm typecheck && pnpm lint && pnpm test`.
4. Checagem manual: light **e** dark; multi-tenancy (não abrir meta de outra account por id); badge de ritmo; glide-path; split por membro; aporte sugerido herda party; over-aporte; arquivar/desarquivar; Budget na aba Orçamento e fora de settings; deep-link de insight abre `/planning/budgets`.
**DoD**: `typecheck`+`lint`+`test` verdes; checklist manual ok; spec 25 com amendment.

### Ordem de dependências

```
Fase 0 ─┬─ 1 ─┬─ 2 ─┬─ 4 ─┬─ 5 ── 8 ── 9 ── 10
        │     ├─ 3 ─┘     │
        │     └───────────┘
        └─ 6 (labels/nav) ── 7 (shell) ── 8
        11 (realocação Budget) — paralelizável após 7 (precisa do shell/aba)
        12 (amendment 25 + verificação) — depende de tudo
```
