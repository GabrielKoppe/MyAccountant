import type { SectionCountType } from "@prisma/client";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { m } from "@/lib/messages";
import { SECTION_COUNT_TYPES } from "@/lib/schemas/settings";

import { SectionKindChip } from "./SectionKindChip";

/**
 * Ícone esperado por valor (Spec 68 §2.1, tabela da coluna Tipo). Os testids
 * vêm do próprio `@mui/icons-material` em ambiente de teste — não são
 * inventados aqui.
 */
const EXPECTED_ICON_TESTID: Record<SectionCountType, string> = {
  subtract: "NorthEastIcon",
  add: "SouthWestIcon",
  neutral: "SwapHorizIcon",
  ignore: "DoNotDisturbOnOutlinedIcon",
};

describe("SectionKindChip (Spec 68 §8 — critério de teste)", () => {
  it.each(SECTION_COUNT_TYPES)(
    "mapeia countType='%s' para o rótulo e o ícone corretos",
    (countType) => {
      const { container, unmount } = render(<SectionKindChip countType={countType} />);

      expect(
        screen.getByText(m.settings.structure.sections.kindLabels[countType]),
      ).toBeInTheDocument();
      expect(
        container.querySelector(`[data-testid="${EXPECTED_ICON_TESTID[countType]}"]`),
      ).toBeInTheDocument();

      unmount();
    },
  );

  it("cobre exatamente os quatro valores reais de `countType` — nenhum valor órfão", () => {
    // `SECTION_COUNT_TYPES` é a fonte única (D1): se o schema ganhar um quinto
    // valor um dia, este teste falha aqui em vez de um chip mudo em produção.
    expect([...SECTION_COUNT_TYPES].sort()).toEqual(["add", "ignore", "neutral", "subtract"]);
    expect(Object.keys(EXPECTED_ICON_TESTID).sort()).toEqual([...SECTION_COUNT_TYPES].sort());
  });
});
