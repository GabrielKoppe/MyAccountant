import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { PageGuide } from "@/lib/page-guide";

import { PageInfoButton } from "./PageInfoButton";

const guide: PageGuide = {
  title: "Guia da página",
  pages: [
    {
      heading: "Visão geral",
      blocks: [{ kind: "text", text: "Texto introdutório." }],
    },
  ],
};

describe("PageInfoButton", () => {
  it("renderiza o botão com o rótulo acessível padrão e não abre o dialog de início", () => {
    render(<PageInfoButton guide={guide} />);
    expect(screen.getByRole("button", { name: "Sobre esta página" })).toBeInTheDocument();
    // Dialog fechado: o conteúdo do guia não está no documento.
    expect(screen.queryByText("Visão geral")).not.toBeInTheDocument();
  });

  it("abre o dialog do guia ao clicar", async () => {
    render(<PageInfoButton guide={guide} />);
    await userEvent.click(screen.getByRole("button", { name: "Sobre esta página" }));
    expect(screen.getByText("Guia da página")).toBeInTheDocument();
    expect(screen.getByText("Visão geral")).toBeInTheDocument();
    expect(screen.getByText("Texto introdutório.")).toBeInTheDocument();
  });

  it("aceita um rótulo acessível customizado", () => {
    render(<PageInfoButton guide={guide} ariaLabel="Ajuda do net worth" />);
    expect(screen.getByRole("button", { name: "Ajuda do net worth" })).toBeInTheDocument();
  });
});
