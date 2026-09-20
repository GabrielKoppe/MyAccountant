"use client";

import AddIcon from "@mui/icons-material/Add";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useState, useTransition } from "react";

import {
  addTemplateItemAction,
  deleteTemplateItemAction,
  updateTemplateItemAction,
} from "@/actions/table-templates";
import { SettingsEmptyState } from "@/components/settings/SettingsEmptyState";
import { SortableRow, SortableRows } from "@/components/settings/SortableRows";
import {
  SETTINGS_CELL_PADDING,
  SETTINGS_ROW_HEIGHT,
  SETTINGS_ROW_ICON,
  SETTINGS_TABLE_FONT,
} from "@/components/settings/table/settings-table-tokens";
import { layout, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { RowLayout } from "@/lib/schemas/settings";
import type { TableColumnKey } from "@/lib/table-columns";
import type { Density } from "@/lib/table-density";

import { dayRuleLabel } from "./DayRuleField";
import { ImportFromMonthDialog } from "./ImportFromMonthDialog";
import {
  canCommitItemDraft,
  draftFromItem,
  EMPTY_ITEM_DRAFT,
  itemFromDraft,
  itemInputFromDraft,
  itemOrderPatches,
  modelItemColumns,
  newItemFromDraft,
  reorderItems,
  sumItemCents,
  type ModelItem,
  type ModelItemDraft,
} from "./model-item-draft";
import { ModelItemEditRow } from "./ModelItemEditRow";
import { ModelItemRow, type ModelItemLookups } from "./ModelItemRow";

const t = m.settings.presentation.models.transactions;
const tImport = m.settings.presentation.models.importFromMonth;
const rowLayoutLabels = m.settings.presentation.tableTypes.rowLayout;

/** O tipo de tabela do modelo, já normalizado pelo RSC. */
export type ModelItemsTableType = {
  name: string;
  rowLayout: RowLayout;
  density: Density;
  visibleColumns: readonly TableColumnKey[];
};

export type ModelTransactionsTabProps = {
  accountId: string;
  model: { id: string; name: string; items: ModelItem[] };
  /** Tipo de tabela do PRÓPRIO modelo — é com ele que a linha é renderizada. */
  tableType: ModelItemsTableType | null;
  lookups: ModelItemLookups;
  onItemsChanged: (items: ModelItem[]) => void;
};

/**
 * Aba 2 · Transações do modelo — o core da automação (Spec 69 §2.2, frame 06b).
 *
 * A mini-tabela é editável e é renderizada **com o tipo do próprio modelo**: as
 * linhas de leitura passam pelo `LivePreviewRow`, então o layout (colunas ou
 * pílulas), a densidade e o conjunto de colunas são os mesmos que a tabela real
 * do mês terá. É essa fidelidade que faz a faixa de contexto ("Linha renderizada
 * com o tipo X · layout pílulas") ser verdade e não legenda.
 *
 * **Sem cabeçalho de coluna, de propósito.** No layout de pílulas não existe grade
 * para um cabeçalho nomear — as pílulas fluem e somem quando vazias. Um cabeçalho
 * que só se alinha em um dos dois layouts mente no outro; os campos carregam o
 * próprio nome (`aria-label` + placeholder) e a faixa de contexto diz qual tipo
 * está desenhando a linha. É a única divergência consciente do frame 06b, que
 * desenha um tipo de cartão (pílulas) com cabeçalho de grade.
 */
export function ModelTransactionsTab({
  accountId,
  model,
  tableType,
  lookups,
  onItemsChanged,
}: ModelTransactionsTabProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<ModelItemDraft>(EMPTY_ITEM_DRAFT);
  const [importOpen, setImportOpen] = useState(false);

  const columns = modelItemColumns(tableType?.visibleColumns);
  const showInstitutionColumn = columns.includes("institution");
  const rowLayout: RowLayout = tableType?.rowLayout ?? "columns";
  const density: Density = tableType?.density ?? "default";
  const total = sumItemCents(model.items);

  function patchDraft(patch: Partial<ModelItemDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function closeEditor() {
    setEditingId(null);
    setCreating(false);
    setDraft(EMPTY_ITEM_DRAFT);
  }

  function startCreate() {
    setEditingId(null);
    setCreating(true);
    setDraft(EMPTY_ITEM_DRAFT);
  }

  function startEdit(item: ModelItem) {
    setCreating(false);
    setEditingId(item.id);
    setDraft(draftFromItem(item));
  }

  function handleCreate() {
    if (!canCommitItemDraft(draft)) return;

    startTransition(async () => {
      const result = await addTemplateItemAction(accountId, {
        templateId: model.id,
        ...itemInputFromDraft(draft),
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      onItemsChanged([...model.items, newItemFromDraft(result.data.id, draft, model.items.length)]);
      // Enter grava e REABRE (contrato da linha-fantasma da Spec 68): quem está
      // montando um modelo digita várias linhas seguidas.
      setDraft(EMPTY_ITEM_DRAFT);
      enqueueSnackbar(t.created, { variant: "success" });
    });
  }

  function handleUpdate() {
    if (!editingId || !canCommitItemDraft(draft)) return;
    const target = model.items.find((item) => item.id === editingId);
    if (!target) return;

    startTransition(async () => {
      const result = await updateTemplateItemAction(accountId, {
        itemId: editingId,
        ...itemInputFromDraft(draft),
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      onItemsChanged(
        model.items.map((item) => (item.id === editingId ? itemFromDraft(target, draft) : item)),
      );
      closeEditor();
      enqueueSnackbar(t.updated, { variant: "success" });
    });
  }

  function handleDelete(item: ModelItem) {
    startTransition(async () => {
      const result = await deleteTemplateItemAction(accountId, { itemId: item.id });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      onItemsChanged(model.items.filter((other) => other.id !== item.id));
      if (editingId === item.id) closeEditor();
      enqueueSnackbar(t.deleted, { variant: "success" });
    });
  }

  /**
   * Arraste: renumera TODAS as linhas afetadas, não só a arrastada.
   *
   * Otimista com reversão — a lista reordena no mesmo gesto e volta ao estado
   * anterior se alguma escrita falhar. Sem a reversão, um erro deixaria a tela
   * mostrando uma ordem que o banco não tem.
   */
  function handleReorder(orderedIds: string[]) {
    const patches = itemOrderPatches(model.items, orderedIds);
    if (patches.length === 0) return;

    const previous = model.items;
    onItemsChanged(reorderItems(model.items, orderedIds));

    startTransition(async () => {
      const results = await Promise.all(
        patches.map((patch) =>
          updateTemplateItemAction(accountId, {
            itemId: patch.itemId,
            displayOrder: patch.displayOrder,
          }),
        ),
      );
      const failure = results.find((result) => !result.ok);
      if (failure && !failure.ok) {
        onItemsChanged(previous);
        enqueueSnackbar(failure.error.message, { variant: "error" });
      }
    });
  }

  function handleImported(items: ModelItem[], imported: number) {
    // A lista vem INTEIRA do servidor (as antigas + as importadas no fim), então
    // é substituição, não concatenação — não há como duplicar nem perder linha.
    onItemsChanged(items);
    if (imported > 0) closeEditor();
  }

  const newButton = (
    <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={startCreate}>
      {t.newButton}
    </Button>
  );

  const importButton = (
    <Button
      size="small"
      variant="outlined"
      startIcon={<UploadFileOutlinedIcon />}
      onClick={() => setImportOpen(true)}
    >
      {tImport.button}
    </Button>
  );

  const isEmpty = model.items.length === 0 && !creating;

  return (
    <Box sx={{ py: layout.stack }}>
      <Stack
        direction="row"
        spacing={layout.inline}
        alignItems="center"
        useFlexGap
        sx={{ flexWrap: "wrap", mb: layout.stack }}
      >
        <InfoOutlinedIcon fontSize="small" sx={{ color: "text.tertiary" }} />
        <Typography variant="body2" sx={{ color: "text.tertiary", flex: 1, minWidth: 0 }}>
          {tableType
            ? t.renderedWith(
                tableType.name,
                tableType.rowLayout === "pills"
                  ? rowLayoutLabels.pillsShort
                  : rowLayoutLabels.columnsShort,
              )
            : t.renderedWithNoType}
        </Typography>
        {!isEmpty && importButton}
        {!isEmpty && newButton}
      </Stack>

      {isEmpty ? (
        <SettingsEmptyState
          size="compact"
          title={t.empty}
          description={t.hint}
          action={newButton}
          shortcut={importButton}
        />
      ) : (
        // `SortableRows` envolve o CONTÊINER inteiro, nunca só as linhas: o
        // `DndContext` injeta um `<div>` oculto de acessibilidade como irmão do
        // conteúdo (aqui não há `<tbody>` para invalidar, mas a regra vale igual —
        // o div precisa de um pai que aceite `div`).
        <SortableRows ids={model.items.map((item) => item.id)} onReorder={handleReorder}>
          <Box
            sx={{
              border: 1,
              borderColor: "border.subtle",
              borderRadius: "8px",
              overflowX: "auto",
            }}
          >
            {model.items.map((item, index) =>
              item.id === editingId ? (
                <ModelItemEditRow
                  key={item.id}
                  draft={draft}
                  onChange={patchDraft}
                  onCancel={closeEditor}
                  onCommit={handleUpdate}
                  canCommit={canCommitItemDraft(draft)}
                  lookups={lookups}
                  showInstitutionColumn={showInstitutionColumn}
                  name={item.description ?? t.columnDescription}
                  disabled={isPending}
                />
              ) : (
                <SortableRow
                  key={item.id}
                  id={item.id}
                  name={item.description ?? dayRuleLabel(item.dayRule, item.day)}
                  // Arrastar enquanto outra linha está aberta reordenaria por baixo
                  // de um formulário sem commit — a ordem mudaria e o rascunho
                  // ficaria apontando para a posição antiga.
                  disabled={editingId !== null || creating || isPending}
                >
                  {({ setNodeRef, style, handle }) => (
                    <ModelItemRow
                      item={item}
                      columns={columns}
                      rowLayout={rowLayout}
                      density={density}
                      lookups={lookups}
                      last={index === model.items.length - 1 && !creating}
                      onEdit={() => startEdit(item)}
                      onDelete={() => handleDelete(item)}
                      handle={handle}
                      setNodeRef={setNodeRef}
                      dragStyle={style}
                    />
                  )}
                </SortableRow>
              ),
            )}

            {creating ? (
              <ModelItemEditRow
                draft={draft}
                onChange={patchDraft}
                onCancel={closeEditor}
                onCommit={handleCreate}
                canCommit={canCommitItemDraft(draft)}
                isNew
                lookups={lookups}
                showInstitutionColumn={showInstitutionColumn}
                name={t.newButton}
                disabled={isPending}
              />
            ) : (
              <GhostRow onClick={startCreate} />
            )}
          </Box>
        </SortableRows>
      )}

      {/* Rodapé do frame 06b: a explicação do dia relativo e do valor zero à
          esquerda, o total do modelo à direita. */}
      <Stack
        direction="row"
        spacing={layout.inline}
        alignItems="flex-start"
        useFlexGap
        sx={{ flexWrap: "wrap", mt: layout.stack }}
      >
        <InfoOutlinedIcon fontSize="small" sx={{ color: "text.tertiary" }} />
        <Typography variant="caption" sx={{ color: "text.tertiary", flex: 1, minWidth: 200 }}>
          {t.hint}
        </Typography>
        <Typography
          variant="mono"
          sx={{ fontSize: "0.75rem", fontWeight: typography.fontWeight.medium }}
        >
          {t.total(formatCentsToBrl(total))}
        </Typography>
      </Stack>

      <ImportFromMonthDialog
        accountId={accountId}
        templateId={model.id}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
      />
    </Box>
  );
}

/**
 * Estado ocioso da linha-fantasma (`SettingsGhostRow` sem o `<tr>`).
 *
 * A `SettingsGhostRow` da Spec 68 é um `<TableRow>` e só existe dentro de um
 * `<table>`; as linhas daqui são as do `LivePreviewRow`, que são `Box`. O que
 * importa dela — o `+` em accent, a borda tracejada, o rótulo terciário e o
 * gesto de abrir a criação — está reproduzido; o contrato de teclado e os botões
 * ✗/✓ vivem na `ModelItemEditRow`, que é o estado aberto desta mesma linha.
 */
function GhostRow({ onClick }: { onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: "100%",
        minHeight: SETTINGS_ROW_HEIGHT,
        justifyContent: "flex-start",
        gap: 1,
        px: SETTINGS_CELL_PADDING.x,
        py: SETTINGS_CELL_PADDING.y,
        borderTopWidth: "1px",
        borderTopStyle: "dashed",
        borderTopColor: "border.subtle",
        "&:hover": { bgcolor: "background.subtle" },
      }}
    >
      <AddIcon sx={{ fontSize: SETTINGS_ROW_ICON.size, color: "accent.primary" }} />
      <Typography sx={{ fontSize: SETTINGS_TABLE_FONT.row.size, color: "text.tertiary" }}>
        {t.addRow}
      </Typography>
    </ButtonBase>
  );
}
