import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CategoriesManager } from "@/components/settings/categories/CategoriesManager";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";

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

  // Spec 68 §2.2 (P3, revisão de estilo) — ordem manual e status/lastUsedAt para o
  // StatusCell via `resolveActive`. Subcategorias trazem os mesmos campos. Não busca
  // mais `Section`: a coluna "Seção padrão" saiu da UI nesta revisão (o campo
  // `Category.defaultSectionId` continua no banco, deprecado, sem migração destrutiva).
  const categories = await prisma.category.findMany({
    where: { accountId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      order: true,
      status: true,
      lastUsedAt: true,
      subcategories: {
        orderBy: { order: "asc" },
        select: { id: true, name: true, order: true, status: true, lastUsedAt: true },
      },
    },
  });

  // O título agora vem do SettingsPageShell (dentro do manager), junto com
  // breadcrumb, contagem e propósito — a página não passa mais cabeçalho.
  return <CategoriesManager accountId={accountId} initialCategories={categories} />;
}
