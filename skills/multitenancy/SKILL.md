# SKILL — Multi-tenancy

## Quando usar

Toda Server Action, route handler ou query que toca dados de Account. Ou seja: praticamente tudo no app exceto autenticação pura.

## Princípio

**Cada query deve ser explicitamente filtrada por `accountId` do usuário autenticado.** Sem filtro = vazamento de dados entre tenants. Esta é a vulnerabilidade #1 a evitar em sistemas multi-tenant.

## Padrão obrigatório em Server Actions

Toda Server Action começa com este pattern:

```ts
// src/actions/transactions.ts
"use server";

import { requireAccountAccess } from "@/lib/auth/session";

export async function createTransaction(accountId: string, data: CreateTransactionInput) {
  // 1. Verifica auth + acesso à Account
  const { user, member } = await requireAccountAccess(accountId);

  // 2. Verifica role suficiente (se aplicável)
  if (member.role === "viewer") {
    throw new Error("Forbidden: viewer não pode criar transações");
  }

  // 3. Validar input com Zod
  const parsed = createTransactionSchema.parse(data);

  // 4. Verificar que entidades referenciadas pertencem à mesma account
  await ensureTableBelongsToAccount(parsed.tableId, accountId);

  // 5. Mutar com accountId explícito
  return prisma.transaction.create({
    data: {
      ...parsed,
      accountId, // ← sempre explícito
    },
  });
}
```

## Helper `requireAccountAccess`

```ts
// src/lib/auth/session.ts
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export async function requireAccountAccess(accountId: string) {
  const user = await requireUser();
  const member = await prisma.accountMember.findUnique({
    where: {
      accountId_userId: { accountId, userId: user.id },
    },
  });
  if (!member) {
    throw new Error("Forbidden: not a member of this account");
  }
  return { user, member };
}

export async function requireAccountRole(
  accountId: string,
  allowedRoles: AccountMemberRole[]
) {
  const { user, member } = await requireAccountAccess(accountId);
  if (!allowedRoles.includes(member.role)) {
    throw new Error(`Forbidden: role ${member.role} not allowed`);
  }
  return { user, member };
}
```

## Validar que entidades referenciadas pertencem à Account

Quando uma action recebe um `tableId`, `categoryId`, etc., **valide que ele pertence ao `accountId` corrente** antes de usar. Senão, é IDOR (Insecure Direct Object Reference).

```ts
// src/lib/auth/ownership.ts

export async function ensureTableBelongsToAccount(tableId: string, accountId: string) {
  const table = await prisma.financeTable.findUnique({
    where: { id: tableId },
    select: { accountId: true },
  });
  if (!table || table.accountId !== accountId) {
    throw new Error("Forbidden: resource not in account");
  }
}

export async function ensureMonthBelongsToAccount(monthId: string, accountId: string) {
  // idem
}

// ...para cada entidade
```

## Padrão de query (read)

```ts
// ✅ Certo — accountId sempre no where
const transactions = await prisma.transaction.findMany({
  where: { accountId, monthId },
});

// ❌ Errado — sem accountId, leak entre tenants
const transactions = await prisma.transaction.findMany({
  where: { monthId },
});

// ❌ Errado — confiar no monthId pertencer ao account é fraco; alguém pode forjar
```

## Account-scoped Prisma Client (opcional, recomendado)

Para reduzir o risco de esquecer o filtro, crie um wrapper que injeta `accountId` automaticamente:

```ts
// src/lib/prisma-scoped.ts

import { prisma } from "@/lib/prisma";

export function getAccountScoped(accountId: string) {
  return {
    transaction: {
      findMany: (args: Omit<Prisma.TransactionFindManyArgs, "where"> & { where?: Prisma.TransactionWhereInput }) =>
        prisma.transaction.findMany({
          ...args,
          where: { ...args.where, accountId },
        }),
      create: (args: Omit<Prisma.TransactionCreateArgs, "data"> & { data: Omit<Prisma.TransactionCreateInput, "account"> }) =>
        prisma.transaction.create({
          ...args,
          data: { ...args.data, account: { connect: { id: accountId } } },
        }),
      // ... idem para outras operations
    },
    // ... idem para outros models
  };
}

// Uso
async function listTransactions(accountId: string, monthId: string) {
  const db = getAccountScoped(accountId);
  return db.transaction.findMany({ where: { monthId } });
  // Filtro de accountId já incluído automaticamente
}
```

> **MVP**: pode começar manual (com `requireAccountAccess` + filtros explícitos) e migrar para wrapper se ficar repetitivo demais.

## Pattern para Route Handlers (API routes)

```ts
// src/app/api/transactions/route.ts

export async function POST(req: Request) {
  try {
    const { accountId, ...data } = await req.json();
    const { user } = await requireAccountAccess(accountId);
    const parsed = createTransactionSchema.parse(data);
    const created = await prisma.transaction.create({
      data: { ...parsed, accountId, createdById: user.id },
    });
    return Response.json(created);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 403 });
  }
}
```

## Pattern para Server Components (read)

```tsx
// src/app/(app)/[accountId]/months/[monthId]/page.tsx

import { requireAccountAccess } from "@/lib/auth/session";

export default async function MonthPage({ params }: { params: { accountId: string; monthId: string } }) {
  await requireAccountAccess(params.accountId); // throws → Next renders error
  
  const tables = await prisma.financeTable.findMany({
    where: { accountId: params.accountId, monthId: params.monthId },
  });
  
  return <MonthView tables={tables} />;
}
```

## Layout pattern (proteção em árvore)

```tsx
// src/app/(app)/[accountId]/layout.tsx

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { accountId: string };
}) {
  await requireAccountAccess(params.accountId);
  return <>{children}</>;
}
```

> Layout protege toda a árvore de páginas. Mas **não substitui** a checagem dentro de cada action (defense in depth).

## Testes de segurança

Para cada feature, escreva pelo menos 1 teste:

```ts
it("não permite acessar transações de outra Account", async () => {
  const accountA = await createTestAccount();
  const accountB = await createTestAccount();
  const txInB = await createTestTransaction(accountB.id);
  
  const userInA = accountA.members[0].user;
  await loginAs(userInA);
  
  await expect(getTransaction(accountA.id, txInB.id)).rejects.toThrow("Forbidden");
});
```

## Anti-patterns (não fazer)

❌ Confiar no `accountId` enviado pelo client sem validar
❌ Query sem `where: { accountId }`
❌ Buscar entidade por `id` sem confirmar `accountId`
❌ Pular `requireAccountAccess` "porque está dentro do layout protegido"
❌ Usar `prisma` diretamente em Server Action sem o helper de session
❌ Esquecer de validar `responsibleUserId` como sendo membro da Account

## Checklist antes de fazer PR

- [ ] Toda Server Action começa com `requireAccountAccess` ou `requireAccountRole`.
- [ ] Toda query Prisma de leitura tem `where: { accountId }` ou filtro equivalente em escopo aninhado.
- [ ] Toda mutação inclui `accountId` no `data`.
- [ ] Todo FK recebido (tableId, categoryId, etc.) é validado quanto a pertencer à Account.
- [ ] Há ao menos um teste de "user de account A não consegue ver/modificar dados de B".
