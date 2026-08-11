import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionSuccess } from "@/lib/action-result";
import { m } from "@/lib/messages";

import type { CategoryItem, SubcategoryItem } from "./categories-tree";
import { CategoriesManager } from "./CategoriesManager";

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ accountId: "acc-test-1" }),
  useRouter: () => ({ refresh: routerRefresh }),
}));

const createCategoryAction = vi.fn();
const updateCategoryAction = vi.fn();
const deleteCategoryAction = vi.fn();
const createSubcategoryAction = vi.fn();
const updateSubcategoryAction = vi.fn();
const deleteSubcategoryAction = vi.fn();
const reorderCategoriesAction = vi.fn();
const reorderSubcategoriesAction = vi.fn();
vi.mock("@/actions/account-settings", () => ({
  createCategoryAction: (...args: unknown[]) => createCategoryAction(...args),
  updateCategoryAction: (...args: unknown[]) => updateCategoryAction(...args),
  deleteCategoryAction: (...args: unknown[]) => deleteCategoryAction(...args),
  createSubcategoryAction: (...args: unknown[]) => createSubcategoryAction(...args),
  updateSubcategoryAction: (...args: unknown[]) => updateSubcategoryAction(...args),
  deleteSubcategoryAction: (...args: unknown[]) => deleteSubcategoryAction(...args),
  reorderCategoriesAction: (...args: unknown[]) => reorderCategoriesAction(...args),
  reorderSubcategoriesAction: (...args: unknown[]) => reorderSubcategoriesAction(...args),
}));

// M5 (Mesclar) e M2 (excluir com realocação) chamam estas duas por baixo dos panos,
// dentro de `MergeDialog`/`DeleteWithReallocationDialog` — mesmo padrão de mock dos
// testes desses dois diálogos.
const getConfigReferencesAction = vi.fn();
const mergeEntityAction = vi.fn();
vi.mock("@/actions/settings-merge", () => ({
  getConfigReferencesAction: (...args: unknown[]) => getConfigReferencesAction(...args),
  mergeEntityAction: (...args: unknown[]) => mergeEntityAction(...args),
}));

const countUsageAction = vi.fn();
vi.mock("@/actions/settings-usage", () => ({
  countUsageAction: (...args: unknown[]) => countUsageAction(...args),
}));

// `ImportCategoriesDialog` (M4) fica montado (fechado) na página inteira — mesmo sem
// abrir, o módulo importa `@/actions/settings-import`, que puxa `defineAction`/auth.
// Mock aqui evita a resolução real de next-auth no teste (mesmo padrão de
// `ImportCategoriesDialog.test.tsx`).
vi.mock("@/actions/settings-import", () => ({
  previewCategoryImportAction: vi.fn(),
  importCategoriesAction: vi.fn(),
}));

const t = m.settings.structure.categories;
const rowMenu = m.settings.shell.rowMenu;

function buildCategory(overrides: Partial<CategoryItem> = {}): CategoryItem {
  return {
    id: "cat-1",
    name: "Alimentação",
    order: 0,
    status: "active",
    lastUsedAt: null,
    subcategories: [],
    ...overrides,
  };
}

function buildSubcategory(overrides: Partial<SubcategoryItem> = {}): SubcategoryItem {
  return {
    id: "sub-1",
    name: "Mercado",
    order: 0,
    status: "active",
    lastUsedAt: null,
    ...overrides,
  };
}

function renderManager(categories: CategoryItem[] = [buildCategory()]) {
  return render(
    <SnackbarProvider>
      <CategoriesManager accountId="acc-test-1" initialCategories={categories} />
    </SnackbarProvider>,
  );
}

/** Abre o menu "⋮" da linha e clica no item de rótulo `itemLabel`. */
async function openRowMenuAndClick(rowName: string, itemLabel: string) {
  await userEvent.click(screen.getByRole("button", { name: `${rowMenu.trigger}: ${rowName}` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: itemLabel }));
}

