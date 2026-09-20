"use client";

import Box from "@mui/material/Box";

type Variant = "success" | "warning" | "danger" | "neutral";

type Props = {
  variant: Variant;
  children: React.ReactNode;
};

// `success.light` / `warning.light` mapeiam para o token "subtle" no nosso tema
// (ver buildPalette). O texto NUNCA usa `.main`: o par `main` + fundo sutil
// reprova WCAG AA no tema claro (warning 2,77:1) — este badge e 12px/500, ou
// seja, texto normal, minimo 4,5:1. A cor de texto correta e `.onSubtle`.
// Ver src/lib/design-tokens.ts e src/lib/theme-contrast.test.ts.
export const statusBadgeStyles: Record<Variant, { bgcolor: string; color: string }> = {
  success: { bgcolor: "success.light", color: "success.onSubtle" },
  warning: { bgcolor: "warning.light", color: "warning.onSubtle" },
  danger: { bgcolor: "danger.subtle", color: "danger.onSubtle" },
  neutral: { bgcolor: "neutral.subtle", color: "neutral.onSubtle" },
};

export function StatusBadge({ variant, children }: Props) {
  const { bgcolor, color } = statusBadgeStyles[variant];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        bgcolor,
        color,
        px: 2,
        py: 0.5,
        borderRadius: "4px",
        fontSize: "0.75rem",
        fontWeight: 500,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Box>
  );
}
