# Spec 39 — Revisão de Performance e Padrões de Carregamento

> Status: approved
> Insumo: revisão de código em `src/` (auditoria de performance, 2026-06-11)
> Skills: [`performance`](../skills/performance/SKILL.md) *(criado por esta spec)* · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`testing`](../skills/testing/SKILL.md) 

---

## 1. Problema

- **PERF-01**: Nenhuma rota de `src/app/` possui `loading.tsx` (0 ocorrências) e nenhuma página usa `<Suspense>` para streaming. As páginas pesadas — `(app)/[accountId]/months/[monthId]/page.tsx` (11 queries), dashboards yearly/monthly — bloqueiam a renderização inteira até a última query resolver. Durante a navegação o usuário vê tela congelada/branca, sem feedback.
- **PERF-02**: Em `src/actions/transactions.ts:26,36,45,54,64,73,83`, todas as 7 actions de transação chamam `revalidatePath(\`/${ctx.accountId}\`, "layout")`. Criar/editar/deletar uma única transação invalida o layout inteiro da Account — incluindo a AppBar (que rebusca account, meses recentes e contador de notificações) e todas as subpáginas — quando só a página do mês afetado mudou.
- **PERF-03**: Em `(app)/[accountId]/months/[monthId]/page.tsx:210` e `:226`, `getSectionTotals()` é chamado duas vezes em série (mês atual, depois mês anterior para o delta). A segunda chamada só depende de `prevMonthItem.id`, já conhecido — são dois round-trips sequenciais ao banco que poderiam ser um `Promise.all`.
- **PERF-04**: Na mesma página (`:101-126`), `prisma.transaction.findMany` busca **todas** as transações do mês com ~20 campos; em `:164-189` a serialização BigInt→string / Date→ISO é feita inline em loops; e em `:192-217` os totais por tabela são calculados com `reduce` em JS sobre o dataset completo, quando o Postgres agregaria com um `groupBy` + `_sum`. O resultado é um payload grande serializado para o client e um RSC monolítico de 341 linhas.
- **PERF-05**: `src/components/transactions/TransactionRow.tsx` (706 linhas, client) não usa `React.memo`; em `src/components/transactions/TransactionTable.tsx:148-155`, o `useMemo` de `visibleRows` roda `sortRows()` que faz `.find()` em `categories`/`institutions` por transação (O(n×m)). A cada keystroke do campo de busca, centenas de linhas re-renderizam e o sort re-executa lookups lineares.
- **PERF-06**: Os gráficos de dashboard (`src/components/dashboards/YearlyLineChart.tsx` e demais componentes que importam `recharts`) fazem import eager — `recharts` entra no bundle inicial da rota mesmo quando o widget não está visível. Apenas o SankeyChart usa `dynamic()` (via `MonthlyDashboardClient.tsx:3`).
- **PERF-07**: Em `src/components/ui/NotificationBell.tsx:29,69`, o sino de notificações faz polling via `fetch` a cada 60 segundos **e** refetch em todo evento `focus`, sem debounce nem condicional. Uma aba aberta o dia inteiro gera centenas de requisições para um dado que raramente muda.
- **PERF-08**: Não existe nenhum padrão de performance documentado no projeto — não há skill em `skills/` cobrindo loading/streaming, revalidação granular, dedupe de queries ou code-splitting. Sintoma concreto: nenhuma função de `src/server/queries/*.ts` usa `React.cache()`, então qualquer helper chamado duas vezes na mesma renderização executa a query duas vezes. Cada feature nova decide esses pontos ad-hoc.

---

## 2. Solução

### 2.1 Carregamento progressivo (PERF-01)

Adicionar `loading.tsx` com skeletons (componentes `Skeleton` do MUI, respeitando tokens do design system) nas rotas de maior custo: `months/[monthId]`, `dashboards/yearly/[year]`, `dashboards/monthly/[monthId]` e grupo `settings/`.

