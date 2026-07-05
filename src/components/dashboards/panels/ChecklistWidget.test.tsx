import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChecklistWidget } from "./ChecklistWidget";
import type { ChecklistMonthItem } from "@/server/services/checklist-service";

// Mock das Server Actions — capturamos os payloads enviados ao servidor.
const toggleChecklistCompletionAction = vi.fn();
const createChecklistItemAction = vi.fn();
const deleteChecklistItemAction = vi.fn();
const unlinkChecklistTransactionAction = vi.fn();
const linkChecklistTransactionAction = vi.fn();
const searchChecklistTransactionsAction = vi.fn();
vi.mock("@/actions/checklist", () => ({
  toggleChecklistCompletionAction: (...args: unknown[]) => toggleChecklistCompletionAction(...args),
  createChecklistItemAction: (...args: unknown[]) => createChecklistItemAction(...args),
  deleteChecklistItemAction: (...args: unknown[]) => deleteChecklistItemAction(...args),
  unlinkChecklistTransactionAction: (...args: unknown[]) =>
    unlinkChecklistTransactionAction(...args),
  linkChecklistTransactionAction: (...args: unknown[]) => linkChecklistTransactionAction(...args),
  searchChecklistTransactionsAction: (...args: unknown[]) =>
    searchChecklistTransactionsAction(...args),
}));

function buildItem(overrides: Partial<ChecklistMonthItem> = {}): ChecklistMonthItem {
  return {
    id: "item-1",
    label: "Pagar aluguel",
    position: 0,
    done: false,
    completedByName: null,
    completedAt: null,
    linkedTransaction: null,
    ...overrides,
  };
}

function renderWidget(props: Partial<Parameters<typeof ChecklistWidget>[0]> = {}) {
  render(
    <SnackbarProvider>
      <ChecklistWidget
        accountId="acc-1"
        monthId="month-1"
        items={[buildItem()]}
        canEdit
        renderMode="default"
        {...props}
      />
    </SnackbarProvider>,
  );
}

beforeEach(() => {
  toggleChecklistCompletionAction.mockReset().mockResolvedValue({ ok: true, data: undefined });
  createChecklistItemAction.mockReset().mockResolvedValue({ ok: true, data: { itemId: "new" } });
  deleteChecklistItemAction.mockReset().mockResolvedValue({ ok: true, data: undefined });
  unlinkChecklistTransactionAction.mockReset().mockResolvedValue({ ok: true, data: undefined });
  linkChecklistTransactionAction.mockReset().mockResolvedValue({ ok: true, data: undefined });
  searchChecklistTransactionsAction.mockReset().mockResolvedValue({ ok: true, data: [] });
});

