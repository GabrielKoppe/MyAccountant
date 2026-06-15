# Spec 36 — Widgets Configuráveis e Instanciáveis de Dashboard

> Status: approved
> Refinamento: 2026-06-14 — sessão de refinamento de produto (ver §6 para tabela completa de decisões).
> Insumo: docs/wave-2.md §4 (Dashboards customizáveis) · evolução de `specs/33-dashboard-widgets.md` (§5 itens "criar/duplicar widgets" e "configurar conteúdo interno", marcados como fora de escopo) · reuso de `src/lib/schemas/sandbox.ts` e `specs/19-transaction-search-filter-sort.md` · `docs/widgets.md`
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`dashboard-widgets`](../skills/dashboard-widgets/SKILL.md)

---

## 1. Problema

O [spec 33](33-dashboard-widgets.md) introduz um sistema de widgets que permite **reordenar e ocultar** blocos por Account, mas com um catálogo **fixo de singletons**: cada widget existe uma única vez e seu conteúdo é hardcoded. Os limites concretos (explicitados na §5 "Fora de Escopo" do spec 33):

- **WGT-01**: Cada widget do registry é um **singleton** — o usuário só pode mostrá-lo ou escondê-lo. Não há como ter **duas instâncias** do mesmo tipo (ex.: dois gráficos de linha temporal, um para "Alimentação" e outro para "Transporte"). (spec 33 §5: "Criar/duplicar widgets novos pela UI — fora de escopo".)
- **WGT-02**: Widgets singletons existentes **não têm configuração interna**. Exemplos concretos: `kpi-month-total` não permite escolher delta vs mês anterior ou vs ano anterior; `money-flow` (Sankey) não permite escolher agrupar por seção ou por categoria; `category-treemap` não permite limitar ao top N categorias; `budgets` não permite mostrar apenas metas próximas do limite; `top-transactions` não permite definir quantas transações exibir. (spec 33 §5: "Configurar conteúdo interno de um widget — fora de escopo".)
- **WGT-03**: Widgets **não têm configuração por instância**. Não é possível escolher qual categoria/seção, qual período ou qual métrica um widget instanciável exibe — o conteúdo é fixo no componente.
- **WGT-04**: Não existem **widgets genéricos parametrizáveis**: KPI de uma métrica arbitrária, linha temporal de uma category/section escolhida, e lista de transações filtradas. Hoje só há os blocos pré-definidos do dashboard.
- **WGT-05**: O formato de persistência do spec 33 — `DashboardLayout.widgets` como `string[]` de widgetIds ativos — **não representa instâncias nem configuração**: não há `instanceId`, `config`, ou coordenadas de posição na grade.
- **WGT-06**: A tela de configuração do spec 33 (`settings/dashboards`) só **reordena e liga/desliga** widgets em lista vertical. Não permite **posicionar livremente na grade**, configurar conteúdo interno, adicionar instâncias ou visualizar o layout em grade.
- **WGT-07**: O layout dos widgets é uma **lista sequencial**. Não existe grade — o sistema decide a posição dos widgets com base apenas em `span: 'half' | 'full'` (fixo por tipo, sem controle do usuário). Não é possível posicionar dois KPIs lado a lado num recanto específico da tela nem deixar um widget grande ocupar um bloco de 3×2 colunas.
- **WGT-08**: Widgets não têm **variantes de tamanho predefinidas com apresentação adaptativa**. O campo `span` do spec 33 é binário e hardcoded no registry. Não é possível escolher entre apresentações diferentes para o mesmo widget dependendo do espaço disponível — ex.: `insights` em carrossel horizontal (6×1), em card médio (3×2), ou em card compacto (2×1).

---

## 2. Solução

Evoluir o sistema do spec 33 de "singletons ordenáveis" para "**instâncias configuráveis em grade 2D**", reusando a infraestrutura analítica já existente (config do Sandbox e filtros de transação).

> **Dependência**: esta spec assume o spec 33 **implementado**. O editor de lista (`DashboardLayoutEditor.tsx`) e o renderer sequencial (`DashboardWidgetRenderer.tsx`) do spec 33 são **substituídos** por novos componentes. O registry, o model Prisma e a action de layout permanecem, mas são estendidos.
> **Migration**: o formato do campo `widgets` muda de `string[]` (spec 33) para `StoredWidget[]` (esta spec). A migration faz **DROP TABLE `dashboard_layouts` + CREATE TABLE** — sem conversão de dados existentes (projeto em desenvolvimento, sem usuários em produção).

### 2.1 Instâncias de widget e persistência (WGT-01, WGT-05)

