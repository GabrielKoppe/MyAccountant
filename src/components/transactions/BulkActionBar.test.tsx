import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import { BulkActionBar } from "./BulkActionBar";

// Mock das Server Actions de transação (bulkUpdateAction/bulkDeleteAction usadas
// diretamente pela barra + listTablesForMoveAction/moveTransactionsAction usadas
// pela MoveTransactionsDialog aninhada — mesmo módulo, precisa mockar todas).
const bulkUpdateAction = vi.fn();
const bulkDeleteAction = vi.fn();
const listTablesForMoveAction = vi.fn();
const moveTransactionsAction = vi.fn();
vi.mock("@/actions/transactions", () => ({
  bulkUpdateAction: (...args: unknown[]) => bulkUpdateAction(...args),
  bulkDeleteAction: (...args: unknown[]) => bulkDeleteAction(...args),
  listTablesForMoveAction: (...args: unknown[]) => listTablesForMoveAction(...args),
  moveTransactionsAction: (...args: unknown[]) => moveTransactionsAction(...args),
}));

// Mock das Server Actions de tags (adicionar/remover em massa + listagem).
const bulkAddTagAction = vi.fn();
const bulkRemoveTagAction = vi.fn();
const listTagsAction = vi.fn();
vi.mock("@/actions/tags", () => ({
  bulkAddTagAction: (...args: unknown[]) => bulkAddTagAction(...args),
  bulkRemoveTagAction: (...args: unknown[]) => bulkRemoveTagAction(...args),
  listTagsAction: (...args: unknown[]) => listTagsAction(...args),
}));

function renderBar(props: Partial<Parameters<typeof BulkActionBar>[0]> = {}) {
  const spies = {
    onClear: vi.fn(),
    onMoved: vi.fn(),
    onBulkUpdated: vi.fn(),
    onStartInlineEdit: vi.fn(),
    onSaveInlineEdit: vi.fn(),
    onCancelInlineEdit: vi.fn(),
  };
  render(
    <SnackbarProvider>
      <BulkActionBar
        accountId="acc-1"
        tableId="table-1"
        monthId="month-1"
        sourceCountType="add"
        sampleAmountCents="1000"
        selectedIds={["tx-1", "tx-2"]}
        allSelectedPending={false}
        isEditing={false}
        isSavingEdit={false}
        {...spies}
        {...props}
      />
    </SnackbarProvider>,
  );
  return spies;
}

/** Abre o menu do botão "Tags" e devolve o menu. */
async function openTagMenu() {
  await userEvent.click(screen.getByRole("button", { name: m.transactions.bulk.tags }));
  return screen.getByRole("menu");
}

