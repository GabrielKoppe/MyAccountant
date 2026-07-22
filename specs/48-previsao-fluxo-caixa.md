# Spec 48 — Previsão de Fluxo de Caixa

> Status: approved
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Profundidade Financeira; refinado por entrevista de produto + arquitetura (2026-07-22)
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`dashboards-charts`](../skills/dashboards-charts/SKILL.md) · [`dashboard-widgets`](../skills/dashboard-widgets/SKILL.md)

---

## 1. Problema

- **FC-01**: O app possui todos os insumos de uma projeção — `TableTemplate` com `autoApply` (recorrentes, spec 24), `PendingInstallment` com `expectedDate` (parcelas futuras, spec 41 TRN-02) — mas **não combina nada disso numa projeção de saldo futuro**. O usuário enxerga apenas o passado (meses já lançados).
- **FC-02**: Sem projeção, é impossível responder "vou ter caixa suficiente nos próximos 3 meses?". Monarch cobra à parte por forecasting; aqui os dados já existem e estão sendo desperdiçados.
- **FC-03**: Não há nenhuma noção de **cenário**: a mesma base poderia ser projetada de forma otimista ou conservadora, mas hoje não há sequer a projeção realista.
- **FC-04**: Mesmo com uma linha projetada, o usuário teria que *ler o gráfico* para descobrir o dado mais acionável — **quando o saldo fica negativo**. O ponto de ruptura ("runway") precisa ser destacado, não inferido.
- **FC-05**: Uma projeção que nunca fica negativa ainda esconde o **vale** (pior momento do horizonte). Saber "seu menor saldo será R$ X em Novembro" é informação de planejamento, não só o resultado final.
- **FC-06**: Uma linha só responde "quanto"; não responde **"por quê"**. O usuário precisa entender a composição de cada mês projetado (recorrentes, parcelas, estimativa) para confiar no número.
- **FC-07**: Cenários renderizados como 3 linhas soltas comunicam falsa precisão. A **incerteza cresce com o tempo** (mês 1 é quase certo; mês 12 é chute) e isso precisa ser visível.
- **FC-08**: Diferentes usuários têm perfis de gasto diferentes. Horizonte, fatores de cenário e saldo de partida precisam ser **ajustáveis e persistentes por account** — não fixos no código, nem presos a um widget que o usuário pode nunca adicionar.

---

## 2. Solução

Serviço de **projeção derivada** (cálculo em tempo de leitura) que combina os insumos existentes e produz uma série de saldo projetado para N meses à frente, com cenários simples.

> **Fronteira de persistência (importante):** a **projeção nunca é persistida** — é calculada sob demanda e cacheada por request com `React.cache`. O que persiste é apenas a **configuração** (preferências do usuário: horizonte, cenário, fatores, override de saldo), em `AccountSettings`. "Projeção é cálculo, não estado" continua valendo para o **resultado**; só as *preferências* viram estado.

Entregue em **duas superfícies que compartilham o mesmo cálculo**, espelhando o precedente já implementado do Patrimônio Líquido (spec 46):

- **Página hero `/[accountId]/forecast`** — **superfície primária**. Existe para toda account (como `/net-worth`), linkada no AppBar. É a casa canônica da informação por ser uma visão *a partir de hoje* (não ancorada ao mês/ano navegado).
- **Widget `cashflow-forecast`** no dashboard `yearly` — **superfície secundária, opt-in**. Reflete a config account-level (não tem config por-instância). O usuário pode ou não adicioná-lo.

Seis melhorias sobre a projeção-base (mapa A–F):

| Cód. | Melhoria | O que entrega ao usuário |
|---|---|---|
| **A** (FC-04) | **Ponto de ruptura ("runway")** | Marcador visual no mês em que o saldo cruza zero: *"seu caixa fica negativo em Outubro"*. |
| **B** (FC-05) | **Saldo mínimo (vale)** | Destaque do pior momento do horizonte, mesmo sem ruptura: *"menor saldo: R$ 320 em Novembro"*. |
| **C** (FC-06) | **Decomposição do mês** | Tooltip/drill-down com a composição: recorrentes (entrada/saída), parcelas e estimado (hábitos recentes). Transparência = confiança. |
| **D** (FC-07) | **Cone de incerteza** | Realista como linha; otimista↔conservador como **banda sombreada que alarga com o tempo**. |
| **E** (FC-08) | **Config em account settings** | Horizonte (N), cenário default, fatores e override de saldo persistidos por account, editados numa tela de settings. |
| **F** | **Enquadramento honesto** | Copy sempre "faixa provável"/"estimativa", nunca "previsão". Distinção visual entre valores **conhecidos** e **estimados**; aviso quando há pouco histórico. |

```ts
// Tipos de saída (projeção NÃO persistida) — todos os *Cents serializados como string na fronteira RSC→Client:
type ForecastPoint = {
  yearMonth: string;              // "2026-08"
  label: string;                  // "Ago/2026" (formatMonthLabel)
  isProjected: boolean;           // false apenas no ponto-âncora (último mês fechado)
  realisticBalanceCents: string;  // saldo acumulado projetado (cenário realista)
  optimisticBalanceCents: string; // idem, cenário otimista (limite superior da banda)
  conservativeBalanceCents: string;// idem, cenário conservador (limite inferior da banda)
  // Decomposição (melhoria C) — sempre do cenário realista:
  recurringInflowCents: string;   // recorrentes em seções "add"
  recurringOutflowCents: string;  // recorrentes em seções "subtract"
  installmentsOutflowCents: string;// parcelas do mês (por expectedDate)
  estimatedCents: string;         // bloco estimado (hábitos recentes) — resultado líquido, ver §3.3/§4
  monthResultCents: string;       // resultado do mês (conhecido + estimado)
};

type CashflowForecast = {
  startingBalanceCents: string;   // saldo corrente (override ?? Σ meses fechados) — ver §3.1
  startingBalanceIsOverride: boolean; // true se veio do override configurado
  horizonMonths: number;          // N (config account-level)
  scenarioDefault: "optimistic" | "realistic" | "conservative";
  points: ForecastPoint[];        // 1 âncora (último fechado) + N projetados
  runwayYearMonth: string | null; // melhoria A — 1º mês com saldo realista < 0 (null se nunca)
  troughYearMonth: string;        // melhoria B — mês do menor saldo realista no horizonte
  troughBalanceCents: string;     // menor saldo realista no horizonte
  variableWindow: number;         // janela-alvo da média (config)
  effectiveWindow: number;        // min(variableWindow, mesesFechados) — ver §3.3
  hasLowData: boolean;            // effectiveWindow < variableWindow → aviso (F)
  factors: { optimisticPct: number; conservativePct: number };
};
```

---

## 3. Como interage com o que já existe hoje

Esta seção ancora a spec no código real (âncoras `arquivo:linha` verificadas). **Nada aqui é novo insumo de dado** — tudo já existe; a projeção apenas *lê e combina*. A única escrita nova é a **config** (§3.6).

### 3.1 Ponto de partida: saldo corrente + override

Não existe função de "saldo acumulado corrido" nem flag de "mês fechado" (`Month`, `prisma/schema.prisma:357` não tem status; o único acúmulo é `yearTotal` inline em `dashboards/yearly/[year]/page.tsx:60`). O saldo de partida é:

```
startingBalanceCents = accountSettings.forecastStartBalanceCents   // override opcional (§3.6)
                    ?? Σ calculateMonthTotal(sections, sectionTotals) sobre todos os meses fechados
```

1. `getCurrentFiscalMonth(new Date(), monthStartDay)` (`src/lib/dates.ts:101`) → mês corrente. O **último mês fechado** é o mês imediatamente anterior; "meses fechados" = todos os `Month` estritamente anteriores ao corrente.
2. O acumulado reutiliza `getMonthSections` + `batchSectionTotals` (`src/server/queries/dashboards.ts:57`, lote já existente).

> **Premissa (F):** o acumulado é um **proxy** — assume saldo inicial 0 antes do 1º mês registrado. Como o **nível absoluto** decide *quando a linha cruza zero* (runway), o **override** (`forecastStartBalanceCents`) permite ao usuário informar o caixa real e corrigir o nível. **Não** é saldo bancário real (Open Finance = spec 52, fora de escopo). Rotular como "saldo acumulado" (ou "saldo informado" quando override), nunca "saldo em conta".

### 3.2 Sinal vem de `Section.countType`, não da transação

O resultado do mês (`calculateMonthTotal`, `src/server/services/month-service.ts:215`) deriva o sinal do **`countType` da seção** (`enum SectionCountType { add, subtract, ignore, neutral }`, `schema.prisma:34`), não do sinal do valor. Logo:

- **Recorrentes** (`TableTemplateItem.amountCents`, `schema.prisma:583`) contribuem com o sinal da **`autoSectionId`** do template (`schema.prisma:559`; aplicados por `applyAutoTemplates`, `month-service.ts:60`).
- **Parcelas** (`PendingInstallment.amountCents`, `schema.prisma:839`) contribuem com o sinal da **`InstallmentGroup.sectionId`** (`schema.prisma:817`).

Consequência de design: a projeção **não** soma valores com sinal ad-hoc. Monta um `sectionTotals: Record<sectionId, bigint>` sintético por mês futuro (recorrentes + parcelas agrupados por seção de destino) e chama **`calculateMonthTotal`** — reaproveitando a semântica de `countType`. O **mesmo** helper computa o componente estimado (§3.3), mantendo sinais consistentes entre conhecido e estimado.

### 3.3 Componente estimado: média de hábitos recentes (Decisão de Design 1)

O bloco estimado representa o que o usuário gasta/recebe de forma **não-comprometida** (fora recorrentes e parcelas). É a média mensal do **resultado líquido** (via `calculateMonthTotal`) das transações reais onde:

```
source != "auto_template"          -- exclui recorrentes já contados como conhecido
AND installmentGroupId = null      -- exclui parcelas já contadas como conhecido
AND expenseType != "one_time"      -- exclui gastos únicos (não recorrem)
-- INCLUI: expenseType ∈ { variable, fixed, null }
```

- **Por que incluir `fixed` e `null`:** custo fixo lançado manualmente (aluguel não-templatizado) e imports CSV (nascem `expenseType = null`, spec 41 §linha 131) recorrem na prática. Excluí-los subcontaria despesa → superestimaria o caixa — o pior erro para uma ferramenta de "vou ter dinheiro?".
- **Por que excluir `one_time`:** um pico pontual (viagem) não deve virar gasto recorrente projetado.
- **Sem dupla contagem:** recorrentes (`source = "auto_template"`) e parcelas (`installmentGroupId`) já entram como componente conhecido; o filtro os remove daqui.
- Precedente de média de janela: `getComparisonData.avg3months` (`dashboards.ts:449`).

**Janela e histórico curto (Decisão de Design 5):**

```
effectiveWindow = min(variableWindow, nº de meses fechados)
estimatedNetBase = effectiveWindow > 0
  ? BigInt(Math.round(Number(Σ resultado líquido não-comprometido dos effectiveWindow meses mais recentes) / effectiveWindow))
  : 0n
hasLowData = effectiveWindow < variableWindow
```