**Estratégia de skeleton**: estrutural/genérico — cabeçalho + 3–4 linhas de `<Skeleton>` representando tabelas colapsadas, sem query prévia para inferir o número real de seções/tabelas.

**Estratégia de Suspense na página de mês**: cada aba (summary e cada seção) é um **async Server Component independente** envolvido em `<Suspense>`. O `page.tsx` busca apenas auth + mês atual + lista de meses e renderiza o shell (cabeçalho, tabs, `<Suspense>` com fallback skeleton por aba). Isso limita as queries ao contexto da aba ativa e permite streaming real do shell antes de qualquer dado de conteúdo. Queries compartilhadas entre abas (`getCategories`, `getInstitutions`, `getMembers`, `getAccountSettings`) ficam em funções com `React.cache()` — chamadas por cada aba, executadas uma única vez por render graças ao cache.

### 2.2 Revalidação granular (PERF-02)

Substituir `revalidatePath(`/${ctx.accountId}`, "layout")` e `updateTag(...)` nas 7 actions de transação por revalidação das rotas realmente afetadas. Regras por action:

- **`createTransactionAction`**: `monthId` vem do input → 2 `revalidatePath` (página do mês + dashboard mensal).
- **`updateTransactionAction`**: `monthId` vem do input → 2 `revalidatePath`.
- **`deleteTransactionAction`**: o service já carrega a transação no ownership check e passa a retornar `{ monthId }` → 2 `revalidatePath` usando o valor retornado.
- **`duplicateTransactionAction`**: análogo ao delete — service retorna `monthId` da transação original → 2 `revalidatePath`.
- **`bulkDeleteAction`**: o service já faz `findMany` para verificar ownership e calcula `uniqueMonthIds` (array dedupado); passa a retornar esse array → action itera e chama `revalidatePath` para cada `monthId` distinto (página + dashboard).
- **`bulkUpdateAction`**: adicionar `monthId` ao `bulkUpdateSchema`; o client sempre conhece o mês (operação ocorre dentro de uma página de mês) → 2 `revalidatePath`.
- **`moveTransactionsAction`**: `sourceMonthId` vem do input (já existe no schema); `targetMonthId` é retornado pelo service → 4 `revalidatePath` (página de origem, dashboard de origem, página de destino, dashboard de destino).

Remover **todas** as chamadas `updateTag(...)` das actions de transação — a tag `account:${ctx.accountId}` não é consumida por nenhuma rota com `fetch` + `next.tags` no projeto; as chamadas não têm efeito e seriam inconsistentes com a granularização.

### 2.3 Paralelização do delta de seções (PERF-03)

Resolver `prevMonthItem` antes do bloco de totais e buscar `getSectionTotals` do mês atual e do anterior em um único `Promise.all`.

### 2.4 Agregação no banco e serialização única (PERF-04)

- Calcular totais por tabela com `prisma.transaction.groupBy({ by: ["tableId"], _sum: { amountCents: true } })`, eliminando o `reduce` em JS.
- Extrair a serialização de transações para um helper único `serializeTransaction()` em `src/lib/serializers/transaction.ts`, reutilizável por qualquer RSC.
- Substituir a função monolítica `getMonthPageData()` por duas funções separadas em `src/server/queries/month-page.ts`, alinhadas com a arquitetura de Suspense por aba (PERF-01):
  - **`getMonthSummaryData(accountId, monthId, monthYear, monthMonth, userId)`**: dados da aba summary (sections, totais de seção via `Promise.all` com mês anterior, insights, budgets, KPIs, widgets). A paralelização de `getSectionTotals` (PERF-03) ocorre **dentro desta função**.
  - **`getSectionTabData(accountId, monthId, sectionId)`**: dados de uma aba de seção (tabelas, transações via `groupBy` + serialização com `serializeTransaction()`).
  - Queries compartilhadas entre abas (`getCategories`, `getInstitutions`, `getMembers`, `getAccountSettings`) ficam em funções nomeadas com `React.cache()` no mesmo arquivo ou em `src/server/queries/shared.ts`.
