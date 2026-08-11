import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { m } from "@/lib/messages";
import { SECTION_COUNT_TYPES } from "@/lib/schemas/settings";

import { SectionKindLegend } from "./SectionKindLegend";

describe("SectionKindLegend (Spec 68 §8 — critério de teste)", () => {
  it("renderiza os quatro tipos com rótulo e explicação — o componente não recebe itemCount", () => {
    // `SectionKindLegend` não tem nenhum prop de contagem: ela vive no slot
    // `subheader` do shell, que NUNCA é sujeito ao gate dos 12 itens (D12 da
    // Spec 67) — diferente do `toolbar`. Renderizar sem qualquer prop de lista
    // já comprova que a legenda independe de quantos itens existem.
    render(<SectionKindLegend />);

    for (const countType of SECTION_COUNT_TYPES) {
      expect(
        screen.getByText(m.settings.structure.sections.kindLabels[countType]),
      ).toBeInTheDocument();
      expect(
        screen.getByText(m.settings.structure.sections.kindHints[countType]),
      ).toBeInTheDocument();
    }
  });

  it("renderiza o rótulo 'Tipos' da faixa", () => {
    render(<SectionKindLegend />);
    expect(screen.getByText(m.settings.structure.sections.legendLabel)).toBeInTheDocument();
  });
});
