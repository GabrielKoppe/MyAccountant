import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionSuccess } from "@/lib/action-result";
import { m } from "@/lib/messages";

import { InstitutionsManager, type Institution } from "./InstitutionsManager";

vi.mock("next/navigation", () => ({
  useParams: () => ({ accountId: "acc-test-1" }),
}));

const createInstitutionAction = vi.fn();
const updateInstitutionAction = vi.fn();
const deleteInstitutionAction = vi.fn();
vi.mock("@/actions/account-settings", () => ({
  createInstitutionAction: (...args: unknown[]) => createInstitutionAction(...args),
  updateInstitutionAction: (...args: unknown[]) => updateInstitutionAction(...args),
  deleteInstitutionAction: (...args: unknown[]) => deleteInstitutionAction(...args),
}));

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

const rowMenu = m.settings.shell.rowMenu;
const removeT = m.settings.structureDialogs.remove;
const t = m.settings.structure.institutions;

function buildInstitution(overrides: Partial<Institution> = {}): Institution {
  return {
    id: "inst-1",
    name: "Nubank",
    kind: null,
    status: "active",
    lastUsedAt: null,
    last4: null,
    closingDay: null,
    dueDay: null,
    branch: null,
    accountNo: null,
    taxId: null,
    ...overrides,
  };
}

function renderManager(institutions: Institution[] = [buildInstitution()]) {
  return render(
    <SnackbarProvider>
      <InstitutionsManager accountId="acc-test-1" initialInstitutions={institutions} />
    </SnackbarProvider>,
  );
}

async function openRowMenuAndClick(rowName: string, itemLabel: string) {
  await userEvent.click(screen.getByRole("button", { name: `${rowMenu.trigger}: ${rowName}` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: itemLabel }));
}

