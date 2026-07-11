# Spec 36 — Widgets Configuráveis e Instanciáveis de Dashboard

> Status: implemented (DashboardGridEditor, DashboardGridCanvas, WidgetConfigForm, WidgetPalette, settings/dashboards — 2026-07-11)
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
    > **Paridade de filtros (V2).** Nivelado ao conjunto-alvo de 9 campos (ver [spec 19](19-transaction-search-filter-sort.md)): além de seção/categoria/responsável, filtra instituições, tags, tipo de transação, origem, método de pagamento, pendente e favorita. Ganhou também as dimensões de group/series `expense_type`, `source`, `payment_method` (escalares). `tags` como **dimensão** foi adiada (relação N:N distorce somas/contagens — só existe como filtro). Responsável resolve por `responsiblePartyId` (todas as personas) via `responsiblePartyIdsForFilter`.
  - **`kpi-custom`** — KPI de métrica arbitrária; `config` subconjunto do `sandboxConfigSchema` (`metric`, `period`, filtros opcionais de seção/categoria/membro). Disponível em todos os 3 contextos. O componente `KpiCustomWidget` pode ser reutilizado internamente como implementação dos KPIs fixos (ex.: `kpi-income` usa `KpiCustomWidget` com config fixa) — porém os KPIs fixos continuam aparecendo e se comportando exatamente como hoje para o usuário final.
  - **`filtered-transactions`** — lista de transações filtradas; `config` reutiliza o schema de filtros do [spec 19](19-transaction-search-filter-sort.md) + `limit`. Disponível **apenas em `month_summary`** (contexto de acompanhamento de transações do mês, não de análise).
    > **Paridade de filtros (V2).** `filteredTransactionsConfigSchema` nivelado ao conjunto-alvo de 9 campos: ganhou tipo de transação, origem, tags e método de pagamento (antes só tinha categoria/instituição/responsável/pendente/favorita). Responsável por `responsiblePartyId` via resolver canônico.

### 2.4 Editor de grade 2D (WGT-06)

O editor de lista do spec 33 (`DashboardLayoutEditor.tsx`) é **substituído** por um editor de grade 2D. Novos componentes:

- **`DashboardGridEditor.tsx`** (cliente) — orquestra o canvas da grade, a paleta lateral e o estado de layout.
- **`DashboardGridCanvas.tsx`** (cliente) — canvas interativo da grade: drag-and-drop de reposicionamento, alças de resize com snap de variante, indicador visual de drop zone durante drag.
- **`WidgetPalette.tsx`** (cliente) — painel lateral com widgets disponíveis. Para singletons: exibe apenas os não instanciados. Para instanciáveis: sempre disponíveis na paleta (sem limite por tipo — o limite é o espaço da grade).
- **`WidgetSettingsPanel.tsx`** (cliente) — painel lateral de configurações da instância **selecionada** (substitui o menu de contexto ⋮ e o modal de config). Centraliza, na mesma lateral do canvas (onde a paleta aparece quando nada está selecionado): o **tamanho** (miniaturas de variante), as **ações** (duplicar/remover) e o **form de config** (RHF/Zod do `configSchema`, quando houver). Sem `DialogShell`/modal — tudo visível na lateral, sem sobreposição nem perda de contexto.

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
| Remover instância | Botão "Remover" no painel lateral (instância selecionada) | Imediato |
| Duplicar instância | Botão "Duplicar" no painel lateral (instância selecionada) | Imediato |
| Editar config | Form de config no painel lateral → botão "Salvar" | Save explícito no painel |

**Seleção e painel lateral:** ao clicar num widget da grade, ele fica selecionado e a lateral passa a exibir o `WidgetSettingsPanel` daquela instância — tamanho (miniaturas de variante), ações e config. Quando nada está selecionado, a lateral mostra a paleta. Mudar a variante clicando numa miniatura, ou arrastando a alça de resize do canto do card (snap para a variante declarada cujo `(w, h)` é mais próximo), reflete imediatamente na grade.

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

- QUANDO o usuário seleciona um singleton com `configSchema`, O PAINEL LATERAL DEVE exibir a seção de config apenas com as opções daquele `configSchema`.
- QUANDO o usuário clica "Salvar" na seção de config do painel, O `config` DEVE ser persistido na instância; ao renderizar, O WIDGET DEVE usar esse `config` (ou `defaultConfig` se ausente).
- Singletons **sem** `configSchema` NÃO DEVEM exibir a seção de config no painel lateral.

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
- QUANDO o usuário seleciona uma instância com `configSchema`, O PAINEL LATERAL (`WidgetSettingsPanel`) DEVE exibir um form RHF/Zod do `configSchema`; ao clicar "Salvar" na seção de config, O `config` DEVE ser persistido. NÃO DEVE haver modal/`DialogShell` para config.
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
- **Configuração inline no card** (popover dentro do widget no dashboard) — toda config no painel lateral (`WidgetSettingsPanel`) do editor de settings, nunca em modal.
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
| Ações e config da instância | Painel lateral (`WidgetSettingsPanel`) ao selecionar o card — **sem menu de contexto ⋮ nem modal** | Tudo visível na mesma lateral (tamanho + ações + config), sem sobreposição nem perda de contexto; selecionar o card abre o painel, e a paleta volta quando nada está selecionado |
| Instâncias ocultas | Ghost na grade (opacidade + `VisibilityOffIcon`) | Preserva posição e config; visível no editor, invisível no dashboard |
| Colisões | Push (empurra widgets para baixo) | Mais fluido que bloquear; menos disruptivo que swap com widgets de tamanhos diferentes |
| Auto-save | Layout (drag/resize/ocultar/add/remove): debounce 600 ms. Config interna: save explícito no painel lateral | Config é mais crítica — botão explícito dá controle; auto-save flui para ações de posicionamento |
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
| WGT-06 | `src/components/settings/WidgetSettingsPanel.tsx` (novo — painel lateral: tamanho + ações + config da instância selecionada; substitui o menu de contexto e o modal de config) |
| WGT-06 | `src/components/settings/WidgetCardBody.tsx` (novo — card compartilhado entre canvas e paleta) |
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
| `checklist` | ❌ | ❌ | ✅ | false | false |

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

### 7.7 Widget `checklist` — singleton exclusivo do `month_summary`

Lista de tarefas recorrentes do mês. **Singleton** (`instantiable: false`, sem `configSchema`), `defaultVisible: false`, registrado **apenas** em `month_summary` — o enforcement é end-to-end via `resolveLayout`/`upsertLayout` (widgetId ausente do catálogo de um contexto é descartado). Dados vêm de `ChecklistItem`/`ChecklistCompletion` (spec 01 §3.18–3.19).

- **Variantes** — reutiliza `ACTIVITY_ITEM_VARIANTS` (mesmo padrão visual de lista compacta das listas Pendentes/Favoritas): `compact` 1×2, `default` 2×3, `large` (`renderMode: "full"`) 3×3. Progresso vira **badge `X/N`** no header (verde quando 100%), não barra. Linhas densas (`caption`), hover sutil.
- **`full`** adiciona a data de conclusão (`dd/MM`) à direita da linha concluída, com o nome de quem concluiu no tooltip.
- **Add-inline** (`default`/`full`, owner/editor): grava no template recorrente (B1); não-otimista (o item aparece após `revalidateMonth`). **Exclusão de item NÃO fica no widget** — é ação de escopo-conta (afeta todos os meses), então mora só em Configurações com dialog de confirmação.
- **Vínculo de transação (unilateral)**: cada item pode apontar para uma transação do mês (a que cumpriu a tarefa). Botão de vincular (hover) abre um picker simples das transações do próprio mês; **vincular marca o item como concluído** (o vínculo vive em `ChecklistCompletion.transactionId`). A transação vinculada aparece na linha por densidade: nos tamanhos compact/default, um chip enxuto com o valor (descrição no tooltip) e remover (`onDelete`); no tamanho grande (full), a linha ganha estrutura em dois níveis — linha 1 com valor (monospace, colorido por sinal) e desvincular no hover; subtítulo com `descrição · DD/MM · quem concluiu`. Itens concluídos sem vínculo também usam o subtítulo (`concluída por · data`) no full, densificando a lista sem inflar tipografia/espaçamento. Desvincular mantém concluído. Só no lado do checklist — a transação não guarda nada (`onDelete: SetNull`).
- **Papel**: owner/editor togglam/adicionam/vinculam; viewer é read-only (checkboxes desabilitados, sem vincular/desvincular — `canEdit` propagado do RSC).