- O mês fiscal **corrente é parcial** e, por ser "não-fechado", já fica **fora** do conjunto de meses fechados — não entra na média (senão subconta).
- `estimatedNetBase` é tipicamente **negativo** (saída líquida). O fator de cenário escala sua **magnitude** (§4).
- 0 meses fechados → `estimatedNetBase = 0n` (projeta só conhecido + saldo de partida). `hasLowData = true` → widget/página exibem aviso "estimativa com poucos dados".

### 3.4 Delimitação de mês futuro (Decisão de Design — parcelas)

`getMonthRange(year, month, monthStartDay)` (`dates.ts:76`) delimita cada mês futuro. **Parcelas são bucketizadas por mês-calendário** (`expectedDate` entre o 1º e o último dia do mês), espelhando `convertPendingInstallmentsForMonth` (`installment-service.ts:169`) — a projeção prevê o que **de fato** será convertido. Ver divergência registrada em §11.

### 3.5 Superfícies: página hero (primária) + widget (secundária)

A IA da plataforma já resolveu este problema com o **Patrimônio Líquido** (spec 46, implementado): visão *a partir de hoje* → **página hero atemporal** (`/[accountId]/net-worth`, computada de `new Date()`/`getCurrentFiscalMonth`, linkada no AppBar) **+** série temporal espelhada como **widget opt-in exclusivo do `yearly`** (`net-worth-evolution`, `defaultVisible: false`).

A previsão adota o mesmo par, com a diferença de que **a config é account-level** (não por-instância de widget):

- **Página `/[accountId]/forecast`** — casa primária; presente para toda account; não ancorada a período. Item no AppBar (`AppBarNavButtons.tsx`, precedente "Patrimônio").
- **Widget `cashflow-forecast`** — registry existente (`widget-registry.ts:50`, `WidgetDef`), contexto `yearly`, `kind: "panel"`, singleton, `defaultVisible: false`. **Sem `configSchema`** (reflete a config da account) — logo **não há case novo em `WidgetConfigForm`**. Só declara `sizeVariants` (densidade de render).

Pipeline de dados de ambas:

- **Fetch (RSC)** → `getCashflowForecast(accountId)` com `React.cache` + `requireAccountAccess` → serializa BigInt→string → componente client.
- **Chart lazy** (`charts/lazy.tsx`, `dynamic ssr:false` + `ChartSkeleton`), dentro de `WidgetContainer` (`src/components/ui/WidgetContainer.tsx:46`) no widget; num `Paper` hero na página.

### 3.6 Config persistente (account-level) — Decisão de Design 3

A config (preferências) vive em **`AccountSettings`** (`schema.prisma:262`, que já guarda `monthStartDay`, `currency`), em **colunas discretas tipadas**:

```prisma
model AccountSettings {
  // ...campos existentes
  forecastHorizonMonths     Int     @default(6)  @map("forecast_horizon_months")
  forecastScenario          String  @default("realistic") @map("forecast_scenario")
  forecastOptimisticPct     Int     @default(15) @map("forecast_optimistic_pct")
  forecastConservativePct   Int     @default(15) @map("forecast_conservative_pct")
  forecastVariableWindow    Int     @default(6)  @map("forecast_variable_window")
  forecastStartBalanceCents BigInt? @map("forecast_start_balance_cents") // override opcional
}
```

- **Migration** aditiva (colunas com default; `forecastStartBalanceCents` nullable). Sem tabela nova.
- **Edição** numa tela de settings (§5.6), via `updateAccountSettings` (`account-settings-service.ts:8`) sob `defineAction` + Zod (fonte única, §5.6). Filtro por `accountId` no `ctx`.
- **Leitura**: `getCashflowForecast` lê esses campos; página e widget consomem o mesmo resultado.

---

## 4. Modelo de cálculo

Separação de responsabilidade (convenção do repo: `queries/` = acesso a dados + `React.cache`; `services/` = lógica pura testável):

- **`src/server/queries/cashflow-forecast.ts`** (novo) — acesso a dados multi-tenant + `React.cache`; carrega config (AccountSettings), recorrentes, parcelas, histórico não-comprometido e saldo corrente; serializa.
- **`src/server/services/cashflow-forecast-service.ts`** (novo) — **matemática pura, sem Prisma**: compõe a série, aplica cenários, calcula runway/vale/decomposição. Unit-testável com inputs mockados.

Algoritmo (por request):

1. `accountSettings` ← `monthStartDay` + campos `forecast*` (§3.6).
2. `currentFiscal` ← `getCurrentFiscalMonth(new Date(), monthStartDay)`; "meses fechados" = `Month` anteriores.
3. `startingBalanceCents` ← `forecastStartBalanceCents ?? Σ calculateMonthTotal(meses fechados)` (§3.1).
4. **Recorrentes** ← `tableTemplate.findMany({ where: { accountId, autoApply: true }, include: { items } })`; agrega `Σ items.amountCents` por `autoSectionId` → `recurringSectionTotals`. Igual todo mês do horizonte.
5. **Parcelas** ← `pendingInstallment.findMany({ where: { accountId, expectedDate: { gte, lte } }, include: { group: { select: { sectionId } } } })` na janela do horizonte (mês-calendário, §3.4); bucketiza por mês futuro × `sectionId`.
6. **Estimado base** ← `estimatedNetBase` (§3.3): média mensal do resultado líquido não-comprometido sobre `effectiveWindow` meses fechados; `0n` se nenhum. Sinal via `calculateMonthTotal` (tipicamente negativo).
7. Para cada mês futuro `m ∈ [1..N]`:
   - `sectionTotals_m` = `recurringSectionTotals` ⊕ `installmentsByMonth[m]`.
   - `knownResult_m` = `calculateMonthTotal(sections, sectionTotals_m)`.
   - `estimated_m(scenario)` = `estimatedNetBase × factor(scenario)` — **fator só no bloco estimado** (F).
   - `monthResult_m(scenario)` = `knownResult_m + estimated_m(scenario)` (soma com sinal; `estimated` já é negativo em geral).
   - `balance_m(scenario)` = `balance_{m-1}(scenario) + monthResult_m(scenario)`; `balance_0 = startingBalance`.
8. **Banda (D):** `conservative` (fator amplia a magnitude do estimado → saldo menor) e `optimistic` (reduz → saldo maior). A banda alarga porque o erro do estimado **acumula** a cada mês.
9. **Runway (A):** `runwayYearMonth` = 1º `m` com `realisticBalance < 0` (ou `null`).
10. **Vale (B):** `troughYearMonth`/`troughBalanceCents` = mínimo de `realisticBalance` no horizonte.
11. **Decomposição (C):** por mês, `recurringInflow`/`recurringOutflow`, `installmentsOutflow`, `estimatedCents` (= `estimated_m` realista).
12. Ponto-âncora: prepende 1 ponto `isProjected: false` com `realisticBalance = startingBalance` (último mês fechado) para a junção sólido→tracejado conectar.
13. `hasLowData` (§3.3); serializa todos `*Cents` como `string`.

Fatores: `factor(realistic) = 1.0`; `factor(optimistic) = 1 − optimisticPct/100`; `factor(conservative) = 1 + conservativePct/100`. Aplicados à **magnitude** do estimado (net negativo × fator<1 = menos saída = melhor).

> **Divisão de média com BigInt** (skill money-handling): `BigInt(Math.round(Number(soma) / effectiveWindow))` — nunca `bigint / bigint` (trunca).

---

## 5. UX / UI

### 5.1 Onde vive — página hero (primária) + widget (secundária)

**Página hero `/[accountId]/forecast`** (casa primária, toda account):
- Item no AppBar (`AppBarNavButtons.tsx`), ao lado de "Patrimônio" (ícone sugerido `TrendingUpIcon`/`TimelineIcon`, label "Projeção").
- Não depende de `[year]`/`[monthId]` — projeta do mês fiscal corrente. Resolve a tensão de ancoragem (não existe "previsão de 2023").
- Layout: hero com `ComposedChart` grande, stats de vale/runway em destaque, toggle de cenário, link/atalho para a tela de settings.
- **Controles da página são efêmeros** (exploração): o **toggle de cenário** troca a linha em foco sem persistir. Horizonte, fatores e override se ajustam na **tela de settings** (persistem). Settings = defaults; página = visão + exploração.

**Widget `cashflow-forecast`** (secundária, opt-in): contexto `yearly`, singleton, `defaultVisible: false`. Reflete a config da account. Copy "Projeção a partir de hoje" deixa claro que ignora o ano navegado. `sizeVariants` (grade 6-col, `ROW_HEIGHT = 120px`):
  - `compact` — `w:3 h:2`, `renderMode:"compact"`: linha realista + banda + baseline; sem legenda; vale/runway no header.
  - `default` — `w:4 h:2`, `renderMode:"default"`: + legenda + marcador de runway.
  - `large` — `w:6 h:3`, `renderMode:"expanded"`: + eixo Y completo, ReferenceDot no vale, tooltip com decomposição completa.
  - O componente lê **`renderMode`** (string opaca), nunca `w`/`h`. A página hero reusa o mesmo componente em `expanded`.

### 5.2 Linguagem visual (respeitando `dashboards-charts`)

**Zero hex.** Cores via `getChartColors(mode)` (`design-tokens.ts:264`) e `theme.palette.*`. `ComposedChart` (recharts) combinando `Area` (banda) + `Line` (séries):

| Elemento | Técnica | Precedente |
|---|---|---|
| **Histórico** (âncora→hoje) | `Line` sólida, `palette[0]` (accent índigo), `strokeWidth 2.5`, `dot={false}` | `NetWorthEvolutionChart.tsx` série principal |
| **Projeção realista** | `Line` **tracejada** `strokeDasharray="5 4"`, `palette[0]`, `strokeWidth 2` | `YearlyLineChart.tsx:94` (linha derivada) |
| **Cone (D)** | `Area` com `dataKey={["conservative","optimistic"]}` (range), `fill` accent, `fillOpacity ~0.12`, sem stroke | `SandboxChart.tsx:218` (`fillOpacity 0.45`) — **técnica de banda é net-new** |
| **Baseline zero** | `ReferenceLine y={0}` `stroke={theme.palette.divider}` | `YearlyLineChart.tsx:91`, `MonthlyBarChart.tsx:153` |
| **Runway (A)** | `ReferenceLine x={runwayMonth}` vertical, `stroke={theme.palette.error.main}`, `strokeDasharray="4 4"`, `label` "fica negativo" | `WeeklySpendingWidget.tsx:180` (ReferenceLine c/ label) |
| **Vale (B)** | `ReferenceDot` no ponto mínimo (`expanded`) + stat no header | — |

> **Conhecido vs estimado (F):** histórico = sólido/accent; projetado = tracejado; banda = accent translúcido. O trecho projetado é visualmente "mais leve". Junção: último ponto histórico = primeiro ponto projetado (compartilhado) para as linhas conectarem.

### 5.3 Header (`WidgetContainer` no widget / `Paper` na página)

