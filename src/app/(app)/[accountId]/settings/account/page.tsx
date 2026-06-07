import type { Metadata } from "next";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { layout, containers } from "@/lib/design-tokens";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccountDangerZone } from "../general/AccountDangerZone";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Conta");
}

export default async function AccountSettingsPage({ params }: Props) {
  const { accountId } = await params;

  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { name: true },
  });
  if (!account) redirect("/home");

  return (
    <Box sx={{ p: layout.page, maxWidth: containers.md }}>
      <PageHeader title={m.account.settings.title} />

      
    </Box>
  );
}
