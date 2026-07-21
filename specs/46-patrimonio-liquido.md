# Spec 46 — Patrimônio Líquido (Net Worth)

> Status: approved
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Profundidade Financeira · entrevista de refinamento de produto (2026-07-20)
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`dashboards-charts`](../skills/dashboards-charts/SKILL.md)

---

## 1. Problema

- **NW-01**: O domínio inteiro modela **fluxo** (transações organizadas por mês → seção → tabela, ver `prisma/schema.prisma` model `Transaction`). Não existe representação de **estoque patrimonial**: o usuário não consegue cadastrar uma conta corrente, um investimento, um imóvel (ativos) nem um empréstimo ou saldo de cartão (passivos).
- **NW-02**: Sem ativos e passivos cadastrados, é impossível calcular o **patrimônio líquido** (ativos − passivos) — a tela "hero" de todo PFM premium (Monarch, Copilot). O usuário só vê o resultado do mês, nunca a foto consolidada do que possui.
- **NW-03**: Não há histórico de saldo ao longo do tempo. Mesmo que o usuário anote saldos manualmente em transações/notas, não há como traçar a **evolução do patrimônio** mês a mês.

---

## 2. Solução

Introduzir contas patrimoniais e fotos de saldo (snapshots), com cálculo derivado de patrimônio líquido e sua evolução temporal. Atualização de saldo é **manual** neste escopo.

- **NW-01**: novo modelo `BalanceAccount` (conta patrimonial) com `kind` (`asset` | `liability`), `name`, `institutionId` opcional e `archivedAt` (nullable — arquivamento).
- **NW-02**: cálculo de net worth = soma dos snapshots mais recentes de ativos − soma dos snapshots mais recentes de passivos, sempre em `BigInt` centavos. O número atual é exibido numa **página hero dedicada** (`/[accountId]/net-worth`), com variação vs. mês anterior.
- **NW-03**: novo modelo `BalanceSnapshot` (saldo de uma conta em uma data), permitindo série temporal por **carry-forward mensal** (ver §6 DD-02) e um **widget de evolução** no dashboard `yearly`.

A entrada de saldo tem dois caminhos: uma tela **"Atualizar saldos"** (lote — lista as contas ativas com o último saldo pré-preenchido, grava N snapshots numa mesma data) e a **edição avulsa** de um snapshot específico (correção de histórico). Ambos fazem upsert idempotente garantido por `@@unique([balanceAccountId, capturedOn])`.

```prisma
enum BalanceAccountKind {
  asset
  liability

  @@map("balance_account_kind")
}

model BalanceAccount {
  id            String             @id @default(cuid())
  accountId     String             @map("account_id")
  kind          BalanceAccountKind                         // imutável após a criação (ver §6 DD-05)
  name          String                                     // "Conta Nubank", "Apartamento", "Financiamento do carro"
  institutionId String?            @map("institution_id")
  archivedAt    DateTime?          @map("archived_at")     // null = ativa; preenchido = data de corte do carry-forward (ver §6 DD-03)
  createdById   String             @map("created_by_id")
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")

  account     Account           @relation(fields: [accountId], references: [id], onDelete: Cascade)
  institution Institution?      @relation(fields: [institutionId], references: [id], onDelete: SetNull)
  snapshots   BalanceSnapshot[]

  @@index([accountId])
  @@index([accountId, kind])
  @@map("balance_accounts")
}

model BalanceSnapshot {
  id               String   @id @default(cuid())
  accountId        String   @map("account_id")
  balanceAccountId String   @map("balance_account_id")
  balanceCents     BigInt   @map("balance_cents")   // saldo do ativo/passivo na data; passivo é positivo (valor devido). Pode ser negativo (ex.: cheque especial num ativo)
  capturedOn       DateTime @map("captured_on") @db.Date
  createdById      String   @map("created_by_id")
  createdAt        DateTime @default(now()) @map("created_at")

  account        Account        @relation(fields: [accountId], references: [id], onDelete: Cascade)
  balanceAccount BalanceAccount @relation(fields: [balanceAccountId], references: [id], onDelete: Cascade)

  @@unique([balanceAccountId, capturedOn])
  @@index([accountId])
  @@index([balanceAccountId, capturedOn])
  @@map("balance_snapshots")
}
```

`Account` ganha as relações `balanceAccounts BalanceAccount[]` e `balanceSnapshots BalanceSnapshot[]`. `Institution` ganha `balanceAccounts BalanceAccount[]`.

---

## 3. User Stories

- Como membro de uma account, quero cadastrar minhas contas, investimentos e bens como ativos, para ter o quadro completo do que possuo.
- Como membro de uma account, quero cadastrar empréstimos e saldos de cartão como passivos, para saber quanto devo.
- Como usuário, quero ver meu patrimônio líquido (ativos − passivos) em um único número e sua evolução ao longo dos meses, para acompanhar se estou progredindo.
- Como usuário, quero atualizar de uma vez o saldo de várias contas numa data ("Atualizar saldos"), para registrar a foto do mês sem repetir o fluxo conta por conta.
- Como usuário, quero corrigir o saldo de uma conta numa data passada, para acertar o histórico sem depender de integração bancária.
- Como usuário, quero arquivar uma conta que não tenho mais (bem vendido, dívida quitada) sem apagar o histórico, para que a curva de evolução continue honesta no passado.

---

## 4. Critérios de Aceitação

**NW-01 — Contas patrimoniais**

- QUANDO o usuário cria uma `BalanceAccount`, O SISTEMA DEVE exigir `kind` (`asset` ou `liability`) e `name`, e persistir com o `accountId` da account ativa.
- QUANDO o usuário edita uma `BalanceAccount`, O SISTEMA NÃO DEVE permitir alterar `kind`; DEVE permitir alterar apenas `name`, `institutionId` e o estado de arquivamento (`archivedAt`).
- QUANDO o usuário cria, edita, arquiva ou exclui uma `BalanceAccount` ou registra um saldo, O SISTEMA DEVE exigir papel `owner` ou `editor`; um `viewer` NÃO DEVE conseguir nenhuma dessas mutações (apenas leitura).
- QUANDO o usuário exclui (hard delete) uma `BalanceAccount`, O SISTEMA DEVE pedir confirmação e, ao confirmar, remover a conta e seus `BalanceSnapshot` em cascata. Arquivar é o caminho recomendado para preservar o histórico.

**NW-03 — Registro de saldo (snapshots)**

