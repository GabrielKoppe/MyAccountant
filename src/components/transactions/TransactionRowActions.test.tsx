import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TransactionRowActions } from "./TransactionRowActions";
import type { TransactionRow as TxRow } from "./types";

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

function renderActions(props: Partial<Parameters<typeof TransactionRowActions>[0]> = {}) {
  const spies = {
    onStartEdit: vi.fn(),
    onTogglePending: vi.fn(),
    onToggleFavorite: vi.fn(),
    onViewDetails: vi.fn(),
    onDuplicate: vi.fn(),
    onMove: vi.fn(),
    onCreateAlias: vi.fn(),
    onDelete: vi.fn(),
    onOpenLinkDialog: vi.fn(),
    onOpenMenu: vi.fn(),
  };
  render(
    <table>
      <tbody>
        <tr>
          <TransactionRowActions tx={TX} isReadOnly={false} {...spies} {...props} />
        </tr>
      </tbody>
    </table>,
  );
  return spies;
}

describe("TransactionRowActions", () => {
  it("editor: mostra as primárias (pendente, favorito) e o ⋮ com aria-label", () => {
    renderActions();
    expect(screen.getByRole("button", { name: "Marcar como pendente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar aos favoritos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais ações" })).toBeInTheDocument();
  });

  it("viewer: esconde as primárias, mantém só o ⋮", () => {
    renderActions({ isReadOnly: true });
    expect(screen.queryByRole("button", { name: "Marcar como pendente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar aos favoritos" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais ações" })).toBeInTheDocument();
  });

  it("clicar na primária de pendente chama onTogglePending", async () => {
    const spies = renderActions();
    await userEvent.click(screen.getByRole("button", { name: "Marcar como pendente" }));
    expect(spies.onTogglePending).toHaveBeenCalledTimes(1);
  });

  it("clicar no ⋮ chama onOpenMenu com os itens do editor", async () => {
    const spies = renderActions();
    await userEvent.click(screen.getByRole("button", { name: "Mais ações" }));
    expect(spies.onOpenMenu).toHaveBeenCalledTimes(1);
    const items = spies.onOpenMenu.mock.calls[0][1];
    expect(items.map((i: { label: string }) => i.label)).toEqual([
      "Editar",
      "Duplicar",
      "Mover para…",
      "Ver detalhes",
      "Gerenciar vínculos",
      "Criar apelido a partir desta transação",
      "Deletar",
    ]);
  });

  it("aria-label dinâmico quando já pendente/favorito", () => {
    renderActions({ tx: { ...TX, isPending: true, isFavorite: true } });
    expect(screen.getByRole("button", { name: "Marcar como concluída" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover dos favoritos" })).toBeInTheDocument();
  });
});
