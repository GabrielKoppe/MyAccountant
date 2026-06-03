"use client";

import { useState, useTransition } from "react";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
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
import { TemplateItemsEditor } from "./TemplateItemsEditor";

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
  investmentType: string | null;
  displayOrder: number;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  tableTypeId: string | null;
  countInMonth: boolean;
  _count: { items: number };
  tableType: { id: string; name: string } | null;
  items: TemplateItem[];
};

type Props = {
  accountId: string;
  initialTemplates: Template[];
  categories: { id: string; name: string; subcategories: { id: string; name: string }[] }[];
  institutions: { id: string; name: string }[];
  members: { id: string; name: string | null; email: string }[];
  tableTypes: { id: string; name: string; isDefault: boolean }[];
};

export function TableModelsManager({
  accountId,
  initialTemplates,
  categories,
  institutions,
  members,
  tableTypes,
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
      if (!result.ok) { enqueueSnackbar(result.error.message, { variant: "error" }); return; }
      setTemplates((prev) => [
        ...prev,
        { ...result.data, description: null, tableTypeId: null, countInMonth: true, tableType: null, _count: { items: 0 }, items: [] },
      ]);
      enqueueSnackbar(m.tableModels.created, { variant: "success" });
      setCreateOpen(false);
      setNewName("");
    });
  }

  function handleRename() {
    if (!renameId || !renameValue.trim()) return;
    startTransition(async () => {
      const result = await updateTemplateAction(accountId, { templateId: renameId, name: renameValue.trim() });
      if (!result.ok) { enqueueSnackbar(result.error.message, { variant: "error" }); return; }
      setTemplates((prev) => prev.map((t) => t.id === renameId ? { ...t, name: renameValue.trim() } : t));
      enqueueSnackbar(m.tableModels.updated, { variant: "success" });
      setRenameId(null);
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    setDeleteId(null);
    startTransition(async () => {
      const result = await deleteTemplateAction(accountId, { templateId: deleteId });
      if (!result.ok) { enqueueSnackbar(result.error.message, { variant: "error" }); return; }
      setTemplates((prev) => prev.filter((t) => t.id !== deleteId));
      enqueueSnackbar(m.tableModels.deleted, { variant: "success" });
    });
  }

  function handleItemsUpdated(templateId: string, items: TemplateItem[]) {
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId
          ? { ...t, items, _count: { items: items.length } }
          : t,
      ),
    );
  }

  const editTemplate = templates.find((t) => t.id === editItemsId);

  if (templates.length === 0 && !createOpen) {
    return (
      <Box>
        <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
          <TableChartIcon sx={{ fontSize: 64, opacity: 0.3 }} />
          <Typography variant="h6" mt={1}>{m.tableModels.noModels}</Typography>
          <Typography variant="body2" mt={0.5} mb={3}>{m.tableModels.noModelsHint}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            {m.tableModels.createButton}
          </Button>
        </Box>
        <CreateDialog open={createOpen} name={newName} onNameChange={setNewName} onConfirm={handleCreate} onClose={() => setCreateOpen(false)} isPending={isPending} />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          {m.tableModels.createButton}
        </Button>
      </Box>

      <Stack spacing={1}>
        {templates.map((t) => (
          <Accordion key={t.id} variant="outlined">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, mr: 1 }}>
                <TableChartIcon fontSize="small" color="action" />
                <Typography fontWeight="medium">{t.name}</Typography>
                <Chip label={m.tableModels.itemCount(t._count.items)} size="small" variant="outlined" />
                {t.tableType && <Chip label={t.tableType.name} size="small" />}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {/* Items preview */}
              {t.items.length > 0 ? (
                <Table size="small" sx={{ mb: 1.5 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "background.default" }}>
                      <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Dia</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Descrição</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: "bold" }} align="right">Valor</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {t.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ fontSize: 12 }}>Dia {item.day}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{item.description ?? <Typography variant="caption" color="text.disabled">—</Typography>}</TableCell>
                        <TableCell sx={{ fontSize: 12 }} align="right">
                          <Typography variant="caption" color={BigInt(item.amountCents) < 0n ? "error.main" : "success.main"}>
                            {formatCentsToBrl(BigInt(item.amountCents))}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Sem itens. Clique em "Editar itens" para adicionar.
                </Typography>
              )}
              {/* Actions */}
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button size="small" startIcon={<AddIcon />} onClick={() => setEditItemsId(t.id)}>
                  {m.tableModels.editItems}
                </Button>
                <IconButton size="small" onClick={() => { setRenameId(t.id); setRenameValue(t.name); }}>
                  <DriveFileRenameOutlineIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => setDeleteId(t.id)} disabled={isPending}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>

      {/* Dialogs */}
      <CreateDialog open={createOpen} name={newName} onNameChange={setNewName} onConfirm={handleCreate} onClose={() => { setCreateOpen(false); setNewName(""); }} isPending={isPending} />

      <Dialog open={!!renameId} onClose={() => setRenameId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Renomear modelo</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField label={m.tableModels.nameLabel} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} fullWidth autoFocus onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleRename(); } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameId(null)}>{m.common.cancel}</Button>
          <Button variant="contained" onClick={handleRename} disabled={isPending}>{m.common.save}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Deletar modelo</DialogTitle>
        <DialogContent>
          <DialogContentText>{m.tableModels.deleteConfirm}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>{m.common.cancel}</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={isPending}>{m.common.delete}</Button>
        </DialogActions>
      </Dialog>

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
    </>
  );
}

function CreateDialog({ open, name, onNameChange, onConfirm, onClose, isPending }: {
  open: boolean; name: string; onNameChange: (v: string) => void;
  onConfirm: () => void; onClose: () => void; isPending: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{m.tableModels.createButton}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <TextField label={m.tableModels.nameLabel} value={name} onChange={(e) => onNameChange(e.target.value)} fullWidth autoFocus onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onConfirm(); } }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{m.common.cancel}</Button>
        <Button variant="contained" onClick={onConfirm} disabled={isPending || !name.trim()}>{m.common.create}</Button>
      </DialogActions>
    </Dialog>
  );
}
