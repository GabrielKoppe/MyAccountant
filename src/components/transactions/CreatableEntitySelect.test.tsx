import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreatableEntitySelect } from "./CreatableEntitySelect";

const options = [
  { id: "cat-1", name: "Alimentação" },
  { id: "cat-2", name: "Transporte" },
];

function renderSelect(props: Partial<Parameters<typeof CreatableEntitySelect>[0]> = {}) {
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
});
