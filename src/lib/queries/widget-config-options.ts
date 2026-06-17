import { cache } from "react";

import { prisma } from "@/server/prisma";

// Opções para os formulários de config dos widgets (kpi-custom, filtered-transactions).
// Listas simples {id, name} por Account — usadas nos multi-selects de filtro.
export type ConfigFormOption = { id: string; name: string };

export type WidgetConfigOptions = {
  sections: ConfigFormOption[];
  categories: ConfigFormOption[];
  institutions: ConfigFormOption[];
  members: ConfigFormOption[];
};

export const getWidgetConfigOptions = cache(
  async (accountId: string): Promise<WidgetConfigOptions> => {
    const [sections, categories, institutions, members] = await Promise.all([
      prisma.section.findMany({
        where: { accountId },
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      }),
      prisma.category.findMany({
        where: { accountId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.institution.findMany({
        where: { accountId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.accountMember.findMany({
        where: { accountId },
        select: { userId: true, user: { select: { name: true, email: true } } },
      }),
    ]);

    return {
      sections,
      categories,
      institutions,
      members: members.map((m) => ({
        id: m.userId,
        name: m.user.name ?? m.user.email ?? "Membro",
      })),
    };
  },
);
