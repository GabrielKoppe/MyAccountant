import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SettingsPagination } from "./SettingsPagination";

const noop = () => {};

function renderPagination(props: Partial<Parameters<typeof SettingsPagination>[0]> = {}) {
  return render(
    <SettingsPagination
      count={132}
      page={0}
      rowsPerPage={20}
      onPageChange={noop}
      onRowsPerPageChange={noop}
      {...props}
    />,
  );
}

describe("SettingsPagination", () => {
  describe("rótulos em pt-BR", () => {
    it("renderiza o intervalo com travessão e o total", () => {
      renderPagination();
      expect(screen.getByText("1–20 de 132")).toBeInTheDocument();
    });

    it("renderiza o rótulo de itens por página", () => {
      renderPagination();
      expect(screen.getByText("Por página")).toBeInTheDocument();
    });

    it("renderiza o intervalo da página seguinte a partir de page 1", () => {
      renderPagination({ page: 1 });
      expect(screen.getByText("21–40 de 132")).toBeInTheDocument();
    });

    it("usa 'mais de N' quando o total é desconhecido (count = -1)", () => {
      renderPagination({ count: -1 });
      expect(screen.getByText("1–20 de mais de 20")).toBeInTheDocument();
    });
  });

  describe("onPageChange", () => {
    it("chama com o número da próxima página, não com o evento", async () => {
      const onPageChange = vi.fn();
      renderPagination({ onPageChange });

      await userEvent.click(screen.getByLabelText("Próxima página"));

      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it("chama com o número da página anterior", async () => {
      const onPageChange = vi.fn();
      renderPagination({ page: 2, onPageChange });

      await userEvent.click(screen.getByLabelText("Página anterior"));

      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it("desabilita a navegação nos extremos da lista", () => {
      renderPagination({ page: 0, count: 10, rowsPerPage: 20 });
      expect(screen.getByLabelText("Página anterior")).toBeDisabled();
      expect(screen.getByLabelText("Próxima página")).toBeDisabled();
    });
  });

  describe("onRowsPerPageChange", () => {
    it("chama com o número escolhido, não com o evento", async () => {
      const onRowsPerPageChange = vi.fn();
      renderPagination({ onRowsPerPageChange });

      await userEvent.click(screen.getByRole("combobox"));
      await userEvent.click(screen.getByRole("option", { name: "50" }));

      expect(onRowsPerPageChange).toHaveBeenCalledWith(50);
      // Garante que a normalização aconteceu: um evento passaria como objeto.
      expect(onRowsPerPageChange.mock.calls[0]?.[0]).toBeTypeOf("number");
    });

    it("oferece 20, 50 e 100 por padrão", async () => {
      renderPagination();

      await userEvent.click(screen.getByRole("combobox"));

      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "20",
        "50",
        "100",
      ]);
    });

    it("respeita rowsPerPageOptions customizado", async () => {
      renderPagination({ rowsPerPage: 5, rowsPerPageOptions: [5, 10] });

      await userEvent.click(screen.getByRole("combobox"));

      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "5",
        "10",
      ]);
      expect(screen.queryByRole("option", { name: "100" })).not.toBeInTheDocument();
    });
  });

  it("não se envolve em Paper — a página é quem posiciona", () => {
    const { container } = renderPagination();
    expect(container.querySelector(".MuiPaper-root")).toBeNull();
  });
});
