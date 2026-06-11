import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DialogShell } from "./DialogShell";

const noop = () => {};

function Wrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function renderShell(props: Partial<Parameters<typeof DialogShell>[0]> = {}) {
  return render(
    <DialogShell
      open={true}
      onClose={noop}
      title="Título teste"
      {...props}
    />,
    { wrapper: Wrapper },
  );
}

describe("DialogShell", () => {
  describe("loading=false (padrão)", () => {
    it("renderiza o título", () => {
      renderShell();
      expect(screen.getByText("Título teste")).toBeInTheDocument();
    });

    it("renderiza description como string em Typography", () => {
      renderShell({ description: "Texto de descrição" });
      expect(screen.getByText("Texto de descrição")).toBeInTheDocument();
    });

    it("chama onClose ao clicar no X", async () => {
      const onClose = vi.fn();
      renderShell({ onClose });
      await userEvent.click(screen.getByLabelText("Fechar"));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("renderiza botoes de actions habilitados", () => {
      renderShell({
        actions: (
          <>
            <button>Cancelar</button>
            <button>Confirmar</button>
          </>
        ),
      });
      expect(screen.getByText("Cancelar")).not.toBeDisabled();
      expect(screen.getByText("Confirmar")).not.toBeDisabled();
    });

    it("renderiza children quando fornecidos", () => {
      renderShell({ children: <p>Conteúdo do dialog</p> });
      expect(screen.getByText("Conteúdo do dialog")).toBeInTheDocument();
    });

    it("não renderiza DialogContent quando children é null", () => {
      renderShell({ children: undefined });
      expect(screen.queryByText("Conteúdo do dialog")).not.toBeInTheDocument();
    });
  });

  describe("loading=true", () => {
    it("desabilita o botão X", () => {
      renderShell({ loading: true });
      expect(screen.getByLabelText("Fechar")).toBeDisabled();
    });

    it("X está desabilitado (pointer-events: none impede clique)", () => {
      const onClose = vi.fn();
      renderShell({ loading: true, onClose });
      const closeBtn = screen.getByLabelText("Fechar");
      expect(closeBtn).toBeDisabled();
      expect(getComputedStyle(closeBtn).pointerEvents).toBe("none");
    });

    it("injeta disabled em botoes de actions simples", () => {
      renderShell({
        loading: true,
        actions: (
          <>
            <button>Cancelar</button>
            <button>Confirmar</button>
          </>
        ),
      });
      expect(screen.getByText("Cancelar")).toBeDisabled();
      expect(screen.getByText("Confirmar")).toBeDisabled();
    });

    it("injeta disabled em botoes dentro de Fragment", () => {
      renderShell({
        loading: true,
        actions: (
          <>
            <button>A</button>
            <button>B</button>
            <button>C</button>
          </>
        ),
      });
      expect(screen.getByText("A")).toBeDisabled();
      expect(screen.getByText("B")).toBeDisabled();
      expect(screen.getByText("C")).toBeDisabled();
    });

    it("não injeta disabled em botoes quando loading=false", () => {
      renderShell({
        loading: false,
        actions: <button>Ação</button>,
      });
      expect(screen.getByText("Ação")).not.toBeDisabled();
    });
  });

  describe("aria", () => {
    it("dialog tem aria-labelledby apontando para o título", () => {
      renderShell();
      const dialog = screen.getByRole("dialog");
      const labelledBy = dialog.getAttribute("aria-labelledby");
      expect(labelledBy).not.toBeNull();
      const titleEl = document.getElementById(labelledBy!);
      expect(titleEl).toHaveTextContent("Título teste");
    });
  });
});
