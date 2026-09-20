import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionSuccess } from "@/lib/action-result";
import { m } from "@/lib/messages";

import { TableTypesManager, type SettingsTableType } from "./TableTypesManager";

vi.mock("next/navigation", () => ({
  useParams: () => ({ accountId: "acc-test-1" }),
}));

const createTableTypeAction = vi.fn();
const deleteTableTypeAction = vi.fn();
const updateTableTypeAction = vi.fn();
vi.mock("@/actions/account-settings", () => ({
  createTableTypeAction: (...args: unknown[]) => createTableTypeAction(...args),
  deleteTableTypeAction: (...args: unknown[]) => deleteTableTypeAction(...args),
  updateTableTypeAction: (...args: unknown[]) => updateTableTypeAction(...args),
}));

// A aba 3 monta o `OnDemandUsagePanel`, que importa a action de contagem — e essa
// arrasta o NextAuth para o ambiente de teste. Mockada aqui só para não carregar o
// servidor; o comportamento dela é testado em `TableTypeUsedByTab.test.tsx`.
const countUsageAction = vi.fn();
vi.mock("@/actions/settings-usage", () => ({
  countUsageAction: (...args: unknown[]) => countUsageAction(...args),
}));

const t = m.settings.presentation.tableTypes;
const legacy = m.settings.tableTypes;
const shell = m.settings.shell;

function buildType(overrides: Partial<SettingsTableType> = {}): SettingsTableType {
  return {
    id: "tt-card",
    name: "Cartão de crédito",
    isDefault: false,
    rowLayout: "pills",
    density: "default",
    visibleColumns: ["occurredOn", "description", "category", "amount"],
    pinnedColumns: [],
    inheritOnNewRow: [],
    defaultSort: { key: "occurredOn", dir: "asc" },
    groupBy: null,
    showFooterTotal: true,
    showGroupSubtotal: false,
    allowBulkEdit: true,
    keepGhostRow: true,
    tableCount: 0,
    models: [{ id: "tpl-1", name: "Cartão Nubank", sectionName: "Cartões" }],
    ...overrides,
  };
}

const TYPES: SettingsTableType[] = [
  buildType(),
  buildType({
    id: "tt-refund",
    name: "Reembolsos",
    rowLayout: "columns",
    visibleColumns: ["occurredOn", "description", "amount"],
    models: [],
    tableCount: 3,
  }),
];

function renderManager(types: SettingsTableType[] = TYPES) {
  return render(
    <SnackbarProvider>
      <TableTypesManager accountId="acc-test-1" initialTypes={types} />
    </SnackbarProvider>,
  );
}

