"use client";

import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CloseIcon from "@mui/icons-material/Close";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";
import SearchIcon from "@mui/icons-material/Search";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
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
import type { SectionCountType } from "@prisma/client";
import { useSnackbar } from "notistack";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createCategoryAction,
  createInstitutionAction,
  createSubcategoryAction,
} from "@/actions/account-settings";
import { bulkUpdateAction, updateTransactionAction } from "@/actions/transactions";
import { applyGlobalFilters, useMonthFilters } from "@/components/months/MonthFilterContext";
import { useDeleteUndo } from "@/components/providers/DeleteUndoProvider";
import { TagUpdateContext } from "@/components/tags/TagUpdateContext";
import type { ActionResult } from "@/lib/action-result";
import { formatDateLong } from "@/lib/dates";
import { m } from "@/lib/messages";
import type { BulkUpdateInput, UpdateTransactionInput } from "@/lib/schemas/transaction";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

import { BulkActionBar } from "./BulkActionBar";
import { MoveTransactionsDialog } from "./MoveTransactionsDialog";
import { NewTransactionRow } from "./NewTransactionRow";
import { OptionsProvider } from "./OptionsContext";
import { resolveRowLayout, useIsNarrow, type RowLayout } from "./row-layout";
import { RowActionsMenu } from "./RowActionsMenu";
import { TransactionDetailDialog } from "./TransactionDetailDialog";
import { TransactionRow } from "./TransactionRow";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  ResponsiblePartyOption,
  RowMenuItem,
  TransactionRow as TxRow,
} from "./types";

type SortField = "occurredOn" | "amountCents" | "description" | "categoryId" | "institutionId";
type SortDir = "asc" | "desc";
type SortState = { field: SortField; dir: SortDir } | null;

const DEFAULT_SORT_FIELD: SortField = "occurredOn";
const DEFAULT_SORT_DIR: SortDir = "desc";

// Rótulos do header (`.thead` do frame 66 §1): fonte SANS — não mono —, 0.62rem,
// peso 500, letter-spacing .05em, uppercase, `text.tertiary`.
const HEADER_LABEL_SX = {
  fontWeight: 500,
  fontSize: "0.62rem",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "text.tertiary",
} as const;

/**
 * Campos que `bulkUpdateAction` sabe aplicar em UM round-trip para o lote
 * inteiro. Os demais campos tocados na edição em massa (data, descrição, valor,
 * nota, subcategoria, responsável, …) precisam de `updateTransactionAction`
 * linha a linha — ver `saveBulkEdit`.
 */
const BULK_ACTION_FIELDS = new Set<keyof TxRow>([
  "isPending",
  "isFavorite",
  "categoryId",
  "institutionId",
  "expenseType",
  "paymentMethod",
]);

/**
 * Converte um patch em formato de linha (strings serializadas) para o input da
 * Server Action de update individual (Date/BigInt). Só entram as chaves
 * presentes no patch — `undefined` nunca é enviado.
 */
