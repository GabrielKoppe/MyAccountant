# Spec 33 — Widgets Configuráveis de Dashboard e Resumo

> Status: draft
> Insumo: revisão de código em `src/components/dashboards/MonthlyDashboardClient.tsx`, `src/components/months/MonthSummary.tsx`, `src/app/(app)/[accountId]/dashboards/yearly/[year]/page.tsx`; ideia do desenvolvedor (widgets configuráveis estilo Android).
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`dashboards-charts`](../skills/dashboards-charts/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md)

---

## 1. Problema

A composição visual das áreas analíticas é **fixa e hardcoded**. Não há como o usuário escolher quais blocos (gráficos, indicadores, listas) quer ver, nem em que ordem. Isso torna as telas longas, com blocos irrelevantes para alguns perfis (ex.: quem não usa Sankey ou metas), sem nenhuma forma de enxugar ou priorizar.

- **FEAT-01**: Em `src/components/dashboards/MonthlyDashboardClient.tsx:190–419`, todos os blocos do dashboard mensal (6 KPIs, metas, heatmap, treemap, Sankey, pizzas, análises fixadas, maiores transações) são renderizados em **ordem fixa em JSX**. Não há prop de layout nem leitura de preferência — a ordem e a visibilidade são imutáveis.
- **FEAT-02**: Em `src/app/(app)/[accountId]/dashboards/yearly/[year]/page.tsx:94–240`, o dashboard anual (KPIs, `MonthCardGrid`, `MonthlyBarChart`, `PinnedAnalysesSection`, `CategoryBarList`) também é montado em ordem fixa direto na página RSC.
- **FEAT-03**: Em `src/components/months/MonthSummary.tsx:112–322`, o "Resumo do mês" (total, 3 KPIs, metas, cards de seção, listas de atividade) é montado em ordem fixa, sem configuração.
- **FEAT-04**: Não existe modelo de persistência para arranjo de blocos. Em `prisma/schema.prisma` há apenas `SavedAnalysis.pinnedOrder` (linha 412–430), que ordena **análises salvas** dentro de um único bloco — não serve para ordenar/ocultar os blocos das três áreas.
- **UX-05**: Em `src/app/(app)/[accountId]/settings/layout.tsx:14–24`, a navegação de Configurações não tem entrada para gerenciar a visualização dos dashboards. Não há lugar na UI onde o usuário organize essas áreas.

---

## 2. Solução

Introduzir o conceito de **widget**: cada bloco analítico vira um widget identificado por `widgetId`, com `kind` (`kpi` compacto ou `panel`) e um `span` padrão. Um **registry em código** é a fonte da verdade dos widgets disponíveis por contexto; um **layout persistido por Account** (ordem + visibilidade) é a preferência aplicada na renderização. Uma nova tela em Configurações permite reordenar (drag-and-drop) e ligar/desligar widgets por área.

Escopo das três áreas (contextos): `monthly` (dashboard mensal), `yearly` (dashboard anual), `month_summary` (aba Resumo do mês).

### 2.1 Modelo de dados (FEAT-04)

- Nova tabela `DashboardLayout` com `@@unique([accountId, context])`. `context` é um enum (`monthly` | `yearly` | `month_summary`). O arranjo é salvo em `widgets Json` como array ordenado de `{ widgetId, visible }`. Ordem do array = ordem de exibição.
- Layout é **por Account** (compartilhado entre membros — decisão do desenvolvedor). Editar exige papel `owner`/`editor`; `viewer` apenas vê o resultado.
- **Ausência de linha = padrões do registry.** Nenhum backfill: contas existentes mantêm exatamente o visual atual via ordem/visibilidade default definidas no registry.

### 2.2 Registry e reconciliação (FEAT-01, FEAT-02, FEAT-03)

- `widget-registry` define, por contexto, a lista canônica de widgets: `id`, `label` (via `m.*`), `kind`, `defaultSpan`, `defaultVisible`.
- A leitura do layout **reconcilia** o JSON persistido com o registry: mantém a ordem salva (descartando `widgetId` desconhecidos) e **anexa ao final** widgets do registry ainda não presentes (com `defaultVisible`). Isso garante compat-forward: novos widgets adicionados em código aparecem automaticamente sem migração de dados.
- Guards de dados existentes são **preservados**: um widget visível no layout mas sem dados se comporta como hoje (ex.: Sankey sem entradas não renderiza; KPI "Pendentes" só se `> 0`). O layout controla **inclusão e ordem**, não substitui os guards.

