import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SettingsPageShell, shouldRenderToolbar } from "./SettingsPageShell";

vi.mock("next/navigation", () => ({
  useParams: () => ({ accountId: "acc-test-1" }),
}));

const BASE = {
  family: "Estrutura" as const,
  title: "Categorias",
  purpose: "Classificam cada transação.",
};

describe("shouldRenderToolbar (Spec 67 §4 SET-04 / D6)", () => {
  it("só acima de 12 itens", () => {
    expect(shouldRenderToolbar(undefined)).toBe(false);
    expect(shouldRenderToolbar(0)).toBe(false);
    expect(shouldRenderToolbar(12)).toBe(false);
    expect(shouldRenderToolbar(13)).toBe(true);
    expect(shouldRenderToolbar(999)).toBe(true);
  });
});

describe("SettingsPageShell — cabeçalho", () => {
  it("renderiza breadcrumb, título, contagem e frase de propósito", () => {
    render(
      <SettingsPageShell {...BASE} count="18 · 47 sub">
        <div>conteúdo</div>
      </SettingsPageShell>,
    );

    // O rótulo do breadcrumb é lido por leitor de tela: vem de `messages`, em pt-BR.
    expect(screen.getByRole("navigation", { name: "Trilha de navegação" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configurações" })).toHaveAttribute(
      "href",
      "/acc-test-1/settings",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Categorias" })).toBeInTheDocument();
    expect(screen.getByText("Estrutura")).toBeInTheDocument();
    expect(screen.getByText("18 · 47 sub")).toBeInTheDocument();
    expect(screen.getByText("Classificam cada transação.")).toBeInTheDocument();
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("sem contagem, nenhum chip é renderizado", () => {
    const { container } = render(
      <SettingsPageShell {...BASE}>
        <div />
      </SettingsPageShell>,
    );
    expect(container.querySelector(".MuiChip-root")).toBeNull();
  });

  it("badge de owner só aparece com ownerOnly", () => {
    const { rerender } = render(
      <SettingsPageShell {...BASE}>
        <div />
      </SettingsPageShell>,
    );
    expect(screen.queryByText("owner")).toBeNull();

    rerender(
      <SettingsPageShell {...BASE} ownerOnly>
        <div />
      </SettingsPageShell>,
    );
    expect(screen.getByText("owner")).toBeInTheDocument();
  });
});

describe("SettingsPageShell — ações (regra 4)", () => {
  it("a primária é contained e as secundárias são outlined, com as secundárias ANTES dela no DOM", async () => {
    const onPrimary = vi.fn();
    render(
      <SettingsPageShell
        {...BASE}
        primaryAction={{ label: "Nova categoria", onClick: onPrimary }}
        secondaryActions={[{ label: "Exportar", onClick: vi.fn() }]}
      >
        <div />
      </SettingsPageShell>,
    );

    const primary = screen.getByRole("button", { name: "Nova categoria" });
    const secondary = screen.getByRole("button", { name: "Exportar" });

    expect(primary.className).toContain("MuiButton-contained");
    expect(secondary.className).toContain("MuiButton-outlined");
    // Node.DOCUMENT_POSITION_FOLLOWING = 4 -> a primária vem depois da secundária.
    expect(secondary.compareDocumentPosition(primary) & 4).toBeTruthy();

    await userEvent.click(primary);
    expect(onPrimary).toHaveBeenCalledOnce();
  });

  it("há no máximo um botão contained no cabeçalho", () => {
    const { container } = render(
      <SettingsPageShell
        {...BASE}
        primaryAction={{ label: "Nova categoria", onClick: vi.fn() }}
        secondaryActions={[
          { label: "Exportar", onClick: vi.fn() },
          { label: "Importar", onClick: vi.fn() },
        ]}
      >
        <div />
      </SettingsPageShell>,
    );

    expect(container.querySelectorAll("header .MuiButton-contained")).toHaveLength(1);
  });
});

describe("SettingsPageShell — toolbar (D6) e subheader (D12)", () => {
  it("não renderiza a toolbar com 12 itens ou menos, MESMO com toolbar passada", () => {
    render(
      <SettingsPageShell {...BASE} itemCount={12} toolbar={<div>toolbar</div>}>
        <div />
      </SettingsPageShell>,
    );
    expect(screen.queryByText("toolbar")).toBeNull();
  });

  it("renderiza a toolbar acima de 12 itens", () => {
    render(
      <SettingsPageShell {...BASE} itemCount={13} toolbar={<div>toolbar</div>}>
        <div />
      </SettingsPageShell>,
    );
    expect(screen.getByText("toolbar")).toBeInTheDocument();
  });

  it("o subheader NUNCA é afetado pelo gate — aparece numa lista de 6 itens", () => {
    render(
      <SettingsPageShell
        {...BASE}
        itemCount={6}
        toolbar={<div>toolbar</div>}
        subheader={<div>legenda de tipos</div>}
      >
        <div />
      </SettingsPageShell>,
    );
    expect(screen.queryByText("toolbar")).toBeNull();
    expect(screen.getByText("legenda de tipos")).toBeInTheDocument();
  });
});

describe("SettingsPageShell — rodapé de salvar (D7)", () => {
  it("dirtyCount undefined não renderiza a barra", () => {
    render(
      <SettingsPageShell {...BASE}>
        <div />
      </SettingsPageShell>,
    );
    expect(screen.queryByText("Nenhuma alteração")).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("dirtyCount 0 renderiza a barra desabilitada", () => {
    render(
      <SettingsPageShell {...BASE} dirtyCount={0} onSave={vi.fn()} onDiscard={vi.fn()}>
        <div />
      </SettingsPageShell>,
    );
    expect(screen.getByText("Nenhuma alteração")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
  });

  it("dirtyCount > 0 habilita e usa saveLabel customizado", async () => {
    const onSave = vi.fn();
    render(
      <SettingsPageShell
        {...BASE}
        dirtyCount={3}
        saveLabel="Salvar tipo"
        onSave={onSave}
        onDiscard={vi.fn()}
      >
        <div />
      </SettingsPageShell>,
    );

    expect(screen.getByText("3 alterações não salvas")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Salvar tipo" });
    expect(save).toBeEnabled();

    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledOnce();
  });
});
