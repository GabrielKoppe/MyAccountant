import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

import { m } from "@/lib/messages";

/**
 * Status de um `Budget` (spec 25) por limiar de uso — semântica INTACTA (spec 47
 * §3.5/§5.9: "reconstrução da superfície NÃO altera o cálculo/limiares do Budget").
 * "ok" até `alertThresholdPercent`, "alert" dali até 100%, "exceeded" acima de 100%.
 *
 * Extraído de `BudgetProgressBar.tsx` (fonte original, única dona da lógica) para
 * este módulo, para ser reusado também pelo hero de KPIs e pelos `StatusBadge` da
 * aba Orçamento (`BudgetsPlanningManager.tsx`, spec 47 Fase 11) sem duplicar o
 * cálculo em dois lugares — `BudgetProgressBar` passou a importar daqui.
 */
export type BudgetStatus = "ok" | "alert" | "exceeded";

export function getBudgetStatus(percent: number, alertThresholdPercent: number): BudgetStatus {
  if (percent >= 100) return "exceeded";
  if (percent >= alertThresholdPercent) return "alert";
  return "ok";
}

/** Cor MUI (ícone/`LinearProgress`) por status — inalterada, só nomeada/exportada. */
export const BUDGET_STATUS_COLOR: Record<BudgetStatus, "success" | "warning" | "error"> = {
  ok: "success",
  alert: "warning",
  exceeded: "error",
};

export const BUDGET_STATUS_ICON: Record<BudgetStatus, typeof CheckCircleOutlineIcon> = {
  ok: CheckCircleOutlineIcon,
  alert: WarningAmberIcon,
  exceeded: ErrorOutlineIcon,
};

/**
 * Variante do `<StatusBadge>` (design system §5.7) por status — "danger", não
 * "error" (StatusBadge não tem essa variante). Usada só pela aba Orçamento —
 * `BudgetProgressBar` (widgets) usa `BUDGET_STATUS_COLOR` diretamente na cor do
 * MUI, sem StatusBadge.
 */
export const BUDGET_STATUS_VARIANT: Record<BudgetStatus, "success" | "warning" | "danger"> = {
  ok: "success",
  alert: "warning",
  exceeded: "danger",
};

/**
 * Rótulo pt-BR do status (spec 47 §5.9 fix wave) — mesmas 3 palavras já usadas na
 * legenda antiga da faixa de histórico (`m.budgets.progress.*`), agora centralizadas
 * aqui para serem consumidas também por `BudgetHistoryChart` (tooltip) e
 * `BudgetDetailDialog`/`BudgetConfigCard` (badge do último mês) sem duplicar o mapa.
 */
export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  ok: m.budgets.progress.onTrack,
  alert: m.budgets.progress.attention,
  exceeded: m.budgets.progress.exceeded,
};
