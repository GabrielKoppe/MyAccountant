# Skill: Performance

> Padrões de performance estabelecidos pela Spec 39. **Ler antes de criar rotas, queries, actions ou componentes de gráfico.**

---

## (a) `loading.tsx` vs `<Suspense>` inline

| Situação | Usar |
|---|---|
| Feedback imediato ao navegar para uma rota | `loading.tsx` na pasta da rota |
| Conteúdo pesado *dentro* da rota que não bloqueia o shell | `<Suspense>` inline com fallback de skeleton |
| Aba independente com query própria (ex: tabs de seção) | Async Server Component envolvido em `<Suspense key={id}>` |

**Regra**: o `loading.tsx` dá feedback de navegação imediato. O `<Suspense>` por aba impede que queries de abas não visitadas sejam executadas. Use os dois em conjunto para páginas com múltiplas abas pesadas.

```tsx
// ✅ Correto — page.tsx: shell + Suspense por aba
<Suspense key={activeSection.id} fallback={<TabContentSkeleton />}>
  <SectionTab accountId={accountId} sectionId={activeSection.id} />
</Suspense>

// ❌ Anti-padrão — page.tsx aguarda todas as queries antes de renderizar qualquer coisa
const [data1, data2, data3] = await Promise.all([query1(), query2(), query3()]);
```

**Skeleton shape**: estrutural/genérico (cabeçalho + 3–4 linhas). Não fazer query prévia para inferir o layout real.

---

## (b) Revalidação granular — nunca `"layout"`

**Regra**: `revalidatePath(path, "layout")` invalida toda a subárvore incluindo AppBar, navbar e dados globais. Isso re-executa queries que não mudaram. Sempre revalidar apenas as rotas que a mutação afeta.

```ts
// ✅ Correto — helper reutilizável para ações de transação
function revalidateMonth(accountId: string, monthId: string) {
  revalidatePath(`/${accountId}/months/${monthId}`);
  revalidatePath(`/${accountId}/dashboards/monthly/${monthId}`);
}

// ❌ Anti-padrão — invalida AppBar e todas as subpáginas
revalidatePath(`/${accountId}`, "layout");
```

**Regras por tipo de mutação**:

| Tipo de mutação | `monthId` disponível em | Revalidar |
|---|---|---|
| `createTransaction` | retorno do service | página do mês + dashboard mensal |
| `updateTransaction` | retorno do service | página do mês + dashboard mensal |
| `deleteTransaction` | retorno do service (ownership check já buscou) | página do mês + dashboard mensal |
| `bulkDelete` | `uniqueMonthIds` retornados pelo service | cada monthId distinto × (mês + dashboard) |
| `moveTransactions` | `sourceMonthId` (input) + `targetMonthId` (retorno) | 4 revalidações |
| `updateFinanceTable` | retorno do service (ownership check já buscou) | página do mês + dashboard mensal |

**Sobre `updateTag`**: só tem efeito em rotas com `fetch(..., { next: { tags: [...] } })`. Não usar em projetos com Prisma direto em RSC sem `unstable_cache` com tags.

---

## (c) `React.cache()` — obrigatório em helpers de query RSC

**Quando usar**: em qualquer função de query chamada diretamente em RSC (pages, layouts, async Server Components). Se a função pode ser chamada por dois componentes distintos na mesma renderização, envolva em `cache()`.

**Quando NÃO usar**: funções chamadas exclusivamente por Server Actions ou Route Handlers. `cache()` só funciona no contexto RSC — fora disso é um no-op que polui o código.

```ts
// ✅ Correto — src/lib/queries/month-page.ts
import { cache } from "react";

export const getMonthCategories = cache(async (accountId: string) =>
  prisma.category.findMany({ where: { accountId }, ... }),
);
// Chamada por MonthSummaryTab E SectionTab na mesma render → executa 1x

// ❌ Anti-padrão — função "nua": duas chamadas = duas queries
export async function getMonthCategories(accountId: string) { ... }
```

---

## (d) `dynamic()` — obrigatório para libs de visualização

**Regra**: qualquer componente que importe `recharts`, `@nivo/*` ou outras libs de gráfico (pesadas, client-only) deve ser carregado via `dynamic()`. Isso impede que a lib entre no bundle inicial da rota.

