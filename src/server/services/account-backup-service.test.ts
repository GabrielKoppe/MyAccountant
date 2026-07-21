import { beforeEach, describe, expect, it } from "vitest";

import type {
  AccountSnapshot,
  AccountSnapshotData,
  BudgetRow,
  CategoryRow,
  DashboardLayoutRow,
  FinanceTableRow,
  InstallmentGroupRow,
  MonthRow,
  PendingInstallmentRow,
  ResponsiblePartyMemberRow,
  ResponsiblePartyRow,
  SectionRow,
  SubcategoryRow,
  TableTemplateItemRow,
  TableTemplateRow,
  TransactionAliasRow,
  TransactionRow,
} from "@/lib/schemas/account-backup";

import { prismaMock } from "@/../tests/mocks/prisma";

import { buildAccountSnapshot, importSnapshot, planImport } from "./account-backup-service";

const ACCOUNT_ID = "acc-1";
const OTHER_ACCOUNT_ID = "acc-other";

function mockEmptyFindManys() {
  prismaMock.responsibleParty.findMany.mockResolvedValue([]);
  prismaMock.responsiblePartyMember.findMany.mockResolvedValue([]);
  prismaMock.tableType.findMany.mockResolvedValue([]);
  prismaMock.section.findMany.mockResolvedValue([]);
  prismaMock.category.findMany.mockResolvedValue([]);
  prismaMock.subcategory.findMany.mockResolvedValue([]);
  prismaMock.institution.findMany.mockResolvedValue([]);
  prismaMock.tag.findMany.mockResolvedValue([]);
  prismaMock.csvTemplate.findMany.mockResolvedValue([]);
  prismaMock.month.findMany.mockResolvedValue([]);
  prismaMock.tableTemplate.findMany.mockResolvedValue([]);
  prismaMock.tableTemplateItem.findMany.mockResolvedValue([]);
  prismaMock.installmentGroup.findMany.mockResolvedValue([]);
  prismaMock.pendingInstallment.findMany.mockResolvedValue([]);
  prismaMock.financeTable.findMany.mockResolvedValue([]);
  prismaMock.transaction.findMany.mockResolvedValue([]);
  prismaMock.transactionTag.findMany.mockResolvedValue([]);
  prismaMock.transactionLink.findMany.mockResolvedValue([]);
  prismaMock.transactionAlias.findMany.mockResolvedValue([]);
  prismaMock.transactionAliasTag.findMany.mockResolvedValue([]);
  prismaMock.budget.findMany.mockResolvedValue([]);
  prismaMock.dashboardLayout.findMany.mockResolvedValue([]);
  prismaMock.checklistItem.findMany.mockResolvedValue([]);
  prismaMock.checklistCompletion.findMany.mockResolvedValue([]);
  prismaMock.balanceAccount.findMany.mockResolvedValue([]);
  prismaMock.balanceSnapshot.findMany.mockResolvedValue([]);
}

function mockAccountAndSettings() {
  prismaMock.account.findUnique.mockResolvedValue({ name: "Minha Conta" } as never);
  prismaMock.accountSettings.findUnique.mockResolvedValue({
    accountId: ACCOUNT_ID,
    currency: "BRL",
    monthStartDay: 1,
    invertSignOnMoveByDefault: true,
    onboardingCompletedAt: null,
    defaultResponsiblePartyId: null,
  } as never);
}

beforeEach(() => {
  mockAccountAndSettings();
  mockEmptyFindManys();
});

