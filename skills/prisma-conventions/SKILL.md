# SKILL — Convenções Prisma

## Quando usar

Toda vez que tocar o `schema.prisma`, criar migration, escrever query ou mutation. Define naming, indexes e patterns comuns que aparecem em todo o projeto.

## Naming

### Modelos
- `PascalCase` no Prisma (`User`, `FinanceTable`)
- `snake_case` plural no Postgres via `@@map`

```prisma
model FinanceTable {
  // ...
  @@map("finance_tables")
}
```

### Campos
- `camelCase` no Prisma
- `snake_case` no Postgres via `@map`

```prisma
model Transaction {
  occurredOn  DateTime @map("occurred_on") @db.Date
  amountCents BigInt   @map("amount_cents")
  createdAt   DateTime @default(now()) @map("created_at")
}
```

### Enums
- `PascalCase` no Prisma
- `snake_case` no Postgres

```prisma
enum SectionCountType {
  add
  subtract
  ignore
  neutral

  @@map("section_count_type")
}
```

### Relations
- Campo FK: sufixo `Id` (`accountId`, `createdById`)
- Relation: sem sufixo, singular (`account`, `createdBy`)
- Relation reversa: plural ou descritiva (`transactions`, `accountsCreated`)

```prisma
model Transaction {
  accountId String  @map("account_id")
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
}
```

## IDs

**Sempre CUID**, nunca UUID.

```prisma
id String @id @default(cuid())
```

Por quê:
- Ordenáveis (timestamp embutido)
- Mais compactos que UUID (24 chars vs 36)
- Sem precisar de extensão Postgres

## Timestamps

```prisma
createdAt DateTime @default(now()) @map("created_at")
updatedAt DateTime @updatedAt @map("updated_at")
```

- `createdAt` em **toda** entidade.
- `updatedAt` em entidades mutáveis (não em `Month`, `AccountMember`).

## Foreign Keys e Cascade

**Sempre explicitar `onDelete`**:

```prisma
// Cascade — filho não tem sentido sem o pai
account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

// SetNull — filho continua válido se pai sumir
category Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

// Restrict — proteger contra delete inadvertido
section Section @relation(fields: [sectionId], references: [id], onDelete: Restrict)
```

Tabela de decisão (no nosso domínio):

| Pai → Filho | onDelete |
|---|---|
| Account → tudo | Cascade |
| Month → FinanceTable | Cascade |
| FinanceTable → Transaction | Cascade |
| Category → Transaction | SetNull |
| Subcategory → Transaction | SetNull |
| Institution → Transaction | SetNull |
| Section → FinanceTable | Restrict |
| User → AccountMember | Cascade |
| User → Transaction.createdBy | Restrict |
| FinanceTable → FinanceTable (sourceTableId) | SetNull |

## Indexes

Adicionar índice quando:
- Campo aparece em `where` de query frequente
- Campo é usado em `orderBy`
- Campo é FK de tabela grande

```prisma
model Transaction {
  // ...

  @@index([tableId])
  @@index([accountId, monthId])
  @@index([accountId, occurredOn])
  @@index([categoryId])
}
```

**Composite indexes** ordenam-se por seletividade: a coluna mais seletiva primeiro... **exceto** quando há queries de "range" — aí o campo do range vai por último.

```prisma
// Bom: filtra por accountId + monthId (igualdade) + ordena por occurredOn (range)
@@index([accountId, monthId, occurredOn])
```

## Unique constraints

```prisma
model Month {
  // ...
  @@unique([accountId, year, month])
}

model Section {
  // ...
  @@unique([accountId, name])
}
```

## Composite primary keys

Use quando o registro é definido pela combinação de FKs:

```prisma
model AccountMember {
  accountId String
  userId    String
  // ...
  @@id([accountId, userId])
}
```

## Padrões de query

### Multi-tenancy
Ver `skills/multitenancy/SKILL.md`. Resumo:
```ts
prisma.transaction.findMany({
  where: { accountId, ...otrosFiltros }
});
```

### Select explícito
**Nunca** trazer mais do que precisa:

```ts
// ❌ Errado — overfetch
const tx = await prisma.transaction.findUnique({ where: { id } });

// ✅ Certo — só os campos usados
const tx = await prisma.transaction.findUnique({
  where: { id },
  select: { id: true, amountCents: true, description: true },
});
```

### Include vs select
- `include`: trazer relations completas.
- `select`: pick específico (pode aninhar `select` em relations).

