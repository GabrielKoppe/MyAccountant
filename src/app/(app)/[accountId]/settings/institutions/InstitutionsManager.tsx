"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { useSnackbar } from "notistack";

import {
  createInstitutionAction,
  deleteInstitutionAction,
  updateInstitutionAction,
} from "@/actions/account-settings";
import { DialogShell } from "@/components/ui/DialogShell";
import { m } from "@/lib/messages";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";

type Institution = { id: string; name: string };

type Props = {
  accountId: string;
  initialInstitutions: Institution[];
  title?: string;
};

export function InstitutionsManager({ accountId, initialInstitutions, title }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [institutions, setInstitutions] = useState(initialInstitutions);
  const [isPending, startTransition] = useTransition();
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");
  const [editTarget, setEditTarget] = useState<Institution | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  function openEdit(inst: Institution) {
    setEditTarget(inst);
    setNameInput(inst.name);
    setNameError("");
  }

  function closeDialog() {
    setCreateOpen(false);
    setEditTarget(null);
    setNameInput("");
    setNameError("");
  }

  async function handleSave() {
    if (!nameInput.trim()) {
      setNameError("Nome obrigatório");
      return;
    }
    setNameError("");

    if (editTarget) {
      const result = await updateInstitutionAction(accountId, {
        institutionId: editTarget.id,
        name: nameInput.trim(),
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setInstitutions((prev) =>
        prev.map((i) => (i.id === editTarget.id ? { ...i, name: nameInput.trim() } : i)),
      );
      enqueueSnackbar(m.settings.institutions.updated, { variant: "success" });
    } else {
      const result = await createInstitutionAction(accountId, { name: nameInput.trim() });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setInstitutions((prev) =>
        [...prev, { id: result.data.institutionId, name: nameInput.trim() }].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      enqueueSnackbar(m.settings.institutions.created, { variant: "success" });
    }
    closeDialog();
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteInstitutionAction(accountId, { institutionId: target.id });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setInstitutions((prev) => prev.filter((i) => i.id !== target.id));
      enqueueSnackbar(m.settings.institutions.deleted, { variant: "success" });
    });
  }

  return (
    <PageSettingsContainer
      title={title}
      secondary={
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => {
            setCreateOpen(true);
            setNameInput("");
            setNameError("");
          }}
        >
          {m.settings.institutions.createButton}
        </Button>
      }
    >
      {institutions.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {m.settings.institutions.noInstitutions}
        </Typography>
      ) : (
        <Stack spacing={1}>
          {institutions.map((inst) => (
            <Paper key={inst.id} variant="outlined" sx={{ px: 2, py: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  variant="body2"
                  fontWeight="medium"
                  noWrap
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  {inst.name}
                </Typography>
                <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0 }}>
                  <Tooltip title={m.common.edit}>
                    <IconButton size="small" onClick={() => openEdit(inst)}>
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={m.common.delete}>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(inst)}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Create / Edit dialog */}
      <DialogShell
        open={createOpen || !!editTarget}
        onClose={closeDialog}
        maxWidth="xs"
        title={editTarget ? m.common.edit : m.settings.institutions.createButton}
        actions={
          <>
            <Button size="small" onClick={closeDialog}>
              {m.common.cancel}
            </Button>
            <Button size="small" variant="contained" onClick={handleSave}>
              {m.common.save}
            </Button>
          </>
        }
      >
        <TextField
          label={m.settings.institutions.nameLabel}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          error={!!nameError}
          helperText={nameError}
          fullWidth
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
        />
      </DialogShell>

      {/* Delete dialog */}
      <DialogShell
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        title={m.common.delete}
        actions={
          <>
            <Button size="small" onClick={() => setDeleteTarget(null)}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={confirmDelete}
              disabled={isPending}
            >
              {m.common.delete}
            </Button>
          </>
        }
      >
        <Typography variant="body2">{m.settings.institutions.deleteConfirm}</Typography>
      </DialogShell>
    </PageSettingsContainer>
  );
}