### 2.3 Renderização (FEAT-01, FEAT-02, FEAT-03)

- Novo `DashboardWidgetRenderer` recebe a lista resolvida (ordenada, só visíveis) e um mapa `widgetId → { node, kind, span }` produzido pela página/cliente. Regras de arranjo que **preservam o visual atual** quando os widgets estão na ordem default:
  - widgets `kind: "kpi"` **consecutivos** colapsam em uma faixa de grid responsiva (como a linha de 6 KPIs hoje);
  - widgets `kind: "panel"` com `span: "half"` **consecutivos** pareiam em linha de 2 colunas (como heatmap+treemap e as duas pizzas hoje); um `half` isolado ocupa a largura total;
  - widgets `panel` com `span: "full"` ocupam a linha inteira.
- `MonthlyDashboardClient` deixa de renderizar JSX em ordem fixa: passa a construir o mapa de nós e delegar a ordem ao renderer. Controles que não são widgets (`ComparisonToggle`, `DrillDownDrawer`, `BudgetFormDialog`) continuam fora do sistema de widgets. No dashboard anual e no resumo, o cabeçalho de identidade da página (título/seletor de ano; total + "Ver Dashboard") permanece fixo e **não** reordenável.

### 2.4 Tela de configuração (UX-05)

- Nova rota `src/app/(app)/[accountId]/settings/dashboards/page.tsx` e entrada em `editorLinks` (`settings/layout.tsx`).
- Três grupos (um por contexto), cada um com uma lista reordenável via **drag-and-drop** (`@dnd-kit`) e um toggle de visibilidade por item. Salva via Server Action com o padrão `defineAction`.

---

## 3. User Stories

- Como usuário, quero **reordenar** os blocos do dashboard mensal arrastando-os, para ver primeiro o que importa para mim.
- Como usuário, quero **ocultar** blocos que não uso (ex.: Sankey, metas), para deixar a tela mais enxuta.
- Como usuário, quero configurar **cada uma das três áreas** (dashboard mensal, dashboard anual e resumo do mês) de forma independente, pois cada uma tem propósitos diferentes.
- Como membro de uma Account, quero que o arranjo configurado **valha para a Account**, para que todos vejamos a mesma organização acordada.
- Como desenvolvedor, quero adicionar um widget novo **só registrando-o no registry**, sem migração de banco nem editar a ordem manualmente, para evoluir os dashboards com baixo atrito.
- Como viewer, quero **ver** os dashboards no arranjo configurado, sem poder alterá-lo, respeitando meu papel de leitura.

---

## 4. Critérios de Aceitação

### FEAT-01 / FEAT-02 / FEAT-03 — Renderização por layout

- QUANDO uma Account **não tem** linha em `DashboardLayout` para um contexto, A ÁREA DEVE renderizar exatamente os widgets na ordem e visibilidade default do registry (visual idêntico ao atual).
- QUANDO o layout salvo define a ordem `[A, B, C]` e todos visíveis, A ÁREA DEVE renderizar A, B e C nessa ordem.
- QUANDO um widget está marcado `visible: false`, A ÁREA NÃO DEVE renderizá-lo (nem seu `<Paper>`/título).
- QUANDO o layout salvo referencia um `widgetId` que não existe mais no registry, O RENDERER DEVE ignorá-lo silenciosamente sem quebrar a página.
- QUANDO o registry tem um widget ausente no layout salvo, A ÁREA DEVE renderizá-lo ao final usando seu `defaultVisible`.
- ENQUANTO widgets `kind: "kpi"` consecutivos estiverem visíveis, O RENDERER DEVE agrupá-los numa faixa de grid responsiva (não um por linha).
- ENQUANTO dois widgets `panel` com `span: "half"` forem consecutivos e visíveis, O RENDERER DEVE renderizá-los lado a lado em 2 colunas (`md`+); em `xs` DEVE empilhar.
- QUANDO um widget visível não tem dados, ELE DEVE manter o comportamento atual de guard (ex.: Sankey sem `nodes` não renderiza; "Pendentes" só com `count > 0`) — o layout não anula o guard.

