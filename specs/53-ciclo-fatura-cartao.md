# Spec 53 — Ciclo de Fatura de Cartão de Crédito

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Brasil & Agregação
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md)
> Relacionado: [`spec 41`](41-aprimoramentos-objeto-transacao.md) (parcelamento — `InstallmentGroup`/`PendingInstallment`, **reusar, não reescrever**)

---

## 1. Problema

- **CARD-01 — App organiza por mês-calendário, cartão organiza por ciclo de fatura**: toda a estrutura (Month/Section/FinanceTable, ver `prisma/schema.prisma` model `Month` e `Transaction.occurredOn`) ancora as transações no **mês-calendário** da `occurredOn`. Cartão de crédito não funciona assim: tem **dia de fechamento** e **dia de vencimento** que definem uma fatura cujo período não coincide com o mês civil.
- **CARD-02 — Transações de cartão caem no mês de competência errado**: uma compra em 28/06 num cartão que fecha dia 25 pertence à fatura que vence em julho, mas hoje ela é contabilizada em junho (mês da `occurredOn`). Isso distorce o "quanto vou pagar neste mês" e qualquer análise por fatura.
- **CARD-03 — Fatura não é entidade de primeira classe**: Organizze e Mobills tratam a fatura como objeto próprio (aberta/fechada/paga, com total e vencimento). No MyAccountant não existe modelo de fatura nem de cartão; só `Institution` (genérica) e `Transaction.cardInstallment`/`installmentGroupId`.
- **CARD-04 — Parcelas existentes não se associam à fatura**: a spec 41 já criou `InstallmentGroup`/`PendingInstallment` para parcelamento estruturado. Hoje essas parcelas viram `Transaction` num mês-calendário, sem vínculo com a fatura em que efetivamente caem. É preciso **integrar** (não duplicar) o parcelamento existente ao ciclo de fatura.

---

## 2. Solução

> Reusa integralmente o parcelamento da spec 41. Nenhuma reescrita de `InstallmentGroup`/`PendingInstallment` — apenas associação à fatura correta.

### 2.1 CARD-01 / CARD-03 — Modelos `CreditCard` e `CardInvoice`

```prisma
enum CardInvoiceStatus {
  open    // ciclo ainda não fechou
  closed  // fechou, aguardando pagamento
  paid    // paga

  @@map("card_invoice_status")
}

model CreditCard {
  id            String   @id @default(cuid())
  accountId     String   @map("account_id")
  name          String                                  // "Nubank Roxinho"
  institutionId String?  @map("institution_id")
  closingDay    Int      @map("closing_day")            // 1–31, dia de fechamento
  dueDay        Int      @map("due_day")                // 1–31, dia de vencimento
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at")

  account     Account       @relation(fields: [accountId], references: [id], onDelete: Cascade)
  institution Institution?  @relation(fields: [institutionId], references: [id], onDelete: SetNull)
  invoices    CardInvoice[]

  @@index([accountId])
  @@map("credit_cards")
}

model CardInvoice {
  id            String            @id @default(cuid())
  accountId     String            @map("account_id")
  creditCardId  String            @map("credit_card_id")
  periodStart   DateTime          @map("period_start") @db.Date // fechamento anterior + 1
  periodEnd     DateTime          @map("period_end") @db.Date   // dia de fechamento desta fatura
  dueDate       DateTime          @map("due_date") @db.Date
  status        CardInvoiceStatus @default(open)
  totalCents    BigInt            @default(0) @map("total_cents") // derivado da soma das transações
  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")

  account      Account       @relation(fields: [accountId], references: [id], onDelete: Cascade)
  creditCard   CreditCard    @relation(fields: [creditCardId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@unique([creditCardId, periodEnd])
  @@index([accountId])
  @@index([creditCardId, status])
  @@map("card_invoices")
}
```

`Transaction` ganha vínculo opcional à fatura:

```prisma
// Em Transaction:
cardInvoiceId String?      @map("card_invoice_id")
cardInvoice   CardInvoice? @relation(fields: [cardInvoiceId], references: [id], onDelete: SetNull)
// + @@index([cardInvoiceId])
```

- `totalCents` da fatura é **derivado** (soma dos `amountCents` das transações vinculadas), recalculado em centavos/`BigInt`, nunca `Float`.

### 2.2 CARD-02 — Associação por ciclo

- Dado um `CreditCard` com `closingDay`, a fatura de uma transação é resolvida pelo `occurredOn`: se `occurredOn` é posterior ao fechamento do ciclo corrente, cai na próxima fatura; senão, na atual. O cálculo de borda (fechamento, virada de mês, meses curtos como fevereiro) respeita `date-timezone` e usa `occurredOn` (`@db.Date`, sem timezone).
- O `dueDate` da fatura é derivado do `dueDay` no mês de vencimento (que pode ser o mês seguinte ao `periodEnd` quando `dueDay < closingDay`).

### 2.3 CARD-03 — Visão de fatura

