"use client";

import Typography from "@mui/material/Typography";
import type { TypographyProps } from "@mui/material/Typography";

import { formatCentsToBrl } from "@/lib/money";

type Props = {
  cents: bigint;
  variant?: TypographyProps["variant"];
  showSign?: boolean;
};

export function MoneyValue({
  cents,
  variant = "body2",
  showSign = false,
  sx,
  ...props
}: Props & { sx?: any }) {
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
        ...sx,
      }}
      {...props}
    >
      {formatCentsToBrl(cents, showSign ? { sign: "always" } : undefined)}
    </Typography>
  );
}
