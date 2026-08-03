import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";
import type { InstallmentPanelItem } from "@/server/services/installment-service";

import { InstallmentSchedule } from "./InstallmentSchedule";

const PAID_ITEM: InstallmentPanelItem = {
  installmentNumber: 1,
  amountCents: "10000",
  date: "2026-01-15",
  status: "paid",
  monthYear: 2026,
  monthMonth: 1,
};

const PENDING_ITEM: InstallmentPanelItem = {
  installmentNumber: 2,
  amountCents: "10000",
  date: "2026-02-15",
  status: "pending",
  monthYear: 2026,
  monthMonth: 2,
};

const WAITING_CONVERTIBLE_ITEM: InstallmentPanelItem = {
  installmentNumber: 3,
  amountCents: "5000",
  date: "2026-03-15",
  status: "waiting",
  monthYear: 2026,
  monthMonth: 3,
  existingMonthId: "month-3",
  pendingInstallmentId: "pi-3",
};

const WAITING_PLAIN_ITEM: InstallmentPanelItem = {
  installmentNumber: 3,
  amountCents: "5000",
  date: "2026-07-15",
  status: "waiting",
  monthYear: 2026,
  monthMonth: 7,
};

// Parcela de fatura: occurredOn é a data da COMPRA (março), mas a parcela é
// contabilizada na competência de junho (spec 73 §2.2).
const INVOICE_LAST_INSTALLMENT: InstallmentPanelItem = {
  installmentNumber: 4,
  amountCents: "22983",
  date: "2026-03-06",
  status: "paid",
  monthYear: 2026,
  monthMonth: 6,
};

const SETTLED_EXTERNAL_ITEM: InstallmentPanelItem = {
  installmentNumber: 2,
  amountCents: "22983",
  date: "2026-04-06",
  status: "settled_external",
  monthYear: 2026,
  monthMonth: 4,
  pendingInstallmentId: "pi-2",
};

describe("InstallmentSchedule", () => {
  it("mostra ícone de status (check para paga, radio preenchido para pendente) e o valor de cada parcela", () => {
    render(<InstallmentSchedule items={[PAID_ITEM, PENDING_ITEM]} installmentCount={3} />);
    expect(screen.getByTestId("CheckCircleIcon")).toBeInTheDocument();
    expect(screen.getByTestId("RadioButtonCheckedIcon")).toBeInTheDocument();
    // Ambos itens têm amountCents "10000" → duas ocorrências do valor formatado
    expect(screen.getAllByText(/100,00/)).toHaveLength(2);
  });

  it("waiting + existingMonthId + canEdit: mostra 'Criar neste mês' e dispara onConvert com pendingInstallmentId", async () => {
    const onConvert = vi.fn();
    render(
      <InstallmentSchedule
        items={[WAITING_CONVERTIBLE_ITEM]}
        installmentCount={3}
        canEdit
        onConvert={onConvert}
      />,
    );
    const trigger = screen.getByText("Criar neste mês");
    expect(trigger).toBeInTheDocument();
    await userEvent.click(trigger);
    expect(onConvert).toHaveBeenCalledTimes(1);
    expect(onConvert).toHaveBeenCalledWith("pi-3");
  });

  it("waiting + canEdit=false (sem onConvert): não mostra 'Criar neste mês', mostra ícone de aguardando e rótulo 'prevista'", () => {
    render(<InstallmentSchedule items={[WAITING_PLAIN_ITEM]} installmentCount={3} />);
    expect(screen.queryByText("Criar neste mês")).not.toBeInTheDocument();
    expect(screen.getByTestId("RadioButtonUncheckedIcon")).toBeInTheDocument();
    expect(screen.getByText(m.transactions.installments.statusForecast)).toBeInTheDocument();
  });

  it("waiting + existingMonthId mas canEdit=false: não mostra 'Criar neste mês', mostra 'prevista'", () => {
    render(<InstallmentSchedule items={[WAITING_CONVERTIBLE_ITEM]} installmentCount={3} />);
    expect(screen.queryByText("Criar neste mês")).not.toBeInTheDocument();
    expect(screen.getByText(m.transactions.installments.statusForecast)).toBeInTheDocument();
  });

  it("renderiza valor via MoneyValue e rótulo número/total da parcela", () => {
    const item: InstallmentPanelItem = {
      installmentNumber: 2,
      amountCents: "12345",
      date: "2026-04-15",
      status: "pending",
      monthYear: 2026,
      monthMonth: 4,
    };
    render(<InstallmentSchedule items={[item]} installmentCount={5} />);
    expect(screen.getByText("2/5")).toBeInTheDocument();
    expect(screen.getByText(/123,45/)).toBeInTheDocument();
  });

  it("rotula o mês pela competência (monthMonth), não pela data da compra (spec 73 §2.2)", () => {
    render(<InstallmentSchedule items={[INVOICE_LAST_INSTALLMENT]} installmentCount={4} />);
    expect(screen.getByText(/junho/i)).toBeInTheDocument();
    expect(screen.queryByText(/março/i)).not.toBeInTheDocument();
  });
});

