import { describe, it, expect } from "vitest";

import type { PreviewRow } from "./csv-parser";
import { detectInstallments } from "./installment-detector";

function makeRow(
  rowIndex: number,
  description: string,
  amountCents: bigint,
  cardInstallment?: string,
): PreviewRow {
  return {
    rowIndex,
    status: "ok",
    original: {},
    parsed: {
      occurredOn: "2026-01-15",
      amountCents,
      description,
      notes: null,
      categoryName: null,
      subcategoryName: null,
      institutionName: null,
      cardInstallment: cardInstallment ?? null,
      investmentType: null,
      responsibleUserId: null,
      originalAmountCents: null,
      originalCurrency: null,
      exchangeRate: null,
      appliedAliasId: null,
    },
  };
}

// ─── Sinal 1: campo cardInstallment ──────────────────────────────────────────

describe("detectInstallments — Signal 1: cardInstallment field", () => {
  it("groups rows by normalized description + installmentCount", () => {
    const rows: PreviewRow[] = [
      makeRow(0, "MacBook Pro", 100000n, "1/3"),
      makeRow(1, "MacBook Pro", 100000n, "2/3"),
      makeRow(2, "MacBook Pro", 100000n, "3/3"),
    ];
    const suggestions = detectInstallments(rows);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].confidence).toBe("high");
    expect(suggestions[0].installmentCount).toBe(3);
    expect(suggestions[0].lines).toHaveLength(3);
    expect(suggestions[0].lines.map((l) => l.installmentNumber)).toEqual([1, 2, 3]);
    expect(suggestions[0].totalAmountCents).toBe(300000n);
  });

  it("ignores invalid cardInstallment formats", () => {
    const rows: PreviewRow[] = [
      makeRow(0, "Test", 100n, "1/1"), // installmentCount < 2
      makeRow(1, "Test2", 100n, "0/3"), // num < 1
      makeRow(2, "Test3", 100n, "abc"), // not X/Y
    ];
    const suggestions = detectInstallments(rows);
    expect(suggestions).toHaveLength(0);
  });

  it("handles single row with cardInstallment (only 1 row in CSV for a group)", () => {
    const rows: PreviewRow[] = [makeRow(0, "iPhone", 150000n, "2/12")];
    const suggestions = detectInstallments(rows);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].installmentCount).toBe(12);
    expect(suggestions[0].lines[0].installmentNumber).toBe(2);
  });
});

// ─── Sinal 2: regex na descrição ─────────────────────────────────────────────

describe("detectInstallments — Signal 2: regex in description", () => {
  it("detects X/Y at end of description", () => {
    const rows: PreviewRow[] = [
      makeRow(0, "AMAZON 01/12", 5000n),
      makeRow(1, "AMAZON 02/12", 5000n),
    ];
    const suggestions = detectInstallments(rows);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].confidence).toBe("high");
    expect(suggestions[0].installmentCount).toBe(12);
    expect(suggestions[0].lines).toHaveLength(2);
    expect(suggestions[0].groupDescription).not.toContain("01/12");
  });

  it("normalizes description by removing X/Y pattern", () => {
    const rows: PreviewRow[] = [makeRow(0, "MERCADO LIVRE 3/6", 20000n)];
    const suggestions = detectInstallments(rows);
    expect(suggestions[0].groupDescription).toBe("mercado livre");
  });

  it("does not duplicate rows already matched by Signal 1", () => {
    const rows: PreviewRow[] = [
      makeRow(0, "Test 1/3", 100n, "1/3"),
      makeRow(1, "Test 2/3", 100n, "2/3"),
    ];
    const suggestions = detectInstallments(rows);
    // Should only appear once (signal 1 takes priority)
    expect(suggestions).toHaveLength(1);
  });
});

// ─── Sinal 3: repetição de (descrição, amountCents) ──────────────────────────

describe("detectInstallments — Signal 3: repeated (description, amount)", () => {
  it("detects recurring (description + amount) as medium confidence", () => {
    const rows: PreviewRow[] = [
      makeRow(0, "Netflix", 4490n),
      makeRow(1, "Netflix", 4490n),
      makeRow(2, "Netflix", 4490n),
    ];
    const suggestions = detectInstallments(rows);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].confidence).toBe("medium");
    expect(suggestions[0].installmentCount).toBe(3);
  });

  it("ignores single-occurrence rows", () => {
    const rows: PreviewRow[] = [makeRow(0, "Spotify", 1990n), makeRow(1, "Apple", 2990n)];
    const suggestions = detectInstallments(rows);
    expect(suggestions).toHaveLength(0);
  });

  it("does not overlap with high-confidence rows", () => {
    const rows: PreviewRow[] = [
      makeRow(0, "AMAZON 01/12", 5000n),
      makeRow(1, "AMAZON 02/12", 5000n),
      makeRow(2, "Netflix", 4490n),
      makeRow(3, "Netflix", 4490n),
    ];
    const suggestions = detectInstallments(rows);
    // 1 high (AMAZON via signal 2) + 1 medium (Netflix)
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].confidence).toBe("high");
    expect(suggestions[1].confidence).toBe("medium");
  });
});

// ─── Ordenação ────────────────────────────────────────────────────────────────

describe("detectInstallments — sort order", () => {
  it("returns high confidence suggestions before medium", () => {
    const rows: PreviewRow[] = [
      makeRow(0, "Netflix", 4490n),
      makeRow(1, "Netflix", 4490n),
      makeRow(2, "AMAZON 01/12", 5000n),
    ];
    const suggestions = detectInstallments(rows);
    expect(suggestions[0].confidence).toBe("high");
    expect(suggestions[1].confidence).toBe("medium");
  });
});
