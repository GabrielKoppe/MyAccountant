import { describe, expect, it } from "vitest";

import { contrastRatio, WCAG_AA_LARGE_TEXT } from "@/lib/contrast";
import { darkColors, lightColors } from "@/lib/design-tokens";

import { MINIATURE_INK } from "./miniature-ink";

/**
 * Guarda permanente das duas tintas descritas em `miniature-ink.ts`.
 *
 * O bug original não tinha teste porque nada MEDIA a miniatura: o par
 * `background.muted` sobre `accent.primarySubtle` (card selecionado, tema claro)
 * dava 1,02:1 e passou pela revisão visual justamente porque some. Aqui os três
 * fundos que o `ChoiceCard` pode ter entram na matriz.
 *
 * **Cada uso tem o SEU piso**, e o da ilustrativa é menor que 3:1 de propósito —
 * ver a justificativa (WCAG 1.4.11 vale para gráfico necessário ao conteúdo, e o
 * pictograma do bloco "Organização da linha" não é) em `miniature-ink.ts`. O que
 * o teste impede é a volta ao ~1,0:1, onde o desenho desaparece.
 */
const CARD_BACKGROUNDS = {
  /** Card não selecionado. */
  surface: (c: typeof lightColors) => c.background.surface,
  /** Card selecionado — o fundo que apagava a miniatura. */
  selected: (c: typeof lightColors) => c.accent.primarySubtle,
  /** Card desabilitado (tipo padrão, salvamento em curso). */
  disabled: (c: typeof lightColors) => c.background.subtle,
} as const;

/**
 * Piso da tinta ILUSTRATIVA. Abaixo de 3:1 conscientemente (o pictograma não é
 * necessário para entender o card), mas com chão: 1,8 é o pior caso do
 * `border.strong` — 1,83:1, sobre o card selecionado no tema claro.
 */
const ILLUSTRATIVE_MIN = 1.8;

/** Piso da tinta ESTRUTURAL: régua cheia da WCAG 1.4.11 — ali a miniatura É o dado. */
const STRUCTURAL_MIN = WCAG_AA_LARGE_TEXT;

const INK_HEX = {
  illustrative: (c: typeof lightColors) => c.border.strong,
  "structural.strong": (c: typeof lightColors) => c.text.secondary,
  "structural.soft": (c: typeof lightColors) => c.text.tertiary,
} as const;

const INK_MIN: Record<keyof typeof INK_HEX, number> = {
  illustrative: ILLUSTRATIVE_MIN,
  "structural.strong": STRUCTURAL_MIN,
  "structural.soft": STRUCTURAL_MIN,
};

const THEMES = {
  light: lightColors,
  dark: darkColors as unknown as typeof lightColors,
} as const;

describe("tinta das miniaturas dos ChoiceCard", () => {
  it("os nomes de token exportados são os que o teste mede", () => {
    // Sem isto o teste mediria `border.strong`/`text.secondary` enquanto o
    // componente desenhasse outra coisa.
    expect(MINIATURE_INK).toEqual({
      illustrative: "border.strong",
      structural: { strong: "text.secondary", soft: "text.tertiary" },
    });
  });

  describe.each(Object.keys(THEMES) as (keyof typeof THEMES)[])("tema %s", (theme) => {
    const colors = THEMES[theme];

    describe.each(Object.keys(INK_HEX) as (keyof typeof INK_HEX)[])("tinta %s", (ink) => {
      const min = INK_MIN[ink];

      it.each(Object.keys(CARD_BACKGROUNDS) as (keyof typeof CARD_BACKGROUNDS)[])(
        `passa ${min}:1 sobre o card %s`,
        (background) => {
          const ratio = contrastRatio(INK_HEX[ink](colors), CARD_BACKGROUNDS[background](colors));

          expect(ratio, `${ink} sobre ${background} (${theme})`).toBeGreaterThanOrEqual(min);
        },
      );
    });
  });

  it("a ilustrativa é mais LEVE que a estrutural — foi o pedido, não um acidente", () => {
    // Se alguém "consertar" a ilustrativa de volta para uma tinta de texto, o
    // bloco "Organização da linha" volta a pesar mais que o próprio rótulo.
    const illustrative = contrastRatio(lightColors.border.strong, lightColors.background.surface);
    const structural = contrastRatio(lightColors.text.tertiary, lightColors.background.surface);

    expect(illustrative).toBeLessThan(structural);
    expect(illustrative).toBeLessThan(WCAG_AA_LARGE_TEXT);
  });

  it("o token de FUNDO que estava em uso reprova até o piso da ilustrativa — é o bug", () => {
    // Referência histórica: enquanto este número for < ILLUSTRATIVE_MIN, trocar a
    // tinta de volta para `background.muted` é uma regressão, não uma
    // simplificação — nem sob o argumento de "deixar mais leve".
    expect(
      contrastRatio(lightColors.background.muted, lightColors.accent.primarySubtle),
    ).toBeLessThan(ILLUSTRATIVE_MIN);
  });
});
