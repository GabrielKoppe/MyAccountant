"use client";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HistoryIcon from "@mui/icons-material/History";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ScheduleIcon from "@mui/icons-material/Schedule";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { MoneyValue } from "@/components/ui/MoneyValue";
import { parseLocalDate } from "@/lib/dates";
import { layout, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type {
  InstallmentPanelItem,
  InstallmentPanelItemStatus,
} from "@/server/services/installment-service";

/**
 * Rótulo de mês da parcela. Usa a COMPETÊNCIA (`monthYear`/`monthMonth`) — para
 * item lançado ela vem do `Month` da transação, não de `occurredOn`, que numa
 * parcela de fatura é a data da compra e apontaria o mês errado (spec 73 §2.2).
 */
function monthLabelOf(item: InstallmentPanelItem, pattern: string): string {
  const date =
    item.monthYear && item.monthMonth
      ? new Date(item.monthYear, item.monthMonth - 1, 1)
      : parseLocalDate(item.date);
  return format(date, pattern, { locale: ptBR });
}

// Ícone de status por linha (variante "compact"): paga (check verde) ·
// atual/pendente (radio preenchido, accent) · prevista/aguardando (radio
// vazio, mutado). O ícone já comunica o estado — não repetir em uma pílula
// de texto ao lado.
const STATUS_ICON: Record<InstallmentPanelItemStatus, typeof CheckCircleIcon> = {
  paid: CheckCircleIcon,
  pending: RadioButtonCheckedIcon,
  waiting: RadioButtonUncheckedIcon,
  // Paga fora do app: check, mas em tom secundário — não é lançamento
  settled_external: HistoryIcon,
};

const STATUS_ICON_COLOR: Record<InstallmentPanelItemStatus, string> = {
  paid: "success.main",
  pending: "accent.primary",
  waiting: "text.disabled",
  settled_external: "success.main",
};

// Ícone de status da variante "panel" (frame Spec 66 §10): check_circle
// (paga) · radio_button_checked (atual) · schedule (prevista) — diferente da
// variante "compact", que usa radio_button_unchecked para "prevista".
const PANEL_STATUS_ICON: Record<InstallmentPanelItemStatus, typeof CheckCircleIcon> = {
  paid: CheckCircleIcon,
  pending: RadioButtonCheckedIcon,
  waiting: ScheduleIcon,
  settled_external: HistoryIcon,
};

// NOTA: "text.tertiary" não é um token de palette resolvível pelo MUI (só
// `text.primary/secondary/disabled` existem em `theme.palette.text` — ver
// `src/lib/theme.ts`). O equivalente que REALMENTE resolve para o mesmo tom
// cinza-terciário é `neutral.main` (mesmo valor hex em light e dark). Usar
// "text.tertiary" aqui resultaria em cor não aplicada (fallback silencioso).
const PANEL_STATUS_ICON_COLOR: Record<InstallmentPanelItemStatus, string> = {
  paid: "success.main",
  pending: "accent.primary",
  waiting: "neutral.main",
  settled_external: "success.main",
};

const PANEL_VALUE_COLOR: Record<InstallmentPanelItemStatus, string> = {
  paid: "text.secondary",
  pending: "text.primary",
  waiting: "neutral.main",
  settled_external: "text.secondary",
};

type InstallmentRowValueProps = {
  item: InstallmentPanelItem;
  canEdit: boolean;
  convertingId: string | null;
  onConvert: (id: string) => void;
};

/**
 * Lado direito da linha (variante "compact"): valor lançado (via MoneyValue),
 * "prevista" (parcela futura ainda sem lançamento) ou o link de ação "Criar
 * neste mês" quando o mês já existe mas a parcela ainda não foi criada.
 */
function InstallmentRowValue({ item, canEdit, convertingId, onConvert }: InstallmentRowValueProps) {
  if (item.status === "waiting" && item.existingMonthId && canEdit) {
    const isConverting = convertingId === item.pendingInstallmentId;
    return (
      <Box
        component="span"
        onClick={() =>
          !isConverting && item.pendingInstallmentId && onConvert(item.pendingInstallmentId)
        }
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          color: "accent.primary",
          fontSize: "0.8125rem",
          fontWeight: 500,
          whiteSpace: "nowrap",
          cursor: isConverting ? "default" : "pointer",
          "&:hover": isConverting ? {} : { textDecoration: "underline" },
        }}
      >
        {isConverting && <CircularProgress size={10} color="inherit" />}
        Criar neste mês
      </Box>
    );
  }

  if (item.status === "waiting") {
    return (
      <Typography variant="body2" color="text.tertiary" sx={{ whiteSpace: "nowrap" }}>
        {m.transactions.installments.statusForecast}
      </Typography>
    );
  }

  return <MoneyValue cents={BigInt(item.amountCents)} variant="body2" />;
}

