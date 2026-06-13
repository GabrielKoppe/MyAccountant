# Spec 36 — Widgets Configuráveis e Instanciáveis de Dashboard

> Status: draft
> Insumo: docs/wave-2.md §4 (Dashboards customizáveis) · evolução de `specs/33-dashboard-widgets.md` (§5 itens "criar/duplicar widgets" e "configurar conteúdo interno", marcados como fora de escopo) · reuso de `src/lib/schemas/sandbox.ts` e `specs/19-transaction-search-filter-sort.md`
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md)

---

## 1. Problema

O [spec 33](33-dashboard-widgets.md) introduz um sistema de widgets que permite **reordenar e ocultar** blocos por Account, mas com um catálogo **fixo de singletons**: cada widget existe uma única vez e seu conteúdo é hardcoded. Os limites concretos (explicitados na §5 "Fora de Escopo" do spec 33):

- **WGT-01**: Cada widget do registry é um **singleton** — o usuário só pode mostrá-lo ou escondê-lo. Não há como ter **duas instâncias** do mesmo tipo (ex.: dois gráficos de linha temporal, um para "Alimentação" e outro para "Transporte"). (spec 33 §5: "Criar/duplicar widgets novos pela UI — fora de escopo".)
- **WGT-02**: Widgets singletons existentes **não têm configuração interna**. Exemplos concretos: `kpi-month-total` não permite escolher delta vs mês anterior ou vs ano anterior; `money-flow` (Sankey) não permite escolher agrupar por seção ou por categoria; `category-treemap` não permite limitar ao top N categorias; `budgets` não permite mostrar apenas metas próximas do limite; `top-transactions` não permite definir quantas transações exibir. (spec 33 §5: "Configurar conteúdo interno de um widget — fora de escopo".)
- **WGT-03**: Widgets **não têm configuração por instância**. Não é possível escolher qual categoria/seção, qual período ou qual métrica um widget instanciável exibe — o conteúdo é fixo no componente.
- **WGT-04**: Não existem **widgets genéricos parametrizáveis**: KPI de uma métrica arbitrária, linha temporal de uma category/section escolhida, e lista de transações filtradas. Hoje só há os blocos pré-definidos do dashboard.
- **WGT-05**: O formato de persistência do spec 33 — `DashboardLayout.widgets` como `[{ widgetId, visible }]` (spec 33 §7.2) — **não representa instâncias nem configuração**: não há `instanceId` nem `config`, e não há versionamento do formato para evoluí-lo.
- **WGT-06**: A tela de configuração do spec 33 (`settings/dashboards`) só **reordena e liga/desliga** widgets. Não permite **adicionar, duplicar ou remover** instâncias, nem **editar a configuração interna** de cada uma.
- **WGT-07**: O layout dos widgets é uma **lista sequencial**. Não existe grade — o sistema decide a posição dos widgets com base apenas em `span: 'half' | 'full'` (fixo por tipo, sem controle do usuário). Não é possível posicionar dois KPIs lado a lado num recanto específico da tela nem deixar um widget grande ocupar um bloco de 3×2 colunas.
- **WGT-08**: Widgets não têm **variantes de tamanho predefinidas com apresentação adaptativa**. O campo `span` do spec 33 é binário e hardcoded no registry. Não é possível escolher entre apresentações diferentes para o mesmo widget dependendo do espaço disponível — ex.: `insights` em carrossel horizontal (5×1), em pílulas MUI (3×1), ou em card único com navegação (1×1).

---

## 2. Solução

Evoluir o sistema do spec 33 de "singletons ordenáveis" para "**instâncias configuráveis**", **reusando a infraestrutura analítica já existente** (config do Sandbox e filtros de transação) em vez de criar um motor de configuração paralelo.

> **Dependência**: esta spec assume o spec 33 **implementado** (registry, `DashboardLayout`, renderer, editor `@dnd-kit`). Ela estende esses artefatos; não os recria.

### 2.1 Instâncias de widget e persistência (WGT-01, WGT-05)

- Cada item do layout passa de `{ widgetId, visible }` para `{ instanceId, widgetId, visible, config? }`:
  - `instanceId`: `cuid` único por item — permite múltiplas instâncias do mesmo `widgetId`.
  - `config`: objeto opcional validado pelo `configSchema` do widget (ausente para singletons sem config).
