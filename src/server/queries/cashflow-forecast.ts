// ─── Spec 48 — Previsão de Fluxo de Caixa ──────────────────────────
// Query multi-tenant + React.cache que junta os insumos param-independentes
// (`getForecastBasis`) com os parâmetros salvos da conta e delega TODA a
// matemática às funções puras de `src/lib/forecast/project.ts` — as mesmas que
// o preview ao vivo de Configurações usa no client (spec 71 §7.2). A projeção
// NUNCA é persistida: é recalculada por request. Todo BigInt é serializado para
// string apenas no retorno (fronteira RSC→Client).

import { cache } from "react";

import {
  composeForecast,
  deriveForecastInput,
  type ForecastParams,
  type ForecastResult,
} from "@/lib/forecast/project";
import { SCENARIOS, type Scenario } from "@/lib/schemas/forecast";
import { getForecastBasis, getForecastSettingsRow } from "@/server/queries/forecast-basis";

// ─── Serialização (borda RSC→Client): ForecastResult (bigint) → CashflowForecast (string) ───

function serialize(r: ForecastResult) {
  const s = (b: bigint) => b.toString();
  return {
    startingBalanceCents: s(r.startingBalanceCents),
    startingBalanceIsOverride: r.startingBalanceIsOverride,
    horizonMonths: r.horizonMonths,
    scenarioDefault: r.scenarioDefault,
    points: r.points.map((p) => ({
      yearMonth: p.yearMonth,
      label: p.label,
      isProjected: p.isProjected,
      realisticBalanceCents: s(p.realisticBalanceCents),
      optimisticBalanceCents: s(p.optimisticBalanceCents),
      conservativeBalanceCents: s(p.conservativeBalanceCents),
      recurringInflowCents: s(p.recurringInflowCents),
      recurringOutflowCents: s(p.recurringOutflowCents),
      installmentsOutflowCents: s(p.installmentsOutflowCents),
      estimatedCents: s(p.estimatedCents),
      monthResultCents: s(p.monthResultCents),
    })),
    runwayYearMonth: r.runwayYearMonth,
    troughYearMonth: r.troughYearMonth,
    troughBalanceCents: s(r.troughBalanceCents),
    variableWindow: r.variableWindow,
    effectiveWindow: r.effectiveWindow,
    hasLowData: r.hasLowData,
    factors: r.factors,
  };
}

export type CashflowForecast = ReturnType<typeof serialize>;

type ForecastSettingsRow = Awaited<ReturnType<typeof getForecastSettingsRow>>;

/**
 * Linha de `AccountSettings` → parâmetros de projeção. Conta nova (sem linha de
 * settings) cai nos mesmos defaults do schema Prisma/Zod; `forecastScenario` é
 * uma coluna String, então um valor legado fora do enum volta para "realistic"
 * em vez de derrubar a página.
 */
function readForecastParams(row: ForecastSettingsRow): ForecastParams {
  const rawScenario = row?.forecastScenario ?? "realistic";
  const scenarioDefault: Scenario = (SCENARIOS as readonly string[]).includes(rawScenario)
    ? (rawScenario as Scenario)
    : "realistic";

  return {
    horizonMonths: row?.forecastHorizonMonths ?? 6,
    scenarioDefault,
    optimisticPct: row?.forecastOptimisticPct ?? 15,
    conservativePct: row?.forecastConservativePct ?? 15,
    variableWindow: row?.forecastVariableWindow ?? 6,
    startBalanceOverrideCents: row?.forecastStartBalanceCents ?? null,
  };
}

// ─── Query principal ───────────────────────────────────────────────

export const getCashflowForecast = cache(async function getCashflowForecast(
  accountId: string,
): Promise<CashflowForecast> {
  // `getForecastBasis` também lê a linha de settings (para `monthStartDay`);
  // as duas chamadas compartilham o mesmo `cache`, então é uma query só.
  const [settingsRow, basis] = await Promise.all([
    getForecastSettingsRow(accountId),
    getForecastBasis(accountId),
  ]);

  const input = deriveForecastInput(basis, readForecastParams(settingsRow));
  return serialize(composeForecast(input));
});
