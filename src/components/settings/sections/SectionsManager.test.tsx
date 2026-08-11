import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionSuccess } from "@/lib/action-result";
import { m } from "@/lib/messages";

import type { SectionRowData } from "./SectionRow";
import { SectionsManager } from "./SectionsManager";

vi.mock("next/navigation", () => ({
  useParams: () => ({ accountId: "acc-test-1" }),
}));

const createSectionAction = vi.fn();
const updateSectionAction = vi.fn();
const reorderSectionsAction = vi.fn();
const deleteSectionAction = vi.fn();
vi.mock("@/actions/account-settings", () => ({
  createSectionAction: (...args: unknown[]) => createSectionAction(...args),
  updateSectionAction: (...args: unknown[]) => updateSectionAction(...args),
  reorderSectionsAction: (...args: unknown[]) => reorderSectionsAction(...args),
  deleteSectionAction: (...args: unknown[]) => deleteSectionAction(...args),
}));

// `viewUsage` (Spec 68 §2.6 / M3) abre um `UsageDialog` de verdade dentro do teste —
// ele chama esta action no próprio `useEffect`, então precisa de mock aqui também
// (mesmo padrão de `UsageDialog.test.tsx`).
const countUsageAction = vi.fn();
vi.mock("@/actions/settings-usage", () => ({
  countUsageAction: (...args: unknown[]) => countUsageAction(...args),
}));

const t = m.settings.structure.sections;
const rowMenu = m.settings.shell.rowMenu;

function buildSection(overrides: Partial<SectionRowData> = {}): SectionRowData {
  return {
    id: "sec-1",
    name: "Alimentação",
    countType: "subtract",
    isActive: true,
    color: null,
    lastUsedAt: null,
    modelsCount: 0,
    ...overrides,
  };
}

function renderManager(sections: SectionRowData[] = [buildSection()]) {
  return render(
    <SnackbarProvider>
      <SectionsManager accountId="acc-test-1" initialSections={sections} />
    </SnackbarProvider>,
  );
}

/** Abre o menu "⋮" da linha e clica no item de rótulo `itemLabel`. */
async function openRowMenuAndClick(rowName: string, itemLabel: string) {
  await userEvent.click(screen.getByRole("button", { name: `${rowMenu.trigger}: ${rowName}` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: itemLabel }));
}

