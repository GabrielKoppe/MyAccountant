"use client";

import SettingsIcon from "@mui/icons-material/Settings";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import { LazyCashflowForecastChart } from "@/components/dashboards/charts/lazy";
import { AppLink } from "@/components/ui/AppLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageInfoButton } from "@/components/ui/PageInfoButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import { SCENARIOS, type Scenario } from "@/lib/schemas/forecast";
import type { CashflowForecast } from "@/server/queries/cashflow-forecast";

type Props = {
  accountId: string;
  forecast: CashflowForecast;
};

type ScenarioBalanceKey =
  | "optimisticBalanceCents"
  | "realisticBalanceCents"
  | "conservativeBalanceCents";

// Duplicado de `SCENARIO_BALANCE_KEY` / `deriveRunwayTrough`
// (`charts/CashflowForecastChart.tsx`) — aquele módulo importa `recharts` no
// top-level, então importar qualquer export dele aqui furaria o
// code-splitting (convenção `charts/lazy.tsx`: recharts só via dynamic
// import). Mesma lógica; se mudar lá, replicar aqui.
const SCENARIO_BALANCE_KEY: Record<Scenario, ScenarioBalanceKey> = {
  optimistic: "optimisticBalanceCents",
  realistic: "realisticBalanceCents",
  conservative: "conservativeBalanceCents",
};

function deriveRunwayTrough(
  points: CashflowForecast["points"],
  balanceKey: ScenarioBalanceKey,
): { runwayYearMonth: string | null; troughYearMonth: string; troughBalanceCents: string } {
  const projectedPoints = points.filter((p) => p.isProjected);

  let runwayYearMonth: string | null = null;
  let troughYearMonth = "";
  let troughBalanceCents = 0n;

  projectedPoints.forEach((p, i) => {
    const balance = BigInt(p[balanceKey]);
    if (runwayYearMonth === null && balance < 0n) runwayYearMonth = p.yearMonth;
    if (i === 0 || balance < troughBalanceCents) {
      troughBalanceCents = balance;
      troughYearMonth = p.yearMonth;
    }
  });

  return { runwayYearMonth, troughYearMonth, troughBalanceCents: troughBalanceCents.toString() };
}

/**
 * Hero da Previsão de Fluxo de Caixa (spec 48, Task 8). Vista "a partir de
 * hoje" — não depende de [year]/[monthId], apenas de `getCashflowForecast`.
 * O toggle de cenário é efêmero (useState), nunca persiste no servidor;
 * `forecast.scenarioDefault` só define o valor inicial.
 */
export function ForecastManager({ accountId, forecast }: Props) {
  const [scenario, setScenario] = useState<Scenario>(forecast.scenarioDefault);

  const labelFor = (yearMonth: string): string =>
    forecast.points.find((p) => p.yearMonth === yearMonth)?.label ?? yearMonth;

  const isEmpty =
    forecast.startingBalanceCents === "0" &&
    forecast.points.every((p) => p.realisticBalanceCents === "0");

  // Runway/vale recalculados sobre o cenário SELECIONADO no toggle — o
  // servidor só computa `forecast.runwayYearMonth`/`troughYearMonth` em cima
  // do realista (ver `deriveRunwayTrough` em CashflowForecastChart.tsx), então
  // usar os campos do servidor direto aqui faria os cards contradizerem a
  // linha exibida ao alternar cenário.
  const balanceKey = SCENARIO_BALANCE_KEY[scenario];
  const { runwayYearMonth, troughYearMonth, troughBalanceCents } = deriveRunwayTrough(
    forecast.points,
    balanceKey,
  );

  return (
    <Box sx={{ p: layout.page }}>
      <PageHeader
        title={m.cashflowForecast.title}
        description={m.cashflowForecast.fromToday}
        actions={
          <Stack direction="row" spacing={layout.inline}>
            <PageInfoButton guide={m.cashflowForecast.guide} />
            <Button
              size="small"
              component={AppLink}
              href={`/${accountId}/settings/forecast`}
              variant="outlined"
              startIcon={<SettingsIcon />}
              sx={{ color: "text.secondary", borderColor: "divider" }}
            >
              {m.cashflowForecast.configureLink}
            </Button>
          </Stack>
        }
      />

      {isEmpty ? (
        <EmptyState
          icon={<TrendingUpIcon sx={{ fontSize: 48 }} />}
          title={m.cashflowForecast.emptyTitle}
          description={m.cashflowForecast.emptyDescription}
        />
      ) : (
        <Stack spacing={layout.page}>
          {/* ── Stat row: runway, menor saldo, saldo de partida ── */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              gap: layout.cluster,
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                p: layout.card,
                display: "flex",
                flexDirection: "column",
                gap: layout.micro,
                justifyContent: "center",
              }}
            >
              <Typography variant="overline" sx={{ color: "text.tertiary" }}>
                {m.cashflowForecast.runwayTitle}
              </Typography>
              {runwayYearMonth ? (
                <StatusBadge variant="danger">
                  {m.cashflowForecast.runwayBadge(labelFor(runwayYearMonth))}
                </StatusBadge>
              ) : (
                <StatusBadge variant="success">{m.cashflowForecast.noRupture}</StatusBadge>
              )}
            </Paper>

            <Paper
              variant="outlined"
              sx={{
                p: layout.card,
                display: "flex",
                flexDirection: "column",
                gap: layout.micro,
                justifyContent: "center",
              }}
            >
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {m.cashflowForecast.trough(
                  formatCentsToBrl(BigInt(troughBalanceCents), { sign: true }),
                  labelFor(troughYearMonth),
                )}
              </Typography>
              {forecast.hasLowData && (
                <StatusBadge variant="warning">{m.cashflowForecast.lowData}</StatusBadge>
              )}
            </Paper>

            <Paper
              variant="outlined"
              sx={{ p: layout.card, display: "flex", flexDirection: "column", gap: layout.micro }}
            >
              <Typography variant="overline" sx={{ color: "text.tertiary" }}>
                {forecast.startingBalanceIsOverride
                  ? m.cashflowForecast.startingOverride
                  : m.cashflowForecast.startingAccrued}
              </Typography>
              <Typography
                variant="mono"
                component="div"
                sx={{ fontSize: "1.25rem", fontWeight: 600 }}
              >
                {formatCentsToBrl(BigInt(forecast.startingBalanceCents), { sign: true })}
              </Typography>
            </Paper>
          </Box>

          {/* ── Gráfico + toggle de cenário no header do card (controle junto do efeito;
                efêmero, não persiste no servidor) ── */}
          <Paper variant="outlined" sx={{ p: layout.card }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: layout.inline,
                mb: layout.stack,
              }}
            >
              <Typography variant="overline" sx={{ color: "text.tertiary" }}>
                {m.cashflowForecast.scenarioLabel}
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={scenario}
                onChange={(_event, value: Scenario | null) => {
                  if (value) setScenario(value);
                }}
                aria-label={m.cashflowForecast.scenarioLabel}
              >
                {SCENARIOS.map((s) => (
                  <ToggleButton key={s} value={s}>
                    {m.cashflowForecast.scenarios[s]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Divider sx={{ mb: layout.stack }} />
            <LazyCashflowForecastChart
              forecast={forecast}
              scenario={scenario}
              renderMode="expanded"
              height={340}
            />
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
