"use client";

import { useState, useTransition } from "react";
import type { TransactionExpenseType } from "@prisma/client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import StarIcon from "@mui/icons-material/Star";
import DeleteIcon from "@mui/icons-material/Delete";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import { useSnackbar } from "notistack";

import { bulkDeleteAction, bulkUpdateAction } from "@/actions/transactions";
import { bulkAddTagAction, bulkRemoveTagAction, listTagsAction } from "@/actions/tags";
import type { BulkUpdateInput } from "@/lib/schemas/transaction";
import { m } from "@/lib/messages";
import type { CategoryOption, InstitutionOption, TransactionRow } from "./types";
import { MoveTransactionsDialog } from "./MoveTransactionsDialog";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import { DialogShell } from "@/components/ui/DialogShell";

type Props = {
  accountId: string;
  tableId: string;
  monthId: string;
  selectedIds: string[];
  allSelectedPending: boolean;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  onClear: () => void;
  onMoved: (ids: string[]) => void;
  onBulkUpdated: (ids: string[], patch: Partial<TransactionRow>) => void;
};

export function BulkActionBar({
  accountId,
  tableId,
  monthId,
  selectedIds,
  allSelectedPending,
  categories,
  institutions: _institutions,
  onClear,
  onMoved,
  onBulkUpdated,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [tagAddOpen, setTagAddOpen] = useState(false);
  const [tagRemoveOpen, setTagRemoveOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string }[]>([]);
  const [tagRemoveId, setTagRemoveId] = useState("");

  const count = selectedIds.length;

  function run(patch: BulkUpdateInput["patch"]) {
    startTransition(async () => {
      const result = await bulkUpdateAction(accountId, { ids: selectedIds, patch });
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
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: "background.subtle",
        borderBottom: 1,
        borderTop: 1,
        borderColor: "divider",
        flexWrap: "wrap",
      }}
    >
      <Chip label={`${count} selecionada(s)`} size="small" color="primary" />

      <Button
        size="small"
        variant="outlined"
        disabled={isPending}
        onClick={() => run({ isPending: !allSelectedPending })}
      >
        {allSelectedPending ? "Desmarcar pendente" : "Marcar pendente"}
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<StarIcon fontSize="small" />}
        disabled={isPending}
        onClick={() => run({ isFavorite: true })}
      >
        Favoritar
      </Button>

      {/* Tipo de gasto */}
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>{m.transactions.expenseTypeLabel}</InputLabel>
        <Select
          label={m.transactions.expenseTypeLabel}
          value=""
          onChange={(e) =>
            run({ expenseType: (e.target.value || null) as TransactionExpenseType | null })
          }
        >
          <MenuItem value="">{m.transactions.expenseTypeNone}</MenuItem>
          <MenuItem value="fixed">{m.transactions.expenseTypes.fixed}</MenuItem>
          <MenuItem value="variable">{m.transactions.expenseTypes.variable}</MenuItem>
          <MenuItem value="one_time">{m.transactions.expenseTypes.one_time}</MenuItem>
        </Select>
      </FormControl>

      {/* Tags */}
      <Button
        size="small"
        variant="outlined"
        startIcon={<LabelOutlinedIcon fontSize="small" />}
        disabled={isPending}
        onClick={() => {
          setTagInput("");
          setTagAddOpen(true);
        }}
      >
        {m.transactions.tags.bulkAdd}
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<LabelOutlinedIcon fontSize="small" />}
        disabled={isPending}
        onClick={() => {
          listTagsAction(accountId).then(setAvailableTags);
          setTagRemoveId("");
          setTagRemoveOpen(true);
        }}
      >
        {m.transactions.tags.bulkRemove}
      </Button>

      <Button
        size="small"
        variant="outlined"
        startIcon={<DriveFileMoveIcon fontSize="small" />}
        disabled={isPending}
        onClick={() => setMoveOpen(true)}
      >
        Mover
      </Button>

      {categories.length > 0 && (
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Categoria</InputLabel>
          <Select
            label="Categoria"
            value=""
            onChange={(e) => run({ categoryId: e.target.value as string })}
          >
            <MenuItem value="">Remover categoria</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <Box sx={{ flex: 1 }} />

      <Button
        size="small"
        variant="outlined"
        color="error"
        startIcon={<DeleteIcon />}
        disabled={isPending}
        onClick={() => (count > 5 ? setDeleteOpen(true) : handleDelete())}
      >
        Deletar
      </Button>
      <Button size="small" variant="text" onClick={onClear}>
        Cancelar
      </Button>

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
          label="Nome da tag"
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
          <MenuItem value="">Selecionar tag...</MenuItem>
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
