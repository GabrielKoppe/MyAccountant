import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TransactionRowDetails } from "./TransactionRowDetails";
import type { TransactionRow as TxRow } from "./types";

const TX: TxRow = {
  id: "tx-1", monthId: "m-1", occurredOn: "2026-06-15", amountCents: "4590",
  description: "Netflix", notes: null, isPending: false, isFavorite: false,
  categoryId: null, subcategoryId: null, institutionId: null, institutionText: null,
  responsiblePartyId: null, cardInstallment: null, investmentType: null, expenseType: null,
  paymentMethod: null, source: "manual", installmentGroupId: null, installmentNumber: null,
  installmentGroupCount: null, originalAmountCents: null, originalCurrency: null, exchangeRate: null,
  tags: [], linkCount: 0, createdById: "u-1", createdAt: "2026-06-15T00:00:00.000Z",
  updatedById: null, updatedAt: "2026-06-15T00:00:00.000Z",
};

function renderDetails(tx: Partial<TxRow> = {}, isReadOnly = false) {
  const onManageLinks = vi.fn();
  const onViewInstallmentGroup = vi.fn();
  render(
    <TransactionRowDetails
      tx={{ ...TX, ...tx }}
      isReadOnly={isReadOnly}
      onManageLinks={onManageLinks}
      onViewInstallmentGroup={onViewInstallmentGroup}
    />,
  );
  return { onManageLinks, onViewInstallmentGroup };
}

describe("TransactionRowDetails", () => {
  it("mostra só a seção de nota quando só há nota", () => {
    renderDetails({ notes: "Renovação anual" });
    expect(screen.getByText("Renovação anual")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vincular transação" })).not.toBeInTheDocument();
  });
  it("seção de vínculos: [gerenciar] dispara onManageLinks", async () => {
    const { onManageLinks } = renderDetails({ linkCount: 2 });
    await userEvent.click(screen.getByRole("button", { name: "Vincular transação" }));
    expect(onManageLinks).toHaveBeenCalledTimes(1);
  });
  it("seção de parcela: [ver grupo] dispara onViewInstallmentGroup", async () => {
    const { onViewInstallmentGroup } = renderDetails({
      installmentGroupId: "g1", installmentNumber: 3, installmentGroupCount: 12,
    });
    await userEvent.click(screen.getByRole("button", { name: "Ver grupo" }));
    expect(onViewInstallmentGroup).toHaveBeenCalledTimes(1);
  });
  it("viewer: seção de vínculos não oferece [gerenciar]", () => {
    renderDetails({ linkCount: 1 }, true);
    expect(screen.getByText("1 vínculo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vincular transação" })).not.toBeInTheDocument();
  });
  it("tags: renderiza chips das tags", () => {
    renderDetails({ tags: [{ id: "1", name: "lazer", color: null }] });
    expect(screen.getByText("lazer")).toBeInTheDocument();
  });
  it("seção de câmbio: mostra moeda, valor estrangeiro e taxa centralizada", () => {
    renderDetails({ originalCurrency: "USD", originalAmountCents: "899", exchangeRate: 5.11 });
    expect(screen.getByText(/USD.*8\.99/)).toBeInTheDocument();
    expect(screen.getByText(/câmbio R\$5\.11/)).toBeInTheDocument();
  });
});
