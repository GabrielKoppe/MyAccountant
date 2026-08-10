"use client";

import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useState, useTransition } from "react";

import {
  createChecklistItemAction,
  deleteChecklistItemAction,
  reorderChecklistAction,
  updateChecklistItemAction,
} from "@/actions/checklist";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { containers } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

type ChecklistItem = { id: string; label: string; position: number };

type Props = {
  accountId: string;
  initialItems: ChecklistItem[];
  title?: string;
};

export function ChecklistManager({ accountId, initialItems, title }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [labelInput, setLabelInput] = useState("");
  const [labelError, setLabelError] = useState("");
  const [editTarget, setEditTarget] = useState<ChecklistItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const cm = m.settings.checklist;

  function openEdit(item: ChecklistItem) {
    setEditTarget(item);
    setLabelInput(item.label);
    setLabelError("");
  }

  function closeDialog() {
    setCreateOpen(false);
    setEditTarget(null);
    setLabelInput("");
    setLabelError("");
  }

  function handleSave() {
    const label = labelInput.trim();
    if (!label) {
      setLabelError(cm.labelRequired);
      return;
    }
    setLabelError("");
    startTransition(async () => {
      if (editTarget) {
        const result = await updateChecklistItemAction(accountId, {
          itemId: editTarget.id,
          label,
        });
        if (!result.ok) {
          enqueueSnackbar(result.error.message, { variant: "error" });
          return;
        }
        setItems((prev) => prev.map((i) => (i.id === editTarget.id ? { ...i, label } : i)));
        enqueueSnackbar(cm.updated, { variant: "success" });
      } else {
        const result = await createChecklistItemAction(accountId, { label });
        if (!result.ok) {
          enqueueSnackbar(result.error.message, { variant: "error" });
          return;
        }
        setItems((prev) => [...prev, { id: result.data.itemId, label, position: prev.length }]);
        enqueueSnackbar(cm.created, { variant: "success" });
      }
      closeDialog();
    });
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    startTransition(async () => {
      const result = await reorderChecklistAction(accountId, {
        orderedIds: next.map((i) => i.id),
      });
      if (!result.ok) enqueueSnackbar(result.error.message, { variant: "error" });
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteChecklistItemAction(accountId, { itemId: target.id });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== target.id));
      enqueueSnackbar(cm.deleted, { variant: "success" });
    });
  }

  return (
    <SettingsPageShell
      family="Planejamento"
      // `title` continua vindo da page (RSC) — o fallback existe só porque a prop é opcional.
      title={title ?? cm.title}
      // Chip do §7.5 sem a parte "· N grupos": `ChecklistGroup` não existe (D1),
      // agrupamento é decisão da Spec 71.
      count={m.months.automations.templateItems(items.length)}
      purpose={m.settings.purposes.checklist}
      itemCount={items.length}
      primaryAction={{
        label: cm.createButton,
        icon: <AddIcon />,
        onClick: () => {
          setCreateOpen(true);
          setLabelInput("");
          setLabelError("");
        },
      }}
    >
      {/* O shell não limita a largura do conteúdo; este Box preserva a largura de
          leitura (containers.md) que a lista tinha antes da migração. */}
      <Box sx={{ maxWidth: containers.md }}>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {cm.empty}
          </Typography>
        ) : (
          <Stack spacing={1}>
            {items.map((item, index) => (
              <Paper key={item.id} variant="outlined" sx={{ px: 2, py: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography
                    variant="body2"
                    fontWeight="medium"
                    noWrap
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    {item.label}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0 }}>
                    <Tooltip title={cm.moveUp}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={index === 0 || isPending}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={cm.moveDown}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={index === items.length - 1 || isPending}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={m.common.edit}>
                      <IconButton size="small" onClick={() => openEdit(item)}>
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={m.common.delete}>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(item)}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Stack>
        )}
      </Box>

      {/* Create / Edit dialog */}
      <SettingsDialog
        open={createOpen || !!editTarget}
        onClose={closeDialog}
        size="form"
        title={editTarget ? m.common.edit : cm.createButton}
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
          label={cm.labelLabel}
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          error={!!labelError}
          helperText={labelError}
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
        title={cm.deleteTitle}
        description={cm.deleteConfirm}
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