- O `page.tsx` reduz a composição pura: auth + mês + lista de meses + render do shell com `<Suspense>` por aba.

### 2.5 Memoização da tabela de transações (PERF-05)

- Envolver `TransactionRow` em `React.memo`.
- Estabilizar **todos os callbacks passados para `TransactionRow`** em `TransactionTable` com `useCallback`: `handleSelect`, `optimisticUpdate`, `onDeleteRequested`, `onDuplicated`, e o handler de `onAutoEditConsumed`. Sem `useCallback` nos callbacks, o `React.memo` não surte efeito (nova referência de função a cada render anula a comparação rasa).
- Em `sortRows`, substituir os `.find()` por `Map`s (`categoryById`, `institutionById`) construídos uma vez via `useMemo`.
- Aplicar debounce (~250ms) no `searchText` antes de entrar no `useMemo` de `visibleRows`.

### 2.6 Code-splitting de gráficos (PERF-06)

Carregar todos os componentes de gráfico (recharts e nivo) via `dynamic(() => import(...), { ssr: false, loading: <ChartSkeleton/> })`, seguindo o padrão já usado pelo SankeyChart. Centralizar os wrappers dinâmicos em `src/components/dashboards/charts/lazy.tsx` (extensão `.tsx` — o arquivo usa JSX no prop `loading`) para evitar repetição. Criar `ChartSkeleton` como componente compartilhado no mesmo diretório.

### 2.7 Polling moderado de notificações (PERF-07)

- Aumentar `POLL_INTERVAL_MS` para 5 minutos.
- No handler de `focus`, só refazer o fetch se o último fetch tiver mais de 30 segundos.
- Pausar o polling quando `document.visibilityState === "hidden"`.

### 2.8 Skill de performance (PERF-08)

Criar `skills/performance/SKILL.md` documentando os padrões consolidados por esta spec, no mínimo: (a) quando criar `loading.tsx` vs `<Suspense>` inline; (b) regra de revalidação granular (nunca `"layout"` para mutações de dados de página; remover `updateTag` sem `next.tags` correspondente); (c) `React.cache()` obrigatório em helpers de query chamados em RSC compartilhados entre componentes; (d) `dynamic()` para libs de visualização; (e) agregação no Postgres antes de agregação em JS; (f) checklist de performance para review de feature. Como parte da spec, envolver em `React.cache()` as funções de `src/server/queries/*.ts` que são efetivamente chamadas em RSC — funções usadas exclusivamente em Server Actions ou Route Handlers não precisam de `cache()` (sem efeito fora do contexto RSC).

---

## 3. User Stories

- Como usuário, quero ver a estrutura da página com skeletons imediatamente ao navegar para um mês ou dashboard, para ter feedback de que o app está respondendo.
- Como usuário com um mês de 500+ transações, quero digitar no campo de busca sem travamentos, para filtrar rapidamente.
- Como usuário, quero que salvar uma transação atualize a tela rapidamente, sem recarregar dados da AppBar que não mudaram.
- Como desenvolvedor, quero um skill de performance com regras claras, para não decidir caso a caso como carregar dados e revalidar cache.

---

## 4. Critérios de Aceitação

**PERF-01:**
- QUANDO o usuário navega para `months/[monthId]`, `dashboards/yearly/[year]` ou `dashboards/monthly/[monthId]`, a UI DEVE exibir um skeleton (via `loading.tsx`) antes dos dados chegarem.
- Os skeletons DEVEM usar componentes MUI com tokens do tema (sem hex hardcoded) e ter shape estrutural/genérico (cabeçalho + 3–4 linhas de skeleton), sem depender de query prévia.
- QUANDO o usuário está em qualquer aba de `months/[monthId]`, o shell da página (header, tabs) DEVE estar visível enquanto o conteúdo da aba ainda carrega (via `<Suspense>` por aba).
- Apenas as queries da aba ativa DEVEM ser executadas em uma renderização — queries de abas não visitadas NÃO DEVEM ir ao banco.

