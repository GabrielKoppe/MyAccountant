import { describe, expect, it } from "vitest";

import { darkColors, lightColors } from "./design-tokens";
import { darkTheme, lightTheme } from "./theme";

/**
 * Guarda de regressão dos TOKENS SEMÂNTICOS documentados em CLAUDE.md §5.11.
 *
 * Bug real (Spec 66): o projeto inteiro escreve `sx={{ bgcolor: "background.subtle" }}`
 * e `color="text.tertiary"` — 183 usos em 74 arquivos —, mas a palette do MUI só
 * define `background.{default,paper}` e `text.{primary,secondary,disabled}`.
 * Chave inexistente NÃO gera erro: o MUI resolve para `undefined` e descarta a
 * regra em SILÊNCIO. Resultado: estilos que "não aparecem" sem nenhum aviso —
 * exatamente o sintoma de "mudei o design e continua igual".
 */
describe("tokens semânticos da palette", () => {
  for (const [name, theme, c] of [
    ["light", lightTheme, lightColors],
    ["dark", darkTheme, darkColors],
  ] as const) {
    describe(name, () => {

      it("background.{canvas,surface,subtle,muted} existem e batem com design-tokens", () => {
        expect(theme.palette.background.canvas).toBe(c.background.canvas);
        expect(theme.palette.background.surface).toBe(c.background.surface);
        expect(theme.palette.background.subtle).toBe(c.background.subtle);
        expect(theme.palette.background.muted).toBe(c.background.muted);
      });

      it("mantém os tokens nativos do MUI (default/paper)", () => {
        expect(theme.palette.background.default).toBe(c.background.canvas);
        expect(theme.palette.background.paper).toBe(c.background.surface);
      });

      it("text.tertiary existe e bate com design-tokens", () => {
        expect(theme.palette.text.tertiary).toBe(c.text.tertiary);
      });

      it("surface.* segue como alias equivalente (mesmos hex)", () => {
        expect(theme.palette.surface.canvas).toBe(theme.palette.background.canvas);
        expect(theme.palette.surface.subtle).toBe(theme.palette.background.subtle);
        expect(theme.palette.surface.muted).toBe(theme.palette.background.muted);
      });

      it("border/accent/danger/neutral continuam definidos", () => {
        expect(theme.palette.border.subtle).toBe(c.border.subtle);
        expect(theme.palette.border.default).toBe(c.border.default);
        expect(theme.palette.border.strong).toBe(c.border.strong);
        expect(theme.palette.accent.primary).toBeTruthy();
        expect(theme.palette.danger.main).toBe(c.danger.main);
        expect(theme.palette.danger.subtle).toBe(c.danger.subtle);
        expect(theme.palette.neutral.main).toBe(c.neutral.main);
      });
    });
  }
});