- Cada item do layout é `StoredWidget`:
  - `instanceId`: cuid único por item — permite múltiplas instâncias do mesmo `widgetId`.
  - `widgetId`: referência ao registry.
  - `visible`: `boolean` — `false` = instância em modo "ghost" na grade (posição e config preservadas; não renderizada nos dashboards).
  - `x`, `y`: coluna e linha de início (0-indexed).
  - `w`, `h`: largura e altura em células de grade.
  - `sizeVariantId`: id da variante de tamanho ativa.
  - `config`: objeto opcional, validado pelo `configSchema` do widget no service (ausente para singletons sem config).
- **Sem `schemaVersion`**: migration limpa (DROP + CREATE). Nenhuma lógica de conversão de formato legado.
- **Reconciliação**: ao ler o layout, `instanceId`s com `widgetId` desconhecido são descartados silenciosamente. Widgets do registry com `defaultVisible: true` não presentes no layout salvo são **auto-inseridos** na próxima posição livre (algoritmo bin-packing: linha por linha, esquerda para direita) usando `sizeVariants[0]`.
- **Layout inicial** (`stored = null`): todos os widgets com `defaultVisible: true` são auto-posicionados em ordem de registry usando suas variantes default.

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
- Três novos widgets `instantiable: true`:
  - **`analysis`** — gráfico configurável; `config` reutiliza `sandboxConfigSchema` de `src/lib/schemas/sandbox.ts`. O formulário de configuração filtra as opções por contexto na UI (ex.: `periodType: "current_month"` disponível apenas em `monthly`; `periodType: "year"` apenas em `yearly`) — o schema amplo é reutilizado sem modificação. Disponível em `monthly` e `yearly`.
  - **`kpi-custom`** — KPI de métrica arbitrária; `config` subconjunto do `sandboxConfigSchema` (`metric`, `period`, filtros opcionais de seção/categoria/membro). Disponível em todos os 3 contextos. O componente `KpiCustomWidget` pode ser reutilizado internamente como implementação dos KPIs fixos (ex.: `kpi-income` usa `KpiCustomWidget` com config fixa) — porém os KPIs fixos continuam aparecendo e se comportando exatamente como hoje para o usuário final.
  - **`filtered-transactions`** — lista de transações filtradas; `config` reutiliza o schema de filtros do [spec 19](19-transaction-search-filter-sort.md) + `limit`. Disponível **apenas em `month_summary`** (contexto de acompanhamento de transações do mês, não de análise).

### 2.4 Editor de grade 2D (WGT-06)

O editor de lista do spec 33 (`DashboardLayoutEditor.tsx`) é **substituído** por um editor de grade 2D. Novos componentes:

- **`DashboardGridEditor.tsx`** (cliente) — orquestra o canvas da grade, a paleta lateral e o estado de layout.
- **`DashboardGridCanvas.tsx`** (cliente) — canvas interativo da grade: drag-and-drop de reposicionamento, alças de resize com snap de variante, indicador visual de drop zone durante drag.
- **`WidgetPalette.tsx`** (cliente) — painel lateral com widgets disponíveis. Para singletons: exibe apenas os não instanciados. Para instanciáveis: sempre disponíveis na paleta (sem limite por tipo — o limite é o espaço da grade).
- **`WidgetConfigDialog.tsx`** (cliente) — `DialogShell` + form RHF/Zod para o `configSchema` do widget.

**Como adicionar widgets:** o usuário arrasta da paleta lateral para uma célula da grade. O widget é inserido com sua variante default (`sizeVariants[0]`); a posição é onde foi solto (ou a célula livre mais próxima se houver colisão com push).

**Colisões — Push:** ao soltar um widget sobre células ocupadas, os widgets afetados são empurrados para baixo, abrindo espaço. Se o push ultrapassar o limite máximo de linhas da grade, o drop é cancelado com feedback visual (borda vermelha na zona de drop).

**Instâncias ocultas (ghost):** ao ocultar, o widget permanece na grade com opacidade reduzida e ícone `VisibilityOffIcon`. O usuário reativa clicando no ícone. Widgets ocultos **não são renderizados** nos dashboards (apenas no editor). O `visible: false` preserva posição e config — especialmente útil para instâncias com `configSchema` configurado.

**Comportamentos e auto-save:**

| Ação | Como | Auto-save |
|---|---|---|
| Reposicionar widget | Drag na grade | Debounce 600 ms |
| Resize de variante | Arrastar alça → snap para variante mais próxima | Debounce 600 ms |
| Ocultar / Reativar | Toggle `VisibilityOffIcon` no widget | Debounce 600 ms |
| Adicionar widget | Drag da paleta para a grade | Imediato |
| Remover instância | Botão ✕ no menu de contexto do widget | Imediato |
| Duplicar instância | Menu de contexto → "Duplicar" | Imediato |
| Editar config (⚙) | Abre `WidgetConfigDialog` → botão "Salvar" | Save explícito no dialog |

