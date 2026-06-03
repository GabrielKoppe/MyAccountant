# SKILL — Testing

> **Regra**: Toda feature nova ou alteração em service/utilitário **deve** ter testes correspondentes. Sem testes, o PR não está completo.

---

## 1. Stack

| Ferramenta | Papel |
|---|---|
| `vitest` | Test runner + cobertura |
| `@testing-library/react` | Testes de componente |
| `vitest-mock-extended` | Mock tipado do PrismaClient |
| `jsdom` | Ambiente DOM para componentes |

---

## 2. Onde criar os testes

```
src/lib/money.ts              ← src/lib/money.test.ts
src/lib/dates.ts              ← src/lib/dates.test.ts
src/server/services/foo.ts    ← src/server/services/foo.test.ts
src/components/Bar.tsx        ← src/components/Bar.test.tsx
```

**Regra**: arquivo de teste ao lado do arquivo de origem. Arquivos `.test.ts` (nunca `.spec.ts`).

Helpers compartilhados ficam em:
```
tests/
  setup.ts              ← rodado antes de cada arquivo de teste
  mocks/
    prisma.ts           ← mock do PrismaClient
    auth.ts             ← mock de requireAccountAccess / requireUser
    email.ts            ← mock do emailService
  fixtures/
    transaction.ts      ← buildTransaction(overrides?)
    account.ts          ← buildAccount, buildAccountMember, buildSection, TEST_CTX
```

---

## 3. Como rodar

```bash
# Rodar tudo (dentro do container)
docker compose exec app pnpm test

# Watch mode (desenvolvimento)
docker compose exec app pnpm test:watch

# Cobertura
docker compose exec app pnpm test:coverage
```

Threshold mínimo: **60%** (statements, branches, functions, lines). Meta: 75%.

---

## 4. Estrutura de um teste de service

```ts
import { describe, expect, it } from "vitest";
import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { NotFoundError } from "@/server/api/errors";
import { createFoo } from "./foo-service";

describe("createFoo", () => {
  // ── Arrange / Act / Assert ─────────────────────────────────
  it("deve criar foo com sucesso", async () => {
    // Arrange
    prismaMock.foo.findUnique.mockResolvedValue(null);
    prismaMock.foo.create.mockResolvedValue({ id: "foo-1" } as any);

    // Act
    const result = await createFoo({ name: "Teste" }, TEST_CTX);

    // Assert
    expect(result.fooId).toBe("foo-1");
    expect(prismaMock.foo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accountId: "acc-test-1" }),
      }),
    );
  });

  // ── Multi-tenancy security (OBRIGATÓRIO em mutations) ──────
  it("não deve operar em dados de outra account (segurança multi-tenancy)", async () => {
    prismaMock.foo.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);

    await expect(createFoo({ name: "Teste" }, TEST_CTX)).rejects.toThrow(NotFoundError);
  });
});
```

---

## 5. Mock do Prisma

Importe `prismaMock` de `@/../tests/mocks/prisma`. Ele registra o `vi.mock` automaticamente e é resetado antes de cada teste via `beforeEach`.

```ts
import { prismaMock } from "@/../tests/mocks/prisma";

// Configurar o retorno
prismaMock.transaction.findUnique.mockResolvedValue({ id: "tx-1", accountId: "acc-test-1" } as any);

// Verificar chamadas
expect(prismaMock.transaction.create).toHaveBeenCalledWith(
  expect.objectContaining({ data: expect.objectContaining({ accountId: "acc-test-1" }) }),
);
```

### Transações Prisma (`$transaction`)

**Array (batch)**:
```ts
prismaMock.$transaction.mockResolvedValue([{}, {}]);
```

**Callback (interativo)**:
```ts
const txMock = {
  financeTable: { create: vi.fn().mockResolvedValue({ id: "table-1" }) },
  transaction: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
};
prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txMock));
```

---

## 6. Mock de auth

```ts
import "@/../tests/mocks/auth"; // já mocka requireAccountAccess e requireUser
```

O mock de `requireAccountAccess` retorna `{ user: { id: "user-test-1" }, member: { role: "owner" } }` por padrão.