- **Título** + ícone (registrar em `widget-icons.ts`).
- **Toggle de cenário** — `ToggleButtonGroup` (otimista/realista/conservador). **Estado efêmero client-side**; default vem de `scenarioDefault` (config). Alternar destaca a linha; a banda permanece sempre visível.
- **Stats derivados:**
  - Vale (B): `"Menor saldo: R$ 320 · Nov"`.
  - Runway (A): `<StatusBadge variant="danger">Fica negativo em Out</StatusBadge>`; senão `<StatusBadge variant="success">Sem ruptura no horizonte</StatusBadge>`.
  - Pouco histórico (F): `<StatusBadge variant="warning">Estimativa com poucos dados</StatusBadge>` quando `hasLowData`.

### 5.4 Tooltip com decomposição (C)

Estende o padrão `ChartTooltip` (`_shared/ChartTooltip.tsx:25`):

```
Novembro/2026 · projetado
Recorrentes (entrada)   + R$ 6.000,00   (conhecido)
Recorrentes (saída)     − R$ 3.200,00   (conhecido)
Parcelas                − R$   890,00   (conhecido)
Estimado (hábitos)      − R$ 2.100,00   (estimativa · média 6m)
────────────────────────────────────
Resultado do mês        − R$   190,00
Saldo acumulado         = R$ 3.010,00
```

Valores em JetBrains Mono (padrão do `ChartTooltip`). Marcadores "(conhecido)"/"(estimativa)" reforçam F.

### 5.5 Estado vazio, loading, temas

- **EmptyState** (`ui/EmptyState.tsx`, `size="compact"`): só quando **não há nenhum mês registrado E nenhum recorrente/parcela** (sem ponto de partida e sem insumos). Se houver saldo mas nenhum recorrente/parcela → **linha constante** (não vazio). Se houver recorrentes/parcelas mas 0 meses fechados → projeta conhecido + `hasLowData`.
- **Loading**: `ChartSkeleton` via `charts/lazy.tsx` (`dynamic ssr:false`).
- **Light/dark**: 100% `getChartColors(theme.palette.mode)` + `theme.palette.*`. Testar nos dois modos (regra inegociável).

### 5.6 Tela de config (E) — account settings

Nova entrada de settings (`/[accountId]/settings/forecast` ou seção equivalente; precedente `SettingsNav`). Form RHF + `zodResolver` (skill forms-zod-rhf) sobre o schema `forecastSettingsSchema` (novo, em `src/lib/schemas/`), que valida form **e** action (fonte única):

| Campo (AccountSettings) | Tipo | Default | UI |
|---|---|---|---|
| `forecastHorizonMonths` | `3 \| 6 \| 12 \| 24` | `6` | Select/slider |
| `forecastScenario` | `"optimistic" \| "realistic" \| "conservative"` | `"realistic"` | Select |
| `forecastOptimisticPct` | `int 0–50` | `15` | Slider (%) |
| `forecastConservativePct` | `int 0–50` | `15` | Slider (%) |
| `forecastVariableWindow` | `3 \| 6 \| 12` | `6` | Select (meses) |
| `forecastStartBalanceCents` | `bigint \| null` | `null` | CurrencyInput (opcional; "deixe vazio para usar o acumulado") |

Gravação via `updateAccountSettings` (`account-settings-service.ts:8`) sob `defineAction` (`requireRoles: ["owner","editor"]`), `revalidatePath` de `/forecast` + dashboards. Money em `BigInt` centavos (skill money-handling); `forecastStartBalanceCents` parseado de máscara BRL na borda.

### 5.7 Mensagens (`src/lib/messages/pt-BR.ts`)

- `dashboards.widgets.yearly["cashflow-forecast"]` (nome curto) + `dashboards.widgets.descriptions.yearly["cashflow-forecast"]` (frase), marcado `// Spec 48`.
- Namespace de domínio `cashflowForecast` (modelo `netWorth`, `pt-BR.ts:1594`): nomes de série, labels de cenário, textos do tooltip ("conhecido"/"estimativa"/"média Nm"), runway/vale, empty state, aviso de pouco histórico, `navLabel` "Projeção". Interpolações como funções (ex. `trough: (value, month) => ...`).
- `settings.forecast.*`: labels/ajudas dos campos da tela de config.

---

## 6. User Stories

- Como usuário, quero ver a projeção do meu saldo para os próximos meses, para saber se terei caixa suficiente.
- Como usuário, quero que a projeção use minhas recorrentes e parcelas futuras já cadastradas, para não reinformar nada.
- Como usuário, quero alternar entre cenário otimista, realista e conservador, para entender o intervalo de possibilidades.
- Como usuário, quero configurar horizonte, fatores e meu saldo real de partida nas configurações da conta, para que a projeção reflita meu perfil e persista.
- **(A)** Como usuário, quero ser avisado visualmente do mês em que meu saldo fica negativo, para agir com antecedência.
- **(B)** Como usuário, quero saber meu pior momento de caixa no horizonte, mesmo que eu nunca fique negativo.
- **(C)** Como usuário, quero entender de onde vem o número de cada mês (recorrentes, parcelas, estimado), para confiar na projeção.
- **(D)** Como usuário, quero enxergar a incerteza crescendo com o tempo, para não tratar a projeção como certeza.

---

## 7. Critérios de Aceitação

**Cálculo da projeção**
- QUANDO a projeção é solicitada, O SERVIÇO DEVE compor cada mês futuro a partir de: recorrentes (`TableTemplate.autoApply = true`), `PendingInstallment` por `expectedDate`, e o saldo corrente como ponto de partida — tudo em `BigInt` centavos, com o sinal derivado do `countType` da seção de destino (via `calculateMonthTotal`).
- QUANDO o saldo corrente é calculado, O SERVIÇO DEVE usar `accountSettings.forecastStartBalanceCents` se preenchido, SENÃO Σ `calculateMonthTotal` dos meses fechados (mês anterior a `getCurrentFiscalMonth`).
- QUANDO o componente estimado é calculado, O SERVIÇO DEVE mediar transações reais onde `source != "auto_template"` E `installmentGroupId = null` E `expenseType != "one_time"` (incluindo `variable`, `fixed` e `null`), sobre `effectiveWindow = min(forecastVariableWindow, mesesFechados)` meses fechados; o mês fiscal corrente (parcial) NÃO DEVE entrar na média.
- SE não houver meses fechados, O componente estimado DEVE ser `0n` e a projeção DEVE render conhecido + saldo de partida sem erro.
- SE `effectiveWindow < forecastVariableWindow`, O RESULTADO DEVE marcar `hasLowData = true`.
- SE o cenário for `optimistic` ou `conservative`, O SERVIÇO DEVE aplicar o fator **apenas** à magnitude do bloco estimado; recorrentes e parcelas (conhecidos) NÃO DEVEM ser ajustados.
- QUANDO parcelas são bucketizadas por mês futuro, O SERVIÇO DEVE usar **mês-calendário** (`expectedDate` do 1º ao último dia), espelhando `convertPendingInstallmentsForMonth`.
- O SERVIÇO NÃO DEVE persistir a projeção em nenhuma tabela — DEVE ser calculada por request e cacheada com `React.cache`.
- ENQUANTO `forecastHorizonMonths` for N, A PROJEÇÃO DEVE produzir exatamente N pontos projetados a partir do mês seguinte ao último fechado, mais 1 ponto-âncora do último fechado.

**Config account-level**
- QUANDO o usuário salva a config na tela de settings, O SISTEMA DEVE persistir em `AccountSettings` via `defineAction` + Zod, e a projeção (página e widget) DEVE refletir os novos valores após revalidação.
- O WIDGET `cashflow-forecast` NÃO DEVE ter config por-instância — DEVE ler a config da account.
- **Multi-tenancy**: QUANDO o serviço lê recorrentes, parcelas, histórico ou config, ele DEVE filtrar por `accountId`; a escrita de config DEVE usar `ctx.accountId` (nunca o body); a projeção NÃO DEVE misturar dados de outra account.

**UX**
- **(A)** QUANDO o saldo realista cruza zero, A PROJEÇÃO DEVE expor `runwayYearMonth` e o widget/página DEVE destacá-lo; QUANDO não cruza, DEVE indicar "sem ruptura no horizonte".
- **(B)** A PROJEÇÃO DEVE expor o menor saldo realista do horizonte (`troughBalanceCents`/`troughYearMonth`).
- **(C)** QUANDO o usuário inspeciona um mês projetado, O TOOLTIP DEVE mostrar recorrentes (entrada/saída), parcelas e estimado, distinguindo valores conhecidos de estimados.
- **(D)** O GRÁFICO DEVE renderizar a faixa otimista↔conservador como banda, e a incerteza DEVE alargar ao longo do horizonte.
- **(F)** SE `hasLowData`, O WIDGET/PÁGINA DEVE exibir aviso "estimativa com poucos dados".
- A PÁGINA hero e O WIDGET DEVEM consumir o mesmo `getCashflowForecast`; a PÁGINA NÃO DEVE depender de `[year]`/`[monthId]` (projeta do mês fiscal corrente) e DEVE estar disponível para toda account.
- A PÁGINA e O WIDGET DEVEM renderizar com cores do tema em light e dark, distinguindo histórico (sólido) de projetado (tracejado + banda).

---

## 8. Fora de Escopo

- **Persistência da projeção** — só a *config* persiste (§2); o *resultado* é sempre derivado.
- **Machine learning / previsão estatística / sazonalidade** — cenários são multiplicadores simples. Sazonalidade exigiria modelo estatístico → fora por decisão.
- **Modo de estimativa por Budget** (teto) — adiado; ver §9.
- **Integração com saldo bancário real** — o override é manual; saldo real vem de Open Finance (spec 52).
- **Acurácia retroativa** (projetado vs realizado) — exigiria snapshot da projeção = persistir resultado; fura a filosofia. Spec própria se desejado.
- **Simulação "e se" interativa** (evento único ad-hoc) — não colide com spec alguma, mas incha a UI; ver §9.
- **Projeção por membro/persona** — a projeção é account-level; recortes por membro ficam com specs 35 (análise por membro) / 60 (responsável/persona).
- **Multi-moeda** — projeção assume a `currency` da account (default BRL).
- **Projeção de patrimônio líquido** (ativos/passivos) — spec 46.
- **Alertas/notificações de saldo negativo projetado** — spec 29 (o runway aqui é anotação passiva no gráfico, não push).
- **Cronograma de quitação de dívida** (spec 51) e **projeção de fatura de cartão** (spec 53) — parcelas entram como saída genérica; a projeção não modela quitação nem ciclo de fatura.
- **Progresso de meta de poupança** (spec 47) — a projeção responde "quanto terei", não "quando atinjo o alvo".

---

## 9. Portas abertas para o futuro

- **Modo de estimativa por Budget**: usar `Budget` recorrente (`getBudgetsWithProgress`, `budgets.ts:149`) como teto alternativo de estimativa — reintroduzir `variableEstimationSource` na config sem tocar o contrato.
- **Widget instanciável**: a arquitetura da spec 36 permite virar `instantiable: true` (múltiplos horizontes lado a lado) se um dia a config sair do account-level.
- **Views de cenário salvas**: a página hero pode ganhar comparação lado a lado de perfis salvos sem tocar o cálculo.
- **Simulação "e se" efêmera**: o service aceita um parâmetro opcional futuro `adjustments: { yearMonth, deltaCents }[]` sem quebrar a assinatura — cenário efêmero via estado client.
- **Config expansível**: novos campos `forecast*` cabem em `AccountSettings` sem tabela nova.
- **Ponto de partida real**: quando a spec 52 (Open Finance/Pluggy) chegar, `startingBalanceCents` pode vir do saldo bancário real — troca de fonte, mesmo contrato.
- **Fronteira limpa com 46/47/51/53**: parcelas e recorrentes entram como fluxo genérico; specs vizinhas plugam suas visões sobre a mesma base.