- `DashboardLayout` ganha `schemaVersion Int` (`1` = formato do spec 33; `2` = este formato).
- **Reconciliação compat-forward**: ao ler um layout `schemaVersion = 1`, o service converte cada `{ widgetId, visible }` em `{ instanceId: widgetId, widgetId, visible }` (singleton, sem config) e marca como v2 na próxima escrita. Nenhum backfill obrigatório.

### 2.2 Configuração interna de widgets singletons (WGT-02)

- O `WidgetDef` ganha campos opcionais `configSchema?` (Zod) e `defaultConfig?`.
- Singletons existentes que admitem configuração interna ganham `configSchema` (mas permanecem `instantiable: false` — não podem ser duplicados):
  - `kpi-month-total` → `config: { deltaMode: 'previous_month' | 'previous_year' | 'none' }`
  - `money-flow` (Sankey) → `config: { groupBy: 'section' | 'category' }`
  - `category-treemap` → `config: { topN: 5 | 10 | 20 | 'all' }`
  - `budgets` → `config: { showOnly: 'all' | 'near_limit' }`
  - `top-transactions` → `config: { limit: 5 | 10 | 20 }`
- Singletons **sem** `configSchema` permanecem exatamente como no spec 33 — zero regressão.

### 2.3 Widgets genéricos instanciáveis (WGT-03, WGT-04)

- O `WidgetDef` ganha campo `instantiable: boolean` (default `false`).
- Novos widgets `instantiable: true`, por contexto:
  - **`analysis`** — gráfico configurável; `config` reusa o `sandboxConfigSchema` de `src/lib/schemas/sandbox.ts` (métrica, `groupBy`, `seriesBy`, `chartType`, filtros, período). Cobre "linha temporal de category/section" e qualquer outro gráfico.
  - **`kpi-custom`** — KPI de uma métrica arbitrária; `config = { metric, period, filterSectionIds?, filterCategoryIds?, filterMemberIds? }` (subconjunto do schema do Sandbox).
  - **`filtered-transactions`** — lista de transações filtradas; `config` reusa o schema de filtros do [spec 19](19-transaction-search-filter-sort.md) + `limit`.

### 2.4 Editor: configuração, instâncias e remoção (WGT-06)

- A tela `settings/dashboards` (do spec 33) ganha:
  - Botão de **configuração** (ícone ⚙) em cada item que possua `configSchema`, abrindo um `DialogShell` com formulário RHF + Zod específico do widget.
  - Botão **"Adicionar widget"** — lista apenas tipos `instantiable` do contexto; ao escolher, cria instância com `defaultConfig`.
  - Botão **duplicar** — herda `config` da original com novo `instanceId`.
  - Botão **remover** — remove a instância sem afetar as demais.
- Singletons **sem** `configSchema` continuam apenas reordenáveis/ocultáveis (sem ⚙, sem duplicar/remover).

### 2.5 Grade posicionável por contexto (WGT-07)

- Cada `DashboardContext` define `gridCols` e `gridRows` no registry (ex.: `month_summary: { cols: 5, rows: 8 }`). Esses valores são constantes por contexto — não editáveis pelo usuário.
- `StoredWidget` passa a incluir `x`, `y`, `w`, `h` (inteiros em unidades de grade):
  - `x`, `y`: coluna e linha de início (0-indexed).
  - `w`, `h`: largura e altura em células.
- O renderer usa **CSS Grid** (`display: 'grid'`, `gridTemplateColumns: repeat(cols, 1fr)`) e posiciona cada widget com `gridColumn: '${x + 1} / span ${w}'` e `gridRow: '${y + 1} / span ${h}'`.
- O editor mostra uma **pré-visualização da grade** interativa: o usuário move widgets por drag-and-drop (já provido pelo `@dnd-kit` do spec 33, adaptado para grid) e escolhe a variante de tamanho. Sobreposições são impedidas pelo editor.
- **Conversão compat v1→v2**: widgets sem posição recebem `x = 0`, `y = index`, `w = cols` (largura total), `h` igual à altura da variante padrão do widget.

### 2.6 Variantes de tamanho com apresentação adaptativa (WGT-08)

