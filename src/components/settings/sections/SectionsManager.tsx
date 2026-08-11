"use client";

import AddIcon from "@mui/icons-material/Add";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { SectionCountType } from "@prisma/client";
import { useSnackbar } from "notistack";
import { useRef, useState, useTransition } from "react";

import {
  createSectionAction,
  deleteSectionAction,
  reorderSectionsAction,
  updateSectionAction,
} from "@/actions/account-settings";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SettingsEmptyState } from "@/components/settings/SettingsEmptyState";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { SortableRows } from "@/components/settings/SortableRows";
import {
  SETTINGS_GRIP_WIDTH,
  SETTINGS_MENU_WIDTH,
} from "@/components/settings/table/settings-table-tokens";
import {
  SettingsGhostRow,
  settingsGhostHint,
  type SettingsGhostRowHandle,
} from "@/components/settings/table/SettingsGhostRow";
import { SettingsRowField } from "@/components/settings/table/SettingsRowField";
import { SettingsSelect } from "@/components/settings/table/SettingsSelect";
import {
  SettingsCell,
  SettingsHeadCell,
  SettingsTable,
} from "@/components/settings/table/SettingsTable";
import { UsageDialog } from "@/components/settings/UsageDialog";
import type { AccentColorKey } from "@/lib/accent-colors";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { SECTION_COUNT_TYPES } from "@/lib/schemas/settings";

import { SectionColorPicker } from "./SectionColorPicker";
import { SectionKindLegend } from "./SectionKindLegend";
import {
  SECTION_COLUMN_WIDTHS,
  SectionRow,
  type SectionDraft,
  type SectionRowData,
} from "./SectionRow";

type Props = {
  accountId: string;
  initialSections: SectionRowData[];
  title?: string;
};

type NewSectionDraft = {
  name: string;
  countType: SectionCountType;
  color: AccentColorKey | null;
};

const EMPTY_DRAFT: NewSectionDraft = { name: "", countType: "subtract", color: null };

/** `colgroup` da tabela — grip e menu vêm dos tokens compartilhados (Spec 68, revisão de estilo). */
const SECTION_TABLE_COLUMNS = [
  SETTINGS_GRIP_WIDTH,
  undefined,
  SECTION_COLUMN_WIDTHS.kind,
  SECTION_COLUMN_WIDTHS.models,
  SECTION_COLUMN_WIDTHS.status,
  SETTINGS_MENU_WIDTH,
];

const t = m.settings.structure.sections;

/**
 * Página de Seções (Spec 68 §2.1, pacote P2 + revisão de estilo).
 *
 * Substitui a versão anterior (Stack de Paper + modal de formulário + setas de
 * reordenar) por: `SettingsTable` compartilhada com as outras três páginas da família,
 * edição inline por linha, arraste via `@dnd-kit/sortable` e a legenda de tipos no
 * `subheader` do shell. O modal só sobrevive para duas confirmações curtas: desativar
 * (M8) e excluir.
 */
