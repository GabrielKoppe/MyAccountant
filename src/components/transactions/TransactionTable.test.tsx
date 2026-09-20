// Spec 69 §2.1 (aba "Comportamento") — os controles do tipo de tabela ligados na
// TABELA DO MÊS. Cada bloco abaixo prova o EFEITO OBSERVÁVEL de um controle:
// a ordem em que as linhas saem no DOM, a existência (ou não) das caixas de
// seleção e da barra de ações, a linha-fantasma na tela, e os cabeçalhos de
// bloco com o subtotal. O último bloco é a trava do que JÁ funcionava: o
// agrupamento por data do menu ⋮ da tabela.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import { TransactionTable } from "./TransactionTable";
import type { TransactionRow as TxRow } from "./types";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// Nada aqui participa do que se prova: são os módulos que resolvem Server
// Actions (ou o router) e que seriam carregados de verdade só por estarem na
// árvore da linha.
vi.mock("@/actions/transactions", () => ({
  createTransactionAction: vi.fn(),
  updateTransactionAction: vi.fn(),
  duplicateTransactionAction: vi.fn(),
  bulkUpdateAction: vi.fn(),
  bulkDeleteAction: vi.fn(),
  moveTransactionsAction: vi.fn(),
  listTablesForMoveAction: vi.fn(),
}));
vi.mock("@/actions/account-settings", () => ({
  createCategoryAction: vi.fn(),
  createInstitutionAction: vi.fn(),
  createSubcategoryAction: vi.fn(),
}));
vi.mock("@/actions/tags", () => ({
  addTagToTransactionAction: vi.fn(),
  removeTagFromTransactionAction: vi.fn(),
  bulkAddTagAction: vi.fn(),
  bulkRemoveTagAction: vi.fn(),
  updateTagAction: vi.fn(),
  listTagsAction: vi.fn(),
}));
vi.mock("@/actions/transaction-links", () => ({
  listLinksForTransactionAction: vi.fn(),
  deleteTransactionLinkAction: vi.fn(),
}));
vi.mock("@/actions/transaction-aliases", () => ({
  createTransactionAliasAction: vi.fn(),
  updateTransactionAliasAction: vi.fn(),
}));
vi.mock("@/actions/installments", () => ({
  getInstallmentGroupPanelDataAction: vi.fn(),
  settleInstallmentGroupAction: vi.fn(),
  undoInstallmentGroupAction: vi.fn(),
  listTablesForSettlementAction: vi.fn(),
  setInstallmentGroupAutoCreateAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/months/MonthFilterContext", () => ({
  useMonthFilters: () => ({
    filters: {},
    clearFilters: vi.fn(),
    isActive: false,
    updateTagInOptions: vi.fn(),
  }),
  applyGlobalFilters: (rows: TxRow[]) => rows,
}));
vi.mock("@/components/providers/DeleteUndoProvider", () => ({
  useDeleteUndo: () => ({
    requestDelete: vi.fn(),
    registerRestoreCallback: vi.fn(),
    unregisterRestoreCallback: vi.fn(),
  }),
}));

/**
 * `useIsNarrow` (row-layout.ts) mede a largura do container para degradar o
 * layout A em "pills" no estreito. No jsdom não existe `ResizeObserver` e todo
 * `getBoundingClientRect()` devolve 0 — sem estes dois stubs a tabela cai SEMPRE
 * em pílulas, onde não há cabeçalho de coluna nem grade para conferir.
 */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { width: 1200, height: 40, top: 0, left: 0, right: 1200, bottom: 40, x: 0, y: 0, toJSON: () => ({}) };
  };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function tx(overrides: Partial<TxRow> & { id: string; description: string }): TxRow {
  return {
    monthId: "month-1",
    occurredOn: "2026-03-10",
    amountCents: "1000",
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
    createdById: "user-1",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedById: null,
    updatedAt: "2026-03-10T00:00:00.000Z",
    ...overrides,
  };
}

const CATEGORIES = [
  { id: "cat-1", name: "Alimentação", subcategories: [] },
  { id: "cat-2", name: "Moradia", subcategories: [] },
];

type TableProps = Parameters<typeof TransactionTable>[0];

function renderTable(overrides: Partial<TableProps> = {}) {
  return render(
    <SnackbarProvider>
      <TransactionTable
        tableId="table-1"
        monthId="month-1"
        accountId="acc-1"
        currentUserId="user-1"
        canEdit
        timezone="America/Sao_Paulo"
        sectionIsActive
        sectionCountType="subtract"
        hiddenColumns={{}}
        rowLayout="columns"
        initialTransactions={[]}
        categories={CATEGORIES}
        institutions={[]}
        members={[]}
        parties={[{ id: "party-1", name: "Gabriel", kind: "personal", icon: null, color: null, imageUrl: null }]}
        aliases={[]}
        defaultResponsiblePartyId={null}
        showNewRow={false}
        onNewRowClose={vi.fn()}
        groupByDate={false}
        {...overrides}
      />
    </SnackbarProvider>,
  );
}