/**
 * Lado direito da linha (variante "panel"): mesma ação "Criar neste mês"
 * preservada para itens waiting convertíveis; caso contrário, valor mono
 * formatado (inclusive para "prevista" — o frame Spec 66 §10 mostra o valor
 * previsto, não o texto "prevista", que fica só como sufixo do título).
 */
function PanelRowValue({ item, canEdit, convertingId, onConvert }: InstallmentRowValueProps) {
  if (item.status === "waiting" && item.existingMonthId && canEdit) {
    const isConverting = convertingId === item.pendingInstallmentId;
    return (
      <Box
        component="span"
        onClick={() =>
          !isConverting && item.pendingInstallmentId && onConvert(item.pendingInstallmentId)
        }
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          flexShrink: 0,
          color: "accent.primary",
          fontFamily: typography.fontFamily.mono,
          fontWeight: 500,
          fontSize: "0.8rem",
          whiteSpace: "nowrap",
          cursor: isConverting ? "default" : "pointer",
          "&:hover": isConverting ? {} : { textDecoration: "underline" },
        }}
      >
        {isConverting && <CircularProgress size={10} color="inherit" />}
        Criar neste mês
      </Box>
    );
  }

  return (
    <Typography
      component="span"
      sx={{
        flexShrink: 0,
        fontFamily: typography.fontFamily.mono,
        fontWeight: 500,
        fontSize: "0.8rem",
        fontVariantNumeric: "tabular-nums",
        color: PANEL_VALUE_COLOR[item.status],
        whiteSpace: "nowrap",
      }}
    >
      {formatCentsToBrl(BigInt(item.amountCents))}
    </Typography>
  );
}

type StatusIconSlotProps = {
  item: InstallmentPanelItem;
  Icon: typeof CheckCircleIcon;
  color: string;
  fontSize: number;
  canEdit: boolean;
  settlingId: string | null;
  onToggleSettled?: (pendingInstallmentId: string, settled: boolean) => void;
};

/**
 * Ícone de status. Para parcela prevista/paga-fora-do-app com permissão de
 * edição, vira botão: marca/desmarca "paga (histórico)" (spec 73 §2.5).
 */
function StatusIconSlot({
  item,
  Icon,
  color,
  fontSize,
  canEdit,
  settlingId,
  onToggleSettled,
}: StatusIconSlotProps) {
  const isSettleable =
    canEdit &&
    Boolean(onToggleSettled) &&
    Boolean(item.pendingInstallmentId) &&
    (item.status === "waiting" || item.status === "settled_external");

  if (!isSettleable) {
    return <Icon sx={{ fontSize, color, flexShrink: 0 }} />;
  }

  const isSettled = item.status === "settled_external";
  const isBusy = settlingId === item.pendingInstallmentId;
  const label = isSettled
    ? m.transactions.installments.unmarkSettled
    : m.transactions.installments.markSettled;

  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        disabled={isBusy}
        onClick={() => onToggleSettled?.(item.pendingInstallmentId!, !isSettled)}
        sx={{ p: 0.25, flexShrink: 0, color }}
      >
        {isBusy ? (
          <CircularProgress size={fontSize} color="inherit" />
        ) : (
          <Icon sx={{ fontSize, color: "inherit" }} />
        )}
      </IconButton>
    </Tooltip>
  );
}

type InstallmentScheduleVariant = "compact" | "panel";

type InstallmentScheduleProps = {
  items: InstallmentPanelItem[];
  installmentCount: number;
  canEdit?: boolean;
  convertingId?: string | null;
  onConvert?: (pendingInstallmentId: string) => void;
  /** PendingInstallment cuja marcação de "paga (histórico)" está em voo */
  settlingId?: string | null;
  /** Marca/desmarca a parcela como paga fora do app (spec 73 §2.5) */
  onToggleSettled?: (pendingInstallmentId: string, settled: boolean) => void;
  /**
   * "compact" (padrão): linha única condensada, usada na aba "Parcelas" do
   * modal de detalhe da transação (TransactionDetailDialog).
   * "panel": linha densa com subtítulo (mês · origem) e destaque para a
   * parcela atual, usada no painel lateral (InstallmentGroupPanel) — frame
   * Spec 66 §10.
   */
  variant?: InstallmentScheduleVariant;
};

