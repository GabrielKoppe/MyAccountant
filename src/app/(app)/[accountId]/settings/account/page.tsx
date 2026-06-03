import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { AccountDangerZone } from "./AccountDangerZone";

type Props = { params: Promise<{ accountId: string }> };

export default async function AccountSettingsPage({ params }: Props) {
  const { accountId } = await params;

  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { name: true },
  });
  if (!account) redirect("/home");

  return (
    <Box sx={{ p: 4, maxWidth: 700 }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        {m.account.settings.title}
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={1}>
        {m.account.accountName}
      </Typography>
      <Typography variant="h6" mb={4}>
        {account.name}
      </Typography>

      <Divider sx={{ my: 3 }} />

      <Paper
        variant="outlined"
        sx={{ p: 3, borderColor: "error.light" }}
      >
        <Typography variant="h6" color="error" fontWeight="medium" mb={1}>
          {m.account.settings.dangerZone}
        </Typography>
        <AccountDangerZone
          accountId={accountId}
          accountName={account.name}
          role={member.role}
        />
      </Paper>
    </Box>
  );
}
