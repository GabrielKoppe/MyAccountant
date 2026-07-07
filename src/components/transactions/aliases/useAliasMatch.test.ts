import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

import { useAliasMatch } from "./useAliasMatch";

function alias(overrides: Partial<SerializedTransactionAlias> = {}): SerializedTransactionAlias {
  return {
    id: "alias-1",
    trigger: "CEG",
    triggerNormalized: "ceg",
    updatedAt: "2026-01-01T00:00:00.000Z",
    description: null,
    notes: null,
    amountCents: null,
    categoryId: null,
    categoryName: null,
    subcategoryId: null,
    subcategoryName: null,
    institutionId: null,
    institutionName: null,
    institutionText: null,
    responsiblePartyId: null,
    responsiblePartyName: null,
    expenseType: null,
    paymentMethod: null,
    investmentType: null,
    cardInstallment: null,
    isPending: null,
    isFavorite: null,
    originalCurrency: null,
    originalAmountCents: null,
    exchangeRate: null,
    isArchived: false,
    createdById: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    tags: [],
    ...overrides,
  };
}

describe("useAliasMatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enabled=false nunca retorna match, mesmo após o debounce", () => {
    const { result } = renderHook(() => useAliasMatch("pagamento CEG", [alias()], false));
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBeNull();
  });

  it("enabled=true só retorna match após o debounce (280ms) de uma mudança de descrição", () => {
    const { result, rerender } = renderHook(
      ({ description }) => useAliasMatch(description, [alias()], true),
      { initialProps: { description: "" } },
    );
    expect(result.current).toBeNull();

    rerender({ description: "pagamento CEG" });
    expect(result.current).toBeNull(); // ainda não debounced

    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBeNull(); // ainda dentro da janela

    act(() => vi.advanceTimersByTime(100));
    expect(result.current?.id).toBe("alias-1");
  });

  it("reinicia o debounce a cada mudança de descrição (sem match parcial)", () => {
    const { result, rerender } = renderHook(
      ({ description }) => useAliasMatch(description, [alias()], true),
      { initialProps: { description: "pagamento C" } },
    );

    act(() => vi.advanceTimersByTime(200));
    rerender({ description: "pagamento CEG" });
    act(() => vi.advanceTimersByTime(200)); // 200ms desde a última tecla — não fechou ainda
    expect(result.current).toBeNull();

    act(() => vi.advanceTimersByTime(100));
    expect(result.current?.id).toBe("alias-1");
  });

  it("recomputa quando a lista de aliases muda", () => {
    const cegAlias = alias({ id: "ceg", trigger: "CEG", triggerNormalized: "ceg" });
    const { result, rerender } = renderHook(
      ({ aliases }) => useAliasMatch("pagamento CEG", aliases, true),
      { initialProps: { aliases: [cegAlias] } },
    );
    act(() => vi.advanceTimersByTime(280));
    expect(result.current?.id).toBe("ceg");

    rerender({ aliases: [] });
    expect(result.current).toBeNull();
  });
});
