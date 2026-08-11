import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InstitutionsManager } from "@/components/settings/institutions/InstitutionsManager";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";

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
    // Spec 68 §2.3 (P4) — tipo, os seis campos de detalhe e status/lastUsedAt para
    // o StatusCell via `resolveActive`. Nenhum outro campo (ex.: `createdById`) é
    // necessário na UI.
    select: {
      id: true,
      name: true,
      kind: true,
      last4: true,
      closingDay: true,
      dueDay: true,
      branch: true,
      accountNo: true,
      taxId: true,
      status: true,
      lastUsedAt: true,
    },
  });

  // O título agora vem do SettingsPageShell (dentro do manager), junto com
  // breadcrumb, contagem e propósito — a página não passa mais cabeçalho.
  return <InstitutionsManager accountId={accountId} initialInstitutions={institutions} />;
}
