import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import { ColumnChipList, type ColumnChipListProps } from "./ColumnChipList";

const t = m.settings.presentation.tableTypes.columns;
const chip = m.settings.presentation.chip;

const ITEMS = [
  { key: "occurredOn", label: "Data", locked: true },
  { key: "description", label: "Descrição", locked: true },
  { key: "category", label: "Categoria" },
  { key: "amount", label: "Valor", locked: true },
];

function renderList(overrides: Partial<ColumnChipListProps> = {}) {
  const onReorder = vi.fn();
  const onRemove = vi.fn();
  const onAdd = vi.fn();

  render(
    <ColumnChipList
      items={ITEMS}
      onReorder={onReorder}
      onRemove={onRemove}
      onAdd={onAdd}
      emptyLabel={t.empty}
      ariaLabel="Colunas visíveis"
      {...overrides}
    />,
  );

  return { onReorder, onRemove, onAdd };
}

describe("ColumnChipList", () => {
  describe("APR-04 — o corpo do chip é inerte", () => {
    it("clicar no rótulo não remove, não reordena e não seleciona", async () => {
      const { onReorder, onRemove, onAdd } = renderList();

      // "Categoria" é o único chip destravado — se algum clique no corpo tivesse
      // efeito, seria neste.
      await userEvent.click(screen.getByText("Categoria"));

      expect(onRemove).not.toHaveBeenCalled();
      expect(onReorder).not.toHaveBeenCalled();
      expect(onAdd).not.toHaveBeenCalled();
    });

    it("o rótulo não é um controle: nenhum botão tem o nome da coluna sozinho", () => {
      renderList();

      // Um `<button>` inerte ainda receberia foco e ainda seria anunciado como
      // clicável — é exatamente o que a regra proíbe.
      expect(screen.queryByRole("button", { name: "Categoria" })).not.toBeInTheDocument();
    });

    it("clicar no × dispara só onRemove, com a chave da coluna", async () => {
      const { onReorder, onRemove, onAdd } = renderList();

      await userEvent.click(screen.getByRole("button", { name: t.remove("Categoria") }));

      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(onRemove).toHaveBeenCalledWith("category");
      expect(onReorder).not.toHaveBeenCalled();
      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  describe("chip travado", () => {
    it("não renderiza × nem alça, e explica o motivo no title", () => {
      renderList();

      expect(screen.queryByRole("button", { name: t.remove("Data") })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(t.drag("Data"))).not.toBeInTheDocument();
      // Data, Descrição e Valor — os três obrigatórios do frame.
      expect(screen.getAllByTitle(t.locked)).toHaveLength(3);
    });

    it("a coluna destravada mantém alça e ×", () => {
      renderList();

      expect(screen.getByLabelText(t.drag("Categoria"))).toBeInTheDocument();
      expect(screen.getByRole("button", { name: t.remove("Categoria") })).toBeInTheDocument();
    });
  });

  describe('variant="available"', () => {
    it("clicar no chip dispara onAdd e nunca onRemove/onReorder", async () => {
      const { onReorder, onRemove, onAdd } = renderList({
        variant: "available",
        items: [{ key: "institution", label: "Instituição" }],
        emptyLabel: t.allInUse,
      });

      await userEvent.click(screen.getByRole("button", { name: t.add("Instituição") }));

      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledWith("institution");
      expect(onRemove).not.toHaveBeenCalled();
      expect(onReorder).not.toHaveBeenCalled();
    });

    it("não renderiza alça de arraste (não há ordem a defender)", () => {
      renderList({
        variant: "available",
        items: [{ key: "institution", label: "Instituição" }],
        emptyLabel: t.allInUse,
      });

      expect(screen.queryByLabelText(t.drag("Instituição"))).not.toBeInTheDocument();
    });
  });

  describe('variant="toggle"', () => {
    it("chip ligado desliga por onRemove; chip desligado liga por onAdd", async () => {
      const { onAdd, onRemove } = renderList({
        variant: "toggle",
        items: [
          { key: "occurredOn", label: "Data", selected: true },
          { key: "category", label: "Categoria" },
        ],
        emptyLabel: t.empty,
      });

      // Rótulos neutros: no modo toggle o chip liga/desliga um atributo, e
      // "Remover coluna Data da linha anterior" descreveria outra ação.
      const on = screen.getByRole("button", { name: chip.toggleOff("Data") });
      const off = screen.getByRole("button", { name: chip.toggleOn("Categoria") });

      expect(on).toHaveAttribute("aria-pressed", "true");
      expect(off).toHaveAttribute("aria-pressed", "false");

      await userEvent.click(on);
      await userEvent.click(off);

      expect(onRemove).toHaveBeenCalledWith("occurredOn");
      expect(onAdd).toHaveBeenCalledWith("category");
    });
  });

  /**
   * Lista sem efeito (papel sem escrita, ou bloco que o layout escolhido não
   * comporta — "Colunas fixadas" em pílulas). O chip continua sendo o readout do
   * que está configurado: ele não some, não perde o rótulo e não perde o
   * `aria-pressed` — só para de aceitar a interação.
   */
  describe("disabled", () => {
    it("no toggle: o chip fica desabilitado mantendo rótulo e estado", async () => {
      const { onAdd, onRemove } = renderList({
        variant: "toggle",
        disabled: true,
        items: [
          { key: "occurredOn", label: "Data", selected: true },
          { key: "category", label: "Categoria" },
        ],
        emptyLabel: t.empty,
      });

      const on = screen.getByRole("button", { name: chip.toggleOff("Data") });
      expect(on).toBeDisabled();
      expect(on).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("Categoria")).toBeInTheDocument();

      await userEvent.click(on);
      await userEvent.click(screen.getByRole("button", { name: chip.toggleOn("Categoria") }));

      expect(onAdd).not.toHaveBeenCalled();
      expect(onRemove).not.toHaveBeenCalled();
    });

    it("no visible: sem alça de arraste e com o × desabilitado", () => {
      renderList({ disabled: true });

      expect(screen.queryByLabelText(t.drag("Categoria"))).not.toBeInTheDocument();
      // Sem `userEvent.click` aqui de propósito: o `IconButton` desabilitado do MUI
      // carrega `pointer-events: none`, e o user-event ERRA em vez de clicar — a
      // prova de que o clique não chega é o próprio `toBeDisabled`.
      expect(screen.getByRole("button", { name: t.remove("Categoria") })).toBeDisabled();
    });
  });

  describe("estado vazio", () => {
    it("mostra o emptyLabel no lugar dos chips", () => {
      renderList({ items: [], emptyLabel: t.empty });

      expect(screen.getByText(t.empty)).toBeInTheDocument();
      expect(screen.queryByLabelText(t.drag("Categoria"))).not.toBeInTheDocument();
    });
  });
});
