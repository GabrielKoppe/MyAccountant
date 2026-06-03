"use client";

import { useTransition } from "react";
import type { AccountMemberRole, InviteStatus } from "@prisma/client";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import BlockIcon from "@mui/icons-material/Block";
import { useSnackbar } from "notistack";

import { revokeInviteAction } from "@/actions/members";
import { m } from "@/lib/messages";

type Invite = {
  id: string;
  email: string;
  role: AccountMemberRole;
  status: InviteStatus;
  createdAt: Date;
  expiresAt: Date;
};

type Props = {
  accountId: string;
  invites: Invite[];
};

export function InvitesList({ accountId, invites }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();

  function handleRevoke(inviteId: string) {
    startTransition(async () => {
      const result = await revokeInviteAction(accountId, { inviteId });
      if (result.ok) {
        enqueueSnackbar(m.account.members.revokeSuccess, { variant: "success" });
      } else {
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
    });
  }

  if (invites.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {m.account.members.noPendingInvites}
      </Typography>
    );
  }

  return (
    <Paper variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell>Papel</TableCell>
            <TableCell>{m.account.members.expiresAt}</TableCell>
            <TableCell align="right">Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invites.map((invite) => (
            <TableRow key={invite.id} hover>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2">{invite.email}</Typography>
                  <Chip label="Pendente" size="small" color="warning" variant="outlined" />
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{m.account.roles[invite.role]}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">
                  {invite.expiresAt.toLocaleDateString("pt-BR")}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Tooltip title={m.account.members.revokeButton}>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={isPending}
                    onClick={() => handleRevoke(invite.id)}
                  >
                    <BlockIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
