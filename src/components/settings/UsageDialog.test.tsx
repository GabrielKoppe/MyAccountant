import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionSuccess } from "@/lib/action-result";
import { m } from "@/lib/messages";

import { UsageDialog, type UsageDialogProps } from "./UsageDialog";

const countUsageAction = vi.fn();
vi.mock("@/actions/settings-usage", () => ({
  countUsageAction: (...args: unknown[]) => countUsageAction(...args),
}));

const t = m.settings.structureDialogs.usage;

function renderDialog(overrides: Partial<UsageDialogProps> = {}) {
  const onClose = vi.fn();
  render(
    <SnackbarProvider>
      <UsageDialog
        open
        onClose={onClose}
        accountId="acc-test-1"
        entity="category"
        entityId="cat-1"
        entityName="Moradia"
        {...overrides}
      />
    </SnackbarProvider>,
  );
  return { onClose };
}

describe("UsageDialog", () => {
  beforeEach(() => {
    countUsageAction.mockReset();
  });

  it("não busca nada enquanto open=false", () => {
    renderDialog({ open: false });
    expect(countUsageAction).not.toHaveBeenCalled();
  });

  it("busca ao abrir e renderiza os três KPIs", async () => {
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 204,
        months: 12,
        byMonth: [
          { month: "2025-09", transactions: 10 },
          { month: "2026-07", transactions: 40 },
        ],
        countedAt: new Date("2026-07-29T09:12:00.000Z"),
        fromCache: true,
      }),
    );

    renderDialog();

    await waitFor(() => {
      expect(countUsageAction).toHaveBeenCalledWith("acc-test-1", {
        entity: "category",
        entityId: "cat-1",
      });
    });

    expect(await screen.findByText("204")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    // Último uso deriva do ÚLTIMO ponto de `byMonth` (cronológico) — não é um
    // campo próprio da resposta. "jul/26" também aparece no rótulo do eixo do
    // histograma, então o KPI precisa ser localizado pelo container, não pelo texto solto.
    const lastUseKpi = screen.getByText(t.lastUse).parentElement;
    expect(lastUseKpi).toHaveTextContent("jul/26");
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it('"Recontar" chama a action com force: true', async () => {
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 5,
        months: 2,
        byMonth: [{ month: "2026-07", transactions: 5 }],
        countedAt: new Date("2026-07-29T09:12:00.000Z"),
        fromCache: true,
      }),
    );

    renderDialog();
    await screen.findByText("5");

    await userEvent.click(screen.getByRole("button", { name: t.recount }));

    await waitFor(() => {
      expect(countUsageAction).toHaveBeenLastCalledWith("acc-test-1", {
        entity: "category",
        entityId: "cat-1",
        force: true,
      });
    });
  });

  it("série vazia mostra o texto de 'sem uso' em vez do gráfico", async () => {
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 0,
        months: 0,
        byMonth: [],
        countedAt: new Date("2026-07-29T09:12:00.000Z"),
        fromCache: true,
      }),
    );

    renderDialog();

    expect(await screen.findByText(t.noUsage)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    // KPIs continuam renderizando mesmo com a série vazia.
    expect(screen.getByText(t.never)).toBeInTheDocument();
  });
});