describe("buildAccountSnapshot — multi-tenancy", () => {
  it("filtra todas as leituras de modelos com accountId direto por where: { accountId }", async () => {
    await buildAccountSnapshot(ACCOUNT_ID);

    const directAccountIdModels = [
      prismaMock.responsibleParty.findMany,
      prismaMock.tableType.findMany,
      prismaMock.section.findMany,
      prismaMock.category.findMany,
      prismaMock.subcategory.findMany,
      prismaMock.institution.findMany,
      prismaMock.tag.findMany,
      prismaMock.csvTemplate.findMany,
      prismaMock.month.findMany,
      prismaMock.tableTemplate.findMany,
      prismaMock.tableTemplateItem.findMany,
      prismaMock.installmentGroup.findMany,
      prismaMock.pendingInstallment.findMany,
      prismaMock.financeTable.findMany,
      prismaMock.transaction.findMany,
      prismaMock.transactionLink.findMany,
      prismaMock.transactionAlias.findMany,
      prismaMock.budget.findMany,
      prismaMock.dashboardLayout.findMany,
      prismaMock.checklistItem.findMany,
      prismaMock.checklistCompletion.findMany,
      prismaMock.balanceAccount.findMany,
      prismaMock.balanceSnapshot.findMany,
    ];

    for (const mockFn of directAccountIdModels) {
      expect(mockFn).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accountId: ACCOUNT_ID } }),
      );
    }

    // account + settings também filtram pela account correta
    expect(prismaMock.account.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ACCOUNT_ID } }),
    );
    expect(prismaMock.accountSettings.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: ACCOUNT_ID } }),
    );

    // never a account errada
    for (const mockFn of [...directAccountIdModels, prismaMock.account.findUnique]) {
      expect(mockFn).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ accountId: OTHER_ACCOUNT_ID }),
        }),
      );
    }
  });

  it("filtra tabelas de junção (sem accountId próprio) via relação para a account correta", async () => {
    await buildAccountSnapshot(ACCOUNT_ID);

    expect(prismaMock.responsiblePartyMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { party: { accountId: ACCOUNT_ID } } }),
    );
    expect(prismaMock.transactionTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { transaction: { accountId: ACCOUNT_ID } } }),
    );
    expect(prismaMock.transactionAliasTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { alias: { accountId: ACCOUNT_ID } } }),
    );
  });
});

describe("buildAccountSnapshot — serialização", () => {
  it("serializa amountCents (BigInt) como string e occurredOn (Date) como YYYY-MM-DD", async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: "tx-1",
        accountId: ACCOUNT_ID,
        monthId: "month-1",
        tableId: "table-1",
        sectionId: "section-1",
        occurredOn: new Date("2026-03-15T00:00:00.000Z"),
        amountCents: 12345n,
        description: "Supermercado",
        notes: null,
        isPending: false,
        isFavorite: false,
        categoryId: null,
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
        createdById: "user-1",
        createdAt: new Date("2026-03-15T10:00:00.000Z"),
        updatedById: null,
        updatedAt: new Date("2026-03-15T10:00:00.000Z"),
      },
    ] as never);

    const snapshot = await buildAccountSnapshot(ACCOUNT_ID);

    expect(snapshot.data.transactions).toHaveLength(1);
    const tx = snapshot.data.transactions[0]!;
    expect(tx.amountCents).toBe("12345");
    expect(typeof tx.amountCents).toBe("string");
    expect(tx.occurredOn).toBe("2026-03-15");
  });

  it("serializa exchangeRate (Decimal) como string quando presente", async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: "tx-2",
        accountId: ACCOUNT_ID,
        monthId: "month-1",
        tableId: "table-1",
        sectionId: "section-1",
        occurredOn: new Date("2026-01-01T00:00:00.000Z"),
        amountCents: 100n,
        description: null,
        notes: null,
        isPending: false,
        isFavorite: false,
        categoryId: null,
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
        originalAmountCents: 500n,
        originalCurrency: "USD",
        exchangeRate: { toString: () => "5.234500" },
        metadata: {},
        createdById: "user-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedById: null,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ] as never);

    const snapshot = await buildAccountSnapshot(ACCOUNT_ID);
    const tx = snapshot.data.transactions[0]!;
    expect(tx.exchangeRate).toBe("5.234500");
    expect(tx.originalAmountCents).toBe("500");
  });
});

