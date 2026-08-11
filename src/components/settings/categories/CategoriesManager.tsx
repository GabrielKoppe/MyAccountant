"use client";

import AddIcon from "@mui/icons-material/Add";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  createCategoryAction,
  createSubcategoryAction,
  deleteCategoryAction,
  deleteSubcategoryAction,
  reorderCategoriesAction,
  reorderSubcategoriesAction,
  updateCategoryAction,
  updateSubcategoryAction,
} from "@/actions/account-settings";
import { mergeEntityAction } from "@/actions/settings-merge";
import { DeleteWithReallocationDialog } from "@/components/settings/DeleteWithReallocationDialog";
import { ImportCategoriesDialog } from "@/components/settings/ImportCategoriesDialog";
import { MergeDialog } from "@/components/settings/MergeDialog";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SettingsEmptyState } from "@/components/settings/SettingsEmptyState";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { SettingsPagination } from "@/components/settings/SettingsPagination";
import { SortableRows } from "@/components/settings/SortableRows";
import {
  SETTINGS_MENU_ITEM_SX,
  SETTINGS_MENU_SLOT_PROPS,
} from "@/components/settings/table/settings-menu-props";
import {
  settingsGhostHint,
  SettingsGhostRow,
  type SettingsGhostRowHandle,
} from "@/components/settings/table/SettingsGhostRow";
import { SettingsRowField } from "@/components/settings/table/SettingsRowField";
import {
  SettingsCell,
  SettingsHeadCell,
  SettingsTable,
} from "@/components/settings/table/SettingsTable";
import { UsageDialog } from "@/components/settings/UsageDialog";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

import { buildCategoriesExportCsv, buildCategoriesExportJson } from "./categories-export";
import {
  CATEGORY_COLUMN_COUNT,
  CATEGORY_TABLE_COLUMNS,
  getVisibleCategories,
  type CategoryItem,
  type CategorySortMode,
  type EditTarget,
  type SubcategoryItem,
} from "./categories-tree";
import { CategoriesToolbar } from "./CategoriesToolbar";
import { CategoryRow } from "./CategoryRow";

const t = m.settings.structure.categories;

/** Acima disso a `SettingsPagination` entra (Spec 68 §2.2). Independente do
 * `rowsPerPage` escolhido — é um limiar de escala da PÁGINA, não da paginação. */
const PAGINATION_THRESHOLD = 50;
const DEFAULT_ROWS_PER_PAGE = 20;

type Props = {
  accountId: string;
  initialCategories: CategoryItem[];
};

/**
 * Página "Categorias" (Spec 68 §2.2 / EST-02/EST-03, revisão de estilo) — arquétipo B.
 * Tabela compartilhada da família Estrutura (`@/components/settings/table`): busca,
 * ordenação, arraste, paginação e a mesma densidade de Seções/Instituições/Responsáveis.
 *
 * Sem "Seção padrão": a coluna nunca fez sentido (decisão do desenvolvedor) — a
 * categoria não filtra, não deriva cor, nem grava mais `Category.defaultSectionId`
 * (campo deprecado no schema, sem migração destrutiva).
 */
