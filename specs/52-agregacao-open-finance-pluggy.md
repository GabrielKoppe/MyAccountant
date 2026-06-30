# Spec 52 — Agregação Bancária via Open Finance

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Brasil & Agregação
> Skills: [`api-routes`](../skills/api-routes/SKILL.md) · [`env-validation`](../skills/env-validation/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md)

---

## 1. Problema

- **AGG-01 — Entrada de dados 100% manual ou por import**: hoje as únicas formas de popular transações são lançamento manual (spec 09) e importação de arquivo CSV/XLSX (spec 10). Não existe nenhuma sincronização automática com instituições financeiras. O mercado de PFM trata agregação automática como *table-stakes*: o usuário espera que o app puxe os lançamentos sozinho.
- **AGG-02 — Brasil tem canal regulado disponível e subutilizado**: o Open Finance (regulado pelo BACEN, +100M de clientes, compartilhamento obrigatório desde jan/2025) viabiliza agregação automática via agregadores (**Pluggy**, Belvo). Não há nenhuma integração no código. Fato de validação: o Actual Budget já usa Pluggy.ai para bancos brasileiros.
- **AGG-03 — Sem modelo de domínio para conexões bancárias**: não há entidade que represente "conexão a uma instituição via consentimento Open Finance", nem mapeamento de uma conta sincronizada para a estrutura interna (Section/FinanceTable). O `prisma/schema.prisma` não tem nenhum modelo de conexão/sync.
- **AGG-04 — Risco de duplicação contra lançamentos manuais/CSV**: ao introduzir ingestão automática, transações sincronizadas podem colidir com lançamentos manuais ou importados do mesmo período. Não há chave de deduplicação.
- **AGG-05 — Manuseio de credenciais sensíveis**: integração com agregador envolve tokens de acesso e identificadores de item que são segredos. Hoje não há padrão definido para guardar/criptografar esses tokens nem para isolar credenciais do client.

---

## 2. Solução

> Entrega faseada. Fase A entrega consentimento + conexão; Fase B entrega sync + ingestão deduplicada. Sem iniciação de pagamento.

### 2.1 AGG-01 / AGG-02 — Integração com Pluggy (faseada)

- **Fase A — Consentimento e conexão**: integrar o **Pluggy Connect Widget** para o fluxo de consentimento. O backend gera um `connectToken` (via API Pluggy, server-side) e o client abre o widget. Ao concluir, o Pluggy retorna um `itemId` que o backend persiste como `BankConnection`.
- **Fase B — Sincronização**: sync periódico (e on-demand) via API Pluggy lendo as transações do `item`. Disparado por Server Action manual ("Sincronizar agora") e por rotina agendada por Account. Cada execução é logada de forma estruturada (Pino) com `accountId`, `connectionId`, contagem de ingeridas/dedup/erros.

### 2.2 AGG-03 — Modelos `BankConnection` e `SyncedBankAccount`

```prisma
enum BankConnectionProvider {
  pluggy

  @@map("bank_connection_provider")
}

enum BankConnectionStatus {
  pending        // consentimento iniciado, ainda não confirmado
  active         // conectado, sincronizando
  needs_action   // requer reautenticação/MFA do usuário
  error          // falha persistente
  disconnected   // revogado pelo usuário

  @@map("bank_connection_status")
}

model BankConnection {
  id             String                 @id @default(cuid())
  accountId      String                 @map("account_id")
  provider       BankConnectionProvider @default(pluggy)
  providerItemId String                 @map("provider_item_id") // itemId do Pluggy
  institutionId  String?                @map("institution_id")   // FK opcional p/ Institution interna
  status         BankConnectionStatus   @default(pending)
  lastSyncAt     DateTime?              @map("last_sync_at")
  createdById    String                 @map("created_by_id")
  createdAt      DateTime               @default(now()) @map("created_at")
  updatedAt      DateTime               @updatedAt @map("updated_at")

  account        Account             @relation(fields: [accountId], references: [id], onDelete: Cascade)
  institution    Institution?        @relation(fields: [institutionId], references: [id], onDelete: SetNull)
  syncedAccounts SyncedBankAccount[]

  @@index([accountId])
  @@index([accountId, status])
  @@map("bank_connections")
}

model SyncedBankAccount {
  id                String   @id @default(cuid())
  accountId         String   @map("account_id")
  connectionId      String   @map("connection_id")
  providerAccountId String   @map("provider_account_id") // accountId do Pluggy
  name              String                               // "Conta Corrente Nubank"
  sectionId         String   @map("section_id")          // Section destino da ingestão
  tableTypeId       String?  @map("table_type_id")       // TableType destino (opcional)
  isActive          Boolean  @default(true) @map("is_active")
  createdAt         DateTime @default(now()) @map("created_at")

  account    Account        @relation(fields: [accountId], references: [id], onDelete: Cascade)
  connection BankConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  section    Section        @relation(fields: [sectionId], references: [id], onDelete: Restrict)
  tableType  TableType?     @relation(fields: [tableTypeId], references: [id], onDelete: SetNull)

  @@index([accountId])
  @@index([connectionId])
  @@map("synced_bank_accounts")
}
```

- O token de acesso do provedor **não** é persistido em claro: ou é mantido apenas em memória durante o sync, ou criptografado em repouso (ver DD-04). `providerItemId` não é segredo, mas é tratado como dado sensível em logs (não logar valor cru).

### 2.3 AGG-04 — Ingestão deduplicada

