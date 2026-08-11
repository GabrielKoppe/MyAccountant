"use client";

import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TableCell from "@mui/material/TableCell";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useMemo, useRef, useState, useTransition } from "react";

import {
  archiveResponsiblePartyAction,
  createResponsiblePartyAction,
  deleteResponsiblePartyAction,
  updateResponsiblePartyAction,
} from "@/actions/responsible-parties";
import { mergeEntityAction } from "@/actions/settings-merge";
import { DeleteWithReallocationDialog } from "@/components/settings/DeleteWithReallocationDialog";
import { MergeDialog } from "@/components/settings/MergeDialog";
import { PersonaStyleFields } from "@/components/settings/PersonaStyleFields";
import { RowActionsMenu, type RowAction } from "@/components/settings/RowActionsMenu";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { StatusCell } from "@/components/settings/StatusCell";
import { SETTINGS_CELL_PADDING, SETTINGS_MENU_WIDTH } from "@/components/settings/table/settings-table-tokens";
import {
  SettingsGhostAddIcon,
  SettingsGhostRow,
  type SettingsGhostRowHandle,
} from "@/components/settings/table/SettingsGhostRow";
import { SettingsEditActions, SettingsRowField } from "@/components/settings/table/SettingsRowField";
import {
  SettingsCell,
  SettingsHeadCell,
  SettingsMenuCell,
  SettingsRow,
  SettingsTable,
} from "@/components/settings/table/SettingsTable";
import { UsageDialog } from "@/components/settings/UsageDialog";
import { PartyAvatar } from "@/components/transactions/PartyAvatar";
import type { AccentColorKey } from "@/lib/accent-colors";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { PersonaIconKey } from "@/lib/persona-icons";

import { SettingsFieldLabel } from "../SettingsFieldLabel";

import { PartyMembersCell, type AvailableMember, type LinkedMember } from "./PartyMembersCell";

type PartyKind = "personal" | "group" | "external";

type Party = {
  id: string;
  name: string;
  kind: PartyKind;
  icon: string | null;
  color: string | null;
  /** Já normalizado por `resolveActive` em page.tsx (Spec 68 §7.1) — nunca leia `archivedAt` aqui. */
  active: boolean;
  lastUsedAt: string | null;
  memberUserIds: string[];
  transactionCount: number;
  imageUrl: string | null;
};

type MemberOption = { userId: string; label: string };

type Props = {
  accountId: string;
  initialParties: Party[];
  members: MemberOption[];
};

// Mensagens legadas de CRUD (rótulos do form, toasts) — a Spec 68 não as duplicou;
// o bloco `st` abaixo cobre o que a família Estrutura acrescentou.
const rp = m.settings.responsibleParties;
// Spec 68 §7 — colunas da tabela, célula de membros, "nenhum — só rótulo", rodapé.
const st = m.settings.structure.responsibles;

// Arquétipo A (sem alça de arraste — Responsáveis não reordena) e, por isso, SEM
// coluna de alça: reservar uma célula vazia só para o "+" da criação empurrava o
// avatar e o nome 24px para dentro, e o nome deixava de ficar sob o rótulo "NOME".
// A linha-fantasma recebe `gripColumn={false}` e desenha o "+" na própria célula do
// nome.
const TABLE_COLUMNS = [undefined, 220, 130, SETTINGS_MENU_WIDTH] as const;

