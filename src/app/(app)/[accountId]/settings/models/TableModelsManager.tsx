"use client";

import { useState, useTransition } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TableChartIcon from "@mui/icons-material/TableChart";
import { useSnackbar } from "notistack";

import {
  createTemplateManualAction,
  deleteTemplateAction,
  updateTemplateAction,
} from "@/actions/table-templates";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";
import { DialogShell } from "@/components/ui/DialogShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TemplateItemsEditor } from "../../../../../components/settings/TemplateItemsEditor";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";

type TemplateItem = {
  id: string;
  day: number;
  amountCents: string;
  description: string | null;
  isPending: boolean;
  categoryId: string | null;
  subcategoryId: string | null;
  institutionId: string | null;
  responsibleUserId: string | null;
  cardInstallment: string | null;
  investmentType: import("@/lib/schemas/transaction").InvestmentType | null;
  displayOrder: number;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  tableTypeId: string | null;
  countInMonth: boolean;
  autoApply: boolean;
  autoSectionId: string | null;
  autoTableTypeId: string | null;
  _count: { items: number };
  tableType: { id: string; name: string } | null;
  items: TemplateItem[];
};

type Section = { id: string; name: string };
type TableType = { id: string; name: string; isDefault: boolean };

type Props = {
  accountId: string;
  initialTemplates: Template[];
  categories: { id: string; name: string; subcategories: { id: string; name: string }[] }[];
  institutions: { id: string; name: string }[];
  members: { id: string; name: string | null; email: string }[];
  tableTypes: TableType[];
  sections: Section[];
  title?: string;
};

