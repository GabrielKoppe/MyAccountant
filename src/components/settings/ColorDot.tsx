"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

import { getAccentPreset, ACCENT_COLOR_KEYS, type AccentColorKey } from "@/lib/accent-colors";
import { getChartColors } from "@/lib/design-tokens";

export type ColorDotProps = {
  /**
   * Chave de `accent-colors.ts` (nunca hex). `null`/inválida cai no fallback por
   * índice, que é a paleta que os widgets de dashboard já usam hoje.
   */
  colorKey?: string | null;
  /**
   * Posição do objeto na lista — semeia o fallback. Passar o índice da linha faz
   * seções vizinhas saírem com cores distintas em vez de todas iguais.
   */
  fallbackIndex?: number;
  /** Aresta do quadrado em px. 9 nas listas; 8 dentro de chips e legendas. */
  size?: number;
};

function isAccentKey(value: string | null | undefined): value is AccentColorKey {
  return !!value && (ACCENT_COLOR_KEYS as readonly string[]).includes(value);
}

/**
 * Ponto de cor da identidade de uma seção ou categoria (Spec 68 §7.4).
 *
 * **Um único componente** para Seções, Categorias, chips de transação e legendas de
 * widget — é o que garante que a mesma seção tenha a mesma marca em toda a aplicação.
 *
 * `aria-hidden` de propósito: a cor nunca é a única informação (o nome vem ao lado), e
 * anunciar "quadrado verde" a cada linha só polui o leitor de tela.
 *
 * O quadrado tem 3px de raio — canto arredondado, não círculo. Círculo lê como avatar
 * ou como status (o `StatusCell` já ocupa esse vocabulário na mesma linha).
 */
export function ColorDot({ colorKey, fallbackIndex = 0, size = 9 }: ColorDotProps) {
  const theme = useTheme();
  const mode = theme.palette.mode as "light" | "dark";

  const palette = getChartColors(mode);
  const color = isAccentKey(colorKey)
    ? getAccentPreset(colorKey, mode).primary
    : // `% length` porque a lista pode ser mais longa que a paleta; sem isso o índice
      // estoura e o `background` vira `undefined` (retângulo invisível).
      palette[fallbackIndex % palette.length];

  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        // String em px: `borderRadius: 3` seria multiplicado por `theme.shape.borderRadius`
        // (8) e viraria 24px — um círculo.
        borderRadius: "3px",
        bgcolor: color,
        flexShrink: 0,
      }}
    />
  );
}