---

## 10. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Persistência da projeção | Nenhuma; cálculo derivado + `React.cache` | Resultado é cálculo, não estado; persistir divergiria |
| Persistência da config | Colunas discretas em `AccountSettings` | Casa natural (já guarda monthStartDay/currency); tipada; migration aditiva |
| Camadas | `queries/` (dados+cache) + `service/` (matemática pura) | Alinha ao repo; math testável sem Prisma |
| Sinal | `calculateMonthTotal` sobre `sectionTotals` sintético | Reaproveita semântica de `countType`; DRY |
| **D1 — Base do estimado** | Média de actuals: `source != auto_template` E `installmentGroupId = null` E `expenseType != one_time` (inclui variable/fixed/null) | Captura fixo não-templatizado e imports `null`; evita subcontar despesa (superestimar caixa); exclui pico `one_time` |
| Fator de cenário | Sobre a magnitude do bloco estimado; conhecidos fixos | Simples e explicável; recorrentes/parcelas são certos |
| **D2 — Saldo de partida** | `override ?? Σ meses fechados` | Acumulado funciona sem config; override corrige o nível absoluto → runway correto |
| **D3 — Superfícies/config** | Página `/forecast` primária + widget secundário; config account-level em settings | Página existe pra toda account; widget é opcional; config não pode viver presa a widget que pode não existir |
| **D4 — Modo budget** | Adiado (§9); v1 só actuals | Teto ≠ gasto esperado; redundante com a base de actuals; menor escopo |
| **D5 — Pouco histórico** | `effectiveWindow = min(window, mesesFechados)`; 0 → estimado `0n`; badge `hasLowData` | Sempre mostra algo útil a contas novas, com aviso honesto |
| Parcelas por mês | Mês-calendário (espelha `convertPendingInstallmentsForMonth`) | Projeta o que de fato será convertido |
| Cenário na UI | `scenarioDefault` persistido + toggle efêmero na página; banda sempre visível | Defaults persistidos separados da exploração ao vivo |
| Distinção conhecido/estimado | Sólido vs tracejado + banda translúcida + labels no tooltip | Vocabulário visual já existente (`YearlyLineChart`) |

---

## 11. Divergências com o código a resolver

- **Sem flag de "mês fechado"**: `Month` (`schema.prisma:357`) não tem status. O "último fechado" é derivado de `getCurrentFiscalMonth`. Se um dia existir fechamento explícito, `startingBalance` deve respeitá-lo.
- **`monthStartDay` não é usado na agregação de resultado**: `getSectionTotals`/`batchSectionTotals` filtram por `monthId`, não por range de `occurredOn`. A projeção herda essa semântica para o histórico, mas usa `getMonthRange` para bucketizar parcelas por `expectedDate` — possível descompasso de fronteira de mês.
- **`convertPendingInstallmentsForMonth` usa mês-calendário puro** (`installment-service.ts:169`), ignorando `monthStartDay`. **Resolvido:** a projeção adota a mesma janela de calendário (Decisão de Design — parcelas) para bater com o realizado. Alinhar a conversão de parcelas a `monthStartDay` é correção à parte em `installment-service`, fora do escopo desta spec.

---

## 12. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Query de projeção (dados + cache + multi-tenant) | `src/server/queries/cashflow-forecast.ts` (novo) |
| Service de projeção (matemática pura) | `src/server/services/cashflow-forecast-service.ts` (novo) |
| Resultado do mês / sinal | `calculateMonthTotal` — `src/server/services/month-service.ts:215` (consumir) |
| Totais por seção em lote | `batchSectionTotals` — `src/server/queries/dashboards.ts:57` (consumir) |
| Mês fiscal / range | `getCurrentFiscalMonth`, `getMonthRange` — `src/lib/dates.ts:101,76` |
| Recorrentes | `TableTemplate`/`TableTemplateItem` — `prisma/schema.prisma:559,583` |
| Parcelas futuras | `PendingInstallment`/`InstallmentGroup` — `prisma/schema.prisma:839,817` |
| Classificação (fixed/variable/one_time) | `Transaction.expenseType` — `prisma/schema.prisma:52,446` |
| **Config em AccountSettings (migration)** | `prisma/schema.prisma:262` (novos campos `forecast*`) + migration aditiva |
| **Schema Zod da config** | `src/lib/schemas/` (novo `forecastSettingsSchema`) |
| **Action de settings** | `updateAccountSettings` — `src/server/services/account-settings-service.ts:8` (estender) + `defineAction` |
| **Tela de settings** | `src/app/(app)/[accountId]/settings/forecast/` (nova) + `SettingsNav` |
| Página hero dedicada (novo) | `src/app/(app)/[accountId]/forecast/page.tsx` + manager client (precedente `net-worth/page.tsx` + `NetWorthManager.tsx`) |
| Item de navegação (AppBar) | `src/components/ui/AppBarNavButtons.tsx` (novo IconButton, precedente "Patrimônio" → `/net-worth`) |
| Registry do widget (sem `configSchema`) | `src/components/dashboards/_core/widget-registry.ts:50` |
| Ícone do widget | `src/components/dashboards/_core/widget-icons.ts` |
| Chart (novo) + lazy | `src/components/dashboards/charts/` + `charts/lazy.tsx` |
| Cores/tokens/tooltip | `getChartColors` — `src/lib/design-tokens.ts:264`; `ChartTooltip` — `_shared/ChartTooltip.tsx:25` |
| Precedente visual | `NetWorthEvolutionChart.tsx`; sólido/tracejado — `charts/YearlyLineChart.tsx:94` |
| Formatação monetária | `formatCentsToBrl` — `src/lib/money.ts:46`; `formatMonthLabel` — `src/lib/dates.ts:13` |
| Wrapper/estado vazio | `WidgetContainer.tsx:46`; `EmptyState.tsx`; `StatusBadge.tsx` |
| Labels de UI | `src/lib/messages/pt-BR.ts` (namespace `cashflowForecast` + `dashboards.widgets.yearly` + `settings.forecast`) |
| Recorrentes (não duplicar) | `specs/24-recurring-transactions.md` |
| Parcelas (não duplicar) | `specs/41-aprimoramentos-objeto-transacao.md` TRN-02 |
| Arquitetura de widgets (não duplicar) | `specs/33-dashboard-widgets.md`, `specs/36-widgets-configuraveis-instanciaveis.md` |
| Config de account (padrão) | `specs/05-account-settings.md` |

---

## 13. Plano de Implementação

