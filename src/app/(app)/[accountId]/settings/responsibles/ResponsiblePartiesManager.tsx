"use client";

import { useMemo, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ArchiveIcon from "@mui/icons-material/Archive";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import { useSnackbar } from "notistack";

import {
  archiveResponsiblePartyAction,
  createResponsiblePartyAction,
  deleteResponsiblePartyAction,
  updateResponsiblePartyAction,
} from "@/actions/responsible-parties";
import { DialogShell } from "@/components/ui/DialogShell";
import { EmptyState } from "@/components/ui/EmptyState";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";
import { PersonaStyleFields } from "@/components/settings/PersonaStyleFields";
import { PartyAvatar } from "@/components/transactions/PartyAvatar";
import type { PersonaIconKey } from "@/lib/persona-icons";
import type { AccentColorKey } from "@/lib/accent-colors";
import { m } from "@/lib/messages";

type PartyKind = "personal" | "group" | "external";

type Party = {
  id: string;
  name: string;
  kind: PartyKind;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
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

const rp = m.settings.responsibleParties;

function kindLabel(kind: PartyKind): string {
  if (kind === "group") return rp.kindGroup;
  if (kind === "external") return rp.kindExternal;
  return rp.kindPersonal;
}

export function ResponsiblePartiesManager({ accountId, initialParties, members }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [parties, setParties] = useState(initialParties);
  const [isPending, startTransition] = useTransition();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Party | null>(null);
  const [formKind, setFormKind] = useState<"group" | "external">("group");
  const [nameInput, setNameInput] = useState("");
  const [iconKey, setIconKey] = useState<PersonaIconKey | null>(null);
  const [colorKey, setColorKey] = useState<AccentColorKey | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [nameError, setNameError] = useState("");
  const [membersError, setMembersError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Party | null>(null);

  const memberLabelById = useMemo(
    () => new Map(members.map((mm) => [mm.userId, mm.label])),
    [members],
  );

  function resetForm() {
    setNameInput("");
    setIconKey(null);
    setColorKey(null);
    setSelectedMembers([]);
    setNameError("");
    setMembersError("");
  }

  function openCreate(kind: "group" | "external") {
    resetForm();
    setEditTarget(null);
    setFormKind(kind);
    setDialogOpen(true);
  }

  function openEdit(party: Party) {
    setEditTarget(party);
    setFormKind(party.kind === "external" ? "external" : "group");
    setNameInput(party.name);
    setIconKey((party.icon as PersonaIconKey | null) ?? null);
    setColorKey((party.color as AccentColorKey | null) ?? null);
    setSelectedMembers(party.memberUserIds);
    setNameError("");
    setMembersError("");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditTarget(null);
    resetForm();
  }

  function toggleMember(userId: string) {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function validate(isGroup: boolean): boolean {
    let ok = true;
    if (!nameInput.trim()) {
      setNameError("Nome obrigatório");
      ok = false;
    }
    if (isGroup && !editTarget?.kind && selectedMembers.length < 2) {
      // criação de grupo exige >= 2
      setMembersError(rp.membersHint);
      ok = false;
    }
    if (isGroup && editTarget?.kind === "group" && selectedMembers.length < 2) {
      setMembersError(rp.membersHint);
      ok = false;
    }
    return ok;
  }

  function handleSave() {
    const isPersonal = editTarget?.kind === "personal";
    const isGroup = !isPersonal && formKind === "group";
    setNameError("");
    setMembersError("");
    if (!validate(isGroup)) return;

    const icon = iconKey;
    const color = colorKey;
    const name = nameInput.trim();

    startTransition(async () => {
      if (editTarget) {
        const result = await updateResponsiblePartyAction(accountId, {
          partyId: editTarget.id,
          name,
          icon,
          color,
          ...(editTarget.kind === "group" ? { memberUserIds: selectedMembers } : {}),
        });
        if (!result.ok) {
          enqueueSnackbar(result.error.message, { variant: "error" });
          return;
        }
        setParties((prev) =>
          prev.map((p) =>
            p.id === editTarget.id
              ? {
                  ...p,
                  name,
                  icon,
                  color,
                  memberUserIds: p.kind === "group" ? selectedMembers : p.memberUserIds,
                }
              : p,
          ),
        );
        enqueueSnackbar(rp.updated, { variant: "success" });
      } else {
        const input = isGroup
          ? { kind: "group" as const, name, icon, color, memberUserIds: selectedMembers }
          : { kind: "external" as const, name, icon, color };
        const result = await createResponsiblePartyAction(accountId, input);
        if (!result.ok) {
          enqueueSnackbar(result.error.message, { variant: "error" });
          return;
        }
        setParties((prev) => [
          ...prev,
          {
            id: result.data.id,
            name,
            kind: isGroup ? "group" : "external",
            icon,
            color,
            isArchived: false,
            memberUserIds: isGroup ? selectedMembers : [],
            transactionCount: 0,
            imageUrl: null,
          },
        ]);
        enqueueSnackbar(rp.created, { variant: "success" });
      }
      closeDialog();
    });
  }

  function handleArchive(party: Party) {
    startTransition(async () => {
      const result = await archiveResponsiblePartyAction(accountId, {
        partyId: party.id,
        archived: !party.isArchived,
      });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setParties((prev) =>
        prev.map((p) => (p.id === party.id ? { ...p, isArchived: !p.isArchived } : p)),
      );
      enqueueSnackbar(party.isArchived ? rp.unarchived : rp.archived, { variant: "success" });
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteResponsiblePartyAction(accountId, { partyId: target.id });
      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }
      setParties((prev) => prev.filter((p) => p.id !== target.id));
      enqueueSnackbar(rp.deleted, { variant: "success" });
    });
  }

  const managed = parties.filter((p) => p.kind !== "personal");
  const personal = parties.filter((p) => p.kind === "personal");
  const isGroupForm = editTarget ? editTarget.kind === "group" : formKind === "group";

  return (
    <PageSettingsContainer
      title={rp.title}
      secondary={
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => openCreate("external")}
          >
            {rp.createExternal}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => openCreate("group")}
          >
            {rp.createGroup}
          </Button>
        </Stack>
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {rp.subtitle}
      </Typography>

      {managed.length === 0 ? (
        <EmptyState title={rp.empty} />
      ) : (
        <Stack spacing={1}>
          {managed.map((party) => (
            <Paper key={party.id} variant="outlined" sx={{ px: 2, py: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <PartyAvatar
                  kind={party.kind}
                  icon={party.icon}
                  color={party.color}
                  imageUrl={party.imageUrl}
                  name={party.name}
                  size={28}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight="medium" noWrap>
                    {party.name}
                  </Typography>
                  {party.kind === "group" && (
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {party.memberUserIds.map((id) => memberLabelById.get(id) ?? "—").join(", ")}
                    </Typography>
                  )}
                </Box>
                <Chip size="small" label={kindLabel(party.kind)} variant="outlined" />
                {party.isArchived && (
                  <Chip size="small" label={rp.archivedBadge} color="warning" variant="outlined" />
                )}
                <Box sx={{ display: "flex", gap: 0.25, flexShrink: 0 }}>
                  <Tooltip title={m.common.edit}>
                    <IconButton size="small" onClick={() => openEdit(party)}>
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={party.isArchived ? rp.unarchive : rp.archive}>
                    <IconButton size="small" onClick={() => handleArchive(party)}>
                      {party.isArchived ? (
                        <UnarchiveIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <ArchiveIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={m.common.delete}>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(party)}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      {personal.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="overline" color="text.secondary">
            {rp.kindPersonal} {rp.personalHint}
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {personal.map((party) => (
              <Paper
                key={party.id}
                variant="outlined"
                sx={{ px: 2, py: 1, display: "flex", alignItems: "center", gap: 1 }}
              >
                <PartyAvatar
                  kind={party.kind}
                  icon={party.icon}
                  color={party.color}
                  imageUrl={party.imageUrl}
                  name={party.name}
                  size={28}
                />
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                  {party.name}
                </Typography>
                <Tooltip title={m.common.edit}>
                  <IconButton size="small" onClick={() => openEdit(party)}>
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      {/* Create / Edit dialog */}
      <DialogShell
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="xs"
        title={editTarget ? m.common.edit : isGroupForm ? rp.createGroup : rp.createExternal}
        loading={isPending}
        actions={
          <>
            <Button size="small" onClick={closeDialog}>
              {m.common.cancel}
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleSave}
              endIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {m.common.save}
            </Button>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            label={rp.nameLabel}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            error={!!nameError}
            helperText={nameError}
            fullWidth
            autoFocus
            disabled={editTarget?.kind === "personal"}
          />
          <PersonaStyleFields
            icon={iconKey}
            color={colorKey}
            onIconChange={setIconKey}
            onColorChange={setColorKey}
          />
          {isGroupForm && editTarget?.kind !== "personal" && (
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                {rp.membersLabel}
              </Typography>
              <Typography
                variant="caption"
                color={membersError ? "error" : "text.secondary"}
                component="div"
                sx={{ mb: 1 }}
              >
                {membersError || rp.membersHint}
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
      </DialogShell>

      {/* Delete dialog */}
      <DialogShell
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        title={rp.deleteTitle}
        description={
          deleteTarget && deleteTarget.transactionCount > 0
            ? `${rp.deleteWarnCount(deleteTarget.transactionCount)} ${rp.deleteConfirm}`
            : rp.deleteConfirm
        }
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
    </PageSettingsContainer>
  );
}
