import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PageGuide } from "@/lib/page-guide";

import { PageInfoDialog } from "./PageInfoDialog";

const guide: PageGuide = {
  title: "Guia da página",
  pages: [
    {
      heading: "Visão geral",
      blocks: [
        { kind: "text", text: "Texto introdutório." },
        { kind: "list", items: ["Item A", "Item B"] },
      ],
    },
    {
      heading: "Como usar",
      blocks: [
        { kind: "steps", items: ["Passo um", "Passo dois"] },
        { kind: "tip", tone: "info", title: "Dica", text: "Fique atento." },
      ],
    },
    {
      heading: "Exemplo",
      blocks: [{ kind: "example", title: "Exemplo prático", text: "Conteúdo do exemplo." }],
    },
  ],
};

function renderDialog(props: Partial<Parameters<typeof PageInfoDialog>[0]> = {}) {
  return render(<PageInfoDialog open={true} onClose={() => {}} guide={guide} {...props} />);
}

describe("PageInfoDialog", () => {
  it("renderiza o primeiro passo ao abrir", () => {
    renderDialog();
    expect(screen.getByText("Guia da página")).toBeInTheDocument();
    expect(screen.getByText("Visão geral")).toBeInTheDocument();
    expect(screen.getByText("Texto introdutório.")).toBeInTheDocument();
    expect(screen.getByText("Item A")).toBeInTheDocument();
  });

  it('"Voltar" está desabilitado no primeiro passo', () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
  });

  it('"Próximo" avança para o passo seguinte', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByText("Como usar")).toBeInTheDocument();
    expect(screen.getByText("Passo um")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).not.toBeDisabled();
  });

  it('"Voltar" retorna ao passo anterior', async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByText("Como usar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText("Visão geral")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
  });

  it('no último passo o botão vira "Entendi" e chama onClose', async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });
    await userEvent.click(screen.getByRole("button", { name: "Próximo" }));
    await userEvent.click(screen.getByRole("button", { name: "Próximo" }));
    // Terceiro (último) passo
    expect(screen.getByText("Exemplo prático")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Próximo" })).not.toBeInTheDocument();
    const done = screen.getByRole("button", { name: "Entendi" });
    await userEvent.click(done);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("permite pular direto via dots de progresso", async () => {
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "3 / 3" }));
    expect(screen.getByText("Exemplo")).toBeInTheDocument();
    expect(screen.getByText("Conteúdo do exemplo.")).toBeInTheDocument();
  });

  it("reabrir reseta para o primeiro passo", async () => {
    const { rerender } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByText("Como usar")).toBeInTheDocument();

    // Fecha
    rerender(<PageInfoDialog open={false} onClose={() => {}} guide={guide} />);
    // Reabre
    rerender(<PageInfoDialog open={true} onClose={() => {}} guide={guide} />);

    expect(screen.getByText("Visão geral")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
  });
});
