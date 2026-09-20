// Spec 69 §16 — colunas fixadas à esquerda.
//
// O que este arquivo trava é a razão pela qual o campo saiu da lista de
// "persistidos mas inertes": a cadeia de `left` é ARITMÉTICA sobre constantes,
// não medição. Se alguém trocar uma largura sem trocar a outra, ou reintroduzir
// medição em JS, o cálculo abaixo denuncia.
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { ColumnsRow, PINNED_CELL_CLASS } from "./ColumnsRow";
import type { ColumnsRowProps } from "./ColumnsRow";
import {
  effectivePinnedColumns,
  PIN_COLUMN_WIDTH,
  PIN_SELECT_WIDTH,
  PIN_Z_INDEX,
  pinnedBodyCellSx,
  pinnedColumnOffsets,
  pinnedHeadCellSx,
  pinnedPaneWidth,
  pinnedSelectCellSx,
} from "./pinned-columns";
import type { TransactionRow as TxRow } from "./types";

/** As receitas devolvem `false` (item neutro do `sx`) ou um objeto de estilo. */
function styleOf(entry: ReturnType<typeof pinnedBodyCellSx>): Record<string, unknown> {
  expect(entry).not.toBe(false);
  return entry as Record<string, unknown>;
}

describe("effectivePinnedColumns — o que de fato gruda", () => {
  it("descarta o que não é fixável e mantém só as colunas de identificação", () => {
    expect(
      effectivePinnedColumns(["category", "occurredOn", "amount", "tags"], {}, "columns"),
    ).toEqual(["occurredOn"]);
  });

  it("sai na ordem das colunas VISÍVEIS, não na ordem em que foi gravado", () => {
    expect(effectivePinnedColumns(["description", "occurredOn"], {}, "columns")).toEqual([
      "occurredOn",
      "description",
    ]);
  });

  it("ignora coluna que não está visível", () => {
    // `category` está escondida E não é fixável — dois motivos para sair; o que
    // importa é que uma chave gravada nunca vira coluna presa por si só.
    expect(
      effectivePinnedColumns(["occurredOn", "category"], { category: true }, "columns"),
    ).toEqual(["occurredOn"]);
  });

  it("em `pills` NADA é preso, mesmo com valor gravado", () => {
    expect(effectivePinnedColumns(["occurredOn", "description"], {}, "pills")).toEqual([]);
  });

  it("tolera lixo vindo do Json do banco", () => {
    expect(effectivePinnedColumns(null, {}, "columns")).toEqual([]);
    expect(effectivePinnedColumns("occurredOn", {}, "columns")).toEqual([]);
    expect(effectivePinnedColumns([42, null, "occurredOn"], {}, "columns")).toEqual(["occurredOn"]);
  });

  it("não duplica quando a mesma chave aparece duas vezes", () => {
    expect(effectivePinnedColumns(["occurredOn", "occurredOn"], {}, "columns")).toEqual([
      "occurredOn",
    ]);
  });
});

describe("cadeia de `left` — soma de constantes, zero medição", () => {
  it("com a coluna de seleção: cada presa começa onde a anterior termina", () => {
    expect(pinnedColumnOffsets(["occurredOn", "description"])).toEqual({
      occurredOn: PIN_SELECT_WIDTH,
      description: PIN_SELECT_WIDTH + PIN_COLUMN_WIDTH.occurredOn,
    });
  });

  it("SEM a coluna de seleção a cadeia inteira desloca para 0", () => {
    expect(pinnedColumnOffsets(["occurredOn", "description"], 0)).toEqual({
      occurredOn: 0,
      description: PIN_COLUMN_WIDTH.occurredOn,
    });
  });

  it("descrição presa SOZINHA gruda logo depois da seleção", () => {
    expect(pinnedColumnOffsets(["description"])).toEqual({ description: PIN_SELECT_WIDTH });
  });

  it("largura do painel congelado = seleção + presas", () => {
    expect(pinnedPaneWidth([])).toBe(0);
    expect(pinnedPaneWidth(["occurredOn"])).toBe(PIN_SELECT_WIDTH + PIN_COLUMN_WIDTH.occurredOn);
    expect(pinnedPaneWidth(["occurredOn", "description"])).toBe(
      PIN_SELECT_WIDTH + PIN_COLUMN_WIDTH.occurredOn + PIN_COLUMN_WIDTH.description,
    );
  });
});

