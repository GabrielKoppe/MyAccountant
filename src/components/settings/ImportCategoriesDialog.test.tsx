import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { importCategoriesAction, previewCategoryImportAction } from "@/actions/settings-import";
import type { CategoryImportRow, ImportPlan } from "@/lib/category-import";
import { parseCategoryImportFile } from "@/lib/category-import-file";
import { m } from "@/lib/messages";

import { ImportCategoriesDialog } from "./ImportCategoriesDialog";

vi.mock("notistack", () => ({
  useSnackbar: () => ({ enqueueSnackbar: vi.fn() }),
}));

vi.mock("@/actions/settings-import", () => ({
  previewCategoryImportAction: vi.fn(),
  importCategoriesAction: vi.fn(),
}));

vi.mock("@/lib/category-import-file", () => ({
  parseCategoryImportFile: vi.fn(),
}));

const t = m.settings.structureDialogs.import;

const PARSED_ROWS: CategoryImportRow[] = [
  { name: "Mercado", section: undefined },
  { name: "Padaria", parent: "Mercado", color: "verde" },
  { name: "Farmácia", section: "Saúde" },
  { name: "" },
];

const PLAN_WITH_ALL_ACTIONS: ImportPlan = {
  rows: [
    { line: 1, name: "Mercado", parent: null, action: "create", note: "sem seção padrão" },
    {
      line: 2,
      name: "Padaria",
      parent: "Mercado",
      action: "create",
      note: "nova subcategoria · cor ignorada",
      parentId: "cat-mercado",
    },
    {
      line: 3,
      name: "Farmácia",
      parent: null,
      action: "update",
      note: "seção Saúde (antes: sem seção)",
      existingId: "cat-farmacia",
    },
    { line: 4, name: "", parent: null, action: "error", note: "nome vazio" },
  ],
  counts: { create: 2, update: 1, skip: 0, error: 1 },
  totalChanges: 3,
};

/** Encontra o rótulo do cartão de contagem e devolve o texto inteiro do cartão
 * (rótulo + número), já que o número sozinho colide com outros textos da tela. */
function cardText(label: string): string {
  const labelNode = screen.getByText(label);
  const card = labelNode.closest("div");
  if (!card) throw new Error(`cartão de "${label}" não encontrado`);
  return card.textContent ?? "";
}

async function selectFile() {
  const input = screen.getByTestId("import-categories-file-input");
  const file = new File(["irrelevante — parseCategoryImportFile está mockado"], "categorias.csv", {
    type: "text/csv",
  });
  await userEvent.upload(input, file);
}

function renderDialog() {
  const onClose = vi.fn();
  const onImported = vi.fn();
  render(
    <ImportCategoriesDialog open onClose={onClose} accountId="acc-1" onImported={onImported} />,
  );
  return { onClose, onImported };
}