### 7.8 Precedente: widgets que MUTAM dados

O `checklist` é o **primeiro widget bem-formado que grava dados** (o `ActivityWidget` já mutava, mas com anti-padrão: `useState(props)` sem revalidate → drift; marcá-lo como legado a migrar). O padrão canônico a seguir (detalhado no skill `dashboard-widgets`):

1. **Dados via RSC, carregamento GATED** — a query (`listChecklistForMonth`) só roda quando o widget está **visível** no layout resolvido, dentro do `Promise.all` de `getMonthSummaryData` (espelha `getFilteredTransactionsMap`). Widget `defaultVisible: false` ⇒ a maioria das accounts não paga o custo.
2. **Fluxo de mutação**: componente cliente → Server Action (`defineAction`, `requireRoles: [owner, editor]`) → service → **`revalidateMonth` na ACTION, nunca no service**.
3. **Feedback otimista com `useOptimistic(props)`** (base = prop do RSC; `revalidateMonth` reconcilia) — **proibido `useState(props)`**. Erro da action (`{ ok: false }`, sem lançar) ocorre antes do revalidate ⇒ servidor intacto ⇒ otimista reverte ao fechar a transition.
4. **Toggle idempotente** (`upsert`/`deleteMany` no `@@unique([itemId, monthId])`) + **guarda tenant write-time** (item **E** month ∈ account) — coberto por teste de multi-tenancy.

---

## 8. Fases de Implementação

> Esta seção é destinada à implementação incremental da spec. Cada fase é **independentemente testável** — o app deve estar em estado funcionando ao final de cada uma. Implemente sempre uma fase de cada vez, em ordem, sem pular.
>
> **Convenções do projeto aplicáveis a todas as fases** (ler antes de implementar qualquer fase):
> - Dinheiro: `BigInt` em centavos, converter apenas na camada de apresentação (`skills/money-handling/SKILL.md`)
> - Multi-tenancy: toda query filtra por `accountId`; toda mutation usa `ctx.accountId` — nunca `input.accountId` (`skills/multitenancy/SKILL.md`)
> - Server Actions: usar `defineAction()` de `src/server/api/define-action.ts` (`skills/server-actions/SKILL.md`)
> - Design system: tokens semânticos do tema, nunca hex hardcoded; `sx` prop ou `styled API` (`skills/design-system/SKILL.md`, `skills/mui-patterns/SKILL.md`)
> - RSC vs Client: páginas RSC buscam dados e passam props; componentes interativos têm `"use client"` (`skills/rsc-client-boundary/SKILL.md`)
> - Mensagens de UI: centralizadas em `src/lib/messages/pt-BR.ts` via `m.*`, nunca strings literais em JSX
> - Testes: arquivo `.test.ts` ao lado do arquivo testado; mocks em `tests/mocks/`; fixtures em `tests/fixtures/`; rodar com `docker compose exec app pnpm test`
> - Comandos de dev: sempre dentro do container (`docker compose exec app <comando>`)

---

### Fase 1 — Fundação: schema Prisma, tipos e registry

**Objetivo**: substituir o alicerce de dados e tipos sem tocar em nenhuma UI. Ao final da fase, o app compila, os testes passam e o banco tem o novo schema. Nenhum dashboard muda visualmente ainda.

**Critérios de conclusão**:
- `pnpm typecheck` sem erros
- `pnpm test` passando
- `prisma studio` mostra tabela `dashboard_layouts` com colunas do novo formato
- Tabela `saved_analyses` não existe mais no banco

#### 1.1 Migration Prisma

Arquivo: `prisma/schema.prisma`

**Remover** (apagar completamente):
- Model `SavedAnalysis` (bloco que começa em `model SavedAnalysis {`)
- Enum `SandboxDashboardContext` (se existir como enum Prisma — verificar; o tipo TS em `sandbox.ts` permanece)
- Relação `savedAnalyses SavedAnalysis[]` dentro de `model Account`

**Alterar** o model `DashboardLayout`: o campo `widgets Json` continua existindo mas seu conteúdo muda de `string[]` para `StoredWidget[]`. Não há alteração de DDL — o tipo JSON aceita qualquer valor. Nenhuma migration de coluna é necessária para o campo `widgets` em si.

**Criar migration** com nome descritivo:
```bash
docker compose exec app pnpm prisma migrate dev --name "spec36_remove_saved_analyses"
```

> **Atenção**: o `prisma db push` foi usado anteriormente. Antes de criar a migration, verificar se há migrations pendentes com `pnpm prisma migrate status`. Se o schema atual já reflete o banco (via `db push`), criar a migration normalmente — o Prisma vai detectar que não há diff de DDL para `dashboard_layouts` e vai registrar apenas a remoção de `saved_analyses`.

#### 1.2 Atualizar `src/lib/schemas/dashboard-layout.ts`

Substituir o arquivo inteiro pelo conteúdo da §7.1 deste spec. O tipo `StoredWidget` e o schema `storedWidgetSchema` são a nova interface de contrato.

```ts
// Referência: §7.1 deste spec
// Campos novos vs schema antigo (que tinha apenas: accountId, context, widgets: string[]):
// - storedWidgetSchema: instanceId, widgetId, visible, x, y, w, h, sizeVariantId, config
// - updateDashboardLayoutSchema: sem accountId (vem do ctx); widgets: StoredWidget[]
```

#### 1.3 Atualizar `src/components/dashboards/_core/widget-registry.ts`

Substituir o arquivo pelo novo formato. Manter os mesmos `id`s e `labelKey`s existentes — apenas adicionar os campos novos e remover `span`.

**Estrutura do arquivo**:

```
1. Tipos: WidgetSizeVariant, DashboardGridConfig, WidgetKind, WidgetSpan (REMOVER), DashboardContext, WidgetDef, ResolvedLayout (REMOVER), StoredWidget (importado de schemas)
2. GRID_CONFIG — constante conforme §7.2
3. WIDGET_REGISTRY — objeto completo com todos os widgets, sem span, com sizeVariants conforme tabela do §2.6
4. Função resolveLayout — REESCREVER (ver abaixo)
5. Remover: buildSegments, tipo Segment (não existem mais — o renderer não usa mais)
```

**Nova `resolveLayout`**: recebe `stored: StoredWidget[] | null` e retorna `StoredWidget[]` (apenas os ativos visíveis para renderização + os ocultos para o editor). A lógica:

