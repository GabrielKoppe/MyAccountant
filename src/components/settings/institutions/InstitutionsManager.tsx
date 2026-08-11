"use client";

import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import AddIcon from "@mui/icons-material/Add";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import Button from "@mui/material/Button";
import type { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useRef, useState, useTransition, type KeyboardEvent } from "react";

import {
  createInstitutionAction,
  deleteInstitutionAction,
  updateInstitutionAction,
} from "@/actions/account-settings";
import { mergeEntityAction } from "@/actions/settings-merge";
import { DeleteWithReallocationDialog } from "@/components/settings/DeleteWithReallocationDialog";
import { MergeDialog } from "@/components/settings/MergeDialog";
import { RowActionsMenu } from "@/components/settings/RowActionsMenu";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SettingsEmptyState } from "@/components/settings/SettingsEmptyState";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { StatusCell } from "@/components/settings/StatusCell";
import { SETTINGS_MENU_WIDTH } from "@/components/settings/table/settings-table-tokens";
import {
  SettingsGhostRow,
  settingsGhostHint,
  type SettingsGhostRowHandle,
} from "@/components/settings/table/SettingsGhostRow";
import {
  SettingsEditActions,
  SettingsRowField,
} from "@/components/settings/table/SettingsRowField";
import { SettingsSelect } from "@/components/settings/table/SettingsSelect";
import {
  SettingsCell,
  SettingsHeadCell,
  SettingsMenuCell,
  SettingsRow,
  SettingsTable,
} from "@/components/settings/table/SettingsTable";
import { UsageDialog } from "@/components/settings/UsageDialog";
import { layout } from "@/lib/design-tokens";
import { stripInapplicableDetails, type InstitutionDetails } from "@/lib/institution-details";
import { m } from "@/lib/messages";
import {
  INSTITUTION_KINDS,
  type InstitutionKindValue,
  type UpdateInstitutionInput,
} from "@/lib/schemas/settings";
import { resolveActive } from "@/lib/settings-status";

import { InstitutionDetailsFields } from "./InstitutionDetailsFields";
import { InstitutionMonogram } from "./InstitutionMonogram";

const t = m.settings.structure.institutions;

export type Institution = {
  id: string;
  name: string;
  kind: InstitutionKindValue | null;
  status: "active" | "inactive";
  lastUsedAt: Date | string | null;
} & InstitutionDetails;

type Draft = {
  name: string;
} & Pick<Institution, "kind"> &
  InstitutionDetails;

type Props = {
  accountId: string;
  initialInstitutions: Institution[];
};

const EMPTY_DETAILS: InstitutionDetails = {
  last4: null,
  closingDay: null,
  dueDay: null,
  branch: null,
  accountNo: null,
  taxId: null,
};

/** Larguras das colunas de conteúdo — o menu vem do token compartilhado. Sem coluna de
 * alça: instituições não têm ordem própria (a lista já nasce alfabética). */
const INSTITUTION_COLUMN_WIDTHS = {
  kind: 130,
  status: 140,
} as const;

/** `colgroup` da tabela (Spec 68, revisão de estilo). */
const INSTITUTION_TABLE_COLUMNS = [
  undefined,
  INSTITUTION_COLUMN_WIDTHS.kind,
  undefined,
  INSTITUTION_COLUMN_WIDTHS.status,
  SETTINGS_MENU_WIDTH,
];

const KIND_OPTIONS = INSTITUTION_KINDS.map((kind) => ({ value: kind, label: t.kindLabels[kind] }));

/**
 * Monta o payload de update SEMPRE com a foto inteira da linha (nome, tipo e os seis
 * campos de detalhe), só sobrepondo o que de fato mudou.
 *
 * Isto não é excesso de zelo: `updateInstitution` (service, P1 — não alterado aqui)
 * chama `stripInapplicableDetails(input.kind, ...)`, e essa função trata `kind:
 * undefined` como "nenhum campo se aplica" — zerando os SEIS campos de detalhe. Um
 * update parcial (ex.: só `{ institutionId, name, status }` para alternar o Switch)
 * apagaria silenciosamente final de cartão, agência etc. de qualquer instituição já
 * classificada. Mandar a foto inteira em toda chamada neutraliza a armadilha.
 */
