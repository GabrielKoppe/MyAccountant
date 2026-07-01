"use client";

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { formatCentsToBrl } from "@/lib/money";
import { getColors } from "@/lib/design-tokens";
import { AppLink } from "@/components/ui/AppLink";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { m } from "@/lib/messages";
import type { DayTotal } from "@/server/queries/dashboards";

type Props = {
  year: number;
  month: number; // 1-12
  dailyTotals: DayTotal[];
  colorBy?: "intensity" | "expense_type"; // Spec 41 Fase 14
  onDayClick?: (transactionIds: string[], day: number) => void;
  monthSummaryHref: string;
};

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay(); // 0=Sunday
}

// Gradiente Warm Calm: accent.primarySubtle → accent.primary (5 níveis)
const HEAT_COLORS_LIGHT = [
  "#F5F4F0", // 0 — vazio (background.subtle)
  "#EAEDFB", // 1 — accent.primarySubtle
  "#C5CBEF", // 2 — intermediário
  "#8B98E8", // 3 — intermediário
  "#4E5FD9", // 4 — accent.primary
] as const;

const HEAT_COLORS_DARK = [
  "#2A2620", // 0 — vazio (surface.subtle dark)
  "#252840", // 1 — accent.primarySubtle dark
  "#3A4070", // 2 — intermediário dark
  "#5C6CB8", // 3 — intermediário dark
  "#7E8DE5", // 4 — accent.primary dark
] as const;

function getHeatIndex(cents: bigint, maxCents: bigint): 0 | 1 | 2 | 3 | 4 {
  if (maxCents === 0n || cents === 0n) return 0;
  const ratio = Number(cents) / Number(maxCents);
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

export function DailyHeatmap({
  year,
  month,
  dailyTotals,
  colorBy = "intensity",
  onDayClick,
  monthSummaryHref,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const colors = getColors(theme.palette.mode as "light" | "dark");
  const heatColors = isDark ? HEAT_COLORS_DARK : HEAT_COLORS_LIGHT;
  // Cores semânticas para expenseType — derivadas do tema "Warm Calm"
  // (alternam light/dark automaticamente, sem hex hardcoded).
  const expenseTypeColors: Record<string, string> = {
    fixed: theme.palette.accent.primary, // compromisso fixo (azul)
    variable: theme.palette.success.main, // variável (verde)
    one_time: theme.palette.warning.main, // evento único (âmbar/mostarda)
    none: theme.palette.neutral.main, // sem tipo / não classificado (cinza)
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekday(year, month);

  const dayMap = useMemo(() => {
    const map = new Map<number, DayTotal>();
    for (const d of dailyTotals) map.set(d.day, d);
    return map;
  }, [dailyTotals]);

  const maxCents = useMemo(() => {
    return dailyTotals.reduce((max, d) => {
      const v = BigInt(d.absoluteCents);
      return v > max ? v : max;
    }, 0n);
  }, [dailyTotals]);

  const isEmpty = dailyTotals.length === 0;

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <WidgetContainer
      title={m.dashboards.sections.calendarHeatmap}
      icon={WIDGET_ICONS["daily-heatmap"]}
      contentSx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {isEmpty ? (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Nenhuma transação registrada nas seções de saída neste mês.
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
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
            width: "100%",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Cabeçalho dos dias da semana */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {WEEKDAY_LABELS.map((l, i) => (
              <Typography
                key={i}
                variant="caption"
                align="center"
                sx={{
                  fontSize: "0.6rem",
                  color: "text.disabled",
                  fontWeight: 500,
                  display: "block",
                }}
              >
                {l}
              </Typography>
            ))}
          </Box>

          {/* Células dos dias — fluidas: sem aspectRatio fixo, altura via fr */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              // Cada linha ocupa 1fr da altura disponível; as células se moldam
              // ao espaço sem forçar scroll.
              gridAutoRows: "1fr",
              gap: "3px",
              flex: 1,
              minHeight: 0,
            }}
          >
            {cells.map((day, i) => {
              if (!day) {
                return <Box key={`blank-${i}`} />;
              }

              const data = dayMap.get(day);
              const cents = data ? BigInt(data.absoluteCents) : 0n;
              const heatIdx = getHeatIndex(cents, maxCents);
              const hasData = !!data;

              let bgColor: string;
              let textColor: string;
              if (colorBy === "expense_type" && data?.dominantExpenseType) {
                bgColor = expenseTypeColors[data.dominantExpenseType] ?? heatColors[heatIdx];
                textColor = heatIdx >= 1 ? colors.text.inverse : colors.text.disabled;
              } else {
                bgColor = heatColors[heatIdx];
                textColor =
                  heatIdx >= 3
                    ? colors.text.inverse
                    : heatIdx >= 1
                      ? colors.text.tertiary
                      : colors.text.disabled;
              }

              return (
                <Tooltip
                  key={day}
                  title={
                    hasData ? (
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.tertiary"
                          display="block"
                          fontWeight={600}
                        >
                          Dia {day}
                        </Typography>
                        <Typography
                          variant="caption"
                          display="block"
                          color="text.tertiary"
                          sx={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}
                        >
                          {formatCentsToBrl(cents)}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.tertiary">
                          {data.transactionCount} transação(ões)
                        </Typography>
                      </Box>
                    ) : (
                      `Dia ${day} — sem gastos`
                    )
                  }
                  placement="top"
                  arrow
                >
                  <Box
                    onClick={() => hasData && onDayClick?.(data.transactionIds, day)}
                    sx={{
                      borderRadius: "3px",
                      bgcolor: bgColor,
                      cursor: hasData && onDayClick ? "pointer" : "default",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "opacity 120ms, outline 120ms",
                      minHeight: 0,
                      "&:hover": hasData
                        ? {
                            opacity: 0.82,
                            outline: "1.5px solid",
                            outlineColor: "accent.primary",
                            outlineOffset: "1px",
                          }
                        : {},
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "0.55rem",
                        color: textColor,
                        lineHeight: 1,
                        userSelect: "none",
                        fontWeight: heatIdx >= 1 ? 500 : 400,
                      }}
                    >
                      {day}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>

          {/* Legenda */}
          {colorBy === "expense_type" ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              {[
                { key: "fixed", label: "Fixo" },
                { key: "variable", label: "Variável" },
                { key: "one_time", label: "Único" },
                { key: "none", label: "Sem tipo" },
              ].map(({ key, label }) => (
                <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 11,
                      height: 11,
                      borderRadius: "2px",
                      bgcolor: expenseTypeColors[key],
                    }}
                  />
                  <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6rem" }}>
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6rem" }}>
                Menos
              </Typography>
              {heatColors.map((c, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 11,
                    height: 11,
                    borderRadius: "2px",
                    bgcolor: c,
                    border: "1px solid",
                    borderColor: "border.subtle",
                  }}
                />
              ))}
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6rem" }}>
                Mais
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </WidgetContainer>
  );
}