- Visão "Fatura aberta / fechada" por cartão: lista as transações da fatura, total derivado, `periodStart→periodEnd`, `dueDate` e `status`. Fechar/marcar como paga transiciona o `status` (`open → closed → paid`).

### 2.4 CARD-04 — Integração com parcelamento da spec 41

- Ao criar/vincular `Transaction` de parcela (originada de `InstallmentGroup`/`PendingInstallment`), o serviço **também** resolve e atribui o `cardInvoiceId` correto pelo `occurredOn` da parcela vs ciclo do cartão. A parcela continua sendo a mesma `Transaction` da spec 41 — apenas ganha o vínculo de fatura. Nada do modelo de parcelamento é duplicado.

---

## 3. User Stories

- Como usuário de cartão de crédito, quero que uma compra feita após o fechamento entre na fatura certa, para saber quanto vou pagar em cada vencimento.
- Como usuário, quero ver a fatura aberta e a fechada de cada cartão com total e vencimento, para me planejar.
- Como usuário que parcela compras, quero que cada parcela apareça na fatura do mês em que cai, para que a soma da fatura bata com o que o banco cobra.

---

## 4. Critérios de Aceitação

**CARD-01 / CARD-02:**
- QUANDO uma transação de cartão tem `occurredOn` posterior ao `closingDay` do ciclo corrente, ELA DEVE ser associada à fatura do ciclo seguinte, não à do mês-calendário da `occurredOn`.
- QUANDO `dueDay < closingDay`, O `dueDate` da fatura DEVE cair no mês seguinte ao `periodEnd`.
- QUANDO o ciclo cruza fevereiro ou um mês com menos dias que o `closingDay`, O CÁLCULO DE BORDA DEVE resolver para o último dia válido do mês, sem lançar erro.

**CARD-03 (multi-tenancy):**
- QUANDO qualquer query lê `CreditCard` ou `CardInvoice`, ELA DEVE filtrar por `accountId`; um membro NÃO DEVE ver cartões/faturas de outra Account.
- QUANDO uma fatura é exibida, SEU `totalCents` DEVE ser igual à soma (em `BigInt` centavos) dos `amountCents` das transações vinculadas.
- QUANDO o usuário marca uma fatura como paga, SEU `status` DEVE transicionar para `paid` e NÃO DEVE permitir voltar a `open`.

**CARD-04:**
- QUANDO uma parcela de um `InstallmentGroup` é materializada como `Transaction`, ELA DEVE receber o `cardInvoiceId` resolvido pelo seu `occurredOn`, mantendo intactos `installmentGroupId`/`installmentNumber`.
- O SISTEMA NÃO DEVE criar nenhum modelo de parcelamento novo — DEVE reusar `InstallmentGroup`/`PendingInstallment` da spec 41.

---

## 5. Fora de Escopo

- **Juros rotativo, encargos por atraso e CET** — cálculo financeiro de fatura não paga fica de fora.
- **Pagamento da fatura via Open Finance / Pix** — depende da spec 52 e de payment initiation.
- **Importação automática do PDF/extrato da fatura** — coberto por import CSV/XLSX (spec 10) e agregação (spec 52).
- **Limite de crédito e disponível** — não modelado nesta spec.
- **Reescrever ou alterar o ciclo de vida de parcelamento da spec 41** — apenas associação à fatura.

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Fatura como entidade | `CardInvoice` de 1ª classe (período + status + total) | Alinha com Organizze/Mobills; permite "quanto pago neste vencimento" correto |
| DD-02 | Vínculo transação↔fatura | FK opcional `cardInvoiceId` em `Transaction` | Não-cartão fica `null`; zero impacto nas queries atuais por mês |
| DD-03 | `totalCents` da fatura | Derivado (soma em `BigInt`), recalculado | Fonte da verdade são as transações; evita divergência |
| DD-04 | Parcelas | Reusar spec 41; só atribuir `cardInvoiceId` | Evita duplicação de modelo e lógica de parcelamento |
| DD-05 | Borda de meses curtos | Clamp para o último dia válido do mês | Robusto a fevereiro e meses de 30 dias |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Modelos `CreditCard`, `CardInvoice`, enum, FK em `Transaction` | `prisma/schema.prisma` + nova migration |
| Serviço de cartão (CRUD) e de fatura (resolução de ciclo, total, status) | `src/server/services/credit-card-service.ts` · `src/server/services/card-invoice-service.ts` (criar) |
| Resolução de ciclo por `occurredOn` (borda de mês, timezone) | reusar utilitários de `src/lib/date/` (ver `skills/date-timezone/SKILL.md`) |
| Integração com parcelamento existente | `src/server/services/transaction-service.ts` (atribuir `cardInvoiceId` ao materializar parcela) · spec 41 §3 TRN-02 |
| Soma de valores em centavos | `skills/money-handling/SKILL.md` |
| Estrutura de mês/seção (contexto) | `prisma/schema.prisma` (models `Month`, `Section`, `FinanceTable`, `Transaction`) |
