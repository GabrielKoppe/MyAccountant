"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AccountMemberRole } from "@prisma/client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";

import { deleteAccountAction, leaveAccountAction } from "@/actions/members";
import { DialogShell } from "@/components/ui/DialogShell";
import { m } from "@/lib/messages";
import { Paper } from "@mui/material";

type Props = {
  accountId: string;
  accountName: string;
  role: AccountMemberRole;
};

export function AccountDangerZone({ accountId, accountName, role }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  function handleLeave() {
    startTransition(async () => {
      const result = await leaveAccountAction(accountId, {});
      if (result.ok) {
        enqueueSnackbar(m.account.settings.leaveAccountSuccess, { variant: "success" });
        router.push("/home");
      } else {
        setLeaveOpen(false);
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAccountAction(accountId, {});
      if (result.ok) {
        enqueueSnackbar(m.account.settings.deleteAccountSuccess, { variant: "success" });
        router.push("/home");
      } else {
        setDeleteOpen(false);
        enqueueSnackbar(result.error.message, { variant: "error" });
      }
    });
  }

  return (
    <Paper variant="outlined" sx={{ p: 3, borderColor: "error.light" }}>
      <Typography variant="h6" color="error" fontWeight="semibold" mb={1}>
        {m.account.settings.dangerZone}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="body1" fontWeight="medium" sx={{ fontSize: "0.85rem" }}>
              {m.account.settings.leaveAccount}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.85rem" }}>
              Você precisará de um novo convite para retornar.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="error"
            size="small"
            disabled={isPending}
            onClick={() => setLeaveOpen(true)}
          >
            {m.account.settings.leaveAccount}
          </Button>
        </Box>

        {role === "owner" && (
          <>
            <Divider />
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box>
                <Typography variant="body1" fontWeight="medium" sx={{ fontSize: "0.85rem" }}>
                  {m.account.settings.deleteAccount}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.85rem" }}>
                  Ação permanente. Todos os dados serão apagados.
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="error"
                disabled={isPending}
                size="small"
                onClick={() => {
                  setConfirmName("");
                  setDeleteOpen(true);
                }}
              >
                {m.account.settings.deleteAccount}
              </Button>
            </Box>
          </>
        )}

        {/* Leave Dialog */}
        <DialogShell
          open={leaveOpen}
          onClose={() => setLeaveOpen(false)}
          title={m.account.settings.leaveAccount}
          actions={
            <>
              <Button onClick={() => setLeaveOpen(false)}>{m.common.cancel}</Button>
              <Button color="error" variant="contained" onClick={handleLeave} disabled={isPending}>
                {m.account.settings.leaveAccount}
              </Button>
            </>
          }
        >
          <Typography variant="body2">{m.account.settings.leaveAccountConfirm}</Typography>
        </DialogShell>

        {/* Delete Dialog */}
        <DialogShell
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          title={m.account.settings.deleteAccount}
          actions={
            <>
              <Button onClick={() => setDeleteOpen(false)}>{m.common.cancel}</Button>
              <Button
                color="error"
                variant="contained"
                onClick={handleDelete}
                disabled={isPending || confirmName !== accountName}
              >
                {m.account.settings.deleteAccount}
              </Button>
            </>
          }
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="error">Esta ação é permanente e não pode ser desfeita.</Alert>
            <Typography variant="body2">{m.account.settings.deleteAccountConfirm}</Typography>
            <TextField
              label={`Digite "${accountName}" para confirmar`}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              fullWidth
              size="small"
            />
          </Box>
        </DialogShell>
      </Box>
    </Paper>
  );
}