/**
 * Descrições das linhas de transação, na ORDEM do DOM. A 3ª célula é a descrição
 * no layout A (seleção · data · descrição · …); linhas que não são de transação
 * (cabeçalho de bloco, gaveta, linha-fantasma) não têm 3ª célula com texto.
 */
function renderedDescriptions(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("tbody > tr > td:nth-child(3)"))
    .map((cell) => cell.textContent?.trim() ?? "")
    .filter((d) => ["Mercado", "Aluguel", "Cinema"].includes(d));
}

const THREE_ROWS = [
  tx({ id: "a", description: "Mercado", occurredOn: "2026-03-05", categoryId: "cat-1" }),
  tx({ id: "b", description: "Aluguel", occurredOn: "2026-03-20", categoryId: "cat-2" }),
  tx({ id: "c", description: "Cinema", occurredOn: "2026-03-12" }),
];

// ─── 1. defaultSort ───────────────────────────────────────────────────────────

describe("defaultSort — a tabela abre na ordenação do tipo", () => {
  it("crescente por data: a linha mais antiga vem primeiro", () => {
    const { container } = renderTable({
      initialTransactions: THREE_ROWS,
      defaultSort: { key: "occurredOn", dir: "asc" },
    });

    expect(renderedDescriptions(container)).toEqual(["Mercado", "Cinema", "Aluguel"]);
  });

  it("decrescente por data inverte a mesma tabela", () => {
    const { container } = renderTable({
      initialTransactions: THREE_ROWS,
      defaultSort: { key: "occurredOn", dir: "desc" },
    });

    expect(renderedDescriptions(container)).toEqual(["Aluguel", "Cinema", "Mercado"]);
  });

  it("padrão por descrição ordena por texto, sem ninguém tocar no cabeçalho", () => {
    const { container } = renderTable({
      initialTransactions: THREE_ROWS,
      defaultSort: { key: "description", dir: "asc" },
    });

    expect(renderedDescriptions(container)).toEqual(["Aluguel", "Cinema", "Mercado"]);
  });

  it("clicar no cabeçalho continua reordenando por cima do padrão", async () => {
    const { container } = renderTable({
      initialTransactions: THREE_ROWS,
      defaultSort: { key: "occurredOn", dir: "desc" },
    });

    await userEvent.click(screen.getByText("Data"));

    // 1º clique numa coluna = crescente, independentemente do padrão.
    expect(renderedDescriptions(container)).toEqual(["Mercado", "Cinema", "Aluguel"]);
  });
});

// ─── 2. allowBulkEdit ─────────────────────────────────────────────────────────

describe("allowBulkEdit — seleção e edição em massa", () => {
  it("ligado: há checkbox por linha, 'selecionar tudo' e a barra ao marcar", async () => {
    renderTable({ initialTransactions: THREE_ROWS, allowBulkEdit: true });

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(4); // 3 linhas + selecionar tudo

    await userEvent.click(checkboxes[1]);
    expect(screen.getByText(m.transactions.bulk.selected(1))).toBeInTheDocument();
  });

  it("desligado: nenhum checkbox na tabela e nenhuma barra de ações", () => {
    renderTable({ initialTransactions: THREE_ROWS, allowBulkEdit: false });

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByText(m.transactions.bulk.selected(1))).not.toBeInTheDocument();
  });

  it("desligado: o resto da linha continua de pé (menu ⋮ e as linhas)", () => {
    const { container } = renderTable({ initialTransactions: THREE_ROWS, allowBulkEdit: false });

    expect(renderedDescriptions(container)).toEqual(["Aluguel", "Cinema", "Mercado"]);
    expect(screen.getAllByLabelText(m.common.moreActions).length).toBeGreaterThanOrEqual(3);
  });

  it("desligado: a grade não perde a coluna — o cabeçalho mantém a célula vazia", () => {
    const { container } = renderTable({ initialTransactions: THREE_ROWS, allowBulkEdit: false });

    const headerCells = container.querySelectorAll("thead tr th, thead tr td");
    const bodyCells = container.querySelectorAll("tbody tr:first-of-type td");
    expect(headerCells.length).toBe(bodyCells.length);
  });
});

// ─── 3. keepGhostRow ──────────────────────────────────────────────────────────

