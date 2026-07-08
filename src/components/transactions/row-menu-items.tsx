import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import EditIcon from "@mui/icons-material/Edit";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
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
  onManageLinks: () => void;
  onCreateAlias: () => void;
  onDelete: () => void;
};

/**
 * Monta os itens do menu ⋮ da linha. Viewers (read-only) só veem ações de
 * leitura. Ordem: positivas primeiro; Excluir por último com <Divider> e danger
 * (design-system §6.6).
 */
export function buildRowMenuItems(opts: BuildOpts): RowMenuItem[] {
  const a = m.transactions.actions;

  const readItems: RowMenuItem[] = [
    { label: a.viewDetails, icon: <VisibilityOutlinedIcon sx={ICON_SX} />, onClick: opts.onViewDetails },
    { label: m.transactions.links.manage, icon: <LinkOutlinedIcon sx={ICON_SX} />, onClick: opts.onManageLinks },
  ];

  if (opts.isReadOnly) return readItems;

  return [
    { label: a.edit, icon: <EditIcon sx={ICON_SX} />, onClick: opts.onEdit },
    { label: a.duplicate, icon: <ContentCopyIcon sx={ICON_SX} />, onClick: opts.onDuplicate },
    { label: a.moveTo, icon: <DriveFileMoveOutlinedIcon sx={ICON_SX} />, onClick: opts.onMove },
    ...readItems,
    { label: a.createAlias, icon: <BookmarkAddOutlinedIcon sx={ICON_SX} />, onClick: opts.onCreateAlias },
    { label: a.delete, icon: <DeleteIcon sx={ICON_SX} />, onClick: opts.onDelete, danger: true, dividerBefore: true },
  ];
}