**Seletor de variante:** ao selecionar um widget na grade, um painel lateral exibe as variantes disponíveis como miniaturas mostrando a pegada na grade. O usuário pode clicar para mudar a variante ou arrastar a alça de resize — o sistema faz snap para a variante declarada cujo `(w, h)` é mais próximo.

### 2.5 Grade posicionável (WGT-07)

- **6 colunas** para todos os contextos — grade uniforme.
- **Linhas iniciais e máximas** (fixas no registry por contexto):

| Contexto | Linhas iniciais | Limite máximo |
|---|---|---|
| `monthly` | 10 | 12 |
| `yearly` | 8 | 12 |
| `month_summary` | 6 | 10 |

- **Crescimento automático**: ao arrastar um widget abaixo da última linha do canvas, o sistema adiciona uma nova linha (até o limite máximo). Linhas completamente vazias ao final são removidas automaticamente ao salvar.
- **Sem limite por tipo de widget instanciável**: o único limite é o espaço disponível na grade. Ao atingir o limite máximo de linhas, drops são cancelados com feedback visual.
- **Mobile (`xs`/`sm`)**: os widgets renderizam como lista sequencial (ordem da grade: linha por linha, esquerda para direita), sem grade 2D. O editor de grade 2D não está disponível em mobile. Ver **spec 28** para responsividade completa do dashboard.
- **Renderer**: CSS Grid nativo via MUI Box (`display: 'grid'`, `gridTemplateColumns: 'repeat(6, 1fr)'`). Cada widget posicionado com `gridColumn: '${x+1} / span ${w}'` e `gridRow: '${y+1} / span ${h}'`.

### 2.6 Variantes de tamanho (WGT-08)

O campo `span: 'half' | 'full'` é **removido** de todos os `WidgetDef`. Cada widget declara `sizeVariants: WidgetSizeVariant[]` com 2–3 variantes derivadas de `docs/widgets.md` (min/default/max). O `sizeVariants[0]` é a variante default (usada no auto-posicionamento inicial).

- Se `min = default` → 2 variantes: `default` e `large` (max).
- Se `min < default < max` → 3 variantes: `small` (min), `default`, `large` (max).
- Se só há variação em uma dimensão → 2 variantes ajustadas.

**Tabela completa de variantes por widget:**

| widgetId | id variante | w | h | renderMode |
|---|---|---|---|---|
| todos `kpi-*` e `kpi-custom` | `default` | 1 | 1 | `default` |
| | `wide` | 2 | 1 | `wide` |
| `budgets` | `small` | 2 | 1 | `compact` |
| | `default` | 3 | 2 | `default` |
| | `large` | 6 | 3 | `full` |
| `section-cards` | `compact` | 2 | 1 | `compact` |
| | `default` | 6 | 1 | `default` |
| | `expanded` | 6 | 2 | `expanded` |
| `activity-lists` | `compact` | 6 | 2 | `compact` |
| | `default` | 6 | 3 | `default` |
| `insights` | `compact` | 2 | 1 | `compact` |
| | `default` | 3 | 2 | `default` |
| | `large` | 6 | 3 | `expanded` |
| `daily-heatmap` | `compact` | 2 | 2 | `compact` |
| | `default` | 3 | 3 | `default` |
| | `large` | 4 | 3 | `full` |
| `category-treemap` | `compact` | 2 | 2 | `compact` |
| | `default` | 3 | 3 | `default` |
| | `large` | 4 | 3 | `full` |
| `money-flow` | `compact` | 2 | 2 | `compact` |
| | `default` | 6 | 3 | `default` |
| `section-breakdown` | `compact` | 2 | 2 | `compact` |
| | `default` | 3 | 2 | `default` |
| | `large` | 4 | 3 | `full` |
| `category-breakdown` | `compact` | 2 | 2 | `compact` |
| | `default` | 3 | 2 | `default` |
| | `large` | 4 | 3 | `full` |
| `top-transactions` | `compact` | 3 | 2 | `compact` |
| | `default` | 6 | 2 | `default` |
| | `large` | 6 | 3 | `expanded` |
| `month-card-grid` | `compact` | 2 | 1 | `compact` |
| | `default` | 6 | 1 | `default` |
| | `expanded` | 6 | 2 | `expanded` |
| `monthly-bar-chart` | `compact` | 3 | 1 | `compact` |
| | `default` | 6 | 2 | `default` |
| | `large` | 6 | 3 | `expanded` |
| `top-categories` | `compact` | 3 | 2 | `compact` |
| | `default` | 6 | 2 | `default` |
| | `large` | 6 | 3 | `expanded` |
| `member-trend` | `compact` | 3 | 2 | `compact` |
| | `default` | 6 | 2 | `default` |
| | `large` | 6 | 3 | `expanded` |
| `member-breakdown` | `compact` | 3 | 2 | `compact` |
| | `default` | 6 | 2 | `default` |
| | `large` | 6 | 3 | `expanded` |
| `analysis` (instanciável) | `compact` | 2 | 2 | `compact` |
| | `default` | 3 | 3 | `default` |
| | `large` | 6 | 4 | `expanded` |
| `filtered-transactions` (instanciável) | `compact` | 3 | 2 | `compact` |
| | `default` | 6 | 2 | `default` |
| | `large` | 6 | 3 | `expanded` |