describe("CategoriesManager", () => {
  beforeEach(() => {
    createCategoryAction.mockReset();
    updateCategoryAction.mockReset();
    deleteCategoryAction.mockReset();
    createSubcategoryAction.mockReset();
    updateSubcategoryAction.mockReset();
    deleteSubcategoryAction.mockReset();
    reorderCategoriesAction.mockReset();
    reorderSubcategoriesAction.mockReset();
    getConfigReferencesAction.mockReset();
    mergeEntityAction.mockReset();
    countUsageAction.mockReset();
    routerRefresh.mockReset();
  });

  it("renderiza a categoria e o chip de contagem do cabeçalho", () => {
    renderManager([
      buildCategory({ id: "cat-1", name: "Alimentação", subcategories: [buildSubcategory()] }),
      buildCategory({ id: "cat-2", name: "Moradia" }),
    ]);

    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Moradia")).toBeInTheDocument();
    expect(screen.getByText(m.settings.hub.counts.categories(2, 1))).toBeInTheDocument();
  });

  it("expandir a categoria mostra a subcategoria sem coluna de seção (saiu da UI)", async () => {
    renderManager([
      buildCategory({
        id: "cat-1",
        name: "Alimentação",
        subcategories: [buildSubcategory({ id: "sub-1", name: "Mercado" })],
      }),
    ]);

    await userEvent.click(screen.getByRole("button", { name: t.expandRow("Alimentação") }));

    expect(await screen.findByText("Mercado")).toBeInTheDocument();
    const subRow = screen.getByText("Mercado").closest("tr")!;
    // "Seção padrão" saiu inteira da tabela: nem Select, nem o chip "herda" que só
    // existia para dizer que a subcategoria herdava a seção do pai.
    expect(within(subRow).queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText("herda")).not.toBeInTheDocument();
  });

  it("expõe verUso e mesclar na linha de categoria, mas não duplicar (Spec 68 §9 P8)", async () => {
    renderManager([buildCategory({ name: "Alimentação" })]);

    await userEvent.click(screen.getByRole("button", { name: `${rowMenu.trigger}: Alimentação` }));

    expect(screen.getByRole("menuitem", { name: rowMenu.viewUsage })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: rowMenu.merge })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: rowMenu.duplicate })).not.toBeInTheDocument();
  });

  it("'Ver uso' abre o UsageDialog da categoria (M3)", async () => {
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 8,
        months: 2,
        byMonth: [],
        countedAt: new Date("2026-08-10T12:00:00.000Z"),
        fromCache: true,
      }),
    );
    renderManager([buildCategory({ id: "cat-1", name: "Alimentação" })]);

    await openRowMenuAndClick("Alimentação", rowMenu.viewUsage);

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(m.settings.structureDialogs.usage.title("Alimentação")),
    ).toBeInTheDocument();
    expect(countUsageAction).toHaveBeenCalledWith("acc-test-1", {
      entity: "category",
      entityId: "cat-1",
    });
  });

  it("'Mesclar' abre o MergeDialog com a linha de origem pré-selecionada em Absorver", async () => {
    getConfigReferencesAction.mockResolvedValue(actionSuccess({ groups: [], total: 0 }));
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 0,
        months: 0,
        byMonth: [],
        countedAt: new Date("2026-08-10T12:00:00.000Z"),
        fromCache: true,
      }),
    );
    const mergeT = m.settings.structureDialogs.merge;
    renderManager([
      buildCategory({ id: "cat-1", name: "Restaurantes" }),
      buildCategory({ id: "cat-2", name: "Restaurante" }),
    ]);

    await openRowMenuAndClick("Restaurantes", rowMenu.merge);

    const dialog = await screen.findByRole("dialog");
    // "Absorver" já vem com a linha de onde o menu foi aberto.
    expect(within(dialog).getByLabelText(mergeT.absorbLabel)).toHaveTextContent("Restaurantes");
  });

  it("exclusão de categoria passa pelo M2: sem destino chama deleteCategoryAction", async () => {
    getConfigReferencesAction.mockResolvedValue(actionSuccess({ groups: [], total: 0 }));
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 0,
        months: 0,
        byMonth: [],
        countedAt: new Date("2026-08-10T12:00:00.000Z"),
        fromCache: true,
      }),
    );
    deleteCategoryAction.mockResolvedValue(actionSuccess(undefined));
    const removeT = m.settings.structureDialogs.remove;
    renderManager([buildCategory({ id: "cat-1", name: "Alimentação" })]);

    await openRowMenuAndClick("Alimentação", rowMenu.delete);

    // M2 (não a confirmação simples de antes): pede um destino de realocação.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(removeT.noTransactions)).toBeInTheDocument();
    const confirmButton = within(dialog).getByRole("button", { name: removeT.confirmSimple });
    expect(confirmButton).toBeEnabled();

    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteCategoryAction).toHaveBeenCalledWith("acc-test-1", { categoryId: "cat-1" });
    });
    expect(mergeEntityAction).not.toHaveBeenCalled();
    expect(screen.queryByText("Alimentação")).not.toBeInTheDocument();
  });

  it("exclusão de categoria com destino escolhido chama mergeEntityAction (M2 = mesclar)", async () => {
    getConfigReferencesAction.mockResolvedValue(
      actionSuccess({ groups: [{ kind: "aliases", count: 1 }], total: 1 }),
    );
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 3,
        months: 1,
        byMonth: [],
        countedAt: new Date("2026-08-10T12:00:00.000Z"),
        fromCache: true,
      }),
    );
    mergeEntityAction.mockResolvedValue(
      actionSuccess({
        transactions: 3,
        aliases: 1,
        templateItems: 0,
        templateDefaults: 0,
        widgetFilters: 0,
        subcategories: 0,
      }),
    );
    const removeT = m.settings.structureDialogs.remove;
    renderManager([
      buildCategory({ id: "cat-1", name: "Restaurantes" }),
      buildCategory({ id: "cat-2", name: "Restaurante" }),
    ]);

    await openRowMenuAndClick("Restaurantes", rowMenu.delete);

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(removeT.transactionCount(3, 1));

    await userEvent.click(within(dialog).getByLabelText(removeT.reallocateTo));
    await userEvent.click(await screen.findByRole("option", { name: "Restaurante" }));

    await userEvent.click(
      within(dialog).getByRole("button", { name: removeT.confirmWithTotal(4) }),
    );

    await waitFor(() => {
      expect(mergeEntityAction).toHaveBeenCalledWith("acc-test-1", {
        entity: "category",
        absorbedId: "cat-1",
        keptId: "cat-2",
      });
    });
    expect(deleteCategoryAction).not.toHaveBeenCalled();
    expect(screen.queryByText("Restaurantes")).not.toBeInTheDocument();
  });

  describe("menu 'Importar / Exportar' (Spec 68 §2.2)", () => {
    beforeEach(() => {
      // jsdom não implementa Blob URL — stub mínimo para o export não estourar.
      URL.createObjectURL = vi.fn(() => "blob:mock-url");
      URL.revokeObjectURL = vi.fn();
    });

    it("abre com três itens: Importar categorias, Exportar CSV e Exportar JSON", async () => {
      renderManager([]);

      await userEvent.click(screen.getByRole("button", { name: t.importExport }));

      expect(await screen.findByRole("menuitem", { name: t.importMenuItem })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: t.exportCsvMenuItem })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: t.exportJsonMenuItem })).toBeInTheDocument();
    });

    it("'Importar categorias…' abre o ImportCategoriesDialog", async () => {
      renderManager([]);

      await userEvent.click(screen.getByRole("button", { name: t.importExport }));
      await userEvent.click(await screen.findByRole("menuitem", { name: t.importMenuItem }));

      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog).getByText(m.settings.structureDialogs.import.title),
      ).toBeInTheDocument();
    });

    it("'Exportar CSV' baixa um CSV sem abrir diálogo", async () => {
      renderManager([buildCategory({ name: "Alimentação" })]);

      await userEvent.click(screen.getByRole("button", { name: t.importExport }));
      await userEvent.click(await screen.findByRole("menuitem", { name: t.exportCsvMenuItem }));

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("'Exportar JSON' baixa um JSON sem abrir diálogo", async () => {
      renderManager([buildCategory({ name: "Alimentação" })]);

      await userEvent.click(screen.getByRole("button", { name: t.importExport }));
      await userEvent.click(await screen.findByRole("menuitem", { name: t.exportJsonMenuItem }));

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("cria uma categoria pela linha-fantasma (sem modal) e reabre a próxima linha", async () => {
    createCategoryAction.mockResolvedValue({ ok: true, data: { categoryId: "cat-new" } });
    renderManager([]);

    await userEvent.click(screen.getByRole("button", { name: t.addRow }));
    await userEvent.type(screen.getByPlaceholderText(m.settings.categories.nameLabel), "Lazer");
    await userEvent.keyboard("{Enter}");

    expect(createCategoryAction).toHaveBeenCalledWith("acc-test-1", { name: "Lazer" });
    expect(await screen.findByText("Lazer")).toBeInTheDocument();
    // SET-08: Enter grava E reabre a linha — o campo continua na tela, vazio.
    expect(screen.getByPlaceholderText(m.settings.categories.nameLabel)).toHaveValue("");
  });

  it("cria uma subcategoria pela linha-fantasma da categoria expandida", async () => {
    createSubcategoryAction.mockResolvedValue({ ok: true, data: { subcategoryId: "sub-new" } });
    renderManager([buildCategory({ id: "cat-1", name: "Alimentação", subcategories: [] })]);

    await userEvent.click(screen.getByRole("button", { name: t.expandRow("Alimentação") }));
    await userEvent.click(await screen.findByRole("button", { name: t.addSubRow }));
    await userEvent.type(
      screen.getByPlaceholderText(m.settings.categories.nameLabel),
      "Restaurante",
    );
    await userEvent.keyboard("{Enter}");

    expect(createSubcategoryAction).toHaveBeenCalledWith("acc-test-1", {
      categoryId: "cat-1",
      name: "Restaurante",
    });
    expect(await screen.findByText("Restaurante")).toBeInTheDocument();
  });

  it("alterna o Switch para ativar sem pedir confirmação", async () => {
    updateCategoryAction.mockResolvedValue({ ok: true });
    renderManager([buildCategory({ status: "inactive" })]);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(updateCategoryAction).toHaveBeenCalledWith("acc-test-1", {
      categoryId: "cat-1",
      name: "Alimentação",
      status: "active",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("desativar pelo Switch pede confirmação (M8) antes de gravar", async () => {
    updateCategoryAction.mockResolvedValue({ ok: true });
    renderManager([buildCategory({ name: "Alimentação", status: "active" })]);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(updateCategoryAction).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(t.deactivateTitle("Alimentação"))).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: rowMenu.deactivate }));

    expect(updateCategoryAction).toHaveBeenCalledWith("acc-test-1", {
      categoryId: "cat-1",
      name: "Alimentação",
      status: "inactive",
    });
  });

  it("editar pelo menu troca o nome para um campo, e o check grava", async () => {
    updateCategoryAction.mockResolvedValue({ ok: true });
    renderManager([buildCategory({ name: "Alimentação" })]);

    await openRowMenuAndClick("Alimentação", rowMenu.edit);

    const nameField = screen.getByDisplayValue("Alimentação");
    await userEvent.clear(nameField);
    await userEvent.type(nameField, "Restaurantes");
    await userEvent.click(screen.getByRole("button", { name: `${m.common.save}: Alimentação` }));

    expect(updateCategoryAction).toHaveBeenCalledWith("acc-test-1", {
      categoryId: "cat-1",
      name: "Restaurantes",
    });
  });

  // A confirmação simples de exclusão (botão "Deletar" via `m.common.delete`) foi
  // substituída pelo M2 (`DeleteWithReallocationDialog`) para categoria — ver
  // "exclusão de categoria passa pelo M2..." acima, que cobre o mesmo cenário com o
  // fluxo novo (referências + uso contados na hora, destino de realocação).
  //
  // O teste "trocar a seção padrão pelo Select" saiu daqui: a coluna "Seção padrão"
  // não existe mais (revisão de estilo) — não há mais Select nenhum na linha da
  // categoria fora do modo de edição de nome.

  describe("busca e filtro (Spec 68 §4)", () => {
    // Toolbar só aparece acima de 12 itens (gate do SettingsPageShell) — o fixture
    // precisa de massa suficiente para exercitar a busca de verdade, não só a
    // função pura (já coberta em categories-tree.test.ts).
    function manyCategories(): CategoryItem[] {
      // Gate do SettingsPageShell é `itemCount > 12` — 12 filler + 1 = 13 total.
      const base = Array.from({ length: 12 }, (_, i) =>
        buildCategory({ id: `cat-filler-${i}`, name: `Categoria ${i}`, order: i }),
      );
      return [
        ...base,
        buildCategory({
          id: "cat-moradia",
          name: "Moradia",
          order: 12,
          subcategories: [buildSubcategory({ id: "sub-aluguel", name: "Aluguel" })],
        }),
      ];
    }

    it("busca que casa uma subcategoria mantém o pai visível", async () => {
      renderManager(manyCategories());

      await userEvent.type(
        screen.getByRole("textbox", { name: m.settings.shell.searchLabel }),
        "aluguel",
      );

      expect(await screen.findByText("Moradia")).toBeInTheDocument();
      expect(screen.getByText("Aluguel")).toBeInTheDocument();
      expect(screen.queryByText("Categoria 0")).not.toBeInTheDocument();
    });

    it("busca sem nenhuma correspondência mostra o estado vazio de busca", async () => {
      renderManager(manyCategories());

      await userEvent.type(
        screen.getByRole("textbox", { name: m.settings.shell.searchLabel }),
        "zzzznada",
      );

      expect(await screen.findByText(m.settings.shell.searchNoResults)).toBeInTheDocument();
    });
  });
  // Regressão de um bug encontrado na tela: a lista era SEMPRE cortada em
  // `rowsPerPage` (20), mas o controle de paginação só aparecia acima de 50 itens.
  // Numa conta com 37 categorias, 17 ficavam invisíveis e inalcançáveis — a lista
  // parava no meio do alfabeto. Corte e controle agora saem do MESMO booleano.
  describe("paginação: cortar e mostrar o controle são a mesma decisão", () => {
    /** N categorias com nomes sequenciais, para conferir a primeira e a última. */
    function manyCategories(count: number): CategoryItem[] {
      return Array.from({ length: count }, (_, i) =>
        buildCategory({
          id: `cat-${i}`,
          name: `Categoria ${String(i).padStart(3, "0")}`,
          order: i,
        }),
      );
    }

    it("abaixo do limiar, mostra TODAS as categorias e nenhum controle", () => {
      renderManager(manyCategories(37));

      // A última do alfabeto tem de estar na tela, não escondida numa página 2
      // que o usuário não tem como abrir.
      expect(screen.getByText("Categoria 000")).toBeInTheDocument();
      expect(screen.getByText("Categoria 036")).toBeInTheDocument();
      expect(screen.getAllByText(/^Categoria \d{3}$/)).toHaveLength(37);
      expect(screen.queryByText(m.settings.shell.pagination.rowsPerPage)).toBeNull();
    });

    it("acima do limiar, corta E mostra o controle", () => {
      renderManager(manyCategories(60));

      expect(screen.getByText(m.settings.shell.pagination.rowsPerPage)).toBeInTheDocument();
      // Cortado: a última não está na primeira página.
      expect(screen.queryByText("Categoria 059")).toBeNull();
    });

    it("a ação primária não troca de página quando não há paginação", async () => {
      renderManager(manyCategories(37));

      // `m.settings.categories.createButton` ("Nova categoria"): o rótulo da ação
      // primária mora no bloco legado, não em `structure.categories`.
      const primary = screen.getByRole("button", {
        name: m.settings.categories.createButton,
      });
      await userEvent.click(primary);

      // Abre a linha-fantasma na hora, em vez de "saltar" para outra página — o
      // salto com o controle escondido lia como a tela ter mudado de lugar.
      expect(
        screen.getByPlaceholderText(m.settings.categories.nameLabel),
      ).toBeInTheDocument();
    });
  });
});