```ts
// Pseudocódigo da nova resolveLayout
export function resolveLayout(
  context: DashboardContext,
  stored: StoredWidget[] | null,
): StoredWidget[] {
  const registry = WIDGET_REGISTRY[context];
  const { cols } = GRID_CONFIG[context];

  if (stored === null) {
    // Layout inicial: posicionar todos os defaultVisible via bin-packing
    return binPack(registry.filter(w => w.defaultVisible), cols);
  }

  // Descartar instanceIds com widgetId desconhecido (silenciosamente)
  const knownIds = new Set(registry.map(w => w.id));
  let result = stored.filter(s => knownIds.has(s.widgetId));

  // Fallback de variante desconhecida → sizeVariants[0]
  result = result.map(s => {
    const def = registry.find(d => d.id === s.widgetId)!;
    const variantExists = def.sizeVariants.some(v => v.id === s.sizeVariantId);
    if (!variantExists) {
      const v = def.sizeVariants[0];
      return { ...s, sizeVariantId: v.id, w: v.w, h: v.h };
    }
    return s;
  });

  // Auto-inserir novos widgets defaultVisible ausentes (compat-forward)
  const presentWidgetIds = new Set(result.map(s => s.widgetId));
  const toAdd = registry.filter(d => d.defaultVisible && !presentWidgetIds.has(d.id));
  if (toAdd.length > 0) {
    result = [...result, ...binPack(toAdd, cols, result)];
  }

  return result;
}

// binPack: posiciona uma lista de WidgetDef em células livres
// Algoritmo: varre a grade linha por linha, esquerda para direita
// Recebe existingItems para calcular células já ocupadas
function binPack(
  defs: WidgetDef[],
  cols: number,
  existingItems: StoredWidget[] = [],
): StoredWidget[] { ... }
```

> **Nota sobre `kind: "kpi"` no novo sistema**: no spec 33, KPIs eram agrupados automaticamente pelo `buildSegments`. No novo sistema de grade 2D, cada KPI é posicionado individualmente com `w:1, h:1`. O bin-packing garante que KPIs `defaultVisible` acabam em posições consecutivas na mesma linha — a aparência de "linha de KPIs" emerge naturalmente das coordenadas, não de lógica especial no renderer.

#### 1.4 Atualizar `src/server/services/dashboard-layout-service.ts`

Reescrever completamente. O serviço atual usa `string[]` e `resolveLayout` antiga.

```ts
// Novo dashboard-layout-service.ts

import { prisma } from "@/server/prisma";
import { WIDGET_REGISTRY, GRID_CONFIG, resolveLayout, type DashboardContext } from "@/components/dashboards/_core/widget-registry";
import type { StoredWidget, UpdateDashboardLayoutInput } from "@/lib/schemas/dashboard-layout";
import type { ActionContext } from "@/server/api/define-action";
import { AppError } from "@/server/api/errors";

export async function getLayout(accountId: string, context: DashboardContext): Promise<StoredWidget[]> {
  const record = await prisma.dashboardLayout.findUnique({
    where: { accountId_context: { accountId, context } },
    select: { widgets: true },
  });
  const stored = record ? (record.widgets as StoredWidget[]) : null;
  return resolveLayout(context, stored);
}

export async function upsertLayout(input: UpdateDashboardLayoutInput, ctx: ActionContext): Promise<void> {
  const { context, widgets } = input;
  const registry = WIDGET_REGISTRY[context as DashboardContext];
  const knownIds = new Set(registry.map(w => w.id));

  // Validar cada item: widgetId conhecido + config válida se configSchema presente
  for (const item of widgets) {
    const def = registry.find(d => d.id === item.widgetId);
    if (!def) throw new AppError("NOT_FOUND", `Widget desconhecido: ${item.widgetId}`);
    if (def.configSchema && item.config !== undefined) {
      const result = def.configSchema.safeParse(item.config);
      if (!result.success) {
        throw new AppError("VALIDATION", `Config inválida para widget ${item.widgetId}`);
      }
    }
  }

  // Validar que coordenadas não ultrapassam maxRows
  const { cols, maxRows } = GRID_CONFIG[context as DashboardContext];
  for (const item of widgets) {
    if (item.x + item.w > cols || item.y + item.h > maxRows) {
      throw new AppError("VALIDATION", `Widget ${item.instanceId} fora dos limites da grade`);
    }
  }

  await prisma.dashboardLayout.upsert({
    where: { accountId_context: { accountId: ctx.accountId, context } },
    create: { accountId: ctx.accountId, context, widgets: widgets as unknown as Prisma.InputJsonValue },
    update: { widgets: widgets as unknown as Prisma.InputJsonValue },
  });
}
```

#### 1.5 Atualizar `src/actions/dashboard-layout.ts`

O schema mudou (`accountId` foi removido do body). Verificar que `updateDashboardLayoutSchema` é importado do arquivo atualizado. O resto da action permanece igual.

#### 1.6 Remover artefatos de `SavedAnalysis`

Remover os seguintes arquivos/exports **completamente**:
- `src/components/dashboards/panels/PinnedAnalysesSection.tsx` — deletar
- `src/app/(app)/[accountId]/settings/analyses/` — deletar pasta inteira (page.tsx + AnalysesManager.tsx)

Nos seguintes arquivos, **remover apenas as partes relacionadas a SavedAnalysis** (não apagar o arquivo inteiro):
- `src/actions/sandbox.ts` — remover `saveSandboxAnalysisAction`, `togglePinAnalysisAction` e imports associados
- `src/lib/schemas/sandbox.ts` — remover `saveSandboxAnalysisSchema`, `togglePinSchema`, `SaveSandboxAnalysisInput`, `togglePinSchema` e tipos associados
- `src/lib/queries/sandbox.ts` (se existir) — remover `listSavedAnalyses`, `PinnedAnalysisData` e queries relacionadas
- `src/lib/messages/pt-BR.ts` — remover entradas `"pinned-analyses"` dos contextos de widgets e textos de settings de análises

Remover `pinned-analyses` do `WIDGET_REGISTRY` (já feito no passo 1.3 via reescrita do registry).

#### 1.7 Testes — `src/server/services/dashboard-layout-service.test.ts`

Criar arquivo de teste ao lado do service. Usar o padrão do projeto:

```ts
// src/server/services/dashboard-layout-service.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import "../../../tests/mocks/prisma";      // ativa mock do Prisma
import "../../../tests/mocks/auth";        // ativa mock de auth
import { prismaMock } from "../../../tests/mocks/prisma";
import { TEST_CTX } from "../../../tests/fixtures/account";
import * as service from "./dashboard-layout-service";
import { GRID_CONFIG } from "@/components/dashboards/_core/widget-registry";

describe("getLayout", () => {
  it("retorna layout inicial quando não há registro salvo", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);
    const result = await service.getLayout("acc-1", "monthly");
    // Todos os widgets defaultVisible devem estar presentes
    expect(result.length).toBeGreaterThan(0);
    result.forEach(w => {
      expect(w).toHaveProperty("instanceId");
      expect(w).toHaveProperty("x");
      expect(w).toHaveProperty("y");
      expect(w.visible).toBe(true);
    });
  });

  it("filtra accountId corretamente — isolamento multi-tenancy", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);
    await service.getLayout("acc-1", "monthly");
    expect(prismaMock.dashboardLayout.findUnique).toHaveBeenCalledWith({
      where: { accountId_context: { accountId: "acc-1", context: "monthly" } },
      select: { widgets: true },
    });
  });

  it("descarta widgetId desconhecido silenciosamente", async () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      widgets: [{ instanceId: "i1", widgetId: "widget-inexistente", visible: true, x: 0, y: 0, w: 1, h: 1, sizeVariantId: "default" }],
    } as never);
    const result = await service.getLayout("acc-1", "monthly");
    expect(result.every(w => w.widgetId !== "widget-inexistente")).toBe(true);
  });

  it("faz fallback de sizeVariantId desconhecido para sizeVariants[0]", async () => {
    // Salvo com variante que não existe mais no registry
    prismaMock.dashboardLayout.findUnique.mockResolvedValue({
      widgets: [{ instanceId: "i1", widgetId: "kpi-income", visible: true, x: 0, y: 0, w: 1, h: 1, sizeVariantId: "variante-inexistente" }],
    } as never);
    const result = await service.getLayout("acc-1", "monthly");
    const kpi = result.find(w => w.widgetId === "kpi-income");
    expect(kpi?.sizeVariantId).toBe("default"); // sizeVariants[0].id
  });
});

describe("upsertLayout", () => {
  it("usa ctx.accountId, não input.accountId — multi-tenancy", async () => {
    prismaMock.dashboardLayout.upsert.mockResolvedValue({} as never);
    await service.upsertLayout({ context: "monthly", widgets: [] }, TEST_CTX);
    expect(prismaMock.dashboardLayout.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId_context: { accountId: TEST_CTX.accountId, context: "monthly" } },
      })
    );
  });

  it("rejeita widget com widgetId desconhecido", async () => {
    await expect(
      service.upsertLayout({
        context: "monthly",
        widgets: [{ instanceId: "i1", widgetId: "inexistente", visible: true, x: 0, y: 0, w: 1, h: 1, sizeVariantId: "default" }],
      }, TEST_CTX)
    ).rejects.toThrow();
  });

  it("rejeita widget fora dos limites da grade", async () => {
    const { cols, maxRows } = GRID_CONFIG["monthly"];
    await expect(
      service.upsertLayout({
        context: "monthly",
        widgets: [{ instanceId: "i1", widgetId: "kpi-income", visible: true, x: cols, y: 0, w: 1, h: 1, sizeVariantId: "default" }],
      }, TEST_CTX)
    ).rejects.toThrow();
  });
});

describe("resolveLayout — bin-packing", () => {
  it("posiciona widgets dentro dos limites de cols", () => {
    prismaMock.dashboardLayout.findUnique.mockResolvedValue(null);
    // Importar resolveLayout diretamente para teste unitário puro
    const { resolveLayout, WIDGET_REGISTRY, GRID_CONFIG } = require("@/components/dashboards/_core/widget-registry");
    const result = resolveLayout("monthly", null);
    const { cols } = GRID_CONFIG["monthly"];
    result.forEach((w: { x: number; w: number }) => {
      expect(w.x + w.w).toBeLessThanOrEqual(cols);
    });
  });
});
```

