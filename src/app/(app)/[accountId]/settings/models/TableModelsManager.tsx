"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useState, useTransition } from "react";

import {
  createTemplateManualAction,
  deleteTemplateAction,
  updateTemplateAction,
} from "@/actions/table-templates";
import {
  automationSiblings,
  buildSectionOrder,
  countDirtyFields,
  draftFromModel,
  orderPatches,
  type ModelDraft,
} from "@/components/settings/models/model-draft";
import type { ModelItem } from "@/components/settings/models/model-item-draft";
import {
  ModelDefinitionTab,
  type ModelDefinitionSection,
} from "@/components/settings/models/ModelDefinitionTab";
import { ModelTransactionsTab } from "@/components/settings/models/ModelTransactionsTab";
import {
  ModelUsedByTab,
  PROVENANCE_CUTOFF_LABEL,
  type ModelUsage,
} from "@/components/settings/models/ModelUsedByTab";
import { SETTINGS_GUTTER } from "@/components/settings/settings-layout";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SettingsMasterDetail } from "@/components/settings/SettingsMasterDetail";
import {
  SettingsPageShell,
  type SettingsPageShellProps,
} from "@/components/settings/SettingsPageShell";
import { SettingsSaveBar } from "@/components/settings/SettingsSaveBar";
import { SettingsTabPanel, SettingsTabs } from "@/components/settings/SettingsTabs";
import type { ResponsiblePartyOption } from "@/components/transactions/types";
import { m } from "@/lib/messages";
import type { RowLayout } from "@/lib/schemas/settings";
import type { UpdateTemplateInput } from "@/lib/schemas/table-template";
import type { TableColumnKey } from "@/lib/table-columns";
import type { Density } from "@/lib/table-density";

const t = m.settings.presentation.models;

/**
 * Tipo de tabela como a página precisa dele.
 *
 * Carrega apresentação (`rowLayout`, `density`, `visibleColumns`) porque a aba 2
 * renderiza a transação do modelo COM o tipo do modelo — sem esses três, a linha
 * ali seria uma tabela genérica que só afirma ser a linha real.
 */
export type ModelTableTypeOption = {
  id: string;
  name: string;
  isDefault: boolean;
  rowLayout: RowLayout;
  density: Density;
  visibleColumns: TableColumnKey[];
};

export type SettingsModel = {
  id: string;
  name: string;
  description: string | null;
  /** D7 — campo ÚNICO. `autoTableTypeId` é deprecated e não sobe para a UI. */
  tableTypeId: string | null;
  countInMonth: boolean;
  autoApply: boolean;
  autoSectionId: string | null;
  orderInSection: number | null;
  tableType: { id: string; name: string } | null;
  items: ModelItem[];
};

type Props = {
  accountId: string;
  initialModels: SettingsModel[];
  categories: { id: string; name: string; subcategories: { id: string; name: string }[] }[];
  institutions: { id: string; name: string }[];
  parties: ResponsiblePartyOption[];
  tableTypes: ModelTableTypeOption[];
  sections: ModelDefinitionSection[];
  /** Proveniência por modelo (`FinanceTable.createdFromTemplateId`), vinda do RSC. */
  usageByModel: Record<string, ModelUsage>;
  title?: string;
};

const EMPTY_USAGE: ModelUsage = { tables: 0, months: 0 };

/**
 * Modelos de tabela — arquétipo C (Spec 69 §2.2, frame 06).
 *
 * Substitui o accordion anterior: lista mestre à esquerda, três abas no detalhe,
 * rodapé "Salvar modelo". O que era diálogo de renomear virou o campo Nome da aba
 * 1; o que era o bloco `AutoApplySection` no fim do accordion virou a Automação,
 * agora com **um** campo de tipo (D7) e com Seção/Ordem revelados só sob o toggle.
 *
 * **Rascunho por modelo, não global.** `drafts` é indexado por id: trocar de modelo
 * na lista mestre com alterações pendentes não as descarta — elas continuam lá ao
 * voltar. O `dirtyCount` do rodapé, porém, é sempre o do modelo SELECIONADO: a barra
 * fala do que está na tela, e "Salvar modelo" salva um modelo.
 */
