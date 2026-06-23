"use client";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";

import { m } from "@/lib/messages";
import { DialogShell } from "@/components/ui/DialogShell";

type RenameDialogProps = {
  open: boolean;
  loading: boolean;
  name: string;
  onChangeName: (name: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function FinanceTableRenameDialog({
  open,
  loading,
  name,
  onChangeName,
  onClose,
  onConfirm,
}: RenameDialogProps) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title={m.financeTables.editTitle}
      loading={loading}
      actions={
        <>
          <Button onClick={onClose}>{m.common.cancel}</Button>
          <Button
            variant="contained"
            onClick={onConfirm}
            endIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {m.common.save}
          </Button>
        </>
      }
    >
      <TextField
        label={m.financeTables.nameLabel}
        value={name}
        onChange={(e) => onChangeName(e.target.value)}
        fullWidth
        autoFocus
        sx={{ mt: 2 }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onConfirm();
          }
        }}
      />
    </DialogShell>
  );
}

type DeleteDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function FinanceTableDeleteDialog({ open, onClose, onConfirm }: DeleteDialogProps) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title={m.financeTables.menuDelete}
      description={m.financeTables.deleteConfirm}
      actions={
        <>
          <Button onClick={onClose}>{m.common.cancel}</Button>
          <Button color="error" variant="contained" onClick={onConfirm}>
            {m.common.delete}
          </Button>
        </>
      }
    />
  );
}

type SaveModelDialogProps = {
  open: boolean;
  loading: boolean;
  modelName: string;
  onChangeModelName: (name: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function FinanceTableSaveModelDialog({
  open,
  loading,
  modelName,
  onChangeModelName,
  onClose,
  onConfirm,
}: SaveModelDialogProps) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title={m.tableModels.saveAsModelTitle}
      loading={loading}
      actions={
        <>
          <Button onClick={onClose}>{m.common.cancel}</Button>
          <Button
            variant="contained"
            onClick={onConfirm}
            disabled={!modelName.trim()}
            endIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {m.tableModels.saveModelButton}
          </Button>
        </>
      }
    >
      <TextField
        label={m.tableModels.nameLabel}
        value={modelName}
        onChange={(e) => onChangeModelName(e.target.value)}
        fullWidth
        autoFocus
        helperText={m.tableModels.saveModelHelperText}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onConfirm();
          }
        }}
      />
    </DialogShell>
  );
}
