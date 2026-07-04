# Spec 41 — Aprimoramentos do Objeto Transação

> Status: implemented (Fases 1–14 entregues em 2026-06; Fase 15 / TRN-05 adiada — ver §10). **Lote pós-Fase-15 entregue em 2026-07** (Fases 16–18): colunas `expenseType`/`tags`/`paymentMethod` expostas no picker de Tipo de Tabela, Método de pagamento (TRN-11) e entrada rápida no lançamento manual (TRN-12) — ver §10.
> Insumo: refinamento da Spec 38 (FEAT-05 extraído); conversa de produto (2026-06-21) sobre gastos fixos/variáveis, parcelamento vinculado e enriquecimento do objeto Transaction; benchmark de mercado (2026-06-23); entrevista de refinamento (2026-06-23).
> Relacionado: [`spec 09`](09-transactions.md) (CRUD base) · [`spec 10`](10-csv-xlsx-import.md) (import CSV/XLSX) · [`spec 24`](24-recurring-transactions.md) (templates automáticos) · [`spec 27`](27-transaction-detail-panel.md) (painel de detalhes) · [`spec 38`](38-novos-widgets-dashboard.md) (widget `recurring-vs-variable` aguardando esta spec) · [`spec 19`](19-transaction-search-filter-sort.md) (filtros)
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`testing`](../skills/testing/SKILL.md) · [`ui-feedback`](../skills/ui-feedback/SKILL.md)

---

## 1. Contexto e Problema

O objeto `Transaction` cresceu organicamente a cada spec e hoje acumula limitações que afetam tanto a qualidade analítica quanto a experiência de lançamento.

### Estado atual do modelo

```
Transaction {
  id, accountId, monthId, tableId, sectionId
  occurredOn, amountCents, description, notes
  isPending, isFavorite
  categoryId, subcategoryId
  institutionId, institutionText
  responsibleUserId
  cardInstallment  ← String? livre, sem estrutura
  investmentType   ← String? livre, sem enum
  metadata         ← JSON genérico
  createdById, createdAt, updatedById, updatedAt
}
```

### Lacunas identificadas

- **Sem distinção fixo vs variável** — impossível calcular "quanto do orçamento já está comprometido" antes do mês.
- **Parcelamento não estruturado** — `cardInstallment "2/12"` é um texto solto; parcelas não se conhecem entre si.
- **Sem rastreamento de origem** — impossível saber se veio de CSV, template ou foi manual.
- **Sem tags livres** — o sistema de categorias hierárquico não serve para rótulos ad-hoc de evento/projeto.
- **Sem split** — uma compra no mercado que toca 3 categorias vira 3 lançamentos separados e perdem o vínculo.
- **Sem vínculo de reembolso** — comum em contextos colaborativos (casal, família) pagar por outro e ser reembolsado.
- **Sem moeda original** — compras em dólar/euro são lançadas convertidas, perdendo o valor original e a taxa.
- **Delete sem desfazer** — hard delete imediato foi apontado como ponto de atrito na spec 09.
- **UX da linha** — a única entrada de ação é o menu ⋮; hover não revela atalhos de ação frequente.

---

## 2. Benchmark de Mercado

> Análise de **YNAB**, **Firefly III**, **Actual Budget**, **Organizze**, **Mobills**, **Copilot Money** e **Monarch Money** — focada em funcionalidades do objeto transação, não em modelo de negócio.

### 2.1 Funcionalidades universais (presentes em 5+ dos 7 apps)

| Feature | YNAB | Firefly III | Actual | Organizze | Mobills | Copilot | Monarch |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Tags livres | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Split de transação | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| Transações recorrentes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Parcelamento estruturado | — | — | — | ✓ | ✓ | — | — |
| Rastreamento de origem | — | ✓ | ✓ | — | — | ✓ | ✓ |
| Undo após exclusão | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Vínculo de reembolso | — | ✓ | — | — | — | ✓ | — |

### 2.2 Insights específicos por app

**YNAB**
- *Cleared / Reconciled*: dois estágios além de `isPending` — a transação pode estar "cleared" (apareceu no extrato) sem estar "reconciled" (fecho de mês fechado definitivamente). Reconciled bloqueia edição.
- *Memo* extenso + *Payee* como dimensão separada de instituição.
- *Split*: divide a transação em sub-splits, cada um com categoria e valor; o total dos splits = valor da transação pai.

**Firefly III**
- *Transaction links* tipados: `is paid for by` / `is refunded by` / `is reimbursed by` / `relates to`. Permite rastrear reembolso sem criar transação espelho.
- *Foreign amount*: `foreign_amount` + `foreign_currency_code` + taxa de câmbio implícita. O valor principal continua na moeda da conta.
- *Tags* como dimensão independente de categorias: filtros, relatórios por tag.
- *Reconciliation*: estado da transação que bloqueia edição acidental.
- *Importação com deduplicação*: hash de deduplicação por transação para evitar duplicatas em imports.

**Actual Budget**
- *Payee rules*: ao digitar um "beneficiário" (payee), regras automáticas aplicam categoria. Não existe conceito de "institution" como entidade separada — payee é o equivalente.
- *Split*: nativo e muito usado para compras de supermercado.
- *Notes* longo por transação.

**Organizze / Mobills (Brasil)**
- *Parcelamento estruturado*: usuário informa "6x R$ 200" → sistema cria as 6 transações vinculadas. Visualizar parcelas restantes, antecipar pagamento, quitar todas.
- *Flag fixo/variável*: "despesa fixa" é um campo booleano no Organizze; Mobills chama de "recorrente".
- *Anexo de comprovante*: foto do recibo ou PDF no Mobills. Muito requisitado por usuários BR.
- *Geolocalização*: Mobills registra lat/lng da compra (feature mobile).

**Copilot Money**
- *Transaction enrichment*: logo do merchant, categoria sugerida por ML, detecção automática de recorrente.
- *Split* + *tags* integrados.
- *Vínculo de reembolso*: marcar que "esta transação foi reembolsada por [outra]".

**Monarch Money**
- *Goal linking*: uma transação pode ser vinculada a uma meta de poupança.
- *Recurring detection*: identifica automaticamente transações recorrentes com base em padrão de descrição + valor.
- *Merchant enrichment*: detecção de nome limpo do merchant a partir do texto bruto do banco.

### 2.3 Padrões de UX identificados

- **Quick actions no hover** (Copilot, Monarch): ao passar o mouse sobre uma linha, aparecem 2–3 botões de ação frequente sem abrir o menu.
- **Agrupamento por data** (YNAB, Firefly, Monarch): linhas agrupadas em blocos de data com header visual, reduz escaneamento.
- **Inline tag input** (todos): chips autocomplete dentro da linha/form, não modal separado.
- **Status badge discreto** na linha (Firefly, Actual): ícone pequeno de "cleared" / "reconciled" substituindo o boolean `isPending`.
- **Split visual** (YNAB): transação com splits tem ícone de "dividido" na linha; clique expande os sub-splits inline.
- **Valor original + convertido** (Firefly, Toshl): campo extra visível na linha quando `foreignCurrency` está presente, sem poluir o layout padrão.

---

## 3. Funcionalidades Propostas

> Cada TRN tem um **nível de prioridade** baseado na frequência no mercado, valor para o usuário e custo de implementação.

### TRN-01 — Classificação fixo/variável/único (`expenseType`) — Prioridade: 🔴 Alta

**Problema**: sem distinção entre despesas fixas (aluguel, mensalidade), variáveis (alimentação, transporte) e eventos únicos (viagem, presente), não é possível calcular compromisso fixo do mês nem alimentar o widget `recurring-vs-variable`.

**Solução**: substituir a flag booleana (`isFixed`) por um enum `expenseType` com 3 valores:

```prisma
enum TransactionExpenseType {
  fixed      // se repete todo mês (aluguel, assinatura, mensalidade, salário)
  variable   // valor muda mês a mês (mercado, transporte, lazer)
  one_time   // acontecimento único (viagem, presente, conserto, IPTU)

  @@map("transaction_expense_type")
}
```

`Transaction` ganha `expenseType TransactionExpenseType? @map("expense_type")` — **nullable** para não forçar backfill e respeitar transações de investimento onde a classificação não se aplica.

**Regras de negócio:**
- Transações geradas por `TableTemplate` com `autoApply = true` (spec 24) nascem com `expenseType` herdado do `TableTemplateItem` correspondente (ver decisão DD-01).
- Transações criadas via import CSV/XLSX nascem com `expenseType = null`.
- No bulk edit: campo editável como os demais (atribuir tipo a N transações de uma vez).
- O campo aparece no formulário de criação/edição como um segmented control de 3 opções + "não classificado".

**UX na tabela:**
- Opcional: ícone discreto na linha (🔒 = fixo, 〜 = variável, ⚡ = único) visível apenas quando preenchido.
- O ícone deve ser configurável como coluna oculta via `TableType.hiddenColumns`.

**Alteração em `TableTemplateItem`:** ganha `expenseType TransactionExpenseType? @map("expense_type")` para que cada item do template configure seu próprio tipo. Ao aplicar o template, o campo é herdado pelo item (ver DD-01).

**Desdobramento:** habilita o widget `recurring-vs-variable` (spec 38 FEAT-05) e análises de comprometimento orçamentário.

---

### TRN-02 — Grupos de parcelamento estruturado (`InstallmentGroup`) — Prioridade: 🔴 Alta

**Problema**: `cardInstallment String?` é texto livre. Parcelas de uma mesma compra não se conhecem, impossibilitando visão do total da compra, navegação entre parcelas e projeção de compromissos futuros.

**Solução**: novo modelo `InstallmentGroup` + modelo `PendingInstallment` para parcelas ainda sem mês vinculado + FK em `Transaction`.

#### Schema

```prisma
model InstallmentGroup {
  id               String   @id @default(cuid())
  accountId        String   @map("account_id")
  description      String                             // "MacBook Pro 16"
  totalCents       BigInt   @map("total_cents")       // valor total da compra
  installmentCount Int      @map("installment_count") // número total de parcelas
  downPaymentCents BigInt?  @map("down_payment_cents") // entrada opcional (parcela 1 diferente)
  startDate        DateTime @map("start_date") @db.Date // data da 1ª parcela
  sectionId        String   @map("section_id")        // seção destino das parcelas futuras
  tableTypeId      String?  @map("table_type_id")     // tipo de tabela destino
  createdAt        DateTime @default(now()) @map("created_at")

  account          Account              @relation(...)
  section          Section              @relation(...)
  tableType        TableType?           @relation(...)
  transactions     Transaction[]
  pendingInstallments PendingInstallment[]

  @@index([accountId])
  @@map("installment_groups")
}

// Parcelas que ainda não têm mês/tabela vinculado
model PendingInstallment {
  id                 String   @id @default(cuid())
  accountId          String   @map("account_id")
  installmentGroupId String   @map("installment_group_id")
  installmentNumber  Int      @map("installment_number")   // 1-based
  amountCents        BigInt   @map("amount_cents")
  expectedDate       DateTime @map("expected_date") @db.Date // data prevista
  // Campos preservados de edições manuais (Opção B confirmada):
  description        String?
  categoryId         String?  @map("category_id")
  subcategoryId      String?  @map("subcategory_id")
  notes              String?
  createdAt          DateTime @default(now()) @map("created_at")

  account       Account          @relation(...)
  group         InstallmentGroup @relation(...)

  @@index([accountId])
  @@index([installmentGroupId])
  @@map("pending_installments")
}
```

