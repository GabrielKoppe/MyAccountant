import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { getConfigReferencesAction } from "@/actions/settings-merge";
import { countUsageAction } from "@/actions/settings-usage";
import { m } from "@/lib/messages";

import { DeleteWithReallocationDialog } from "./DeleteWithReallocationDialog";

vi.mock("notistack", () => ({
  useSnackbar: () => ({ enqueueSnackbar: vi.fn() }),
}));

vi.mock("@/actions/settings-merge", () => ({
  getConfigReferencesAction: vi.fn(),
}));

vi.mock("@/actions/settings-usage", () => ({
  countUsageAction: vi.fn(),
}));

const t = m.settings.structureDialogs;

const REFS_WITH_ALIASES = {
  ok: true as const,
  data: {
    groups: [
      { kind: "aliases" as const, count: 2 },
      { kind: "templateDefaults" as const, count: 0 },
      { kind: "templateItems" as const, count: 0 },
      { kind: "widgetFilters" as const, count: 0 },
      { kind: "accountDefault" as const, count: 0 },
    ],
    total: 2,
  },
};

const REFS_EMPTY = {
  ok: true as const,
  data: {
    groups: [
      { kind: "aliases" as const, count: 0 },
      { kind: "templateDefaults" as const, count: 0 },
      { kind: "templateItems" as const, count: 0 },
      { kind: "widgetFilters" as const, count: 0 },
      { kind: "accountDefault" as const, count: 0 },
    ],
    total: 0,
  },
};

function usageResult(transactions: number, months: number) {
  return {
    ok: true as const,
    data: {
      transactions,
      months,
      byMonth: [],
      countedAt: new Date("2026-08-10T12:00:00Z"),
      fromCache: false,
    },
  };
}

function renderDialog(props: { open?: boolean } = {}) {
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <DeleteWithReallocationDialog
      open={props.open ?? true}
      onClose={onClose}
      accountId="acc-1"
      entity="category"
      target={{ id: "cat-1", name: "Restaurantes" }}
      options={[{ id: "cat-2", name: "Restaurante", colorKey: null }]}
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm, onClose };
}

describe("DeleteWithReallocationDialog (Spec 68 §2.6 / M2)", () => {
  it("não busca nada quando open={false}", () => {
    renderDialog({ open: false });

    expect(getConfigReferencesAction).not.toHaveBeenCalled();
    expect(countUsageAction).not.toHaveBeenCalled();
  });

  it("busca referências e uso só depois de abrir, com force:true na contagem", async () => {
    vi.mocked(getConfigReferencesAction).mockResolvedValue(REFS_WITH_ALIASES);
    vi.mocked(countUsageAction).mockResolvedValue(usageResult(5, 2));

    renderDialog();

    expect(getConfigReferencesAction).toHaveBeenCalledWith("acc-1", {
      entity: "category",
      entityId: "cat-1",
    });
    expect(countUsageAction).toHaveBeenCalledWith("acc-1", {
      entity: "category",
      entityId: "cat-1",
      force: true,
    });

    // Espera as duas respostas assentarem antes do teste terminar — senão o `act`
    // do próximo teste acusa update fora de ato por causa desta promise pendente.
    await screen.findByText(t.remove.transactionCount(5, 2));
  });

  it("mantém a confirmação desabilitada com referências e destino intocado", async () => {
    vi.mocked(getConfigReferencesAction).mockResolvedValue(REFS_WITH_ALIASES);
    vi.mocked(countUsageAction).mockResolvedValue(usageResult(5, 2));

    renderDialog();

    await screen.findByText(t.remove.transactionCount(5, 2));
    // 2 referências de configuração + 5 transações = 7 no total do botão.
    const confirmButton = screen.getByRole("button", { name: t.remove.confirmWithTotal(7) });
    expect(confirmButton).toBeDisabled();
  });

  it('habilita a confirmação ao escolher "Sem categoria" — destino explícito', async () => {
    vi.mocked(getConfigReferencesAction).mockResolvedValue(REFS_WITH_ALIASES);
    vi.mocked(countUsageAction).mockResolvedValue(usageResult(5, 2));

    const { onConfirm } = renderDialog();

    await screen.findByText(t.remove.transactionCount(5, 2));

    await userEvent.click(screen.getByLabelText(t.remove.reallocateTo));
    await userEvent.click(
      await screen.findByRole("option", { name: t.remove.noneOption(t.entityLabels.category) }),
    );

    const confirmButton = screen.getByRole("button", { name: t.remove.confirmWithTotal(7) });
    expect(confirmButton).toBeEnabled();

    await userEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it("habilita e confirma com um destino real escolhido", async () => {
    vi.mocked(getConfigReferencesAction).mockResolvedValue(REFS_WITH_ALIASES);
    vi.mocked(countUsageAction).mockResolvedValue(usageResult(5, 2));

    const { onConfirm } = renderDialog();

    await screen.findByText(t.remove.transactionCount(5, 2));

    await userEvent.click(screen.getByLabelText(t.remove.reallocateTo));
    await userEvent.click(await screen.findByRole("option", { name: "Restaurante" }));

    const confirmButton = screen.getByRole("button", { name: t.remove.confirmWithTotal(7) });
    expect(confirmButton).toBeEnabled();

    await userEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith("cat-2");
  });

  it("sem nenhuma referência, o botão libera direto com o rótulo simples", async () => {
    vi.mocked(getConfigReferencesAction).mockResolvedValue(REFS_EMPTY);
    vi.mocked(countUsageAction).mockResolvedValue(usageResult(0, 0));

    renderDialog();

    await screen.findByText(t.remove.noTransactions);
    expect(screen.getByText(t.remove.noRefs)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: t.remove.confirmSimple });
    expect(confirmButton).toBeEnabled();
  });
});
