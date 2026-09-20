import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionSuccess } from "@/lib/action-result";
import { m } from "@/lib/messages";

import type { ModelItem } from "./model-item-draft";
import { ModelTransactionsTab, type ModelTransactionsTabProps } from "./ModelTransactionsTab";

const listTablesForMoveAction = vi.fn();
vi.mock("@/actions/transactions", () => ({
  listTablesForMoveAction: (...args: unknown[]) => listTablesForMoveAction(...args),
}));

const addTemplateItemAction = vi.fn();
const updateTemplateItemAction = vi.fn();
const deleteTemplateItemAction = vi.fn();
const importTemplateItemsFromTableAction = vi.fn();
vi.mock("@/actions/table-templates", () => ({
  addTemplateItemAction: (...args: unknown[]) => addTemplateItemAction(...args),
  updateTemplateItemAction: (...args: unknown[]) => updateTemplateItemAction(...args),
  deleteTemplateItemAction: (...args: unknown[]) => deleteTemplateItemAction(...args),
  importTemplateItemsFromTableAction: (...args: unknown[]) =>
    importTemplateItemsFromTableAction(...args),
}));

const t = m.settings.presentation.models.transactions;
const f = m.transactions.fields;
const rowMenu = m.settings.shell.rowMenu;
const tImport = m.settings.presentation.models.importFromMonth;

function buildItem(overrides: Partial<ModelItem> = {}): ModelItem {
  return {
    id: "item-1",
    day: 5,
    dayRule: "5",
    amountCents: "-5590",
    description: "Netflix",
    notes: "cobrança anual",
    isPending: false,
    categoryId: "cat-sub",
    subcategoryId: null,
    institutionId: null,
    responsiblePartyId: null,
    cardInstallment: null,
    investmentType: null,
    displayOrder: 0,
    ...overrides,
  };
}

const LOOKUPS = {
  categories: [
    { id: "cat-sub", name: "Assinaturas", subcategories: [{ id: "sub-1", name: "Streaming" }] },
    { id: "cat-health", name: "Saúde", subcategories: [] },
  ],
  institutions: [{ id: "inst-1", name: "Nubank" }],
  parties: [
    {
      id: "party-1",
      name: "Gabriel",
      kind: "personal" as const,
      icon: null,
      color: null,
      imageUrl: null,
    },
  ],
};

/** Cartão de crédito: pílulas, SEM instituição — o exemplo do frame 06b. */
const CARD_TYPE = {
  name: "Cartão de crédito",
  rowLayout: "pills" as const,
  density: "default" as const,
  visibleColumns: ["occurredOn", "description", "category", "responsibleUser", "amount"] as const,
};

/** Conta corrente: colunas, COM instituição — o outro lado da D5. */
const CHECKING_TYPE = {
  name: "Conta corrente",
  rowLayout: "columns" as const,
  density: "compact" as const,
  visibleColumns: [
    "occurredOn",
    "description",
    "category",
    "institution",
    "responsibleUser",
    "amount",
  ] as const,
};

function renderTab(overrides: Partial<ModelTransactionsTabProps> = {}) {
  const onItemsChanged = vi.fn();

  const view = render(
    <SnackbarProvider>
      <ModelTransactionsTab
        accountId="acc-test-1"
        model={{ id: "tpl-1", name: "Cartão Nubank", items: [buildItem()] }}
        tableType={CARD_TYPE}
        lookups={LOOKUPS}
        onItemsChanged={onItemsChanged}
        {...overrides}
      />
    </SnackbarProvider>,
  );

  return { ...view, onItemsChanged };
}

/** Abre a linha-fantasma e devolve os campos da linha de criação. */
async function openGhostRow() {
  await userEvent.click(screen.getByRole("button", { name: t.addRow }));
}

/** Abre o menu ⋮ de uma linha e clica num item. */
async function openRowMenu(rowName: string, itemLabel: string) {
  await userEvent.click(screen.getByRole("button", { name: `${rowMenu.trigger}: ${rowName}` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: itemLabel }));
}

