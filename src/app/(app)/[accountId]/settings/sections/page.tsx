import { redirect } from "next/navigation";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { layout, containers } from "@/lib/design-tokens";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionsManager } from "./SectionsManager";

type Props = { params: Promise<{ accountId: string }> };

export default async function SectionsPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const sections = await prisma.section.findMany({
    where: { accountId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      countType: true,
      isActive: true,
      order: true,
    },
  });

  return (
    <Box sx={{ p: layout.page, maxWidth: containers.md }}>
      <PageHeader title={m.settings.sections.title} />
      <SectionsManager accountId={accountId} initialSections={sections} />
    </Box>
  );
}
