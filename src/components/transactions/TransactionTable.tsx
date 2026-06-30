"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { m } from "@/lib/messages";
import { formatDateLong } from "@/lib/dates";
import { applyGlobalFilters, useMonthFilters } from "@/components/months/MonthFilterContext";
import { useDeleteUndo } from "@/components/providers/DeleteUndoProvider";
import { TagUpdateContext } from "@/components/tags/TagUpdateContext";
import { BulkActionBar } from "./BulkActionBar";
import { NewTransactionRow } from "./NewTransactionRow";
import { TransactionRow } from "./TransactionRow";
import { TransactionDetailDialog } from "./TransactionDetailDialog";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  TransactionRow as TxRow,
} from "./types";

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

function sortRows(
  rows: TxRow[],
  sort: SortState,
  categoryById: Map<string, string>,
  institutionById: Map<string, string>,
): TxRow[] {
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
        const aName = categoryById.get(a.categoryId ?? "") ?? "";
        const bName = categoryById.get(b.categoryId ?? "") ?? "";
        cmp = aName.localeCompare(bName);
        break;
      }
      case "institutionId": {
        const aName = institutionById.get(a.institutionId ?? "") ?? "";
        const bName = institutionById.get(b.institutionId ?? "") ?? "";
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
  currentUserId: string;
  canEdit: boolean;
  timezone: string;
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
  groupByDate: boolean;
  /** Notifica o pai quando o sort passa a ser não-padrão (true) ou volta ao padrão (false) */
  onSortActiveChange?: (active: boolean) => void;
  /** Incrementar para disparar reset do sort externamente */
  resetSortSignal?: number;
};

