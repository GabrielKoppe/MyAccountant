"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

type Entry = {
  name?: string;
  value?: number;
  color?: string;
  fill?: string;
};

type TooltipProps = {
  active?: boolean;
  payload?: Entry[];
  label?: string;
  formatValue?: (value: number) => string;
  hideName?: boolean;
};

/**
 * Tooltip padronizado para gráficos recharts.
 * Usar como: <Tooltip content={(p: any) => <ChartTooltip {...p} formatValue={...} />} />
 */
export function ChartTooltip({ active, payload, label, formatValue, hideName }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "border.subtle",
        borderRadius: "8px",
        px: 1.5,
        py: 1,
        boxShadow: 2,
        minWidth: 80,
        maxWidth: 260,
        pointerEvents: "none",
      }}
    >
      {label && (
        <Typography
          component="div"
          sx={{
            mb: 0.75,
            fontSize: "0.6rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "text.tertiary",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </Typography>
      )}
      {payload.map((entry, i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1, mt: i > 0 ? 0.5 : 0 }}>
          <Box
            component="span"
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: entry.color ?? entry.fill ?? "text.disabled",
              flexShrink: 0,
              display: "inline-block",
            }}
          />
          {!hideName && entry.name && (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                flex: 1,
                fontSize: "0.7rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 120,
              }}
            >
              {entry.name}
            </Typography>
          )}
          {entry.value != null && (
            <Typography
              variant="caption"
              sx={{
                fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                fontWeight: 500,
                fontSize: "0.7rem",
                color: "text.primary",
                ml: "auto",
                flexShrink: 0,
                pl: 1,
              }}
            >
              {formatValue ? formatValue(entry.value) : entry.value}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

type PieLegendProps = {
  payload?: Array<{ value: string; color: string }>;
};

/**
 * Legenda compacta para gráficos de pizza (círculos + nomes).
 * Usar como: <Legend content={(p: any) => <PieLegend {...p} />} />
 */
export function PieLegend({ payload }: PieLegendProps) {
  if (!payload?.length) return null;
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 1.5,
        justifyContent: "center",
        mt: 1,
        px: 2,
      }}
    >
      {payload.map((entry, i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: entry.color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
            {entry.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