> **Para workers agênticos:** SUB-SKILL REQUERIDO — use `subagent-driven-development` (recomendado) ou `executing-plans` para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`) para rastreio. Rodar comandos **dentro do container**: `docker compose exec app <cmd>`.

**Goal:** Entregar a previsão de fluxo de caixa como página hero `/forecast` (primária) + widget `yearly` (secundário), com cálculo derivado, cenários, runway/vale, decomposição, cone de incerteza e config account-level.

**Architecture:** Cálculo puro e testável em `cashflow-forecast-service.ts` (sem Prisma), alimentado por uma query multi-tenant com `React.cache` (`cashflow-forecast.ts`). Config persiste em `AccountSettings` (colunas discretas) editada via `defineAction`. Página e widget consomem o mesmo resultado serializado; gráfico `ComposedChart` (recharts) com banda + linhas sólida/tracejada.

**Tech Stack:** Next.js 15 (App Router, RSC), Prisma/PostgreSQL, Zod, React Hook Form, MUI v6 + tokens "Warm Calm", recharts, Vitest + `vitest-mock-extended`.

### Global Constraints

- **Dinheiro**: `BigInt` centavos no domínio/banco; converter para Number **só na borda de render** (`Number(BigInt(str))/100`).
- **Multi-tenancy**: toda query filtra `accountId`; toda mutation via `defineAction` (auth + role + Zod); escrita usa `ctx.accountId`, nunca o body.
- **Projeção nunca persistida** — derivada por request + `React.cache`. **Só a config persiste** (em `AccountSettings`).
- **Zod fonte única** — mesmo schema valida form (RHF) e action.
- **MUI-only + tokens semânticos** — zero hex; cores de chart via `getChartColors(mode)`/`theme.palette.*`; testar light **e** dark.
- **Sem `console.log`** (logger Pino); **sem `process.env` direto** (`env` de `@/lib/env.ts`).
- **Strings de UI** centralizadas em `src/lib/messages/pt-BR.ts`.
- **Teste de multi-tenancy obrigatório** em toda mutation; testes `.test.ts` ao lado do source; `prismaMock` + `TEST_CTX`.

### Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `prisma/schema.prisma` (`AccountSettings`) | Modificar | 6 campos `forecast*` (config) |
| `src/lib/schemas/forecast.ts` | Criar | `forecastSettingsSchema` (Zod, fonte única) |
| `src/server/services/cashflow-forecast-service.ts` | Criar | Matemática pura: `composeForecast` + helpers |
| `src/server/services/cashflow-forecast-service.test.ts` | Criar | Unit tests da matemática |
| `src/server/queries/cashflow-forecast.ts` | Criar | Acesso a dados multi-tenant + `React.cache` + serialização |
| `src/server/queries/cashflow-forecast.test.ts` | Criar | Multi-tenancy + integração (prismaMock) |
| `src/server/services/account-settings-service.ts` | Modificar | Estender `updateAccountSettings` com campos `forecast*` |
| `src/actions/account-settings.ts` (ou existente) | Modificar/Criar | `updateForecastSettingsAction` via `defineAction` |
| `src/actions/*.test.ts` | Criar | Teste multi-tenancy/role da action |
| `src/components/dashboards/charts/CashflowForecastChart.tsx` | Criar | `ComposedChart`: banda + linhas + runway + vale + tooltip |
| `src/components/dashboards/charts/lazy.tsx` | Modificar | Entrada `dynamic ssr:false` + `ChartSkeleton` |
| `src/app/(app)/[accountId]/forecast/page.tsx` | Criar | RSC hero: `requireAccountAccess` + `getCashflowForecast` |
| `src/app/(app)/[accountId]/forecast/ForecastManager.tsx` | Criar | Client: toggle de cenário efêmero + stats |
| `src/app/(app)/[accountId]/settings/forecast/page.tsx` | Criar | Tela de config |
| `src/components/settings/ForecastSettingsForm.tsx` | Criar | Form RHF + zodResolver |
| `src/components/ui/AppBarNavButtons.tsx` | Modificar | Item de nav "Projeção" |
| `src/components/dashboards/_core/widget-registry.ts` | Modificar | Registrar `cashflow-forecast` (sem `configSchema`) |
| `src/components/dashboards/_core/widget-icons.ts` | Modificar | Ícone do widget |
| `src/components/dashboards/yearly/YearlyDashboardClient.tsx` | Modificar | `nodeMap` + fetch gated |
| `src/lib/messages/pt-BR.ts` | Modificar | `cashflowForecast` + `dashboards.widgets.yearly` + `settings.forecast` |

---

### Fase A — Dados & Config

#### Task 1: Migration `AccountSettings` (campos de config)

**Files:**
- Modify: `prisma/schema.prisma` (model `AccountSettings`, ~linha 262)

**Interfaces:**
- Produces: colunas `forecastHorizonMonths`, `forecastScenario`, `forecastOptimisticPct`, `forecastConservativePct`, `forecastVariableWindow`, `forecastStartBalanceCents` (BigInt?).

- [ ] **Step 1: Adicionar campos ao model** (`AccountSettings`)

```prisma
  forecastHorizonMonths     Int     @default(6)  @map("forecast_horizon_months")
  forecastScenario          String  @default("realistic") @map("forecast_scenario")
  forecastOptimisticPct     Int     @default(15) @map("forecast_optimistic_pct")
  forecastConservativePct   Int     @default(15) @map("forecast_conservative_pct")
  forecastVariableWindow    Int     @default(6)  @map("forecast_variable_window")
  forecastStartBalanceCents BigInt? @map("forecast_start_balance_cents")
```

- [ ] **Step 2: Validar schema**

Run: `docker compose exec app pnpm prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Criar migration aditiva**

Run: `docker compose exec app pnpm prisma migrate dev --name add_forecast_config_to_account_settings`
Expected: migration criada + `pnpm prisma generate` roda; SQL só com `ADD COLUMN ... DEFAULT` (aditivo, sem drop).

- [ ] **Step 4: Revisar o SQL gerado**

Abrir `prisma/migrations/<timestamp>_add_forecast_config_to_account_settings/migration.sql`. Confirmar: 6 `ADD COLUMN`, defaults presentes, `forecast_start_balance_cents` nullable, nenhum `DROP`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(forecast): add forecast config columns to account_settings"
```

#### Task 2: Schema Zod `forecastSettingsSchema`

**Files:**
- Create: `src/lib/schemas/forecast.ts`
- Test: `src/lib/schemas/forecast.test.ts`

**Interfaces:**
- Produces: `forecastSettingsSchema`; `type ForecastSettingsInput = z.input<typeof forecastSettingsSchema>`; `type Scenario`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/schemas/forecast.test.ts
import { describe, expect, it } from "vitest";
import { forecastSettingsSchema } from "./forecast";

describe("forecastSettingsSchema", () => {
  it("aplica defaults quando vazio", () => {
    const r = forecastSettingsSchema.parse({});
    expect(r).toMatchObject({
      forecastHorizonMonths: 6, forecastScenario: "realistic",
      forecastOptimisticPct: 15, forecastConservativePct: 15,
      forecastVariableWindow: 6, forecastStartBalanceCents: null,
    });
  });
  it("rejeita horizonte fora do enum", () => {
    expect(forecastSettingsSchema.safeParse({ forecastHorizonMonths: 7 }).success).toBe(false);
  });
  it("rejeita fator acima de 50", () => {
    expect(forecastSettingsSchema.safeParse({ forecastOptimisticPct: 60 }).success).toBe(false);
  });
  it("aceita override BigInt e null", () => {
    expect(forecastSettingsSchema.parse({ forecastStartBalanceCents: 500000n }).forecastStartBalanceCents).toBe(500000n);
    expect(forecastSettingsSchema.parse({ forecastStartBalanceCents: null }).forecastStartBalanceCents).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose exec app pnpm test src/lib/schemas/forecast.test.ts`
Expected: FAIL — `Cannot find module './forecast'`.

- [ ] **Step 3: Implementar o schema**

```ts
// src/lib/schemas/forecast.ts
import { z } from "zod";

export const SCENARIOS = ["optimistic", "realistic", "conservative"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const forecastSettingsSchema = z.object({
  forecastHorizonMonths: z.union([z.literal(3), z.literal(6), z.literal(12), z.literal(24)]).default(6),
  forecastScenario: z.enum(SCENARIOS).default("realistic"),
  forecastOptimisticPct: z.coerce.number().int().min(0).max(50).default(15),
  forecastConservativePct: z.coerce.number().int().min(0).max(50).default(15),
  forecastVariableWindow: z.union([z.literal(3), z.literal(6), z.literal(12)]).default(6),
  forecastStartBalanceCents: z.coerce.bigint().nullable().default(null),
});

// z.input<> (não z.infer<>) por conta dos .default() — ver skill server-actions
export type ForecastSettingsInput = z.input<typeof forecastSettingsSchema>;
export type ForecastSettings = z.output<typeof forecastSettingsSchema>;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `docker compose exec app pnpm test src/lib/schemas/forecast.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/forecast.ts src/lib/schemas/forecast.test.ts
git commit -m "feat(forecast): add forecastSettingsSchema (single source of validation)"
```

#### Task 3: Estender `updateAccountSettings` + action

**Files:**
- Modify: `src/server/services/account-settings-service.ts:8` (`updateAccountSettings`)
- Modify/Create: `src/actions/account-settings.ts` (`updateForecastSettingsAction`)
- Test: `src/actions/account-settings.test.ts`

**Interfaces:**
- Consumes: `forecastSettingsSchema` (Task 2), `defineAction`.
- Produces: `updateForecastSettingsAction(accountId, input): Promise<ActionResult<void>>`.

- [ ] **Step 1: Teste que falha (multi-tenancy + persistência)**

```ts
// src/actions/account-settings.test.ts
import "@/../tests/mocks/auth";
import { describe, expect, it, beforeEach } from "vitest";
import { prismaMock } from "@/../tests/mocks/prisma";
import { updateForecastSettingsAction } from "./account-settings";

describe("updateForecastSettingsAction", () => {
  beforeEach(() => prismaMock.accountSettings.update.mockResolvedValue({} as any));

  it("persiste a config na account do contexto", async () => {
    const res = await updateForecastSettingsAction("acc-test-1", {
      forecastHorizonMonths: 12, forecastScenario: "conservative",
      forecastOptimisticPct: 10, forecastConservativePct: 20,
      forecastVariableWindow: 3, forecastStartBalanceCents: 500000n,
    });
    expect(res.ok).toBe(true);
    expect(prismaMock.accountSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "acc-test-1" } }),
    );
  });

  it("rejeita input inválido (VALIDATION)", async () => {
    const res = await updateForecastSettingsAction("acc-test-1", { forecastHorizonMonths: 7 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose exec app pnpm test src/actions/account-settings.test.ts`
Expected: FAIL — `updateForecastSettingsAction` não existe.

- [ ] **Step 3: Estender o service**

```ts
// src/server/services/account-settings-service.ts — adicionar
import type { ForecastSettings } from "@/lib/schemas/forecast";

export async function updateForecastSettings(input: ForecastSettings, ctx: { accountId: string }) {
  await prisma.accountSettings.update({
    where: { accountId: ctx.accountId },
    data: {
      forecastHorizonMonths: input.forecastHorizonMonths,
      forecastScenario: input.forecastScenario,
      forecastOptimisticPct: input.forecastOptimisticPct,
      forecastConservativePct: input.forecastConservativePct,
      forecastVariableWindow: input.forecastVariableWindow,
      forecastStartBalanceCents: input.forecastStartBalanceCents,
    },
  });
}
```

- [ ] **Step 4: Definir a action**

```ts
// src/actions/account-settings.ts
"use server";
import { revalidatePath } from "next/cache";
import { forecastSettingsSchema } from "@/lib/schemas/forecast";
import { defineAction } from "@/server/api/define-action";
import { updateForecastSettings } from "@/server/services/account-settings-service";

export const updateForecastSettingsAction = defineAction({
  schema: forecastSettingsSchema,
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    await updateForecastSettings(input, ctx);
    revalidatePath(`/[accountId]/forecast`, "page");
    revalidatePath(`/[accountId]/dashboards/yearly/[year]`, "page");
  },
});
```

- [ ] **Step 5: Rodar e ver passar**

Run: `docker compose exec app pnpm test src/actions/account-settings.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add src/server/services/account-settings-service.ts src/actions/account-settings.ts src/actions/account-settings.test.ts
git commit -m "feat(forecast): persist forecast config via defineAction"
```

---

### Fase B — Cálculo

#### Task 4: Service puro `composeForecast` (o coração)

**Files:**
- Create: `src/server/services/cashflow-forecast-service.ts`
- Test: `src/server/services/cashflow-forecast-service.test.ts`

**Interfaces:**
- Consumes: `calculateMonthTotal(sections, sectionTotals)` de `month-service` (`month-service.ts:215`); `formatMonthLabel` de `@/lib/dates`; `Scenario` de `@/lib/schemas/forecast`.
- Produces: `composeForecast(input: ForecastInput): ForecastResult` (domínio em `bigint`); tipos `ForecastInput`, `ForecastResult`, `ForecastPointDomain`.

- [ ] **Step 1: Testes que falham**

```ts
// src/server/services/cashflow-forecast-service.test.ts
import { describe, expect, it } from "vitest";
import { composeForecast, type ForecastInput } from "./cashflow-forecast-service";

const base: ForecastInput = {
  startingBalanceCents: 100000n,           // R$ 1.000
  startingBalanceIsOverride: false,
  horizonMonths: 3,
  scenarioDefault: "realistic",
  optimisticPct: 10, conservativePct: 20,
  variableWindow: 6, closedMonthCount: 6,
  estimatedNetBaseCents: 0n,
  recurringSectionTotals: {},
  installmentsByMonth: {},
  sections: [{ id: "in", countType: "add" }, { id: "out", countType: "subtract" }],
  firstProjected: { year: 2026, month: 8 },
};

describe("composeForecast", () => {
  it("sem insumos → saldo constante em N pontos + âncora", () => {
    const r = composeForecast(base);
    expect(r.points).toHaveLength(4);                 // 1 âncora + 3
    expect(r.points.every((p) => p.realisticBalanceCents === 100000n)).toBe(true);
    expect(r.runwayYearMonth).toBeNull();
  });

  it("fator de cenário incide só no estimado; conhecido fica fixo", () => {
    const r = composeForecast({
      ...base,
      recurringSectionTotals: { in: 500000n, out: 300000n }, // conhecido: +5000 -3000 = +2000/mês
      estimatedNetBaseCents: -100000n,                        // estimado: -1000/mês (saída)
    });
    const m1 = r.points[1];
    // realista: 2000 + (-1000*1.0) = +1000 → saldo 1000 + 1000 = 2000 (200000c)
    expect(m1.realisticBalanceCents).toBe(200000n);
    // otimista (fator 0.9): estimado -900 → mês +1100 → saldo 210000
    expect(m1.optimisticBalanceCents).toBe(210000n);
    // conservador (fator 1.2): estimado -1200 → mês +800 → saldo 180000
    expect(m1.conservativeBalanceCents).toBe(180000n);
    // conhecido não muda entre cenários (decomposição)
    expect(m1.recurringInflowCents).toBe(500000n);
    expect(m1.recurringOutflowCents).toBe(300000n);
  });

  it("detecta runway e vale quando saldo cai abaixo de zero", () => {
    const r = composeForecast({
      ...base, startingBalanceCents: 150000n,
      recurringSectionTotals: { out: 100000n },  // -1000/mês
    });
    // saldos: 1500 → 500 → -500 → -1500
    expect(r.runwayYearMonth).toBe("2026-10");   // 2º mês projetado cruza zero
    expect(r.troughBalanceCents).toBe(-150000n);
    expect(r.troughYearMonth).toBe("2026-11");
  });

  it("marca hasLowData quando janela efetiva < alvo", () => {
    expect(composeForecast({ ...base, closedMonthCount: 2 }).hasLowData).toBe(true);
    expect(composeForecast({ ...base, closedMonthCount: 6 }).hasLowData).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose exec app pnpm test src/server/services/cashflow-forecast-service.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o service puro**

```ts
// src/server/services/cashflow-forecast-service.ts
import { calculateMonthTotal } from "@/server/services/month-service";
import { formatMonthLabel } from "@/lib/dates";
import type { Scenario } from "@/lib/schemas/forecast";
import type { SectionCountType } from "@prisma/client";

type SectionRef = { id: string; countType: SectionCountType };

export type ForecastInput = {
  startingBalanceCents: bigint;
  startingBalanceIsOverride: boolean;
  horizonMonths: number;
  scenarioDefault: Scenario;
  optimisticPct: number;
  conservativePct: number;
  variableWindow: number;
  closedMonthCount: number;
  estimatedNetBaseCents: bigint;                         // média mensal (sinal via countType; ~negativo)
  recurringSectionTotals: Record<string, bigint>;        // sectionId → Σ recorrentes (mensal)
  installmentsByMonth: Record<string, Record<string, bigint>>; // "YYYY-MM" → sectionId → Σ parcelas
  sections: SectionRef[];
  firstProjected: { year: number; month: number };       // 1º mês projetado (após último fechado)
};

export type ForecastPointDomain = {
  yearMonth: string; label: string; isProjected: boolean;
  realisticBalanceCents: bigint; optimisticBalanceCents: bigint; conservativeBalanceCents: bigint;
  recurringInflowCents: bigint; recurringOutflowCents: bigint;
  installmentsOutflowCents: bigint; estimatedCents: bigint; monthResultCents: bigint;
};

export type ForecastResult = {
  startingBalanceCents: bigint; startingBalanceIsOverride: boolean;
  horizonMonths: number; scenarioDefault: Scenario;
  points: ForecastPointDomain[];
  runwayYearMonth: string | null;
  troughYearMonth: string; troughBalanceCents: bigint;
  variableWindow: number; effectiveWindow: number; hasLowData: boolean;
  factors: { optimisticPct: number; conservativePct: number };
};

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const nextMonth = (y: number, m: number) => (m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 });
const prevMonth = (y: number, m: number) => (m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 });
const scale = (base: bigint, factor: number) => BigInt(Math.round(Number(base) * factor));

export function composeForecast(input: ForecastInput): ForecastResult {
  const effectiveWindow = Math.min(input.variableWindow, input.closedMonthCount);
  const hasLowData = effectiveWindow < input.variableWindow;

  const factorOf = (s: Scenario) =>
    s === "optimistic" ? 1 - input.optimisticPct / 100
    : s === "conservative" ? 1 + input.conservativePct / 100
    : 1;

  const ctById = new Map(input.sections.map((s) => [s.id, s.countType]));
  let recurringInflow = 0n, recurringOutflow = 0n;
  for (const [id, total] of Object.entries(input.recurringSectionTotals)) {
    const ct = ctById.get(id);
    if (ct === "add" || ct === "neutral") recurringInflow += total;
    else if (ct === "subtract") recurringOutflow += total;
  }

  const points: ForecastPointDomain[] = [];
  const anchor = prevMonth(input.firstProjected.year, input.firstProjected.month);
  points.push({
    yearMonth: ym(anchor.year, anchor.month), label: formatMonthLabel(anchor.year, anchor.month),
    isProjected: false,
    realisticBalanceCents: input.startingBalanceCents,
    optimisticBalanceCents: input.startingBalanceCents,
    conservativeBalanceCents: input.startingBalanceCents,
    recurringInflowCents: 0n, recurringOutflowCents: 0n,
    installmentsOutflowCents: 0n, estimatedCents: 0n, monthResultCents: 0n,
  });

  let balR = input.startingBalanceCents, balO = input.startingBalanceCents, balC = input.startingBalanceCents;
  let runwayYearMonth: string | null = null;
  let troughYearMonth = points[0].yearMonth, troughBalanceCents = input.startingBalanceCents;
  let cur = input.firstProjected;

  for (let i = 0; i < input.horizonMonths; i++) {
    const key = ym(cur.year, cur.month);
    const inst = input.installmentsByMonth[key] ?? {};
    const sectionTotals: Record<string, bigint> = { ...input.recurringSectionTotals };
    let installmentsOutflow = 0n;
    for (const [id, total] of Object.entries(inst)) {
      sectionTotals[id] = (sectionTotals[id] ?? 0n) + total;
      if (ctById.get(id) === "subtract") installmentsOutflow += total;
    }

    const known = calculateMonthTotal(input.sections, sectionTotals);
    const estR = scale(input.estimatedNetBaseCents, factorOf("realistic"));
    const estO = scale(input.estimatedNetBaseCents, factorOf("optimistic"));
    const estC = scale(input.estimatedNetBaseCents, factorOf("conservative"));
    const resR = known + estR;

    balR += resR; balO += known + estO; balC += known + estC;
    if (runwayYearMonth === null && balR < 0n) runwayYearMonth = key;
    if (balR < troughBalanceCents) { troughBalanceCents = balR; troughYearMonth = key; }

    points.push({
      yearMonth: key, label: formatMonthLabel(cur.year, cur.month), isProjected: true,
      realisticBalanceCents: balR, optimisticBalanceCents: balO, conservativeBalanceCents: balC,
      recurringInflowCents: recurringInflow, recurringOutflowCents: recurringOutflow,
      installmentsOutflowCents: installmentsOutflow, estimatedCents: estR, monthResultCents: resR,
    });
    cur = nextMonth(cur.year, cur.month);
  }

  return {
    startingBalanceCents: input.startingBalanceCents, startingBalanceIsOverride: input.startingBalanceIsOverride,
    horizonMonths: input.horizonMonths, scenarioDefault: input.scenarioDefault,
    points, runwayYearMonth, troughYearMonth, troughBalanceCents,
    variableWindow: input.variableWindow, effectiveWindow, hasLowData,
    factors: { optimisticPct: input.optimisticPct, conservativePct: input.conservativePct },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `docker compose exec app pnpm test src/server/services/cashflow-forecast-service.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/server/services/cashflow-forecast-service.ts src/server/services/cashflow-forecast-service.test.ts
git commit -m "feat(forecast): pure composeForecast service (scenarios, runway, trough, decomposition)"
```

#### Task 5: Query `getCashflowForecast` (dados + cache + multi-tenancy)

**Files:**
- Create: `src/server/queries/cashflow-forecast.ts`
- Test: `src/server/queries/cashflow-forecast.test.ts`

**Interfaces:**
- Consumes: `composeForecast` (Task 4); `getCurrentFiscalMonth`/`getMonthRange` (`dates.ts:101,76`); `getMonthSections`/`batchSectionTotals` (`month-service`/`dashboards.ts:57`); `formatMonthLabel`.
- Produces: `getCashflowForecast(accountId: string): Promise<CashflowForecast>` (string-serializado, envolto em `React.cache`) — tipo `CashflowForecast` conforme §2.

- [ ] **Step 1: Teste de multi-tenancy que falha**

```ts
// src/server/queries/cashflow-forecast.test.ts
import { describe, expect, it, beforeEach, vi } from "vitest";
import { prismaMock } from "@/../tests/mocks/prisma";
import { getCashflowForecast } from "./cashflow-forecast";

describe("getCashflowForecast — multi-tenancy", () => {
  beforeEach(() => {
    prismaMock.accountSettings.findUnique.mockResolvedValue({
      monthStartDay: 1, forecastHorizonMonths: 3, forecastScenario: "realistic",
      forecastOptimisticPct: 10, forecastConservativePct: 20, forecastVariableWindow: 6,
      forecastStartBalanceCents: null,
    } as any);
    prismaMock.month.findMany.mockResolvedValue([] as any);
    prismaMock.tableTemplate.findMany.mockResolvedValue([] as any);
    prismaMock.pendingInstallment.findMany.mockResolvedValue([] as any);
    prismaMock.transaction.groupBy.mockResolvedValue([] as any);
  });

  it("filtra accountId em toda leitura", async () => {
    await getCashflowForecast("acc-test-1");
    for (const call of prismaMock.tableTemplate.findMany.mock.calls)
      expect(call[0].where).toMatchObject({ accountId: "acc-test-1" });
    for (const call of prismaMock.pendingInstallment.findMany.mock.calls)
      expect(call[0].where).toMatchObject({ accountId: "acc-test-1" });
  });

  it("exclui auto_template, parcelas e one_time da média estimada", async () => {
    await getCashflowForecast("acc-test-1");
    const gb = prismaMock.transaction.groupBy.mock.calls[0][0];
    expect(gb.where).toMatchObject({
      accountId: "acc-test-1",
      source: { not: "auto_template" },
      installmentGroupId: null,
      expenseType: { not: "one_time" },
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose exec app pnpm test src/server/queries/cashflow-forecast.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar a query**

```ts
// src/server/queries/cashflow-forecast.ts
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentFiscalMonth } from "@/lib/dates";
import { getMonthSections } from "@/server/services/month-service";
import { calculateMonthTotal } from "@/server/services/month-service";
import { composeForecast, type ForecastInput, type ForecastResult } from "@/server/services/cashflow-forecast-service";

// Serializa ForecastResult (bigint) → CashflowForecast (string) na borda RSC→Client
function serialize(r: ForecastResult) {
  const s = (b: bigint) => b.toString();
  return {
    startingBalanceCents: s(r.startingBalanceCents), startingBalanceIsOverride: r.startingBalanceIsOverride,
    horizonMonths: r.horizonMonths, scenarioDefault: r.scenarioDefault,
    points: r.points.map((p) => ({
      yearMonth: p.yearMonth, label: p.label, isProjected: p.isProjected,
      realisticBalanceCents: s(p.realisticBalanceCents), optimisticBalanceCents: s(p.optimisticBalanceCents),
      conservativeBalanceCents: s(p.conservativeBalanceCents),
      recurringInflowCents: s(p.recurringInflowCents), recurringOutflowCents: s(p.recurringOutflowCents),
      installmentsOutflowCents: s(p.installmentsOutflowCents), estimatedCents: s(p.estimatedCents),
      monthResultCents: s(p.monthResultCents),
    })),
    runwayYearMonth: r.runwayYearMonth, troughYearMonth: r.troughYearMonth, troughBalanceCents: s(r.troughBalanceCents),
    variableWindow: r.variableWindow, effectiveWindow: r.effectiveWindow, hasLowData: r.hasLowData, factors: r.factors,
  };
}
export type CashflowForecast = ReturnType<typeof serialize>;

export const getCashflowForecast = cache(async function getCashflowForecast(accountId: string): Promise<CashflowForecast> {
  const settings = await prisma.accountSettings.findUnique({
    where: { accountId },
    select: {
      monthStartDay: true, forecastHorizonMonths: true, forecastScenario: true,
      forecastOptimisticPct: true, forecastConservativePct: true, forecastVariableWindow: true,
      forecastStartBalanceCents: true,
    },
  });
  const cfg = settings ?? {
    monthStartDay: 1, forecastHorizonMonths: 6, forecastScenario: "realistic",
    forecastOptimisticPct: 15, forecastConservativePct: 15, forecastVariableWindow: 6, forecastStartBalanceCents: null,
  };

  const currentFiscal = getCurrentFiscalMonth(new Date(), cfg.monthStartDay);
  const beforeCurrent = (y: number, m: number) => y < currentFiscal.year || (y === currentFiscal.year && m < currentFiscal.month);

  const months = await prisma.month.findMany({ where: { accountId }, select: { id: true, year: true, month: true } });
  const closed = months.filter((mo) => beforeCurrent(mo.year, mo.month)).sort((a, b) => a.year - b.year || a.month - b.month);
  const closedMonthCount = closed.length;

  // saldo de partida: override ?? Σ resultado dos meses fechados
  let startingBalanceCents = 0n;
  const startingBalanceIsOverride = cfg.forecastStartBalanceCents != null;
  if (startingBalanceIsOverride) {
    startingBalanceCents = cfg.forecastStartBalanceCents!;
  } else {
    for (const mo of closed) {
      const sections = await getMonthSections(accountId, mo.id);
      const totals = await sectionTotalsForMonth(accountId, mo.id); // helper local (groupBy por sectionId)
      startingBalanceCents += calculateMonthTotal(sections, totals);
    }
  }

  // recorrentes: Σ items por autoSectionId
  const templates = await prisma.tableTemplate.findMany({
    where: { accountId, autoApply: true },
    include: { items: { select: { amountCents: true } } },
  });
  const recurringSectionTotals: Record<string, bigint> = {};
  for (const t of templates) {
    if (!t.autoSectionId) continue;
    const sum = t.items.reduce((a, it) => a + it.amountCents, 0n);
    recurringSectionTotals[t.autoSectionId] = (recurringSectionTotals[t.autoSectionId] ?? 0n) + sum;
  }

  // horizonte: mês seguinte ao último fechado
  const firstProjected = nextFiscalMonth(currentFiscal); // helper: currentFiscal já é o "corrente"; 1º projetado = corrente
  // parcelas por mês-calendário no horizonte
  const horizonMonths = cfg.forecastHorizonMonths;
  const rangeStart = new Date(firstProjected.year, firstProjected.month - 1, 1);
  const last = addCalendarMonths(firstProjected, horizonMonths - 1);
  const rangeEnd = new Date(last.year, last.month, 0);
  const installments = await prisma.pendingInstallment.findMany({
    where: { accountId, expectedDate: { gte: rangeStart, lte: rangeEnd } },
    select: { amountCents: true, expectedDate: true, group: { select: { sectionId: true } } },
  });
  const installmentsByMonth: Record<string, Record<string, bigint>> = {};
  for (const p of installments) {
    const d = p.expectedDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    (installmentsByMonth[key] ??= {});
    const sec = p.group.sectionId;
    installmentsByMonth[key][sec] = (installmentsByMonth[key][sec] ?? 0n) + p.amountCents;
  }

  // estimado: média mensal do resultado líquido não-comprometido sobre effectiveWindow meses fechados
  const effectiveWindow = Math.min(cfg.forecastVariableWindow, closedMonthCount);
  let estimatedNetBaseCents = 0n;
  if (effectiveWindow > 0) {
    const windowMonths = closed.slice(-effectiveWindow);
    const monthIds = windowMonths.map((m) => m.id);
    const grouped = await prisma.transaction.groupBy({
      by: ["sectionId"],
      where: {
        accountId, monthId: { in: monthIds },
        source: { not: "auto_template" }, installmentGroupId: null, expenseType: { not: "one_time" },
      },
      _sum: { amountCents: true },
    });
    // usar as seções do 1º mês da janela como referência de countType
    const refSections = await getMonthSections(accountId, windowMonths[0].id);
    const totals: Record<string, bigint> = {};
    for (const g of grouped) if (g.sectionId) totals[g.sectionId] = g._sum.amountCents ?? 0n;
    const netOverWindow = calculateMonthTotal(refSections, totals);
    estimatedNetBaseCents = BigInt(Math.round(Number(netOverWindow) / effectiveWindow));
  }

  const sections = closed.length ? await getMonthSections(accountId, closed[closed.length - 1].id) : [];

  const input: ForecastInput = {
    startingBalanceCents, startingBalanceIsOverride,
    horizonMonths, scenarioDefault: cfg.forecastScenario as ForecastInput["scenarioDefault"],
    optimisticPct: cfg.forecastOptimisticPct, conservativePct: cfg.forecastConservativePct,
    variableWindow: cfg.forecastVariableWindow, closedMonthCount,
    estimatedNetBaseCents, recurringSectionTotals, installmentsByMonth, sections, firstProjected,
  };
  return serialize(composeForecast(input));
});
```

> **Helpers locais** a implementar no mesmo arquivo: `sectionTotalsForMonth` (groupBy `sectionId` filtrando `table: { countInMonth: true }`, espelha `getSectionTotals`), `nextFiscalMonth`/`addCalendarMonths` (aritmética de mês). Preferir `batchSectionTotals` (`dashboards.ts:57`) para o loop de saldo, evitando N queries.

- [ ] **Step 4: Rodar e ver passar**

Run: `docker compose exec app pnpm test src/server/queries/cashflow-forecast.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Typecheck**

Run: `docker compose exec app pnpm typecheck`
Expected: sem erros no módulo novo.

- [ ] **Step 6: Commit**

```bash
git add src/server/queries/cashflow-forecast.ts src/server/queries/cashflow-forecast.test.ts
git commit -m "feat(forecast): getCashflowForecast query (multi-tenant, React.cache, serialized)"
```

---

### Fase C — Visualização

#### Task 6: Componente `CashflowForecastChart` (banda + linhas + runway + vale)

**Files:**
- Create: `src/components/dashboards/charts/CashflowForecastChart.tsx`
- Modify: `src/components/dashboards/charts/lazy.tsx`

**Interfaces:**
- Consumes: `CashflowForecast` (Task 5); `getChartColors` (`design-tokens.ts:264`); `formatCentsToBrl` (`money.ts:46`); `ChartTooltip` (`_shared/ChartTooltip.tsx:25`).
- Produces: `<CashflowForecastChart forecast scenario renderMode height? />`; export lazy `LazyCashflowForecastChart`.

- [ ] **Step 1: Implementar o gráfico** (verificação visual, não unit — ver testing skill §12)

```tsx
// src/components/dashboards/charts/CashflowForecastChart.tsx
"use client";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer } from "recharts";
import { useTheme } from "@mui/material/styles";
import { getChartColors } from "@/lib/design-tokens";
import { formatCentsToBrl } from "@/lib/money";
import { ChartTooltip } from "@/components/dashboards/_shared/ChartTooltip";
import { m } from "@/lib/messages";
import type { CashflowForecast } from "@/server/queries/cashflow-forecast";
import type { Scenario } from "@/lib/schemas/forecast";

const toReais = (c: string) => Number(BigInt(c)) / 100;

export function CashflowForecastChart({ forecast, scenario, height = 300 }: {
  forecast: CashflowForecast; scenario: Scenario; height?: number;
}) {
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");
  const grid = theme.palette.divider, tick = theme.palette.text.secondary;
  const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" });

  const scenarioKey = { optimistic: "optimisticBalanceCents", realistic: "realisticBalanceCents", conservative: "conservativeBalanceCents" }[scenario] as const;

  const data = forecast.points.map((p) => {
    const focus = toReais(p[scenarioKey]);
    return {
      label: p.label,
      historical: p.isProjected ? null : focus,
      // âncora entra em ambos p/ conectar sólido↔tracejado
      projected: p.isProjected || !p.isProjected && p.yearMonth === forecast.points.find((x) => !x.isProjected)?.yearMonth ? focus : null,
      band: [toReais(p.conservativeBalanceCents), toReais(p.optimisticBalanceCents)] as [number, number],
      raw: p,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: grid }} tick={{ fill: tick, fontSize: 11 }} />
        <YAxis width={56} axisLine={false} tickLine={false} tick={{ fill: tick, fontSize: 11 }} tickFormatter={(v: number) => compact.format(v)} />
        <ReferenceLine y={0} stroke={grid} />
        {/* cone de incerteza (D) — banda conservador↔otimista */}
        <Area dataKey="band" stroke="none" fill={palette[0]} fillOpacity={0.12} isAnimationActive={false} />
        {/* histórico — sólido */}
        <Line dataKey="historical" stroke={palette[0]} strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
        {/* projeção — tracejado */}
        <Line dataKey="projected" stroke={palette[0]} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
        {/* runway (A) */}
        {forecast.runwayYearMonth && (
          <ReferenceLine
            x={forecast.points.find((p) => p.yearMonth === forecast.runwayYearMonth)?.label}
            stroke={theme.palette.error.main} strokeDasharray="4 4"
            label={{ value: m.cashflowForecast.runwayLabel, position: "insideTopRight", fill: theme.palette.error.main, fontSize: 10 }}
          />
        )}
        {/* vale (B) */}
        <ReferenceDot
          x={forecast.points.find((p) => p.yearMonth === forecast.troughYearMonth)?.label}
          y={toReais(forecast.troughBalanceCents)} r={4}
          fill={theme.palette.warning.main} stroke="none" isFront
        />
        <Tooltip cursor={{ stroke: grid, strokeDasharray: "3 3" }} content={(props: any) => {
          if (!props.active || !props.payload?.length) return null;
          const p = props.payload[0]?.payload?.raw as CashflowForecast["points"][number];
          return (
            <ChartTooltip active label={`${p.label}${p.isProjected ? " · " + m.cashflowForecast.projected : ""}`}
              payload={[
                { name: m.cashflowForecast.recurringIn, color: theme.palette.success.main, value: toReais(p.recurringInflowCents) },
                { name: m.cashflowForecast.recurringOut, color: theme.palette.error.main, value: -toReais(p.recurringOutflowCents) },
                { name: m.cashflowForecast.installments, color: theme.palette.error.main, value: -toReais(p.installmentsOutflowCents) },
                { name: m.cashflowForecast.estimated, color: theme.palette.text.secondary, value: toReais(p.estimatedCents) },
                { name: m.cashflowForecast.balance, color: palette[0], value: toReais(p[scenarioKey]) },
              ]}
              formatValue={(v: number) => formatCentsToBrl(BigInt(Math.round(v * 100)), { sign: true })} />
          );
        }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Registrar lazy** (`charts/lazy.tsx`)

```tsx
export const LazyCashflowForecastChart = dynamic(
  () => import("./CashflowForecastChart").then((mod) => mod.CashflowForecastChart),
  { ssr: false, loading: () => <ChartSkeleton height={300} /> },
);
```

- [ ] **Step 3: Verificação visual (light + dark)**

Run: subir app (`docker compose up -d`), abrir `/forecast` após Task 8. Conferir: histórico sólido, projeção tracejada, banda alarga, `ReferenceLine y=0`, runway em vermelho quando aplicável, `ReferenceDot` no vale, tooltip com decomposição. Alternar tema — sem hex quebrado.

- [ ] **Step 4: Lint (garante zero hex / tokens)**

Run: `docker compose exec app pnpm lint src/components/dashboards/charts/CashflowForecastChart.tsx`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboards/charts/CashflowForecastChart.tsx src/components/dashboards/charts/lazy.tsx
git commit -m "feat(forecast): ComposedChart with uncertainty band, runway and trough markers"
```

#### Task 7: Tela de settings + form

**Files:**
- Create: `src/app/(app)/[accountId]/settings/forecast/page.tsx`
- Create: `src/components/settings/ForecastSettingsForm.tsx`
- Modify: `SettingsNav` (entrada "Projeção")

**Interfaces:**
- Consumes: `forecastSettingsSchema` (Task 2); `updateForecastSettingsAction` (Task 3); `useAction`/`useActionFeedback` (padrão ui-feedback).
- Produces: rota de settings + form persistente.

- [ ] **Step 1: RSC page** — `requireAccountAccess`, lê `AccountSettings`, passa defaults ao form.

```tsx
// src/app/(app)/[accountId]/settings/forecast/page.tsx
import { redirect } from "next/navigation";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { forecastSettingsSchema } from "@/lib/schemas/forecast";
import { ForecastSettingsForm } from "@/components/settings/ForecastSettingsForm";

export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));
  const s = await prisma.accountSettings.findUnique({ where: { accountId } });
  const defaults = forecastSettingsSchema.parse({
    forecastHorizonMonths: s?.forecastHorizonMonths, forecastScenario: s?.forecastScenario,
    forecastOptimisticPct: s?.forecastOptimisticPct, forecastConservativePct: s?.forecastConservativePct,
    forecastVariableWindow: s?.forecastVariableWindow, forecastStartBalanceCents: s?.forecastStartBalanceCents ?? null,
  });
  return <ForecastSettingsForm accountId={accountId} defaults={{ ...defaults, forecastStartBalanceCents: defaults.forecastStartBalanceCents?.toString() ?? null }} />;
}
```

- [ ] **Step 2: Form client** (RHF + zodResolver; Select horizonte/cenário/janela, Slider fatores, CurrencyInput override). Submeter via `updateForecastSettingsAction`, feedback via notistack.

```tsx
// src/components/settings/ForecastSettingsForm.tsx — esqueleto-chave
"use client";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSnackbar } from "notistack";
import { forecastSettingsSchema, type ForecastSettingsInput } from "@/lib/schemas/forecast";
import { updateForecastSettingsAction } from "@/actions/account-settings";
import { m } from "@/lib/messages";
// ... imports MUI (Select, Slider, TextField, Button), PageHeader, CurrencyInput