describe("InstitutionsManager (Spec 68 §9 P8)", () => {
  beforeEach(() => {
    createInstitutionAction.mockReset();
    updateInstitutionAction.mockReset();
    deleteInstitutionAction.mockReset();
    getConfigReferencesAction.mockReset();
    mergeEntityAction.mockReset();
    countUsageAction.mockReset();
  });

  it("mostra o estado vazio quando não há instituições, mantendo a linha-fantasma dentro da tabela", () => {
    // Regressão: a `SettingsGhostRow` é um `<TableRow>` de verdade — precisa estar
    // dentro do `<tbody>` mesmo com a lista vazia, nunca como irmã da tabela (senão é
    // um `<tr>` filho de `<div>`, HTML inválido / hydration error).
    renderManager([]);

    expect(screen.getByText(t.emptyTitle)).toBeInTheDocument();
    // Diferente de Seções: aqui a ação primária do cabeçalho ("Nova instituição") e o
    // gatilho da própria `SettingsGhostRow` ("Adicionar instituição…") têm rótulos
    // DIFERENTES — só o segundo precisa existir dentro da tabela.
    expect(screen.getByRole("button", { name: t.addRow })).toBeInTheDocument();
  });

  it("expõe verUso e mesclar no menu da linha, mas não duplicar", async () => {
    renderManager([buildInstitution({ name: "Nubank" })]);

    await userEvent.click(screen.getByRole("button", { name: `${rowMenu.trigger}: Nubank` }));

    expect(screen.getByRole("menuitem", { name: rowMenu.viewUsage })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: rowMenu.merge })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: rowMenu.duplicate })).not.toBeInTheDocument();
  });

  it("'Ver uso' abre o UsageDialog da instituição (M3)", async () => {
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 40,
        months: 6,
        byMonth: [],
        countedAt: new Date("2026-08-10T12:00:00.000Z"),
        fromCache: true,
      }),
    );
    renderManager([buildInstitution({ id: "inst-1", name: "Nubank" })]);

    await openRowMenuAndClick("Nubank", rowMenu.viewUsage);

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(m.settings.structureDialogs.usage.title("Nubank")),
    ).toBeInTheDocument();
    expect(countUsageAction).toHaveBeenCalledWith("acc-test-1", {
      entity: "institution",
      entityId: "inst-1",
    });
  });

  it("'Mesclar' abre o MergeDialog com a linha de origem pré-selecionada em Absorver", async () => {
    const mergeT = m.settings.structureDialogs.merge;
    renderManager([
      buildInstitution({ id: "inst-1", name: "Nubank Cartão" }),
      buildInstitution({ id: "inst-2", name: "Nubank" }),
    ]);

    await openRowMenuAndClick("Nubank Cartão", rowMenu.merge);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(mergeT.absorbLabel)).toHaveTextContent("Nubank Cartão");
  });

  it("exclusão passa pelo M2: sem destino chama deleteInstitutionAction", async () => {
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
    deleteInstitutionAction.mockResolvedValue(actionSuccess(undefined));
    renderManager([buildInstitution({ id: "inst-1", name: "Nubank" })]);

    await openRowMenuAndClick("Nubank", rowMenu.delete);

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(removeT.noTransactions);
    await userEvent.click(within(dialog).getByRole("button", { name: removeT.confirmSimple }));

    await waitFor(() => {
      expect(deleteInstitutionAction).toHaveBeenCalledWith("acc-test-1", {
        institutionId: "inst-1",
      });
    });
    expect(mergeEntityAction).not.toHaveBeenCalled();
  });

  it("exclusão com destino escolhido chama mergeEntityAction (M2 = mesclar)", async () => {
    getConfigReferencesAction.mockResolvedValue(
      actionSuccess({ groups: [{ kind: "aliases", count: 2 }], total: 2 }),
    );
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 10,
        months: 3,
        byMonth: [],
        countedAt: new Date("2026-08-10T12:00:00.000Z"),
        fromCache: true,
      }),
    );
    mergeEntityAction.mockResolvedValue(
      actionSuccess({
        transactions: 10,
        aliases: 2,
        templateItems: 0,
        templateDefaults: 0,
        widgetFilters: 0,
        subcategories: 0,
      }),
    );
    renderManager([
      buildInstitution({ id: "inst-1", name: "Nubank Cartão" }),
      buildInstitution({ id: "inst-2", name: "Nubank" }),
    ]);

    await openRowMenuAndClick("Nubank Cartão", rowMenu.delete);

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(removeT.transactionCount(10, 3));

    await userEvent.click(within(dialog).getByLabelText(removeT.reallocateTo));
    await userEvent.click(await screen.findByRole("option", { name: "Nubank" }));

    await userEvent.click(
      within(dialog).getByRole("button", { name: removeT.confirmWithTotal(12) }),
    );

    await waitFor(() => {
      expect(mergeEntityAction).toHaveBeenCalledWith("acc-test-1", {
        entity: "institution",
        absorbedId: "inst-1",
        keptId: "inst-2",
      });
    });
    expect(deleteInstitutionAction).not.toHaveBeenCalled();
  });

  it("editar pelo menu e escolher um tipo grava o tipo escolhido (bug real: o tipo não gravava)", async () => {
    // Reprodução do bug relatado: `stripInapplicableDetails` vazava o `kind` ANTIGO do
    // `Draft` inteiro (nome incluso) de volta no rascunho, e `{ ...prev, kind: nextKind,
    // ...stripped }` deixava esse vazamento por cima — o tipo escolhido nunca chegava
    // ao payload. Ver `src/lib/institution-details.ts`.
    updateInstitutionAction.mockResolvedValue({ ok: true });
    renderManager([buildInstitution({ id: "inst-1", name: "Nubank", kind: null })]);

    await openRowMenuAndClick("Nubank", rowMenu.edit);
    await userEvent.click(screen.getByLabelText(`${t.columnKind}: Nubank`));
    await userEvent.click(await screen.findByRole("option", { name: t.kindLabels.card }));
    await userEvent.click(screen.getByRole("button", { name: `${m.common.save}: Nubank` }));

    await waitFor(() => {
      expect(updateInstitutionAction).toHaveBeenCalledWith(
        "acc-test-1",
        expect.objectContaining({ kind: "card" }),
      );
    });
  });
});
