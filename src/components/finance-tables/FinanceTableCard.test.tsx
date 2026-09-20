import { render, screen } from "@testing-library/react";
import { SnackbarProvider } from "notistack";
import { describe, expect, it, vi } from "vitest";

import { FinanceTableCard } from "./FinanceTableCard";

// A carga do card é toda de subsistemas que não têm nada a ver com o que se
// prova aqui (o total do cabeçalho). Cada mock abaixo existe para o módulo real
// — que resolve Server Actions ou o router — não ser carregado no teste.
vi.mock("@/actions/finance-tables", () => ({
  deleteFinanceTableAction: vi.fn(),
  updateFinanceTableAction: vi.fn(),
}));
vi.mock("@/actions/table-templates", () => ({ createFromTableAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/transactions/TransactionTable", () => ({
  TransactionTable: () => <div data-testid="transaction-table" />,
}));
vi.mock("@/components/installments/CreateInstallmentDialog", () => ({
  CreateInstallmentDialog: () => null,
}));
vi.mock("@/components/months/MonthFilterContext", () => ({
  useMonthFilters: () => ({ filters: {}, isActive: false }),
  applyGlobalFilters: (rows: unknown[]) => rows,
}));

function buildTable(overrides: Record<string, unknown> = {}) {
  return {
    id: "table-1",
    name: "Cartão Nubank",
    tableTypeId: "type-1",
    tableTypeName: "Cartão de crédito",
    countInMonth: true,
    groupByDate: false,
    total: "-12345",
    transactionCount: 3,
    hiddenColumns: {},
    rowLayout: "columns" as const,
    density: "default" as const,
    showFooterTotal: true,
    inheritOnNewRow: ["occurredOn" as const],
    ...overrides,
  };
}

function renderCard(tableOverrides: Record<string, unknown> = {}) {
  return render(
    <SnackbarProvider>
      <FinanceTableCard
        table={buildTable(tableOverrides) as never}
        accountId="acc-1"
        monthId="month-1"
        currentUserId="user-1"
        canEdit
        timezone="America/Sao_Paulo"
        sectionIsActive
        sectionCountType="subtract"
        tableTypes={[]}
        transactions={[]}
        categories={[]}
        institutions={[]}
        members={[]}
        parties={[]}
        aliases={[]}
        defaultResponsiblePartyId={null}
        onDuplicate={vi.fn()}
      />
    </SnackbarProvider>,
  );
}

// R$ 123,45 — o `MoneyValue` formata com espaço não-quebrável entre "R$" e o número.
const TOTAL_TEXT = /123,45/;

describe("FinanceTableCard — `showFooterTotal` do tipo de tabela (Spec 69 §2.1)", () => {
  it("com o toggle ligado, o total da tabela aparece no cabeçalho", () => {
    renderCard();

    expect(screen.getByText(TOTAL_TEXT)).toBeInTheDocument();
  });

  it("com o toggle desligado, o total some — e só ele", () => {
    renderCard({ showFooterTotal: false });

    expect(screen.queryByText(TOTAL_TEXT)).not.toBeInTheDocument();
    // O resto do cabeçalho continua de pé: o card não vira uma casca.
    expect(screen.getByText("Cartão Nubank")).toBeInTheDocument();
    expect(screen.getByText("Cartão de crédito")).toBeInTheDocument();
  });

  it("tabela sem tipo mantém o total — o comportamento de hoje é o piso", () => {
    // A query do mês entrega `showFooterTotal: true` quando `tableTypeId` é null;
    // este teste fixa a promessa do lado do componente.
    renderCard({ tableTypeId: null, tableTypeName: null });

    expect(screen.getByText(TOTAL_TEXT)).toBeInTheDocument();
  });
});
