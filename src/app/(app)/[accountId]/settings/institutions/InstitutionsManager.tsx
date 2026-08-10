"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
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
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { m } from "@/lib/messages";

type Institution = { id: string; name: string };

type Props = {
  accountId: string;
  initialInstitutions: Institution[];
};

export function InstitutionsManager({ accountId, initialInstitutions }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [institutions, setInstitutions] = useState(initialInstitutions);
  const [isPending, startTransition] = useTransition();
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");
  const [editTarget, setEditTarget] = useState<Institution | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Extraído do onClick inline do botão antigo: agora é a ação primária do shell.
  function openCreate() {
    setCreateOpen(true);
    setNameInput("");
    setNameError("");
  }

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

  function handleSave() {
    if (!nameInput.trim()) {
      setNameError("Nome obrigatório");
      return;
    }
    setNameError("");
    startTransition(async () => {
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
    });
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
    <SettingsPageShell
      family="Estrutura"
      title={m.settings.nav.institutions}
      // Chip simples de contagem (§7.5: "9") — vem dos dados que a página já carregou.
      count={String(institutions.length)}
      purpose={m.settings.purposes.institutions}
      // `itemCount` só alimenta o gate de toolbar do shell (>12). A página ainda não
      // tem busca/filtro (escopo da Spec 68), então hoje não renderiza nada.
      itemCount={institutions.length}
      primaryAction={{
        label: m.settings.institutions.createButton,
        icon: <AddIcon />,
        onClick: openCreate,
      }}
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
      <SettingsDialog
        open={createOpen || !!editTarget}
        onClose={closeDialog}
        size="form"
        title={editTarget ? m.common.edit : m.settings.institutions.createButton}
        loading={isPending}
        actions={
          <>
            <Button size="small" onClick={closeDialog}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleSave}
              endIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
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
      </SettingsDialog>

      {/* Delete dialog */}
      <SettingsDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        size="confirm"
        title={m.settings.institutions.deleteTitle}
        description={m.settings.institutions.deleteConfirm}
        actions={
          <>
            <Button size="small" onClick={() => setDeleteTarget(null)}>
              {m.common.cancel}
            </Button>
            <Button size="small" color="error" variant="contained" onClick={confirmDelete}>
              {m.common.delete}
            </Button>
          </>
        }
      />
    </SettingsPageShell>
  );
}
