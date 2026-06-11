# Spec 33 — Widgets Configuráveis de Dashboard e Resumo

> Status: approved
> Insumo: revisão de código em `src/components/dashboards/MonthlyDashboardClient.tsx`, `src/components/months/MonthSummary.tsx`, `src/app/(app)/[accountId]/dashboards/yearly/[year]/page.tsx`; ideia do desenvolvedor (widgets configuráveis estilo Android).
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`dashboards-charts`](../skills/dashboards-charts/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md)

---

## 1. Problema

A composição visual das áreas analíticas é **fixa e hardcoded**. Não há como o usuário escolher quais blocos (gráficos, indicadores, listas) quer ver, nem em que ordem. Isso torna as telas longas, com blocos irrelevantes para alguns perfis (ex.: quem não usa Sankey ou metas), sem nenhuma forma de enxugar ou priorizar.

- **FEAT-01**: Em `src/components/dashboards/MonthlyDashboardClient.tsx:190–419`, todos os blocos do dashboard mensal (6 KPIs, metas, heatmap, treemap, Sankey, pizzas, análises fixadas, maiores transações) são renderizados em **ordem fixa em JSX**. Não há prop de layout nem leitura de preferência — a ordem e a visibilidade são imutáveis.
- **FEAT-02**: Em `src/app/(app)/[accountId]/dashboards/yearly/[year]/page.tsx:94–240`, o dashboard anual (KPIs, `MonthCardGrid`, `MonthlyBarChart`, `PinnedAnalysesSection`, `CategoryBarList`) também é montado em ordem fixa direto na página RSC.
- **FEAT-03**: Em `src/components/months/MonthSummary.tsx:112–322`, o "Resumo do mês" (total, 3 KPIs, metas, cards de seção, listas de atividade) é montado em ordem fixa, sem configuração.
- **FEAT-04**: Não existe modelo de persistência para arranjo de blocos. Em `prisma/schema.prisma` há apenas `SavedAnalysis.pinnedOrder` (linha 412–430), que ordena **análises salvas** dentro de um único bloco — não serve para ordenar/remover os blocos das três áreas.
- **UX-05**: Em `src/app/(app)/[accountId]/settings/layout.tsx:14–24`, a navegação de Configurações não tem entrada para gerenciar a visualização dos dashboards. Não há lugar na UI onde o usuário organize essas áreas.

---

## 2. Solução

Introduzir o conceito de **widget**: cada bloco analítico vira um widget identificado por `widgetId`, com `kind` (`kpi` compacto ou `panel`) e um `span` padrão. Um **registry em código** é a fonte da verdade dos widgets disponíveis por contexto; um **layout persistido por Account** (lista ordenada dos widgets ativos) é a preferência aplicada na renderização.

A experiência de configuração segue o modelo **Android home screen**: o usuário gerencia quais widgets estão ativos (arrastar para reordenar, ✕ para remover) e quais estão disponíveis para adicionar (clicar no card para ativar). Auto-save após cada ação — sem botão "Salvar".

Escopo das três áreas (contextos): `monthly` (dashboard mensal), `yearly` (dashboard anual), `month_summary` (aba Resumo do mês).

### 2.1 Modelo de dados (FEAT-04)

- Nova tabela `DashboardLayout` com `@@unique([accountId, context])`. `context` é um enum (`monthly` | `yearly` | `month_summary`). O arranjo é salvo em `widgets Json` como **array ordenado de `widgetId` strings** — apenas os widgets ativos, na ordem de exibição. Não há campo `visible`; presença no array = ativo.
- Layout é **por Account** (compartilhado entre membros). Editar exige papel `owner`/`editor`; `viewer` apenas vê o resultado.
- **Ausência de linha = padrões do registry.** Contas existentes mantêm exatamente o visual atual via `defaultVisible` definido no registry.

### 2.2 Registry e reconciliação (FEAT-01, FEAT-02, FEAT-03)

