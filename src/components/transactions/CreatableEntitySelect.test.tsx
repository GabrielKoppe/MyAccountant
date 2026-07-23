import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreatableEntitySelect } from "./CreatableEntitySelect";

const options = [
  { id: "cat-1", name: "Alimentação" },
  { id: "cat-2", name: "Transporte" },
];

function renderSelect(
  props: Partial<
    Extract<Parameters<typeof CreatableEntitySelect>[0], { multiple?: false | undefined }>
  > = {},
) {
  const onChange = vi.fn();
  const onCreate = vi.fn().mockResolvedValue("new-id");
  render(
    <CreatableEntitySelect
      value={null}
      onChange={onChange}
      options={options}
      onCreate={onCreate}
      canCreate
      ariaLabel="Categoria"
      {...props}
    />,
  );
  return { onChange, onCreate };
}

function renderMultiSelect(
  props: Partial<Extract<Parameters<typeof CreatableEntitySelect>[0], { multiple: true }>> = {},
) {
  const onChange = vi.fn();
  const onCreate = vi.fn().mockResolvedValue("new-id");
  render(
    <CreatableEntitySelect
      multiple
      value={[]}
      onChange={onChange}
      options={options}
      onCreate={onCreate}
      canCreate
      ariaLabel="Categorias"
      {...props}
    />,
  );
  return { onChange, onCreate };
}

describe("CreatableEntitySelect", () => {
  it("renderiza as opções existentes ao abrir o dropdown", async () => {
    renderSelect();
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
  });

  it('mostra a opção "＋ Criar" só quando o texto não bate com nenhuma opção existente', async () => {
    renderSelect();
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.type(input, "Lazer");
    expect(screen.getByText('Criar "Lazer"')).toBeInTheDocument();
  });

  it("não mostra a opção de criar quando o texto bate exatamente com uma opção existente", async () => {
    renderSelect();
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.type(input, "Alimentação");
    expect(screen.queryByText(/^Criar "/)).not.toBeInTheDocument();
  });

  it("selecionar a opção de criar chama onCreate com o nome digitado e auto-seleciona o novo id", async () => {
    const { onCreate, onChange } = renderSelect();
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.type(input, "Lazer");
    await userEvent.click(screen.getByText('Criar "Lazer"'));

    expect(onCreate).toHaveBeenCalledWith("Lazer");
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("new-id"));
  });

  it("digitar um nome existente e confirmar seleciona a opção existente sem chamar onCreate (dedupe)", async () => {
    const { onCreate, onChange } = renderSelect();
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.type(input, "Alimentação{Enter}");

    expect(onChange).toHaveBeenCalledWith("cat-1");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("nunca mostra a opção de criar quando canCreate=false", async () => {
    renderSelect({ canCreate: false });
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.type(input, "Lazer");
    expect(screen.queryByText(/^Criar "/)).not.toBeInTheDocument();
  });

  describe("modo multi", () => {
    it("renderiza os ids selecionados como chips deletáveis", () => {
      renderMultiSelect({ value: ["cat-1", "cat-2"] });
      expect(screen.getByText("Alimentação")).toBeInTheDocument();
      expect(screen.getByText("Transporte")).toBeInTheDocument();
    });

    it("selecionar várias opções acumula os ids no array (sem substituir)", async () => {
      const { onChange } = renderMultiSelect({ value: ["cat-1"] });
      const input = screen.getByRole("combobox");
      await userEvent.click(input);
      await userEvent.click(screen.getByText("Transporte"));

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(["cat-1", "cat-2"]));
    });

    it("remover um chip chama onChange sem o id removido", async () => {
      const { onChange } = renderMultiSelect({ value: ["cat-1", "cat-2"] });
      // O botão de delete de cada chip tem role de botão (CancelIcon clicável).
      const deleteButtons = screen.getAllByTestId("CancelIcon");
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(["cat-2"]));
    });

    it("criar inline no modo multi chama onCreate e adiciona o novo id ao array", async () => {
      const { onChange, onCreate } = renderMultiSelect({ value: ["cat-1"] });
      const input = screen.getByRole("combobox");
      await userEvent.click(input);
      await userEvent.type(input, "Lazer");
      await userEvent.click(screen.getByText('Criar "Lazer"'));

      expect(onCreate).toHaveBeenCalledWith("Lazer");
      await waitFor(() => expect(onChange).toHaveBeenCalledWith(["cat-1", "new-id"]));
    });

    it("digitar um nome existente resolve para o id existente sem chamar onCreate (dedupe)", async () => {
      const { onChange, onCreate } = renderMultiSelect({ value: ["cat-2"] });
      const input = screen.getByRole("combobox");
      await userEvent.click(input);
      await userEvent.type(input, "Alimentação{Enter}");

      await waitFor(() => expect(onChange).toHaveBeenCalledWith(["cat-2", "cat-1"]));
      expect(onCreate).not.toHaveBeenCalled();
    });
  });
});
