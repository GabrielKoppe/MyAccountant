import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { CategoriesManager } from "./CategoriesManager";

type Props = { params: Promise<{ accountId: string }> };

export default async function CategoriesPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const categories = await prisma.category.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      subcategories: {
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });

  return (
    <Box sx={{ p: 4, maxWidth: 700 }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        {m.settings.categories.title}
      </Typography>
      <CategoriesManager accountId={accountId} initialCategories={categories} />
    </Box>
  );
}
