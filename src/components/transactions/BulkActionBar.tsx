"use client";

import { useState, useTransition } from "react";
import type { SectionCountType } from "@prisma/client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import EditIcon from "@mui/icons-material/Edit";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { useSnackbar } from "notistack";

import { bulkDeleteAction, bulkUpdateAction } from "@/actions/transactions";
import { bulkAddTagAction, bulkRemoveTagAction, listTagsAction } from "@/actions/tags";
import type { BulkUpdateInput } from "@/lib/schemas/transaction";
import { m } from "@/lib/messages";
import type { TransactionRow } from "./types";
import { MoveTransactionsDialog } from "./MoveTransactionsDialog";
import { rowCheckboxCheckedIconSx, rowCheckboxIconSx } from "./pill-sx";
import { DialogShell } from "@/components/ui/DialogShell";

type Props = {
  accountId: string;
  tableId: string;
  monthId: string;
  sourceCountType: SectionCountType;
  sampleAmountCents?: string;
  selectedIds: string[];
  allSelectedPending: boolean;
  /** Edição em massa inline ativa — a barra troca as ações por Salvar/Cancelar do lote. */
  isEditing: boolean;
  /** Lote em gravação (desabilita Salvar/Cancelar). */
  isSavingEdit: boolean;
  onClear: () => void;
  onMoved: (ids: string[]) => void;
  onBulkUpdated: (ids: string[], patch: Partial<TransactionRow>) => void;
  /** Coloca TODAS as linhas selecionadas em edição inline simultânea (frame §4). */
  onStartInlineEdit: () => void;
  onSaveInlineEdit: () => void;
  onCancelInlineEdit: () => void;
};

/**
 * Botão em modo texto da barra (frame §4): ícone 16px + rótulo, peso 500,
 * 0.78rem, `text.secondary`, gap 5px entre ícone e rótulo.
 */
const BAR_BUTTON_SX = {
  textTransform: "none",
  fontWeight: 500,
  fontSize: "0.78rem",
  color: "text.secondary",
  minWidth: 0,
  px: 1,
  py: 0.5,
  whiteSpace: "nowrap",
  "& .MuiButton-startIcon": { marginLeft: 0, marginRight: "5px" },
  "& .MuiButton-startIcon > *:nth-of-type(1)": { fontSize: 16 },
} as const;

/** "Cancelar" do lote — botão texto do frame (h30, r8, px12, 500/0.78rem). */
const CANCEL_BUTTON_SX = {
  textTransform: "none",
  height: 30,
  borderRadius: "8px",
  px: "12px",
  fontWeight: 500,
  fontSize: "0.78rem",
  color: "text.secondary",
} as const;

/** "Salvar" do lote — botão primário do frame (h30, r8, px14, 600/0.78rem). */
const SAVE_BUTTON_SX = {
  textTransform: "none",
  height: 30,
  borderRadius: "8px",
  px: "14px",
  fontWeight: 600,
  fontSize: "0.78rem",
  bgcolor: "accent.primary",
  color: "background.canvas",
  boxShadow: "none",
  "&:hover": { bgcolor: "accent.primaryHover", boxShadow: "none" },
} as const;

