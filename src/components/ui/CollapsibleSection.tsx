"use client";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

import { layout, motion } from "@/lib/design-tokens";

type Props = {
  label: string;
  /** Texto secundário abaixo do título (visível só quando aberto). */
  hint?: string;
  /** Node opcional à direita do título (contadores, hints inline). */
  badge?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/**
 * Bloco de formulário colapsável — mesma estética do `FieldGroup` (borda sutil,
 * fundo `surface` uniforme, sem faixa de cabeçalho, título em overline), só que
 * com um cabeçalho clicável que expande/recolhe o conteúdo. Fundo uniforme evita
 * a inversão de hierarquia no dark (uma faixa `subtle` fica mais clara que o
 * corpo `surface` no tema escuro).
 *
 * O cabeçalho é um `<button type="button">` nativo — dentro de `<form>` não
 * submete (só `submit` o faz) e já traz foco/teclado do próprio elemento.
 */
export function CollapsibleSection({ label, hint, badge, open, onToggle, children }: Props) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "border.subtle",
        borderRadius: 2,
        bgcolor: "background.surface",
      }}
    >
      <Box
        component="button"
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: layout.inline,
          width: "100%",
          px: layout.stack,
          py: 1.25,
          border: 0,
          m: 0,
          bgcolor: "transparent",
          font: "inherit",
          color: "inherit",
          textAlign: "left",
          appearance: "none",
          cursor: "pointer",
          borderRadius: 2,
          "&:focus-visible": { outline: 2, outlineColor: "border.focus", outlineOffset: -2 },
        }}
      >
        <Typography variant="overline" color="text.tertiary" sx={{ flex: 1, lineHeight: 1 }}>
          {label}
        </Typography>
        {badge}
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            color: "text.tertiary",
            transform: open ? "rotate(180deg)" : "none",
            transition: `transform ${motion.duration.normal}ms ${motion.easing.standard}`,
          }}
        />
      </Box>
      <Collapse
        in={open}
        timeout={{ enter: motion.duration.slow, exit: motion.duration.fast }}
        easing={{ enter: motion.easing.entrance, exit: motion.easing.exit }}
      >
        <Box
          sx={{
            px: layout.stack,
            pb: layout.stack,
            opacity: open ? 1 : 0,
            // Atraso no fade de entrada para o conteúdo revelar-se enquanto o
            // bloco ainda está crescendo (em vez de aparecer pronto de cara);
            // saída sem atraso, some junto do início do recolhimento.
            transition: open
              ? `opacity ${motion.duration.normal}ms ${motion.easing.standard} ${motion.duration.fast}ms`
              : `opacity ${motion.duration.fast}ms ${motion.easing.exit}`,
          }}
        >
          {hint && (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mb: layout.stack }}
            >
              {hint}
            </Typography>
          )}
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}
