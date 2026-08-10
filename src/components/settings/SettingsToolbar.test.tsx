import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import { SettingsToolbar } from "./SettingsToolbar";

/**
 * A busca é controlada pela página. Sem um harness com estado, `userEvent.type`
 * reenvia sempre o mesmo `value=""` e cada tecla chega isolada — o teste passaria
 * a testar o mock, não o campo.
 */
function ControlledToolbar({
  onChange,
  placeholder,
}: {
  onChange?: (value: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  return (
    <SettingsToolbar
      search={{
        value,
        placeholder,
        onChange: (next) => {
          setValue(next);
          onChange?.(next);
        },
      }}
    />
  );
}

describe("SettingsToolbar", () => {
  describe("busca", () => {
    it("dispara onChange com o texto digitado", async () => {
      const onChange = vi.fn();
      render(<ControlledToolbar onChange={onChange} />);

      const input = screen.getByRole("textbox", { name: m.settings.shell.searchLabel });
      await userEvent.type(input, "mercado");

      expect(input).toHaveValue("mercado");
      expect(onChange).toHaveBeenLastCalledWith("mercado");
      expect(onChange).toHaveBeenCalledTimes("mercado".length);
    });

    it("usa o placeholder padrão das messages quando nenhum é passado", () => {
      render(<ControlledToolbar />);

      expect(screen.getByPlaceholderText(m.settings.shell.searchPlaceholder)).toBeInTheDocument();
    });

    it("usa o placeholder customizado quando passado", () => {
      render(<ControlledToolbar placeholder="Buscar apelido" />);

      expect(screen.getByPlaceholderText("Buscar apelido")).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText(m.settings.shell.searchPlaceholder),
      ).not.toBeInTheDocument();
    });

    it("expõe aria-label no input", () => {
      render(<ControlledToolbar />);

      expect(
        screen.getByRole("textbox", { name: m.settings.shell.searchLabel }),
      ).toBeInTheDocument();
    });

    it("não renderiza nenhum textbox quando search não é passado", () => {
      render(<SettingsToolbar filters={<button>Filtrar</button>} />);

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });

  describe("slots", () => {
    it("renderiza filters, sort e end quando passados", () => {
      render(
        <SettingsToolbar
          filters={<button>Filtrar</button>}
          sort={<button>Ordenar</button>}
          end={<span>18 de 132</span>}
        />,
      );

      expect(screen.getByRole("button", { name: "Filtrar" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ordenar" })).toBeInTheDocument();
      expect(screen.getByText("18 de 132")).toBeInTheDocument();
    });

    it("não renderiza nada dos slots quando nenhum é passado", () => {
      render(<SettingsToolbar />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });
});
