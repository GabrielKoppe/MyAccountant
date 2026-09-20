// Spec 69 · acabamento visual — trava o invariante do esmaecimento da linha
// PENDENTE: `opacity` num ancestral compõe o subárvore como um GRUPO, e nenhum
// descendente consegue se resgatar. Se alguém "simplificar" isto de volta para
// `opacity` no `<tr>`, o chip que NOMEIA o estado volta a cair para ~1,8:1 no
// light — ilegível. O bug é invisível em code review; por isso está em teste.
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { ColumnsRow, PENDING_DIM_CLASS, PENDING_HOST_CLASS } from "./ColumnsRow";
import { PillsRow, type PillsRowProps } from "./PillsRow";
import type { TransactionRow as TxRow } from "./types";

function makeTx(overrides: Partial<TxRow> = {}): TxRow {
  return {
    id: "tx-1",
    monthId: "month-1",
    occurredOn: "2099-11-10",
    amountCents: "10000",
    description: "Mercado",
    notes: null,
    isPending: true,
    isFavorite: true,
    categoryId: "cat-1",
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
    createdAt: "2099-11-10T00:00:00.000Z",
    updatedById: null,
    updatedAt: "2099-11-10T00:00:00.000Z",
    ...overrides,
  };
}

function makeProps(overrides: Partial<PillsRowProps> = {}): PillsRowProps {
  return {
    tx: makeTx(),
    isSelected: false,
    isReadOnly: false,
    sectionCountType: "subtract",
    hiddenColumns: {},
    categories: [{ id: "cat-1", name: "Alimentação", subcategories: [] }],
    institutions: [],
    parties: [],
    localTags: [],
    hasSuggestion: true,
    installmentBadgeRef: createRef<HTMLDivElement>(),
    onSelect: vi.fn(),
    onStartEdit: vi.fn(),
    onOpenSuggestion: vi.fn(),
    onOpenTags: vi.fn(),
    onOpenInstallmentPanel: vi.fn(),
    onTogglePending: vi.fn(),
    onToggleFavorite: vi.fn(),
    onViewDetails: vi.fn(),
    onDuplicate: vi.fn(),
    onMove: vi.fn(),
    onCreateAlias: vi.fn(),
    onDelete: vi.fn(),
    onToggleDrawer: vi.fn(),
    drawerOpen: false,
    onOpenMenu: vi.fn(),
    ...overrides,
  };
}

function renderInTable(node: React.ReactNode) {
  return render(
    <table>
      <tbody>{node}</tbody>
    </table>,
  );
}

describe.each([
  ["ColumnsRow", (p: PillsRowProps) => <ColumnsRow {...p} />],
  ["PillsRow", (p: PillsRowProps) => <PillsRow {...p} />],
])("%s — escopo opaco da linha pendente", (_name, renderRow) => {
  it("o chip Pendente está fora de todo elemento esmaecido", () => {
    const { container } = renderInTable(renderRow(makeProps()));

    const chip = screen.getByText("pendente").closest(".MuiChip-root")!;
    expect(chip).not.toBeNull();

    // 1. O chip mora na célula-host (a única <td> não esmaecida em bloco).
    const hostTd = chip.closest("td")!;
    expect(hostTd.classList.contains(PENDING_HOST_CLASS)).toBe(true);

    // 2. Nenhum ancestral do chip carrega .row-dim.
    expect(chip.closest(`.${PENDING_DIM_CLASS}`)).toBeNull();

    // 3. A REGRA emitida pelo Emotion para a classe do <tr> não pode conter
    //    `opacity` no próprio seletor da linha (isso seria o grupo opaco).
    const tr = container.querySelector("tr")!;
    const emotionClass = Array.from(tr.classList).find((c) => c.startsWith("css-"))!;
    const css = Array.from(document.querySelectorAll("style"))
      .map((s) => s.textContent ?? "")
      .join("\n");
    const rowRule = css
      .split("}")
      .find((block) => block.includes(`.${emotionClass}{`) || block.startsWith(`.${emotionClass}{`));
    expect(rowRule ?? "").not.toMatch(/opacity/);
    // ...mas a regra POR CÉLULA existe, e a exceção da host também.
    expect(css).toMatch(new RegExp(`\\.${emotionClass}>td\\{[^}]*opacity:0\\.6`));
    expect(css).toMatch(new RegExp(`\\.${emotionClass}>td\\.${PENDING_HOST_CLASS}\\{[^}]*opacity:1`));
    expect(css).toMatch(
      new RegExp(
        `\\.${emotionClass}>td\\.${PENDING_HOST_CLASS} \\.${PENDING_DIM_CLASS}\\{[^}]*opacity:0\\.6`,
      ),
    );

    // 4. Prova de que o esmaecimento continua valendo para o RESTO:
    //    existe exatamente uma td-host, e há >= 1 td irmã (esmaecida por `& > td`)
    //    além de >= 1 elemento .row-dim dentro da host.
    const tds = Array.from(tr.querySelectorAll(":scope > td"));
    const hosts = tds.filter((td) => td.classList.contains(PENDING_HOST_CLASS));
    expect(hosts).toHaveLength(1);
    expect(tds.length - hosts.length).toBeGreaterThanOrEqual(1);
    expect(hostTd.querySelectorAll(`.${PENDING_DIM_CLASS}`).length).toBeGreaterThanOrEqual(2);

    // 5. A descrição (dentro da host) ESTÁ esmaecida.
    const desc = screen.getByText("Mercado");
    expect(desc.closest(`.${PENDING_DIM_CLASS}`)).not.toBeNull();
  });

  it("linha NÃO pendente não marca host nem dim", () => {
    const { container } = renderInTable(
      renderRow(makeProps({ tx: makeTx({ isPending: false }) })),
    );
    const tr = container.querySelector("tr")!;
    expect(tr.querySelectorAll(`.${PENDING_HOST_CLASS}`)).toHaveLength(0);
  });
});