- O `WidgetDef` ganha `sizeVariants: WidgetSizeVariant[]` — lista de 2 a 4 tamanhos suportados pelo widget, cada um com `{ id, labelKey, w, h, renderMode }`.
  - `w` e `h` são expressados em colunas/linhas da grade do contexto.
  - `renderMode` é uma string opaca consumida pelo componente para adaptar a apresentação (ex.: `'carousel'`, `'pills'`, `'single-card'`).
- O campo `span: 'half' | 'full'` do spec 33 é **substituído** por `sizeVariants`. Para singletons sem variantes explícitas, o sistema infere uma variante única a partir do `span` legado na conversão.
- Cada instância em `StoredWidget` persiste `sizeVariantId` (id da variante escolhida). Ao renderizar, o componente recebe `renderMode` da variante e adapta sua apresentação. Exemplos:
  - `insights` → `[{ id: 'wide', w: 5, h: 1, renderMode: 'carousel' }, { id: 'medium', w: 3, h: 1, renderMode: 'pills' }, { id: 'compact', w: 1, h: 1, renderMode: 'single-card' }]`
  - `kpi-month-total` → `[{ id: 'standard', w: 1, h: 1, renderMode: 'default' }, { id: 'expanded', w: 2, h: 1, renderMode: 'with-chart' }]`
  - `money-flow` → `[{ id: 'full', w: 5, h: 2, renderMode: 'full' }, { id: 'compact', w: 3, h: 2, renderMode: 'compact' }]`
- No editor, o usuário pode mudar a variante de duas formas:
  1. **Seletor de tamanho** (ícones/miniaturas mostrando a pegada na grade) no painel lateral da instância.
  2. **Resize por drag** — alças nas bordas do widget na pré-visualização da grade; ao soltar, o sistema escolhe a `sizeVariant` cujo `(w, h)` mais se aproxima do tamanho arrastado. Não existe tamanho intermediário: o widget sempre termina numa variante declarada.
- **Princípio de densidade de informação**: cada variante maior DEVE expor mais conteúdo ou mais contexto — nunca apenas ampliar espaçamentos, aumentar proporção de tipografia ou inflar áreas vazias. Variantes que não adicionam informação comparadas à menor não devem existir no registry.

---

## 3. User Stories

- Como usuário, quero **configurar** cada widget singleton (ex.: delta de KPI, agrupamento do Sankey, top N do treemap), para que ele mostre exatamente o recorte que me interessa.
- Como usuário, quero adicionar **mais de uma** instância de um widget genérico (ex.: dois gráficos de linha, um por categoria), para montar o dashboard que faz sentido pra mim.
- Como usuário, quero um widget de **lista de transações filtradas** fixado no dashboard, para acompanhar um recorte recorrente sem ir ao sandbox.
- Como usuário, quero **remover** uma instância que não uso mais, sem afetar as demais.
- Como desenvolvedor, quero que widgets configuráveis reusem o schema do Sandbox e os filtros do spec 19, para não manter dois sistemas de configuração paralelos.
- Como viewer, quero **ver** o dashboard com as instâncias e configurações, sem poder editá-las.
- Como usuário, quero **posicionar widgets livremente** na grade da tela, para organizar o dashboard de acordo com o que mais uso.
- Como usuário, quero **escolher o tamanho de cada widget** dentre opções predefinidas, para que ele se encaixe no espaço que reservei e exiba a informação na forma mais adequada para aquele tamanho.

---

## 4. Critérios de Aceitação

### WGT-01 / WGT-05 — Instâncias e persistência

- QUANDO um editor adiciona um segundo widget do mesmo `widgetId`, O SISTEMA DEVE criar um item com `instanceId` distinto, e AMBAS as instâncias DEVEM ser renderizadas independentemente.
- QUANDO o layout é salvo, CADA item DEVE conter `instanceId`, `widgetId`, `visible` e, para widgets com `configSchema`, `config` validado contra ele.
- QUANDO o service lê um layout `schemaVersion = 1` (formato do spec 33), ELE DEVE convertê-lo para o formato de instâncias sem quebrar a renderização.
- A query de leitura DEVE filtrar por `accountId` (multi-tenancy) e a escrita DEVE persistir `schemaVersion = 2`.

### WGT-02 — Configuração de singletons existentes

