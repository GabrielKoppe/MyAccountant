"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { ResponsiveSankey } from "@nivo/sankey";
import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import { AppLink } from "@/components/ui/AppLink";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { m } from "@/lib/messages";
import type { SankeyData } from "@/server/queries/dashboards";

type Props = {
  data: SankeyData;
  monthSummaryHref: string;
  renderMode?: string; // "default" | "compact"
};

// Tooltip inline para não depender do ThemeProvider dentro do @nivo portal
// EXCEÇÃO: style inline necessário pois @nivo renderiza fora do contexto MUI
function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(20,20,20,0.88)",
        color: "#fff", // texto sobre fundo escuro — token text.inverse
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 12,
        lineHeight: 1.5,
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        pointerEvents: "none",
        width: "max-content",
        maxWidth: 256,
      }}
    >
      {children}
    </div>
  );
}

export function SankeyChart({ data, monthSummaryHref, renderMode = "default" }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const chartPalette = getChartColors(theme.palette.mode as "light" | "dark");

  const isEmpty = data.nodes.length === 0;
  const isCompact = renderMode === "compact";

  // Em compact (3×3) a margem direita menor dá mais espaço ao gráfico.
  const marginRight = isCompact ? 90 : 150;
  const nodeSpacing = isCompact ? 14 : 20;
  const nodeThickness = isCompact ? 12 : 16;

  const nivoData = isEmpty
    ? { nodes: [], links: [] }
    : {
        nodes: data.nodes.map((n) => ({ id: n.id, label: n.label })),
        links: data.links.map((l) => ({ source: l.source, target: l.target, value: l.value })),
      };

  const nodeColorMap = new Map(
    data.nodes.map((n, i) => [n.id, chartPalette[i % chartPalette.length]]),
  );

  return (
    <WidgetContainer
      title={m.dashboards.sections.moneyFlow}
      icon={WIDGET_ICONS["money-flow"]}
      sx={{ overflow: "visible" }}
      contentSx={{ overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      {isEmpty ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Sem entradas suficientes para montar o fluxo.
          </Typography>
          <Button
            component={AppLink}
            href={monthSummaryHref}
            size="small"
            variant="text"
            sx={{ color: "text.tertiary", fontSize: "0.75rem", p: 0, minWidth: 0 }}
          >
            Ver resumo do mês
          </Button>
        </Box>
      ) : (
        // flex: 1 + minHeight: 0 preenche o espaço disponível sem forçar altura
        // mínima que ultrapasse a célula da grade e corte widgets abaixo.
        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          <ResponsiveSankey
            data={nivoData}
            margin={{ top: 8, right: marginRight, bottom: 8, left: 8 }}
            align="justify"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            colors={(node: any) => nodeColorMap.get(node.id) ?? "#90a4ae"}
            nodeOpacity={0.95}
            nodeThickness={nodeThickness}
            nodeInnerPadding={3}
            nodeSpacing={nodeSpacing}
            nodeBorderWidth={0}
            nodeBorderRadius={3}
            linkOpacity={isDark ? 0.3 : 0.4}
            linkHoverOpacity={0.7}
            linkBlendMode={isDark ? "screen" : "multiply"}
            enableLinkGradient
            labelPosition="outside"
            labelOrientation="horizontal"
            labelPadding={8}
            // EXCEÇÃO: labelTextColor é prop do @nivo — não aceita tokens MUI
            // Equivalentes: text.secondary light (#4A453C) / dark (#C4BDB0)
            labelTextColor={isDark ? "#e0e0e0" : "#333333"}
            label={(node: any) => node.label ?? node.id}
            nodeTooltip={({ node }: { node: any }) => (
              <TooltipBox>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <strong>{(node as any).label ?? node.id}</strong>
                <br />
                {formatCentsToBrl(BigInt(Math.round(node.value * 100)))}
              </TooltipBox>
            )}
            linkTooltip={({ link }: { link: any }) => (
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
      )}
    </WidgetContainer>
  );
}
