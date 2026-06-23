# Spec 40 — Revisão de Estrutura e Padronização de Código

> Status: approved
> Insumo: revisão de código em `src/` (auditoria de estrutura, 2026-06-11) + `specs/15-project-structure.md`
> Skills: [`code-structure`](../skills/code-structure/SKILL.md) *(criado por esta spec)* · [`server-actions`](../skills/server-actions/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`spec-writing`](../skills/spec-writing/SKILL.md) · [`testing`](../skills/testing/SKILL.md) 

---

## 1. Problema

- **EST-01**: Lógica de negócio e Prisma direto dentro de actions, violando a camada definida na spec 15 §4.2. Ocorrências identificadas (critério: nenhuma chamada `prisma.` em `src/actions/`):
  - `src/actions/user-settings.ts:20,41` — `prisma.userSettings.upsert` direto na action.
  - `src/actions/onboarding.ts:14,27` — `prisma.accountSettings.update` direto na action, sem service.
  - `src/actions/budgets.ts` — `getBudgetTransactionsAction` executa `prisma.budget.findUnique` + `prisma.transaction.findMany` com lógica de filtro dinâmico dentro do handler, apesar de o arquivo já importar `budget-service` para as demais actions.
  - *(Resolvido)* `src/actions/sandbox.ts` — já migrado para `defineAction` + `@/lib/queries/sandbox`.
- **EST-02**: Dois arquivos de actions que operam em contexto de usuário autenticado não usam o wrapper obrigatório (CLAUDE.md §5.5): `src/actions/accounts.ts` e `src/actions/user-settings.ts` reimplementam manualmente auth check, parse Zod e try/catch. `src/actions/auth.ts` é tratado como **exceção documentada** — contém actions pré-autenticação (`signIn`, `signUp`) que por definição não podem exigir sessão prévia; aplicar `defineUserAction()` aí seria incorreto.
- **EST-03**: `src/server/services/settings-service.ts` tem 389 linhas e 17 funções exportadas cobrindo 5 entidades distintas (Account, Sections, Categories, Institutions, TableTypes). A spec 15 §9.1 limita services a 300 linhas; o arquivo mistura responsabilidades e dificulta navegação e teste.
- **EST-04**: Código duplicado em vez de utilitários centralizados: o array `MONTH_NAMES` ainda existe localmente em `src/components/budgets/BudgetFormDialog.tsx:23` (cópia literal da definição canônica em `src/lib/dates.ts:106`). *(Resolvido)* `MonthCardGrid.tsx` e o `replace("R$ ")` em `BudgetFormDialog.tsx` já foram corrigidos. Ainda falta criar `centsToBrlInput()` em `src/lib/money.ts` para uso futuro e eliminar a cópia local de `MONTH_NAMES` em `BudgetFormDialog.tsx`.
- **EST-05**: Não existe convenção documentada para hooks e contexts — a spec 15 não menciona o tema. Pior: hoje existem **duas pastas de hooks concorrentes** no projeto: `src/lib/hooks/` (com `use-export-download.ts`) e `src/hooks/` (com `useActionFeedback.ts`), cada uma com 1 arquivo. Além disso: `useThemeMode` mora em `src/components/providers/ThemeContext.tsx:22`, `MonthFilterContext` mora em `src/components/months/`. Sem regra documentada, cada feature nova escolhe um lugar diferente.
- **EST-06**: Strings de UI hardcoded fora de `src/lib/messages/` (violação do CLAUDE.md §5.10): em `src/components/transactions/TransactionRow.tsx:446,641,650`, tooltips em pt-BR estão inline ("Ocultar notas", "Marcar como concluída", "Adicionar aos favoritos"), enquanto linhas vizinhas (ex: `:660`) já usam `m.transactions.actions.*`.
- **EST-07**: Componentes misturando múltiplas responsabilidades em arquivos únicos: `src/components/transactions/TransactionRow.tsx` (701 linhas: linha + editor inline + menu + notas), `src/components/transactions/TransactionTable.tsx` (624 linhas, cresceu de 527: tabela + filtros + seleção + paginação) e `src/components/finance-tables/FinanceTableCard.tsx` (444 linhas: card + modais + ações). O critério de corte não é numérico — é **coesão**: cada componente extraído deve ter uma única responsabilidade clara e ser testável/alterável de forma independente.
- **EST-08**: A camada `src/lib/queries/` (3 arquivos, sendo `dashboards.ts` com 850 linhas) não está prevista na spec 15 nem documentada em nenhum skill. Ela contém código server-only (importa Prisma) morando em `src/lib/`, que a spec 15 §3 define como "utilitários compartilhados (server + client)" — a fronteira server/client fica implícita e o padrão de leitura para RSCs fica sem dono.
- **EST-09**: Valores de estilo hardcoded espalhados por `src/` inteiro — espaçamentos mágicos (`sx={{ p: 3 }}`), cores hex (`#fff`), elevações (`elevation={2}`) — em vez de tokens semânticos de `src/lib/design-tokens.ts`. A varredura cobre **todo `src/`** (components, app, lib, hooks), substituindo qualquer valor que tenha correspondente nos tokens semânticos do tema.
- **EST-10**: Código morto acumulado — funções exportadas, tipos, constantes e imports que nunca são referenciados. O `tsconfig.json` tem `strict: true` mas **não** tem `noUnusedLocals` nem `noUnusedParameters`, portanto o TypeScript não detecta variáveis locais não usadas. O ESLint cobre imports e vars locais via `unused-imports`, mas **não** detecta funções/tipos exportados sem nenhum importador. Com o crescimento do projeto (refactors de EST-03, EST-08 etc.), código orfão se acumula silenciosamente.
- **EST-11**: Repetição de código além das duplicações pontuais de EST-04. Exemplos identificados: 55 chamadas de `revalidatePath` nas actions sem helper centralizado (cada mutation reescreve a mesma lógica de revalidação); padrão `try/catch` + log manual em actions que não usam `defineAction`; estruturas de serialização `BigInt → string` repetidas em múltiplos handlers.

