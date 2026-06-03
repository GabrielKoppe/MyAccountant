"use client";

import Typography from "@mui/material/Typography";
import type { TypographyProps } from "@mui/material/Typography";
import { formatCentsToBrl } from "@/lib/money";

type Props = {
  cents: bigint;
  variant?: TypographyProps["variant"];
};

export function MoneyValue({ cents, variant = "body2" }: Props) {
  const color = cents > 0n ? "success.main" : cents < 0n ? "danger.main" : "text.tertiary";

  return (
    <Typography
      component="span"
      variant={variant}
      sx={{
        fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
        fontWeight: 500,
        fontVariantNumeric: "tabular-nums",
        color,
      }}
    >
      {formatCentsToBrl(cents)}
    </Typography>
  );
}
