import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TemplatesManager } from "@/app/(app)/[accountId]/settings/templates/TemplatesManager";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import type { ImportMapping } from "@/lib/schemas/csv-import";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Templates CSV");
}

export default async function TemplatesPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  // Carve-out do viewer (Spec 65 §10.5): esta página não tem guard próprio no
  // layout — só "Membros" fica aberto a todos os papéis.
  if (member.role === "viewer") redirect(`/${accountId}`);

  const templates = await prisma.csvTemplate.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, mapping: true, createdAt: true },
  });

  const serialized = templates.map((t) => ({
    id: t.id,
    name: t.name,
    mapping: t.mapping as unknown as ImportMapping,
    createdAt: t.createdAt.toISOString(),
  }));

  return <TemplatesManager accountId={accountId} initialTemplates={serialized} />;
}
