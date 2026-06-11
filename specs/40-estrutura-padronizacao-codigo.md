# Spec 40 — Revisão de Estrutura e Padronização de Código

> Status: draft
> Insumo: revisão de código em `src/` (auditoria de estrutura, 2026-06-11) + `specs/15-project-structure.md`
> Skills: [`code-structure`](../skills/code-structure/SKILL.md) *(criado por esta spec)* · [`server-actions`](../skills/server-actions/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`spec-writing`](../skills/spec-writing/SKILL.md) · [`testing`](../skills/testing/SKILL.md) 

---

## 1. Problema

- **EST-01**: Lógica de negócio e Prisma direto dentro de actions, violando a camada definida na spec 15 §4.2. Em `src/actions/sandbox.ts:38-126` há 10 chamadas diretas a `prisma.savedAnalysis.*` com regras de negócio (limite de 4 análises fixadas, cálculo de `maxOrder`, validação de criador). Em `src/actions/user-settings.ts:20,41` há `prisma.userSettings.upsert` direto na action.
- **EST-02**: Três arquivos de actions não usam o wrapper obrigatório `defineAction()` (CLAUDE.md §5.5): `src/actions/accounts.ts`, `src/actions/auth.ts` e `src/actions/user-settings.ts` reimplementam manualmente auth check, parse Zod e try/catch — exatamente o boilerplate que o wrapper elimina.
- **EST-03**: `src/server/services/settings-service.ts` tem 389 linhas e 17 funções exportadas cobrindo 5 entidades distintas (Account, Sections, Categories, Institutions, TableTypes). A spec 15 §9.1 limita services a 300 linhas; o arquivo mistura responsabilidades e dificulta navegação e teste.
- **EST-04**: Código duplicado em vez de utilitários centralizados: o array `MONTH_NAMES` existe 3× (`src/lib/dates.ts:106` — canônico, `src/components/dashboards/MonthCardGrid.tsx:17` e `src/components/budgets/BudgetFormDialog.tsx:23` — cópias literais); e `src/components/budgets/BudgetFormDialog.tsx:76` desfaz a formatação BRL com `.replace("R$ ", "").replace("R$ ", "")` em vez de usar um helper de `src/lib/money.ts`.
- **EST-05**: Não existe convenção documentada para hooks e contexts — a spec 15 não menciona o tema. Hoje: `src/lib/hooks/` tem 1 arquivo (`use-export-download.ts`), `useThemeMode` mora em `src/components/providers/ThemeContext.tsx:22`, `MonthFilterContext` mora em `src/components/months/`. Sem regra, cada feature nova escolhe um lugar diferente.
- **EST-06**: Strings de UI hardcoded fora de `src/lib/messages/` (violação do CLAUDE.md §5.10): em `src/components/transactions/TransactionRow.tsx:446,641,650`, tooltips em pt-BR estão inline ("Ocultar notas", "Marcar como concluída", "Adicionar aos favoritos"), enquanto linhas vizinhas (ex: `:660`) já usam `m.transactions.actions.*`.
- **EST-07**: Componentes muito acima do limite de 200 linhas da spec 15 §9.1, misturando responsabilidades: `src/components/transactions/TransactionRow.tsx` (706 linhas: linha + editor inline + menu + notas), `src/components/transactions/TransactionTable.tsx` (527: tabela + filtros + seleção + paginação) e `src/components/finance-tables/FinanceTableCard.tsx` (444: card + modais + ações).
- **EST-08**: A camada `src/lib/queries/` (3 arquivos, sendo `dashboards.ts` com 850 linhas) não está prevista na spec 15 nem documentada em nenhum skill. Ela contém código server-only (importa Prisma) morando em `src/lib/`, que a spec 15 §3 define como "utilitários compartilhados (server + client)" — a fronteira server/client fica implícita e o padrão de leitura para RSCs fica sem dono.

---

## 2. Solução

