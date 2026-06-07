import type { Metadata } from "next";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { redirect } from "next/navigation";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { parseHiddenColumns } from "@/lib/schemas/settings";
import { TableTypesManager } from "./TableTypesManager";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Modelos de coluna");
}

export default async function TableTypesPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const tableTypes = await prisma.tableType.findMany({
    where: { accountId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      isDefault: true,
      hiddenColumns: true,
      _count: { select: { financeTables: true } },
    },
  });

  const types = tableTypes.map(
    (t: {
      id: string;
      name: string;
      isDefault: boolean;
      hiddenColumns: any;
      _count: { financeTables: number };
    }) => ({
      id: t.id,
      name: t.name,
      isDefault: t.isDefault,
      hiddenColumns: parseHiddenColumns(t.hiddenColumns),
      tableCount: t._count.financeTables,
    }),
  );

  return (
    <TableTypesManager
      accountId={accountId}
      initialTypes={types}
      title={m.settings.tableTypes.title}
    />
  );
}
