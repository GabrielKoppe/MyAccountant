import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { requireAccountAccess } from "@/server/auth/session";
import { listSavedAnalyses } from "@/lib/queries/sandbox";
import { m } from "@/lib/messages";
import { AnalysesManager } from "./AnalysesManager";

type Props = { params: Promise<{ accountId: string }> };

export default async function AnalysesSettingsPage({ params }: Props) {
  const { accountId } = await params;
  const { user, member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const analyses = await listSavedAnalyses(accountId);

  return (
    <Box sx={{ p: 4, maxWidth: 700 }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        {m.settings.nav.analyses}
      </Typography>

      <AnalysesManager
        accountId={accountId}
        analyses={analyses}
        currentUserId={user.id}
        role={member.role}
      />
    </Box>
  );
}