### 2.1 Restaurar a camada de services (EST-01)

- Criar `src/server/services/sandbox-service.ts` e mover toda a lógica de `src/actions/sandbox.ts` (validação de limite de pins, `maxOrder`, autorização de delete) — a action vira só transporte.
- Criar `src/server/services/user-settings-service.ts` com os upserts de `user-settings.ts`.

### 2.2 Padronizar actions com defineAction (EST-02)

Converter `accounts.ts`, `auth.ts` e `user-settings.ts` para `defineAction()`. Para actions sem contexto de Account (auth, user-settings), usar a variante do wrapper que exige apenas sessão (se não existir, criá-la em `src/server/api/define-action.ts` como `defineUserAction()` seguindo o mesmo padrão `ActionResult`).

### 2.3 Quebrar settings-service por entidade (EST-03)

Dividir `settings-service.ts` em `account-settings-service.ts`, `section-service.ts`, `category-service.ts`, `institution-service.ts` e `table-type-service.ts`, mantendo as assinaturas das funções (refactor mecânico — imports atualizados nos call sites, sem mudança de comportamento).

### 2.4 Eliminar duplicações (EST-04)

- Remover os `MONTH_NAMES` locais de `MonthCardGrid.tsx` e `BudgetFormDialog.tsx`, importando de `@/lib/dates`.
- Criar `centsToBrlInput(cents: bigint): string` em `src/lib/money.ts` (valor formatado sem símbolo, para inputs) e usar em `BudgetFormDialog.tsx:76`.

### 2.5 Convenção de hooks e contexts (EST-05)

Definir e documentar a regra (sem mover código que já a cumpre):
- Hooks puros reutilizáveis → `src/lib/hooks/use-*.ts` (kebab-case).
- Contexts globais do app (tema, providers) → `src/components/providers/`.
- Contexts de feature → na pasta da própria feature (ex: `MonthFilterContext` fica em `components/months/`).
A regra entra no skill `code-structure` (§2.8) e na spec 15 §5.

### 2.6 Centralizar strings de UI (EST-06)

Mover os tooltips hardcoded de `TransactionRow.tsx` para `m.transactions.actions.*` em `src/lib/messages/pt-BR.ts`, seguindo o padrão já usado no próprio arquivo.

### 2.7 Decompor componentes gigantes (EST-07)

- `TransactionRow.tsx` → extrair `TransactionRowEditor` (edição inline), `TransactionRowActions` (ícones/menu) e `TransactionNotesRow`.
- `TransactionTable.tsx` → extrair `TransactionTableToolbar` (busca/filtros) e `useTransactionSelection` (hook de seleção em massa).
- `FinanceTableCard.tsx` → extrair os dialogs internos para arquivos próprios em `components/finance-tables/`.
Critério de corte: cada arquivo resultante < 300 linhas, componente principal < 200.

### 2.8 Oficializar a camada de queries + skill (EST-08)

- Mover `src/lib/queries/` → `src/server/queries/` (código server-only mora em `src/server/`), atualizando imports.
- Atualizar a spec 15 §3/§4 registrando a camada: **queries** = leitura para RSCs (sem regra de negócio de mutação), **services** = regras de negócio e mutações.
- Criar `skills/code-structure/SKILL.md` consolidando: mapa de camadas atualizado (UI → actions/queries → services → Prisma), regra de hooks/contexts (§2.5), limites de tamanho de arquivo com receita de decomposição, checklist anti-duplicação ("antes de criar helper/constante, procurar em `lib/`"), e convenções de nomenclatura da spec 15 §5.

---

## 3. User Stories

- Como desenvolvedor, quero toda lógica de negócio em services, para testá-la sem montar o contexto de uma Server Action.
- Como desenvolvedor, quero todas as actions no mesmo padrão `defineAction`/`ActionResult`, para não reaprender o error handling a cada arquivo.
- Como desenvolvedor, quero um skill de estrutura com regras de onde cada coisa mora, para que código novo não recrie a bagunça que esta spec limpa.
- Como desenvolvedor, quero componentes menores e utilitários sem duplicação, para alterar um comportamento em um lugar só.

