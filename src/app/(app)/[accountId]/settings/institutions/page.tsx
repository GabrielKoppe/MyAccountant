import type { Metadata } from "next";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { layout, containers } from "@/lib/design-tokens";
import { InstitutionsManager } from "./InstitutionsManager";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Instituições");
}

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
    <InstitutionsManager
      accountId={accountId}
      initialInstitutions={institutions}
      title={m.settings.institutions.title}
    />
  );
}
