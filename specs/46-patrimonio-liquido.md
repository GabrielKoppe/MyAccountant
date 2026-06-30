# Spec 46 — Patrimônio Líquido (Net Worth)

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Profundidade Financeira
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`dashboards-charts`](../skills/dashboards-charts/SKILL.md)

---

## 1. Problema

- **NW-01**: O domínio inteiro modela **fluxo** (transações organizadas por mês → seção → tabela, ver `prisma/schema.prisma` model `Transaction`). Não existe representação de **estoque patrimonial**: o usuário não consegue cadastrar uma conta corrente, um investimento, um imóvel (ativos) nem um empréstimo ou saldo de cartão (passivos).
- **NW-02**: Sem ativos e passivos cadastrados, é impossível calcular o **patrimônio líquido** (ativos − passivos) — a tela "hero" de todo PFM premium (Monarch, Copilot). O usuário só vê o resultado do mês, nunca a foto consolidada do que possui.
- **NW-03**: Não há histórico de saldo ao longo do tempo. Mesmo que o usuário anote saldos manualmente em transações/notas, não há como traçar a **evolução do patrimônio** mês a mês.

---

## 2. Solução

Introduzir contas patrimoniais e fotos de saldo (snapshots), com cálculo derivado de patrimônio líquido e sua evolução temporal. Atualização de saldo é **manual** neste escopo.

- **NW-01**: novo modelo `BalanceAccount` (conta patrimonial) com `kind` (`asset` | `liability`), `name`, `institutionId` opcional e flag `isArchived`.
- **NW-02**: cálculo de net worth = soma dos snapshots mais recentes de ativos − soma dos snapshots mais recentes de passivos, sempre em `BigInt` centavos.
- **NW-03**: novo modelo `BalanceSnapshot` (saldo de uma conta em uma data), permitindo série temporal e widget de evolução.

```prisma
enum BalanceAccountKind {
  asset
  liability

  @@map("balance_account_kind")
}

model BalanceAccount {
  id            String             @id @default(cuid())
  accountId     String             @map("account_id")
  kind          BalanceAccountKind
  name          String                                  // "Conta Nubank", "Apartamento", "Financiamento do carro"
  institutionId String?            @map("institution_id")
  isArchived    Boolean            @default(false) @map("is_archived")
  createdById   String             @map("created_by_id")
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")

  account     Account           @relation(fields: [accountId], references: [id], onDelete: Cascade)
  institution Institution?      @relation(fields: [institutionId], references: [id], onDelete: SetNull)
  snapshots   BalanceSnapshot[]

  @@index([accountId])
  @@index([accountId, kind])
  @@map("balance_accounts")
}

model BalanceSnapshot {
  id               String   @id @default(cuid())
  accountId        String   @map("account_id")
  balanceAccountId String   @map("balance_account_id")
  balanceCents     BigInt   @map("balance_cents")   // saldo do ativo/passivo na data; passivo é positivo (valor devido)
  capturedOn       DateTime @map("captured_on") @db.Date
  createdById      String   @map("created_by_id")
  createdAt        DateTime @default(now()) @map("created_at")

  account        Account        @relation(fields: [accountId], references: [id], onDelete: Cascade)
  balanceAccount BalanceAccount @relation(fields: [balanceAccountId], references: [id], onDelete: Cascade)

  @@unique([balanceAccountId, capturedOn])
  @@index([accountId])
  @@index([balanceAccountId, capturedOn])
  @@map("balance_snapshots")
}
```

`Account` ganha as relações `balanceAccounts BalanceAccount[]` e `balanceSnapshots BalanceSnapshot[]`. `Institution` ganha `balanceAccounts BalanceAccount[]`.

---

## 3. User Stories

- Como membro de uma account, quero cadastrar minhas contas, investimentos e bens como ativos, para ter o quadro completo do que possuo.
- Como membro de uma account, quero cadastrar empréstimos e saldos de cartão como passivos, para saber quanto devo.
- Como usuário, quero ver meu patrimônio líquido (ativos − passivos) em um único número e sua evolução ao longo dos meses, para acompanhar se estou progredindo.
- Como usuário, quero atualizar manualmente o saldo de uma conta em uma data, para registrar a foto atual sem depender de integração bancária.

---

## 4. Critérios de Aceitação

- QUANDO o usuário cria uma `BalanceAccount`, O SISTEMA DEVE exigir `kind` (`asset` ou `liability`) e `name`, e persistir com o `accountId` da account ativa.
- QUANDO o usuário registra um saldo, O SISTEMA DEVE armazenar `balanceCents` como `BigInt` em centavos e `capturedOn` como `date`. NÃO DEVE aceitar `Float`.
- SE já existe um `BalanceSnapshot` para a mesma `balanceAccountId` e `capturedOn`, O SISTEMA DEVE atualizar o saldo existente em vez de criar duplicata (garantido por `@@unique([balanceAccountId, capturedOn])`).
- QUANDO o patrimônio líquido é calculado, O SISTEMA DEVE somar o snapshot mais recente (por `capturedOn`) de cada ativo não arquivado e subtrair o de cada passivo não arquivado.
- ENQUANTO uma `BalanceAccount` estiver `isArchived = true`, ela NÃO DEVE entrar no cálculo de patrimônio líquido nem no widget de evolução.
- **Multi-tenancy**: QUANDO qualquer query lê `BalanceAccount` ou `BalanceSnapshot`, ela DEVE filtrar por `accountId`. Um usuário NÃO DEVE conseguir ler ou alterar contas patrimoniais de outra account, mesmo informando um `balanceAccountId` válido de terceiro.
- QUANDO o widget de evolução é renderizado, O SISTEMA DEVE exibir a série temporal do patrimônio líquido com cores do tema (nunca hex hardcoded), em light e dark mode.

---

## 5. Fora de Escopo

- **Sincronização automática de saldo** (Open Finance / agregação bancária) — virá na spec 52 (Open Finance). Neste escopo a atualização é manual.
- **Vínculo automático entre transações e o saldo da conta** — não há débito/crédito automático no `BalanceSnapshot` ao lançar transação.
- **Cotação de ativos em tempo real** (ações, cripto) — saldo é informado pelo usuário.
- **Gestão de dívidas com amortização** — coberto pela spec 51 (Gestão de Dívidas); aqui o passivo é apenas um saldo informado.
- **Alocação de portfólio / classes de ativo** — fora do escopo inicial.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Representação de passivo | `balanceCents` positivo, `kind = liability` | Evita sinal negativo ambíguo; o cálculo subtrai passivos explicitamente |
| Saldo como série | Modelo `BalanceSnapshot` separado | Permite evolução temporal sem mutar o registro da conta |
| Unicidade do snapshot | `@@unique([balanceAccountId, capturedOn])` | Um saldo por conta por dia; re-registro atualiza |
| Atualização manual | Sem integração nesta spec | Desacopla o valor patrimonial do Open Finance (spec 52) |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Modelos `BalanceAccount` / `BalanceSnapshot` + enum | `prisma/schema.prisma` · nova migration `add_balance_accounts` |
| Schemas Zod | `src/lib/schemas/balance-account.ts` (novo) |
| Service de patrimônio | `src/server/services/net-worth-service.ts` (novo) |
| Serialização BigInt → string | `src/lib/serializers/` (novo serializer) |
| Widget de evolução | `src/components/dashboard/widgets/` (novo widget `net-worth`) |
| Labels de UI | `src/lib/messages/pt-BR.ts` |
| Relações em `Account` / `Institution` | `prisma/schema.prisma` |
