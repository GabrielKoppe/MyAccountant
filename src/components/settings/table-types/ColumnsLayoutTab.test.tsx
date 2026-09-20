import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";
import { DENSITY_METRICS } from "@/lib/table-density";

import { ColumnsLayoutTab, type ColumnsLayoutTabProps } from "./ColumnsLayoutTab";
import type { TableTypeDraft } from "./table-type-draft";

const t = m.settings.presentation.tableTypes;
const legacy = m.settings.tableTypes;

function buildDraft(overrides: Partial<TableTypeDraft> = {}): TableTypeDraft {
  return {
    name: "Cartão de crédito",
    rowLayout: "columns",
    density: "default",
    visibleColumns: ["occurredOn", "description", "category", "amount"],
    pinnedColumns: [],
    inheritOnNewRow: [],
    defaultSort: { key: "occurredOn", dir: "asc" },
    groupBy: null,
    showFooterTotal: true,
    showGroupSubtotal: false,
    allowBulkEdit: true,
    keepGhostRow: true,
    ...overrides,
  };
}

function renderTab(overrides: Partial<ColumnsLayoutTabProps> = {}) {
  const onChange = vi.fn();
  const view = render(<ColumnsLayoutTab draft={buildDraft()} onChange={onChange} {...overrides} />);
  return { ...view, onChange };
}

/** A caixa da pré-visualização — a única com este nome acessível na aba. */
function preview() {
  return screen.getByRole("group", { name: t.preview.title });
}

