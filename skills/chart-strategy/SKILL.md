# SKILL — Estratégia de Visualização Financeira

## Quando usar

Sempre que for **sugerir, escolher, criticar ou enriquecer** uma visualização de dados financeiros — criar um widget/gráfico novo, revisar um existente, ou responder "que gráfico uso para X?", "como visualizar Y?", "que insight tiro daqui?". O objetivo é trazer **criatividade e contexto que o usuário não pensaria em pedir** — não só "plotar os dados".

> **Divisão de responsabilidade com [`dashboards-charts`](../dashboards-charts/SKILL.md):**
> - **Este skill (`chart-strategy`)** = a camada de **decisão e criatividade**: qual gráfico responde à pergunta, o que está errado numa escolha, o que adicionar para virar insight acionável.
> - **`dashboards-charts`** = a camada **técnica**: como renderizar corretamente neste código (BigInt→Number na borda, `getChartColors`, `ChartTooltip`/`PieLegend`, `DrillDownDrawer`, Sankey via `next/dynamic`, sem hex hardcoded).
>
> Decida aqui; **renderize seguindo `dashboards-charts`**. Toda regra de cor/dinheiro de lá vale aqui.

---

## 1. As 3 perguntas antes de qualquer gráfico

Antes de devolver uma sugestão ou código, percorra sempre:

1. **Que pergunta este gráfico tenta responder?**
2. **Esse é o formato visual certo para essa pergunta?**
3. **O que falta para a resposta ser acionável (e não só bonita)?**

A pergunta 3 é a que mais gera valor e a mais esquecida — ver §5.

---

## 2. Decisão: tipo de pergunta → família de gráfico

Classifique a necessidade numa destas categorias antes de escolher. Isso evita o erro nº 1: usar barra para tudo.

| Categoria da pergunta | Exemplo | Família indicada | Componente no projeto |
|---|---|---|---|
| **Composição** (como o todo se divide) | "Para onde foi meu dinheiro?" | Treemap; donut só se ≤5–6 categorias | `CategoryTreemap`, `SectionPieChart`/`PieBreakdown` |
| **Evolução no tempo** | "Meu saldo está crescendo?" | Linha / área | `YearlyLineChart`, `MemberTrendChart` |
| **Comparação entre categorias** | "Gastei mais em quê vs mês passado?" | Barras agrupadas / divergentes | `MonthlyBarChart`, `BreakdownBarChart`, `BarList` |
| **Fluxo / transformação** | "Como a receita vira saldo líquido?" | Sankey, waterfall | `SankeyChart` (`@nivo/sankey`) |
| **Distribuição / consistência** | "Meus gastos diários são erráticos?" | Heatmap, histograma | `DailyHeatmap`, `WeeklySpendingWidget` |
| **Progresso vs meta** | "Estou perto da meta?" | Gauge, barra c/ linha de meta | `BudgetHealthKpi` |
| **Resumo + tendência** | "Como está o total, subindo ou caindo?" | KPI + sparkline + delta | `KpiSparklineCard`, `KpiCard` |

**Regras práticas:**
- Pergunta com "como mudou / evoluiu / ao longo do tempo" → eixo X é tempo, **nunca pizza**.
- "De onde vem / para onde vai" com etapas → **Sankey ou waterfall**, nunca barras simples.
- Alocação/composição **ao longo do tempo** → **área empilhada normalizada (100%)**, nunca uma sequência de pizzas.

---

## 3. Guia por domínio

### 3.1 Receitas e despesas
- **Gasto por categoria no período**: `CategoryTreemap` é superior a pizza com >6 categorias (comparar área > comparar ângulo). Reserve donut para ≤4–6 categorias com diferenças óbvias.
- **Receita vs despesa lado a lado**: barras agrupadas por mês **com linha de saldo líquido sobreposta** (combo) — responde "estou no azul ou no vermelho" sem o usuário calcular.
- **Fixo vs variável**: corte adicional (cor) separando despesa fixa de variável dentro da composição é um insight que o usuário raramente pede mas muda a leitura ("75% do gasto é fixo, pouca margem de corte rápido"). Use **cores semânticas do tema** (ver §7), nunca hex.
- **Sparkline em cards de resumo**: `KpiSparklineCard` já faz isso — tendência das últimas N semanas em miniatura.

