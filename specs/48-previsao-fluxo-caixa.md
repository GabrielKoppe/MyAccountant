# Spec 48 — Previsão de Fluxo de Caixa

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Profundidade Financeira
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`dashboards-charts`](../skills/dashboards-charts/SKILL.md) · [`performance`](../skills/performance/SKILL.md)

---

## 1. Problema

- **FC-01**: O app possui todos os insumos de uma projeção — `TableTemplate` com `autoApply` (recorrentes, spec 24), `PendingInstallment` com `expectedDate` (parcelas futuras, spec 41 TRN-02) e `Budget` (limites previstos, spec 25) — mas **não combina nada disso numa projeção de saldo futuro**. O usuário enxerga apenas o passado (meses já lançados).
- **FC-02**: Sem projeção, é impossível responder "vou ter caixa suficiente nos próximos 3 meses?". Monarch cobra à parte por forecasting; aqui os dados já existem e estão sendo desperdiçados.
- **FC-03**: Não há nenhuma noção de **cenário**: a mesma base poderia ser projetada de forma otimista ou conservadora, mas hoje não há sequer a projeção realista.

---

## 2. Solução

Serviço de **projeção derivada** (cálculo em tempo de leitura, **sem persistência de modelo pesado**) que combina os insumos existentes e produz uma série de saldo projetado para N meses à frente, com cenários simples. Marca-se explicitamente: **isto é cálculo, não estado armazenado** — nenhuma tabela nova de projeção.

- **FC-01**: `cashflow-forecast-service` agrega, por mês futuro: (a) recorrentes previstos dos `TableTemplate` com `autoApply = true`; (b) `PendingInstallment` cujo `expectedDate` cai no mês; (c) opcionalmente, valores previstos por `Budget` recorrente. O ponto de partida é o saldo corrente (resultado acumulado do último mês fechado).
- **FC-02**: widget de **linha projetada** mostrando o saldo acumulado para os próximos N meses (config do widget, padrão 6).
- **FC-03**: cenários simples aplicados como multiplicadores sobre o componente variável da projeção:
  - *realista* (padrão): recorrentes + parcelas + média recente de variáveis.
  - *otimista*: variáveis reduzidas por um fator configurável.
  - *conservador*: variáveis aumentadas por um fator configurável.

Nenhuma alteração de schema. A projeção é calculada sob demanda e cacheada por request com `React.cache`.

```
// Tipo de saída (sem persistência):
// ForecastPoint { yearMonth: string; projectedBalanceCents: bigint; inflowCents: bigint; outflowCents: bigint }
// CashflowForecast { scenario: 'optimistic' | 'realistic' | 'conservative'; points: ForecastPoint[] }
```

---

## 3. User Stories

- Como usuário, quero ver a projeção do meu saldo para os próximos meses, para saber se terei caixa suficiente.
- Como usuário, quero que a projeção use minhas recorrentes e parcelas futuras já cadastradas, para não ter que reinformar nada.
- Como usuário, quero alternar entre cenário otimista, realista e conservador, para entender o intervalo de possibilidades.
- Como usuário, quero escolher quantos meses à frente projetar, para ajustar o horizonte ao meu planejamento.

---

## 4. Critérios de Aceitação

- QUANDO a projeção é solicitada, O SERVIÇO DEVE compor cada mês futuro a partir de: recorrentes (`TableTemplate.autoApply = true`), `PendingInstallment` por `expectedDate`, e o saldo corrente como ponto de partida — tudo em `BigInt` centavos.
- QUANDO uma data de mês futuro é calculada, O SERVIÇO DEVE respeitar `account_settings.month_start_day` para delimitar o mês, conforme convenção de datas do projeto.
- SE o cenário for `optimistic` ou `conservador`, O SERVIÇO DEVE aplicar o fator de ajuste **apenas** ao componente variável estimado; recorrentes e parcelas (valores conhecidos) NÃO DEVEM ser ajustados.
- O SERVIÇO NÃO DEVE persistir a projeção em nenhuma tabela — DEVE ser calculada por request e cacheada com `React.cache`.
- QUANDO não há recorrentes nem parcelas futuras, A PROJEÇÃO DEVE retornar o saldo corrente constante para todos os meses (sem erro).
- ENQUANTO a quantidade de meses (`N`) for configurada no widget, A PROJEÇÃO DEVE produzir exatamente `N` pontos a partir do mês seguinte ao último fechado.
- **Multi-tenancy**: QUANDO o serviço lê recorrentes, parcelas ou orçamentos, ele DEVE filtrar por `accountId`; a projeção NÃO DEVE misturar dados de outra account.
- O WIDGET de linha DEVE renderizar a série com cores do tema em light e dark mode, distinguindo visualmente o trecho projetado do histórico.

---

## 5. Fora de Escopo

- **Persistência da projeção** — é cálculo, não estado; não há modelo novo.
- **Machine learning / previsão estatística** — cenários são multiplicadores simples, não modelos preditivos.
- **Integração com saldo bancário real** — ponto de partida vem do resultado acumulado, não de Open Finance (spec 52).
- **Projeção de patrimônio líquido** (ativos/passivos) — fica para evolução futura combinando com a spec 46.
- **Alertas de saldo negativo projetado** — coberto pela spec 29 (notificações).

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Persistência | Nenhuma; cálculo derivado | Insumos já existem; estado novo introduziria divergência |
| Cache | `React.cache` por request | Evita recomputar a projeção em múltiplos widgets do mesmo render |
| Cenários | Multiplicador sobre o componente variável | Simples e explicável; valores conhecidos permanecem fixos |
| Componente variável | Média móvel recente das transações `variable` (spec 41 TRN-01) | Aproveita classificação fixo/variável já existente |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Service de projeção (derivado) | `src/server/services/cashflow-forecast-service.ts` (novo) |
| Leitura de recorrentes | `src/server/services/table-template-service.ts` (consumir, não alterar) |
| Leitura de parcelas futuras | `prisma/schema.prisma` model `PendingInstallment` (`expectedDate`) |
| Delimitação de mês | convenção de `month_start_day` — `specs/06-months.md` |
| Widget de linha projetada | `src/components/dashboard/widgets/` (novo widget `cashflow-forecast`) |
| Labels de UI | `src/lib/messages/pt-BR.ts` |
| Recorrentes (não duplicar) | `specs/24-recurring-transactions.md` |
| Parcelas (não duplicar) | `specs/41-aprimoramentos-objeto-transacao.md` TRN-02 |