- `widget-registry` define, por contexto, a lista canônica de widgets: `id`, `labelKey` (via `m.*`), `kind`, `span`, `defaultVisible`.
- `defaultVisible` determina o estado inicial de um widget: `true` = entra na lista ativa por padrão; `false` = fica em "Disponíveis" por padrão.
- A leitura do layout **reconcilia** o array persistido com o registry:
  - Mantém a ordem salva, descartando `widgetId`s desconhecidos.
  - Widgets do registry **ausentes** no array salvo com `defaultVisible: true` são **anexados ao final** da lista ativa (compat-forward para novos widgets).
  - Widgets com `defaultVisible: false` ausentes no array permanecem em "Disponíveis".
- `resolveLayout` retorna `{ active: WidgetDef[], available: WidgetDef[] }`.
- Guards de dados existentes são **preservados**: um widget ativo sem dados se comporta como hoje (ex.: Sankey sem entradas não renderiza; KPI "Pendentes" só se `> 0`). O layout controla **inclusão e ordem**, não substitui os guards.

### 2.3 Renderização (FEAT-01, FEAT-02, FEAT-03)

- Novo `DashboardWidgetRenderer` recebe a lista ativa (ordenada) e um mapa `widgetId → { node, kind, span }` produzido pela página/cliente. Regras de arranjo que **preservam o visual atual** quando os widgets estão na ordem default:
  - widgets `kind: "kpi"` **consecutivos** colapsam em uma faixa de grid responsiva (como a linha de 6 KPIs hoje);
  - widgets `kind: "panel"` com `span: "half"` **consecutivos** pareiam em linha de 2 colunas (como heatmap+treemap e as duas pizzas hoje); um `half` isolado ocupa a largura total;
  - widgets `panel` com `span: "full"` ocupam a linha inteira.
- `MonthlyDashboardClient` deixa de renderizar JSX em ordem fixa: passa a construir o mapa de nós e delegar a ordem ao renderer. Controles que não são widgets (`ComparisonToggle`, `DrillDownDrawer`, `BudgetFormDialog`) continuam fora do sistema de widgets. No dashboard anual e no resumo, o cabeçalho de identidade da página (título/seletor de ano; total + "Ver Dashboard") permanece fixo e **não** reordenável.

### 2.4 Tela de configuração (UX-05)

- A navegação lateral de Configurações (`settings/layout.tsx`) ganha um item **colapsável** "Visualização", que ao clicar expande revelando três sub-itens: "Dashboard Mensal", "Dashboard Anual" e "Resumo do Mês". Clicar no item pai apenas expande/recolhe — não navega automaticamente. Este padrão de sub-nav colapsável vira **componente reutilizável** (`CollapsibleNavItem.tsx`) para futuras implementações.
- Três páginas dedicadas, uma por contexto:
  - `src/app/(app)/[accountId]/settings/dashboards/monthly/page.tsx`
  - `src/app/(app)/[accountId]/settings/dashboards/yearly/page.tsx`
  - `src/app/(app)/[accountId]/settings/dashboards/month-summary/page.tsx`
  - `src/app/(app)/[accountId]/settings/dashboards/page.tsx` → redireciona para `monthly`
- Cada página exibe **duas seções simultâneas**:
  1. **Ativos** — cards draggáveis (`@dnd-kit`) com drag handle e botão ✕ para remover.
  2. **Disponíveis** — cards estáticos; clicar no card o move para o final dos Ativos.
- **Auto-save**: cada ação (reordenar, remover, adicionar) dispara o server action imediatamente. Reorders usam debounce de 600 ms; add/delete são imediatos. Snackbar discreto "Layout atualizado" no sucesso; revert otimista + snackbar de erro no falha.
- `WidgetCard.tsx` é o card compartilhado entre as três páginas (ativo e disponível diferem apenas em props).
- Viewers são redirecionados pelo `settings/layout.tsx` existente — sem mudança nessa lógica.

---

## 3. User Stories

