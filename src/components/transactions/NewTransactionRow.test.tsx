import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

import { NewTransactionRow } from "./NewTransactionRow";
import { OptionsProvider } from "./OptionsContext";

// Apelido "CEG" que define categoria + isPending — usado nos testes da Fase 4
// (aplicação manual). isPending é o campo do bug de vazamento entre lançamentos
// consecutivos (entrada rápida) corrigido nesta rodada.
const CEG_ALIAS: SerializedTransactionAlias = {
  id: "alias-1",
  trigger: "CEG",
  triggerNormalized: "ceg",
  triggerMode: "contains",
  priority: "medium",
  conditionInstitutionId: null,
  conditionInstitutionName: null,
  minCents: null,
  maxCents: null,
  updatedAt: "2026-01-01T00:00:00.000Z",
  description: null,
  notes: null,
  amountCents: null,
  categoryId: "cat-1",
  categoryName: "Conta",
  subcategoryId: null,
  subcategoryName: null,
  institutionId: null,
  institutionName: null,
  institutionText: null,
  responsiblePartyId: null,
  responsiblePartyName: null,
  expenseType: null,
  paymentMethod: null,
  investmentType: null,
  cardInstallment: null,
  isPending: true,
  isFavorite: null,
  originalCurrency: null,
  originalAmountCents: null,
  exchangeRate: null,
  isArchived: false,
  createdById: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  tags: [],
};

// Mock da Server Action de criação — capturamos o payload enviado ao servidor.
const createTransactionAction = vi.fn();
vi.mock("@/actions/transactions", () => ({
  createTransactionAction: (...args: unknown[]) => createTransactionAction(...args),
}));

// RowDrawer (compartilhada com o editor) importa incondicionalmente os
// subsistemas de vínculos e tags (via TagPopover → TagEditor), mesmo que
// NewTransactionRow nunca passe `links`/`tags` (create não suporta nenhum dos
// dois). Mocks evitam que os módulos reais (Server Actions) sejam resolvidos
// neste teste.
vi.mock("@/actions/transaction-links", () => ({
  listLinksForTransactionAction: vi.fn(),
  deleteTransactionLinkAction: vi.fn(),
}));
vi.mock("@/actions/tags", () => ({
  addTagToTransactionAction: vi.fn(),
  listTagsAction: vi.fn(),
  removeTagFromTransactionAction: vi.fn(),
  updateTagAction: vi.fn(),
}));

// RowDrawer também chama useRouter() incondicionalmente (para o link "abrir
// transação vinculada"), mesmo sem a prop `links`. Fora de uma árvore Next.js
// App Router real, o hook lança "invariant expected app router to be
// mounted" — mock evita isso sem alterar a RowDrawer.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function renderRow(props: Partial<Parameters<typeof NewTransactionRow>[0]> = {}) {
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(
    <SnackbarProvider>
      <OptionsProvider
        value={{
          onCreateCategory: vi.fn(),
          onCreateSubcategory: vi.fn(),
          onCreateInstitution: vi.fn(),
          canManageOptions: true,
        }}
      >
        <table>
          <tbody>
            <NewTransactionRow
              tableId="table-1"
              monthId="month-1"
              accountId="acc-1"
              currentUserId="user-1"
              hiddenColumns={{}}
              categories={[]}
              institutions={[]}
              members={[]}
              parties={[]}
              aliases={[]}
              defaultResponsiblePartyId={null}
              onCreated={onCreated}
              onCancel={onCancel}
              {...props}
            />
          </tbody>
        </table>
      </OptionsProvider>
    </SnackbarProvider>,
  );
  return { onCreated, onCancel };
}