`Transaction` ganha:
```prisma
installmentGroupId   String? @map("installment_group_id")
installmentNumber    Int?    @map("installment_number")   // qual parcela é essa (1-based)
installmentGroup     InstallmentGroup? @relation(...)
```

O campo `cardInstallment String?` (legado) é **mantido** por compatibilidade — será deprecado em v3.

#### Cálculo de valores

- **Sem entrada**: cada parcela = `totalCents / installmentCount` (inteiro, centavos, sem arredondamento acumulativo — usar remainder na última parcela).
- **Com entrada (`downPaymentCents`)**: parcela 1 = `downPaymentCents`; parcelas 2–N = `(totalCents - downPaymentCents) / (installmentCount - 1)`.

#### Formulário de criação manual

```
┌─ Nova transação parcelada ──────────────────────────────────┐
│  Descrição:     [ MacBook Pro 16                          ] │
│  Valor total:   [ R$ 12.000,00                            ] │
│  Parcelas:      [ 12  ▼ ] vezes de [ R$ 1.000,00 ] /mês   │
│  1ª parcela em: [ 01/07/2026  📅 ]                         │
│  Seção destino: [ Cartão de Crédito            ▼ ]         │
│  Tipo de tabela:[ Cartão                       ▼ ]         │
│  [ + Adicionar entrada diferente ]                         │
│                                                             │
│  ℹ️  Parcelas 2–12 serão criadas como pendentes e           │
│     vinculadas automaticamente ao criar os meses futuros.  │
│                                                             │
│  [ Cancelar ]                         [ Criar parcelamento ]│
└─────────────────────────────────────────────────────────────┘
```

#### Regras de negócio — ciclo de vida

1. **Criação**: gera `installmentCount` registros — parcela 1 como `Transaction` com `isPending = false` na tabela selecionada; parcelas 2–N como `PendingInstallment` com `expectedDate` incrementando mês a mês.
2. **Criação de mês**: ao executar `createMonth` (spec 24), o sistema verifica `PendingInstallment` cujo `expectedDate` cai naquele mês. Para cada um: busca ou cria tabela com `tableTypeId` na `sectionId` configurada no grupo → cria `Transaction` → deleta o `PendingInstallment`. Falhas são reportadas no snackbar expansível da spec 24 (mesmo mecanismo de melhor esforço).
3. **Deletar uma parcela (Transaction)**: hard delete da transaction + recria o `PendingInstallment` correspondente com os dados preservados (Opção B — campos editados são copiados de volta antes do delete). Cobre o escape de "parcela no mês errado" — o usuário usa o **"Mover transação"** existente (spec 09 §3.6) para realocar sem suspender; o delete+suspend é o escape quando não há mês destino conhecido ainda.
4. **Mover parcela**: o vínculo `installmentGroupId` e `installmentNumber` são preservados ao mover — a parcela continua aparecendo como `"3/12"` na tabela destino.

#### Quitação antecipada

- **Via ação manual no app**: dialog "Quitar antecipado" com duas opções:
  - *"Registrar como parcelas individuais"*: converte cada `PendingInstallment` restante em `Transaction` no mês atual com `isPending = false`.
  - *"Registrar como quitação única (R$ X)"*: deleta todos os `PendingInstallment` restantes e cria **uma** `Transaction` com valor total das parcelas restantes e descrição "Quitação antecipada — [nome do grupo]".
- **Via import CSV** (quando o extrato traz as N parcelas restantes no mesmo mês): o sistema detecta e apresenta na seção "Parcelamentos detectados" do preview de import (ver §3.13), onde o usuário confirma antes de salvar.

#### UX na tabela

- Parcelas de um grupo exibem badge discreto `"3/12"` derivado de `installmentNumber` e `installmentGroup.installmentCount`.
- Clicar no badge `"3/12"` abre painel lateral do grupo com: lista de todas as parcelas (transactions vinculadas + pending installments), status de cada uma, ações "Quitar antecipado" e "Ver detalhes do grupo".

#### Visibilidade das parcelas flutuantes (`PendingInstallment`)

- **Painel do grupo** (acesso via badge `"3/12"`): lista todas as parcelas com status "Vinculada a [mês]" ou "Aguardando mês".
- **Widget `installment-forecast`** (dashboard anual): projeção de comprometimento futuro usando `expectedDate` dos `PendingInstallment`.

#### Detecção de parcelamentos no import CSV (spec 10 — extensão)

O import analisa as linhas do CSV em **cascata de 3 sinais**, exibindo os grupos detectados na seção "Parcelamentos detectados" no preview de confirmação (antes de salvar):

1. **Campo `cardInstallment` mapeado**: coluna com padrão `X/Y` → agrupamento direto.
2. **Regex na descrição**: padrão `\d+/\d+` no final da string (ex: `"AMAZON 02/12"`).
3. **Similaridade de descrição + valor idêntico** em meses consecutivos já importados: detecção de série recorrente.

O sistema verifica se já existe um `InstallmentGroup` compatível para associar a parcela importada, ou propõe criar um novo. O usuário confirma ou rejeita cada sugestão antes de salvar.

**Desdobramento:** widget `installment-forecast` (compromissos futuros por mês no dashboard anual).

---

### TRN-03 — Origem da transação (`source`) — Prioridade: 🟡 Média

**Problema**: sem rastreamento de como a transação foi criada, é impossível filtrar "só o que eu importei do Nubank" ou auditar "quem lançou manualmente".

**Solução**:

```prisma
enum TransactionSource {
  manual       // lançamento manual via UI
  csv_import   // via spec 10 (CSV)
  xlsx_import  // via spec 10 (XLSX)
  template     // via sourceMethod=template (aplicação manual de TableTemplate)
  auto_template // via autoApply=true da spec 24 (aplicação automática ao criar mês)
  duplicate    // via duplicar transação existente

  @@map("transaction_source")
}
```

`Transaction` ganha `source TransactionSource @default(manual) @map("source")`.

**Backfill**: migração seta `source = manual` para todas as transações existentes. Sem custo analítico — é o valor correto para o histórico.

**UX:**
- Campo visível apenas no painel de detalhes (spec 27) — badge discreto: "Lançado manualmente" / "Importado via CSV" / etc.
- Filtro disponível em spec 19 (adicionar ao filtro avançado de transações).
- **Não aparece** no formulário de criação/edição — é preenchido pela camada de serviço.

---

### TRN-04 — Tags livres — Prioridade: 🟡 Média

**Problema**: categorias hierárquicas são boas para análise recorrente, mas inadequadas para rótulos de evento (ex: "Viagem Paris 2026", "Presente Natal", "IPTU 2026").

**Solução**: novo modelo `Tag` + relação N:N com `Transaction`.

```prisma
model Tag {
  id        String   @id @default(cuid())
  accountId String   @map("account_id")
  name      String                         // max 30 chars, case-insensitive no match
  color     String?                        // hex opcional para diferenciação visual
  createdAt DateTime @default(now()) @map("created_at")

  account      Account              @relation(...)
  transactions TransactionTag[]

  @@unique([accountId, name])
  @@map("tags")
}

model TransactionTag {
  transactionId String @map("transaction_id")
  tagId         String @map("tag_id")

  transaction Transaction @relation(...)
  tag         Tag         @relation(...)

  @@id([transactionId, tagId])
  @@map("transaction_tags")
}
```

`Transaction` ganha relação `tags TransactionTag[]`.

**Regras:**
- Tags são por Account (compartilhadas entre membros).
- Máximo 10 tags por transação (validação Zod).
- Nome: max 30 chars, sem caracteres especiais (regex `^[\w\s\-àáâãéêíóôõúç]+$`).
- Ao digitar no inline/form: autocomplete das tags já usadas na account (query com `contains` case-insensitive).
- Criar tag nova: digitar e pressionar Enter — a tag é criada atomicamente na action de salvar a transação.
- Bulk edit: ação "Adicionar tag" e "Remover tag" na barra de bulk select.

**UX na tabela (inline — simples):**
- Clicar na célula de tags abre um **popover simples** com input de texto + lista de autocomplete de tags existentes + chips das tags já selecionadas. Interação mínima: digitar, Enter para adicionar, × para remover.
- Tags aparecem como chips coloridos na linha (máximo 2 visíveis + "+N" se houver mais).
- A coluna de tags é configurável via `TableType.hiddenColumns` (chave `tags`).

**UX no painel de detalhes (spec 27 — completo):**
- Todas as tags exibidas com cor e nome completo.
- Edição completa: criar com cor personalizada, renomear, remover, ver quantas transações usam aquela tag na account.

**Integração com filtros (spec 19):**
- Filtro por tag(s): multi-select com chips autocomplete.
- Tags são indexadas para busca (`@@index([accountId])` no modelo `Tag`).

---

### TRN-05 — Split de transação — Prioridade: 🟠 v3

**Problema**: uma nota fiscal de R$200 no mercado pode conter R$80 de alimentação + R$50 de higiene + R$70 de bebidas. Hoje o usuário lança 3 transações separadas, perdendo o vínculo com o total da compra.

**Solução**: campo `splits Json?` na própria `Transaction` com array de sub-itens. O `categoryId` da transação pai é **mantido** — o usuário categoriza a compra como um todo (ex: "Alimentação"). Os splits são detalhamento informacional dentro daquela categoria, não substituem nem duplicam a categoria do pai para fins de agregação.

```prisma
// Em Transaction:
// splits Json? — array de { amountCents: string, description: string, categoryId?: string, subcategoryId?: string }
// A soma dos amountCents dos splits deve ser = amountCents do pai (validação Zod server-side)
```

**Regras:**
- Máximo de 20 splits por transação.
- O `categoryId` do pai continua obrigatório e independente dos splits — o pai aparece normalmente em todos os totais e filtros por categoria. Zero impacto em queries de agregação existentes.
- Splits **não participam** de queries de agregação — são dados enriquecidos visíveis no painel de detalhes e na linha expandida.
- Bulk edit não afeta splits.

**UX proposta:**
- Linha com splits: ícone discreto de "split" após a categoria + badge `"3 itens"`.
- Clicar no ícone: expande inline os splits abaixo da linha pai (accordion).
- Ao criar/editar: botão `+ Detalhar com itens` no formulário. Abre sub-form com linhas de split.

---

### TRN-06 — Vínculos entre transações (`TransactionLink`) — Prioridade: 🟢 Baixa

**Problema**: em contextos colaborativos (casal, família), é comum pagar por outra pessoa e ser reembolsado por múltiplas transações. Ex: pagar uma pizza para amigos → cada amigo faz um Pix separado de volta. Hoje esses vínculos são invisíveis no app.

**Solução**: modelo `TransactionLink` com enum de tipos, suportando N vínculos por transação.

```prisma
enum TransactionLinkType {
  reimbursed_by   // esta despesa foi reembolsada por [outra]
  paid_for        // paguei por [outra pessoa], esta é a despesa original
  relates_to      // relacionado a [outra transação] (vínculo neutro)

  @@map("transaction_link_type")
}

model TransactionLink {
  id        String              @id @default(cuid())
  accountId String              @map("account_id")
  sourceId  String              @map("source_id")   // transação de origem
  targetId  String              @map("target_id")   // transação vinculada
  type      TransactionLinkType
  notes     String?             // comentário opcional sobre o vínculo
  createdAt DateTime            @default(now()) @map("created_at")

  account Account     @relation(...)
  source  Transaction @relation("LinkSource", ...)
  target  Transaction @relation("LinkTarget", ...)

  @@index([sourceId])
  @@index([targetId])
  @@index([accountId])
  @@map("transaction_links")
}
```

