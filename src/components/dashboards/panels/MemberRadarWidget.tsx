"use client";

import { useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import FilterListIcon from "@mui/icons-material/FilterList";
import { useTheme } from "@mui/material/styles";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

import { formatCentsToBrl } from "@/lib/money";
import { getChartColors } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import {
  buildMemberColorMap,
  memberDisplayName,
} from "@/components/dashboards/_shared/member-display";
import type { MemberBreakdownRow } from "@/server/queries/member-analytics";

type RenderMode = "compact" | "default";

type Props = {
  rows: MemberBreakdownRow[];
  renderMode?: RenderMode;
};

function rowKey(r: MemberBreakdownRow): string {
  return r.userId ?? "unassigned";
}

// Trunca nomes longos para os eixos do radar
function truncateCat(name: string, maxLen: number): string {
  return name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
}

// ─────────────────────────────────────────────────────────────────────────────

export function MemberRadarWidget({ rows, renderMode = "default" }: Props) {
  const theme = useTheme();
  const palette = getChartColors(theme.palette.mode as "light" | "dark");
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const spenders = useMemo(() => rows.filter((r) => BigInt(r.totalCents) > 0n), [rows]);

  // IDs de todos os membros com despesa — inicializa com todos selecionados
  const allKeys = useMemo(() => spenders.map(rowKey), [spenders]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set(allKeys));

  // Sincroniza quando spenders mudam (ex: mês diferente)
  const validSelected = useMemo(
    () => new Set(allKeys.filter((k) => selectedKeys.has(k))),
    [allKeys, selectedKeys],
  );

  const colorMap = useMemo(() => buildMemberColorMap(allKeys, palette), [allKeys, palette]);

  // Membros selecionados e com despesa
  const selectedRows = useMemo(
    () => spenders.filter((r) => validSelected.has(rowKey(r))),
    [spenders, validSelected],
  );

  // Top N categorias por total de gastos entre os membros selecionados
  const maxCats = renderMode === "compact" ? 6 : 9;
  const radarData = useMemo(() => {
    // Soma total de cada categoria (para ordenar)
    const catTotals = new Map<string, number>();
    for (const row of selectedRows) {
      for (const cat of row.categories) {
        catTotals.set(cat.name, (catTotals.get(cat.name) ?? 0) + Number(BigInt(cat.cents)));
      }
    }

    const topCats = [...catTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxCats)
      .map(([name]) => name);

    return topCats.map((catName) => {
      const entry: Record<string, string | number> = {
        category: catName,
        _fullName: catName,
      };
      for (const row of selectedRows) {
        const cat = row.categories.find((c) => c.name === catName);
        entry[rowKey(row)] = cat ? Number(BigInt(cat.cents)) / 100 : 0;
      }
      return entry;
    });
  }, [selectedRows, maxCats]);

  // Toggle seleção de membro (garante ao menos 1 selecionado)
  function toggleKey(key: string) {
    setSelectedKeys((prev) => {
      if (prev.has(key)) {
        if (prev.size <= 1) return prev; // mantém pelo menos 1
        const next = new Set(prev);
        next.delete(key);
        return next;
      }
      return new Set([...prev, key]);
    });
  }

  function toggleAll() {
    setSelectedKeys((prev) =>
      prev.size === allKeys.length ? new Set([allKeys[0]]) : new Set(allKeys),
    );
  }

  if (spenders.length === 0) return null;

  const isCompact = renderMode === "compact";
  const chartHeight = isCompact ? 220 : 340;
  const catLabelLen = isCompact ? 10 : 14;
  const showLegend = !isCompact && selectedRows.length > 1;

  // Botão de filtro de membros (slot secondary do WidgetContainer)
  const filterButton = (
    <>
      <MuiTooltip title="Filtrar membros">
        <IconButton
          ref={anchorRef}
          size="small"
          onClick={() => setPopoverOpen(true)}
          color={validSelected.size < allKeys.length ? "primary" : "default"}
          sx={{ p: 0.5 }}
        >
          <FilterListIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </MuiTooltip>

      <Popover
        open={popoverOpen}
        anchorEl={anchorRef.current}
        onClose={() => setPopoverOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 180, p: 1.5 } } }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 0.5, display: "block", mb: 0.5 }}
        >
          Exibir membros
        </Typography>
        <Divider sx={{ mb: 0.75 }} />

        {/* Selecionar todos */}
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={validSelected.size === allKeys.length}
              indeterminate={validSelected.size > 0 && validSelected.size < allKeys.length}
              onChange={toggleAll}
              sx={{ py: 0.25 }}
            />
          }
          label={
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              Todos
            </Typography>
          }
          sx={{ mx: 0, display: "flex" }}
        />

        <Divider sx={{ my: 0.5 }} />

        {/* Um checkbox por membro */}
        <Stack spacing={0}>
          {spenders.map((r) => {
            const key = rowKey(r);
            const color = colorMap.get(key) ?? palette[0];
            const checked = validSelected.has(key);
            return (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    size="small"
                    checked={checked}
                    onChange={() => toggleKey(key)}
                    disabled={checked && validSelected.size === 1}
                    sx={{ py: 0.25, color, "&.Mui-checked": { color } }}
                  />
                }
                label={
                  <Typography variant="caption" noWrap sx={{ maxWidth: 140 }}>
                    {memberDisplayName(r.name, r.isFormerMember)}
                  </Typography>
                }
                sx={{ mx: 0, display: "flex" }}
              />
            );
          })}
        </Stack>
      </Popover>
    </>
  );

  return (
    <WidgetContainer
      title={m.dashboards.sections.memberRadar}
      icon={WIDGET_ICONS["member-radar"]}
      secondary={filterButton}
      contentSx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {radarData.length === 0 ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Sem dados de categoria para exibir.
          </Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <RadarChart data={radarData} margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
            <PolarGrid stroke={theme.palette.divider} />
            <PolarAngleAxis
              dataKey="category"
              tick={({ payload, x, y, cx, cy, ...rest }: any) => {
                const label = truncateCat(String(payload.value), catLabelLen);
                const anchor = x > cx + 1 ? "start" : x < cx - 1 ? "end" : "middle";
                return (
                  <text
                    {...rest}
                    x={x}
                    y={y}
                    textAnchor={anchor}
                    fill={theme.palette.text.secondary}
                    fontSize={isCompact ? 10 : 11}
                    dy={4}
                  >
                    {label}
                  </text>
                );
              }}
            />
            {!isCompact && (
              <PolarRadiusAxis
                tick={{ fontSize: 9, fill: theme.palette.text.disabled }}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v.toFixed(0)}`
                }
                axisLine={false}
              />
            )}
            {selectedRows.map((row) => {
              const key = rowKey(row);
              const color = colorMap.get(key) ?? palette[0];
              return (
                <Radar
                  key={key}
                  name={memberDisplayName(row.name, row.isFormerMember)}
                  dataKey={key}
                  stroke={color}
                  fill={color}
                  fillOpacity={selectedRows.length === 1 ? 0.25 : 0.12}
                  strokeWidth={isCompact ? 1.5 : 2}
                  dot={false}
                />
              );
            })}
            <RechartsTooltip
              content={(props: any) => {
                if (!props.active || !props.payload?.length) return null;
                const catName = String(props.payload[0]?.payload?._fullName ?? "");
                return (
                  <Box
                    sx={{
                      bgcolor: "background.paper",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 1.25,
                      boxShadow: 2,
                      maxWidth: 220,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mb: 0.5, fontWeight: 500 }}
                    >
                      {catName}
                    </Typography>
                    <Stack spacing={0.25}>
                      {props.payload.map((entry: any) => (
                        <Box
                          key={entry.dataKey}
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Box
                            component="span"
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              bgcolor: entry.color,
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ flex: 1 }}
                          >
                            {entry.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: "var(--font-jetbrains-mono), monospace",
                              fontVariantNumeric: "tabular-nums",
                              ml: 1,
                              flexShrink: 0,
                            }}
                          >
                            {formatCentsToBrl(BigInt(Math.round(entry.value * 100)))}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                );
              }}
            />
            {showLegend && (
              <Legend
                iconSize={8}
                iconType="circle"
                formatter={(value: string) => (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {value}
                  </Typography>
                )}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      )}
    </WidgetContainer>
  );
}
