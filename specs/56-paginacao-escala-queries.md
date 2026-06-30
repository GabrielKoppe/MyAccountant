# Spec 56 — Paginação e Escala de Queries

> Status: draft
> Insumo: revisão de código em `src/server/queries/` (2026-06-29)
> Skills: [`performance`](../skills/performance/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`logging`](../skills/logging/SKILL.md)

---

## 1. Problema

- **PERF-01**: Em `src/server/queries/month-page.ts:347-389`, `getSectionTabData()` faz `prisma.transaction.findMany` para **todas** as transações da seção no mês (`where: { accountId, monthId, sectionId, tableId: { in: tableIds } }`), sem `skip`/`take`, com ~30 campos selecionados + `tags` + `_count` de links. Em `:391-396` o resultado inteiro é serializado em memória num loop. O mesmo padrão ocorre em `:186-199` (`getMonthSummaryData`), onde `allTransactionsRaw` carrega todas as transações do mês só para extrair listas de 20 itens (pending/favorites/recent). Acima de ~5k transações/mês o payload serializado para o client e o uso de memória degradam visivelmente.
- **PERF-02**: `src/server/queries/dashboards.ts` (~48 KB, 1173 linhas) concentra múltiplos subqueries de widgets num único arquivo monolítico. Funções de agregação distintas (breakdown por categoria, por membro, por seção, heatmaps) convivem no mesmo módulo, dificultando cache granular e leitura.
- **PERF-03**: Não há **telemetria de tempo de query**. Nenhuma das funções de `src/server/queries/*.ts` mede e loga sua própria latência; quando uma página de mês fica lenta, não há dado de P95/P99 por query para identificar o gargalo.

---

## 2. Solução

### 2.1 Paginação nas listagens de transação (PERF-01)

- Em `getSectionTabData()` (`month-page.ts`), o `findMany` de transações por tabela passa a aceitar **paginação cursor-based** (`cursor` + `take`), com `take` padrão configurável (ex.: 200) e ordenação estável (`occurredOn` DESC, `id` como desempate). A primeira página é carregada no RSC; páginas seguintes são buscadas sob demanda pela tabela client-side.
- Em `getMonthSummaryData()`, substituir o `findMany` de todas as transações (linhas `:186-199`) por **três queries dedicadas e limitadas**: `take: 20` para pending (`where isPending`), `take: 20` para favorites (`where isFavorite`), `take: 20` ordenado por `createdAt` desc para recent — eliminando o carregamento completo do mês só para fatiar 60 itens.
- O total de transações por tabela continua vindo de `_count` / `groupBy` (já presente), sem materializar linhas.

### 2.2 Divisão de `dashboards.ts` (PERF-02)

- Quebrar `src/server/queries/dashboards.ts` em módulos menores por domínio de widget, dentro de `src/server/queries/dashboards/` (ex.: `category-breakdown.ts`, `member-breakdown.ts`, `section-totals.ts`, `heatmap.ts`), reexportados por um `index.ts` para preservar os imports existentes.
- Cada função de query exportada é envolvida em **`React.cache()`** (padrão já adotado em `month-page.ts`), de forma que chamadas repetidas na mesma renderização RSC executem o Prisma uma única vez.

### 2.3 Telemetria de latência (PERF-03)

- Introduzir um helper de instrumentação (ex.: `withQueryTiming(name, fn)`) que mede a duração de cada query e emite um log estruturado Pino com `queryName`, `accountId`, `durationMs`. Aplicar nas queries de maior custo (mês e dashboards).
- O agregado de P95/P99 é derivável dos logs estruturados (skill `logging`); esta spec **não** inclui dashboard de observabilidade próprio — apenas a emissão dos eventos.

---

## 3. User Stories

- Como usuário com muitos lançamentos no mês, quero que a página de mês carregue só as primeiras transações de cada tabela, para que a tela abra rápido mesmo com milhares de transações.
- Como usuário, quero rolar/paginar a tabela e ver mais transações sob demanda, para não pagar o custo de carregar tudo de uma vez.
- Como desenvolvedor, quero `dashboards.ts` dividido em módulos pequenos e cacheados, para entender e alterar uma agregação sem ler um arquivo de 1000+ linhas.
- Como desenvolvedor, quero logs de duração por query, para identificar o gargalo quando uma página fica lenta.

