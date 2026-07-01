import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { layout } from "@/lib/design-tokens";

/**
 * Card temático para agrupar campos relacionados de um formulário.
 * Borda sutil (sem sombra), título em overline e hint opcional.
 */
export function FieldGroup({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  /** Node opcional alinhado à direita do título (ex: switch, contador). */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "border.subtle",
        borderRadius: 2,
        bgcolor: "background.surface",
        p: layout.stack,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: layout.inline, minHeight: 20 }}>
        <Typography variant="overline" color="text.tertiary" sx={{ flex: 1, lineHeight: 1 }}>
          {title}
        </Typography>
        {action}
      </Box>
      {hint && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mt: layout.micro }}
        >
          {hint}
        </Typography>
      )}
      <Box sx={{ mt: layout.stack }}>{children}</Box>
    </Box>
  );
}