**PERF-02:**
- QUANDO qualquer action de `src/actions/transactions.ts` completa com sucesso, ela NÃO DEVE chamar `revalidatePath` com escopo `"layout"` nem `updateTag`.
- QUANDO uma transação é criada/editada/deletada, a página do mês afetado e o dashboard mensal correspondente DEVEM refletir o novo dado após o refresh do router.
- `deleteTransactionAction` e `duplicateTransactionAction` DEVEM obter o `monthId` a partir do retorno do service (não do input do client).
- `bulkDeleteAction` DEVE revalidar cada `monthId` distinto retornado pelo service.
- `moveTransactionsAction` DEVE emitir 4 `revalidatePath` (página e dashboard de origem + destino).
- `bulkUpdateAction` DEVE exigir `monthId` no schema de input.

**PERF-03:**
- QUANDO a página do mês renderiza com mês anterior existente, as duas chamadas de `getSectionTotals` DEVEM ser disparadas em paralelo (um único `await Promise.all`).

**PERF-04:**
- QUANDO a página do mês renderiza, os totais por tabela DEVEM vir de uma query agregada (`groupBy` + `_sum`), e NÃO de `reduce` em JS sobre as transações.
- A serialização de transações DEVE ocorrer exclusivamente via `serializeTransaction()` — nenhum RSC DEVE converter BigInt/Date de transação inline.
- O arquivo `months/[monthId]/page.tsx` DEVE ficar com menos de 150 linhas após a extração das funções de query.
- As funções `getMonthSummaryData()` e `getSectionTabData()` DEVEM existir em `src/server/queries/month-page.ts`.

**PERF-05:**
- ENQUANTO o usuário digita no campo de busca, linhas cuja transação não mudou NÃO DEVEM re-renderizar (verificável com React DevTools Profiler).
- `sortRows` NÃO DEVE conter `.find()` por item — lookups DEVEM usar `Map` pré-construído.
- Os callbacks `handleSelect`, `optimisticUpdate`, `onDeleteRequested`, `onDuplicated` e `onAutoEditConsumed` em `TransactionTable` DEVEM ser estabilizados com `useCallback`.

**PERF-06:**
- QUANDO uma rota de dashboard é compilada, `recharts` NÃO DEVE estar no chunk inicial da rota (verificável com `next build` + análise de bundle); todos os gráficos DEVEM ser importados via `dynamic()`.

**PERF-07:**
- ENQUANTO a aba está oculta (`visibilityState === "hidden"`), o NotificationBell NÃO DEVE fazer requisições.
- QUANDO a janela recebe `focus` e o último fetch tem menos de 30 segundos, NÃO DEVE haver novo fetch.

**PERF-08:**
- O arquivo `skills/performance/SKILL.md` DEVE existir cobrindo os itens (a)–(f) da §2.8.
- Funções de `src/server/queries/*.ts` efetivamente chamadas em RSC DEVEM estar envolvidas em `React.cache()`. Funções usadas exclusivamente em Server Actions ou Route Handlers NÃO precisam de `cache()`.
- SE a mesma função de query (com `React.cache()`) for chamada duas vezes na mesma renderização RSC, o Prisma DEVE executar apenas uma query (verificável com log de queries em dev).

---

## 5. Fora de Escopo

