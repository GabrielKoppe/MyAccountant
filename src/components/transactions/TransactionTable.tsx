"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import Typography from "@mui/material/Typography";

import { BulkActionBar } from "./BulkActionBar";
import { NewTransactionRow } from "./NewTransactionRow";
import { TransactionRow } from "./TransactionRow";
import type { CategoryOption, HiddenColumns, InstitutionOption, MemberOption, TransactionRow as TxRow } from "./types";

type Props = {
  tableId: string;
  monthId: string;
  accountId: string;
  sectionIsActive: boolean;
  hiddenColumns: HiddenColumns;
  initialTransactions: TxRow[];
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  defaultResponsibleUserId: string | null;
  showNewRow: boolean;
  onNewRowClose: () => void;
};

export function TransactionTable({
  tableId,
  monthId,
  accountId,
  sectionIsActive,
  hiddenColumns,
  initialTransactions,
  categories,
  institutions,
  members,
  defaultResponsibleUserId,
  showNewRow,
  onNewRowClose,
}: Props) {
  const [rows, setRows] = useState<TxRow[]>(initialTransactions);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const isReadOnly = !sectionIsActive;
  const selectedIds = Array.from(selected);

  function handleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set());
  }

  function optimisticUpdate(id: string, patch: Partial<TxRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function optimisticDelete(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function onDuplicated(newTx: TxRow) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === newTx.id.replace(/-copy$/, ""));
      const copy = [...prev];
      copy.splice(idx + 1, 0, newTx);
      return copy;
    });
  }

  function onNewCreated(newTx: TxRow) {
    setRows((prev) => [newTx, ...prev]);
    onNewRowClose();
  }

  function onBulkMoved(movedIds: string[]) {
    const movedSet = new Set(movedIds);
    setRows((prev) => prev.filter((r) => !movedSet.has(r.id)));
    setSelected(new Set());
  }

  function onBulkUpdated(ids: string[], patch: Partial<TxRow>) {
    const idSet = new Set(ids);
    setRows((prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, ...patch } : r)));
  }

  // Visible columns config
  const show = (key: string) => !hiddenColumns[key];

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && selected.size < rows.length;

  // True quando TODAS as selecionadas já são pendentes → botão vira "Desmarcar"
  const allSelectedPending =
    selectedIds.length > 0 &&
    selectedIds.every((id) => rows.find((r) => r.id === id)?.isPending ?? false);

  if (rows.length === 0 && !showNewRow) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          py: 4,
          gap: 1,
          color: "text.disabled",
        }}
      >
        <TableChartOutlinedIcon sx={{ fontSize: 36, opacity: 0.4 }} />
        <Typography variant="body2">Nenhuma transação</Typography>
        {!isReadOnly && (
          <Typography variant="caption" color="text.secondary">
            Clique em "+ Nova transação" no cabeçalho para adicionar
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {selected.size > 0 && (
        <BulkActionBar
          accountId={accountId}
          tableId={tableId}
          monthId={monthId}
          selectedIds={selectedIds}
          allSelectedPending={allSelectedPending}
          categories={categories}
          institutions={institutions}
          onClear={() => setSelected(new Set())}
          onMoved={onBulkMoved}
          onBulkUpdated={onBulkUpdated}
        />
      )}

      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  disabled={isReadOnly}
                />
              </TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: "bold", whiteSpace: "nowrap" }}>Data</TableCell>
              <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Descrição</TableCell>
              {show("category") && <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Categoria</TableCell>}
              {show("subcategory") && <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Subcategoria</TableCell>}
              {show("institution") && <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Instituição</TableCell>}
              <TableCell sx={{ fontSize: 12, fontWeight: "bold" }} align="right">Valor</TableCell>
              {show("responsibleUser") && <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Resp.</TableCell>}
              {show("isPending") && <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Pend.</TableCell>}
              {show("investmentType") && <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Tipo inv.</TableCell>}
              <TableCell align="right" sx={{ fontSize: 12, fontWeight: "bold" }}>★ ⋮</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {showNewRow && (
              <NewTransactionRow
                tableId={tableId}
                accountId={accountId}
                hiddenColumns={hiddenColumns}
                categories={categories}
                institutions={institutions}
                members={members}
                defaultResponsibleUserId={defaultResponsibleUserId}
                onCreated={onNewCreated}
                onCancel={onNewRowClose}
              />
            )}

            {rows.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                accountId={accountId}
                isSelected={selected.has(tx.id)}
                isReadOnly={isReadOnly}
                hiddenColumns={hiddenColumns}
                categories={categories}
                institutions={institutions}
                members={members}
                onSelect={handleSelect}
                onOptimisticUpdate={optimisticUpdate}
                onOptimisticDelete={optimisticDelete}
                onDuplicated={onDuplicated}
              />
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
