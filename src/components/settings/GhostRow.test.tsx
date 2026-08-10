import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import { GhostRow, type GhostRowHandle } from "./GhostRow";

const noop = () => {};

type Props = Parameters<typeof GhostRow>[0];

function renderGhostRow(props: Partial<Props> = {}) {
  const handlers = {
    onStartEditing: vi.fn(),
    onCancel: vi.fn(),
    onCommit: vi.fn(),
  };
  render(<GhostRow editing={false} {...handlers} {...props} />);
  return handlers;
}

describe("GhostRow", () => {
  describe("estado ocioso", () => {
    it("renderiza o rótulo padrão de adicionar", () => {
      renderGhostRow();
      expect(screen.getByRole("button", { name: m.settings.shell.addRow })).toBeInTheDocument();
    });

    it("aceita um rótulo customizado", () => {
      renderGhostRow({ label: "Nova categoria…" });
      expect(screen.getByRole("button", { name: "Nova categoria…" })).toBeInTheDocument();
    });

    it("dispara onStartEditing ao clicar na linha", async () => {
      const { onStartEditing } = renderGhostRow();
      await userEvent.click(screen.getByRole("button", { name: m.settings.shell.addRow }));
      expect(onStartEditing).toHaveBeenCalledOnce();
    });

    it("não grava com Enter enquanto está ociosa (linha ainda vazia)", async () => {
      const { onCommit } = renderGhostRow();
      // act: focar o ButtonBase atualiza o estado interno de focusVisible do MUI.
      act(() => screen.getByRole("button", { name: m.settings.shell.addRow }).focus());
      await userEvent.keyboard("{Enter}");
      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  describe("estado em edição", () => {
    it("renderiza children no lugar do botão", () => {
      renderGhostRow({ editing: true, children: <input aria-label="Nome" /> });
      expect(screen.getByLabelText("Nome")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: m.settings.shell.addRow }),
      ).not.toBeInTheDocument();
    });

    it("Enter chama onCommit", async () => {
      const { onCommit } = renderGhostRow({
        editing: true,
        children: <input aria-label="Nome" />,
      });
      await userEvent.click(screen.getByLabelText("Nome"));
      await userEvent.keyboard("{Enter}");
      expect(onCommit).toHaveBeenCalledOnce();
    });

    it("Enter NÃO chama onCommit quando canCommit=false", async () => {
      const { onCommit } = renderGhostRow({
        editing: true,
        canCommit: false,
        children: <input aria-label="Nome" />,
      });
      await userEvent.click(screen.getByLabelText("Nome"));
      await userEvent.keyboard("{Enter}");
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("Escape chama onCancel", async () => {
      const { onCancel } = renderGhostRow({
        editing: true,
        children: <input aria-label="Nome" />,
      });
      await userEvent.click(screen.getByLabelText("Nome"));
      await userEvent.keyboard("{Escape}");
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("Enter dentro de textarea NÃO chama onCommit (quebra de linha legítima)", async () => {
      const { onCommit } = renderGhostRow({
        editing: true,
        children: <textarea aria-label="Observação" />,
      });
      await userEvent.click(screen.getByLabelText("Observação"));
      await userEvent.keyboard("{Enter}");
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("Enter já tratado por um filho (Select aberto) NÃO chama onCommit", async () => {
      const { onCommit } = renderGhostRow({
        editing: true,
        children: (
          // Simula um Select/Autocomplete aberto, que consome o Enter para escolher opção.
          <input
            aria-label="Categoria"
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
        ),
      });
      await userEvent.click(screen.getByLabelText("Categoria"));
      await userEvent.keyboard("{Enter}");
      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  describe("handle imperativo", () => {
    it("focus() foca o primeiro campo renderizado em children", () => {
      const ref = createRef<GhostRowHandle>();
      render(
        <GhostRow ref={ref} editing onStartEditing={noop} onCancel={noop} onCommit={noop}>
          <input aria-label="Nome" />
          <input aria-label="Sigla" />
        </GhostRow>,
      );

      ref.current?.focus();

      expect(screen.getByLabelText("Nome")).toHaveFocus();
    });

    it("focus() foca o próprio botão quando a linha está ociosa", () => {
      const ref = createRef<GhostRowHandle>();
      render(
        <GhostRow
          ref={ref}
          editing={false}
          onStartEditing={noop}
          onCancel={noop}
          onCommit={noop}
        />,
      );

      // act: focar o ButtonBase atualiza o estado interno de focusVisible do MUI.
      act(() => ref.current?.focus());

      expect(screen.getByRole("button", { name: m.settings.shell.addRow })).toHaveFocus();
    });
  });
});
