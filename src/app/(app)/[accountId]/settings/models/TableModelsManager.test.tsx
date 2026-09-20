import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionSuccess } from "@/lib/action-result";
import { m } from "@/lib/messages";

import { TableModelsManager, type SettingsModel } from "./TableModelsManager";

vi.mock("next/navigation", () => ({
  useParams: () => ({ accountId: "acc-test-1" }),
}));

// A aba 2 monta o `ImportFromMonthDialog`, que importa a action de transações —
// sem o mock o módulo real arrasta o next-auth para dentro do jsdom.
const listTablesForMoveAction = vi.fn();
vi.mock("@/actions/transactions", () => ({
  listTablesForMoveAction: (...args: unknown[]) => listTablesForMoveAction(...args),
}));

const createTemplateManualAction = vi.fn();
const deleteTemplateAction = vi.fn();
const updateTemplateAction = vi.fn();
const addTemplateItemAction = vi.fn();
const deleteTemplateItemAction = vi.fn();
const importTemplateItemsFromTableAction = vi.fn();
vi.mock("@/actions/table-templates", () => ({
  createTemplateManualAction: (...args: unknown[]) => createTemplateManualAction(...args),
  deleteTemplateAction: (...args: unknown[]) => deleteTemplateAction(...args),
  updateTemplateAction: (...args: unknown[]) => updateTemplateAction(...args),
  addTemplateItemAction: (...args: unknown[]) => addTemplateItemAction(...args),
  deleteTemplateItemAction: (...args: unknown[]) => deleteTemplateItemAction(...args),
  importTemplateItemsFromTableAction: (...args: unknown[]) =>
    importTemplateItemsFromTableAction(...args),
}));

const t = m.settings.presentation.models;
const d = t.definition;
const shell = m.settings.shell;

function buildModel(overrides: Partial<SettingsModel> = {}): SettingsModel {
  return {
    id: "tpl-card",
    name: "Cartão Nubank",
    description: null,
    tableTypeId: "tt-card",
    countInMonth: true,
    autoApply: false,
    autoSectionId: null,
    orderInSection: null,
    tableType: { id: "tt-card", name: "Cartão de crédito" },
    items: [],
    ...overrides,
  };
}

const MODELS: SettingsModel[] = [
  buildModel({
    items: [
      {
        id: "item-1",
        day: 5,
        dayRule: "5",
        amountCents: "-12000",
        description: "Assinatura",
        notes: null,
        isPending: false,
        categoryId: null,
        subcategoryId: null,
        institutionId: null,
        responsiblePartyId: null,
        cardInstallment: null,
        investmentType: null,
        displayOrder: 0,
      },
    ],
  }),
  buildModel({
    id: "tpl-refund",
    name: "Reembolsos",
    tableTypeId: "tt-checking",
    tableType: { id: "tt-checking", name: "Conta corrente" },
    items: [],
  }),
];

function renderManager(models: SettingsModel[] = MODELS) {
  return render(
    <SnackbarProvider>
      <TableModelsManager
        accountId="acc-test-1"
        initialModels={models}
        categories={[]}
        institutions={[]}
        parties={[]}
        tableTypes={[
          {
            id: "tt-card",
            name: "Cartão de crédito",
            isDefault: true,
            rowLayout: "pills",
            density: "default",
            // Cartão NÃO mostra instituição — é o exemplo do frame e o caso que
            // prova a D5 (o campo migra para "Mais campos", a coluna some).
            visibleColumns: ["occurredOn", "description", "category", "responsibleUser", "amount"],
          },
          {
            id: "tt-checking",
            name: "Conta corrente",
            isDefault: false,
            rowLayout: "columns",
            density: "compact",
            visibleColumns: [
              "occurredOn",
              "description",
              "category",
              "institution",
              "responsibleUser",
              "amount",
            ],
          },
        ]}
        sections={[
          { id: "sec-cards", name: "Cartões", isActive: true },
          { id: "sec-old", name: "Antiga", isActive: false },
        ]}
        usageByModel={{ "tpl-card": { tables: 4, months: 3 } }}
      />
    </SnackbarProvider>,
  );
}

