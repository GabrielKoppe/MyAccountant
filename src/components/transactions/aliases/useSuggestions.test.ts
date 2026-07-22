import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

import { useSuggestions } from "./useSuggestions";

function alias(overrides: Partial<SerializedTransactionAlias> = {}): SerializedTransactionAlias {
  return {
    id: "alias-1",
    trigger: "CEG",
    triggerNormalized: "ceg",
    triggerMode: "contains",
    priority: "medium",
    conditionInstitutionId: null,
    conditionInstitutionName: null,
    minCents: null,
    maxCents: null,
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

describe("useSuggestions — apelido", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enabled=false nunca retorna match, mesmo após o debounce", () => {
    const { result } = renderHook(() =>
      useSuggestions("pagamento CEG", null, null, [alias()], false),
    );
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBeNull();
  });

  it("enabled=true só retorna match após o debounce (280ms) de uma mudança de descrição", () => {
    const { result, rerender } = renderHook(
      ({ description }) => useSuggestions(description, null, null, [alias()], true),
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
      ({ description }) => useSuggestions(description, null, null, [alias()], true),
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
      ({ aliases }) => useSuggestions("pagamento CEG", null, null, aliases, true),
      { initialProps: { aliases: [cegAlias] } },
    );
    act(() => vi.advanceTimersByTime(280));
    expect(result.current?.id).toBe("ceg");

    rerender({ aliases: [] });
    expect(result.current).toBeNull();
  });

  it("observa amountCents na condição de faixa do apelido (min/max) sem novo debounce", () => {
    const rangeAlias = alias({ id: "range", minCents: "10000", maxCents: "50000" });
    const { result, rerender } = renderHook(
      ({ amountCents }) => useSuggestions("pagamento CEG", amountCents, null, [rangeAlias], true),
      { initialProps: { amountCents: 5000n as bigint } },
    );
    act(() => vi.advanceTimersByTime(280));
    expect(result.current).toBeNull(); // fora da faixa

    rerender({ amountCents: 20000n });
    expect(result.current?.id).toBe("range"); // dentro da faixa, sem novo debounce
  });

  it("observa a condição de instituição do apelido (AND com o gatilho)", () => {
    const instAlias = alias({ id: "inst", conditionInstitutionId: "inst-1" });
    const { result, rerender } = renderHook(
      ({ institutionId }) =>
        useSuggestions("pagamento CEG", null, institutionId, [instAlias], true),
      { initialProps: { institutionId: null as string | null } },
    );
    act(() => vi.advanceTimersByTime(280));
    expect(result.current).toBeNull(); // instituição não bate

    rerender({ institutionId: "inst-1" });
    expect(result.current?.id).toBe("inst");
  });
});