> Nota: `docs/widgets.md` declara `member-breakdown` com `default: 6w/1h` mas range `h:2-3`. O default correto é `6w/2h` (mínimo do range declarado); o arquivo será corrigido durante a implementação.

**Princípio de densidade de informação**: cada variante maior DEVE expor mais conteúdo ou mais contexto — nunca apenas ampliar espaçamentos ou aumentar tipografia. Variantes que não adicionam informação não devem existir no registry.

### 2.7 Remoção de SavedAnalysis e novo fluxo do Sandbox

O widget `pinned-analyses` e o model `SavedAnalysis` são **removidos completamente** — não deprecados.

**Remoção:**
- Model `SavedAnalysis` do Prisma (migration DROP TABLE `saved_analyses`)
- Relação `savedAnalyses` em `Account`
- Widget `pinned-analyses` do `WIDGET_REGISTRY` (todos os contextos)
- Componente `PinnedAnalysesSection.tsx`
- Página `src/app/(app)/[accountId]/settings/analyses/`
- Actions `saveSandboxAnalysisAction` e `togglePinAction`
- Schemas `saveSandboxAnalysisSchema`, `togglePinSchema` de `src/lib/schemas/sandbox.ts`

**Novo fluxo — Sandbox → Dashboard:**
1. No Sandbox, o botão "Salvar análise" / "Fixar" é substituído por **"Adicionar ao dashboard"**.
2. Ao clicar, um modal pede ao usuário para escolher o contexto de destino (`monthly` ou `yearly`).
3. O sistema cria uma instância `analysis` naquele dashboard com a config do Sandbox pré-preenchida, posicionada na próxima célula livre da grade.
4. O usuário pode refinar posição e config depois no editor do dashboard (`Configurações → Visualização`).

**Widget `analysis` = caminho canônico** para charts configurados nos dashboards. O Sandbox continua existindo para exploração ad-hoc — só o destino dos gráficos muda.

---

## 3. User Stories

- Como usuário, quero **configurar internamente** um widget singleton (ex.: delta do KPI, agrupamento do Sankey, top N do treemap), para que ele mostre o recorte que me interessa.
- Como usuário, quero adicionar **mais de uma** instância de um widget genérico (ex.: dois KPIs de métricas distintas, dois gráficos por categoria), para montar o dashboard que faz sentido para mim.
- Como usuário, quero **posicionar livremente** cada widget na grade, arrastando-o para a posição que prefiro.
- Como usuário, quero **escolher o tamanho de cada widget** dentre opções predefinidas, para que ele exiba a informação na forma adequada ao espaço que reservei.
- Como usuário, quero **ocultar** um widget sem removê-lo, para preservar minha configuração sem poluir o dashboard.
- Como usuário, quero que o canvas **cresça automaticamente** ao adicionar widgets, sem precisar gerenciar o tamanho da grade manualmente.
- Como usuário, quero um widget de **lista de transações filtradas** no resumo do mês, para acompanhar um recorte recorrente sem ir à tela de transações.
- Como usuário, quero **adicionar ao dashboard** um gráfico que explorei no Sandbox, sem precisar reconfigurá-lo do zero.
- Como viewer, quero **ver** o dashboard com as instâncias e configurações, sem poder editá-las.

---

## 4. Critérios de Aceitação

### WGT-01 / WGT-05 — Instâncias e persistência

- QUANDO um editor adiciona um segundo widget do mesmo `widgetId`, O SISTEMA DEVE criar uma instância com `instanceId` distinto, e ambas DEVEM ser renderizadas independentemente.
- QUANDO o layout é salvo, CADA item DEVE conter `instanceId`, `widgetId`, `visible`, `x`, `y`, `w`, `h`, `sizeVariantId` e, para widgets com `configSchema`, `config` validado contra ele.
- A query de leitura DEVE filtrar por `accountId` (multi-tenancy).
- QUANDO o layout salvo contém `instanceId` com `widgetId` desconhecido, ELE DEVE ser descartado silenciosamente.
- QUANDO o registry tem um widget com `defaultVisible: true` não instanciado no layout salvo, ELE DEVE ser auto-inserido na próxima posição livre da grade usando `sizeVariants[0]`.

### WGT-02 — Configuração de singletons existentes