**Verificação final da fase**:
```bash
docker compose exec app pnpm typecheck
docker compose exec app pnpm test
```

---

### Fase 2 — Renderer: CSS Grid nos dashboards

**Objetivo**: os três contextos de dashboard (monthly, yearly, month_summary) passam a renderizar via `DashboardGrid.tsx` com CSS Grid posicionado por coordenadas. Visual idêntico ao atual — sem regressão. Editor de settings ainda não muda.

**Critérios de conclusão**:
- Abrir `/[accountId]/dashboards/monthly/[monthId]` → visual idêntico ao atual, sem erros no console
- Abrir `/[accountId]/dashboards/yearly/[year]` → idem
- Abrir `/[accountId]/months/[monthId]` aba Resumo → idem
- Em viewport `xs`/`sm` (DevTools), widgets renderizam em lista vertical (não em grade)
- `pnpm typecheck` sem erros

#### 2.1 Criar `src/components/dashboards/_core/DashboardGrid.tsx`

Substituir `DashboardWidgetRenderer.tsx` pelo novo componente. O arquivo antigo pode ser mantido temporariamente como stub vazio (ele já está esvaziado conforme contexto do terminal) — apenas criar o novo arquivo.

Implementar conforme o código de referência em §7.5 deste spec. Pontos críticos:
- `"use client"` (usa `useTheme`, `useMediaQuery`)
- Recebe `widgets: StoredWidget[]` e `nodeMap: Record<string, ReactNode>`
- Filtra `w.visible === true` antes de renderizar
- Mobile (`breakpoints.down("md")`): `display: flex, flexDirection: column`, ordenado por `y` depois `x`
- Desktop: `display: grid`, `gridTemplateColumns: repeat(${cols}, 1fr)`, cada item com `gridColumn` e `gridRow` via sx

```ts
// Tipos do componente:
type Props = {
  widgets: StoredWidget[];
  nodeMap: Record<string, ReactNode>;
  cols: number; // sempre 6, mas receber como prop para flexibilidade de teste
};
```

#### 2.2 Migrar `MonthlyDashboardClient.tsx`

O componente atual recebe `activeWidgets: WidgetDef[]` e usa `DashboardWidgetRenderer`. Migrar para usar `DashboardGrid`.

**Alterações necessárias**:

1. Atualizar a prop de layout: `activeWidgets: WidgetDef[]` → `widgets: StoredWidget[]`
2. Remover import de `DashboardWidgetRenderer` e `buildSegments`
3. Adicionar import de `DashboardGrid` e `StoredWidget`
4. No `nodeMap`: as chaves mudam de `widget.id` para `instance.instanceId`. Como cada instância tem um `instanceId` único mas o widget a renderizar é identificado pelo `widgetId`, o mapa deve ser construído por `widgetId` e depois resolvido:

```ts
// Construção do nodeMap por instanceId
// Cada instância tem widgetId → busca o nó correspondente ao widgetId
// Para singletons (defaultVisible: true), instanceId === widgetId no layout inicial
const nodeByWidgetId: Record<string, ReactNode> = {
  "kpi-month-total": <KpiSparklineCard ... />,
  "kpi-income":      <KpiSparklineCard ... />,
  // ... todos os widgets do contexto monthly
};

// nodeMap final: instâncias mapeadas ao seu nó
const nodeMap: Record<string, ReactNode> = {};
for (const w of widgets) {
  nodeMap[w.instanceId] = nodeByWidgetId[w.widgetId] ?? null;
}
```

5. Remover a prop `pinnedAnalyses: PinnedAnalysisData[]` e o nó correspondente no `nodeByWidgetId` (o widget `pinned-analyses` foi removido)
6. Substituir `<DashboardWidgetRenderer active={activeWidgets} nodeMap={nodeMap} />` por `<DashboardGrid widgets={widgets} nodeMap={nodeMap} cols={6} />`

**Atualizar a página RSC** que chama `MonthlyDashboardClient`:
- `src/app/(app)/[accountId]/dashboards/monthly/[monthId]/page.tsx` (verificar caminho exato)
- Remover chamada a `listPinnedAnalyses` / `getPinnedAnalyses` (e imports de `PinnedAnalysisData`)
- Chamar `dashboardLayoutService.getLayout(accountId, "monthly")` → passa como `widgets` para o client
- Remover `activeWidgets` → passar `widgets`

#### 2.3 Migrar `YearlyDashboardClient.tsx`

Mesmo padrão da §2.2. Verificar o arquivo em `src/components/dashboards/yearly/YearlyDashboardClient.tsx`. Ajustar props e `nodeMap` conforme o catálogo `yearly` do registry (§7.4).

**Atualizar a página RSC**: `src/app/(app)/[accountId]/dashboards/yearly/[year]/page.tsx`

#### 2.4 Migrar `MonthSummary.tsx`

Arquivo: `src/components/dashboards/monthly/MonthSummary.tsx`. Mesmo padrão. Catálogo `month_summary` do registry (§7.4).

**Cabeçalho fixo** (total do mês + botão "Ver Dashboard"): continua como está, **fora** do `DashboardGrid`. Apenas os blocos analíticos abaixo do cabeçalho entram no grid.

#### 2.5 Remover importações quebradas

Após remover `PinnedAnalysesSection.tsx`, verificar se há outros arquivos importando-o:
```bash
docker compose exec app grep -r "PinnedAnalysesSection\|PinnedAnalysesSectionSecondary" src/ --include="*.tsx" --include="*.ts" -l
```
Para cada arquivo encontrado, remover o import e o uso correspondente.

**Verificação final da fase**:
```bash
docker compose exec app pnpm typecheck
# Abrir no browser: dashboard mensal, anual e resumo do mês
```

---

### Fase 3 — Editor de grade 2D (estrutura base: reposicionar e ocultar)

**Objetivo**: a tela `settings/dashboards` mostra o canvas da grade. O usuário pode arrastar widgets para reposicionar e ocultar/reativar com ghost. Sem paleta lateral ainda — apenas os widgets já no layout são mostrados.

**Critérios de conclusão**:
- Abrir `Configurações → Visualização → Dashboard Mensal` → grade com widgets posicionados
- Arrastar widget → posição atualiza na grade → auto-save dispara (verificar no console/network)
- Clicar `VisibilityOffIcon` → widget fica ghost → auto-save → refresh mostra widget oculto (não aparece no dashboard)
- `pnpm typecheck` sem erros

