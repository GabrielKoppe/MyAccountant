import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AuthCard } from "@/components/auth/AuthCard";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { requireUser } from "@/server/auth/session";
import { getClient } from "@/server/mcp/oauth/clients";
import { prisma } from "@/server/prisma";

import { ConsentForm } from "./ConsentForm";

type ConsentSearchParams = {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  state?: string;
};

/**
 * Tela de consentimento do connector MCP (spec 63, Task 3.4).
 *
 * Rota top-level (fora de `[accountId]`) porque, neste ponto do fluxo, ainda
 * não existe uma Account escolhida — é justamente esta tela que decide qual.
 * `/api/oauth/authorize` já validou os parâmetros antes de redirecionar para
 * cá, mas eles chegam por query string (não secretos) e são revalidados
 * aqui em profundidade (defense in depth) antes de renderizar o form; a
 * revalidação definitiva, que de fato importa para segurança, é a feita
 * dentro de `approveConsentAction` no momento do submit.
 */
function ConsentShell({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: layout.stack,
      }}
    >
      <Container maxWidth="xs">{children}</Container>
    </Box>
  );
}

function ConsentError({ message }: { message: string }) {
  return (
    <ConsentShell>
      <AuthCard title={m.mcpConsent.errorTitle}>
        <Alert severity="error">{message}</Alert>
      </AuthCard>
    </ConsentShell>
  );
}

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<ConsentSearchParams>;
}) {
  const raw = await searchParams;

  const clientId = raw.client_id ?? null;
  const redirectUri = raw.redirect_uri ?? null;
  const responseType = raw.response_type ?? null;
  const codeChallenge = raw.code_challenge ?? null;
  const codeChallengeMethod = raw.code_challenge_method ?? null;
  const scopeParam = raw.scope ?? null;
  const state = raw.state ?? null;

  // Defense in depth: revalida client + redirect_uri (igualdade estrita) —
  // mesma checagem anti open-redirect do /api/oauth/authorize.
  const client = clientId ? await getClient(clientId) : null;
  if (!clientId || !client) {
    return <ConsentError message={m.mcpConsent.invalidClient} />;
  }

  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    return <ConsentError message={m.mcpConsent.invalidRedirectUri} />;
  }

  if (responseType !== "code" || !codeChallenge || codeChallengeMethod !== "S256") {
    return <ConsentError message={m.mcpConsent.invalidRequest} />;
  }

  const scopes = scopeParam ? scopeParam.split(" ").filter(Boolean) : ["read"];
  if (scopes.length === 0 || !scopes.every((s) => s === "read")) {
    return <ConsentError message={m.mcpConsent.invalidRequest} />;
  }
  const scope = "read";

  const callbackQuery = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope,
    ...(state ? { state } : {}),
  }).toString();

  const user = await requireUser().catch(() => {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/oauth/consent?${callbackQuery}`)}`);
  });

  // Não existe "Account ativa" server-side (spec 31) — lista todas as
  // Accounts das quais o usuário é membro para ele escolher qual conceder.
  const memberships = await prisma.accountMember.findMany({
    where: { userId: user.id },
    include: { account: { select: { id: true, name: true } } },
  });

  const accounts = memberships.map((membership) => ({
    id: membership.account.id,
    name: membership.account.name,
  }));

  return (
    <ConsentShell>
      <ConsentForm
        clientName={client.clientName}
        accounts={accounts}
        clientId={clientId}
        redirectUri={redirectUri}
        codeChallenge={codeChallenge}
        scope={scope}
        state={state ?? undefined}
      />
    </ConsentShell>
  );
}
