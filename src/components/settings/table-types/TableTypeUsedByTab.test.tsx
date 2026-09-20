import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionSuccess } from "@/lib/action-result";
import { m } from "@/lib/messages";

import { TableTypeUsedByTab, type TableTypeUsedByTabProps } from "./TableTypeUsedByTab";

const countUsageAction = vi.fn();
vi.mock("@/actions/settings-usage", () => ({
  countUsageAction: (...args: unknown[]) => countUsageAction(...args),
}));

const t = m.settings.presentation.tableTypes.usedBy;
const od = m.settings.presentation.onDemand;

const MODELS = [
  { id: "tpl-1", name: "Cartão Nubank", sectionName: "Cartões" },
  { id: "tpl-2", name: "Cartão Santander", sectionName: null },
];

function renderTab(overrides: Partial<TableTypeUsedByTabProps> = {}) {
  return render(
    <SnackbarProvider>
      <TableTypeUsedByTab
        accountId="acc-test-1"
        tableTypeId="tt-card"
        tableTypeName="Cartão de crédito"
        models={MODELS}
        modelsHref="/acc-test-1/settings/models"
        {...overrides}
      />
    </SnackbarProvider>,
  );
}

describe("TableTypeUsedByTab", () => {
  beforeEach(() => {
    countUsageAction.mockReset();
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 488,
        months: 12,
        byMonth: [{ month: "2026-06", transactions: 40 }],
        countedAt: new Date("2026-07-28T14:10:00.000Z"),
        fromCache: false,
      }),
    );
  });

  describe("modelos que usam o tipo (contagem barata)", () => {
    it("aparecem sem nenhum clique, com a seção de cada um", () => {
      renderTab();

      expect(screen.getByText("Cartão Nubank")).toBeInTheDocument();
      expect(screen.getByText(t.sectionOf("Cartões"))).toBeInTheDocument();
      // Modelo sem automação não tem seção de destino — e isso é dito.
      expect(screen.getByText(t.noSection)).toBeInTheDocument();
    });

    it("cada modelo leva para a página de Modelos", () => {
      renderTab();

      expect(screen.getByRole("link", { name: /Cartão Nubank/ })).toHaveAttribute(
        "href",
        "/acc-test-1/settings/models",
      );
    });

    it("sem modelo nenhum, diz isso em vez de mostrar uma lista vazia", () => {
      renderTab({ models: [] });

      expect(screen.getByText(t.modelsEmpty)).toBeInTheDocument();
    });
  });

  describe("tabelas e transações reais (sob demanda — SET-07)", () => {
    it("NÃO conta na montagem: a aba abre junto com a página", () => {
      renderTab();

      expect(countUsageAction).not.toHaveBeenCalled();
      expect(screen.getByText(od.title)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: od.count })).toBeInTheDocument();
    });

    it("conta no clique e carimba a hora do resultado", async () => {
      renderTab();

      await userEvent.click(screen.getByRole("button", { name: od.count }));

      await waitFor(() => expect(countUsageAction).toHaveBeenCalledTimes(1));
      expect(countUsageAction).toHaveBeenCalledWith("acc-test-1", {
        entity: "tableType",
        entityId: "tt-card",
      });
      expect(await screen.findByText("488")).toBeInTheDocument();
      expect(screen.getByText(/^Resultado de /)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: od.recount })).toBeInTheDocument();
    });
  });
});