- Lazy-loading de transações por tabela (carregar sob demanda ao expandir) — mudança de UX que merece spec própria; esta spec apenas prepara o terreno (agregados via `groupBy`).
- Substituir polling de notificações por WebSocket/SSE — infraestrutura nova, fora do escopo (o polling moderado resolve o custo atual).
- Virtualização da tabela de transações (`react-window`/`react-virtuoso`) — avaliar só se a memoização não bastar.
- Caching HTTP/CDN, ISR e `unstable_cache` — o app é fortemente dinâmico por sessão; não aplicar nesta spec.
- Otimização de imagens, fonts e métricas de Web Vitals em produção.
- Refatoração estrutural de pastas/camadas — coberta pela Spec 40.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| `loading.tsx` vs `<Suspense>` | `loading.tsx` para o shell da rota + `<Suspense>` por aba (async Server Component) | `loading.tsx` dá feedback de navegação imediato; `<Suspense>` por aba limita queries ao contexto ativo e permite streaming real do shell |
| Skeleton shape | Estrutural/genérico (cabeçalho + 3–4 linhas) sem query prévia | Query prévia adicionaria complexidade sem ganho de UX significativo; skeleton genérico é suficiente para feedback visual |
| Suspense na página de mês | Opção C: cada aba = async Server Component independente | Elimina queries de abas não visitadas; maximiza streaming; reforça o padrão RSC do projeto |
| Dados compartilhados entre abas | `React.cache()` em funções de query compartilhadas | Zero round-trips extras; page.tsx não bloqueia em dados comuns; coerente com PERF-08 |
| Revalidação | `revalidatePath` granular por rota; `updateTag` removido | `revalidateTag` exigiria `unstable_cache`/tags em todas as queries; `updateTag` sem `next.tags` correspondente é dead code |
| `monthId` em actions de delete/duplicate | Service retorna o valor carregado no ownership check | Zero round-trip extra; evita confiar em dado do client; segue o padrão "service é dono dos dados" |
| `bulkDelete` revalidação | Iterar sobre `uniqueMonthIds` retornados pelo service | Service já calcula o array para notificações; zero custo adicional |
| `moveTransactions` revalidação | 4 `revalidatePath` (origem + destino × página + dashboard) | Dados mudam em dois meses distintos; `sourceMonthId` já está no schema; `targetMonthId` retornado pelo service |
| `React.memo` em `TransactionRow` | Memo + `useCallback` obrigatório nos 5 callbacks do pai | Callbacks inline anulam comparação rasa do memo; sem `useCallback`, a otimização não produz efeito real |
| Dedupe de queries | `React.cache()` apenas em funções chamadas em RSC | `cache()` fora do contexto RSC não tem efeito; aplicar em Server Actions seria ruído sem benefício |
| `lazy.tsx` extensão | `.tsx` (não `.ts`) | Arquivo usa JSX no prop `loading` do `dynamic()` |
| Debounce da busca | 250ms no estado derivado, não no input | O input continua responsivo (controlado), só o filtro/sort pesado é adiado |

---

## 7. Referências Técnicas

### 7.1 Escopo de arquivos por critério

O spec define **padrões**, não listas de arquivos. O implementador DEVE aplicar cada padrão a **todo arquivo do projeto que satisfaça o critério**, não apenas aos exemplos citados no §1.

| Critério de busca | Padrão a aplicar | PERF |
|---|---|---|
| Qualquer `revalidatePath(…, "layout")` em `src/actions/` | Substituir por revalidação granular das rotas afetadas pela mutação | 02 |
| Qualquer `updateTag(…)` em `src/actions/` sem `next.tags` correspondente em queries | Remover | 02 |
| Qualquer `import … from "recharts"` ou `import … from "@nivo/…"` em `src/components/` | Mover para `lazy.tsx` com `dynamic()` | 06 |
| Qualquer função exportada de `src/server/queries/` chamada diretamente em RSC (page.tsx, layout.tsx, async Server Components) | Envolver em `React.cache()` | 08 |
| Qualquer serialização inline de `BigInt→string` ou `Date→ISO` referente a transações em RSC | Substituir por `serializeTransaction()` | 04 |
| Qualquer `prisma.transaction.findMany` seguido de `reduce` para somar `amountCents` | Substituir por `groupBy` + `_sum` | 04 |

> **Como usar**: antes de fechar cada PERF, rodar a busca correspondente no workspace inteiro e confirmar que não há ocorrências do anti-padrão restantes. Os critérios são verificáveis com `grep_search` ou busca no editor.

### 7.2 Arquivos confirmados no código atual

Inventário dos anti-padrões identificados na auditoria de 2026-06-11 que servem como ponto de partida (pode haver mais — use os critérios da §7.1 para verificação completa):