### FEAT-04 — Persistência

- QUANDO um editor salva um layout, O SISTEMA DEVE fazer upsert em `DashboardLayout` por `(accountId, context)` e persistir o array `widgets` validado por Zod.
- O `widgets` Json DEVE conter apenas `widgetId`s conhecidos do registry daquele contexto no momento do save; entradas inválidas DEVEM ser rejeitadas pelo schema.
- A query de leitura DEVE filtrar por `accountId` (multi-tenancy) e retornar a lista **reconciliada** (ordem salva + novos anexados).

### UX-05 — Tela de configuração

- QUANDO o usuário acessa `Configurações → Visualização`, A TELA DEVE listar os três contextos (mensal, anual, resumo) cada um com seus widgets.
- QUANDO o usuário arrasta um item para nova posição, A LISTA DEVE refletir a nova ordem imediatamente (otimista) e habilitar o salvamento.
- QUANDO o usuário alterna o toggle de visibilidade de um widget, O ITEM DEVE marcar/desmarcar sua exibição sem removê-lo da lista (continua reordenável).
- QUANDO o usuário salva, A AÇÃO DEVE persistir e revalidar as rotas afetadas; em sucesso DEVE exibir feedback (snackbar) e em erro DEVE manter o estado editável.
- SE o membro for `viewer`, A ROTA DEVE redirecioná-lo (mesmo comportamento das demais telas de settings em `settings/layout.tsx:30`).
- O drag-and-drop DEVE ser operável por teclado (ativação e movimentação via `KeyboardSensor` do `@dnd-kit`).

---

## 5. Fora de Escopo

- **Layout por usuário** ou **override por usuário sobre default da Account** — decidido como **por Account**. Personalização individual fica para spec futura.
- **Redimensionamento livre de widgets** (resize por drag, grid arbitrário tipo masonry). O único controle de tamanho é o `span` default por widget no registry (`half`/`full`); não é editável pelo usuário nesta spec.
- **Criar/duplicar widgets novos pela UI** — o catálogo de widgets é definido em código (registry). A UI só ordena/oculta.
- **Mover um widget entre contextos** (ex.: levar um KPI do anual para o mensal). Cada contexto tem seu próprio catálogo.
- **Configurar conteúdo interno de um widget** (ex.: quais KPIs aparecem dentro do bloco de metas, paleta de gráfico). Só visibilidade/ordem do bloco como um todo.
- **Sandbox** (`/sandbox`) e ordenação de **análises fixadas** (`SavedAnalysis.pinnedOrder`) — permanecem como estão; a análise fixada continua sendo **um** widget (`pinned-analyses`) no registry.
- **Configuração da home / navegação global** — apenas as três áreas analíticas listadas.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Escopo do layout | Por Account (`@@unique([accountId, context])`) | Decisão do desenvolvedor; membros compartilham a mesma organização acordada. |
| Reordenação | Drag-and-drop via `@dnd-kit` | Decisão do desenvolvedor. `@dnd-kit` é **headless** (sem CSS próprio) — não conflita com a regra "só MUI" para estilo; o visual dos itens é 100% MUI. |
| Catálogo de widgets | Registry em código, não em banco | Evita migração a cada widget novo; reconciliação anexa novos widgets automaticamente. Banco guarda só a preferência (ordem/visibilidade). |
| Armazenamento do arranjo | `Json` (array `{ widgetId, visible }`) | Esquema flexível; ordem implícita pela posição no array; validado por Zod na borda. |
| Preservar visual atual | Agrupamento `kpi` em faixa + pareamento de `half` | Mantém o layout existente quando os widgets estão na ordem default — refator sem regressão visual. |
| Tamanho do widget | `span` fixo no registry (`half`/`full`), não editável | Mantém UI minimalista; resize livre adicionaria complexidade desproporcional. |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar / criar |
|---|---|
| FEAT-04 | `prisma/schema.prisma` (model `DashboardLayout` + enum `DashboardLayoutContext`), nova migration |
| FEAT-04 | `src/lib/schemas/dashboard-layout.ts` (Zod: `updateDashboardLayoutSchema`) |
| FEAT-04 | `src/server/services/dashboard-layout-service.ts` (get reconciliado + upsert) + `.test.ts` (multi-tenancy) |
| FEAT-04 | `src/actions/dashboard-layout.ts` (`updateDashboardLayoutAction` via `defineAction`) |
| FEAT-01/02/03 | `src/components/dashboards/widget-registry.ts` (catálogo por contexto) |
| FEAT-01/02/03 | `src/components/dashboards/DashboardWidgetRenderer.tsx` (arranjo kpi/panel + span) |
| FEAT-01 | `src/components/dashboards/MonthlyDashboardClient.tsx` (refatorar para mapa de nós + renderer) |
| FEAT-02 | `src/app/(app)/[accountId]/dashboards/yearly/[year]/page.tsx` (ler layout, montar mapa, renderer) |
| FEAT-03 | `src/components/months/MonthSummary.tsx` (refatorar para mapa de nós + renderer) |
| UX-05 | `src/app/(app)/[accountId]/settings/dashboards/page.tsx` (nova rota) |
| UX-05 | `src/components/settings/DashboardLayoutEditor.tsx` (`@dnd-kit` sortable + toggles) |
| UX-05 | `src/app/(app)/[accountId]/settings/layout.tsx` (entrada em `editorLinks`) |
| Mensagens | `src/lib/messages/pt-BR.ts` (labels de widgets + textos da tela `settings.dashboards`) |
| Deps | `package.json`: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |

