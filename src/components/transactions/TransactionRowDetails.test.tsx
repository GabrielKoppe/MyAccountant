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
  it("seção de câmbio: mostra moeda, valor original e taxa em campos distintos (frame 66 §7.2)", () => {
    renderDetails({ originalCurrency: "USD", originalAmountCents: "899", exchangeRate: 5.11 });
    expect(screen.getByText("USD")).toBeInTheDocument();
    expect(screen.getByText("8.99")).toBeInTheDocument();
    expect(screen.getByText("R$5.11")).toBeInTheDocument();
  });

  const ALL_SECTIONS_TX: Partial<TxRow> = {
    notes: "Nota de teste",
    originalCurrency: "USD",
    originalAmountCents: "899",
    exchangeRate: 5.11,
    linkCount: 1,
    tags: [{ id: "1", name: "lazer", color: null }],
    installmentGroupId: "g1",
    installmentNumber: 3,
    installmentGroupCount: 12,
  };

  it("com todos os dados preenchidos: seções aparecem na ordem canônica (notas, câmbio, vínculos, tags, parcela)", () => {
    const { container } = render(
      <TransactionRowDetails
        tx={{ ...TX, ...ALL_SECTIONS_TX }}
        isReadOnly={false}
        onManageLinks={vi.fn()}
        onViewInstallmentGroup={vi.fn()}
      />,
    );

    const labels = ["Notas", "Moeda estrangeira", "Vínculos", "Tags", "Parcela"];
    const positions = labels.map((label) => container.innerHTML.indexOf(`>${label}<`));

    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("com todos os dados preenchidos: cabeçalhos das seções não repetem o ícone da seção (frame 66 §7)", () => {
    render(
      <TransactionRowDetails
        tx={{ ...TX, ...ALL_SECTIONS_TX }}
        isReadOnly={false}
        onManageLinks={vi.fn()}
        onViewInstallmentGroup={vi.fn()}
      />,
    );

    // O ícone de cada seção já vive no toggle da barra de ferramentas
    // (RowDrawerToolbar) — o cabeçalho da gaveta é só o rótulo `.cap`.
    expect(screen.queryByTestId("NoteIcon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("CurrencyExchangeIcon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("LinkIcon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("LabelIcon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("PaymentsIcon")).not.toBeInTheDocument();
  });
});
