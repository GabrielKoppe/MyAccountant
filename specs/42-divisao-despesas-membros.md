# Spec 42 — Divisão de Despesas entre Membros

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Colaboração
> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`ui-feedback`](../skills/ui-feedback/SKILL.md)

---

## 1. Problema

- **COL-01**: Uma Account já tem múltiplos membros com papéis (`AccountMember` / `AccountMemberRole` em `prisma/schema.prisma:195-209`), mas não existe nenhuma estrutura que represente "esta despesa de R$ 300 deve ser dividida entre João, Maria e Ana". Hoje quem paga lança a transação inteira no próprio nome e a divisão fica fora do app (planilha à parte, mensagem no WhatsApp).
- **COL-02**: A spec 41 introduziu `TransactionLink` com os tipos `reimbursed_by` e `paid_for` (`prisma/schema.prisma:71-77,694-711`), que registram um vínculo de reembolso entre **duas** transações, mas não modelam a divisão de **uma** despesa entre **N** membros com diferentes métodos (igual / percentual / valor fixo / cotas).
- **COL-03**: Não há saldo consolidado "quem deve a quem" na Account. O usuário não consegue responder "no total, quanto a Maria me deve somando todas as despesas compartilhadas do mês?".
- **COL-04**: Não há tela de acerto de contas (settle up). Quando uma dívida é paga, não há fluxo que registre a quitação reaproveitando o `TransactionLink` (`reimbursed_by`) que já existe.
- **COL-05**: Risco de confusão de escopo: o "split por categoria" (Spec 41 TRN-05, adiado para v3) divide uma transação entre **categorias**. Esta spec trata de divisão entre **pessoas** — são features distintas e não devem compartilhar modelo.

---

## 2. Solução

### 2.1 Modelo de divisão (COL-01, COL-02, COL-05)

Novo modelo `ExpenseSplit`: cada linha representa a parcela de **um membro devedor** sobre **uma transação**. A transação-pai continua lançada por quem pagou; os splits são o detalhamento de quem deve o quê.

```prisma
enum ExpenseSplitMethod {
  equal       // dividido igualmente entre os participantes
  percentage  // cada participante tem um percentual
  fixed       // cada participante tem um valor fixo em centavos
  shares      // cada participante tem um número de cotas (peso)

  @@map("expense_split_method")
}

model ExpenseSplit {
  id            String             @id @default(cuid())
  accountId     String             @map("account_id")
  transactionId String             @map("transaction_id")
  debtorUserId  String             @map("debtor_user_id")   // membro que deve sua parte
  method        ExpenseSplitMethod                          // método usado no grupo do split
  shareCents    BigInt             @map("share_cents")      // parte devida, sempre em centavos (resolvida na criação)
  settled       Boolean            @default(false)          // já quitada?
  settledLinkId String?            @map("settled_link_id")  // TransactionLink (reimbursed_by) que registrou a quitação
  createdAt     DateTime           @default(now()) @map("created_at")

  account     Account     @relation(fields: [accountId], references: [id], onDelete: Cascade)
  transaction Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  debtor      User        @relation("ExpenseSplitDebtor", fields: [debtorUserId], references: [id], onDelete: Cascade)

  @@unique([transactionId, debtorUserId])
  @@index([accountId])
  @@index([transactionId])
  @@index([accountId, debtorUserId, settled])
  @@map("expense_splits")
}
```

- O `method` é informacional/auditável; a resolução para `shareCents` acontece na camada de serviço no momento da criação (igual / percentual / valor fixo / cotas → centavos). Valores monetários sempre `BigInt` em centavos (skill `money-handling`).
- A soma dos `shareCents` de todos os splits de uma transação DEVE ser igual ao `amountCents` da transação-pai (validação Zod server-side). O credor (quem pagou) não recebe linha de `ExpenseSplit` — sua parte é o resíduo `amountCents - Σ shareCents(outros)`; opcionalmente uma linha com `debtorUserId = pagador` para representar a própria cota.

### 2.2 Saldo consolidado "quem deve a quem" (COL-03)

- Serviço `expense-split-service.ts` computa o **saldo líquido por par de membros** na Account: para cada par (A, B), soma o que A deve a B menos o que B deve a A, considerando apenas splits com `settled = false`.
- **Simplificação de dívidas**: algoritmo que minimiza o número de pagamentos (greedy de maior credor → maior devedor) para produzir a lista mínima de transferências que zera os saldos.

### 2.3 Tela "Acerto de contas" (settle up) (COL-04)

- Lista os saldos líquidos e as transferências sugeridas pela simplificação.
- Ao confirmar uma quitação, o serviço: (a) marca os `ExpenseSplit` envolvidos como `settled = true`; (b) cria um `TransactionLink` do tipo `reimbursed_by` (reaproveitando o modelo da Spec 41) ligando a transação de reembolso à(s) despesa(s) original(is); (c) grava o `settledLinkId` no split. Nenhuma nova estrutura de quitação é inventada — reutiliza `TransactionLink`.

---

## 3. User Stories