- Como usuário, quero **reordenar** os blocos do dashboard mensal arrastando-os, para ver primeiro o que importa para mim.
- Como usuário, quero **remover** blocos que não uso (ex.: Sankey, metas) da lista ativa, para deixar a tela mais enxuta.
- Como usuário, quero **adicionar de volta** um bloco removido a qualquer momento, clicando nele na seção "Disponíveis".
- Como usuário, quero que as mudanças sejam **salvas automaticamente** sem precisar clicar em "Salvar", para ter uma experiência fluida.
- Como usuário, quero configurar **cada uma das três áreas** (dashboard mensal, dashboard anual e resumo do mês) de forma independente, pois cada uma tem propósitos diferentes.
- Como membro de uma Account, quero que o arranjo configurado **valha para a Account**, para que todos vejamos a mesma organização acordada.
- Como desenvolvedor, quero adicionar um widget novo **só registrando-o no registry**, sem migração de banco nem editar a ordem manualmente, para evoluir os dashboards com baixo atrito.
- Como viewer, quero **ver** os dashboards no arranjo configurado, sem poder alterá-lo, respeitando meu papel de leitura.

---

## 4. Critérios de Aceitação

### FEAT-01 / FEAT-02 / FEAT-03 — Renderização por layout

- QUANDO uma Account **não tem** linha em `DashboardLayout` para um contexto, A ÁREA DEVE renderizar exatamente os widgets com `defaultVisible: true` na ordem do registry (visual idêntico ao atual).
- QUANDO o layout salvo define a ordem `[A, B, C]`, A ÁREA DEVE renderizar A, B e C nessa ordem.
- QUANDO um `widgetId` não existe mais no registry, O RENDERER DEVE ignorá-lo silenciosamente sem quebrar a página.
- QUANDO o registry tem um widget com `defaultVisible: true` ausente no layout salvo, A ÁREA DEVE renderizá-lo ao final da lista ativa.
- ENQUANTO widgets `kind: "kpi"` consecutivos estiverem ativos, O RENDERER DEVE agrupá-los numa faixa de grid responsiva (não um por linha).
- ENQUANTO dois widgets `panel` com `span: "half"` forem consecutivos e ativos, O RENDERER DEVE renderizá-los lado a lado em 2 colunas (`md`+); em `xs` DEVE empilhar.
- QUANDO um widget ativo não tem dados, ELE DEVE manter o comportamento atual de guard (ex.: Sankey sem `nodes` não renderiza; "Pendentes" só com `count > 0`) — o layout não anula o guard.

### FEAT-04 — Persistência

- QUANDO uma ação de layout é disparada, O SISTEMA DEVE fazer upsert em `DashboardLayout` por `(accountId, context)` e persistir o array `widgets` validado por Zod.
- O `widgets` Json DEVE conter apenas `widgetId`s strings conhecidos do registry daquele contexto no momento do save; entradas inválidas DEVEM ser descartadas pelo service antes do upsert.
- A query de leitura DEVE filtrar por `accountId` (multi-tenancy) e retornar a lista **reconciliada** (`active` + `available`).

### UX-05 — Tela de configuração

- QUANDO o usuário acessa `Configurações → Visualização`, O NAV DEVE expandir os três sub-itens sem navegar automaticamente.
- QUANDO o usuário acessa qualquer sub-item (ex.: "Dashboard Mensal"), A PÁGINA DEVE exibir as seções "Ativos" e "Disponíveis" simultaneamente.
- QUANDO o usuário arrasta um card ativo para nova posição, A LISTA DEVE refletir a nova ordem imediatamente (otimista) e auto-salvar com debounce de 600 ms.
- QUANDO o usuário clica em ✕ em um card ativo, O CARD DEVE mover-se imediatamente para "Disponíveis" e auto-salvar.
- QUANDO o usuário clica em um card disponível, O CARD DEVE mover-se imediatamente para o final de "Ativos" e auto-salvar.
- QUANDO o auto-save falha, O SISTEMA DEVE reverter o estado otimista para o estado anterior e exibir snackbar de erro.
- QUANDO o auto-save tem sucesso, O SISTEMA DEVE exibir snackbar discreto "Layout atualizado" e revalidar as rotas afetadas.
- SE o membro for `viewer`, A ROTA DEVE redirecioná-lo (comportamento do `settings/layout.tsx` existente).
- QUANDO a seção "Disponíveis" está vazia (todos os widgets estão ativos), A SEÇÃO DEVE exibir `<EmptyState>` adequado.
- O drag-and-drop DEVE ser operável por teclado (`KeyboardSensor` do `@dnd-kit`).