- QUANDO o usuário abre a configuração (⚙) de um singleton com `configSchema`, O DIALOG DEVE exibir apenas as opções daquele `configSchema`.
- QUANDO o usuário clica "Salvar" no dialog, O `config` DEVE ser persistido na instância; ao renderizar, O WIDGET DEVE usar esse `config` (ou `defaultConfig` se ausente).
- Singletons **sem** `configSchema` NÃO DEVEM exibir o botão ⚙.

### WGT-03 / WGT-04 — Widgets genéricos instanciáveis

- QUANDO um widget `instantiable` é renderizado, ELE DEVE usar seu `config` (ou `defaultConfig` se ausente) para produzir o conteúdo.
- O REGISTRY DEVE expor `analysis` e `kpi-custom` em `monthly` e `yearly`; `kpi-custom`, `filtered-transactions` e `insights` em `month_summary`.
- O `config` de `analysis` DEVE ser validado pelo `sandboxConfigSchema`; o de `filtered-transactions` pelo schema de filtros do spec 19. Configurações inválidas DEVEM ser rejeitadas na borda (Zod) antes do upsert.
- QUANDO um widget configurável não tiver dados para o recorte escolhido, ELE DEVE exibir `<EmptyState>` amigável, sem quebrar a página.

### WGT-06 — Editor de grade 2D

- QUANDO o editor abre, ELE DEVE exibir o canvas da grade com todos os widgets posicionados e a paleta lateral de widgets disponíveis.
- QUANDO o usuário arrasta da paleta para a grade, O WIDGET DEVE ser inserido naquela posição (com push se necessário) e auto-salvar imediatamente.
- QUANDO o usuário arrasta um widget existente para nova posição, A MUDANÇA DEVE refletir imediatamente (otimista) e auto-salvar com debounce de 600 ms.
- QUANDO o usuário arrasta a alça de resize, O SISTEMA DEVE fazer snap para a `sizeVariant` mais próxima ao soltar e auto-salvar com debounce de 600 ms.
- QUANDO o usuário oculta um widget, ELE DEVE aparecer no canvas como ghost (opacidade reduzida + `VisibilityOffIcon`) e auto-salvar com debounce de 600 ms. Widgets ocultos NÃO DEVEM ser renderizados nos dashboards.
- QUANDO o usuário abre ⚙ de uma instância, O DIALOG DEVE usar `DialogShell` + form RHF/Zod do `configSchema`; ao clicar "Salvar" no dialog, O `config` DEVE ser persistido.
- QUANDO o auto-save falha, O SISTEMA DEVE reverter o estado otimista e exibir snackbar de erro.
- SE o membro for `viewer`, A ROTA de settings DEVE redirecioná-lo.
- O drag-and-drop DEVE ser operável por teclado (`KeyboardSensor` do `@dnd-kit`).
- QUANDO o canvas está no limite máximo de linhas e o usuário tenta dropar, O DROP DEVE ser cancelado com feedback visual.

### WGT-07 — Grade posicionável

- O RENDERER DEVE usar CSS Grid para posicionar widgets, sem JavaScript de posicionamento absoluto.
- O SISTEMA NÃO DEVE permitir posicionar um widget fora dos limites (`x + w > 6` ou `y + h > maxRows`).
- QUANDO o canvas cresce automaticamente, A NOVA LINHA DEVE respeitar o `maxRows` do contexto.
- EM `xs`/`sm`, os widgets DEVEM renderizar como lista sequencial (linha por linha, esquerda para direita) — sem grade 2D.
- O editor de grade 2D DEVE estar visível apenas em `md`+.

### WGT-08 — Variantes de tamanho

- CADA `WidgetDef` DEVE declarar `sizeVariants` com ao menos 1 variante.
- QUANDO o editor seleciona variante diferente, O PREVIEW DEVE refletir o novo `(w, h)` imediatamente; ao salvar, `sizeVariantId`, `w` e `h` DEVEM ser persistidos.
- QUANDO o widget é renderizado, ELE DEVE receber `renderMode` da variante e adaptar sua apresentação.
- QUANDO o usuário arrasta alça de resize, O SISTEMA DEVE fazer snap para a `sizeVariant` mais próxima ao soltar.
- SE uma variante salva não existir mais no registry, O SISTEMA DEVE fazer fallback para `sizeVariants[0]` sem quebrar o dashboard.
- O campo `span` NÃO DEVE existir em nenhum `WidgetDef` após esta spec.

### WGT-09 — Remoção de SavedAnalysis

- O model `SavedAnalysis` NÃO DEVE existir no schema Prisma após a migration.
- O widget `pinned-analyses` NÃO DEVE existir em nenhum contexto do `WIDGET_REGISTRY`.
- O Sandbox DEVE exibir o botão **"Adicionar ao dashboard"** e NÃO DEVE exibir "Salvar análise" / "Fixar".
- QUANDO o usuário clica "Adicionar ao dashboard" no Sandbox, O SISTEMA DEVE criar uma instância `analysis` no contexto escolhido com a config pré-preenchida.

