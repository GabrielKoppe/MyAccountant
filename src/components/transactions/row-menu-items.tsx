import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import { m } from "@/lib/messages";

import type { RowMenuItem } from "./types";

const ICON_SX = { fontSize: 16 } as const;

type BuildOpts = {
  isReadOnly: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onViewDetails: () => void;
  onCreateAlias: () => void;
  onDelete: () => void;
};

/** Itens do menu ⋮ (spec 62 v2 §2.4). Nota e Gerenciar vínculos migraram para a
 * gaveta de anexos. Viewer só vê Ver detalhes. Excluir por último (danger). */
export function buildRowMenuItems(opts: BuildOpts): RowMenuItem[] {
  const a = m.transactions.actions;

  if (opts.isReadOnly) {
    return [{ label: a.viewDetails, icon: <VisibilityOutlinedIcon sx={ICON_SX} />, onClick: opts.onViewDetails }];
  }

  return [
    { label: a.edit, icon: <EditIcon sx={ICON_SX} />, onClick: opts.onEdit },
    { label: a.duplicate, icon: <ContentCopyIcon sx={ICON_SX} />, onClick: opts.onDuplicate },
    { label: a.moveTo, icon: <DriveFileMoveOutlinedIcon sx={ICON_SX} />, onClick: opts.onMove },
    { label: a.viewDetails, icon: <VisibilityOutlinedIcon sx={ICON_SX} />, onClick: opts.onViewDetails },
    { label: a.createAlias, icon: <BookmarkAddOutlinedIcon sx={ICON_SX} />, onClick: opts.onCreateAlias },
    { label: a.delete, icon: <DeleteIcon sx={ICON_SX} />, onClick: opts.onDelete, danger: true, dividerBefore: true },
  ];
}