- QUANDO o usuário abre a configuração de um singleton com `configSchema`, O DIALOG DEVE exibir apenas as opções daquele `configSchema`.
- QUANDO o usuário salva a configuração, O `config` DEVE ser persistido no item do layout; ao renderizar, O WIDGET DEVE usar esse `config` (ou `defaultConfig` se ausente).
- Singletons **sem** `configSchema` NÃO DEVEM exibir o botão ⚙ — comportamento idêntico ao spec 33.

### WGT-03 / WGT-04 — Widgets genéricos instanciáveis

- QUANDO um widget `instantiable` é renderizado, ELE DEVE usar seu `config` (ou `defaultConfig` se ausente) para produzir o conteúdo.
- O REGISTRY DEVE expor ao menos os widgets `analysis`, `kpi-custom` e `filtered-transactions` nos contextos aplicáveis (`monthly`, `yearly`).
- O `config` de `analysis` DEVE ser validado pelo `sandboxConfigSchema`; o de `filtered-transactions` pelo schema de filtros do spec 19. Configurações inválidas DEVEM ser rejeitadas na borda (Zod) antes do upsert.
- QUANDO um widget configurável não tiver dados para o recorte escolhido, ELE DEVE exibir estado vazio amigável, sem quebrar a página.

### WGT-06 — Editor

- QUANDO o usuário clica em "Adicionar widget", A TELA DEVE listar apenas os tipos `instantiable` do contexto e, ao escolher um, adicionar uma instância com `defaultConfig`.
- QUANDO o usuário duplica uma instância, A NOVA instância DEVE herdar o `config` da original com novo `instanceId`.
- QUANDO o usuário remove uma instância, ELA DEVE sair do layout sem afetar as demais.
- QUANDO o usuário abre a configuração de uma instância `instantiable`, O DIALOG DEVE usar `DialogShell` + form RHF/Zod do `configSchema`; ao salvar, o `config` DEVE ser atualizado.
- SE o membro for `viewer`, A ROTA DEVE redirecioná-lo (mesmo comportamento das demais telas de settings).

### WGT-07 — Grade posicionável

- QUANDO o editor abre a tela de configuração do dashboard, ELE DEVE ver uma pré-visualização da grade com todos os widgets posicionados.
- QUANDO o editor arrasta um widget para outra célula da grade, A POSIÇÃO (`x`, `y`) DEVE ser atualizada na pré-visualização imediatamente; ao salvar, DEVE ser persistida.
- O SISTEMA NÃO DEVE permitir posicionar um widget fora dos limites da grade (`x + w > cols` ou `y + h > rows`) nem sobreposto a outro widget.
- QUANDO o layout é convertido de v1 (spec 33), CADA widget DEVE receber `x = 0`, `y = index`, `w = cols`, `h` da variante padrão — garantindo que o dashboard continue visível sem ação do usuário.
- O RENDERER DEVE usar CSS Grid para posicionar widgets, sem JavaScript de posicionamento absoluto.

### WGT-08 — Variantes de tamanho

- CADA `WidgetDef` DEVE declarar `sizeVariants` com ao menos 1 variante; widgets com mais de uma variante DEVEM expô-las como opções no editor.
- QUANDO o editor seleciona uma variante diferente para um widget, O PREVIEW DA GRADE DEVE refletir o novo `(w, h)` imediatamente; ao salvar, `sizeVariantId`, `w` e `h` DEVEM ser persistidos.
- QUANDO o widget é renderizado no dashboard, ELE DEVE receber o `renderMode` da variante escolhida e adaptar sua apresentação a ele. Variante `compact` de `insights` DEVE exibir pílulas MUI em vez de cards em carrossel.
- QUANDO o usuário arrasta uma alça de resize, O SISTEMA DEVE fazer snap para a `sizeVariant` mais próxima ao soltar — NÃO DEVE aceitar dimensões fora das variantes declaradas.
- QUANDO o tamanho de uma variante é maior que outra, O COMPONENTE DEVE exibir mais conteúdo ou mais contexto — NÃO DEVE apenas ampliar espaçamentos, aumentar tamanho de fonte ou deixar áreas vazias.
- SE uma variante salva não existir mais no registry (ex.: widget atualizado), O SISTEMA DEVE fazer fallback para a primeira variante disponível sem quebrar o dashboard.
- O campo `span` legado (`'half' | 'full'`) NÃO DEVE existir no `WidgetDef` após esta spec — substituído integralmente por `sizeVariants`.

