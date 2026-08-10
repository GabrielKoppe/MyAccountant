import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsEmptyState } from "./SettingsEmptyState";

const TITLE = "Nenhuma categoria ainda";
const DESCRIPTION = "Categorias agrupam transações para os relatórios e o orçamento.";

function renderEmptyState(props: Partial<Parameters<typeof SettingsEmptyState>[0]> = {}) {
  return render(<SettingsEmptyState title={TITLE} description={DESCRIPTION} {...props} />);
}

describe("SettingsEmptyState", () => {
  it("renderiza título e descrição", () => {
    renderEmptyState();
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument();
  });

  // A frase do que o objeto faz é obrigatória na regra 6 da Spec 67 — precisa
  // sair na tela mesmo quando não há nenhum botão para acompanhar.
  it("renderiza a descrição mesmo sem ação nem atalho", () => {
    renderEmptyState({ action: undefined, shortcut: undefined });
    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument();
  });

  it("renderiza o ícone quando fornecido", () => {
    renderEmptyState({ icon: <span data-testid="icone" /> });
    expect(screen.getByTestId("icone")).toBeInTheDocument();
  });

  it("renderiza só a primária quando não há atalho", () => {
    renderEmptyState({ action: <button>Criar a primeira</button> });

    expect(screen.getByRole("button", { name: "Criar a primeira" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("renderiza os dois botões quando há atalho", () => {
    renderEmptyState({
      action: <button>Criar a primeira</button>,
      shortcut: <button>Usar preset padrão</button>,
    });

    expect(screen.getByRole("button", { name: "Criar a primeira" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usar preset padrão" })).toBeInTheDocument();
  });

  it("põe a primária antes do atalho na ordem do DOM", () => {
    renderEmptyState({
      action: <button>Criar a primeira</button>,
      shortcut: <button>Usar preset padrão</button>,
    });

    const labels = screen.getAllByRole("button").map((button) => button.textContent);
    expect(labels).toEqual(["Criar a primeira", "Usar preset padrão"]);
  });

  it("renderiza o atalho mesmo sem ação primária", () => {
    renderEmptyState({ shortcut: <button>Importar de arquivo</button> });

    expect(screen.getByRole("button", { name: "Importar de arquivo" })).toBeInTheDocument();
  });

  it("aceita size compact sem perder título e descrição", () => {
    renderEmptyState({ size: "compact" });
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument();
  });
});
