"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

import { acceptInviteAction, declineInviteAction } from "@/actions/members";
import { m } from "@/lib/messages";

type Props = {
  token: string;
};

/**
 * Botões de confirmação da tela de aceite. Só renderizado quando o usuário
 * está logado com o email correto do convite (validado no server component).
 */
export function InviteActions({ token }: Props) {
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
        router.refresh();
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

  if (declined) {
    return (
      <>
        <Alert severity="info" sx={{ mt: 1, mb: 3 }}>
          {m.account.acceptInvite.declined}
        </Alert>
        <Button variant="outlined" onClick={() => router.push("/home")}>
          {m.account.acceptInvite.goToApp}
        </Button>
      </>
    );
  }

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2, textAlign: "left" }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
        <Button variant="outlined" color="inherit" disabled={isPending} onClick={handleDecline}>
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
  );
}