/** A linha-fantasma é a única com o campo de descrição em branco (placeholder). */
const ghostField = () => screen.queryByPlaceholderText("Descrição…");

describe("keepGhostRow — linha-fantasma de criação", () => {
  it("ligado: a linha vazia está na tela sem ninguém pedir, e no FIM da tabela", () => {
    const { container } = renderTable({ initialTransactions: THREE_ROWS, keepGhostRow: true });

    expect(ghostField()).toBeInTheDocument();

    // "No fim" = depois de TODA linha de transação. (A linha-fantasma arrasta
    // junto a sua barra de gavetas, que é um <tr> próprio logo abaixo dela.)
    const bodyRows = Array.from(container.querySelectorAll("tbody > tr"));
    const ghostIndex = bodyRows.indexOf(ghostField()!.closest("tr")!);
    const lastTxIndex = bodyRows.reduce((last, row, i) => {
      const text = row.querySelector("td:nth-child(3)")?.textContent?.trim() ?? "";
      return ["Mercado", "Aluguel", "Cinema"].includes(text) ? i : last;
    }, -1);
    expect(ghostIndex).toBeGreaterThan(lastTxIndex);
  });

  it("desligado: não há linha vazia até acionar 'Nova transação'", () => {
    const { rerender } = renderTable({ initialTransactions: THREE_ROWS, keepGhostRow: false });

    expect(ghostField()).not.toBeInTheDocument();

    rerender(
      <SnackbarProvider>
        <TransactionTable
          tableId="table-1"
          monthId="month-1"
          accountId="acc-1"
          currentUserId="user-1"
          canEdit
          timezone="America/Sao_Paulo"
          sectionIsActive
          sectionCountType="subtract"
          hiddenColumns={{}}
          rowLayout="columns"
          initialTransactions={THREE_ROWS}
          categories={CATEGORIES}
          institutions={[]}
          members={[]}
          parties={[]}
          aliases={[]}
          defaultResponsiblePartyId={null}
          keepGhostRow={false}
          showNewRow
          onNewRowClose={vi.fn()}
          groupByDate={false}
        />
      </SnackbarProvider>,
    );

    expect(ghostField()).toBeInTheDocument();
  });

  it("ligado em tabela somente-leitura: nada de linha-fantasma", () => {
    renderTable({ initialTransactions: THREE_ROWS, keepGhostRow: true, sectionIsActive: false });

    expect(ghostField()).not.toBeInTheDocument();
  });

  it("ligado numa tabela vazia: a linha vazia substitui o estado vazio", () => {
    renderTable({ initialTransactions: [], keepGhostRow: true });

    expect(ghostField()).toBeInTheDocument();
    expect(screen.queryByText(m.transactions.emptyTable.title)).not.toBeInTheDocument();
    // E não pode aparecer "nenhuma transação encontrada" sem filtro nenhum.
    expect(screen.queryByText(m.transactions.filters.noResults)).not.toBeInTheDocument();
  });
});

// ─── 4 e 5. groupBy + showGroupSubtotal ───────────────────────────────────────

/** Cabeçalhos de bloco: as únicas células com colSpan na tbody. */
function groupHeaders(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('tbody td[colspan="99"]')).map(
    (cell) => cell.textContent?.trim() ?? "",
  );
}

describe("groupBy — blocos por categoria, responsável e parcela", () => {
  it("categoria: um bloco por categoria e 'Sem categoria' por último", () => {
    const { container } = renderTable({
      initialTransactions: THREE_ROWS,
      typeGroupBy: "category",
      defaultSort: { key: "description", dir: "asc" },
    });

    expect(groupHeaders(container)).toEqual([
      "Moradia",
      "Alimentação",
      m.dashboards.members.uncategorized,
    ]);
    // As linhas continuam todas na tela, agora dentro dos blocos.
    expect(renderedDescriptions(container)).toEqual(["Aluguel", "Mercado", "Cinema"]);
  });

  it("responsável: o bloco 'Sem responsável' recolhe quem não tem persona", () => {
    const { container } = renderTable({
      initialTransactions: [
        tx({ id: "a", description: "Mercado", responsiblePartyId: "party-1" }),
        tx({ id: "b", description: "Cinema" }),
      ],
      typeGroupBy: "responsible",
    });

    expect(groupHeaders(container)).toEqual(["Gabriel", m.dashboards.members.unassigned]);
  });

  it("sem agrupamento não existe cabeçalho de bloco nenhum", () => {
    const { container } = renderTable({ initialTransactions: THREE_ROWS, typeGroupBy: null });

    expect(groupHeaders(container)).toEqual([]);
  });
});