---

## 7. Mock de email

```ts
import "@/../tests/mocks/email"; // já mocka emailService.send
```

Ou dentro do arquivo de teste quando precisar verificar chamadas:
```ts
vi.mock("@/server/email/email-service", () => ({
  emailService: { send: vi.fn().mockResolvedValue(undefined) },
}));
```

---

## 8. Fixtures prontas

### `TEST_CTX`
```ts
import { TEST_CTX } from "@/../tests/fixtures/account";
// { userId: "user-test-1", accountId: "acc-test-1", role: "owner" }
```

Variações para testes de role:
```ts
const editorCtx = { ...TEST_CTX, role: "editor" as const };
const viewerCtx = { ...TEST_CTX, role: "viewer" as const };
```

### `buildTransaction`
```ts
import { buildTransaction } from "@/../tests/fixtures/transaction";
const tx = buildTransaction({ amountCents: 50000n, isPending: true });
```

### `buildAccount`, `buildAccountMember`, `buildSection`, `buildAccountInvite`
```ts
import { buildAccount, buildSection, buildAccountInvite } from "@/../tests/fixtures/account";
```

---

## 9. Testes de funções puras (utilitários)

Não precisam de mocks. São os mais simples e mais valiosos:

```ts
// src/lib/money.test.ts
import { describe, expect, it } from "vitest";
import { calculateMonthTotal } from "@/server/services/month-service";

describe("calculateMonthTotal", () => {
  it("deve subtrair seções subtract do total", () => {
    const sections = [
      { id: "s1", countType: "add" as const },
      { id: "s2", countType: "subtract" as const },
    ];
    expect(calculateMonthTotal(sections, { s1: 10000n, s2: 3000n })).toBe(7000n);
  });
});
```

---

## 10. Teste de segurança multi-tenancy (OBRIGATÓRIO)

**Para todo service que faz mutações** (`create`, `update`, `delete`, `move`):
1. Mock o `findUnique/findFirst` para retornar `{ accountId: "acc-OUTRA" }`
2. Chame o service com `TEST_CTX` (accountId = `"acc-test-1"`)
3. Espere `NotFoundError` ou `ForbiddenError`

```ts
it("não deve operar em dados de outra account", async () => {
  prismaMock.financeTable.findUnique.mockResolvedValue({ accountId: "acc-OUTRA" } as any);
  await expect(deleteFinanceTable({ tableId: "t-1" }, TEST_CTX)).rejects.toThrow(NotFoundError);
});
```

> Isso garante que o service verifica explicitamente o `accountId` antes de operar. Captura a maioria dos IDORs sem precisar de banco real.

---

## 11. Mock de módulos externos com default export (ex: bcryptjs)

Use `vi.hoisted()` para criar as fns mock ANTES do hoisting de `vi.mock`, evitando erros de referência:

```ts
import { vi } from "vitest";

const mockHash = vi.hoisted(() => vi.fn());
const mockCompare = vi.hoisted(() => vi.fn());

vi.mock("bcryptjs", () => ({
  default: { hash: mockHash, compare: mockCompare },
}));

beforeEach(() => {
  mockHash.mockResolvedValue("$2b$12$hashed");
  mockCompare.mockResolvedValue(true);
});

// Para override em um teste específico:
mockCompare.mockResolvedValueOnce(false);
```

---

## 12. O que NÃO testar

- ❌ `page.tsx` / `layout.tsx` (cobertos por E2E em v2)
- ❌ Componentes triviais (wrappers sem lógica)
- ❌ Route handlers (a lógica está nos services)
- ❌ Fluxos E2E (ex: login → criar account → criar mês) — fica para v2

## 13. Anti-patterns

- ❌ `expect(result).toBeTruthy()` — seja específico no que está verificando
- ❌ Teste que depende de outro — cada `it` deve ser independente
- ❌ `prismaMock.anyMethod.mockResolvedValue(anything as any)` sem ser específico no tipo
- ❌ Mutation sem teste de multi-tenancy
- ❌ `console.log` em testes — use `expect()` ou deixe falhar naturalmente