describe("InstallmentSchedule — variant=panel (frame Spec 66 §10)", () => {
  it("paga: ícone check_circle, título sem sufixo, valor mono e ícone open_in_new (lançada)", () => {
    render(<InstallmentSchedule items={[PAID_ITEM]} installmentCount={3} variant="panel" />);
    expect(screen.getByTestId("CheckCircleIcon")).toBeInTheDocument();
    expect(screen.getByText(m.transactions.installments.itemTitle(1, 3))).toBeInTheDocument();
    expect(screen.getByText(/100,00/)).toBeInTheDocument();
    expect(screen.getByTestId("OpenInNewIcon")).toBeInTheDocument();
  });

  it("pendente (atual): ícone radio_button_checked, sufixo 'atual' no título", () => {
    render(<InstallmentSchedule items={[PENDING_ITEM]} installmentCount={3} variant="panel" />);
    expect(screen.getByTestId("RadioButtonCheckedIcon")).toBeInTheDocument();
    expect(
      screen.getByText(
        `${m.transactions.installments.itemTitle(2, 3)} · ${m.transactions.installments.itemCurrentSuffix}`,
      ),
    ).toBeInTheDocument();
    // Lançada (transactionId virtual via status pending) também mostra open_in_new
    expect(screen.getByTestId("OpenInNewIcon")).toBeInTheDocument();
  });

  it("aguardando (prevista): ícone schedule, sufixo 'prevista', mostra valor mono (não texto 'prevista') e sem open_in_new", () => {
    render(
      <InstallmentSchedule items={[WAITING_PLAIN_ITEM]} installmentCount={3} variant="panel" />,
    );
    expect(screen.getByTestId("ScheduleIcon")).toBeInTheDocument();
    expect(
      screen.getByText(
        `${m.transactions.installments.itemTitle(3, 3)} · ${m.transactions.installments.itemForecastSuffix}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/50,00/)).toBeInTheDocument();
    expect(screen.queryByTestId("OpenInNewIcon")).not.toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(m.transactions.installments.itemNotLaunched)),
    ).toBeInTheDocument();
  });

  it("waiting + existingMonthId + canEdit: preserva 'Criar neste mês' e dispara onConvert", async () => {
    const onConvert = vi.fn();
    render(
      <InstallmentSchedule
        items={[WAITING_CONVERTIBLE_ITEM]}
        installmentCount={3}
        canEdit
        onConvert={onConvert}
        variant="panel"
      />,
    );
    const trigger = screen.getByText("Criar neste mês");
    await userEvent.click(trigger);
    expect(onConvert).toHaveBeenCalledWith("pi-3");
  });
});

describe("InstallmentSchedule — paga fora do app (spec 73 §2.5)", () => {
  it("waiting + canEdit + onToggleSettled: ícone vira botão que marca como paga", async () => {
    const onToggleSettled = vi.fn();
    render(
      <InstallmentSchedule
        items={[WAITING_CONVERTIBLE_ITEM]}
        installmentCount={4}
        canEdit
        onToggleSettled={onToggleSettled}
        variant="panel"
      />,
    );
    const button = screen.getByRole("button", {
      name: m.transactions.installments.markSettled,
    });
    await userEvent.click(button);
    expect(onToggleSettled).toHaveBeenCalledWith("pi-3", true);
  });

  it("settled_external: sufixo 'paga (histórico)', valor visível e botão de desfazer", async () => {
    const onToggleSettled = vi.fn();
    render(
      <InstallmentSchedule
        items={[SETTLED_EXTERNAL_ITEM]}
        installmentCount={4}
        canEdit
        onToggleSettled={onToggleSettled}
        variant="panel"
      />,
    );
    expect(
      screen.getByText(
        `${m.transactions.installments.itemTitle(2, 4)} · ${m.transactions.installments.itemSettledSuffix}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/229,83/)).toBeInTheDocument();
    // Não é lançamento: sem link para transação
    expect(screen.queryByTestId("OpenInNewIcon")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: m.transactions.installments.unmarkSettled }),
    );
    expect(onToggleSettled).toHaveBeenCalledWith("pi-2", false);
  });

  it("canEdit=false: ícone de status não é botão", () => {
    render(
      <InstallmentSchedule
        items={[SETTLED_EXTERNAL_ITEM]}
        installmentCount={4}
        variant="panel"
        onToggleSettled={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: m.transactions.installments.unmarkSettled }),
    ).not.toBeInTheDocument();
  });
});
