import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";
import type { MonthAutomationGroup } from "@/server/services/month-service";

import { MonthAutomationsStep } from "./MonthAutomationsStep";

const GROUPS: MonthAutomationGroup[] = [
  {
    kind: "table_template",
    items: [
      {
        id: "tpl-ok",
        label: "Contas fixas",
        sectionName: "Gastos",
        tableTypeName: "Cartão",
        itemCount: 2,
        installmentNumber: null,
        installmentCount: null,
        amountCents: "432000",
        defaultSelected: true,
        blockedReason: null,
      },
      {
        id: "tpl-bloqueado",
        label: "Investimentos mensais",
        sectionName: null,
        tableTypeName: null,
        itemCount: 0,
        installmentNumber: null,
        installmentCount: null,
        amountCents: "0",
        defaultSelected: false,
        blockedReason: "missing_section",
      },
    ],
  },
  {
    kind: "pending_installment",
    items: [
      {
        id: "pi-import",
        label: "CYAN SHOES",
        sectionName: "Gastos",
        tableTypeName: "Cartão",
        itemCount: null,
        installmentNumber: 3,
        installmentCount: 3,
        amountCents: "15783",
        defaultSelected: false,
        blockedReason: null,
      },
    ],
  },
];

function renderStep(selected: string[] = ["tpl-ok"], onToggle = vi.fn(), onToggleGroup = vi.fn()) {
  render(
    <MonthAutomationsStep
      groups={GROUPS}
      selectedIds={new Set(selected)}
      onToggle={onToggle}
      onToggleGroup={onToggleGroup}
    />,
  );
  return { onToggle, onToggleGroup };
}

describe("MonthAutomationsStep (spec 73 §2.4)", () => {
  it("agrupa por tipo com rótulo e contagem de marcados sobre os selecionáveis", () => {
    renderStep();
    expect(screen.getByText(m.months.automations.kindTableTemplate)).toBeInTheDocument();
    expect(screen.getByText(m.months.automations.kindPendingInstallment)).toBeInTheDocument();
    // Modelos: 1 marcado de 1 selecionável (o bloqueado não conta)
    expect(screen.getByText(m.months.automations.selectedCount(1, 1))).toBeInTheDocument();
    // Parcelas: 0 de 1
    expect(screen.getByText(m.months.automations.selectedCount(0, 1))).toBeInTheDocument();
  });

  it("item bloqueado aparece desabilitado com o motivo", () => {
    renderStep();
    const blocked = screen.getByRole("checkbox", { name: "Investimentos mensais" });
    expect(blocked).toBeDisabled();
    expect(
      screen.getByText(new RegExp(m.months.automations.blocked.missing_section)),
    ).toBeInTheDocument();
  });

  it("parcela de import mostra a origem 'vem da fatura'", () => {
    renderStep();
    // Substring, não RegExp: o rótulo tem parênteses literais em "(import)".
    expect(
      screen.getByText((content) => content.includes(m.months.automations.originImport)),
    ).toBeInTheDocument();
  });

  it("clicar num item dispara onToggle com o id", async () => {
    const { onToggle } = renderStep();
    await userEvent.click(screen.getByRole("checkbox", { name: "CYAN SHOES" }));
    expect(onToggle).toHaveBeenCalledWith("pi-import");
  });

  it("checkbox do grupo alterna todos os selecionáveis daquele tipo", async () => {
    const { onToggleGroup } = renderStep();
    await userEvent.click(
      screen.getByRole("checkbox", { name: m.months.automations.kindPendingInstallment }),
    );
    expect(onToggleGroup).toHaveBeenCalledWith("pending_installment", true);
  });

  it("total a lançar soma só os itens marcados (modelo conta itemCount transações)", () => {
    renderStep(["tpl-ok", "pi-import"]);
    // 432000 + 15783 = 447783 centavos; transações = 2 (itens do modelo) + 1 (parcela)
    expect(
      screen.getByText(m.months.automations.totalToLaunch("R$ 4.477,83", 3)),
    ).toBeInTheDocument();
  });

  it("nada marcado: avisa que o mês será criado vazio", () => {
    renderStep([]);
    expect(screen.getByText(m.months.automations.nothingSelected)).toBeInTheDocument();
  });
});
