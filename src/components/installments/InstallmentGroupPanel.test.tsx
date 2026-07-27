import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import type { ComponentProps } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { m } from "@/lib/messages";
import type { InstallmentGroupPanelData } from "@/server/services/installment-service";

import { InstallmentGroupPanel } from "./InstallmentGroupPanel";

// InstallmentGroupPanel importa Server Actions ("use server") de
// @/actions/installments diretamente, e também renderiza SettleInstallmentDialog
// (que importa mais duas). Mockar todo o módulo isola o teste do server —
// mesmo padrão de TransactionRow.test.tsx.
const getInstallmentGroupPanelDataAction = vi.fn();
const convertPendingInstallmentForExistingMonthAction = vi.fn();
const undoInstallmentGroupAction = vi.fn();
const listTablesForSettlementAction = vi.fn();
const settleInstallmentGroupAction = vi.fn();

vi.mock("@/actions/installments", () => ({
  getInstallmentGroupPanelDataAction: (...args: unknown[]) =>
    getInstallmentGroupPanelDataAction(...args),
  convertPendingInstallmentForExistingMonthAction: (...args: unknown[]) =>
    convertPendingInstallmentForExistingMonthAction(...args),
  undoInstallmentGroupAction: (...args: unknown[]) => undoInstallmentGroupAction(...args),
  listTablesForSettlementAction: (...args: unknown[]) => listTablesForSettlementAction(...args),
  settleInstallmentGroupAction: (...args: unknown[]) => settleInstallmentGroupAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const PANEL_DATA: InstallmentGroupPanelData = {
  id: "grp-1",
  description: "Notebook Dell",
  totalCents: "500000",
  installmentCount: 3,
  items: [
    {
      installmentNumber: 1,
      amountCents: "166667",
      date: "2026-05-15",
      status: "paid",
      transactionId: "tx-1",
      monthYear: 2026,
      monthMonth: 5,
    },
    {
      installmentNumber: 2,
      amountCents: "166667",
      date: "2026-06-15",
      status: "pending",
      transactionId: "tx-2",
      monthYear: 2026,
      monthMonth: 6,
    },
    {
      installmentNumber: 3,
      amountCents: "166666",
      date: "2026-07-15",
      status: "waiting",
      pendingInstallmentId: "pi-3",
    },
  ],
};

function renderPanel(props?: Partial<ComponentProps<typeof InstallmentGroupPanel>>) {
  return render(
    <SnackbarProvider>
      <InstallmentGroupPanel
        open
        onClose={vi.fn()}
        accountId="acc-1"
        monthId="month-1"
        installmentGroupId="grp-1"
        canEdit
        {...props}
      />
    </SnackbarProvider>,
  );
}

describe("InstallmentGroupPanel (frame Spec 66 §10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInstallmentGroupPanelDataAction.mockResolvedValue({ ok: true, data: PANEL_DATA });
    listTablesForSettlementAction.mockResolvedValue({ months: [], sections: [], tables: [] });
  });

  it("cabeçalho: overline 'Parcelamento', descrição em destaque e grid Total/Parcelas/Entrada", async () => {
    renderPanel();
    await screen.findByText("Notebook Dell");

    expect(screen.getByText(m.transactions.installments.panelOverline)).toBeInTheDocument();
    expect(screen.getByText(m.transactions.installments.totalShort)).toBeInTheDocument();
    expect(screen.getByText(m.transactions.installments.installmentsShort)).toBeInTheDocument();
    expect(screen.getByText(m.transactions.installments.downPaymentShort)).toBeInTheDocument();

    // Total: R$ 5.000,00 · Parcelas: 3× R$ 1.666,66 (última parcela) · Entrada: —
    expect(screen.getByText(/5\.000,00/)).toBeInTheDocument();
    expect(
      screen.getByText(m.transactions.installments.perInstallmentValue(3, "R$ 1.666,66")),
    ).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("barra de progresso: legenda 'X de Y lançadas · R$ Z pagos'", async () => {
    renderPanel();
    await screen.findByText("Notebook Dell");
    // launched = 2 (paid + pending); paidSum = só o item "paid" = 166667 centavos = R$ 1.666,67
    expect(
      screen.getByText(m.transactions.installments.launchedProgress(2, 3, "R$ 1.666,67")),
    ).toBeInTheDocument();
  });

  it("lista de parcelas é renderizada via InstallmentSchedule variant=panel (item atual destacado)", async () => {
    renderPanel();
    await screen.findByText("Notebook Dell");
    expect(
      screen.getByText(
        `${m.transactions.installments.itemTitle(2, 3)} · ${m.transactions.installments.itemCurrentSuffix}`,
      ),
    ).toBeInTheDocument();
  });

  it("rodapé: 3 botões (Quitar parcelas, Lançar próxima, Desfazer grupo), nenhum contained", async () => {
    renderPanel();
    await screen.findByText("Notebook Dell");

    const settle = screen.getByRole("button", { name: m.transactions.installments.settleShort });
    const undo = screen.getByRole("button", { name: m.transactions.installments.undoButton });
    const launchNext = screen.getByRole("button", {
      name: m.transactions.installments.launchNextButton,
    });

    for (const btn of [settle, undo, launchNext]) {
      expect(btn.className).toContain("MuiButton-outlined");
      expect(btn.className).not.toContain("MuiButton-contained");
    }
  });

  it("'Desfazer grupo' abre a confirmação existente", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Notebook Dell");

    await user.click(screen.getByRole("button", { name: m.transactions.installments.undoButton }));
    expect(screen.getByText(m.transactions.installments.undoConfirmTitle)).toBeInTheDocument();
  });

  it("'Quitar parcelas' abre o SettleInstallmentDialog existente", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Notebook Dell");

    await user.click(screen.getByRole("button", { name: m.transactions.installments.settleShort }));
    expect(await screen.findByText(m.transactions.installments.settleTitle)).toBeInTheDocument();
  });

  it("sem parcela convertível (existingMonthId): 'Lançar próxima' fica desabilitado", async () => {
    renderPanel();
    await screen.findByText("Notebook Dell");
    const launchNext = screen.getByRole("button", {
      name: m.transactions.installments.launchNextButton,
    });
    expect(launchNext).toBeDisabled();
  });

  it("com parcela convertível: 'Lançar próxima' habilitado converte a parcela via action", async () => {
    const user = userEvent.setup();
    convertPendingInstallmentForExistingMonthAction.mockResolvedValue({ ok: true, data: {} });
    getInstallmentGroupPanelDataAction.mockResolvedValue({
      ok: true,
      data: {
        ...PANEL_DATA,
        items: [
          ...PANEL_DATA.items.slice(0, 2),
          { ...PANEL_DATA.items[2], existingMonthId: "month-existing" },
        ],
      },
    });

    renderPanel();
    await screen.findByText("Notebook Dell");

    const launchNext = screen.getByRole("button", {
      name: m.transactions.installments.launchNextButton,
    });
    expect(launchNext).toBeEnabled();

    await user.click(launchNext);
    expect(convertPendingInstallmentForExistingMonthAction).toHaveBeenCalledWith("acc-1", {
      pendingInstallmentId: "pi-3",
    });
  });

  it("sem parcela waiting: 'Quitar parcelas' fica desabilitado", async () => {
    getInstallmentGroupPanelDataAction.mockResolvedValue({
      ok: true,
      data: { ...PANEL_DATA, items: PANEL_DATA.items.filter((i) => i.status !== "waiting") },
    });
    renderPanel();
    await screen.findByText("Notebook Dell");
    const settle = screen.getByRole("button", { name: m.transactions.installments.settleShort });
    expect(settle).toBeDisabled();
  });
});
