# Spec 13 — Testing

> Skills: [`testing`](../skills/testing/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md)

## 1. Propósito

Define a estratégia de testes do projeto: o que testar, como rodar, padrões obrigatórios. Sem testes consistentes, o app não escala (e bugs aparecem em produção).

## 2. Estratégia

Pirâmide simples — **sem E2E no MVP**.

```
        ┌─────────────────────┐
        │   Integration       │  ← Server Actions, services, com DB mockado
        │   ~30% dos testes   │
        └─────────────────────┘
        ┌─────────────────────┐
        │   Unit              │  ← funções puras (money, dates, validation, services puros)
        │   ~70% dos testes   │
        └─────────────────────┘
```

> E2E (Playwright) é entregue pela [`spec 58`](58-testes-e2e.md) — testes ponta-a-ponta em `e2e/*.spec.ts`, complementares a esta pirâmide de unit/integration com Vitest (não a substituem).

## 3. Stack

```bash
pnpm add -D vitest @vitest/coverage-v8 @vitest/ui
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
pnpm add -D vitest-mock-extended  # mocks tipados do Prisma
pnpm add -D jsdom                  # DOM env para tests de componente
```

## 4. Configuração

### 4.1 `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.stories.{ts,tsx}",
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/emails/**",
      ],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
  },
});
```

### 4.2 Setup (`tests/setup.ts`)

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Auto-cleanup do RTL após cada teste
afterEach(() => {
  cleanup();
});

// Habilitar BigInt em JSON pra testes
beforeAll(() => {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
});

// Stub básico de env vars (override por teste se necessário)
vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
vi.stubEnv("NEXTAUTH_SECRET", "test-secret-min-32-characters-long");
vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000");
vi.stubEnv("GOOGLE_CLIENT_ID", "test");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "test");
vi.stubEnv("RESEND_API_KEY", "test");
vi.stubEnv("EMAIL_FROM", "test@example.com");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
```

### 4.3 Scripts no `package.json`

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

## 5. Convenções

### 5.1 Localização
- Testes **co-localizados** com o código: `transaction-service.ts` + `transaction-service.test.ts` ao lado.
- Helpers e fixtures globais em `tests/` na raiz.

### 5.2 Nomes
- Arquivo: `<source>.test.ts` (não `<source>.spec.ts`, escolha consistente).
- Describe: nome do módulo/função sendo testado.
- It: começa com "should" em inglês ou "deve" em pt-BR — consistente. **Escolha: pt-BR** ("deve calcular...", "deve falhar quando...").

```ts
describe("transactionService.create", () => {
  it("deve criar transação com sucesso", async () => { ... });
  it("deve falhar se categoryId não pertence à account", async () => { ... });
});
```

### 5.3 Estrutura AAA (Arrange / Act / Assert)
```ts
it("deve calcular total da seção com countType=subtract", () => {
  // Arrange
  const transactions = [
    { amountCents: 10000n, sectionId: "s1" },
    { amountCents: 5000n, sectionId: "s1" },
  ];
  const section = { id: "s1", countType: "subtract" as const };

  // Act
  const total = calculateSectionTotal(section, transactions);

  // Assert
  expect(total).toBe(-15000n);
});
```

## 6. Mock do Prisma

Usar `vitest-mock-extended` — gera mock totalmente tipado a partir do client.

### 6.1 Helper de mock

```ts
// tests/mocks/prisma.ts

import { beforeEach } from "vitest";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";

import type { PrismaClient } from "@prisma/client";

// Mockar o módulo @/server/prisma
vi.mock("@/server/prisma", () => ({
  prisma: prismaMock,
}));

export const prismaMock = mockDeep<PrismaClient>() as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});
```

### 6.2 Uso em testes

```ts
import { describe, it, expect } from "vitest";
import { prismaMock } from "@/../tests/mocks/prisma";
import { transactionService } from "@/server/services/transaction-service";

describe("transactionService.create", () => {
  it("deve criar transação com sucesso", async () => {
    const mockTransaction = {
      id: "tx1",
      accountId: "acc1",
      amountCents: 10000n,
      // ... outros campos
    };
    prismaMock.transaction.create.mockResolvedValue(mockTransaction as any);

    const result = await transactionService.create({
      accountId: "acc1",
      tableId: "table1",
      amountCents: 10000n,
      // ...
    });

    expect(result.id).toBe("tx1");
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accountId: "acc1" }),
      }),
    );
  });
});
```

## 7. Tipos de testes — padrões

### 7.1 Unit: funções puras
Funções de `src/lib/` (money, dates, validation helpers).

```ts
// src/lib/money.test.ts
import { describe, it, expect } from "vitest";

import { centsToReais, parseBrlMaskToCents, formatCentsToBrl } from "./money";

describe("money utilities", () => {
  describe("centsToReais", () => {
    it("deve converter centavos para reais", () => {
      expect(centsToReais(12345n)).toBe(123.45);
    });
  });

  describe("parseBrlMaskToCents", () => {
    it("deve parsear formato BRL", () => {
      expect(parseBrlMaskToCents("R$ 1.234,56")).toBe(123456n);
    });

    it("deve manter sinal negativo", () => {
      expect(parseBrlMaskToCents("-R$ 100,00")).toBe(-10000n);
    });
  });

  describe("formatCentsToBrl", () => {
    it("deve formatar valor positivo", () => {
      expect(formatCentsToBrl(12345n)).toBe("R$ 123,45");
    });
  });
});
```

### 7.2 Integration: Server Actions e services
Service ou action chamando Prisma mockado.

```ts
// src/server/services/transaction-service.test.ts
import { describe, it, expect } from "vitest";
import { prismaMock } from "@/../tests/mocks/prisma";

import { transactionService } from "./transaction-service";

describe("transactionService", () => {
  describe("create", () => {
    it("deve criar transação com sectionId desnormalizado", async () => {
      prismaMock.financeTable.findUnique.mockResolvedValue({
        id: "table1",
        accountId: "acc1",
        sectionId: "sec1",
      } as any);

      prismaMock.transaction.create.mockResolvedValue({
        id: "tx1",
        sectionId: "sec1",
      } as any);

      const result = await transactionService.create({
        accountId: "acc1",
        tableId: "table1",
        amountCents: 10000n,
        // ...
      });

      // Verifica desnormalização do sectionId
      expect(prismaMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sectionId: "sec1",
            accountId: "acc1",
          }),
        }),
      );
    });

    it("deve falhar se table não pertence à account", async () => {
      prismaMock.financeTable.findUnique.mockResolvedValue({
        id: "table1",
        accountId: "acc-DIFERENTE",
        sectionId: "sec1",
      } as any);

      await expect(
        transactionService.create({
          accountId: "acc1",
          tableId: "table1",
          // ...
        }),
      ).rejects.toThrow("not in account");
    });
  });
});
```

### 7.3 Multi-tenancy security tests (OBRIGATÓRIO)

Para CADA service que toca dados de Account, **escreva ao menos um teste** de isolamento:

```ts
// src/server/services/transaction-service.test.ts
describe("multi-tenancy security", () => {
  it("não permite atualizar transação de outra account", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: "tx1",
      accountId: "acc-OUTRA",
    } as any);

    await expect(
      transactionService.update({
        accountId: "acc1",
        transactionId: "tx1",
        // ...
      }),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("não permite deletar transação de outra account", async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: "tx1",
      accountId: "acc-OUTRA",
    } as any);

    await expect(
      transactionService.delete({ accountId: "acc1", transactionId: "tx1" }),
    ).rejects.toThrow("FORBIDDEN");
  });
});
```

> Como mockamos o DB, esses testes garantem que **o service verifica explicitamente o accountId**. Não captura "leak no nível do DB", mas captura a maioria dos IDORs.

### 7.4 Componentes (RTL)
Para componentes interativos críticos (formulários, modais).

```ts
// src/components/transactions/TransactionForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TransactionForm } from "./TransactionForm";

describe("TransactionForm", () => {
  it("deve mostrar erro de validação quando valor for inválido", async () => {
    const user = userEvent.setup();
    render(<TransactionForm accountId="acc1" tableId="t1" />);

    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(await screen.findByText(/valor inválido/i)).toBeInTheDocument();
  });
});
```

### 7.5 Mocks de NextAuth

```ts
// tests/mocks/auth.ts
import { vi } from "vitest";

vi.mock("@/server/auth/session", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "user1",
    email: "test@example.com",
    name: "Test User",
  }),
  requireAccountAccess: vi.fn().mockImplementation(async (accountId) => ({
    user: { id: "user1", email: "test@example.com", name: "Test User" },
    member: { accountId, userId: "user1", role: "owner" },
  })),
}));
```

### 7.6 Mocks de email

```ts
// tests/mocks/email.ts
import { vi } from "vitest";

vi.mock("@/server/email/email-service", () => ({
  emailService: {
    send: vi.fn().mockResolvedValue({ ok: true, id: "mock-email-id" }),
  },
}));
```

## 8. Fixtures

Para evitar boilerplate de criar objetos em cada teste:

```ts
// tests/fixtures/transaction.ts
import type { Transaction } from "@prisma/client";

export function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx1",
    accountId: "acc1",
    monthId: "month1",
    tableId: "table1",
    sectionId: "sec1",
    occurredOn: new Date("2026-01-15"),
    amountCents: 10000n,
    description: "Test transaction",
    notes: null,
    isPending: false,
    isFavorite: false,
    categoryId: null,
    subcategoryId: null,
    institutionId: null,
    institutionText: null,
    responsibleUserId: null,
    cardInstallment: null,
    investmentType: null,
    metadata: {},
    createdById: "user1",
    createdAt: new Date(),
    updatedById: null,
    updatedAt: new Date(),
    ...overrides,
  };
}
```

Uso:
```ts
const tx = buildTransaction({ amountCents: 50000n, isFavorite: true });
```

## 9. O que testar (prioridade)

**Alta prioridade** (sempre):
- ✅ Funções puras (money, dates, parsing)
- ✅ Services com lógica de negócio (totais, agregações, copy de tabela)
- ✅ Multi-tenancy security (1 teste por mutation)
- ✅ Validação de Zod schemas
- ✅ Transformações complexas (CSV parsing, mapping)

**Média prioridade**:
- ⚠️ Server Actions (cobrem `defineAction` indiretamente)
- ⚠️ Componentes de form complexos
- ⚠️ Lógica condicional de UI

**Baixa prioridade** (não testar):
- ❌ Componentes triviais (botões wrapper)
- ❌ Route Handlers (cobertos via service tests)
- ❌ Páginas Next (`page.tsx`) — cobertas por E2E via Playwright (spec 58), não por Vitest

## 10. CI

`pnpm test` roda no CI antes do build. Ver `specs/16-ci-cd.md`.

Coverage threshold: 60% no início. Subir gradualmente para 75% conforme estabilizar.

## 11. Anti-patterns

❌ Teste que depende de outro teste (sempre isolado)
❌ Mock que não reflete a API real do Prisma (use `vitest-mock-extended`)
❌ Asserts genéricos (`expect(result).toBeTruthy()`) — seja específico
❌ Testes lentos por loops grandes — manter < 100ms por unit, < 500ms por integration
❌ Setup repetido em cada teste — extrair pra `beforeEach` ou helper
❌ Sem teste de multi-tenancy em mutations

## 12. Decisões em aberto

- [ ] Snapshot testing pra UI? — **MVP: não** (frágeis, pouco valor)
- [ ] Property-based testing (`fast-check`)? — **Considerar pra money utils**
- [ ] Mutation testing (`stryker`)? — **v3, overkill agora**
- [ ] Quando subir o threshold de coverage de 60 → 75? — **decidir após fase 4**
