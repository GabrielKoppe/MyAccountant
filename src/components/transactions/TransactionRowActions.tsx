"use client";

import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import Tooltip from "@mui/material/Tooltip";

import { m } from "@/lib/messages";
import { DENSITY_VAR } from "@/lib/table-density";

import { countAttachments } from "./attachments";
import { RowDrawerChevron } from "./RowDrawerChevron";
import { buildRowMenuItems } from "./row-menu-items";
import type { RowMenuItem, TransactionRow as TxRow } from "./types";

type Props = {
  tx: TxRow;
  isReadOnly: boolean;
  onStartEdit: () => void;
  onTogglePending: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onViewDetails: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onCreateAlias: () => void;
  onDelete: () => void;
  onToggleDrawer: () => void;
  drawerOpen: boolean;
  onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>, items: RowMenuItem[]) => void;
};

// 16px (Spec 66 · Fidelidade): "more_vert e afins" — todo o cluster de ações
// (favorito, pendente, chevron, ⋮) usa o mesmo tamanho de ícone do frame.
const ICON_SX = { fontSize: 16 } as const;
// Altura/largura vêm de `--ctrl-h` (Spec 69 §7.2): o cluster de ações é o
// conteúdo mais alto da linha em leitura, então é ele que precisa acompanhar a
// densidade para a linha caber em 36/44/52px.
const BTN_SX = {
  p: 0.5,
  minWidth: DENSITY_VAR.controlHeight,
  minHeight: DENSITY_VAR.controlHeight,
} as const;
// Cluster sempre `justifyContent:flex-end`, gap 2px (não maior) — o botão
// wrapper do RowDrawerChevron carrega seu próprio `mr` (não é nosso arquivo,
// ver comentário abaixo), por isso o wrapper aqui compensa com margem negativa
// para o chevron ficar realmente colado no ⋮.
const GAP = "2px";

export function TransactionRowActions({
  tx,
  isReadOnly,
  onStartEdit,
  onTogglePending,
  onToggleFavorite,
  onViewDetails,
  onDuplicate,
  onMove,
  onCreateAlias,
  onDelete,
  onToggleDrawer,
  drawerOpen,
  onOpenMenu,
}: Props) {
  const pendingLabel = tx.isPending
    ? m.transactions.actions.markAsDone
    : m.transactions.actions.markAsPending;
  const favoriteLabel = tx.isFavorite
    ? m.transactions.actions.removeFromFavorites
    : m.transactions.actions.addToFavorites;
  const attachmentCount = countAttachments(tx);

  const items = buildRowMenuItems({
    isReadOnly,
    onEdit: onStartEdit,
    onDuplicate,
    onMove,
    onViewDetails,
    onCreateAlias,
    onDelete,
  });

  return (
    <TableCell
      align="right"
      sx={{ width: 160, minWidth: 160, whiteSpace: "nowrap", pr: 1, py: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <Box sx={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: GAP }}>
        {/* Ordem do frame (linha hover): star · schedule · expand_more · more_vert
            — o chevron fica sempre penúltimo, colado no ⋮. */}
        {!isReadOnly && (
          <>
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
          </>
        )}

        {attachmentCount > 0 && (
          // Ação rápida (gaveta): some em repouso, revela no hover/foco da linha —
          // mesma convenção de `.row-primary` do pendente/favorito (Spec 66 · Colunas,
          // REFINADO). Wrapper em Box porque RowDrawerChevron não expõe `className`.
          // `RowDrawerChevron` (fora do nosso escopo) tem `mr:1` embutido — compensamos
          // aqui para o chevron ficar colado no ⋮, conforme o frame.
          <Box className="row-primary" sx={{ display: "inline-flex", mr: "-8px" }}>
            <RowDrawerChevron open={drawerOpen} onClick={onToggleDrawer} />
          </Box>
        )}

        <Tooltip title={m.transactions.actions.more}>
          <IconButton
            size="small"
            aria-label={m.transactions.actions.more}
            onClick={(e) => onOpenMenu(e, items)}
            className="row-more-vert"
            sx={BTN_SX}
          >
            <MoreVertIcon sx={ICON_SX} />
          </IconButton>
        </Tooltip>
      </Box>
    </TableCell>
  );
}
