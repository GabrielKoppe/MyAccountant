import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { m } from "@/lib/messages";
import { requireAccountAccess } from "@/server/auth/session";
import { getAccountConnectors } from "@/server/queries/mcp-connectors";

import { ConnectorsManager } from "./ConnectorsManager";

type Props = { params: Promise<{ accountId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, m.mcpConnectors.title);
}

export default async function ConnectorsSettingsPage({ params }: Props) {
  const { accountId } = await params;

  // Multi-tenancy (spec 63, Task 4.1): só chega aqui quem é membro da Account.
  const { user } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  // User-scoped: cada membro vê apenas os próprios connectors.
  const connectors = await getAccountConnectors(accountId, user.id);

  return <ConnectorsManager accountId={accountId} connectors={connectors} />;
}
