import { redirect } from "next/navigation";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { listSavedAnalyses } from "@/lib/queries/sandbox";
import { m } from "@/lib/messages";
import { layout, containers } from "@/lib/design-tokens";
import { PageHeader } from "@/components/ui/PageHeader";
import { AnalysesManager } from "./AnalysesManager";

type Props = { params: Promise<{ accountId: string }> };

export default async function AnalysesSettingsPage({ params }: Props) {
  const { accountId } = await params;
  const { user, member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const analyses = await listSavedAnalyses(accountId);

  return (
    <Box sx={{ p: layout.page, maxWidth: containers.md }}>
      <PageHeader title={m.settings.nav.analyses} />

      <AnalysesManager
        accountId={accountId}
        analyses={analyses}
        currentUserId={user.id}
        role={member.role}
      />
    </Box>
  );
}