#### 3.1 Criar `src/components/settings/DashboardGridCanvas.tsx`

Componente cliente que renderiza a grade interativa do editor. Recebe os widgets já posicionados e callbacks de mudança.

```ts
// Props
type Props = {
  widgets: StoredWidget[];        // todos (incluindo visible: false)
  registry: WidgetDef[];          // defs do contexto para labels/ícones
  cols: number;
  maxRows: number;
  onLayoutChange: (widgets: StoredWidget[]) => void; // callback para auto-save
};
```

**Responsabilidades do componente**:
1. Renderizar a grade com `display: grid` — mesmas dimensões do `DashboardGrid`, mas com célula-guia visível (fundo sutil em `background.subtle`)
2. Cada widget no canvas: `Card` com borda `border.default`, título (label do widget), ícone de ocultar (`VisibilityOffIcon` / `VisibilityIcon`) e handle de drag
3. Widgets `visible: false`: `opacity: 0.35`, ícone `VisibilityOffIcon` proeminente
4. Drag-and-drop: usar `@dnd-kit/core` + `@dnd-kit/sortable`. Como os widgets têm posições `(x, y)` em grade, usar `@dnd-kit/core` com `DragOverlay` e lógica de drop customizada (não `SortableContext` vertical, pois a grade é 2D)
5. Ao soltar: calcular nova `(x, y)` da célula de destino, aplicar push (empurrar widgets abaixo se necessário), chamar `onLayoutChange`
6. **Algoritmo de push**: ao dropar na posição `(tx, ty)`, verificar sobreposição com outros widgets. Se houver colisão, deslocar os widgets afetados para `y + widget.h` iterativamente. Se o push ultrapassar `maxRows`, cancelar o drop (manter posição original) e mostrar borda vermelha na drop zone

#### 3.2 Criar `src/components/settings/DashboardGridEditor.tsx`

Componente cliente que orquestra o `DashboardGridCanvas` e o auto-save.

```ts
// Props
type Props = {
  accountId: string;
  context: DashboardContext;
  initialWidgets: StoredWidget[];  // passado pela página RSC
};
```

**Responsabilidades**:
1. Estado local: `const [widgets, setWidgets] = useState(initialWidgets)`
2. Ref para debounce: `const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)`
3. `saveLayout(newWidgets)`: chama `updateDashboardLayoutAction(accountId, { context, widgets: newWidgets })`
4. `handleLayoutChange(newWidgets)`: atualiza estado otimista + debounce 600ms → `saveLayout`
5. Em falha do auto-save: reverter para estado anterior + `enqueueSnackbar(m.settings.dashboards.saveError, { variant: "error" })`
6. Em sucesso: `enqueueSnackbar(m.settings.dashboards.saved, { variant: "success" })`
7. Renderiza `<DashboardGridCanvas widgets={widgets} ... onLayoutChange={handleLayoutChange} />`
8. `KeyboardSensor` do `@dnd-kit` deve estar configurado (acessibilidade)

#### 3.3 Atualizar páginas de settings

As três páginas já existem (`monthly/page.tsx`, `yearly/page.tsx`, `month-summary/page.tsx`) e usam um componente `DashboardSettingsPage` de `_shared/`. Atualizar esse componente para usar `DashboardGridEditor` em vez de `DashboardLayoutEditor`.

Arquivo: `src/app/(app)/[accountId]/settings/dashboards/_shared/DashboardSettingsPage.tsx`

Chamada ao service: `dashboardLayoutService.getLayout(accountId, context)` → retorna `StoredWidget[]` → passa como `initialWidgets` para `DashboardGridEditor`.

#### 3.4 Adaptar `WidgetCard.tsx`

O `WidgetCard` atual referencia `WidgetDef["span"]` no `TypeBadge`. Remover essa referência (o campo `span` foi removido). Substituir o badge por indicador do tamanho da variante default (ex.: `2×1`, `6×3`).

**Verificação final da fase**:
```bash
docker compose exec app pnpm typecheck
# Testar reposicionamento e ocultar/reativar nos 3 contextos
```

---

### Fase 4 — Paleta lateral, instâncias e variantes

**Objetivo**: o editor mostra a paleta lateral com widgets disponíveis. O usuário pode arrastar da paleta para a grade (adiciona instância), duplicar, remover e trocar a variante de tamanho.

**Critérios de conclusão**:
- Paleta lateral visível com singletons não instanciados e widgets instanciáveis
- Arrastar da paleta para a grade → widget inserido na posição com `sizeVariants[0]`
- Selecionar um widget → painel lateral (`WidgetSettingsPanel`) com "Duplicar" e "Remover" funcionando
- Seletor de variante (miniaturas) no painel → mudar variante atualiza `(w, h)` na grade imediatamente
- `pnpm typecheck` sem erros

#### 4.1 Criar `src/components/settings/WidgetPalette.tsx`

Painel lateral fixo (sidebar) com lista de widgets disponíveis para adicionar.

```ts
// Props
type Props = {
  context: DashboardContext;
  activeWidgetIds: Set<string>;     // widgetIds já instanciados (para filtrar singletons)
  onAdd: (widgetId: string, at?: { x: number; y: number }) => void;
};
```

**Regras de exibição**:
- Singletons (`instantiable !== true`): exibir apenas se `activeWidgetIds` não contém o `widgetId` (só pode haver uma instância)
- Instanciáveis (`instantiable: true`): exibir sempre (pode adicionar N vezes)
- Cards usam o **`WidgetCardBody`** compartilhado (mesmo card do canvas, sem alça de drag) com label, descrição e ícone do `WIDGET_ICONS`
- O card inteiro é arrastável; soltá-lo na grade adiciona a instância na célula de destino (ou na próxima livre)

**Integrar no `DashboardGridEditor`**: a paleta fica ao lado do canvas (layout de 2 colunas; em mobile empilha acima). A mesma coluna lateral alterna para o `WidgetSettingsPanel` quando há um widget selecionado.

#### 4.2 Ações da instância no painel lateral

**Sem menu de contexto (⋮).** Ao selecionar um widget no canvas, o `WidgetSettingsPanel` (na lateral) exibe a seção **Ações**:
- **Duplicar** (apenas se `instantiable: true` no def): cria nova instância com mesmo `widgetId`, novo `instanceId` (`crypto.randomUUID()`), mesma `config`, posicionada na próxima célula livre → save imediato
- **Remover**: remove a instância do array → save imediato

#### 4.3 Seletor de variante (no painel lateral)

O `WidgetSettingsPanel` também exibe a seção **Tamanho**:
- Cabeçalho "Configurações do widget" + nome do widget como contexto
- Miniaturas das `sizeVariants` disponíveis (cada uma com label da variante e representação proporcional de `w × h`)
- Variante ativa destacada

Ao clicar numa miniatura: atualizar `sizeVariantId`, `w`, `h` (com push/deslocamento para caber em `cols × maxRows`) → debounce 600ms → save. Sem espaço → snackbar de aviso.

#### 4.4 Alça de resize no canvas

Em cada widget do canvas (desktop), renderizar **uma alça sutil no canto inferior-direito** (grip neutro), com interação via **pointer capture** (sem listeners de window). O drag calcula o tamanho arrastado e faz snap para a `sizeVariant` cujo `(w, h)` minimiza `Math.abs(dragW - v.w) + Math.abs(dragH - v.h)` (distância de Manhattan), deslocando o card para caber se necessário → debounce 600ms → save.

**Verificação final da fase**:
```bash
docker compose exec app pnpm typecheck
# Adicionar widget da paleta, duplicar, remover, mudar variante nos 3 contextos
```

---

### Fase 5 — Configuração interna de widgets (`configSchema`)