- QUANDO o usuário registra um saldo, O SISTEMA DEVE armazenar `balanceCents` como `BigInt` em centavos e `capturedOn` como `date`. NÃO DEVE aceitar `Float`.
- QUANDO o usuário usa "Atualizar saldos", O SISTEMA DEVE aceitar N contas com uma única `capturedOn` e fazer upsert do snapshot de cada conta informada, numa única operação idempotente.
- SE já existe um `BalanceSnapshot` para a mesma `balanceAccountId` e `capturedOn`, O SISTEMA DEVE atualizar o saldo existente em vez de criar duplicata (garantido por `@@unique([balanceAccountId, capturedOn])`).
- O SISTEMA DEVE aceitar `balanceCents` negativo (ex.: cheque especial num ativo, passivo pré-pago).
- O SISTEMA NÃO DEVE aceitar `capturedOn` no futuro (posterior a "hoje" no timezone da account); DEVE rejeitar com erro de validação.

**NW-02 — Cálculo do patrimônio líquido**

- QUANDO o patrimônio líquido atual é calculado, O SISTEMA DEVE somar o snapshot mais recente (maior `capturedOn`) de cada ativo não-arquivado e subtrair o de cada passivo não-arquivado, tudo em `BigInt` centavos.
- ENQUANTO uma `BalanceAccount` tiver `archivedAt` preenchido, ela NÃO DEVE entrar no cálculo do patrimônio líquido **atual**.
- QUANDO a página hero é renderizada, O SISTEMA DEVE exibir a variação do patrimônio líquido vs. o mês anterior (valor absoluto + percentual + ícone de direção), usando cor por significado financeiro pareada com o ícone.

**NW-03 — Evolução temporal (série mensal por carry-forward)**

- QUANDO a série de evolução é computada, para cada mês M O SISTEMA DEVE somar, por conta, o snapshot mais recente com `capturedOn` ≤ fim de M (carry-forward do último saldo conhecido).
- SE uma conta não tem nenhum snapshot com `capturedOn` ≤ fim de M, ela DEVE contribuir com 0 nesse mês.
- Para o mês M, uma conta arquivada DEVE continuar contribuindo com seu último saldo conhecido SE `archivedAt` for nulo OU posterior ao fim de M; a partir do mês em que foi arquivada (`archivedAt` ≤ fim de M), ela NÃO DEVE mais contribuir. O histórico anterior ao arquivamento DEVE ser preservado.

**Multi-tenancy**

- QUANDO qualquer query lê ou grava `BalanceAccount` ou `BalanceSnapshot`, ela DEVE filtrar por `accountId`. Um usuário NÃO DEVE conseguir ler ou alterar contas patrimoniais de outra account, mesmo informando um `balanceAccountId` válido de terceiro.

**UI / tema**

- QUANDO o valor de um passivo é exibido, O SISTEMA DEVE colori-lo por contexto (`danger`/neutro), NÃO por sinal aritmético — um passivo positivo NÃO DEVE aparecer em verde.
- QUANDO o widget de evolução (dashboard `yearly`) e o gráfico da página hero são renderizados, O SISTEMA DEVE exibir a série temporal com cores do tema (`getChartColors`), em light e dark mode, nunca hex hardcoded.

---

## 5. Fora de Escopo

- **Sincronização automática de saldo** (Open Finance / agregação bancária) — a atualização aqui é manual. **Atenção**: a spec 52 (Open Finance/Pluggy) ingere **transações** (fluxo) e mapeia para Section/TableType; ela **não** popula `BalanceSnapshot`. A sincronização automática de saldo patrimonial fica para **spec futura**, não a 52 como escrita hoje.
- **Vínculo automático entre transações e o saldo da conta** — não há débito/crédito automático no `BalanceSnapshot` ao lançar transação.
- **Cotação de ativos em tempo real** (ações, cripto) — saldo é informado pelo usuário.
- **Dívidas estruturadas no cálculo** — o net worth soma **apenas `BalanceAccount`**. O modelo `Debt` da spec 51 (com juros e plano de quitação) **não** entra no cálculo de patrimônio líquido, para evitar dupla contagem quando o usuário modelar o mesmo financiamento como passivo aqui e como `Debt` na 51. A consolidação das duas visões fica para spec futura (consistente com spec 51 §5).
- **Gestão de dívidas com amortização** — coberto pela spec 51 (Gestão de Dívidas); aqui o passivo é apenas um saldo informado.
- **Alocação de portfólio / classes de ativo** — fora do escopo inicial.
- **Multi-moeda** — todos os saldos em BRL nesta spec; conversão de moeda fica para spec futura.
- **KPI de patrimônio no dashboard mensal / month_summary** — o net worth é estoque cross-mês; sua casa é a página hero + o widget de evolução no `yearly`. Não há widget de net worth nos contextos `monthly`/`month_summary`.

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Representação de passivo | `balanceCents` positivo, `kind = liability` | Evita sinal negativo ambíguo; o cálculo subtrai passivos explicitamente. Na UI, passivo é colorido por contexto (não por sinal) para não aparecer verde |
| DD-02 | Série de evolução | Carry-forward mensal: mês M usa o snapshot mais recente com `capturedOn` ≤ fim de M por conta | Lida com atualizações esparsas/irregulares; consistente com a regra "snapshot mais recente" do cálculo atual; alinha ao eixo mensal do dashboard `yearly` |
| DD-03 | Arquivamento | Campo único `archivedAt DateTime?` (não booleano `isArchived`); carry-forward para na data de arquivamento, passado preservado | `archivedAt` é fonte única de verdade (evita divergência com um booleano) e fornece a data de corte; exclusão retroativa total tornaria a curva histórica mentirosa |
| DD-04 | Saldo como série | Modelo `BalanceSnapshot` separado | Permite evolução temporal sem mutar o registro da conta |
| DD-05 | `kind` imutável | Não permitir trocar `asset`↔`liability` após criar | Trocar o tipo reescreveria o sinal de toda a série histórica; para mudar, arquivar e recriar |
| DD-06 | Unicidade do snapshot | `@@unique([balanceAccountId, capturedOn])` | Um saldo por conta por dia; re-registro (avulso ou em lote) atualiza |
| DD-07 | Entrada de saldo | Fluxo em lote ("Atualizar saldos") + edição avulsa; ambos upsert | Reduz fricção do fechamento mensal (ação recorrente) mantendo correção pontual de histórico |
| DD-08 | Atualização manual | Sem integração nesta spec | Desacopla o valor patrimonial do Open Finance; sync automático de saldo é spec futura (ver §5) |
| DD-09 | Papéis | Mutações exigem `owner`/`editor`; `viewer` só lê | Segue o padrão das entidades de configuração (ex.: `Institution`); net worth é visível a todos os membros, como os dashboards |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Modelos `BalanceAccount` / `BalanceSnapshot` + enum + relações em `Account`/`Institution` | `prisma/schema.prisma` · nova migration `add_balance_accounts` |
| Schemas Zod (conta + snapshot avulso + lote) | `src/lib/schemas/balance-account.ts` (novo) |
| Service de patrimônio (cálculo atual + série carry-forward) | `src/server/services/net-worth-service.ts` (novo) |
| Service CRUD de conta + upsert de snapshots (single + bulk) | `src/server/services/balance-account-service.ts` (novo) |
| Actions (CRUD conta, arquivar, delete, registrar saldo single/bulk) | `src/actions/net-worth.ts` (novo, via `defineAction` + `EDITOR_ROLES`) |
| Serialização `BigInt` → string na fronteira RSC→client | `src/lib/serializers/balance-account.ts` (novo — seguir padrão de `src/lib/serializers/transaction.ts`) |
| Página hero + client manager | `src/app/(app)/[accountId]/net-worth/page.tsx` + `NetWorthManager.tsx` (novos) |
| Gráfico de evolução (recharts, tema) | `src/components/net-worth/NetWorthEvolutionChart.tsx` (novo — usar `getChartColors(mode)`) |
| Widget de evolução no dashboard `yearly` | registrar em `src/components/dashboards/_core/widget-registry.ts` (contexto `yearly`) · componente em `src/components/dashboards/panels/` · query em `src/server/queries/dashboards.ts` · ícone em `src/components/dashboards/_core/widget-icons.ts` |
| Entrada de nav top-level | `src/components/ui/AppBarNavButtons.tsx` (4º `IconButton`/`Tooltip` → `/${accountId}/net-worth`) |
| Labels de UI | `src/lib/messages/pt-BR.ts` |

