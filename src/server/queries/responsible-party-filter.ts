import { prisma } from "@/server/prisma";

/**
 * Traduz userIds de membros → ids das suas parties `personal` na Account.
 * Filtros persistidos (dashboards, Budget) guardam userIds (semântica "qual membro");
 * as transações são atribuídas por `responsiblePartyId`. Esta ponte resolve o membro
 * para a sua party pessoal, permitindo filtrar por `responsiblePartyId` sem migrar
 * os dados persistidos e sem depender de `responsibleUserId` (removível na Spec 60 Fase 5).
 * Multi-tenancy: só parties da própria Account.
 */
export async function personalPartyIdsForUsers(
  accountId: string,
  userIds: string[] | undefined | null,
): Promise<string[]> {
  if (!userIds || userIds.length === 0) return [];
  const links = await prisma.responsiblePartyMember.findMany({
    where: { userId: { in: userIds }, party: { accountId, kind: "personal" } },
    select: { partyId: true },
  });
  return links.map((l) => l.partyId);
}

/**
 * Mapa userId (membro) → id da sua party `personal` na Account. Usado na importação CSV,
 * que mapeia células de texto para membros (userIds) e precisa gravar `responsiblePartyId`.
 */
export async function personalPartyMapForAccount(
  accountId: string,
): Promise<Map<string, string>> {
  const links = await prisma.responsiblePartyMember.findMany({
    where: { party: { accountId, kind: "personal" } },
    select: { userId: true, partyId: true },
  });
  return new Map(links.map((l) => [l.userId, l.partyId]));
}

/**
 * Mapa partyId → nome de exibição (Spec 60 §2.4). Para `personal` de membro atual usa o
 * nome ao vivo do User; demais usam o snapshot `party.name`. Usado por agregações que
 * agrupam por responsável (ex.: sandbox seriesBy=member).
 */
export async function partyDisplayMap(accountId: string): Promise<Map<string, string>> {
  const [parties, members] = await Promise.all([
    prisma.responsibleParty.findMany({
      where: { accountId },
      select: {
        id: true,
        name: true,
        kind: true,
        members: { select: { userId: true, user: { select: { name: true, email: true } } } },
      },
    }),
    prisma.accountMember.findMany({ where: { accountId }, select: { userId: true } }),
  ]);
  const current = new Set(members.map((mm) => mm.userId));
  const map = new Map<string, string>();
  for (const p of parties) {
    let name = p.name;
    if (p.kind === "personal" && p.members.length === 1 && current.has(p.members[0].userId)) {
      name = p.members[0].user.name ?? p.members[0].user.email;
    }
    map.set(p.id, name);
  }
  return map;
}