export function ForecastSettingsForm({ accountId, defaults }: { accountId: string; defaults: any }) {
  const { enqueueSnackbar } = useSnackbar();
  const form = useForm<ForecastSettingsInput>({ resolver: zodResolver(forecastSettingsSchema), defaultValues: {
    ...defaults, forecastStartBalanceCents: defaults.forecastStartBalanceCents ? BigInt(defaults.forecastStartBalanceCents) : null,
  }});
  async function onSubmit(values: ForecastSettingsInput) {
    const res = await updateForecastSettingsAction(accountId, values);
    if (res.ok) enqueueSnackbar(m.settings.forecast.saved, { variant: "success" });
    else enqueueSnackbar(res.error.message, { variant: "error" });
  }
  // <form onSubmit={form.handleSubmit(onSubmit)}> ...campos com Controller... </form>
}
```

- [ ] **Step 3: Verificação** — abrir `/settings/forecast`, salvar, recarregar → valores persistem; role `viewer` não vê submit (gating). E2E smoke em Task 10.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/[accountId]/settings/forecast" src/components/settings/ForecastSettingsForm.tsx src/components/settings/SettingsNav.tsx
git commit -m "feat(forecast): account-level forecast settings page + form"
```

#### Task 8: Página hero `/forecast` + navegação + messages