- Cada transação ingerida nasce com `source = open_finance` (novo valor no enum `TransactionSource`) e `monthId`/`tableId` derivados da `SyncedBankAccount` (Section/TableType destino + mês resolvido pelo `occurredOn`).
- **Deduplicação**: o serviço calcula uma chave determinística por transação ingerida (`providerTransactionId` quando o Pluggy fornece, senão hash de `occurredOn + amountCents + description normalizada`). Antes de inserir, verifica colisão dentro da mesma Account/mês contra transações existentes (incluindo `manual` e `csv_import`). Colisões são puladas e reportadas no resultado do sync, nunca inseridas em duplicata.

### 2.4 AGG-05 — Segurança de credenciais

- `connectToken` é gerado **server-side** via Route Handler (`api-routes`); o client nunca vê o `clientId`/`clientSecret` do Pluggy.
- Credenciais Pluggy (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`) declaradas e lidas **somente** via `src/lib/env.ts` (`env-validation`). Nunca `process.env` direto.
- Toda chamada externa e cada sync produzem log estruturado Pino, sem expor token/secret.

---

## 3. User Stories

- Como membro de uma Account, quero conectar minha conta bancária via Open Finance, para que meus lançamentos apareçam sem digitação manual.
- Como editor, quero mapear cada conta sincronizada para uma Section/tabela existente, para que as transações caiam na estrutura que já uso.
- Como usuário, quero que lançamentos sincronizados não dupliquem o que já lancei manualmente ou importei por CSV, para manter os totais corretos.
- Como owner preocupado com segurança, quero que credenciais e tokens nunca trafeguem pelo client nem fiquem em texto claro, para reduzir risco de vazamento.

---

## 4. Critérios de Aceitação

**AGG-01 / AGG-02:**
- QUANDO o usuário inicia uma conexão, O BACKEND DEVE gerar o `connectToken` server-side e o client DEVE abrir o Pluggy Connect Widget com esse token.
- QUANDO o usuário conclui o consentimento no widget, O SISTEMA DEVE persistir um `BankConnection` com `status = active` e o `providerItemId` retornado.

**AGG-03 (multi-tenancy):**
- QUANDO qualquer query lê `BankConnection` ou `SyncedBankAccount`, ELA DEVE filtrar por `accountId` da Account ativa; um membro de uma Account NÃO DEVE ler nem sincronizar conexões de outra Account.
- QUANDO uma conta sincronizada é mapeada, O SISTEMA DEVE exigir uma `sectionId` válida pertencente à mesma Account.

**AGG-04:**
- QUANDO o sync ingere uma transação cuja chave de deduplicação já existe na Account/mês, O SERVIÇO NÃO DEVE inserir duplicata e DEVE contabilizá-la como "ignorada por duplicidade" no resultado.
- QUANDO uma transação é ingerida, ELA DEVE nascer com `source = open_finance`.

**AGG-05:**
- O `clientSecret` do Pluggy NÃO DEVE ser exposto em nenhuma resposta enviada ao client.
- QUANDO o código lê credenciais do provedor, ELE DEVE fazê-lo via `env` de `src/lib/env.ts`, NÃO via `process.env` direto.
- QUANDO um sync executa, O SISTEMA DEVE emitir log estruturado Pino com `accountId`, `connectionId` e contagens, SEM registrar token/secret em claro.

---

## 5. Fora de Escopo

- **Iniciação de pagamentos / Pix Automático** — fica para spec futura (Open Finance payment initiation).
- **Belvo e outros agregadores** — Pluggy primeiro; abstração multi-provider só quando houver segundo provedor real.
- **Investimentos (Open Investment)** — agregação de posição/carteira fora do escopo desta spec.
- **Auto-categorização por ML das transações sincronizadas** — ingestão entra sem categoria; categorização permanece manual.
- **Conciliação avançada / reconciliation de extrato** — deduplicação cobre o caso primário; fechamento formal de extrato não.

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Agregador inicial | Pluggy primeiro (não Belvo) | Foco BR, Connect Widget maduro; validado pelo uso no Actual Budget |
| DD-02 | Modelo de destino | Mapear `SyncedBankAccount` → `Section`/`TableType` existentes | Reaproveita estrutura Mês/Seção/Tabela; evita modelo paralelo de "conta" que fragmentaria os dashboards e queries atuais |
| DD-03 | Chave de deduplicação | `providerTransactionId` quando disponível, senão hash `occurredOn+amountCents+description` | Cobre provedores que não dão id estável sem inserir duplicatas |
| DD-04 | Armazenamento de token | Não persistir em claro: memória durante sync ou criptografado em repouso | Reduz superfície de vazamento; segredos só via env |
| DD-05 | Origem das transações | Novo valor `open_finance` no enum `TransactionSource` | Permite filtrar/auditar origem sem ambiguidade com `csv_import` |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Modelos `BankConnection`, `SyncedBankAccount`, enums, valor `open_finance` em `TransactionSource` | `prisma/schema.prisma` + nova migration |
| Variáveis Pluggy (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, base URL) | `src/lib/env.ts` |
| Geração de `connectToken` + callback de item | `src/app/api/v1/bank-connections/` (Route Handlers, `defineRoute`) |
| Serviço de conexão (criar/listar/desconectar) | `src/server/services/bank-connection-service.ts` (criar) |
| Serviço de sync + deduplicação | `src/server/services/bank-sync-service.ts` (criar) |
| Actions de conexão/mapeamento/sync manual | `src/actions/bank-connections.ts` (criar) |
| Cliente HTTP do Pluggy | `src/server/integrations/pluggy/` (criar) |
| Import CSV de referência (reuso de ingestão em massa) | `specs/10-csv-xlsx-import.md` · `src/server/services/csv-import-service.ts` |
| Enum de origem existente | `prisma/schema.prisma` (`TransactionSource`) |
