import { redirect } from "next/navigation";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { layout, containers } from "@/lib/design-tokens";
import { PageHeader } from "@/components/ui/PageHeader";
import { TemplatesManager } from "@/components/settings/TemplatesManager";
import type { ImportMapping } from "@/lib/schemas/csv-import";

type Props = { params: Promise<{ accountId: string }> };

export default async function TemplatesPage({ params }: Props) {
  const { accountId } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const templates = await prisma.csvTemplate.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, mapping: true, createdAt: true },
  });

  const serialized = templates.map((t) => ({
    id: t.id,
    name: t.name,
    mapping: t.mapping as ImportMapping,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <Box sx={{ p: layout.page, maxWidth: containers.md }}>
      <PageHeader title={m.templates.title} />
      <TemplatesManager accountId={accountId} initialTemplates={serialized} />
    </Box>
  );
}