**Regras:**
- Sem impacto em cálculos — vínculos são puramente informativos/navegacionais.
- Validação: `sourceId` e `targetId` devem pertencer à mesma account.
- Uma transação pode ter N vínculos de qualquer tipo.
- Vínculo é sempre exibido nos dois lados na UI (se A aponta para B, B também exibe o link para A).

**UX:**
- No painel de detalhes (spec 27): seção "Vínculos" listando todas as transações relacionadas com tipo e valor.
- No menu ⋮: opção "Vincular transação" abre dialog de busca por descrição/data/valor + seletor de tipo.
- Badge discreto na linha quando há vínculos: ícone `↩` com tooltip "Tem vínculos".

---

### TRN-07 — Valor original em moeda estrangeira — Prioridade: 🟢 Baixa

**Problema**: compras em dólar ou euro são lançadas em BRL (valor já convertido), perdendo o valor original e a taxa usada.

**Solução**: 3 campos opcionais na `Transaction`:

```prisma
// Em Transaction:
originalAmountCents  BigInt? @map("original_amount_cents")  // valor em moeda original (centavos)
originalCurrency     String? @map("original_currency")       // código ISO 4217 (ex: "USD")
exchangeRate         Decimal? @map("exchange_rate")          // taxa aplicada (6 casas decimais)
```

`amountCents` continua sendo o valor em BRL — os três campos são opcionais e decorativos para o usuário.

**UX na tabela:**
- Quando `originalCurrency` preenchido: tooltip no valor mostra `"USD 49.99 @ R$5,12"`.
- No formulário: dois modos de preenchimento:
  - **Modo simples (padrão):** campos `originalCurrency` + `exchangeRate` digitável diretamente. Ex: "comprei em USD a R$5,12".
  - **Modo avançado (expandível via link "Preencher valor original"):** campo `originalAmountCents` adicional. Ao preencher `amountCents` + `originalAmountCents`, o `exchangeRate` é calculado automaticamente e exibido como campo readonly derivado.

---

### TRN-08 — Undo após exclusão — Prioridade: 🔴 Alta (UX pendente da spec 09)

**Problema**: spec 09 §3.4 postergou undo para v2. Hard delete sem confirmação causa perda acidental, especialmente em bulk delete.

**Solução**: UI-only com estado global no provider — **sem soft delete no banco**.

**Fluxo:**
1. Usuário clica "Deletar" (individual ou bulk).
2. Transação(ões) removida(s) da UI **otimisticamente** (não some do banco ainda).
3. O estado do "delete pendente" é guardado num **provider global no root layout** (não no componente da tabela) — sobrevive à navegação dentro do app.
4. Toast aparece via `SnackbarProvider` (já no root layout): `"1 transação excluída"` + botão `"Desfazer"` com timer visual de 10s.
5. Se "Desfazer" clicado dentro de 10s: transação retorna à UI e o hard delete é **cancelado**.
6. Se não clicado (10s expiraram): hard delete disparado via Server Action. `revalidatePath` ocorre após o hard delete.
7. Se o usuário **fechar a aba/recarregar** antes dos 10s: hard delete é disparado imediatamente via `window.addEventListener('beforeunload', ...)` — sem risco de dado fantasma no banco.

**Comportamento especial — parcelas de grupo (`InstallmentGroup`):**
- Ao hard delete de uma `Transaction` que é parte de um `InstallmentGroup`, o serviço **recria automaticamente o `PendingInstallment`** correspondente com os dados preservados da transaction (descrição, categoria, notas).

**Sem alteração no schema**: nenhuma coluna `deleted_at` adicionada. Todas as queries existentes permanecem intactas.

---

### TRN-09 — Quick actions no hover da linha — Prioridade: 🟡 Média (UX polish)

**Problema**: o único ponto de acção numa linha é o menu ⋮. Para ações frequentes (marcar como pendente, duplicar), o fluxo é: hover → clique ⋮ → clique na opção. Dois cliques extras.

**Solução**: ao fazer hover na linha da transação, revelar 2–3 ícones de ação rápida à direita (antes do ⋮):

```
[ ] [ Data ][ Descrição ][ Categoria ][ Valor ][ Resp. ][ ⚐ ] [ ✓ ][ ⧉ ] [ ⋮ ]
                                                              ↑ só no hover
```

- `✓` → toggle `isPending` (confirmar / marcar como pendente)
- `⧉` → duplicar transação

**Regras:**
- Só aparece no hover (`:hover` + estado de foco). Em mobile, não aparece (toque abre o painel de detalhes).
- Os botões são adicionados na última coluna, com `opacity: 0` por padrão e `opacity: 1` no hover do `TableRow`.
- Para viewer (read-only): quick actions não aparecem.

---

### TRN-10 — Agrupamento visual por data — Prioridade: 🟡 Média (UX polish)

**Problema**: tabelas com muitas transações de dias diferentes são difíceis de escanear. O usuário precisa ler a coluna de data linha por linha para saber onde começa um novo dia.

**Inspiração**: YNAB, Monarch Money, apps de messaging (WhatsApp).

**Solução**: inserir header separador de data entre grupos de transações de datas distintas.

```
┌──────────────────────────── 15 de junho ─────────────────────────┐
│ [ ] 15/06  Aluguel           Moradia      R$ 2.000,00   João     │
│ [ ] 15/06  Netflix           Assinaturas  R$    45,90   João     │
├──────────────────────────── 10 de junho ─────────────────────────┤
│ [ ] 10/06  Mercado           Alimentação  R$   312,00   Maria    │
│ [ ] 10/06  Farmácia          Saúde        R$    89,00   João     │
└──────────────────────────────────────────────────────────────────┘
```

**Regras:**
- Agrupamento é **client-side** (transações já carregadas).
- O header de data é uma linha não selecionável (`TableRow` com `data-separator`).
- Ordenação padrão: `occurredOn` DESC (mais recente no topo) — grupos em ordem cronológica reversa.
- **Boolean `groupByDate` em `FinanceTable`** (padrão `true`, persistido no banco, compartilhado entre todos os membros da account — não é preferência individual por usuário).
- Toggle exposto no menu ⋮ da tabela financeira, na mesma região dos toggles de configuração de visualização (ex: "Contar no total do mês").
- **Conflito com reordenação por coluna (Opção A — fluida):** ao clicar em qualquer outro header de coluna para reordenar, o agrupamento por data é **desativado temporariamente na UI** sem alterar o `groupByDate` salvo no banco.
- Enquanto a ordenação estiver fora do padrão (`occurredOn` DESC), um **botão discreto "Voltar à visualização padrão"** aparece no topo da tabela financeira (ao lado do nome/tipo da tabela). Clicar nele restaura `occurredOn` DESC e reativa o agrupamento visual.

---

### TRN-11 — Método de pagamento (`paymentMethod`) — Prioridade: 🟡 Média

**Problema**: não havia forma de registrar *como* a transação foi paga (PIX, dinheiro, cartão, boleto…), informação relevante para conciliação e análise de meios de pagamento.

**Solução**: novo campo `paymentMethod` na `Transaction`, baseado num **enum fixo** (igual a `expenseType`, **não** é um model gerenciável — sem tela de settings, CRUD ou seeding).

```prisma
enum TransactionPaymentMethod {
  pix
  cash
  credit_card
  debit_card
  bank_transfer
  boleto
  other

  @@map("transaction_payment_method")
}
```

`Transaction` ganha `paymentMethod TransactionPaymentMethod? @map("payment_method")` — **nullable**, posicionado ao lado de `expenseType`. **Não** foi adicionado a `TableTemplateItem` (fora de escopo).

**Regras de negócio:**
- Propagado em create/update/duplicate/bulkUpdate do `transaction-service`; incluído no Zod `baseTransactionSchema` e em `bulkUpdateSchema.patch`; no serializer; no tipo `TransactionRow`; e no `select` da query da month-page.
- Labels em pt-BR: PIX (`pix`), Dinheiro (`cash`), Cartão de crédito (`credit_card`), Cartão de débito (`debit_card`), Transferência (`bank_transfer`), Boleto (`boleto`), Outro (`other`).

**UX na tabela:**
- Renderizado como **coluna nova** (label curto "Método", label completo "Método de pagamento"), posicionada **após** a coluna "Instituição" e **antes** de "Valor".
- Célula editável com `<Select>` MUI simples (opção "Nenhum" + os 7 valores) na linha de nova transação e no editor de linha existente; exibição read-only na linha e no painel de detalhes.
- A coluna é configurável via `TableType.hiddenColumns` (chave `paymentMethod`) — ver TRN-12 e spec 05 §4.5.

**Exposição de colunas no picker de Tipo de Tabela:** junto desta entrega, `TableType.hiddenColumns` passou a permitir ocultar também `expenseType` (label "Tipo de transação"), `tags` (label "Tags") e `paymentMethod` (label "Método de pagamento"). Essas colunas já eram renderizadas mas não eram configuráveis; agora aparecem no picker de settings → Tipos de Tabela. Colunas core sempre visíveis (não toggleáveis): `occurredOn` (Data), `amount` (Valor), `description` (Descrição). O tipo de tabela **default** continua ignorando `hiddenColumns` (sempre exibe tudo).

---

### TRN-12 — Entrada rápida no lançamento manual — Prioridade: 🟡 Média (UX polish)

**Problema**: o fluxo de lançamento manual em série era lento e tinha bugs: (1) o `expenseType` escolhido na nova linha era descartado (nunca enviado no payload de create); (2) o mesmo acontecia no editor de linha existente, onde `expenseType` (e depois `paymentMethod`) eram omitidos do payload de update em `saveEdit`; (3) após salvar, a linha fechava, forçando reabrir para o próximo lançamento.

**Solução:**
- **Default `one_time`**: o tipo (`expenseType`) da nova linha vem pré-selecionado como `one_time` ("Evento único") por default — **apenas no fluxo manual da nova linha**; **não** foi adicionado `.default()` ao Zod compartilhado.
- **Correção de persistência**: o `expenseType` da nova linha agora persiste no create; e no editor de linha existente, `expenseType` e `paymentMethod` passam a ser incluídos no payload de update de `saveEdit` (persistem ao editar uma transação existente).
- **Linha-aberta após salvar** (fluxo de entrada rápida): ao salvar pela nova linha, a linha **permanece aberta**. Os campos editáveis são limpos (descrição, valor, categoria, subcategoria, instituição, tipo de investimento, método de pagamento, notas, moeda estrangeira); preserva-se a **data** (`occurredOn`); o tipo volta ao default `one_time`; e o foco vai para o campo de **descrição** para o próximo lançamento. Fechar a linha é explícito: **ESC** ou o botão cancelar.

---

