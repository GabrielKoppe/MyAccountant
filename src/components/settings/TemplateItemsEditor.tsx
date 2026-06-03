"use client";

import { useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
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
import { NumericFormat } from "react-number-format";
import { useSnackbar } from "notistack";

import { addTemplateItemAction, deleteTemplateItemAction } from "@/actions/table-templates";
import { formatCentsToBrl } from "@/lib/money";
import { m } from "@/lib/messages";

type Item = {
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

type Template = { id: string; name: string; items: Item[] };
type CategoryOption = { id: string; name: string; subcategories: { id: string; name: string }[] };

type Props = {
  accountId: string;
  template: Template;
  categories: CategoryOption[];
  institutions: { id: string; name: string }[];
  members: { id: string; name: string | null; email: string }[];
  open: boolean;
  onClose: () => void;
  onItemsChanged: (items: Item[]) => void;
};

const EMPTY_FORM = {
  day: 1,
  amountRaw: "",
  description: "",
  isPending: false,
  categoryId: "",
  subcategoryId: "",
  institutionId: "",
  responsibleUserId: "",
  cardInstallment: "",
  investmentType: "",
};

export function TemplateItemsEditor({
  accountId,
  template,
  categories,
  institutions,
  members,
  open,
  onClose,
  onItemsChanged,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<Item[]>(template.items);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function pf(partial: Partial<typeof EMPTY_FORM>) {
    setForm((prev) => ({ ...prev, ...partial }));
    if (partial.categoryId !== undefined) setForm((prev) => ({ ...prev, ...partial, subcategoryId: "" }));
  }

  const selectedCategory = categories.find((c) => c.id === form.categoryId);

  function handleAdd() {
    const amountCents = Math.round(parseFloat(form.amountRaw.replace(/\./g, "").replace(",", ".")) * 100);
    if (isNaN(amountCents)) { enqueueSnackbar("Valor inválido", { variant: "error" }); return; }

    startTransition(async () => {
      const result = await addTemplateItemAction(accountId, {
        templateId: template.id,
        day: form.day,
        amountCents: BigInt(amountCents),
        description: form.description || undefined,
        isPending: form.isPending,
        categoryId: form.categoryId || undefined,
        subcategoryId: form.subcategoryId || undefined,
        institutionId: form.institutionId || undefined,
        responsibleUserId: form.responsibleUserId || undefined,
        cardInstallment: form.cardInstallment || undefined,
        investmentType: form.investmentType || undefined,
      });
      if (!result.ok) { enqueueSnackbar(result.error.message, { variant: "error" }); return; }

      const newItem: Item = {
        id: result.data.id,
        day: form.day,
        amountCents: String(amountCents),
        description: form.description || null,
        isPending: form.isPending,
        categoryId: form.categoryId || null,
        subcategoryId: form.subcategoryId || null,
        institutionId: form.institutionId || null,
        responsibleUserId: form.responsibleUserId || null,
        cardInstallment: form.cardInstallment || null,
        investmentType: form.investmentType || null,
        displayOrder: items.length,
      };
      const updated = [...items, newItem];
      setItems(updated);
      onItemsChanged(updated);
      setForm(EMPTY_FORM);
      setAddOpen(false);
      enqueueSnackbar("Item adicionado.", { variant: "success" });
    });
  }

  function handleDelete(itemId: string) {
    startTransition(async () => {
      const result = await deleteTemplateItemAction(accountId, { itemId });
      if (!result.ok) { enqueueSnackbar(result.error.message, { variant: "error" }); return; }
      const updated = items.filter((i) => i.id !== itemId);
      setItems(updated);
      onItemsChanged(updated);
      enqueueSnackbar(m.tableModels.itemDeleted, { variant: "success" });
    });
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Editar itens — {template.name}
        </DialogTitle>
        <DialogContent>
          {items.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Nenhum item. Clique em "+ Adicionar item" para começar.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "background.default" }}>
                  <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Dia</TableCell>
                  <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Descrição</TableCell>
                  <TableCell sx={{ fontSize: 11, fontWeight: "bold" }} align="right">Valor</TableCell>
                  <TableCell sx={{ fontSize: 11, fontWeight: "bold" }}>Categoria</TableCell>
                  <TableCell sx={{ width: 48 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const cat = categories.find((c) => c.id === item.categoryId);
                  return (
                    <TableRow key={item.id}>
                      <TableCell sx={{ fontSize: 12 }}>Dia {item.day}</TableCell>
                      <TableCell sx={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.description ?? <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }} align="right">
                        <Typography variant="caption" color={BigInt(item.amountCents) < 0n ? "error.main" : "success.main"}>
                          {formatCentsToBrl(BigInt(item.amountCents))}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: 12 }}>{cat?.name ?? "—"}</TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => handleDelete(item.id)} disabled={isPending}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            {m.tableModels.addItem}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose}>{m.common.close}</Button>
        </DialogActions>
      </Dialog>

      {/* Add item dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{m.tableModels.addItem}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label={m.tableModels.dayLabel}
                type="number"
                value={form.day}
                onChange={(e) => pf({ day: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })}
                inputProps={{ min: 1, max: 31 }}
                sx={{ width: 100 }}
                size="small"
              />
              <NumericFormat
                customInput={TextField}
                label="Valor (R$) *"
                value={form.amountRaw}
                onValueChange={(v) => pf({ amountRaw: v.value })}
                thousandSeparator="."
                decimalSeparator=","
                decimalScale={2}
                fixedDecimalScale
                prefix="R$ "
                fullWidth
                size="small"
                allowNegative
              />
            </Box>

            <TextField
              label="Descrição"
              value={form.description}
              onChange={(e) => pf({ description: e.target.value })}
              fullWidth
              size="small"
            />

            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Categoria</InputLabel>
                <Select value={form.categoryId} label="Categoria" onChange={(e) => pf({ categoryId: e.target.value })}>
                  <MenuItem value="">— Nenhuma —</MenuItem>
                  {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" disabled={!selectedCategory}>
                <InputLabel>Subcategoria</InputLabel>
                <Select value={form.subcategoryId} label="Subcategoria" onChange={(e) => pf({ subcategoryId: e.target.value })}>
                  <MenuItem value="">— Nenhuma —</MenuItem>
                  {selectedCategory?.subcategories.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Instituição</InputLabel>
                <Select value={form.institutionId} label="Instituição" onChange={(e) => pf({ institutionId: e.target.value })}>
                  <MenuItem value="">— Nenhuma —</MenuItem>
                  {institutions.map((i) => <MenuItem key={i.id} value={i.id}>{i.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Responsável</InputLabel>
                <Select value={form.responsibleUserId} label="Responsável" onChange={(e) => pf({ responsibleUserId: e.target.value })}>
                  <MenuItem value="">— Nenhum —</MenuItem>
                  {members.map((mem) => <MenuItem key={mem.id} value={mem.id}>{mem.name ?? mem.email}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>

            <FormControlLabel
              control={<Checkbox size="small" checked={form.isPending} onChange={(e) => pf({ isPending: e.target.checked })} />}
              label="Marcar como pendente ao aplicar"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)}>{m.common.cancel}</Button>
          <Button variant="contained" onClick={handleAdd} disabled={isPending || !form.amountRaw}>
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