### 7.1 Catálogo de widgets (registry)

> `defaultVisible: true` em todos, salvo indicação. `span` só se aplica a `kind: "panel"`. A ordem da tabela é a ordem default — espelha o JSX atual para não regredir o visual.

**Contexto `monthly`** (espelha `MonthlyDashboardClient.tsx:190–419`):

| widgetId | kind | span | Componente atual |
|---|---|---|---|
| `kpi-month-total` | kpi | — | `KpiSparklineCard` (Total do Mês) |
| `kpi-income` | kpi | — | `KpiSparklineCard` (Receitas) |
| `kpi-expenses` | kpi | — | `KpiSparklineCard` (Despesas) |
| `kpi-savings-rate` | kpi | — | `KpiSparklineCard` (Taxa de Poupança) |
| `kpi-top-category` | kpi | — | `KpiSparklineCard` (guard: `topCategory`) |
| `kpi-pending` | kpi | — | `KpiSparklineCard` (guard: `pendingCount > 0`) |
| `budgets` | panel | full | bloco de metas (`BudgetProgressBar`) |
| `daily-heatmap` | panel | half | `DailyHeatmap` (guard: `subtractSections > 0`) |
| `category-treemap` | panel | half | `CategoryTreemap` |
| `money-flow` | panel | full | `SankeyChart` (guard: `nodes > 0`) |
| `section-breakdown` | panel | half | `SectionPieChart` |
| `category-breakdown` | panel | half | `CategoryPieChart` |
| `pinned-analyses` | panel | full | `PinnedAnalysesSection` |
| `top-transactions` | panel | full | `TopTransactionTable` |

**Contexto `yearly`** (espelha `yearly/[year]/page.tsx:136–239`):

| widgetId | kind | span | Componente atual |
|---|---|---|---|
| `kpi-year-total` | kpi | — | `KpiSparklineCard` |
| `kpi-income` | kpi | — | `KpiSparklineCard` |
| `kpi-expenses` | kpi | — | `KpiSparklineCard` |
| `kpi-savings-rate` | kpi | — | `KpiSparklineCard` |
| `kpi-monthly-avg` | kpi | — | `KpiSparklineCard` |
| `kpi-best-month` | kpi | — | `KpiSparklineCard` |
| `kpi-worst-month` | kpi | — | `KpiSparklineCard` |
| `kpi-pending` | kpi | — | `KpiSparklineCard` (guard: `> 0`) |
| `month-card-grid` | panel | full | `MonthCardGrid` |
| `monthly-bar-chart` | panel | full | `MonthlyBarChart` |
| `pinned-analyses` | panel | full | `PinnedAnalysesSection` |
| `top-categories` | panel | full | `CategoryBarList` |

**Contexto `month_summary`** (espelha `MonthSummary.tsx:144–315`; o cabeçalho de total + "Ver Dashboard" é fixo, não-widget):

