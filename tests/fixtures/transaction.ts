import type { Transaction } from "@prisma/client";

export function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-test-1",
    accountId: "acc-test-1",
    monthId: "month-test-1",
    tableId: "table-test-1",
    sectionId: "sec-test-1",
    occurredOn: new Date("2026-01-15"),
    amountCents: 10000n,
    description: "Transação de teste",
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
    createdById: "user-test-1",
    createdAt: new Date("2026-01-15"),
    updatedById: null,
    updatedAt: new Date("2026-01-15"),
    ...overrides,
  };
}