function toUpdateInput(patch: Partial<TxRow>): Omit<UpdateTransactionInput, "transactionId"> {
  const out: Record<string, unknown> = {};
  if ("occurredOn" in patch) out.occurredOn = new Date(patch.occurredOn as string);
  if ("amountCents" in patch) out.amountCents = BigInt(patch.amountCents as string);
  if ("description" in patch) out.description = patch.description;
  if ("notes" in patch) out.notes = patch.notes;
  if ("isPending" in patch) out.isPending = patch.isPending;
  if ("isFavorite" in patch) out.isFavorite = patch.isFavorite;
  if ("categoryId" in patch) out.categoryId = patch.categoryId;
  if ("subcategoryId" in patch) out.subcategoryId = patch.subcategoryId;
  if ("institutionId" in patch) out.institutionId = patch.institutionId;
  if ("institutionText" in patch) out.institutionText = patch.institutionText;
  if ("responsiblePartyId" in patch) out.responsiblePartyId = patch.responsiblePartyId;
  if ("cardInstallment" in patch) out.cardInstallment = patch.cardInstallment;
  if ("investmentType" in patch) out.investmentType = patch.investmentType;
  if ("expenseType" in patch) out.expenseType = patch.expenseType;
  if ("paymentMethod" in patch) out.paymentMethod = patch.paymentMethod;
  if ("originalCurrency" in patch) out.originalCurrency = patch.originalCurrency;
  if ("exchangeRate" in patch) out.exchangeRate = patch.exchangeRate;
  if ("originalAmountCents" in patch) {
    out.originalAmountCents =
      patch.originalAmountCents !== null && patch.originalAmountCents !== undefined
        ? BigInt(patch.originalAmountCents)
        : null;
  }
  return out as Omit<UpdateTransactionInput, "transactionId">;
}

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
  rowLayout: RowLayout;
  initialTransactions: TxRow[];
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  parties: ResponsiblePartyOption[];
  aliases: SerializedTransactionAlias[];
  defaultResponsiblePartyId: string | null;
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
  rowLayout,
  initialTransactions,
  categories: propCategories,
  institutions: propInstitutions,
  members,
  parties,
  aliases,
  defaultResponsiblePartyId,
  showNewRow,
  onNewRowClose,
  groupByDate,
  onSortActiveChange,
  resetSortSignal,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<TxRow[]>(initialTransactions);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Categoria/instituição vivem em state (em vez de ler a prop direto) para permitir
  // criação inline otimista via CreatableEntitySelect (Spec V3 · Model D) sem esperar
  // o round-trip de revalidação do server.
  const [categories, setCategories] = useState<CategoryOption[]>(propCategories);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>(propInstitutions);

  // O server continua sendo fonte da verdade — quando a prop mudar (ex: revalidação
  // após a action de criação, ou navegação), realinha o state local.
  useEffect(() => {
    setCategories(propCategories);
  }, [propCategories]);

  useEffect(() => {
    setInstitutions(propInstitutions);
  }, [propInstitutions]);

  const [detailTxId, setDetailTxId] = useState<string | null>(null);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<{ anchorEl: HTMLElement; items: RowMenuItem[] } | null>(
    null,
  );
  const [moveIds, setMoveIds] = useState<string[] | null>(null);

  const handleOpenRowMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, items: RowMenuItem[]) => {
      setRowMenu({ anchorEl: e.currentTarget, items });
    },
    [],
  );
  const handleOpenMove = useCallback((ids: string[]) => setMoveIds(ids), []);
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

  // Layout efetivo (Spec 66 TX-04d): degrada para "rich" em viewport estreito.
  // A medição vem do container de overflow; `useIsNarrow` retorna false até
  // montar, então SSR/1ª render usam sempre o layout configurado (sem mismatch).
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isNarrow = useIsNarrow(wrapperRef);
  const effectiveLayout = resolveRowLayout(rowLayout, isNarrow);

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
    // Entrada rápida (Spec 41): a linha de nova transação permanece aberta após
    // salvar — o próprio NewTransactionRow limpa os campos e refoca a descrição.
    // Fechar é explícito, via ESC ou botão cancelar (onNewRowClose).
    setRows((prev) => [newTx, ...prev]);
  }

  function onBulkMoved(movedIds: string[]) {
    const movedSet = new Set(movedIds);
    setRows((prev) => prev.filter((r) => !movedSet.has(r.id)));
    setSelected(new Set());
  }

  const onBulkUpdated = useCallback((ids: string[], patch: Partial<TxRow>) => {
    const idSet = new Set(ids);
    setRows((prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, ...patch } : r)));
  }, []);

  // ─── Edição em massa INLINE (frame 66 §4) ───────────────────────────────
  // "Editar em massa" não abre modal: coloca todas as linhas selecionadas em
  // edição ao mesmo tempo. Cada linha mostra os próprios valores; o campo que o
  // usuário tocar em QUALQUER linha entra no `bulkPatch` e passa a valer para
  // todas. Salvar/Cancelar são únicos, para o lote inteiro.
  const [bulkEditIds, setBulkEditIds] = useState<Set<string> | null>(null);
  const [bulkPatch, setBulkPatch] = useState<Partial<TxRow>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  const startBulkEdit = useCallback(() => {
    setBulkPatch({});
    setBulkEditIds(new Set(selected));
  }, [selected]);

  const cancelBulkEdit = useCallback(() => {
    setBulkEditIds(null);
    setBulkPatch({});
  }, []);

  const handleBulkFieldChange = useCallback((delta: Partial<TxRow>) => {
    setBulkPatch((prev) => ({ ...prev, ...delta }));
  }, []);

  const saveBulkEdit = useCallback(async () => {
    if (!bulkEditIds || bulkSaving) return;

    const affected = rows.filter((r) => bulkEditIds.has(r.id));
    const ids = affected.map((r) => r.id);
    const touched = bulkPatch;

    if (ids.length === 0 || Object.keys(touched).length === 0) {
      cancelBulkEdit();
      return;
    }

    // Split: o que `bulkUpdateAction` aceita vai numa chamada só para o lote;
    // o resto vai linha a linha, e apenas onde o valor realmente difere.
    const sharedPatch: Record<string, unknown> = {};
    const individualPatch: Partial<TxRow> = {};
    for (const key of Object.keys(touched) as (keyof TxRow)[]) {
      if (BULK_ACTION_FIELDS.has(key)) sharedPatch[key] = touched[key];
      else (individualPatch as Record<string, unknown>)[key] = touched[key];
    }

    const snapshot = new Map(affected.map((r) => [r.id, r]));

    setBulkSaving(true);
    onBulkUpdated(ids, touched); // otimista

    const calls: Promise<ActionResult<void>>[] = [];
    if (Object.keys(sharedPatch).length > 0) {
      calls.push(
        bulkUpdateAction(accountId, {
          ids,
          monthId,
          patch: sharedPatch as BulkUpdateInput["patch"],
        }),
      );
    }

    const individualKeys = Object.keys(individualPatch) as (keyof TxRow)[];
    if (individualKeys.length > 0) {
      for (const row of affected) {
        const diff: Partial<TxRow> = {};
        for (const key of individualKeys) {
          if (!Object.is(individualPatch[key], row[key])) {
            (diff as Record<string, unknown>)[key] = individualPatch[key];
          }
        }
        if (Object.keys(diff).length === 0) continue;
        calls.push(
          updateTransactionAction(accountId, { transactionId: row.id, ...toUpdateInput(diff) }),
        );
      }
    }

    const results = await Promise.all(calls);

    setBulkSaving(false);
    setBulkEditIds(null);
    setBulkPatch({});
    setSelected(new Set());

    const failure = results.find((r) => !r.ok);
    if (failure && !failure.ok) {
      setRows((prev) => prev.map((r) => snapshot.get(r.id) ?? r));
      enqueueSnackbar(failure.error.message, { variant: "error" });
    }
  }, [
    accountId,
    bulkEditIds,
    bulkPatch,
    bulkSaving,
    cancelBulkEdit,
    enqueueSnackbar,
    monthId,
    onBulkUpdated,
    rows,
  ]);

  // Só a 1ª linha do lote autofoca a descrição — N autoFocus brigariam entre si.
  const firstBulkEditId = bulkEditIds
    ? (visibleRows.find((r) => bulkEditIds.has(r.id))?.id ?? null)
    : null;

  const onDeleteRequested = useCallback(
    (id: string) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      optimisticDelete(id);
      requestDelete(id, row, accountId);
    },
    [rows, requestDelete, accountId],
  );

  // ─── Criação inline de categoria/subcategoria/instituição (CreatableEntitySelect) ───
  // Reusam as mesmas Server Actions do fluxo "criar em Configurações"; aqui só
  // injetamos o resultado no state local para auto-seleção otimista na linha.

  const onCreateCategory = useCallback(
    async (name: string): Promise<string | null> => {
      const res = await createCategoryAction(accountId, { name });
      if (!res.ok) {
        enqueueSnackbar(res.error.message || m.transactions.options.createError, {
          variant: "error",
        });
        return null;
      }
      setCategories((prev) =>
        [...prev, { id: res.data.categoryId, name, subcategories: [] }].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      enqueueSnackbar(m.transactions.options.created, { variant: "success" });
      return res.data.categoryId;
    },
    [accountId, enqueueSnackbar],
  );

  const onCreateSubcategory = useCallback(
    async (categoryId: string, name: string): Promise<string | null> => {
      const res = await createSubcategoryAction(accountId, { categoryId, name });
      if (!res.ok) {
        enqueueSnackbar(res.error.message || m.transactions.options.createError, {
          variant: "error",
        });
        return null;
      }
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? {
                ...c,
                subcategories: [...c.subcategories, { id: res.data.subcategoryId, name }].sort(
                  (a, b) => a.name.localeCompare(b.name),
                ),
              }
            : c,
        ),
      );
      enqueueSnackbar(m.transactions.options.created, { variant: "success" });
      return res.data.subcategoryId;
    },
    [accountId, enqueueSnackbar],
  );

  const onCreateInstitution = useCallback(
    async (name: string): Promise<string | null> => {
      const res = await createInstitutionAction(accountId, { name });
      if (!res.ok) {
        enqueueSnackbar(res.error.message || m.transactions.options.createError, {
          variant: "error",
        });
        return null;
      }
      setInstitutions((prev) =>
        [...prev, { id: res.data.institutionId, name }].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      enqueueSnackbar(m.transactions.options.created, { variant: "success" });
      return res.data.institutionId;
    },
    [accountId, enqueueSnackbar],
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
          ...HEADER_LABEL_SX,
          whiteSpace: "nowrap",
          cursor: "pointer",
          userSelect: "none",
          "&:hover": { color: "accent.primary" },
          color: isActive ? "accent.primary" : "text.tertiary",
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

  // Renderer único da linha (usado com e sem agrupamento por data) — evita que a
  // lista de props divirja entre os dois caminhos.
  const renderTransactionRow = (tx: TxRow) => {
    const inBulkEdit = bulkEditIds?.has(tx.id) ?? false;
    return (
      <TransactionRow
        key={tx.id}
        tx={tx}
        accountId={accountId}
        currentUserId={currentUserId}
        isSelected={selected.has(tx.id)}
        isReadOnly={isReadOnly}
        sectionCountType={sectionCountType}
        hiddenColumns={hiddenColumns}
        effectiveLayout={effectiveLayout}
        categories={categories}
        institutions={institutions}
        members={members}
        parties={parties}
        aliases={aliases}
        autoEdit={editRequestId === tx.id}
        bulkEditing={inBulkEdit}
        bulkPatch={inBulkEdit ? bulkPatch : undefined}
        bulkFocus={firstBulkEditId === tx.id}
        onSelect={handleSelect}
        onOptimisticUpdate={optimisticUpdate}
        onDeleteRequested={onDeleteRequested}
        onDuplicated={onDuplicated}
        onViewDetails={setDetailTxId}
        onAutoEditConsumed={handleAutoEditConsumed}
        onOpenMenu={handleOpenRowMenu}
        onOpenMove={handleOpenMove}
        onBulkFieldChange={handleBulkFieldChange}
        onBulkSave={saveBulkEdit}
        onBulkCancel={cancelBulkEdit}
      />
    );
  };

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
    <OptionsProvider
      value={{
        onCreateCategory,
        onCreateSubcategory,
        onCreateInstitution,
        canManageOptions: canEdit,
      }}
    >
      <TagUpdateContext.Provider value={globalTagUpdate}>
        <Box>
          {selected.size > 0 && (
            <BulkActionBar
              accountId={accountId}
              tableId={tableId}
              monthId={monthId}
              sourceCountType={sectionCountType}
              sampleAmountCents={String(
                rows.find((r) => r.id === selectedIds[0])?.amountCents ?? "",
              )}
              selectedIds={selectedIds}
              allSelectedPending={allSelectedPending}
              isEditing={bulkEditIds !== null}
              isSavingEdit={bulkSaving}
              onClear={() => setSelected(new Set())}
              onMoved={onBulkMoved}
              onBulkUpdated={onBulkUpdated}
              onStartInlineEdit={startBulkEdit}
              onSaveInlineEdit={saveBulkEdit}
              onCancelInlineEdit={cancelBulkEdit}
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

          <Box ref={wrapperRef} sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                {effectiveLayout === "rich" ? (
                  // Header mínimo no layout rico (frame B): select-all + os três
                  // rótulos que o layout de fato tem (DATA · TRANSAÇÃO · VALOR).
                  // Sem cabeçalhos por coluna — no rico os metadados são pílulas.
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
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Box component="span" sx={{ ...HEADER_LABEL_SX, minWidth: 40 }}>
                          {m.transactions.fields.occurredOn}
                        </Box>
                        <Box component="span" sx={{ ...HEADER_LABEL_SX, flex: 1, minWidth: 0 }}>
                          {m.transactions.detail.titleNeutral}
                        </Box>
                        <Box component="span" sx={{ ...HEADER_LABEL_SX, flexShrink: 0 }}>
                          {m.transactions.fields.amount}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ width: 160, minWidth: 160 }} />
                  </TableRow>
                ) : (
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
                  <TableCell sx={HEADER_LABEL_SX}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box
                        component="span"
                        sx={{
                          cursor: "pointer",
                          userSelect: "none",
                          "&:hover": { color: "accent.primary" },
                          color: sort?.field === "description" ? "accent.primary" : "text.tertiary",
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
                    <TableCell sx={HEADER_LABEL_SX}>Subcategoria</TableCell>
                  )}
                  {show("institution") && (
                    <SortableHeaderCell field="institutionId" label="Instituição" />
                  )}
                  {show("paymentMethod") && (
                    <TableCell sx={HEADER_LABEL_SX}>{m.transactions.paymentMethodColumn}</TableCell>
                  )}
                  <SortableHeaderCell field="amountCents" label="Valor" align="right" />
                  {show("responsibleUser") && (
                    <TableCell sx={HEADER_LABEL_SX}>Resp.</TableCell>
                  )}

                  {show("investmentType") && (
                    <TableCell sx={HEADER_LABEL_SX}>Tipo inv.</TableCell>
                  )}
                  {show("cardInstallment") && (
                    <TableCell align="left" sx={HEADER_LABEL_SX}>
                      {m.transactions.installments.column}
                    </TableCell>
                  )}
                  {show("expenseType") && (
                    <TableCell align="center" sx={{ ...HEADER_LABEL_SX, width: 28, px: 0.5 }}>
                      Tipo
                    </TableCell>
                  )}
                  {show("tags") && <TableCell sx={HEADER_LABEL_SX}>Tags</TableCell>}
                    <TableCell sx={{ width: 160, minWidth: 160 }} />
                  </TableRow>
                )}
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
                    parties={parties}
                    aliases={aliases}
                    defaultResponsiblePartyId={defaultResponsiblePartyId}
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
                      return visibleRows.map(renderTransactionRow);
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
                      result.push(renderTransactionRow(tx));
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
              categories={categories}
              institutions={institutions}
              members={members}
              parties={parties}
              timezone={timezone}
              canEdit={!isReadOnly}
              onEdit={handleEditFromDetail}
            />
          )}

          <RowActionsMenu
            anchorEl={rowMenu?.anchorEl ?? null}
            items={rowMenu?.items ?? []}
            onClose={() => setRowMenu(null)}
          />

          <MoveTransactionsDialog
            accountId={accountId}
            sourceTableId={tableId}
            sourceMonthId={monthId}
            sourceCountType={sectionCountType}
            sampleAmountCents={
              moveIds ? String(rows.find((r) => r.id === moveIds[0])?.amountCents ?? "") : undefined
            }
            selectedIds={moveIds ?? []}
            open={!!moveIds}
            onClose={() => setMoveIds(null)}
            onMoved={(ids) => {
              onBulkMoved(ids);
              setMoveIds(null);
            }}
          />
        </Box>
      </TagUpdateContext.Provider>
    </OptionsProvider>
  );
}