describe("ModelTransactionsTab", () => {
  beforeEach(() => {
    addTemplateItemAction.mockReset();
    updateTemplateItemAction.mockReset();
    deleteTemplateItemAction.mockReset();
    addTemplateItemAction.mockResolvedValue(actionSuccess({ id: "item-novo" }));
    updateTemplateItemAction.mockResolvedValue(actionSuccess({ id: "item-1" }));
    deleteTemplateItemAction.mockResolvedValue(actionSuccess(undefined));
    importTemplateItemsFromTableAction.mockReset();
    listTablesForMoveAction.mockReset();
    listTablesForMoveAction.mockResolvedValue(
      actionSuccess({
        months: [{ id: "month-7", year: 2026, month: 7, label: "julho de 2026" }],
        sections: [],
        tables: [
          {
            id: "tbl-1",
            name: "Cartão Nubank",
            monthId: "month-7",
            sectionId: "sec-1",
            _count: { transactions: 4 },
          },
          {
            id: "tbl-vazia",
            name: "Tabela vazia",
            monthId: "month-7",
            sectionId: "sec-1",
            _count: { transactions: 0 },
          },
        ],
        tableTypes: [],
        invertSignOnMoveByDefault: true,
      }),
    );
  });

  describe("faixa de contexto", () => {
    it("nomeia o tipo e o layout que desenham a linha", () => {
      renderTab();

      expect(
        screen.getByText(
          t.renderedWith(
            "Cartão de crédito",
            m.settings.presentation.tableTypes.rowLayout.pillsShort,
          ),
        ),
      ).toBeInTheDocument();
    });

    it("sem tipo escolhido, manda o usuário à aba Definição", () => {
      renderTab({ tableType: null });

      expect(screen.getByText(t.renderedWithNoType)).toBeInTheDocument();
    });
  });

  describe("leitura", () => {
    it("mostra o dia relativo, não uma data", () => {
      renderTab({
        model: { id: "tpl-1", name: "M", items: [buildItem({ dayRule: "last" })] },
      });

      expect(screen.getByText(t.dayRule.last)).toBeInTheDocument();
    });

    it("valor 0,00 ganha o aviso 'criada em branco'", () => {
      renderTab({
        model: { id: "tpl-1", name: "M", items: [buildItem({ amountCents: "0" })] },
      });

      expect(screen.getByText(t.blankAmountHint)).toBeInTheDocument();
    });

    it("item parcelado mostra o chip da parcela na descrição", () => {
      renderTab({
        model: { id: "tpl-1", name: "M", items: [buildItem({ cardInstallment: "3/12" })] },
      });

      expect(screen.getByText("3/12")).toBeInTheDocument();
    });

    it("soma o total do modelo em BigInt", () => {
      renderTab({
        model: {
          id: "tpl-1",
          name: "M",
          items: [
            buildItem({ amountCents: "-5590" }),
            buildItem({ id: "i2", amountCents: "-3490" }),
          ],
        },
      });

      expect(screen.getByText(/Total do modelo/)).toHaveTextContent("90,80");
    });

    it("modelo vazio cai no estado vazio, com a explicação do dia relativo", () => {
      renderTab({ model: { id: "tpl-1", name: "M", items: [] } });

      expect(screen.getByText(t.empty)).toBeInTheDocument();
      expect(screen.getAllByText(t.hint).length).toBeGreaterThan(0);
    });
  });

  describe("coluna Instituição (D5)", () => {
    it("não aparece quando o tipo do modelo não mostra instituição", () => {
      renderTab({
        model: { id: "tpl-1", name: "M", items: [buildItem({ institutionId: "inst-1" })] },
        tableType: CARD_TYPE,
      });

      expect(screen.queryByText("Nubank")).not.toBeInTheDocument();
    });

    it("aparece quando o tipo mostra instituição", () => {
      renderTab({
        model: { id: "tpl-1", name: "M", items: [buildItem({ institutionId: "inst-1" })] },
        tableType: CHECKING_TYPE,
      });

      expect(screen.getByText("Nubank")).toBeInTheDocument();
    });

    it("o CAMPO continua editável em 'Mais campos' quando a coluna some", async () => {
      renderTab({ tableType: CARD_TYPE });
      await openGhostRow();

      // Fora da linha, o campo não existe…
      expect(screen.queryByLabelText(f.institution)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: t.moreFields }));

      // …mas o painel de mais campos o oferece — o dado nunca fica inalcançável.
      expect(await screen.findByLabelText(f.institution)).toBeInTheDocument();
    });

    it("quando a coluna existe, 'Mais campos' não duplica o campo", async () => {
      renderTab({ tableType: CHECKING_TYPE });
      await openGhostRow();
      await userEvent.click(screen.getByRole("button", { name: t.moreFields }));

      expect(screen.getAllByLabelText(f.institution)).toHaveLength(1);
    });
  });

  describe("linha-fantasma", () => {
    it("abre a linha de criação com os dois botões visíveis", async () => {
      renderTab();
      await openGhostRow();

      expect(screen.getByLabelText(t.columnDescription)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: `${m.common.cancel}: ${t.newButton}` }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: `${m.common.save}: ${t.newButton}` }),
      ).toBeInTheDocument();
    });

    it("não grava uma linha que não diz nada", async () => {
      renderTab();
      await openGhostRow();

      expect(
        screen.getByRole("button", { name: `${m.common.save}: ${t.newButton}` }),
      ).toBeDisabled();
    });

    it("Enter grava e REABRE a linha para a próxima transação", async () => {
      const { onItemsChanged } = renderTab();
      await openGhostRow();

      const description = screen.getByLabelText(t.columnDescription);
      await userEvent.type(description, "Seguro do carro{Enter}");

      await waitFor(() => expect(addTemplateItemAction).toHaveBeenCalled());
      expect(onItemsChanged).toHaveBeenCalled();
      // A linha continua aberta e limpa — quem monta um modelo digita várias.
      await waitFor(() => expect(screen.getByLabelText(t.columnDescription)).toHaveValue(""));
    });

    it("Esc cancela e devolve a linha-fantasma", async () => {
      renderTab();
      await openGhostRow();

      await userEvent.type(screen.getByLabelText(t.columnDescription), "Seguro{Escape}");

      expect(addTemplateItemAction).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: t.addRow })).toBeInTheDocument();
    });

    it("grava o dia relativo escolhido, não uma data", async () => {
      renderTab();
      await openGhostRow();

      await userEvent.type(screen.getByLabelText(t.columnDescription), "Anuidade");
      await userEvent.click(screen.getByLabelText(t.dayRule.label));
      await userEvent.click(await screen.findByRole("option", { name: t.dayRule.last }));
      await userEvent.click(
        screen.getByRole("button", { name: `${m.common.save}: ${t.newButton}` }),
      );

      await waitFor(() => expect(addTemplateItemAction).toHaveBeenCalled());
      const [, payload] = addTemplateItemAction.mock.calls[0];
      expect(payload).toMatchObject({ templateId: "tpl-1", dayRule: "last", amountCents: 0n });
    });
  });

  describe("editar e excluir pela linha", () => {
    it("o menu ⋮ abre a edição inline com os valores atuais", async () => {
      renderTab();

      await openRowMenu("Netflix", rowMenu.edit);

      expect(screen.getByLabelText(t.columnDescription)).toHaveValue("Netflix");
      expect(screen.getByLabelText(t.columnCategory)).toHaveTextContent("Assinaturas");
    });

    it("salvar manda o item inteiro, campo a campo", async () => {
      const { onItemsChanged } = renderTab();
      await openRowMenu("Netflix", rowMenu.edit);

      await userEvent.clear(screen.getByLabelText(t.columnDescription));
      await userEvent.type(screen.getByLabelText(t.columnDescription), "Netflix 4K");
      await userEvent.click(screen.getByRole("button", { name: `${m.common.save}: Netflix` }));

      await waitFor(() => expect(updateTemplateItemAction).toHaveBeenCalled());
      const [, payload] = updateTemplateItemAction.mock.calls[0];
      expect(payload).toMatchObject({ itemId: "item-1", description: "Netflix 4K" });
      // A nota que veio do banco volta intacta: o rascunho a carrega, então o
      // update parcial não a apaga.
      expect(payload.notes).toBe("cobrança anual");
      expect(onItemsChanged).toHaveBeenCalled();
    });

    it("cancelar não chama a action", async () => {
      renderTab();
      await openRowMenu("Netflix", rowMenu.edit);

      await userEvent.click(screen.getByRole("button", { name: `${m.common.cancel}: Netflix` }));

      expect(updateTemplateItemAction).not.toHaveBeenCalled();
      expect(screen.getByText("Netflix")).toBeInTheDocument();
    });

    it("excluir remove a transação do modelo", async () => {
      const { onItemsChanged } = renderTab();

      await openRowMenu("Netflix", rowMenu.delete);

      await waitFor(() =>
        expect(deleteTemplateItemAction).toHaveBeenCalledWith("acc-test-1", { itemId: "item-1" }),
      );
      expect(onItemsChanged).toHaveBeenCalledWith([]);
    });

    it("a subcategoria segue a categoria escolhida", async () => {
      renderTab();
      await openRowMenu("Netflix", rowMenu.edit);
      await userEvent.click(screen.getByRole("button", { name: t.moreFields }));

      const subcategory = await screen.findByLabelText(f.subcategory);
      await userEvent.click(subcategory);
      expect(
        within(await screen.findByRole("listbox")).getByRole("option", { name: "Streaming" }),
      ).toBeInTheDocument();
    });
  });

  describe("importar de um mês", () => {
    async function openImportDialog() {
      await userEvent.click(screen.getByRole("button", { name: tImport.button }));
      // O diálogo só busca meses/tabelas quando ABRE.
      await waitFor(() => expect(listTablesForMoveAction).toHaveBeenCalled());
    }

    it("não busca meses antes de o diálogo abrir", () => {
      renderTab();

      expect(listTablesForMoveAction).not.toHaveBeenCalled();
    });

    it("promete no texto que as transações atuais são mantidas", async () => {
      renderTab();
      await openImportDialog();

      expect(await screen.findByText(tImport.description)).toBeInTheDocument();
    });

    it("mostra quantas transações entram ANTES de confirmar", async () => {
      renderTab();
      await openImportDialog();

      await userEvent.click(await screen.findByLabelText(tImport.monthLabel));
      await userEvent.click(await screen.findByRole("option", { name: "julho de 2026" }));
      await userEvent.click(screen.getByLabelText(tImport.tableLabel));
      await userEvent.click(await screen.findByRole("option", { name: "Cartão Nubank" }));

      expect(await screen.findByText(tImport.preview(4))).toBeInTheDocument();
      // Nada foi importado ainda — o número é preview, não resultado.
      expect(importTemplateItemsFromTableAction).not.toHaveBeenCalled();
    });

    it("tabela sem transações não deixa confirmar", async () => {
      renderTab();
      await openImportDialog();

      await userEvent.click(await screen.findByLabelText(tImport.monthLabel));
      await userEvent.click(await screen.findByRole("option", { name: "julho de 2026" }));
      await userEvent.click(screen.getByLabelText(tImport.tableLabel));
      await userEvent.click(await screen.findByRole("option", { name: "Tabela vazia" }));

      expect(screen.getByRole("button", { name: tImport.confirm })).toBeDisabled();
    });

    it("importar SUBSTITUI a lista pela que o servidor devolve — com a antiga na frente", async () => {
      const importedList = [
        buildItem({ id: "item-1", displayOrder: 0 }),
        buildItem({ id: "novo-1", description: "Spotify", displayOrder: 1 }),
      ];
      importTemplateItemsFromTableAction.mockResolvedValue(
        actionSuccess({ imported: 1, items: importedList }),
      );

      const { onItemsChanged } = renderTab();
      await openImportDialog();

      await userEvent.click(await screen.findByLabelText(tImport.monthLabel));
      await userEvent.click(await screen.findByRole("option", { name: "julho de 2026" }));
      await userEvent.click(screen.getByLabelText(tImport.tableLabel));
      await userEvent.click(await screen.findByRole("option", { name: "Cartão Nubank" }));
      await userEvent.click(screen.getByRole("button", { name: tImport.confirm }));

      await waitFor(() =>
        expect(importTemplateItemsFromTableAction).toHaveBeenCalledWith("acc-test-1", {
          templateId: "tpl-1",
          tableId: "tbl-1",
        }),
      );
      // A transação que já existia continua na lista, e na frente da importada.
      expect(onItemsChanged).toHaveBeenCalledWith(importedList);
      expect(onItemsChanged.mock.calls.at(-1)![0][0].id).toBe("item-1");
    });
  });

  describe("reordenar", () => {
    it("cada linha tem alça de arraste com nome próprio", () => {
      renderTab({
        model: {
          id: "tpl-1",
          name: "M",
          items: [buildItem(), buildItem({ id: "i2", description: "Spotify" })],
        },
      });

      expect(
        screen.getByRole("button", { name: `${m.settings.structure.dragHandleLabel}: Netflix` }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: `${m.settings.structure.dragHandleLabel}: Spotify` }),
      ).toBeInTheDocument();
    });

    it("a alça some enquanto uma linha está em edição", async () => {
      renderTab();
      await openRowMenu("Netflix", rowMenu.edit);

      expect(
        screen.queryByRole("button", { name: `${m.settings.structure.dragHandleLabel}: Netflix` }),
      ).not.toBeInTheDocument();
    });
  });
});