export function ResponsiblePartiesManager({ accountId, initialParties, members }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [parties, setParties] = useState(initialParties);
  const [isPending, startTransition] = useTransition();

  // Linha-fantasma (Spec 68 §2.4 regra 5): único caminho de criação. "Tudo é
  // responsável" — nasce sempre `group`, sem membro (vincular vem depois, pelo "+"
  // da célula ou pelo diálogo de estilo).
  const ghostRef = useRef<SettingsGhostRowHandle>(null);
  const [ghostEditing, setGhostEditing] = useState(false);
  const [ghostName, setGhostName] = useState("");

  // Edição inline do NOME de uma linha já existente — no máximo uma por vez.
  // `personal` nunca entra aqui (nome vem do cadastro do usuário, não é renomeável).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  // Diálogo de estilo (ícone, cor e — fora do `personal` — membros). Só EDITA: a
  // criação é 100% pela linha-fantasma, nunca abre este diálogo vazio.
  const [styleTarget, setStyleTarget] = useState<Party | null>(null);
  const [iconKey, setIconKey] = useState<PersonaIconKey | null>(null);
  const [colorKey, setColorKey] = useState<AccentColorKey | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<Party | null>(null);
  // M8 (§2.6 / bullet 8): desativar pede confirmação; reativar é instantâneo.
  const [deactivateTarget, setDeactivateTarget] = useState<Party | null>(null);
  // M3 · Ver uso / M5 · Mesclar (Spec 68 §2.5/§2.6 — pacote P8).
  const [usageTarget, setUsageTarget] = useState<Party | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Party | null>(null);

  const memberLabelById = useMemo(
    () => new Map(members.map((mm) => [mm.userId, mm.label])),
    [members],
  );

  // Cor/foto de cada membro vêm do responsável PESSOAL dele — a mesma identidade
  // usada no resto da app (seletor de transação, etc.). Dado já carregado em
  // `parties`; nenhuma query nova para pintar a célula de membros vinculados.
  const personalStyleByUserId = useMemo(() => {
    const map = new Map<string, { color: string | null; imageUrl: string | null }>();
    for (const p of parties) {
      if (p.kind === "personal" && p.memberUserIds.length === 1) {
        map.set(p.memberUserIds[0], { color: p.color, imageUrl: p.imageUrl });
      }
    }
    return map;
  }, [parties]);

  // "Mesclar" e a realocação de exclusão (M2) ficam entre responsáveis GERIDOS: o
  // `personal` automático não é um destino nem uma origem válida (não pode ser
  // excluído nem perder membro pela mão do usuário).
  const mergeable = parties.filter((p) => p.kind !== "personal");
  const activeCount = parties.filter((p) => p.active).length;

  function openStyleDialog(party: Party) {
    setStyleTarget(party);
    setIconKey((party.icon as PersonaIconKey | null) ?? null);
    setColorKey((party.color as AccentColorKey | null) ?? null);
    setSelectedMembers(party.memberUserIds);
  }

  function closeStyleDialog() {
    setStyleTarget(null);
  }

  function toggleMember(userId: string) {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function handleStyleSave() {
    if (!styleTarget) return;
    const target = styleTarget;
    const icon = iconKey;
    const color = colorKey;

    startTransition(async () => {
      const result = await updateResponsiblePartyAction(accountId, {
        partyId: target.id,
        icon,
        color,
        // `personal` não aceita vínculo manual (guard no service) — nem tenta enviar.
        ...(target.kind !== "personal" ? { memberUserIds: selectedMembers } : {}),
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setParties((prev) =>
        prev.map((p) =>
          p.id === target.id
            ? {
                ...p,
                icon,
                color,
                memberUserIds: p.kind !== "personal" ? selectedMembers : p.memberUserIds,
              }
            : p,
        ),
      );
      enqueueSnackbar(rp.updated, { variant: "success" });
      closeStyleDialog();
    });
  }

  function handleGhostCommit() {
    const name = ghostName.trim();
    if (!name) return;
    startTransition(async () => {
      // "Tudo é responsável" — nasce sempre `group`, sem membro: 0 membros é o
      // caminho que hoje nomeia alguém externo; vincular vem depois.
      const result = await createResponsiblePartyAction(accountId, {
        name,
        icon: null,
        color: null,
        memberUserIds: [],
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setParties((prev) => [
        ...prev,
        {
          id: result.data.id,
          name,
          kind: "group",
          icon: null,
          color: null,
          active: true,
          lastUsedAt: null,
          memberUserIds: [],
          transactionCount: 0,
          imageUrl: null,
        },
      ]);
      enqueueSnackbar(rp.created, { variant: "success" });
      // Enter cria e abre a próxima (Spec 68 §7.2) — a linha continua editável.
      setGhostName("");
    });
  }

  function startInlineEdit(party: Party) {
    setEditingId(party.id);
    setNameDraft(party.name);
  }

  function cancelInlineEdit() {
    setEditingId(null);
    setNameDraft("");
  }

  function commitInlineEdit(party: Party) {
    const name = nameDraft.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await updateResponsiblePartyAction(accountId, { partyId: party.id, name });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setParties((prev) => prev.map((p) => (p.id === party.id ? { ...p, name } : p)));
      enqueueSnackbar(rp.updated, { variant: "success" });
      cancelInlineEdit();
    });
  }

  function handleLinkMember(party: Party, userId: string) {
    const nextMemberIds = [...party.memberUserIds, userId];
    startTransition(async () => {
      const result = await updateResponsiblePartyAction(accountId, {
        partyId: party.id,
        memberUserIds: nextMemberIds,
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setParties((prev) =>
        prev.map((p) => (p.id === party.id ? { ...p, memberUserIds: nextMemberIds } : p)),
      );
    });
  }

  function runArchive(party: Party, archived: boolean) {
    startTransition(async () => {
      const result = await archiveResponsiblePartyAction(accountId, {
        partyId: party.id,
        archived,
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setParties((prev) => prev.map((p) => (p.id === party.id ? { ...p, active: !archived } : p)));
      enqueueSnackbar(archived ? rp.archived : rp.unarchived, { variant: "success" });
    });
  }

  // Desativar pede confirmação (M8); reativar é instantâneo — mesma assimetria do
  // resto das listas de Configurações (§2.6). Vale para QUALQUER kind: nada aqui
  // distingue `personal` — o Switch da coluna Status é o mesmo para todo mundo.
  function handleStatusToggle(party: Party, nextActive: boolean) {
    if (!nextActive) {
      setDeactivateTarget(party);
      return;
    }
    runArchive(party, false);
  }

  function confirmDeactivate() {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    setDeactivateTarget(null);
    runArchive(target, true);
  }

  // M2 (Spec 68 §2.6) — sem action de "excluir realocando": mesclar já move tudo
  // (transações, apelidos, itens de modelo, de-para, widgets, default da conta)
  // numa transação só, com auditoria. Sem destino, a exclusão simples serve.
  async function handleDeleteConfirm(reallocateToId: string | null) {
    if (!deleteTarget) return;
    const target = deleteTarget;

    const result = reallocateToId
      ? await mergeEntityAction(accountId, {
          entity: "responsibleParty",
          absorbedId: target.id,
          keptId: reallocateToId,
        })
      : await deleteResponsiblePartyAction(accountId, { partyId: target.id });

    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      throw new Error(result.error.message);
    }
    setParties((prev) => prev.filter((p) => p.id !== target.id));
    setDeleteTarget(null);
    enqueueSnackbar(m.settings.structureDialogs.remove.success, { variant: "success" });
  }

  // Ordem canônica do `RowActionsMenu` decide a exibição; aqui só filtramos QUAIS
  // ações se aplicam. `personal`: nada de Ver uso / Mesclar / Excluir (automático,
  // não pode virar origem nem sumir da conta) — mas Editar (ícone/cor, via diálogo)
  // e Ativar/Desativar continuam, iguais aos de qualquer outra linha.
  function actionsFor(party: Party): Partial<Record<RowAction, () => void>> {
    const common: Partial<Record<RowAction, () => void>> = {
      edit: () => openStyleDialog(party),
      toggleActive: () => handleStatusToggle(party, !party.active),
    };
    if (party.kind === "personal") return common;
    return {
      ...common,
      viewUsage: () => setUsageTarget(party),
      merge: () => setMergeTarget(party),
      delete: () => setDeleteTarget(party),
    };
  }

  return (
    <SettingsPageShell
      family="Estrutura"
      title={m.settings.nav.responsibles}
      count={String(activeCount)}
      purpose={m.settings.purposes.responsibles}
      // A primária não abre modal (regra 5): ela leva o foco até a linha-fantasma,
      // com o mesmo efeito de clicar nela.
      primaryAction={{
        label: st.addRow,
        icon: <AddIcon />,
        onClick: () => {
          setGhostEditing(true);
          ghostRef.current?.focus();
        },
      }}
      // Só alimenta o gate de toolbar do shell (>12). Sem toolbar aqui: a lista de
      // responsáveis é curta por natureza (§2.4 regra "Sem toolbar (4 itens)").
      itemCount={parties.length}
      // A tabela ocupa o painel inteiro, como no frame — sem o cap de leitura dos
      // formulários (Spec 68, revisão de estilo).
      wideContent
    >
      <SettingsTable
        ariaLabel={m.settings.nav.responsibles}
        columns={[...TABLE_COLUMNS]}
        head={
          <>
            <SettingsHeadCell>{st.columnName}</SettingsHeadCell>
            <SettingsHeadCell>{st.columnMembers}</SettingsHeadCell>
            <SettingsHeadCell>{st.columnStatus}</SettingsHeadCell>
            <SettingsHeadCell />
          </>
        }
      >
        {parties.map((party) => {
          const isEditingName = editingId === party.id;
          const linkedMembers: LinkedMember[] = party.memberUserIds.map((userId) => ({
            userId,
            label: memberLabelById.get(userId) ?? "—",
            color: personalStyleByUserId.get(userId)?.color ?? null,
            imageUrl: personalStyleByUserId.get(userId)?.imageUrl ?? null,
          }));
          const availableMembers: AvailableMember[] = members.filter(
            (mm) => !party.memberUserIds.includes(mm.userId),
          );

          return (
            // SET-07: linha inativa renderiza com opacidade reduzida — o StatusCell
            // só pinta a própria célula (ver doc do componente).
            <SettingsRow
              key={party.id}
              hover={!isEditingName}
              editing={isEditingName}
              sx={{ opacity: party.active ? 1 : 0.6 }}
            >
              <SettingsCell>
                {isEditingName ? (
                  <SettingsRowField
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    disabled={isPending}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitInlineEdit(party);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelInlineEdit();
                      }
                    }}
                  />
                ) : (
                  <Stack direction="row" spacing={layout.inline} alignItems="center" sx={{ minWidth: 0 }}>
                    {/* Clicar no avatar abre o diálogo de ícone/cor/membros — o mesmo
                        gesto para QUALQUER kind, inclusive `personal`. */}
                    <Tooltip title={st.personalizeFor(party.name)}>
                      <ButtonBase
                        onClick={() => openStyleDialog(party)}
                        aria-label={st.personalizeFor(party.name)}
                        sx={{ borderRadius: "50%", flexShrink: 0 }}
                      >
                        <PartyAvatar
                          kind={party.kind}
                          icon={party.icon}
                          color={party.color}
                          imageUrl={party.imageUrl}
                          name={party.name}
                          size={28}
                        />
                      </ButtonBase>
                    </Tooltip>
                    {party.kind === "personal" ? (
                      // Nome vem do cadastro do usuário — não é renomeável por aqui.
                      <Typography variant="body2" fontWeight="medium" noWrap>
                        {party.name}
                      </Typography>
                    ) : (
                      // Clicar no NOME entra em edição inline (`SettingsRow editing` +
                      // `SettingsEditActions`) — sem abrir modal só para renomear.
                      <ButtonBase
                        onClick={() => startInlineEdit(party)}
                        aria-label={`${m.common.edit}: ${party.name}`}
                        sx={{
                          minWidth: 0,
                          justifyContent: "flex-start",
                          borderRadius: 1,
                          px: 0.5,
                          mx: -0.5,
                        }}
                      >
                        <Typography variant="body2" fontWeight="medium" noWrap>
                          {party.name}
                        </Typography>
                      </ButtonBase>
                    )}
                  </Stack>
                )}
              </SettingsCell>
              <SettingsCell>
                <PartyMembersCell
                  partyName={party.name}
                  members={linkedMembers}
                  availableMembers={availableMembers}
                  onLink={(userId) => handleLinkMember(party, userId)}
                  disabled={isPending}
                  locked={party.kind === "personal"}
                />
              </SettingsCell>
              <SettingsCell>
                <StatusCell
                  active={party.active}
                  lastUsedAt={party.lastUsedAt}
                  gender="m"
                  name={party.name}
                  disabled={isPending}
                  onToggle={(next) => handleStatusToggle(party, next)}
                />
              </SettingsCell>
              <SettingsMenuCell>
                {isEditingName ? (
                  <SettingsEditActions
                    onCancel={cancelInlineEdit}
                    onCommit={() => commitInlineEdit(party)}
                    canCommit={nameDraft.trim().length > 0}
                    name={party.name}
                  />
                ) : (
                  <RowActionsMenu name={party.name} active={party.active} actions={actionsFor(party)} />
                )}
              </SettingsMenuCell>
            </SettingsRow>
          );
        })}

        <SettingsGhostRow
          ref={ghostRef}
          label={st.addRow}
          editing={ghostEditing}
          onStartEditing={() => setGhostEditing(true)}
          onCancel={() => {
            setGhostEditing(false);
            setGhostName("");
          }}
          onCommit={handleGhostCommit}
          canCommit={ghostName.trim().length > 0}
          columnCount={TABLE_COLUMNS.length}
          name={ghostName || st.addRow}
          gripColumn={false}
        >
          <TableCell
            sx={{
              px: SETTINGS_CELL_PADDING.x,
              py: SETTINGS_CELL_PADDING.y,
              // A marcação de "linha em criação" vem para cá junto com o "+", já que
              // não há coluna de alça para carregá-la.
              borderLeftWidth: "2px",
              borderLeftStyle: "solid",
              borderLeftColor: "accent.primary",
            }}
          >
            <Stack direction="row" spacing={layout.inline} alignItems="center">
              <SettingsGhostAddIcon />
              <SettingsRowField
                placeholder={rp.nameLabel}
                value={ghostName}
                onChange={(e) => setGhostName(e.target.value)}
                disabled={isPending}
              />
            </Stack>
          </TableCell>
          {/* Membros e Status não fazem parte da criação rápida — vincular e
              desativar acontecem depois, na linha já criada. */}
          <TableCell sx={{ px: SETTINGS_CELL_PADDING.x, py: SETTINGS_CELL_PADDING.y }} />
          <TableCell sx={{ px: SETTINGS_CELL_PADDING.x, py: SETTINGS_CELL_PADDING.y }} />
        </SettingsGhostRow>
      </SettingsTable>

      {ghostEditing && (
        <Typography variant="caption" color="text.tertiary" sx={{ display: "block", mt: layout.micro, px: layout.inline }}>
          {m.settings.structure.ghostHint}
        </Typography>
      )}
      <Typography
        variant="caption"
        color="text.tertiary"
        sx={{ display: "block", mt: layout.stack, pb: layout.stack, px: layout.inline }}
      >
        {st.footnote}
      </Typography>

      {/* Ícone, cor e — fora do `personal` — membros. Nunca cria (a criação é 100%
          pela linha-fantasma); só edita um responsável existente. */}
      <SettingsDialog
        open={!!styleTarget}
        onClose={closeStyleDialog}
        size="form"
        titleIcon={<EditOutlinedIcon />}
        title={styleTarget ? `${m.common.edit} · ${styleTarget.name}` : ""}
        // Os outros diálogos da família abrem com uma linha de propósito sob o
        // título; sem ela este parecia um formulário solto.
        description={rp.styleDialogDescription}
        loading={isPending}
        actions={
          <>
            <Button size="small" onClick={closeStyleDialog}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleStyleSave}
              endIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {m.common.save}
            </Button>
          </>
        }
      >
        <Stack spacing={layout.stack}>
          <PersonaStyleFields
            icon={iconKey}
            color={colorKey}
            onIconChange={setIconKey}
            onColorChange={setColorKey}
          />
          {styleTarget && styleTarget.kind !== "personal" && (
            <Box>
              <SettingsFieldLabel>{rp.membersLabel}</SettingsFieldLabel>
              {/* Spec 68 D4 — o vínculo é 0..N. A dica diz o que acontece quando
                  ninguém é marcado, em vez de exigir um mínimo que não existe mais. */}
              <Typography
                variant="caption"
                color="text.tertiary"
                component="div"
                sx={{ mb: layout.inline }}
              >
                {rp.membersHint}
              </Typography>
              <Stack>
                {members.map((mm) => (
                  <FormControlLabel
                    key={mm.userId}
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedMembers.includes(mm.userId)}
                        onChange={() => toggleMember(mm.userId)}
                      />
                    }
                    label={<Typography variant="body2">{mm.label}</Typography>}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </SettingsDialog>

      {/* Excluir — M2 (Spec 68 §2.6): realocação obrigatória enquanto houver
          referência; "sem responsável" é uma opção explícita na própria lista.
          `personal` fica fora das opções de destino (não pode ser mesclado). */}
      <DeleteWithReallocationDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        accountId={accountId}
        entity="responsibleParty"
        target={{ id: deleteTarget?.id ?? "", name: deleteTarget?.name ?? "" }}
        options={mergeable
          .filter((p) => p.id !== deleteTarget?.id)
          .map((p) => ({ id: p.id, name: p.name, colorKey: p.color }))}
        onConfirm={handleDeleteConfirm}
      />

      {/* Ver uso (M3) — sem `transactionsHref`: não há rota de "todas as
          transações" filtrável fora de um mês específico (ver relatório da task). */}
      <UsageDialog
        open={!!usageTarget}
        onClose={() => setUsageTarget(null)}
        accountId={accountId}
        entity="responsibleParty"
        entityId={usageTarget?.id ?? ""}
        entityName={usageTarget?.name ?? ""}
      />

      {/* Mesclar (M5) — só entre responsáveis GERIDOS; o "pessoal" automático fica
          de fora (nem tem essas ações no menu da linha). */}
      <MergeDialog
        open={!!mergeTarget}
        onClose={() => setMergeTarget(null)}
        accountId={accountId}
        entity="responsibleParty"
        options={mergeable.map((p) => ({ id: p.id, name: p.name, colorKey: p.color }))}
        initialAbsorbedId={mergeTarget?.id}
        onMerged={({ absorbedId }) => {
          setParties((prev) => prev.filter((p) => p.id !== absorbedId));
        }}
      />

      {/* Desativar (M8) — vale para qualquer kind, inclusive `personal`. */}
      <SettingsDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        size="confirm"
        titleIcon={<VisibilityOffOutlinedIcon />}
        tone="warning"
        title={deactivateTarget ? st.deactivateTitle(deactivateTarget.name) : ""}
        description={st.deactivateBody}
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
    </SettingsPageShell>
  );
}