## 4. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | `expenseType` em templates | Por item (`TableTemplateItem`) | Templates podem misturar fixos, variáveis e únicos |
| DD-02 | Parcelas sem mês | Modelo `PendingInstallment` separado | Preserva invariante `monthId` obrigatório em `Transaction` |
| DD-03 | Conversão de parcelas ao criar mês | Automática (melhor esforço) com snackbar da spec 24 | Consistente com comportamento de `autoApply` |
| DD-04 | Reversão de parcela vinculada | Delete recria `PendingInstallment` com dados preservados; mover mantém vínculo | Sem ação "suspender" dedicada — mover ou deletar são os escapes |
| DD-05 | Quitação antecipada manual | Dialog com 2 opções (parcelas individuais ou consolidado) | Controle do usuário |
| DD-06 | Quitação antecipada via import | Detecção automática + confirmação na tela de preview | Consistente com fluxo de import semi-automático |
| DD-07 | Detecção de parcelamentos no import | Cascata 3 sinais: campo mapeado → regex → similaridade | Cobertura máxima com confirmação do usuário antes de salvar |
| DD-08 | Destino das parcelas futuras | `sectionId` + `tableTypeId` explícitos no `InstallmentGroup` | Igual ao `autoApply` da spec 24; robusto a mudanças de nome |
| DD-09 | Split de transação | JSON embutido (`splits Json?`), `categoryId` do pai mantido | Zero impacto em queries de agregação existentes |
| DD-10 | Undo de exclusão | UI-only com provider global + `beforeunload` para fechar aba | Sem alteração no schema; simples e fluido |
| DD-11 | Vínculo de reembolso | `TransactionLink` com enum de tipos (N:N) | Suporta reembolso parcial/múltiplo (pizza com amigos) |
| DD-12 | Taxa de câmbio | Modo simples (currency + rate) + modo avançado (calcula automaticamente) | Flexível para diferentes níveis de detalhe |
| DD-13 | Agrupamento por data | `groupByDate Boolean` em `FinanceTable`, shared entre membros | Preferência da tabela, não individual |
| DD-14 | Tags inline vs detalhes | Inline: popover simples; painel de detalhes: edição completa | Velocidade no contexto da tabela; poder no painel |
| DD-15 | Método de pagamento | **Enum fixo** (`TransactionPaymentMethod`), não model gerenciável | Conjunto de meios de pagamento é estável e universal — sem CRUD/seeding, coerente com `expenseType` |
| DD-16 | Entrada rápida (lançamento manual) | Default `one_time` + linha permanece aberta após salvar (reset + refoco na descrição) em vez de fechar | Lançamento em série rápido; fechar continua explícito (ESC/cancelar) |

---

## 5. Matriz de Prioridade

| ID | Feature | Prioridade | Complexidade (DB) | Complexidade (UI) | Bloqueios |
|---|---|---|---|---|---|
| TRN-01 | Enum fixo/variável/único | 🔴 Alta | Baixa (1 enum + campo em TableTemplateItem) | Baixa (segmented control) | Widget spec 38 FEAT-05 |
| TRN-02 | InstallmentGroup + PendingInstallment | 🔴 Alta | Alta (2 novos modelos) | Alta (formulário + badge + painel) | — |
| TRN-08 | Undo após exclusão | 🔴 Alta | Nenhuma | Baixa (provider global + toast) | — |
| TRN-03 | TransactionSource | 🟡 Média | Baixa (1 campo enum) | Baixa (só detalhes) | — |
| TRN-04 | Tags livres | 🟡 Média | Média (2 novos modelos N:N) | Média (popover inline + detalhes completos) | — |
| TRN-09 | Quick actions hover | 🟡 Média | Nenhuma | Baixa (CSS + 2 botões) | — |
| TRN-10 | Agrupamento por data | 🟡 Média | Baixa (`groupByDate` em FinanceTable) | Média (row separator + botão reset) | — |
| TRN-05 | Split de transação (JSON) | 🟠 v3 | Baixa (1 campo Json) | Média (accordion inline) | — |
| TRN-06 | TransactionLink | 🟢 Baixa | Média (novo modelo) | Média (dialog de busca) | — |
| TRN-07 | Moeda estrangeira | 🟢 Baixa | Baixa (3 campos) | Baixa (2 modos no form) | — |
| TRN-11 | Método de pagamento (`paymentMethod`) | 🟡 Média | Baixa (1 enum fixo + campo) | Baixa (Select + coluna configurável) | — |
| TRN-12 | Entrada rápida (lançamento manual) | 🟡 Média | Nenhuma | Baixa (default + linha-aberta + refoco) | TRN-01, TRN-11 |

---

## 6. Fora de Escopo

- **Parcelamento com juros compostos / CET** — complexidade financeira fora do foco do produto.
- **Substituição do sistema de categorias por tags** — tags são complemento, não substituto.
- **Sincronização com fatura de cartão** — coberto pela spec 10 (CSV/XLSX) e Open Finance futuro.
- **Alertas de vencimento de parcelas** — spec 29 (notificações).
- **Geolocalização de compra** — feature exclusivamente mobile, fora do escopo atual.
- **OCR de recibo** — infra de storage + ML, fora do escopo.
- **Auto-categorização por ML** — fora do escopo; regras manuais são suficientes para o público-alvo.
- **Reconciliation (fechamento definitivo de extrato)** — fluxo de YNAB/Actual que não se encaixa bem na arquitetura de Mês/Seção/Tabela do MyAccountant.
- **Status `cleared` separado de `pending`** — o `isPending` já cobre o caso de uso primário; `cleared` seria redundante sem sincronização bancária.

---

## 7. Widgets dependentes desta spec (novos)

| Widget | Spec de origem | Bloqueador desta spec |
|---|---|---|
| `recurring-vs-variable` (donut fixo vs variável) | Spec 38 FEAT-05 | TRN-01 (`expenseType`) |
| `installment-forecast` (compromissos futuros por mês) | — (novo, spec futura) | TRN-02 (`PendingInstallment`) |
| `tag-breakdown` (gastos por tag) | — (novo, spec futura) | TRN-04 (Tags) |

---

## 8. Widgets existentes impactados

> Esta spec introduz novos dados (tags, `expenseType`, parcelamentos, vínculos) que enriquecem widgets já implementados. Os widgets abaixo devem ser revisados para incorporar os novos campos como opções de filtro ou dimensão de análise — sempre como **configuração opcional com `defaultVisible: false`**, sem alterar o comportamento atual para layouts já configurados.

| Widget | Spec | Impacto sugerido |
|---|---|---|
| `category-breakdown` (mensal e anual) | Spec 33/38 | Filtro adicional por tag(s); opção de dimensão `expenseType` no breakdown |
| `member-breakdown` (mensal e anual) | Spec 33/38 | Filtro por tag e por `expenseType` nas configurações do widget |
| `top-transactions` | Spec 33 | Badge de parcelamento `"X/12"` nas transações listadas; filtro por `source` (origem) |
| `budgets` / `kpi-budget-health` | Spec 25/38 | Opção de filtrar metas por `expenseType = fixed` para mostrar comprometimento fixo separado do variável |
| `daily-heatmap` | Spec 33 | Opção de colorir por `expenseType` (fixo vs variável vs único) em vez de intensidade de valor |
| `insights` | Spec 34 | Novos insights: "X% do orçamento já está comprometido em despesas fixas este mês"; padrões de tags ao longo do tempo |

---

## 9. Referências

| Item | Arquivo |
|---|---|
| Schema atual de Transaction | [prisma/schema.prisma](../prisma/schema.prisma) (model Transaction) |
| CRUD de Transaction | [specs/09-transactions.md](09-transactions.md) |
| Import CSV/XLSX | [specs/10-csv-xlsx-import.md](10-csv-xlsx-import.md) |
| Templates automáticos | [specs/24-recurring-transactions.md](24-recurring-transactions.md) |
| Painel de detalhes | [specs/27-transaction-detail-panel.md](27-transaction-detail-panel.md) |
| Widgets spec 38 | [specs/38-novos-widgets-dashboard.md](38-novos-widgets-dashboard.md) §2.5 |
| Filtros de transação | [specs/19-transaction-search-filter-sort.md](19-transaction-search-filter-sort.md) |
| Budget targets | [specs/25-budget-targets.md](25-budget-targets.md) |
| Widgets configuráveis | [specs/36-widgets-configuraveis-instanciaveis.md](36-widgets-configuraveis-instanciaveis.md) |

---

## 10. Fases de Implementação

> **Como usar:** Para implementar uma fase, inclua no prompt:
> *"Leia a spec [`41-aprimoramentos-objeto-transacao.md`](specs/41-aprimoramentos-objeto-transacao.md) e implemente completamente a **Fase N**. Leia as skills listadas antes de implementar."*

> **Regra geral de todas as fases:**
> - Rodar `docker compose exec app pnpm prisma migrate dev --name <nome>` após qualquer alteração de schema.
> - Rodar `docker compose exec app pnpm test` ao final de cada fase.
> - Rodar `docker compose exec app pnpm typecheck` e `pnpm lint` para garantir sem erros.

> **Estado de implementação (atualizado em 2026-07):**
>
> | Fase | TRN | Status |
> |---|---|---|
> | 1 | TRN-08 (undo global) | ✅ Implementada |
> | 2 | TRN-01 (`expenseType`) | ✅ Implementada |
> | 3 | TRN-03 (`source`) | ✅ Implementada |
> | 4 | TRN-10 (agrupamento por data) | ✅ Implementada |
> | 5 | TRN-09 (quick actions hover) | ✅ Implementada |
> | 6 | TRN-04 (tags livres) | ✅ Implementada |
> | 7 | TRN-02a (schema parcelamento) | ✅ Implementada |
> | 8 | TRN-02b (criação + ciclo de vida) | ✅ Implementada |
> | 9 | TRN-02c (delete+suspend + painel) | ✅ Implementada |
> | 10 | TRN-02d (quitação antecipada) | ✅ Implementada |
> | 11 | TRN-02e (detecção no import) | ✅ Implementada |
> | 12 | TRN-07 (moeda estrangeira) | ✅ Implementada |
> | 13 | TRN-06 (`TransactionLink`) | ✅ Implementada |
> | 14 | §8 (impacto em widgets) | ✅ Implementada |
> | 15 | TRN-05 (split de transação) | 🟠 **Adiada** — mantida como ideia futura (v3). Ver nota no início da Fase 15. |
> | 16 | Colunas expostas no picker (`expenseType`, `tags`, `paymentMethod`) | ✅ Implementada (2026-07) |
> | 17 | TRN-11 (`paymentMethod` — enum fixo + coluna) | ✅ Implementada (2026-07) |
> | 18 | TRN-12 (entrada rápida no lançamento manual) | ✅ Implementada (2026-07) |

---

### Fase 1 — TRN-08: Upgrade do undo de exclusão para provider global

**Objetivo:** O undo de exclusão já existe em `TransactionTable.tsx` com timer de 5s local. Esta fase faz o upgrade para: (1) sobreviver à navegação dentro do app movendo o estado para um provider global; (2) aumentar o timer para 10s; (3) disparar o hard delete via `beforeunload` se o usuário fechar a aba antes dos 10s. Sem alterações de schema.

**Pré-requisitos:** Nenhum.

**Skills a consultar:** [`ui-feedback`](../skills/ui-feedback/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md)

**O que já existe:**
- `TransactionTable.tsx` — lógica completa de optimistic delete + undo com timer de 5s local (`pendingBatchRef`, `deleteTimerRef`, `onDeleteRequested`, `handleUndoDelete`, `executePendingDeletes`).
- `src/components/providers/AppProviders.tsx` — `SnackbarProvider` já no root layout.
- `deleteTransactionAction` em `src/actions/transactions.ts` — já funcional.

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `src/components/providers/DeleteUndoProvider.tsx` | **Criar** — context + provider global do estado de delete pendente |
| `src/components/providers/AppProviders.tsx` | Modificar — envolver com `DeleteUndoProvider` |
| `src/components/transactions/TransactionTable.tsx` | Modificar — remover lógica local, consumir context global |
| `src/lib/messages/pt-BR.ts` | Verificar/adicionar mensagens se ausentes |

