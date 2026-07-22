"use client";

// Spec 48 — widget yearly (opt-in) que reflete a projeção de fluxo de caixa da
// account no cenário default configurado em Account Settings. Sem config por
// instância: não há toggle de cenário nem período — reflete `forecast.scenarioDefault`.

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { LazyCashflowForecastChart } from "@/components/dashboards/charts/lazy";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { Scenario } from "@/lib/schemas/forecast";
import type { CashflowForecast } from "@/server/queries/cashflow-forecast";

type Props = {
  forecast: CashflowForecast;
  renderMode?: "compact" | "default" | "expanded";
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

export function CashflowForecastWidget({ forecast, renderMode = "default" }: Props) {
  const isEmpty =
    forecast.startingBalanceCents === "0" &&
    forecast.points.every((p) => p.realisticBalanceCents === "0");

  const balanceKey = SCENARIO_BALANCE_KEY[forecast.scenarioDefault];
  const { runwayYearMonth, troughYearMonth, troughBalanceCents } = deriveRunwayTrough(
    forecast.points,
    balanceKey,
  );
  const labelFor = (yearMonth: string): string =>
    forecast.points.find((p) => p.yearMonth === yearMonth)?.label ?? yearMonth;

  // Em compact o chart esconde runway/vale (`showExtras` em
  // CashflowForecastChart), então o header precisa surfaceá-los como
  // texto/badge (spec 48 §5.1). hasLowData vale para qualquer renderMode.
  const tertiaryItems: ReactNode[] = [];
  if (renderMode === "compact") {
    tertiaryItems.push(
      runwayYearMonth ? (
        <StatusBadge key="runway" variant="danger">
          {m.cashflowForecast.runwayBadge(labelFor(runwayYearMonth))}
        </StatusBadge>
      ) : (
        <Typography key="trough" variant="caption" sx={{ color: "text.secondary" }}>
          {m.cashflowForecast.trough(
            formatCentsToBrl(BigInt(troughBalanceCents), { sign: true }),
            labelFor(troughYearMonth),
          )}
        </Typography>
      ),
    );
  }
  if (forecast.hasLowData) {
    tertiaryItems.push(
      <StatusBadge key="lowdata" variant="warning">
        {m.cashflowForecast.lowData}
      </StatusBadge>,
    );
  }

  return (
    <WidgetContainer
      title={m.dashboards.widgets.yearly["cashflow-forecast"]}
      icon={WIDGET_ICONS["cashflow-forecast"]}
      subtitle={m.cashflowForecast.fromToday}
      tertiary={
        tertiaryItems.length > 0 ? (
          <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
            {tertiaryItems}
          </Stack>
        ) : undefined
      }
      contentSx={{ overflow: "hidden" }}
    >
      {isEmpty ? (
        <EmptyState
          size="compact"
          title={m.cashflowForecast.emptyTitle}
          description={m.cashflowForecast.emptyDescription}
        />
      ) : (
        <LazyCashflowForecastChart
          forecast={forecast}
          scenario={forecast.scenarioDefault}
          renderMode={renderMode}
          height={renderMode === "expanded" ? 300 : 200}
        />
      )}
    </WidgetContainer>
  );
}
