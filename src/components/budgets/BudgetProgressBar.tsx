import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";

import { BUDGET_STATUS_COLOR, BUDGET_STATUS_ICON, getBudgetStatus } from "./budget-status";

type Props = {
  label: string;
  amountCents: string;
  spentCents: string;
  percent: number;
  alertThresholdPercent: number;
  compact?: boolean;
};

export function BudgetProgressBar({
  label,
  amountCents,
  spentCents,
  percent,
  alertThresholdPercent,
  compact = false,
}: Props) {
  const status = getBudgetStatus(percent, alertThresholdPercent);
  const color = BUDGET_STATUS_COLOR[status];
  const Icon = BUDGET_STATUS_ICON[status];
  const clampedPercent = Math.min(percent, 100);

  const spent = formatCentsToBrl(BigInt(spentCents));
  const goal = formatCentsToBrl(BigInt(amountCents));

  if (compact) {
    return (
      <Box sx={{ width: "100%" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.25 }}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Icon sx={{ fontSize: 12, color: `${color}.main` }} />
            <Typography
              variant="caption"
              sx={{ fontSize: "0.7rem", color: "text.secondary" }}
              noWrap
            >
              {label}
            </Typography>
          </Stack>
          {/* U8 (fix wave): variant="mono" do tema (fontFamily+tabular-nums) — mesmo
              caminho de GoalProgressBar.tsx, antes divergia (sem tabular-nums aqui). */}
          <Typography
            variant="mono"
            sx={{
              fontSize: "0.7rem",
              fontWeight: 600,
              color: `${color}.main`,
              whiteSpace: "nowrap",
              ml: 1,
            }}
          >
            {percent}%
          </Typography>
        </Stack>
        <Tooltip title={`${spent} de ${goal}`} placement="top">
          <LinearProgress
            variant="determinate"
            value={clampedPercent}
            color={color}
            sx={{ height: 4, borderRadius: 2 }}
          />
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
          <Icon sx={{ fontSize: 14, color: `${color}.main`, flexShrink: 0 }} />
          {/* U9 (fix wave): Tooltip no nome — Metas (GoalCard) já tem, faltava aqui
              quando o `label` trunca (noWrap) num card estreito. */}
          <Tooltip title={label}>
            <Typography variant="body2" fontWeight={500} noWrap>
              {label}
            </Typography>
          </Tooltip>
        </Stack>
        {/* U8 (fix wave): variant="mono" do tema + fontWeight:600 — paridade com
            GoalProgressBar.tsx (lá já usava 600; aqui era 500, divergia). */}
        <Typography
          variant="mono"
          sx={{ fontWeight: 600, color: `${color}.main`, whiteSpace: "nowrap", ml: 1 }}
        >
          {percent}%
        </Typography>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={clampedPercent}
        color={color}
        sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
      />

      {/* U8 (fix wave): <span style={}> trocado por Typography variant="mono" — mesmo
          caminho tipográfico do resto do componente, sem style inline (CLAUDE.md §5.11). */}
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
          {m.budgets.progress.spent}:{" "}
          <Typography component="span" variant="mono" sx={{ fontSize: "0.7rem" }}>
            {spent}
          </Typography>
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
          {m.budgets.progress.goal}:{" "}
          <Typography component="span" variant="mono" sx={{ fontSize: "0.7rem" }}>
            {goal}
          </Typography>
        </Typography>
      </Stack>
    </Box>
  );
}
