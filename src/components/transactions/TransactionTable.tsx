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
import type { Theme } from "@mui/material/styles";
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
import { EmptyState } from "@/components/ui/EmptyState";
import { MoneyValue } from "@/components/ui/MoneyValue";
import type { ActionResult } from "@/lib/action-result";
import { m } from "@/lib/messages";
import { displaySignInverts } from "@/lib/money";
import {
  DEFAULT_INHERIT_ON_NEW_ROW,
  type DefaultSort,
  type GroupBy,
  type InheritOnNewRowField,
} from "@/lib/schemas/settings";
import type { BulkUpdateInput, UpdateTransactionInput } from "@/lib/schemas/transaction";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";
import type { TableColumnKey } from "@/lib/table-columns";
import { DEFAULT_DENSITY, type Density } from "@/lib/table-density";

import { BulkActionBar } from "./BulkActionBar";
import { groupRows, resolveGrouping } from "./group-rows";
import { MoveTransactionsDialog } from "./MoveTransactionsDialog";
import { NewTransactionRow } from "./NewTransactionRow";
import { OptionsProvider } from "./OptionsContext";
import {
  effectivePinnedColumns,
  pinnedHeadCellSx,
  pinnedSelectHeadCellSx,
} from "./pinned-columns";
import { resolveRowLayout, useIsNarrow, type RowLayout } from "./row-layout";
import { RowActionsMenu } from "./RowActionsMenu";
import {
  FALLBACK_SORT,
  isCustomSort,
  nextSortState,
  sortRows,
  type SortState,
} from "./sort-rows";
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
  /**
   * Spec 69 §7.2 — densidade do tipo de tabela. Vira `data-density` na raiz e,
   * daí, as 3 variáveis CSS (`--row-h`, `--row-fs`, `--ctrl-h`) que a linha, o
   * editor e a barra de gavetas consomem. Opcional para não obrigar quem
   * renderiza a tabela fora do mês a conhecer o campo.
   */
  density?: Density;
  /**
   * Spec 69 §2.1 — o que a linha-fantasma herda do lançamento recém-criado.
   * Só atravessa até `NewTransactionRow`; a tabela em si não usa. Opcional com o
   * default de sempre (`["occurredOn"]`) para quem renderiza fora do mês.
   */
  inheritOnNewRow?: InheritOnNewRowField[];
  /**
   * Spec 69 §2.1 — ordenação com que a tabela ABRE, do tipo de tabela. É só o
   * ponto de partida: clicar no cabeçalho continua reordenando, e o terceiro
   * clique volta para cá (em vez do `occurredOn/desc` que era fixo no código).
   */
  defaultSort?: DefaultSort;
  /**
   * Spec 69 §2.1 — dimensão de agrupamento do TIPO. Não substitui `groupByDate`
   * (por tabela): a precedência entre os dois está documentada em `group-rows.ts`.
   */
  typeGroupBy?: GroupBy;
  /** Spec 69 §2.1 — soma das linhas do bloco no cabeçalho do grupo. */
  showGroupSubtotal?: boolean;
  /** Spec 69 §2.1 — `false` remove seleção de linha, "selecionar tudo" e a BulkActionBar. */
  allowBulkEdit?: boolean;
  /** Spec 69 §2.1 — `true` mantém a linha-fantasma de criação sempre visível, no fim. */
  keepGhostRow?: boolean;
  /**
   * Spec 69 §16 — colunas fixadas à esquerda, **como estão gravadas**. A tabela
   * é quem resolve (∩ `PINNABLE_COLUMNS` ∩ visíveis, ordem das visíveis, e nada
   * no layout de pílulas); ninguém aqui confia no valor cru do banco.
   */
  pinnedColumns?: unknown;
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
  density = DEFAULT_DENSITY,
  inheritOnNewRow = DEFAULT_INHERIT_ON_NEW_ROW,
  defaultSort = FALLBACK_SORT,
  typeGroupBy = null,
  showGroupSubtotal = false,
  allowBulkEdit = true,
  keepGhostRow = false,
  pinnedColumns: rawPinnedColumns,
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
  // Spec 69 §2.1 — a ordenação NASCE do tipo de tabela (`defaultSort`) em vez de
  // `null` + `occurredOn/desc` fixos. Continua sendo estado local: o clique no
  // cabeçalho reordena normalmente, e o 3º clique volta para este mesmo valor.
  const [sort, setSort] = useState<SortState>(defaultSort);
  const [isGrouped, setIsGrouped] = useState(groupByDate);

  // Sincroniza se a prop muda (ex: após revalidação do server)
  useEffect(() => {
    setIsGrouped(groupByDate);
  }, [groupByDate]);

  // O padrão do tipo mudou em Configurações (revalidação do server) → a tabela
  // reabre no novo padrão. Só realinha o que está em vigor, sem tocar num sort
  // que o usuário tenha escolhido no cabeçalho depois.
  useEffect(() => {
    setSort(defaultSort);
    onSortActiveChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSort.key, defaultSort.dir]);

  // Reset do sort disparado pelo pai (ex: botão no header da tabela)
  useEffect(() => {
    if (resetSortSignal !== undefined && resetSortSignal > 0) {
      setSort(defaultSort);
      onSortActiveChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSortSignal]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Layout efetivo (Spec 66 TX-04d): degrada para "pills" em viewport estreito.
  // A medição vem do container de overflow; `useIsNarrow` retorna false até
  // montar, então SSR/1ª render usam sempre o layout configurado (sem mismatch).
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isNarrow = useIsNarrow(wrapperRef);
  const effectiveLayout = resolveRowLayout(rowLayout, isNarrow);

  /**
   * Spec 69 §16 — as colunas EFETIVAMENTE fixadas.
   *
   * Só vale no layout A: em pílulas (configurado ou por degradação de viewport)
   * não existe grade de colunas para fixar, então nada gruda mesmo com valor
   * gravado. A filtragem por `PINNABLE_COLUMNS` e por coluna visível é do
   * `resolvePinnedColumns`.
   */
  const pinnedColumns = useMemo(
    () => effectivePinnedColumns(rawPinnedColumns, hiddenColumns, effectiveLayout),
    [effectiveLayout, rawPinnedColumns, hiddenColumns],
  );

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

  // Map-based lookups para sortRows/groupRows — O(1) em vez de O(n) por transação
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const subcategoryById = useMemo(
    () => new Map(categories.flatMap((c) => c.subcategories.map((s) => [s.id, s.name] as const))),
    [categories],
  );
  const institutionById = useMemo(
    () => new Map(institutions.map((i) => [i.id, i.name])),
    [institutions],
  );
  const partyById = useMemo(() => new Map(parties.map((p) => [p.id, p.name])), [parties]);
  const sortLookups = useMemo(
    () => ({ categoryById, subcategoryById, institutionById, partyById }),
    [categoryById, subcategoryById, institutionById, partyById],
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
    return sortRows(result, sort, sortLookups);
  }, [rows, filters, debouncedSearch, sort, sortLookups]);

  // Spec 69 §2.1 — dimensão de agrupamento em vigor. A precedência entre o
  // `groupBy` do TIPO e o `groupByDate` desta TABELA está em `group-rows.ts`.
  const effectiveGroupBy = resolveGrouping(typeGroupBy, isGrouped, sort.key);
  const groups = useMemo(
    () =>
      effectiveGroupBy === null
        ? null
        : groupRows(visibleRows, effectiveGroupBy, { categoryById, partyById }),
    [visibleRows, effectiveGroupBy, categoryById, partyById],
  );

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

  function handleSortClick(field: TableColumnKey) {
    const next = nextSortState(sort, field, defaultSort);
    setSort(next);
    // "Voltar à visualização padrão" só faz sentido quando o que está na tela
    // NÃO é o padrão do tipo — inclusive na direção, não só na coluna.
    onSortActiveChange?.(isCustomSort(next, defaultSort));
  }

  const handleAutoEditConsumed = useCallback(() => setEditRequestId(null), []);

  function SortableHeaderCell({
    field,
    label,
    align,
  }: {
    field: TableColumnKey;
    label: string;
    align?: "right";
  }) {
    const isActive = sort.key === field;
    const Icon = sort.dir === "asc" ? ArrowUpwardIcon : ArrowDownwardIcon;
    return (
      <TableCell
        align={align}
        sx={[
          {
            ...HEADER_LABEL_SX,
            whiteSpace: "nowrap",
            cursor: "pointer",
            userSelect: "none",
            "&:hover": { color: "accent.primary" },
            color: isActive ? "accent.primary" : "text.tertiary",
          },
          // Spec 69 §16 — `false` quando a coluna não é fixável ou não está
          // presa: ordenar e fixar são independentes e convivem na mesma célula.
          field === "occurredOn" && pinnedHeadCellSx(pinnedColumns, "occurredOn"),
        ]}
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
        // Spec 69 §2.1 — sem edição em massa não há caixa de seleção na linha.
        // A célula continua existindo (vazia) para a grade não sair do lugar.
        selectable={allowBulkEdit}
        pinnedColumns={pinnedColumns}
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

  /**
   * Spec 69 §2.1 — a linha-fantasma na tela.
   *
   * `keepGhostRow` ligado: ela está sempre lá, no FIM da tabela — é a linha em
   * branco em que se digita direto, sem passar por "Nova transação".
   * Desligado: só aparece quando o botão a pede (`showNewRow`), no topo, que é
   * o comportamento de sempre. Em tabela somente-leitura não aparece nunca —
   * antes esse guard vinha de graça, porque o único gatilho era um botão que
   * some no modo leitura.
   */
  const ghostVisible = !isReadOnly && (showNewRow || keepGhostRow);
  const ghostAtEnd = keepGhostRow;

  const ghostRow = (
    <NewTransactionRow
      tableId={tableId}
      monthId={monthId}
      accountId={accountId}
      currentUserId={currentUserId}
      hiddenColumns={hiddenColumns}
      pinnedColumns={pinnedColumns}
      categories={categories}
      institutions={institutions}
      members={members}
      parties={parties}
      aliases={aliases}
      defaultResponsiblePartyId={defaultResponsiblePartyId}
      inheritOnNewRow={inheritOnNewRow}
      // A linha permanente NÃO rouba o foco ao abrir o mês: `autoFocus` só
      // quando ela foi pedida ("Nova transação"). Sem esse recorte, cada tabela
      // com `keepGhostRow` disputaria o cursor no carregamento da página.
      autoFocus={showNewRow}
      onCreated={onNewCreated}
      onCancel={onNewRowClose}
    />
  );

  /**
   * Célula de "selecionar tudo" do cabeçalho. Sem `allowBulkEdit` ela continua
   * existindo, vazia: é a coluna que alinha o checkbox das linhas e o "+" da
   * linha-fantasma — removê-la deslocaria a grade inteira em uma coluna.
   */
  const selectAllHeadSx = pinnedSelectHeadCellSx(pinnedColumns);
  const selectAllCell = allowBulkEdit ? (
    <TableCell padding="checkbox" sx={[selectAllHeadSx]}>
      <Checkbox
        size="small"
        checked={allSelected}
        indeterminate={someSelected}
        onChange={(e) => handleSelectAll(e.target.checked)}
        disabled={isReadOnly}
      />
    </TableCell>
  ) : (
    <TableCell padding="checkbox" sx={[selectAllHeadSx]} />
  );

  /**
   * Mesma convenção de sinal da linha (`ColumnsRow`/`PillsRow`) e do total do
   * card: em seção `subtract` o valor positivo armazenado É despesa.
   */
  const subtotalIsPositive = (cents: bigint) =>
    displaySignInverts(sectionCountType) ? cents < 0n : cents >= 0n;

  const isFiltered = hasGlobalFilters || searchText.trim().length > 0;
  const noRowsAtAll = rows.length === 0 && !ghostVisible;
  // "Nada encontrado" pressupõe que havia algo para encontrar. Com a
  // linha-fantasma permanente, `!noRowsAtAll` deixou de garantir isso — uma
  // tabela vazia passaria a exibir "revise os filtros" sem filtro nenhum.
  const noRowsAfterFilter = rows.length > 0 && visibleRows.length === 0;

  // Empty table (no data at all, no active filter)
  if (noRowsAtAll && !isFiltered) {
    return (
      // `<EmptyState>` canônico no lugar do Box/Typography à mão: o texto herdava
      // `text.disabled` (2,14:1 no light) e o ícone ainda levava `opacity: 0.4`
      // por cima. O componente já usa `text.tertiary` no ícone (4,69:1) e
      // `text.primary`/`text.secondary` no texto.
      <EmptyState
        size="compact"
        icon={<TableChartOutlinedIcon sx={{ fontSize: 36 }} />}
        title={m.transactions.emptyTable.title}
        description={isReadOnly ? undefined : m.transactions.emptyTable.hint}
      />
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
        {/* Spec 69 §7.2 — raiz da tabela: o `data-density` daqui resolve as 3
            variáveis CSS (declaradas no tema) para TUDO que está abaixo —
            leitura, edição, linha nova e barra de gavetas. */}
        <Box data-density={density}>
          {allowBulkEdit && selected.size > 0 && (
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
                {effectiveLayout === "pills" ? (
                  // Header mínimo no layout rico (frame B): select-all + os três
                  // rótulos que o layout de fato tem (DATA · TRANSAÇÃO · VALOR).
                  // Sem cabeçalhos por coluna — no rico os metadados são pílulas.
                  <TableRow sx={{ bgcolor: "background.default" }}>
                    {selectAllCell}
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
                    {selectAllCell}
                    <SortableHeaderCell field="occurredOn" label="Data" />
                  <TableCell
                    sx={[HEADER_LABEL_SX, pinnedHeadCellSx(pinnedColumns, "description")]}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box
                        component="span"
                        sx={{
                          cursor: "pointer",
                          userSelect: "none",
                          "&:hover": { color: "accent.primary" },
                          color: sort.key === "description" ? "accent.primary" : "text.tertiary",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.25,
                        }}
                        onClick={() => handleSortClick("description")}
                      >
                        Descrição
                        {sort.key === "description" &&
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
                  {show("category") && <SortableHeaderCell field="category" label="Categoria" />}
                  {show("subcategory") && (
                    <TableCell sx={HEADER_LABEL_SX}>Subcategoria</TableCell>
                  )}
                  {show("institution") && (
                    <SortableHeaderCell field="institution" label="Instituição" />
                  )}
                  {show("paymentMethod") && (
                    <TableCell sx={HEADER_LABEL_SX}>{m.transactions.paymentMethodColumn}</TableCell>
                  )}
                  <SortableHeaderCell field="amount" label="Valor" align="right" />
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
                {ghostVisible && !ghostAtEnd && ghostRow}

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
                ) : groups === null ? (
                  visibleRows.map(renderTransactionRow)
                ) : (
                  groups.map((group) => (
                    <React.Fragment key={`group-${group.key}`}>
                      <TableRow sx={{ pointerEvents: "none", bgcolor: "background.subtle" }}>
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
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "baseline",
                              justifyContent: "space-between",
                              gap: 2,
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.tertiary"
                              fontWeight={500}
                              sx={[
                                // Spec 69 §16 — o cabeçalho de grupo é `colSpan={99}`:
                                // ele não tem como ficar meio preso e meio rolante, e
                                // rola inteiro. Com um painel congelado à esquerda isso
                                // deixaria uma FAIXA VAZIA no lugar do rótulo — some
                                // justamente a legenda do bloco que as colunas presas
                                // existem para ancorar. O rótulo (só ele) gruda em
                                // `left`, alinhado com o `px: 2` da célula.
                                pinnedColumns.length > 0 && {
                                  position: "sticky",
                                  left: (theme: Theme) => theme.spacing(2),
                                },
                              ]}
                            >
                              {group.label}
                            </Typography>
                            {/* Spec 69 §2.1 — subtotal do bloco. `BigInt` até aqui;
                                a formatação em reais é do `MoneyValue`. A COR vem
                                do tipo de seção, como na linha e no total do card:
                                em seção `subtract` um valor positivo é despesa
                                (vermelho), e o verde do `MoneyValue` (que lê só o
                                sinal cru) contradiria todas as linhas somadas. */}
                            {showGroupSubtotal && (
                              <MoneyValue
                                cents={group.subtotalCents}
                                variant="caption"
                                sx={{
                                  fontWeight: 500,
                                  color: subtotalIsPositive(group.subtotalCents)
                                    ? "success.main"
                                    : "error.main",
                                }}
                              />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                      {group.rows.map(renderTransactionRow)}
                    </React.Fragment>
                  ))
                )}

                {ghostVisible && ghostAtEnd && ghostRow}
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