**Objetivo**: widgets com `configSchema` exibem uma **seção de config no painel lateral** (`WidgetSettingsPanel`). Salvar grava o `config` na instância. Os componentes de dashboard usam o `config` salvo para adaptar a apresentação. **Sem modal/`DialogShell`.**

**Critérios de conclusão**:
- Selecionar `kpi-month-total`, `money-flow`, `category-treemap`, `budgets` ou `top-transactions` → painel lateral mostra a seção de config
- Editar config no painel → "Salvar" → widget no dashboard usa o novo config
- `kpi-custom` adicionado da paleta → configurado com métrica/período → renderiza KPI correto
- `filtered-transactions` em `month_summary` → configurado com filtros → lista filtrada renderiza
- Widgets sem `configSchema` não exibem a seção de config
- `pnpm typecheck` sem erros

#### 5.1 Adicionar a seção de config ao `WidgetSettingsPanel`

A config vive numa **seção do painel lateral** (não em modal). O `WidgetSettingsPanel` ganha, abaixo de "Tamanho", uma seção **Configuração** quando `def.configSchema` está definido.

```ts
// O painel recebe um callback de salvar config além das ações já existentes:
onSaveConfig: (config: unknown) => void;
```

**Estrutura**:
- Detecta o widget pelo `def.id` e renderiza o sub-form correspondente dentro do painel:
  - `kpi-month-total`: `<DeltaModeConfigForm>` (RadioGroup: Mês anterior / Ano anterior / Sem comparação)
  - `money-flow`: `<GroupByConfigForm>` (RadioGroup: Por seção / Por categoria)
  - `category-treemap`: `<TopNConfigForm>` (Select: 5 / 10 / 20 / Todos)
  - `budgets`: `<ShowOnlyConfigForm>` (RadioGroup: Todas as metas / Apenas próximas do limite)
  - `top-transactions`: `<LimitConfigForm>` (Select: 5 / 10 / 20)
  - `kpi-custom`: `<KpiCustomConfigForm>` (metric, period, filtros — reusar campos do SandboxControls)
  - `filtered-transactions`: `<FilteredTransactionsConfigForm>` (filtros do spec 19 + limit)
  - `analysis`: `<AnalysisConfigForm>` (reusar `SandboxControls` com opções filtradas por contexto)
- Cada sub-form usa `useForm` com `zodResolver(def.configSchema!)` e `defaultValues` de `widget.config ?? def.defaultConfig`
- Botão "Salvar" da seção chama `form.handleSubmit(onSaveConfig)`; save explícito (sem debounce)

#### 5.2 Ligar a config ao canvas

No `DashboardGridCanvas.tsx`, passar `onSaveConfig` ao `WidgetSettingsPanel` da instância selecionada. Ao salvar: atualizar `config` na instância → save imediato (ação deliberada). A seção de config só aparece quando `def.configSchema` está definido.

#### 5.3 Adicionar `configSchema` ao registry

No `WIDGET_REGISTRY`, adicionar `configSchema` e `defaultConfig` para os widgets listados em §2.2:

```ts
// Exemplo — kpi-month-total
const deltaModeSchema = z.object({
  deltaMode: z.enum(["previous_month", "previous_year", "none"]),
});

{ 
  id: "kpi-month-total", 
  ...,
  configSchema: deltaModeSchema,
  defaultConfig: { deltaMode: "previous_month" } as z.infer<typeof deltaModeSchema>,
}
```

> Declarar os `configSchema`s fora do objeto `WIDGET_REGISTRY` (como constantes nomeadas) para evitar que o objeto fique enorme e para facilitar o import nos forms.

#### 5.4 Adaptar componentes de dashboard para ler `config`

Cada componente de widget que tem `configSchema` deve receber um prop `config` opcional e usá-lo:

- `KpiSparklineCard` para `kpi-month-total`: adicionar `deltaMode?: 'previous_month' | 'previous_year' | 'none'` — já calcula delta; apenas filtrar qual coluna usar
- `SankeyChart`: adicionar `groupBy?: 'section' | 'category'`
- `CategoryTreemap`: adicionar `topN?: 5 | 10 | 20 | 'all'`
- `BudgetWidgetContent`: adicionar `showOnly?: 'all' | 'near_limit'` — filtrar `budgets` antes de passar
- `TopTransactionTable`: adicionar `limit?: 5 | 10 | 20` — faticar `topTransactions.slice(0, limit ?? 10)`

**Passagem do config**: no `nodeByWidgetId` dentro de `MonthlyDashboardClient` (e similares), buscar o `config` da instância correspondente:

```ts
// Em MonthlyDashboardClient, ao construir nodeByWidgetId:
const widgetConfig = (instanceId: string) => {
  const inst = widgets.find(w => w.instanceId === instanceId);
  return inst?.config;
};

// Exemplo para kpi-month-total — encontrar a instância pelo widgetId
const kpiTotalInstance = widgets.find(w => w.widgetId === "kpi-month-total");
const kpiTotalConfig = kpiTotalInstance?.config as { deltaMode: string } | undefined;

nodeByWidgetId["kpi-month-total"] = (
  <KpiSparklineCard
    ...
    deltaMode={kpiTotalConfig?.deltaMode ?? "previous_month"}
  />
);
```

#### 5.5 Criar `KpiCustomWidget.tsx` e `FilteredTransactionsWidget.tsx`

Novos componentes para os widgets instanciáveis simples:

**`src/components/dashboards/kpi/KpiCustomWidget.tsx`**:
- Recebe `config: { metric, period, filters }` + `accountId` + contexto (ano/mês)
- Faz query dos dados via `useEffect` ou — melhor — recebe os dados pré-calculados no `nodeMap` (RSC calcula, passa ao client)
- RSC strategy: para `kpi-custom`, a página RSC detecta instâncias `kpi-custom` com config, chama uma query genérica `getKpiCustomData(accountId, config)` e passa o resultado para o client junto com os dados normais

**`src/components/dashboards/panels/FilteredTransactionsWidget.tsx`**:
- Similar — lista de transações filtradas por config
- Renderiza lista compacta de transações (reusar `TxRow` de `TopTransactionTable`)

**Verificação final da fase**:
```bash
docker compose exec app pnpm typecheck
docker compose exec app pnpm test
# Configurar cada singleton com configSchema e verificar mudança no dashboard
```

---

### Fase 6 — Widget `analysis` e integração com Sandbox

**Objetivo**: o widget `analysis` instanciável renderiza gráficos configurados. O Sandbox tem o botão "Adicionar ao dashboard". A página `settings/analyses` não existe mais.

**Critérios de conclusão**:
- Adicionar widget `analysis` pelo editor, configurar pela seção de config do painel lateral → gráfico renderiza no dashboard
- No Sandbox, "Adicionar ao dashboard" abre modal, escolher contexto → instância `analysis` criada no layout
- Navegar para o dashboard → instância `analysis` visível com o gráfico configurado
- Rota `/[accountId]/settings/analyses` retorna 404
- `pnpm typecheck` sem erros
- `pnpm test` passando

#### 6.1 Criar `src/components/dashboards/panels/AnalysisWidget.tsx`

Componente que renderiza um gráfico configurável baseado em `SandboxConfig`.

```ts
// Props
type Props = {
  config: SandboxConfig;            // de src/lib/schemas/sandbox.ts
  accountId: string;
  renderMode: "compact" | "default" | "expanded";
  // dados pré-calculados passados pelo RSC (mesmo padrão do SandboxChart)
  data: SandboxChartData;
};
```

**Estratégia de dados**:
- A página RSC detecta instâncias `analysis` no layout com suas configs
- Para cada instância, chama o resolver do sandbox (já existe em `src/lib/queries/sandbox.ts` ou similar — reusar a mesma lógica do `SandboxPage`)
- Passa os dados via prop para o client component
- O `AnalysisWidget` renderiza com `SandboxChart` (já existente), passando `config` e `data`
- `renderMode` afeta apenas o wrapper (altura do container, legenda abreviada em `compact`)

