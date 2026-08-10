import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import { ROW_ACTION_ORDER, RowActionsMenu } from "./RowActionsMenu";

const t = m.settings.shell.rowMenu;

const NAME = "Mercado";
const TRIGGER_LABEL = `${t.trigger}: ${NAME}`;

/** Abre o menu e devolve o gatilho (usado nas asserções de aria/fechamento). */
async function openMenu() {
  const trigger = screen.getByLabelText(TRIGGER_LABEL);
  await userEvent.click(trigger);
  return trigger;
}

function labelsInDom() {
  return screen.getAllByRole("menuitem").map((item) => item.textContent);
}

describe("RowActionsMenu", () => {
  describe("ordem canônica (Spec 67 §2.6)", () => {
    it("expõe ROW_ACTION_ORDER como Editar · Duplicar · Ativar/desativar · Ver uso · Mesclar · Excluir", () => {
      expect(ROW_ACTION_ORDER).toEqual([
        "edit",
        "duplicate",
        "toggleActive",
        "viewUsage",
        "merge",
        "delete",
      ]);
    });

    it("renderiza na ordem canônica mesmo com as chaves de `actions` em ordem invertida", async () => {
      // Objeto declarado do fim para o começo: a ordem de renderização não pode
      // depender da ordem de inserção das chaves.
      render(
        <RowActionsMenu
          name={NAME}
          active
          actions={{
            delete: vi.fn(),
            merge: vi.fn(),
            viewUsage: vi.fn(),
            toggleActive: vi.fn(),
            duplicate: vi.fn(),
            edit: vi.fn(),
          }}
        />,
      );
      await openMenu();

      expect(labelsInDom()).toEqual([
        t.edit,
        t.duplicate,
        t.deactivate,
        t.viewUsage,
        t.merge,
        t.delete,
      ]);
    });

    it("mantém a ordem relativa quando só um subconjunto é aplicável", async () => {
      render(
        <RowActionsMenu
          name={NAME}
          actions={{ delete: vi.fn(), viewUsage: vi.fn(), edit: vi.fn() }}
        />,
      );
      await openMenu();

      expect(labelsInDom()).toEqual([t.edit, t.viewUsage, t.delete]);
    });

    it("põe uma divisória imediatamente antes de Excluir", async () => {
      render(<RowActionsMenu name={NAME} actions={{ edit: vi.fn(), delete: vi.fn() }} />);
      await openMenu();

      expect(screen.getAllByRole("separator")).toHaveLength(1);
    });

    it("não põe divisória quando Excluir é o único item", async () => {
      render(<RowActionsMenu name={NAME} actions={{ delete: vi.fn() }} />);
      await openMenu();

      expect(screen.queryByRole("separator")).toBeNull();
    });
  });

  describe("itens inaplicáveis somem (nunca desabilitados)", () => {
    it("não coloca no DOM as ações não passadas", async () => {
      render(<RowActionsMenu name={NAME} actions={{ edit: vi.fn(), delete: vi.fn() }} />);
      await openMenu();

      expect(screen.getAllByRole("menuitem")).toHaveLength(2);
      expect(screen.queryByRole("menuitem", { name: t.duplicate })).toBeNull();
      expect(screen.queryByRole("menuitem", { name: t.viewUsage })).toBeNull();
      expect(screen.queryByRole("menuitem", { name: t.merge })).toBeNull();
      expect(screen.queryByRole("menuitem", { name: t.activate })).toBeNull();
      expect(screen.queryByRole("menuitem", { name: t.deactivate })).toBeNull();
    });

    it("os itens presentes não estão desabilitados", async () => {
      render(<RowActionsMenu name={NAME} actions={{ edit: vi.fn(), delete: vi.fn() }} />);
      await openMenu();

      for (const item of screen.getAllByRole("menuitem")) {
        expect(item).not.toHaveAttribute("aria-disabled");
        expect(item).not.toHaveClass("Mui-disabled");
      }
    });

    it("trata callback `undefined` como ação ausente", async () => {
      render(<RowActionsMenu name={NAME} actions={{ edit: undefined, delete: vi.fn() }} />);
      await openMenu();

      expect(labelsInDom()).toEqual([t.delete]);
    });
  });

  describe("toggleActive", () => {
    it('mostra "Desativar" quando active=true', async () => {
      render(<RowActionsMenu name={NAME} active={true} actions={{ toggleActive: vi.fn() }} />);
      await openMenu();

      expect(screen.getByRole("menuitem", { name: t.deactivate })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: t.activate })).toBeNull();
    });

    it('mostra "Ativar" quando active=false', async () => {
      render(<RowActionsMenu name={NAME} active={false} actions={{ toggleActive: vi.fn() }} />);
      await openMenu();

      expect(screen.getByRole("menuitem", { name: t.activate })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: t.deactivate })).toBeNull();
    });
  });

  describe("seleção", () => {
    it("chama o callback do item clicado e fecha o menu", async () => {
      const onEdit = vi.fn();
      const onDelete = vi.fn();
      render(<RowActionsMenu name={NAME} actions={{ edit: onEdit, delete: onDelete }} />);
      const trigger = await openMenu();

      await userEvent.click(screen.getByRole("menuitem", { name: t.edit }));

      expect(onEdit).toHaveBeenCalledOnce();
      expect(onDelete).not.toHaveBeenCalled();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });

    it("chama o callback de Excluir", async () => {
      const onDelete = vi.fn();
      render(<RowActionsMenu name={NAME} actions={{ edit: vi.fn(), delete: onDelete }} />);
      await openMenu();

      await userEvent.click(screen.getByRole("menuitem", { name: t.delete }));

      expect(onDelete).toHaveBeenCalledOnce();
    });
  });

  describe("gatilho", () => {
    it("não renderiza nada quando `actions` está vazio", () => {
      const { container } = render(<RowActionsMenu name={NAME} actions={{}} />);

      expect(screen.queryByLabelText(TRIGGER_LABEL)).toBeNull();
      expect(container).toBeEmptyDOMElement();
    });

    it("nomeia o objeto no aria-label e declara o popup como menu", () => {
      render(<RowActionsMenu name={NAME} actions={{ edit: vi.fn() }} />);
      const trigger = screen.getByLabelText(TRIGGER_LABEL);

      expect(trigger).toHaveAttribute("aria-haspopup", "menu");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).not.toHaveAttribute("aria-controls");
    });

    it("aponta aria-controls para o menu quando aberto", async () => {
      render(<RowActionsMenu name={NAME} actions={{ edit: vi.fn() }} />);
      const trigger = await openMenu();

      expect(trigger).toHaveAttribute("aria-expanded", "true");
      const controls = trigger.getAttribute("aria-controls");
      expect(controls).not.toBeNull();
      expect(document.getElementById(controls!)).toBeInTheDocument();
    });
  });
});