describe("showGroupSubtotal — soma por bloco", () => {
  const MIXED = [
    tx({ id: "a", description: "Mercado", categoryId: "cat-1", amountCents: "-15050" }),
    tx({ id: "b", description: "Cinema", categoryId: "cat-1", amountCents: "20000" }),
    tx({ id: "c", description: "Aluguel", categoryId: "cat-2", amountCents: "700" }),
  ];

  it("ligado: o cabeçalho do bloco mostra a soma, com sinais misturados", () => {
    const { container } = renderTable({
      initialTransactions: MIXED,
      typeGroupBy: "category",
      showGroupSubtotal: true,
      defaultSort: { key: "description", dir: "asc" },
    });

    // Aluguel (Moradia) vem primeiro na ordem alfabética: 7,00.
    // Alimentação: -150,50 + 200,00 = 49,50.
    const headers = groupHeaders(container);
    expect(headers[0]).toMatch(/Moradia/);
    expect(headers[0]).toMatch(/7,00/);
    expect(headers[1]).toMatch(/Alimentação/);
    expect(headers[1]).toMatch(/49,50/);
  });

  it("desligado: o cabeçalho tem só o nome do bloco", () => {
    const { container } = renderTable({
      initialTransactions: MIXED,
      typeGroupBy: "category",
      showGroupSubtotal: false,
    });

    expect(groupHeaders(container).some((h) => /49,50/.test(h))).toBe(false);
  });

  it("a cor do subtotal segue a convenção da seção, não o sinal cru", () => {
    // Em seção `subtract` o valor positivo armazenado é DESPESA: o subtotal tem
    // que ler igual às linhas que ele soma, não verde por ser positivo.
    const colorIn = (countType: "subtract" | "add") => {
      const { container, unmount } = renderTable({
        initialTransactions: [tx({ id: "a", description: "Mercado", amountCents: "700" })],
        typeGroupBy: "category",
        showGroupSubtotal: true,
        sectionCountType: countType,
      });
      // No cabeçalho do bloco há duas `caption`: o rótulo e, depois dele, o valor.
      const captions = container.querySelectorAll(
        'tbody td[colspan="99"] .MuiTypography-caption',
      );
      const value = captions[captions.length - 1]!;
      // O jsdom não resolve a folha do Emotion em `getComputedStyle`; a REGRA
      // emitida para a classe é a evidência disponível (mesmo caminho de
      // `pending-row-scope.test.tsx`).
      const emotionClass = Array.from(value.classList).find((c) => c.startsWith("css-"))!;
      const css = Array.from(document.querySelectorAll("style"))
        .map((tag) => tag.textContent ?? "")
        .join("\n");
      const rule = css.split("}").find((block) => block.includes(`.${emotionClass}{`)) ?? "";
      unmount();
      // A última declaração vence no CSS — é a do `sx` que este teste verifica.
      const colors = Array.from(rule.matchAll(/color:([^;]+)/g)).map((match) => match[1]);
      return colors[colors.length - 1] ?? "";
    };

    const subtract = colorIn("subtract");
    expect(subtract).not.toBe("");
    expect(subtract).not.toBe(colorIn("add"));
  });

  it("sem agrupamento, o toggle não promete nada — não há onde somar", () => {
    const { container } = renderTable({
      initialTransactions: MIXED,
      typeGroupBy: null,
      showGroupSubtotal: true,
    });

    expect(groupHeaders(container)).toEqual([]);
  });
});

// ─── 6. Trava do que já funcionava: agrupar por data ──────────────────────────

describe("agrupamento por data (menu ⋮ da tabela) segue funcionando", () => {
  it("`groupByDate` liga os separadores de data, com o rótulo por extenso", () => {
    const { container } = renderTable({ initialTransactions: THREE_ROWS, groupByDate: true });

    expect(groupHeaders(container)).toEqual(["20 de março", "12 de março", "5 de março"]);
  });

  it("o toggle da tabela vence o `groupBy` do tipo no eixo data", () => {
    const { container } = renderTable({
      initialTransactions: THREE_ROWS,
      groupByDate: true,
      typeGroupBy: "category",
    });

    expect(groupHeaders(container)).toEqual(["20 de março", "12 de março", "5 de março"]);
  });

  it("ordenar por outra coluna suspende os blocos de data, como antes", async () => {
    const { container } = renderTable({ initialTransactions: THREE_ROWS, groupByDate: true });

    await userEvent.click(screen.getByText("Valor"));

    expect(groupHeaders(container)).toEqual([]);
    expect(renderedDescriptions(container)).toHaveLength(3);
  });
});