---

## 4. Critérios de Aceitação

**PERF-01:**
- QUANDO `getSectionTabData` é chamada, ELA DEVE buscar no máximo `take` transações por página (não todas as transações da seção no mês).
- QUANDO o usuário pede a próxima página de uma tabela, A APLICAÇÃO DEVE buscar as transações seguintes via cursor, sem recarregar as anteriores.
- `getMonthSummaryData` NÃO DEVE executar um `findMany` sem `take` sobre todas as transações do mês; as listas de pending/favorites/recent DEVEM vir de queries com `take: 20` cada.

**PERF-02:**
- O arquivo `dashboards.ts` DEVE ser substituído por módulos sob `src/server/queries/dashboards/`, com os imports atuais preservados via `index.ts`.
- CADA função de query de dashboard exportada DEVE estar envolvida em `React.cache()`.
- QUANDO a mesma função de dashboard é chamada duas vezes na mesma renderização RSC, o Prisma DEVE executar a query uma única vez.

**PERF-03:**
- CADA query instrumentada DEVE emitir um log Pino com `queryName`, `accountId` e `durationMs`.
- A instrumentação NÃO DEVE alterar o valor de retorno da query.

---

## 5. Fora de Escopo

- Migração para paginação no nível de API REST pública (`/api/v1/transactions`) — esta spec cobre o carregamento RSC da página de mês.
- Índices novos no banco além dos necessários para a ordenação estável da paginação.
- Dashboard/painel de observabilidade de P95/P99 — apenas a emissão dos logs estruturados.
- Virtualização de linhas na UI da tabela (renderização) — é tema de performance de front, não de query.
- Cache distribuído (Redis) — `React.cache()` cobre o escopo de uma renderização.

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Estratégia de paginação | Cursor-based (`occurredOn` DESC + `id`) | Estável sob inserções; evita `OFFSET` custoso em páginas profundas |
| DD-02 | Compatibilidade dos imports | `dashboards/index.ts` reexporta | Quebra o monólito sem tocar nos call-sites |
| DD-03 | Telemetria | Logs Pino por query (sem APM dedicado) | Reusa a infra de logging existente; P95/P99 derivável dos logs |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Paginação na aba de seção | `src/server/queries/month-page.ts` (`getSectionTabData`, `getMonthSummaryData`) |
| Divisão de dashboards | `src/server/queries/dashboards.ts` → `src/server/queries/dashboards/*` |
| Helper de timing | `src/server/queries/_timing.ts` (novo) ou `src/lib/logging` |
| Consumo client-side da paginação | `src/components/transactions/TransactionTable.tsx` |

```ts
// ❌ Hoje em getSectionTabData (month-page.ts:347) — carrega tudo
const allTransactionsRaw = await prisma.transaction.findMany({
  where: { accountId, monthId, sectionId, tableId: { in: tableIds } },
  orderBy: { occurredOn: "desc" },
  select: { /* ~30 campos + tags + _count */ },
});

// ✅ Paginado, cursor estável
const page = await prisma.transaction.findMany({
  where: { accountId, monthId, sectionId, tableId: { in: tableIds } },
  orderBy: [{ occurredOn: "desc" }, { id: "desc" }],
  take: PAGE_SIZE,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  select: { /* mesmos campos */ },
});

// ✅ Listas rápidas em getMonthSummaryData — 3 queries com take, não findMany total
const [pending, favorites, recent] = await Promise.all([
  prisma.transaction.findMany({ where: { accountId, monthId, isPending: true }, take: 20, orderBy: { occurredOn: "desc" }, select: quickSelect }),
  prisma.transaction.findMany({ where: { accountId, monthId, isFavorite: true }, take: 20, orderBy: { occurredOn: "desc" }, select: quickSelect }),
  prisma.transaction.findMany({ where: { accountId, monthId }, take: 20, orderBy: { createdAt: "desc" }, select: quickSelect }),
]);
```