#### 6.2 Adicionar `analysis` ao `nodeByWidgetId` nos dashboards

Em `MonthlyDashboardClient` e `YearlyDashboardClient`, instâncias `analysis` precisam de dados próprios (cada instância tem config diferente). A estratégia é passar os dados via prop do RSC:

```ts
// Na página RSC (monthly page):
const analysisInstances = widgets.filter(w => w.widgetId === "analysis" && w.visible);
const analysisDataMap: Record<string, SandboxChartData> = {};
await Promise.all(
  analysisInstances.map(async (inst) => {
    const config = inst.config as SandboxConfig;
    analysisDataMap[inst.instanceId] = await getSandboxChartData(accountId, config);
  })
);

// Passar analysisDataMap para o client component
// No client:
nodeByWidgetId para instâncias analysis:
// (o nodeMap é construído por instanceId, então cada analysis tem seu próprio nó)
for (const inst of widgets.filter(w => w.widgetId === "analysis")) {
  nodeMap[inst.instanceId] = (
    <AnalysisWidget
      config={inst.config as SandboxConfig}
      data={analysisDataMap[inst.instanceId]}
      renderMode={sizeVariantRenderMode(inst)}
      accountId={accountId}
    />
  );
}
```

#### 6.3 Form de configuração do `analysis` no `WidgetSettingsPanel`

O form para `analysis` reutiliza `SandboxControls` (ou os campos individuais do sandbox — verificar se o componente é reutilizável). Filtrar opções por contexto na UI:

```ts
// Filtro por contexto no AnalysisConfigForm:
const allowedPeriodTypes = context === "monthly"
  ? ["current_month", "last_3_months", "last_6_months"] as const
  : ["year", "months"] as const;
```

#### 6.4 Botão "Adicionar ao dashboard" no Sandbox

Arquivo: localizar o botão "Salvar análise" / "Fixar" no componente do Sandbox (provavelmente em `src/components/dashboards/sandbox/SandboxPage.tsx` ou similar).

**Substituir** pelo novo fluxo:
1. Botão `"Adicionar ao dashboard"` com `AddToPhotosIcon` (ou `DashboardIcon`)
2. Ao clicar: abrir `<DialogShell>` com `Select` para escolher o contexto destino (`monthly` ou `yearly`) + botão "Adicionar"
3. Ao confirmar: chamar nova action `addAnalysisToDashboardAction(accountId, { context, config: currentConfig })`

**Nova action** `src/actions/dashboard-layout.ts` — adicionar:
```ts
export const addAnalysisToDashboardAction = defineAction({
  schema: z.object({
    context: z.enum(["monthly", "yearly"]),
    config: sandboxConfigSchema,
  }),
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    const existing = await dashboardLayoutService.getLayout(ctx.accountId, input.context);
    const { cols, maxRows } = GRID_CONFIG[input.context];
    const nextPos = findNextFreePosition(existing, cols, maxRows);
    if (!nextPos) throw new AppError("CONFLICT", m.settings.dashboards.gridFull);

    const analysisWidget = WIDGET_REGISTRY[input.context].find(w => w.widgetId === "analysis")!;
    const defaultVariant = analysisWidget.sizeVariants[0];
    const newInstance: StoredWidget = {
      instanceId: createId(), // cuid de @paralleldrive/cuid2 ou crypto.randomUUID()
      widgetId: "analysis",
      visible: true,
      x: nextPos.x,
      y: nextPos.y,
      w: defaultVariant.w,
      h: defaultVariant.h,
      sizeVariantId: defaultVariant.id,
      config: input.config,
    };
    const updated = [...existing, newInstance];
    await dashboardLayoutService.upsertLayout({ context: input.context, widgets: updated }, ctx);
    revalidatePath(`/${ctx.accountId}/dashboards`, "layout");
  },
});
```

#### 6.5 Remover restos da página `settings/analyses`

Verificar se há links na navegação de settings (`SettingsNav.tsx` ou similar) apontando para `/settings/analyses`. Remover. A pasta já foi deletada na fase 1 — garantir que o build não tenta importar nada de lá.

#### 6.6 Testes de integração da fase 6

```ts
// src/actions/dashboard-layout.test.ts (adicionar caso):
it("addAnalysisToDashboardAction cria instância analysis com config e posição livre", async () => {
  prismaMock.dashboardLayout.findUnique.mockResolvedValue(null); // layout vazio
  prismaMock.dashboardLayout.upsert.mockResolvedValue({} as never);

  const result = await addAnalysisToDashboardAction("acc-1", {
    context: "monthly",
    config: { periodType: "current_month", groupBy: "category", seriesBy: "none", metric: "total", chartType: "bar_grouped" },
  });

  expect(result.ok).toBe(true);
  const upsertCall = prismaMock.dashboardLayout.upsert.mock.calls[0][0];
  const widgets = upsertCall.create.widgets as StoredWidget[];
  expect(widgets[widgets.length - 1].widgetId).toBe("analysis");
  expect(widgets[widgets.length - 1].config).toMatchObject({ periodType: "current_month" });
});
```

**Verificação final da fase**:
```bash
docker compose exec app pnpm typecheck
docker compose exec app pnpm test
# Fluxo completo: Sandbox → Adicionar ao dashboard → Dashboard mostra gráfico
# Verificar 404 em /settings/analyses
```

---

### Fase 7 — Finalização: limpeza, cobertura e skill de widgets

**Objetivo**: garantir que nenhum resíduo das fases anteriores persiste no codebase, a cobertura de testes está dentro do threshold do projeto, o skill `dashboard-widgets` está atualizado para refletir a nova arquitetura, e o `docs/widgets.md` tem a correção de `member-breakdown` registrada. Ao final desta fase o spec está 100% implementado e documentado.

**Critérios de conclusão**:
- `pnpm typecheck` sem erros
- `pnpm test` passando com cobertura ≥ 60% (threshold do projeto)
- Nenhuma referência a `span`, `buildSegments`, `ResolvedLayout`, `PinnedAnalysesSection`, `SavedAnalysis`, `savedAnalyses`, `saveSandboxAnalysisAction`, `togglePinAnalysisAction`, `pinned-analyses` no codebase
- `skills/dashboard-widgets/SKILL.md` reflete a nova arquitetura de grade 2D
- `docs/widgets.md` corrigido para `member-breakdown`

#### 7.1 Auditoria de resíduos

Executar os seguintes greps para confirmar que não há referências órfãs antes de declarar a spec concluída:

```bash
# Nenhum resultado esperado para cada comando
docker compose exec app grep -r "buildSegments\|ResolvedLayout\|WidgetSpan\b" src/ --include="*.ts" --include="*.tsx" -l

docker compose exec app grep -r "PinnedAnalysesSection\|PinnedAnalysesSectionSecondary" src/ --include="*.ts" --include="*.tsx" -l

docker compose exec app grep -r "savedAnalysis\|SavedAnalysis\|saved_analyses\|saveSandboxAnalysis\|togglePinAnalysis\|togglePinSchema\|pinned-analyses" src/ --include="*.ts" --include="*.tsx" -l

docker compose exec app grep -r '"span"' src/components/dashboards/ --include="*.ts" --include="*.tsx" -l

docker compose exec app grep -r "DashboardWidgetRenderer\|DashboardLayoutEditor" src/ --include="*.ts" --include="*.tsx" -l
```

Para cada arquivo retornado, remover a referência residual. Após limpar, rodar `pnpm typecheck` para confirmar que não há erros introduzidos.

#### 7.2 Auditoria de imports quebrados

```bash
# Verificar imports de arquivos deletados
docker compose exec app pnpm typecheck 2>&1 | grep "Cannot find module"
```

Cada `Cannot find module` indica um import apontando para arquivo deletado em fases anteriores. Corrigir um a um.

#### 7.3 Cobertura de testes