/**
 * Cronograma de parcelas: fonte única de verdade visual, reusada pelo
 * painel lateral (InstallmentGroupPanel, variant="panel") e pela aba
 * "Parcelas" do modal de detalhe da transação (variant="compact", padrão).
 */
export function InstallmentSchedule({
  items,
  installmentCount,
  canEdit = false,
  convertingId = null,
  onConvert,
  settlingId = null,
  onToggleSettled,
  variant = "compact",
}: InstallmentScheduleProps) {
  const handleConvert = onConvert ?? (() => {});

  if (variant === "panel") {
    return (
      <Box sx={{ py: "6px" }}>
        {items.map((item, index) => {
          const StatusIcon = PANEL_STATUS_ICON[item.status];
          const isCurrent = item.status === "pending";
          // Só "paid"/"pending" têm Transaction navegável; settled_external e
          // waiting não são lançamentos.
          const isLaunched = item.status === "paid" || item.status === "pending";
          const monthLabel = monthLabelOf(item, "MMMM yyyy");
          const subtitle =
            item.status === "waiting"
              ? `${monthLabel} · ${m.transactions.installments.itemNotLaunched}`
              : item.status === "settled_external"
                ? `${monthLabel} · ${m.transactions.installments.itemSettledNote}`
                : monthLabel;
          const itemTitle = m.transactions.installments.itemTitle(
            item.installmentNumber,
            installmentCount,
          );
          const title =
            item.status === "pending"
              ? `${itemTitle} · ${m.transactions.installments.itemCurrentSuffix}`
              : item.status === "waiting"
                ? `${itemTitle} · ${m.transactions.installments.itemForecastSuffix}`
                : item.status === "settled_external"
                  ? `${itemTitle} · ${m.transactions.installments.itemSettledSuffix}`
                  : itemTitle;

          return (
            <Box
              key={item.installmentNumber}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                py: "10px",
                px: "16px",
                borderBottom: index < items.length - 1 ? "1px solid" : "none",
                borderColor: "border.subtle",
                bgcolor: isCurrent ? "accent.primarySubtle" : "transparent",
              }}
            >
              <StatusIconSlot
                item={item}
                Icon={StatusIcon}
                color={PANEL_STATUS_ICON_COLOR[item.status]}
                fontSize={17}
                canEdit={canEdit}
                settlingId={settlingId}
                onToggleSettled={onToggleSettled}
              />

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: 500,
                    fontSize: "0.8rem",
                    color: isCurrent ? "accent.primary" : "text.primary",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.68rem",
                    color: "neutral.main",
                    mt: "2px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {subtitle}
                </Typography>
              </Box>

              <PanelRowValue
                item={item}
                canEdit={canEdit}
                convertingId={convertingId}
                onConvert={handleConvert}
              />

              {isLaunched && (
                <OpenInNewIcon sx={{ fontSize: 15, color: "text.secondary", flexShrink: 0 }} />
              )}
            </Box>
          );
        })}
      </Box>
    );
  }

  return (
    <Stack divider={<Divider />} spacing={0}>
      {items.map((item) => {
        const StatusIcon = STATUS_ICON[item.status];
        const monthLabel = monthLabelOf(item, "MMMM");

        return (
          <Box
            key={item.installmentNumber}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: layout.inline,
              py: 1.25,
              px: 0.5,
            }}
          >
            <StatusIconSlot
              item={item}
              Icon={StatusIcon}
              color={STATUS_ICON_COLOR[item.status]}
              fontSize={20}
              canEdit={canEdit}
              settlingId={settlingId}
              onToggleSettled={onToggleSettled}
            />

            {/* N/total · mês */}
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "baseline",
                gap: 0.75,
                overflow: "hidden",
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontFamily: typography.fontFamily.mono,
                  fontVariantNumeric: "tabular-nums",
                  color: "text.primary",
                  flexShrink: 0,
                }}
              >
                {item.installmentNumber}/{installmentCount}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                · {monthLabel}
              </Typography>
            </Box>

            {/* Valor / prevista / ação */}
            <Box sx={{ flexShrink: 0, textAlign: "right" }}>
              <InstallmentRowValue
                item={item}
                canEdit={canEdit}
                convertingId={convertingId}
                onConvert={handleConvert}
              />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