describe("TableTypesManager", () => {
  beforeEach(() => {
    createTableTypeAction.mockReset();
    deleteTableTypeAction.mockReset();
    updateTableTypeAction.mockReset();
    updateTableTypeAction.mockResolvedValue(actionSuccess(undefined));
  });

  describe("lista mestre", () => {
    it("resume cada tipo com colunas, layout e modelos", () => {
      renderManager();

      expect(screen.getByText(t.summary(4, t.rowLayout.pillsShort, 1))).toBeInTheDocument();
      // Tipo sem modelo: "sem modelo" (e esmaecido, como no frame 05).
      expect(screen.getByText(t.summary(3, t.rowLayout.columnsShort, 0))).toBeInTheDocument();
    });

    it("abre o primeiro tipo por padrão e troca o detalhe na seleção", async () => {
      renderManager();

      expect(screen.getByLabelText(legacy.nameLabel)).toHaveValue("Cartão de crédito");

      await userEvent.click(screen.getByRole("button", { name: /Reembolsos/ }));

      expect(screen.getByLabelText(legacy.nameLabel)).toHaveValue("Reembolsos");
    });

    it("sem nenhum tipo, a tela inteira vira o estado vazio", () => {
      renderManager([]);

      expect(screen.getByText(legacy.noTableTypes)).toBeInTheDocument();
      expect(screen.queryByText(shell.noChanges)).not.toBeInTheDocument();
    });
  });

  describe("abas", () => {
    it("mostra as três, com a contagem de modelos no rótulo da terceira", () => {
      renderManager();

      expect(
        screen.getByRole("tab", { name: new RegExp(m.settings.presentation.tabs.columnsLayout) }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: new RegExp(m.settings.presentation.tabs.behavior) }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: new RegExp(m.settings.presentation.tabs.usedBy) }),
      ).toHaveTextContent("1");
    });
  });

  describe("rodapé de salvar", () => {
    it("começa sem alterações", () => {
      renderManager();

      expect(screen.getByText(shell.noChanges)).toBeInTheDocument();
    });

    it("salva SÓ o que mudou (§15 — `undefined` = 'não mencionei')", async () => {
      renderManager();

      await userEvent.type(screen.getByLabelText(legacy.nameLabel), "!");
      await userEvent.click(screen.getByRole("button", { name: t.saveLabel }));

      await waitFor(() => expect(updateTableTypeAction).toHaveBeenCalled());
      const [, payload] = updateTableTypeAction.mock.calls[0];
      expect(payload).toEqual({ tableTypeId: "tt-card", name: "Cartão de crédito!" });
    });

    it("trocar o layout conta 1 alteração e vai no payload", async () => {
      renderManager();

      await userEvent.click(screen.getByRole("radio", { name: t.rowLayout.columnsLabel }));
      expect(screen.getByText(shell.unsavedChanges(1))).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: t.saveLabel }));

      await waitFor(() => expect(updateTableTypeAction).toHaveBeenCalled());
      expect(updateTableTypeAction.mock.calls[0][1]).toEqual({
        tableTypeId: "tt-card",
        rowLayout: "columns",
      });
    });

    it("Descartar volta ao último salvo", async () => {
      renderManager();

      await userEvent.type(screen.getByLabelText(legacy.nameLabel), "!");
      await userEvent.click(screen.getByRole("button", { name: shell.discard }));

      expect(screen.getByLabelText(legacy.nameLabel)).toHaveValue("Cartão de crédito");
      expect(screen.getByText(shell.noChanges)).toBeInTheDocument();
    });

    it("rascunho de um tipo SOBREVIVE à troca de seleção", async () => {
      renderManager();

      await userEvent.type(screen.getByLabelText(legacy.nameLabel), "!");
      await userEvent.click(screen.getByRole("button", { name: /Reembolsos/ }));

      // O rodapé fala do tipo que está na tela — o outro rascunho não vaza.
      expect(screen.getByText(shell.noChanges)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /Cartão de crédito/ }));
      expect(screen.getByLabelText(legacy.nameLabel)).toHaveValue("Cartão de crédito!");
      expect(screen.getByText(shell.unsavedChanges(1))).toBeInTheDocument();
    });

    it("salvar atualiza o resumo da lista mestre sem recarregar", async () => {
      renderManager();

      await userEvent.click(screen.getByRole("radio", { name: t.rowLayout.columnsLabel }));
      await userEvent.click(screen.getByRole("button", { name: t.saveLabel }));

      await waitFor(() =>
        expect(screen.getAllByText(t.summary(4, t.rowLayout.columnsShort, 1)).length).toBe(1),
      );
    });
  });

  describe("excluir (a função que veio do accordion antigo)", () => {
    it("avisa quantas tabelas usam o tipo antes de confirmar", async () => {
      renderManager();

      await userEvent.click(screen.getByRole("button", { name: /Reembolsos/ }));
      await userEvent.click(screen.getByRole("button", { name: m.common.delete }));

      expect(screen.getByText(legacy.deleteWarning(3))).toBeInTheDocument();
    });

    it("o tipo padrão não oferece exclusão (o serviço a recusa)", async () => {
      renderManager([buildType({ isDefault: true })]);

      expect(screen.queryByRole("button", { name: m.common.delete })).not.toBeInTheDocument();
    });
  });

  describe("criar", () => {
    it("cria pelo diálogo e já seleciona o tipo novo", async () => {
      createTableTypeAction.mockResolvedValue(actionSuccess({ tableTypeId: "tt-new" }));
      renderManager();

      await userEvent.click(screen.getByRole("button", { name: t.createButton }));
      // O campo Nome existe nos DOIS lugares (aba 1 e diálogo) — daí o escopo.
      const dialog = within(screen.getByRole("dialog"));
      await userEvent.type(dialog.getByLabelText(legacy.nameLabel), "Investimentos");
      await userEvent.click(dialog.getByRole("button", { name: m.common.create }));

      await waitFor(() => expect(createTableTypeAction).toHaveBeenCalled());
      expect(createTableTypeAction).toHaveBeenCalledWith("acc-test-1", {
        name: "Investimentos",
        hiddenColumns: {},
      });
      // Tipo novo nasce com as 14 colunas (espelho do serviço) e sem modelo.
      await waitFor(() =>
        expect(screen.getByText(t.summary(14, t.rowLayout.columnsShort, 0))).toBeInTheDocument(),
      );
    });
  });
});
