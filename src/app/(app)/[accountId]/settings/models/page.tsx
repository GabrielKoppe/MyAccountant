import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { requireAccountAccess } from "@/server/auth/session";
import * as svc from "@/server/services/table-template-service";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import type { InvestmentType } from "@/lib/schemas/transaction";
import { TableModelsManager } from "@/components/settings/TableModelsManager";

type Props = { params: Promise<{ accountId: string }> };

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
  const serializedTemplates = templates.map((t) => ({
    ...t,
    items: t.items.map((item) => ({
      ...item,
      amountCents: item.amountCents.toString(),
      investmentType: item.investmentType as InvestmentType | null,
    })),
  }));

  const memberOptions = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
  }));

  return (
    <Box sx={{ p: 4, maxWidth: 700 }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        {m.tableModels.title}
      </Typography>
      <TableModelsManager
        accountId={accountId}
        initialTemplates={serializedTemplates}
        categories={categories}
        institutions={institutions}
        members={memberOptions}
        tableTypes={tableTypes}
      />
    </Box>
  );
}