| Item | Arquivo(s) a tocar |
|---|---|
| PERF-01 | `src/app/(app)/[accountId]/months/[monthId]/loading.tsx` (novo), `src/app/(app)/[accountId]/dashboards/yearly/[year]/loading.tsx` (novo), `src/app/(app)/[accountId]/dashboards/monthly/[monthId]/loading.tsx` (novo), `src/app/(app)/[accountId]/settings/loading.tsx` (novo), `months/[monthId]/page.tsx` (shell + `<Suspense>` por aba), componentes de aba extraídos como async Server Components |
| PERF-02 | `src/actions/transactions.ts`, `src/actions/finance-tables.ts`, `src/actions/table-templates.ts`, `src/actions/dashboard-layout.ts`, `src/server/services/transaction-service.ts` (retorno de `monthId`/`uniqueMonthIds`), `src/lib/schemas/transaction.ts` (adicionar `monthId` ao `bulkUpdateSchema`) |
| PERF-03 | absorvido por `getMonthSummaryData()` — `Promise.all` com `getSectionTotals` ocorre dentro da função |
| PERF-04 | `src/app/(app)/[accountId]/months/[monthId]/page.tsx`, `src/lib/serializers/transaction.ts` (novo, `serializeTransaction`), `src/server/queries/month-page.ts` (novo, `getMonthSummaryData` + `getSectionTabData` + queries compartilhadas com `React.cache()`) |
| PERF-05 | `src/components/transactions/TransactionRow.tsx`, `src/components/transactions/TransactionTable.tsx` |
| PERF-06 | `src/components/dashboards/charts/lazy.tsx` (novo), `src/components/dashboards/charts/ChartSkeleton.tsx` (novo), todos os componentes com `import … from "recharts"` em `src/components/dashboards/` (confirmados na auditoria: `YearlyLineChart`, `SectionPieChart`, `PieBreakdown`, `CategoryTreemap`, `MonthSectionBarChart`, `MemberTrendChart`, `BreakdownBarChart`, `MonthlyBarChart`, `KpiCard`, `KpiSparklineCard`, `MemberBreakdownChart`, `WeeklySpendingWidget`, `MemberRadarWidget`) |
| PERF-07 | `src/components/ui/NotificationBell.tsx` |
| PERF-08 | `skills/performance/SKILL.md` (novo), funções RSC em `src/server/queries/*.ts` |

### Revalidação granular (PERF-02)

```ts
// ✅ Correto — create/update: monthId vem do input
export const createTransactionAction = defineAction({
  handler: async (input, ctx) => {
    const tx = await txService.createTransaction(input, ctx);
    revalidatePath(`/${ctx.accountId}/months/${input.monthId}`);
    revalidatePath(`/${ctx.accountId}/dashboards/monthly/${input.monthId}`);
    return tx;
  },
});

// ✅ Correto — delete/duplicate: monthId retornado pelo service
export const deleteTransactionAction = defineAction({
  handler: async (input, ctx) => {
    const { monthId } = await txService.deleteTransaction(input, ctx);
    revalidatePath(`/${ctx.accountId}/months/${monthId}`);
    revalidatePath(`/${ctx.accountId}/dashboards/monthly/${monthId}`);
  },
});

// ✅ Correto — bulkDelete: iterar uniqueMonthIds retornados pelo service
export const bulkDeleteAction = defineAction({
  handler: async (input, ctx) => {
    const { uniqueMonthIds } = await txService.bulkDelete(input, ctx);
    for (const monthId of uniqueMonthIds) {
      revalidatePath(`/${ctx.accountId}/months/${monthId}`);
      revalidatePath(`/${ctx.accountId}/dashboards/monthly/${monthId}`);
    }
  },
});

// ✅ Correto — moveTransactions: 4 revalidatePaths
export const moveTransactionsAction = defineAction({
  handler: async (input, ctx) => {
    const result = await txService.moveTransactions(input, ctx);
    revalidatePath(`/${ctx.accountId}/months/${input.sourceMonthId}`);
    revalidatePath(`/${ctx.accountId}/dashboards/monthly/${input.sourceMonthId}`);
    revalidatePath(`/${ctx.accountId}/months/${result.targetMonthId}`);
    revalidatePath(`/${ctx.accountId}/dashboards/monthly/${result.targetMonthId}`);
    return result;
  },
});

// ❌ Anti-padrão — invalida AppBar + todas as subpáginas da Account + dead code
revalidatePath(`/${ctx.accountId}`, "layout");
updateTag(`account:${ctx.accountId}`);
```

