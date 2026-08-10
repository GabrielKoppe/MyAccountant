import Typography from "@mui/material/Typography";

import { typography } from "@/lib/design-tokens";

type Props = {
  /** Contagem já formatada pela origem — string, não número ("18 · 47 sub", "1 conectado"). */
  value: string;
};

/**
 * Contagem barata à direita de um item do nav de Configurações (Spec 67 §4 SET-01).
 *
 * Monoespaçada e discreta: é referência de escala, não conteúdo — nunca deve
 * competir com o rótulo do link. Discreta até `text.tertiary`, e não além:
 * `text.disabled` daria 2,1:1 em light / 2,5:1 em dark, abaixo do AA para 12px.
 */
export function NavCount({ value }: Props) {
  return (
    <Typography
      component="span"
      variant="caption"
      sx={{
        ml: "auto",
        pl: 1,
        color: "text.tertiary",
        fontFamily: typography.fontFamily.mono,
        fontVariantNumeric: "tabular-nums",
        flexShrink: 0,
      }}
    >
      {value}
    </Typography>
  );
}