### 3.2 Patrimônio e investimentos *(v3 — specs [46](../../specs/46-patrimonio-liquido.md))*
- **Evolução de patrimônio líquido (ativos − passivos)**: linha/área no tempo — é a tela "hero". Sobreponha marcos (§5).
- **Composição de carteira/ativos**: treemap com hierarquia (classe → ativo) via `children` aninhados.
- **Mudança de alocação no tempo**: **área empilhada normalizada (100%)**, nunca pizzas em sequência.
- **Comparação de rentabilidade**: indexe tudo a 100 na data inicial — comparar valores absolutos de escalas diferentes engana.

### 3.3 Fluxo de caixa e visão "negócio"
- **Receita → custos → líquido (estilo DRE)**: caso clássico de **Sankey** (`SankeyChart` já existe) — mostra de imediato "de cada R$1, quanto sobra". Waterfall é a alternativa quando o usuário quer os números absolutos em sequência.
- **Fluxo de caixa no tempo**: barras divergentes (entradas ↑ / saídas ↓ do zero) com linha de saldo acumulado.
- **Previsão de saldo** *(v3 — spec [48](../../specs/48-previsao-fluxo-caixa.md))*: projeção a partir de recorrentes + parcelas; mostre **faixa de incerteza**, não linha única (§5).
- **Sazonalidade**: com ≥2 anos, linhas sobrepostas por ano (mesmo mês no X, uma linha por ano) revela padrão que uma série contínua esconde.

---

## 4. Anti-padrões de **escolha** (sinalize ativamente)

> Estes são erros de **decisão visual**. Os anti-padrões **técnicos** (hex hardcoded, BigInt em recharts, `onClick` no `<BarChart>`, etc.) estão em [`dashboards-charts §9`](../dashboards-charts/SKILL.md).

- **Pizza com >6–7 fatias** → Treemap ou barras horizontais ordenadas.
- **Pizza 3D / com perspectiva** → nunca; distorce proporção (decorativo, não analítico).
- **Várias pizzas para mostrar mudança no tempo** → área/barras empilhadas.
- **Eixo Y não começando em zero em barras** → exagera diferenças; zero-based, ou troque por linha (onde cortar eixo é aceitável).
- **>5–6 linhas no mesmo gráfico temporal** ("espaguete") → destaque 2–3 em cor e o resto em cinza, ou *small multiples*.
- **Cor sem significado consistente** → se verde/vermelho é "receita/despesa" num gráfico, mantenha em **todos**. No projeto isso é garantido usando os tokens semânticos do tema (ver §7); inconsistência quebra a confiança nos dados.
- **Só valor absoluto quando % importa (e vice-versa)** → ofereça leitura/_toggle_ entre R$ e %.

---

## 5. Complementos de insight (o que **adicionar**, não só desenhar)

Esta é a camada que gera "uau" — adições que o usuário raramente pediria. Sempre sugira **pelo menos um**:

- **Linha de meta/orçamento sobreposta**: se há orçamento na categoria, sobreponha como linha tracejada no gasto real — transforma "quanto gastei" em "estou dentro do esperado?". (Conecta a `BudgetHealthKpi` / spec [25](../../specs/25-budget-targets.md).)
- **Média móvel (3/6 meses)**: em qualquer série de gasto/receita, suaviza ruído e revela tendência real.
- **Comparação YoY / MoM**: **já existe** o `ComparisonToggle` + `deltaMode` do `KpiSparklineCard` (`prevMonth | prevYear | avg3m`). Reuse — não reinvente. Anote a variação no gráfico (badge "+8% vs mês anterior").
- **Benchmark/faixa de referência**: p/ investimentos, sobreponha CDI/IBOV; p/ categorias, a média da Account.
- **Anotações de eventos**: marque pontos no eixo do tempo (13º salário, compra grande) — explica picos/vales que sem contexto parecem ruído.
- **Indicador de tendência ao lado de KPIs**: seta/cor mostrando direção vs período anterior (já no padrão `KpiSparklineCard`).
- **Faixa de projeção (incerteza)**: ao projetar saldo de fim de mês, mostre uma **faixa**, não uma linha — comunica incerteza honestamente (spec 48).
- **Drill-down**: todo gráfico que agrega deve permitir clicar e ver as transações por trás — use o `DrillDownDrawer` (padrão em [`dashboards-charts §7`](../dashboards-charts/SKILL.md)). É o complemento mais pedido em apps financeiros.