describe("BulkActionBar", () => {
  beforeEach(() => {
    bulkUpdateAction.mockReset().mockResolvedValue({ ok: true, data: undefined });
    bulkDeleteAction.mockReset().mockResolvedValue({ ok: true, data: undefined });
    listTablesForMoveAction.mockReset();
    moveTransactionsAction.mockReset();
    bulkAddTagAction.mockReset();
    bulkRemoveTagAction.mockReset();
    listTagsAction.mockReset().mockResolvedValue([]);
  });

  it("mostra o contador em texto puro e os 5 botões do frame §4", () => {
    renderBar();

    expect(screen.getByText(m.transactions.bulk.selected(2))).toBeInTheDocument();
    // Contador NÃO é pílula/Chip.
    expect(document.querySelector(".MuiChip-root")).toBeNull();

    for (const label of [
      m.transactions.bulk.editTitle,
      m.transactions.bulk.move,
      m.transactions.bulk.markPending,
      m.transactions.bulk.tags,
      m.transactions.bulk.delete,
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it('com tudo pendente, o toggle vira "Marcar pago" (isPending: false)', async () => {
    renderBar({ allSelectedPending: true });

    await userEvent.click(screen.getByRole("button", { name: m.transactions.bulk.markPaid }));

    expect(bulkUpdateAction).toHaveBeenCalledWith("acc-1", {
      ids: ["tx-1", "tx-2"],
      monthId: "month-1",
      patch: { isPending: false },
    });
  });

  it('"Marcar pendente" (ação direta) chama bulkUpdateAction COM monthId', async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: m.transactions.bulk.markPending }));

    expect(bulkUpdateAction).toHaveBeenCalledTimes(1);
    const [accountId, payload] = bulkUpdateAction.mock.calls[0];
    expect(accountId).toBe("acc-1");
    expect(payload).toEqual({
      ids: ["tx-1", "tx-2"],
      monthId: "month-1",
      patch: { isPending: true },
    });
  });

  it('"Editar em massa" NÃO abre modal — dispara a edição inline do lote', async () => {
    const { onStartInlineEdit } = renderBar();

    await userEvent.click(screen.getByRole("button", { name: m.transactions.bulk.editTitle }));

    expect(onStartInlineEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("em edição, a barra expõe UM par Salvar/Cancelar para o lote", async () => {
    const { onSaveInlineEdit, onCancelInlineEdit } = renderBar({ isEditing: true });

    // As ações diretas dão lugar ao par do lote.
    expect(
      screen.queryByRole("button", { name: m.transactions.bulk.editTitle }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: m.transactions.actions.save }));
    expect(onSaveInlineEdit).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: m.transactions.actions.cancel }));
    expect(onCancelInlineEdit).toHaveBeenCalledTimes(1);
  });

  it("o checkbox marcado da barra limpa a seleção", async () => {
    const { onClear } = renderBar();
    await userEvent.click(screen.getByRole("checkbox", { name: m.common.cancel }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("Excluir com seleção grande (>5) abre confirmação antes de bulkDeleteAction", async () => {
    renderBar({ selectedIds: ["1", "2", "3", "4", "5", "6"] });

    await userEvent.click(screen.getByRole("button", { name: m.transactions.bulk.delete }));
    expect(bulkDeleteAction).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(m.transactions.bulkDeleteTitle)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: m.common.delete }));

    expect(bulkDeleteAction).toHaveBeenCalledTimes(1);
    expect(bulkDeleteAction).toHaveBeenCalledWith("acc-1", {
      ids: ["1", "2", "3", "4", "5", "6"],
    });
  });

  it("Excluir com seleção pequena (<=5) chama bulkDeleteAction direto, sem confirmação", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: m.transactions.bulk.delete }));

    expect(bulkDeleteAction).toHaveBeenCalledTimes(1);
    expect(bulkDeleteAction).toHaveBeenCalledWith("acc-1", { ids: ["tx-1", "tx-2"] });
  });

  it("Tags: o botão único do frame mantém adicionar E remover", async () => {
    renderBar();
    const menu = await openTagMenu();

    expect(
      within(menu).getByRole("menuitem", { name: m.transactions.tags.bulkAdd }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: m.transactions.tags.bulkRemove }),
    ).toBeInTheDocument();
  });

  it("Tags: adicionar chama bulkAddTagAction com transactionIds + tagName", async () => {
    bulkAddTagAction.mockResolvedValue({ ok: true, data: undefined });
    renderBar();

    const menu = await openTagMenu();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: m.transactions.tags.bulkAdd }),
    );

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText(m.transactions.bulk.tagNameLabel),
      "urgente",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: m.transactions.tags.addTooltip }),
    );

    expect(bulkAddTagAction).toHaveBeenCalledWith("acc-1", {
      transactionIds: ["tx-1", "tx-2"],
      tagName: "urgente",
    });
  });

  it("Tags: remover abre o diálogo, carrega as tags da conta e mantém a ação disponível", async () => {
    listTagsAction.mockResolvedValue([{ id: "tag-1", name: "Urgente" }]);
    renderBar();

    const menu = await openTagMenu();
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: m.transactions.tags.bulkRemove }),
    );

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(listTagsAction).toHaveBeenCalledWith("acc-1"));
    expect(
      within(dialog).getByRole("button", { name: m.transactions.tags.removeTooltip }),
    ).toBeInTheDocument();
  });

  it('"Mover" abre a MoveTransactionsDialog', async () => {
    listTablesForMoveAction.mockResolvedValue({
      ok: true,
      data: {
        months: [],
        sections: [],
        tables: [],
        tableTypes: [],
        invertSignOnMoveByDefault: true,
      },
    });
    renderBar();

    await userEvent.click(screen.getByRole("button", { name: m.transactions.bulk.move }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(listTablesForMoveAction).toHaveBeenCalledWith("acc-1", {});
  });
});
