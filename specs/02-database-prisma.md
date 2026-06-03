# Spec 02 — Database e Prisma

## 1. Propósito

Define as convenções de banco de dados, estrutura do schema Prisma, estratégia de migrations, índices, e padrões de acesso. Reflete o modelo descrito em `01-domain-model.md`.

## 2. Tecnologias

- **PostgreSQL** 16 (alpine)
- **Prisma** ≥ 5.x
- **Em dev**: PostgreSQL roda em **container Docker** (ver `12-deployment-and-docker.md`).
- **Em prod**, três opções (decidir mais tarde):
  - **Hybrid**: Postgres em **Neon** (serverless), app em Vercel.
  - **Full Docker**: Postgres + app no mesmo VPS.
  - **Self-hosted PaaS**: Coolify/Dokploy.

> **Default da Fase 0**: Postgres em Docker local. Decisão de prod pode adiar até ter usuários.

## 3. Convenções de schema

### 3.1 Naming
- **Modelos Prisma**: `PascalCase` no singular (ex: `User`, `FinanceTable`).
- **Tabelas no Postgres**: `snake_case` no plural (ex: `users`, `finance_tables`). Configurar via `@@map`.
- **Campos no Prisma**: `camelCase` (ex: `createdAt`, `accountId`).
- **Colunas no Postgres**: `snake_case` (ex: `created_at`, `account_id`). Configurar via `@map`.
- **Enums**: `PascalCase` no Prisma, `snake_case` no Postgres.

### 3.2 IDs
- **CUID** (Collision-Resistant Unique IDs) para todos os PKs. Não UUID.
  - Motivo: ordenáveis, mais compactos, sem dependência de extensão.
- Definição: `id String @id @default(cuid())`.

### 3.3 Timestamps
- **Sempre incluir** `createdAt DateTime @default(now())` em todas as entidades.
- Incluir `updatedAt DateTime @updatedAt` quando a entidade é mutável (FinanceTable, Transaction, AccountSettings, UserSettings, etc.).
- Não incluir `updatedAt` em entidades imutáveis (Month, AccountMember).

### 3.4 Foreign Keys
- Sempre nomear o campo FK com sufixo `Id`: `accountId`, `createdById`.
- Sempre nomear a relação correspondente sem sufixo: `account`, `createdBy`.
- Definir `onDelete` explicitamente:
  - `Cascade` quando o filho não tem sentido sem o pai (Transaction → FinanceTable).
  - `SetNull` quando o filho continua válido sem o pai (Transaction.category).
  - `Restrict` quando deletar pode causar perda inadvertida (Section com tabelas).

### 3.5 Money
- **`BigInt`** para valores em centavos. Nunca `Float`, `Decimal` ou `Int`.
- Nomear sempre com sufixo `Cents`: `amountCents`.
- Validação no Zod schema com `z.bigint()` ou `z.coerce.bigint()`.

### 3.6 Multi-tenancy
- **Toda entidade que pertence a uma Account precisa ter `accountId` direto**, mesmo que pareça redundante. Isso evita joins desnecessários e permite RLS-like filtros no nível de aplicação.
- Exemplo: `Transaction.accountId` está duplicado (poderia ser obtido via `tableId → monthId → accountId`), mas é necessário para queries diretas e segurança.

### 3.7 JSON fields
- Use `Json` apenas para dados de extensão (`metadata`, `mapping`, `hiddenColumns`).
- Sempre validar com Zod antes de salvar.

## 4. Schema base (esqueleto)

> Esqueleto inicial. A versão completa fica em `prisma/schema.prisma` quando o projeto começar.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =========================================
// Enums
// =========================================

enum AccountMemberRole {
  owner
  editor
  viewer

  @@map("account_member_role")
}

enum InviteStatus {
  pending
  accepted
  revoked
  expired

  @@map("invite_status")
}

enum SectionCountType {
  add
  subtract
  ignore
  neutral

  @@map("section_count_type")
}

enum TableSourceMethod {
  empty
  copy
  import
  template  // tabela criada a partir de um TableTemplate

  @@map("table_source_method")
}

// =========================================
// Auth (NextAuth + custom fields)
// =========================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  emailVerified DateTime? @map("email_verified")
  passwordHash  String?   @map("password_hash")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  // NextAuth relations
  oauthAccounts OAuthAccount[]
  sessions      Session[]

  // App relations
  settings        UserSettings?
  accountsCreated Account[]          @relation("AccountCreatedBy")
  memberships     AccountMember[]
  invitesSent     AccountInvite[]    @relation("InviteSentBy")
  // ... (relations omitidas para brevidade)

  @@map("users")
}

// Renomeado de "Account" do NextAuth para evitar conflito com nosso domínio.
model OAuthAccount {
  // ... campos padrão do NextAuth
  userId            String  @map("user_id")
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  // ... etc
  @@map("oauth_accounts")
}

model Session {
  // ... campos padrão do NextAuth
  @@map("sessions")
}

model VerificationToken {
  // ... campos padrão do NextAuth
  @@map("verification_tokens")
}

// =========================================
// Domain
// =========================================

