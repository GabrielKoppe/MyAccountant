"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StarIcon from "@mui/icons-material/Star";

import { AppLink } from "@/components/ui/AppLink";
import { WidgetContainer } from "@/components/ui/WidgetContainer";
import { WIDGET_ICONS } from "@/components/dashboards/_core/widget-icons";
import { formatCentsToBrl } from "@/lib/money";
import { updateTransactionAction } from "@/actions/transactions";
import { Zoom } from "@mui/material";

export type ActivityTx = {
  id: string;
  description: string | null;
  amountCents: string;
  sectionId: string;
  sectionName: string;
  occurredOn: string; // "YYYY-MM-DD"
};

type Mode = "pending" | "favorite" | "recent";
type RenderMode = "compact" | "default" | "full";

// ─── Linha de transação ───────────────────────────────────────────────────────
function TxRow({
  tx,
  mode,
  density,
  accountId,
  monthId,
  onRemove,
  isUpdating,
}: {
  tx: ActivityTx;
  mode: Mode;
  density: "compact" | "default" | "full";
  accountId: string;
  monthId: string;
  onRemove: (id: string) => void;
  isUpdating: boolean;
}) {
  const amount = BigInt(tx.amountCents);
  const isCompact = density === "compact";
  const isFull = density === "full";
  // "MM/DD" → "DD/MM"
  const dateLabel = tx.occurredOn.slice(8, 10) + "/" + tx.occurredOn.slice(5, 7);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: isCompact ? 0.5 : 1,
        px: isCompact ? 0.5 : 1,
        py: isCompact ? 0.375 : isFull ? 0.875 : 0.625,
        borderRadius: 1,
        transition: "background-color 120ms",
        "&:hover": { bgcolor: "action.hover" },
        minWidth: 0,
      }}
    >
      {/* Ação: completar (pending) ou desfavoritar (favorite) */}
      {mode !== "recent" && (
        <Tooltip
          arrow={true}
          slots={{
            transition: Zoom,
          }}
          title={mode === "pending" ? "Marcar como realizada" : "Remover dos favoritos"}
          placement="left"
        >
          <IconButton
            size="small"
            disabled={isUpdating}
            onClick={() => onRemove(tx.id)}
            sx={{
              p: 0.25,
              flexShrink: 0,
              color: mode === "favorite" ? "warning.main" : "success.main",
              opacity: 0.65,
              "&:hover": { opacity: 1 },
            }}
          >
            {mode === "favorite" ? (
              <StarIcon sx={{ fontSize: isCompact ? 14 : 16 }} />
            ) : (
              <CheckCircleOutlineIcon sx={{ fontSize: isCompact ? 14 : 16 }} />
            )}
          </IconButton>
        </Tooltip>
      )}

      {/* Data — no full para todos os modos, no default/full para recent */}
      {(isFull || (density === "default" && mode === "recent")) && (
        <Tooltip
          arrow={true}
          slots={{
            transition: Zoom,
          }}
          title={mode === "recent" ? "Data de inserção no sistema" : "Data da transação"}
          placement="top"
        >
          <Typography
            variant="caption"
            sx={{
              fontSize: "0.68rem",
              color: "text.tertiary",
              fontFamily: "var(--font-jetbrains-mono), monospace",
              flexShrink: 0,
              minWidth: 32,
              cursor: "default",
            }}
          >
            {dateLabel}
          </Typography>
        </Tooltip>
      )}

      {/* Descrição */}
      <Typography
        variant="caption"
        noWrap
        title={tx.description ?? "Sem descrição"}
        sx={{
          flex: 1,
          minWidth: 0,
          fontSize: isCompact ? "0.68rem" : "0.75rem",
          color: tx.description ? "text.primary" : "text.disabled",
          fontStyle: tx.description ? "normal" : "italic",
        }}
      >
        {tx.description ?? "Sem descrição"}
      </Typography>

      {/* Chip de seção — só no full */}
      {isFull && tx.sectionName && (
        <Chip
          label={tx.sectionName}
          size="small"
          sx={{
            height: 16,
            fontSize: "0.58rem",
            flexShrink: 0,
            "& .MuiChip-label": { px: 0.75 },
            bgcolor: "action.selected",
            color: "text.secondary",
          }}
        />
      )}

      {/* Valor */}
      <Typography
        variant="caption"
        sx={{
          fontFamily: "var(--font-jetbrains-mono), monospace",
          fontVariantNumeric: "tabular-nums",
          fontSize: isCompact ? "0.68rem" : "0.75rem",
          fontWeight: 500,
          flexShrink: 0,
          color: amount < 0n ? "danger.main" : "success.main",
        }}
      >
        {formatCentsToBrl(amount)}
      </Typography>

      {/* Link para a seção */}
      {!isCompact && (
        <Tooltip
          arrow={true}
          slots={{
            transition: Zoom,
          }}
          title={`Ir para ${tx.sectionName || "seção"}`}
          placement="right"
        >
          <IconButton
            size="small"
            component={AppLink}
            href={`/${accountId}/months/${monthId}?tab=${tx.sectionId}`}
            sx={{
              p: 0.25,
              flexShrink: 0,
              color: "text.disabled",
              opacity: isFull ? 0.5 : 0,
              ".MuiBox-root:hover &": { opacity: 0.5 },
              transition: "opacity 120ms",
            }}
          >
            <OpenInNewIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

// ─── Widget base ─────────────────────────────────────────────────────────────

const MODE_META = {
  pending: {
    title: "Pendentes",
    icon: PendingActionsIcon,
    widgetId: "pending-transactions" as const,
    emptyText: "Nenhuma transação pendente.",
    chipColor: "warning" as const,
  },
  favorite: {
    title: "Favoritas",
    icon: StarIcon,
    widgetId: "favorite-transactions" as const,
    emptyText: "Nenhuma transação favorita.",
    chipColor: "warning" as const,
  },
  recent: {
    title: "Últimas adicionadas",
    icon: ScheduleIcon,
    widgetId: "recent-transactions" as const,
    emptyText: "Nenhuma transação registrada.",
    chipColor: "default" as const,
  },
};

const RECENT_MAX_ITEMS: Record<RenderMode, number> = {
  compact: 11,
  default: 15,
  full: 14,
};

export function ActivityWidget({
  mode,
  transactions,
  accountId,
  monthId,
  renderMode = "default",
}: {
  mode: Mode;
  transactions: ActivityTx[];
  accountId: string;
  monthId: string;
  renderMode?: RenderMode;
}) {
  const [items, setItems] = useState<ActivityTx[]>(transactions);
  const [isUpdating, startTransition] = useTransition();

  const meta = MODE_META[mode];

  function handleRemove(id: string) {
    startTransition(async () => {
      const patch = mode === "pending" ? { isPending: false } : { isFavorite: false };
      const result = await updateTransactionAction(accountId, { transactionId: id, ...patch });
      if (result.ok) setItems((prev) => prev.filter((tx) => tx.id !== id));
    });
  }

  const density: "compact" | "default" | "full" =
    renderMode === "compact" ? "compact" : renderMode === "full" ? "full" : "default";

  // recent: fatia exatamente o número que cabe na altura do widget
  const visibleItems = mode === "recent" ? items.slice(0, RECENT_MAX_ITEMS[renderMode]) : items;
  // recent: sem scroll — o conteúdo preenche a altura disponível sem ultrapassar
  const isRecent = mode === "recent";

  const badge =
    visibleItems.length > 0 ? (
      <Chip
        label={visibleItems.length}
        size="small"
        color={meta.chipColor}
        sx={{ height: 16, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.75 } }}
      />
    ) : undefined;

  return (
    <WidgetContainer
      title={meta.title}
      icon={WIDGET_ICONS[meta.widgetId]}
      tertiary={badge}
      contentSx={{ overflow: isRecent ? "hidden" : "auto" }}
    >
      {visibleItems.length === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ px: 0.5 }}>
          {meta.emptyText}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {visibleItems.map((tx) => (
            <TxRow
              key={tx.id}
              tx={tx}
              mode={mode}
              density={density}
              accountId={accountId}
              monthId={monthId}
              onRemove={handleRemove}
              isUpdating={isUpdating}
            />
          ))}
        </Box>
      )}
    </WidgetContainer>
  );
}

// ─── Exports por modo ─────────────────────────────────────────────────────────

export function PendingTransactionsWidget(props: {
  transactions: ActivityTx[];
  accountId: string;
  monthId: string;
  renderMode?: RenderMode;
}) {
  return <ActivityWidget mode="pending" {...props} />;
}

export function FavoriteTransactionsWidget(props: {
  transactions: ActivityTx[];
  accountId: string;
  monthId: string;
  renderMode?: RenderMode;
}) {
  return <ActivityWidget mode="favorite" {...props} />;
}

export function RecentTransactionsWidget(props: {
  transactions: ActivityTx[];
  accountId: string;
  monthId: string;
  renderMode?: RenderMode;
}) {
  return <ActivityWidget mode="recent" {...props} />;
}
