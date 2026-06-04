"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { SectionCountType } from "@prisma/client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
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
import { DialogShell } from "@/components/ui/DialogShell";

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
};

export function SectionsManager({ accountId, initialSections }: Props) {
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
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          {m.settings.sections.createButton}
        </Button>
      </Box>

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
      <Box component="form" onSubmit={form.handleSubmit(onSubmit)}>
        <DialogShell
          open={createOpen || !!editTarget}
          onClose={closeDialog}
          maxWidth="xs"
          title={editTarget ? m.settings.sections.editTitle : m.settings.sections.createTitle}
          actions={
            <>
              <Button size="small" onClick={closeDialog}>
                {m.common.cancel}
              </Button>
              <Button
                size="small"
                type="submit"
                variant="contained"
                disabled={form.formState.isSubmitting}
              >
                {m.common.save}
              </Button>
            </>
          }
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
                <FormControl>
                  <FormLabel
                    sx={{
                      fontSize: "0.7rem",
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "text.secondary",
                      mb: 0.75,
                      "&.Mui-focused": { color: "text.secondary" },
                    }}
                  >
                    {m.settings.sections.countTypeLabel}
                  </FormLabel>
                  <RadioGroup
                    {...field}
                    row
                    sx={{
                      gap: 0,
                      "& .MuiFormControlLabel-root": { mr: 2 },
                      "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" },
                    }}
                  >
                    <FormControlLabel value="add" control={<Radio size="small" />} label="Somar" />
                    <FormControlLabel
                      value="subtract"
                      control={<Radio size="small" />}
                      label="Subtrair"
                    />
                    <FormControlLabel
                      value="ignore"
                      control={<Radio size="small" />}
                      label="Ignorar"
                    />
                    <FormControlLabel
                      value="neutral"
                      control={<Radio size="small" />}
                      label="Neutro"
                    />
                  </RadioGroup>
                </FormControl>
              )}
            />

            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch size="small" checked={field.value} onChange={field.onChange} />}
                  label={m.settings.sections.isActiveLabel}
                  sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" }, ml: 0 }}
                />
              )}
            />
          </Box>
        </DialogShell>
      </Box>

      {/* Delete confirmation */}
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
        <Typography variant="body2">{m.settings.sections.deleteConfirm}</Typography>
      </DialogShell>
    </>
  );
}