- Como membro que pagou o jantar, quero dividir a despesa igualmente entre 3 membros, para que cada um veja sua parte sem eu precisar de planilha externa.
- Como membro de uma Account, quero ver um saldo consolidado de "quem deve a quem", para saber quanto recebo ou devo no total.
- Como membro, quero uma tela de acerto de contas que sugira o menor número de transferências, para quitar tudo com o mínimo de Pix.
- Como dono da Account, quero que registrar uma quitação crie automaticamente um vínculo de reembolso na transação original, para manter o histórico rastreável.

## 4. Critérios de Aceitação

**COL-01 / COL-02 (divisão):**
- QUANDO o usuário divide uma transação entre N membros, O SERVIÇO DEVE criar N registros `ExpenseSplit` (ou N−1, se a cota do pagador for resíduo) cada um com `shareCents` em centavos e o `method` usado.
- SE o método é `equal`, O SERVIÇO DEVE distribuir `amountCents` igualmente e atribuir o resto da divisão inteira ao último participante, de modo que `Σ shareCents == amountCents`.
- SE o método é `percentage`, O SERVIÇO DEVE rejeitar (ActionResult erro) quando a soma dos percentuais não for exatamente 100.
- SE o método é `fixed` ou `shares`, O SERVIÇO DEVE rejeitar quando `Σ shareCents != amountCents` da transação-pai.
- QUANDO já existe um `ExpenseSplit` para o par (`transactionId`, `debtorUserId`), O SERVIÇO NÃO DEVE criar duplicata (garantido por `@@unique([transactionId, debtorUserId])`).

**COL-03 (saldo):**
- QUANDO o saldo é calculado, O SERVIÇO DEVE considerar apenas splits com `settled = false` e retornar o líquido por par de membros (positivo = a receber, negativo = a pagar).
- QUANDO a simplificação de dívidas roda, A LISTA de transferências resultante DEVE zerar todos os saldos líquidos e DEVE ter no máximo (nº de membros com saldo não-zero − 1) transferências.

**COL-04 (settle up):**
- QUANDO o usuário confirma uma quitação na tela de acerto de contas, O SERVIÇO DEVE marcar os splits quitados como `settled = true`, criar um `TransactionLink` `reimbursed_by` e gravar `settledLinkId` nos splits afetados.
- SE a quitação falha em qualquer etapa, O SERVIÇO DEVE reverter a transação inteira (nenhum split fica `settled` sem `TransactionLink` correspondente).

**Multi-tenancy:**
- QUANDO qualquer action de divisão/saldo/quitação é chamada, A ACTION DEVE começar com `requireAccountAccess(accountId)` e toda query Prisma DEVE filtrar por `accountId`.
- QUANDO o `debtorUserId` informado não é membro da Account (`AccountMember`), O SERVIÇO DEVE rejeitar.
- QUANDO a `transactionId` informada pertence a outra Account, O SERVIÇO DEVE rejeitar (sem vazamento entre tenants).

## 5. Fora de Escopo

- Split por **categoria** dentro de uma mesma transação (Spec 41 TRN-05 / v3) — esta spec é divisão entre pessoas.
- Cobrança automática / integração de pagamento (Pix, links de cobrança) — apenas registro manual da quitação.
- Notificação ao membro devedor quando uma despesa é dividida — depende da Spec 45 (feed/menções); pode ser ligada depois.
- Divisão de despesas com pessoas **fora** da Account (não-membros) — todos os participantes precisam ser `AccountMember`.
- Histórico/relatório de saldos ao longo do tempo — apenas o saldo corrente (não quitado).

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Onde modelar a divisão | Novo modelo `ExpenseSplit` (1 linha por devedor) em vez de JSON na transação | Permite `@@unique`, índices e query de saldo por membro sem varrer JSON |
| DD-02 | Resolução do método | `method` guardado para auditoria; `shareCents` resolvido na criação | Saldo e relatórios leem só `shareCents` (centavos), sem recalcular |
| DD-03 | Quitação | Reaproveita `TransactionLink` `reimbursed_by` da Spec 41 + flag `settled` | Não duplica conceito de reembolso já existente |
| DD-04 | Simplificação de dívidas | Greedy credor↔devedor (estilo Splitwise) | Minimiza nº de transferências; suficiente para N pequeno (membros de uma Account) |

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| COL-01/02 schema | `prisma/schema.prisma` (enum `ExpenseSplitMethod`, model `ExpenseSplit`, relações em `Account`, `Transaction`, `User`) |
| Migration | `prisma/migrations/` (`add_expense_splits`) |
| Validação | `src/lib/schemas/expense-split.ts` (Zod: método, participantes, soma == total) |
| Lógica de divisão + saldo + simplificação | `src/server/services/expense-split-service.ts` |
| Actions | `src/actions/expense-splits.ts` (`splitTransactionAction`, `settleUpAction`) com `defineAction` |
| Reuso de reembolso | `src/server/services/transaction-link-service.ts` (Spec 41) — criar `reimbursed_by` na quitação |
| Mensagens | `src/lib/messages/pt-BR.ts` (labels de método, "Acerto de contas", "a receber", "a pagar") |
| UI divisão | `src/components/transactions/SplitExpenseDialog.tsx` (via `DialogShell`) |
| UI settle up | `src/components/accounts/SettleUpView.tsx` |
| Testes | `src/server/services/expense-split-service.test.ts` (divisão, soma, saldo, simplificação, multi-tenancy) |
