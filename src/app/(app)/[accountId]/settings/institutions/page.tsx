import { redirect } from "next/navigation";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { layout, containers } from "@/lib/design-tokens";
import { PageHeader } from "@/components/ui/PageHeader";
import { InstitutionsManager } from "./InstitutionsManager";

type Props = { params: Promise<{ accountId: string }> };

export default async function InstitutionsPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const institutions = await prisma.institution.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <Box sx={{ p: layout.page, maxWidth: containers.md }}>
      <PageHeader title={m.settings.institutions.title} />
      <InstitutionsManager accountId={accountId} initialInstitutions={institutions} />
    </Box>
  );
}
