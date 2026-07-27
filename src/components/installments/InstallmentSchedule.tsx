"use client";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ScheduleIcon from "@mui/icons-material/Schedule";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { MoneyValue } from "@/components/ui/MoneyValue";
import { parseLocalDate } from "@/lib/dates";
import { layout, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { InstallmentPanelItem } from "@/server/services/installment-service";

// Ícone de status por linha (variante "compact"): paga (check verde) ·
// atual/pendente (radio preenchido, accent) · prevista/aguardando (radio
// vazio, mutado). O ícone já comunica o estado — não repetir em uma pílula
// de texto ao lado.
const STATUS_ICON = {
  paid: CheckCircleIcon,
  pending: RadioButtonCheckedIcon,
  waiting: RadioButtonUncheckedIcon,
} as const;

const STATUS_ICON_COLOR = {
  paid: "success.main",
  pending: "accent.primary",
  waiting: "text.disabled",
} as const;

// Ícone de status da variante "panel" (frame Spec 66 §10): check_circle
// (paga) · radio_button_checked (atual) · schedule (prevista) — diferente da
// variante "compact", que usa radio_button_unchecked para "prevista".
const PANEL_STATUS_ICON = {
  paid: CheckCircleIcon,
  pending: RadioButtonCheckedIcon,
  waiting: ScheduleIcon,
} as const;

// NOTA: "text.tertiary" não é um token de palette resolvível pelo MUI (só
// `text.primary/secondary/disabled` existem em `theme.palette.text` — ver
// `src/lib/theme.ts`). O equivalente que REALMENTE resolve para o mesmo tom
// cinza-terciário é `neutral.main` (mesmo valor hex em light e dark). Usar
// "text.tertiary" aqui resultaria em cor não aplicada (fallback silencioso).
const PANEL_STATUS_ICON_COLOR = {
  paid: "success.main",
  pending: "accent.primary",
  waiting: "neutral.main",
} as const;

const PANEL_VALUE_COLOR = {
  paid: "text.secondary",
  pending: "text.primary",
  waiting: "neutral.main",
} as const;

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

type InstallmentScheduleVariant = "compact" | "panel";

type InstallmentScheduleProps = {
  items: InstallmentPanelItem[];
  installmentCount: number;
  canEdit?: boolean;
  convertingId?: string | null;
  onConvert?: (pendingInstallmentId: string) => void;
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
  variant = "compact",
}: InstallmentScheduleProps) {
  const handleConvert = onConvert ?? (() => {});

  if (variant === "panel") {
    return (
      <Box sx={{ py: "6px" }}>
        {items.map((item, index) => {
          const StatusIcon = PANEL_STATUS_ICON[item.status];
          const isCurrent = item.status === "pending";
          const isLaunched = item.status !== "waiting";
          const monthLabel = format(parseLocalDate(item.date), "MMMM yyyy", { locale: ptBR });
          const subtitle =
            item.status === "waiting"
              ? `${monthLabel} · ${m.transactions.installments.itemNotLaunched}`
              : monthLabel;
          const title =
            item.status === "pending"
              ? `${m.transactions.installments.itemTitle(item.installmentNumber, installmentCount)} · ${m.transactions.installments.itemCurrentSuffix}`
              : item.status === "waiting"
                ? `${m.transactions.installments.itemTitle(item.installmentNumber, installmentCount)} · ${m.transactions.installments.itemForecastSuffix}`
                : m.transactions.installments.itemTitle(item.installmentNumber, installmentCount);

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
              <StatusIcon
                sx={{ fontSize: 17, color: PANEL_STATUS_ICON_COLOR[item.status], flexShrink: 0 }}
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
        const monthLabel = format(parseLocalDate(item.date), "MMMM", { locale: ptBR });

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
            <StatusIcon
              fontSize="small"
              sx={{ color: STATUS_ICON_COLOR[item.status], flexShrink: 0 }}
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