export function TransactionTable({
  tableId,
  monthId,
  accountId,
  currentUserId,
  canEdit,
  timezone,
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
  groupByDate,
  onSortActiveChange,
  resetSortSignal,
}: Props) {
  const [rows, setRows] = useState<TxRow[]>(initialTransactions);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailTxId, setDetailTxId] = useState<string | null>(null);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [isGrouped, setIsGrouped] = useState(groupByDate);

  // Sincroniza se a prop muda (ex: após revalidação do server)
  useEffect(() => {
    setIsGrouped(groupByDate);
  }, [groupByDate]);

  // Reset do sort disparado pelo pai (ex: botão no header da tabela)
  useEffect(() => {
    if (resetSortSignal !== undefined && resetSortSignal > 0) {
      setSort(null);
      onSortActiveChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSortSignal]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { requestDelete, registerRestoreCallback, unregisterRestoreCallback } = useDeleteUndo();

  const {
    filters,
    clearFilters,
    isActive: hasGlobalFilters,
    updateTagInOptions,
  } = useMonthFilters();

  const isReadOnly = !sectionIsActive || !canEdit;
  const selectedIds = Array.from(selected);
  const detailTx = detailTxId ? (rows.find((r) => r.id === detailTxId) ?? null) : null;

  // Map-based lookups para sortRows — O(1) em vez de O(n) por transação
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const institutionById = useMemo(
    () => new Map(institutions.map((i) => [i.id, i.name])),
    [institutions],
  );

  // Debounce do searchText para evitar re-runs pesados a cada keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(searchText);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchText), 250);
    return () => clearTimeout(id);
  }, [searchText]);

  function handleEditFromDetail() {
    if (!detailTx) return;
    setEditRequestId(detailTx.id);
    setDetailTxId(null);
  }
  const show = (key: string) => !hiddenColumns[key];

  // Apply global filters → then local search (debounced) → then sort
  const visibleRows = useMemo(() => {
    let result = applyGlobalFilters(rows, filters);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter((r) => (r.description ?? "").toLowerCase().includes(q));
    }
    return sortRows(result, sort, categoryById, institutionById);
  }, [rows, filters, debouncedSearch, sort, categoryById, institutionById]);

  const allSelected = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id));
  const someSelected = visibleRows.some((r) => selected.has(r.id)) && !allSelected;

  const allSelectedPending =
    selectedIds.length > 0 &&
    selectedIds.every((id) => rows.find((r) => r.id === id)?.isPending ?? false);

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  function handleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(visibleRows.map((r) => r.id)) : new Set());
  }

  const optimisticUpdate = useCallback((id: string, patch: Partial<TxRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  /** Atualiza nome/cor de uma tag em TODAS as linhas da tabela e nas opções de filtro. */
  const globalTagUpdate = useCallback(
    (tagId: string, name: string, color: string | null) => {
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          tags: r.tags.map((t) => (t.id === tagId ? { ...t, name, color } : t)),
        })),
      );
      updateTagInOptions(tagId, name, color);
    },
    [updateTagInOptions],
  );

  function optimisticDelete(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // Registrar callback de restauração no provider global de undo
  useEffect(() => {
    registerRestoreCallback(tableId, (restoredRows) => {
      setRows((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const toAdd = restoredRows.filter((r) => !existingIds.has(r.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
    });
    return () => unregisterRestoreCallback(tableId);
  }, [tableId, registerRestoreCallback, unregisterRestoreCallback]);

  const onDuplicated = useCallback((newTx: TxRow, sourceId: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === sourceId);
      const copy = [...prev];
      copy.splice(idx + 1, 0, newTx);
      return copy;
    });
  }, []);

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

  const onDeleteRequested = useCallback(
    (id: string) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      optimisticDelete(id);
      requestDelete(id, row, accountId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, requestDelete, accountId],
  );

  function handleOpenSearch() {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  function handleCloseSearch() {
    setSearchOpen(false);
    setSearchText("");
  }

  function handleSortClick(field: SortField) {
    const next = nextSortState(sort, field);
    setSort(next);
    const isNonDefault = next !== null && next.field !== DEFAULT_SORT_FIELD;
    onSortActiveChange?.(isNonDefault);
  }

  const handleAutoEditConsumed = useCallback(() => setEditRequestId(null), []);

  function SortableHeaderCell({
    field,
    label,
    align,
  }: {
    field: SortField;
    label: string;
    align?: "right";
  }) {
    const isActive = sort?.field === field;
    const Icon = sort?.dir === "asc" ? ArrowUpwardIcon : ArrowDownwardIcon;
    return (
      <TableCell
        align={align}
        sx={{
          fontSize: 12,
          fontWeight: "bold",
          whiteSpace: "nowrap",
          cursor: "pointer",
          userSelect: "none",
          "&:hover": { color: "accent.primary" },
          color: isActive ? "accent.primary" : "inherit",
        }}
        onClick={() => handleSortClick(field)}
      >
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
          {label}
          {isActive && <Icon sx={{ fontSize: 12 }} />}
        </Box>
      </TableCell>
    );
  }

  const isFiltered = hasGlobalFilters || searchText.trim().length > 0;
  const noRowsAtAll = rows.length === 0 && !showNewRow;
  const noRowsAfterFilter = !noRowsAtAll && visibleRows.length === 0;

  // Empty table (no data at all, no active filter)
  if (noRowsAtAll && !isFiltered) {
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
    <TagUpdateContext.Provider value={globalTagUpdate}>
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
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: 1,
              borderColor: "divider",
              bgcolor: "background.subtle",
            }}
          >
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
              onKeyDown={(e) => {
                if (e.key === "Escape") handleCloseSearch();
              }}
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
                      sx={{
                        cursor: "pointer",
                        userSelect: "none",
                        "&:hover": { color: "accent.primary" },
                        color: sort?.field === "description" ? "accent.primary" : "inherit",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.25,
                      }}
                      onClick={() => handleSortClick("description")}
                    >
                      Descrição
                      {sort?.field === "description" &&
                        (sort.dir === "asc" ? (
                          <ArrowUpwardIcon sx={{ fontSize: 12 }} />
                        ) : (
                          <ArrowDownwardIcon sx={{ fontSize: 12 }} />
                        ))}
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
                {show("subcategory") && (
                  <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Subcategoria</TableCell>
                )}
                {show("institution") && (
                  <SortableHeaderCell field="institutionId" label="Instituição" />
                )}
                <SortableHeaderCell field="amountCents" label="Valor" align="right" />
                {show("responsibleUser") && (
                  <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Resp.</TableCell>
                )}

                {show("investmentType") && (
                  <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Tipo inv.</TableCell>
                )}
                {show("cardInstallment") && (
                  <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>
                    {m.transactions.installments.column}
                  </TableCell>
                )}
                {show("expenseType") && (
                  <TableCell sx={{ fontSize: 12, fontWeight: "bold", width: 28, px: 0.5 }}>
                    Tipo
                  </TableCell>
                )}
                {show("tags") && (
                  <TableCell sx={{ fontSize: 12, fontWeight: "bold" }}>Tags</TableCell>
                )}
                <TableCell sx={{ width: 200, minWidth: 200 }} />
              </TableRow>
            </TableHead>

            <TableBody>
              {showNewRow && (
                <NewTransactionRow
                  tableId={tableId}
                  monthId={monthId}
                  accountId={accountId}
                  currentUserId={currentUserId}
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
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1.5,
                        color: "text.disabled",
                      }}
                    >
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
                          if (searchText) {
                            setSearchText("");
                            setSearchOpen(false);
                          } else clearFilters();
                        }}
                        sx={{ mt: 0.5 }}
                      >
                        {m.transactions.filters.clearFilters}
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                (() => {
                  // Agrupamento por data: ativo se isGrouped=true E sort for a ordenação padrão (occurredOn)
                  const groupingActive = isGrouped && (!sort || sort.field === "occurredOn");

                  if (!groupingActive) {
                    return visibleRows.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        accountId={accountId}
                        currentUserId={currentUserId}
                        isSelected={selected.has(tx.id)}
                        isReadOnly={isReadOnly}
                        sectionCountType={sectionCountType}
                        hiddenColumns={hiddenColumns}
                        categories={categories}
                        institutions={institutions}
                        members={members}
                        autoEdit={editRequestId === tx.id}
                        onSelect={handleSelect}
                        onOptimisticUpdate={optimisticUpdate}
                        onDeleteRequested={onDeleteRequested}
                        onDuplicated={onDuplicated}
                        onViewDetails={setDetailTxId}
                        onAutoEditConsumed={handleAutoEditConsumed}
                      />
                    ));
                  }

                  // Renderizar com separadores de data
                  const result: React.ReactNode[] = [];
                  let lastDate: string | null = null;
                  for (const tx of visibleRows) {
                    if (tx.occurredOn !== lastDate) {
                      lastDate = tx.occurredOn;
                      result.push(
                        <TableRow
                          key={`date-sep-${tx.occurredOn}`}
                          sx={{ pointerEvents: "none", bgcolor: "background.subtle" }}
                        >
                          <TableCell
                            colSpan={99}
                            sx={{
                              py: 0.5,
                              px: 2,
                              borderBottom: 0,
                              borderTop: 1,
                              borderColor: "divider",
                            }}
                          >
                            <Typography variant="caption" color="text.tertiary" fontWeight={500}>
                              {formatDateLong(tx.occurredOn)}
                            </Typography>
                          </TableCell>
                        </TableRow>,
                      );
                    }
                    result.push(
                      <TransactionRow
                        key={tx.id}
                        tx={tx}
                        accountId={accountId}
                        currentUserId={currentUserId}
                        isSelected={selected.has(tx.id)}
                        isReadOnly={isReadOnly}
                        sectionCountType={sectionCountType}
                        hiddenColumns={hiddenColumns}
                        categories={categories}
                        institutions={institutions}
                        members={members}
                        autoEdit={editRequestId === tx.id}
                        onSelect={handleSelect}
                        onOptimisticUpdate={optimisticUpdate}
                        onDeleteRequested={onDeleteRequested}
                        onDuplicated={onDuplicated}
                        onViewDetails={setDetailTxId}
                        onAutoEditConsumed={handleAutoEditConsumed}
                      />,
                    );
                  }
                  return result;
                })()
              )}
            </TableBody>
          </Table>
        </Box>

        {detailTx && (
          <TransactionDetailDialog
            open
            onClose={() => setDetailTxId(null)}
            tx={detailTx}
            accountId={accountId}
            sectionCountType={sectionCountType}
            hiddenColumns={hiddenColumns}
            categories={categories}
            institutions={institutions}
            members={members}
            timezone={timezone}
            canEdit={!isReadOnly}
            onEdit={handleEditFromDetail}
            onTagsChange={(tags) => optimisticUpdate(detailTx.id, { tags })}
            onLinkCountChanged={(newCount) =>
              optimisticUpdate(detailTx.id, { linkCount: newCount })
            }
            onViewLinkedTransaction={(txId) => setDetailTxId(txId)}
          />
        )}
      </Box>
    </TagUpdateContext.Provider>
  );
}
