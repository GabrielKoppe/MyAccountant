"use client";

import Box from "@mui/material/Box";

type Variant = "success" | "warning" | "danger" | "neutral";

type Props = {
  variant: Variant;
  children: React.ReactNode;
};

// success.light / warning.light map to the "subtle" token in our theme (buildPalette)
const variantStyles: Record<Variant, { bgcolor: string; color: string }> = {
  success: { bgcolor: "success.light", color: "success.main" },
  warning: { bgcolor: "warning.light", color: "warning.main" },
  danger: { bgcolor: "danger.subtle", color: "danger.main" },
  neutral: { bgcolor: "neutral.subtle", color: "neutral.main" },
};

export function StatusBadge({ variant, children }: Props) {
  const { bgcolor, color } = variantStyles[variant];
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