model Account {
  id          String   @id @default(cuid())
  name        String
  createdById String   @map("created_by_id")
  createdAt   DateTime @default(now()) @map("created_at")

  createdBy User            @relation("AccountCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  members   AccountMember[]
  invites   AccountInvite[]
  months    Month[]
  sections  Section[]
  // ... etc
  settings  AccountSettings?

  @@map("accounts")
}

model AccountMember {
  accountId String            @map("account_id")
  userId    String            @map("user_id")
  role      AccountMemberRole
  addedById String?           @map("added_by_id")
  createdAt DateTime          @default(now()) @map("created_at")

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  addedBy User?   @relation("MemberAddedBy", fields: [addedById], references: [id], onDelete: SetNull)

  @@id([accountId, userId])
  @@map("account_members")
}

// ... resto das entidades (ver 01-domain-model.md)
```

> **O schema completo fica em `prisma/schema.prisma`.** Este é só o esqueleto. Quando implementar, gere a partir do `01-domain-model.md`.

## 5. Índices recomendados

| Tabela | Índice | Motivo |
|---|---|---|
| `account_members` | `(userId)` | listar Accounts de um User (login flow) |
| `months` | `(accountId, year, month)` | unique + lookup |
| `finance_tables` | `(monthId)` | listar tabelas de um mês |
| `finance_tables` | `(accountId, monthId, sectionId)` | listar tabelas de uma seção |
| `transactions` | `(tableId)` | listar transações de uma tabela |
| `transactions` | `(accountId, monthId)` | agregações por mês |
| `transactions` | `(accountId, occurredOn)` | filtros por data nos dashboards |
| `transactions` | `(categoryId)` | dashboards por categoria |
| `account_invites` | `(email, status)` | listar invites pendentes por email |
| `account_invites` | `(token)` | unique + lookup pelo link do email |

## 6. Migrations

### 6.1 Workflow
1. Mudar o `schema.prisma`.
2. `pnpm prisma migrate dev --name <descritivo_em_snake_case>` em ambiente local.
3. Revisar o SQL gerado em `prisma/migrations/`.
4. Commit do schema + migration juntos.
5. Em prod: `pnpm prisma migrate deploy`.

### 6.2 Regras
- **Nome da migration** em snake_case e descritivo: `add_is_favorite_to_transactions`, não `update_schema`.
- **Migrations são imutáveis em prod**: nunca editar uma migration já aplicada. Para corrigir, crie outra.
- **Breaking changes** (drop column, rename): em duas fases:
  1. Migration 1: add nova coluna, copia dados, mantém antiga.
  2. Deploy + atualizar código para usar nova.
  3. Migration 2: drop antiga.

### 6.3 Seed
- Arquivo `prisma/seed.ts` para dados de desenvolvimento.
- Configurar em `package.json`:
  ```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
  ```
- Seed cria: 2 Users de teste, 1 Account, 4 Sections default, 5 Categories default, 3 Months recentes com transações exemplo.

## 7. Padrões de acesso (Prisma Client)

### 7.1 Multi-tenancy
- **Nunca** importe `prisma` diretamente em Server Actions sem passar pelo helper de scope. Ver `skills/multitenancy/SKILL.md`.

### 7.2 BigInt serialization
- `BigInt` não serializa nativamente em JSON. Configurar globalmente:
  ```ts
  // src/lib/json.ts
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
  ```
- No client, ao receber, converter de volta com `BigInt(value)`.
- Ver `skills/money-handling/SKILL.md`.

### 7.3 Transactions (DB)
- Usar `prisma.$transaction([...])` para operações atômicas (ex: copiar tabela = create table + create transactions).
- Limite de tempo padrão: 5s. Para imports grandes, ajustar `timeout`.

### 7.4 Soft-delete (futuro)
- MVP: hard-delete em tudo, com cascade onde definido.
- Quando precisar de soft-delete (provavelmente em Transaction e FinanceTable), adicionar `deletedAt DateTime?` e middleware Prisma para filtrar.

## 8. Variáveis de ambiente

```bash
# .env.example

# ===== Database =====
# Em dev (docker compose): "postgres" é o hostname do service
DATABASE_URL="postgresql://myaccountant:dev_password@postgres:5432/myaccountant?schema=public"
# Para migrations no Neon (prod), DIRECT_URL sem pooling. Em dev é igual.
DIRECT_URL="postgresql://myaccountant:dev_password@postgres:5432/myaccountant?schema=public"

# ===== NextAuth =====
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<gere com: openssl rand -base64 32>"

# ===== OAuth =====
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# ===== Email (para invites) =====
RESEND_API_KEY=""
EMAIL_FROM="MyAccountant <noreply@myaccountant.app>"
```

> Para conectar com DBeaver/pgAdmin/TablePlus na sua máquina (fora do docker), use `localhost:5432`. A porta está exposta no `docker-compose.yml`. Detalhes em `12-deployment-and-docker.md`.

## 9. Performance

- **Paginação** em qualquer query de lista (transactions, invites). Cursor-based usando `id` ou `(occurredOn, id)`.
- **Select explícito**: nunca `select: *`. Sempre listar campos para evitar overfetch.
- **N+1**: usar `include` ou `select` aninhado, nunca loops com queries.
- **Aggregations**: usar `prisma.transaction.aggregate({...})` para somas. Não trazer todas as rows para somar no app.

## 10. Backup e disaster recovery

- Backup automático diário pelo provider (Neon faz isso).
- Branch de preview no Neon para staging.
- Dump manual antes de migrations destrutivas: `pg_dump $DATABASE_URL > backup_YYYY-MM-DD.sql`.
