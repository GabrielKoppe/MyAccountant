import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SettingsSaveBar } from "./SettingsSaveBar";

const noop = () => {};

function renderBar(props: Partial<Parameters<typeof SettingsSaveBar>[0]> = {}) {
  return render(<SettingsSaveBar dirtyCount={0} onSave={noop} onDiscard={noop} {...props} />);
}

const saveButton = () => screen.getByRole("button", { name: "Salvar" });
const discardButton = () => screen.getByRole("button", { name: "Descartar" });

describe("SettingsSaveBar", () => {
  describe("dirtyCount === 0", () => {
    it("mostra 'Nenhuma alteração'", () => {
      renderBar({ dirtyCount: 0 });
      expect(screen.getByText("Nenhuma alteração")).toBeInTheDocument();
    });

    it("desabilita Descartar e Salvar", () => {
      renderBar({ dirtyCount: 0 });
      expect(discardButton()).toBeDisabled();
      expect(saveButton()).toBeDisabled();
    });
  });

  describe("dirtyCount > 0", () => {
    it("mostra a contagem de alterações não salvas", () => {
      renderBar({ dirtyCount: 3 });
      expect(screen.getByText("3 alterações não salvas")).toBeInTheDocument();
    });

    it("usa o singular quando há exatamente 1 alteração", () => {
      renderBar({ dirtyCount: 1 });
      expect(screen.getByText("1 alteração não salva")).toBeInTheDocument();
    });

    it("habilita Descartar e Salvar", () => {
      renderBar({ dirtyCount: 3 });
      expect(discardButton()).toBeEnabled();
      expect(saveButton()).toBeEnabled();
    });

    it("chama onSave ao clicar em Salvar", async () => {
      const onSave = vi.fn();
      renderBar({ dirtyCount: 3, onSave });
      await userEvent.click(saveButton());
      expect(onSave).toHaveBeenCalledOnce();
    });

    it("chama onDiscard ao clicar em Descartar", async () => {
      const onDiscard = vi.fn();
      renderBar({ dirtyCount: 3, onDiscard });
      await userEvent.click(discardButton());
      expect(onDiscard).toHaveBeenCalledOnce();
    });
  });

  describe("saving", () => {
    it("desabilita os dois botões mesmo com alterações pendentes", () => {
      renderBar({ dirtyCount: 3, saving: true });
      expect(discardButton()).toBeDisabled();
      expect(saveButton()).toBeDisabled();
    });

    it("mostra indicador de progresso na primária", () => {
      renderBar({ dirtyCount: 3, saving: true });
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("não mostra progresso quando saving é falso", () => {
      renderBar({ dirtyCount: 3 });
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });

  describe("saveLabel", () => {
    it("usa 'Salvar' por padrão", () => {
      renderBar({ dirtyCount: 3 });
      expect(saveButton()).toBeInTheDocument();
    });

    it("usa o rótulo customizado quando fornecido", () => {
      renderBar({ dirtyCount: 3, saveLabel: "Publicar layout" });
      expect(screen.getByRole("button", { name: "Publicar layout" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    });
  });

  describe("acessibilidade", () => {
    it("anuncia a mudança de estado via role=status + aria-live=polite", () => {
      renderBar({ dirtyCount: 3 });
      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveTextContent("Há alterações não salvas");
    });

    it("anuncia o estado limpo", () => {
      renderBar({ dirtyCount: 0 });
      expect(screen.getByRole("status")).toHaveTextContent("Nenhuma alteração");
    });

    // O contador muda a cada tecla: se estivesse dentro do texto anunciado, o
    // leitor de tela enfileiraria "1 alteração…", "2 alterações…", "3…".
    it("mantém o texto anunciado estável enquanto a contagem sobe", () => {
      const { rerender } = renderBar({ dirtyCount: 1 });

      expect(screen.getByRole("status")).toHaveTextContent("Há alterações não salvas");
      expect(screen.getByText("1 alteração não salva")).toHaveAttribute("aria-hidden", "true");

      rerender(<SettingsSaveBar dirtyCount={2} onSave={noop} onDiscard={noop} />);

      expect(screen.getByRole("status")).toHaveTextContent("Há alterações não salvas");
      expect(screen.getByText("2 alterações não salvas")).toHaveAttribute("aria-hidden", "true");
    });
  });
});