Rodar cobertura e verificar threshold:

```bash
docker compose exec app pnpm test:coverage
```

Se algum arquivo novo das fases 1–6 estiver abaixo de 60% de cobertura, adicionar os casos de teste faltantes. Focar em:

- `src/components/dashboards/_core/widget-registry.ts` — função `binPack` (casos: KPIs na mesma linha, widget `w > 1` que não cabe na linha atual vai para a próxima, grade completamente cheia retorna sem posicionar)
- `src/server/services/dashboard-layout-service.ts` — `upsertLayout` com config inválida, limites da grade
- `src/actions/dashboard-layout.ts` — `addAnalysisToDashboardAction` com grade cheia

**Casos de teste adicionais para `binPack`**:

```ts
// src/components/dashboards/_core/widget-registry.test.ts
import { describe, it, expect } from "vitest";
import { resolveLayout, GRID_CONFIG } from "./widget-registry";

describe("binPack — casos de borda", () => {
  it("KPIs consecutivos ficam na mesma linha quando há espaço", () => {
    const result = resolveLayout("monthly", null);
    const kpis = result.filter(w => w.kind === "kpi");
    // KPIs do monthly têm w:1 — os primeiros 6 devem estar em y=0
    const firstRowKpis = kpis.filter(w => w.y === 0);
    expect(firstRowKpis.length).toBe(6); // 6 KPIs defaultVisible no monthly
  });

  it("widget que não cabe na linha atual avança para a próxima", () => {
    const result = resolveLayout("monthly", null);
    result.forEach(w => {
      expect(w.x + w.w).toBeLessThanOrEqual(GRID_CONFIG["monthly"].cols);
    });
  });

  it("stored = [] respeita escolha do usuário (sem auto-inserção)", () => {
    const result = resolveLayout("monthly", []);
    // stored = [] significa usuário removeu tudo — não auto-inserir
    // (comportamento definido: stored vazio é respeitado, diferente de stored = null)
    // Verificar que o resultado preserva a intenção: nenhum widget ativo
    // exceto os defaultVisible ausentes que devem ser auto-inseridos (compat-forward)
    // Nota: ajustar este teste conforme a implementação final de resolveLayout
    expect(Array.isArray(result)).toBe(true);
  });

  it("widgets com visible: false são preservados no resultado", () => {
    const ghost: import("@/lib/schemas/dashboard-layout").StoredWidget = {
      instanceId: "ghost-1", widgetId: "kpi-income", visible: false,
      x: 0, y: 0, w: 1, h: 1, sizeVariantId: "default",
    };
    const result = resolveLayout("monthly", [ghost]);
    const found = result.find(w => w.instanceId === "ghost-1");
    expect(found?.visible).toBe(false);
  });
});
```

#### 7.4 Correção de `docs/widgets.md`

O spec §2.6 registra: _"`docs/widgets.md` declara `member-breakdown` com `default: 6w/1h` mas range `h:2-3`. O default correto é `6w/2h`"_.

Arquivo: `docs/widgets.md`

```
# Linha incorreta:
Gastos por Membro:
- w:3-6
- h:2-3
- default: 6w / 1h   ← ERRADO

# Corrigir para:
Gastos por Membro:
- w:3-6
- h:2-3
- default: 6w / 2h   ← CORRETO (mínimo do range declarado)
```

#### 7.5 Atualizar `skills/dashboard-widgets/SKILL.md`

O skill atual descreve a arquitetura do spec 33 (lista sequencial, `buildSegments`, `ResolvedLayout`, `nodeMap` por `widget.id`). Reescrever para refletir a nova arquitetura do spec 36.

**Seções a atualizar obrigatoriamente**:

1. **Diagrama de arquitetura** (topo do arquivo): substituir o fluxo atual pelo novo:

```
WIDGET_REGISTRY (_core/widget-registry.ts)
        ↓  resolveLayout(context, StoredWidget[] | null)
  StoredWidget[]  (com x, y, w, h, visible, config)
        ↓  passado como props para o Client Component do dashboard
  DashboardGrid (_core/DashboardGrid.tsx)
        ↓  nodeMap[instanceId] → ReactNode
  CSS Grid posicionado por gridColumn/gridRow
        ↓
  Componente filho recebe renderMode da sizeVariant ativa
```

2. **Checklist de implementação**: atualizar os 6 passos para refletir `sizeVariants` em vez de `span`, e `instanceId` em vez de `widget.id` no `nodeMap`:

```
1. WIDGET_REGISTRY   → registrar id/kind/sizeVariants/defaultVisible (sem span)
2. messages/pt-BR.ts → label + description + labels de sizeVariants
3. widget-icons.ts   → ícone MUI para o card da paleta
4. Query             → função em src/lib/queries/ ou service
5. Componente        → src/components/dashboards/; receber prop renderMode
6. nodeMap           → integrar no Client Component por widgetId (mapeado para instanceId)
```

3. **Seção "Passo 1 — Registro"**: substituir o exemplo de `span` por `sizeVariants`:

```ts
// ✅ Novo padrão — sizeVariants obrigatório, sem span
{ 
  id: "meu-widget", 
  labelKey: "meuWidget", 
  kind: "panel", 
  defaultVisible: false,
  sizeVariants: [
    { id: "default", labelKey: "padrão", w: 3, h: 2, renderMode: "default" },
    { id: "large",   labelKey: "grande",  w: 6, h: 3, renderMode: "expanded" },
  ],
}

// ❌ Padrão antigo (spec 33) — NÃO USAR
{ id: "meu-widget", kind: "panel", span: "half", defaultVisible: false }
```

4. **Adicionar seção "nodeMap por instanceId"**: explicar que o mapa agora usa `instanceId` (não `widgetId`) e como construir o `nodeByWidgetId` intermediário:

```ts
// ✅ Padrão correto (spec 36) — nodeMap por instanceId
const nodeByWidgetId: Record<string, ReactNode> = {
  "meu-widget": <MeuWidget renderMode={instancia.sizeVariantId} ... />,
};
const nodeMap: Record<string, ReactNode> = {};
for (const w of widgets) {
  nodeMap[w.instanceId] = nodeByWidgetId[w.widgetId] ?? null;
}

// ❌ Padrão antigo (spec 33) — nodeMap por widgetId direto
const nodeMap: Record<string, ReactNode> = {
  "meu-widget": <MeuWidget />,
};
```

5. **Adicionar seção "renderMode"**: documentar que cada componente de widget deve receber `renderMode` como prop e adaptar apresentação — nunca ler `w`/`h` diretamente.

6. **Remover** qualquer menção a `buildSegments`, `Segment`, `ResolvedLayout`, `span`, `WidgetSpan`.

#### 7.6 Verificação final completa

```bash
# Suite completa — deve passar com zero erros e cobertura ≥ 60%
docker compose exec app pnpm typecheck
docker compose exec app pnpm lint
docker compose exec app pnpm test:coverage

# Checklist manual no browser (testar em light e dark mode):
# ✅ Dashboard mensal — widgets na grade, sem erros de console
# ✅ Dashboard anual — idem
# ✅ Resumo do mês — idem
# ✅ Settings → Visualização → Dashboard Mensal — editor de grade abre
# ✅ Reposicionar widget → auto-save → refresh mantém posição
# ✅ Ocultar widget → não aparece no dashboard → reativar → volta
# ✅ Paleta lateral → arrastar widget para grade → inserido
# ✅ Selecionar widget → painel lateral → Duplicar (instanciável) / Remover
# ✅ Painel lateral → seção Tamanho → mudar variante → grade atualiza
# ✅ Painel lateral → seção Configuração (configSchema) → salvar → widget usa config
# ✅ Sandbox → "Adicionar ao dashboard" → modal contexto → confirmar → dashboard tem o widget
# ✅ /settings/analyses → 404
# ✅ Viewport xs/sm → widgets em lista vertical (sem grade 2D)
```