| widgetId | kind | span | Componente atual |
|---|---|---|---|
| `kpi-income` | kpi | — | `KpiSparklineCard` (Receitas) |
| `kpi-expenses` | kpi | — | `KpiSparklineCard` (Despesas) |
| `kpi-balance` | kpi | — | `KpiSparklineCard` (Saldo) |
| `budgets` | panel | full | bloco de metas (guard) |
| `section-cards` | panel | full | cards de seção |
| `activity-lists` | panel | full | Pendentes/Favoritas/Recentes |

```ts
// src/components/dashboards/widget-registry.ts
export type WidgetKind = "kpi" | "panel";
export type WidgetSpan = "half" | "full";
export type DashboardContext = "monthly" | "yearly" | "month_summary";

export type WidgetDef = {
  id: string;
  labelKey: string;       // chave em m.dashboards.widgets.*
  kind: WidgetKind;
  span?: WidgetSpan;      // só para kind === "panel"
  defaultVisible: boolean;
};

export const WIDGET_REGISTRY: Record<DashboardContext, WidgetDef[]> = {
  monthly: [
    { id: "kpi-month-total", labelKey: "monthTotal", kind: "kpi", defaultVisible: true },
    /* ...demais conforme tabela acima, na ordem default... */
    { id: "money-flow", labelKey: "moneyFlow", kind: "panel", span: "full", defaultVisible: true },
  ],
  yearly: [/* ... */],
  month_summary: [/* ... */],
};

export type StoredWidget = { widgetId: string; visible: boolean };

// Reconcilia layout salvo com o registry: mantém ordem salva (descarta ids
// desconhecidos) e anexa widgets novos ao final com seu defaultVisible.
export function resolveLayout(
  context: DashboardContext,
  stored: StoredWidget[] | null,
): Array<WidgetDef & { visible: boolean }> {
  const registry = WIDGET_REGISTRY[context];
  const byId = new Map(registry.map((w) => [w.id, w]));
  const seen = new Set<string>();
  const out: Array<WidgetDef & { visible: boolean }> = [];

  for (const s of stored ?? []) {
    const def = byId.get(s.widgetId);
    if (!def || seen.has(def.id)) continue; // ✅ descarta desconhecido/duplicado
    seen.add(def.id);
    out.push({ ...def, visible: s.visible });
  }
  for (const def of registry) {
    if (seen.has(def.id)) continue;
    out.push({ ...def, visible: def.defaultVisible }); // ✅ anexa novos ao final
  }
  return out;
}
```

### 7.2 Prisma

```prisma
enum DashboardLayoutContext {
  monthly
  yearly
  month_summary

  @@map("dashboard_layout_context")
}

model DashboardLayout {
  id        String                 @id @default(cuid())
  accountId String                 @map("account_id")
  context   DashboardLayoutContext
  widgets   Json                   // [{ widgetId: string, visible: boolean }]
  createdAt  DateTime              @default(now()) @map("created_at")
  updatedAt  DateTime              @updatedAt      @map("updated_at")

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, context])
  @@index([accountId])
  @@map("dashboard_layouts")
}
```

> Lembrar de adicionar `dashboardLayouts DashboardLayout[]` ao `model Account` (junto das demais relations em `schema.prisma:152–157`).

### 7.3 Zod schema

```ts
// src/lib/schemas/dashboard-layout.ts
import { z } from "zod";

export const dashboardContextSchema = z.enum(["monthly", "yearly", "month_summary"]);

export const updateDashboardLayoutSchema = z.object({
  context: dashboardContextSchema,
  widgets: z
    .array(
      z.object({
        widgetId: z.string().min(1),
        visible: z.boolean(),
      }),
    )
    .min(1),
});

export type UpdateDashboardLayoutInput = z.infer<typeof updateDashboardLayoutSchema>;
```

> O service DEVE validar que cada `widgetId` pertence ao registry do `context` (não dá para fazê-lo só no Zod sem acoplar o registry ao schema). Ids fora do registry são descartados/rejeitados antes do upsert.

### 7.4 Action (segue `account-settings.ts:32–40`)

