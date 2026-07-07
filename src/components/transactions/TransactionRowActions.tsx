"use client";

import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import NoteIcon from "@mui/icons-material/Note";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import Tooltip from "@mui/material/Tooltip";

import { m } from "@/lib/messages";

import type { TransactionRow as TxRow } from "./types";

type Props = {
  tx: TxRow;
  isReadOnly: boolean;
  menuAnchor: HTMLElement | null;
  setMenuAnchor: (el: HTMLElement | null) => void;
  onStartEdit: () => void;
  onStartEditWithNote: (e: React.MouseEvent) => void;
  onTogglePending: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onViewDetails: () => void;
  onDuplicate: () => void;
  onCreateAlias: () => void;
  onDelete: () => void;
  onOpenLinkDialog: () => void;
};

export function TransactionRowActions({
  tx,
  isReadOnly,
  onStartEdit,
  onStartEditWithNote,
  onTogglePending,
  onToggleFavorite,
  onViewDetails,
  onDuplicate,
  onCreateAlias,
  onDelete,
  onOpenLinkDialog,
}: Props) {
  const iconSx = { fontSize: 16 };
  const btnSx = { p: 0.5 };

  return (
    <TableCell
      align="right"
      sx={{ width: 200, minWidth: 200, whiteSpace: "nowrap", pr: 1 }}
      onClick={(e) => e.stopPropagation()}
    >
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
        {/* Nota — só visível quando existe conteúdo */}
        {tx.notes && (
          <Tooltip title={<Box sx={{ whiteSpace: "pre-wrap", maxWidth: 280 }}>{tx.notes}</Box>}>
            <IconButton
              size="small"
              onClick={onStartEditWithNote}
              className="action-icon--active action-icon"
              sx={{ ...btnSx, color: "text.secondary" }}
            >
              <NoteIcon sx={iconSx} />
            </IconButton>
          </Tooltip>
        )}

        {/* Moeda estrangeira — só visível quando existe anotação */}
        {tx.originalCurrency && (
          <Tooltip
            title={[
              "Moeda estrangeira",
              tx.originalAmountCents && tx.originalAmountCents !== "0"
                ? `${tx.originalCurrency} ${(Number(BigInt(tx.originalAmountCents)) / 100).toFixed(2)}`
                : tx.originalCurrency,
              tx.exchangeRate ? `câmbio R$${tx.exchangeRate.toFixed(2)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            <IconButton
              size="small"
              onClick={onStartEdit}
              className="action-icon--active action-icon"
              sx={{ ...btnSx, color: "text.secondary" }}
            >
              <CurrencyExchangeOutlinedIcon sx={iconSx} />
            </IconButton>
          </Tooltip>
        )}

        {/* Vínculos */}
        <Tooltip title={m.transactions.links.addLink}>
          <IconButton
            size="small"
            onClick={onOpenLinkDialog}
            className={`action-icon${tx.linkCount > 0 ? " action-icon--active" : ""}`}
            sx={{ ...btnSx, color: "text.secondary" }}
          >
            <LinkOutlinedIcon sx={iconSx} />
          </IconButton>
        </Tooltip>

        {/* Pendente — ativo quando isPending */}
        <Tooltip
          title={
            tx.isPending ? m.transactions.actions.markAsDone : m.transactions.actions.markAsPending
          }
        >
          <IconButton
            size="small"
            onClick={onTogglePending}
            className={`action-icon${tx.isPending ? " action-icon--active" : ""}`}
            sx={{ ...btnSx, color: "text.secondary" }}
          >
            {tx.isPending ? (
              <HourglassBottomIcon sx={iconSx} />
            ) : (
              <HourglassEmptyIcon sx={iconSx} />
            )}
          </IconButton>
        </Tooltip>

        {/* Favorito — ativo quando isFavorite */}
        <Tooltip
          title={
            tx.isFavorite
              ? m.transactions.actions.removeFromFavorites
              : m.transactions.actions.addToFavorites
          }
        >
          <IconButton
            size="small"
            onClick={onToggleFavorite}
            className={`action-icon${tx.isFavorite ? " action-icon--active" : ""}`}
            sx={{ ...btnSx, color: tx.isFavorite ? "warning.main" : "text.secondary" }}
          >
            {tx.isFavorite ? <StarIcon sx={iconSx} /> : <StarBorderIcon sx={iconSx} />}
          </IconButton>
        </Tooltip>

        {/* Ver detalhes — sempre disponível (viewers também) */}
        <Tooltip title={m.transactions.actions.viewDetails}>
          <IconButton
            size="small"
            onClick={onViewDetails}
            className="action-icon"
            sx={{ ...btnSx, color: "text.secondary" }}
          >
            <VisibilityOutlinedIcon sx={iconSx} />
          </IconButton>
        </Tooltip>

        {/* Ações só para editors/owners */}
        {!isReadOnly && (
          <>
            <Tooltip title={m.transactions.actions.edit}>
              <IconButton
                size="small"
                onClick={onStartEdit}
                className="action-icon"
                sx={{ ...btnSx, color: "text.secondary" }}
              >
                <EditIcon sx={iconSx} />
              </IconButton>
            </Tooltip>

            <Tooltip title={m.transactions.actions.duplicate}>
              <IconButton
                size="small"
                onClick={onDuplicate}
                className="action-icon"
                sx={{ ...btnSx, color: "text.secondary" }}
              >
                <ContentCopyIcon sx={iconSx} />
              </IconButton>
            </Tooltip>

            <Tooltip title={m.transactions.actions.createAlias}>
              <IconButton
                size="small"
                onClick={onCreateAlias}
                aria-label={m.transactions.actions.createAlias}
                className="action-icon"
                sx={{ ...btnSx, color: "text.secondary" }}
              >
                <BookmarkAddOutlinedIcon sx={iconSx} />
              </IconButton>
            </Tooltip>

            <Tooltip title={m.transactions.actions.delete}>
              <IconButton
                size="small"
                onClick={onDelete}
                className="action-icon"
                sx={{ ...btnSx, color: "error.main" }}
              >
                <DeleteIcon sx={iconSx} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
    </TableCell>
  );
}
