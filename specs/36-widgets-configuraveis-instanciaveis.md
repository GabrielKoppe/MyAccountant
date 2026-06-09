# Spec 36 — Widgets Configuráveis e Instanciáveis de Dashboard

> Status: draft
> Insumo: docs/wave-2.md §4 (Dashboards customizáveis) · evolução de `specs/33-dashboard-widgets.md` (§5 itens "criar/duplicar widgets" e "configurar conteúdo interno", marcados como fora de escopo) · reuso de `src/lib/schemas/sandbox.ts` e `specs/19-transaction-search-filter-sort.md`
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md)

---

## 1. Problema

O [spec 33](33-dashboard-widgets.md) introduz um sistema de widgets que permite **reordenar e ocultar** blocos por Account, mas com um catálogo **fixo de singletons**: cada widget existe uma única vez e seu conteúdo é hardcoded. A wave 2.4 previa um dashboard de fato customizável — instâncias múltiplas e parametrizáveis. Os limites concretos do spec 33 (explicitados na sua própria §5 "Fora de Escopo"):

- **WGT-01**: Cada widget do registry é um **singleton** — o usuário só pode mostrá-lo ou escondê-lo. Não há como ter **duas instâncias** do mesmo tipo (ex.: dois gráficos de linha temporal, um para "Alimentação" e outro para "Transporte"). (spec 33 §5: "Criar/duplicar widgets novos pela UI — fora de escopo".)
- **WGT-02**: Widgets **não têm configuração por instância**. Não é possível escolher qual categoria/seção, qual período ou qual métrica um widget exibe — o conteúdo é fixo no componente. (spec 33 §5: "Configurar conteúdo interno de um widget — fora de escopo".)
- **WGT-03**: Não existem **widgets genéricos parametrizáveis** que a wave 2.4 listava: KPI de uma métrica arbitrária, linha temporal de uma category/section escolhida, e lista de transações filtradas. Hoje só há os blocos pré-definidos do dashboard.
- **WGT-04**: O formato de persistência do spec 33 — `DashboardLayout.widgets` como `[{ widgetId, visible }]` (spec 33 §7.2) — **não representa instâncias nem configuração**: não há `instanceId` nem `config`, e não há versionamento do formato para evoluí-lo.
- **WGT-05**: A tela de configuração do spec 33 (`settings/dashboards`) só **reordena e liga/desliga** widgets. Não permite **adicionar, duplicar ou remover** instâncias, nem **editar a configuração** de cada uma.

---

## 2. Solução

Evoluir o sistema do spec 33 de "singletons ordenáveis" para "**instâncias configuráveis**", **reusando a infraestrutura analítica já existente** (config do Sandbox e filtros de transação) em vez de criar um motor de configuração paralelo.

> **Dependência**: esta spec assume o spec 33 **implementado** (registry, `DashboardLayout`, renderer, editor `@dnd-kit`). Ela estende esses artefatos; não os recria.

### 2.1 Instâncias de widget e persistência (WGT-01, WGT-04)

- Cada item do layout passa de `{ widgetId, visible }` para `{ instanceId, widgetId, visible, config? }`:
  - `instanceId`: `cuid` único por item — permite múltiplas instâncias do mesmo `widgetId`.
  - `config`: objeto opcional validado pelo `configSchema` do widget (ausente para singletons).
- `DashboardLayout` ganha `schemaVersion Int` (`1` = formato do spec 33; `2` = este formato).
- **Reconciliação compat-forward**: ao ler um layout `schemaVersion = 1`, o service converte cada `{ widgetId, visible }` em `{ instanceId: widgetId, widgetId, visible }` (singleton, sem config) e marca como v2 na próxima escrita. Nenhum backfill obrigatório; contas sem layout seguem os defaults do registry.

### 2.2 Widgets configuráveis no registry (WGT-02, WGT-03)

- O `WidgetDef` do registry ganha campos opcionais: `instantiable: boolean` (default `false`), `configSchema?` (Zod), `defaultConfig?`, e um renderer que recebe `config`.
- Widgets singletons do spec 33 permanecem `instantiable: false`, sem `configSchema` — **zero regressão**.
- Novos widgets `instantiable: true`, por contexto:
  - **`analysis`** — gráfico configurável; `config` reusa o `sandboxConfigSchema` de `src/lib/schemas/sandbox.ts` (métrica, `groupBy`, `seriesBy`, `chartType`, filtros, período). Cobre "linha temporal de category/section" e qualquer outro gráfico.
  - **`kpi-custom`** — KPI de uma métrica arbitrária; `config = { metric, period, filterSectionIds?, filterCategoryIds?, filterMemberIds? }` (subconjunto do schema do Sandbox).
  - **`filtered-transactions`** — lista de transações filtradas; `config` reusa o schema de filtros do [spec 19](19-transaction-search-filter-sort.md) + `limit`.

