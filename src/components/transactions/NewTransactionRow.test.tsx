import { render, screen, waitFor } from "@testing-library/react";
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

// RowDrawer importa (estaticamente) RowLinksSection e TagPopover, que puxam
// Server Actions (transaction-links / tags → next-auth) não resolvíveis sob
// vitest — mesmo padrão do mock de @/actions/transactions acima. Nenhum dos
// dois é renderizado no create (sem `links`/`tags`), então basta mockar os
// módulos para a resolução do grafo de import; useRouter não é chamado.
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

    await userEvent.type(screen.getByPlaceholderText("Descrição"), "Café{Enter}");

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

    await userEvent.type(screen.getByPlaceholderText("Descrição"), "Mercado{Enter}");

    await waitFor(() => expect(createTransactionAction).toHaveBeenCalled());
    // A linha permanece montada e o campo de descrição é limpo para o próximo lançamento.
    await waitFor(() => expect(screen.getByPlaceholderText("Descrição")).toHaveValue(""));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("não cria lançamento fantasma ao dar Enter numa linha intocada (guard pristino)", async () => {
    renderRow();

    // Linha aberta e vazia: um Enter perdido não deve disparar o create.
    screen.getByPlaceholderText("Descrição").focus();
    await userEvent.keyboard("{Enter}");

    expect(createTransactionAction).not.toHaveBeenCalled();
  });

  it("propaga o expenseType escolhido pelo usuário", async () => {
    renderRow();

    await userEvent.click(screen.getByRole("button", { name: "Transação fixa" }));
    await userEvent.type(screen.getByPlaceholderText("Descrição"), "Aluguel{Enter}");

    await waitFor(() => expect(createTransactionAction).toHaveBeenCalled());
    expect(createTransactionAction.mock.calls[0][1].expenseType).toBe("fixed");
  });
});

describe("NewTransactionRow — aplicação manual de apelido (Fase 4)", () => {
  beforeEach(() => {
    createTransactionAction.mockReset();
    createTransactionAction.mockResolvedValue({ ok: true, data: { transactionId: "tx-new" } });
  });

  it("acende o ícone ao casar o gatilho e aplica os campos do apelido ao confirmar no popover", async () => {
    renderRow({ aliases: [CEG_ALIAS] });

    await userEvent.type(screen.getByPlaceholderText("Descrição"), "pagamento CEG");
    await userEvent.click(await screen.findByRole("button", { name: 'Aplicar apelido "CEG"' }));
    await userEvent.click(await screen.findByRole("button", { name: "Aplicar" }));

    await userEvent.click(screen.getByPlaceholderText("Descrição"));
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(createTransactionAction).toHaveBeenCalledTimes(1));
    const payload = createTransactionAction.mock.calls[0][1];
    expect(payload.categoryId).toBe("cat-1");
    expect(payload.isPending).toBe(true);
  });

  it('"Desfazer" no snackbar restaura os campos — nada persiste até Salvar', async () => {
    renderRow({ aliases: [CEG_ALIAS] });

    await userEvent.type(screen.getByPlaceholderText("Descrição"), "pagamento CEG");
    await userEvent.click(await screen.findByRole("button", { name: 'Aplicar apelido "CEG"' }));
    await userEvent.click(await screen.findByRole("button", { name: "Aplicar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Desfazer" }));

    await userEvent.click(screen.getByPlaceholderText("Descrição"));
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(createTransactionAction).toHaveBeenCalledTimes(1));
    const payload = createTransactionAction.mock.calls[0][1];
    expect(payload.categoryId).toBeNull();
    expect(payload.isPending).toBe(false);
  });

  it("não vaza isPending do apelido para o próximo lançamento na entrada rápida (regressão)", async () => {
    renderRow({ aliases: [CEG_ALIAS] });

    await userEvent.type(screen.getByPlaceholderText("Descrição"), "pagamento CEG");
    await userEvent.click(await screen.findByRole("button", { name: 'Aplicar apelido "CEG"' }));
    await userEvent.click(await screen.findByRole("button", { name: "Aplicar" }));
    await userEvent.click(screen.getByPlaceholderText("Descrição"));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(createTransactionAction).toHaveBeenCalledTimes(1));
    expect(createTransactionAction.mock.calls[0][1].isPending).toBe(true);

    // Linha permanece aberta (entrada rápida) — próximo lançamento não deve herdar isPending.
    await userEvent.type(screen.getByPlaceholderText("Descrição"), "Mercado{Enter}");
    await waitFor(() => expect(createTransactionAction).toHaveBeenCalledTimes(2));
    expect(createTransactionAction.mock.calls[1][1].isPending).toBe(false);
  });
});
