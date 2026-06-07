import type { Metadata } from "next";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";
import * as svc from "@/server/services/table-template-service";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
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

  const [templates, categories, institutions, members, tableTypes] = await Promise.all([
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
    prisma.tableType.findMany({
      where: { accountId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true, isDefault: true },
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

  const memberOptions = members.map((m: any) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));

  return (
    <TableModelsManager
      accountId={accountId}
      initialTemplates={serializedTemplates}
      categories={categories}
      institutions={institutions}
      members={memberOptions}
      tableTypes={tableTypes}
      title={m.tableModels.title}
    />
  );
}