describe("buildAccountSnapshot — formato do snapshot", () => {
  it("retorna formatVersion 1, app e os 26 grupos de data", async () => {
    const snapshot = await buildAccountSnapshot(ACCOUNT_ID);

    expect(snapshot.formatVersion).toBe(1);
    expect(snapshot.app).toBe("myaccountant");
    expect(snapshot.account.name).toBe("Minha Conta");
    expect(typeof snapshot.exportedAt).toBe("string");

    const expectedKeys = [
      "responsibleParties",
      "responsiblePartyMembers",
      "tableTypes",
      "sections",
      "categories",
      "subcategories",
      "institutions",
      "tags",
      "csvTemplates",
      "months",
      "tableTemplates",
      "tableTemplateItems",
      "installmentGroups",
      "pendingInstallments",
      "financeTables",
      "transactions",
      "transactionTags",
      "transactionLinks",
      "transactionAliases",
      "transactionAliasTags",
      "budgets",
      "dashboardLayouts",
      "checklistItems",
      "checklistCompletions",
      "balanceAccounts",
      "balanceSnapshots",
    ];

    expect(Object.keys(snapshot.data).sort()).toEqual(expectedKeys.sort());
    expect(expectedKeys).toHaveLength(26);
    for (const key of expectedKeys) {
      expect(Array.isArray(snapshot.data[key as keyof typeof snapshot.data])).toBe(true);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Fase 2b — planImport (planner PURO) + importSnapshot (executor tx)
// ═════════════════════════════════════════════════════════════════════════════

const ISO = "2026-01-01T00:00:00.000Z";
const IMPORTER = "importer-user";

function emptyData(): AccountSnapshotData {
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

function makeSnapshot(data: Partial<AccountSnapshotData>): AccountSnapshot {
  return {
    formatVersion: 1,
    app: "myaccountant",
    exportedAt: "2026-07-21T00:00:00.000Z",
    account: {
      name: "Conta Origem",
      settings: {
        currency: "BRL",
        monthStartDay: 1,
        invertSignOnMoveByDefault: false,
        onboardingCompletedAt: null,
        defaultResponsiblePartyId: null,
      },
    },
    data: { ...emptyData(), ...data },
  };
}

// ─── Factories (defaults + override) ─────────────────────────────────────────
function month(over: Partial<MonthRow> & { id: string }): MonthRow {
  return {
    accountId: "src",
    year: 2026,
    month: 1,
    createdById: "src-user",
    createdAt: ISO,
    ...over,
  };
}
function section(over: Partial<SectionRow> & { id: string }): SectionRow {
  return {
    accountId: "src",
    name: "Seção",
    countType: "add",
    order: 0,
    isActive: true,
    createdAt: ISO,
    ...over,
  };
}
function category(over: Partial<CategoryRow> & { id: string }): CategoryRow {
  return { accountId: "src", name: "Cat", createdById: "src-user", createdAt: ISO, ...over };
}
function subcategory(over: Partial<SubcategoryRow> & { id: string; categoryId: string }): SubcategoryRow {
  return { accountId: "src", name: "Sub", createdAt: ISO, ...over };
}
function responsibleParty(over: Partial<ResponsiblePartyRow> & { id: string }): ResponsiblePartyRow {
  return {
    accountId: "src",
    name: "Você",
    kind: "personal",
    icon: null,
    color: null,
    archivedAt: null,
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  };
}
function financeTable(over: Partial<FinanceTableRow> & { id: string }): FinanceTableRow {
  return {
    accountId: "src",
    monthId: "m-old",
    sectionId: "s-old",
    tableTypeId: null,
    name: "Tabela",
    countInMonth: true,
    groupByDate: true,
    sourceMethod: "empty",
    sourceTableId: null,
    displayOrder: 0,
    createdById: "src-user",
    createdAt: ISO,
    updatedById: null,
    updatedAt: ISO,
    ...over,
  };
}
function transaction(over: Partial<TransactionRow> & { id: string }): TransactionRow {
  return {
    accountId: "src",
    monthId: "m-old",
    tableId: "ft-old",
    sectionId: "s-old",
    occurredOn: "2026-03-15",
    amountCents: 100n,
    description: null,
    notes: null,
    isPending: false,
    isFavorite: false,
    categoryId: null,
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
    createdById: "src-user",
    createdAt: ISO,
    updatedById: null,
    updatedAt: ISO,
    ...over,
  };
}
function tableTemplate(over: Partial<TableTemplateRow> & { id: string }): TableTemplateRow {
  return {
    accountId: "src",
    name: "Modelo",
    description: null,
    tableTypeId: null,
    countInMonth: true,
    autoApply: false,
    autoSectionId: null,
    autoTableTypeId: null,
    createdById: "src-user",
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  };
}
function tableTemplateItem(
  over: Partial<TableTemplateItemRow> & { id: string; templateId: string },
): TableTemplateItemRow {
  return {
    accountId: "src",
    day: 1,
    amountCents: 100n,
    description: null,
    notes: null,
    isPending: false,
    categoryId: null,
    subcategoryId: null,
    institutionId: null,
    responsiblePartyId: null,
    cardInstallment: null,
    investmentType: null,
    expenseType: null,
    displayOrder: 0,
    createdAt: ISO,
    ...over,
  };
}
function installmentGroup(
  over: Partial<InstallmentGroupRow> & { id: string; sectionId: string },
): InstallmentGroupRow {
  return {
    accountId: "src",
    description: "Parcelado",
    totalCents: 1200n,
    installmentCount: 12,
    downPaymentCents: null,
    startDate: "2026-01-01",
    tableTypeId: null,
    createdAt: ISO,
    ...over,
  };
}
function pendingInstallment(
  over: Partial<PendingInstallmentRow> & { id: string; installmentGroupId: string },
): PendingInstallmentRow {
  return {
    accountId: "src",
    installmentNumber: 1,
    amountCents: 100n,
    expectedDate: "2026-02-01",
    description: null,
    categoryId: null,
    subcategoryId: null,
    notes: null,
    createdAt: ISO,
    ...over,
  };
}
function dashboardLayout(over: Partial<DashboardLayoutRow> & { id: string }): DashboardLayoutRow {
  return {
    accountId: "src",
    context: "monthly",
    widgets: [],
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  };
}
function transactionAlias(over: Partial<TransactionAliasRow> & { id: string }): TransactionAliasRow {
  return {
    accountId: "src",
    trigger: "Uber",
    triggerNormalized: "uber",
    description: null,
    notes: null,
    amountCents: null,
    categoryId: null,
    subcategoryId: null,
    institutionId: null,
    institutionText: null,
    responsiblePartyId: null,
    expenseType: null,
    paymentMethod: null,
    investmentType: null,
    cardInstallment: null,
    isPending: null,
    isFavorite: null,
    originalCurrency: null,
    originalAmountCents: null,
    exchangeRate: null,
    archivedAt: null,
    createdById: "src-user",
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  };
}
function budget(over: Partial<BudgetRow> & { id: string }): BudgetRow {
  return {
    accountId: "src",
    name: "Meta",
    sectionId: null,
    categoryId: null,
    memberUserId: null,
    institutionId: null,
    tableTypeId: null,
    amountCents: 500n,
    alertThresholdPercent: 80,
    isRecurring: true,
    showInSummary: false,
    year: null,
    month: null,
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  };
}

describe("planImport — FK remap (colunas reais)", () => {
  it("remapeia monthId/tableId/sectionId/categoryId da Transaction para os novos ids do idMap", () => {
    const snapshot = makeSnapshot({
      months: [month({ id: "m-old" })],
      sections: [section({ id: "s-old" })],
      categories: [category({ id: "c-old" })],
      financeTables: [financeTable({ id: "ft-old", monthId: "m-old", sectionId: "s-old" })],
      transactions: [
        transaction({
          id: "tx-old",
          monthId: "m-old",
          tableId: "ft-old",
          sectionId: "s-old",
          categoryId: "c-old",
        }),
      ],
    });

    const plan = planImport(snapshot, "target-acc", IMPORTER);
    const tx = plan.inserts.transactions[0]!;

    expect(tx.monthId).toBe(plan.idMap.months.get("m-old"));
    expect(tx.tableId).toBe(plan.idMap.financeTables.get("ft-old"));
    expect(tx.sectionId).toBe(plan.idMap.sections.get("s-old"));
    expect(tx.categoryId).toBe(plan.idMap.categories.get("c-old"));
    expect(tx.accountId).toBe("target-acc");

    // id novo: mapeado e diferente do original.
    expect(tx.id).toBe(plan.idMap.transactions.get("tx-old"));
    expect(tx.id).not.toBe("tx-old");
  });
});

describe("planImport — soft-ref remap (String sem relação Prisma)", () => {
  it("remapeia TableTemplateItem.categoryId e PendingInstallment.subcategoryId/installmentGroupId", () => {
    const snapshot = makeSnapshot({
      sections: [section({ id: "s-old" })],
      categories: [category({ id: "c-old" })],
      subcategories: [subcategory({ id: "sub-old", categoryId: "c-old" })],
      tableTemplates: [tableTemplate({ id: "tt-old" })],
      tableTemplateItems: [
        tableTemplateItem({ id: "tti-old", templateId: "tt-old", categoryId: "c-old" }),
      ],
      installmentGroups: [installmentGroup({ id: "ig-old", sectionId: "s-old" })],
      pendingInstallments: [
        pendingInstallment({ id: "pi-old", installmentGroupId: "ig-old", subcategoryId: "sub-old" }),
      ],
    });

    const plan = planImport(snapshot, "target-acc", IMPORTER);
    const item = plan.inserts.tableTemplateItems[0]!;
    const pending = plan.inserts.pendingInstallments[0]!;

    expect(item.categoryId).toBe(plan.idMap.categories.get("c-old"));
    expect(item.templateId).toBe(plan.idMap.tableTemplates.get("tt-old"));
    expect(pending.subcategoryId).toBe(plan.idMap.subcategories.get("sub-old"));
    expect(pending.installmentGroupId).toBe(plan.idMap.installmentGroups.get("ig-old"));
  });
});

describe("planImport — deep-remap de ids em JSON", () => {
  it("remapeia dashboard analysis config.monthIds/filterSectionIds e Transaction.metadata.appliedAliasId", () => {
    const snapshot = makeSnapshot({
      months: [month({ id: "m-old" })],
      sections: [section({ id: "s-old" })],
      financeTables: [financeTable({ id: "ft-old", monthId: "m-old", sectionId: "s-old" })],
      transactionAliases: [transactionAlias({ id: "al-old" })],
      transactions: [
        transaction({
          id: "tx-old",
          monthId: "m-old",
          tableId: "ft-old",
          sectionId: "s-old",
          metadata: { appliedAliasId: "al-old", foo: "bar" },
        }),
      ],
      dashboardLayouts: [
        dashboardLayout({
          id: "d-old",
          context: "yearly",
          widgets: [
            {
              instanceId: "i1",
              widgetId: "analysis",
              visible: true,
              x: 0,
              y: 0,
              w: 2,
              h: 2,
              sizeVariantId: "m",
              config: { monthIds: ["m-old"], filterSectionIds: ["s-old"] },
            },
          ],
        }),
      ],
    });

    const plan = planImport(snapshot, "target-acc", IMPORTER);

    const widgets = plan.inserts.dashboardLayouts[0]!.widgets as Array<{
      config: { monthIds: string[]; filterSectionIds: string[] };
    }>;
    expect(widgets[0]!.config.monthIds).toEqual([plan.idMap.months.get("m-old")]);
    expect(widgets[0]!.config.filterSectionIds).toEqual([plan.idMap.sections.get("s-old")]);

    const meta = plan.inserts.transactions[0]!.metadata as { appliedAliasId: string; foo: string };
    expect(meta.appliedAliasId).toBe(plan.idMap.transactionAliases.get("al-old"));
    expect(meta.foo).toBe("bar"); // chaves opacas preservadas
  });
});

describe("planImport — re-carimbo de usuário + drops (DD-10)", () => {
  it("re-carimba createdById para o importador, dropa ResponsiblePartyMember e zera Budget.memberUserId", () => {
    const snapshot = makeSnapshot({
      responsibleParties: [responsibleParty({ id: "p-old" })],
      responsiblePartyMembers: [{ partyId: "p-old", userId: "other-user" } as ResponsiblePartyMemberRow],
      categories: [category({ id: "c-old", createdById: "other-user" })],
      budgets: [budget({ id: "b-old", memberUserId: "other-user" })],
    });

    const plan = planImport(snapshot, "target-acc", IMPORTER);

    expect(plan.inserts.categories[0]!.createdById).toBe(IMPORTER);
    expect(plan.inserts.responsiblePartyMembers).toEqual([]);
    expect(plan.inserts.budgets[0]!.memberUserId).toBeNull();
  });
});

describe("planImport — self-relation FinanceTable.sourceTableId (2ª passada)", () => {
  it("insere sourceTableId null e coleta o update remapeado para a 2ª passada", () => {
    const snapshot = makeSnapshot({
      months: [month({ id: "m-old" })],
      sections: [section({ id: "s-old" })],
      financeTables: [
        financeTable({ id: "ft-a", monthId: "m-old", sectionId: "s-old", sourceTableId: null }),
        financeTable({ id: "ft-b", monthId: "m-old", sectionId: "s-old", sourceTableId: "ft-a" }),
      ],
    });

    const plan = planImport(snapshot, "target-acc", IMPORTER);

    for (const ft of plan.inserts.financeTables) {
      expect(ft.sourceTableId).toBeNull();
    }
    expect(plan.secondPass).toEqual([
      {
        id: plan.idMap.financeTables.get("ft-b"),
        sourceTableId: plan.idMap.financeTables.get("ft-a"),
      },
    ]);
  });
});

// Ordem topológica de insert (spec 64 §7) — verificada de forma INDEPENDENTE do service.
const IMPORT_TOPO_ORDER = [
  "responsibleParties",
  "tableTypes",
  "sections",
  "categories",
  "subcategories",
  "institutions",
  "tags",
  "csvTemplates",
  "months",
  "tableTemplates",
  "tableTemplateItems",
  "installmentGroups",
  "financeTables",
  "transactions",
  "transactionTags",
  "transactionLinks",
  "transactionAliases",
  "transactionAliasTags",
  "pendingInstallments",
  "responsiblePartyMembers",
  "budgets",
  "dashboardLayouts",
  "checklistItems",
  "checklistCompletions",
  "balanceAccounts",
  "balanceSnapshots",
] as const;

describe("importSnapshot — modo overwrite (executor tx)", () => {
  it("apaga cada modelo em ordem REVERSA da topológica, restaura nome+settings, tudo dentro de $transaction", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: unknown) =>
      (fn as (tx: typeof prismaMock) => unknown)(prismaMock),
    );

    const deleteDelegate: Record<(typeof IMPORT_TOPO_ORDER)[number], { deleteMany: unknown }> = {
      responsibleParties: prismaMock.responsibleParty,
      tableTypes: prismaMock.tableType,
      sections: prismaMock.section,
      categories: prismaMock.category,
      subcategories: prismaMock.subcategory,
      institutions: prismaMock.institution,
      tags: prismaMock.tag,
      csvTemplates: prismaMock.csvTemplate,
      months: prismaMock.month,
      tableTemplates: prismaMock.tableTemplate,
      tableTemplateItems: prismaMock.tableTemplateItem,
      installmentGroups: prismaMock.installmentGroup,
      financeTables: prismaMock.financeTable,
      transactions: prismaMock.transaction,
      transactionTags: prismaMock.transactionTag,
      transactionLinks: prismaMock.transactionLink,
      transactionAliases: prismaMock.transactionAlias,
      transactionAliasTags: prismaMock.transactionAliasTag,
      pendingInstallments: prismaMock.pendingInstallment,
      responsiblePartyMembers: prismaMock.responsiblePartyMember,
      budgets: prismaMock.budget,
      dashboardLayouts: prismaMock.dashboardLayout,
      checklistItems: prismaMock.checklistItem,
      checklistCompletions: prismaMock.checklistCompletion,
      balanceAccounts: prismaMock.balanceAccount,
      balanceSnapshots: prismaMock.balanceSnapshot,
    };

    const result = await importSnapshot(makeSnapshot({}), {
      mode: "overwrite",
      targetAccountId: "acc-1",
      userId: IMPORTER,
    });

    expect(result.accountId).toBe("acc-1");
    expect(prismaMock.$transaction).toHaveBeenCalled();

    // deleteMany chamado uma vez por modelo, na ordem REVERSA da topológica.
    const reverseKeys = [...IMPORT_TOPO_ORDER].reverse();
    const orders = reverseKeys.map((key) => {
      const fn = (deleteDelegate[key] as { deleteMany: { mock: { invocationCallOrder: number[] } } })
        .deleteMany;
      expect(fn.mock.invocationCallOrder.length).toBe(1);
      return fn.mock.invocationCallOrder[0]!;
    });
    for (let i = 1; i < orders.length; i += 1) {
      expect(orders[i]!).toBeGreaterThan(orders[i - 1]!);
    }

    // Restaura nome (overwrite) + AccountSettings, na mesma accountId.
    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: "acc-1" },
      data: { name: "Conta Origem" },
    });
    expect(prismaMock.accountSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc-1" },
        data: expect.objectContaining({ currency: "BRL", monthStartDay: 1 }),
      }),
    );
  });
});
