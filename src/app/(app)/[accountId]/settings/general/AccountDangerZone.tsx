"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AccountMemberRole } from "@prisma/client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useSnackbar } from "notistack";

import { deleteAccountAction, leaveAccountAction } from "@/actions/members";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { m } from "@/lib/messages";
import { layout } from "@/lib/design-tokens";

type Props = {
  accountId: string;
  accountName: string;
  role: AccountMemberRole;
};

export function AccountDangerZone({ accountId, accountName, role }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
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
    <Paper variant="outlined" sx={{ borderColor: "error.light", overflow: "hidden" }}>
      <Box
        onClick={() => setExpanded((prev) => !prev)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2,
          cursor: "pointer",
          userSelect: "none",
          "&:hover": { bgcolor: "danger.subtle" },
          transition: "background-color 0.15s ease",
        }}
      >
        <Box>
          <Typography variant="h6" color="error" fontWeight="semibold" lineHeight={1.3}>
            {m.account.settings.dangerZone}
          </Typography>
          {!expanded && (
            <Typography variant="caption" color="text.secondary">
              {m.account.settings.dangerZoneHint}
            </Typography>
          )}
        </Box>
        <ExpandMoreIcon
          sx={{
            color: "error.main",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        />
      </Box>

      <Collapse in={expanded}>
        <Divider sx={{ borderColor: "error.light" }} />
        <Stack spacing={layout.stack} sx={{ px: 3, py: 2.5 }}>
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}
          >
            <Box>
              <Typography variant="body2" fontWeight="medium">
                {m.account.settings.leaveAccount}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {m.account.settings.leaveAccountHint}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="error"
              size="small"
              disabled={isPending}
              onClick={() => setLeaveOpen(true)}
              sx={{ flexShrink: 0 }}
            >
              {m.account.settings.leaveAccount}
            </Button>
          </Box>

          {role === "owner" && (
            <>
              <Divider />
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    {m.account.settings.deleteAccount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {m.account.settings.deleteAccountHint}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  disabled={isPending}
                  onClick={() => {
                    setConfirmName("");
                    setDeleteOpen(true);
                  }}
                  sx={{ flexShrink: 0 }}
                >
                  {m.account.settings.deleteAccount}
                </Button>
              </Box>
            </>
          )}
        </Stack>
      </Collapse>

      <SettingsDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        size="confirm"
        title={m.account.settings.leaveAccount}
        description={m.account.settings.leaveAccountConfirm}
        loading={isPending}
        actions={
          <>
            <Button onClick={() => setLeaveOpen(false)}>{m.common.cancel}</Button>
            <Button color="error" variant="contained" onClick={handleLeave}>
              {m.account.settings.leaveAccount}
            </Button>
          </>
        }
      />

      <SettingsDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size="form"
        title={m.account.settings.deleteAccount}
        loading={isPending}
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
        <Stack spacing={layout.stack}>
          <Alert severity="error">{m.account.settings.deleteAccountAlert}</Alert>
          <Typography variant="body2">{m.account.settings.deleteAccountConfirm}</Typography>
          <TextField
            label={`Digite "${accountName}" para confirmar`}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            fullWidth
            size="small"
          />
        </Stack>
      </SettingsDialog>
    </Paper>
  );
}