---

## 5. Fora de Escopo

- **Tamanhos fracionários** (`w: 1.5`) — apenas inteiros; resize faz snap para variantes declaradas.
- **Resize para tamanho arbitrário** — o drag faz snap às variantes declaradas no registry; não existe tamanho intermediário persistido.
- **Grade configurável pelo usuário** — `cols` e `maxRows` são fixos no registry por contexto.
- **Layout por usuário** — segue por Account. Personalização individual fica para spec futura.
- **Mover instâncias entre contextos** — cada contexto tem seu catálogo independente.
- **Tornar todos os singletons do spec 33 instanciáveis** (ex.: múltiplos Sankeys) — apenas os 3 novos tipos são `instantiable`.
- **Migrar `SavedAnalysis` existentes para instâncias `analysis`** — remoção total sem migração (projeto em desenvolvimento).
- **Responsividade avançada em mobile** — o fallback sequencial em `xs`/`sm` é provisório; experiência de dashboard em mobile fica para **spec 28**.
- **Configuração inline no card** (popover dentro do widget no dashboard) — toda config via `DialogShell` no editor de settings.
- **Novos tipos de gráfico além dos do Sandbox** — o catálogo de `chartType` é o do `sandboxConfigSchema`.
- **Compartilhar configurações de widget entre Accounts** — fora de escopo.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| `visible: boolean` | Reintroduzido no `StoredWidget` | Preserva posição e config de instâncias ocultas; especialmente útil para instâncias configuradas via `configSchema` |
| `span` → `sizeVariants` | Migração completa (Opção A) | Todos os widgets ganham variantes explícitas; `span` removido; grade 2D requer dimensões em colunas/linhas |
| Colunas da grade | 6 para todos os contextos | Compatível com 6 KPIs em linha (cada `w:1`); grade uniforme entre contextos |
| Linhas iniciais/máximas | monthly 10/12, yearly 8/12, month_summary 6/10 | Limite do canvas força curadoria — o usuário escolhe porque não cabe tudo |
| Crescimento do canvas | Automático ao arrastar abaixo da última linha | Mais fluido que botão explícito; `maxRows` garante contenção |
| Editor | Substituição total por grade 2D (`DashboardGridEditor`) | Posicionamento livre requer canvas 2D; lista vertical não suporta coordenadas |
| Adição de widgets | Paleta lateral + drag para a grade | Intuitivo; usuário controla onde o widget cai |
| Instâncias ocultas | Ghost na grade (opacidade + `VisibilityOffIcon`) | Preserva posição e config; visível no editor, invisível no dashboard |
| Colisões | Push (empurra widgets para baixo) | Mais fluido que bloquear; menos disruptivo que swap com widgets de tamanhos diferentes |
| Auto-save | Layout (drag/resize/ocultar/add/remove): debounce 600 ms. Config interna: save explícito no dialog | Config é mais crítica — botão explícito dá controle; auto-save flui para ações de posicionamento |
| `pinned-analyses` / `SavedAnalysis` | Remoção total | Projeto em desenvolvimento; `analysis` é o caminho canônico; sem usuários em produção para migrar |
| Fluxo Sandbox → Dashboard | Botão "Adicionar ao dashboard" | Elimina redundância de dois sistemas; mantém Sandbox para exploração |
| `kpi-custom` | Complemento (novas métricas); componente pode ser base interna dos KPIs fixos | Fixos continuam como antes para o usuário; reutilização de componente é decisão de implementação |
| `filtered-transactions` | Apenas em `month_summary` | Contexto de acompanhamento de transações do mês, não de análise |
| `analysis` | Apenas em `monthly` e `yearly` | Gráficos de análise pertencem aos dashboards, não ao resumo do mês |
| `insights` | Nos 3 contextos; `defaultVisible: false` | Em month_summary pode resumir o que foi detectado no mês; desativado por padrão (widget avançado) |
| `schemaVersion` | Removido | Migration limpa; sem usuários em produção; lógica de conversão seria código morto |
| Mobile | Lista sequencial em `xs`/`sm`; spec 28 trata mobile | Grade 2D requer espaço de tela; não degradar experiência agora |
| Config do `analysis` | `sandboxConfigSchema` reutilizado integralmente; UI filtra por contexto | Evita duplicação de schema; UX guiada pelo formulário |
| Escopo do layout | Por Account (mantido do spec 33) | Membros compartilham a mesma organização acordada |
| Sem limite por tipo instanciável | Limite é o espaço da grade (`maxRows` × 6 cols) | Simples; canvas cheio impede adições; `maxRows` baixo força curadoria |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar / criar |
|---|---|
| WGT-05/09 | `prisma/schema.prisma` — remover model `SavedAnalysis` e relação `savedAnalyses`; migration DROP+CREATE de `dashboard_layouts` |
| WGT-05 | `src/lib/schemas/dashboard-layout.ts` — `storedWidgetSchema` com `instanceId`, `visible`, `x`, `y`, `w`, `h`, `sizeVariantId`, `config` |
| WGT-05 | `src/server/services/dashboard-layout-service.ts` — atualizar para novo formato; bin-packing para auto-posicionamento; fallback de variante desconhecida |
| WGT-02/03/04/08 | `src/components/dashboards/_core/widget-registry.ts` — remover `span`; adicionar `sizeVariants`, `instantiable`, `configSchema`, `defaultConfig`, `GRID_CONFIG` |
| WGT-07 | `src/components/dashboards/DashboardGrid.tsx` (novo — substitui `DashboardWidgetRenderer.tsx`) — CSS Grid renderer com fallback sequencial em mobile |
| WGT-06 | `src/components/settings/DashboardGridEditor.tsx` (novo — substitui `DashboardLayoutEditor.tsx`) |
| WGT-06 | `src/components/settings/DashboardGridCanvas.tsx` (novo) |
| WGT-06 | `src/components/settings/WidgetPalette.tsx` (novo) |
| WGT-06 | `src/components/settings/WidgetConfigDialog.tsx` (novo) |
| WGT-09 | Remover: `PinnedAnalysesSection.tsx`, `settings/analyses/`, `saveSandboxAnalysisAction`, `togglePinAction`, `saveSandboxAnalysisSchema`, `togglePinSchema` |
| WGT-09 | Sandbox: substituir "Salvar/Fixar" por "Adicionar ao dashboard" com modal de seleção de contexto |
| Mensagens | `src/lib/messages/pt-BR.ts` — labels de variantes de tamanho, textos do editor de grade, "Adicionar ao dashboard", `dashboards.widgets.*` para widgets novos |
| Spec 28 | Registrar como requisito: comportamento responsivo completo dos dashboards em mobile |

