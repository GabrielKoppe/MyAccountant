# Skill: RSC / Client Boundary

> Quando usar React Server Components vs Client Components, como serializar dados na fronteira, e como estruturar carregamento progressivo. Alinhado com a spec 39 (performance).

---

## 1. Decisão: RSC vs Client Component

```
Precisa de hooks (useState, useEffect, useTransition)?  → Client
Usa APIs de browser (window, localStorage)?             → Client
Tem interatividade (click handler, form controlado)?    → Client
Usa recharts / @nivo / qualquer lib de visualização?    → Client

Busca dados diretamente do banco (Prisma)?              → RSC
Conteúdo estático / apenas leitura?                     → RSC  (padrão)
Recebe dados como props e só renderiza?                 → RSC (preferível)
```

**Regra prática**: comece com RSC. Mova para Client Component apenas quando um dos itens acima exigir.

### Composição — Server wraps Client

```tsx
// ✅ Padrão: RSC page busca dados, passa para Client Component
// src/app/(app)/[accountId]/months/[monthId]/page.tsx  (RSC)
export default async function MonthPage({ params }) {
  const data = await getMonthPageData(accountId, monthId);   // Prisma direto no RSC
  return <TransactionTable data={data} />;                   // Client Component
}

// src/components/transactions/TransactionTable.tsx
"use client";
export function TransactionTable({ data }: Props) { ... }
```

```tsx
// ❌ Não fazer: Client Component buscando dados próprios
"use client";
export function TransactionTable({ monthId }: { monthId: string }) {
  const [data, setData] = useState(null);
  useEffect(() => { fetch(`/api/...`).then(...) }, [monthId]);  // waterfall + sem cache RSC
}
```

---

## 2. Serialização na fronteira RSC → Client

Next.js serializa props via JSON ao passar de RSC para Client Component. **Tipos que precisam de conversão:**

### BigInt → string

```typescript
// No RSC (query / serializer):
// ✅ Sempre serializar como string
return {
  amountCents: tx.amountCents.toString(),   // BigInt → string
  totalCents: total.toString(),
};

// No Client Component (uso):
formatCentsToBrl(BigInt(data.amountCents))        // display
Number(BigInt(data.amountCents)) / 100            // recharts
BigInt(data.totalCents) >= 0n                     // comparação

// ❌ Nunca passar BigInt diretamente — Next.js lança erro de serialização
return { amountCents: tx.amountCents };
```

### Date → string ISO

```typescript
// No RSC:
return {
  occurredOn: tx.occurredOn.toISOString().slice(0, 10),  // "2026-01-15" (sem hora)
  createdAt: tx.createdAt.toISOString(),                 // "2026-01-15T14:30:00.000Z"
};

// No Client Component:
import { parseLocalDate, formatDateBr } from "@/lib/dates";
formatDateBr(data.occurredOn)   // usa parseLocalDate internamente — evita hydration mismatch
new Date(data.createdAt)        // timestamps ISO são seguros com new Date()
```

> **Por que `parseLocalDate`?** `new Date("2026-01-15")` interpreta como UTC midnight, que em BRT (UTC-3) vira 31/12 no cliente → hydration mismatch. `parseLocalDate` cria `Date` no fuso local. Ver `skills/date-timezone/SKILL.md`.

### Serializer centralizado

Para entidades repetidas (ex: Transaction), extrair a serialização para um helper:

```typescript
// src/lib/serializers/transaction.ts
export type SerializedTransaction = { ... };

export function serializeTransaction(tx: PrismaTransaction): SerializedTransaction {
  return {
    id: tx.id,
    amountCents: tx.amountCents.toString(),
    occurredOn: tx.occurredOn.toISOString().slice(0, 10),
    // ...
  };
}
```

Nunca fazer conversão inline em RSC page — centralizar no serializer para consistência.

---

## 3. `React.cache()` — deduplicação de queries

Funções de query chamadas mais de uma vez na mesma renderização (ex: por dois componentes na árvore RSC) executam a query duas vezes sem `cache`.

```typescript
// src/lib/queries/dashboards.ts
import { cache } from "react";  // React.cache, não Next.js unstable_cache

// ✅ Com cache — chamadas duplicadas na mesma render são deduplicadas
export const getYearOverview = cache(async (accountId: string, year: number) => {
  return prisma.year.findFirst({ where: { accountId, year }, include: { ... } });
});

// ❌ Sem cache — duas chamadas = duas queries ao banco
export async function getYearOverview(accountId: string, year: number) { ... }
```

**Regra**: toda função exportada de `src/lib/queries/*.ts` deve ser envolvida em `React.cache()`.

`React.cache` é scoped por request — não há risco de vazamento entre usuários.

---

## 4. Carregamento progressivo

Padrão definido na [spec 39](specs/39-revisao-performance-carregamento.md):

