import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SnackbarProvider } from "notistack";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

import { OptionsProvider } from "./OptionsContext";
import { TransactionRow } from "./TransactionRow";
import type { TransactionRow as TxRow } from "./types";

// A árvore de TransactionRow importa estaticamente vários componentes que, por
// sua vez, importam Server Actions ("use server") incondicionalmente — mesmo
// quando o JSX condicional que os usa nunca chega a renderizar (aliasDialog,
// InstallmentGroupPanel, LinkTransactionDialog, TagPopover→TagEditor). Mocka-se
// cada módulo de actions alcançável para isolar o teste do server (mesmo padrão
// de NewTransactionRow.test.tsx / TransactionDetailDialog.test.tsx).
vi.mock("@/actions/transactions", () => ({
  updateTransactionAction: vi.fn(),
  duplicateTransactionAction: vi.fn(),
}));
vi.mock("@/actions/tags", () => ({
  listTagsAction: vi.fn().mockResolvedValue([]),
  addTagToTransactionAction: vi.fn(),
  removeTagFromTransactionAction: vi.fn(),
  updateTagAction: vi.fn(),
}));
vi.mock("@/actions/transaction-links", () => ({
  listLinksForTransactionAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  deleteTransactionLinkAction: vi.fn(),
  createTransactionLinkAction: vi.fn(),
  getMonthsForLinkAction: vi.fn(),
  getSectionsTablesForLinkAction: vi.fn(),
  searchTransactionsForLinkAction: vi.fn(),
}));
vi.mock("@/actions/transaction-aliases", () => ({
  createTransactionAliasAction: vi.fn(),
  updateTransactionAliasAction: vi.fn(),
}));
vi.mock("@/actions/installments", () => ({
  getInstallmentGroupPanelDataAction: vi.fn(),
  convertPendingInstallmentForExistingMonthAction: vi.fn(),
  undoInstallmentGroupAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Defeito pré-existente do ambiente (não relacionado ao pacote P5): o client
// Prisma gerado neste checkout está desatualizado e não exporta os enums
// `AliasMatchMode`/`AliasPriority`, então importar o schema real de aliases
// lança "Cannot read properties of undefined (reading 'contains')" no import
// estático de TransactionAliasFormDialog (via TransactionRow → aliasDialog).
// O diálogo nunca é aberto neste teste (aliasDialogOpen permanece false, então
// TransactionAliasFormDialog nunca é sequer chamado) — o mock só evita que o
// módulo real seja avaliado no load do grafo de módulos.
vi.mock("@/lib/schemas/transaction-alias", () => ({
  createTransactionAliasSchema: z.object({}),
}));

const TX: TxRow = {
  id: "tx-1",
  monthId: "m-1",
  occurredOn: "2026-06-15",
  amountCents: "4590",
  description: "Netflix",
  notes: null,
  isPending: false,
  isFavorite: false,
  categoryId: null,
  subcategoryId: null,
  institutionId: null,
  institutionText: null,
  responsiblePartyId: null,
  cardInstallment: null,
  investmentType: null,
  expenseType: null,
  paymentMethod: null,
  source: "manual",
  installmentGroupId: null,
  installmentNumber: null,
  installmentGroupCount: null,
  originalAmountCents: null,
  originalCurrency: null,
  exchangeRate: null,
  tags: [],
  linkCount: 0,
  createdById: "u-1",
  createdAt: "2026-06-15T00:00:00.000Z",
  updatedById: null,
  updatedAt: "2026-06-15T00:00:00.000Z",
};

const ALIASES: SerializedTransactionAlias[] = [];

function renderRow(props: Partial<Parameters<typeof TransactionRow>[0]> = {}) {
  const spies = {
    onSelect: vi.fn(),
    onOptimisticUpdate: vi.fn(),
    onDeleteRequested: vi.fn(),
    onDuplicated: vi.fn(),
    onViewDetails: vi.fn(),
    onAutoEditConsumed: vi.fn(),
    onOpenMenu: vi.fn(),
    onOpenMove: vi.fn(),
  };
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
            <TransactionRow
              tx={TX}
              accountId="acc-1"
              currentUserId="user-1"
              isSelected={false}
              isReadOnly={false}
              sectionCountType="add"
              hiddenColumns={{}}
              effectiveLayout="columns"
              categories={[]}
              institutions={[]}
              members={[]}
              parties={[]}
              aliases={ALIASES}
              autoEdit={false}
              {...spies}
              {...props}
            />
          </tbody>
        </table>
      </OptionsProvider>
    </SnackbarProvider>,
  );
  return spies;
}

describe("TransactionRow — TX-03c (editar a partir do modal de detalhe)", () => {
  it("com autoEdit, entra em edição inline com o foco na Descrição (não na Data)", async () => {
    renderRow({ autoEdit: true });

    const descriptionInput = await waitFor(() => screen.getByPlaceholderText("Descrição"));
    await waitFor(() => expect(descriptionInput).toHaveFocus());

    // Regressão: o campo Data (occurredOn) não deve ficar com o foco — era o
    // comportamento antigo de `startEdit()` sem argumento (default "occurredOn").
    const dateInput = screen.getByDisplayValue(TX.occurredOn);
    expect(dateInput).not.toHaveFocus();
  });

  it("sem autoEdit, permanece em modo leitura (linha normal, sem editor)", () => {
    renderRow({ autoEdit: false });

    expect(screen.queryByPlaceholderText("Descrição")).not.toBeInTheDocument();
    expect(screen.getByText("Netflix")).toBeInTheDocument();
  });
});

describe("TransactionRow — edição em massa inline (frame 66 §4)", () => {
  it("com bulkEditing entra em edição exibindo os PRÓPRIOS valores da linha", () => {
    renderRow({ bulkEditing: true, bulkPatch: {} });

    expect(screen.getByPlaceholderText("Descrição")).toHaveValue("Netflix");
    expect(screen.getByDisplayValue(TX.occurredOn)).toBeInTheDocument();
  });

  it("o patch compartilhado sobrepõe o valor da linha (campo tocado vale para todas)", () => {
    renderRow({ bulkEditing: true, bulkPatch: { description: "Assinaturas" } });

    expect(screen.getByPlaceholderText("Descrição")).toHaveValue("Assinaturas");
  });

  it("publica no lote SÓ o campo tocado (diff), nunca a linha inteira", () => {
    const onBulkFieldChange = vi.fn();
    renderRow({ bulkEditing: true, bulkPatch: {}, onBulkFieldChange });

    fireEvent.change(screen.getByPlaceholderText("Descrição"), {
      target: { value: "Spotify" },
    });

    expect(onBulkFieldChange).toHaveBeenCalledTimes(1);
    expect(onBulkFieldChange).toHaveBeenCalledWith({ description: "Spotify" });
  });

  it("Enter salva o LOTE e Esc cancela o LOTE (não a linha)", () => {
    const onBulkSave = vi.fn();
    const onBulkCancel = vi.fn();
    renderRow({ bulkEditing: true, bulkPatch: {}, onBulkSave, onBulkCancel });

    const description = screen.getByPlaceholderText("Descrição");
    fireEvent.keyDown(description, { key: "Enter" });
    expect(onBulkSave).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(description, { key: "Escape" });
    expect(onBulkCancel).toHaveBeenCalledTimes(1);
  });
});