---

## 5. Fora de Escopo

- **Layout por usuário** ou **override por usuário sobre default da Account** — decidido como **por Account**. Personalização individual fica para spec futura.
- **Redimensionamento livre de widgets** (resize por drag, grid arbitrário tipo masonry). O único controle de tamanho é o `span` default por widget no registry (`half`/`full`); não é editável pelo usuário nesta spec.
- **Criar/duplicar widgets novos pela UI** — o catálogo de widgets é definido em código (registry). A UI só ordena/remove/adiciona do catálogo.
- **Mover um widget entre contextos** (ex.: levar um KPI do anual para o mensal). Cada contexto tem seu próprio catálogo.
- **Configurar conteúdo interno de um widget** (ex.: quais KPIs aparecem dentro do bloco de metas, paleta de gráfico, filtros internos) — **Spec 36** (fase 2 do sistema de widgets).
- **Sandbox** (`/sandbox`) e ordenação de **análises fixadas** (`SavedAnalysis.pinnedOrder`) — permanecem como estão; a análise fixada continua sendo **um** widget (`pinned-analyses`) no registry.
- **Configuração da home / navegação global** — apenas as três áreas analíticas listadas.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Escopo do layout | Por Account (`@@unique([accountId, context])`) | Membros compartilham a mesma organização acordada. |
| Modelo de interação | Android home screen (add/remove/reorder) | Mais intuitivo que toggle on/off; elimina estado "oculto mas na lista". |
| Dado persistido | `string[]` de IDs ativos (sem `visible`) | Presença no array = ativo. Mais simples; `visible: boolean` era redundante com a presença/ausência. |
| Auto-save | Sim — sem botão "Salvar" | Layout não é operação crítica irreversível. Padrão moderno (Notion, Linear). Elimina toda a fricção de estado sujo. |
| Debounce em reorders | 600 ms | Evita N saves em drag contínuo; imperceptível para o usuário. Add/delete imediatos para feedback instantâneo. |
| Tela de configuração | 3 páginas explícitas por contexto | Fetch de dados independente por RSC; sem condicional "qual contexto" no componente. |
| Seções simultâneas | "Ativos" + "Disponíveis" na mesma página | Sem bottom sheet; tudo visível de uma vez. Alinhado com "warm calm" minimalista. |
| Adicionar widget | Clicar no card em "Disponíveis" | Click é igualmente intuitivo e evita cross-container DnD (complexidade desnecessária). |
| Nav lateral de settings | Item colapsável com sub-itens (`CollapsibleNavItem.tsx`) | Padrão reutilizável para futuras sub-navegações em settings. |
| Cards no editor | `WidgetCard.tsx` compartilhado | Reutilizado nas 3 páginas de contexto; diferença entre ativo/disponível via props. |
| Catálogo de widgets | Registry em código | Evita migração a cada widget novo; reconciliação garante compat-forward. |
| `span` do widget | Fixo no registry (`half`/`full`), não editável | Mantém UI minimalista; resize livre → Spec futura. |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar / criar |
|---|---|
| FEAT-04 | `prisma/schema.prisma` (model `DashboardLayout` + enum `DashboardLayoutContext`), nova migration |
| FEAT-04 | `src/lib/schemas/dashboard-layout.ts` (Zod: `updateDashboardLayoutSchema`) |
| FEAT-04 | `src/server/services/dashboard-layout-service.ts` (get reconciliado + upsert) + `.test.ts` (multi-tenancy) |
| FEAT-04 | `src/actions/dashboard-layout.ts` (`updateDashboardLayoutAction` via `defineAction`) |
| FEAT-01/02/03 | `src/components/dashboards/widget-registry.ts` (catálogo por contexto + `resolveLayout`) |
| FEAT-01/02/03 | `src/components/dashboards/DashboardWidgetRenderer.tsx` (arranjo kpi/panel + span) |
| FEAT-01 | `src/components/dashboards/MonthlyDashboardClient.tsx` (refatorar para mapa de nós + renderer) |
| FEAT-02 | `src/app/(app)/[accountId]/dashboards/yearly/[year]/page.tsx` (ler layout, montar mapa, renderer) |
| FEAT-03 | `src/components/months/MonthSummary.tsx` (refatorar para mapa de nós + renderer) |
| UX-05 | `src/app/(app)/[accountId]/settings/dashboards/page.tsx` (redirect para `monthly`) |
| UX-05 | `src/app/(app)/[accountId]/settings/dashboards/monthly/page.tsx` |
| UX-05 | `src/app/(app)/[accountId]/settings/dashboards/yearly/page.tsx` |
| UX-05 | `src/app/(app)/[accountId]/settings/dashboards/month-summary/page.tsx` |
| UX-05 | `src/components/settings/DashboardLayoutEditor.tsx` (orquestra WidgetCard + DnD + auto-save) |
| UX-05 | `src/components/settings/WidgetCard.tsx` (card compartilhado ativo/disponível) |
| UX-05 | `src/components/settings/CollapsibleNavItem.tsx` (item de nav com sub-itens colapsáveis) |
| UX-05 | `src/app/(app)/[accountId]/settings/layout.tsx` (entrada colapsável "Visualização" com 3 sub-itens) |
| Mensagens | `src/lib/messages/pt-BR.ts` (labels de widgets + textos `settings.dashboards.*`) |
| Deps | `package.json`: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |

### 7.1 Catálogo de widgets (registry)

> `defaultVisible: true` em todos, salvo indicação. `span` só se aplica a `kind: "panel"`. A ordem da tabela é a ordem default — espelha o JSX atual para não regredir o visual.

**Contexto `monthly`** (espelha `MonthlyDashboardClient.tsx:190–419`):

| widgetId | kind | span | defaultVisible | Componente atual |
|---|---|---|---|---|
| `kpi-month-total` | kpi | — | true | `KpiSparklineCard` (Total do Mês) |
| `kpi-income` | kpi | — | true | `KpiSparklineCard` (Receitas) |
| `kpi-expenses` | kpi | — | true | `KpiSparklineCard` (Despesas) |
| `kpi-savings-rate` | kpi | — | true | `KpiSparklineCard` (Taxa de Poupança) |
| `kpi-top-category` | kpi | — | true | `KpiSparklineCard` (guard: `topCategory`) |
| `kpi-pending` | kpi | — | true | `KpiSparklineCard` (guard: `pendingCount > 0`) |
| `budgets` | panel | full | true | bloco de metas (`BudgetProgressBar`) |
| `daily-heatmap` | panel | half | true | `DailyHeatmap` (guard: `subtractSections > 0`) |
| `category-treemap` | panel | half | true | `CategoryTreemap` |
| `money-flow` | panel | full | true | `SankeyChart` (guard: `nodes > 0`) |
| `section-breakdown` | panel | half | true | `SectionPieChart` |
| `category-breakdown` | panel | half | true | `CategoryPieChart` |
| `pinned-analyses` | panel | full | true | `PinnedAnalysesSection` |
| `top-transactions` | panel | full | true | `TopTransactionTable` |

**Contexto `yearly`** (espelha `yearly/[year]/page.tsx:136–239`):

| widgetId | kind | span | defaultVisible | Componente atual |
|---|---|---|---|---|
| `kpi-year-total` | kpi | — | true | `KpiSparklineCard` |
| `kpi-income` | kpi | — | true | `KpiSparklineCard` |
| `kpi-expenses` | kpi | — | true | `KpiSparklineCard` |
| `kpi-savings-rate` | kpi | — | true | `KpiSparklineCard` |
| `kpi-monthly-avg` | kpi | — | true | `KpiSparklineCard` |
| `kpi-best-month` | kpi | — | true | `KpiSparklineCard` |
| `kpi-worst-month` | kpi | — | true | `KpiSparklineCard` |
| `kpi-pending` | kpi | — | true | `KpiSparklineCard` (guard: `> 0`) |
| `month-card-grid` | panel | full | true | `MonthCardGrid` |
| `monthly-bar-chart` | panel | full | true | `MonthlyBarChart` |
| `pinned-analyses` | panel | full | true | `PinnedAnalysesSection` |
| `top-categories` | panel | full | true | `CategoryBarList` |