describe("ImportCategoriesDialog (Spec 68 §2.2 / M4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra as quatro contagens e a lista linha a linha, com 'cor ignorada' na observação", async () => {
    vi.mocked(parseCategoryImportFile).mockResolvedValue(PARSED_ROWS);
    vi.mocked(previewCategoryImportAction).mockResolvedValue({
      ok: true,
      data: PLAN_WITH_ALL_ACTIONS,
    });

    renderDialog();
    await selectFile();

    await screen.findByText("Padaria");
    expect(screen.getByText("Padaria")).toBeInTheDocument();
    expect(screen.getByText("Farmácia")).toBeInTheDocument();

    expect(cardText(t.create)).toContain("2");
    expect(cardText(t.update)).toContain("1");
    expect(cardText(t.skip)).toContain("0");
    expect(cardText(t.error)).toContain("1");

    // "cor ignorada" (D7) é reportada, nunca aplicada — a coluna cor não tem destino.
    expect(screen.getByText(/cor ignorada/)).toBeInTheDocument();

    // Nada foi gravado: só a action de PREVIEW foi chamada até aqui.
    expect(previewCategoryImportAction).toHaveBeenCalledWith("acc-1", {
      rows: PARSED_ROWS,
      deactivateMissing: false,
    });
    expect(importCategoriesAction).not.toHaveBeenCalled();
  });

  it("cancelar fecha o diálogo sem chamar importCategoriesAction", async () => {
    vi.mocked(parseCategoryImportFile).mockResolvedValue(PARSED_ROWS);
    vi.mocked(previewCategoryImportAction).mockResolvedValue({
      ok: true,
      data: PLAN_WITH_ALL_ACTIONS,
    });

    const { onClose } = renderDialog();
    await selectFile();
    await screen.findByText("Padaria");

    await userEvent.click(screen.getByRole("button", { name: m.common.cancel }));

    expect(importCategoriesAction).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("aplicar chama importCategoriesAction com as MESMAS linhas do preview", async () => {
    vi.mocked(parseCategoryImportFile).mockResolvedValue(PARSED_ROWS);
    vi.mocked(previewCategoryImportAction).mockResolvedValue({
      ok: true,
      data: PLAN_WITH_ALL_ACTIONS,
    });
    vi.mocked(importCategoriesAction).mockResolvedValue({
      ok: true,
      data: { created: 2, updated: 1, deactivated: 0 },
    });

    const { onClose, onImported } = renderDialog();
    await selectFile();
    await screen.findByText("Padaria");

    const applyButton = screen.getByRole("button", { name: t.apply(3) });
    await userEvent.click(applyButton);

    expect(importCategoriesAction).toHaveBeenCalledWith("acc-1", {
      rows: PARSED_ROWS,
      deactivateMissing: false,
    });
    expect(onImported).toHaveBeenCalledWith({ created: 2, updated: 1, deactivated: 0 });
    expect(onClose).toHaveBeenCalled();
  });

  it("totalChanges === 0 desabilita o botão e mostra 'nada a aplicar'", async () => {
    vi.mocked(parseCategoryImportFile).mockResolvedValue(PARSED_ROWS);
    vi.mocked(previewCategoryImportAction).mockResolvedValue({
      ok: true,
      data: {
        rows: [
          { line: 1, name: "Mercado", parent: null, action: "skip", note: "idêntica à existente" },
        ],
        counts: { create: 0, update: 0, skip: 1, error: 0 },
        totalChanges: 0,
      },
    });

    renderDialog();
    await selectFile();

    const applyButton = await screen.findByRole("button", { name: t.nothingToApply });
    expect(applyButton).toBeDisabled();
    expect(importCategoriesAction).not.toHaveBeenCalled();
  });

  it("repete o preview ao alternar 'desativar categorias ausentes'", async () => {
    vi.mocked(parseCategoryImportFile).mockResolvedValue(PARSED_ROWS);
    vi.mocked(previewCategoryImportAction).mockResolvedValue({
      ok: true,
      data: PLAN_WITH_ALL_ACTIONS,
    });

    renderDialog();
    await selectFile();
    await screen.findByText("Padaria");

    await userEvent.click(screen.getByRole("checkbox", { name: t.deactivateMissing }));

    expect(previewCategoryImportAction).toHaveBeenLastCalledWith("acc-1", {
      rows: PARSED_ROWS,
      deactivateMissing: true,
    });
  });

  it("aceita .json além de CSV/XLSX (revisão de estilo)", () => {
    renderDialog();

    expect(screen.getByTestId("import-categories-file-input")).toHaveAttribute(
      "accept",
      ".csv,.xlsx,.xls,.json",
    );
  });

  it("arquivo sem linha legível mostra a mensagem de arquivo vazio", async () => {
    vi.mocked(parseCategoryImportFile).mockResolvedValue([]);

    renderDialog();
    await selectFile();

    expect(await screen.findByText(t.emptyFile)).toBeInTheDocument();
    expect(previewCategoryImportAction).not.toHaveBeenCalled();
  });
});
