import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SETTINGS_FIELD_HEIGHT, SETTINGS_TABLE_FONT } from "./settings-table-tokens";
import { SettingsRowField } from "./SettingsRowField";

/** O `<div>` do contorno — é nele que altura, tipografia e raio são aplicados. */
function outlinedRoot(container: HTMLElement) {
  return container.querySelector(".MuiOutlinedInput-root") as HTMLElement;
}

describe("SettingsRowField", () => {
  it("converte `label` em placeholder + nome acessível, sem label flutuante do MUI", () => {
    const { container } = render(<SettingsRowField label="Nome do tipo" value="" />);

    expect(screen.getByLabelText("Nome do tipo")).toHaveAttribute("placeholder", "Nome do tipo");
    expect(container.querySelector("label")).toBeNull();
  });

  describe("altura", () => {
    it("sem `fieldHeight`, usa a altura da linha de tabela", () => {
      const { container } = render(<SettingsRowField label="Nome" value="" />);

      expect(getComputedStyle(outlinedRoot(container)).height).toBe(`${SETTINGS_FIELD_HEIGHT}px`);
    });

    /**
     * TESTE DE REGRESSÃO — não remover.
     *
     * A altura customizada chegava por `sx={{ "& .MuiOutlinedInput-root": { height: 33 } }}`.
     * O `sx` do chamador é espalhado por último e o seletor é um objeto ANINHADO: o
     * spread substituía o objeto inteiro do componente e levava embora o `fontSize`
     * (0.8125rem) e o `borderRadius`. O campo caía nos 16px do tema — invisível em code
     * review, porque o seletor está escrito corretamente. Se alguém trocar a prop de
     * volta por `sx`, este teste cai.
     */
    it("com `fieldHeight`, a tipografia do campo CONTINUA a da tabela", () => {
      const { container } = render(<SettingsRowField label="Nome" value="" fieldHeight={33} />);
      const style = getComputedStyle(outlinedRoot(container));

      expect(style.height).toBe("33px");
      expect(style.fontSize).toBe(SETTINGS_TABLE_FONT.field.size);
    });
  });
});
