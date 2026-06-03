"use client";

import { useState } from "react";
import { NumericFormat } from "react-number-format";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { useSnackbar } from "notistack";

import { deleteTransactionAction, duplicateTransactionAction, updateTransactionAction } from "@/actions/transactions";
import { formatCentsToBrl, reaisToCents, centsToReais } from "@/lib/money";
import { formatDateShort } from "@/lib/dates";
import type { CategoryOption, HiddenColumns, InstitutionOption, MemberOption, TransactionRow as TxRow } from "./types";

type Props = {
  tx: TxRow;
  accountId: string;
  isSelected: boolean;
  isReadOnly: boolean;
  hiddenColumns: HiddenColumns;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  onSelect: (id: string, checked: boolean) => void;
  onOptimisticUpdate: (id: string, patch: Partial<TxRow>) => void;
  onOptimisticDelete: (id: string) => void;
  onDuplicated: (newTx: TxRow) => void;
};

export function TransactionRow({
  tx,
  accountId,
  isSelected,
  isReadOnly,
  hiddenColumns,
  categories,
  institutions,
  members,
  onSelect,
  onOptimisticUpdate,
  onOptimisticDelete,
  onDuplicated,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<TxRow>(tx);
  const [saving, setSaving] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const amount = BigInt(tx.amountCents);
  const isPositive = amount >= 0n;

  function startEdit() {
    if (isReadOnly) return;
    setEditValues(tx);
    setEditing(true);
  }

  async function saveEdit() {
    if (!editing) return;
    setEditing(false);
    setSaving(true);

    const patch: Partial<TxRow> = {};
    const fields = Object.keys(editValues) as (keyof TxRow)[];
    for (const k of fields) {
      if (editValues[k] !== tx[k]) (patch as Record<string, unknown>)[k] = editValues[k];
    }

    if (Object.keys(patch).length === 0) { setSaving(false); return; }

    onOptimisticUpdate(tx.id, patch);

    const result = await updateTransactionAction(accountId, {
      transactionId: tx.id,
      ...(editValues.occurredOn !== tx.occurredOn && { occurredOn: new Date(editValues.occurredOn) }),
      ...(editValues.amountCents !== tx.amountCents && { amountCents: BigInt(editValues.amountCents) }),
      ...(editValues.description !== tx.description && { description: editValues.description }),
      ...(editValues.categoryId !== tx.categoryId && { categoryId: editValues.categoryId }),
      ...(editValues.subcategoryId !== tx.subcategoryId && { subcategoryId: editValues.subcategoryId }),
      ...(editValues.institutionId !== tx.institutionId && { institutionId: editValues.institutionId }),
      ...(editValues.responsibleUserId !== tx.responsibleUserId && { responsibleUserId: editValues.responsibleUserId }),
      ...(editValues.isPending !== tx.isPending && { isPending: editValues.isPending }),
      ...(editValues.isFavorite !== tx.isFavorite && { isFavorite: editValues.isFavorite }),
    });

    setSaving(false);
    if (!result.ok) {
      onOptimisticUpdate(tx.id, tx); // revert
      enqueueSnackbar(result.error.message, { variant: "error" });
    }
  }

  function cancelEdit() {
    setEditing(false);
    setEditValues(tx);
  }

  async function toggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    const newVal = !tx.isFavorite;
    onOptimisticUpdate(tx.id, { isFavorite: newVal });
    const result = await updateTransactionAction(accountId, {
      transactionId: tx.id,
      isFavorite: newVal,
    });
    if (!result.ok) {
      onOptimisticUpdate(tx.id, { isFavorite: tx.isFavorite });
      enqueueSnackbar(result.error.message, { variant: "error" });
    }
  }

  async function handleDelete() {
    setMenuAnchor(null);
    onOptimisticDelete(tx.id);
    const result = await deleteTransactionAction(accountId, { transactionId: tx.id });
    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
    } else {
      enqueueSnackbar("Transação deletada.", { variant: "info" });
    }
  }

  async function handleDuplicate() {
    setMenuAnchor(null);
    const result = await duplicateTransactionAction(accountId, { transactionId: tx.id });
    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }
    onDuplicated({ ...tx, id: result.data.transactionId });
    enqueueSnackbar("Transação duplicada.", { variant: "success" });
  }

  const subcatsForCategory = categories.find((c) => c.id === (editing ? editValues.categoryId : tx.categoryId))?.subcategories ?? [];

  const sharedInputProps = { size: "small" as const, variant: "standard" as const };

  if (editing) {
    return (
      <TableRow
        sx={{ bgcolor: "action.selected" }}
        onKeyDown={(e) => {
          if (e.key === "Enter") saveEdit();
          if (e.key === "Escape") cancelEdit();
        }}
      >
        <TableCell padding="checkbox">
          <Checkbox checked={isSelected} onChange={(e) => onSelect(tx.id, e.target.checked)} size="small" />
        </TableCell>

        {/* Data */}
        <TableCell>
          <TextField
            {...sharedInputProps}
            type="date"
            value={editValues.occurredOn.slice(0, 10)}
            onChange={(e) => setEditValues((prev) => ({ ...prev, occurredOn: e.target.value }))}
            inputProps={{ style: { fontSize: 13 } }}
            sx={{ width: 120 }}
            autoFocus
          />
        </TableCell>

        {/* Descrição */}
        <TableCell>
          <TextField
            {...sharedInputProps}
            value={editValues.description ?? ""}
            onChange={(e) => setEditValues((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Descrição"
            fullWidth
          />
        </TableCell>

        {/* Categoria */}
        {!hiddenColumns.category && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.categoryId ?? ""}
              onChange={(e) => setEditValues((prev) => ({ ...prev, categoryId: e.target.value || null, subcategoryId: null }))}
              sx={{ minWidth: 110, fontSize: 13 }}
            >
              <MenuItem value=""><em>Nenhuma</em></MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>{c.name}</MenuItem>)}
            </Select>
          </TableCell>
        )}

        {/* Subcategoria */}
        {!hiddenColumns.subcategory && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.subcategoryId ?? ""}
              onChange={(e) => setEditValues((prev) => ({ ...prev, subcategoryId: e.target.value || null }))}
              sx={{ minWidth: 110, fontSize: 13 }}
              disabled={!editValues.categoryId}
            >
              <MenuItem value=""><em>Nenhuma</em></MenuItem>
              {subcatsForCategory.map((s) => <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13 }}>{s.name}</MenuItem>)}
            </Select>
          </TableCell>
        )}

        {/* Instituição */}
        {!hiddenColumns.institution && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.institutionId ?? ""}
              onChange={(e) => setEditValues((prev) => ({ ...prev, institutionId: e.target.value || null }))}
              sx={{ minWidth: 110, fontSize: 13 }}
            >
              <MenuItem value=""><em>Nenhuma</em></MenuItem>
              {institutions.map((i) => <MenuItem key={i.id} value={i.id} sx={{ fontSize: 13 }}>{i.name}</MenuItem>)}
            </Select>
          </TableCell>
        )}

        {/* Valor */}
        <TableCell align="right">
          <NumericFormat
            customInput={TextField}
            {...sharedInputProps}
            value={centsToReais(BigInt(editValues.amountCents))}
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={2}
            fixedDecimalScale
            allowNegative
            onValueChange={({ floatValue }) => {
              const cents = reaisToCents(floatValue ?? 0);
              setEditValues((prev) => ({ ...prev, amountCents: cents.toString() }));
            }}
            inputProps={{ style: { textAlign: "right", width: 100, fontSize: 13 } }}
          />
        </TableCell>

        {/* Responsável */}
        {!hiddenColumns.responsibleUser && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.responsibleUserId ?? ""}
              onChange={(e) => setEditValues((prev) => ({ ...prev, responsibleUserId: e.target.value || null }))}
              sx={{ minWidth: 90, fontSize: 13 }}
            >
              <MenuItem value=""><em>Nenhum</em></MenuItem>
              {members.map((m) => <MenuItem key={m.id} value={m.id} sx={{ fontSize: 13 }}>{m.name ?? m.email}</MenuItem>)}
            </Select>
          </TableCell>
        )}

        {/* Pendente */}
        {!hiddenColumns.isPending && (
          <TableCell padding="checkbox">
            <Checkbox
              size="small"
              checked={editValues.isPending}
              onChange={(e) => setEditValues((prev) => ({ ...prev, isPending: e.target.checked }))}
            />
          </TableCell>
        )}

        {/* Ações edit */}
        <TableCell align="right">
          <IconButton size="small" onClick={saveEdit} color="primary" title="Salvar (Enter)">
            ✓
          </IconButton>
          <IconButton size="small" onClick={cancelEdit} title="Cancelar (Esc)">
            ✕
          </IconButton>
        </TableCell>
      </TableRow>
    );
  }

  // View mode
  return (
    <TableRow
      hover
      selected={isSelected}
      sx={{ opacity: tx.isPending ? 0.65 : 1, cursor: isReadOnly ? "default" : "pointer" }}
      onClick={() => !isReadOnly && startEdit()}
    >
      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onChange={(e) => onSelect(tx.id, e.target.checked)}
          size="small"
          disabled={isReadOnly}
        />
      </TableCell>

      <TableCell sx={{ fontSize: 13, whiteSpace: "nowrap" }}>
        {formatDateShort(tx.occurredOn)}
      </TableCell>

      <TableCell sx={{ fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {tx.description || <Typography variant="caption" color="text.disabled">—</Typography>}
      </TableCell>

      {!hiddenColumns.category && (
        <TableCell sx={{ fontSize: 13 }}>
          {categories.find((c) => c.id === tx.categoryId)?.name ?? <Typography variant="caption" color="text.disabled">—</Typography>}
        </TableCell>
      )}

      {!hiddenColumns.subcategory && (
        <TableCell sx={{ fontSize: 13 }}>
          {subcatsForCategory.find((s) => s.id === tx.subcategoryId)?.name ?? <Typography variant="caption" color="text.disabled">—</Typography>}
        </TableCell>
      )}

      {!hiddenColumns.institution && (
        <TableCell sx={{ fontSize: 13 }}>
          {institutions.find((i) => i.id === tx.institutionId)?.name ?? tx.institutionText ?? <Typography variant="caption" color="text.disabled">—</Typography>}
        </TableCell>
      )}

      <TableCell align="right" sx={{ fontWeight: "medium", fontSize: 13, whiteSpace: "nowrap", color: isPositive ? "success.main" : "error.main" }}>
        {formatCentsToBrl(amount)}
      </TableCell>

      {!hiddenColumns.responsibleUser && (
        <TableCell>
          {tx.responsibleUserId ? (
            <Tooltip title={members.find((m) => m.id === tx.responsibleUserId)?.name ?? ""}>
              <Avatar
                src={members.find((m) => m.id === tx.responsibleUserId)?.image ?? undefined}
                sx={{ width: 24, height: 24, fontSize: 11 }}
              >
                {members.find((m) => m.id === tx.responsibleUserId)?.name?.charAt(0)}
              </Avatar>
            </Tooltip>
          ) : <Typography variant="caption" color="text.disabled">—</Typography>}
        </TableCell>
      )}

      {!hiddenColumns.isPending && (
        <TableCell padding="checkbox">
          {tx.isPending && <Tooltip title="Pendente"><span>⏳</span></Tooltip>}
        </TableCell>
      )}

      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
        <IconButton size="small" onClick={toggleFavorite}>
          {tx.isFavorite ? <StarIcon fontSize="small" color="warning" /> : <StarBorderIcon fontSize="small" />}
        </IconButton>
        {!isReadOnly && (
          <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
      </TableCell>

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={handleDuplicate}>
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          Duplicar
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          Deletar
        </MenuItem>
      </Menu>
    </TableRow>
  );
}