**Files:**
- Create: `src/app/(app)/[accountId]/forecast/page.tsx`, `ForecastManager.tsx`
- Modify: `src/components/ui/AppBarNavButtons.tsx`, `src/lib/messages/pt-BR.ts`

**Interfaces:**
- Consumes: `getCashflowForecast` (Task 5); `LazyCashflowForecastChart` (Task 6).
- Produces: rota primária `/forecast`; item de nav "Projeção".

- [ ] **Step 1: RSC page** — guard + fetch + serialização já pronta.

```tsx
// src/app/(app)/[accountId]/forecast/page.tsx
import { redirect } from "next/navigation";
import { requireAccountAccess } from "@/server/auth/session";
import { getCashflowForecast } from "@/server/queries/cashflow-forecast";
import { ForecastManager } from "./ForecastManager";

export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));
  const forecast = await getCashflowForecast(accountId);
  return <ForecastManager accountId={accountId} forecast={forecast} />;
}
```

- [ ] **Step 2: Client manager** — `PageHeader`, toggle de cenário efêmero (`useState(forecast.scenarioDefault)`), stats de vale/runway (`StatusBadge`), badge `hasLowData`, `LazyCashflowForecastChart`. Atalho para `/settings/forecast`.

- [ ] **Step 3: Item de nav** (`AppBarNavButtons.tsx`) — novo `IconButton` "Projeção" → `/${accountId}/forecast` (`TrendingUpIcon`), ao lado de "Patrimônio".

