"use client";

import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import type { ThemeMode } from "@/lib/design-tokens";
import type { SandboxConfig, SandboxMetric } from "@/lib/schemas/sandbox";
import type { SandboxResult } from "@/lib/queries/sandbox";
import { ChartTooltip } from "@/components/dashboards/ChartTooltip";

type Props = {
  result: SandboxResult;
  config: SandboxConfig;
  height?: number;
  showLegend?: boolean;
};

function formatValue(v: number, metric: SandboxMetric): string {
  if (metric === "count") return v.toFixed(0);
  try {
    return formatCentsToBrl(BigInt(Math.round(v * 100)));
  } catch {
    return v.toFixed(2);
  }
}

function shortLabel(label: string, maxLen = 12): string {
  return label.length > maxLen ? label.slice(0, maxLen - 1) + "…" : label;
}

function fmtShort(v: number, metric: SandboxMetric): string {
  if (metric === "count") return v.toFixed(0);
  const abs = Math.abs(v);
  if (abs >= 10000) return `R$${(v / 1000).toFixed(0)}k`;
  if (abs >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
  return formatCentsToBrl(BigInt(Math.round(v * 100)));
}

const LEGEND_STYLE = { fontSize: 11, lineHeight: "18px" };
const TICK_STYLE = { fontSize: 10 };

export function SandboxChart({ result, config, height = 320, showLegend = true }: Props) {
  const theme = useTheme();
  const colors = getChartColors(theme.palette.mode as ThemeMode);

  if (result.rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        Sem dados para a configuração selecionada.
      </Typography>
    );
  }

  const { rows, series } = result;

  const fmtVal = (v: number) => formatValue(v, config.metric);
  const yTickFmt = (v: number) => fmtShort(v, config.metric);

  // Custom tooltip: uses ChartTooltip design system, filters zero-value entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SandboxTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const visible = payload.filter((e: any) => e.value !== 0 && e.value != null);
    if (!visible.length) return null;
    return (
      <ChartTooltip
        active
        payload={visible}
        label={label}
        formatValue={fmtVal}
      />
    );
  };

  // Pie / donut — no inline labels, rely on legend
  if (config.chartType === "pie" || config.chartType === "donut") {
    const pieData = rows.map((r) => ({
      name: r.xLabel as string,
      value: (r["total"] as number) ?? 0,
    }));
    const total = pieData.reduce((s, d) => s + d.value, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PieTooltip = ({ active, payload }: any) => {
      if (!active || !payload?.length) return null;
      const entry = payload[0];
      const val: number = entry?.value ?? 0;
      const pct = total > 0 ? ((Math.abs(val) / Math.abs(total)) * 100).toFixed(1) : "0";
      return (
        <ChartTooltip
          active
          payload={[{ ...entry, value: val }]}
          label={entry?.name}
          formatValue={(v) => `${fmtVal(v)} (${pct}%)`}
          hideName
        />
      );
    };

    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            innerRadius={config.chartType === "donut" ? "40%" : 0}
            outerRadius="65%"
            paddingAngle={1}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={PieTooltip} />
          {showLegend && (
            <Legend
              wrapperStyle={LEGEND_STYLE}
              formatter={(v) => shortLabel(String(v), 20)}
              iconSize={10}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // Line chart
  if (config.chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis
            dataKey="xLabel"
            tick={{ ...TICK_STYLE, fill: theme.palette.text.secondary }}
            tickFormatter={(v) => shortLabel(String(v))}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ ...TICK_STYLE, fill: theme.palette.text.secondary }}
            tickFormatter={yTickFmt}
            width={56}
          />
          <Tooltip content={SandboxTooltip} />
          {showLegend && (
            <Legend
              wrapperStyle={LEGEND_STYLE}
              formatter={(v) => shortLabel(String(v), 18)}
              iconSize={10}
            />
          )}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Area chart
  if (config.chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rows} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis
            dataKey="xLabel"
            tick={{ ...TICK_STYLE, fill: theme.palette.text.secondary }}
            tickFormatter={(v) => shortLabel(String(v))}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ ...TICK_STYLE, fill: theme.palette.text.secondary }}
            tickFormatter={yTickFmt}
            width={56}
          />
          <Tooltip content={SandboxTooltip} />
          {showLegend && (
            <Legend
              wrapperStyle={LEGEND_STYLE}
              formatter={(v) => shortLabel(String(v), 18)}
              iconSize={10}
            />
          )}
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stackId="stack"
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.45}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Bar grouped / stacked (default)
  const isStacked = config.chartType === "bar_stacked";
  // Use vertical layout when grouping by section/category with more than 5 items
  const isVertical = config.groupBy !== "month" && rows.length > 5;

  if (isVertical) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(height, rows.length * 28 + 60)}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={false} />
          <XAxis
            type="number"
            tick={{ ...TICK_STYLE, fill: theme.palette.text.secondary }}
            tickFormatter={yTickFmt}
          />
          <YAxis
            type="category"
            dataKey="xLabel"
            width={90}
            tick={{ ...TICK_STYLE, fill: theme.palette.text.secondary }}
            tickFormatter={(v) => shortLabel(String(v), 13)}
          />
          <Tooltip content={SandboxTooltip} />
          {showLegend && series.length > 1 && (
            <Legend
              wrapperStyle={LEGEND_STYLE}
              formatter={(v) => shortLabel(String(v), 18)}
              iconSize={10}
            />
          )}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={isStacked ? "stack" : undefined}
              fill={colors[i % colors.length]}
              maxBarSize={20}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
        <XAxis
          dataKey="xLabel"
          tick={{ ...TICK_STYLE, fill: theme.palette.text.secondary }}
          tickFormatter={(v) => shortLabel(String(v))}
          interval={rows.length > 8 ? "preserveStartEnd" : 0}
        />
        <YAxis
          tick={{ ...TICK_STYLE, fill: theme.palette.text.secondary }}
          tickFormatter={yTickFmt}
          width={56}
        />
        <Tooltip content={SandboxTooltip} />
        {showLegend && series.length > 1 && (
          <Legend
            wrapperStyle={LEGEND_STYLE}
            formatter={(v) => shortLabel(String(v), 18)}
            iconSize={10}
          />
        )}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId={isStacked ? "stack" : undefined}
            fill={colors[i % colors.length]}
            radius={isStacked ? undefined : [2, 2, 0, 0]}
            maxBarSize={36}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