**Contexto `month_summary`** (espelha `MonthSummary.tsx:144–315`; o cabeçalho de total + "Ver Dashboard" é fixo, não-widget):

| widgetId | kind | span | defaultVisible | Componente atual |
|---|---|---|---|---|
| `kpi-income` | kpi | — | true | `KpiSparklineCard` (Receitas) |
| `kpi-expenses` | kpi | — | true | `KpiSparklineCard` (Despesas) |
| `kpi-balance` | kpi | — | true | `KpiSparklineCard` (Saldo) |
| `budgets` | panel | full | true | bloco de metas (guard) |
| `section-cards` | panel | full | true | cards de seção |
| `activity-lists` | panel | full | true | Pendentes/Favoritas/Recentes |

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
  defaultVisible: boolean; // true = ativo por padrão; false = em "Disponíveis" por padrão
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

export type ResolvedLayout = {
  active: WidgetDef[];    // ordenados conforme layout salvo
  available: WidgetDef[]; // não estão na lista ativa (ordem do registry)
};

// Reconcilia layout salvo com o registry.
// stored: array de widgetIds ativos (null = sem layout salvo).
export function resolveLayout(
  context: DashboardContext,
  stored: string[] | null,
): ResolvedLayout {
  const registry = WIDGET_REGISTRY[context];
  const byId = new Map(registry.map((w) => [w.id, w]));
  const seen = new Set<string>();
  const active: WidgetDef[] = [];

  for (const id of stored ?? []) {
    const def = byId.get(id);
    if (!def || seen.has(def.id)) continue; // descarta desconhecido/duplicado
    seen.add(def.id);
    active.push(def);
  }

  // Anexa ao final widgets novos com defaultVisible: true (compat-forward)
  for (const def of registry) {
    if (seen.has(def.id)) continue;
    if (def.defaultVisible) active.push(def);
    seen.add(def.id);
  }

  // Disponíveis = widgets do registry não presentes nos ativos
  const activeIds = new Set(active.map((w) => w.id));
  const available = registry.filter((w) => !activeIds.has(w.id));

  return { active, available };
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
  widgets   Json                   // string[] — array ordenado de widgetIds ativos
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
  // array ordenado de widgetIds ativos; service valida que cada id pertence ao registry
  widgets: z.array(z.string().min(1)),
});

export type UpdateDashboardLayoutInput = z.infer<typeof updateDashboardLayoutSchema>;
```

> O service DEVE validar que cada `widgetId` pertence ao registry do `context` antes do upsert (filtrar/descartar ids inválidos — não retorna erro, pois o client nunca envia ids inválidos em operação normal).

### 7.4 Action (auto-save, segue `account-settings.ts:32–40`)

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
    revalidatePath(`/${ctx.accountId}/settings/dashboards`, "layout");
    // revalida as áreas afetadas pelo contexto editado
    revalidatePath(`/${ctx.accountId}/dashboards`, "layout");
    revalidatePath(`/${ctx.accountId}/months`, "layout");
  },
});
```

### 7.5 Renderer (arranjo preservando o visual atual)

```tsx
// src/components/dashboards/DashboardWidgetRenderer.tsx
// Recebe os widgets já ativos (ordenados) e o mapa de nós.
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
// ✅ Correto — a ordem vem do layout resolvido; a página só fornece os nós
const items = resolved.active.map((w) => ({ ...w, node: NODES[w.id] }));
<DashboardWidgetRenderer items={items} />
```

### 7.6 Editor Android-style — `DashboardLayoutEditor` + `WidgetCard`

```tsx
// src/components/settings/WidgetCard.tsx
// Card compartilhado entre seção "Ativos" e "Disponíveis".
// mode="active": mostra drag handle + label + botão ✕
// mode="available": mostra label clicável (sem drag handle)

type WidgetCardProps =
  | { mode: "active"; widget: WidgetDef; dragHandleProps?: object; onRemove: () => void }
  | { mode: "available"; widget: WidgetDef; onAdd: () => void };

export function WidgetCard(props: WidgetCardProps) {
  // Card MUI com borderColor: "border.subtle", radius lg, p: layout.card/2
  // Ativo: DragIndicatorIcon (text.tertiary) + Typography + IconButton ✕
  // Disponível: Card sx={{ cursor: "pointer", "&:hover": { borderColor: "border.default" } }}
}
```

