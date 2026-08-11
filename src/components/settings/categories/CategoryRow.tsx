"use client";

import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { type KeyboardEvent } from "react";

import { ColorDot } from "@/components/settings/ColorDot";
import { RowActionsMenu } from "@/components/settings/RowActionsMenu";
import { SortableRow, SortableRows } from "@/components/settings/SortableRows";
import { StatusCell } from "@/components/settings/StatusCell";
import { SETTINGS_ROW_ICON } from "@/components/settings/table/settings-table-tokens";
import { settingsGhostHint, SettingsGhostRow } from "@/components/settings/table/SettingsGhostRow";
import {
  SettingsEditActions,
  SettingsRowField,
} from "@/components/settings/table/SettingsRowField";
import {
  SettingsCell,
  SettingsGripCell,
  SettingsMenuCell,
  SettingsRow,
} from "@/components/settings/table/SettingsTable";
import { layout, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { resolveActive } from "@/lib/settings-status";

import {
  CATEGORY_COLUMN_COUNT,
  CATEGORY_TABLE_COLUMNS,
  type CategoryItem,
  type EditTarget,
  type SubcategoryItem,
} from "./categories-tree";

const t = m.settings.structure.categories;

type EditGroup = {
  target: EditTarget | null;
  name: string;
  onNameChange: (value: string) => void;
  onStartCategory: (category: CategoryItem) => void;
  onStartSubcategory: (categoryId: string, sub: SubcategoryItem) => void;
  onCommit: () => void;
  onCancel: () => void;
};

type SubDraftGroup = {
  /** `null` = linha-fantasma ociosa desta categoria. */
  value: string | null;
  onOpen: (categoryId: string) => void;
  onChange: (categoryId: string, value: string) => void;
  onCommit: (categoryId: string) => void;
  onCancel: (categoryId: string) => void;
};

type Props = {
  category: CategoryItem;
  /** Posição na lista renderizada — semeia o fallback de cor (categoria não tem cor
   * própria desde a saída de "Seção padrão" — só o índice determinístico, D2). */
  index: number;
  isPending: boolean;
  expanded: boolean;
  onToggleExpand: (categoryId: string) => void;
  /** Só faz sentido em ordenação manual, sem busca ativa (§2.2). */
  canDragTop: boolean;
  canDragSub: boolean;
  edit: EditGroup;
  onToggleCategoryActive: (category: CategoryItem, next: boolean) => void;
  onToggleSubcategoryActive: (categoryId: string, sub: SubcategoryItem, next: boolean) => void;
  /** M3/M5 (Spec 68 §2.5/§2.6) — só na linha de CATEGORIA; subcategoria fica fora
   * deste pacote (não há action de "excluir realocando" para `Subcategory`). */
  onViewUsage: (category: CategoryItem) => void;
  onMerge: (category: CategoryItem) => void;
  onDeleteCategory: (category: CategoryItem) => void;
  onDeleteSubcategory: (categoryId: string, sub: SubcategoryItem) => void;
  onReorderSubcategories: (categoryId: string, orderedIds: string[]) => void;
  subDraft: SubDraftGroup;
};

/** Enter grava/Escape cancela — mesmo contrato de teclado do `SettingsGhostRow`, para
 * uma linha que já existe. */
function makeEditKeyDownHandler(canCommit: boolean, onCommit: () => void, onCancel: () => void) {
  return (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      onCancel();
      return;
    }
    if (event.key !== "Enter") return;
    if ((event.target as HTMLElement).tagName === "TEXTAREA") return;
    if (!canCommit) return;
    event.preventDefault();
    onCommit();
  };
}

/**
 * Uma categoria de topo, suas subcategorias (quando expandida) e a linha-fantasma de
 * subcategoria (Spec 68 §2.2, revisão de estilo). Retorna múltiplas `<TableRow>` — o
 * pai monta a `<SettingsTable>`.
 */