---

## 6. Processo de sugestão

Ao receber dados (ou um gráfico para revisar), siga **nesta ordem** — nunca pule direto para o código:

1. **Identifique a pergunta implícita** (composição? evolução? fluxo? comparação?).
2. **Cheque anti-padrões** se já existe gráfico — concreto, não genérico ("essa pizza tem 9 fatias, 3 somam <5% e ficam ilegíveis").
3. **Proponha o tipo** com uma frase de justificativa ligada à pergunta ("treemap porque são 12 categorias e você quer comparar tamanho relativo de imediato").
4. **Sugira ≥1 complemento da §5**, mesmo sem ser pedido.
5. **Renderize seguindo [`dashboards-charts`](../dashboards-charts/SKILL.md)** (componentes reais, tokens, BigInt).

> É o passo 1–2 que separa "gerador de gráfico" de "consultor de dados".

---

## 7. Traduzindo para o projeto (cores e dinheiro)

O `financas-visualizacao` original usava hex cru (`#6366f1`, `#22c55e`) e números soltos (`950`). **No MyAccountant isso é proibido.** A regra:

**Cor categórica** (séries sem significado fixo) → `getChartColors(mode)`:
```ts
import { getChartColors } from "@/lib/design-tokens";
const palette = getChartColors(theme.palette.mode as "light" | "dark");
// <Cell fill={palette[i % palette.length]} />
```

**Cor semântica financeira** (receita/despesa, fixo/variável, countType) → `theme.palette.*`:
```ts
// ✅ corte "fixo vs variável" com tokens (substitui o #6366f1/#f59e0b do original)
const colorFor = (entry: { fixo: boolean }) =>
  entry.fixo ? theme.palette.info.main : theme.palette.warning.main;

// receita/despesa/saldo
const RECEITA = theme.palette.success.main; // verde-musgo
const DESPESA = theme.palette.error.main;   // terracota (= danger no tema)
```

**Dinheiro** → sempre `BigInt` em centavos; converta só na borda de render e formate com o helper:
```ts
import { formatCentsToBrl } from "@/lib/money"; // ver skill money-handling
// dado do gráfico:
const value = Number(BigInt(s.totalCents)) / 100; // só aqui
// label/tooltip:
formatCentsToBrl(BigInt(s.totalCents));
```

Mapa de chart → componente real do projeto: ver tabela na §2. Para tooltip/legenda/treemap-cell/sankey/heatmap/drilldown, **reuse os componentes e padrões de [`dashboards-charts`](../dashboards-charts/SKILL.md)** em vez de escrever recharts do zero.

---

## 8. Resumo rápido

- Composição poucas categorias → donut; muitas → **treemap** (`CategoryTreemap`).
- Evolução → linha/área, **nunca pizza repetida**.
- Fluxo/DRE → **Sankey** (`SankeyChart`) ou waterfall.
- Alocação no tempo → **área empilhada normalizada**.
- Sempre sugira ≥1 complemento: meta sobreposta, média móvel, YoY/MoM (`ComparisonToggle`), benchmark ou drill-down (`DrillDownDrawer`).
- Sempre cheque: Y começa em zero (barras)? cor consistente entre telas? >6 fatias na pizza? >5 linhas no temporal?
- **Cor e dinheiro**: `getChartColors`/`theme.palette.*` + `BigInt`/`formatCentsToBrl`. Nunca hex, nunca número solto.
