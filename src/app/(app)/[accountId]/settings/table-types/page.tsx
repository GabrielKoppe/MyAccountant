import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { TableTypesManager } from "./TableTypesManager";

type Props = { params: Promise<{ accountId: string }> };

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

  const types = tableTypes.map((t) => ({
    id: t.id,
    name: t.name,
    isDefault: t.isDefault,
    hiddenColumns: (t.hiddenColumns ?? {}) as Record<string, boolean>,
    tableCount: t._count.financeTables,
  }));

  return (
    <Box sx={{ p: 4, maxWidth: 700 }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        {m.settings.tableTypes.title}
      </Typography>
      <TableTypesManager accountId={accountId} initialTypes={types} />
    </Box>
  );
}