```tsx
// src/components/settings/DashboardLayoutEditor.tsx
"use client";
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSnackbar } from "notistack";
import { useOptimistic, useTransition } from "react";
import { updateDashboardLayoutAction } from "@/actions/dashboard-layout";

type Props = {
  accountId: string;
  context: DashboardContext;
  initialActive: WidgetDef[];
  initialAvailable: WidgetDef[];
};

export function DashboardLayoutEditor({ accountId, context, initialActive, initialAvailable }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();

  // Estado otimista — reflete imediatamente na UI antes do server responder
  const [active, setActive] = useOptimistic(initialActive);
  const [available, setAvailable] = useOptimistic(initialAvailable);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function save(newActive: WidgetDef[]) {
    startTransition(async () => {
      const result = await updateDashboardLayoutAction(accountId, {
        context,
        widgets: newActive.map((w) => w.id),
      });
      if (result.ok) {
        enqueueSnackbar(m.settings.dashboards.saved, { variant: "success" });
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
        // revert otimista: redefinir para initialActive/initialAvailable
      }
    });
  }

  // onDragEnd → arrayMove + save (debounce 600ms para reorders)
  // onRemove → filtra active, adiciona ao available + save imediato
  // onAdd → adiciona ao final de active, remove de available + save imediato
}
```

### 7.7 Nav colapsável — `CollapsibleNavItem`

```tsx
// src/components/settings/CollapsibleNavItem.tsx
// Item de nav com sub-itens colapsáveis. Reutilizável para futuras
// sub-navegações em settings. Ao clicar expande/recolhe — não navega.

type CollapsibleNavItemProps = {
  label: string;
  icon?: ReactNode;
  children: ReactNode; // sub-itens (Links MUI ou NextLink)
  defaultOpen?: boolean; // abre automaticamente se sub-rota está ativa
};
```

> `defaultOpen` deve ser `true` quando a rota atual começa com o prefixo do item (ex.: `/settings/dashboards/*`). Usar `usePathname()` para detectar.

---

## 8. Notas de implementação

- **Multi-tenancy**: `dashboard-layout-service` deve receber `accountId` do `ctx` (nunca do input) e filtrar/escopar o upsert por `(accountId, context)`. Teste obrigatório de isolamento entre Accounts (CLAUDE.md §5.12).
- **RSC**: as páginas anual e mensal e a página do mês já são RSC — carregar o layout resolvido em paralelo com os dados (`Promise.all`). As três páginas de settings (`monthly`, `yearly`, `month-summary`) também são RSC que buscam o layout e passam `initialActive`/`initialAvailable` para `DashboardLayoutEditor`.
- **Auto-save debounce**: usar `useRef` para armazenar o timer do debounce de reorder. Add/delete não fazem debounce — chamam `save` diretamente.
- **Revalidação**: após salvar, revalidar `dashboards` e `months` em modo `layout` para refletir em todas as rotas filhas.
- **URL slug**: a página de `month_summary` usa o slug `month-summary` na URL (kebab-case); o valor do enum Prisma/código permanece `month_summary` (snake_case).
- **Redirect base**: `settings/dashboards/page.tsx` usa `redirect("./monthly")` para sempre aterrissar no primeiro contexto.
- **Mensagens**: todos os labels de widget e textos da tela ficam em `src/lib/messages/pt-BR.ts` sob `dashboards.widgets.*` e `settings.dashboards.*` (CLAUDE.md §5.10). Adicionar entrada colapsável "Visualização" com sub-labels em `settings.nav.visualization`.
- **Dark mode**: validar o editor e as três áreas em light **e** dark (CLAUDE.md §7).
- **Spec 36**: configuração interna de widgets (fase 2) — schema de configuração por `widgetId`, UI de edição dentro do `WidgetCard` ativo.