describe("TableModelsManager", () => {
  beforeEach(() => {
    createTemplateManualAction.mockReset();
    deleteTemplateAction.mockReset();
    updateTemplateAction.mockReset();
    updateTemplateAction.mockResolvedValue(actionSuccess({ id: "tpl-card" }));
  });

  describe("lista mestre", () => {
    it("resume cada modelo com o tipo e a contagem de transações", () => {
      renderManager();

      expect(screen.getByText("Cartão Nubank")).toBeInTheDocument();
      expect(screen.getByText(t.summary("Cartão de crédito", 1))).toBeInTheDocument();
      // Modelo sem transação sai como "vazio" (e esmaecido, como no frame 06).
      expect(screen.getByText(t.summary("Conta corrente", 0))).toBeInTheDocument();
    });

    it("abre o primeiro modelo por padrão", () => {
      renderManager();

      expect(screen.getByLabelText(d.nameLabel)).toHaveValue("Cartão Nubank");
    });

    it("selecionar outro modelo troca o detalhe", async () => {
      renderManager();

      await userEvent.click(screen.getByRole("button", { name: /Reembolsos/ }));

      expect(screen.getByLabelText(d.nameLabel)).toHaveValue("Reembolsos");
    });

    it("sem nenhum modelo, a tela inteira vira o estado vazio", () => {
      renderManager([]);

      expect(screen.getByText(m.tableModels.noModels)).toBeInTheDocument();
      expect(
        screen.queryByRole("navigation", { name: m.settings.presentation.masterListLabel }),
      ).not.toBeInTheDocument();
      // Sem modelo selecionado não há rodapé de salvar.
      expect(screen.queryByText(shell.noChanges)).not.toBeInTheDocument();
    });
  });

  describe("abas", () => {
    it("mostra as três abas, com a contagem de transações no rótulo", () => {
      renderManager();

      expect(
        screen.getByRole("tab", { name: new RegExp(m.settings.presentation.tabs.definition) }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("tab", {
          name: new RegExp(m.settings.presentation.tabs.modelTransactions),
        }),
      ).toHaveTextContent("1");
      expect(
        screen.getByRole("tab", { name: new RegExp(m.settings.presentation.tabs.usedBy) }),
      ).toBeInTheDocument();
    });

    it("a aba 2 é a mini-tabela editável — o diálogo de itens não existe mais", async () => {
      renderManager();

      await userEvent.click(
        screen.getByRole("tab", {
          name: new RegExp(m.settings.presentation.tabs.modelTransactions),
        }),
      );

      // A transação do modelo aparece na própria aba, com o dia relativo…
      expect(screen.getByText("Assinatura")).toBeInTheDocument();
      expect(screen.getByText(t.transactions.dayRule.fixed(5))).toBeInTheDocument();
      // …e a linha-fantasma substitui o botão "Editar itens" do editor antigo.
      expect(screen.getByRole("button", { name: t.transactions.addRow })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: m.tableModels.editItems }),
      ).not.toBeInTheDocument();
    });

    it("a faixa de contexto nomeia o tipo e o layout que desenham a linha", async () => {
      renderManager();

      await userEvent.click(
        screen.getByRole("tab", {
          name: new RegExp(m.settings.presentation.tabs.modelTransactions),
        }),
      );

      expect(
        screen.getByText(
          t.transactions.renderedWith(
            "Cartão de crédito",
            m.settings.presentation.tableTypes.rowLayout.pillsShort,
          ),
        ),
      ).toBeInTheDocument();
    });

    it("a aba 3 conta as tabelas nascidas do modelo e declara a data de corte", async () => {
      renderManager();

      await userEvent.click(
        screen.getByRole("tab", { name: new RegExp(m.settings.presentation.tabs.usedBy) }),
      );

      expect(screen.getByText(t.usedBy.result(4, 3))).toBeInTheDocument();
      expect(screen.getByText(/não guardam a origem/)).toBeInTheDocument();
    });
  });

  describe("rodapé de salvar", () => {
    it("começa sem alterações", () => {
      renderManager();

      expect(screen.getByText(shell.noChanges)).toBeInTheDocument();
    });

    it("editar o nome conta uma alteração", async () => {
      renderManager();

      await userEvent.type(screen.getByLabelText(d.nameLabel), "!");

      expect(screen.getByText(shell.unsavedChanges(1))).toBeInTheDocument();
    });

    it("Descartar volta ao último salvo", async () => {
      renderManager();

      await userEvent.type(screen.getByLabelText(d.nameLabel), "!");
      await userEvent.click(screen.getByRole("button", { name: shell.discard }));

      expect(screen.getByLabelText(d.nameLabel)).toHaveValue("Cartão Nubank");
      expect(screen.getByText(shell.noChanges)).toBeInTheDocument();
    });

    it("salva com o campo ÚNICO de tipo — sem tocar em autoTableTypeId (D7)", async () => {
      renderManager();

      await userEvent.type(screen.getByLabelText(d.nameLabel), "!");
      await userEvent.click(screen.getByRole("button", { name: t.saveLabel }));

      await waitFor(() => expect(updateTemplateAction).toHaveBeenCalled());
      const [, payload] = updateTemplateAction.mock.calls[0];
      expect(payload).toMatchObject({
        templateId: "tpl-card",
        name: "Cartão Nubank!",
        tableTypeId: "tt-card",
        autoApply: false,
      });
      expect(payload).not.toHaveProperty("autoTableTypeId");
      // Sem automação, a ordem não é mencionada — mencioná-la escreveria por engano.
      expect(payload).not.toHaveProperty("orderInSection");
    });

    it("alterações de um modelo sobrevivem à troca de seleção", async () => {
      renderManager();

      await userEvent.type(screen.getByLabelText(d.nameLabel), "!");
      await userEvent.click(screen.getByRole("button", { name: /Reembolsos/ }));
      expect(screen.getByText(shell.noChanges)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /Cartão Nubank/ }));
      expect(screen.getByLabelText(d.nameLabel)).toHaveValue("Cartão Nubank!");
    });
  });
});
