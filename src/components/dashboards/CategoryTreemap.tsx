"use client";

import { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import type { TreemapCategory } from "@/lib/queries/dashboards";

type Props = {
  categories: TreemapCategory[];
  onDrillDown?: (transactionIds: string[], label: string) => void;
};

type TreemapNode = {
  name: string;
  value: number;
  categoryId?: string;
  subcategoryId?: string | null;
  totalCents: string;
  transactionIds?: string[];
  fill?: string;
};

function CustomCell(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  totalCents?: string;
  fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, totalCents, fill } = props;
  const theme = useTheme();
  // Separator uses the canvas background color for a clean flush look
  const separator = theme.palette.background.default;

  if (width < 20 || height < 20) return null;

  const showLabel = width > 48 && height > 26;
  const showValue = width > 68 && height > 48;

  // Dynamic font size: smaller cells get smaller text
  const labelSize = Math.min(13, Math.max(9, width / 9));
  const valueSize = Math.min(11, Math.max(8, width / 12));

  return (
    <g style={{ cursor: "pointer" }}>
      <rect
        x={x + 1}
        y={y + 1}
        width={width - 2}
        height={height - 2}
        style={{ fill: fill ?? theme.palette.surface.subtle, stroke: separator, strokeWidth: 2 }}
        rx={4}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showValue ? 9 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fill: "rgba(255,255,255,0.92)",
            fontSize: labelSize,
            fontWeight: 600,
            fontFamily: theme.typography.fontFamily,
            pointerEvents: "none",
          }}
        >
          {name && name.length > 16 ? name.slice(0, 15) + "…" : name}
        </text>
      )}
      {showValue && totalCents && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 11}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fill: "rgba(255,255,255,0.72)",
            fontSize: valueSize,
            fontFamily: "'JetBrains Mono', monospace",
            pointerEvents: "none",
          }}
        >
          {formatCentsToBrl(BigInt(totalCents))}
        </text>
      )}
    </g>
  );
}

export function CategoryTreemap({ categories, onDrillDown }: Props) {
  const [drillCategoryId, setDrillCategoryId] = useState<string | null>(null);
  const theme = useTheme();
  const chartPalette = getChartColors(theme.palette.mode as "light" | "dark");

  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c, i) => m.set(c.categoryId, chartPalette[i % chartPalette.length]));
    return m;
  }, [categories, chartPalette]);

  const rootData: TreemapNode[] = useMemo(
    () =>
      categories.map((c) => ({
        name: c.name,
        value: Number(BigInt(c.totalCents)) / 100,
        categoryId: c.categoryId,
        totalCents: c.totalCents,
        fill: colorMap.get(c.categoryId),
      })),
    [categories, colorMap],
  );

  const drilledCategory = categories.find((c) => c.categoryId === drillCategoryId);
  const drillData: TreemapNode[] = useMemo(() => {
    if (!drilledCategory) return [];
    return drilledCategory.children.map((child, i) => ({
      name: child.name,
      value: Number(BigInt(child.totalCents)) / 100,
      subcategoryId: child.subcategoryId,
      totalCents: child.totalCents,
      transactionIds: child.transactionIds,
      fill: chartPalette[i % chartPalette.length],
    }));
  }, [drilledCategory, chartPalette]);

  const data = drillCategoryId ? drillData : rootData;

  if (categories.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sem categorias registradas neste mês.
      </Typography>
    );
  }

  function handleCellClick(node: TreemapNode) {
    if (!drillCategoryId && node.categoryId) {
      const cat = categories.find((c) => c.categoryId === node.categoryId);
      if (cat && cat.children.length > 0) {
        setDrillCategoryId(node.categoryId);
      }
    } else if (drillCategoryId && node.transactionIds) {
      onDrillDown?.(node.transactionIds, `${drilledCategory?.name} › ${node.name}`);
    }
  }

  return (
    <Box>
      {drillCategoryId && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => setDrillCategoryId(null)}
            variant="text"
            sx={{ fontSize: 12, color: "text.secondary" }}
          >
            Todas as categorias
          </Button>
          <Chip
            label={drilledCategory?.name}
            size="small"
            sx={{
              bgcolor: colorMap.get(drillCategoryId),
              color: "rgba(255,255,255,0.92)",
              fontSize: 11,
              fontWeight: 500,
            }}
          />
        </Box>
      )}

      <ResponsiveContainer width="100%" height={280}>
        <Treemap
          data={data}
          dataKey="value"
          aspectRatio={4 / 3}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(nodeData: any) => handleCellClick(nodeData as TreemapNode)}
          content={<CustomCell />}
        >
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const node = (payload[0] as any)?.payload as TreemapNode | undefined;
              if (!node) return null;
              return (
                <Box
                  sx={{
                    bgcolor: "background.paper",
                    border: 1,
                    borderColor: "border.subtle",
                    borderRadius: "8px",
                    px: 3,
                    py: 2,
                    boxShadow: 3,
                    pointerEvents: "none",
                  }}
                >
                  <Typography variant="caption" fontWeight={600} display="block" color="text.primary">
                    {node.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    display="block"
                    sx={{
                      fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                      fontWeight: 500,
                      color: "text.primary",
                      mt: 0.25,
                    }}
                  >
                    {formatCentsToBrl(BigInt(node.totalCents))}
                  </Typography>
                  {!drillCategoryId && node.categoryId && (
                    <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
                      Clique para ver subcategorias
                    </Typography>
                  )}
                </Box>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>

      {!drillCategoryId && (
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem" }}>
          Clique em uma categoria para ver subcategorias
        </Typography>
      )}
    </Box>
  );
}
