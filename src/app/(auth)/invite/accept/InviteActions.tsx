"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";

import { acceptInviteAction, declineInviteAction } from "@/actions/members";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

type Props = {
  token?: string;
  inviteId?: string;
};

/**
 * Botões de confirmação da tela de aceite. Só renderizado quando o usuário
 * está logado com o email correto do convite (validado no server component).
 */
export function InviteActions({ token, inviteId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInviteAction({ token, inviteId });
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
      const result = await declineInviteAction({ token, inviteId });
      if (result.ok) {
        setDeclined(true);
      } else {
        setError(result.error.message);
      }
    });
  }

  if (declined) {
    return (
      <Stack spacing={layout.stack} sx={{ width: "100%" }}>
        <Alert severity="info">{m.account.acceptInvite.declined}</Alert>
        <Button variant="outlined" fullWidth onClick={() => router.push("/home")}>
          {m.account.acceptInvite.goToApp}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={layout.inline} sx={{ width: "100%" }}>
      {error && (
        <Alert severity="error" sx={{ textAlign: "left" }}>
          {error}
        </Alert>
      )}
      <Button
        variant="contained"
        size="large"
        fullWidth
        disabled={isPending}
        onClick={handleAccept}
      >
        {isPending ? (
          <CircularProgress size={20} color="inherit" />
        ) : (
          m.account.acceptInvite.acceptButton
        )}
      </Button>
      <Button variant="text" fullWidth disabled={isPending} onClick={handleDecline}>
        {m.account.acceptInvite.declineButton}
      </Button>
    </Stack>
  );
}
