import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import { TransactionDetailDialog } from "./TransactionDetailDialog";
import type {
  CategoryOption,
  InstitutionOption,
  MemberOption,
  ResponsiblePartyOption,
  TransactionRow as TxRow,
} from "./types";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const listLinksForTransactionAction = vi.fn();
vi.mock("@/actions/transaction-links", () => ({
  listLinksForTransactionAction: (...args: unknown[]) => listLinksForTransactionAction(...args),
}));

const getInstallmentGroupPanelDataAction = vi.fn();
vi.mock("@/actions/installments", () => ({
  getInstallmentGroupPanelDataAction: (...args: unknown[]) =>
    getInstallmentGroupPanelDataAction(...args),
}));

function baseTx(overrides: Partial<TxRow> = {}): TxRow {
  return {
    id: "tx-1",
    monthId: "month-1",
    occurredOn: "2026-07-10",
    amountCents: "5000",
    description: "Mercado",
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
    createdAt: "2026-07-10T12:00:00.000Z",
    updatedById: null,
    updatedAt: "2026-07-10T12:00:00.000Z",
    ...overrides,
  };
}

const categories: CategoryOption[] = [];
const institutions: InstitutionOption[] = [];
const members: MemberOption[] = [{ id: "user-1", name: "Ana", email: "ana@x.com", image: null }];
const parties: ResponsiblePartyOption[] = [];

function renderDialog(props: Partial<Parameters<typeof TransactionDetailDialog>[0]> = {}) {
  const onClose = vi.fn();
  const onEdit = vi.fn();
  const utils = render(
    <TransactionDetailDialog
      open
      onClose={onClose}
      tx={baseTx()}
      accountId="acc-1"
      sectionCountType="subtract"
      categories={categories}
      institutions={institutions}
      members={members}
      parties={parties}
      timezone="America/Sao_Paulo"
      canEdit={false}
      onEdit={onEdit}
      {...props}
    />,
  );
  return { ...utils, onClose, onEdit };
}

describe("TransactionDetailDialog", () => {
  beforeEach(() => {
    pushMock.mockReset();
    listLinksForTransactionAction.mockReset();
    listLinksForTransactionAction.mockResolvedValue({ ok: true, data: [] });
    getInstallmentGroupPanelDataAction.mockReset();
    getInstallmentGroupPanelDataAction.mockResolvedValue({ ok: true, data: null });
  });

  it("renderiza as 4 abas somente leitura e permite navegar entre elas", async () => {
    renderDialog();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs.map((t) => t.textContent)).toEqual([
      m.transactions.detail.tabs.summary,
      m.transactions.detail.tabs.classification,
      m.transactions.detail.tabs.installmentsLinks,
      m.transactions.detail.tabs.history,
    ]);

    await userEvent.click(screen.getByRole("tab", { name: m.transactions.detail.tabs.history }));
    expect(screen.getByText(m.transactions.fields.source)).toBeInTheDocument();
  });

  it("cabeçalho usa MoneyValue como apex e StatusBadge (nunca Chip) para status", () => {
    renderDialog({ tx: baseTx({ isPending: true, isFavorite: true }) });

    expect(screen.getByText(m.transactions.fields.isPending)).toBeInTheDocument();
    expect(screen.getByText(m.transactions.fields.isFavorite)).toBeInTheDocument();
    // Regra do design system: status nunca via <Chip> — só <StatusBadge>.
    expect(document.querySelector(".MuiChip-root")).not.toBeInTheDocument();
  });

  it("oculta 'Editar' quando canEdit=false e exibe quando true", () => {
    const { rerender } = renderDialog({ canEdit: false });
    expect(
      screen.queryByRole("button", { name: m.transactions.actions.edit }),
    ).not.toBeInTheDocument();

    rerender(
      <TransactionDetailDialog
        open
        onClose={vi.fn()}
        tx={baseTx()}
        accountId="acc-1"
        sectionCountType="subtract"
        categories={categories}
        institutions={institutions}
        members={members}
        parties={parties}
        timezone="America/Sao_Paulo"
        canEdit
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: m.transactions.actions.edit })).toBeInTheDocument();
  });

  it("mostra EmptyState nas abas sem dado (sem grupo/vínculos/tags)", async () => {
    renderDialog();

    // Resumo (aba inicial): sem categoria/instituição/responsável/moeda/nota
    expect(screen.getByText(m.transactions.detail.emptySummary)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("tab", { name: m.transactions.detail.tabs.classification }),
    );
    expect(screen.getByText(m.transactions.detail.emptyClassification)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("tab", { name: m.transactions.detail.tabs.installmentsLinks }),
    );
    expect(
      await screen.findByText(m.transactions.detail.emptyInstallmentsLinks),
    ).toBeInTheDocument();
  });

  it("campo ausente nunca some quando a aba tem algum dado — mostra '—' (Spec 66 §9, defeito #7)", () => {
    const categories: CategoryOption[] = [{ id: "cat-1", name: "Alimentação", subcategories: [] }];
    renderDialog({ categories, tx: baseTx({ categoryId: "cat-1" }) });

    // Categoria presente...
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    // ...mas Instituição/Responsável/Moeda/Nota ausentes mostram "—" em vez de sumir.
    expect(screen.getAllByText(m.transactions.detail.emptyValue).length).toBeGreaterThan(0);
    expect(screen.queryByText(m.transactions.detail.emptySummary)).not.toBeInTheDocument();
  });

  it("usa o rótulo abreviado 'Forma pagto' na aba Classificação (defeito #9)", async () => {
    renderDialog({ tx: baseTx({ paymentMethod: "pix" }) });

    await userEvent.click(
      screen.getByRole("tab", { name: m.transactions.detail.tabs.classification }),
    );

    expect(screen.getByText(m.transactions.detail.paymentMethodShort)).toBeInTheDocument();
    expect(screen.queryByText(m.transactions.fields.paymentMethod)).not.toBeInTheDocument();
  });

  it("aba Histórico sempre mostra 'Editada por', com '—' quando nunca foi editada (defeito #11)", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("tab", { name: m.transactions.detail.tabs.history }));

    expect(screen.getByText(m.transactions.detail.createdBy)).toBeInTheDocument();
    expect(screen.getByText(m.transactions.detail.updatedBy)).toBeInTheDocument();
    expect(screen.getByText(m.transactions.detail.emptyValue)).toBeInTheDocument();
  });

  it("lista vínculos na aba 'Parcelas e vínculos' e 'abrir' navega + fecha o modal mesmo como viewer", async () => {
    listLinksForTransactionAction.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "link-1",
          type: "relates_to",
          notes: null,
          direction: "outgoing",
          linkedTransaction: {
            id: "tx-2",
            description: "Reembolso",
            amountCents: "1000",
            occurredOn: "2026-07-11",
            monthId: "month-2",
            sectionId: "section-2",
          },
        },
      ],
    });

    const { onClose } = renderDialog({ canEdit: false });

    await userEvent.click(
      screen.getByRole("tab", { name: m.transactions.detail.tabs.installmentsLinks }),
    );

    const openButton = await screen.findByRole("button", {
      name: m.transactions.detail.openLinked,
    });
    await userEvent.click(openButton);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/acc-1/months/month-2?tab=section-2");
  });
});
