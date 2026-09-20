import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChoiceCard, type ChoiceCardProps } from "./ChoiceCard";

function renderCard(overrides: Partial<ChoiceCardProps> = {}) {
  const onSelect = vi.fn();

  render(
    <div role="radiogroup" aria-label="Organização da linha">
      <ChoiceCard
        selected={false}
        onSelect={onSelect}
        label="B · Pílulas"
        helper="Atributos como chips."
        {...overrides}
      />
    </div>,
  );

  return { onSelect };
}

describe("ChoiceCard", () => {
  describe("semântica de radio", () => {
    it("expõe UM único radio — o card, não o input do MUI", () => {
      renderCard();

      // O `Radio` interno é indicador visual (aria-hidden); se ele vazasse para a
      // árvore de acessibilidade, haveria dois radios no mesmo card.
      expect(screen.getAllByRole("radio")).toHaveLength(1);
      expect(screen.getByRole("radio", { name: "B · Pílulas" })).toBeInTheDocument();
    });

    it("reflete a seleção em aria-checked", () => {
      renderCard({ selected: true });

      expect(screen.getByRole("radio", { name: "B · Pílulas" })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });

    it("descreve o card pelo texto de apoio", () => {
      renderCard();

      const card = screen.getByRole("radio", { name: "B · Pílulas" });
      const describedBy = card.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy as string)).toHaveTextContent(
        "Atributos como chips.",
      );
    });
  });

  describe("seleção", () => {
    it("clicar em qualquer ponto do card seleciona — o Radio não é o único alvo", async () => {
      const { onSelect } = renderCard({ meta: "36px · 0.82rem" });

      await userEvent.click(screen.getByText("36px · 0.82rem"));

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("Espaço e Enter selecionam pelo teclado", async () => {
      const { onSelect } = renderCard();

      const card = screen.getByRole("radio", { name: "B · Pílulas" });
      card.focus();
      await userEvent.keyboard(" ");
      await userEvent.keyboard("{Enter}");

      expect(onSelect).toHaveBeenCalledTimes(2);
    });

    it("o card habilitado está na ordem de tabulação", () => {
      renderCard();

      expect(screen.getByRole("radio", { name: "B · Pílulas" })).toHaveAttribute("tabindex", "0");
    });
  });

  describe("desabilitado", () => {
    it("não seleciona por clique nem por teclado, e sai da ordem de tabulação", async () => {
      const { onSelect } = renderCard({ disabled: true });

      const card = screen.getByRole("radio", { name: "B · Pílulas" });
      await userEvent.click(card);
      card.focus();
      await userEvent.keyboard("{Enter}");

      expect(onSelect).not.toHaveBeenCalled();
      expect(card).toHaveAttribute("aria-disabled", "true");
      expect(card).toHaveAttribute("tabindex", "-1");
    });

    it("mostra o motivo VISÍVEL, não escondido em tooltip (matriz 07b)", () => {
      renderCard({ disabled: true, disabledReason: "precisa de 8 colunas" });

      expect(screen.getByText("precisa de 8 colunas")).toBeInTheDocument();
    });
  });

  it("renderiza a miniatura passada como children", () => {
    renderCard({ children: <span>miniatura</span> });

    expect(screen.getByText("miniatura")).toBeInTheDocument();
  });
});