describe("ChecklistWidget — render", () => {
  it("renderiza os itens e o badge de progresso X/N", () => {
    renderWidget({
      items: [
        buildItem({ id: "a", label: "Tarefa A", done: true }),
        buildItem({ id: "b", label: "Tarefa B", done: false }),
      ],
    });
    expect(screen.getByText("Tarefa A")).toBeInTheDocument();
    expect(screen.getByText("Tarefa B")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("marca o checkbox conforme o estado done", () => {
    renderWidget({ items: [buildItem({ done: true })] });
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("mostra estado vazio de editor quando não há itens e pode editar", () => {
    renderWidget({ items: [] });
    expect(screen.getByText(/Nenhuma tarefa ainda/i)).toBeInTheDocument();
  });

  it("mostra estado vazio read-only quando não pode editar", () => {
    renderWidget({ items: [], canEdit: false });
    expect(screen.getByText(/Nenhuma tarefa configurada/i)).toBeInTheDocument();
  });
});

describe("ChecklistWidget — variantes", () => {
  it("compact não mostra campo de adicionar tarefa", () => {
    renderWidget({ renderMode: "compact" });
    expect(screen.queryByPlaceholderText(/Adicionar tarefa/i)).not.toBeInTheDocument();
  });

  it("default mostra campo de adicionar tarefa", () => {
    renderWidget({ renderMode: "default" });
    expect(screen.getByPlaceholderText(/Adicionar tarefa/i)).toBeInTheDocument();
  });

  it("full mostra 'concluída por' + data no subtítulo do item concluído", () => {
    renderWidget({
      renderMode: "full",
      items: [buildItem({ done: true, completedByName: "Ana", completedAt: "2026-07-03" })],
    });
    expect(screen.getByText(/Concluída por Ana · 03\/07/)).toBeInTheDocument();
  });
});

describe("ChecklistWidget — mutações", () => {
  it("toggle chama a action com { itemId, monthId, done }", async () => {
    const user = userEvent.setup();
    renderWidget({ items: [buildItem({ id: "item-x", done: false })] });

    await user.click(screen.getByRole("checkbox"));

    await waitFor(() =>
      expect(toggleChecklistCompletionAction).toHaveBeenCalledWith("acc-1", {
        itemId: "item-x",
        monthId: "month-1",
        done: true,
      }),
    );
  });

  it("viewer (read-only) tem checkbox desabilitado e sem campo de adicionar", () => {
    renderWidget({ canEdit: false });
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.queryByPlaceholderText(/Adicionar tarefa/i)).not.toBeInTheDocument();
  });

  it("reverte o estado otimista e mostra erro quando a action falha", async () => {
    const user = userEvent.setup();
    toggleChecklistCompletionAction.mockResolvedValue({ ok: false, error: { message: "boom" } });
    renderWidget({ items: [buildItem({ id: "item-x", done: false })] });

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);

    // Sem revalidate (jsdom), o otimista reconcilia de volta ao prop base (done=false).
    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(await screen.findByText(/Não foi possível atualizar/i)).toBeInTheDocument();
  });
});

describe("ChecklistWidget — vínculo de transação", () => {
  it("mostra o chip da transação vinculada (valor)", () => {
    renderWidget({
      items: [
        buildItem({
          done: true,
          linkedTransaction: {
            id: "tx-1",
            description: "Aluguel julho",
            amountCents: "-150000",
            occurredOn: "2026-07-03",
          },
        }),
      ],
    });
    expect(screen.getByText(/R\$\s*-?1\.500,00|-R\$\s*1\.500,00/)).toBeInTheDocument();
  });

  it("no full mostra valor na linha 1 e descrição · data no subtítulo", () => {
    renderWidget({
      renderMode: "full",
      items: [
        buildItem({
          done: true,
          linkedTransaction: {
            id: "tx-1",
            description: "Aluguel julho",
            amountCents: "-150000",
            occurredOn: "2026-07-03",
          },
        }),
      ],
    });
    // valor (linha 1) e subtítulo estruturado (descrição · DD/MM) são nós separados
    expect(screen.getByText(/R\$\s*-?1\.500,00|-R\$\s*1\.500,00/)).toBeInTheDocument();
    expect(screen.getByText(/Aluguel julho · 03\/07/)).toBeInTheDocument();
  });

  it("no full desvincular usa o botão (aria-label) e chama a action", async () => {
    const user = userEvent.setup();
    renderWidget({
      renderMode: "full",
      items: [
        buildItem({
          id: "item-x",
          done: true,
          linkedTransaction: {
            id: "tx-1",
            description: "Aluguel julho",
            amountCents: "-150000",
            occurredOn: "2026-07-03",
          },
        }),
      ],
    });

    await user.click(screen.getByLabelText("Desvincular transação"));

    await waitFor(() =>
      expect(unlinkChecklistTransactionAction).toHaveBeenCalledWith("acc-1", {
        itemId: "item-x",
        monthId: "month-1",
      }),
    );
  });

  it("botão de vincular abre o dialog (picker do mês)", async () => {
    const user = userEvent.setup();
    renderWidget({ items: [buildItem({ id: "item-x" })] });

    await user.click(screen.getByLabelText("Vincular transação"));

    expect(await screen.findByPlaceholderText(/Buscar transação do mês/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(searchChecklistTransactionsAction).toHaveBeenCalledWith("acc-1", {
        monthId: "month-1",
        query: "",
      }),
    );
  });

  it("desvincular chama a action com { itemId, monthId }", async () => {
    const user = userEvent.setup();
    renderWidget({
      items: [
        buildItem({
          id: "item-x",
          done: true,
          linkedTransaction: {
            id: "tx-1",
            description: "Aluguel",
            amountCents: "-150000",
            occurredOn: "2026-07-03",
          },
        }),
      ],
    });

    await user.click(screen.getByTestId("CancelIcon"));

    await waitFor(() =>
      expect(unlinkChecklistTransactionAction).toHaveBeenCalledWith("acc-1", {
        itemId: "item-x",
        monthId: "month-1",
      }),
    );
  });

  it("viewer não vê botão de vincular nem pode desvincular", () => {
    renderWidget({
      canEdit: false,
      items: [
        buildItem({
          done: true,
          linkedTransaction: {
            id: "tx-1",
            description: "Aluguel",
            amountCents: "-150000",
            occurredOn: "2026-07-03",
          },
        }),
      ],
    });
    expect(screen.queryByLabelText("Vincular transação")).not.toBeInTheDocument();
    // chip visível, mas sem botão de remover (onDelete undefined)
    expect(screen.queryByTestId("CancelIcon")).not.toBeInTheDocument();
  });
});