---

## 4. Critérios de Aceitação

**EST-01:**
- QUANDO se busca `prisma.` em `src/actions/`, NÃO DEVE haver nenhuma ocorrência — todo acesso a dados passa por services (ou queries, em RSCs).
- Os testes existentes de sandbox DEVEM continuar passando, agora apontando para `sandbox-service.ts`, incluindo o teste de multi-tenancy.

**EST-02:**
- QUANDO se busca por actions exportadas em `src/actions/*.ts`, todas DEVEM usar `defineAction()` (ou `defineUserAction()` para fluxos sem Account) e retornar `ActionResult<T>`.

**EST-03:**
- O arquivo `settings-service.ts` NÃO DEVE mais existir; cada service resultante DEVE ter menos de 300 linhas e cobrir uma única entidade.
- QUANDO `pnpm test` e `pnpm typecheck` rodam após a divisão, DEVEM passar sem mudança de comportamento (refactor mecânico).

**EST-04:**
- QUANDO se busca `MONTH_NAMES =` em `src/`, DEVE haver exatamente 1 definição (`src/lib/dates.ts`).
- QUANDO se busca `.replace("R$` em `src/`, NÃO DEVE haver ocorrências — conversões para input usam `centsToBrlInput()`.

**EST-05:**
- A regra de localização de hooks/contexts DEVE estar documentada no skill `code-structure` e na spec 15.
- SE um hook puro novo for criado após esta spec, ele DEVE morar em `src/lib/hooks/` (verificável em review).

**EST-06:**
- QUANDO se inspeciona `TransactionRow.tsx`, nenhum `Tooltip`/label DEVE conter string pt-BR literal — todas DEVEM vir de `m.*`.

**EST-07:**
- `TransactionRow.tsx`, `TransactionTable.tsx` e `FinanceTableCard.tsx` DEVEM ficar cada um com menos de 300 linhas após a extração, e os componentes extraídos DEVEM morar na mesma pasta de feature.
- QUANDO o usuário edita, seleciona e favorita transações após o refactor, o comportamento DEVE ser idêntico ao atual (verificação manual guiada pelos critérios da spec 09 e 20).

**EST-08:**
- O diretório `src/lib/queries/` NÃO DEVE mais existir; as queries DEVEM morar em `src/server/queries/` e nenhum arquivo em `src/lib/` DEVE importar `@/server/prisma`.
- O arquivo `skills/code-structure/SKILL.md` DEVE existir cobrindo os itens da §2.8.
- A spec 15 DEVE estar atualizada com a camada de queries ANTES do código ser movido (spec-anchored).

---

## 5. Fora de Escopo

