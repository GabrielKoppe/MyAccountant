"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

import { ACCENT_COLOR_KEYS, getAccentPreset } from "@/lib/accent-colors";

/**
 * Duas letras significativas do nome ("Nubank" → "NU", "Colégio Santa Rosa" → "CS").
 *
 * Regra: nome de uma palavra só → as duas primeiras letras dela; duas ou mais
 * palavras → a inicial da primeira + a inicial da segunda. Não há filtro de
 * conectores ("de"/"da"): a segunda palavra do nome, seja qual for, é a que
 * identifica a instituição no monograma.
 *
 * Exportada (não só usada internamente) para o teste unitário do §8 da Spec 68
 * — "o monograma produz duas letras estáveis" — testar sem precisar montar React.
 */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

/**
 * Hash determinístico (djb2) de uma string para um índice de paleta. Mesmo nome ⇒
 * mesmo índice sempre — é o que garante que "Nubank" tenha sempre a mesma cor em
 * toda a aplicação, sem guardar cor nenhuma no banco (Institution não ganhou coluna
 * `color` nesta spec; só Section e ResponsibleParty ganharam).
 */
function hashToIndex(value: string, length: number): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  // `>>> 0`: descarta o sinal do XOR sem depender de Math.abs (que falha em
  // Number.MIN_SAFE_INTEGER, caso de borda que o hash pode produzir).
  return (hash >>> 0) % length;
}

/** Exportada pelo mesmo motivo de `initialsFor`: estabilidade testável sem montar React. */
export function accentKeyForName(name: string): (typeof ACCENT_COLOR_KEYS)[number] {
  return ACCENT_COLOR_KEYS[hashToIndex(name, ACCENT_COLOR_KEYS.length)];
}

type Props = {
  name: string;
  /** Aresta do quadrado em px (Spec 68 §2.3: ~22px na lista). */
  size?: number;
};

/**
 * Monograma de instituição (Spec 68 §2.3 / EST-05): quadrado colorido com as duas
 * primeiras letras significativas do nome. A cor não é escolhida pelo usuário nem
 * guardada no banco — deriva do nome via `accent-colors.ts`, nunca hex.
 *
 * `aria-hidden`: o nome completo já vem ao lado na célula "Nome" (mesmo tratamento
 * do `ColorDot`) — anunciar "quadrado azul, N-U" a cada linha só polui o leitor de tela.
 */
export function InstitutionMonogram({ name, size = 22 }: Props) {
  const theme = useTheme();
  const mode = theme.palette.mode;
  const preset = getAccentPreset(accentKeyForName(name), mode);

  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        // String em px: `borderRadius: 6` seria multiplicado por `theme.shape.borderRadius`
        // (8) e viraria 48px — armadilha documentada no skill design-system.
        borderRadius: "6px",
        bgcolor: preset.subtle,
        color: preset.primary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: "0.62rem",
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {initialsFor(name)}
    </Box>
  );
}
