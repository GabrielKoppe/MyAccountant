"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useSnackbar } from "notistack";

import {
  createTableTypeAction,
  deleteTableTypeAction,
  updateTableTypeAction,
} from "@/actions/account-settings";
import {
  createTableTypeSchema,
  type CreateTableTypeInput,
  TOGGLEABLE_COLUMNS,
} from "@/lib/schemas/settings";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import { DialogShell } from "@/components/ui/DialogShell";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";

type TableTypeItem = {
  id: string;
  name: string;
  isDefault: boolean;
  hiddenColumns: Record<string, boolean>;
  tableCount: number;
};

type Props = {
  accountId: string;
  initialTypes: TableTypeItem[];
  title?: string;
};

const ALWAYS_VISIBLE = [
  { key: "occurredOn", label: "Data" },
  { key: "amount", label: "Valor" },
  { key: "description", label: "Descrição" },
];

export function TableTypesManager({ accountId, initialTypes, title }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [types, setTypes] = useState(initialTypes);
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TableTypeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TableTypeItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const form = useForm<CreateTableTypeInput>({
    resolver: zodResolver(createTableTypeSchema),
    defaultValues: { name: "", hiddenColumns: {} },
  });

  function openCreate() {
    form.reset({ name: "", hiddenColumns: {} });
    setCreateOpen(true);
  }

  function openEdit(type: TableTypeItem) {
    setEditTarget(type);
    setExpandedId(type.id);
  }

  function closeDialog() {
    setCreateOpen(false);
    setEditTarget(null);
    form.reset();
  }

  async function onSubmitCreate(values: CreateTableTypeInput) {
    const result = await createTableTypeAction(accountId, values);
    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }
    setTypes((prev) => [
      ...prev,
      { id: result.data.tableTypeId, ...values, isDefault: false, tableCount: 0 },
    ]);
    enqueueSnackbar(m.settings.tableTypes.created, { variant: "success" });
    closeDialog();
  }

  function handleToggleColumn(typeId: string, key: string, hidden: boolean) {
    startTransition(async () => {
      const current = types.find((t) => t.id === typeId);
      if (!current) return;

      const newHidden = { ...current.hiddenColumns };
      if (hidden) newHidden[key] = true;
      else delete newHidden[key];

      const result = await updateTableTypeAction(accountId, {
        tableTypeId: typeId,
        hiddenColumns: newHidden,
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setTypes((prev) =>
        prev.map((t) => (t.id === typeId ? { ...t, hiddenColumns: newHidden } : t)),
      );
    });
  }

  function handleRename(typeId: string, name: string) {
    startTransition(async () => {
      const result = await updateTableTypeAction(accountId, { tableTypeId: typeId, name });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setTypes((prev) => prev.map((t) => (t.id === typeId ? { ...t, name } : t)));
      enqueueSnackbar(m.settings.tableTypes.updated, { variant: "success" });
      setEditTarget(null);
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteTableTypeAction(accountId, { tableTypeId: target.id });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setTypes((prev) => prev.filter((t) => t.id !== target.id));
      enqueueSnackbar(m.settings.tableTypes.deleted, { variant: "success" });
    });
  }

  return (
    <PageSettingsContainer
      title={title}
      secondary={
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          {m.settings.tableTypes.createButton}
        </Button>
      }
    >
      {types.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {m.settings.tableTypes.noTableTypes}
        </Typography>
      )}

      <Stack spacing={1}>
        {types.map((type) => {
          const isExpanded = expandedId === type.id;
          const hiddenKeys = Object.keys(type.hiddenColumns).filter((k) => type.hiddenColumns[k]);

          return (
            <Paper key={type.id} variant="outlined">
              {/* Header */}
              <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1.5, gap: 1 }}>
                {/* Edit inline or show name */}
                {editTarget?.id === type.id ? (
                  <EditableNameField
                    initialName={type.name}
                    onSave={(name) => handleRename(type.id, name)}
                    onCancel={() => setEditTarget(null)}
                    disabled={isPending}
                  />
                ) : (
                  <>
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      noWrap
                      sx={{ flex: 1, minWidth: 0 }}
                    >
                      {type.name}
                    </Typography>
                    {type.isDefault && (
                      <Chip
                        label={m.settings.tableTypes.defaultBadge}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    )}
                    {hiddenKeys.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {hiddenKeys.length} coluna(s) oculta(s)
                      </Typography>
                    )}
                    <Tooltip title={m.common.edit}>
                      <IconButton size="small" onClick={() => openEdit(type)}>
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    {!type.isDefault && (
                      <Tooltip title={m.common.delete}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteTarget(type)}
                          disabled={isPending}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => setExpandedId(isExpanded ? null : type.id)}
                    >
                      {isExpanded ? (
                        <ExpandLessIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <ExpandMoreIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </>
                )}
              </Box>

              {/* Colunas expandidas */}
              <Collapse in={isExpanded}>
                <Divider />
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="caption" fontWeight="bold" color="text.secondary">
                    {m.settings.tableTypes.alwaysVisible}
                  </Typography>
                  <List dense disablePadding>
                    {ALWAYS_VISIBLE.map(({ key, label }) => (
                      <ListItem key={key} dense disableGutters>
                        <FormControlLabel
                          sx={{ m: 0 }}
                          control={<Switch size="small" checked disabled />}
                          label={label}
                        />
                      </ListItem>
                    ))}
                  </List>

                  <Typography
                    variant="caption"
                    fontWeight="bold"
                    color="text.secondary"
                    sx={{ mt: 1, display: "block" }}
                  >
                    {m.settings.tableTypes.configurable}
                  </Typography>
                  <List dense disablePadding>
                    {TOGGLEABLE_COLUMNS.map(({ key, label }) => (
                      <ListItem key={key} dense disableGutters>
                        <FormControlLabel
                          sx={{ m: 0 }}
                          control={
                            <Switch
                              size="small"
                              checked={!type.hiddenColumns[key]}
                              disabled={type.isDefault || isPending}
                              onChange={(e) => handleToggleColumn(type.id, key, !e.target.checked)}
                            />
                          }
                          label={label}
                        />
                      </ListItem>
                    ))}
                  </List>
                  {type.isDefault && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      O tipo padrão sempre exibe todas as colunas.
                    </Typography>
                  )}
                </Box>
              </Collapse>
            </Paper>
          );
        })}
      </Stack>

      {/* Create dialog */}
      <DialogShell
        open={createOpen}
        onClose={closeDialog}
        maxWidth="xs"
        title={m.settings.tableTypes.createTitle}
        loading={form.formState.isSubmitting}
        actions={
          <>
            <Button size="small" onClick={closeDialog}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              type="submit"
              form="table-types-form"
              variant="contained"
              endIcon={form.formState.isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {m.common.create}
            </Button>
          </>
        }
      >
        <form id="table-types-form" onSubmit={form.handleSubmit(onSubmitCreate)} noValidate>
          <Stack spacing={layout.stack}>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label={m.settings.tableTypes.nameLabel}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? m.settings.tableTypes.createHelperText}
                  fullWidth
                  autoFocus
                />
              )}
            />
          </Stack>
        </form>
      </DialogShell>

      {/* Delete dialog */}
      <DialogShell
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        title={m.settings.tableTypes.deleteTitle}
        description={m.settings.tableTypes.deleteConfirm}
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
            >
              {m.common.delete}
            </Button>
          </>
        }
      >
        {deleteTarget && deleteTarget.tableCount > 0 ? (
          <Alert severity="warning">
            {m.settings.tableTypes.deleteWarning(deleteTarget.tableCount)}
          </Alert>
        ) : null}
      </DialogShell>
    </PageSettingsContainer>
  );
}

function EditableNameField({
  initialName,
  onSave,
  onCancel,
  disabled,
}: {
  initialName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState(initialName);
  return (
    <Box sx={{ display: "flex", gap: 1, flex: 1, alignItems: "center" }}>
      <TextField
        size="small"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        disabled={disabled}
        sx={{ flex: 1 }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(value);
          }
          if (e.key === "Escape") onCancel();
        }}
      />
      <Button size="small" variant="contained" onClick={() => onSave(value)} disabled={disabled}>
        {m.common.save}
      </Button>
      <Button size="small" onClick={onCancel} disabled={disabled}>
        {m.common.cancel}
      </Button>
    </Box>
  );
}