### Notas de implementação

- **Cor do passivo (não usar `MoneyValue` cru)**: `MoneyValue` (`src/components/ui/MoneyValue.tsx`) colore por sinal — positivo → `success.main` (verde). Um passivo é `balanceCents` positivo, logo apareceria verde (errado). Renderizar passivo com cor por contexto:

```tsx
// ✅ Passivo: cor por contexto, não por sinal
<Typography
  component="span"
  sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontWeight: 500,
        fontVariantNumeric: "tabular-nums", color: "danger.main" }}
>
  {formatCentsToBrl(liability.balanceCents)}
</Typography>

// ❌ Não fazer — pinta dívida de verde
<MoneyValue cents={liability.balanceCents} />
```

- **Carry-forward (esboço do service)**:

```ts
// Para cada mês M do intervalo, por conta, o snapshot mais recente com capturedOn <= fim de M.
// Conta contribui em M se: archivedAt == null || archivedAt > fim de M. Ativo soma, passivo subtrai.
// Tudo BigInt; serializar com .toString() na fronteira (ver src/lib/serializers/transaction.ts).
```

- Registrar no skill [`money-handling`](../skills/money-handling/SKILL.md) o padrão "cor de saldo patrimonial por `kind`" (ativo por sinal; passivo sempre contexto), estendendo a seção "Display color convention".

---

## 8. Plano de Implementação

> Guia de execução (não faz parte da anatomia canônica da spec; §1–7 são a fonte da verdade). **Executar apenas após `Status: approved`.** Todo dev roda **dentro do container** (`docker compose exec app ...`) — sem `pnpm` no host. **Não** criar branch, worktree nem rodar git; trabalhar na working tree.
>
> Os skeletons abaixo são **fiéis aos templates reais do repo** (arquivo canônico citado em cada fase). Copie o padrão do template, não invente estrutura. Ao terminar cada fase: rodar `typecheck` + `lint` + os testes da fase, marcar o checkbox em §8.4 e atualizar a coluna de status.

### 8.1 Padrões de código (obrigatórios — a base do "padronizado")

| Camada | Regra inegociável | Template canônico |
|---|---|---|
| Dinheiro | `BigInt` centavos no domínio/DB. `.toString()` na fronteira RSC→client; `BigInt(str)` no client; `Number(BigInt(str))/100` **só** no render do gráfico. Nunca `Float`. | `src/lib/money.ts`, `skills/money-handling` |
| Passivo (cor) | Colorir por **contexto** (`danger.main`/neutro), nunca por sinal. **Nunca** `<MoneyValue>` cru para passivo (pinta positivo de verde). | §7 nota |
| Multi-tenancy | Service re-busca a linha (`select: { accountId: true }`) e compara `!row \|\| row.accountId !== ctx.accountId → NotFoundError`. `accountId` **sempre** de `ctx`, nunca do input. | `src/server/services/institution-service.ts` |
| Action | Transporte só. `defineAction({ schema, requireRoles, handler })`; chama **um** service; `revalidateX(ctx.accountId)`; retorna `ActionResult<T>`. Zero lógica/prisma na action. | `src/actions/account-settings.ts` |
| Erros | `throw new NotFoundError("Conta patrimonial")` / `ConflictError(msg)` no service; `defineAction` mapeia `code`. | `src/server/api/errors.ts` |
| Reads (RSC) | Função em `src/server/queries/`, envolta em `cache(...)` (`import { cache } from "react"`), filtra `accountId` (`// ✅ multi-tenancy`), serializa no boundary. | `src/server/queries/dashboards.ts` |
| Serialização | `BigInt`→`.toString()`; data-only→`.toISOString().slice(0,10)`; timestamp→`.toISOString()`. Serializer central por entidade. No client, data-only → `parseLocalDate` (nunca `new Date("YYYY-MM-DD")` → off-by-one BRT). | `src/lib/serializers/transaction.ts` |
| Feedback | `useActionFeedback<T>({ successMessage, onSuccess })` → `handle(result)`; `useTransition` p/ `isPending`; strings de `m.*`. | `src/lib/hooks/use-action-feedback.ts` |
| Forms | 1 schema Zod (RHF `zodResolver` + `safeParse` server + `z.infer`). MUI via `Controller`. Dinheiro: `NumericFormat` + `customInput={TextField}`. Data: `<TextField type="date" InputLabelProps={{ shrink: true }}>` (**não** há DatePicker no projeto). | `src/components/installments/CreateInstallmentDialog.tsx` |
| Gráfico | `getChartColors(theme.palette.mode)`; `ChartTooltip` recebe `formatValue`; lazy `next/dynamic({ ssr: false })`; sem hex; `theme.palette.error.main` já é `danger` (não vermelho MUI). | `src/components/dashboards/charts/YearlyLineChart.tsx` |
| Datas | `getMonthRange(year, month, monthStartDay)` / `getCurrentFiscalMonth(today, monthStartDay)`; `monthStartDay` de `accountSettings ?? 1`. | `src/lib/dates.ts` |
| Prisma | Singleton `@/server/prisma`; sempre `select` explícito; `onDelete` explícito em toda relação; id `cuid()`. | `skills/prisma-conventions` |
| Testes | Colocados `*.test.ts`; `prismaMock` de `@/../tests/mocks/prisma`; `TEST_CTX` de `@/../tests/fixtures/account`; cross-account → mock `{ accountId: "acc-OUTRA" }` + `.rejects.toThrow(NotFoundError)`. | `src/server/services/budget-service.test.ts` |
| UI | Só MUI + tokens do tema; `<DialogShell>`, `<EmptyState>`, `<PageHeader>`, `<StatusBadge>`; testar light **e** dark. | CLAUDE.md §5.11 |

