import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import { m } from "@/lib/messages";
import { resolveActive } from "@/lib/settings-status";
import { ResponsiblePartiesManager } from "@/components/settings/responsibles/ResponsiblePartiesManager";

type Props = { params: Promise<{ accountId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, m.settings.responsibleParties.title);
}

export default async function ResponsiblesPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const [parties, members] = await Promise.all([
    prisma.responsibleParty.findMany({
      where: { accountId },
      // "Tudo é responsável": uma tabela só, sem agrupar por `kind` — a ordem é
      // simplesmente alfabética, como qualquer outra lista de nomes da Estrutura.
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        kind: true,
        icon: true,
        color: true,
        archivedAt: true,
        lastUsedAt: true,
        members: { select: { userId: true } },
        _count: { select: { transactions: true } },
      },
    }),
    prisma.accountMember.findMany({
      where: { accountId },
      select: { userId: true, user: { select: { name: true, email: true, image: true } } },
    }),
  ]);

  // Foto ao vivo do membro (para personal parties): userId → image.
  const imageByUserId = new Map(members.map((mm) => [mm.userId, mm.user.image]));

  const serializedParties = parties.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    icon: p.icon,
    color: p.color,
    // Spec 68 §7.1 — `archivedAt: null` significa ATIVO. O componente NUNCA lê
    // `archivedAt` direto (§7.4); a normalização acontece aqui, na borda RSC.
    active: resolveActive({ kind: "archivedAt", archivedAt: p.archivedAt }),
    lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
    memberUserIds: p.members.map((mm) => mm.userId),
    transactionCount: p._count.transactions,
    imageUrl:
      p.kind === "personal" && p.members.length === 1
        ? (imageByUserId.get(p.members[0].userId) ?? null)
        : null,
  }));

  const memberOptions = members.map((mm) => ({
    userId: mm.userId,
    label: mm.user.name ?? mm.user.email,
  }));

  return (
    <ResponsiblePartiesManager
      accountId={accountId}
      initialParties={serializedParties}
      members={memberOptions}
    />
  );
}
