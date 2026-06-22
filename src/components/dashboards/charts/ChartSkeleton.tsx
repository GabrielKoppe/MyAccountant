"use client";

import Skeleton from "@mui/material/Skeleton";
import Box from "@mui/material/Box";

type Props = {
  height?: number;
  width?: string | number;
};

export function ChartSkeleton({ height = 280, width = "100%" }: Props) {
  return (
    <Box sx={{ width, height, display: "flex", alignItems: "flex-end", gap: 0.5, px: 1, pb: 1 }}>
      {/* Simula barras de gráfico */}
      {[60, 80, 45, 90, 70, 55, 85, 65, 75, 50].map((h, i) => (
        <Skeleton
          key={i}
          variant="rectangular"
          width="100%"
          height={`${h}%`}
          sx={{ flexShrink: 0, borderRadius: 1 }}
        />
      ))}
    </Box>
  );
}