**Nomes de símbolos (fixar agora para consistência entre fases):** service CRUD `balance-account-service.ts`; service puro `net-worth-service.ts`; query `net-worth.ts`; actions `net-worth.ts`; serializer `SerializedBalanceAccount`/`serializeBalanceAccount`; widget id `"net-worth-evolution"`; rota `/${accountId}/net-worth`; bloco de mensagens `m.netWorth.*`.

### 8.2 Fases

Cada fase: **Objetivo · Arquivos · Skeleton · Testes · Cobre (§4) · DoD**.

---

#### Fase 0 — Schema & migration · *modelo: Haiku*

**Objetivo**: persistir `BalanceAccount` + `BalanceSnapshot`.
**Arquivos**: `prisma/schema.prisma` (editar) · migration `add_balance_accounts` (nova).

**Passos**:
1. Colar o enum + os 2 models da §2 em `prisma/schema.prisma` (com `archivedAt`, sem `isArchived`).
2. Adicionar as relações inversas: em `Account` → `balanceAccounts BalanceAccount[]` + `balanceSnapshots BalanceSnapshot[]`; em `Institution` → `balanceAccounts BalanceAccount[]`.
3. `docker compose exec app pnpm prisma format && pnpm prisma validate`.
4. `docker compose exec app pnpm prisma migrate dev --name add_balance_accounts && pnpm prisma generate`.

**DoD**: `prisma validate` ok; migration aplicada; `@prisma/client` regenerado; `onDelete` explícito em todas as 4 relações (Account=Cascade, Institution=SetNull, BalanceAccount→snapshots=Cascade).

---

#### Fase 1 — Schemas Zod · *modelo: Sonnet*

**Objetivo**: fonte única de validação (form + action).
**Arquivos**: `src/lib/schemas/balance-account.ts` (novo).

**Skeleton**:
```ts
import { z } from "zod";
import { cuidSchema, dateSchema, amountCentsSchema } from "./shared";

export const balanceAccountKindSchema = z.enum(["asset", "liability"]);
const nameSchema = z.string().min(1, "Nome obrigatório").max(80).trim();
const notFuture = (d: Date) => d <= new Date();
const futureMsg = "Data não pode ser futura";

export const createBalanceAccountSchema = z.object({
  kind: balanceAccountKindSchema,                       // kind só na criação (DD-05)
  name: nameSchema,
  institutionId: cuidSchema.optional().nullable(),
});

export const updateBalanceAccountSchema = z.object({
  balanceAccountId: cuidSchema,
  name: nameSchema,
  institutionId: cuidSchema.optional().nullable(),      // SEM kind (imutável)
});

export const archiveBalanceAccountSchema = z.object({
  balanceAccountId: cuidSchema,
  archived: z.boolean(),                                // true=arquivar, false=desarquivar
});

export const deleteBalanceAccountSchema = z.object({ balanceAccountId: cuidSchema });

export const upsertBalanceSnapshotSchema = z.object({
  balanceAccountId: cuidSchema,
  balanceCents: amountCentsSchema,                      // aceita negativo (não usar .positive())
  capturedOn: dateSchema.refine(notFuture, futureMsg),
});

export const upsertBalanceSnapshotsSchema = z.object({  // lote "Atualizar saldos"
  capturedOn: dateSchema.refine(notFuture, futureMsg),
  entries: z.array(z.object({ balanceAccountId: cuidSchema, balanceCents: amountCentsSchema })).min(1),
});

export type CreateBalanceAccountInput = z.infer<typeof createBalanceAccountSchema>;
export type UpdateBalanceAccountInput = z.infer<typeof updateBalanceAccountSchema>;
export type ArchiveBalanceAccountInput = z.infer<typeof archiveBalanceAccountSchema>;
export type DeleteBalanceAccountInput = z.infer<typeof deleteBalanceAccountSchema>;
export type UpsertBalanceSnapshotInput = z.infer<typeof upsertBalanceSnapshotSchema>;
export type UpsertBalanceSnapshotsInput = z.infer<typeof upsertBalanceSnapshotsSchema>;
```
**Testes**: colocado `balance-account.test.ts` — `capturedOn` futuro falha; negativo passa; `entries: []` falha; `kind` ausente no create falha.
**Cobre**: NW-01 (kind exigido), NW-03 (BigInt, negativo, não-futuro).
**DoD**: `typecheck` ok; testes de schema verdes.

---

#### Fase 2 — Services + testes · *modelo: Sonnet (Opus se carry-forward travar)*

**Objetivo**: CRUD/upsert (I/O) + cálculo (puro).
**Arquivos**: `src/server/services/balance-account-service.ts` (novo) · `net-worth-service.ts` (novo) + 2 testes.

