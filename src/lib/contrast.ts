/**
 * Contraste WCAG 2.x — utilitario do design system.
 *
 * Existe para que o contraste dos pares texto/fundo seja um NUMERO verificavel
 * (teste automatizado + script de auditoria), e nao uma inspecao visual. O bug
 * que motivou este modulo (`warning.main` sobre `warning.light` a 2,77:1 no
 * tema claro) viveu meses justamente porque nada media.
 *
 * Ver: src/lib/design-tokens.ts, src/lib/theme-contrast.test.ts,
 *      scripts/contrast-audit.ts
 */

/** Minimo WCAG 2.x AA para texto normal (< 18pt / < 14pt bold). */
export const WCAG_AA_NORMAL_TEXT = 4.5;

/** Minimo WCAG 2.x AA para texto grande e componentes de interface. */
export const WCAG_AA_LARGE_TEXT = 3;

type Rgb = { r: number; g: number; b: number };

/** Converte "#RGB" ou "#RRGGBB" para canais 0-255. */
export function hexToRgb(hex: string): Rgb {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Hex invalido: "${hex}"`);
  }

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** Luminancia relativa (WCAG 2.x, §Relative luminance). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Razao de contraste WCAG 2.x entre duas cores opacas (1 a 21).
 * A ordem dos argumentos e irrelevante.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
