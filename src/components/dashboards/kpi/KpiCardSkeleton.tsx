"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";

type Props = {
  /** "wide" para variante 2×1 (KPI wide). Padrão: false (1×1). */
  wide?: boolean;
};

/**
 * Skeleton fiel ao shape do KpiCard:
 * - Paper outlined com mesmas bordas/radius
 * - Linha de overline (título)
 * - Valor grande
 * - Linha de subtítulo
 * - Sparkline mini opcional (variante wide)
 */
export function KpiCardSkeleton({ wide = false }: Props) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: "100%",
        minHeight: 80,
        display: "flex",
        flexDirection: wide ? "row" : "column",
        gap: wide ? 2 : 0.5,
        borderColor: "border.subtle",
        borderRadius: "12px",
        bgcolor: "background.paper",
      }}
    >
      {/* Coluna principal: título + valor + subtítulo */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
        {/* Título (overline) */}
        <Skeleton variant="text" width={80} height={14} />
        {/* Valor grande */}
        <Skeleton variant="text" width={120} height={32} />
        {/* Subtítulo */}
        <Skeleton variant="text" width={90} height={14} />
      </Box>

      {/* Sparkline — só na variante wide */}
      {wide && (
        <Box sx={{ width: 80, display: "flex", alignItems: "flex-end", gap: "2px", pb: 0.5 }}>
          {[55, 70, 45, 85, 60, 75].map((h, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              width="100%"
              height={`${h}%`}
              sx={{ borderRadius: 0.5 }}
            />
          ))}
        </Box>
      )}
    </Paper>
  );
}
