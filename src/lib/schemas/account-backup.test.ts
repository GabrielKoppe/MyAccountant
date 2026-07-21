import { describe, expect, it } from "vitest";

import { accountSnapshotSchema } from "./account-backup";

// Data completa com todos os 26 arrays presentes (vazios por padrão) — cada
// teste sobrescreve só os grupos que precisa exercitar. Sem tipagem estrita:
// isto representa o JSON *bruto* (pré-parse), com dinheiro/datas como string,
// não o tipo de saída do schema (pós-coerce).
function emptyData() {
  return {
    responsibleParties: [],
    responsiblePartyMembers: [],
    tableTypes: [],
    sections: [],
    categories: [],
    subcategories: [],
    institutions: [],
    tags: [],
    csvTemplates: [],
    months: [],
    tableTemplates: [],
    tableTemplateItems: [],
    installmentGroups: [],
    pendingInstallments: [],
    financeTables: [],
    transactions: [],
    transactionTags: [],
    transactionLinks: [],
    transactionAliases: [],
    transactionAliasTags: [],
    budgets: [],
    dashboardLayouts: [],
    checklistItems: [],
    checklistCompletions: [],
    balanceAccounts: [],
    balanceSnapshots: [],
  };
}

function validSnapshot() {
  return {
    formatVersion: 1 as const,
    app: "myaccountant" as const,
    exportedAt: "2026-07-21T12:00:00.000Z",
    account: {
      name: "Minha Conta",
      settings: {
        currency: "BRL",
        monthStartDay: 1,
        invertSignOnMoveByDefault: false,
        onboardingCompletedAt: null,
        defaultResponsiblePartyId: null,
      },
    },
    data: {
      ...emptyData(),
      responsibleParties: [
        {
          id: "party1",
          accountId: "acc1",
          name: "Casal",
          kind: "personal",
          icon: null,
          color: null,
          archivedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      sections: [
        {
          id: "sec1",
          accountId: "acc1",
          name: "Receitas",
          countType: "add",
          order: 0,
          isActive: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      categories: [
        {
          id: "cat1",
          accountId: "acc1",
          name: "Alimentação",
          createdById: "user1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "tx1",
          accountId: "acc1",
          monthId: "month1",
          tableId: "table1",
          sectionId: "sec1",
          occurredOn: "2026-01-05",
          amountCents: "12345",
          description: null,
          notes: null,
          isPending: false,
          isFavorite: false,
          categoryId: "cat1",
          subcategoryId: null,
          institutionId: null,
          institutionText: null,
          responsiblePartyId: null,
          cardInstallment: null,
          investmentType: null,
          expenseType: null,
          paymentMethod: null,
          source: "manual",
          installmentGroupId: null,
          installmentNumber: null,
          originalAmountCents: null,
          originalCurrency: null,
          exchangeRate: null,
          metadata: {},
          createdById: "user1",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedById: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
  };
}

describe("accountSnapshotSchema", () => {
  it("aceita um snapshot mínimo válido com linhas em alguns modelos", () => {
    const result = accountSnapshotSchema.safeParse(validSnapshot());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data.transactions[0].amountCents).toBe(12345n);
      expect(result.data.data.responsibleParties).toHaveLength(1);
      expect(result.data.data.sections).toHaveLength(1);
    }
  });

  it("rejeita formatVersion diferente de 1", () => {
    const snapshot = { ...validSnapshot(), formatVersion: 2 };

    const result = accountSnapshotSchema.safeParse(snapshot);

    expect(result.success).toBe(false);
  });

  it("rejeita snapshot com uma chave de data faltando", () => {
    const snapshot = validSnapshot();
    const { transactions: _transactions, ...dataWithoutTransactions } = snapshot.data;
    const invalidSnapshot = { ...snapshot, data: dataWithoutTransactions };

    const result = accountSnapshotSchema.safeParse(invalidSnapshot);

    expect(result.success).toBe(false);
  });

  it("aceita dinheiro serializado como string (coerce.bigint)", () => {
    const snapshot = validSnapshot();
    snapshot.data.transactions[0].amountCents = "99999";

    const result = accountSnapshotSchema.safeParse(snapshot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data.transactions[0].amountCents).toBe(99999n);
    }
  });

  it("rejeita dinheiro em string não-numérica", () => {
    const snapshot = validSnapshot();
    snapshot.data.transactions[0].amountCents = "not-a-number";

    const result = accountSnapshotSchema.safeParse(snapshot);

    expect(result.success).toBe(false);
  });
});