export function SectionsManager({ accountId, initialSections, title }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [sections, setSections] = useState(initialSections);
  const [isPending, startTransition] = useTransition();

  // Linha-fantasma (criação) — SET-08: único caminho de criação, nunca modal.
  const ghostRef = useRef<SettingsGhostRowHandle>(null);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<NewSectionDraft>(EMPTY_DRAFT);

  // Edição inline de uma linha já existente (no máximo uma por vez).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SectionDraft | null>(null);

  const [deactivateTarget, setDeactivateTarget] = useState<SectionRowData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SectionRowData | null>(null);

  // M3 · Ver uso (Spec 68 §2.6) — seções NÃO ganham "Mesclar" nem o M2 de exclusão
  // com realocação (fora do pacote §2.5/§2.6: `deleteSectionAction` já bloqueia
  // exclusão com tabelas financeiras associadas, e seção não está em
  // `getConfigReferencesAction`).
  const [usageTarget, setUsageTarget] = useState<SectionRowData | null>(null);

  // Chip de contagem do cabeçalho ("6 · 1 inativa" — Spec 67 §7.5). Deriva do
  // estado local, então acompanha criação/edição/exclusão sem nova consulta.
  const inactiveCount = sections.filter((section) => !section.isActive).length;
  const countLabel =
    inactiveCount > 0
      ? `${sections.length} · ${inactiveCount} ${inactiveCount === 1 ? "inativa" : "inativas"}`
      : String(sections.length);

  function cancelCreating() {
    setCreating(false);
    setNewDraft(EMPTY_DRAFT);
  }

  async function commitCreate() {
    if (newDraft.name.trim().length === 0) return;
    const name = newDraft.name.trim();
    const result = await createSectionAction(accountId, {
      name,
      countType: newDraft.countType,
      isActive: true,
      color: newDraft.color,
    });
    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }
    setSections((prev) => [
      ...prev,
      {
        id: result.data.sectionId,
        name,
        countType: newDraft.countType,
        color: newDraft.color,
        isActive: true,
        lastUsedAt: null,
        modelsCount: 0,
      },
    ]);
    enqueueSnackbar(m.settings.sections.created, { variant: "success" });
    // Enter cria e abre a próxima linha (contrato da `SettingsGhostRow` — `editing`
    // continua true, só o rascunho volta a ficar vazio).
    setNewDraft(EMPTY_DRAFT);
    ghostRef.current?.focus();
  }

  function startEdit(section: SectionRowData) {
    setEditingId(section.id);
    setEditDraft({
      name: section.name,
      countType: section.countType,
      color: section.color as AccentColorKey | null,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function commitEdit(section: SectionRowData) {
    if (!editDraft || editDraft.name.trim().length === 0) return;
    const name = editDraft.name.trim();
    const result = await updateSectionAction(accountId, {
      sectionId: section.id,
      name,
      countType: editDraft.countType,
      isActive: section.isActive,
      color: editDraft.color,
    });
    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }
    setSections((prev) =>
      prev.map((s) =>
        s.id === section.id
          ? { ...s, name, countType: editDraft.countType, color: editDraft.color }
          : s,
      ),
    );
    enqueueSnackbar(m.settings.sections.updated, { variant: "success" });
    cancelEdit();
  }

  function toggleActive(section: SectionRowData, next: boolean) {
    startTransition(async () => {
      const result = await updateSectionAction(accountId, {
        sectionId: section.id,
        name: section.name,
        countType: section.countType,
        isActive: next,
        color: section.color,
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, isActive: next } : s)));
    });
  }

  function confirmDeactivate() {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    setDeactivateTarget(null);
    toggleActive(target, false);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteSectionAction(accountId, { sectionId: target.id });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setSections((prev) => prev.filter((s) => s.id !== target.id));
      enqueueSnackbar(m.settings.sections.deleted, { variant: "success" });
    });
  }

  function handleReorder(orderedIds: string[]) {
    const byId = new Map(sections.map((s) => [s.id, s]));
    // Otimista: a ordem muda na tela antes da resposta do servidor — é só a
    // ordem das abas do mês, sem risco de dado inconsistente entre telas.
    setSections(orderedIds.map((id) => byId.get(id)!));
    startTransition(async () => {
      const result = await reorderSectionsAction(accountId, { orderedIds });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      enqueueSnackbar(m.settings.structure.reordered, { variant: "success" });
    });
  }

  const sectionsTableHead = (
    <>
      <SettingsHeadCell />
      <SettingsHeadCell>{t.columnName}</SettingsHeadCell>
      <SettingsHeadCell>{t.columnKind}</SettingsHeadCell>
      <SettingsHeadCell>{t.columnModels}</SettingsHeadCell>
      <SettingsHeadCell>{t.columnStatus}</SettingsHeadCell>
      <SettingsHeadCell />
    </>
  );

  // Linha-fantasma — referenciada nos DOIS ramos (lista vazia / preenchida) do
  // `SettingsTable` abaixo, nunca fora dele (ver comentário no JSX).
  const ghostRow = (
    <SettingsGhostRow
      ref={ghostRef}
      label={t.addRow}
      editing={creating}
      onStartEditing={() => setCreating(true)}
      onCancel={cancelCreating}
      onCommit={commitCreate}
      canCommit={newDraft.name.trim().length > 0}
      columnCount={SECTION_TABLE_COLUMNS.length}
    >
      <SettingsCell>
        <Stack direction="row" spacing={layout.inline} alignItems="center">
          <SectionColorPicker
            value={newDraft.color}
            fallbackIndex={sections.length}
            onChange={(next) => setNewDraft((draft) => ({ ...draft, color: next }))}
          />
          <SettingsRowField
            placeholder={t.columnName}
            value={newDraft.name}
            onChange={(event) => setNewDraft((draft) => ({ ...draft, name: event.target.value }))}
            inputProps={{ "aria-label": t.columnName }}
          />
        </Stack>
      </SettingsCell>
      <SettingsCell>
        <SettingsSelect
          fullWidth
          value={newDraft.countType}
          onChange={(event) =>
            setNewDraft((draft) => ({
              ...draft,
              countType: event.target.value as SectionCountType,
            }))
          }
          options={SECTION_COUNT_TYPES.map((type) => ({
            value: type,
            label: t.kindLabels[type],
          }))}
          inputProps={{ "aria-label": t.columnKind }}
        />
      </SettingsCell>
      {/* Modelos e Status não se editam na criação — células mudas, só para as
          colunas seguintes não desalinharem com o cabeçalho. */}
      <SettingsCell />
      <SettingsCell />
    </SettingsGhostRow>
  );

  return (
    <SettingsPageShell
      family="Estrutura"
      title={title ?? m.settings.nav.sections}
      count={countLabel}
      purpose={m.settings.purposes.sections}
      itemCount={sections.length}
      subheader={<SectionKindLegend />}
      // A tabela ocupa o painel inteiro, como no frame — o cap de leitura fica só
      // para os formulários (Spec 68, revisão de estilo).
      wideContent
      primaryAction={{
        label: t.addRow,
        icon: <AddIcon />,
        // Regra global do frame ("UM CAMINHO DE CRIAÇÃO"): o botão primário rola até
        // a última linha e deixa o cursor no primeiro campo — mesmo resultado de
        // clicar em "Adicionar seção…". Não abre modal.
        //
        // Precisa ABRIR a linha, não só focá-la: com a linha-fantasma ociosa, o
        // `focus()` alcança apenas o botão-gatilho e o usuário ainda teria de dar um
        // Enter antes de digitar. Abrir + focar é o que o frame promete.
        onClick: () => {
          setCreating(true);
          ghostRef.current?.focus();
        },
      }}
    >
      {sections.length === 0 && (
        <SettingsEmptyState
          icon={<ViewAgendaOutlinedIcon sx={{ fontSize: 48 }} />}
          title={t.emptyTitle}
          description={t.emptyDescription}
        />
      )}

      {/*
        A `SettingsGhostRow` é um `<TableRow>` de verdade (Spec 68, revisão de
        estilo) — precisa viver DENTRO do `<tbody>` da MESMA tabela, nunca como irmã
        dela. Fora da tabela ela vira um `<tr>` filho de `<div>`, HTML inválido que o
        navegador corrige sozinho e diverge do SSR (hydration error). Por isso as duas
        ramificações (lista vazia / lista preenchida) montam a própria `SettingsTable`
        e só variam se há `SortableRows` e linhas de dados por cima da linha-fantasma.
      */}
      {sections.length === 0 ? (
        <SettingsTable
          ariaLabel={title ?? m.settings.nav.sections}
          columns={SECTION_TABLE_COLUMNS}
          head={sectionsTableHead}
        >
          {ghostRow}
        </SettingsTable>
      ) : (
        // `SortableRows` envolve a TABELA INTEIRA, não só o corpo: o `DndContext` do
        // dnd-kit emite um `<div>` oculto de acessibilidade (descrição para leitor de
        // tela) como IRMÃO do conteúdo — dentro de `<tbody>` isso vira `<div>` filho de
        // `<tbody>`, HTML inválido que o navegador corrige sozinho e diverge do SSR
        // (hydration error).
        <SortableRows ids={sections.map((section) => section.id)} onReorder={handleReorder}>
          <SettingsTable
            ariaLabel={title ?? m.settings.nav.sections}
            columns={SECTION_TABLE_COLUMNS}
            head={sectionsTableHead}
          >
            {sections.map((section, index) => (
              <SectionRow
                key={section.id}
                section={section}
                index={index}
                editing={editingId === section.id}
                draft={editingId === section.id ? editDraft : null}
                onDraftChange={setEditDraft}
                onStartEdit={() => startEdit(section)}
                onCommitEdit={() => commitEdit(section)}
                onCancelEdit={cancelEdit}
                onToggleActive={(next) => toggleActive(section, next)}
                onRequestDeactivate={() => setDeactivateTarget(section)}
                onViewUsage={() => setUsageTarget(section)}
                onDelete={() => setDeleteTarget(section)}
                disabled={isPending}
              />
            ))}
            {ghostRow}
          </SettingsTable>
        </SortableRows>
      )}

      {creating && (
        <Typography
          variant="caption"
          sx={{ display: "block", color: "text.disabled", mt: layout.micro, px: layout.inline }}
        >
          {settingsGhostHint()}
        </Typography>
      )}

      <Typography
        variant="caption"
        sx={{ display: "block", color: "text.tertiary", mt: layout.stack }}
      >
        {t.modelsHint} {t.colorHint}
      </Typography>

      {/* Desativar (M8) — só quando a origem é o menu da linha (Spec 68 §2.1
          item 10); o Switch do StatusCell alterna direto, sem confirmação, que
          é o próprio motivo de existir um controle instantâneo na coluna. */}
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

      {/* Ver uso (M3) — sem `transactionsHref`: não existe rota de "todas as
          transações" filtrável fora de um mês específico (Spec 67/68 não criaram
          uma; a única filtragem por seção/categoria/instituição/responsável vive em
          `/months/[monthId]?...`, por mês). Ver relatório da task. */}
      <UsageDialog
        open={!!usageTarget}
        onClose={() => setUsageTarget(null)}
        accountId={accountId}
        entity="section"
        entityId={usageTarget?.id ?? ""}
        entityName={usageTarget?.name ?? ""}
      />

      {/* Excluir — bloqueado pelo service quando há tabelas financeiras
          associadas; a mensagem de bloqueio chega em `result.error.message`. */}
      <SettingsDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        size="confirm"
        titleIcon={<WarningAmberOutlinedIcon />}
        tone="danger"
        title={m.settings.sections.deleteTitle}
        description={m.settings.sections.deleteConfirm}
        actions={
          <>
            <Button size="small" onClick={() => setDeleteTarget(null)}>
              {m.common.cancel}
            </Button>
            <Button size="small" color="error" variant="contained" onClick={confirmDelete}>
              {m.common.delete}
            </Button>
          </>
        }
      />
    </SettingsPageShell>
  );
}