**Tarefas:**

1. Criar `DeleteUndoProvider.tsx` com:
   - Context com estado: `pendingDeletes: { id: string; row: TxRow; accountId: string }[]`
   - Função `requestDelete(id, row, accountId)`: adiciona à fila, inicia/reinicia timer de 10s, exibe snackbar persist com botão "Desfazer".
   - Função `undoDelete()`: limpa fila, cancela timer, fecha snackbar, restaura linhas (via callback registrado pela tabela).
   - `executePendingDeletes()`: dispara `deleteTransactionAction` para cada item da fila.
   - `useEffect` com `window.addEventListener('beforeunload', executePendingDeletes)` — garante que fechar a aba dispara o hard delete imediatamente.
   - Expor `registerRestoreCallback(tableId, fn)` / `unregisterRestoreCallback(tableId)` para que cada `TransactionTable` registre sua função de restauração de linhas.

2. Envolver `AppProviders.tsx` com `<DeleteUndoProvider>` dentro do `SnackbarProvider` (precisa de acesso ao `enqueueSnackbar`).

3. Refatorar `TransactionTable.tsx`:
   - Remover `pendingBatchRef`, `deleteTimerRef`, `snackbarKeyRef`, `executePendingDeletes`, `handleUndoDelete`, `isMountedRef` e o `useEffect` de cleanup.
   - `onDeleteRequested(id)` chama `requestDelete(id, row, accountId)` do context global.
   - Em `useEffect` de mount/unmount: registrar/desregistrar a função de restauração de linhas (`setRows`).

4. Ajustar o timer de 5s para 10s na implementação do provider.

**Critérios de conclusão:**
- Deletar uma transação → toast com "Desfazer" aparece.
- Navegar para outro mês/seção enquanto o toast está ativo → toast persiste.
- Clicar "Desfazer" em qualquer página → transação reaparecer na tabela original.
- Aguardar 10s sem desfazer → hard delete executado (verificar no banco via Prisma Studio).
- `pnpm test` passa.

---

### Fase 2 — TRN-01: `expenseType` nas transações e templates

**Objetivo:** Adicionar o enum `TransactionExpenseType` (`fixed` / `variable` / `one_time`) ao schema de `Transaction` e `TableTemplateItem`. Exibir segmented control no formulário de criação/edição. Suportar bulk edit. Exibir ícone discreto na linha da tabela. Transações geradas por `autoApply` herdam o tipo do item do template.

**Pré-requisitos:** Nenhum (schema independente).

**Skills a consultar:** [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`testing`](../skills/testing/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md)

**Schema — alterações:**
```prisma
// Novo enum
enum TransactionExpenseType {
  fixed
  variable
  one_time
  @@map("transaction_expense_type")
}

// Em Transaction:
expenseType TransactionExpenseType? @map("expense_type")

// Em TableTemplateItem:
expenseType TransactionExpenseType? @map("expense_type")
```

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Adicionar enum + campos |
| `prisma/migrations/` | Nova migration `add_expense_type` |
| `src/lib/schemas/transaction.ts` | Adicionar `expenseType` ao schema Zod |
| `src/lib/messages/pt-BR.ts` | Labels: "Despesa fixa", "Despesa variável", "Evento único", "Não classificado" |
| `src/server/services/transaction-service.ts` | Incluir `expenseType` em create/update/duplicate |
| `src/server/services/table-template-service.ts` | Ao aplicar template (manual + autoApply), herdar `expenseType` do `TableTemplateItem` |
| `src/lib/serializers/transaction.ts` | Incluir `expenseType` na serialização |
| `src/components/transactions/types.ts` | Adicionar `expenseType` ao tipo `TransactionRow` |
| `src/components/transactions/TransactionRowEditor.tsx` | Adicionar segmented control de 4 opções |
| `src/components/transactions/TransactionRow.tsx` | Exibir ícone discreto quando `expenseType` preenchido |
| `src/components/transactions/BulkActionBar.tsx` | Adicionar ação "Definir tipo" |
| `src/actions/transactions.ts` | Incluir `expenseType` nos bulk update handlers |
| `src/server/services/transaction-service.test.ts` | Testes de create/update com `expenseType` |

**Tarefas:**

1. Adicionar enum e campos ao schema. Rodar migration.
2. Atualizar Zod schema em `src/lib/schemas/transaction.ts` com `expenseType: z.nativeEnum(TransactionExpenseType).nullable().optional()`.
3. Adicionar labels em `pt-BR.ts`.
4. Atualizar `serializeTransaction` para incluir `expenseType`.
5. Atualizar `types.ts` (`TransactionRow`).
6. Em `transaction-service.ts`: incluir `expenseType` no payload de `createTransaction`, `updateTransaction` e `duplicateTransaction`.
7. Em `table-template-service.ts`: ao criar `Transaction` a partir de `TableTemplateItem` (fluxo manual e `autoApply`), passar `expenseType: item.expenseType ?? null`.
8. Em `TransactionRowEditor.tsx`: adicionar segmented control (`ToggleButtonGroup` MUI) com 4 opções + "Não classificado" (null). Colocar após o campo `notes` ou em seção de campos opcionais.
9. Em `TransactionRow.tsx`: exibir ícone discreto (`LockOutlined` = fixo, `WavesOutlined` = variável, `FlashOnOutlined` = único) com `Tooltip`. Visível apenas quando `expenseType !== null`. Configurável via `hiddenColumns`.
10. Em `BulkActionBar.tsx`: adicionar botão "Tipo de gasto" → menu com as 3 opções → chama `bulkUpdateTransactionsAction`.
11. Escrever testes unitários para o service cobrindo os 3 tipos + null.

**Critérios de conclusão:**
- Criar transação com `expenseType = fixed` → ícone 🔒 aparece na linha.
- Criar transação via `autoApply` com item de template marcado como `variable` → transação nasce com `variable`.
- Bulk select 3 transações → "Tipo de gasto" → "Fixo" → todas atualizam.
- `pnpm test` passa.

---

### Fase 3 — TRN-03: `source` — rastreamento de origem

**Objetivo:** Adicionar o enum `TransactionSource` ao schema. Preencher automaticamente na camada de serviço conforme o fluxo de criação. Exibir badge discreto no painel de detalhes. Adicionar filtro avançado nas transações.

**Pré-requisitos:** Nenhum (schema independente).