describe("ColumnsLayoutTab", () => {
  describe("pré-visualização ao vivo (APR-01)", () => {
    it("desenha duas linhas de exemplo", () => {
      renderTab();

      expect(within(preview()).getByText("Padaria Real")).toBeInTheDocument();
      expect(within(preview()).getByText("Uber")).toBeInTheDocument();
    });

    it("mostra só as colunas escolhidas — e some com a que saiu", () => {
      const { rerender, onChange } = renderTab();

      expect(within(preview()).getAllByText("Alimentação").length).toBeGreaterThan(0);

      rerender(
        <ColumnsLayoutTab
          draft={buildDraft({ visibleColumns: ["occurredOn", "description", "amount"] })}
          onChange={onChange}
        />,
      );

      expect(within(preview()).queryByText("Alimentação")).not.toBeInTheDocument();
      expect(within(preview()).getByText("Padaria Real")).toBeInTheDocument();
    });

    it("respeita a ORDEM das colunas (D3), não a ordem canônica", () => {
      const { rerender, onChange } = renderTab();

      // Ordem original: data · descrição · categoria · valor.
      expect(preview().textContent).toMatch(/Padaria Real.*Alimentação/s);

      rerender(
        <ColumnsLayoutTab
          draft={buildDraft({
            visibleColumns: ["occurredOn", "category", "description", "amount"],
          })}
          onChange={onChange}
        />,
      );

      // Trocar a ordem no rascunho vira ordem na tela, sem salvar nada.
      expect(preview().textContent).toMatch(/Alimentação.*Padaria Real/s);
    });

    it("aplica a densidade escolhida às linhas, no mesmo render", () => {
      const { rerender, onChange } = renderTab();

      const rowOf = () => within(preview()).getByText("Padaria Real").parentElement!;
      expect(rowOf().style.getPropertyValue("--row-h")).toBe(DENSITY_METRICS.default.rowHeight);

      rerender(<ColumnsLayoutTab draft={buildDraft({ density: "compact" })} onChange={onChange} />);

      expect(rowOf().style.getPropertyValue("--row-h")).toBe(DENSITY_METRICS.compact.rowHeight);
      expect(rowOf().style.getPropertyValue("--row-fs")).toBe(DENSITY_METRICS.compact.fontSize);
    });

    it("no layout B o atributo vira pílula; no A, célula da grade", () => {
      const { rerender, onChange } = renderTab();

      expect(within(preview()).getByText("Alimentação").closest(".MuiChip-root")).toBeNull();

      rerender(<ColumnsLayoutTab draft={buildDraft({ rowLayout: "pills" })} onChange={onChange} />);

      expect(within(preview()).getByText("Alimentação").closest(".MuiChip-root")).not.toBeNull();
    });
  });

  describe("organização da linha e densidade", () => {
    it("os dois layouts formam um radiogroup, com o atual marcado", () => {
      renderTab({ draft: buildDraft({ rowLayout: "pills" }) });

      const group = screen.getByRole("radiogroup", { name: t.rowLayout.title });
      expect(within(group).getByRole("radio", { name: t.rowLayout.pillsLabel })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(within(group).getByRole("radio", { name: t.rowLayout.columnsLabel })).toHaveAttribute(
        "aria-checked",
        "false",
      );
    });

    it("escolher pílulas pede a troca ao dono do rascunho", async () => {
      const { onChange } = renderTab();

      await userEvent.click(screen.getByRole("radio", { name: t.rowLayout.pillsLabel }));

      expect(onChange).toHaveBeenCalledWith({ rowLayout: "pills" });
    });

    it("cada card de densidade traz a medida real do frame", () => {
      renderTab();

      expect(
        screen.getByText(
          t.density.meta(DENSITY_METRICS.compact.rowHeight, DENSITY_METRICS.compact.fontSize),
        ),
      ).toBeInTheDocument();
    });

    it("escolher Compacta pede a troca — sem salvar", async () => {
      const { onChange } = renderTab();

      await userEvent.click(screen.getByRole("radio", { name: t.density.compact }));

      expect(onChange).toHaveBeenCalledWith({ density: "compact" });
    });
  });

  describe("chips de coluna (APR-04)", () => {
    it("o × remove a coluna do rascunho", async () => {
      const { onChange } = renderTab();

      await userEvent.click(screen.getByRole("button", { name: t.columns.remove("Categoria") }));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ visibleColumns: ["occurredOn", "description", "amount"] }),
      );
    });

    it("o + adiciona ao FIM da ordem", async () => {
      const { onChange } = renderTab();

      await userEvent.click(screen.getByRole("button", { name: t.columns.add("Instituição") }));

      expect(onChange).toHaveBeenCalledWith({
        visibleColumns: ["occurredOn", "description", "category", "amount", "institution"],
      });
    });

    it("clicar no CORPO do chip não faz nada", async () => {
      const { onChange } = renderTab();
      const visibleGroup = screen.getByRole("group", { name: t.columns.visibleTitle });

      await userEvent.click(within(visibleGroup).getByText("Categoria"));

      expect(onChange).not.toHaveBeenCalled();
    });

    it("a ALÇA reordena — e só ela", async () => {
      const { onChange } = renderTab();

      // Sensor de teclado do @dnd-kit: espaço pega, seta move, espaço solta. Em
      // jsdom todo retângulo mede zero, então a POSIÇÃO final não é comparável à
      // do navegador — o que este teste prova é a ligação alça → onReorder →
      // rascunho, com o conjunto de colunas preservado. A posição exata é
      // território do e2e.
      screen.getByLabelText(t.columns.drag("Categoria")).focus();
      await userEvent.keyboard("[Space]");
      await userEvent.keyboard("[ArrowRight]");
      await userEvent.keyboard("[Space]");

      expect(onChange).toHaveBeenCalledTimes(1);
      const [patch] = onChange.mock.calls[0];
      expect(patch.visibleColumns).toHaveLength(4);
      expect([...patch.visibleColumns].sort()).toEqual(
        ["amount", "category", "description", "occurredOn"].sort(),
      );
    });

    it("coluna obrigatória não tem × nem alça", () => {
      renderTab();

      expect(
        screen.queryByRole("button", { name: t.columns.remove("Data") }),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText(t.columns.drag("Data"))).not.toBeInTheDocument();
      // A destravada tem os dois.
      expect(screen.getByLabelText(t.columns.drag("Categoria"))).toBeInTheDocument();
    });

    it("remover uma coluna desfixa essa coluna junto", async () => {
      const { onChange } = renderTab({
        draft: buildDraft({ pinnedColumns: ["occurredOn", "category"] }),
      });

      await userEvent.click(screen.getByRole("button", { name: t.columns.remove("Categoria") }));

      expect(onChange).toHaveBeenCalledWith({
        visibleColumns: ["occurredOn", "description", "amount"],
        pinnedColumns: ["occurredOn"],
      });
    });
  });

  describe("D3 — a divergência declarada", () => {
    it("a nota sobre a ordem fica visível na aba", () => {
      renderTab();

      expect(screen.getByText(t.columns.orderPendingNote)).toBeInTheDocument();
    });
  });

  describe("tipo padrão", () => {
    it("não oferece × nem a lista Disponíveis (o serviço recusa mudar o conjunto)", () => {
      renderTab({ draft: buildDraft(), isDefault: true });

      expect(
        screen.queryByRole("button", { name: t.columns.remove("Categoria") }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(t.columns.availableTitle)).not.toBeInTheDocument();
    });

    /**
     * O selo "Padrão" saiu daqui para a lista mestre, mas ele era o que explicava
     * de carona por que os chips não respondem. Sem esta frase o usuário fica com
     * uma lista de colunas inerte e nenhuma pista.
     */
    it("diz POR QUE as colunas estão travadas — a razão não foi embora com o selo", () => {
      renderTab({ draft: buildDraft(), isDefault: true });

      expect(screen.getByText(new RegExp(t.columns.defaultLocked))).toBeInTheDocument();
      // "Padrão" ainda aparece como nome de densidade; o que não pode sobrar é o
      // selo do tipo padrão fora de um card de escolha.
      const badge = screen
        .getAllByText(legacy.defaultBadge)
        .find((element) => element.closest('[role="radio"]') === null);
      expect(badge).toBeUndefined();
    });

    it("layout e densidade continuam editáveis no tipo padrão", async () => {
      const { onChange } = renderTab({ isDefault: true });

      await userEvent.click(screen.getByRole("radio", { name: t.density.comfortable }));

      expect(onChange).toHaveBeenCalledWith({ density: "comfortable" });
    });
  });

  describe("nome do tipo", () => {
    it("renomear virou campo desta aba (era diálogo)", async () => {
      const { onChange } = renderTab();

      await userEvent.type(screen.getByLabelText(legacy.nameLabel), "!");

      expect(onChange).toHaveBeenCalledWith({ name: "Cartão de crédito!" });
    });
  });
});
