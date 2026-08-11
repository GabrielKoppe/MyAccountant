"use client";

// Spec 68 §2.6 (EST-08) — M3 · Ver uso: raio de impacto REAL (varre `Transaction`,
// cache de 24h) de qualquer objeto de estrutura. Autocontido de propósito (ver
// instruções da task): não é ligado a nenhum manager aqui — quem abre controla
// `open`/`onClose`.
//
// Busca só quando `open` vira `true` (§ "Só busque quando open virar true"): a
// contagem é cara, e o diálogo fica montado (mas fechado) na página inteira.

import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import RefreshIcon from "@mui/icons-material/Refresh";
import ScheduleIcon from "@mui/icons-material/Schedule";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSnackbar } from "notistack";
import { useEffect, useMemo, useState, useTransition } from "react";

import { countUsageAction } from "@/actions/settings-usage";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SettingsFieldLabel } from "@/components/settings/SettingsFieldLabel";
import { AppLink } from "@/components/ui/AppLink";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { CountableUsageEntity } from "@/lib/schemas/settings-usage";
import type { UsageCountResult, UsageMonthPoint } from "@/server/services/settings-usage-service";

const t = m.settings.structureDialogs.usage;

export type UsageDialogProps = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  entity: CountableUsageEntity;
  entityId: string;
  entityName: string;
  /** Link para a lista de transações filtrada; ausente = não renderiza o atalho. */
  transactionsHref?: string;
};

/** "2026-07" → "jul/26" — mesmo padrão curto de `BudgetHistoryChart` (ano com 2
 * dígitos: a faixa cabe até 12 barras lado a lado, o rótulo cheio não cabe). */
function shortMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMM/yy", { locale: ptBR });
}

/** "29/07 09:12" — hora local do navegador. Sem ano: o rodapé já é lido no contexto
 * de "agora", e o timestamp da spec/frame também não traz ano. */
