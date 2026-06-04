"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import MailOutlineIcon from "@mui/icons-material/MailOutline";

import { acceptInviteAction, declineInviteAction } from "@/actions/members";
import { m } from "@/lib/messages";

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInviteAction(token);
      if (result.ok) {
        router.push(`/${result.data.accountId}`);
      } else {
        setError(result.error.message);
      }
    });
  }

  function handleDecline() {
    setError(null);
    startTransition(async () => {
      const result = await declineInviteAction(token);
      if (result.ok) {
        setDeclined(true);
      } else {
        setError(result.error.message);
      }
    });
  }

  if (!token) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <Alert severity="error">{m.account.acceptInvite.invalidToken}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 440, width: "100%", textAlign: "center" }}>
        <MailOutlineIcon sx={{ fontSize: 56, color: "primary.main", mb: 2 }} />

        <Typography variant="h5" mb={1}>
          {m.account.acceptInvite.title}
        </Typography>

        {declined ? (
          <>
            <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
              {m.account.acceptInvite.declined}
            </Alert>
            <Button variant="outlined" onClick={() => router.push("/home")}>
              Ir para o início
            </Button>
          </>
        ) : (
          <>
            <Typography color="text.secondary" mb={3}>
              Clique em aceitar para entrar na conta. O convite expira em 7 dias.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, textAlign: "left" }}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
              <Button
                variant="outlined"
                color="inherit"
                disabled={isPending}
                onClick={handleDecline}
              >
                {isPending ? m.account.acceptInvite.declining : m.account.acceptInvite.declineButton}
              </Button>
              <Button variant="contained" disabled={isPending} onClick={handleAccept}>
                {isPending ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  m.account.acceptInvite.acceptButton
                )}
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