### Paralelização + agregação (PERF-03, PERF-04)

```ts
// ✅ Correto — dentro de getMonthSummaryData() em src/server/queries/month-page.ts
// Promise.all com getSectionTotals do mês atual e anterior + groupBy no Postgres
const [sectionTotalsRaw, prevTotalsRaw, tableTotalsRaw] = await Promise.all([
  getSectionTotals(accountId, monthId, sectionIds),
  prevMonthItem ? getSectionTotals(accountId, prevMonthItem.id, sectionIds) : Promise.resolve(null),
  prisma.transaction.groupBy({
    by: ["tableId"],
    where: { accountId, monthId },
    _sum: { amountCents: true },
  }),
]);

// ❌ Anti-padrão — awaits em série + soma em JS do dataset inteiro
const sectionTotalsRaw = await getSectionTotals(accountId, monthId, sectionIds);
const prevTotalsRaw = await getSectionTotals(accountId, prevMonthItem.id, sectionIds);
const total = txList.reduce((sum, tx) => sum + BigInt(tx.amountCents), 0n);
```

### Dedupe com React.cache (PERF-08)

```ts
// ✅ Correto — funções chamadas em RSC, com React.cache()
// src/server/queries/month-page.ts
import { cache } from "react";

export const getCategories = cache(async (accountId: string) => {
  return prisma.category.findMany({ where: { accountId }, ... });
});

// Chamada por getMonthSummaryData E getSectionTabData na mesma render → executa 1x
export const getMonthSummaryData = cache(async (...) => { ... });
export const getSectionTabData = cache(async (...) => { ... });

// ❌ Anti-padrão — função "nua": duas chamadas na mesma render = duas queries
export async function getCategories(accountId: string) { ... }
```

### Gráfico com dynamic (PERF-06)

```tsx
// ✅ Correto — src/components/dashboards/charts/lazy.tsx (extensão .tsx — usa JSX)
import dynamic from "next/dynamic";
import { ChartSkeleton } from "./ChartSkeleton";

export const YearlyLineChart = dynamic(() => import("../YearlyLineChart"), {
  ssr: false,
  loading: () => <ChartSkeleton height={300} />,
});

// ❌ Anti-padrão — recharts no bundle inicial da rota
import { LineChart, Line } from "recharts";
```

---

## 8. Checklist de verificação pós-implementação

Antes de considerar o spec concluído, verificar **todo o workspace** com os critérios abaixo. Nenhum item deve ter ocorrências restantes.

```bash
# PERF-02a — revalidatePath de layout amplo em actions
grep -rn 'revalidatePath.*"layout"' src/actions/

# PERF-02b — updateTag sem next.tags correspondente
grep -rn 'updateTag(' src/actions/

# PERF-04a — serialização inline de BigInt de transação em RSC
grep -rn 'amountCents\.toString()' src/app/

# PERF-04b — reduce somando amountCents em JS
grep -rn 'amountCents.*reduce\|reduce.*amountCents' src/app/ src/components/

# PERF-06 — recharts eager import em componentes
grep -rn 'from "recharts"' src/components/

# PERF-08 — funções de query RSC sem React.cache
grep -rn 'export async function\|export function' src/server/queries/
# (verificar manualmente se as que são chamadas em RSC estão com cache())
```

Cada comando DEVE retornar zero resultados (ou apenas ocorrências justificadas com comentário `// perf: não-RSC`). O implementador registra o resultado no PR com um snapshot de cada busca.
