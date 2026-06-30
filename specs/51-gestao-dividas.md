# Spec 51 — Gestão de Dívidas

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Profundidade Financeira
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`dashboards-charts`](../skills/dashboards-charts/SKILL.md)

---

## 1. Problema

- **DEBT-01**: Não há cadastro de **dívidas/empréstimos** com saldo devedor, taxa de juros e pagamento mínimo. O usuário com financiamento, empréstimo pessoal ou rotativo de cartão não tem onde registrar essas obrigações de forma estruturada (os passivos da spec 46 guardam só um saldo, sem juros nem plano).
- **DEBT-02**: Sem taxa de juros e pagamento mínimo, é impossível **simular um plano de quitação**. As duas estratégias clássicas — *snowball* (quitar o menor saldo primeiro, motivação) e *avalanche* (quitar o maior juros primeiro, ótimo financeiro) — não existem no app. YNAB e PocketGuard oferecem.
- **DEBT-03**: Não há forma de **vincular pagamentos reais** (transações) a uma dívida, então o saldo devedor não reflete o que já foi pago.

---

## 2. Solução

Modelo `Debt` (saldo, juros, pagamento mínimo) + simulador de quitação *snowball*/*avalanche* com timeline, e vínculo opcional de pagamentos a transações. Valores monetários em `BigInt` centavos; taxa de juros como `Decimal`.

- **DEBT-01**: modelo `Debt` com `principalCents`, `interestRateAnnual` (`Decimal`), `minPaymentCents`, `institutionId` opcional.
- **DEBT-02**: serviço de simulação **derivado** (sem persistir o plano) que, dado um aporte extra mensal e a estratégia, produz a ordem de quitação e a timeline (meses até zerar, total de juros).
- **DEBT-03**: modelo `DebtPayment` (pagamento de uma dívida) com `transactionId` opcional; o saldo devedor corrente = `principalCents` − soma dos pagamentos de principal.

```prisma
enum DebtPayoffStrategy {
  snowball   // menor saldo primeiro
  avalanche  // maior juros primeiro

  @@map("debt_payoff_strategy")
}

model Debt {
  id                 String   @id @default(cuid())
  accountId          String   @map("account_id")
  name               String                                   // "Financiamento do carro"
  principalCents     BigInt   @map("principal_cents")         // saldo devedor inicial
  interestRateAnnual Decimal  @map("interest_rate_annual") @db.Decimal(6, 4) // % a.a. (ex: 12.5000)
  minPaymentCents    BigInt   @map("min_payment_cents")
  institutionId      String?  @map("institution_id")
  isPaidOff          Boolean  @default(false) @map("is_paid_off")
  createdById        String   @map("created_by_id")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  account     Account       @relation(fields: [accountId], references: [id], onDelete: Cascade)
  institution Institution?  @relation(fields: [institutionId], references: [id], onDelete: SetNull)
  payments    DebtPayment[]

  @@index([accountId])
  @@map("debts")
}

model DebtPayment {
  id            String   @id @default(cuid())
  accountId     String   @map("account_id")
  debtId        String   @map("debt_id")
  amountCents   BigInt   @map("amount_cents")     // valor pago
  principalCents BigInt  @map("principal_cents")  // parcela que abate o principal
  paidOn        DateTime @map("paid_on") @db.Date
  transactionId String?  @map("transaction_id")   // vínculo opcional ao lançamento
  createdAt     DateTime @default(now()) @map("created_at")

  account     Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)
  debt        Debt         @relation(fields: [debtId], references: [id], onDelete: Cascade)
  transaction Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)

  @@index([accountId])
  @@index([debtId])
  @@map("debt_payments")
}
```

`Account` ganha `debts Debt[]` e `debtPayments DebtPayment[]`; `Institution` ganha `debts Debt[]`; `Transaction` ganha `debtPayments DebtPayment[]`.

---

## 3. User Stories

- Como usuário, quero cadastrar minhas dívidas com saldo devedor, taxa de juros e pagamento mínimo, para ter visão consolidada do que devo.
- Como usuário, quero simular um plano de quitação pela estratégia snowball ou avalanche, para escolher como atacar minhas dívidas.
- Como usuário, quero ver em quantos meses ficarei livre de dívidas e quanto pagarei de juros em cada estratégia, para decidir com base em números.
- Como usuário, quero vincular um pagamento real (transação) a uma dívida, para que o saldo devedor reflita o que já paguei.

---

## 4. Critérios de Aceitação

- QUANDO o usuário cadastra uma `Debt`, O SISTEMA DEVE exigir `name`, `principalCents` (`BigInt`), `interestRateAnnual` (`Decimal`) e `minPaymentCents` (`BigInt`). NÃO DEVE usar `Float` para nenhum valor monetário.
- QUANDO o simulador roda com estratégia `snowball`, O SERVIÇO DEVE ordenar as dívidas por saldo devedor crescente; QUANDO `avalanche`, por `interestRateAnnual` decrescente.
- QUANDO o simulador roda, O SERVIÇO DEVE aplicar o pagamento mínimo a todas as dívidas e direcionar o aporte extra à dívida prioritária da estratégia, calculando mês a mês o juro sobre o saldo até zerar — e DEVE retornar meses-até-quitação e total de juros por estratégia. O plano NÃO DEVE ser persistido (cálculo derivado).
- QUANDO um `DebtPayment` é registrado, O SISTEMA DEVE abater `principalCents` do saldo devedor corrente da dívida; QUANDO o saldo devedor chega a zero, DEVE marcar `isPaidOff = true`.
- QUANDO um `DebtPayment` referencia `transactionId`, O SISTEMA DEVE validar que a transação pertence à mesma account; SE não pertencer, DEVE rejeitar.
- **Multi-tenancy**: QUANDO qualquer query lê ou grava `Debt` / `DebtPayment`, ela DEVE filtrar por `accountId`. Um usuário NÃO DEVE simular, pagar ou ler dívidas de outra account, mesmo informando um `debtId` válido de terceiro.
- A TIMELINE do simulador DEVE ser renderizada com cores do tema em light e dark mode, nunca hex hardcoded.

---

## 5. Fora de Escopo

- **CET / juros compostos com tarifas e seguros** — o simulador usa juros sobre saldo de forma simplificada; modelagem financeira completa fica fora (consistente com spec 41 §6).
- **Renegociação automática / portabilidade de dívida** — fora do escopo.
- **Importação de contrato de financiamento** (PDF/boleto) — fora do escopo.
- **Sincronização do saldo devedor via Open Finance** — fica para a spec 52.
- **Alertas de vencimento de pagamento** — coberto pela spec 29 (notificações).
- **Unificação com os passivos da spec 46** — `Debt` é estruturada (com juros/plano); o passivo da spec 46 é só um saldo. A consolidação das duas visões fica para spec futura.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Plano de quitação | Cálculo derivado, não persistido | Depende de inputs voláteis (aporte extra, estratégia) |
| Taxa de juros | `Decimal(6,4)` anual | Precisão sem `Float`; segue convenção de `exchangeRate` em `Transaction` |
| Saldo devedor corrente | `principalCents` − soma de principal pago | Evita campo mutável propenso a divergir |
| Pagamento vinculado | `transactionId` opcional, `onDelete: SetNull` | Pagamento sobrevive à exclusão da transação |
| Diferença vs. spec 46 | `Debt` tem juros e plano; passivo da 46 é saldo simples | Casos de uso distintos, modelos separados |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Modelos `Debt` / `DebtPayment` + enum | `prisma/schema.prisma` · nova migration `add_debts` |
| Service de simulação (snowball/avalanche) | `src/server/services/debt-payoff-service.ts` (novo) |
| Service CRUD + pagamentos | `src/server/services/debt-service.ts` (novo) |
| Schemas Zod | `src/lib/schemas/debt.ts` (novo) |
| Actions CRUD + registro de pagamento | `src/actions/debts.ts` (novo) |
| Serialização BigInt/Decimal → string | `src/lib/serializers/` (novo serializer) |
| Widget/tela de timeline | `src/components/dashboard/widgets/` (novo widget `debt-payoff`) |
| Labels de UI | `src/lib/messages/pt-BR.ts` |
| Passivos (não duplicar) | `specs/46-patrimonio-liquido.md` |