---

## 2. Solução

### 2.1 Restaurar a camada de services (EST-01)

- Criar `src/server/services/user-settings-service.ts` com os upserts de `user-settings.ts`.
- Criar `src/server/services/onboarding-service.ts` com os updates de `accountSettings` de `onboarding.ts`.
- Mover `getBudgetTransactions` para `src/server/services/budget-service.ts` (o arquivo já existe com outras funções) — a lógica de filtro dinâmico por `budget.*` é regra de negócio que pertence ao service, não ao handler.
- A action correspondente vira apenas transporte.
- **Testes obrigatórios** para cada service novo/expandido, incluindo cenário de multi-tenancy (CLAUDE.md §5.12).

### 2.2 Padronizar actions com defineAction (EST-02)

Converter `accounts.ts` e `user-settings.ts` para `defineUserAction()` — variante do wrapper que exige apenas sessão (sem `accountId`), a ser criada em `src/server/api/define-action.ts` seguindo o mesmo padrão `ActionResult`.

**`auth.ts` é exceção documentada** — contém actions pré-autenticação que por definição não podem exigir sessão. Fica fora do `defineUserAction()` e é explicitamente listada como caso especial no skill `code-structure`.

Critério: **toda action que opera em contexto de usuário autenticado** usa `defineAction()` (com Account) ou `defineUserAction()` (sem Account).

### 2.3 Quebrar settings-service por entidade (EST-03)

Dividir `settings-service.ts` em `account-settings-service.ts`, `section-service.ts`, `category-service.ts`, `institution-service.ts` e `table-type-service.ts`, mantendo as assinaturas das funções (refactor mecânico — imports atualizados nos call sites, sem mudança de comportamento).

### 2.4 Eliminar duplicações (EST-04)

- Remover o `MONTH_NAMES` local de `BudgetFormDialog.tsx`, importando de `@/lib/dates`. *(Resolvido: `MonthCardGrid.tsx` já está corrigido.)*
- Criar `centsToBrlInput(cents: bigint): string` em `src/lib/money.ts` (valor formatado sem símbolo, para inputs) e adicionar testes unitários.

### 2.5 Convenção de hooks e contexts (EST-05)

Definir, documentar e consolidar em uma única localização:
- Hooks puros reutilizáveis → `src/lib/hooks/use-*.ts` (kebab-case) — **única pasta canônica**.
- Mover `useActionFeedback.ts` de `src/hooks/` → `src/lib/hooks/use-action-feedback.ts` e eliminar a pasta `src/hooks/` por completo.
- Contexts globais do app (tema, providers) → `src/components/providers/`.
- Contexts de feature → na pasta da própria feature (ex: `MonthFilterContext` fica em `components/months/`).
A regra entra no skill `code-structure` (§2.8) e na spec 15 §5.