- **`loading.tsx`** → feedback imediato de navegação (shell da rota inteira)
- **`<Suspense>`** inline → streaming de blocos pesados dentro da página

```
src/app/(app)/[accountId]/months/[monthId]/
  ├── page.tsx          → RSC principal
  └── loading.tsx       → skeleton do shell (exibido pelo router imediatamente)
```

```tsx
// loading.tsx — skeleton que espelha o layout real da página
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import { layout } from "@/lib/design-tokens";

export default function Loading() {
  return (
    <Stack spacing={layout.section} sx={{ p: layout.page }}>
      <Skeleton variant="text" width={240} height={32} />
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: layout.cluster }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={80} sx={{ borderRadius: 1.5 }} />
        ))}
      </Box>
      <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1.5 }} />
    </Stack>
  );
}
```

```tsx
// page.tsx — Suspense para blocos pesados internos
export default async function MonthPage({ params }) {
  const lightData = await getLightData(accountId, monthId);   // rápido, não bloqueia

  return (
    <Box>
      <MonthHeader data={lightData} />
      <Suspense fallback={<Skeleton variant="rectangular" height={320} />}>
        <HeavyChart accountId={accountId} monthId={monthId} />
      </Suspense>
    </Box>
  );
}
```

Skeletons devem usar componentes MUI (`Skeleton` de `@mui/material`) com tokens do tema — sem hex hardcoded, sem layout shift perceptível.

---

## 5. `dynamic()` para libs de visualização

Recharts e @nivo são browser-only e pesadas. Carregar via `dynamic` para não entrar no bundle inicial da rota:

```typescript
// src/components/dashboards/charts/lazy.ts
import dynamic from "next/dynamic";
import Skeleton from "@mui/material/Skeleton";

export const CategoryTreemap = dynamic(
  () => import("../CategoryTreemap").then((m) => m.CategoryTreemap),
  {
    ssr: false,
    loading: () => <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />,
  },
);

export const MonthlyBarChart = dynamic(
  () => import("../MonthlyBarChart").then((m) => m.MonthlyBarChart),
  {
    ssr: false,
    loading: () => <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1.5 }} />,
  },
);
```

Importar sempre do `lazy.ts` nas pages/dashboards — nunca importar diretamente:

```tsx
// ✅
import { CategoryTreemap } from "@/components/dashboards/charts/lazy";

// ❌ — recharts entra no bundle inicial da rota
import { CategoryTreemap } from "@/components/dashboards/CategoryTreemap";
```

---

## 6. Revalidação granular

Após mutação (create / update / delete), revalidar **apenas** as rotas afetadas — nunca o layout inteiro:

```typescript
// ✅ Granular — revalida só a página que mudou
revalidatePath(`/${accountId}/months/${monthId}`);
revalidatePath(`/${accountId}/dashboards/monthly/${monthId}`);

// ❌ Invalida AppBar + todas as subpáginas da Account
revalidatePath(`/${accountId}`, "layout");
```

Ver [specs/39-revisao-performance-carregamento.md](specs/39-revisao-performance-carregamento.md) §2.2 para detalhes.

---

## Anti-padrões

| ❌ Não fazer | ✅ Fazer |
|---|---|
| Passar `BigInt` como prop de RSC para Client | `.toString()` no RSC, `BigInt(str)` no Client |
| `new Date("YYYY-MM-DD")` no Client | `parseLocalDate(str)` de `@/lib/dates` |
| `export async function getQuery(...)` sem `cache` | `export const getQuery = cache(async ...)` |
| Client Component buscando dados com `useEffect`/`fetch` | RSC page busca os dados e passa como props |
| `import { LineChart } from "recharts"` direto em page | `import { LineChart } from "@/components/dashboards/charts/lazy"` |
| `loading.tsx` sem Suspense interno para blocos pesados | `loading.tsx` (shell) + `<Suspense>` para componentes lentos |
| `revalidatePath(\`/${accountId}\`, "layout")` | `revalidatePath` granular por rota afetada |
| Converter BigInt inline no RSC page | `serializeTransaction()` centralizado |

---

## Referência de arquivos

| Arquivo | Papel |
|---|---|
| [src/lib/serializers/transaction.ts](src/lib/serializers/transaction.ts) | Serializer centralizado (a criar per spec 39) |
| [src/lib/queries/](src/lib/queries/) | Funções de query — todas devem usar `React.cache` |
| [src/components/dashboards/charts/lazy.ts](src/components/dashboards/charts/lazy.ts) | Dynamic imports de gráficos (a criar per spec 39) |
| [src/lib/dates.ts](src/lib/dates.ts) | `parseLocalDate`, `formatDateBr`, `formatDateShort` |
| [src/lib/money.ts](src/lib/money.ts) | `formatCentsToBrl` |
| [specs/39-revisao-performance-carregamento.md](specs/39-revisao-performance-carregamento.md) | Spec de performance e carregamento (alinhamento) |
