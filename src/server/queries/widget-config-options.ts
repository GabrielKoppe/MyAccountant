import { cache } from "react";

import { prisma } from "@/server/prisma";

import { partyDisplayMap } from "./responsible-party-filter";

// Opções para os formulários de config dos widgets (kpi-custom, filtered-transactions).
// Listas simples {id, name} por Account — usadas nos multi-selects de filtro.
export type ConfigFormOption = { id: string; name: string };

export type WidgetConfigOptions = {
  sections: ConfigFormOption[];
  categories: ConfigFormOption[];
  institutions: ConfigFormOption[];
  members: ConfigFormOption[];
  parties: ConfigFormOption[]; // Parte A / A1: responsáveis (todas as kinds de persona)
  tags: ConfigFormOption[]; // Spec 41 Fase 14
};

export const getWidgetConfigOptions = cache(
  async (accountId: string): Promise<WidgetConfigOptions> => {
    const [sections, categories, institutions, members, tags, partyNames] = await Promise.all([
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
      prisma.tag.findMany({
        where: { accountId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      partyDisplayMap(accountId),
    ]);

    return {
      sections,
      categories,
      institutions,
      members: members.map((m) => ({
        id: m.userId,
        name: m.user.name ?? m.user.email ?? "Membro",
      })),
      parties: [...partyNames.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      tags,
    };
  },
);
