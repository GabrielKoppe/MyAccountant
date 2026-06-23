"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import type { SandboxConfig } from "@/lib/schemas/sandbox";
import { sandboxConfigSchema } from "@/lib/schemas/sandbox";
import type { SerializedSandboxResult } from "@/server/queries/sandbox";
import { deserializeSandboxResult } from "@/server/queries/sandbox";
import { WIDGET_REGISTRY } from "@/components/dashboards/_core/widget-registry";
import { SandboxChart } from "@/components/dashboards/sandbox/SandboxChart";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { m } from "@/lib/messages";

// Resolve o renderMode a partir do sizeVariantId usando as variantes do registry.
function resolveRenderMode(sizeVariantId: string): "compact" | "default" | "expanded" {
  const def = WIDGET_REGISTRY.monthly.find((d) => d.id === "analysis");
  const mode = def?.sizeVariants.find((v) => v.id === sizeVariantId)?.renderMode;
  if (mode === "compact" || mode === "expanded") return mode;
  return "default";
}

// Gera um nome legível e natural a partir das configurações da análise.
function buildSubtitle(config: SandboxConfig): string {
  const ms = m.dashboards.sandbox.controls;

  const metricLabels: Record<string, string> = {
    total: "Total",
    income: "Entradas",
    expense: "Despesas",
    count: "Qtd. transações",
    avg: "Média",
  };
  const groupLabels: Record<string, string> = {
    month: "mês a mês",
    section: "por seção",
    category: "por categoria",
    institution: "por instituição",
    table_type: "por tipo de tabela",
  };
  const seriesLabels: Record<string, string> = {
    section: "por seção",
    category: "por categoria",
    member: "por membro",
    institution: "por instituição",
    table_type: "por tipo de tabela",
  };
  const chartLabels: Record<string, string> = {
    bar_grouped: "em barras",
    bar_stacked: "em barras empilhadas",
    line: "em linhas",
    area: "em área",
    pie: "em pizza",
    donut: "em rosca",
  };
  const periodLabels: Record<string, string> = {
    current_month: ms.periodCurrentMonth,
    last_3_months: ms.periodLast3,
    last_6_months: ms.periodLast6,
    year: config.year != null ? String(config.year) : "ano atual",
    months: ms.period,
  };

  const metric = metricLabels[config.metric] ?? config.metric;
  const group = groupLabels[config.groupBy] ?? config.groupBy;
  const chart = chartLabels[config.chartType] ?? config.chartType;
  const period = periodLabels[config.periodType] ?? config.periodType;

  const seriesPart =
    config.seriesBy && config.seriesBy !== "none"
      ? ` ${seriesLabels[config.seriesBy] ?? config.seriesBy}`
      : "";

  const filterCount =
    (config.filterSectionIds?.length ?? 0) +
    (config.filterCategoryIds?.length ?? 0) +
    (config.filterMemberIds?.length ?? 0);
  const filterPart = filterCount > 0 ? ` · ${filterCount} filtro${filterCount > 1 ? "s" : ""}` : "";

  // Ex: "Despesas por categoria por membro em barras (mês atual) · 2 filtros"
  return `${metric} ${group}${seriesPart} ${chart} (${period})${filterPart}`;
}

// Mensagem inline para estados sem dados — sem o componente EmptyState (tipografia muito grande).
function InlineMessage({ text }: { text: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        minHeight: 48,
      }}
    >
      <Typography variant="caption" color="text.disabled" textAlign="center">
        {text}
      </Typography>
    </Box>
  );
}

export type AnalysisWidgetProps = {
  // Config bruta do StoredWidget — parseada internamente.
  rawConfig: unknown;
  // Dados pré-calculados no RSC e serializados (BigInt → string) para a fronteira RSC→Client.
  data: SerializedSandboxResult | null;
  // Id da variante de tamanho ativa — renderMode resolvido internamente.
  sizeVariantId: string;
};

export function AnalysisWidget({ rawConfig, data, sizeVariantId }: AnalysisWidgetProps) {
  const renderMode = resolveRenderMode(sizeVariantId);
  const parsed = sandboxConfigSchema.safeParse(rawConfig);
  const subtitle = parsed.success ? buildSubtitle(parsed.data) : "—";

  return (
    <WidgetContainer
      title={(m.dashboards.widgets.monthly as Record<string, string>)["analysis"] ?? "Análise"}
      subtitle={subtitle}
      icon={WIDGET_ICONS["analysis"]}
      contentSx={{ px: 0, pb: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {!parsed.success ? (
        <InlineMessage text="Configure este widget nas configurações do dashboard" />
      ) : !data || data.rows.length === 0 ? (
        <InlineMessage text="Sem dados para a configuração escolhida" />
      ) : (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <SandboxChart
            result={deserializeSandboxResult(data)}
            config={parsed.data}
            height="100%"
            showLegend={renderMode !== "compact"}
          />
        </Box>
      )}
    </WidgetContainer>
  );
}
