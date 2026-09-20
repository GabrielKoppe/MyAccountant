"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ViewColumnOutlinedIcon from "@mui/icons-material/ViewColumnOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useState, useTransition } from "react";

import {
  createTableTypeAction,
  deleteTableTypeAction,
  updateTableTypeAction,
} from "@/actions/account-settings";
import { SETTINGS_GUTTER } from "@/components/settings/settings-layout";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SettingsMasterDetail } from "@/components/settings/SettingsMasterDetail";
import {
  SettingsPageShell,
  type SettingsPageShellProps,
} from "@/components/settings/SettingsPageShell";
import { SettingsSaveBar } from "@/components/settings/SettingsSaveBar";
import { SettingsTabPanel, SettingsTabs } from "@/components/settings/SettingsTabs";
import { BehaviorTab } from "@/components/settings/table-types/BehaviorTab";
import { ColumnsLayoutTab } from "@/components/settings/table-types/ColumnsLayoutTab";
import {
  buildUpdatePayload,
  countDirtyFields,
  draftFromType,
  prunePinned,
  type TableTypeDraft,
} from "@/components/settings/table-types/table-type-draft";
import {
  TableTypeUsedByTab,
  type TableTypeModelUsage,
} from "@/components/settings/table-types/TableTypeUsedByTab";
import { m } from "@/lib/messages";
import {
  DEFAULT_INHERIT_ON_NEW_ROW,
  DEFAULT_KEEP_GHOST_ROW,
  DEFAULT_TABLE_TYPE_SORT,
} from "@/lib/schemas/settings";
import { visibleColumnsFromHidden } from "@/lib/table-columns";

const t = m.settings.presentation.tableTypes;
/** Chaves do namespace legado que a Spec 69 não reescreveu (nome, badge, exclusão). */
const legacy = m.settings.tableTypes;

/** Um tipo de tabela como a página o conhece: os 12 campos editáveis + o contexto. */
export type SettingsTableType = TableTypeDraft & {
  id: string;
  isDefault: boolean;
  /** Tabelas reais que usam este tipo — é o número do aviso de exclusão. */
  tableCount: number;
  /** Modelos que usam este tipo (contagem barata do RSC). */
  models: TableTypeModelUsage[];
};

type Props = {
  accountId: string;
  initialTypes: SettingsTableType[];
};

/**
 * Tipos de tabela — arquétipo C (Spec 69 §2.1, frames 05 e 05b).
 *
 * Substitui o accordion + diálogos anterior. Nada se perdeu: **criar** continua na
 * ação primária do shell, **renomear** virou o campo Nome da aba 1 (era um diálogo
 * de edição inline), **excluir** virou ação secundária do shell com o mesmo aviso
 * de N tabelas afetadas, e o selo **Padrão** virou o `badge` do item na lista
 * mestre — ele diz QUAL tipo é o padrão, e isso se lê melhor na lista do que ao
 * lado de um campo do detalhe. O motivo da trava de colunas, que o selo explicava
 * de carona, está dito na Aba 1 (`columns.defaultLocked`).
 *
 * **Rascunho por tipo, não global** (mesmo padrão da página de Modelos): `drafts`
 * é indexado por id, então trocar de tipo na lista mestre não descarta edição
 * pendente. O `dirtyCount` do rodapé, porém, é sempre o do tipo SELECIONADO — a
 * barra fala do que está na tela, e "Salvar tipo" salva um tipo.
 */
