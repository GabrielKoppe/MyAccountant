import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SectionsManager } from "@/components/settings/sections/SectionsManager";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { m } from "@/lib/messages";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Seções");
}

export default async function SectionsPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const [sections, modelCounts] = await Promise.all([
    prisma.section.findMany({
      where: { accountId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        countType: true,
        isActive: true,
        color: true,
        lastUsedAt: true,
      },
    }),
    // Spec 68 §2.1 item 4 — coluna "Modelos": quantos `TableTemplate` criam
    // tabela nesta seção via `autoSectionId`. Contagem barata (groupBy em
    // configuração, não em `Transaction` — SET-07 da Spec 67 proíbe isso).
    prisma.tableTemplate.groupBy({
      by: ["autoSectionId"],
      where: { accountId, autoSectionId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const modelsCountBySection = new Map(
    modelCounts.map((row) => [row.autoSectionId as string, row._count._all]),
  );

  return (
    <SectionsManager
      accountId={accountId}
      initialSections={sections.map((section) => ({
        ...section,
        modelsCount: modelsCountBySection.get(section.id) ?? 0,
      }))}
      // Spec 67 §7.5: o título do cabeçalho é o mesmo rótulo do nav da família Estrutura.
      title={m.settings.nav.sections}
    />
  );
}