export function TableModelsManager({
  accountId,
  initialModels,
  categories,
  institutions,
  parties,
  tableTypes,
  sections,
  usageByModel,
  title,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [models, setModels] = useState<SettingsModel[]>(initialModels);
  const [selectedId, setSelectedId] = useState<string | null>(initialModels[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, ModelDraft>>({});
  const [tab, setTab] = useState("definition");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isMutating, startMutating] = useTransition();

  const selected = models.find((model) => model.id === selectedId) ?? null;
  const draft = selected ? (drafts[selected.id] ?? draftFromModel(selected)) : null;

  // Sem `useMemo` de propósito: `draft` é um objeto novo a cada render quando não há
  // rascunho salvo, então o memo nunca acertaria — e filtrar/ordenar meia dúzia de
  // modelos custa menos que a comparação de dependências.
  const siblings =
    selected && draft ? automationSiblings(models, selected.id, draft.autoSectionId) : [];

  // O tipo SALVO, não o do rascunho: a aba 2 renderiza a linha com o tipo que o
  // modelo tem hoje. Trocar o tipo na aba 1 sem salvar não pode reescrever a
  // aparência das transações já gravadas — elas nasceriam com o tipo antigo se o
  // usuário descartasse.
  const selectedTableType = tableTypes.find((type) => type.id === selected?.tableTypeId) ?? null;

  function patchDraft(patch: Partial<ModelDraft>) {
    if (!selected || !draft) return;
    const next = { ...draft, ...patch };
    // Trocar de seção zera a ordem: "2ª de 3" na seção antiga não diz nada sobre a
    // fila da nova. `null` = "no fim", que é onde um recém-chegado entra.
    if (patch.autoSectionId !== undefined && patch.autoSectionId !== draft.autoSectionId) {
      next.orderInSection = null;
    }
    setDrafts((prev) => ({ ...prev, [selected.id]: next }));
  }

  function clearDraft(modelId: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[modelId];
      return next;
    });
  }

  function handleSave() {
    if (!selected || !draft) return;

    const name = draft.name.trim();
    const order =
      draft.autoApply && draft.autoSectionId
        ? buildSectionOrder(siblings, selected.id, draft.orderInSection)
        : null;
    const selfIndex = order ? order.indexOf(selected.id) : null;

    const payload: UpdateTemplateInput = {
      templateId: selected.id,
      name,
      tableTypeId: draft.tableTypeId || null,
      autoApply: draft.autoApply,
      autoSectionId: draft.autoSectionId || null,
      ...(selfIndex === null ? {} : { orderInSection: selfIndex }),
    };

    startSaving(async () => {
      const result = await updateTemplateAction(accountId, payload);
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }

      // Os irmãos da seção também precisam de renumeração — sem isso, mover este
      // modelo para o topo o deixaria em 0 com o antigo primeiro TAMBÉM em 0, e o
      // desempate por nome decidiria a fila no lugar do usuário.
      const stored = new Map(models.map((model) => [model.id, model.orderInSection]));
      const patches = order
        ? orderPatches(order, stored).filter((patch) => patch.templateId !== selected.id)
        : [];
      const results = await Promise.all(
        patches.map((patch) => updateTemplateAction(accountId, patch)),
      );
      const persisted = new Map(
        patches
          .filter((_, index) => results[index].ok)
          .map((p) => [p.templateId, p.orderInSection]),
      );

      const nextTableType = tableTypes.find((type) => type.id === draft.tableTypeId) ?? null;
      setModels((prev) =>
        prev.map((model) => {
          if (model.id === selected.id) {
            return {
              ...model,
              name,
              tableTypeId: draft.tableTypeId || null,
              tableType: nextTableType ? { id: nextTableType.id, name: nextTableType.name } : null,
              autoApply: draft.autoApply,
              autoSectionId: draft.autoSectionId || null,
              orderInSection: selfIndex ?? model.orderInSection,
            };
          }
          const persistedOrder = persisted.get(model.id);
          return persistedOrder === undefined
            ? model
            : { ...model, orderInSection: persistedOrder };
        }),
      );
      clearDraft(selected.id);
      enqueueSnackbar(t.saved, { variant: "success" });
    });
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;

    startMutating(async () => {
      const result = await createTemplateManualAction(accountId, { name });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setModels((prev) => [
        ...prev,
        {
          id: result.data.id,
          name: result.data.name,
          description: null,
          tableTypeId: null,
          countInMonth: true,
          autoApply: false,
          autoSectionId: null,
          orderInSection: null,
          tableType: null,
          items: [],
        },
      ]);
      setSelectedId(result.data.id);
      setTab("definition");
      setCreateOpen(false);
      setNewName("");
      enqueueSnackbar(m.tableModels.created, { variant: "success" });
    });
  }

  function handleDelete() {
    if (!selected) return;
    const target = selected.id;
    setDeleteOpen(false);

    startMutating(async () => {
      const result = await deleteTemplateAction(accountId, { templateId: target });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      const remaining = models.filter((model) => model.id !== target);
      setModels(remaining);
      clearDraft(target);
      setSelectedId(remaining[0]?.id ?? null);
      enqueueSnackbar(m.tableModels.deleted, { variant: "success" });
    });
  }

  function handleItemsChanged(items: ModelItem[]) {
    if (!selected) return;
    setModels((prev) =>
      prev.map((model) => (model.id === selected.id ? { ...model, items } : model)),
    );
  }

  const pageTitle = title ?? m.tableModels.title;

  const createButton = (
    <Button
      variant="contained"
      size="small"
      startIcon={<AddIcon />}
      onClick={() => setCreateOpen(true)}
    >
      {t.createButton}
    </Button>
  );

  const shellProps: Omit<SettingsPageShellProps, "children"> = {
    family: "Apresentação",
    title: pageTitle,
    count: String(models.length),
    purpose: m.settings.purposes.models,
    primaryAction: {
      label: t.createButton,
      icon: <AddIcon />,
      onClick: () => setCreateOpen(true),
    },
    secondaryActions: selected
      ? [
          {
            label: m.common.delete,
            icon: <DeleteOutlineIcon />,
            onClick: () => setDeleteOpen(true),
            disabled: isMutating,
          },
        ]
      : undefined,
    // Sem `dirtyCount`: o rodapé desta página é da COLUNA DE DETALHE (slot `footer`
    // do master-detail), não do painel inteiro — o do shell corria por baixo da lista
    // de modelos. Ver o comentário da prop `footer` em `SettingsMasterDetail`.
    disableContentPadding: true,
  };

  // Sem modelo selecionado não há o que salvar: o slot fica vazio e o rodapé não
  // aparece, que é o comportamento certo no estado vazio.
  const saveBar =
    selected && draft ? (
      <SettingsSaveBar
        dirtyCount={countDirtyFields(draft, selected)}
        saveLabel={t.saveLabel}
        saving={isSaving}
        onSave={handleSave}
        onDiscard={() => clearDraft(selected.id)}
      />
    ) : undefined;

  return (
    <SettingsPageShell {...shellProps}>
      <SettingsMasterDetail
        items={models.map((model) => ({
          id: model.id,
          name: model.name,
          summary: t.summary(model.tableType?.name ?? null, model.items.length),
          // Esmaecido = modelo que ainda não cria transação nenhuma (frame 06).
          dimmed: model.items.length === 0,
        }))}
        selectedId={selectedId}
        onSelect={setSelectedId}
        ariaLabel={m.settings.presentation.masterListLabel}
        emptyLabel={m.tableModels.noModels}
        emptyDescription={m.tableModels.noModelsHint}
        emptyIcon={<TableChartOutlinedIcon sx={{ fontSize: 48 }} />}
        emptyAction={createButton}
        footer={saveBar}
      >
        {selected && draft ? (
          <>
            <SettingsTabs
              tabs={[
                { value: "definition", label: m.settings.presentation.tabs.definition },
                {
                  value: "transactions",
                  label: m.settings.presentation.tabs.modelTransactions,
                  count: selected.items.length,
                },
                { value: "usedBy", label: m.settings.presentation.tabs.usedBy },
              ]}
              value={tab}
              onChange={setTab}
              ariaLabel={pageTitle}
            />

            {/* O shell está com o padding desligado (arquétipo C): a goteira do
                detalhe é reaplicada aqui, na MESMA medida das abas. */}
            <Box sx={{ px: SETTINGS_GUTTER, flex: 1, minHeight: 0 }}>
              <SettingsTabPanel value="definition" activeValue={tab}>
                <ModelDefinitionTab
                  draft={draft}
                  onChange={patchDraft}
                  tableTypes={tableTypes}
                  sections={sections}
                  siblings={siblings}
                  disabled={isSaving}
                />
              </SettingsTabPanel>

              <SettingsTabPanel value="transactions" activeValue={tab}>
                <ModelTransactionsTab
                  accountId={accountId}
                  model={selected}
                  tableType={selectedTableType}
                  lookups={{ categories, institutions, parties }}
                  onItemsChanged={handleItemsChanged}
                />
              </SettingsTabPanel>

              <SettingsTabPanel value="usedBy" activeValue={tab}>
                <ModelUsedByTab
                  usage={usageByModel[selected.id] ?? EMPTY_USAGE}
                  cutoffDate={PROVENANCE_CUTOFF_LABEL}
                />
              </SettingsTabPanel>
            </Box>
          </>
        ) : (
          <Typography variant="body2" sx={{ px: SETTINGS_GUTTER, py: 4, color: "text.tertiary" }}>
            {m.settings.presentation.detailEmpty}
          </Typography>
        )}
      </SettingsMasterDetail>

      <SettingsDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setNewName("");
        }}
        size="form"
        title={t.createButton}
        loading={isMutating}
        actions={
          <>
            <Button
              onClick={() => {
                setCreateOpen(false);
                setNewName("");
              }}
            >
              {m.common.cancel}
            </Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={isMutating || !newName.trim()}
            >
              {m.common.create}
            </Button>
          </>
        }
      >
        <TextField
          label={m.tableModels.nameLabel}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          fullWidth
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleCreate();
            }
          }}
        />
      </SettingsDialog>

      <SettingsDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size="confirm"
        title={m.tableModels.deleteTitle}
        description={m.tableModels.deleteConfirm}
        actions={
          <>
            <Button onClick={() => setDeleteOpen(false)}>{m.common.cancel}</Button>
            <Button color="error" variant="contained" onClick={handleDelete}>
              {m.common.delete}
            </Button>
          </>
        }
      />
    </SettingsPageShell>
  );
}
