# Spec 36 — Configuração Interna de Widgets (Fase 2)

> Status: placeholder
> Depende de: [Spec 33 — Widgets Configuráveis](./33-dashboard-widgets.md) (deve estar implementada e em produção).
> Origem: decisão de escopo na Spec 33 — configuração interna de widgets adiada para esta spec.

---

## Contexto

A Spec 33 introduziu o sistema de widgets: o usuário pode reordenar e ativar/desativar widgets por área (monthly, yearly, month_summary). O que ficou fora de escopo foi a **configuração do conteúdo interno** de cada widget — ou seja, não só "mostrar ou não mostrar", mas **como** cada widget se apresenta.

## Problema (a detalhar)

Exemplos de configurações internas possíveis por widget:

- `kpi-month-total` — mostrar delta vs mês anterior ou vs ano anterior?
- `money-flow` (Sankey) — agrupar por seção ou por categoria?
- `category-treemap` — limitar ao top N categorias?
- `budgets` — mostrar apenas metas próximas do limite ou todas?
- `top-transactions` — quantas transações exibir (5, 10, 20)?

Cada widget tem um **schema de configuração diferente**. A UI de edição precisará ser dinâmica por widget.

## Solução (rascunho)

- Cada `WidgetDef` no registry ganharia um `configSchema?: ZodSchema` opcional.
- O `DashboardLayout.widgets` passaria de `string[]` para `Array<{ widgetId: string; config?: JsonObject }>`.
- O `WidgetCard` ativo exibiria um botão de engrenagem (⚙) que abre um mini-form com as opções do widget.
- A configuração seria salva junto com o layout (mesmo upsert).

## O que precisa ser definido antes de escrever esta spec

- Quais widgets terão configuração e quais opções cada um suporta.
- Como o mini-form de configuração é apresentado (inline no card? popover? drawer?).
- Como o schema de configuração é tipado no registry sem acoplar lógica de UI ao registry.
- Impacto na migração de dados: `string[]` → `Array<{ widgetId, config? }>`.
