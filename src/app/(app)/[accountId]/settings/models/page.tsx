import type { Metadata } from "next";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";
import * as svc from "@/server/services/table-template-service";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { toResponsiblePartyOption } from "@/lib/party-display";
import type { InvestmentType } from "@/lib/schemas/transaction";
import { TableModelsManager } from "@/app/(app)/[accountId]/settings/models/TableModelsManager";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Modelos de tabela");
}

export default async function TableModelsPage({ params }: Props) {
  const { accountId } = await params;
  await requireAccountAccess(accountId).catch(() => redirect("/home"));

  const [templates, categories, institutions, members, partiesRaw, tableTypes, sections] =
    await Promise.all([
    svc.listTemplates(accountId),
    prisma.category.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, subcategories: { select: { id: true, name: true } } },
    }),
    prisma.institution.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.accountMember.findMany({
      where: { accountId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.responsibleParty.findMany({
      where: { accountId, archivedAt: null },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        icon: true,
        color: true,
        members: {
          select: { userId: true, user: { select: { name: true, email: true, image: true } } },
        },
      },
    }),
    prisma.tableType.findMany({
      where: { accountId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
    prisma.section.findMany({
      where: { accountId, isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Serialize BigInt; cast investmentType to enum (DB may return string)
  const serializedTemplates = templates.map((t: any) => ({
    ...t,
    items: t.items.map((item: any) => ({
      ...item,
      amountCents: item.amountCents.toString(),
      investmentType: item.investmentType as InvestmentType | null,
    })),
  }));

  const currentMemberIds = new Set(members.map((mm: any) => mm.user.id));
  const parties = partiesRaw.map((p) => toResponsiblePartyOption(p, currentMemberIds));

  return (
    <TableModelsManager
      accountId={accountId}
      initialTemplates={serializedTemplates}
      categories={categories}
      institutions={institutions}
      parties={parties}
      tableTypes={tableTypes}
      sections={sections}
      title={m.tableModels.title}
    />
  );
}