export function CategoryRow({
  category,
  index,
  isPending,
  expanded,
  onToggleExpand,
  canDragTop,
  canDragSub,
  edit,
  onToggleCategoryActive,
  onToggleSubcategoryActive,
  onViewUsage,
  onMerge,
  onDeleteCategory,
  onDeleteSubcategory,
  onReorderSubcategories,
  subDraft,
}: Props) {
  const active = resolveActive({ kind: "status", status: category.status });
  const isEditingCategory = edit.target?.scope === "category" && edit.target.id === category.id;
  const canCommitEdit = edit.name.trim().length > 0;
  const hasSubcategories = category.subcategories.length > 0;

  const handleCategoryEditKeyDown = makeEditKeyDownHandler(
    canCommitEdit,
    edit.onCommit,
    edit.onCancel,
  );

  return (
    <>
      <SortableRow id={category.id} name={category.name} disabled={!canDragTop}>
        {({ setNodeRef, style, handle }) =>
          isEditingCategory ? (
            <SettingsRow ref={setNodeRef} editing onKeyDown={handleCategoryEditKeyDown} sx={style}>
              <SettingsGripCell>{handle}</SettingsGripCell>
              <SettingsCell sx={{ width: CATEGORY_TABLE_COLUMNS.expand, px: 0.5 }} />
              <SettingsCell>
                <Stack direction="row" spacing={layout.inline} alignItems="center">
                  <ColorDot fallbackIndex={index} />
                  <SettingsRowField
                    autoFocus
                    value={edit.name}
                    onChange={(event) => edit.onNameChange(event.target.value)}
                  />
                </Stack>
              </SettingsCell>
              <SettingsCell sx={{ width: CATEGORY_TABLE_COLUMNS.status }}>
                <StatusCell
                  active={active}
                  lastUsedAt={category.lastUsedAt}
                  gender="f"
                  name={category.name}
                  disabled
                  onToggle={() => undefined}
                />
              </SettingsCell>
              <SettingsMenuCell>
                <SettingsEditActions
                  onCancel={edit.onCancel}
                  onCommit={edit.onCommit}
                  canCommit={canCommitEdit && !isPending}
                  name={category.name}
                />
              </SettingsMenuCell>
            </SettingsRow>
          ) : (
            <SettingsRow ref={setNodeRef} hover sx={{ ...style, opacity: active ? 1 : 0.6 }}>
              <SettingsGripCell>{handle}</SettingsGripCell>
              <SettingsCell sx={{ width: CATEGORY_TABLE_COLUMNS.expand, px: 0.5 }}>
                {/* Sempre visível, mesmo com 0 subcategorias: é o único caminho até a
                    linha-fantasma de subcategoria dessa categoria (§2.2 — criar a
                    PRIMEIRA subcategoria de uma categoria nova precisa expandir primeiro). */}
                <IconButton
                  size="small"
                  onClick={() => onToggleExpand(category.id)}
                  aria-label={expanded ? t.collapseRow(category.name) : t.expandRow(category.name)}
                >
                  {expanded ? (
                    <ExpandMoreIcon sx={{ fontSize: SETTINGS_ROW_ICON.size }} />
                  ) : (
                    <ChevronRightIcon sx={{ fontSize: SETTINGS_ROW_ICON.size }} />
                  )}
                </IconButton>
              </SettingsCell>
              <SettingsCell>
                <Stack direction="row" spacing={layout.inline} alignItems="center">
                  <ColorDot fallbackIndex={index} />
                  <Typography variant="body2" fontWeight="medium" noWrap>
                    {category.name}
                  </Typography>
                  {hasSubcategories && (
                    <Typography
                      variant="caption"
                      sx={{ color: "text.disabled", fontFamily: typography.fontFamily.mono }}
                    >
                      {t.subCount(category.subcategories.length)}
                    </Typography>
                  )}
                </Stack>
              </SettingsCell>
              <SettingsCell sx={{ width: CATEGORY_TABLE_COLUMNS.status }}>
                <StatusCell
                  active={active}
                  lastUsedAt={category.lastUsedAt}
                  gender="f"
                  name={category.name}
                  disabled={isPending}
                  onToggle={(next) => onToggleCategoryActive(category, next)}
                />
              </SettingsCell>
              <SettingsMenuCell>
                <RowActionsMenu
                  name={category.name}
                  active={active}
                  actions={{
                    edit: () => edit.onStartCategory(category),
                    toggleActive: () => onToggleCategoryActive(category, !active),
                    viewUsage: () => onViewUsage(category),
                    merge: () => onMerge(category),
                    delete: () => onDeleteCategory(category),
                  }}
                />
              </SettingsMenuCell>
            </SettingsRow>
          )
        }
      </SortableRow>

      {expanded && (
        <TableRow>
          {/* Painel expandido de uma categoria: subcategorias + linha-fantasma, tudo
              dentro de UMA célula que ocupa a largura inteira (colSpan). Isto NÃO é o
              padrão "linha-fantasma fora da <table>" — aqui a posição no meio da
              árvore importa, e um <table> aninhado dentro de <td> é HTML válido. É
              também o que resolve o `SortableRows` de subcategorias: seu `DndContext`
              injeta dois <div> ocultos de acessibilidade como irmãos do conteúdo, e
              isso é HTML inválido solto entre <tr> de um <tbody> — só é válido
              envolvendo um elemento de verdade, aqui a <Table> aninhada. O `colgroup`
              repete as larguras da tabela de fora para as duas ficarem alinhadas. */}
          <TableCell colSpan={CATEGORY_COLUMN_COUNT} sx={{ p: 0, borderBottom: "none" }}>
            {/* Uma `<Table>` só para as subcategorias E a linha-fantasma: duas tabelas
                irmãs deixariam uma borda dupla entre a última subcategoria e o "+
                Adicionar…". O `SortableRows` engloba a tabela inteira mesmo quando há
                0 subcategorias (`ids: []`) — a linha-fantasma não chama `useSortable`,
                então fica inerte dentro do `SortableContext`, sem participar do
                arraste. */}
            <SortableRows
              ids={category.subcategories.map((sub) => sub.id)}
              onReorder={(orderedIds) => onReorderSubcategories(category.id, orderedIds)}
            >
              <Table sx={{ tableLayout: "fixed", width: "100%" }}>
                <colgroup>
                  <col style={{ width: CATEGORY_TABLE_COLUMNS.drag }} />
                  <col style={{ width: CATEGORY_TABLE_COLUMNS.expand }} />
                  <col />
                  <col style={{ width: CATEGORY_TABLE_COLUMNS.status }} />
                  <col style={{ width: CATEGORY_TABLE_COLUMNS.menu }} />
                </colgroup>
                <TableBody>
                  {category.subcategories.map((sub) => (
                    <SubcategoryRow
                      key={sub.id}
                      categoryId={category.id}
                      sub={sub}
                      index={index}
                      isPending={isPending}
                      canDrag={canDragSub}
                      edit={edit}
                      onToggleActive={onToggleSubcategoryActive}
                      onDelete={onDeleteSubcategory}
                    />
                  ))}

                  <SettingsGhostRow
                    label={t.addSubRow}
                    editing={subDraft.value !== null}
                    canCommit={(subDraft.value ?? "").trim().length > 0}
                    onStartEditing={() => subDraft.onOpen(category.id)}
                    onCancel={() => subDraft.onCancel(category.id)}
                    onCommit={() => subDraft.onCommit(category.id)}
                    columnCount={CATEGORY_COLUMN_COUNT}
                    name={m.settings.categories.nameLabel}
                  >
                    {subDraft.value !== null && (
                      <>
                        <SettingsCell sx={{ width: CATEGORY_TABLE_COLUMNS.expand, px: 0.5 }}>
                          <SubdirectoryArrowRightIcon
                            sx={{ fontSize: SETTINGS_ROW_ICON.size, color: "text.disabled" }}
                          />
                        </SettingsCell>
                        <SettingsCell>
                          <SettingsRowField
                            autoFocus
                            placeholder={m.settings.categories.nameLabel}
                            value={subDraft.value}
                            onChange={(event) => subDraft.onChange(category.id, event.target.value)}
                          />
                        </SettingsCell>
                        <SettingsCell sx={{ width: CATEGORY_TABLE_COLUMNS.status }} />
                      </>
                    )}
                  </SettingsGhostRow>
                </TableBody>
              </Table>
            </SortableRows>

            {subDraft.value !== null && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  color: "text.disabled",
                  px: layout.inline,
                  py: layout.micro,
                }}
              >
                {settingsGhostHint()}
              </Typography>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** Uma linha de subcategoria — indentada, fundo `background.subtle`, ícone de
 * sub-nível. Não tem mais coluna própria de seção (o chip "herda" saiu junto com
 * "Seção padrão" — §2.2, revisão de estilo). */
function SubcategoryRow({
  categoryId,
  sub,
  index,
  isPending,
  canDrag,
  edit,
  onToggleActive,
  onDelete,
}: {
  categoryId: string;
  sub: SubcategoryItem;
  index: number;
  isPending: boolean;
  canDrag: boolean;
  edit: EditGroup;
  onToggleActive: (categoryId: string, sub: SubcategoryItem, next: boolean) => void;
  onDelete: (categoryId: string, sub: SubcategoryItem) => void;
}) {
  const active = resolveActive({ kind: "status", status: sub.status });
  const isEditingSub = edit.target?.scope === "subcategory" && edit.target.id === sub.id;
  const canCommitEdit = edit.name.trim().length > 0;
  const handleEditKeyDown = makeEditKeyDownHandler(canCommitEdit, edit.onCommit, edit.onCancel);

  return (
    <SortableRow id={sub.id} name={sub.name} disabled={!canDrag}>
      {({ setNodeRef, style, handle }) =>
        isEditingSub ? (
          <SettingsRow ref={setNodeRef} nested editing onKeyDown={handleEditKeyDown} sx={style}>
            <SettingsGripCell>{handle}</SettingsGripCell>
            <SettingsCell sx={{ width: CATEGORY_TABLE_COLUMNS.expand, px: 0.5 }}>
              <SubdirectoryArrowRightIcon
                sx={{ fontSize: SETTINGS_ROW_ICON.size, color: "text.disabled" }}
              />
            </SettingsCell>
            <SettingsCell>
              <Stack direction="row" spacing={layout.inline} alignItems="center">
                <ColorDot fallbackIndex={index} size={8} />
                <SettingsRowField
                  autoFocus
                  value={edit.name}
                  onChange={(event) => edit.onNameChange(event.target.value)}
                />
              </Stack>
            </SettingsCell>
            <SettingsCell sx={{ width: CATEGORY_TABLE_COLUMNS.status }}>
              <StatusCell
                active={active}
                lastUsedAt={sub.lastUsedAt}
                gender="f"
                name={sub.name}
                disabled
                onToggle={() => undefined}
              />
            </SettingsCell>
            <SettingsMenuCell>
              <SettingsEditActions
                onCancel={edit.onCancel}
                onCommit={edit.onCommit}
                canCommit={canCommitEdit && !isPending}
                name={sub.name}
              />
            </SettingsMenuCell>
          </SettingsRow>
        ) : (
          <SettingsRow ref={setNodeRef} nested hover sx={{ ...style, opacity: active ? 1 : 0.6 }}>
            <SettingsGripCell>{handle}</SettingsGripCell>
            <SettingsCell sx={{ width: CATEGORY_TABLE_COLUMNS.expand, px: 0.5 }}>
              <SubdirectoryArrowRightIcon
                sx={{ fontSize: SETTINGS_ROW_ICON.size, color: "text.disabled" }}
              />
            </SettingsCell>
            <SettingsCell sx={{ pl: 1 }}>
              <Stack direction="row" spacing={layout.inline} alignItems="center">
                <ColorDot fallbackIndex={index} size={8} />
                <Typography variant="body2" color="text.secondary" noWrap>
                  {sub.name}
                </Typography>
              </Stack>
            </SettingsCell>
            <SettingsCell sx={{ width: CATEGORY_TABLE_COLUMNS.status }}>
              <StatusCell
                active={active}
                lastUsedAt={sub.lastUsedAt}
                gender="f"
                name={sub.name}
                disabled={isPending}
                onToggle={(next) => onToggleActive(categoryId, sub, next)}
              />
            </SettingsCell>
            <SettingsMenuCell>
              <RowActionsMenu
                name={sub.name}
                active={active}
                actions={{
                  edit: () => edit.onStartSubcategory(categoryId, sub),
                  toggleActive: () => onToggleActive(categoryId, sub, !active),
                  delete: () => onDelete(categoryId, sub),
                }}
              />
            </SettingsMenuCell>
          </SettingsRow>
        )
      }
    </SortableRow>
  );
}
