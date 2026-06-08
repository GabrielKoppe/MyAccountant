"use client";

import { useState, useTransition } from "react";
import type { AccountMemberRole } from "@prisma/client";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import { useSnackbar } from "notistack";

import { removeMemberAction, updateMemberRoleAction } from "@/actions/members";
import { DialogShell } from "@/components/ui/DialogShell";
import { m } from "@/lib/messages";

type Member = {
  userId: string;
  role: AccountMemberRole;
  createdAt: Date;
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
};

type Props = {
  accountId: string;
  members: Member[];
  currentUserId: string;
  currentUserRole: AccountMemberRole;
};

export function MembersTable({ accountId, members, currentUserId, currentUserRole }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  const isOwner = currentUserRole === "owner";

  function handleRoleChange(targetUserId: string, role: AccountMemberRole) {
    startTransition(async () => {
      const result = await updateMemberRoleAction(accountId, { targetUserId, role });
      if (result.ok) {
        enqueueSnackbar(m.account.members.roleUpdated, { variant: "success" });
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
    });
  }

  function handleRemove(member: Member) {
    setRemoveTarget(member);
  }

  function confirmRemove() {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoveTarget(null);
    startTransition(async () => {
      const result = await removeMemberAction(accountId, { targetUserId: target.userId });
      if (result.ok) {
        enqueueSnackbar(m.account.members.removeSuccess, { variant: "success" });
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
    });
  }

  return (
    <>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Membro</TableCell>
              <TableCell>Papel</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.userId === currentUserId;
              const displayName = member.user.name ?? member.user.email;
              return (
                <TableRow key={member.userId} hover>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar
                        src={member.user.image ?? undefined}
                        sx={{ width: 32, height: 32, fontSize: 14 }}
                      >
                        {displayName.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {displayName}
                          {isSelf && (
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                              (você)
                            </Typography>
                          )}
                        </Typography>
                        {member.user.name && (
                          <Typography variant="caption" color="text.secondary">
                            {member.user.email}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {isOwner && !isSelf ? (
                      <Select
                        value={member.role}
                        size="small"
                        variant="standard"
                        disabled={isPending}
                        onChange={(e) =>
                          handleRoleChange(member.userId, e.target.value as AccountMemberRole)
                        }
                      >
                        <MenuItem value="owner">{m.account.roles.owner}</MenuItem>
                        <MenuItem value="editor">{m.account.roles.editor}</MenuItem>
                        <MenuItem value="viewer">{m.account.roles.viewer}</MenuItem>
                      </Select>
                    ) : (
                      <Typography variant="body2">{m.account.roles[member.role]}</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {isOwner && !isSelf && (
                      <Tooltip title={m.account.members.removeButton}>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={isPending}
                          onClick={() => handleRemove(member)}
                        >
                          <PersonRemoveIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      <DialogShell
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        maxWidth="xs"
        title={m.account.members.removeTitle}
        description={m.account.members.removeConfirm}
        actions={
          <>
            <Button onClick={() => setRemoveTarget(null)}>{m.common.cancel}</Button>
            <Button color="error" variant="contained" onClick={confirmRemove} disabled={isPending}>
              {m.account.members.removeButton}
            </Button>
          </>
        }
      />
    </>
  );
}
