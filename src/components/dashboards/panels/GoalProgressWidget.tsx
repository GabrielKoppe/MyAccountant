"use client";

// Spec 47 Fase 10 — widget yearly (opt-in) que reflete as metas de poupança
// ativas da account (§2.5/§5.10). Espelha o par hero+widget de
// net-worth-evolution/cashflow-forecast (specs 46/48): sem config por
// instância; o dado (`GoalsWidgetData`) vem de um fetch GATED na page
// (YearlyDashboardPage só chama `getGoalsWidgetData` quando o widget está
// visível). Conteúdo por `renderMode` (nunca w/h — skill dashboard-widgets):
//
//   compact  → top 3 metas por deadline mais próximo: mini-barra + %, sem badge/alvo
//   default  → todas as metas ativas: barra + badge de ritmo + alvo
//   expanded → default + "aportado no mês" + glide-path da meta mais próxima do prazo

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import dynamic from "next/dynamic";

import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { ChartSkeleton } from "@/components/dashboards/charts/ChartSkeleton";
import { GoalProgressBar } from "@/components/goals/GoalProgressBar";
import { PACE_VARIANT } from "@/components/goals/pace-variant";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { SerializedGoal } from "@/lib/serializers/goal";
import type { GoalsWidgetData } from "@/server/queries/goals";

// Lazy — mantém recharts fora do bundle inicial (espelha GoalDetailDrawer.tsx —
// o glide-path só existe aqui no renderMode "expanded", então o corte de
// código só se paga nesse caso).
const GoalGlidePathChart = dynamic(
  () => import("@/components/goals/GoalGlidePathChart").then((mod) => mod.GoalGlidePathChart),
  { ssr: false, loading: () => <ChartSkeleton height={180} /> },
);

const MONO_SX = {
  fontFamily: "var(--font-jetbrains-mono), monospace",
  fontVariantNumeric: "tabular-nums",
} as const;

type Props = {
  data: GoalsWidgetData;
  renderMode?: string;
};

export function GoalProgressWidget({ data, renderMode = "default" }: Props) {
  // ✅ Correto — adapta pelo renderMode, nunca lê w/h diretamente (skill dashboard-widgets).
  if (renderMode === "compact") return <CompactContent data={data} />;
  if (renderMode === "expanded") return <ExpandedContent data={data} />;
  return <DefaultContent data={data} />;
}

// ─── compact (3×2, §5.10) — top 3 metas por deadline mais próximo ──────────

function CompactContent({ data }: { data: GoalsWidgetData }) {
  // `data.goals` já vem ordenado por deadline mais próximo primeiro (sem deadline por
  // último) — queries/goals.ts:getGoalsWidgetData.
  const top3 = data.goals.slice(0, 3);

  return (
    <WidgetContainer
      title={m.dashboards.widgets.yearly["goal-progress"]}
      icon={WIDGET_ICONS["goal-progress"]}
    >
      {top3.length === 0 ? (
        <EmptyState size="compact" title={m.goals.empty} />
      ) : (
        <Stack spacing={layout.stack}>
          {top3.map((goal) => (
            <Box key={goal.id}>
              <Typography
                variant="caption"
                noWrap
                sx={{ display: "block", color: "text.secondary" }}
              >
                {goal.name}
              </Typography>
              <GoalProgressBar
                compact
                progressCents={goal.progressCents}
                targetCents={goal.targetCents}
                percent={goal.percent}
              />
            </Box>
          ))}
        </Stack>
      )}
    </WidgetContainer>
  );
}

// ─── Linha de meta — compartilhada entre default/expanded (§5.10: barra + badge de ritmo + alvo) ──

function GoalRow({ goal }: { goal: SerializedGoal }) {
  return (
    <Box>
      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
        {goal.name}
      </Typography>
      <GoalProgressBar
        progressCents={goal.progressCents}
        targetCents={goal.targetCents}
        percent={goal.percent}
      />
      <Stack
        direction="row"
        alignItems="center"
        gap={layout.inline}
        flexWrap="wrap"
        sx={{ mt: layout.micro }}
      >
        <StatusBadge variant={PACE_VARIANT[goal.pace]}>{m.goals.pace[goal.pace]}</StatusBadge>
        {!goal.isAchieved && goal.requiredMonthlyCents !== null && (
          <Typography variant="caption" sx={{ color: "text.tertiary" }}>
            {m.goals.monthlyNeeded(formatCentsToBrl(BigInt(goal.requiredMonthlyCents)))}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

// ─── default (6×2, §5.10) — todas as metas ativas ──────────────────────────

function DefaultContent({ data }: { data: GoalsWidgetData }) {
  return (
    <WidgetContainer
      title={m.dashboards.widgets.yearly["goal-progress"]}
      icon={WIDGET_ICONS["goal-progress"]}
      subtitle={data.goals.length > 0 ? m.goals.activeCount(data.goals.length) : undefined}
    >
      {data.goals.length === 0 ? (
        <EmptyState size="compact" title={m.goals.empty} description={m.goals.emptyHint} />
      ) : (
        <Stack spacing={layout.stack} divider={<Divider />}>
          {data.goals.map((goal) => (
            <GoalRow key={goal.id} goal={goal} />
          ))}
        </Stack>
      )}
    </WidgetContainer>
  );
}

// ─── expanded (6×3, §5.10) — default + "aportado no mês" + glide-path ──────

function ExpandedContent({ data }: { data: GoalsWidgetData }) {
  const nearestGoal = data.goals.find((g) => g.id === data.nearestDeadlineGoalId) ?? null;

  return (
    <WidgetContainer
      title={m.dashboards.widgets.yearly["goal-progress"]}
      icon={WIDGET_ICONS["goal-progress"]}
      subtitle={data.goals.length > 0 ? m.goals.activeCount(data.goals.length) : undefined}
    >
      {data.goals.length === 0 ? (
        <EmptyState size="compact" title={m.goals.empty} description={m.goals.emptyHint} />
      ) : (
        <Stack spacing={layout.stack}>
          <Stack direction="row" alignItems="baseline" justifyContent="space-between">
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {m.goals.contributedThisMonth}
            </Typography>
            <Typography variant="body2" sx={{ ...MONO_SX, fontWeight: 600 }}>
              {formatCentsToBrl(BigInt(data.contributedThisMonthCents))}
            </Typography>
          </Stack>

          <Divider />

          <Stack spacing={layout.stack} divider={<Divider />}>
            {data.goals.map((goal) => (
              <GoalRow key={goal.id} goal={goal} />
            ))}
          </Stack>

          {/* glidePath só existe quando alguma meta ativa tem deadline (nearestDeadlineGoalId
              não-nulo — queries/goals.ts). Sem isso, expanded fica igual ao default. */}
          {data.glidePath && nearestGoal && (
            <>
              <Divider />
              <Stack spacing={layout.stack}>
                <Stack direction="row" alignItems="baseline" gap={layout.inline}>
                  <Typography variant="overline" sx={{ color: "text.tertiary" }}>
                    {m.goals.glidePathTitle}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ color: "text.secondary" }}>
                    {nearestGoal.name}
                  </Typography>
                </Stack>
                <GoalGlidePathChart series={data.glidePath} height={180} />
              </Stack>
            </>
          )}
        </Stack>
      )}
    </WidgetContainer>
  );
}
