"use client";

import { memo, useEffect, useState } from "react";
import type { SectionCountType } from "@prisma/client";
import Avatar from "@mui/material/Avatar";
import Checkbox from "@mui/material/Checkbox";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";

import { duplicateTransactionAction, updateTransactionAction } from "@/actions/transactions";
import { formatCentsToBrl } from "@/lib/money";
import { formatDateShort } from "@/lib/dates";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  TransactionRow as TxRow,
} from "./types";
import { TransactionRowEditor } from "./TransactionRowEditor";
import { TransactionRowActions } from "./TransactionRowActions";

type Props = {
  tx: TxRow;
  accountId: string;
  currentUserId: string;
  isSelected: boolean;
  isReadOnly: boolean;
  sectionCountType: SectionCountType;
  hiddenColumns: HiddenColumns;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  autoEdit: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onOptimisticUpdate: (id: string, patch: Partial<TxRow>) => void;
  onDeleteRequested: (id: string) => void;
  onDuplicated: (newTx: TxRow, sourceId: string) => void;
  onViewDetails: (id: string) => void;
  onAutoEditConsumed: () => void;
};

export function TransactionRowBase({
  tx,
  accountId,
  currentUserId,
  isSelected,
  isReadOnly,
  sectionCountType,
  hiddenColumns,
  categories,
  institutions,
  members,
  autoEdit,
  onSelect,
  onOptimisticUpdate,
  onDeleteRequested,
  onDuplicated,
  onViewDetails,
  onAutoEditConsumed,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [editing, setEditing] = useState(false);
  const [focusField, setFocusField] = useState("occurredOn");
  const [editValues, setEditValues] = useState<TxRow>(tx);
  const [_saving, setSaving] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const amount = BigInt(tx.amountCents);
  const isPositive = sectionCountType === "subtract" ? amount < 0n : amount >= 0n;

  function startEdit(field = "occurredOn") {
    if (isReadOnly) return;
    setEditValues(tx);
    setFocusField(field);
    setNotesOpen(false);
    setEditing(true);
  }

  useEffect(() => {
    if (autoEdit) {
      startEdit();
      onAutoEditConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit]);

  function startEditWithNote(e: React.MouseEvent) {
    e.stopPropagation();
    if (isReadOnly) return;
    setEditValues(tx);
    setFocusField("notes");
    setNotesOpen(true);
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

    if (Object.keys(patch).length === 0) {
      setSaving(false);
      return;
    }

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
      ...(editValues.investmentType !== tx.investmentType && { investmentType: editValues.investmentType }),
      ...(editValues.notes !== tx.notes && { notes: editValues.notes }),
    });

    setSaving(false);
    if (!result.ok) {
      onOptimisticUpdate(tx.id, tx);
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
    const result = await updateTransactionAction(accountId, { transactionId: tx.id, isFavorite: newVal });
    if (!result.ok) {
      onOptimisticUpdate(tx.id, { isFavorite: tx.isFavorite });
      enqueueSnackbar(result.error.message, { variant: "error" });
    }
  }

  async function togglePending(e: React.MouseEvent) {
    e.stopPropagation();
    const newVal = !tx.isPending;
    onOptimisticUpdate(tx.id, { isPending: newVal });
    const result = await updateTransactionAction(accountId, { transactionId: tx.id, isPending: newVal });
    if (!result.ok) {
      onOptimisticUpdate(tx.id, { isPending: tx.isPending });
      enqueueSnackbar(result.error.message, { variant: "error" });
    }
  }

  function handleDelete() {
    setMenuAnchor(null);
    onDeleteRequested(tx.id);
  }

  function handleViewDetails() {
    setMenuAnchor(null);
    onViewDetails(tx.id);
  }

  async function handleDuplicate() {
    setMenuAnchor(null);
    const result = await duplicateTransactionAction(accountId, { transactionId: tx.id });
    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }
    const now = new Date().toISOString();
    onDuplicated(
      { ...tx, id: result.data.transactionId, createdById: currentUserId, createdAt: now, updatedById: null, updatedAt: now },
      tx.id,
    );
    enqueueSnackbar("Transação duplicada.", { variant: "success" });
  }

  const subcatsForCategory = categories.find((c) => c.id === tx.categoryId)?.subcategories ?? [];

  // Modo edição — delega para TransactionRowEditor
  if (editing) {
    return (
      <TransactionRowEditor
        tx={tx}
        editValues={editValues}
        setEditValues={setEditValues}
        isSelected={isSelected}
        notesOpen={notesOpen}
        setNotesOpen={setNotesOpen}
        focusField={focusField}
        hiddenColumns={hiddenColumns}
        categories={categories}
        institutions={institutions}
        members={members}
        onSelect={onSelect}
        onSave={saveEdit}
        onCancel={cancelEdit}
      />
    );
  }

  // Modo leitura
  return (
    <TableRow hover selected={isSelected} sx={{ opacity: tx.isPending ? 0.65 : 1 }}>
      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={isSelected} onChange={(e) => onSelect(tx.id, e.target.checked)} size="small" disabled={isReadOnly} />
      </TableCell>

      <TableCell sx={{ fontSize: 13, whiteSpace: "nowrap", cursor: isReadOnly ? "default" : "pointer" }} onClick={() => !isReadOnly && startEdit("occurredOn")}>
        {formatDateShort(tx.occurredOn)}
      </TableCell>

      <TableCell sx={{ fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: isReadOnly ? "default" : "pointer" }} onClick={() => !isReadOnly && startEdit("description")}>
        {tx.description || <Typography variant="caption" color="text.disabled">—</Typography>}
      </TableCell>

      {!hiddenColumns.category && (
        <TableCell sx={{ fontSize: 13, cursor: isReadOnly ? "default" : "pointer" }} onClick={() => !isReadOnly && startEdit("categoryId")}>
          {categories.find((c) => c.id === tx.categoryId)?.name ?? <Typography variant="caption" color="text.disabled">—</Typography>}
        </TableCell>
      )}

      {!hiddenColumns.subcategory && (
        <TableCell sx={{ fontSize: 13, cursor: isReadOnly ? "default" : "pointer" }} onClick={() => !isReadOnly && startEdit("subcategoryId")}>
          {subcatsForCategory.find((s) => s.id === tx.subcategoryId)?.name ?? <Typography variant="caption" color="text.disabled">—</Typography>}
        </TableCell>
      )}

      {!hiddenColumns.institution && (
        <TableCell sx={{ fontSize: 13, cursor: isReadOnly ? "default" : "pointer" }} onClick={() => !isReadOnly && startEdit("institutionId")}>
          {institutions.find((i) => i.id === tx.institutionId)?.name ?? tx.institutionText ?? <Typography variant="caption" color="text.disabled">—</Typography>}
        </TableCell>
      )}

      <TableCell align="right" sx={{ fontWeight: "medium", fontSize: 13, whiteSpace: "nowrap", color: isPositive ? "success.main" : "error.main", cursor: isReadOnly ? "default" : "pointer" }} onClick={() => !isReadOnly && startEdit("amountCents")}>
        {formatCentsToBrl(amount)}
      </TableCell>

      {!hiddenColumns.responsibleUser && (
        <TableCell sx={{ cursor: isReadOnly ? "default" : "pointer" }} onClick={() => !isReadOnly && startEdit("responsibleUserId")}>
          {tx.responsibleUserId ? (
            <Tooltip title={members.find((mem) => mem.id === tx.responsibleUserId)?.name ?? ""}>
              <Avatar src={members.find((mem) => mem.id === tx.responsibleUserId)?.image ?? undefined} sx={{ width: 24, height: 24, fontSize: 11 }}>
                {members.find((mem) => mem.id === tx.responsibleUserId)?.name?.charAt(0)}
              </Avatar>
            </Tooltip>
          ) : (
            <Typography variant="caption" color="text.disabled">—</Typography>
          )}
        </TableCell>
      )}

      {!hiddenColumns.investmentType && (
        <TableCell sx={{ fontSize: 13, cursor: isReadOnly ? "default" : "pointer" }} onClick={() => !isReadOnly && startEdit("investmentType")}>
          {tx.investmentType ?? <Typography variant="caption" color="text.disabled">—</Typography>}
        </TableCell>
      )}

      <TransactionRowActions
        tx={tx}
        isReadOnly={isReadOnly}
        menuAnchor={menuAnchor}
        setMenuAnchor={setMenuAnchor}
        onStartEdit={() => startEdit()}
        onStartEditWithNote={startEditWithNote}
        onTogglePending={togglePending}
        onToggleFavorite={toggleFavorite}
        onViewDetails={handleViewDetails}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />
    </TableRow>
  );
}

export const TransactionRow = memo(TransactionRowBase);
