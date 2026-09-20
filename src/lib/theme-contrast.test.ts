import { describe, expect, it } from "vitest";

import { statusBadgeStyles } from "@/components/ui/StatusBadge";

import { contrastRatio, WCAG_AA_NORMAL_TEXT } from "./contrast";
import { darkColors, lightColors } from "./design-tokens";
import { darkTheme, lightTheme } from "./theme";

/**
 * Guarda de CONTRASTE dos pares texto/fundo do design system.
 *
 * Bug real: o `StatusBadge` (12px/500 → texto normal, minimo AA 4,5:1) pintava
 * o texto com `X.main` sobre `X.light`/`X.subtle`. No tema claro esse par media
 * warning 2,77:1, success 4,05:1, danger 4,38:1 — todos reprovados. Viveu meses
 * porque NADA media: contraste nao quebra build, nao gera warning e passa
 * despercebido em code review. Este teste e o que impede a volta silenciosa.
 *
 * O que ele trava:
 *  1. Os 4 tons do `StatusBadge` (tokens lidos do PROPRIO componente) ≥ 4,5:1
 *     nos dois modos — se alguem trocar `onSubtle` de volta por `main`, falha.
 *  2. `text.tertiary` sobre `background.surface` ≥ 4,5:1 nos dois modos.
 *  3. Que os tokens existam de fato na palette do MUI (chave inexistente
 *     resolve para `undefined` e o MUI descarta a regra em SILENCIO).
 *  4. As decisoes de design por tras dos hex: no dark `onSubtle === main`
 *     (o par ja passava) e `neutral.onSubtle === text.secondary`.
 */

type AnyTheme = typeof lightTheme;

/** Resolve um token de palette ("warning.onSubtle") como o `sx` do MUI faria. */
function resolveToken(theme: AnyTheme, token: string): unknown {
  return token
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      theme.palette,
    );
}

function resolveHex(theme: AnyTheme, token: string): string {
  const value = resolveToken(theme, token);
  expect(
    value,
    `token "${token}" nao existe na palette — o MUI descartaria a regra em silencio`,
  ).toEqual(expect.stringMatching(/^#[0-9A-Fa-f]{6}$/));
  return value as string;
}

/** Le `components.MuiTooltip.styleOverrides.tooltip` como o MUI o aplicaria. */
function tooltipStyle(theme: AnyTheme): { backgroundColor: string; color: string } {
  const style = theme.components?.MuiTooltip?.styleOverrides?.tooltip as
    | { backgroundColor?: string; color?: string }
    | undefined;

  expect(style?.backgroundColor, "MuiTooltip sem backgroundColor no tema").toEqual(
    expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
  );
  expect(style?.color, "MuiTooltip sem color no tema").toEqual(
    expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
  );

  return { backgroundColor: style!.backgroundColor!, color: style!.color! };
}

const MODES = [
  ["light", lightTheme, lightColors],
  ["dark", darkTheme, darkColors],
] as const;

describe("contraste WCAG AA (4,5:1) dos pares texto/fundo", () => {
  for (const [mode, theme, colors] of MODES) {
    describe(mode, () => {
      for (const [variant, style] of Object.entries(statusBadgeStyles)) {
        it(`StatusBadge "${variant}": ${style.color} sobre ${style.bgcolor} >= 4,5:1`, () => {
          const fg = resolveHex(theme, style.color);
          const bg = resolveHex(theme, style.bgcolor);
          const ratio = contrastRatio(fg, bg);

          expect(
            ratio,
            `${style.color} (${fg}) sobre ${style.bgcolor} (${bg}) = ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
        });
      }

      it("text.tertiary sobre background.surface >= 4,5:1", () => {
        const fg = resolveHex(theme, "text.tertiary");
        const bg = resolveHex(theme, "background.surface");
        const ratio = contrastRatio(fg, bg);

        expect(ratio, `${fg} sobre ${bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          WCAG_AA_NORMAL_TEXT,
        );
      });

      it("neutral.onSubtle e o mesmo tom de text.secondary", () => {
        expect(colors.neutral.onSubtle).toBe(colors.text.secondary);
      });

      /**
       * O tooltip ja saiu INVERTIDO uma vez: `backgroundColor: text.primary` +
       * `color: text.inverse` amarrava o balao ao oposto do modo, entao no tema
       * escuro ele aparecia claro e no claro, escuro. O par continua legivel
       * invertido — por isso nenhum teste de contraste pegava o problema. Este
       * aqui pega: le os hex do PROPRIO tema e exige que o balao seja da familia
       * do modo (proximo de `background.surface`), alem de AA para o texto.
       */
      it("Tooltip: balao na superficie do TEMA (nao invertido) e texto >= 4,5:1", () => {
        const { backgroundColor, color } = tooltipStyle(theme);

        expect(backgroundColor, "o balao usa a superficie do tema").toBe(colors.background.surface);

        const ratio = contrastRatio(color, backgroundColor);
        expect(
          ratio,
          `${color} sobre ${backgroundColor} = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
      });
    });
  }

  it("no dark, onSubtle === main (o par main+subtle ja passava AA)", () => {
    for (const tone of ["success", "warning", "danger"] as const) {
      expect(darkColors[tone].onSubtle, `dark ${tone}`).toBe(darkColors[tone].main);
    }
  });

  it("no light, onSubtle e mais escuro que main (o par main+subtle reprovava)", () => {
    for (const tone of ["success", "warning", "danger"] as const) {
      const withMain = contrastRatio(lightColors[tone].main, lightColors[tone].subtle);
      const withOnSubtle = contrastRatio(lightColors[tone].onSubtle, lightColors[tone].subtle);

      expect(withMain, `light ${tone} main ainda reprovava`).toBeLessThan(WCAG_AA_NORMAL_TEXT);
      expect(withOnSubtle, `light ${tone} onSubtle`).toBeGreaterThan(withMain);
    }
  });
});
