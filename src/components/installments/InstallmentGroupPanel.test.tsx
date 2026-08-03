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
const setPendingInstallmentSettledAction = vi.fn();
const setInstallmentGroupAutoCreateAction = vi.fn();

vi.mock("@/actions/installments", () => ({
  getInstallmentGroupPanelDataAction: (...args: unknown[]) =>
    getInstallmentGroupPanelDataAction(...args),
  convertPendingInstallmentForExistingMonthAction: (...args: unknown[]) =>
    convertPendingInstallmentForExistingMonthAction(...args),
  undoInstallmentGroupAction: (...args: unknown[]) => undoInstallmentGroupAction(...args),
  listTablesForSettlementAction: (...args: unknown[]) => listTablesForSettlementAction(...args),
  settleInstallmentGroupAction: (...args: unknown[]) => settleInstallmentGroupAction(...args),
  setPendingInstallmentSettledAction: (...args: unknown[]) =>
    setPendingInstallmentSettledAction(...args),
  setInstallmentGroupAutoCreateAction: (...args: unknown[]) =>
    setInstallmentGroupAutoCreateAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const PANEL_DATA: InstallmentGroupPanelData = {
  id: "grp-1",
  description: "Notebook Dell",
  totalCents: "500000",
  installmentCount: 3,
  autoCreateOnNewMonth: true,
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
      monthYear: 2026,
      monthMonth: 7,
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

  it("rodapé: 3 ações acessíveis; as textuais são outlined, nenhuma contained", async () => {
    renderPanel();
    await screen.findByText("Notebook Dell");

    const settle = screen.getByRole("button", { name: m.transactions.installments.settleShort });
    const launchNext = screen.getByRole("button", {
      name: m.transactions.installments.launchNextButton,
    });
    // "Desfazer grupo" virou IconButton com aria-label (spec 73 §2.6) — continua
    // acessível pelo mesmo nome.
    const undo = screen.getByRole("button", { name: m.transactions.installments.undoButton });

    for (const btn of [settle, launchNext]) {
      expect(btn.className).toContain("MuiButton-outlined");
      expect(btn.className).not.toContain("MuiButton-contained");
    }
    expect(undo.className).toContain("MuiIconButton-root");
    expect(undo).toHaveAttribute("aria-label", m.transactions.installments.undoButton);
  });

  it("'Lançar próxima' não quebra o rótulo em duas linhas (nowrap, spec 73 §2.6)", async () => {
    renderPanel();
    await screen.findByText("Notebook Dell");
    const launchNext = screen.getByRole("button", {
      name: m.transactions.installments.launchNextButton,
    });
    expect(getComputedStyle(launchNext).whiteSpace).toBe("nowrap");
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

describe("InstallmentGroupPanel — spec 73", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInstallmentGroupPanelDataAction.mockResolvedValue({ ok: true, data: PANEL_DATA });
    listTablesForSettlementAction.mockResolvedValue({ months: [], sections: [], tables: [] });
  });

  it("marcar parcela prevista como paga chama a action com settled=true", async () => {
    const user = userEvent.setup();
    setPendingInstallmentSettledAction.mockResolvedValue({ ok: true, data: { settled: true } });
    renderPanel();
    await screen.findByText("Notebook Dell");

    await user.click(screen.getByRole("button", { name: m.transactions.installments.markSettled }));
    expect(setPendingInstallmentSettledAction).toHaveBeenCalledWith("acc-1", {
      pendingInstallmentId: "pi-3",
      settled: true,
    });
  });

  it("parcela settled_external conta no progresso e no somatório de pagos", async () => {
    getInstallmentGroupPanelDataAction.mockResolvedValue({
      ok: true,
      data: {
        ...PANEL_DATA,
        items: [
          PANEL_DATA.items[0],
          PANEL_DATA.items[1],
          { ...PANEL_DATA.items[2], status: "settled_external" as const },
        ],
      },
    });
    renderPanel();
    await screen.findByText("Notebook Dell");
    // 3 de 3 lançadas; pagos = paid (1.666,67) + settled_external (1.666,66)
    expect(
      screen.getByText(m.transactions.installments.launchedProgress(3, 3, "R$ 3.333,33")),
    ).toBeInTheDocument();
  });

  it("toggle de criação automática persiste via action", async () => {
    const user = userEvent.setup();
    setInstallmentGroupAutoCreateAction.mockResolvedValue({
      ok: true,
      data: { autoCreateOnNewMonth: false },
    });
    renderPanel();
    await screen.findByText("Notebook Dell");

    const toggle = screen.getByRole("checkbox", {
      name: m.transactions.installments.autoCreateLabel,
    });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(setInstallmentGroupAutoCreateAction).toHaveBeenCalledWith("acc-1", {
      installmentGroupId: "grp-1",
      autoCreateOnNewMonth: false,
    });
  });

  it("canEdit=false: não mostra o toggle de criação automática", async () => {
    renderPanel({ canEdit: false });
    await screen.findByText("Notebook Dell");
    expect(
      screen.queryByRole("checkbox", { name: m.transactions.installments.autoCreateLabel }),
    ).not.toBeInTheDocument();
  });
});
