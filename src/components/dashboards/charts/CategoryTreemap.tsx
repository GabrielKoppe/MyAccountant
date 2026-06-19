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
import { m } from "@/lib/messages";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import type { TreemapCategory } from "@/lib/queries/dashboards";
import type { TreemapConfig } from "@/lib/schemas/widget-config";

type Props = {
  categories: TreemapCategory[];
  config?: TreemapConfig;
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

export function CategoryTreemap({ categories, config, onDrillDown }: Props) {
  const [drillCategoryId, setDrillCategoryId] = useState<string | null>(null);
  const theme = useTheme();
  const chartPalette = getChartColors(theme.palette.mode as "light" | "dark");

  const topN = config?.topN ?? "all";
  const shown = topN === "all" ? categories : categories.slice(0, topN);

  const subtitle = topN === "all" ? undefined : `Top ${topN}`;

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    shown.forEach((c, i) => map.set(c.categoryId, chartPalette[i % chartPalette.length]));
    return map;
  }, [shown, chartPalette]);

  const rootData: TreemapNode[] = useMemo(
    () =>
      shown.map((c) => ({
        name: c.name,
        value: Number(BigInt(c.totalCents)) / 100,
        categoryId: c.categoryId,
        totalCents: c.totalCents,
        fill: colorMap.get(c.categoryId),
      })),
    [shown, colorMap],
  );

  const drilledCategory = shown.find((c) => c.categoryId === drillCategoryId);
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

  function handleCellClick(node: TreemapNode) {
    if (!drillCategoryId && node.categoryId) {
      const cat = shown.find((c) => c.categoryId === node.categoryId);
      if (cat && cat.children.length > 0) {
        setDrillCategoryId(node.categoryId);
      }
    } else if (drillCategoryId && node.transactionIds) {
      onDrillDown?.(node.transactionIds, `${drilledCategory?.name} › ${node.name}`);
    }
  }

  // Controles de drill-down no slot secondary do header
  const drillControls = drillCategoryId ? (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Button
        size="small"
        startIcon={<ArrowBackIcon sx={{ fontSize: 14, mr: -1.5 }} />}
        onClick={() => setDrillCategoryId(null)}
        variant="text"
        sx={{ fontSize: "0.7rem", color: "text.secondary", minWidth: 0, px: 1, py: 0.25 }}
      >
        Todas
      </Button>
      <Chip
        label={drilledCategory?.name}
        size="small"
        sx={{
          bgcolor: colorMap.get(drillCategoryId),
          color: "rgba(255,255,255,0.92)",
          fontSize: 11,
          fontWeight: 500,
          height: 20,
        }}
      />
    </Box>
  ) : undefined;

  return (
    <WidgetContainer
      title={m.dashboards.sections.categoryTreemap}
      icon={WIDGET_ICONS["category-treemap"]}
      subtitle={subtitle}
      secondary={drillControls}
      contentSx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {categories.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Sem categorias registradas neste mês.
        </Typography>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <ResponsiveContainer width="100%" height="100%" minHeight={140}>
            <Treemap
              data={data}
              dataKey="value"
              aspectRatio={4 / 3}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={(nodeData: any) => handleCellClick(nodeData as TreemapNode)}
              content={<CustomCell />}
            >
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload }: any) => {
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
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        display="block"
                        color="text.primary"
                      >
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
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          display="block"
                          sx={{ mt: 0.5 }}
                        >
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
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ fontSize: "0.65rem", mt: 0.5 }}
            >
              Clique em uma categoria para ver subcategorias
            </Typography>
          )}
        </Box>
      )}
    </WidgetContainer>
  );
}
