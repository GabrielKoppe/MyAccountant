"use client";

// Spec 69 §2.1/§2.3 (SET-07) — contagem de uso SOB DEMANDA, embutível numa aba.
//
// Extraído do miolo do `UsageDialog` (Spec 68 · M3 "Ver uso"), que passou a
// consumi-lo: as abas "Onde é usado" de Tipos de tabela e de Modelos precisam
// exatamente da mesma contagem, só que dentro da página em vez de num modal.
//
// **Nada é contado na montagem.** Varrer `Transaction` custa, e o custo cresce
// com a conta (Spec 67 §2.4) — por isso o estado inicial é o cartão "Contagem sob
// demanda" com o botão "Contar", e o serviço guarda o resultado por 24 h. O
// modal, que só existe enquanto o usuário está olhando para ele, liga o
// `autoCount` e mantém o comportamento que já tinha.

import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
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
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import { countUsageAction } from "@/actions/settings-usage";
import { SettingsFieldLabel } from "@/components/settings/SettingsFieldLabel";
import { AppLink } from "@/components/ui/AppLink";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { CountableUsageEntity } from "@/lib/schemas/settings-usage";
import type { UsageCountResult, UsageMonthPoint } from "@/server/services/settings-usage-service";

const od = m.settings.presentation.onDemand;
/** Strings do resultado PADRÃO — que é, literalmente, o corpo do modal M3. */
const t = m.settings.structureDialogs.usage;

/** "2026-07" → "jul/26" — mesmo padrão curto de `BudgetHistoryChart` (ano com 2
 * dígitos: a faixa cabe até 12 barras lado a lado, o rótulo cheio não cabe). */
function shortMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMM/yy", { locale: ptBR });
}

/** "29/07 09:12" — hora local do navegador. Sem ano: o rodapé já é lido no contexto
 * de "agora", e o timestamp da spec/frame também não traz ano. */
export function formatCountedAt(date: Date): string {
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

export type OnDemandUsagePanelProps = {
  accountId: string;
  entity: CountableUsageEntity;
  entityId: string;
  /** Nome do objeto contado — compõe o nome acessível do painel. */
  entityName: string;
  /** Link para a lista de transações filtrada; ausente = não renderiza o atalho. */
  transactionsHref?: string;
  /**
   * Formatação do resultado pela página. Sem isto o painel usa o corpo do modal
   * M3 (três KPIs + histograma); a Spec 69 passa a sua própria frase
   * ("24 tabelas em 12 meses · 488 transações").
   */
  renderResult?: (usage: UsageCountResult) => ReactNode;
  /**
   * Conta assim que o painel monta, pulando o estado ocioso.
   *
   * Existe para o `UsageDialog`: lá o gesto de abrir o modal JÁ É o pedido de
   * contagem. Numa aba não — a aba abre junto com a página, e contar na montagem
   * é exatamente o que o SET-07 proíbe.
   */
  autoCount?: boolean;
  /** Sobrescreve o texto do carimbo de tempo. Default: `onDemand.resultAt`. */
  countedAtLabel?: (when: string) => string;
};

export function OnDemandUsagePanel({
  accountId,
  entity,
  entityId,
  entityName,
  transactionsHref,
  renderResult,
  autoCount = false,
  countedAtLabel,
}: OnDemandUsagePanelProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [usage, setUsage] = useState<UsageCountResult | null>(null);
  // Com `autoCount` o painel já nasce carregando: começar em "ocioso" faria o
  // cartão "Contar" piscar por um frame antes de o efeito rodar.
  const [loading, setLoading] = useState(autoCount);
  const [isRecounting, startRecounting] = useTransition();

  // A action é assíncrona e o painel pode desmontar no meio (troca de aba, modal
  // fechado). Sem esta guarda, o `setState` cai numa árvore que não existe mais.
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const count = useCallback(() => {
    setLoading(true);
    countUsageAction(accountId, { entity, entityId }).then((result) => {
      if (unmountedRef.current) return;
      setLoading(false);

      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setUsage(result.data);
    });
  }, [accountId, entity, entityId, enqueueSnackbar]);

  useEffect(() => {
    if (!autoCount) return;
    count();
  }, [autoCount, count]);

  function handleRecount() {
    startRecounting(async () => {
      const result = await countUsageAction(accountId, { entity, entityId, force: true });
      if (unmountedRef.current) return;
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setUsage(result.data);
    });
  }

  return (
    <Box component="section" aria-label={`${od.title} — ${entityName}`}>
      {loading ? (
        <Stack alignItems="center" sx={{ py: layout.section }}>
          <CircularProgress size={24} aria-label={od.counting} />
        </Stack>
      ) : !usage ? (
        <IdleCard onCount={count} />
      ) : (
        <>
          {renderResult ? renderResult(usage) : <DefaultUsageResult usage={usage} />}

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
              {(countedAtLabel ?? od.resultAt)(formatCountedAt(usage.countedAt))}
            </Typography>
            {transactionsHref && (
              <Button
                size="small"
                component={AppLink}
                href={transactionsHref}
                startIcon={<OpenInNewIcon fontSize="small" />}
              >
                {od.viewTransactions}
              </Button>
            )}
            <Button
              size="small"
              onClick={handleRecount}
              disabled={isRecounting}
              startIcon={
                isRecounting ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />
              }
            >
              {od.recount}
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}

/** Estado ocioso: o cartão que explica o custo antes de cobrá-lo (frame 05b). */
function IdleCard({ onCount }: { onCount: () => void }) {
  return (
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
      <QueryStatsIcon fontSize="small" sx={{ color: "text.tertiary" }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {od.title}
        </Typography>
        <Typography variant="body2" color="text.tertiary">
          {od.body}
        </Typography>
      </Box>
      <Button
        size="small"
        variant="outlined"
        startIcon={<PlayArrowIcon fontSize="small" />}
        onClick={onCount}
        sx={{ flexShrink: 0 }}
      >
        {od.count}
      </Button>
    </Stack>
  );
}

/**
 * Resultado padrão: três KPIs + histograma mensal — o corpo do modal M3, movido
 * para cá sem alteração (sem lib de gráfico: 8 barras não justificam `recharts`).
 */
function DefaultUsageResult({ usage }: { usage: UsageCountResult }) {
  const filledSeries = useMemo(() => fillMonthGaps(usage.byMonth), [usage]);
  const axisLabels = useMemo(() => pickAxisLabels(filledSeries), [filledSeries]);
  const maxTransactions = Math.max(1, ...filledSeries.map((p) => p.transactions));
  const hasUsage = usage.byMonth.length > 0;
  const lastUseLabel = hasUsage
    ? shortMonthLabel(usage.byMonth[usage.byMonth.length - 1].month)
    : t.never;

  return (
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
              <Typography
                key={month}
                variant="mono"
                color="text.tertiary"
                sx={{ fontSize: "0.6rem" }}
              >
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
    </>
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
