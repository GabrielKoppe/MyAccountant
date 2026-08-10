import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SETTINGS_DIALOG_WIDTH, SettingsDialog, type SettingsDialogSize } from "./SettingsDialog";

const noop = () => {};

function renderDialog(props: Partial<React.ComponentProps<typeof SettingsDialog>> = {}) {
  return render(
    <SettingsDialog open onClose={noop} title="Título do modal" size="form" {...props} />,
  );
}

/** O Paper vive num portal fora do container do RTL — daí o querySelector global. */
function getPaper(): HTMLElement {
  const paper = document.querySelector(".MuiDialog-paper");
  expect(paper).not.toBeNull();
  return paper as HTMLElement;
}

describe("SettingsDialog", () => {
  describe("larguras (Spec 67 §2.7 / D8)", () => {
    it("mantém as três larguras do catálogo em px", () => {
      // Congelado de propósito: a spec fixa 420/560/720 e proíbe largura sob medida.
      expect(SETTINGS_DIALOG_WIDTH).toEqual({ confirm: 420, form: 560, editor: 720 });
    });

    it.each<[SettingsDialogSize, number]>([
      ["confirm", 420],
      ["form", 560],
      ["editor", 720],
    ])("size=%s aplica max-width de %ipx no Paper", (size, expectedWidth) => {
      renderDialog({ size });
      expect(getComputedStyle(getPaper()).maxWidth).toBe(`${expectedWidth}px`);
    });

    it("não usa os breakpoints do MUI como largura final (444/600/900)", () => {
      renderDialog({ size: "confirm" });
      // Se o maxWidth de breakpoint vencesse, o Paper ficaria com 444px.
      expect(getComputedStyle(getPaper()).maxWidth).not.toBe("444px");
    });
  });

  describe("repasse para o DialogShell", () => {
    it("renderiza título, corpo e ações", () => {
      renderDialog({
        title: "Excluir categoria",
        children: <p>Esta categoria é usada em 3 modelos.</p>,
        actions: (
          <>
            <button>Cancelar</button>
            <button>Excluir</button>
          </>
        ),
      });

      expect(screen.getByText("Excluir categoria")).toBeInTheDocument();
      expect(screen.getByText("Esta categoria é usada em 3 modelos.")).toBeInTheDocument();
      expect(screen.getByText("Cancelar")).toBeInTheDocument();
      expect(screen.getByText("Excluir")).toBeInTheDocument();
    });

    it("não renderiza o dialog quando open=false", () => {
      renderDialog({ open: false });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("fechamento", () => {
    it("Esc chama onClose", async () => {
      const onClose = vi.fn();
      renderDialog({ onClose });
      await userEvent.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("clique no X chama onClose", async () => {
      const onClose = vi.fn();
      renderDialog({ onClose });
      await userEvent.click(screen.getByLabelText("Fechar"));
      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});