**Skills a consultar:** [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

**Schema — alterações:**
```prisma
enum TransactionSource {
  manual
  csv_import
  xlsx_import
  template
  auto_template
  duplicate
  @@map("transaction_source")
}

// Em Transaction:
source TransactionSource @default(manual) @map("source")
```

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Adicionar enum + campo |
| `prisma/migrations/` | Nova migration `add_transaction_source` (backfill `source = manual`) |
| `src/lib/schemas/transaction.ts` | Campo é server-only — **não** expor no form schema |
| `src/lib/messages/pt-BR.ts` | Labels de origem para exibição no painel de detalhes |
| `src/server/services/transaction-service.ts` | `createTransaction` → `manual`; `duplicateTransaction` → `duplicate` |
| `src/server/services/csv-import-service.ts` | Detectar extensão → `csv_import` ou `xlsx_import` |
| `src/server/services/table-template-service.ts` | Manual → `template`; autoApply → `auto_template` |
| `src/lib/serializers/transaction.ts` | Incluir `source` na serialização |
| `src/components/transactions/TransactionDetailDialog.tsx` | Exibir badge de origem na seção de histórico |
| `src/server/services/transaction-service.test.ts` | Testar `source` correto em cada fluxo |

**Tarefas:**

1. Schema + migration. A migration deve incluir `UPDATE transactions SET source = 'manual'` antes de adicionar o `NOT NULL`. Usar `prisma migrate dev` com SQL customizado ou default `@default(manual)`.
2. Atualizar `serializeTransaction` para incluir `source`.
3. Em `transaction-service.ts`: `createTransaction` já passa `source: 'manual'` (default), `duplicateTransaction` passa `source: 'duplicate'` explicitamente.
4. Em `csv-import-service.ts`: detectar pela extensão do arquivo original → passar `source: 'csv_import'` ou `'xlsx_import'` no bulk create.
5. Em `table-template-service.ts`: distinguir fluxo manual (`template`) de `autoApply` (`auto_template`).
6. Em `TransactionDetailDialog.tsx`: na seção "Histórico", adicionar linha "Origem" com `<Chip>` ou texto descritivo baseado em `source`.
7. Adicionar `source` como filtro opcional em `TransactionFilterDrawer.tsx` (multi-select).
8. Testes: duplicar → `duplicate`; criar → `manual`.

**Critérios de conclusão:**
- Criar transação manualmente → painel de detalhes mostra "Lançado manualmente".
- Importar CSV → transações mostram "Importado via CSV".
- Duplicar → mostra "Duplicado".
- `pnpm test` passa.

---

### Fase 4 — TRN-10: Agrupamento visual por data

**Objetivo:** Adicionar `groupByDate Boolean` ao `FinanceTable`. Na UI da tabela, quando ativo, inserir headers separadores entre grupos de datas distintas. Toggle no menu ⋮ da tabela. Ao reordenar por outra coluna, agrupamento desativa temporariamente e botão "Voltar à visualização padrão" aparece.

**Pré-requisitos:** Nenhum (schema independente de Transaction).

**Skills a consultar:** [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md)

**Schema — alterações:**
```prisma
// Em FinanceTable:
groupByDate Boolean @default(true) @map("group_by_date")
```

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Adicionar campo `groupByDate` |
| `prisma/migrations/` | Nova migration `add_group_by_date` |
| `src/server/services/finance-table-service.ts` | Ação `updateTableSettings` para toglar `groupByDate` |
| `src/actions/finance-tables.ts` | Expor action `updateTableSettingsAction` |
| `src/server/queries/month-page.ts` | Incluir `groupByDate` no select das tabelas |
| `src/components/transactions/TransactionTable.tsx` | Lógica de agrupamento por data + botão de reset |
| `src/components/transactions/TransactionTable.tsx` | Toggle no menu de configurações da tabela |
| `src/lib/messages/pt-BR.ts` | "Agrupar por data", "Voltar à visualização padrão" |

**Tarefas:**

1. Schema + migration com `@default(true)`.
2. Adicionar `updateTableSettings(tableId, { groupByDate })` no `finance-table-service.ts` com check de `accountId`.
3. Expor action `updateTableSettingsAction` em `src/actions/finance-tables.ts`.
4. Incluir `groupByDate` no select do query de página de mês.
5. Passar `groupByDate` como prop para `TransactionTable`.
6. Em `TransactionTable.tsx`:
   - Estado local `isGrouped` inicializado com `props.groupByDate` (persiste no banco via toggle).
   - Quando `sort !== null && sort.field !== 'occurredOn'`: agrupamento visual desativado (sem alterar `isGrouped`).
   - Função `groupedRows(visibleRows)`: agrupa por `occurredOn` formatada, retorna array com itens `{ type: 'header', date }` intercalados com `{ type: 'row', tx }`.
   - Renderizar headers de data como `TableRow` com `sx={{ pointerEvents: 'none', backgroundColor: 'background.subtle' }}` + `Typography variant="caption"` com a data formatada por extenso.
   - Mostrar botão "Voltar à visualização padrão" quando `sort !== null && sort.field !== 'occurredOn'` — ao clicar, resetar `sort` para `null`.
7. No menu ⋮ da tabela (onde fica "Contar no total do mês"): adicionar toggle "Agrupar por data" que chama a action e atualiza `isGrouped`.

**Critérios de conclusão:**
- Tabela com múltiplos dias mostra headers de data intercalados.
- Ordenar por "Valor" → headers somem, botão "Voltar" aparece.
- Clicar "Voltar" → `occurredOn` DESC restaurado, headers voltam.
- Toggle no menu ⋮ → persiste no banco, refresh mantém preferência.
- `pnpm test` passes.

---

### Fase 5 — TRN-09: Quick actions no hover da linha

**Objetivo:** Exibir 2 botões de ação rápida (`isPending` toggle e duplicar) visíveis apenas no hover da linha da transação. Sem alterações de schema ou services.

**Pré-requisitos:** Nenhum.

**Skills a consultar:** [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md)

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `src/components/transactions/TransactionRow.tsx` | Adicionar quick actions no hover |
| `src/lib/messages/pt-BR.ts` | Tooltips: "Confirmar transação", "Marcar como pendente", "Duplicar" |

**Tarefas:**

1. Em `TransactionRow.tsx`, antes do `TransactionRowActions` (menu ⋮), adicionar um `Box` com os 2 `IconButton`:
   - `CheckCircleOutlineIcon` / `RadioButtonUncheckedIcon` → toggle `isPending` (chama `onTogglePending` ou o handler existente de edição inline de `isPending`).
   - `ContentCopyIcon` → duplicar (chama `onDuplicate` existente).
2. Estilizar com `sx={{ opacity: 0, transition: 'opacity 0.15s' }}` no container e `'& :hover > &': { opacity: 1 }` no `TableRow` pai — ou usar o mecanismo de hover já existente na row (verificar como o `isFavorite` star já faz isso).
3. Não exibir quando `isReadOnly === true` (viewer).
4. Testar acessibilidade: `aria-label` nos botões.

**Critérios de conclusão:**
- Hover numa linha → 2 ícones aparecem suavemente.
- Clicar no ✓ em linha pendente → linha confirma (`isPending = false`).
- Clicar em duplicar → nova linha aparece abaixo.
- Para viewer → quick actions não aparecem.

---

### Fase 6 — TRN-04: Tags livres

**Objetivo:** Criar modelos `Tag` e `TransactionTag`. Popover inline simples para edição de tags na linha da tabela. Edição completa no painel de detalhes. Bulk add/remove. Filtro por tags.

**Pré-requisitos:** Nenhum (schema independente de Transaction além da FK).

**Skills a consultar:** [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`testing`](../skills/testing/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md)

**Schema — alterações:** Ver §3 TRN-04 desta spec (modelos `Tag`, `TransactionTag`, relação em `Transaction`).

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Adicionar `Tag`, `TransactionTag`, relação em `Transaction`, relação em `Account` |
| `prisma/migrations/` | Nova migration `add_tags` |
| `src/lib/schemas/tag.ts` | **Criar** — Zod schemas para criar/editar tag |
| `src/server/services/tag-service.ts` | **Criar** — `listTags`, `createTag`, `addTagToTransaction`, `removeTagFromTransaction`, `bulkAddTag`, `bulkRemoveTag` |
| `src/actions/tags.ts` | **Criar** — actions com `defineAction` |
| `src/server/queries/month-page.ts` | Incluir tags no select de transações |
| `src/lib/serializers/transaction.ts` | Incluir `tags` na serialização |
| `src/components/transactions/types.ts` | Adicionar `tags` ao tipo `TransactionRow` |
| `src/components/tags/TagPopover.tsx` | **Criar** — popover simples de edição inline |
| `src/components/tags/TagDetailEditor.tsx` | **Criar** — editor completo para painel de detalhes |
| `src/components/transactions/TransactionRow.tsx` | Adicionar célula de tags com `TagPopover` |
| `src/components/transactions/TransactionDetailDialog.tsx` | Adicionar `TagDetailEditor` |
| `src/components/transactions/BulkActionBar.tsx` | Adicionar ações "Adicionar tag" e "Remover tag" |
| `src/components/transactions/TransactionFilterDrawer.tsx` | Adicionar filtro por tags |
| `src/lib/messages/pt-BR.ts` | Labels de tags |
| `src/server/services/tag-service.test.ts` | **Criar** — testes de multi-tenancy |

**Tarefas:**

1. Schema + migration.
2. Criar `tag-service.ts` com todas as funções. Validar `accountId` em todas. Limite de 10 tags por transação em `addTagToTransaction`.
3. Criar actions em `src/actions/tags.ts`.
4. Atualizar queries para incluir tags (select `{ tags: { include: { tag: true } } }`).
5. Atualizar serializer para converter `tags` em `{ id, name, color }[]`.
6. Criar `TagPopover.tsx`: `Popover` MUI com `Autocomplete` freeSolo para buscar/criar tags + chips das tags selecionadas. Ao adicionar/remover → chama action + atualiza linha otimisticamente.
7. Criar `TagDetailEditor.tsx`: versão expandida com suporte a escolha de cor (`color` hex), rename inline, remoção, contador de uso da tag na account.
8. Inserir `TagPopover` na `TransactionRow` como célula configurável via `hiddenColumns['tags']`. Exibir no máximo 2 chips + "+N".
9. Inserir `TagDetailEditor` no `TransactionDetailDialog`.
10. Adicionar ao `BulkActionBar`: "Adicionar tag" e "Remover tag" (multi-select de tags existentes).
11. Adicionar ao `TransactionFilterDrawer`: filtro multi-select de tags.
12. Testes: multi-tenancy (tag de account A não aparece em account B), limite de 10.

**Critérios de conclusão:**
- Criar tag "Viagem Paris 2026" numa transação → aparece como chip na linha.
- Filtrar por tag → só transações com aquela tag aparecem.
- Bulk select + "Adicionar tag Natal" → todas as selecionadas recebem a tag.
- Viewer pode ver tags, mas não editar.
- `pnpm test` passa.

---

### Fase 7 — TRN-02a: Schema do parcelamento (`InstallmentGroup` + `PendingInstallment`)

**Objetivo:** Criar os dois novos modelos no schema + adicionar FKs em `Transaction`. Exibir badge `"3/12"` nas linhas de transações vinculadas a grupos. Incluir `installmentGroup` na serialização. Sem criar ainda o fluxo completo de criação ou ciclo de vida (isso é a Fase 8).

**Pré-requisitos:** Fase 1 (o delete das parcelas já integra com o undo global).

**Skills a consultar:** [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md)

**Schema — alterações:** Ver §3 TRN-02 desta spec (modelos `InstallmentGroup`, `PendingInstallment`, campos em `Transaction`).

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Adicionar modelos + campos em `Transaction` |
| `prisma/migrations/` | Nova migration `add_installment_group` |
| `src/lib/serializers/transaction.ts` | Incluir `installmentGroupId`, `installmentNumber`, e dados do grupo |
| `src/components/transactions/types.ts` | Adicionar campos de parcelamento ao `TransactionRow` |
| `src/components/transactions/TransactionRow.tsx` | Exibir badge `"X/Y"` na coluna de parcela do cartão |
| `src/server/queries/month-page.ts` | Incluir `installmentGroup` no select de transações |
| `src/lib/messages/pt-BR.ts` | Labels de parcelamento |

**Tarefas:**

1. Adicionar os dois modelos e os campos em `Transaction` ao schema. Rodar migration.
2. Atualizar o select de transações na query de página de mês para incluir `installmentGroup: { select: { id, description, installmentCount } }`.
3. Atualizar `serializeTransaction` para incluir `installmentGroupId`, `installmentNumber`, `installmentGroupCount` (do grupo).
4. Atualizar `types.ts` com os campos.
5. Em `TransactionRow.tsx`, na coluna `cardInstallment` (que já existe): se `installmentGroupId` presente, renderizar `Chip` clicável com label `"${installmentNumber}/${installmentGroupCount}"` em vez do texto livre. O `onClick` do chip será usado na Fase 9 para abrir o painel do grupo.
6. Se `cardInstallment` preenchido mas `installmentGroupId` nulo: manter exibição do texto legado.

**Critérios de conclusão:**
- Migration roda sem erros.
- Transação existente sem grupo: sem badge, sem mudança visual.
- Transação com `installmentGroupId` e `installmentNumber = 3` com grupo de 12: exibe chip `"3/12"`.
- `pnpm test` passa.

---

### Fase 8 — TRN-02b: Criação manual de parcelamento + ciclo de vida ao criar mês

**Objetivo:** Formulário para criar `InstallmentGroup` manualmente (parcela 1 como `Transaction` + parcelas 2–N como `PendingInstallment`). Hook em `createMonth` para converter `PendingInstallment` cujo `expectedDate` cai no mês sendo criado.

**Pré-requisitos:** Fase 7 (schema existente).

**Skills a consultar:** [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `src/lib/schemas/installment.ts` | **Criar** — Zod schema para criação de grupo |
| `src/server/services/installment-service.ts` | **Criar** — `createInstallmentGroup`, `convertPendingInstallmentsForMonth` |
| `src/actions/installments.ts` | **Criar** — `createInstallmentGroupAction` |
| `src/server/services/month-service.ts` | Modificar `createMonth` para chamar `convertPendingInstallmentsForMonth` |
| `src/components/installments/CreateInstallmentDialog.tsx` | **Criar** — dialog de criação com formulário |
| `src/components/transactions/TransactionTable.tsx` | Adicionar botão "+ Parcelado" no header da tabela |
| `src/lib/messages/pt-BR.ts` | Labels do formulário e feedback |
| `src/server/services/installment-service.test.ts` | **Criar** — testes de criação e conversão |

**Tarefas:**

1. Criar Zod schema em `src/lib/schemas/installment.ts`:
```ts
createInstallmentGroupSchema = z.object({
  description: z.string().min(1).max(200),
  totalCents: z.coerce.bigint().positive(),
  installmentCount: z.coerce.number().int().min(2).max(360),
  downPaymentCents: z.coerce.bigint().positive().optional(),
  startDate: z.coerce.date(),
  tableId: z.string().cuid(),        // tabela da 1ª parcela
  sectionId: z.string().cuid(),      // seção das parcelas futuras
  tableTypeId: z.string().cuid().optional(),
})
```
2. Criar `installment-service.ts`:
   - `createInstallmentGroup(input, ctx)`: calcula valores das parcelas (sem arredondamento acumulativo), cria `InstallmentGroup`, cria `Transaction` para parcela 1 (com `installmentGroupId`, `installmentNumber: 1`), cria `PendingInstallment` para parcelas 2–N com `expectedDate` incrementando mês a mês a partir de `startDate`.
   - `convertPendingInstallmentsForMonth(accountId, monthId, year, month)`: busca `PendingInstallment` com `expectedDate` no período `year/month`. Para cada um: busca/cria tabela com `tableTypeId` e `sectionId` do grupo → cria `Transaction` → deleta `PendingInstallment`. Retorna `{ converted: number; failed: { groupDescription; reason }[] }`.
3. Modificar `month-service.ts` em `createMonth`: após criar o mês e aplicar `autoApply` templates, chamar `convertPendingInstallmentsForMonth`. Adicionar resultados ao snackbar expansível existente.
4. Criar `CreateInstallmentDialog.tsx`: dialog com os campos do schema, campo de entrada condicional, preview do cálculo (mostra "12x R$1.000,00"), seção de destino (selects de seção e tipo de tabela).
5. Adicionar botão "+ Parcelado" no header de `TransactionTable` (ao lado de "+ Nova transação") que abre o dialog.
6. Testes: criação cria 1 Transaction + N-1 PendingInstallments; conversão ao criar mês; multi-tenancy.

**Critérios de conclusão:**
- Criar parcelamento 12x R$1.000 → 1 transaction + 11 PendingInstallments criados.
- Criar mês seguinte → 1 PendingInstallment convertido em Transaction automaticamente com badge `"2/12"`.
- Snackbar do mês exibe "1 parcelamento vinculado automaticamente".
- `pnpm test` passa.

---

### Fase 9 — TRN-02c: Ciclo de vida — delete+suspend e painel do grupo

**Objetivo:** Ao deletar uma `Transaction` de um grupo, recriar o `PendingInstallment` correspondente com os dados preservados. Abrir painel do grupo ao clicar no badge `"X/Y"`. Ação de suspender manualmente (mover descrito como escape principal).

**Pré-requisitos:** Fase 7 + Fase 8.

**Skills a consultar:** [`server-actions`](../skills/server-actions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `src/server/services/installment-service.ts` | Adicionar `restoreAsPendingInstallment(transactionId, ctx)` |
| `src/server/services/transaction-service.ts` | Modificar `deleteTransaction` para chamar restore quando `installmentGroupId` presente |
| `src/components/installments/InstallmentGroupPanel.tsx` | **Criar** — painel lateral com lista de parcelas |
| `src/components/transactions/TransactionRow.tsx` | onClick no badge → abrir painel |

**Tarefas:**

1. Em `installment-service.ts`, criar `restoreAsPendingInstallment(transactionId, ctx)`:
   - Buscar a transaction (verificar que pertence à account).
   - Criar `PendingInstallment` com `installmentGroupId`, `installmentNumber`, `amountCents`, `expectedDate = transaction.occurredOn`, `description`, `categoryId`, `subcategoryId`, `notes`.
   - Retornar o `PendingInstallment` criado.
2. Modificar `transaction-service.ts` em `deleteTransaction`: após deletar, se `tx.installmentGroupId` presente, chamar `restoreAsPendingInstallment`.
3. Criar `InstallmentGroupPanel.tsx`: `Drawer` lateral (ou `Dialog` em mobile) com:
   - Header: nome do grupo, valor total, `N/installmentCount` parcelas pagas.
   - Lista: todas as `Transaction` do grupo + todos os `PendingInstallment` do grupo, ordenados por `installmentNumber`.
   - Status por item: "Pago" (Transaction não pending), "Pendente" (Transaction pending), "Aguardando mês" (PendingInstallment).
   - Link para cada transaction vinculada (rola a tabela até ela).
4. Em `TransactionRow.tsx`: `onClick` no chip `"X/Y"` → abrir `InstallmentGroupPanel` para o grupo.

**Critérios de conclusão:**
- Deletar parcela 3 de um grupo de 12 → `PendingInstallment` recriado com dados preservados.
- Undo do delete (Fase 1) → transaction volta, PendingInstallment deletado (idempotente).
- Clicar em `"3/12"` → painel abre listando as 12 parcelas com status correto.
- `pnpm test` passa.

---

### Fase 10 — TRN-02d: Quitação antecipada

**Objetivo:** Dialog "Quitar antecipado" com 2 opções: registrar parcelas individuais no mês atual ou registrar quitação consolidada numa única transaction.

**Pré-requisitos:** Fase 9.

**Skills a consultar:** [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md)

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `src/server/services/installment-service.ts` | Adicionar `settleInstallmentGroup(groupId, mode, tableId, ctx)` |
| `src/actions/installments.ts` | Adicionar `settleInstallmentGroupAction` |
| `src/components/installments/SettleInstallmentDialog.tsx` | **Criar** — dialog de quitação |
| `src/components/installments/InstallmentGroupPanel.tsx` | Adicionar botão "Quitar antecipado" |
| `src/lib/messages/pt-BR.ts` | Labels de quitação |

**Tarefas:**

1. Criar `settleInstallmentGroup(groupId, mode: 'individual' | 'consolidated', tableId, ctx)`:
   - Buscar todos os `PendingInstallment` do grupo.
   - Se `mode = 'individual'`: converter cada PendingInstallment em Transaction no `tableId` com `isPending = false` e `occurredOn = today`.
   - Se `mode = 'consolidated'`: somar `amountCents` de todos os PendingInstallments → criar 1 Transaction com valor total, `description = "Quitação antecipada — ${group.description}"`, `occurredOn = today`, `isPending = false`. Deletar todos os PendingInstallments.
2. Dialog `SettleInstallmentDialog.tsx`: mostra valor total das parcelas restantes, seletor de tabela de destino (no mês atual), escolha entre os 2 modos com preview do resultado.
3. Adicionar botão "Quitar antecipado" no `InstallmentGroupPanel` (visível apenas para owner/editor).

**Critérios de conclusão:**
- 8 parcelas pendentes de R$200 → quitar consolidado → 1 transaction de R$1.600 criada.
- 8 parcelas pendentes → quitar individual → 8 transactions de R$200 criadas.
- `pnpm test` passa.

---

### Fase 11 — TRN-02e: Detecção de parcelamentos no import CSV

**Objetivo:** Estender o fluxo de import da spec 10 com uma seção "Parcelamentos detectados" no preview de confirmação. O sistema analisa as linhas importadas em cascata de 3 sinais e propõe agrupamentos que o usuário confirma ou rejeita.

**Pré-requisitos:** Fase 7 + Fase 8 (schema e service de InstallmentGroup existentes). Conhecer o fluxo atual de `csv-import-service.ts` e a tela de preview de import.

**Skills a consultar:** [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `src/lib/installment-detector.ts` | **Criar** — função de detecção em cascata |
| `src/server/services/csv-import-service.ts` | Integrar detecção no retorno do preview |
| `src/components/import/InstallmentDetectionSection.tsx` | **Criar** — seção de confirmação no preview |
| Tela de preview de import | Adicionar seção de parcelamentos |
| `src/lib/installment-detector.test.ts` | **Criar** — testes de detecção |

**Tarefas:**

1. Criar `installment-detector.ts` com função `detectInstallments(rows, existingGroups)`:
   - Sinal 1: linhas com `cardInstallment` mapeado no formato `X/Y` → agrupar por descrição normalizada + valor + total esperado.
   - Sinal 2: regex `/(\d+)\/(\d+)$/` na descrição — extrair `X/Y`, normalizar descrição removendo o padrão.
   - Sinal 3: agrupar por `(descrição normalizada, amountCents)` com mais de 1 ocorrência → sinalizar como série suspeita (sem `X/Y` explícito).
   - Verificar `existingGroups` para ver se já há um grupo compatível (associar) ou propor criar novo.
   - Retornar `InstallmentSuggestion[]`: `{ type: 'new' | 'existing', groupId?, groupDescription, lines: number[], installmentNumbers: number[], installmentCount: number, confidence: 'high' | 'medium' }`.
2. Integrar no `csv-import-service.ts`: no retorno do preview, incluir `installmentSuggestions`.
3. Criar `InstallmentDetectionSection.tsx`: lista de sugestões, cada uma com checkbox "Confirmar agrupamento" + indicador de confiança. Sugestões `high` pré-marcadas; `medium` desmarcadas.
4. Ao confirmar o import com sugestões aceitas: criar/associar `InstallmentGroup` antes de salvar as transactions, usando a action da Fase 8.
5. Testes de detecção dos 3 sinais.

**Critérios de conclusão:**
- Importar CSV com `"AMAZON 02/12"` → seção "Parcelamentos detectados" aparece com sugestão de grupo.
- Confirmar sugestão → transactions criadas com `installmentGroupId` e badge `"2/12"`.
- Rejeitar sugestão → transactions criadas normalmente sem vínculo.
- `pnpm test` passa.

---

### Fase 12 — TRN-07: Valor original em moeda estrangeira

**Objetivo:** Adicionar 3 campos opcionais à `Transaction` para registrar moeda original, taxa de câmbio e valor original. Formulário com modo simples e modo avançado. Tooltip no valor da linha.

**Pré-requisitos:** Nenhum (schema independente).

**Skills a consultar:** [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md)

**Schema — alterações:**
```prisma
// Em Transaction:
originalAmountCents BigInt?  @map("original_amount_cents")
originalCurrency    String?  @map("original_currency")    // max 3 chars, ISO 4217
exchangeRate        Decimal? @map("exchange_rate")         @db.Decimal(18, 6)
```

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Adicionar 3 campos |
| `prisma/migrations/` | Nova migration `add_foreign_currency` |
| `src/lib/schemas/transaction.ts` | Adicionar campos ao schema Zod |
| `src/server/services/transaction-service.ts` | Incluir campos em create/update |
| `src/lib/serializers/transaction.ts` | Incluir na serialização |
| `src/components/transactions/types.ts` | Adicionar ao tipo |
| `src/components/transactions/TransactionRowEditor.tsx` | Adicionar seção expansível "Moeda estrangeira" |
| `src/components/transactions/TransactionRow.tsx` | Tooltip no valor quando `originalCurrency` preenchido |
| `src/lib/messages/pt-BR.ts` | Labels |

**Tarefas:**

1. Schema + migration.
2. Adicionar ao Zod schema: `originalCurrency: z.string().max(3).optional()`, `exchangeRate: z.coerce.number().positive().optional()`, `originalAmountCents: z.coerce.bigint().optional()`.
3. Atualizar serializer e tipos.
4. Em `TransactionRowEditor.tsx`: adicionar collapse expansível "Moeda estrangeira" com:
   - **Modo simples**: `originalCurrency` (input, max 3) + `exchangeRate` (input numérico).
   - **Modo avançado** (link "Preencher valor original"): adiciona campo `originalAmountCents`. Quando ambos `amountCents` e `originalAmountCents` preenchidos, calcular e exibir `exchangeRate` como campo readonly.
5. Em `TransactionRow.tsx`: no campo de valor, se `originalCurrency` presente → envolver em `Tooltip` com texto `"${originalCurrency} ${originalAmountFormatted} @ R$${rate}"`.

**Critérios de conclusão:**
- Salvar transação com `originalCurrency = "USD"` e `exchangeRate = 5.12` → tooltip aparece no valor.
- Modo avançado: preencher R$256 + USD 49,99 → `exchangeRate` calculado como `5.12`.
- `pnpm test` passa.

---

### Fase 13 — TRN-06: `TransactionLink` — vínculos entre transações

**Objetivo:** Criar o modelo `TransactionLink` com enum de tipos. Dialog de busca para vincular transações. Badge na linha. Seção "Vínculos" no painel de detalhes.

**Pré-requisitos:** Nenhum (schema independente).

**Skills a consultar:** [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md)

**Schema — alterações:** Ver §3 TRN-06 desta spec (modelos `TransactionLinkType`, `TransactionLink`, relações em `Transaction`).

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Adicionar enum + modelo + relações em `Transaction` |
| `prisma/migrations/` | Nova migration `add_transaction_links` |
| `src/lib/schemas/transaction-link.ts` | **Criar** — Zod schemas |
| `src/server/services/transaction-link-service.ts` | **Criar** — `createLink`, `deleteLink`, `listLinksForTransaction` |
| `src/actions/transaction-links.ts` | **Criar** — actions |
| `src/components/transactions/TransactionDetailDialog.tsx` | Adicionar seção "Vínculos" |
| `src/components/transactions/LinkTransactionDialog.tsx` | **Criar** — dialog de busca e vínculo |
| `src/components/transactions/TransactionRowActions.tsx` | Adicionar opção "Vincular transação" no menu ⋮ |
| `src/components/transactions/TransactionRow.tsx` | Badge `↩` quando tem vínculos |
| `src/server/queries/month-page.ts` | Incluir `_count: { links: true }` no select |

**Tarefas:**

1. Schema + migration.
2. Criar `transaction-link-service.ts`:
   - `createLink(sourceId, targetId, type, notes, ctx)`: validar que ambos pertencem à `accountId`.
   - `deleteLink(linkId, ctx)`.
   - `listLinksForTransaction(transactionId, ctx)`: buscar links onde `sourceId = transactionId` OU `targetId = transactionId`, incluir dados da outra transação.
3. Actions em `src/actions/transaction-links.ts`.
4. Criar `LinkTransactionDialog.tsx`: campo de busca por descrição/valor/data → lista de resultados → seletor de tipo do link → botão confirmar.
5. Adicionar opção "Vincular transação" no `TransactionRowActions.tsx`.
6. No `TransactionDetailDialog.tsx`: nova seção "Vínculos" abaixo de "Histórico". Lista cada vínculo com tipo, valor da outra transação, data, botão de remover.
7. Em `TransactionRow.tsx`: ícone `LinkOutlined` discreto quando `_count.links > 0` (buscar do select de query).

**Critérios de conclusão:**
- Vincular despesa "Pizza" com reembolso "Pix João" como `reimbursed_by` → ambas mostram o badge.
- Painel de detalhes de "Pizza" → seção Vínculos mostra "Reembolsado por: Pix João — R$50".
- Remover vínculo → badge some de ambas.
- `pnpm test` passa.

---

### Fase 14 — §8: Impacto em widgets existentes

**Objetivo:** Atualizar os widgets existentes para incorporar as novas dimensões (`expenseType`, tags) como opções de filtro e breakdown nas suas configurações. Todos os novos campos são opcionais com `defaultVisible: false`.

**Pré-requisitos:** Fases 2 (expenseType) + Fase 6 (tags).

**Skills a consultar:** [`dashboard-widgets`](../skills/dashboard-widgets/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md)

**Arquivos a criar ou modificar (por widget):**

| Widget | Arquivo | Mudança |
|---|---|---|
| `category-breakdown` | query + config schema | Filtro por tag; dimensão `expenseType` no breakdown |
| `member-breakdown` | query + config schema | Filtro por `expenseType` |
| `top-transactions` | componente | Badge `"X/Y"` nas linhas; filtro por `source` |
| `kpi-budget-health` / `budgets` | query | Opção de separar fixo vs variável |
| `daily-heatmap` | query + config schema | Opção de colorir por `expenseType` |

**Tarefas:**

1. Para cada widget listado: ler o arquivo de query + componente atuais.
2. Adicionar ao config schema do widget as novas opções (com defaults que preservam comportamento atual).
3. Atualizar as queries para filtrar/agrupar pelos novos campos quando configurados.
4. Atualizar os painéis de configuração dos widgets (WidgetConfig) para expor as novas opções.
5. Testar que widgets sem as novas opções configuradas se comportam identicamente ao estado anterior.

**Critérios de conclusão:**
- Configurar `category-breakdown` para mostrar só `expenseType = fixed` → filtro funciona.
- Configurar `top-transactions` para filtrar por `source = csv_import` → funciona.
- Widgets sem nova configuração se comportam igual ao pré-fase.
- `pnpm test` passa.

---

### Fase 15 — TRN-05: Split de transação (v3)

> ⚠️ **Adiada (decisão de 2026-06-29).** Não será implementada por ora — a complexidade de UI (accordion inline, editor de sub-itens, refinement de soma) não compensa frente ao valor atual do produto. Permanece registrada como **ideia futura (v3)**. O conteúdo abaixo é preservado como referência de design para quando/se for retomada. Nenhum campo `splits` foi adicionado ao schema.

**Objetivo:** Adicionar campo `splits Json?` à `Transaction`. Formulário expansível com sub-itens. Accordion inline na linha da tabela exibindo os splits.

**Pré-requisitos:** Todas as fases anteriores (especialmente Fase 4 e Fase 6 para comportamento da linha estar estável).

**Skills a consultar:** [`money-handling`](../skills/money-handling/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

**Schema — alterações:**
```prisma
// Em Transaction:
splits Json? // array de SplitItem — ver schema Zod abaixo
```

**Zod schema do split:**
```ts
const splitItemSchema = z.object({
  amountCents: z.coerce.bigint().positive(),
  description: z.string().max(200).optional(),
  categoryId: z.string().cuid().nullable().optional(),
  subcategoryId: z.string().cuid().nullable().optional(),
})

// Em transactionFormSchema:
splits: z.array(splitItemSchema).max(20).optional()
// Refinement server-side: soma dos splits = amountCents do pai
```

**Arquivos a criar ou modificar:**

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | Adicionar `splits Json?` |
| `prisma/migrations/` | Nova migration `add_transaction_splits` |
| `src/lib/schemas/transaction.ts` | Adicionar `splits` + refinement |
| `src/server/services/transaction-service.ts` | Incluir `splits` em create/update |
| `src/lib/serializers/transaction.ts` | Serializar `splits` (BigInt nos items) |
| `src/components/transactions/types.ts` | Adicionar `splits` ao tipo |
| `src/components/transactions/SplitItemsEditor.tsx` | **Criar** — editor de sub-itens |
| `src/components/transactions/TransactionRowEditor.tsx` | Adicionar seção expansível de splits |
| `src/components/transactions/TransactionRow.tsx` | Ícone + accordion de splits |
| `src/components/transactions/TransactionDetailDialog.tsx` | Exibir splits na seção de detalhes |

**Tarefas:**

1. Schema + migration.
2. Adicionar ao Zod schema com refinement server-side verificando soma.
3. Atualizar serializer para lidar com BigInt nos items do JSON.
4. Criar `SplitItemsEditor.tsx`: lista de sub-itens com campos `amountCents`, `description`, `categoryId`. Botão `+ Adicionar item`. Ao digitar valores, exibir valor restante não alocado em tempo real. Bloqueio de salvar se soma ≠ valor total.
5. Em `TransactionRowEditor.tsx`: seção expansível "Detalhar com itens" abrindo `SplitItemsEditor`.
6. Em `TransactionRow.tsx`: ícone `CallSplitIcon` discreto + badge `"3 itens"` quando `splits?.length > 0`. Clicar expande accordion com tabela de sub-itens abaixo da linha pai.
7. Em `TransactionDetailDialog.tsx`: seção "Itens" exibindo os splits com valor, descrição e categoria de cada um.

**Critérios de conclusão:**
- Criar transação de R$200 com 3 splits → badge "3 itens" na linha.
- Expandir linha → accordion com 3 sub-itens listados.
- Salvar com soma incorreta → erro de validação exibido.
- Totais de seção/mês não alterados (o pai ainda conta com R$200 inteiros).
- `pnpm test` passa.

---

### Fase 16 — Colunas expostas no picker de Tipo de Tabela (`expenseType`, `tags`, `paymentMethod`)

> ✅ **Implementada (2026-07).**

**Objetivo:** Expor no picker de settings → Tipos de Tabela três colunas que já eram renderizadas mas não eram configuráveis: `expenseType` (label "Tipo de transação"), `tags` (label "Tags") e `paymentMethod` (label "Método de pagamento"). Sem alteração de schema (`hiddenColumns` já é `Json`).

**Pré-requisitos:** Fase 2 (`expenseType`), Fase 6 (tags) e Fase 17 (`paymentMethod`) para que a chave exista.

**Regras:**
- Colunas core sempre visíveis (não toggleáveis): `occurredOn` (Data), `amount` (Valor), `description` (Descrição).
- O tipo de tabela **default** continua ignorando `hiddenColumns` (sempre exibe tudo) — comportamento inalterado.

**Critérios de conclusão:**
- No picker de Tipo de Tabela aparecem os switches de "Tipo de transação", "Tags" e "Método de pagamento".
- Ocultar cada coluna reflete na renderização da tabela financeira do tipo correspondente.
- `pnpm test` passa.

---

### Fase 17 — TRN-11: Método de pagamento (`paymentMethod`)

> ✅ **Implementada (2026-07).**

**Objetivo:** Adicionar o campo `paymentMethod` à `Transaction`, baseado no **enum fixo** `TransactionPaymentMethod` (não é model gerenciável — sem settings, CRUD ou seeding). Renderizar como coluna nova e célula editável. Ver TRN-11.

**Pré-requisitos:** Nenhum (independente das demais fases).

**Skills a consultar:** [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md)

**Schema — alterações:**
```prisma
enum TransactionPaymentMethod {
  pix
  cash
  credit_card
  debit_card
  bank_transfer
  boleto
  other

  @@map("transaction_payment_method")
}

// Em Transaction:
paymentMethod TransactionPaymentMethod? @map("payment_method") // ao lado de expenseType
```

**Tarefas:**
1. Schema + migration (enum + campo nullable). **Não** adicionar a `TableTemplateItem`.
2. Propagar em create/update/duplicate/bulkUpdate do `transaction-service`; incluir no `baseTransactionSchema` e em `bulkUpdateSchema.patch`; no serializer; no tipo `TransactionRow`; e no `select` da query da month-page.
3. Renderizar coluna nova (label curto "Método", completo "Método de pagamento") **após** "Instituição" e **antes** de "Valor".
4. Célula editável com `<Select>` MUI simples ("Nenhum" + 7 valores) na linha nova e no editor de linha existente; read-only na linha e no painel de detalhes. Labels pt-BR conforme TRN-11.
5. Tornar a coluna configurável via `TableType.hiddenColumns` (chave `paymentMethod`) — ver Fase 16.

**Critérios de conclusão:**
- Selecionar um método na nova linha → persiste ao salvar.
- Editar o método numa linha existente → persiste.
- Bulk update de método em N transações → aplica a todas.
- `pnpm test` passa.

---

### Fase 18 — TRN-12: Entrada rápida no lançamento manual

> ✅ **Implementada (2026-07).**

**Objetivo:** Tornar o lançamento manual em série rápido e correto. Ver TRN-12.

**Pré-requisitos:** Fase 2 (`expenseType`) e Fase 17 (`paymentMethod`).

**Skills a consultar:** [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`ui-feedback`](../skills/ui-feedback/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md)

**Tarefas:**
1. Pré-selecionar `expenseType = one_time` na nova linha — apenas no fluxo manual; **sem** `.default()` no Zod compartilhado.
2. Corrigir persistência: incluir o `expenseType` escolhido no payload de create da nova linha; incluir `expenseType` e `paymentMethod` no payload de update de `saveEdit` (linha existente).
3. Fluxo linha-aberta: após salvar pela nova linha, manter a linha aberta, limpar campos editáveis (descrição, valor, categoria, subcategoria, instituição, tipo de investimento, método de pagamento, notas, moeda estrangeira), preservar `occurredOn`, resetar tipo para `one_time` e focar a descrição. Fechar continua explícito (ESC/cancelar).

**Critérios de conclusão:**
- Salvar pela nova linha → linha permanece aberta, data preservada, tipo volta a `one_time`, foco na descrição.
- `expenseType`/`paymentMethod` escolhidos na nova linha e na edição inline persistem.
- ESC/cancelar fecham a linha.
- `pnpm test` passa.
