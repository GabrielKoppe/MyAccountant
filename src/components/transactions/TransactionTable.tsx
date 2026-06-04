"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SectionCountType } from "@prisma/client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";
import SearchIcon from "@mui/icons-material/Search";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

import { useSnackbar } from "notistack";

import { m } from "@/lib/messages";
import { deleteTransactionAction } from "@/actions/transactions";
import { applyGlobalFilters, useMonthFilters } from "@/components/months/MonthFilterContext";
import { BulkActionBar } from "./BulkActionBar";
import { NewTransactionRow } from "./NewTransactionRow";
import { TransactionRow } from "./TransactionRow";
import type { CategoryOption, HiddenColumns, InstitutionOption, MemberOption, TransactionRow as TxRow } from "./types";

type SortField = "occurredOn" | "amountCents" | "description" | "categoryId" | "institutionId";
type SortDir = "asc" | "desc";
type SortState = { field: SortField; dir: SortDir } | null;

const DEFAULT_SORT_FIELD: SortField = "occurredOn";
const DEFAULT_SORT_DIR: SortDir = "desc";

function nextSortState(current: SortState, field: SortField): SortState {
  if (!current || current.field !== field) return { field, dir: "asc" };
  if (current.dir === "asc") return { field, dir: "desc" };
  return null; // reset to default
}