### 2.6 Centralizar strings de UI (EST-06)

Mover os tooltips hardcoded de `TransactionRow.tsx` para `m.transactions.actions.*` em `src/lib/messages/pt-BR.ts`, seguindo o padrão já usado no próprio arquivo.

### 2.7 Decompor componentes gigantes (EST-07)

- `TransactionRow.tsx` → extrair `TransactionRowEditor` (edição inline), `TransactionRowActions` (ícones/menu) e `TransactionNotesRow`.
- `TransactionTable.tsx` → extrair `TransactionTableToolbar` (busca/filtros) e `useTransactionSelection` (hook de seleção em massa, em `src/lib/hooks/`).
- `FinanceTableCard.tsx` → extrair os dialogs internos para arquivos próprios em `components/finance-tables/`.

**Critério de corte: coesão, não linhas.** Cada componente extraído deve ter uma única responsabilidade clara e ser alterável/testável de forma independente. Um componente com 250 linhas mas completamente coeso está correto; um componente com 80 linhas mas com 3 responsabilidades misturadas não está.

### 2.8 Oficializar a camada de queries + skill (EST-08)

- Mover `src/lib/queries/` → `src/server/queries/` (código server-only mora em `src/server/`), atualizando todos os imports.
- **Atualizar a Spec 39** (`specs/39-revisao-performance-carregamento.md`) para refletir `src/server/queries/` como localização canônica — a Spec 39 (status: approved) referencia `src/lib/queries/` em seus critérios de aceitação e deve ser corrigida antes do código ser movido.
- Atualizar a spec 15 §3/§4 registrando a camada: **queries** = leitura para RSCs (sem regra de negócio de mutação), **services** = regras de negócio e mutações.
- Criar `skills/code-structure/SKILL.md` consolidando: mapa de camadas atualizado (UI → actions/queries → services → Prisma), regra de hooks/contexts (§2.5), critério de coesão para decomposição de componentes, checklist anti-duplicação ("antes de criar helper/constante, procurar em `lib/`"), exceção de `auth.ts` no padrão de actions, e convenções de nomenclatura da spec 15 §5.

### 2.9 Auditoria de design-tokens (EST-09)

Varredura completa de **todo `src/`** (components, app, lib, hooks, actions) substituindo:
- Espaçamentos mágicos (`sx={{ p: 3 }}`, `sx={{ gap: 2 }}`) → tokens de `layout.*` de `@/lib/design-tokens`.
- Cores hardcoded (`#fff`, `#1976d2`, strings de palette) → tokens semânticos do tema (`background.surface`, `accent.primary`, etc.).
- Elevações (`elevation={2}`) → o tema já força `elevation={0}` + borda; remover o prop.
- Cores em SVG/recharts (`fill="#2e7d32"`) → `theme.palette.*` ou `getChartColors(mode)`.

Referir ao `skills/design-system/SKILL.md` para a lista completa de tokens disponíveis.

### 2.10 Remoção de código morto (EST-10)

Duas frentes complementares:

**Frente 1 — Tooling (automático):**
- Habilitar `"noUnusedLocals": true` e `"noUnusedParameters": true"` no `tsconfig.json`. Corrigir todos os erros de compilação resultantes.
- Promover `unused-imports/no-unused-vars` de `warn` para `error` no `.eslintrc.json` e corrigir todas as ocorrências — imports de tipos, enums e constantes que ninguém usa.

**Frente 2 — Varredura manual de exportações órfãs:**
- Identificar funções/tipos/constantes **exportados** (que o TypeScript não detecta) sem nenhum importador no projeto usando busca de referências.
- Foco em: `src/server/services/`, `src/lib/`, `src/lib/schemas/` — onde funções exportadas acumulam mais facilmente após refactors.
- Remover o que não tiver uso. Se houver dúvida sobre uso futuro, adicionar um comentário `// TODO: verificar uso` antes de remover.

### 2.11 Redução de repetição de código — DRY geral (EST-11)

Identificar e extrair padrões repetidos em três categorias:

**Categoria 1 — Revalidação de rotas (55 ocorrências em `src/actions/`):**
- Criar helpers de revalidação em `src/server/api/revalidate.ts` por domínio: `revalidateMonth(accountId, monthId)`, `revalidateDashboard(accountId, monthId?)`, `revalidateSettings(accountId)`.
- Substituir todas as chamadas manuais de `revalidatePath` nas actions pelos helpers.

