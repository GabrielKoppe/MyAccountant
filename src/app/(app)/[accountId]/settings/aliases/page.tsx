import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { m } from "@/lib/messages";
import { toResponsiblePartyOption } from "@/lib/party-display";
import { serializeTransactionAlias } from "@/lib/serializers/transaction-alias";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";

import { TransactionAliasesManager } from "./TransactionAliasesManager";

type Props = { params: Promise<{ accountId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, m.settings.transactionAliases.title);
}

// Mesmo shape de include usado em src/server/queries/transaction-aliases.ts (DD-10),
// mas sem filtro de archivedAt — a página de Configurações também precisa listar
// (e permitir reativar/deletar) apelidos arquivados.
const ALIAS_INCLUDE = {
  category: { select: { name: true } },
  subcategory: { select: { name: true } },
  institution: { select: { name: true } },
  responsibleParty: { select: { name: true } },
  tags: { select: { tag: { select: { id: true, name: true } } } },
} as const;

export default async function AliasesPage({ params }: Props) {
  const { accountId } = await params;
  const { user, member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const [aliases, categories, institutions, partiesRaw, members, tags] = await Promise.all([
    prisma.transactionAlias.findMany({
      where: { accountId },
      orderBy: { trigger: "asc" },
      include: ALIAS_INCLUDE,
    }),
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
    prisma.responsibleParty.findMany({
      where: { accountId, archivedAt: null },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        icon: true,
        color: true,
        members: {
          select: { userId: true, user: { select: { name: true, email: true, image: true } } },
        },
      },
    }),
    prisma.accountMember.findMany({
      where: { accountId },
      select: { userId: true },
    }),
    prisma.tag.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  const currentMemberIds = new Set(members.map((mm) => mm.userId));
  const parties = partiesRaw.map((p) => toResponsiblePartyOption(p, currentMemberIds));

  return (
    <TransactionAliasesManager
      accountId={accountId}
      currentUserId={user.id}
      initialAliases={aliases.map(serializeTransactionAlias)}
      categories={categories}
      institutions={institutions}
      parties={parties}
      tags={tags}
    />
  );
}