export function BulkActionBar({
  accountId,
  tableId,
  monthId,
  sourceCountType,
  sampleAmountCents,
  selectedIds,
  allSelectedPending,
  isEditing,
  isSavingEdit,
  onClear,
  onMoved,
  onBulkUpdated,
  onStartInlineEdit,
  onSaveInlineEdit,
  onCancelInlineEdit,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [tagMenuAnchor, setTagMenuAnchor] = useState<HTMLElement | null>(null);
  const [tagAddOpen, setTagAddOpen] = useState(false);
  const [tagRemoveOpen, setTagRemoveOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string }[]>([]);
  const [tagRemoveId, setTagRemoveId] = useState("");

  const count = selectedIds.length;
  const busy = isPending || isSavingEdit;

  /** Aplica um patch imediato (usado pela ação direta "Marcar pago/pendente"). */
  function run(patch: BulkUpdateInput["patch"]) {
    startTransition(async () => {
      const result = await bulkUpdateAction(accountId, { ids: selectedIds, monthId, patch });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
      } else {
        // Atualiza o estado local das linhas imediatamente (sem recarregar a página)
        onBulkUpdated(selectedIds, patch as Partial<TransactionRow>);
        onClear();
      }
    });
  }

  function handleDelete() {
    setDeleteOpen(false);
    startTransition(async () => {
      const result = await bulkDeleteAction(accountId, { ids: selectedIds });
      if (!result.ok) enqueueSnackbar(result.error.message, { variant: "error" });
      else {
        enqueueSnackbar(m.transactions.bulkDeleteSuccess(count), { variant: "success" });
        onClear();
      }
    });
  }

  return (
    <Paper
      elevation={0}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        px: "14px",
        py: "10px",
        bgcolor: "accent.primarySubtle",
        borderBottom: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 0,
        flexWrap: "wrap",
      }}
    >
      {/* Checkbox marcado do frame (`.cbox` accent) — também é o caminho para
          limpar a seleção (a barra do frame não tem botão "cancelar" explícito). */}
      <Tooltip title={m.common.cancel}>
        <span>
          <Checkbox
            checked
            size="small"
            disabled={isEditing}
            onChange={onClear}
            inputProps={{ "aria-label": m.common.cancel }}
            icon={<Box component="span" sx={rowCheckboxIconSx} />}
            checkedIcon={
              <Box component="span" sx={rowCheckboxCheckedIconSx}>
                <CheckIcon sx={{ fontSize: 12 }} />
              </Box>
            }
            sx={{ p: 0 }}
          />
        </span>
      </Tooltip>

      {/* Contador em TEXTO PURO (frame §4) — nunca pílula. */}
      <Typography
        component="span"
        sx={{ fontWeight: 600, fontSize: "0.82rem", color: "accent.primary" }}
      >
        {m.transactions.bulk.selected(count)}
      </Typography>

      {/* Spacer: empurra TODOS os botões para a extremidade direita. */}
      <Box sx={{ flex: 1 }} />

      {isEditing ? (
        <>
          <Button
            variant="text"
            size="small"
            disabled={isSavingEdit}
            onClick={onCancelInlineEdit}
            sx={CANCEL_BUTTON_SX}
          >
            {m.transactions.actions.cancel}
          </Button>
          <Button
            variant="contained"
            size="small"
            disableElevation
            disabled={isSavingEdit}
            onClick={onSaveInlineEdit}
            sx={SAVE_BUTTON_SX}
          >
            {m.transactions.actions.save}
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="text"
            size="small"
            startIcon={<EditIcon />}
            disabled={busy}
            onClick={onStartInlineEdit}
            sx={BAR_BUTTON_SX}
          >
            {m.transactions.bulk.editTitle}
          </Button>

          <Button
            variant="text"
            size="small"
            startIcon={<DriveFileMoveIcon />}
            disabled={busy}
            onClick={() => setMoveOpen(true)}
            sx={BAR_BUTTON_SX}
          >
            {m.transactions.bulk.move}
          </Button>

          {/* "Marcar pago" do frame é o mesmo toggle de pendência de sempre:
              com tudo pendente marca como pago (isPending:false); caso
              contrário marca como pendente. Nenhuma capacidade se perde. */}
          <Button
            variant="text"
            size="small"
            startIcon={<ScheduleIcon />}
            disabled={busy}
            onClick={() => run({ isPending: !allSelectedPending })}
            sx={BAR_BUTTON_SX}
          >
            {allSelectedPending ? m.transactions.bulk.markPaid : m.transactions.bulk.markPending}
          </Button>

          {/* Um único botão "Tags" (frame) abrindo as duas capacidades atuais. */}
          <Button
            variant="text"
            size="small"
            startIcon={<LabelOutlinedIcon />}
            disabled={busy}
            onClick={(e) => setTagMenuAnchor(e.currentTarget)}
            sx={BAR_BUTTON_SX}
          >
            {m.transactions.bulk.tags}
          </Button>

          <Button
            variant="text"
            size="small"
            startIcon={<DeleteIcon />}
            disabled={busy}
            onClick={() => (count > 5 ? setDeleteOpen(true) : handleDelete())}
            sx={{ ...BAR_BUTTON_SX, color: "danger.main" }}
          >
            {m.transactions.bulk.delete}
          </Button>
        </>
      )}

      <Menu
        anchorEl={tagMenuAnchor}
        open={!!tagMenuAnchor}
        onClose={() => setTagMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            setTagMenuAnchor(null);
            setTagInput("");
            setTagAddOpen(true);
          }}
        >
          {m.transactions.tags.bulkAdd}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setTagMenuAnchor(null);
            listTagsAction(accountId).then(setAvailableTags);
            setTagRemoveId("");
            setTagRemoveOpen(true);
          }}
        >
          {m.transactions.tags.bulkRemove}
        </MenuItem>
      </Menu>

      <DialogShell
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        maxWidth="xs"
        title={m.transactions.bulkDeleteTitle}
        description={m.transactions.bulkDeleteConfirm(count)}
        actions={
          <>
            <Button onClick={() => setDeleteOpen(false)}>{m.common.cancel}</Button>
            <Button color="error" variant="contained" onClick={handleDelete}>
              {m.common.delete}
            </Button>
          </>
        }
      />

      <MoveTransactionsDialog
        accountId={accountId}
        sourceTableId={tableId}
        sourceMonthId={monthId}
        sourceCountType={sourceCountType}
        sampleAmountCents={sampleAmountCents}
        selectedIds={selectedIds}
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        onMoved={(ids) => {
          onMoved(ids);
          setMoveOpen(false);
        }}
      />

      {/* Dialog: Adicionar tag */}
      <DialogShell
        open={tagAddOpen}
        onClose={() => setTagAddOpen(false)}
        maxWidth="xs"
        title={m.transactions.tags.bulkAdd}
        actions={
          <>
            <Button onClick={() => setTagAddOpen(false)}>{m.common.cancel}</Button>
            <Button
              variant="contained"
              disabled={!tagInput.trim() || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await bulkAddTagAction(accountId, {
                    transactionIds: selectedIds,
                    tagName: tagInput.trim(),
                  });
                  if (!result.ok) {
                    enqueueSnackbar(result.error.message, { variant: "error" });
                  } else {
                    enqueueSnackbar(m.transactions.tags.added, { variant: "success" });
                    setTagAddOpen(false);
                    onClear();
                  }
                });
              }}
            >
              {m.transactions.tags.addTooltip}
            </Button>
          </>
        }
      >
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={m.transactions.bulk.tagNameLabel}
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tagInput.trim()) {
              e.preventDefault();
            }
          }}
        />
      </DialogShell>

      {/* Dialog: Remover tag */}
      <DialogShell
        open={tagRemoveOpen}
        onClose={() => setTagRemoveOpen(false)}
        maxWidth="xs"
        title={m.transactions.tags.bulkRemove}
        actions={
          <>
            <Button onClick={() => setTagRemoveOpen(false)}>{m.common.cancel}</Button>
            <Button
              variant="contained"
              color="error"
              disabled={!tagRemoveId || isPending}
              onClick={() => {
                startTransition(async () => {
                  const result = await bulkRemoveTagAction(accountId, {
                    transactionIds: selectedIds,
                    tagId: tagRemoveId,
                  });
                  if (!result.ok) {
                    enqueueSnackbar(result.error.message, { variant: "error" });
                  } else {
                    enqueueSnackbar(m.transactions.tags.removed, { variant: "success" });
                    setTagRemoveOpen(false);
                    onClear();
                  }
                });
              }}
            >
              {m.transactions.tags.removeTooltip}
            </Button>
          </>
        }
      >
        <Select
          fullWidth
          size="small"
          value={tagRemoveId}
          onChange={(e) => setTagRemoveId(e.target.value)}
          displayEmpty
        >
          <MenuItem value="">{m.transactions.bulk.selectTagPlaceholder}</MenuItem>
          {availableTags.map((tag) => (
            <MenuItem key={tag.id} value={tag.id}>
              {tag.name}
            </MenuItem>
          ))}
        </Select>
      </DialogShell>
    </Paper>
  );
}