**Categoria 2 — Serialização `BigInt → string`:**
- Auditar RSCs e Route Handlers que fazem `.toString()` em campos monetários.
- Verificar se o padrão já está coberto por `src/lib/serializers/` — se sim, garantir uso consistente; se não, centralizar lá.

**Categoria 3 — Padrões de UI repetidos entre componentes:**
- Identificar estruturas de `<Box>/<Stack>/<Typography>` com a mesma composição aparecendo 3+ vezes (ex: cabeçalho de card, linha de ação com ícone + label, estado vazio inline).
- Extrair para primitivos em `src/components/ui/` apenas quando a abstração tiver pelo menos 3 usos confirmados — sem over-engineering.

---

## 3. User Stories

- Como desenvolvedor, quero toda lógica de negócio em services, para testá-la sem montar o contexto de uma Server Action.
- Como desenvolvedor, quero todas as actions no mesmo padrão `defineAction`/`ActionResult`, para não reaprender o error handling a cada arquivo.
- Como desenvolvedor, quero um skill de estrutura com regras de onde cada coisa mora, para que código novo não recrie a bagunça que esta spec limpa.
- Como desenvolvedor, quero componentes menores e utilitários sem duplicação, para alterar um comportamento em um lugar só.- Como desenvolvedor, quero o projeto livre de código morto e de padrões repetidos, para que buscas no código retornem resultados relevantes e mudanças de comportamento exijam editar exatamente um lugar.
---

## 4. Critérios de Aceitação

**EST-01:**
- QUANDO se busca `prisma.` em `src/actions/`, NÃO DEVE haver nenhuma ocorrência — todo acesso a dados passa por services (ou queries, em RSCs). Isso cobre `user-settings.ts`, `onboarding.ts` e `getBudgetTransactionsAction` em `budgets.ts`.
- Todo service novo ou expandido por este item DEVE ter testes cobrindo o cenário happy-path e o cenário de multi-tenancy (tentativa de acessar dados de outra account).
- `pnpm test` DEVE passar sem alteração de comportamento.

**EST-02:**
- QUANDO se busca por actions que operam em contexto de usuário autenticado em `src/actions/*.ts`, todas DEVEM usar `defineAction()` (com Account) ou `defineUserAction()` (sem Account) e retornar `ActionResult<T>`.
- `src/actions/auth.ts` é exceção documentada (actions pré-autenticação) e NÃO precisa usar os wrappers.

**EST-03:**
- O arquivo `settings-service.ts` NÃO DEVE mais existir; cada service resultante DEVE ter menos de 300 linhas e cobrir uma única entidade.
- QUANDO `pnpm test` e `pnpm typecheck` rodam após a divisão, DEVEM passar sem mudança de comportamento (refactor mecânico).

**EST-04:**
- QUANDO se busca `MONTH_NAMES =` em `src/`, DEVE haver exatamente 1 definição (`src/lib/dates.ts`).
- `centsToBrlInput()` DEVE existir em `src/lib/money.ts` e DEVE ter testes unitários.

**EST-05:**
- A pasta `src/hooks/` NÃO DEVE existir — `useActionFeedback.ts` DEVE estar em `src/lib/hooks/use-action-feedback.ts`.
- A regra de localização de hooks/contexts DEVE estar documentada no skill `code-structure` e na spec 15.
- SE um hook puro novo for criado após esta spec, ele DEVE morar em `src/lib/hooks/` (verificável em review).

**EST-06:**
- QUANDO se inspeciona `TransactionRow.tsx`, nenhum `Tooltip`/label DEVE conter string pt-BR literal — todas DEVEM vir de `m.*`.

**EST-07:**
- `TransactionRow.tsx`, `TransactionTable.tsx` e `FinanceTableCard.tsx` DEVEM ser decompostos em componentes de responsabilidade única; cada componente extraído DEVE morar na mesma pasta de feature.
- O critério de aceitação não é numérico: é verificar que nenhum dos componentes extraídos mistura mais de uma responsabilidade clara.
- QUANDO o usuário edita, seleciona e favorita transações após o refactor, o comportamento DEVE ser idêntico ao atual (verificação manual guiada pelos critérios da spec 09 e 20).

