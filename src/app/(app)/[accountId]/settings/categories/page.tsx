import type { Metadata } from "next";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";

import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { layout, containers } from "@/lib/design-tokens";
import { CategoriesManager } from "./CategoriesManager";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Categorias");
}

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
    <CategoriesManager
      accountId={accountId}
      initialCategories={categories}
      title={m.settings.categories.title}
    />
  );
}