**Skeleton — `balance-account-service.ts`** (multi-tenancy por re-fetch, padrão `institution-service`):
```ts
import { NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  CreateBalanceAccountInput, UpdateBalanceAccountInput, ArchiveBalanceAccountInput,
  DeleteBalanceAccountInput, UpsertBalanceSnapshotInput, UpsertBalanceSnapshotsInput,
} from "@/lib/schemas/balance-account";

const log = logger.child({ module: "balance-account-service" });

async function assertOwned(id: string, ctx: ActionContext) {
  const row = await prisma.balanceAccount.findUnique({ where: { id }, select: { accountId: true } });
  if (!row || row.accountId !== ctx.accountId) throw new NotFoundError("Conta patrimonial");
}

export async function createBalanceAccount(input: CreateBalanceAccountInput, ctx: ActionContext) {
  const created = await prisma.balanceAccount.create({
    data: {
      accountId: ctx.accountId, kind: input.kind, name: input.name,
      institutionId: input.institutionId ?? null, createdById: ctx.userId,
    },
    select: { id: true },
  });
  log.info({ balanceAccountId: created.id, accountId: ctx.accountId }, "BalanceAccount created");
  return { balanceAccountId: created.id };
}

export async function updateBalanceAccount(input: UpdateBalanceAccountInput, ctx: ActionContext) {
  await assertOwned(input.balanceAccountId, ctx);           // kind NÃO é atualizado
  await prisma.balanceAccount.update({
    where: { id: input.balanceAccountId },
    data: { name: input.name, institutionId: input.institutionId ?? null },
  });
}

export async function archiveBalanceAccount(input: ArchiveBalanceAccountInput, ctx: ActionContext) {
  await assertOwned(input.balanceAccountId, ctx);
  await prisma.balanceAccount.update({
    where: { id: input.balanceAccountId },
    data: { archivedAt: input.archived ? new Date() : null },   // data de corte do carry-forward
  });
}

export async function deleteBalanceAccount(input: DeleteBalanceAccountInput, ctx: ActionContext) {
  await assertOwned(input.balanceAccountId, ctx);
  await prisma.balanceAccount.delete({ where: { id: input.balanceAccountId } });  // cascade nos snapshots
}

export async function upsertBalanceSnapshot(input: UpsertBalanceSnapshotInput, ctx: ActionContext) {
  await assertOwned(input.balanceAccountId, ctx);
  await prisma.balanceSnapshot.upsert({
    where: { balanceAccountId_capturedOn: { balanceAccountId: input.balanceAccountId, capturedOn: input.capturedOn } },
    create: { accountId: ctx.accountId, balanceAccountId: input.balanceAccountId, balanceCents: input.balanceCents, capturedOn: input.capturedOn, createdById: ctx.userId },
    update: { balanceCents: input.balanceCents },
  });
}

export async function upsertBalanceSnapshots(input: UpsertBalanceSnapshotsInput, ctx: ActionContext) {
  const ids = input.entries.map((e) => e.balanceAccountId);
  const owned = await prisma.balanceAccount.findMany({
    where: { id: { in: ids }, accountId: ctx.accountId }, select: { id: true },   // ✅ todas da account
  });
  if (owned.length !== new Set(ids).size) throw new NotFoundError("Conta patrimonial");
  await prisma.$transaction(
    input.entries.map((e) => prisma.balanceSnapshot.upsert({
      where: { balanceAccountId_capturedOn: { balanceAccountId: e.balanceAccountId, capturedOn: input.capturedOn } },
      create: { accountId: ctx.accountId, balanceAccountId: e.balanceAccountId, balanceCents: e.balanceCents, capturedOn: input.capturedOn, createdById: ctx.userId },
      update: { balanceCents: e.balanceCents },
    })),
  );
  log.info({ accountId: ctx.accountId, count: input.entries.length }, "Balance snapshots upserted");
}
```

**Skeleton — `net-worth-service.ts`** (puro, sem prisma → unit-testável):
```ts
import { getMonthRange } from "@/lib/dates";

export type NwAccount = { id: string; kind: "asset" | "liability"; archivedAt: Date | null };
export type NwSnapshot = { balanceAccountId: string; balanceCents: bigint; capturedOn: Date };

/** Patrimônio atual: último saldo por conta NÃO-arquivada; ativo soma, passivo subtrai. */
export function computeCurrentNetWorth(accounts: NwAccount[], latestByAccount: Map<string, bigint>) {
  let assetsCents = 0n, liabilitiesCents = 0n;
  for (const a of accounts) {
    if (a.archivedAt !== null) continue;                       // arquivada fora do atual
    const bal = latestByAccount.get(a.id);
    if (bal === undefined) continue;
    if (a.kind === "asset") assetsCents += bal; else liabilitiesCents += bal;
  }
  return { assetsCents, liabilitiesCents, netCents: assetsCents - liabilitiesCents };
}

/** Série mensal por carry-forward. `months` em ordem cronológica. */
export function buildMonthlySeries(
  accounts: NwAccount[], snapshots: NwSnapshot[],
  months: { year: number; month: number }[], monthStartDay: number,
) {
  const byAccount = new Map<string, NwSnapshot[]>();
  for (const s of snapshots) {
    const list = byAccount.get(s.balanceAccountId) ?? [];
    list.push(s); byAccount.set(s.balanceAccountId, list);
  }
  for (const list of byAccount.values()) list.sort((a, b) => a.capturedOn.getTime() - b.capturedOn.getTime());

  return months.map(({ year, month }) => {
    const end = getMonthRange(year, month, monthStartDay).end;
    let netCents = 0n;
    for (const acc of accounts) {
      if (acc.archivedAt !== null && acc.archivedAt <= end) continue;   // parou de contribuir
      const list = byAccount.get(acc.id);
      if (!list) continue;
      let latest: bigint | undefined;                          // último snapshot <= fim de M
      for (const s of list) { if (s.capturedOn <= end) latest = s.balanceCents; else break; }
      if (latest === undefined) continue;                      // sem snapshot ainda → 0
      netCents += acc.kind === "asset" ? latest : -latest;
    }
    return { year, month, netCents };
  });
}
```

**Testes** (`net-worth-service.test.ts` — puro; `balance-account-service.test.ts` — prismaMock):
- Cross-account: `assertOwned` com `{ accountId: "acc-OUTRA" }` → `NotFoundError`; e mutação `.not.toHaveBeenCalled()`.
- `create` grava `expect.objectContaining({ accountId: "acc-test-1" })`.
- `upsertBalanceSnapshot` idempotente (mesma data → `update`).
- `computeCurrentNetWorth`: ativos−passivos; arquivada ignorada; conta sem snapshot ignorada.
- `buildMonthlySeries`: carry-forward (Nubank 100→carrega; Apto 1º em fev); conta nova = 0 antes do 1º snapshot; arquivada preserva passado e some após `archivedAt`.

**Cobre**: NW-02, NW-03, multi-tenancy.
**DoD**: testes verdes; `net-worth-service` sem `import prisma`.

---

#### Fase 3 — Serializer · *modelo: Haiku*

**Objetivo**: fronteira RSC→client sem `BigInt`/`Date` crus.
**Arquivos**: `src/lib/serializers/balance-account.ts` (novo, padrão `transaction.ts`).

**Skeleton**:
```ts
export type SerializedBalanceAccount = {
  id: string;
  kind: "asset" | "liability";
  name: string;
  institutionId: string | null;
  institutionName: string | null;
  archivedAt: string | null;                                   // ISO
  latestSnapshot: { balanceCents: string; capturedOn: string } | null;  // capturedOn "YYYY-MM-DD"
};

type PrismaBalanceAccount = {
  id: string; kind: "asset" | "liability"; name: string;
  institutionId: string | null; archivedAt: Date | null;
  institution?: { name: string } | null;
  snapshots?: { balanceCents: bigint; capturedOn: Date }[];    // esperado: take:1 desc
};

export function serializeBalanceAccount(a: PrismaBalanceAccount): SerializedBalanceAccount {
  const snap = a.snapshots?.[0];
  return {
    id: a.id, kind: a.kind, name: a.name,
    institutionId: a.institutionId,
    institutionName: a.institution?.name ?? null,
    archivedAt: a.archivedAt?.toISOString() ?? null,
    latestSnapshot: snap
      ? { balanceCents: snap.balanceCents.toString(), capturedOn: snap.capturedOn.toISOString().slice(0, 10) }
      : null,
  };
}
```
**DoD**: `typecheck` ok.

