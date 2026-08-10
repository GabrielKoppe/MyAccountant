import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import { StatusCell } from "./StatusCell";

const noop = () => {};

function renderCell(props: Partial<Parameters<typeof StatusCell>[0]> = {}) {
  return render(
    <StatusCell active={true} lastUsedAt={null} name="Alimentação" onToggle={noop} {...props} />,
  );
}

describe("StatusCell", () => {
  describe("rótulo", () => {
    it("ativo com data: mostra o mês do último uso", () => {
      renderCell({ active: true, lastUsedAt: new Date("2026-07-15T12:00:00.000Z") });
      const label = screen.getByText(/jul/i);
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent("2026");
    });

    it("ativo sem data: 'nunca usada' e concorda em gênero", () => {
      const { unmount } = renderCell({ active: true, lastUsedAt: null });
      expect(screen.getByText(m.settings.shell.status.neverUsed("f"))).toBeInTheDocument();
      unmount();

      renderCell({ active: true, lastUsedAt: null, gender: "m", name: "Cartão" });
      expect(screen.getByText(m.settings.shell.status.neverUsed("m"))).toBeInTheDocument();
    });

    it("inativo: 'desativado' vence mesmo com lastUsedAt preenchido", () => {
      renderCell({ active: false, lastUsedAt: new Date("2026-07-15T12:00:00.000Z") });
      expect(screen.getByText(m.settings.shell.status.deactivated)).toBeInTheDocument();
      expect(screen.queryByText(/jul/i)).not.toBeInTheDocument();
    });
  });

  describe("toggle", () => {
    it("reflete `active` no estado do switch", () => {
      const { unmount } = renderCell({ active: true });
      expect(screen.getByRole("checkbox")).toBeChecked();
      unmount();

      renderCell({ active: false });
      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    it("de ativo para inativo chama onToggle(false)", async () => {
      const onToggle = vi.fn();
      renderCell({ active: true, onToggle });
      await userEvent.click(screen.getByRole("checkbox"));
      expect(onToggle).toHaveBeenCalledOnce();
      expect(onToggle).toHaveBeenCalledWith(false);
    });

    it("de inativo para ativo chama onToggle(true)", async () => {
      const onToggle = vi.fn();
      renderCell({ active: false, onToggle });
      await userEvent.click(screen.getByRole("checkbox"));
      expect(onToggle).toHaveBeenCalledOnce();
      expect(onToggle).toHaveBeenCalledWith(true);
    });

    // Sem clique: o Switch desabilitado herda `pointer-events: none` e o userEvent
    // lançaria em vez de simplesmente não disparar o handler.
    it("disabled desabilita o input", () => {
      renderCell({ active: true, disabled: true });
      expect(screen.getByRole("checkbox")).toBeDisabled();
    });
  });

  describe("acessibilidade", () => {
    it("o aria-label do switch nomeia o objeto (há dezenas de 'Ativo' na mesma lista)", () => {
      renderCell({ name: "Mercado Livre" });
      const expected = `${m.settings.shell.status.toggleLabel}: Mercado Livre`;
      expect(screen.getByLabelText(expected)).toBe(screen.getByRole("checkbox"));
    });
  });
});