describe("receitas de `sx`", () => {
  const pinned = ["occurredOn", "description"] as const;

  it("cabeçalho e corpo usam EXATAMENTE a mesma largura e o mesmo `left`", () => {
    for (const key of pinned) {
      const head = styleOf(pinnedHeadCellSx(pinned, key));
      const body = styleOf(pinnedBodyCellSx(pinned, key));
      expect(head.width).toBe(body.width);
      expect(head.minWidth).toBe(body.minWidth);
      expect(head.maxWidth).toBe(body.maxWidth);
      expect(head.left).toBe(body.left);
      // ...e a largura é a mesma nas três propriedades: em `table-layout: auto`
      // só `width` seria uma sugestão.
      expect(head.width).toBe(PIN_COLUMN_WIDTH[key]);
      expect(head.minWidth).toBe(PIN_COLUMN_WIDTH[key]);
      expect(head.maxWidth).toBe(PIN_COLUMN_WIDTH[key]);
    }
  });

  it("cabeçalho preso fica acima do corpo preso, e os dois abaixo dos popovers", () => {
    expect(PIN_Z_INDEX.head).toBeGreaterThan(PIN_Z_INDEX.body);
    // `zIndex.modal` do MUI é 1300 — menu ⋮ e selects da edição continuam por cima.
    expect(PIN_Z_INDEX.head).toBeLessThan(1300);
  });

  it("coluna não presa devolve `false` (item neutro do `sx` em array)", () => {
    expect(pinnedBodyCellSx(["occurredOn"], "description")).toBe(false);
    expect(pinnedHeadCellSx([], "occurredOn")).toBe(false);
    expect(pinnedSelectCellSx([])).toBe(false);
  });

  it("só a ÚLTIMA presa desenha o separador do painel", () => {
    expect(styleOf(pinnedBodyCellSx(pinned, "occurredOn")).boxShadow).toBeUndefined();
    expect(typeof styleOf(pinnedBodyCellSx(pinned, "description")).boxShadow).toBe("function");
    // presa sozinha, ela mesma é a última
    expect(typeof styleOf(pinnedBodyCellSx(["occurredOn"], "occurredOn")).boxShadow).toBe(
      "function",
    );
  });

  it("a célula presa tem fundo OPACO — é o que impede o conteúdo de vazar por baixo", () => {
    expect(styleOf(pinnedBodyCellSx(pinned, "occurredOn")).bgcolor).toBe("background.surface");
    expect(styleOf(pinnedBodyCellSx(pinned, "occurredOn", "accent.primarySubtle")).bgcolor).toBe(
      "accent.primarySubtle",
    );
    expect(styleOf(pinnedSelectCellSx(pinned)).bgcolor).toBe("background.surface");
  });

  it("no hover a célula presa continua OPACA — o véu vem como imagem, não como cor", () => {
    // Trocar isto por `bgcolor: <token>` erra a cor (a linha em hover é o véu
    // `action.hover` COMPOSTO sobre o fundo do card, não um token) e, pior, um
    // token translúcido deixaria o conteúdo rolar visível por baixo.
    const cell = styleOf(pinnedBodyCellSx(pinned, "occurredOn")) as Record<
      string,
      Record<string, unknown>
    >;
    const hover = cell["tr.MuiTableRow-hover:hover &"];
    expect(hover.bgcolor).toBeUndefined();
    expect(typeof hover.backgroundImage).toBe("function");

    // Linha selecionada: cor opaca e o véu apagado (senão os dois somariam).
    const selected = cell["tr.Mui-selected &, tr.Mui-selected:hover &"];
    expect(selected.bgcolor).toBe("accent.primarySubtle");
    expect(selected.backgroundImage).toBe("none");
  });

  it("o hover só reage em linha que TEM hover (leitura) — edição e fantasma não piscam", () => {
    const cell = styleOf(pinnedBodyCellSx(pinned, "occurredOn"));
    expect(Object.keys(cell)).toContain("tr.MuiTableRow-hover:hover &");
    expect(Object.keys(cell)).not.toContain("tr:hover &");
  });

  it("a coluna de seleção gruda em 0 — senão a faixa antes da 1ª presa mostraria o scroll", () => {
    const select = styleOf(pinnedSelectCellSx(pinned));
    expect(select.position).toBe("sticky");
    expect(select.left).toBe(0);
    expect(select.width).toBe(PIN_SELECT_WIDTH);
  });
});

// ---------------------------------------------------------------------------

function makeTx(overrides: Partial<TxRow> = {}): TxRow {
  return {
    id: "tx-1",
    monthId: "month-1",
    occurredOn: "2099-11-10",
    amountCents: "10000",
    description: "Mercado",
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
    createdAt: "2099-11-10T00:00:00.000Z",
    updatedById: null,
    updatedAt: "2099-11-10T00:00:00.000Z",
    ...overrides,
  };
}

