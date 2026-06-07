import type { Metadata } from "next";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { listSavedAnalyses } from "@/lib/queries/sandbox";
import { m } from "@/lib/messages";
import { layout, containers } from "@/lib/design-tokens";
import { PageHeader } from "@/components/ui/PageHeader";
import { AnalysesManager } from "./AnalysesManager";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Análises");
}

export default async function AnalysesSettingsPage({ params }: Props) {
  const { accountId } = await params;
  const { user, member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const analyses = await listSavedAnalyses(accountId);

  return (
    <AnalysesManager
      accountId={accountId}
      analyses={analyses}
      currentUserId={user.id}
      role={member.role}
    />
  );
}