describe("NewTransactionRow", () => {
  beforeEach(() => {
    createTransactionAction.mockReset();
    createTransactionAction.mockResolvedValue({ ok: true, data: { transactionId: "tx-new" } });
  });

  it('vem com o tipo "Evento único" (one_time) pré-selecionado', () => {
    renderRow();
    expect(screen.getByRole("button", { name: "Evento único" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("envia expenseType ao service no create (regressão do bug que descartava o tipo)", async () => {
    const { onCreated } = renderRow();

    await userEvent.type(screen.getByPlaceholderText("Descrição…"), "Café{Enter}");

    await waitFor(() => expect(createTransactionAction).toHaveBeenCalledTimes(1));
    const [accountId, payload] = createTransactionAction.mock.calls[0];
    expect(accountId).toBe("acc-1");
    expect(payload.expenseType).toBe("one_time");
    expect(payload.paymentMethod).toBeNull();
    expect(payload.description).toBe("Café");
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("mantém a linha aberta e limpa a descrição após salvar (entrada rápida)", async () => {
    const { onCancel } = renderRow();

    await userEvent.type(screen.getByPlaceholderText("Descrição…"), "Mercado{Enter}");

    await waitFor(() => expect(createTransactionAction).toHaveBeenCalled());
    // A linha permanece montada e o campo de descrição é limpo para o próximo lançamento.
    await waitFor(() => expect(screen.getByPlaceholderText("Descrição…")).toHaveValue(""));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("não cria lançamento fantasma ao dar Enter numa linha intocada (guard pristino)", async () => {
    renderRow();

    // Linha aberta e vazia: um Enter perdido não deve disparar o create.
    screen.getByPlaceholderText("Descrição…").focus();
    await userEvent.keyboard("{Enter}");

    expect(createTransactionAction).not.toHaveBeenCalled();
  });

  it("propaga o expenseType escolhido pelo usuário", async () => {
    renderRow();

    await userEvent.click(screen.getByRole("button", { name: "Transação fixa" }));
    await userEvent.type(screen.getByPlaceholderText("Descrição…"), "Aluguel{Enter}");

    await waitFor(() => expect(createTransactionAction).toHaveBeenCalled());
    expect(createTransactionAction.mock.calls[0][1].expenseType).toBe("fixed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Spec 69 §2.1 — "Ao criar linha nova, herdar" (`inheritOnNewRow` do tipo de
// tabela). O que se prova aqui é o EFEITO: chave ligada → o valor sobrevive ao
// salvamento e vai no payload do lançamento SEGUINTE; chave desligada → o campo
// volta ao ponto de partida da linha.
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "cat-1", name: "Alimentação", subcategories: [{ id: "sub-1", name: "Mercado" }] },
  { id: "cat-2", name: "Moradia", subcategories: [] },
];
const INSTITUTIONS = [{ id: "inst-1", name: "Nubank" }];
const PARTIES = [
  {
    id: "party-1",
    name: "Gabriel",
    kind: "personal" as const,
    icon: null,
    color: null,
    imageUrl: null,
  },
  { id: "party-2", name: "Casa", kind: "group" as const, icon: null, color: null, imageUrl: null },
];

/** Escolhe uma opção num `CreatableEntitySelect` (Autocomplete) pelo aria-label. */
async function pickAutocomplete(ariaLabel: string, optionName: string) {
  await userEvent.click(screen.getByRole("combobox", { name: ariaLabel }));
  await userEvent.click(await screen.findByRole("option", { name: optionName }));
}

/** Escolhe uma opção num `Select` do MUI (responsável) pelo aria-label. */
async function pickSelect(ariaLabel: string, optionName: string) {
  await userEvent.click(screen.getByRole("combobox", { name: ariaLabel }));
  // Regex: o `MenuItem` do responsável carrega o avatar da persona junto do
  // nome, então o nome acessível não é só o texto.
  await userEvent.click(await screen.findByRole("option", { name: new RegExp(optionName) }));
}

async function saveWith(description: string) {
  await userEvent.type(screen.getByPlaceholderText("Descrição…"), `${description}{Enter}`);
}

/** Preenche os 4 campos herdáveis, salva, e devolve o payload do 2º salvamento. */
async function fillSaveTwice() {
  fireEvent.change(screen.getByDisplayValue(/^\d{4}-\d{2}-\d{2}$/), {
    target: { value: "2026-03-05" },
  });
  await pickAutocomplete("Categoria", "Alimentação");
  await pickAutocomplete("Subcategoria", "Mercado");
  await pickAutocomplete("Instituição", "Nubank");
  await pickSelect("Responsável", "Casa");

  await saveWith("Primeiro");
  await waitFor(() => expect(createTransactionAction).toHaveBeenCalledTimes(1));

  await saveWith("Segundo");
  await waitFor(() => expect(createTransactionAction).toHaveBeenCalledTimes(2));
  return createTransactionAction.mock.calls[1][1];
}

describe("NewTransactionRow — herdar ao criar linha nova (Spec 69 §2.1)", () => {
  beforeEach(() => {
    createTransactionAction.mockReset();
    createTransactionAction.mockResolvedValue({ ok: true, data: { transactionId: "tx-new" } });
  });

  function renderWithInherit(inheritOnNewRow: string[]) {
    return renderRow({
      categories: CATEGORIES,
      institutions: INSTITUTIONS,
      parties: PARTIES,
      defaultResponsiblePartyId: "party-1",
      inheritOnNewRow: inheritOnNewRow as never,
    });
  }

  it("nenhuma chave ligada: os quatro campos voltam ao ponto de partida", async () => {
    renderWithInherit([]);

    const payload = await fillSaveTwice();

    expect(payload.occurredOn).toEqual(new Date(new Date().toISOString().slice(0, 10)));
    expect(payload.categoryId).toBeNull();
    expect(payload.subcategoryId).toBeNull();
    expect(payload.institutionId).toBeNull();
    // Responsável NÃO vira null: volta ao default da conta (semântica de hoje).
    expect(payload.responsiblePartyId).toBe("party-1");
  });

  it("`occurredOn` ligada: a data do lançamento anterior sobrevive", async () => {
    renderWithInherit(["occurredOn"]);

    const payload = await fillSaveTwice();

    expect(payload.occurredOn).toEqual(new Date("2026-03-05"));
    // O resto continua limpo — uma chave ligada não liga as outras.
    expect(payload.categoryId).toBeNull();
    expect(payload.institutionId).toBeNull();
    expect(payload.responsiblePartyId).toBe("party-1");
  });

  it("`category` ligada: herda categoria E subcategoria juntas (par coerente)", async () => {
    renderWithInherit(["category"]);

    const payload = await fillSaveTwice();

    expect(payload.categoryId).toBe("cat-1");
    expect(payload.subcategoryId).toBe("sub-1");
    expect(payload.institutionId).toBeNull();
  });

  it("`category` desligada leva a subcategoria junto — nunca sobra órfã", async () => {
    renderWithInherit(["institution"]);

    const payload = await fillSaveTwice();

    expect(payload.categoryId).toBeNull();
    expect(payload.subcategoryId).toBeNull();
  });

  it("`institution` ligada: a instituição do lançamento anterior sobrevive", async () => {
    renderWithInherit(["institution"]);

    const payload = await fillSaveTwice();

    expect(payload.institutionId).toBe("inst-1");
    expect(payload.categoryId).toBeNull();
  });

  it("`responsibleUser` ligada: o responsável escolhido sobrevive ao default da conta", async () => {
    renderWithInherit(["responsibleUser"]);

    const payload = await fillSaveTwice();

    expect(payload.responsiblePartyId).toBe("party-2");
  });

  it("sem a prop, o default reproduz o comportamento de sempre: só a data sobrevive", async () => {
    renderRow({
      categories: CATEGORIES,
      institutions: INSTITUTIONS,
      parties: PARTIES,
      defaultResponsiblePartyId: "party-1",
    });

    const payload = await fillSaveTwice();

    expect(payload.occurredOn).toEqual(new Date("2026-03-05"));
    expect(payload.categoryId).toBeNull();
    expect(payload.subcategoryId).toBeNull();
    expect(payload.institutionId).toBeNull();
    expect(payload.responsiblePartyId).toBe("party-1");
  });
});

describe("NewTransactionRow — aplicação manual de apelido (Fase 4)", () => {
  beforeEach(() => {
    createTransactionAction.mockReset();
    createTransactionAction.mockResolvedValue({ ok: true, data: { transactionId: "tx-new" } });
  });

  it("acende o ícone ao casar o gatilho e aplica os campos do apelido ao confirmar no popover", async () => {
    renderRow({ aliases: [CEG_ALIAS] });

    await userEvent.type(screen.getByPlaceholderText("Descrição…"), "pagamento CEG");
    await userEvent.click(await screen.findByRole("button", { name: "Apelido" }));
    await userEvent.click(await screen.findByRole("button", { name: "Aplicar" }));

    await userEvent.click(screen.getByPlaceholderText("Descrição…"));
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(createTransactionAction).toHaveBeenCalledTimes(1));
    const payload = createTransactionAction.mock.calls[0][1];
    expect(payload.categoryId).toBe("cat-1");
    expect(payload.isPending).toBe(true);
  });

  it('"Desfazer" no snackbar restaura os campos — nada persiste até Salvar', async () => {
    renderRow({ aliases: [CEG_ALIAS] });

    await userEvent.type(screen.getByPlaceholderText("Descrição…"), "pagamento CEG");
    await userEvent.click(await screen.findByRole("button", { name: "Apelido" }));
    await userEvent.click(await screen.findByRole("button", { name: "Aplicar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Desfazer" }));

    await userEvent.click(screen.getByPlaceholderText("Descrição…"));
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(createTransactionAction).toHaveBeenCalledTimes(1));
    const payload = createTransactionAction.mock.calls[0][1];
    expect(payload.categoryId).toBeNull();
    expect(payload.isPending).toBe(false);
  });

  it("não vaza isPending do apelido para o próximo lançamento na entrada rápida (regressão)", async () => {
    renderRow({ aliases: [CEG_ALIAS] });

    await userEvent.type(screen.getByPlaceholderText("Descrição…"), "pagamento CEG");
    await userEvent.click(await screen.findByRole("button", { name: "Apelido" }));
    await userEvent.click(await screen.findByRole("button", { name: "Aplicar" }));
    await userEvent.click(screen.getByPlaceholderText("Descrição…"));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(createTransactionAction).toHaveBeenCalledTimes(1));
    expect(createTransactionAction.mock.calls[0][1].isPending).toBe(true);

    // Linha permanece aberta (entrada rápida) — próximo lançamento não deve herdar isPending.
    await userEvent.type(screen.getByPlaceholderText("Descrição…"), "Mercado{Enter}");
    await waitFor(() => expect(createTransactionAction).toHaveBeenCalledTimes(2));
    expect(createTransactionAction.mock.calls[1][1].isPending).toBe(false);
  });
});
