# Spec 41 — Aprimoramentos do Objeto Transação

> Status: draft
> Insumo: refinamento da Spec 38 (FEAT-05 extraído); conversa de produto (2026-06-21) sobre gastos fixos/variáveis, parcelamento vinculado e enriquecimento do objeto Transaction.
> Relacionado: [`spec 09`](09-transactions.md) (CRUD base) · [`spec 24`](24-recurring-transactions.md) (templates automáticos) · [`spec 38`](38-novos-widgets-dashboard.md) (widget `recurring-vs-variable` aguardando esta spec)
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

O objeto `Transaction` cresceu organicamente a cada spec e hoje acumula limitações que afetam tanto a qualidade analítica quanto a experiência de lançamento:

- **TRN-01 — Sem distinção fixo vs variável**: `Transaction` não tem flag de "gasto fixo". A única proxy existente é `RecurringTransaction` (origem de template automático), que não cobre despesas fixas lançadas manualmente (aluguel, assinatura avulsa, mensalidade). Não é possível calcular "quanto do orçamento já está comprometido antes do mês começar" nem exibir o widget `recurring-vs-variable` (spec 38 FEAT-05).

- **TRN-02 — Parcelamento sem vínculo**: `cardInstallment` é um campo `String?` livre ("2/12", "3ª parcela", etc.). Parcelas de uma mesma compra não estão relacionadas entre si — é impossível ver o total da compra, navegar entre parcelas, saber quando acaba, calcular o compromisso futuro ou reeditar todas de uma vez. O campo é um texto solto que o usuário preenche por convenção, sem validação nem estrutura.

- **TRN-03 — Sem rastreamento de origem**: não há registro de como uma transação foi criada (manualmente, via importação CSV/XLSX, via template automático, via duplicação). Isso impede filtros por origem, auditoria básica e potencial tratamento diferenciado na UI.

- **TRN-04 — Tags livres ausentes**: `category` e `subcategory` são hierárquicas e pré-cadastradas. Não existe forma de adicionar rótulos ad-hoc sem criar uma categoria nova (ex: "viagem Paris 2026", "IPTU 2026", "presente Natal"). Tags livres complementariam o sistema de categorias sem substituí-lo.

---

## 2. Ideias de Solução (rascunho — a refinar)

> Esta seção é intencional mente preliminar. As decisões definitivas serão tomadas no refinamento desta spec.

### 2.1 TRN-01 — Flag de gasto fixo (`isFixed`)

Adicionar `isFixed Boolean @default(false)` na `Transaction`. Gastos fixos são aqueles que se repetem todo mês num valor previsível (aluguel, assinatura, mensalidade, salário).

**Pontos abertos:**
- Como popular nas transações existentes? (migração com default `false`, população manual via bulk edit, ou auto-detecção heurística?)
- A flag é editável pelo usuário por transação individualmente? Em bulk? Ou derivada automaticamente de alguma regra (ex: transação criada por template automático = fixa)?
- Transações geradas por `RecurringTransaction` (spec 24) devem nascer com `isFixed = true` automaticamente?
- No formulário de criação/edição: toggle "Gasto fixo" simples, ou campo de agrupamento (ex: "Esta é a parcela X de uma série recorrente")?
- O campo se aplica a receitas também (receitas fixas como salário)?

**Desdobramento:** habilita o widget `recurring-vs-variable` da spec 38 FEAT-05 (percentual de gastos fixos vs variáveis no mês, com donut recharts).

### 2.2 TRN-02 — Grupos de parcelamento (`InstallmentGroup`)

Substituir o campo `cardInstallment String?` livre por um vínculo estruturado entre parcelas.

**Ideia base:**
- Novo modelo `InstallmentGroup`: representa a compra original. Campos candidatos: `description`, `totalCents` (valor total da compra), `installmentCount` (número total de parcelas), `startDate`, `accountId`.
- `Transaction` ganha `installmentGroupId String?` (FK para `InstallmentGroup`), substituindo `cardInstallment`.
- Ao registrar uma compra parcelada, o usuário informa o valor total + número de parcelas → o sistema cria o grupo e gera as N transações (uma por mês futuro, com `isPending = true` para as futuras).

**Pontos abertos:**
- Parcelas futuras são criadas automaticamente em meses que ainda não existem? Se não, como lidar com meses não criados?
- Editar o valor de uma parcela quebra o vínculo com o grupo ou apenas atualiza aquela instância?
- Cancelar/quitar antecipado: marcar as restantes como canceladas ou deletar?
- O campo `cardInstallment` (string legado) deve ser mantido para migração gradual ou deprecado imediatamente?
- Parcelamento com entrada diferente das demais parcelas?
- Juros compostos ou valor fixo por parcela?
- UI: ao visualizar uma parcela, exibir "X de Y parcelas" com link para ver todas as demais.

**Desdobramento:** widget futuro de "compromissos futuros" (total de parcelas restantes por mês) no dashboard.

### 2.3 TRN-03 — Origem da transação (`source`)

Adicionar `source Enum { manual, import, template, recurring, duplicate }` em `Transaction`.

**Pontos abertos:**
- `template` e `recurring` são distintos? (template aplicado manualmente vs template automático da spec 24)
- Mostrar a origem na UI (badge discreto no painel de detalhes) ou apenas para filtros?
- Filtrar por origem nas telas de transação (spec 19)?
- Backfill de transações existentes: todas ficam como `manual`?

### 2.4 TRN-04 — Tags livres

Adicionar suporte a tags livres em `Transaction` (rótulos ad-hoc sem hierarquia).

**Pontos abertos:**
- Modelo: `Tag { id, accountId, name }` + relação N:N com `Transaction`? Ou array de strings em `metadata`?
- Tags são por Account (compartilhadas entre membros) ou por usuário?
- Filtrar transações por tag (integração com spec 19)?
- Autocompletar ao digitar (baseado em tags já usadas na account)?
- Limite de tags por transação?

---

## 3. Widgets dependentes desta spec

| Widget | Spec de origem | Bloqueador |
|---|---|---|
| `recurring-vs-variable` (donut fixo vs variável) | Spec 38 FEAT-05 | TRN-01 (`isFixed`) |
| `installment-forecast` (compromissos futuros por mês) | — | TRN-02 (grupos de parcelamento) |

---

## 4. Fora de Escopo (candidatos explícitos)

- **Parcelamento com juros compostos**: calcular CET / taxa efetiva mensal — complexidade financeira fora do foco do produto.
- **Substituição total do sistema de categorias por tags**: tags são complemento, não substituto.
- **Sincronização com fatura de cartão**: importar parcelas automaticamente de extratos bancários — coberto pela spec 10 (CSV/XLSX import) e possível integração futura com Open Finance.
- **Alertas de vencimento de parcelas**: notificações → spec 29.

---

## 5. Referências

| Item | Arquivo |
|---|---|
| Schema atual de Transaction | `prisma/schema.prisma` (model Transaction, linha ~320) |
| CRUD de Transaction | `specs/09-transactions.md` |
| Templates automáticos (spec 24) | `specs/24-recurring-transactions.md` |
| Widget deferred de spec 38 | `specs/38-novos-widgets-dashboard.md` §2.5 |
| Filtros de transação | `specs/19-transaction-search-filter-sort.md` |
| Painel de detalhes | `specs/27-transaction-detail-panel.md` |