function formatCountedAt(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/**
 * `byMonth` só traz meses COM uso (Spec 68 §2.6 / comentário do service): o
 * histograma precisa preencher os meses sem uso no meio da faixa como barras zero,
 * senão dois meses distantes ficam lado a lado como se fossem consecutivos.
 */
function fillMonthGaps(points: UsageMonthPoint[]): UsageMonthPoint[] {
  if (points.length === 0) return [];

  const sorted = [...points].sort((a, b) => a.month.localeCompare(b.month));
  const byKey = new Map(sorted.map((p) => [p.month, p.transactions]));

  const [startYear, startMonth] = sorted[0].month.split("-").map(Number);
  const [endYear, endMonth] = sorted[sorted.length - 1].month.split("-").map(Number);

  const filled: UsageMonthPoint[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    filled.push({ month: key, transactions: byKey.get(key) ?? 0 });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return filled;
}

/** Primeiro · meio · último — nunca duplica rótulo quando a série é curta (1 ou 2
 * pontos): três Typography idênticos seriam ruído, não informação. */
function pickAxisLabels(points: UsageMonthPoint[]): string[] {
  if (points.length === 0) return [];
  if (points.length <= 2) return points.map((p) => p.month);
  const midIndex = Math.floor((points.length - 1) / 2);
  return [points[0].month, points[midIndex].month, points[points.length - 1].month];
}

/**
 * Resumo textual da série para leitor de tela — a barra em si não carrega
 * informação nenhuma sem isto (§ "barra sem rótulo não é legível").
 */
function histogramAriaLabel(points: UsageMonthPoint[]): string {
  if (points.length === 0) return t.byMonth;
  const peak = points.reduce((max, p) => (p.transactions > max.transactions ? p : max));
  const parts = points.map((p) => `${shortMonthLabel(p.month)}: ${p.transactions}`).join(", ");
  return `${t.byMonth}. ${parts}. Pico: ${shortMonthLabel(peak.month)} com ${peak.transactions}.`;
}

/**
 * M3 · Ver uso (Spec 68 §2.6). Três KPIs, histograma mensal (sem lib de gráfico —
 * 8 barras não justificam `recharts`), timestamp da contagem e "Recontar".
 */
export function UsageDialog({
  open,
  onClose,
  accountId,
  entity,
  entityId,
  entityName,
  transactionsHref,
}: UsageDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [usage, setUsage] = useState<UsageCountResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRecounting, startRecounting] = useTransition();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    countUsageAction(accountId, { entity, entityId }).then((result) => {
      if (cancelled) return;
      setLoading(false);

      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setUsage(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [open, accountId, entity, entityId, enqueueSnackbar]);

  function handleRecount() {
    startRecounting(async () => {
      const result = await countUsageAction(accountId, { entity, entityId, force: true });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setUsage(result.data);
    });
  }

  const filledSeries = useMemo(() => fillMonthGaps(usage?.byMonth ?? []), [usage]);
  const axisLabels = useMemo(() => pickAxisLabels(filledSeries), [filledSeries]);
  const maxTransactions = Math.max(1, ...filledSeries.map((p) => p.transactions));
  const hasUsage = (usage?.byMonth.length ?? 0) > 0;
  const lastUseLabel =
    usage && usage.byMonth.length > 0
      ? shortMonthLabel(usage.byMonth[usage.byMonth.length - 1].month)
      : t.never;

  return (
    <SettingsDialog
      open={open}
      onClose={onClose}
      size="form"
      titleIcon={<QueryStatsIcon />}
      title={t.title(entityName)}
      actions={
        <>
          {transactionsHref && (
            <Button
              size="small"
              component={AppLink}
              href={transactionsHref}
              startIcon={<OpenInNewIcon fontSize="small" />}
            >
              {t.viewTransactions}
            </Button>
          )}
          <Button size="small" variant="contained" onClick={onClose}>
            {t.close}
          </Button>
        </>
      }
    >
      {loading || !usage ? (
        <Stack alignItems="center" sx={{ py: layout.section }}>
          <CircularProgress size={24} />
        </Stack>
      ) : (
        <>
          <Box sx={{ display: "flex", gap: layout.inline, mb: layout.stack }}>
            <UsageKpi label={t.transactions} value={String(usage.transactions)} />
            <UsageKpi label={t.months} value={String(usage.months)} />
            <UsageKpi label={t.lastUse} value={lastUseLabel} />
          </Box>

          {hasUsage ? (
            <Box sx={{ mb: layout.stack }}>
              <SettingsFieldLabel>{t.byMonth}</SettingsFieldLabel>
              <Box
                role="img"
                aria-label={histogramAriaLabel(filledSeries)}
                sx={{
                  height: 56,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "4px",
                  mt: layout.micro,
                  mb: layout.micro,
                }}
              >
                {filledSeries.map((point) => (
                  <Box
                    key={point.month}
                    aria-hidden
                    sx={{
                      flex: 1,
                      height: `${Math.max(2, Math.round((point.transactions / maxTransactions) * 100))}%`,
                      bgcolor: "accent.primarySubtle",
                      borderTopWidth: "2px",
                      borderTopStyle: "solid",
                      borderTopColor: "accent.primary",
                      borderRadius: "2px 2px 0 0",
                    }}
                  />
                ))}
              </Box>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: axisLabels.length === 1 ? "center" : "space-between",
                }}
              >
                {axisLabels.map((month) => (
                  <Typography key={month} variant="mono" color="text.tertiary" sx={{ fontSize: "0.6rem" }}>
                    {shortMonthLabel(month)}
                  </Typography>
                ))}
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.tertiary" sx={{ mb: layout.stack }}>
              {t.noUsage}
            </Typography>
          )}

          <Stack
            direction="row"
            spacing={layout.inline}
            alignItems="center"
            sx={{
              p: layout.stack,
              borderRadius: "8px",
              border: 1,
              borderStyle: "dashed",
              borderColor: "border.strong",
            }}
          >
            <ScheduleIcon fontSize="small" sx={{ color: "text.disabled" }} />
            <Typography variant="body2" color="text.tertiary" sx={{ flex: 1 }}>
              {t.countedAt(formatCountedAt(usage.countedAt))}
            </Typography>
            <Button
              size="small"
              onClick={handleRecount}
              disabled={isRecounting}
              startIcon={
                isRecounting ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />
              }
            >
              {t.recount}
            </Button>
          </Stack>
        </>
      )}
    </SettingsDialog>
  );
}

function UsageKpi({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        p: layout.stack,
        borderRadius: "8px",
        border: 1,
        borderColor: "border.subtle",
        bgcolor: "background.canvas",
        minWidth: 0,
      }}
    >
      <SettingsFieldLabel>{label}</SettingsFieldLabel>
      <Typography variant="mono" component="div" sx={{ fontSize: "1.1rem", fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}
