import type { Metadata } from "next";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { SectionsManager } from "./SectionsManager";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Seções");
}

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
    <SectionsManager
      accountId={accountId}
      initialSections={sections}
      title={m.settings.sections.title}
    />
  );
}