---

#### Fase 4 — Queries (reads) + Revalidate · *modelo: Sonnet*

**Objetivo**: reads cacheados p/ página e widget.
**Arquivos**: `src/server/queries/net-worth.ts` (novo) · `src/server/api/revalidate.ts` (editar).

**Skeleton — `net-worth.ts`**:
```ts
import { cache } from "react";
import { prisma } from "@/server/prisma";
import { getCurrentFiscalMonth } from "@/lib/dates";
import { computeCurrentNetWorth, buildMonthlySeries, type NwAccount } from "@/server/services/net-worth-service";
import { serializeBalanceAccount } from "@/lib/serializers/balance-account";

/** Gera N meses cronológicos terminando em (year, month). */
function lastNMonths(end: { year: number; month: number }, n: number) {
  const out: { year: number; month: number }[] = [];
  let { year, month } = end;
  for (let i = 0; i < n; i++) { out.unshift({ year, month }); month--; if (month === 0) { month = 12; year--; } }
  return out;
}

async function monthStartDayOf(accountId: string) {
  const s = await prisma.accountSettings.findUnique({ where: { accountId }, select: { monthStartDay: true } });
  return s?.monthStartDay ?? 1;
}

export const getNetWorthSeries = cache(async function getNetWorthSeries(accountId: string, monthCount: number) {
  const monthStartDay = await monthStartDayOf(accountId);
  const months = lastNMonths(getCurrentFiscalMonth(new Date(), monthStartDay), monthCount);
  const accounts: NwAccount[] = await prisma.balanceAccount.findMany({
    where: { accountId },                                       // ✅ multi-tenancy
    select: { id: true, kind: true, archivedAt: true },
  });
  // carry-forward precisa de TODO o histórico (não filtrar por início da janela)
  const snapshots = await prisma.balanceSnapshot.findMany({
    where: { accountId },                                       // ✅ multi-tenancy
    select: { balanceAccountId: true, balanceCents: true, capturedOn: true },
  });
  return buildMonthlySeries(accounts, snapshots, months, monthStartDay)
    .map((p) => ({ year: p.year, month: p.month, netCents: p.netCents.toString() }));   // BigInt→string
});

export const getNetWorthOverview = cache(async function getNetWorthOverview(accountId: string) {
  const accounts = await prisma.balanceAccount.findMany({
    where: { accountId },                                       // ✅ multi-tenancy
    include: { institution: { select: { name: true } }, snapshots: { orderBy: { capturedOn: "desc" }, take: 1 } },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  const latest = new Map<string, bigint>();
  for (const a of accounts) if (a.snapshots[0]) latest.set(a.id, a.snapshots[0].balanceCents);
  const totals = computeCurrentNetWorth(accounts, latest);

  const series = await getNetWorthSeries(accountId, 2);         // delta vs mês anterior
  const prev = series.length >= 2 ? BigInt(series[series.length - 2].netCents) : null;
  const deltaCents = prev === null ? null : (totals.netCents - prev).toString();
  const deltaPct = prev === null || prev === 0n ? null
    : (Number(totals.netCents - prev) / Math.abs(Number(prev))) * 100;

  return {
    assetsCents: totals.assetsCents.toString(),
    liabilitiesCents: totals.liabilitiesCents.toString(),
    netCents: totals.netCents.toString(),
    deltaCents, deltaPct,
    accounts: accounts.map(serializeBalanceAccount),
  };
});
```
**Revalidate** — adicionar em `src/server/api/revalidate.ts` (docblock por helper; nunca `"layout"`):
```ts
/** Revalida a página de patrimônio líquido. */
export function revalidateNetWorth(accountId: string) {
  revalidatePath(`/${accountId}/net-worth`);
}
```
**DoD**: `typecheck` ok; toda query filtra `accountId`; nenhum `BigInt` cru retornado.

---

#### Fase 5 — Actions + testes · *modelo: Sonnet*

**Objetivo**: transporte validado + autorizado.
**Arquivos**: `src/actions/net-worth.ts` (novo) + `net-worth.test.ts`.

**Skeleton**:
```ts
"use server";

import { defineAction } from "@/server/api/define-action";
import * as svc from "@/server/services/balance-account-service";
import { revalidateNetWorth } from "@/server/api/revalidate";
import {
  createBalanceAccountSchema, updateBalanceAccountSchema, archiveBalanceAccountSchema,
  deleteBalanceAccountSchema, upsertBalanceSnapshotSchema, upsertBalanceSnapshotsSchema,
} from "@/lib/schemas/balance-account";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createBalanceAccountAction = defineAction({
  schema: createBalanceAccountSchema, requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => { const r = await svc.createBalanceAccount(input, ctx); revalidateNetWorth(ctx.accountId); return r; },
});
export const updateBalanceAccountAction = defineAction({
  schema: updateBalanceAccountSchema, requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => { await svc.updateBalanceAccount(input, ctx); revalidateNetWorth(ctx.accountId); },
});
export const archiveBalanceAccountAction = defineAction({
  schema: archiveBalanceAccountSchema, requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => { await svc.archiveBalanceAccount(input, ctx); revalidateNetWorth(ctx.accountId); },
});
export const deleteBalanceAccountAction = defineAction({
  schema: deleteBalanceAccountSchema, requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => { await svc.deleteBalanceAccount(input, ctx); revalidateNetWorth(ctx.accountId); },
});
export const upsertBalanceSnapshotAction = defineAction({
  schema: upsertBalanceSnapshotSchema, requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => { await svc.upsertBalanceSnapshot(input, ctx); revalidateNetWorth(ctx.accountId); },
});
export const upsertBalanceSnapshotsAction = defineAction({
  schema: upsertBalanceSnapshotsSchema, requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => { await svc.upsertBalanceSnapshots(input, ctx); revalidateNetWorth(ctx.accountId); },
});
```
**Testes** (padrão `dashboard-layout.test.ts`: `vi.mock("next/cache")`, `vi.mock("@/server/prisma")`, `vi.mock` do service): viewer → `result.ok === false` + `error.code === "FORBIDDEN"`; `capturedOn` futuro → `"VALIDATION"`.
**Cobre**: NW-01 (papéis owner/editor).
**DoD**: testes verdes.

---

#### Fase 6 — Labels + Nav · *modelo: Haiku*