function sortRows(rows: TxRow[], sort: SortState, categories: CategoryOption[], institutions: InstitutionOption[]): TxRow[] {
  const field = sort?.field ?? DEFAULT_SORT_FIELD;
  const dir = sort?.dir ?? DEFAULT_SORT_DIR;

  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "occurredOn":
        cmp = a.occurredOn.localeCompare(b.occurredOn);
        break;
      case "amountCents":
        cmp = Number(BigInt(a.amountCents) - BigInt(b.amountCents));
        break;
      case "description":
        cmp = (a.description ?? "").localeCompare(b.description ?? "");
        break;
      case "categoryId": {
        const aName = categories.find((c) => c.id === a.categoryId)?.name ?? "";
        const bName = categories.find((c) => c.id === b.categoryId)?.name ?? "";
        cmp = aName.localeCompare(bName);
        break;
      }
      case "institutionId": {
        const aName = institutions.find((i) => i.id === a.institutionId)?.name ?? "";
        const bName = institutions.find((i) => i.id === b.institutionId)?.name ?? "";
        cmp = aName.localeCompare(bName);
        break;
      }
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

type Props = {
  tableId: string;
  monthId: string;
  accountId: string;
  sectionIsActive: boolean;
  sectionCountType: SectionCountType;
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
  sectionCountType,
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const pendingBatchRef = useRef<{ id: string; row: TxRow }[]>([]);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snackbarKeyRef = useRef<string | number | null>(null);
  const isMountedRef = useRef(true);

  const { filters, clearFilters, isActive: hasGlobalFilters } = useMonthFilters();

  const isReadOnly = !sectionIsActive;
  const selectedIds = Array.from(selected);
  const show = (key: string) => !hiddenColumns[key];

  // Apply global filters → then local search → then sort
  const visibleRows = useMemo(() => {
    let result = applyGlobalFilters(rows, filters);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter((r) => (r.description ?? "").toLowerCase().includes(q));
    }
    return sortRows(result, sort, categories, institutions);
  }, [rows, filters, searchText, sort, categories, institutions]);

  const allSelected = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id));
  const someSelected = visibleRows.some((r) => selected.has(r.id)) && !allSelected;

  const allSelectedPending =
    selectedIds.length > 0 &&
    selectedIds.every((id) => rows.find((r) => r.id === id)?.isPending ?? false);

  function handleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(visibleRows.map((r) => r.id)) : new Set());
  }

  function optimisticUpdate(id: string, patch: Partial<TxRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function optimisticDelete(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function onDuplicated(newTx: TxRow, sourceId: string) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === sourceId);
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

  async function executePendingDeletes() {
    const batch = [...pendingBatchRef.current];
    if (batch.length === 0) return;
    pendingBatchRef.current = [];
    deleteTimerRef.current = null;

    const results = await Promise.all(
      batch.map(({ id }) => deleteTransactionAction(accountId, { transactionId: id })),
    );

    const failed = batch.filter((_, i) => !results[i]?.ok);
    if (failed.length > 0 && isMountedRef.current) {
      setRows((prev) => [...prev, ...failed.map((b) => b.row)]);
      enqueueSnackbar(m.transactions.deleteError, { variant: "error" });
    }
  }

  function handleUndoDelete(snackKey: string | number) {
    closeSnackbar(snackKey);
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
    snackbarKeyRef.current = null;

    const batch = [...pendingBatchRef.current];
    pendingBatchRef.current = [];
    if (batch.length > 0) {
      setRows((prev) => [...prev, ...batch.map((b) => b.row)]);
    }
  }

  function onDeleteRequested(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;

    optimisticDelete(id);
    pendingBatchRef.current = [...pendingBatchRef.current, { id, row }];

    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (snackbarKeyRef.current !== null) closeSnackbar(snackbarKeyRef.current);

    const count = pendingBatchRef.current.length;
    const message =
      count === 1
        ? `${m.transactions.deleted}.`
        : `${count} ${m.transactions.deletedMultiple}.`;

    const key = enqueueSnackbar(message, {
      variant: "info",
      persist: true,
      action: (snackKey) => (
        <Button size="small" color="inherit" onClick={() => handleUndoDelete(snackKey)}>
          {m.transactions.undoDelete}
        </Button>
      ),
    });
    snackbarKeyRef.current = key;

    deleteTimerRef.current = setTimeout(() => {
      if (snackbarKeyRef.current !== null) closeSnackbar(snackbarKeyRef.current);
      snackbarKeyRef.current = null;
      void executePendingDeletes();
    }, 5000);
  }

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pendingBatchRef.current.length > 0) {
        if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
        const batch = [...pendingBatchRef.current];
        pendingBatchRef.current = [];
        void Promise.all(
          batch.map(({ id }) => deleteTransactionAction(accountId, { transactionId: id })),
        );
      }
    };
  }, [accountId]);

  function handleOpenSearch() {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  function handleCloseSearch() {
    setSearchOpen(false);
    setSearchText("");
  }

  function handleSortClick(field: SortField) {
    setSort((prev) => nextSortState(prev, field));
  }

  function SortableHeaderCell({ field, label, align }: { field: SortField; label: string; align?: "right" }) {
    const isActive = sort?.field === field;
    const Icon = sort?.dir === "asc" ? ArrowUpwardIcon : ArrowDownwardIcon;
    return (
      <TableCell
        align={align}
        sx={{ fontSize: 12, fontWeight: "bold", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", "&:hover": { color: "accent.primary" }, color: isActive ? "accent.primary" : "inherit" }}
        onClick={() => handleSortClick(field)}
      >
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
          {label}
          {isActive && <Icon sx={{ fontSize: 12 }} />}
        </Box>
      </TableCell>
    );
  }

  const isFiltered = hasGlobalFilters || (searchText.trim().length > 0);
  const noRowsAtAll = rows.length === 0 && !showNewRow;
  const noRowsAfterFilter = !noRowsAtAll && visibleRows.length === 0;

  // Empty table (no data at all, no active filter)
  if (noRowsAtAll && !isFiltered) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4, gap: 1, color: "text.disabled" }}>
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

      {/* Search bar (expandable) */}
      <Collapse in={searchOpen}>
        <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", bgcolor: "background.subtle" }}>
          <TextField
            inputRef={searchInputRef}
            size="small"
            fullWidth
            placeholder={m.transactions.filters.searchPlaceholder}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: "text.tertiary" }} />
                </InputAdornment>
              ),
              endAdornment: searchText ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchText("")} edge="end">
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{ "& .MuiOutlinedInput-root": { fontSize: 13 } }}
            onKeyDown={(e) => { if (e.key === "Escape") handleCloseSearch(); }}
          />
        </Box>
      </Collapse>

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
              <SortableHeaderCell field="occurredOn" label="Data" />
              <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box
                    component="span"
                    sx={{ cursor: "pointer", userSelect: "none", "&:hover": { color: "accent.primary" }, color: sort?.field === "description" ? "accent.primary" : "inherit", display: "inline-flex", alignItems: "center", gap: 0.25 }}
                    onClick={() => handleSortClick("description")}
                  >
                    Descrição
                    {sort?.field === "description" && (
                      sort.dir === "asc" ? <ArrowUpwardIcon sx={{ fontSize: 12 }} /> : <ArrowDownwardIcon sx={{ fontSize: 12 }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }} />
                  {!searchOpen && (
                    <Tooltip title="Buscar por descrição">
                      <IconButton size="small" onClick={handleOpenSearch} sx={{ ml: 0.5 }}>
                        <SearchIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {searchOpen && (
                    <Tooltip title="Fechar busca">
                      <IconButton size="small" onClick={handleCloseSearch} sx={{ ml: 0.5 }}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </TableCell>
              {show("category") && <SortableHeaderCell field="categoryId" label="Categoria" />}
              {show("subcategory") && <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Subcategoria</TableCell>}
              {show("institution") && <SortableHeaderCell field="institutionId" label="Instituição" />}
              <SortableHeaderCell field="amountCents" label="Valor" align="right" />
              {show("responsibleUser") && <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Resp.</TableCell>}

              {show("investmentType") && <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Tipo inv.</TableCell>}
              <TableCell />
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

            {noRowsAfterFilter ? (
              <TableRow>
                <TableCell colSpan={99} sx={{ border: 0, py: 5 }}>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, color: "text.disabled" }}>
                    <FilterListOffIcon sx={{ fontSize: 40, opacity: 0.4 }} />
                    <Typography variant="body2" fontWeight="medium" color="text.secondary">
                      {m.transactions.filters.noResults}
                    </Typography>
                    <Typography variant="caption" color="text.tertiary" textAlign="center">
                      {m.transactions.filters.noResultsHint}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        if (searchText) { setSearchText(""); setSearchOpen(false); }
                        else clearFilters();
                      }}
                      sx={{ mt: 0.5 }}
                    >
                      {m.transactions.filters.clearFilters}
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  accountId={accountId}
                  isSelected={selected.has(tx.id)}
                  isReadOnly={isReadOnly}
                  sectionCountType={sectionCountType}
                  hiddenColumns={hiddenColumns}
                  categories={categories}
                  institutions={institutions}
                  members={members}
                  onSelect={handleSelect}
                  onOptimisticUpdate={optimisticUpdate}
                  onDeleteRequested={onDeleteRequested}
                  onDuplicated={onDuplicated}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
