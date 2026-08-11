import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionSuccess } from "@/lib/action-result";
import { m } from "@/lib/messages";

import { ResponsiblePartiesManager } from "./ResponsiblePartiesManager";

const st = m.settings.structure.responsibles;
const rowMenu = m.settings.shell.rowMenu;
const removeT = m.settings.structureDialogs.remove;

vi.mock("next/navigation", () => ({
  useParams: () => ({ accountId: "acc-1" }),
}));

vi.mock("notistack", () => ({
  useSnackbar: () => ({ enqueueSnackbar: vi.fn() }),
}));

const createResponsiblePartyAction = vi.fn();
const updateResponsiblePartyAction = vi.fn();
const deleteResponsiblePartyAction = vi.fn();
vi.mock("@/actions/responsible-parties", () => ({
  createResponsiblePartyAction: (...args: unknown[]) => createResponsiblePartyAction(...args),
  updateResponsiblePartyAction: (...args: unknown[]) => updateResponsiblePartyAction(...args),
  archiveResponsiblePartyAction: vi.fn(),
  deleteResponsiblePartyAction: (...args: unknown[]) => deleteResponsiblePartyAction(...args),
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

const MEMBERS = [
  { userId: "u-gabriel", label: "Gabriel" },
  { userId: "u-marina", label: "Marina" },
  { userId: "u-rafael", label: "Rafael" },
];

// "Tudo é responsável" — uma única tabela, com `personal` (automático) ao lado dos
// responsáveis comuns (`group`). Fixtures cobrindo 0/1/N membros para QUALQUER kind
// gerido (§4 do critério de aceite) mais o `personal` automático.
const PARTIES = [
  {
    id: "p-personal",
    name: "Gabriel",
    kind: "personal" as const,
    icon: null,
    color: null,
    active: true,
    lastUsedAt: null,
    memberUserIds: ["u-gabriel"],
    transactionCount: 0,
    imageUrl: null,
  },
  {
    id: "p-group-multi",
    name: "Compartilhado",
    kind: "group" as const,
    icon: null,
    color: null,
    active: true,
    lastUsedAt: null,
    memberUserIds: ["u-gabriel", "u-marina"], // N membros
    transactionCount: 0,
    imageUrl: null,
  },
  {
    id: "p-group-empty",
    name: "Diarista",
    kind: "group" as const,
    icon: null,
    color: null,
    active: true,
    lastUsedAt: null,
    memberUserIds: [], // 0 membros — "nomear alguém externo"
    transactionCount: 0,
    imageUrl: null,
  },
  {
    id: "p-group-one",
    name: "Contador",
    kind: "group" as const,
    icon: null,
    color: null,
    active: true,
    lastUsedAt: null,
    memberUserIds: ["u-gabriel"], // 1 membro — "uma persona"
    transactionCount: 0,
    imageUrl: null,
  },
];

function renderManager() {
  return render(
    <ResponsiblePartiesManager accountId="acc-1" initialParties={PARTIES} members={MEMBERS} />,
  );
}

/**
 * Linha da tabela pelo NOME do responsável — não pelo primeiro texto igual que
 * aparecer. Como o `personal` de um membro tem o MESMO nome do membro (ex.:
 * "Gabriel"), o mesmo texto aparece de novo dentro da célula "Membros vinculados"
 * de outra linha (ex.: "Compartilhado" lista "Gabriel, Marina") — exatamente o
 * cenário do frame. Por isso a busca é pela PRIMEIRA célula, que é a coluna Nome
 * (a coluna vazia de alça saiu na revisão de estilo: ela empurrava o avatar e o
 * nome 24px para fora do rótulo "NOME").
 */
function rowFor(name: string): HTMLElement {
  const table = screen.getByRole("table");
  for (const el of within(table).getAllByText(name)) {
    const cell = el.closest("td");
    if (cell?.matches("td:nth-of-type(1)")) {
      return cell.closest("tr") as HTMLElement;
    }
  }
  throw new Error(`linha de "${name}" não encontrada`);
}

/** Abre o menu "⋮" da linha e clica no item de rótulo `itemLabel`. */
async function openRowMenuAndClick(rowName: string, itemLabel: string) {
  await userEvent.click(screen.getByRole("button", { name: `${rowMenu.trigger}: ${rowName}` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: itemLabel }));
}

describe("ResponsiblePartiesManager (revisão 'Tudo é responsável')", () => {
  beforeEach(() => {
    createResponsiblePartyAction.mockReset();
    updateResponsiblePartyAction.mockReset();
    deleteResponsiblePartyAction.mockReset();
    getConfigReferencesAction.mockReset();
    mergeEntityAction.mockReset();
    countUsageAction.mockReset();
  });

  it("todos os responsáveis — inclusive o pessoal — aparecem na MESMA tabela", () => {
    renderManager();

    const table = screen.getByRole("table");
    // cabeçalho + 4 linhas (Gabriel/personal, Compartilhado, Diarista, Contador) +
    // a linha-fantasma ociosa ("Adicionar responsável…").
    expect(within(table).getAllByRole("row")).toHaveLength(1 + 4 + 1);
    expect(rowFor("Gabriel")).toBeTruthy();
  });

  it("mostra 0/1/N membros corretamente por linha, para QUALQUER kind gerido", () => {
    renderManager();

    // 0 membros — "group" (Diarista): nomear alguém externo.
    expect(within(rowFor("Diarista")).getByText(st.noMembers)).toBeInTheDocument();

    // 1 membro — "group" (Contador): uma persona.
    const contadorRow = rowFor("Contador");
    expect(within(contadorRow).getByText("Gabriel")).toBeInTheDocument();
    expect(within(contadorRow).queryByText(st.noMembers)).toBeNull();

    // N membros — "group" (Compartilhado): grupo de verdade.
    const groupRow = rowFor("Compartilhado");
    expect(within(groupRow).getByText("Gabriel, Marina")).toBeInTheDocument();
  });

  it("linha `personal` mostra o vínculo fixo sem o botão de vincular", () => {
    renderManager();

    const personalRow = rowFor("Gabriel");
    // "Gabriel" aparece DUAS vezes na própria linha: no nome do responsável e no
    // vínculo fixo da célula de membros (§ do frame — o `personal` é o próprio
    // membro) — por isso `getAllByText`, não `getByText`.
    expect(within(personalRow).getAllByText("Gabriel").length).toBeGreaterThanOrEqual(2);
    expect(
      within(personalRow).queryByRole("button", { name: st.linkMemberFor("Gabriel") }),
    ).toBeNull();
  });

  it("o '+' de cada linha comum oferece só quem ainda não está vinculado NAQUELA linha", async () => {
    renderManager();

    // "Diarista" (0 vinculados) — os 3 membros da conta estão disponíveis.
    const diaristaRow = rowFor("Diarista");
    await userEvent.click(
      within(diaristaRow).getByRole("button", { name: st.linkMemberFor("Diarista") }),
    );
    expect(
      screen
        .getAllByRole("menuitem")
        .map((i) => i.textContent)
        .sort(),
    ).toEqual(["Gabriel", "Marina", "Rafael"]);
    await userEvent.keyboard("{Escape}");
    // Espera a transição de saída do Menu terminar antes de abrir o próximo —
    // senão os `menuitem` dos dois ainda coexistem no DOM por um instante.
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    // "Compartilhado" (Gabriel + Marina vinculados) — só Rafael sobra.
    const groupRow = rowFor("Compartilhado");
    await userEvent.click(
      within(groupRow).getByRole("button", { name: st.linkMemberFor("Compartilhado") }),
    );
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Rafael"]);
  });

  it("a ação primária do cabeçalho ABRE a linha-fantasma com o cursor no campo (SET-08)", async () => {
    renderManager();

    // O rótulo é o mesmo no botão do cabeçalho e no gatilho ocioso da linha-fantasma
    // (ambos usam `st.addRow`) — por isso a busca por role+nome dá 2 resultados.
    const [primaryButton] = screen.getAllByRole("button", { name: st.addRow });

    await userEvent.click(primaryButton);

    // Regra global do frame ("UM CAMINHO DE CRIAÇÃO"): o botão não abre modal e leva o
    // usuário direto a digitar.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByPlaceholderText("Nome")).toHaveFocus();
  });

  it("a linha-fantasma cria sempre um responsável comum, sem membro (D4 — 'nomear alguém externo')", async () => {
    createResponsiblePartyAction.mockResolvedValue(actionSuccess({ id: "novo-1" }));
    renderManager();

    await userEvent.click(screen.getAllByRole("button", { name: st.addRow })[0]);
    await userEvent.type(screen.getByPlaceholderText("Nome"), "Diarista Ana{Enter}");

    await waitFor(() => {
      expect(createResponsiblePartyAction).toHaveBeenCalledWith("acc-1", {
        name: "Diarista Ana",
        icon: null,
        color: null,
        memberUserIds: [],
      });
    });
    expect(await screen.findByText("Diarista Ana")).toBeInTheDocument();
  });

  it("clicar no nome de um responsável comum entra em edição inline (sem modal)", async () => {
    updateResponsiblePartyAction.mockResolvedValue(actionSuccess(undefined));
    renderManager();

    await userEvent.click(screen.getByRole("button", { name: `${m.common.edit}: Contador` }));

    // O nome "Contador" deixou de ser texto (virou valor do campo) — por isso a
    // busca é por `getByDisplayValue`, não por `rowFor` (que procura texto puro).
    const textbox = screen.getByDisplayValue("Contador");
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.clear(textbox);
    await userEvent.type(textbox, "Contador Novo{Enter}");

    await waitFor(() => {
      expect(updateResponsiblePartyAction).toHaveBeenCalledWith("acc-1", {
        partyId: "p-group-one",
        name: "Contador Novo",
      });
    });
  });

  it("o nome do responsável `personal` NÃO é clicável para renomear", () => {
    renderManager();

    expect(screen.queryByRole("button", { name: `${m.common.edit}: Gabriel` })).toBeNull();
  });

  it("clicar no avatar abre o diálogo de ícone/cor — vale para `personal` também", async () => {
    renderManager();

    await userEvent.click(screen.getByRole("button", { name: st.personalizeFor("Gabriel") }));

    const dialog = await screen.findByRole("dialog");
    // `personal`: sem checklist de membros dentro do diálogo (vínculo fixo).
    expect(within(dialog).queryByText(m.settings.responsibleParties.membersLabel)).toBeNull();
  });

  it("clicar no avatar de um responsável comum abre o diálogo com o checklist de membros", async () => {
    renderManager();

    await userEvent.click(screen.getByRole("button", { name: st.personalizeFor("Compartilhado") }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(m.settings.responsibleParties.membersLabel)).toBeInTheDocument();
  });

  it("expõe verUso e mesclar no menu de um responsável comum, mas NÃO no `personal`", async () => {
    renderManager();

    await userEvent.click(screen.getByRole("button", { name: `${rowMenu.trigger}: Contador` }));
    expect(screen.getByRole("menuitem", { name: rowMenu.viewUsage })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: rowMenu.merge })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: rowMenu.delete })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    await userEvent.click(screen.getByRole("button", { name: `${rowMenu.trigger}: Gabriel` }));
    expect(screen.queryByRole("menuitem", { name: rowMenu.viewUsage })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: rowMenu.merge })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: rowMenu.delete })).toBeNull();
    // Editar (diálogo de estilo) e Ativar/desativar continuam disponíveis.
    expect(screen.getByRole("menuitem", { name: rowMenu.edit })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: rowMenu.deactivate })).toBeInTheDocument();
  });

  it("'Ver uso' abre o UsageDialog do responsável (M3)", async () => {
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 6,
        months: 2,
        byMonth: [],
        countedAt: new Date("2026-08-10T12:00:00.000Z"),
        fromCache: true,
      }),
    );
    renderManager();

    await openRowMenuAndClick("Contador", rowMenu.viewUsage);

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(m.settings.structureDialogs.usage.title("Contador")),
    ).toBeInTheDocument();
    expect(countUsageAction).toHaveBeenCalledWith("acc-1", {
      entity: "responsibleParty",
      entityId: "p-group-one",
    });
  });

  it("'Mesclar' abre o MergeDialog com a linha de origem pré-selecionada em Absorver", async () => {
    const mergeT = m.settings.structureDialogs.merge;
    renderManager();

    await openRowMenuAndClick("Contador", rowMenu.merge);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(mergeT.absorbLabel)).toHaveTextContent("Contador");
    // `personal` não é opção de destino do mesclar.
    expect(within(dialog).queryByText("Gabriel")).toBeNull();
  });

  it("exclusão passa pelo M2: sem destino chama deleteResponsiblePartyAction", async () => {
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
    deleteResponsiblePartyAction.mockResolvedValue(actionSuccess(undefined));
    renderManager();

    await openRowMenuAndClick("Diarista", rowMenu.delete);

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(removeT.noTransactions);
    await userEvent.click(within(dialog).getByRole("button", { name: removeT.confirmSimple }));

    await waitFor(() => {
      expect(deleteResponsiblePartyAction).toHaveBeenCalledWith("acc-1", {
        partyId: "p-group-empty",
      });
    });
    expect(mergeEntityAction).not.toHaveBeenCalled();
  });

  it("exclusão com destino escolhido chama mergeEntityAction (M2 = mesclar)", async () => {
    getConfigReferencesAction.mockResolvedValue(
      actionSuccess({ groups: [{ kind: "aliases", count: 1 }], total: 1 }),
    );
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 4,
        months: 1,
        byMonth: [],
        countedAt: new Date("2026-08-10T12:00:00.000Z"),
        fromCache: true,
      }),
    );
    mergeEntityAction.mockResolvedValue(
      actionSuccess({
        transactions: 4,
        aliases: 1,
        templateItems: 0,
        templateDefaults: 0,
        widgetFilters: 0,
        subcategories: 0,
      }),
    );
    renderManager();

    await openRowMenuAndClick("Diarista", rowMenu.delete);

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(removeT.transactionCount(4, 1));

    await userEvent.click(within(dialog).getByLabelText(removeT.reallocateTo));
    await userEvent.click(await screen.findByRole("option", { name: "Contador" }));

    await userEvent.click(within(dialog).getByRole("button", { name: removeT.confirmWithTotal(5) }));

    await waitFor(() => {
      expect(mergeEntityAction).toHaveBeenCalledWith("acc-1", {
        entity: "responsibleParty",
        absorbedId: "p-group-empty",
        keptId: "p-group-one",
      });
    });
    expect(deleteResponsiblePartyAction).not.toHaveBeenCalled();
  });
});
