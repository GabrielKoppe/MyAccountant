import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionSuccess } from "@/lib/action-result";
import { m } from "@/lib/messages";

import { OnDemandUsagePanel, type OnDemandUsagePanelProps } from "./OnDemandUsagePanel";

const countUsageAction = vi.fn();
vi.mock("@/actions/settings-usage", () => ({
  countUsageAction: (...args: unknown[]) => countUsageAction(...args),
}));

const od = m.settings.presentation.onDemand;
const t = m.settings.structureDialogs.usage;

const RESULT = {
  transactions: 488,
  months: 12,
  byMonth: [
    { month: "2025-09", transactions: 10 },
    { month: "2026-07", transactions: 40 },
  ],
  countedAt: new Date("2026-07-28T14:10:00.000Z"),
  fromCache: true,
};

function renderPanel(overrides: Partial<OnDemandUsagePanelProps> = {}) {
  render(
    <SnackbarProvider>
      <OnDemandUsagePanel
        accountId="acc-test-1"
        entity="tableType"
        entityId="tt-1"
        entityName="Cartão de crédito"
        {...overrides}
      />
    </SnackbarProvider>,
  );
}

describe("OnDemandUsagePanel", () => {
  beforeEach(() => {
    countUsageAction.mockReset();
    countUsageAction.mockResolvedValue(actionSuccess(RESULT));
  });

  describe("SET-07 — não conta na montagem", () => {
    it("não chama a action antes do clique", () => {
      renderPanel();

      expect(countUsageAction).not.toHaveBeenCalled();
    });

    it("mostra o cartão que explica o custo, com o botão Contar", () => {
      renderPanel();

      expect(screen.getByText(od.title)).toBeInTheDocument();
      expect(screen.getByText(od.body)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: od.count })).toBeInTheDocument();
    });

    it("conta só quando o usuário clica em Contar", async () => {
      renderPanel();

      await userEvent.click(screen.getByRole("button", { name: od.count }));

      await waitFor(() => {
        expect(countUsageAction).toHaveBeenCalledWith("acc-test-1", {
          entity: "tableType",
          entityId: "tt-1",
        });
      });
    });
  });

  describe("resultado", () => {
    it("mostra o timestamp e troca Contar por Recontar", async () => {
      renderPanel();

      await userEvent.click(screen.getByRole("button", { name: od.count }));

      expect(await screen.findByRole("button", { name: od.recount })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: od.count })).not.toBeInTheDocument();
      // "Resultado de 28/07 11:10" — a hora é local, então só o prefixo é estável.
      expect(screen.getByText(/^Resultado de /)).toBeInTheDocument();
    });

    it("Recontar chama a action com force: true", async () => {
      renderPanel();

      await userEvent.click(screen.getByRole("button", { name: od.count }));
      await userEvent.click(await screen.findByRole("button", { name: od.recount }));

      await waitFor(() => {
        expect(countUsageAction).toHaveBeenLastCalledWith("acc-test-1", {
          entity: "tableType",
          entityId: "tt-1",
          force: true,
        });
      });
    });

    it("usa o resultado padrão (KPIs do modal M3) quando não há renderResult", async () => {
      renderPanel();

      await userEvent.click(screen.getByRole("button", { name: od.count }));

      expect(await screen.findByText("488")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByText(t.transactions)).toBeInTheDocument();
    });

    it("renderResult substitui o corpo, mas o rodapé de timestamp permanece", async () => {
      renderPanel({
        renderResult: (usage) => <p>{`${usage.transactions} transações`}</p>,
      });

      await userEvent.click(screen.getByRole("button", { name: od.count }));

      expect(await screen.findByText("488 transações")).toBeInTheDocument();
      expect(screen.queryByText(t.transactions)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: od.recount })).toBeInTheDocument();
    });

    it("countedAtLabel troca a frase do carimbo (é o que mantém o modal M3 igual)", async () => {
      renderPanel({ countedAtLabel: t.countedAt });

      await userEvent.click(screen.getByRole("button", { name: od.count }));

      expect(await screen.findByText(/^Contado em /)).toBeInTheDocument();
      expect(screen.queryByText(/^Resultado de /)).not.toBeInTheDocument();
    });

    it("renderiza o atalho para as transações quando há href", async () => {
      renderPanel({ transactionsHref: "/acc-test-1/transactions?tableType=tt-1" });

      await userEvent.click(screen.getByRole("button", { name: od.count }));

      expect(await screen.findByRole("link", { name: od.viewTransactions })).toBeInTheDocument();
    });
  });

  describe("autoCount", () => {
    it("conta na montagem quando ligado (é o caso do UsageDialog)", async () => {
      renderPanel({ autoCount: true });

      await waitFor(() => {
        expect(countUsageAction).toHaveBeenCalledWith("acc-test-1", {
          entity: "tableType",
          entityId: "tt-1",
        });
      });
      // Nunca mostra o cartão ocioso: abrir o modal JÁ É o pedido de contagem.
      expect(screen.queryByText(od.title)).not.toBeInTheDocument();
    });
  });
});