function makeProps(overrides: Partial<ColumnsRowProps> = {}): ColumnsRowProps {
  return {
    tx: makeTx(),
    isSelected: false,
    isReadOnly: false,
    sectionCountType: "subtract",
    hiddenColumns: {},
    categories: [],
    institutions: [],
    parties: [],
    localTags: [],
    hasSuggestion: false,
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

function renderRow(props: Partial<ColumnsRowProps>) {
  return render(
    <table>
      <tbody>
        <ColumnsRow {...makeProps(props)} />
      </tbody>
    </table>,
  );
}

/** CSS que o Emotion emitiu para a classe do elemento. */
function cssFor(el: Element): string {
  const emotionClasses = Array.from(el.classList).filter((c) => c.startsWith("css-"));
  const all = Array.from(document.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("\n");
  return all
    .split("}")
    .filter((block) => emotionClasses.some((c) => block.includes(`.${c}{`)))
    .join("}");
}

describe("ColumnsRow — a linha de leitura aplica o painel congelado", () => {
  it("marca as células presas e emite `sticky` com o `left` da cadeia", () => {
    const { container } = renderRow({ pinnedColumns: ["occurredOn", "description"] });
    const tds = Array.from(container.querySelectorAll("tr > td"));
    const pinnedTds = tds.filter((td) => td.classList.contains(PINNED_CELL_CLASS));

    // seleção + data + descrição
    expect(pinnedTds).toHaveLength(3);
    expect(pinnedTds).toEqual([tds[0], tds[1], tds[2]]);

    const [selectCss, dateCss, descCss] = pinnedTds.map(cssFor);
    expect(selectCss).toContain("position:sticky");
    expect(selectCss).toContain("left:0");
    expect(dateCss).toContain("position:sticky");
    expect(dateCss).toContain(`left:${PIN_SELECT_WIDTH}px`);
    expect(dateCss).toContain(`width:${PIN_COLUMN_WIDTH.occurredOn}px`);
    expect(descCss).toContain(`left:${PIN_SELECT_WIDTH + PIN_COLUMN_WIDTH.occurredOn}px`);
    expect(descCss).toContain(`width:${PIN_COLUMN_WIDTH.description}px`);
  });

  it("sem colunas presas o DOM não ganha nem uma classe a mais (default de sempre)", () => {
    const { container } = renderRow({});
    expect(container.querySelectorAll(`.${PINNED_CELL_CLASS}`)).toHaveLength(0);
    const dateCell = container.querySelectorAll("tr > td")[1];
    expect(cssFor(dateCell)).not.toContain("position:sticky");
  });

  it("data presa sozinha: a descrição continua rolando", () => {
    const { container } = renderRow({ pinnedColumns: ["occurredOn"] });
    const tds = Array.from(container.querySelectorAll("tr > td"));
    expect(tds[0].classList.contains(PINNED_CELL_CLASS)).toBe(true);
    expect(tds[1].classList.contains(PINNED_CELL_CLASS)).toBe(true);
    expect(tds[2].classList.contains(PINNED_CELL_CLASS)).toBe(false);
  });

  it("linha PENDENTE: a célula presa sai do escopo opaco, mas o conteúdo dela ainda esmaece", () => {
    // Se a `td` presa ficasse a 60%, o FUNDO dela ficaria a 60% junto e o
    // conteúdo que rola por baixo apareceria através — o esmaecimento em bloco
    // e o painel congelado são incompatíveis por construção.
    const { container } = renderRow({
      tx: makeTx({ isPending: true }),
      pinnedColumns: ["occurredOn"],
    });
    const tr = container.querySelector("tr")!;
    const rowClass = Array.from(tr.classList).find((c) => c.startsWith("css-"))!;
    const css = Array.from(document.querySelectorAll("style"))
      .map((s) => s.textContent ?? "")
      .join("\n");

    expect(css).toMatch(new RegExp(`\\.${rowClass}>td\\.${PINNED_CELL_CLASS}\\{[^}]*opacity:1`));
    expect(css).toMatch(
      new RegExp(`\\.${rowClass}>td\\.${PINNED_CELL_CLASS} \\.row-dim\\{[^}]*opacity:0\\.6`),
    );

    // A data continua esmaecendo — só deixou de esmaecer EM BLOCO.
    const dateCell = container.querySelectorAll("tr > td")[1];
    expect(dateCell.querySelector(".row-dim")?.textContent).toBe(
      screen.getByText("10/11").textContent,
    );
  });
});