### 7.1 Formato de persistência (StoredWidget)

```ts
// src/lib/schemas/dashboard-layout.ts
import { z } from "zod";

export const dashboardContextSchema = z.enum(["monthly", "yearly", "month_summary"]);

export const storedWidgetSchema = z.object({
  instanceId: z.string().min(1),
  widgetId: z.string().min(1),
  visible: z.boolean().default(true), // false = ghost no editor; não renderizado no dashboard
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  sizeVariantId: z.string().min(1),
  config: z.unknown().optional(), // validado contra o configSchema do widget no service
});

export const updateDashboardLayoutSchema = z.object({
  // accountId vem do ctx na action (multi-tenancy) — não incluso no body
  context: dashboardContextSchema,
  widgets: z.array(storedWidgetSchema),
});

export type StoredWidget = z.infer<typeof storedWidgetSchema>;
export type UpdateDashboardLayoutInput = z.infer<typeof updateDashboardLayoutSchema>;
```

### 7.2 `WidgetDef` e `GRID_CONFIG` estendidos

```ts
// src/components/dashboards/_core/widget-registry.ts

export type WidgetSizeVariant = {
  id: string;          // ex: 'default', 'compact', 'large'
  labelKey: string;    // chave i18n para nome da variante no editor
  w: number;           // largura em colunas (1–6)
  h: number;           // altura em linhas (≥1)
  renderMode: string;  // string opaca passada como prop ao componente
};

export type DashboardGridConfig = {
  cols: number;         // sempre 6
  initialRows: number;  // linhas exibidas ao abrir o editor
  maxRows: number;      // limite máximo de linhas
};

export type WidgetKind = "kpi" | "panel";
export type DashboardContext = "monthly" | "yearly" | "month_summary";

export type WidgetDef = {
  id: string;
  labelKey: string;
  kind: WidgetKind;
  // ❌ span removido — substituído por sizeVariants
  sizeVariants: WidgetSizeVariant[];  // sizeVariants[0] = variante default
  defaultVisible: boolean;
  instantiable?: boolean;             // default false = singleton
  configSchema?: z.ZodTypeAny;        // opcional para singletons com config; obrigatório para instantiable
  defaultConfig?: unknown;
};

export const GRID_CONFIG: Record<DashboardContext, DashboardGridConfig> = {
  monthly:       { cols: 6, initialRows: 10, maxRows: 12 },
  yearly:        { cols: 6, initialRows: 8,  maxRows: 12 },
  month_summary: { cols: 6, initialRows: 6,  maxRows: 10 },
};
```

### 7.3 Validação de `config` no service