---

## 5. Fora de Escopo

- **Tamanhos fracionários** (`w: 1.5`) — apenas inteiros em unidades de grade; drag de resize faz snap para variantes inteiras.
- **Resize para tamanho arbitrário** — o drag faz snap às variantes declaradas no registry; não existe tamanho intermediário persistido.
- **Grade configurável pelo usuário** — as dimensões `cols × rows` de cada contexto são fixas no registry; o usuário não altera o tamanho da grade, só o posicionamento e variante dos widgets.
- **Layout por usuário** — segue por Account, como decidido no spec 33. Personalização individual fica para spec futura.
- **Mover instâncias entre contextos** (ex.: levar um `analysis` do anual para o mensal) — cada contexto tem seu catálogo.
- **Tornar todos os singletons do spec 33 instanciáveis** (ex.: múltiplos Sankeys) — só os novos tipos genéricos são `instantiable` nesta versão.
- **Unificar `pinned-analyses` (SavedAnalysis) com o widget `analysis`** — permanecem separados; migrar SavedAnalysis para instâncias fica para spec futura.
- **Novos tipos de gráfico além dos do Sandbox** — o catálogo de `chartType` é o do `sandboxConfigSchema`.
- **Compartilhar/exportar configurações de widget entre Accounts** — fora de escopo.
- **Configuração inline no card** (popover/drawer dentro do widget) — toda configuração é via `DialogShell` para consistência com os demais settings.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Config de singletons existentes | `configSchema` sem `instantiable: true` | Permite configurar sem duplicar; zero regressão para singletons sem config. |
| Config dos widgets de gráfico | Reusar `sandboxConfigSchema` | Evita um segundo motor de configuração; o Sandbox já valida métrica/groupBy/seriesBy/filtros/período. |
| Config da lista de transações | Reusar filtros do spec 19 | Mesma semântica de filtro já existente nas transações. |
| Identidade da instância | `instanceId` (`cuid`) por item do layout | Permite N instâncias do mesmo `widgetId`. |
| Versionamento | `DashboardLayout.schemaVersion` (1→2) + conversão na leitura | Evolui o formato sem migração de dados; compat-forward com o spec 33. |
| UI de configuração | `DialogShell` + form RHF/Zod por widget | Consistência com os demais settings; evita configurações inline fragmentadas. |
| Escopo do layout | Por Account (igual spec 33) | Consistência com a decisão já tomada. |
| Modelo de grade | Inteiros (cols × rows) por contexto, fixos no registry | Previsível, sem ambiguidade de posicionamento; mais simples de implementar e testar que masonry/breakpoints. |
| Variantes de tamanho | Lista predefinida por `WidgetDef` (2–4 variantes); drag faz snap | Garante que cada tamanho tem apresentação testada e justificada por densidade de informação; evita layouts quebrados de resize livre. |
| `renderMode` | String opaca por variante | Desacopla o registry da lógica de apresentação; o componente decide como interpretar sem expor detalhes de UI no tipo compartilhado. |
| Densidade por variante | Maior variante = mais conteúdo, não mais espaço | Mantém o estilo minimalista do projeto; impede que o dashboard vire um painel de whitespace inflado. |
| Fallback de variante desconhecida | Primeira variante do registry | Evita tela branca quando o registry evolui; simples de implementar. |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar / criar |
|---|---|
| WGT-05 | `prisma/schema.prisma` (`DashboardLayout.schemaVersion Int @default(2)`) + migration |
| WGT-05 | `src/lib/schemas/dashboard-layout.ts` (estender item: `instanceId`, `config`) |
| WGT-05 | `src/server/services/dashboard-layout-service.ts` (conversão v1→v2 na leitura; validação de `config` por widget) + `.test.ts` (compat v1, multi-tenancy) |
| WGT-02 | `src/components/dashboards/widget-registry.ts` (campo `configSchema`, `defaultConfig`; atualizar `kpi-month-total`, `money-flow`, `category-treemap`, `budgets`, `top-transactions`) |
| WGT-03/04 | `src/components/dashboards/widget-registry.ts` (campo `instantiable`; novos widgets `analysis`, `kpi-custom`, `filtered-transactions`) |
| WGT-03/04 | `src/lib/queries/dashboards.ts` (resolver dados a partir de `config` de widget — reusar resolvers do sandbox) |
| WGT-03/04 | reuso de `src/lib/schemas/sandbox.ts` (`sandboxConfigSchema`) e do schema de filtros do spec 19 |
| WGT-06 | `src/components/settings/DashboardLayoutEditor.tsx` (botão ⚙ por item com `configSchema`; adicionar/duplicar/remover instância) |
| WGT-06 | `src/components/settings/WidgetConfigDialog.tsx` (novo — `DialogShell` + RHF/Zod por `configSchema`) |
| WGT-07/08 | `src/components/dashboards/widget-registry.ts` (adicionar `gridCols`, `gridRows` por contexto; substituir `span` por `sizeVariants: WidgetSizeVariant[]`) |
| WGT-07/08 | `src/lib/schemas/dashboard-layout.ts` (adicionar `x`, `y`, `w`, `h`, `sizeVariantId` ao `storedWidgetSchema`) |
| WGT-07/08 | `src/server/services/dashboard-layout-service.ts` (conversão v1→v2 com posição padrão; fallback de variante desconhecida) |
| WGT-07 | `src/components/settings/DashboardGridPreview.tsx` (novo — pré-visualização da grade com `@dnd-kit` para mover widgets e alças de resize com snap para variante mais próxima) |
| WGT-08 | `src/components/settings/SizeVariantPicker.tsx` (novo — seletor de variante: miniaturas da pegada na grade; também acionado pelo snap do resize) |
| WGT-08 | Cada componente de widget (ex.: `src/components/dashboards/widgets/InsightsWidget.tsx`) recebe prop `renderMode` e adapta apresentação |
| Mensagens | `src/lib/messages/pt-BR.ts` (`settings.dashboards.config.*`, rótulos dos novos widgets, opções de config e variantes de tamanho) |

