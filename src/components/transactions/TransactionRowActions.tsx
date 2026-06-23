"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TableCell from "@mui/material/TableCell";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import NoteIcon from "@mui/icons-material/Note";
import NoteOutlinedIcon from "@mui/icons-material/NoteOutlined";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

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
  onDelete: () => void;
};

export function TransactionRowActions({
  tx,
  isReadOnly,
  menuAnchor,
  setMenuAnchor,
  onStartEdit,
  onStartEditWithNote,
  onTogglePending,
  onToggleFavorite,
  onViewDetails,
  onDuplicate,
  onDelete,
}: Props) {
  return (
    <>
      <TableCell align="right" sx={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
        <Tooltip
          title={
            tx.notes ? (
              <Box sx={{ whiteSpace: "pre-wrap", maxWidth: 280 }}>{tx.notes}</Box>
            ) : (
              m.transactions.actions.addNote
            )
          }
        >
          <IconButton size="small" onClick={onStartEditWithNote}>
            {tx.notes ? <NoteIcon fontSize="small" /> : <NoteOutlinedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip
          title={
            tx.isPending ? m.transactions.actions.markAsDone : m.transactions.actions.markAsPending
          }
        >
          <IconButton size="small" onClick={onTogglePending}>
            {tx.isPending ? (
              <HourglassBottomIcon fontSize="small" />
            ) : (
              <HourglassEmptyIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip
          title={
            tx.isFavorite
              ? m.transactions.actions.removeFromFavorites
              : m.transactions.actions.addToFavorites
          }
        >
          <IconButton size="small" onClick={onToggleFavorite}>
            {tx.isFavorite ? (
              <StarIcon fontSize="small" color="warning" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        {!isReadOnly && (
          <Tooltip title={m.transactions.actions.edit}>
            <IconButton size="small" onClick={onStartEdit}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <IconButton
          size="small"
          aria-label="Mais ações"
          onClick={(e) => setMenuAnchor(e.currentTarget)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </TableCell>

      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 140 } } }}
      >
        <MenuItem onClick={onViewDetails} sx={{ py: 0.75, fontSize: 13 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
          </ListItemIcon>
          {m.transactions.actions.viewDetails}
        </MenuItem>
        {!isReadOnly && (
          <MenuItem onClick={onDuplicate} sx={{ py: 0.75, fontSize: 13 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <ContentCopyIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            {m.transactions.actions.duplicate}
          </MenuItem>
        )}
        {!isReadOnly && (
          <MenuItem onClick={onDelete} sx={{ py: 0.75, fontSize: 13, color: "error.main" }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <DeleteIcon sx={{ fontSize: 16 }} color="error" />
            </ListItemIcon>
            {m.transactions.actions.delete}
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