export function TableTypesManager({ accountId, initialTypes }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [types, setTypes] = useState<SettingsTableType[]>(initialTypes);
  const [selectedId, setSelectedId] = useState<string | null>(initialTypes[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, TableTypeDraft>>({});
  const [tab, setTab] = useState("columns");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isMutating, startMutating] = useTransition();

  const selected = types.find((type) => type.id === selectedId) ?? null;
  const draft = selected ? (drafts[selected.id] ?? draftFromType(selected)) : null;

  function patchDraft(patch: Partial<TableTypeDraft>) {
    if (!selected || !draft) return;
    const next = { ...draft, ...patch };
    // Uma coluna que saiu de `visibleColumns` não pode continuar fixada — a poda
    // vale para qualquer caminho que mude o conjunto, não só o × do chip.
    if (patch.visibleColumns !== undefined && patch.pinnedColumns === undefined) {
      next.pinnedColumns = prunePinned(next.pinnedColumns, next.visibleColumns);
    }
    setDrafts((prev) => ({ ...prev, [selected.id]: next }));
  }

  function clearDraft(tableTypeId: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[tableTypeId];
      return next;
    });
  }

  function handleSave() {
    if (!selected || !draft) return;

    const payload = buildUpdatePayload(selected.id, draft, selected, {
      canEditColumns: !selected.isDefault,
    });

    startSaving(async () => {
      const result = await updateTableTypeAction(accountId, payload);
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setTypes((prev) =>
        prev.map((type) =>
          type.id === selected.id
            ? {
                ...type,
                ...draft,
                name: draft.name.trim(),
                // O tipo padrão não aceita mudança de conjunto de colunas: o
                // estado local precisa refletir o que o servidor GRAVOU, não o
                // que a UI mandou, senão a lista mestre mentiria até a recarga.
                visibleColumns: selected.isDefault ? type.visibleColumns : draft.visibleColumns,
              }
            : type,
        ),
      );
      clearDraft(selected.id);
      enqueueSnackbar(t.saved, { variant: "success" });
    });
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;

    startMutating(async () => {
      const result = await createTableTypeAction(accountId, { name, hiddenColumns: {} });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      // Os defaults abaixo espelham os do `createTableType` — um tipo recém-criado
      // aparece na tela exatamente como está no banco, sem esperar recarga.
      setTypes((prev) => [
        ...prev,
        {
          id: result.data.tableTypeId,
          name,
          isDefault: false,
          rowLayout: "columns",
          density: "default",
          visibleColumns: visibleColumnsFromHidden({}),
          pinnedColumns: [],
          inheritOnNewRow: [...DEFAULT_INHERIT_ON_NEW_ROW],
          defaultSort: { ...DEFAULT_TABLE_TYPE_SORT },
          groupBy: null,
          showFooterTotal: true,
          showGroupSubtotal: false,
          allowBulkEdit: true,
          keepGhostRow: DEFAULT_KEEP_GHOST_ROW,
          tableCount: 0,
          models: [],
        },
      ]);
      setSelectedId(result.data.tableTypeId);
      setTab("columns");
      setCreateOpen(false);
      setNewName("");
      enqueueSnackbar(legacy.created, { variant: "success" });
    });
  }

  function handleDelete() {
    if (!selected) return;
    const target = selected.id;
    setDeleteOpen(false);

    startMutating(async () => {
      const result = await deleteTableTypeAction(accountId, { tableTypeId: target });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      const remaining = types.filter((type) => type.id !== target);
      setTypes(remaining);
      clearDraft(target);
      setSelectedId(remaining[0]?.id ?? null);
      enqueueSnackbar(legacy.deleted, { variant: "success" });
    });
  }

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
    title: m.settings.nav.tableTypes,
    count: String(types.length),
    purpose: m.settings.purposes.tableTypes,
    primaryAction: {
      label: t.createButton,
      icon: <AddIcon />,
      onClick: () => setCreateOpen(true),
    },
    // O tipo padrão não é excluível (o serviço recusa) — oferecer o botão só para
    // ele falhar seria uma promessa vazia.
    secondaryActions:
      selected && !selected.isDefault
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
    // de tipos. Ver o comentário da prop `footer` em `SettingsMasterDetail`.
    disableContentPadding: true,
  };

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
        items={types.map((type) => ({
          id: type.id,
          name: type.name,
          summary: t.summary(
            type.visibleColumns.length,
            type.rowLayout === "pills" ? t.rowLayout.pillsShort : t.rowLayout.columnsShort,
            type.models.length,
          ),
          // "Padrão" identifica o tipo, não um campo dele: na lista mestre dá para
          // ver qual é o padrão sem abrir os cinco tipos um a um. A razão da trava
          // de colunas continua escrita na Aba 1 (`columns.defaultLocked`).
          badge: type.isDefault ? legacy.defaultBadge : undefined,
          // Esmaecido = tipo que nenhum modelo usa (frame 05).
          dimmed: type.models.length === 0,
        }))}
        selectedId={selectedId}
        onSelect={setSelectedId}
        ariaLabel={m.settings.presentation.masterListLabel}
        emptyLabel={legacy.noTableTypes}
        emptyDescription={m.settings.purposes.tableTypes}
        emptyIcon={<ViewColumnOutlinedIcon sx={{ fontSize: 48 }} />}
        emptyAction={createButton}
        footer={saveBar}
      >
        {selected && draft ? (
          <>
            <SettingsTabs
              tabs={[
                { value: "columns", label: m.settings.presentation.tabs.columnsLayout },
                { value: "behavior", label: m.settings.presentation.tabs.behavior },
                {
                  value: "usedBy",
                  label: m.settings.presentation.tabs.usedBy,
                  count: selected.models.length,
                },
              ]}
              value={tab}
              onChange={setTab}
              ariaLabel={m.settings.nav.tableTypes}
            />

            {/* O shell está com o padding desligado (arquétipo C): a goteira do
                detalhe é reaplicada aqui, na MESMA medida das abas. */}
            <Box sx={{ px: SETTINGS_GUTTER, flex: 1, minHeight: 0 }}>
              <SettingsTabPanel value="columns" activeValue={tab}>
                <ColumnsLayoutTab
                  draft={draft}
                  onChange={patchDraft}
                  isDefault={selected.isDefault}
                  disabled={isSaving}
                />
              </SettingsTabPanel>

              <SettingsTabPanel value="behavior" activeValue={tab}>
                <BehaviorTab draft={draft} onChange={patchDraft} disabled={isSaving} />
              </SettingsTabPanel>

              <SettingsTabPanel value="usedBy" activeValue={tab}>
                <TableTypeUsedByTab
                  // `key` por tipo: o painel de contagem guarda o resultado em
                  // estado próprio. Sem remontar, trocar de tipo com a aba aberta
                  // mostraria a contagem do tipo ANTERIOR como se fosse deste.
                  key={selected.id}
                  accountId={accountId}
                  tableTypeId={selected.id}
                  tableTypeName={selected.name}
                  models={selected.models}
                  modelsHref={`/${accountId}/settings/models`}
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
        title={legacy.createTitle}
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
          label={legacy.nameLabel}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          helperText={legacy.createHelperText}
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
        title={legacy.deleteTitle}
        description={legacy.deleteConfirm}
        actions={
          <>
            <Button onClick={() => setDeleteOpen(false)}>{m.common.cancel}</Button>
            <Button color="error" variant="contained" onClick={handleDelete}>
              {m.common.delete}
            </Button>
          </>
        }
      >
        {/* O aviso de N tabelas afetadas do gerenciador antigo — a única
            informação que dizia o tamanho do estrago antes do clique. */}
        {selected && selected.tableCount > 0 ? (
          <Alert severity="warning">{legacy.deleteWarning(selected.tableCount)}</Alert>
        ) : null}
      </SettingsDialog>
    </SettingsPageShell>
  );
}
