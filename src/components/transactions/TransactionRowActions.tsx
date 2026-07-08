"use client";

import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import NoteIcon from "@mui/icons-material/Note";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { m } from "@/lib/messages";

import { buildRowMenuItems } from "./row-menu-items";
import type { RowMenuItem, TransactionRow as TxRow } from "./types";

type Props = {
  tx: TxRow;
  isReadOnly: boolean;
  onStartEdit: () => void;
  onStartEditWithNote: () => void;
  onTogglePending: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onViewDetails: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onCreateAlias: () => void;
  onDelete: () => void;
  onOpenLinkDialog: () => void;
  onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>, items: RowMenuItem[]) => void;
};

const ICON_SX = { fontSize: 18 } as const;
const MARKER_ICON_SX = { fontSize: 14 } as const;
const BTN_SX = { p: 1, minWidth: 32, minHeight: 32 } as const;
const GAP = 0.5;

export function TransactionRowActions({
  tx,
  isReadOnly,
  onStartEdit,
  onStartEditWithNote,
  onTogglePending,
  onToggleFavorite,
  onViewDetails,
  onDuplicate,
  onMove,
  onCreateAlias,
  onDelete,
  onOpenLinkDialog,
  onOpenMenu,
}: Props) {
  const pendingLabel = tx.isPending
    ? m.transactions.actions.markAsDone
    : m.transactions.actions.markAsPending;
  const favoriteLabel = tx.isFavorite
    ? m.transactions.actions.removeFromFavorites
    : m.transactions.actions.addToFavorites;

  const hasPassiveState = !!tx.notes || !!tx.originalCurrency || tx.linkCount > 0;

  const items = buildRowMenuItems({
    isReadOnly,
    onEdit: onStartEdit,
    onOpenNote: onStartEditWithNote,
    onDuplicate,
    onMove,
    onViewDetails,
    onManageLinks: onOpenLinkDialog,
    onCreateAlias,
    onDelete,
  });

  return (
    <TableCell
      align="right"
      sx={{ width: 160, minWidth: 160, whiteSpace: "nowrap", pr: 1 }}
      onClick={(e) => e.stopPropagation()}
    >
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: GAP }}>
        {hasPassiveState && (
          <Box
            component="span"
            aria-hidden
            sx={{ display: "inline-flex", alignItems: "center", gap: GAP, color: "text.tertiary" }}
          >
            {tx.notes && <NoteIcon sx={MARKER_ICON_SX} />}
            {tx.originalCurrency && <CurrencyExchangeOutlinedIcon sx={MARKER_ICON_SX} />}
            {tx.linkCount > 0 && (
              <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
                <LinkOutlinedIcon sx={MARKER_ICON_SX} />
                <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>
                  {tx.linkCount}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {!isReadOnly && (
          <>
            <Tooltip title={pendingLabel}>
              <IconButton
                size="small"
                onClick={onTogglePending}
                aria-label={pendingLabel}
                className={`row-primary${tx.isPending ? " row-primary--active" : ""}`}
                sx={{ ...BTN_SX, color: "text.secondary" }}
              >
                {tx.isPending ? (
                  <HourglassBottomIcon sx={ICON_SX} />
                ) : (
                  <HourglassEmptyIcon sx={ICON_SX} />
                )}
              </IconButton>
            </Tooltip>

            <Tooltip title={favoriteLabel}>
              <IconButton
                size="small"
                onClick={onToggleFavorite}
                aria-label={favoriteLabel}
                className={`row-primary${tx.isFavorite ? " row-primary--active" : ""}`}
                sx={{ ...BTN_SX, color: tx.isFavorite ? "warning.main" : "text.secondary" }}
              >
                {tx.isFavorite ? <StarIcon sx={ICON_SX} /> : <StarBorderIcon sx={ICON_SX} />}
              </IconButton>
            </Tooltip>
          </>
        )}

        <Tooltip title={m.transactions.actions.more}>
          <IconButton
            size="small"
            aria-label={m.transactions.actions.more}
            onClick={(e) => onOpenMenu(e, items)}
            sx={{ ...BTN_SX, color: "text.secondary" }}
          >
            <MoreVertIcon sx={ICON_SX} />
          </IconButton>
        </Tooltip>
      </Box>
    </TableCell>
  );
}