export function CategoriesManager({ accountId, initialCategories }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [isPending, startTransition] = useTransition();

  // O server continua sendo fonte da verdade — quando a prop mudar (revalidação
  // após uma action, ou o `router.refresh()` do "Importar categorias"), realinha o
  // state local. Mesmo padrão de `TransactionAliasesManager.tsx`. É o que faz o
  // `router.refresh()` do M4 (import) ter efeito visível: sem isto, `useState`
  // ignoraria a prop nova depois do primeiro render.
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  // ─── Escala: busca, ordenação, paginação ───────────────────────────────────
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<CategorySortMode>("manual");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  // ─── Árvore: expandir/recolher ─────────────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // ─── Renomear (RowActionsMenu → "Editar") — um alvo por vez, categoria OU
  // subcategoria, em qualquer lugar da árvore. ────────────────────────────────
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editName, setEditName] = useState("");

  // ─── Confirmações (desativar / excluir) ────────────────────────────────────
  const [deactivateTarget, setDeactivateTarget] = useState<{
    scope: "category" | "subcategory";
    id: string;
    categoryId?: string;
    name: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    scope: "category" | "subcategory";
    id: string;
    categoryId?: string;
    name: string;
  } | null>(null);

  // ─── Ver uso (M3) / Mesclar (M5) — só na linha de CATEGORIA (Spec 68 §2.5/§2.6):
  // subcategoria fica fora deste pacote, sem action de "excluir realocando". ──────
  const [usageTarget, setUsageTarget] = useState<CategoryItem | null>(null);
  const [mergeTarget, setMergeTarget] = useState<CategoryItem | null>(null);

  // ─── Menu "Importar / Exportar" do cabeçalho (M4 + export CSV/JSON) ────────────
  const [importExportAnchor, setImportExportAnchor] = useState<HTMLElement | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // ─── Linha-fantasma de categoria nova ───────────────────────────────────────
  const ghostRef = useRef<SettingsGhostRowHandle>(null);
  const [newCategoryDraft, setNewCategoryDraft] = useState<string | null>(null);
  const pendingFocusRef = useRef(false);

  // ─── Linhas-fantasma de subcategoria — uma por categoria expandida ─────────
  const [newSubDrafts, setNewSubDrafts] = useState<Record<string, string>>({});

  const visibleCategories = useMemo(
    () => getVisibleCategories(categories, { query: search }, sortMode),
    [categories, search, sortMode],
  );

  /**
   * Paginar ou não é UMA decisão, e ela governa tanto o corte quanto o controle.
   *
   * Antes eram duas: a lista era sempre cortada em `rowsPerPage` (20), mas o controle
   * só aparecia acima de `PAGINATION_THRESHOLD` (50). Numa conta com 37 categorias
   * isso escondia 17 delas **sem nenhum caminho para alcançá-las** — a lista
   * simplesmente parava no meio do alfabeto. Com um único booleano as duas coisas não
   * podem mais discordar.
   */
  const isPaginated = visibleCategories.length > PAGINATION_THRESHOLD;

  // Clampa em vez de ressincronizar por efeito (mesmo padrão de
  // `TransactionAliasesManager`): excluir o último item de uma página deixaria `page`
  // fora do intervalo, e a lista renderizaria vazia com categorias existentes.
  const lastPage = isPaginated
    ? Math.max(0, Math.ceil(visibleCategories.length / rowsPerPage) - 1)
    : 0;
  const currentPage = Math.min(page, lastPage);
  const pageCategories = useMemo(
    () =>
      isPaginated
        ? visibleCategories.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage)
        : visibleCategories,
    [isPaginated, visibleCategories, currentPage, rowsPerPage],
  );

  const showPagination = isPaginated;

  // Arraste só faz sentido em ordenação manual, sem busca ativa (Spec 68 §2.2): com um
  // subconjunto filtrado/paginado, o índice do drag não corresponde à ordem real e
  // persistir corromperia `Category.order`/`Subcategory.order` de itens fora de vista.
  // A alça fica visível mas inerte (SortableRow.disabled).
  const manualOrderingActive = sortMode === "manual" && search.trim() === "";
  const canDragTop = manualOrderingActive && lastPage === 0;
  const canDragSub = manualOrderingActive;

  useEffect(() => {
    if (pendingFocusRef.current) {
      pendingFocusRef.current = false;
      openNewCategoryGhost();
    }
  }, [currentPage]);

  function resetPage() {
    setPage(0);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    resetPage();
  }

  function handleSortModeChange(value: CategorySortMode) {
    setSortMode(value);
    resetPage();
  }

  function handleRowsPerPageChange(value: number) {
    setRowsPerPage(value);
    resetPage();
  }

  function toggleExpand(categoryId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  const hasExpanded = expandedIds.size > 0;

  function toggleExpandAll() {
    if (hasExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(
        new Set(categories.filter((c) => c.subcategories.length > 0).map((c) => c.id)),
      );
    }
  }

  // Durante a busca, o pai de uma subcategoria que casou precisa aparecer JÁ aberto —
  // senão o usuário vê o chip "N sub" sem entender por que a categoria apareceu.
  function isExpanded(category: CategoryItem): boolean {
    if (expandedIds.has(category.id)) return true;
    return search.trim() !== "" && category.subcategories.length > 0;
  }

  // ─── Criar categoria (linha-fantasma) ──────────────────────────────────────

  function openNewCategoryGhost() {
    setNewCategoryDraft((prev) => prev ?? "");
    ghostRef.current?.focus();
  }

  function handleNewCategoryClick() {
    // A linha-fantasma vive no FIM da lista, logo na última página. Sem paginação
    // (`lastPage === 0`) isso nunca troca de página — antes trocava mesmo com o
    // controle escondido, e o salto lia como "a tela mudou de lugar".
    if (isPaginated && currentPage !== lastPage) {
      pendingFocusRef.current = true;
      setPage(lastPage);
    } else {
      openNewCategoryGhost();
    }
  }

  function commitNewCategory() {
    const name = (newCategoryDraft ?? "").trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createCategoryAction(accountId, { name });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setCategories((prev) => [
        ...prev,
        {
          id: result.data.categoryId,
          name,
          order: prev.length,
          status: "active",
          lastUsedAt: null,
          subcategories: [],
        },
      ]);
      enqueueSnackbar(m.settings.categories.created, { variant: "success" });
      // Enter cria e reabre a próxima linha (SET-08): a linha nunca sai do estado
      // "editing", então o efeito interno da linha-fantasma (que só refoca na
      // transição ocioso → edição) não dispara sozinho — limpamos e refocamos.
      setNewCategoryDraft("");
      ghostRef.current?.focus();
    });
  }

  // ─── Criar subcategoria (linha-fantasma por categoria) ─────────────────────

  function openSubDraft(categoryId: string) {
    setNewSubDrafts((prev) => ({ ...prev, [categoryId]: prev[categoryId] ?? "" }));
  }

  function changeSubDraft(categoryId: string, value: string) {
    setNewSubDrafts((prev) => ({ ...prev, [categoryId]: value }));
  }

  function cancelSubDraft(categoryId: string) {
    setNewSubDrafts((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
  }

  function commitSubDraft(categoryId: string) {
    const name = (newSubDrafts[categoryId] ?? "").trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createSubcategoryAction(accountId, { categoryId, name });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setCategories((prev) =>
        prev.map((category) =>
          category.id === categoryId
            ? {
                ...category,
                subcategories: [
                  ...category.subcategories,
                  {
                    id: result.data.subcategoryId,
                    name,
                    order: category.subcategories.length,
                    status: "active" as const,
                    lastUsedAt: null,
                  },
                ],
              }
            : category,
        ),
      );
      enqueueSnackbar(m.settings.categories.subCreated, { variant: "success" });
      setNewSubDrafts((prev) => ({ ...prev, [categoryId]: "" }));
    });
  }

  // ─── Renomear ───────────────────────────────────────────────────────────────

  function startEditCategory(category: CategoryItem) {
    setEditTarget({ scope: "category", id: category.id });
    setEditName(category.name);
  }

  function startEditSubcategory(categoryId: string, sub: SubcategoryItem) {
    setEditTarget({ scope: "subcategory", id: sub.id, categoryId });
    setEditName(sub.name);
  }

  function cancelEdit() {
    setEditTarget(null);
    setEditName("");
  }

  function commitEdit() {
    if (!editTarget) return;
    const name = editName.trim();
    if (!name) return;
    const target = editTarget;

    if (target.scope === "category") {
      const category = categories.find((c) => c.id === target.id);
      if (!category) return;
      setEditTarget(null);
      startTransition(async () => {
        const result = await updateCategoryAction(accountId, { categoryId: category.id, name });
        if (!result.ok) {
          enqueueSnackbar(result.error.message, { variant: "error" });
          return;
        }
        setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, name } : c)));
        enqueueSnackbar(m.settings.categories.updated, { variant: "success" });
      });
    } else {
      setEditTarget(null);
      startTransition(async () => {
        const result = await updateSubcategoryAction(accountId, { subcategoryId: target.id, name });
        if (!result.ok) {
          enqueueSnackbar(result.error.message, { variant: "error" });
          return;
        }
        setCategories((prev) =>
          prev.map((c) =>
            c.id === target.categoryId
              ? {
                  ...c,
                  subcategories: c.subcategories.map((s) =>
                    s.id === target.id ? { ...s, name } : s,
                  ),
                }
              : c,
          ),
        );
        enqueueSnackbar(m.settings.categories.subUpdated, { variant: "success" });
      });
    }
  }

  // ─── Ativar / desativar (item 10 do pacote — confirmação só ao desativar) ──

  function toggleCategoryActive(category: CategoryItem, nextActive: boolean) {
    if (!nextActive) {
      setDeactivateTarget({ scope: "category", id: category.id, name: category.name });
      return;
    }
    applyCategoryStatus(category, "active");
  }

  function toggleSubcategoryActive(categoryId: string, sub: SubcategoryItem, nextActive: boolean) {
    if (!nextActive) {
      setDeactivateTarget({ scope: "subcategory", id: sub.id, categoryId, name: sub.name });
      return;
    }
    applySubcategoryStatus(categoryId, sub, "active");
  }

  function applyCategoryStatus(category: CategoryItem, status: "active" | "inactive") {
    startTransition(async () => {
      const result = await updateCategoryAction(accountId, {
        categoryId: category.id,
        name: category.name,
        status,
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, status } : c)));
      enqueueSnackbar(m.settings.categories.updated, { variant: "success" });
    });
  }

  function applySubcategoryStatus(
    categoryId: string,
    sub: SubcategoryItem,
    status: "active" | "inactive",
  ) {
    startTransition(async () => {
      const result = await updateSubcategoryAction(accountId, {
        subcategoryId: sub.id,
        name: sub.name,
        status,
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? {
                ...c,
                subcategories: c.subcategories.map((s) => (s.id === sub.id ? { ...s, status } : s)),
              }
            : c,
        ),
      );
      enqueueSnackbar(m.settings.categories.subUpdated, { variant: "success" });
    });
  }

  function confirmDeactivate() {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    setDeactivateTarget(null);
    if (target.scope === "category") {
      const category = categories.find((c) => c.id === target.id);
      if (category) applyCategoryStatus(category, "inactive");
      return;
    }
    const category = categories.find((c) => c.id === target.categoryId);
    const sub = category?.subcategories.find((s) => s.id === target.id);
    if (category && sub) applySubcategoryStatus(category.id, sub, "inactive");
  }

  // ─── Excluir subcategoria — confirmação simples ────────────────────────────
  // M2 fica de fora de `Subcategory` neste pacote (Spec 68 §2.6): não há uma
  // `deleteSubcategoryReallocating` nem entrada em `getConfigReferencesAction` para
  // ela — só `category`, `institution` e `responsibleParty` ganham a realocação.

  function confirmDeleteSubcategory() {
    if (!deleteTarget || deleteTarget.scope !== "subcategory") return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteSubcategoryAction(accountId, { subcategoryId: target.id });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setCategories((prev) =>
        prev.map((c) =>
          c.id === target.categoryId
            ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== target.id) }
            : c,
        ),
      );
      enqueueSnackbar(m.settings.categories.subDeleted, { variant: "success" });
    });
  }

  // ─── Excluir categoria — M2 (excluir com realocação) ───────────────────────
  //
  // Não existe uma action de "excluir realocando" — mesclar É exatamente "mover
  // tudo para o destino e excluir o objeto", e o serviço de mesclagem já faz isso
  // numa transação só (transações, apelidos, itens de modelo, de-para, widgets),
  // com auditoria. Duplicar esse movimento numa action nova criaria duas
  // implementações do mesmo gesto, que divergiriam com o tempo. Sem destino
  // escolhido, a exclusão simples serve — as FKs de `Transaction` viram `null`
  // (`onDelete: SetNull`), que é o "sem categoria" explícito.
  async function handleCategoryDeleteConfirm(reallocateToId: string | null) {
    if (!deleteTarget || deleteTarget.scope !== "category") return;
    const target = deleteTarget;

    const result = reallocateToId
      ? await mergeEntityAction(accountId, {
          entity: "category",
          absorbedId: target.id,
          keptId: reallocateToId,
        })
      : await deleteCategoryAction(accountId, { categoryId: target.id });

    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      // O diálogo trata a rejeição como "ainda em confirmação" e não fecha
      // sozinho — o snackbar acima já avisou o usuário (contrato documentado em
      // `DeleteWithReallocationDialog`).
      throw new Error(result.error.message);
    }
    setCategories((prev) => prev.filter((c) => c.id !== target.id));
    setDeleteTarget(null);
    enqueueSnackbar(m.settings.structureDialogs.remove.success, { variant: "success" });
  }

  // ─── Arraste ────────────────────────────────────────────────────────────────

  function handleReorderTop(orderedIds: string[]) {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const reordered = orderedIds.map((id, orderIndex) => ({ ...byId.get(id)!, order: orderIndex }));
    setCategories(reordered);
    startTransition(async () => {
      const result = await reorderCategoriesAction(accountId, { orderedIds });
      if (!result.ok) enqueueSnackbar(result.error.message, { variant: "error" });
      else enqueueSnackbar(m.settings.structure.reordered, { variant: "success" });
    });
  }

  function handleReorderSub(categoryId: string, orderedIds: string[]) {
    setCategories((prev) =>
      prev.map((category) => {
        if (category.id !== categoryId) return category;
        const byId = new Map(category.subcategories.map((s) => [s.id, s]));
        return {
          ...category,
          subcategories: orderedIds.map((id, orderIndex) => ({
            ...byId.get(id)!,
            order: orderIndex,
          })),
        };
      }),
    );
    startTransition(async () => {
      const result = await reorderSubcategoriesAction(accountId, { categoryId, orderedIds });
      if (!result.ok) enqueueSnackbar(result.error.message, { variant: "error" });
      else enqueueSnackbar(m.settings.structure.reordered, { variant: "success" });
    });
  }

  // ─── Importar / Exportar (menu do cabeçalho) ───────────────────────────────

  // Geradas no cliente (Blob + `URL.createObjectURL`), sem rota nem action: são as
  // categorias JÁ carregadas na tela, não um novo fetch. Mesmo padrão de
  // `useExportDownload` (cria o `<a>`, clica, remove, revoga a URL).
  function downloadBlob(content: string, mimeType: string, filename: string) {
    const blob = new Blob([content], { type: mimeType });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  }

  function handleExportCsv() {
    downloadBlob(buildCategoriesExportCsv(categories), "text/csv;charset=utf-8;", "categorias.csv");
  }

  function handleExportJson() {
    downloadBlob(
      buildCategoriesExportJson(categories),
      "application/json;charset=utf-8;",
      "categorias.json",
    );
  }

  // Chip do cabeçalho ("18 · 47 sub") — deriva do state local inteiro (não do filtrado
  // nem do paginado), para acompanhar criar/excluir sem esperar revalidação do server.
  const subcategoryCount = categories.reduce((total, c) => total + c.subcategories.length, 0);

  // Só a categoria (não a subcategoria) passa pelo M2 — calculado uma vez para não
  // repetir a checagem de `scope` em `open`/`target`/`options` do diálogo abaixo.
  const categoryDeleteTarget = deleteTarget?.scope === "category" ? deleteTarget : null;

  return (
    <SettingsPageShell
      family="Estrutura"
      title={m.settings.nav.categories}
      count={m.settings.hub.counts.categories(categories.length, subcategoryCount)}
      purpose={m.settings.purposes.categories}
      itemCount={categories.length}
      wideContent
      primaryAction={{
        label: m.settings.categories.createButton,
        icon: <AddIcon />,
        // Nunca abre modal (item 6 do pacote): só rola até a linha-fantasma e foca o
        // campo de nome — igual clicar na própria linha.
        onClick: handleNewCategoryClick,
      }}
      secondaryActions={[
        {
          label: t.importExport,
          icon: <ImportExportIcon fontSize="small" />,
          onClick: (event) => setImportExportAnchor(event.currentTarget),
        },
      ]}
      toolbar={
        <CategoriesToolbar
          search={search}
          onSearchChange={handleSearchChange}
          sortMode={sortMode}
          onSortModeChange={handleSortModeChange}
          hasExpanded={hasExpanded}
          onToggleExpandAll={toggleExpandAll}
        />
      }
    >
      {categories.length === 0 && (
        <Box sx={{ py: layout.stack }}>
          <SettingsEmptyState
            title={m.settings.nav.categories}
            description={m.settings.categories.noCategories}
            size="compact"
          />
        </Box>
      )}

      {/* Busca sem resultado NÃO é a lista vazia (Spec 67 shell.searchNoResults). */}
      {categories.length > 0 && visibleCategories.length === 0 && (
        <Box sx={{ py: layout.stack }}>
          <SettingsEmptyState
            title={m.settings.shell.searchNoResults}
            description={m.settings.shell.searchNoResultsHint}
            size="compact"
          />
        </Box>
      )}

      {/* O `SortableRows` precisa envolver a TABELA INTEIRA, não só o `<TableBody>`:
          o `DndContext` do dnd-kit injeta dois <div> ocultos de acessibilidade como
          irmãos do conteúdo, e um <div> filho de <tbody> é HTML inválido. A
          linha-fantasma vive DENTRO da mesma tabela (ids: [] quando vazia é inofensivo
          — ela não chama `useSortable`, então fica inerte no `SortableContext`). */}
      <SortableRows ids={pageCategories.map((c) => c.id)} onReorder={handleReorderTop}>
        <SettingsTable
          ariaLabel={m.settings.nav.categories}
          columns={[
            CATEGORY_TABLE_COLUMNS.drag,
            CATEGORY_TABLE_COLUMNS.expand,
            undefined,
            CATEGORY_TABLE_COLUMNS.status,
            CATEGORY_TABLE_COLUMNS.menu,
          ]}
          head={
            <>
              <SettingsHeadCell />
              <SettingsHeadCell />
              <SettingsHeadCell>{t.columnName}</SettingsHeadCell>
              <SettingsHeadCell>{t.columnStatus}</SettingsHeadCell>
              <SettingsHeadCell />
            </>
          }
        >
          {pageCategories.map((category, index) => (
            <CategoryRow
              key={category.id}
              category={category}
              index={index}
              isPending={isPending}
              expanded={isExpanded(category)}
              onToggleExpand={toggleExpand}
              canDragTop={canDragTop}
              canDragSub={canDragSub}
              edit={{
                target: editTarget,
                name: editName,
                onNameChange: setEditName,
                onStartCategory: startEditCategory,
                onStartSubcategory: startEditSubcategory,
                onCommit: commitEdit,
                onCancel: cancelEdit,
              }}
              onToggleCategoryActive={toggleCategoryActive}
              onToggleSubcategoryActive={toggleSubcategoryActive}
              onViewUsage={setUsageTarget}
              onMerge={setMergeTarget}
              onDeleteCategory={(c) =>
                setDeleteTarget({ scope: "category", id: c.id, name: c.name })
              }
              onDeleteSubcategory={(categoryId, sub) =>
                setDeleteTarget({ scope: "subcategory", id: sub.id, categoryId, name: sub.name })
              }
              onReorderSubcategories={handleReorderSub}
              subDraft={{
                value: category.id in newSubDrafts ? newSubDrafts[category.id] : null,
                onOpen: openSubDraft,
                onChange: changeSubDraft,
                onCommit: commitSubDraft,
                onCancel: cancelSubDraft,
              }}
            />
          ))}

          <SettingsGhostRow
            ref={ghostRef}
            label={t.addRow}
            editing={newCategoryDraft !== null}
            canCommit={(newCategoryDraft ?? "").trim().length > 0}
            onStartEditing={() => setNewCategoryDraft("")}
            onCancel={() => setNewCategoryDraft(null)}
            onCommit={commitNewCategory}
            columnCount={CATEGORY_COLUMN_COUNT}
            name={m.settings.categories.nameLabel}
          >
            {newCategoryDraft !== null && (
              <>
                <SettingsCell sx={{ width: CATEGORY_TABLE_COLUMNS.expand, px: 0.5 }} />
                <SettingsCell>
                  <SettingsRowField
                    autoFocus
                    placeholder={m.settings.categories.nameLabel}
                    value={newCategoryDraft}
                    onChange={(event) => setNewCategoryDraft(event.target.value)}
                  />
                </SettingsCell>
                <SettingsCell sx={{ width: CATEGORY_TABLE_COLUMNS.status }} />
              </>
            )}
          </SettingsGhostRow>
        </SettingsTable>
      </SortableRows>

      <Box sx={{ pb: layout.stack }}>
        {newCategoryDraft !== null && (
          <Typography
            variant="caption"
            sx={{ display: "block", color: "text.disabled", mt: layout.micro }}
          >
            {settingsGhostHint()}
          </Typography>
        )}

        {showPagination && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: layout.stack }}>
            <SettingsPagination
              count={visibleCategories.length}
              page={currentPage}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          </Box>
        )}

        <Typography
          variant="caption"
          color="text.tertiary"
          sx={{ display: "block", mt: layout.stack }}
        >
          {t.footnote}
        </Typography>
      </Box>

      {/* Desativar */}
      <SettingsDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        size="confirm"
        titleIcon={<VisibilityOffOutlinedIcon />}
        tone="warning"
        title={deactivateTarget ? t.deactivateTitle(deactivateTarget.name) : ""}
        description={t.deactivateBody}
        actions={
          <>
            <Button size="small" onClick={() => setDeactivateTarget(null)}>
              {m.common.cancel}
            </Button>
            <Button size="small" variant="contained" onClick={confirmDeactivate}>
              {m.settings.shell.rowMenu.deactivate}
            </Button>
          </>
        }
      />

      {/* Excluir subcategoria — confirmação simples (M2 não se aplica aqui). */}
      <SettingsDialog
        open={deleteTarget?.scope === "subcategory"}
        onClose={() => setDeleteTarget(null)}
        size="confirm"
        titleIcon={<WarningAmberOutlinedIcon />}
        tone="danger"
        title={m.settings.categories.deleteTitle}
        description={m.settings.categories.deleteSubConfirm}
        actions={
          <>
            <Button size="small" onClick={() => setDeleteTarget(null)}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={confirmDeleteSubcategory}
            >
              {m.common.delete}
            </Button>
          </>
        }
      />

      {/* Excluir categoria — M2 (Spec 68 §2.6): realocação obrigatória enquanto
          houver referência; "sem categoria" é uma opção explícita na própria lista. */}
      <DeleteWithReallocationDialog
        open={!!categoryDeleteTarget}
        onClose={() => setDeleteTarget(null)}
        accountId={accountId}
        entity="category"
        target={{ id: categoryDeleteTarget?.id ?? "", name: categoryDeleteTarget?.name ?? "" }}
        options={categories
          .filter((c) => c.id !== categoryDeleteTarget?.id)
          .map((c) => ({ id: c.id, name: c.name }))}
        onConfirm={handleCategoryDeleteConfirm}
      />

      {/* Ver uso (M3) — sem `transactionsHref`: não há rota de "todas as
          transações" filtrável fora de um mês específico (ver relatório da task). */}
      <UsageDialog
        open={!!usageTarget}
        onClose={() => setUsageTarget(null)}
        accountId={accountId}
        entity="category"
        entityId={usageTarget?.id ?? ""}
        entityName={usageTarget?.name ?? ""}
      />

      {/* Mesclar (M5) */}
      <MergeDialog
        open={!!mergeTarget}
        onClose={() => setMergeTarget(null)}
        accountId={accountId}
        entity="category"
        options={categories.map((c) => ({ id: c.id, name: c.name }))}
        initialAbsorbedId={mergeTarget?.id}
        onMerged={({ absorbedId }) => {
          // A absorvida deixou de existir — tira da lista agora, sem esperar o
          // próximo refresh (nunca deixar a linha fantasma na tela).
          setCategories((prev) => prev.filter((c) => c.id !== absorbedId));
        }}
      />

      {/* Menu "Importar / Exportar" do cabeçalho */}
      <Menu
        anchorEl={importExportAnchor}
        open={!!importExportAnchor}
        onClose={() => setImportExportAnchor(null)}
        slotProps={SETTINGS_MENU_SLOT_PROPS}
      >
        <MenuItem
          sx={SETTINGS_MENU_ITEM_SX}
          onClick={() => {
            setImportExportAnchor(null);
            setImportDialogOpen(true);
          }}
        >
          <ListItemIcon>
            <UploadFileIcon />
          </ListItemIcon>
          {t.importMenuItem}
        </MenuItem>
        <MenuItem
          sx={SETTINGS_MENU_ITEM_SX}
          onClick={() => {
            setImportExportAnchor(null);
            handleExportCsv();
          }}
        >
          <ListItemIcon>
            <FileDownloadOutlinedIcon />
          </ListItemIcon>
          {t.exportCsvMenuItem}
        </MenuItem>
        <MenuItem
          sx={SETTINGS_MENU_ITEM_SX}
          onClick={() => {
            setImportExportAnchor(null);
            handleExportJson();
          }}
        >
          <ListItemIcon>
            <FileDownloadOutlinedIcon />
          </ListItemIcon>
          {t.exportJsonMenuItem}
        </MenuItem>
      </Menu>

      {/* Importar categorias (M4) */}
      <ImportCategoriesDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        accountId={accountId}
        onImported={() => {
          // M4 pode criar/atualizar/desativar dezenas de linhas de uma vez —
          // reconstruir isso localmente duplicaria a classificação do service. A
          // action já revalida a rota; `router.refresh()` traz `initialCategories`
          // fresco e o efeito de sincronização (topo do componente) realinha o
          // state local com ele.
          router.refresh();
        }}
      />
    </SettingsPageShell>
  );
}
