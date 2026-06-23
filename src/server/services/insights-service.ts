import { unstable_cache } from "next/cache";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import {
  getInsightsData,
  type AdherenceHistory,
  type BudgetRisk,
} from "@/server/queries/insights";

// ─── Tipos ────────────────────────────────────────────────────────

export type InsightSeverity = "info" | "warning" | "success";

export type Insight = {
  id: string; // estável por (regra + dimensão), ex: "spike:catId"
  severity: InsightSeverity;
  icon: string; // chave de ícone MUI resolvida em InsightsCard (não JSX no service)
  title: string; // já localizado via m.dashboards.insights.*
  body: string;
  action?: { label: string; href: string };
};

// Insight + valor de ordenação interno (descartado antes de retornar).
type Ranked = { insight: Insight; rank: number };

// ─── Thresholds (fixos em código nesta versão — spec 34 §5) ───────

const SPIKE_RATIO = 1.25; // +25%
const SPIKE_MIN_DELTA = 5000n; // R$ 50,00 em centavos
const SPIKE_RATIO_X100 = BigInt(Math.round(SPIKE_RATIO * 100)); // 125n

const BUDGET_RISK_MIN_PERCENT = 70;
const BUDGET_RISK_MAX_PERCENT = 100;

const ADHERENCE_MIN_MONTHS = 3;

const MAX_INSIGHTS = 5;

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  warning: 0,
  success: 1,
  info: 2,
};

// ════════════════════════════════════════════════════════════════
//  Regras puras — sem Prisma, recebem dados já agregados.
//  Testáveis isoladamente com casos positivos/negativos.
// ════════════════════════════════════════════════════════════════

// INS-01 — Pico de gasto por categoria
export function detectCategorySpikes(input: {
  current: Map<string, { name: string; cents: bigint }>;
  prior: Map<string, bigint[]>; // meses anteriores COM DADOS
}): Ranked[] {
  const out: Ranked[] = [];
  for (const [catId, { name, cents }] of input.current) {
    const history = input.prior.get(catId) ?? [];
    if (history.length === 0) continue; // sem histórico → não inferir
    const avg = history.reduce((a, b) => a + b, 0n) / BigInt(history.length);
    if (avg <= 0n) continue;
    const delta = cents - avg;
    if (delta < SPIKE_MIN_DELTA) continue; // piso absoluto R$ 50
    if (cents * 100n < avg * SPIKE_RATIO_X100) continue; // < +25%
    const pct = Number((delta * 100n) / avg);
    out.push({
      rank: pct,
      insight: {
        id: `spike:${catId}`,
        severity: "warning",
        icon: "TrendingUp",
        title: m.dashboards.insights.spikeTitle(name),
        body: m.dashboards.insights.spikeBody(pct, formatCentsToBrl(cents), formatCentsToBrl(avg)),
      },
    });
  }
  return out;
}

// INS-02 — Categoria nova
export function detectNewCategories(input: {
  current: Map<string, { name: string; cents: bigint }>;
  prior: Map<string, bigint[]>;
}): Ranked[] {
  const out: Ranked[] = [];
  for (const [catId, { name, cents }] of input.current) {
    if (cents <= 0n) continue;
    if (input.prior.has(catId)) continue; // teve gasto antes → não é nova
    out.push({
      rank: Number(cents), // ordena por valor absoluto decrescente
      insight: {
        id: `new:${catId}`,
        severity: "info",
        icon: "FiberNew",
        title: m.dashboards.insights.newCategoryTitle(name),
        body: m.dashboards.insights.newCategoryBody(formatCentsToBrl(cents)),
      },
    });
  }
  return out;
}

