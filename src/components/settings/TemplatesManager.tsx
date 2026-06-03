"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useSnackbar } from "notistack";

import { deleteTemplateAction, updateTemplateAction } from "@/actions/csv-import";
import { m } from "@/lib/messages";
import type { ImportMapping } from "@/lib/schemas/csv-import";

type TemplateItem = {
  id: string;
  name: string;
  mapping: ImportMapping;
  createdAt: string;
};

type Props = {
  accountId: string;
  initialTemplates: TemplateItem[];
};

export function TemplatesManager({ accountId, initialTemplates }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState<TemplateItem[]>(initialTemplates);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openRename(t: TemplateItem) {
    setRenameId(t.id);
    setRenameValue(t.name);
  }

  function handleRename() {
    if (!renameId || !renameValue.trim()) return;
    startTransition(async () => {
      const result = await updateTemplateAction(accountId, {
        templateId: renameId,
        name: renameValue.trim(),
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setTemplates((prev) =>
        prev.map((t) => (t.id === renameId ? { ...t, name: renameValue.trim() } : t)),
      );
      enqueueSnackbar(m.templates.updated, { variant: "success" });
      setRenameId(null);
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    setDeleteId(null);
    startTransition(async () => {
      const result = await deleteTemplateAction(accountId, { templateId: deleteId });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== deleteId));
      enqueueSnackbar(m.templates.deleted, { variant: "success" });
    });
  }

  function summaryLabel(mapping: ImportMapping): string {
    const parts = [
      `Data: ${mapping.columns.date || "—"}`,
      `Valor: ${mapping.columns.amount || "—"}`,
      mapping.columns.description ? `Descr: ${mapping.columns.description}` : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }

  if (templates.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          py: 8,
          color: "text.secondary",
          gap: 2,
        }}
      >
        <UploadFileIcon sx={{ fontSize: 64, opacity: 0.3 }} />
        <Typography variant="h6">{m.templates.noTemplates}</Typography>
        <Typography variant="body2" textAlign="center">
          {m.templates.noTemplatesHint}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Stack spacing={1}>
        {templates.map((t) => (
          <Paper key={t.id} variant="outlined" sx={{ px: 2, py: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <UploadFileIcon sx={{ fontSize: 16 }} color="action" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight="medium" noWrap>
                  {t.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {summaryLabel(t.mapping)}
                </Typography>
              </Box>
              <Chip
                label={`${t.mapping.amountFormat.toUpperCase()} · ${t.mapping.dateFormat}`}
                size="small"
                variant="outlined"
              />
              <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0 }}>
                <IconButton size="small" onClick={() => openRename(t)} disabled={isPending}>
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setDeleteId(t.id)}
                  disabled={isPending}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Box>
          </Paper>
        ))}
      </Stack>

      {/* Rename dialog */}
      <Dialog open={!!renameId} onClose={() => setRenameId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1, fontSize: "0.9375rem", fontWeight: 600 }}>
          Renomear template
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            label={m.templates.nameLabel}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            fullWidth
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleRename();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button size="small" onClick={() => setRenameId(null)}>
            {m.common.cancel}
          </Button>
          <Button size="small" variant="contained" onClick={handleRename} disabled={isPending}>
            {m.common.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: "0.9375rem", fontWeight: 600 }}>Deletar template</DialogTitle>
        <DialogContent>
          <DialogContentText variant="body2">{m.templates.deleteConfirm}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button size="small" onClick={() => setDeleteId(null)}>
            {m.common.cancel}
          </Button>
          <Button
            size="small"
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={isPending}
          >
            {m.common.delete}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