### 2.3 Editor: instâncias + configuração (WGT-05)

- A tela `settings/dashboards` (do spec 33) ganha, por contexto: botão **"Adicionar widget"** (escolhe um tipo `instantiable` do registry), **duplicar** e **remover** instância, além do reordenar/ocultar já existentes.
- Cada instância configurável exibe um botão de **configuração** que abre um dialog (`DialogShell`) com formulário RHF + Zod do `configSchema` daquele widget.
- Singletons continuam apenas reordenáveis/ocultáveis (sem botão de config, sem duplicar/remover).

---

## 3. User Stories

- Como usuário, quero adicionar **mais de uma** instância de um widget (ex.: dois gráficos de linha, um por categoria), para montar o dashboard que faz sentido pra mim.
- Como usuário, quero **configurar** cada widget (qual categoria/seção, período, métrica), para que ele mostre exatamente o recorte que me interessa.
- Como usuário, quero um widget de **lista de transações filtradas** fixado no dashboard, para acompanhar um recorte recorrente sem ir ao sandbox.
- Como usuário, quero **remover** uma instância que não uso mais, sem afetar as demais.
- Como desenvolvedor, quero que widgets configuráveis reusem o schema do Sandbox e os filtros do spec 19, para não manter dois sistemas de configuração paralelos.
- Como viewer, quero **ver** o dashboard com as instâncias configuradas, sem poder editá-las.

---

## 4. Critérios de Aceitação

### WGT-01 / WGT-04 — Instâncias e persistência

- QUANDO um editor adiciona um segundo widget do mesmo `widgetId`, O SISTEMA DEVE criar um item com `instanceId` distinto, e AMBAS as instâncias DEVEM ser renderizadas independentemente.
- QUANDO o layout é salvo, CADA item DEVE conter `instanceId`, `widgetId`, `visible` e, para widgets configuráveis, `config` validado pelo `configSchema` do tipo.
- QUANDO o service lê um layout `schemaVersion = 1` (formato do spec 33), ELE DEVE convertê-lo para o formato de instâncias (1 singleton por entrada) sem quebrar a renderização.
- A query de leitura DEVE filtrar por `accountId` (multi-tenancy) e a escrita DEVE persistir `schemaVersion = 2`.

### WGT-02 / WGT-03 — Widgets configuráveis

- QUANDO um widget `instantiable` é renderizado, ELE DEVE usar seu `config` (ou `defaultConfig` se ausente) para produzir o conteúdo.
- O REGISTRY DEVE expor ao menos os widgets `analysis`, `kpi-custom` e `filtered-transactions` nos contextos aplicáveis (`monthly`, `yearly`).
- O `config` de `analysis` DEVE ser validado pelo `sandboxConfigSchema`; o de `filtered-transactions` pelo schema de filtros do spec 19. Configurações inválidas DEVEM ser rejeitadas na borda (Zod) antes do upsert.
- QUANDO um widget configurável não tiver dados para o recorte escolhido, ELE DEVE manter o comportamento de guard (estado vazio amigável, sem quebrar a página).
- Os widgets singletons do spec 33 DEVEM continuar `instantiable: false` e renderizar exatamente como hoje (sem regressão).

### WGT-05 — Editor

- QUANDO o usuário clica em "Adicionar widget", A TELA DEVE listar apenas os tipos `instantiable` do contexto e, ao escolher um, adicionar uma instância com `defaultConfig`.
- QUANDO o usuário duplica uma instância, A NOVA instância DEVE herdar o `config` da original com novo `instanceId`.
- QUANDO o usuário remove uma instância, ELA DEVE sair do layout sem afetar as demais.
- QUANDO o usuário abre a configuração de uma instância, O DIALOG DEVE usar `DialogShell` + form RHF/Zod do `configSchema`; ao salvar, o `config` da instância DEVE ser atualizado.
- SE o membro for `viewer`, A ROTA DEVE redirecioná-lo (mesmo comportamento das demais telas de settings).

---

## 5. Fora de Escopo