```ts
// src/actions/dashboard-layout.ts
"use server";
import { revalidatePath } from "next/cache";
import { defineAction } from "@/server/api/define-action";
import { updateDashboardLayoutSchema } from "@/lib/schemas/dashboard-layout";
import * as dashboardLayoutService from "@/server/services/dashboard-layout-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const updateDashboardLayoutAction = defineAction({
  schema: updateDashboardLayoutSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await dashboardLayoutService.upsertLayout(input, ctx);
    revalidatePath(`/${ctx.accountId}/settings/dashboards`);
    // revalida as áreas afetadas pelo contexto editado
    revalidatePath(`/${ctx.accountId}/dashboards`, "layout");
    revalidatePath(`/${ctx.accountId}/months`, "layout");
  },
});
```

### 7.5 Renderer (arranjo preservando o visual atual)

```tsx
// src/components/dashboards/DashboardWidgetRenderer.tsx
// Recebe os widgets já resolvidos (ordenados, só visíveis) e o mapa de nós.
// Agrupa kpi consecutivos numa faixa; pareia panels "half" consecutivos.
type RenderItem = { id: string; kind: WidgetKind; span?: WidgetSpan; node: ReactNode };

export function DashboardWidgetRenderer({ items }: { items: RenderItem[] }) {
  const rows: ReactNode[] = [];
  let i = 0;
  while (i < items.length) {
    const it = items[i];
    if (it.kind === "kpi") {
      const group = [];
      while (i < items.length && items[i].kind === "kpi") group.push(items[i++]);
      rows.push(
        <Box key={`kpi-${i}`} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3,1fr)", md: "repeat(6,1fr)" }, gap: 1.5, mb: 3 }}>
          {group.map((g) => <Fragment key={g.id}>{g.node}</Fragment>)}
        </Box>,
      );
      continue;
    }
    if (it.span === "half" && items[i + 1]?.kind === "panel" && items[i + 1]?.span === "half") {
      rows.push(
        <Box key={it.id} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3, mb: 3 }}>
          {it.node}{items[i + 1].node}
        </Box>,
      );
      i += 2;
      continue;
    }
    rows.push(<Box key={it.id} sx={{ mb: 3 }}>{it.node}</Box>); // full ou half isolado
    i += 1;
  }
  return <>{rows}</>;
}
```

```tsx
// ❌ Anti-padrão — manter a ordem hardcoded em JSX (estado atual)
<Box>
  <KpiRow /> <Budgets /> <Heatmap /> <Treemap /> <Sankey /> ...
</Box>

// ✅ Correto — a ordem vem do layout resolvido; a página só fornece os nós
const items = resolved.filter((w) => w.visible).map((w) => ({ ...w, node: NODES[w.id] }));
<DashboardWidgetRenderer items={items} />
```

### 7.6 Editor drag-and-drop (settings) — `@dnd-kit`

```tsx
// src/components/settings/DashboardLayoutEditor.tsx (trecho)
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// item: ListItem MUI com drag handle (ícone DragIndicator) + Switch de visibilidade.
// Sensores incluem KeyboardSensor → drag operável por teclado (critério de A11y).
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);
// onDragEnd → setItems((prev) => arrayMove(prev, oldIndex, newIndex)); marca "dirty" → habilita Salvar.
```

> Estilo dos itens é **100% MUI** (`ListItem`, `Switch`, `IconButton`, tokens `border.subtle`/`background.subtle`). `@dnd-kit` fornece só o comportamento — sem CSS próprio, sem violar "só MUI".

---

## 8. Notas de implementação

- **Multi-tenancy**: `dashboard-layout-service` deve receber `accountId` do `ctx` (nunca do input) e filtrar/escopar o upsert por `(accountId, context)`. Teste obrigatório de isolamento entre Accounts (CLAUDE.md §5.12).
- **RSC**: as páginas anual e mensal e a página do mês já são RSC — carregar o layout resolvido em paralelo com os dados (`Promise.all`) como em `yearly/[year]/page.tsx:47–52`.
- **Revalidação**: após salvar, revalidar `dashboards` e `months` em modo `layout` para refletir em todas as rotas filhas.
- **Mensagens**: todos os labels de widget e textos da tela ficam em `src/lib/messages/pt-BR.ts` sob `dashboards.widgets.*` e `settings.dashboards.*` (CLAUDE.md §5.10). Adicionar `{ href: "dashboards", label: m.settings.nav.dashboards }` em `editorLinks`.
- **Dark mode**: validar o editor e as três áreas em light **e** dark (CLAUDE.md §7).
```