**EST-08:**
- O diretório `src/lib/queries/` NÃO DEVE mais existir; as queries DEVEM morar em `src/server/queries/` e nenhum arquivo em `src/lib/` DEVE importar `@/server/prisma`.
- A **Spec 39 DEVE ser atualizada** com a nova localização `src/server/queries/` ANTES do código ser movido.
- A spec 15 DEVE estar atualizada com a camada de queries ANTES do código ser movido (spec-anchored).
- O arquivo `skills/code-structure/SKILL.md` DEVE existir cobrindo os itens da §2.8.

**EST-09:**
- QUANDO se busca por valores hardcoded de espaçamento (`p: \d`, `gap: \d`), cor (hex `#[0-9a-f]+`) ou `elevation={\d}` em `src/`, NÃO DEVE haver ocorrências que tenham correspondente em `design-tokens.ts` ou no tema MUI.
- `pnpm typecheck` e `pnpm lint` DEVEM passar após a substituição.
- A aplicação DEVE ser testada visualmente em **light E dark mode** após a substituição.

**EST-10:**
- `pnpm typecheck` NÃO DEVE emitir erros de `noUnusedLocals` ou `noUnusedParameters` após habilitar as flags no `tsconfig.json`.
- `pnpm lint` NÃO DEVE emitir warnings de `unused-imports/no-unused-vars` (promovidos a error).
- A varredura manual de exportações órfãs em `src/server/services/`, `src/lib/` e `src/lib/schemas/` DEVE estar documentada com a lista do que foi removido.
- `pnpm test` DEVE passar após as remoções.

**EST-11:**
- `revalidatePath` NÃO DEVE ser chamado diretamente nas actions — toda revalidação DEVE passar pelos helpers de `src/server/api/revalidate.ts`.
- NÃO DEVE haver estrutura de serialização `BigInt → string` fora do padrão centralizado (via `src/lib/serializers/` ou helper equivalente).
- Nenhum componente primitivo DEVE ser extraído para `src/components/ui/` com menos de 3 usos confirmados (critério anti-over-engineering).

---

## 5. Fora de Escopo

- Refatorações de performance (loading, memoização, revalidação) — cobertas pela Spec 39.
- Quebrar outros arquivos grandes que são coesos: `lib/messages/pt-BR.ts` (930 linhas — catálogo), `lib/theme.ts` (623 — tema), `csv-import/StepMapping.tsx` (694 — fluxo especializado). `server/queries/dashboards.ts` (850 — será movido, não reescrito).
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
| Atualização da Spec 39 | Obrigatória antes de mover o código | Spec 39 (approved) referencia `src/lib/queries/` em critérios de aceitação; mover sem atualizar a spec cria incoerência entre specs |
| Variante de action sem Account | `defineUserAction()` no mesmo arquivo do `defineAction()` | Mantém um único ponto de boilerplate; user-settings e accounts não têm `accountId` para `requireAccountAccess` |
| `auth.ts` no padrão de actions | Exceção documentada — fica fora do `defineUserAction()` | Actions pré-autenticação (signIn, signUp) não podem exigir sessão prévia; aplicar o wrapper seria incorreto |
| Escopo de EST-01 | Todos os `prisma.` em `src/actions/`, incluindo `onboarding.ts` e `getBudgetTransactionsAction` | Critério é binário: nenhuma ocorrência de Prisma direto nas actions |
| Divisão do settings-service | Por entidade (5 arquivos) | Espelha a organização das rotas `settings/*` e dos managers de UI; refactor mecânico, sem mudança de assinatura |
| Hooks canônicos | `src/lib/hooks/` única pasta; `src/hooks/` eliminada | Evita ambiguidade; `useActionFeedback.ts` movido para alinhar com `use-export-download.ts` |
| Critério de corte EST-07 | Coesão (responsabilidade única), sem limite numérico de linhas | Componentes complexos coesos não devem ser fragmentados só por contagem de linhas |
| Escopo de EST-09 | Todo `src/` sem exceção | Padronização de tokens deve ser consistente; exceções criam regressões em futuras edições |
| Contexts de feature | Permanecem na pasta da feature | Mover tudo para `lib/hooks/` criaria acoplamento invertido (lib importando componentes de feature); a regra documentada vale mais que a mudança |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| EST-01 | `src/actions/user-settings.ts`, `src/actions/onboarding.ts`, `src/actions/budgets.ts`, `src/server/services/user-settings-service.ts` (novo), `src/server/services/onboarding-service.ts` (novo), `src/server/services/budget-service.ts` (expandido) + testes |
| EST-02 | `src/actions/accounts.ts`, `src/actions/user-settings.ts`, `src/server/api/define-action.ts` (adicionar `defineUserAction`) |
| EST-03 | `src/server/services/settings-service.ts` (remover), `src/server/services/{account-settings,section,category,institution,table-type}-service.ts` (novos) + call sites |
| EST-04 | `src/components/budgets/BudgetFormDialog.tsx`, `src/lib/money.ts` |
| EST-05 | `src/hooks/useActionFeedback.ts` → `src/lib/hooks/use-action-feedback.ts`, eliminar `src/hooks/`, `skills/code-structure/SKILL.md` (novo), `specs/15-project-structure.md` §5 |
| EST-06 | `src/components/transactions/TransactionRow.tsx`, `src/lib/messages/pt-BR.ts` |
| EST-07 | `src/components/transactions/{TransactionRow,TransactionRowEditor,TransactionRowActions,TransactionNotesRow,TransactionTable,TransactionTableToolbar}.tsx`, `src/lib/hooks/use-transaction-selection.ts` (novo), `src/components/finance-tables/` |
| EST-08 | `src/lib/queries/` → `src/server/queries/`, `specs/39-revisao-performance-carregamento.md`, `specs/15-project-structure.md` §3-4, `skills/code-structure/SKILL.md` (novo) |
| EST-09 | Todos os arquivos `.tsx`/`.ts` em `src/` com valores hardcoded de estilo |
| EST-10 | `tsconfig.json`, `.eslintrc.json`, varredura de `src/server/services/`, `src/lib/`, `src/lib/schemas/` |
| EST-11 | `src/server/api/revalidate.ts` (novo), `src/actions/*.ts` (substituir `revalidatePath`), `src/lib/serializers/`, `src/components/ui/` (novos primitivos com 3+ usos) |

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

