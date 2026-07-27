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
};

const PENDING_ITEM: InstallmentPanelItem = {
  installmentNumber: 2,
  amountCents: "10000",
  date: "2026-02-15",
  status: "pending",
};

const WAITING_CONVERTIBLE_ITEM: InstallmentPanelItem = {
  installmentNumber: 3,
  amountCents: "5000",
  date: "2026-03-15",
  status: "waiting",
  existingMonthId: "month-3",
  pendingInstallmentId: "pi-3",
};

const WAITING_PLAIN_ITEM: InstallmentPanelItem = {
  installmentNumber: 3,
  amountCents: "5000",
  date: "2026-07-15",
  status: "waiting",
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
    };
    render(<InstallmentSchedule items={[item]} installmentCount={5} />);
    expect(screen.getByText("2/5")).toBeInTheDocument();
    expect(screen.getByText(/123,45/)).toBeInTheDocument();
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
