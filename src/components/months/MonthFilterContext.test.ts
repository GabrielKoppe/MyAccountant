import { describe, expect, it } from "vitest";

import type { TransactionRow } from "@/components/transactions/types";

import {
  EMPTY_FILTERS,
  applyGlobalFilters,
  countActiveFilters,
  hasActiveFilters,
  type MonthFilterState,
} from "./MonthFilterContext";

// Fixture mínima — só os campos relevantes para os predicados de filtro variam por teste;
// o resto recebe valores neutros válidos para o shape de TransactionRow.
function makeRow(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: "tx-1",
    monthId: "month-1",
    occurredOn: "2026-07-01",
    amountCents: "1000",
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
    installmentGroupCount: null,
    originalAmountCents: null,
    originalCurrency: null,
    exchangeRate: null,
    tags: [],
    linkCount: 0,
    createdById: "user-1",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedById: null,
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("applyGlobalFilters — paymentMethods", () => {
  const rows: TransactionRow[] = [
    makeRow({ id: "pix-1", paymentMethod: "pix" }),
    makeRow({ id: "cash-1", paymentMethod: "cash" }),
    makeRow({ id: "credit-1", paymentMethod: "credit_card" }),
    makeRow({ id: "none-1", paymentMethod: null }),
  ];

  it("keeps all rows when paymentMethods filter is empty", () => {
    const filters: MonthFilterState = { ...EMPTY_FILTERS };
    expect(applyGlobalFilters(rows, filters)).toEqual(rows);
  });

  it("keeps only rows whose paymentMethod is in the selected set", () => {
    const filters: MonthFilterState = { ...EMPTY_FILTERS, paymentMethods: ["pix"] };
    const result = applyGlobalFilters(rows, filters);
    expect(result.map((r) => r.id)).toEqual(["pix-1"]);
  });

  it("supports multiple selected payment methods", () => {
    const filters: MonthFilterState = {
      ...EMPTY_FILTERS,
      paymentMethods: ["pix", "cash"],
    };
    const result = applyGlobalFilters(rows, filters);
    expect(result.map((r) => r.id).sort()).toEqual(["cash-1", "pix-1"]);
  });

  it("excludes rows with null paymentMethod when the filter is active", () => {
    const filters: MonthFilterState = { ...EMPTY_FILTERS, paymentMethods: ["pix"] };
    const result = applyGlobalFilters(rows, filters);
    expect(result.some((r) => r.id === "none-1")).toBe(false);
  });
});

describe("hasActiveFilters / countActiveFilters — paymentMethods", () => {
  it("is inactive when paymentMethods is empty", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it("counts as one active filter regardless of how many values are selected", () => {
    const oneSelected: MonthFilterState = { ...EMPTY_FILTERS, paymentMethods: ["pix"] };
    const twoSelected: MonthFilterState = {
      ...EMPTY_FILTERS,
      paymentMethods: ["pix", "cash"],
    };
    expect(hasActiveFilters(oneSelected)).toBe(true);
    expect(countActiveFilters(oneSelected)).toBe(1);
    expect(countActiveFilters(twoSelected)).toBe(1);
  });
});