describe("SectionsManager", () => {
  beforeEach(() => {
    createSectionAction.mockReset();
    updateSectionAction.mockReset();
    reorderSectionsAction.mockReset();
    deleteSectionAction.mockReset();
    countUsageAction.mockReset();
  });

  it("renderiza cada seção com tipo, contagem de modelos e status", () => {
    renderManager([
      buildSection({ id: "sec-1", name: "Alimentação", countType: "subtract", modelsCount: 2 }),
      buildSection({ id: "sec-2", name: "Investimentos", countType: "neutral", modelsCount: 0 }),
    ]);

    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Investimentos")).toBeInTheDocument();
    expect(screen.getAllByText(t.kindLabels.subtract).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.kindLabels.neutral).length).toBeGreaterThan(0);

    // Escopado na linha: o chip "2" do cabeçalho (itemCount) tem o mesmo texto
    // da contagem de modelos, então a asserção precisa mirar só a linha.
    const alimentacaoRow = screen.getByText("Alimentação").closest("tr")!;
    expect(within(alimentacaoRow).getByText("2")).toBeInTheDocument();
    // Sem modelo nenhum -> "—" (t.modelsEmpty), não "0".
    const investimentosRow = screen.getByText("Investimentos").closest("tr")!;
    expect(within(investimentosRow).getByText(t.modelsEmpty)).toBeInTheDocument();
  });

  it("mostra a contagem 'N · M inativa(s)' no cabeçalho quando há seção inativa", () => {
    renderManager([
      buildSection({ id: "sec-1", isActive: true }),
      buildSection({ id: "sec-2", name: "Cartões", isActive: false }),
    ]);

    expect(screen.getByText("2 · 1 inativa")).toBeInTheDocument();
  });

  it("mostra o estado vazio quando não há seções, mantendo a linha-fantasma", () => {
    renderManager([]);

    expect(screen.getByText(t.emptyTitle)).toBeInTheDocument();
    // Dois botões com o mesmo rótulo coexistem de propósito: a ação primária do
    // cabeçalho (que só leva o foco/scroll até a linha) e o próprio gatilho
    // ocioso da `GhostRow` (que abre a edição de fato).
    expect(screen.getAllByRole("button", { name: t.addRow })).toHaveLength(2);
  });

  it("cria uma seção pela linha-fantasma (sem modal)", async () => {
    createSectionAction.mockResolvedValue({ ok: true, data: { sectionId: "sec-new" } });
    renderManager([]);

    // O gatilho da própria `GhostRow` é o ÚLTIMO botão com esse rótulo: o
    // primeiro é a ação do cabeçalho, que (Spec 68 §2.1 item 7) só foca/rola
    // até aqui — não abre a edição sozinha.
    const ghostTrigger = screen.getAllByRole("button", { name: t.addRow }).at(-1)!;
    await userEvent.click(ghostTrigger);
    await userEvent.type(screen.getByPlaceholderText(t.columnName), "Lazer");
    await userEvent.keyboard("{Enter}");

    expect(createSectionAction).toHaveBeenCalledWith("acc-test-1", {
      name: "Lazer",
      countType: "subtract",
      isActive: true,
      color: null,
    });
    expect(await screen.findByText("Lazer")).toBeInTheDocument();
  });

  it("alterna o Switch da linha diretamente, sem pedir confirmação", async () => {
    updateSectionAction.mockResolvedValue({ ok: true });
    renderManager([buildSection({ isActive: true })]);

    await userEvent.click(screen.getByRole("checkbox"));

    expect(updateSectionAction).toHaveBeenCalledWith("acc-test-1", {
      sectionId: "sec-1",
      name: "Alimentação",
      countType: "subtract",
      isActive: false,
      color: null,
    });
    // Nenhum modal de confirmação: o Switch é o controle instantâneo da coluna Status.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("desativar pelo menu da linha pede confirmação (M8) antes de gravar", async () => {
    updateSectionAction.mockResolvedValue({ ok: true });
    renderManager([buildSection({ name: "Alimentação", isActive: true })]);

    await openRowMenuAndClick("Alimentação", rowMenu.deactivate);

    expect(updateSectionAction).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(t.deactivateTitle("Alimentação"))).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: rowMenu.deactivate }));

    expect(updateSectionAction).toHaveBeenCalledWith("acc-test-1", {
      sectionId: "sec-1",
      name: "Alimentação",
      countType: "subtract",
      isActive: false,
      color: null,
    });
  });

  it("editar pelo menu troca a linha para campos, e o check grava", async () => {
    updateSectionAction.mockResolvedValue({ ok: true });
    renderManager([buildSection({ name: "Alimentação", countType: "subtract" })]);

    await openRowMenuAndClick("Alimentação", rowMenu.edit);

    const nameField = screen.getByLabelText(t.columnName);
    await userEvent.clear(nameField);
    await userEvent.type(nameField, "Restaurantes");
    // O aria-label da `SettingsEditActions` compõe o nome do OBJETO (prop, não o
    // rascunho digitado) — "Salvar: Alimentação", não só "Salvar" (uma lista tem
    // dezenas de linhas em potencial edição, cada "Salvar" precisa dizer qual).
    await userEvent.click(screen.getByRole("button", { name: `${m.common.save}: Alimentação` }));

    expect(updateSectionAction).toHaveBeenCalledWith("acc-test-1", {
      sectionId: "sec-1",
      name: "Restaurantes",
      countType: "subtract",
      isActive: true,
      color: null,
    });
  });

  it("excluir pede confirmação e chama a action com o id certo", async () => {
    deleteSectionAction.mockResolvedValue({ ok: true });
    renderManager([buildSection({ id: "sec-1", name: "Alimentação" })]);

    await openRowMenuAndClick("Alimentação", rowMenu.delete);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: m.common.delete }));

    expect(deleteSectionAction).toHaveBeenCalledWith("acc-test-1", { sectionId: "sec-1" });
  });

  it("não renderiza itens mortos no menu da linha (viewUsage presente; sem merge/duplicate — D1/§9 P8)", async () => {
    renderManager([buildSection({ name: "Alimentação" })]);

    await userEvent.click(screen.getByRole("button", { name: `${rowMenu.trigger}: Alimentação` }));

    // Seções ficam de fora do M2/M5 (spec 68 §2.5/§2.6): não há "Mesclar" nem uma
    // action de "excluir realocando" para `Section` — só "Ver uso" entra no pacote P8.
    expect(screen.queryByRole("menuitem", { name: rowMenu.merge })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: rowMenu.duplicate })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: rowMenu.viewUsage })).toBeInTheDocument();
  });

  it("'Ver uso' abre o UsageDialog com a seção certa (Spec 68 §2.6 / M3)", async () => {
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 12,
        months: 3,
        byMonth: [],
        countedAt: new Date("2026-08-10T12:00:00.000Z"),
        fromCache: true,
      }),
    );
    renderManager([buildSection({ id: "sec-1", name: "Alimentação" })]);

    await openRowMenuAndClick("Alimentação", rowMenu.viewUsage);

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(m.settings.structureDialogs.usage.title("Alimentação")),
    ).toBeInTheDocument();
    expect(countUsageAction).toHaveBeenCalledWith("acc-test-1", {
      entity: "section",
      entityId: "sec-1",
    });
  });
});
