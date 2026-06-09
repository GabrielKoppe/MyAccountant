import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";

type Props = {
  label: string;
  amountCents: string;
  spentCents: string;
  percent: number;
  alertThresholdPercent: number;
  compact?: boolean;
};

type Status = "ok" | "alert" | "exceeded";

function getStatus(percent: number, threshold: number): Status {
  if (percent >= 100) return "exceeded";
  if (percent >= threshold) return "alert";
  return "ok";
}

const STATUS_COLORS: Record<Status, "success" | "warning" | "error"> = {
  ok: "success",
  alert: "warning",
  exceeded: "error",
};

const STATUS_ICONS: Record<Status, typeof CheckCircleOutlineIcon> = {
  ok: CheckCircleOutlineIcon,
  alert: WarningAmberIcon,
  exceeded: ErrorOutlineIcon,
};

const STATUS_LABELS: Record<Status, string> = {
  ok: m.budgets.progress.onTrack,
  alert: m.budgets.progress.attention,
  exceeded: m.budgets.progress.exceeded,
};

export function BudgetProgressBar({
  label,
  amountCents,
  spentCents,
  percent,
  alertThresholdPercent,
  compact = false,
}: Props) {
  const status = getStatus(percent, alertThresholdPercent);
  const color = STATUS_COLORS[status];
  const Icon = STATUS_ICONS[status];
  const clampedPercent = Math.min(percent, 100);

  const spent = formatCentsToBrl(BigInt(spentCents));
  const goal = formatCentsToBrl(BigInt(amountCents));

  if (compact) {
    return (
      <Box sx={{ width: "100%" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.25 }}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Icon sx={{ fontSize: 12, color: `${color}.main` }} />
            <Typography variant="caption" sx={{ fontSize: "0.7rem", color: "text.secondary" }} noWrap>
              {label}
            </Typography>
          </Stack>
          <Typography variant="caption" sx={{ fontSize: "0.7rem", fontFamily: "var(--font-jetbrains-mono), monospace", color: `${color}.main`, whiteSpace: "nowrap", ml: 1 }}>
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
        <Stack direction="row" alignItems="center" gap={0.75}>
          <Icon sx={{ fontSize: 14, color: `${color}.main` }} />
          <Typography variant="body2" fontWeight={500} noWrap>
            {label}
          </Typography>
        </Stack>
        <Typography
          variant="body2"
          sx={{
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontWeight: 500,
            color: `${color}.main`,
            whiteSpace: "nowrap",
            ml: 1,
          }}
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

      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
          {m.budgets.progress.spent}: <span style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>{spent}</span>
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
          {m.budgets.progress.goal}: <span style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>{goal}</span>
        </Typography>
      </Stack>
    </Box>
  );
}