---

## 8. Ordem de Implementação

Execução **spec-anchored**: specs primeiro, código depois. Cada etapa só começa após a anterior estar com `pnpm typecheck` e `pnpm test` passando.

| Etapa | O que fazer | Motivo |
|---|---|---|
| 0 | Atualizar Spec 39 + Spec 15 com a nova camada `src/server/queries/` | Specs devem refletir a realidade antes do código mudar |
| 1 | **EST-08** — mover `src/lib/queries/` → `src/server/queries/` e atualizar imports | Base estrutural; muitos outros ESTs dependem dos caminhos corretos |
| 2 | **EST-03** — dividir `settings-service.ts` em 5 arquivos por entidade | Services precisam estar estáveis antes de EST-01 expandir mais deles |
| 3 | **EST-01** — mover Prisma de `user-settings.ts`, `onboarding.ts` e `budgets.ts` para services, com testes | Restaura a camada de services; testes obrigatórios antes de seguir |
| 4 | **EST-02** — criar `defineUserAction()` e converter `accounts.ts` e `user-settings.ts` | Boilerplate unificado; depende dos services do passo anterior |
| 5 | **EST-04** — remover `MONTH_NAMES` local de `BudgetFormDialog.tsx` e criar `centsToBrlInput()` | Correção pontual, sem dependências |
| 6 | **EST-05** — mover `useActionFeedback.ts`, eliminar `src/hooks/`, documentar convenção | Reorganização de hooks; sem dependências funcionais |
| 7 | **EST-06** — centralizar tooltips hardcoded de `TransactionRow.tsx` em `m.*` | Correção pontual de strings |
| 8 | **EST-07** — decompor `TransactionRow`, `TransactionTable` e `FinanceTableCard` | UI — depende de EST-06 estar feito (strings já centralizadas) |
| 9 | **EST-09** — varredura de design-tokens em todo `src/` | Auditoria final de estilo; todos os componentes do passo anterior já estão refatorados |
| 10 | **EST-10** — habilitar `noUnusedLocals`/`noUnusedParameters` + promover `unused-vars` a error + varredura manual de exportações órfãs | Feito após todos os refactors — senão removeria código que ainda vai ser importado pelos ESTs anteriores |
| 11 | **EST-11** — extrair helpers de `revalidatePath`, centralizar serialização BigInt e extrair primitivos de UI com 3+ usos | DRY geral; feito por último pois depende do código já estabilizado pelos passos anteriores |