**Como usar**: importar sempre de `@/components/dashboards/charts/lazy.tsx` em vez do arquivo original.

```tsx
// ✅ Correto — importar de lazy.tsx
import { YearlyLineChart, KpiCard, SankeyChart } from "@/components/dashboards/charts/lazy";

// ❌ Anti-padrão — recharts/nivo no bundle inicial da rota
import { YearlyLineChart } from "@/components/dashboards/charts/YearlyLineChart";
import { LineChart } from "recharts";
```

**Adicionando um novo gráfico**:
1. Crie o componente em `src/components/dashboards/charts/` ou `panels/` normalmente com import direto de recharts.
2. Adicione um wrapper em `lazy.tsx`:
```tsx
export const MeuNovoChart = dynamic(
  () => import("./MeuNovoChart").then((m) => ({ default: m.MeuNovoChart })),
  { ssr: false, loading: () => <ChartSkeleton height={260} /> },
);
```
3. Importe `MeuNovoChart` de `lazy.tsx` nos dashboards/widgets.

---

## (e) Agregação no Postgres antes de JS

**Regra**: totais, contagens e somas devem ser calculados no Postgres via `groupBy + _sum`. Nunca usar `Array.reduce()` em JS para somar valores vindos de uma query completa.

```ts
// ✅ Correto — Postgres agrega
const tableTotals = await prisma.transaction.groupBy({
  by: ["tableId"],
  where: { accountId, monthId },
  _sum: { amountCents: true },
});
const total = tableTotals.find(r => r.tableId === id)?._sum.amountCents ?? 0n;

// ❌ Anti-padrão — JS soma dataset inteiro
const allTxs = await prisma.transaction.findMany({ where: { accountId, monthId } });
const total = allTxs.reduce((sum, tx) => sum + tx.amountCents, 0n);
```

---

## (f) Checklist de performance para review de feature

Antes de aprovar qualquer PR que toque em rotas pesadas, actions ou gráficos:

```bash
# 1. revalidatePath "layout" em actions?
grep -rn 'revalidatePath.*"layout"' src/actions/

# 2. updateTag sem next.tags correspondente?
grep -rn 'updateTag(' src/actions/

# 3. Serialização inline de transações em RSC?
grep -rn 'amountCents\.toString()' src/app/

# 4. reduce somando amountCents?
grep -rn 'reduce.*amountCents\|amountCents.*reduce' src/app/ src/components/

# 5. Import direto de recharts em componente não-lazy?
grep -rn 'from "recharts"' src/components/

# 6. Função de query RSC sem React.cache?
grep -rn 'export async function' src/lib/queries/
# (verificar manualmente se as chamadas em RSC estão com cache())

# 7. Nova rota pesada sem loading.tsx?
# (verificar manualmente se existe loading.tsx na pasta)
```

Cada ponto deve retornar **zero resultados** (ou ocorrências justificadas com `// perf: não-RSC`).

---

## Polling e side-effects

Para dados que raramente mudam (ex: notificações), seguir as regras do `NotificationBell`:
- Poll: no mínimo 5 minutos.
- `focus`: só refetch se último fetch tem mais de 30 segundos.
- Visibilidade: não fazer fetch quando `document.visibilityState === "hidden"`.

```ts
const POLL_INTERVAL_MS = 5 * 60_000;
const FOCUS_DEBOUNCE_MS = 30_000;

const onFocus = () => {
  if (Date.now() - lastFetchRef.current > FOCUS_DEBOUNCE_MS) {
    void refreshData();
  }
};
```

---

## Serialização centralizada de transações

**Nunca** converter `amountCents.toString()` ou `.toISOString()` de transações inline em RSC. Usar sempre `serializeTransaction()`:

```ts
import { serializeTransaction } from "@/lib/serializers/transaction";

// ✅ Correto
const rows = txs.map(serializeTransaction);

// ❌ Anti-padrão — serialização inline
const rows = txs.map(tx => ({
  ...tx,
  amountCents: tx.amountCents.toString(),
  occurredOn: tx.occurredOn.toISOString().slice(0, 10),
}));
```