export function TableModelsManager({
  accountId,
  initialTemplates,
  categories,
  institutions,
  members,
  tableTypes,
  sections,
  title,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItemsId, setEditItemsId] = useState<string | null>(null);

  function handleCreate() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await createTemplateManualAction(accountId, { name: newName.trim() });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setTemplates((prev) => [
        ...prev,
        {
          ...result.data,
          description: null,
          tableTypeId: null,
          countInMonth: true,
          autoApply: false,
          autoSectionId: null,
          autoTableTypeId: null,
          tableType: null,
          _count: { items: 0 },
          items: [],
        },
      ]);
      enqueueSnackbar(m.tableModels.created, { variant: "success" });
      setCreateOpen(false);
      setNewName("");
    });
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
      enqueueSnackbar(m.tableModels.updated, { variant: "success" });
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
      enqueueSnackbar(m.tableModels.deleted, { variant: "success" });
    });
  }

  function handleItemsUpdated(templateId: string, items: TemplateItem[]) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, items, _count: { items: items.length } } : t)),
    );
  }

  function handleAutoApplySaved(
    templateId: string,
    update: Pick<Template, "autoApply" | "autoSectionId" | "autoTableTypeId">,
  ) {
    setTemplates((prev) => prev.map((t) => (t.id === templateId ? { ...t, ...update } : t)));
  }

  const editTemplate = templates.find((t) => t.id === editItemsId);

  if (templates.length === 0 && !createOpen) {
    return (
      <Box>
        <Box sx={{ textAlign: "center", py: layout.page, color: "text.secondary" }}>
          <TableChartIcon sx={{ fontSize: 64, opacity: 0.3 }} />
          <Typography variant="h6" mt={1}>
            {m.tableModels.noModels}
          </Typography>
          <Typography variant="body2" mt={0.5} mb={3}>
            {m.tableModels.noModelsHint}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            {m.tableModels.createButton}
          </Button>
        </Box>
        <CreateDialog
          open={createOpen}
          name={newName}
          onNameChange={setNewName}
          onConfirm={handleCreate}
          onClose={() => setCreateOpen(false)}
          isPending={isPending}
        />
      </Box>
    );
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
          {m.tableModels.createButton}
        </Button>
      }
    >
      <Stack spacing={1}>
        {templates.map((t) => (
          <Accordion key={t.id} variant="outlined">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, mr: 1 }}>
                <TableChartIcon fontSize="small" color="action" />
                <Typography fontWeight="medium">{t.name}</Typography>
                <Chip
                  label={m.tableModels.itemCount(t._count.items)}
                  size="small"
                  variant="outlined"
                />
                {t.tableType && <Chip label={t.tableType.name} size="small" />}
                {t.autoApply && (
                  <StatusBadge variant="success">{m.tableModels.autoApplyBadge}</StatusBadge>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {t.items.length > 0 ? (
                <Table size="small" sx={{ mb: layout.stack }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "background.default" }}>
                      <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Dia</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Descrição</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: "bold" }} align="right">
                        Valor
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {t.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ fontSize: 12 }}>Dia {item.day}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>
                          {item.description ?? (
                            <Typography variant="caption" color="text.disabled">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }} align="right">
                          <Typography
                            variant="caption"
                            color={BigInt(item.amountCents) < 0n ? "error.main" : "success.main"}
                          >
                            {formatCentsToBrl(BigInt(item.amountCents))}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: layout.stack }}>
                  Sem itens. Clique em "Editar itens" para adicionar.
                </Typography>
              )}

              <Box sx={{ display: "flex", gap: 1 }}>
                <Button size="small" startIcon={<AddIcon />} onClick={() => setEditItemsId(t.id)}>
                  {m.tableModels.editItems}
                </Button>
                <IconButton
                  size="small"
                  onClick={() => {
                    setRenameId(t.id);
                    setRenameValue(t.name);
                  }}
                >
                  <DriveFileRenameOutlineIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setDeleteId(t.id)}
                  disabled={isPending}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>

              <AutoApplySection
                template={t}
                accountId={accountId}
                sections={sections}
                tableTypes={tableTypes}
                onSaved={(update) => handleAutoApplySaved(t.id, update)}
              />
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>

      <CreateDialog
        open={createOpen}
        name={newName}
        onNameChange={setNewName}
        onConfirm={handleCreate}
        onClose={() => {
          setCreateOpen(false);
          setNewName("");
        }}
        isPending={isPending}
      />

      <DialogShell
        open={!!renameId}
        onClose={() => setRenameId(null)}
        maxWidth="xs"
        title={m.tableModels.renameTitle}
        loading={isPending}
        actions={
          <>
            <Button onClick={() => setRenameId(null)}>{m.common.cancel}</Button>
            <Button
              variant="contained"
              onClick={handleRename}
              endIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {m.common.save}
            </Button>
          </>
        }
      >
        <TextField
          label={m.tableModels.nameLabel}
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
      </DialogShell>

      <DialogShell
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        maxWidth="xs"
        title={m.tableModels.deleteTitle}
        description={m.tableModels.deleteConfirm}
        actions={
          <>
            <Button onClick={() => setDeleteId(null)}>{m.common.cancel}</Button>
            <Button color="error" variant="contained" onClick={handleDelete}>
              {m.common.delete}
            </Button>
          </>
        }
      />

      {editTemplate && (
        <TemplateItemsEditor
          accountId={accountId}
          template={editTemplate}
          categories={categories}
          institutions={institutions}
          members={members}
          open={!!editItemsId}
          onClose={() => setEditItemsId(null)}
          onItemsChanged={(items) => handleItemsUpdated(editTemplate.id, items)}
        />
      )}
    </PageSettingsContainer>
  );
}

// ─── AutoApplySection ──────────────────────────────────────────────────────────

type AutoApplySectionProps = {
  template: Template;
  accountId: string;
  sections: Section[];
  tableTypes: TableType[];
  onSaved: (update: Pick<Template, "autoApply" | "autoSectionId" | "autoTableTypeId">) => void;
};