function buildUpdatePayload(
  current: Institution,
  patch: Partial<Omit<UpdateInstitutionInput, "institutionId">> = {},
): UpdateInstitutionInput {
  return {
    institutionId: current.id,
    name: current.name,
    kind: current.kind,
    status: current.status,
    last4: current.last4,
    closingDay: current.closingDay,
    dueDay: current.dueDay,
    branch: current.branch,
    accountNo: current.accountNo,
    taxId: current.taxId,
    ...patch,
  };
}

/**
 * Página "Instituições" (Spec 68 §2.3 / EST-05) — arquétipo A, sem toolbar (lista
 * curta). `SettingsTable` + edição inline substituem o antigo `Stack` de `Paper` +
 * modal único. Moldura (altura, padding, tipografia, ícones) vem inteira de
 * `@/components/settings/table` — a revisão de estilo da Spec 68 fixou essas medidas
 * num módulo só, compartilhado pelas quatro páginas da família Estrutura.
 */
export function InstitutionsManager({ accountId, initialInstitutions }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [institutions, setInstitutions] = useState(initialInstitutions);
  const [isPending, startTransition] = useTransition();

  const ghostRef = useRef<SettingsGhostRowHandle>(null);
  const [creatingName, setCreatingName] = useState<string | null>(null);
  // Tipo é opcional na criação (§4 — nada é inferido do nome): o campo cabe na própria
  // linha-fantasma, então oferecê-lo já aqui evita um "editar" imediato depois de criar.
  const [creatingKind, setCreatingKind] = useState<InstitutionKindValue | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  // Booleano, não mensagem: `SettingsRowField` esconde o `helperText` (não há onde uma
  // linha de tabela caber um texto de erro) — o aviso vai para o snackbar, o campo só
  // fica vermelho.
  const [nameError, setNameError] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Institution | null>(null);

  // M3 · Ver uso / M5 · Mesclar (Spec 68 §2.5/§2.6 — pacote P8).
  const [usageTarget, setUsageTarget] = useState<Institution | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Institution | null>(null);

  // ─── Criação (linha-fantasma) ───────────────────────────────────────────
  // Detalhes não fazem parte da criação: eles dependem do tipo, e o critério de
  // aceite da §4 já pede uma linha de edição para trocá-los sem recarregar a tela.

  function startCreating() {
    setCreatingName("");
    setCreatingKind(null);
  }

  function cancelCreating() {
    setCreatingName(null);
    setCreatingKind(null);
  }

  function commitCreate() {
    const name = (creatingName ?? "").trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createInstitutionAction(accountId, { name, kind: creatingKind });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      const created: Institution = {
        id: result.data.institutionId,
        name,
        kind: creatingKind,
        status: "active",
        lastUsedAt: null,
        ...EMPTY_DETAILS,
      };
      setInstitutions((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      enqueueSnackbar(m.settings.institutions.created, { variant: "success" });
      // Enter cria e reabre a próxima linha (SET-08): a linha nunca sai do estado
      // "editing", então o efeito interno da `SettingsGhostRow` (que só refoca na
      // transição ocioso → edição) não dispara sozinho — refocamos explicitamente.
      setCreatingName("");
      setCreatingKind(null);
      ghostRef.current?.focus();
    });
  }

  // ─── Edição inline (linha existente) ────────────────────────────────────

  function startEdit(inst: Institution) {
    setEditingId(inst.id);
    setNameError(false);
    setDraft({
      name: inst.name,
      kind: inst.kind,
      last4: inst.last4,
      closingDay: inst.closingDay,
      dueDay: inst.dueDay,
      branch: inst.branch,
      accountNo: inst.accountNo,
      taxId: inst.taxId,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setNameError(false);
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  // Critério de aceite da §4: trocar o tipo troca os campos de detalhe JUNTO, e o
  // valor dos que saíram é descartado — na tela, não só no servidor. Reusa a mesma
  // `stripInapplicableDetails` do schema/service: um lugar só decide o que é válido
  // para cada tipo.
  function handleKindChange(event: SelectChangeEvent) {
    const raw = event.target.value;
    const nextKind = raw === "" ? null : (raw as InstitutionKindValue);
    setDraft((prev) => {
      if (!prev) return prev;
      const stripped = stripInapplicableDetails(nextKind, prev);
      return { ...prev, kind: nextKind, ...stripped };
    });
  }

  const canCommitEdit = !!draft && draft.name.trim().length > 0;

  function commitEdit() {
    if (!draft || !editingId) return;
    const name = draft.name.trim();
    if (!name) {
      setNameError(true);
      enqueueSnackbar(m.settings.institutions.nameLabel, { variant: "error" });
      return;
    }
    const current = institutions.find((i) => i.id === editingId);
    if (!current) return;

    const stripped = stripInapplicableDetails(draft.kind, draft);
    startTransition(async () => {
      const result = await updateInstitutionAction(
        accountId,
        buildUpdatePayload(current, { name, kind: draft.kind, ...stripped }),
      );
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setInstitutions((prev) =>
        prev
          .map((i) => (i.id === editingId ? { ...i, name, kind: draft.kind, ...stripped } : i))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      enqueueSnackbar(m.settings.institutions.updated, { variant: "success" });
      cancelEdit();
    });
  }

  // Mesmo contrato de teclado da `SettingsGhostRow` (Enter grava, Esc cancela), mas
  // para uma linha que já existe: Select/Autocomplete abertos tratam o próprio
  // Enter/Esc e marcam `defaultPrevented`, então não interceptamos de novo por cima
  // deles.
  function handleEditKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      cancelEdit();
      return;
    }
    if (event.key !== "Enter") return;
    if ((event.target as HTMLElement).tagName === "TEXTAREA") return;
    if (!canCommitEdit) return;
    event.preventDefault();
    commitEdit();
  }

  // ─── Status (ativo/inativo) ──────────────────────────────────────────────
  // Reativar não precisa de confirmação (nada a explicar); desativar sim — mesmo
  // texto e largura (`confirm`, 420px) do resto da família (item 10 do pacote).

  function applyToggleActive(inst: Institution, nextActive: boolean) {
    startTransition(async () => {
      const nextStatus = nextActive ? "active" : "inactive";
      const result = await updateInstitutionAction(
        accountId,
        buildUpdatePayload(inst, { status: nextStatus }),
      );
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setInstitutions((prev) =>
        prev.map((i) => (i.id === inst.id ? { ...i, status: nextStatus } : i)),
      );
      enqueueSnackbar(m.settings.institutions.updated, { variant: "success" });
    });
  }

  function requestToggleActive(inst: Institution, nextActive: boolean) {
    if (nextActive) {
      applyToggleActive(inst, true);
    } else {
      setDeactivateTarget(inst);
    }
  }

  function confirmDeactivate() {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    setDeactivateTarget(null);
    applyToggleActive(target, false);
  }

  // ─── Exclusão — M2 (Spec 68 §2.6) ─────────────────────────────────────────
  //
  // Sem action de "excluir realocando": mesclar já move tudo (transações, apelidos,
  // itens de modelo, de-para, widgets) numa transação só, com auditoria — reusar em
  // vez de duplicar. Sem destino escolhido, a exclusão simples serve (FKs de
  // `Transaction` viram `null`, "sem instituição" explícito).

  async function handleDeleteConfirm(reallocateToId: string | null) {
    if (!deleteTarget) return;
    const target = deleteTarget;

    const result = reallocateToId
      ? await mergeEntityAction(accountId, {
          entity: "institution",
          absorbedId: target.id,
          keptId: reallocateToId,
        })
      : await deleteInstitutionAction(accountId, { institutionId: target.id });

    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      throw new Error(result.error.message);
    }
    setInstitutions((prev) => prev.filter((i) => i.id !== target.id));
    setDeleteTarget(null);
    enqueueSnackbar(m.settings.structureDialogs.remove.success, { variant: "success" });
  }

  const institutionsTableHead = (
    <>
      <SettingsHeadCell>{t.columnName}</SettingsHeadCell>
      <SettingsHeadCell>{t.columnKind}</SettingsHeadCell>
      <SettingsHeadCell>{t.columnDetails}</SettingsHeadCell>
      <SettingsHeadCell>{t.columnStatus}</SettingsHeadCell>
      <SettingsHeadCell />
    </>
  );

  // Linha-fantasma — referenciada nos DOIS ramos (lista vazia / preenchida) do
  // `SettingsTable` abaixo. Precisa viver DENTRO do `<tbody>` da tabela (é um
  // `<TableRow>` de verdade): fora dela vira um `<tr>` filho de `<div>`, HTML
  // inválido que diverge do SSR (hydration error).
  const ghostRow = (
    <SettingsGhostRow
      ref={ghostRef}
      label={t.addRow}
      editing={creatingName !== null}
      canCommit={(creatingName ?? "").trim().length > 0}
      onStartEditing={startCreating}
      onCancel={cancelCreating}
      onCommit={commitCreate}
      columnCount={INSTITUTION_TABLE_COLUMNS.length}
    >
      <SettingsCell>
        <SettingsRowField
          placeholder={m.settings.institutions.nameLabel}
          value={creatingName ?? ""}
          onChange={(e) => setCreatingName(e.target.value)}
          inputProps={{ "aria-label": m.settings.institutions.nameLabel }}
        />
      </SettingsCell>
      <SettingsCell>
        <SettingsSelect
          fullWidth
          value={creatingKind ?? ""}
          onChange={(event) => {
            const raw = event.target.value;
            setCreatingKind(raw === "" ? null : (raw as InstitutionKindValue));
          }}
          emptyLabel={t.kindUnsetOption}
          options={KIND_OPTIONS}
          inputProps={{ "aria-label": t.columnKind }}
        />
      </SettingsCell>
      {/* Detalhes e Status não se editam na criação — células mudas, só para as
          colunas seguintes não desalinharem com o cabeçalho. */}
      <SettingsCell />
      <SettingsCell />
    </SettingsGhostRow>
  );

  return (
    <SettingsPageShell
      family="Estrutura"
      title={m.settings.nav.institutions}
      count={String(institutions.length)}
      purpose={m.settings.purposes.institutions}
      // Sem toolbar nesta página (§2.3 — arquétipo A, lista curta): `itemCount` só
      // documenta o total para o shell, sem alimentar controle nenhum (não passamos
      // `toolbar`, então o gate dos 12 não tem o que exibir mesmo se a lista crescer).
      itemCount={institutions.length}
      // A tabela ocupa o painel inteiro, como no frame — o cap de leitura fica só
      // para os formulários (Spec 68, revisão de estilo).
      wideContent
      primaryAction={{
        label: m.settings.institutions.createButton,
        icon: <AddIcon />,
        // A ação primária do cabeçalho NUNCA abre modal (item 6 do pacote): ela só
        // rola até a linha-fantasma e foca o campo de nome — igual clicar na linha.
        onClick: () => {
          startCreating();
          ghostRef.current?.focus();
        },
      }}
    >
      {institutions.length === 0 && (
        // `SettingsEmptyState` e não um `Typography` solto: as outras três páginas da
        // família usam o componente, e estado vazio customizado é anti-padrão do
        // design system. Sem ele esta era a única lista da família sem ícone nem
        // hierarquia no vazio.
        <SettingsEmptyState
          icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />}
          title={t.emptyTitle}
          description={t.emptyDescription}
        />
      )}

      <SettingsTable
        ariaLabel={m.settings.nav.institutions}
        columns={INSTITUTION_TABLE_COLUMNS}
        head={institutionsTableHead}
      >
        {institutions.map((inst) => {
          const active = resolveActive({ kind: "status", status: inst.status });
          const isEditing = editingId === inst.id;

          if (isEditing && draft) {
            return (
              <SettingsRow key={inst.id} editing onKeyDown={handleEditKeyDown}>
                <SettingsCell>
                  <Stack direction="row" spacing={layout.inline} alignItems="center">
                    <InstitutionMonogram name={draft.name || inst.name} />
                    <SettingsRowField
                      autoFocus
                      value={draft.name}
                      onChange={(e) => {
                        setNameError(false);
                        updateDraft({ name: e.target.value });
                      }}
                      error={nameError}
                      inputProps={{ "aria-label": `${t.columnName}: ${inst.name}` }}
                    />
                  </Stack>
                </SettingsCell>
                <SettingsCell>
                  <SettingsSelect
                    fullWidth
                    value={draft.kind ?? ""}
                    onChange={handleKindChange}
                    emptyLabel={t.kindUnsetOption}
                    options={KIND_OPTIONS}
                    inputProps={{ "aria-label": `${t.columnKind}: ${inst.name}` }}
                  />
                </SettingsCell>
                <SettingsCell>
                  <InstitutionDetailsFields
                    mode="edit"
                    kind={draft.kind}
                    values={draft}
                    onChange={updateDraft}
                  />
                </SettingsCell>
                <SettingsCell>
                  {/* Desabilitado durante a edição: evita disparar uma segunda
                      mutação na mesma linha enquanto nome/tipo/detalhes ainda
                      não foram confirmados. */}
                  <StatusCell
                    active={active}
                    lastUsedAt={inst.lastUsedAt}
                    gender="f"
                    name={inst.name}
                    disabled
                    onToggle={() => undefined}
                  />
                </SettingsCell>
                <SettingsMenuCell>
                  <SettingsEditActions
                    onCancel={cancelEdit}
                    onCommit={commitEdit}
                    canCommit={canCommitEdit && !isPending}
                    name={inst.name}
                  />
                </SettingsMenuCell>
              </SettingsRow>
            );
          }

          return (
            <SettingsRow key={inst.id} hover sx={{ opacity: active ? 1 : 0.6 }}>
              <SettingsCell>
                <Stack direction="row" spacing={layout.inline} alignItems="center">
                  <InstitutionMonogram name={inst.name} />
                  <Typography variant="body2" fontWeight={500} noWrap>
                    {inst.name}
                  </Typography>
                </Stack>
              </SettingsCell>
              <SettingsCell>
                <Typography variant="body2" color="text.secondary">
                  {inst.kind ? t.kindLabels[inst.kind] : t.kindUnset}
                </Typography>
              </SettingsCell>
              <SettingsCell>
                <InstitutionDetailsFields mode="read" kind={inst.kind} values={inst} />
              </SettingsCell>
              <SettingsCell>
                <StatusCell
                  active={active}
                  lastUsedAt={inst.lastUsedAt}
                  gender="f"
                  name={inst.name}
                  disabled={isPending}
                  onToggle={(next) => requestToggleActive(inst, next)}
                />
              </SettingsCell>
              <SettingsMenuCell>
                <RowActionsMenu
                  name={inst.name}
                  active={active}
                  actions={{
                    edit: () => startEdit(inst),
                    toggleActive: () => requestToggleActive(inst, !active),
                    viewUsage: () => setUsageTarget(inst),
                    merge: () => setMergeTarget(inst),
                    delete: () => setDeleteTarget(inst),
                  }}
                />
              </SettingsMenuCell>
            </SettingsRow>
          );
        })}
        {ghostRow}
      </SettingsTable>

      {creatingName !== null && (
        <Typography
          variant="caption"
          sx={{ display: "block", color: "text.disabled", mt: layout.micro, px: layout.inline }}
        >
          {settingsGhostHint()}
        </Typography>
      )}

      <Typography
        variant="caption"
        color="text.tertiary"
        sx={{ display: "block", mt: layout.stack }}
      >
        {t.footnote}
      </Typography>

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

      {/* Excluir — M2 (Spec 68 §2.6): realocação obrigatória enquanto houver
          referência; "sem instituição" é uma opção explícita na própria lista. */}
      <DeleteWithReallocationDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        accountId={accountId}
        entity="institution"
        target={{ id: deleteTarget?.id ?? "", name: deleteTarget?.name ?? "" }}
        options={institutions
          .filter((i) => i.id !== deleteTarget?.id)
          .map((i) => ({ id: i.id, name: i.name }))}
        onConfirm={handleDeleteConfirm}
      />

      {/* Ver uso (M3) — sem `transactionsHref`: não há rota de "todas as
          transações" filtrável fora de um mês específico (ver relatório da task). */}
      <UsageDialog
        open={!!usageTarget}
        onClose={() => setUsageTarget(null)}
        accountId={accountId}
        entity="institution"
        entityId={usageTarget?.id ?? ""}
        entityName={usageTarget?.name ?? ""}
      />

      {/* Mesclar (M5) */}
      <MergeDialog
        open={!!mergeTarget}
        onClose={() => setMergeTarget(null)}
        accountId={accountId}
        entity="institution"
        options={institutions.map((i) => ({ id: i.id, name: i.name }))}
        initialAbsorbedId={mergeTarget?.id}
        onMerged={({ absorbedId }) => {
          setInstitutions((prev) => prev.filter((i) => i.id !== absorbedId));
        }}
      />
    </SettingsPageShell>
  );
}