### 7.1 Formato de persistência (v2)

```ts
// src/lib/schemas/dashboard-layout.ts
export const storedWidgetSchema = z.object({
  instanceId: z.string().min(1),
  widgetId: z.string().min(1),
  visible: z.boolean(),
  // posição na grade
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  sizeVariantId: z.string().min(1),
  config: z.unknown().optional(), // validado contra o configSchema do widget no service
});

export const updateDashboardLayoutSchema = z.object({
  context: dashboardContextSchema,
  widgets: z.array(storedWidgetSchema).min(1),
});
```

```ts
// ✅ Correto — conversão compat na leitura (spec 33 v1 → v2)
// Atribui posição padrão (largura total, empilhado verticalmente) e variante padrão do registry
function upgradeV1(
  stored: { widgetId: string; visible: boolean }[],
  registry: WidgetDef[],
  cols: number,
): StoredWidget[] {
  return stored.map((s, i) => {
    const def = registry.find((d) => d.id === s.widgetId);
    const variant = def?.sizeVariants[0] ?? { id: 'default', w: cols, h: 1 };
    return { instanceId: s.widgetId, widgetId: s.widgetId, visible: s.visible,
             x: 0, y: i, w: variant.w, h: variant.h, sizeVariantId: variant.id };
  });
}

// ❌ Anti-padrão — exigir migração de dados/backfill para ler layouts antigos
```

### 7.2 `WidgetDef` estendido

