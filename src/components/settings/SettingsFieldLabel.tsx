"use client";

import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

import { layout, typography } from "@/lib/design-tokens";

/**
 * Rótulo de bloco dentro de um modal de Configurações (`.fl` no desenho).
 *
 * Mono, caixa alta, menor que o texto do corpo: é uma etiqueta de seção
 * ("Referências de configuração", "O que será movido", "Realocar para"), não um
 * parágrafo. Antes cada modal usava `variant="overline"` (12px, sans), que lia com o
 * mesmo peso do conteúdo abaixo dele e achatava a hierarquia do diálogo.
 *
 * `text.tertiary`, e não o tom mais apagado do desenho: em 10px o `text.disabled`
 * mede ~2,1:1 e o rótulo é a única coisa que nomeia o bloco.
 */
export function SettingsFieldLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="div"
      sx={{
        fontFamily: typography.fontFamily.mono,
        fontSize: "0.625rem",
        fontWeight: typography.fontWeight.semibold,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "text.tertiary",
        mb: layout.inline,
      }}
    >
      {children}
    </Typography>
  );
}