O `configSchema` não pode ser embutido no Zod do layout (depende do `widgetId` em runtime). O service DEVE, por item:
1. Localizar o `WidgetDef` no registry do contexto.
2. Se `configSchema` estiver definido, validar `item.config` contra `def.configSchema` **antes** do upsert.
3. Itens com `widgetId` desconhecido ou `config` inválido: **rejeitar** (lançar `AppError`) — não descartar silenciosamente, para não perder configurações feitas no editor.

### 7.4 Mapeamento de widgets por contexto

| widgetId | monthly | yearly | month_summary | defaultVisible | instantiable |
|---|---|---|---|---|---|
| `kpi-month-total` | ✅ | ❌ | ❌ | true | false |
| `kpi-income` | ✅ | ✅ | ✅ | true | false |
| `kpi-expenses` | ✅ | ✅ | ✅ | true | false |
| `kpi-savings-rate` | ✅ | ✅ | ❌ | true | false |
| `kpi-top-category` | ✅ | ❌ | ❌ | true | false |
| `kpi-pending` | ✅ | ✅ | ❌ | true | false |
| `kpi-year-total` | ❌ | ✅ | ❌ | true | false |
| `kpi-monthly-avg` | ❌ | ✅ | ❌ | true | false |
| `kpi-best-month` | ❌ | ✅ | ❌ | true | false |
| `kpi-worst-month` | ❌ | ✅ | ❌ | true | false |
| `kpi-balance` | ❌ | ❌ | ✅ | true | false |
| `budgets` | ✅ | ❌ | ✅ | true | false |
| `section-cards` | ❌ | ❌ | ✅ | true | false |
| `activity-lists` | ❌ | ❌ | ✅ | true | false |
| `insights` | ✅ | ✅ | ✅ | **false** | false |
| `daily-heatmap` | ✅ | ❌ | ❌ | true | false |
| `category-treemap` | ✅ | ❌ | ❌ | true | false |
| `money-flow` | ✅ | ❌ | ❌ | true | false |
| `section-breakdown` | ✅ | ❌ | ❌ | true | false |
| `category-breakdown` | ✅ | ❌ | ❌ | true | false |
| `top-transactions` | ✅ | ❌ | ❌ | true | false |
| `month-card-grid` | ❌ | ✅ | ❌ | true | false |
| `monthly-bar-chart` | ❌ | ✅ | ❌ | true | false |
| `top-categories` | ❌ | ✅ | ❌ | true | false |
| `member-trend` | ❌ | ✅ | ❌ | **false** | false |
| `member-breakdown` | ✅ | ❌ | ❌ | **false** | false |
| `analysis` | ✅ | ✅ | ❌ | false | **true** |
| `kpi-custom` | ✅ | ✅ | ✅ | false | **true** |
| `filtered-transactions` | ❌ | ❌ | ✅ | false | **true** |

### 7.5 Renderização em CSS Grid

```tsx
// src/components/dashboards/DashboardGrid.tsx
// ✅ Correto — CSS Grid nativo via MUI Box; fallback sequencial em mobile
export function DashboardGrid({ widgets, nodeMap, cols }: DashboardGridProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const visibleWidgets = widgets.filter((w) => w.visible);

  if (isMobile) {
    // Ordena por y depois x — mantém a ordem lógica do layout
    const sorted = [...visibleWidgets].sort((a, b) => a.y - b.y || a.x - b.x);
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {sorted.map((w) => <Box key={w.instanceId}>{nodeMap[w.instanceId] ?? null}</Box>)}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: layout.cluster,
      }}
    >
      {visibleWidgets.map((w) => (
        <Box
          key={w.instanceId}
          sx={{
            gridColumn: `${w.x + 1} / span ${w.w}`,
            gridRow: `${w.y + 1} / span ${w.h}`,
          }}
        >
          {nodeMap[w.instanceId] ?? null}
        </Box>
      ))}
    </Box>
  );
}

// ❌ Anti-padrão — posicionamento absoluto com top/left ou calc()
```

### 7.6 Prop `renderMode` nos componentes de widget

```tsx
// src/components/dashboards/widgets/InsightsWidget.tsx
// ✅ Correto — componente adapta apresentação ao renderMode
type InsightsWidgetProps = {
  data: InsightItem[];
  renderMode: 'expanded' | 'default' | 'compact';
};

export function InsightsWidget({ data, renderMode }: InsightsWidgetProps) {
  if (renderMode === 'compact')  return <InsightsCompact items={data} />;
  if (renderMode === 'expanded') return <InsightsExpanded items={data} />;
  return <InsightsDefault items={data} />;
}

// ❌ Anti-padrão — usar w/h diretamente no componente para decidir apresentação
// (o componente não deve conhecer o grid; recebe apenas renderMode)

// ❌ Anti-padrão — variante maior que só infla espaçamento sem adicionar conteúdo
// sx={{ p: renderMode === 'expanded' ? 6 : 2 }}  // não acrescenta informação
```