```ts
// src/components/dashboards/widget-registry.ts

// Variante de tamanho: define pegada na grade + como o componente se apresenta
export type WidgetSizeVariant = {
  id: string;         // ex: 'wide', 'medium', 'compact'
  labelKey: string;   // chave i18n para nome da variante no editor
  w: number;          // largura em colunas de grade
  h: number;          // altura em linhas de grade
  renderMode: string; // string opaca passada como prop ao componente
};

// Dimensões da grade por contexto (definidas no registry, não editáveis pelo usuário)
export type DashboardGridConfig = {
  cols: number;
  rows: number;
};

export type WidgetDef = {
  id: string;
  labelKey: string;
  kind: WidgetKind;              // "kpi" | "panel"
  // ❌ span?: WidgetSpan        // removido — substituído por sizeVariants
  sizeVariants: WidgetSizeVariant[]; // ao menos 1 variante obrigatória
  defaultVisible: boolean;
  instantiable?: boolean;        // default false → singleton do spec 33
  configSchema?: z.ZodTypeAny;   // opcional para singletons com config; obrigatório para instantiable
  defaultConfig?: unknown;
};

// Exemplos de sizeVariants por widget:
// insights         → [{ id: 'wide',    w: 5, h: 1, renderMode: 'carousel'    },
//                     { id: 'medium',  w: 3, h: 1, renderMode: 'pills'       },
//                     { id: 'compact', w: 1, h: 1, renderMode: 'single-card' }]
// kpi-month-total  → [{ id: 'standard', w: 1, h: 1, renderMode: 'default'    },
//                     { id: 'expanded', w: 2, h: 1, renderMode: 'with-chart' }]
// money-flow       → [{ id: 'full',    w: 5, h: 2, renderMode: 'full'        },
//                     { id: 'compact', w: 3, h: 2, renderMode: 'compact'     }]

// Grids por contexto (exemplo — valores finais definidos na implementação):
// month_summary → { cols: 5, rows: 8 }
// monthly       → { cols: 4, rows: 8 }
// yearly        → { cols: 4, rows: 8 }

// Singletons com configuração interna (instantiable: false, configSchema definido):
// kpi-month-total      → z.object({ deltaMode: z.enum(['previous_month','previous_year','none']) })
// money-flow (Sankey)  → z.object({ groupBy: z.enum(['section','category']) })
// category-treemap     → z.object({ topN: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal('all')]) })
// budgets              → z.object({ showOnly: z.enum(['all','near_limit']) })
// top-transactions     → z.object({ limit: z.union([z.literal(5), z.literal(10), z.literal(20)]) })

// Novos widgets instanciáveis (instantiable: true) — config reusa schemas existentes:
// analysis               → configSchema = sandboxConfigSchema
// kpi-custom             → configSchema = subconjunto { metric, period, filters }
// filtered-transactions  → configSchema = filtros do spec 19 + limit
```

### 7.3 Validação de `config` no service

> O `configSchema` não pode ser embutido no Zod do layout (depende do `widgetId` em runtime). O service DEVE, por item: localizar o `WidgetDef` no registry do contexto, e — se `configSchema` estiver definido — validar `item.config` contra `def.configSchema` **antes** do upsert. Itens com `widgetId` desconhecido ou `config` inválido são rejeitados (não descartados silenciosamente, para não perder dados do editor).

### 7.4 Renderização em CSS Grid

```tsx
// src/components/dashboards/DashboardGrid.tsx
// ✅ Correto — CSS Grid nativo via MUI Box
<Box
  sx={{
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, auto)`,
    gap: layout.cluster,
  }}
>
  {widgets.map((item) => (
    <Box
      key={item.instanceId}
      sx={{
        gridColumn: `${item.x + 1} / span ${item.w}`,
        gridRow: `${item.y + 1} / span ${item.h}`,
      }}
    >
      <WidgetRenderer item={item} renderMode={item.sizeVariantId} />
    </Box>
  ))}
</Box>

// ❌ Anti-padrão — posicionamento absoluto com top/left ou calc()
```

### 7.5 Prop `renderMode` nos componentes de widget

```tsx
// src/components/dashboards/widgets/InsightsWidget.tsx
// ✅ Correto — componente adapta apresentação ao renderMode
type InsightsWidgetProps = {
  data: InsightItem[];
  renderMode: 'carousel' | 'pills' | 'single-card';
};

export function InsightsWidget({ data, renderMode }: InsightsWidgetProps) {
  if (renderMode === 'pills')       return <InsightsPills items={data} />;
  if (renderMode === 'single-card') return <InsightsSingleCard items={data} />;
  return <InsightsCarousel items={data} />; // 'carousel' é o default
}

// ❌ Anti-padrão — usar w/h diretamente no componente para decidir apresentação
// (o componente não deve conhecer o grid; recebe apenas renderMode)
```

```tsx
// ✅ Correto — variante maior adiciona conteúdo, não espaço
// renderMode 'with-chart': exibe o valor KPI + sparkline dos últimos 6 meses
// renderMode 'default':    exibe apenas o valor KPI + delta

// ❌ Anti-padrão — variante maior só infla espaçamento/tipografia
// sx={{ p: renderMode === 'expanded' ? 6 : 2, fontSize: renderMode === 'expanded' ? 32 : 24 }}
// → não acrescenta informação, viola o estilo minimalista do projeto
```
