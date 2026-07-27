import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { RichRow, type RichRowProps } from "./RichRow";
import type { TransactionRow as TxRow } from "./types";

function makeTx(overrides: Partial<TxRow> = {}): TxRow {
  return {
    id: "tx-1",
    monthId: "month-1",
    occurredOn: "2099-11-10",
    amountCents: "10000",
    description: "Mercado",
    notes: null,
    isPending: false,
    isFavorite: false,
    categoryId: "cat-1",
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
    createdAt: "2099-11-10T00:00:00.000Z",
    updatedById: null,
    updatedAt: "2099-11-10T00:00:00.000Z",
    ...overrides,
  };
}

function makeProps(overrides: Partial<RichRowProps> = {}): RichRowProps {
  return {
    tx: makeTx(),
    isSelected: false,
    isReadOnly: false,
    sectionCountType: "subtract",
    hiddenColumns: {},
    categories: [{ id: "cat-1", name: "Alimentação", subcategories: [] }],
    institutions: [],
    parties: [],
    localTags: [],
    hasSuggestion: false,
    installmentBadgeRef: createRef<HTMLDivElement>(),
    onSelect: vi.fn(),
    onStartEdit: vi.fn(),
    onOpenSuggestion: vi.fn(),
    onOpenTags: vi.fn(),
    onOpenInstallmentPanel: vi.fn(),
    onTogglePending: vi.fn(),
    onToggleFavorite: vi.fn(),
    onViewDetails: vi.fn(),
    onDuplicate: vi.fn(),
    onMove: vi.fn(),
    onCreateAlias: vi.fn(),
    onDelete: vi.fn(),
    onToggleDrawer: vi.fn(),
    drawerOpen: false,
    onOpenMenu: vi.fn(),
    ...overrides,
  };
}

function renderInTable(props: RichRowProps) {
  return render(
    <table>
      <tbody>
        <RichRow {...props} />
      </tbody>
    </table>,
  );
}

describe("RichRow", () => {
  it("renderiza a pílula de categoria quando o campo é visível", () => {
    renderInTable(makeProps());
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
  });

  it("omite a pílula de categoria quando hiddenColumns.category está ativo", () => {
    renderInTable(makeProps({ hiddenColumns: { category: true } }));
    expect(screen.queryByText("Alimentação")).not.toBeInTheDocument();
  });

  it("renderiza o valor via MoneyValue (mono)", () => {
    const { container } = renderInTable(makeProps());
    expect(container.textContent).toMatch(/100,00/);
    // MoneyValue usa JetBrains Mono — o span carrega a família mono no style inline.
    const mono = Array.from(container.querySelectorAll("span")).find((el) =>
      /100,00/.test(el.textContent ?? ""),
    );
    expect(mono).toBeTruthy();
  });

  it("exibe pendente via chip discreto minúsculo sem ícone (nunca StatusBadge) e favorita via ícone ★ inline", () => {
    renderInTable(makeProps({ tx: makeTx({ isPending: true, isFavorite: true }) }));
    const pending = screen.getByText("pendente");
    expect(pending).toBeInTheDocument();
    // Pendente é um MuiChip discreto (Spec 66 · Fidelidade item 6), sem ícone.
    const pendingChip = pending.closest(".MuiChip-root");
    expect(pendingChip).not.toBeNull();
    expect(pendingChip?.querySelector("svg")).toBeNull();

    // Favorita = ★ inline antes do título (StarIcon), não mais um StatusBadge com texto.
    // Há também um StarIcon no botão de ação (toggle favorito) — filtra pelo que
    // não está dentro de um <button>, que é o ícone inline da descrição.
    const inlineFavoriteIcon = screen
      .getAllByTestId("StarIcon")
      .find((icon) => !icon.closest("button"));
    expect(inlineFavoriteIcon).toBeTruthy();
    expect(screen.queryByText("Favorito")).not.toBeInTheDocument();
  });

  it("não renderiza indicador more_horiz de campos ocultos (TX-04c)", () => {
    const { container } = renderInTable(makeProps({ hiddenColumns: { category: true } }));
    expect(container.querySelector('[data-testid="MoreHorizIcon"]')).toBeNull();
  });
});