**Objetivo**: strings centralizadas + entrada no AppBar.
**Arquivos**: `src/lib/messages/pt-BR.ts` (editar) · `src/components/ui/AppBarNavButtons.tsx` (editar).

**Passos**:
1. Adicionar bloco top-level `netWorth` em `pt-BR.ts` (mesmo shape de `settings.institutions`):
```ts
netWorth: {
  title: "Patrimônio Líquido",
  assets: "Ativos", liabilities: "Passivos",
  newAccount: "Nova conta", updateBalances: "Atualizar saldos",
  kindAsset: "Ativo", kindLiability: "Passivo",
  nameLabel: "Nome", institutionLabel: "Instituição (opcional)",
  balanceLabel: "Saldo", dateLabel: "Data",
  archive: "Arquivar", unarchive: "Desarquivar",
  deleteTitle: "Excluir conta", deleteConfirm: "Excluir a conta e todo o histórico de saldos? Esta ação não pode ser desfeita. Prefira arquivar para manter o histórico.",
  created: "Conta criada.", updated: "Conta atualizada.", archived: "Conta arquivada.", deleted: "Conta excluída.", balancesSaved: "Saldos atualizados.",
  empty: "Cadastre suas contas e bens para acompanhar seu patrimônio.",
  staleSince: "Atualizado {when}",
  navLabel: "Patrimônio",
},
```
2. `AppBarNavButtons.tsx`: 4º `Tooltip`+`IconButton` (`AccountBalanceWalletIcon` de `@mui/icons-material`) → `router`/`Link` para `/${accountId}/net-worth`, espelhando os 3 existentes.

**DoD**: sem string hardcoded na feature; ícone visível no AppBar.

---

#### Fase 7 — Página hero + client · *modelo: Sonnet*

**Objetivo**: tela hero + fluxos (cadastro, bulk, delete).
**Arquivos**: `src/app/(app)/[accountId]/net-worth/page.tsx` (novo, RSC) · `NetWorthManager.tsx` (novo, client).

**Skeleton — `page.tsx`** (padrão `institutions/page.tsx`):
```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAccountAccess } from "@/server/auth/session";
import { getNetWorthOverview, getNetWorthSeries } from "@/server/queries/net-worth";
import { NetWorthManager } from "./NetWorthManager";

type Props = { params: Promise<{ accountId: string }> };
export const metadata: Metadata = { title: "Patrimônio Líquido | MyAccountant" };

export default async function NetWorthPage({ params }: Props) {
  const { accountId } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));
  const [overview, series] = await Promise.all([
    getNetWorthOverview(accountId),
    getNetWorthSeries(accountId, 12),                    // 12 meses no gráfico da hero
  ]);
  return <NetWorthManager accountId={accountId} overview={overview} series={series} />;
}
```

**`NetWorthManager.tsx`** — client, espelhar `InstitutionsManager` (state otimista + `useTransition` + `useActionFeedback`). Estrutura obrigatória:
- `<PageHeader title={m.netWorth.title} actions={<Button startIcon={<AddIcon/>}>Nova conta</Button> + <Button variant="outlined">Atualizar saldos</Button>} />`.
- **KPI hero**: `netCents` em `variant="kpi"` (mono) + delta (`overview.deltaPct`) via padrão `KpiCard`: `TrendingUpIcon`+`success.main` / `TrendingFlatIcon`+`text.disabled` / `TrendingDownIcon`+`error.main`; ícone **e** cor juntos.
- Cards **Ativos** (`success.light` — o tema **não** tem `success.subtle`, só `danger`/`neutral` têm `.subtle`) / **Passivos** (`danger.subtle`) com os totais.
- `<NetWorthEvolutionChart series={series} />` (Fase 8, lazy).
- Duas listas (Ativos / Passivos): cada linha nome + instituição + saldo + data do último snapshot; **staleness** `<StatusBadge variant="warning">` se snapshot > ~35 dias (comparar via `parseLocalDate(latestSnapshot.capturedOn)`); menu (editar / atualizar saldo / arquivar / excluir). **Passivo**: valor por contexto (`color: "danger.main"`), nunca `<MoneyValue>` cru.
- `<EmptyState icon={<AccountBalanceWalletIcon/>} title description action>` quando `accounts.length === 0`.
- **Dialogs** via `<DialogShell>`:
  - Criar/editar conta (RHF + `zodResolver`, `type="submit" form="ba-form"`): `kind` via `ToggleButtonGroup` **só na criação** (oculto/disabled no editar); nome; instituição via `Select` (`Controller`).
  - "Atualizar saldos" (bulk): `<TextField type="date" InputLabelProps={{ shrink: true }}>` p/ `capturedOn`; `useFieldArray` sobre as contas ativas, cada saldo com `NumericFormat` + `customInput={TextField}` pré-preenchido com o último saldo; submit → `upsertBalanceSnapshotsAction`.
  - Confirmar delete: `<DialogShell description={m.netWorth.deleteConfirm}>` + botão `color="error"`.
- Toda ação: `startTransition(async () => handle(await xAction(accountId, input)))` + atualização otimista da lista.

**Cobre**: NW-01, NW-02 (delta), NW-03 (bulk/avulso), UI/tema.
**DoD**: light **e** dark ok; empty state; passivo não aparece verde; bulk grava N snapshots numa data.

---

#### Fase 8 — Gráfico de evolução · *modelo: Sonnet (espelhar `YearlyLineChart.tsx`)*

**Objetivo**: série temporal do patrimônio, tema-aware, reusável (hero + widget).
**Arquivos**: `src/components/net-worth/NetWorthEvolutionChart.tsx` (novo) · wrapper lazy onde usado.

**Skeleton** (LineChart/AreaChart recharts; cores do tema; `ChartTooltip` com `formatValue`):
```tsx
"use client";
import { useTheme } from "@mui/material/styles";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getChartColors } from "@/lib/design-tokens";
import { formatCentsToBrl } from "@/lib/money";
import { formatMonthLabel } from "@/lib/dates";
import { ChartTooltip } from "@/components/dashboards/_shared/ChartTooltip";

type Point = { year: number; month: number; netCents: string };
type Props = { series: Point[]; height?: number };

export function NetWorthEvolutionChart({ series, height = 260 }: Props) {
  const theme = useTheme();
  const colors = getChartColors(theme.palette.mode as "light" | "dark");
  const gridColor = theme.palette.divider;
  const tickColor = theme.palette.text.secondary;
  const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" });

  const data = series.map((p) => ({
    label: formatMonthLabel(p.year, p.month),
    net: Number(BigInt(p.netCents)) / 100,               // BigInt→Number só no render
    raw: p.netCents,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: gridColor }}
          tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }} />
        <YAxis width={56} axisLine={false} tickLine={false}
          tick={{ fill: tickColor, fontSize: 11, fontFamily: theme.typography.fontFamily }}
          tickFormatter={(v: number) => compact.format(v)} />
        <Tooltip content={(props: any) => {
          if (!props.active || !props.payload?.length) return null;
          const raw = props.payload[0]?.payload?.raw as string;
          return <ChartTooltip active label={props.label}
            payload={[{ name: "Patrimônio", value: props.payload[0].value, color: colors[0] }]}
            formatValue={() => formatCentsToBrl(BigInt(raw))} />;
        }} />
        <Area type="monotone" dataKey="net" stroke={colors[0]} fill={colors[0]} fillOpacity={0.25} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```