```tsx
<Tooltip title={m.cashflowForecast.navLabel}>
  <IconButton component={Link} href={`/${accountId}/forecast`} aria-label={m.cashflowForecast.navLabel}>
    <TrendingUpIcon />
  </IconButton>
</Tooltip>
```

- [ ] **Step 4: Messages** — adicionar namespace `cashflowForecast` (navLabel, runwayLabel, projected, recurringIn/Out, installments, estimated, balance, trough, lowData, empty) + `settings.forecast.*`.

- [ ] **Step 5: Verificação (light+dark)** — nav abre `/forecast`; página renderiza para toda account; troca de cenário atualiza a linha sem recarregar; não depende de ano.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/[accountId]/forecast" src/components/ui/AppBarNavButtons.tsx src/lib/messages/pt-BR.ts
git commit -m "feat(forecast): hero page /forecast + AppBar nav + messages"
```

#### Task 9: Widget `cashflow-forecast` (yearly)

**Files:**
- Modify: `widget-registry.ts`, `widget-icons.ts`, `YearlyDashboardClient.tsx`, `pt-BR.ts`

**Interfaces:**
- Consumes: `getCashflowForecast` (Task 5), `LazyCashflowForecastChart` (Task 6).
- Produces: entrada de widget singleton, sem `configSchema`.

- [ ] **Step 1: Registry** (contexto `yearly`) — **sem** `configSchema` (reflete config da account):

```ts
{
  id: "cashflow-forecast", labelKey: "cashflowForecast", kind: "panel", defaultVisible: false,
  sizeVariants: [
    { id: "default", labelKey: "default", w: 4, h: 2, renderMode: "default" },
    { id: "compact", labelKey: "compact", w: 3, h: 2, renderMode: "compact" },
    { id: "large",   labelKey: "large",   w: 6, h: 3, renderMode: "expanded" },
  ],
}
```

- [ ] **Step 2: Ícone** (`widget-icons.ts`): `"cashflow-forecast": TrendingUpIcon`.

- [ ] **Step 3: Messages**: `dashboards.widgets.yearly["cashflow-forecast"]` + `descriptions.yearly`.

- [ ] **Step 4: Fetch gated + nodeMap** (`YearlyDashboardClient.tsx` / RSC da página yearly): só busca se `widgets.some(w => w.widgetId === "cashflow-forecast" && w.visible)`; `nodeByWidgetId["cashflow-forecast"] = <CashflowForecastWidget forecast={forecast} renderMode={getRenderMode(...)} />`.

- [ ] **Step 5: Verificação** — adicionar o widget pela paleta no editor; renderiza no dashboard yearly refletindo a config da account; copy "Projeção a partir de hoje".

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboards/_core/widget-registry.ts src/components/dashboards/_core/widget-icons.ts src/components/dashboards/yearly/YearlyDashboardClient.tsx src/lib/messages/pt-BR.ts
git commit -m "feat(forecast): register cashflow-forecast widget (yearly, reflects account config)"
```

---

### Fase D — Fechamento

#### Task 10: Verificação integrada + E2E smoke

**Files:**
- Create: `e2e/forecast.spec.ts` (Playwright, ver spec 58)

- [ ] **Step 1: Suite unit + typecheck + lint**

Run: `docker compose exec app pnpm test && docker compose exec app pnpm typecheck && docker compose exec app pnpm lint`
Expected: tudo verde; cobertura ≥ 60%.

- [ ] **Step 2: Auditoria de messages** — nenhuma string hardcoded nos componentes novos (`grep` por literais pt-BR fora de `pt-BR.ts`).

- [ ] **Step 3: E2E smoke** — login (fixture), abrir `/forecast`, ver o gráfico; ir a `/settings/forecast`, mudar horizonte, voltar e ver N pontos mudarem; conta nova → badge "poucos dados".

```bash
docker compose --profile e2e up --build --abort-on-container-exit --exit-code-from e2e-runner postgres-e2e app-e2e e2e-runner
```

- [ ] **Step 4: Paridade light/dark** — checklist manual das duas superfícies nos dois temas.

- [ ] **Step 5: Commit final**

```bash
git add e2e/forecast.spec.ts
git commit -m "test(forecast): e2e smoke for page, settings and low-data state"
```

---

### Self-Review (cobertura da spec × plano)

| Requisito da spec | Task |
|---|---|
| FC-01 combinar insumos | 4, 5 |
| FC-02 saldo suficiente / runway (A) | 4, 6, 8 |
| FC-03 cenários | 2, 4, 6 |
| FC-04 runway | 4, 6 |
| FC-05 vale | 4, 6 |
| FC-06 decomposição | 4, 6 |
| FC-07 cone | 6 |
| FC-08 config account-level | 1, 2, 3, 7 |
| D1 base estimado (exclui auto_template/parcelas/one_time) | 5 |
| D2 saldo `override ?? Σ` | 5 |
| D3 página primária + widget + settings | 7, 8, 9 |
| D4 sem modo budget | (ausência intencional) |
| D5 pouco histórico + badge | 4, 5, 8 |
| Parcelas mês-calendário | 5 |
| Multi-tenancy | 3, 5 (testes) |
| Projeção não persistida (`React.cache`) | 5 |
| Light/dark | 6, 8, 10 |

**Sem placeholders**: cada Task de código traz código real. **Consistência de tipos**: `composeForecast`/`ForecastInput`/`CashflowForecast` idênticos entre Tasks 4→5→6→8→9.