```ts
const tx = await prisma.transaction.findUnique({
  where: { id },
  select: {
    id: true,
    amountCents: true,
    category: { select: { name: true } },
    table: { select: { name: true, sectionId: true } },
  },
});
```

### Aggregations
Para somas, médias, contagens, **não traga as rows**:

```ts
// ❌ Errado
const all = await prisma.transaction.findMany({ where: { accountId, monthId } });
const total = all.reduce((s, t) => s + t.amountCents, 0n);

// ✅ Certo
const result = await prisma.transaction.aggregate({
  where: { accountId, monthId },
  _sum: { amountCents: true },
});
const total = result._sum.amountCents ?? 0n;
```

### GroupBy
```ts
const byCategory = await prisma.transaction.groupBy({
  by: ["categoryId"],
  where: { accountId, monthId },
  _sum: { amountCents: true },
  orderBy: { _sum: { amountCents: "desc" } },
});
```

### Transactions (DB)
Use `$transaction` para operações atômicas:

```ts
await prisma.$transaction(async (tx) => {
  const newTable = await tx.financeTable.create({ data: { ... } });
  await tx.transaction.createMany({ data: rows });
  return newTable;
});
```

Para imports grandes, configure timeout:
```ts
await prisma.$transaction(async (tx) => { ... }, { timeout: 30000 });
```

### Pagination
Sempre paginar listas:

```ts
// Cursor-based (recomendado)
const page = await prisma.transaction.findMany({
  where: { accountId, monthId },
  orderBy: { occurredOn: "desc" },
  take: 50,
  cursor: lastIdSeen ? { id: lastIdSeen } : undefined,
  skip: lastIdSeen ? 1 : 0,
});
```

### N+1 prevention
Erro comum — loop com queries:

```ts
// ❌ Errado — N+1
const tables = await prisma.financeTable.findMany({ where: { monthId } });
for (const t of tables) {
  const count = await prisma.transaction.count({ where: { tableId: t.id } });
}

// ✅ Certo — include _count
const tables = await prisma.financeTable.findMany({
  where: { monthId },
  include: { _count: { select: { transactions: true } } },
});
```

## Migrations

### Workflow
```bash
# 1. Editar schema.prisma
# 2. Criar migration
pnpm prisma migrate dev --name <descritivo_snake_case>

# 3. Revisar SQL em prisma/migrations/<timestamp>_<name>/migration.sql
# 4. Commit junto com schema

# Em prod
pnpm prisma migrate deploy
```

### Naming de migrations
- `add_is_favorite_to_transactions` ✅
- `update_schema` ❌
- `fix` ❌
- `create_account_invites_table` ✅

### Migrations destrutivas
Para drop column / rename sem downtime, faça em **duas fases**:

**Fase 1** (deploy 1):
- Adiciona nova coluna.
- Copia dados.
- Mantém antiga.
- Código passa a escrever em ambas.

**Fase 2** (deploy 2):
- Código passa a usar só a nova.
- Migration drop a antiga.

### Imutabilidade
Migration aplicada em prod **nunca** é editada. Para corrigir, crie outra.

## Seed

```ts
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Idempotente — pode rodar várias vezes sem dar erro
  const user = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      name: "Test User",
      passwordHash: await bcrypt.hash("password", 12),
    },
  });

  // ... etc
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
```

Config em `package.json`:
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Executar:
```bash
pnpm prisma db seed
```

## Cliente Prisma singleton

```ts
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

> Evita criar N clientes em dev (HMR).

## BigInt e JSON
Ver `skills/money-handling/SKILL.md` §"Serialização JSON".

## Soft-delete (futuro)

MVP usa hard delete. Quando for adicionar soft-delete:

```prisma
model Transaction {
  // ...
  deletedAt DateTime? @map("deleted_at")
  @@index([accountId, deletedAt])
}
```

Middleware Prisma para filtrar:
```ts
prisma.$extends({
  query: {
    transaction: {
      findMany({ args, query }) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
    },
  },
});
```

## Anti-patterns

❌ `id String @default(uuid())` — usar `cuid()`
❌ `Float` ou `Decimal` para dinheiro — usar `BigInt` em centavos
❌ Esquecer `onDelete` nas relations
❌ `select: { ...todosCampos }` — sempre listar explicitamente
❌ Query sem `where` no MVP — fica perigoso se virar produção
❌ Migrations sem nome descritivo
❌ Editar migration já aplicada
❌ Múltiplas instâncias de PrismaClient (vazamento de connection)