Consumir **lazy** (mantém recharts fora do bundle inicial): `const NetWorthEvolutionChart = dynamic(() => import("@/components/net-worth/NetWorthEvolutionChart").then(m => m.NetWorthEvolutionChart), { ssr: false })`.
**Cobre**: UI/tema (light+dark, sem hex).
**DoD**: renderiza em light **e** dark; tooltip mostra `formatCentsToBrl`; sem hex.

---

#### Fase 9 — Widget yearly · *modelo: Sonnet (checklist 7 arquivos)*

**Objetivo**: widget `net-worth-evolution` no dashboard `yearly`.
**Arquivos (editar todos os 7)**:
1. `src/components/dashboards/_core/widget-registry.ts` → objeto `WidgetDef` no array `yearly`: `{ id: "net-worth-evolution", labelKey: "netWorthEvolution", kind: "panel", sizeVariants: WIDE_CHART_VARIANTS, defaultVisible: false }` (**`false`** — usuário adiciona pela paleta).
2. `src/lib/messages/pt-BR.ts` → `dashboards.widgets.yearly["net-worth-evolution"] = "Evolução do Patrimônio"` **e** `dashboards.widgets.descriptions.yearly["net-worth-evolution"] = "Evolução do patrimônio líquido ao longo do ano"`.
3. `src/components/dashboards/_core/widget-icons.ts` → `import ShowChartIcon` + `WIDGET_ICONS["net-worth-evolution"] = ShowChartIcon`.
4. `src/server/queries/dashboards.ts` → `getNetWorthEvolutionForYear(accountId, year)` reusando `getNetWorthSeries` (12 meses do ano); cents como **string**.
5. `src/components/dashboards/panels/NetWorthEvolutionWidget.tsx` → panel que recebe `{ series, renderMode }`, envolve em `<WidgetContainer title icon={WIDGET_ICONS["net-worth-evolution"]}>` e renderiza `<NetWorthEvolutionChart>` (branch `renderMode === "compact"` → altura menor).
6. `src/components/dashboards/yearly/YearlyDashboardClient.tsx` → add prop em `Props` + entrada em `nodeByWidgetId["net-worth-evolution"]` com `renderMode={getRenderMode(widgets, "yearly", "net-worth-evolution")}` (o loop mapeia `instanceId` sozinho).
7. `src/app/(app)/[accountId]/dashboards/yearly/[year]/page.tsx` → fetch **gated**: `const hasNw = widgets.some(w => w.widgetId === "net-worth-evolution" && w.visible)` → `hasNw ? getNetWorthEvolutionForYear(...) : Promise.resolve([])`; passar prop ao client.

(A paleta `WidgetPalette.tsx` **não** precisa de edição — lê o registry.)
**Cobre**: NW-03 (widget de evolução).
**DoD**: widget aparece na paleta yearly; adiciona/renderiza; some quando não visível (fetch gated).

---

#### Fase 10 — Skill + verificação final · *modelo: Sonnet*

**Objetivo**: consolidar aprendizado + verificar tudo.
**Passos**:
1. Estender `skills/money-handling/SKILL.md` §"Display color convention": adicionar "saldo patrimonial por `kind`" (ativo por sinal; passivo sempre `danger`/contexto).
2. `docker compose exec app pnpm typecheck && pnpm lint && pnpm test`.
3. Checagem manual: light **e** dark; multi-tenancy (não abrir conta de outra account por id); staleness (badge mostarda); delta na hero; bulk grava N; arquivar preserva passado no gráfico e para adiante; delete pede confirmação.
**DoD**: `typecheck`+`lint`+`test` verdes; checklist manual ok.

### 8.3 Definição de Pronto (global)

- [x] Todos os critérios da §4 cobertos por teste automatizado (schema/service/action) ou checklist manual.
- [x] `typecheck` + `test` verdes no container (928 testes). `lint`: arquivos novos limpos; 109 erros são pré-existentes no repo (não introduzidos).
- [x] Nenhuma query de `BalanceAccount`/`BalanceSnapshot` sem filtro `accountId`; teste multi-tenancy presente (`balance-account-service.test.ts`).
- [x] Nenhum `Float`/`Number` para dinheiro; `BigInt` cruza o boundary como string.
- [x] Passivo nunca renderizado por sinal (cor por contexto `danger.main`).
- [ ] UI validada em light **e** dark — **pendente (verificação visual manual no browser)**.
- [x] Strings via `m.netWorth.*`; sem `console.log`.
- [x] Skill `money-handling` atualizado (cor de saldo por `kind`).

### 8.4 Rastreamento de progresso

| Fase | Descrição | Modelo | Status |
|---|---|---|---|
| 0 | Schema & migration | Haiku | ✅ |
| 1 | Schemas Zod | Sonnet | ✅ (9 testes) |
| 2 | Services + testes | Sonnet/Opus | ✅ (20 testes) |
| 3 | Serializer | Haiku | ✅ |
| 4 | Queries + revalidate | Sonnet | ✅ |
| 5 | Actions + testes | Sonnet | ✅ (9 testes) |
| 6 | Labels + nav | Haiku | ✅ |
| 7 | Página hero + client | Sonnet | ✅ |
| 8 | Gráfico de evolução | Sonnet | ✅ |
| 9 | Widget yearly | Sonnet | ✅ |
| 10 | Skill + verificação final | Sonnet | ✅ |

### 8.5 Ordem de dependências

```
Fase 0 (schema) ─┬─ Fase 1 (Zod) ─┬─ Fase 2 (services) ─┬─ Fase 4 (queries) ─┬─ Fase 7 (página) ─┬─ Fase 8 (chart)
                 │                 ├─ Fase 3 (serializer)┘                    │                   └─ Fase 9 (widget)
                 │                 └─ Fase 5 (actions) ───────────────────────┘
                 └─ Fase 6 (labels/nav) ── paralelizável a partir da Fase 0
                                                                    Fase 10 (verificação) depende de tudo
```