function AutoApplySection({
  template,
  accountId,
  sections,
  tableTypes,
  onSaved,
}: AutoApplySectionProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPendingAutoApply, startAutoApplyTransition] = useTransition();
  const [autoApply, setAutoApply] = useState(template.autoApply ?? false);
  const [autoSectionId, setAutoSectionId] = useState(template.autoSectionId ?? "");
  const [autoTableTypeId, setAutoTableTypeId] = useState(template.autoTableTypeId ?? "");
  const [isDirty, setIsDirty] = useState(false);

  const canSave = !autoApply || (autoSectionId !== "" && autoTableTypeId !== "");

  function handleSave() {
    startAutoApplyTransition(async () => {
      const result = await updateTemplateAction(
        accountId,
        autoApply
          ? {
              templateId: template.id,
              autoApply: true,
              autoSectionId,
              autoTableTypeId,
            }
          : { templateId: template.id, autoApply: false },
      );
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setIsDirty(false);
      onSaved({
        autoApply,
        autoSectionId: autoApply ? autoSectionId : template.autoSectionId,
        autoTableTypeId: autoApply ? autoTableTypeId : template.autoTableTypeId,
      });
      enqueueSnackbar(m.tableModels.updated, { variant: "success" });
    });
  }

  function handleReset() {
    setAutoApply(template.autoApply);
    setAutoSectionId(template.autoSectionId ?? "");
    setAutoTableTypeId(template.autoTableTypeId ?? "");
    setIsDirty(false);
  }

  return (
    <Box sx={{ mt: layout.stack }}>
      <Divider sx={{ mb: layout.stack }} />
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight="medium"
        sx={{ display: "block", mb: layout.inline, textTransform: "uppercase", letterSpacing: "0.05em" }}
      >
        {m.tableModels.autoApplySectionTitle}
      </Typography>

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={autoApply}
            onChange={(e) => {
              setAutoApply(e.target.checked);
              setIsDirty(true);
            }}
            disabled={isPendingAutoApply}
          />
        }
        label={<Typography variant="body2">{m.tableModels.autoApplyLabel}</Typography>}
      />

      {autoApply && (
        <Tooltip title={m.tableModels.autoApplyHint} placement="bottom-start">
          <Typography variant="caption" color="text.tertiary" sx={{ display: "block", mt: 0.5, mb: layout.inline }}>
            {m.tableModels.autoApplyHint}
          </Typography>
        </Tooltip>
      )}

      {autoApply && (
        <Stack direction="row" spacing={layout.inline} sx={{ mt: layout.inline }}>
          <FormControl size="small" sx={{ flex: 1 }} error={isDirty && autoApply && !autoSectionId}>
            <InputLabel>{m.tableModels.autoApplySection}</InputLabel>
            <Select
              value={autoSectionId}
              label={m.tableModels.autoApplySection}
              onChange={(e) => {
                setAutoSectionId(e.target.value);
                setIsDirty(true);
              }}
              disabled={isPendingAutoApply}
            >
              {sections.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl
            size="small"
            sx={{ flex: 1 }}
            error={isDirty && autoApply && !autoTableTypeId}
          >
            <InputLabel>{m.tableModels.autoApplyTableType}</InputLabel>
            <Select
              value={autoTableTypeId}
              label={m.tableModels.autoApplyTableType}
              onChange={(e) => {
                setAutoTableTypeId(e.target.value);
                setIsDirty(true);
              }}
              disabled={isPendingAutoApply}
            >
              {tableTypes.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      )}

      {isDirty && (
        <Stack direction="row" spacing={layout.inline} sx={{ mt: layout.stack }}>
          <Button
            size="small"
            variant="contained"
            onClick={handleSave}
            disabled={!canSave || isPendingAutoApply}
            endIcon={isPendingAutoApply ? <CircularProgress size={12} color="inherit" /> : undefined}
          >
            {m.common.save}
          </Button>
          <Button size="small" onClick={handleReset} disabled={isPendingAutoApply}>
            {m.common.cancel}
          </Button>
        </Stack>
      )}
    </Box>
  );
}

// ─── CreateDialog ──────────────────────────────────────────────────────────────

function CreateDialog({
  open,
  name,
  onNameChange,
  onConfirm,
  onClose,
  isPending,
}: {
  open: boolean;
  name: string;
  onNameChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title={m.tableModels.createButton}
      actions={
        <>
          <Button onClick={onClose}>{m.common.cancel}</Button>
          <Button variant="contained" onClick={onConfirm} disabled={isPending || !name.trim()}>
            {m.common.create}
          </Button>
        </>
      }
    >
      <TextField
        label={m.tableModels.nameLabel}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        fullWidth
        autoFocus
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
