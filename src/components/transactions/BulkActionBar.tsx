"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import StarIcon from "@mui/icons-material/Star";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import { useSnackbar } from "notistack";

import { bulkDeleteAction, bulkUpdateAction } from "@/actions/transactions";
import type { BulkUpdateInput } from "@/lib/schemas/transaction";
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
  institutions,
  onClear,
  onMoved,
  onBulkUpdated,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

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
        enqueueSnackbar(`${count} transação(ões) deletada(s).`, { variant: "success" });
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
        title="Deletar transações"
        actions={
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button color="error" variant="contained" onClick={handleDelete} disabled={isPending}>
              Deletar {count} transações
            </Button>
          </>
        }
      >
        <Typography variant="body2">
          Tem certeza que deseja deletar {count} transações? Esta ação não pode ser desfeita.
        </Typography>
      </DialogShell>

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
    </Paper>
  );
}
