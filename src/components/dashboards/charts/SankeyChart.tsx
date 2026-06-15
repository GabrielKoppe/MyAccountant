"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { ResponsiveSankey } from "@nivo/sankey";
import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import type { SankeyData } from "@/lib/queries/dashboards";

type Props = {
  data: SankeyData;
};

// Tooltip inline para não depender do ThemeProvider dentro do @nivo portal
function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(20,20,20,0.88)",
        color: "#fff",
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 12,
        lineHeight: 1.5,
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );
}

export function SankeyChart({ data }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const chartPalette = getChartColors(theme.palette.mode as "light" | "dark");

  if (data.nodes.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sem entradas registradas neste mês.
      </Typography>
    );
  }

  const nivoData = {
    nodes: data.nodes.map((n) => ({ id: n.id, label: n.label })),
    links: data.links.map((l) => ({ source: l.source, target: l.target, value: l.value })),
  };

  // Assign colors deterministically by node index using design system palette
  const nodeColorMap = new Map(
    data.nodes.map((n, i) => [n.id, chartPalette[i % chartPalette.length]]),
  );

  const chartHeight = Math.max(220, data.nodes.length * 38);

  return (
    <Box sx={{ height: "100%", minHeight: chartHeight, width: "100%" }}>
      <ResponsiveSankey
        data={nivoData}
        margin={{ top: 10, right: 160, bottom: 10, left: 10 }}
        align="justify"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        colors={(node: any) => nodeColorMap.get(node.id) ?? "#90a4ae"}
        nodeOpacity={0.95}
        nodeThickness={16}
        nodeInnerPadding={3}
        nodeSpacing={22}
        nodeBorderWidth={0}
        nodeBorderRadius={3}
        linkOpacity={isDark ? 0.3 : 0.4}
        linkHoverOpacity={0.7}
        linkBlendMode={isDark ? "screen" : "multiply"}
        enableLinkGradient
        labelPosition="outside"
        labelOrientation="horizontal"
        labelPadding={10}
        // Texto legível em ambos os modos
        labelTextColor={isDark ? "#e0e0e0" : "#333333"}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        label={(node: any) => node.label ?? node.id}
        nodeTooltip={({ node }) => (
          <TooltipBox>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <strong>{(node as any).label ?? node.id}</strong>
            <br />
            {formatCentsToBrl(BigInt(Math.round(node.value * 100)))}
          </TooltipBox>
        )}
        linkTooltip={({ link }) => (
          <TooltipBox>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(link.source as any).label ?? (link.source as any).id}
            {" → "}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(link.target as any).label ?? (link.target as any).id}
            <br />
            {formatCentsToBrl(BigInt(Math.round(link.value * 100)))}
          </TooltipBox>
        )}
      />
    </Box>
  );
}