- **Redimensionamento livre / grid arbitrário (masonry)** — mantém o `span` (`half`/`full`) do registry do spec 33; sem resize por drag.
- **Layout por usuário** — segue por Account, como decidido no spec 33. Personalização individual fica para spec futura.
- **Mover instâncias entre contextos** (ex.: levar um `analysis` do anual para o mensal) — cada contexto tem seu catálogo.
- **Tornar os singletons do spec 33 instanciáveis** (ex.: múltiplos Sankeys) — só os novos tipos genéricos são `instantiable` nesta versão.
- **Unificar `pinned-analyses` (SavedAnalysis) com o widget `analysis`** — permanecem separados; o `pinned-analyses` continua sendo o bloco único do spec 33. Migrar SavedAnalysis para instâncias fica para spec futura.
- **Novos tipos de gráfico além dos do Sandbox** — o catálogo de `chartType` é o do `sandboxConfigSchema`.
- **Compartilhar/exportar configurações de widget entre Accounts** — fora de escopo.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Config dos widgets de gráfico | Reusar `sandboxConfigSchema` | Evita um segundo motor de configuração; o Sandbox já valida métrica/groupBy/seriesBy/filtros/período. |
| Config da lista de transações | Reusar filtros do spec 19 | Mesma semântica de filtro já existente nas transações. |
| Identidade da instância | `instanceId` (`cuid`) por item do layout | Permite N instâncias do mesmo `widgetId`. |
| Versionamento | `DashboardLayout.schemaVersion` (1→2) + conversão na leitura | Evolui o formato sem migração de dados; compat-forward com o spec 33. |
| Singletons | Permanecem `instantiable: false` | Zero regressão visual/comportamental sobre o spec 33. |
| Escopo do layout | Por Account (igual spec 33) | Consistência com a decisão já tomada. |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar / criar |
|---|---|
| WGT-04 | `prisma/schema.prisma` (`DashboardLayout.schemaVersion Int @default(2)`) + migration |
| WGT-04 | `src/lib/schemas/dashboard-layout.ts` (estender item: `instanceId`, `config`) |
| WGT-04 | `src/server/services/dashboard-layout-service.ts` (conversão v1→v2 na leitura; validação de `config` por widget) + `.test.ts` (compat v1, multi-tenancy) |
| WGT-02/03 | `src/components/dashboards/widget-registry.ts` (campos `instantiable`, `configSchema`, `defaultConfig`; novos widgets `analysis`, `kpi-custom`, `filtered-transactions`) |
| WGT-02/03 | `src/lib/queries/dashboards.ts` (resolver dados a partir de um `config` de widget — reusar resolvers do sandbox) |
| WGT-03 | reuso de `src/lib/schemas/sandbox.ts` (`sandboxConfigSchema`) e do schema de filtros do spec 19 |
| WGT-05 | `src/components/settings/DashboardLayoutEditor.tsx` (adicionar/duplicar/remover instância) |
| WGT-05 | `src/components/settings/WidgetConfigDialog.tsx` (novo — `DialogShell` + RHF/Zod por `configSchema`) |
| Mensagens | `src/lib/messages/pt-BR.ts` (`settings.dashboards.config.*`, rótulos dos novos widgets) |

### 7.1 Formato de persistência (v2)

```ts
// src/lib/schemas/dashboard-layout.ts
export const storedWidgetSchema = z.object({
  instanceId: z.string().min(1),
  widgetId: z.string().min(1),
  visible: z.boolean(),
  config: z.unknown().optional(), // validado contra o configSchema do widget no service
});

export const updateDashboardLayoutSchema = z.object({
  context: dashboardContextSchema,
  widgets: z.array(storedWidgetSchema).min(1),
});
```

```ts
// ✅ Correto — conversão compat na leitura (spec 33 v1 → v2)
function upgradeV1(stored: { widgetId: string; visible: boolean }[]): StoredWidget[] {
  return stored.map((s) => ({ instanceId: s.widgetId, widgetId: s.widgetId, visible: s.visible }));
}

// ❌ Anti-padrão — exigir migração de dados/backfill para ler layouts antigos
```

### 7.2 `WidgetDef` estendido

```ts
// src/components/dashboards/widget-registry.ts (estende o tipo do spec 33)
export type WidgetDef = {
  id: string;
  labelKey: string;
  kind: WidgetKind;            // "kpi" | "panel"
  span?: WidgetSpan;           // "half" | "full"
  defaultVisible: boolean;
  instantiable?: boolean;      // default false → singleton do spec 33
  configSchema?: z.ZodTypeAny; // só para instantiable
  defaultConfig?: unknown;
};

// Novos widgets (instantiable: true) — config reusa schemas existentes:
// analysis            → configSchema = sandboxConfigSchema
// kpi-custom          → configSchema = subconjunto { metric, period, filters }
// filtered-transactions → configSchema = filtros do spec 19 + limit
```

### 7.3 Validação de `config` no service

> O `configSchema` não pode ser embutido no Zod do layout (depende do `widgetId` em runtime). O service DEVE, por item: localizar o `WidgetDef` no registry do contexto, e — se `instantiable` — validar `item.config` contra `def.configSchema` **antes** do upsert. Itens com `widgetId` desconhecido ou `config` inválido são rejeitados (não descartados silenciosamente, para não perder dados do editor).
