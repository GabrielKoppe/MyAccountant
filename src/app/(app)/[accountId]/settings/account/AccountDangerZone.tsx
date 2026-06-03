"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AccountMemberRole } from "@prisma/client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";

import { deleteAccountAction, leaveAccountAction } from "@/actions/members";
import { m } from "@/lib/messages";

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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="body1" fontWeight="medium">
            {m.account.settings.leaveAccount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Você precisará de um novo convite para retornar.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="error"
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
              <Typography variant="body1" fontWeight="medium">
                {m.account.settings.deleteAccount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ação permanente. Todos os dados serão apagados.
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="error"
              disabled={isPending}
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
      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)}>
        <DialogTitle>{m.account.settings.leaveAccount}</DialogTitle>
        <DialogContent>
          <DialogContentText>{m.account.settings.leaveAccountConfirm}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveOpen(false)}>{m.common.cancel}</Button>
          <Button color="error" variant="contained" onClick={handleLeave} disabled={isPending}>
            {m.account.settings.leaveAccount}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>{m.account.settings.deleteAccount}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <Alert severity="error">Esta ação é permanente e não pode ser desfeita.</Alert>
          <DialogContentText>{m.account.settings.deleteAccountConfirm}</DialogContentText>
          <TextField
            label={`Digite "${accountName}" para confirmar`}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            fullWidth
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>{m.common.cancel}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={isPending || confirmName !== accountName}
          >
            {m.account.settings.deleteAccount}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