- Refatorações de performance (loading, memoização, revalidação) — cobertas pela Spec 39.
- Quebrar outros arquivos grandes que são coesos: `lib/messages/pt-BR.ts` (930 linhas — catálogo), `lib/theme.ts` (623 — tema), `csv-import/StepMapping.tsx` (694 — fluxo especializado), `lib/queries/dashboards.ts` (850 — será movido, não reescrito).
- Introduzir repository layer separado dos services — decisão já registrada como "não" na spec 15 §13.
- Adicionar barrel files (`index.ts`) — spec 15 §5.1 já decide contra; manter exports nomeados diretos.
- i18n real (`next-intl`) — esta spec apenas reforça a centralização em `lib/messages/`.
- Reescrever a lógica interna das queries de dashboards — apenas realocação e documentação.
- Regras de ESLint novas para impor as fronteiras de camada (ex: `import/no-restricted-paths`) — registrar como candidato a spec futura se a violação reincidir.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Onde moram as queries de leitura | `src/server/queries/` (novo), não dentro de services | São código server-only (violam o contrato "shared" de `lib/`); separar leitura (RSC) de regra de negócio (service) mantém services enxutos |
| Variante de action sem Account | `defineUserAction()` no mesmo arquivo do `defineAction()` | Mantém um único ponto de boilerplate; auth/user-settings não têm `accountId` para `requireAccountAccess` |
| Divisão do settings-service | Por entidade (5 arquivos) | Espelha a organização das rotas `settings/*` e dos managers de UI; refactor mecânico, sem mudança de assinatura |
| Contexts de feature | Permanecem na pasta da feature | Mover tudo para `lib/hooks/` criaria acoplamento invertido (lib importando componentes de feature); a regra documentada vale mais que a mudança |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| EST-01 | `src/actions/sandbox.ts`, `src/actions/user-settings.ts`, `src/server/services/sandbox-service.ts` (novo), `src/server/services/user-settings-service.ts` (novo) |
| EST-02 | `src/actions/accounts.ts`, `src/actions/auth.ts`, `src/actions/user-settings.ts`, `src/server/api/define-action.ts` |
| EST-03 | `src/server/services/settings-service.ts` (remover), `src/server/services/{account-settings,section,category,institution,table-type}-service.ts` (novos) + call sites |
| EST-04 | `src/components/dashboards/MonthCardGrid.tsx`, `src/components/budgets/BudgetFormDialog.tsx`, `src/lib/money.ts` |
| EST-05 | `skills/code-structure/SKILL.md` (novo), `specs/15-project-structure.md` §5 |
| EST-06 | `src/components/transactions/TransactionRow.tsx`, `src/lib/messages/pt-BR.ts` |
| EST-07 | `src/components/transactions/{TransactionRow,TransactionRowEditor,TransactionRowActions,TransactionNotesRow,TransactionTable,TransactionTableToolbar}.tsx`, `src/lib/hooks/use-transaction-selection.ts` (novo), `src/components/finance-tables/` |
| EST-08 | `src/lib/queries/` → `src/server/queries/`, `specs/15-project-structure.md` §3-4, `skills/code-structure/SKILL.md` (novo) |

### Action como transporte puro (EST-01, EST-02)

```ts
// ✅ Correto — action valida e delega; regra mora no service
export const togglePinAnalysisAction = defineAction(
  togglePinSchema,
  async (input, ctx) => togglePinAnalysis(ctx.accountId, ctx.userId, input),
);

// src/server/services/sandbox-service.ts
export async function togglePinAnalysis(accountId: string, userId: string, input: TogglePinInput) {
  const pinnedCount = await prisma.savedAnalysis.count({ where: { accountId, isPinned: true } });
  if (pinnedCount >= MAX_PINNED_ANALYSES) throw new ConflictError("pinned_limit_reached");
  // ...
}

// ❌ Anti-padrão — Prisma + regra de negócio dentro da action
export async function togglePinAnalysisAction(input: unknown) {
  const pinnedCount = await prisma.savedAnalysis.count({ ... });
  if (pinnedCount >= 4) return { ok: false, ... };
}
```

### Helper centralizado em vez de duplicação (EST-04)

```ts
// ✅ Correto
import { MONTH_NAMES } from "@/lib/dates";
import { centsToBrlInput } from "@/lib/money";
amountBrl: centsToBrlInput(BigInt(budget.amountCents)),

// ❌ Anti-padrão — cópia local + "desformatar" string
const MONTH_NAMES = ["Janeiro", "Fevereiro", /* ... */];
amountBrl: formatCentsToBrl(BigInt(budget.amountCents)).replace("R$ ", "").replace("R$ ", ""),
```

### Fronteira server-only de queries (EST-08)

```ts
// ✅ Correto — RSC importa query de src/server/queries/
import { getYearOverview } from "@/server/queries/dashboards";

// ❌ Anti-padrão — código com Prisma morando em src/lib/ (camada "shared")
import { getYearOverview } from "@/lib/queries/dashboards";
```
