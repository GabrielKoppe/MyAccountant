"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useState, useTransition } from "react";

import { approveConsentAction } from "@/actions/mcp-consent";
import { AuthCard } from "@/components/auth/AuthCard";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

type ConsentAccount = { id: string; name: string };

type ConsentFormProps = {
  clientName: string;
  accounts: ConsentAccount[];
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  state?: string;
};

/**
 * Tela de consentimento OAuth do connector MCP (spec 63, Task 3.4).
 *
 * Componente "burro" no que diz respeito a segurança: os parâmetros do
 * authorize já foram validados no Server Component pai e são só repassados
 * de volta para `approveConsentAction`, que os REVALIDA no server antes de
 * emitir qualquer code. Este componente só decide qual `accountId` enviar.
 */
export function ConsentForm({
  clientName,
  accounts,
  clientId,
  redirectUri,
  codeChallenge,
  scope,
  state,
}: ConsentFormProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  function buildDeniedRedirect(): string {
    const back = new URL(redirectUri);
    back.searchParams.set("error", "access_denied");
    if (state) back.searchParams.set("state", state);
    return back.toString();
  }

  function handleCancel() {
    window.location.href = buildDeniedRedirect();
  }

  function handleAuthorize() {
    if (!accountId) return;

    startTransition(async () => {
      const result = await approveConsentAction({
        clientId,
        redirectUri,
        codeChallenge,
        scope,
        state,
        accountId,
      });

      if (!result.ok) {
        enqueueSnackbar(result.error.message, { variant: "error" });
        return;
      }

      window.location.href = result.data.redirectTo;
    });
  }

  return (
    <AuthCard title={m.mcpConsent.title} description={m.mcpConsent.subtitle(clientName)}>
      <Stack spacing={layout.stack}>
        {accounts.length === 0 ? (
          <Alert severity="warning">{m.mcpConsent.noAccounts}</Alert>
        ) : (
          <FormControl fullWidth>
            <InputLabel id="consent-account-label">{m.mcpConsent.accountLabel}</InputLabel>
            <Select
              labelId="consent-account-label"
              label={m.mcpConsent.accountLabel}
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              disabled={isPending}
            >
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Typography variant="body2" color="text.secondary">
          {m.mcpConsent.scopeReadOnly}
        </Typography>

        <Alert severity="info">{m.mcpConsent.lgpdNotice(clientName)}</Alert>

        <Stack direction="row" spacing={layout.micro} justifyContent="flex-end">
          <Button onClick={handleCancel} disabled={isPending}>
            {m.common.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={handleAuthorize}
            disabled={isPending || accounts.length === 0}
          >
            {isPending ? <CircularProgress size={20} /> : m.mcpConsent.authorize}
          </Button>
        </Stack>
      </Stack>
    </AuthCard>
  );
}
