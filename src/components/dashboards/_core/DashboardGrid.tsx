"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import { layout } from "@/lib/design-tokens";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";

// Altura base de cada linha da grade (px). Um widget de altura h ocupa h linhas,
// então seu footprint vertical é h * ROW_HEIGHT (+ gaps). Mantém o conteúdo
// proporcional ao tamanho declarado na grade, em vez de altura natural do conteúdo.
const ROW_HEIGHT = 120;

type Props = {
  widgets: StoredWidget[];
  nodeMap: Record<string, ReactNode>;
  cols: number; // sempre 6, mas recebido como prop para flexibilidade de teste
};

// Spec 36 §2.1/§7.5 — renderer de grade 2D.
// Desktop (md+): CSS Grid posicionado por coordenadas (x, y, w, h).
// Mobile (xs/sm): lista sequencial ordenada por y depois x (sem grade 2D).
export function DashboardGrid({ widgets, nodeMap, cols }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const visibleWidgets = widgets.filter((w) => w.visible);

  if (isMobile) {
    // Ordena por y depois x — mantém a ordem lógica do layout
    const sorted = [...visibleWidgets].sort((a, b) => a.y - b.y || a.x - b.x);
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {sorted.map((w) => (
          <Box key={w.instanceId}>{nodeMap[w.instanceId] ?? null}</Box>
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridAutoRows: `${ROW_HEIGHT}px`,
        gap: layout.page,
      }}
    >
      {visibleWidgets.map((w) => (
        <Box
          key={w.instanceId}
          sx={{
            minWidth: 0,
            minHeight: 0,
            gridColumn: `${w.x + 1} / span ${w.w}`,
            gridRow: `${w.y + 1} / span ${w.h}`,
          }}
        >
          {nodeMap[w.instanceId] ?? null}
        </Box>
      ))}
    </Box>
  );
}
