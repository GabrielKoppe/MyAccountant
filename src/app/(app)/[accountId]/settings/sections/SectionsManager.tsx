"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { SectionCountType } from "@prisma/client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { useSnackbar } from "notistack";

import {
  createSectionAction,
  deleteSectionAction,
  reorderSectionsAction,
  updateSectionAction,
} from "@/actions/account-settings";
import { createSectionSchema, type CreateSectionInput } from "@/lib/schemas/settings";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import { DialogShell } from "@/components/ui/DialogShell";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";

type Section = {
  id: string;
  name: string;
  countType: SectionCountType;
  isActive: boolean;
  order: number;
};

const COUNT_TYPE_COLORS: Record<SectionCountType, "success" | "error" | "default" | "warning"> = {
  add: "success",
  subtract: "error",
  ignore: "default",
  neutral: "warning",
};

type Props = {
  accountId: string;
  initialSections: Section[];
  title?: string;
};

export function SectionsManager({ accountId, initialSections, title }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [sections, setSections] = useState(initialSections);
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Section | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Section | null>(null);

  const form = useForm<CreateSectionInput>({
    resolver: zodResolver(createSectionSchema),
    defaultValues: { name: "", countType: "subtract", isActive: true },
  });

  function openEdit(section: Section) {
    form.reset({ name: section.name, countType: section.countType, isActive: section.isActive });
    setEditTarget(section);
  }

  function closeDialog() {
    setCreateOpen(false);
    setEditTarget(null);
    form.reset();
  }

  async function onSubmit(values: CreateSectionInput) {
    if (editTarget) {
      const result = await updateSectionAction(accountId, {
        sectionId: editTarget.id,
        ...values,
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setSections((prev) => prev.map((s) => (s.id === editTarget.id ? { ...s, ...values } : s)));
      enqueueSnackbar(m.settings.sections.updated, { variant: "success" });
    } else {
      const result = await createSectionAction(accountId, values);
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setSections((prev) => [
        ...prev,
        { id: result.data.sectionId, ...values, order: prev.length },
      ]);
      enqueueSnackbar(m.settings.sections.created, { variant: "success" });
    }
    closeDialog();
  }

  function move(index: number, direction: -1 | 1) {
    const newSections = [...sections];
    const target = index + direction;
    if (target < 0 || target >= newSections.length) return;
    [newSections[index], newSections[target]] = [newSections[target], newSections[index]];
    setSections(newSections);
    startTransition(async () => {
      const result = await reorderSectionsAction(accountId, {
        orderedIds: newSections.map((s) => s.id),
      });
      if (!result.ok) enqueueSnackbar(result.error.message, { variant: "error" });
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteSectionAction(accountId, { sectionId: target.id });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setSections((prev) => prev.filter((s) => s.id !== target.id));
      enqueueSnackbar(m.settings.sections.deleted, { variant: "success" });
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
          onClick={() => setCreateOpen(true)}
        >
          {m.settings.sections.createButton}
        </Button>
      }
    >
      {sections.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {m.settings.sections.noSections}
        </Typography>
      ) : (
        <Stack spacing={1}>
          {sections.map((section, index) => (
            <Paper key={section.id} variant="outlined" sx={{ px: 2, py: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight="medium" noWrap>
                    {section.name}
                  </Typography>
                  <Chip
                    size="small"
                    label={m.settings.sections.countTypes[section.countType]}
                    color={COUNT_TYPE_COLORS[section.countType]}
                  />
                  {!section.isActive && (
                    <Chip size="small" label="Inativa" variant="outlined" color="default" />
                  )}
                </Box>
                <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0 }}>
                  <Tooltip title="Mover para cima">
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
                  <Tooltip title="Mover para baixo">
                    <span>
                      <IconButton
                        size="small"
                        disabled={index === sections.length - 1 || isPending}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={m.common.edit}>
                    <IconButton size="small" onClick={() => openEdit(section)}>
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={m.common.delete}>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(section)}>
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
        title={editTarget ? m.settings.sections.editTitle : m.settings.sections.createTitle}
        loading={form.formState.isSubmitting}
        actions={
          <>
            <Button size="small" onClick={closeDialog}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              type="submit"
              form="sections-form"
              variant="contained"
              endIcon={
                form.formState.isSubmitting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
            >
              {m.common.save}
            </Button>
          </>
        }
      >
        <form id="sections-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Stack spacing={layout.stack}>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label={m.settings.sections.nameLabel}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  fullWidth
                  autoFocus
                />
              )}
            />

            <Controller
              name="countType"
              control={form.control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>{m.settings.sections.countTypeLabel}</InputLabel>
                  <Select
                    {...field}
                    label={m.settings.sections.countTypeLabel}
                    renderValue={(value) => (
                      <Chip
                        size="small"
                        label={
                          (m.settings.sections.countTypes as Record<SectionCountType, string>)[
                            value as SectionCountType
                          ]
                        }
                        color={COUNT_TYPE_COLORS[value as SectionCountType]}
                      />
                    )}
                  >
                    {(["add", "subtract", "ignore", "neutral"] as SectionCountType[]).map(
                      (type) => (
                        <MenuItem key={type} value={type}>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                            <Chip
                              size="small"
                              label={
                                (
                                  m.settings.sections.countTypes as Record<SectionCountType, string>
                                )[type]
                              }
                              color={COUNT_TYPE_COLORS[type]}
                              sx={{ alignSelf: "flex-start" }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {
                                (
                                  m.settings.sections.countTypeHints as Record<
                                    SectionCountType,
                                    string
                                  >
                                )[type]
                              }
                            </Typography>
                          </Box>
                        </MenuItem>
                      ),
                    )}
                  </Select>
                </FormControl>
              )}
            />

            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch size="small" checked={field.value} onChange={field.onChange} />}
                  label={
                    <Box>
                      <Typography variant="body2">{m.settings.sections.isActiveLabel}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {m.settings.sections.isActiveHint}
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start", ml: 0 }}
                />
              )}
            />
          </Stack>
        </form>
      </DialogShell>

      {/* Delete confirmation */}
      <DialogShell
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        title={m.settings.sections.deleteTitle}
        description={m.settings.sections.deleteConfirm}
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
    </PageSettingsContainer>
  );
}