// INS-03 — Risco de estouro de meta
export function detectBudgetRisk(input: {
  budgets: BudgetRisk[];
  isCurrentMonth: boolean;
  daysRemaining: number | null;
  budgetsHref: string;
}): Ranked[] {
  const out: Ranked[] = [];
  for (const b of input.budgets) {
    if (b.percent < BUDGET_RISK_MIN_PERCENT || b.percent >= BUDGET_RISK_MAX_PERCENT) continue;
    const body =
      input.isCurrentMonth && input.daysRemaining !== null
        ? m.dashboards.insights.budgetRiskBodyCurrent(b.percent, input.daysRemaining)
        : m.dashboards.insights.budgetRiskBodyHistoric(b.percent);
    out.push({
      rank: b.percent,
      insight: {
        id: `budget-risk:${b.id}`,
        severity: "warning",
        icon: "Warning",
        title: m.dashboards.insights.budgetRiskTitle(b.label),
        body,
        action: { label: m.dashboards.insights.viewBudgetAction, href: input.budgetsHref },
      },
    });
  }
  return out;
}

// INS-04 — Aderência sustentada
export function detectSustainedAdherence(input: { history: AdherenceHistory[] }): Ranked[] {
  const out: Ranked[] = [];
  for (const h of input.history) {
    if (h.percents.length < ADHERENCE_MIN_MONTHS) continue; // exige ≥ 3 meses de histórico
    if (!h.percents.every((p) => p < 100)) continue; // estourou em algum mês → não premia
    out.push({
      rank: h.percents.length,
      insight: {
        id: `adherence:${h.id}`,
        severity: "success",
        icon: "EmojiEvents",
        title: m.dashboards.insights.adherenceTitle(h.label),
        body: m.dashboards.insights.adherenceBody(h.percents.length),
      },
    });
  }
  return out;
}

// ─── Orquestração + priorização ───────────────────────────────────

export function orchestrate(ranked: Ranked[]): Insight[] {
  return [...ranked]
    .sort((a, b) => {
      const sev = SEVERITY_ORDER[a.insight.severity] - SEVERITY_ORDER[b.insight.severity];
      if (sev !== 0) return sev;
      return b.rank - a.rank; // maior relevância primeiro dentro da mesma severidade
    })
    .slice(0, MAX_INSIGHTS)
    .map((r) => r.insight);
}

async function computeInsights(
  accountId: string,
  monthId: string,
  options: { isCurrentMonth: boolean },
): Promise<Insight[]> {
  const data = await getInsightsData(accountId, monthId, options);

  const current = new Map<string, { name: string; cents: bigint }>(
    data.currentCategories.map((c) => [c.categoryId, { name: c.name, cents: BigInt(c.cents) }]),
  );
  const prior = new Map<string, bigint[]>(
    Object.entries(data.priorCategoryExpenses).map(([id, arr]) => [id, arr.map((v) => BigInt(v))]),
  );

  const budgetsHref = `/${accountId}/settings/budgets`;

  const ranked: Ranked[] = [
    ...detectCategorySpikes({ current, prior }),
    ...detectNewCategories({ current, prior }),
    ...detectBudgetRisk({
      budgets: data.budgetsCurrent,
      isCurrentMonth: options.isCurrentMonth,
      daysRemaining: data.daysRemaining,
      budgetsHref,
    }),
    ...detectSustainedAdherence({ history: data.adherenceHistory }),
  ];

  return orchestrate(ranked);
}

/**
 * Motor de insights. Roda cada regra, ordena por severidade e corta em 5.
 * Resultado cacheado por (accountId, monthId, isCurrentMonth) com TTL 5 min e
 * tag `account:${accountId}` — invalidado nas mutações de transações/metas.
 */
export async function generateInsights(
  accountId: string,
  monthId: string,
  options: { isCurrentMonth: boolean },
): Promise<Insight[]> {
  const cached = unstable_cache(
    () => computeInsights(accountId, monthId, options),
    ["insights", accountId, monthId, String(options.isCurrentMonth)],
    { revalidate: 300, tags: [`account:${accountId}`] },
  );
  return cached();
}
