// Spec 67 §4 (SET-01) — contagens baratas do nav e do hub de Configurações.
//
// REGRA DE OURO (SET-07): nenhuma query aqui toca `Transaction`. Contagem de
// transações por objeto tem custo que cresce com a conta e só existe sob
// demanda (`settings-usage.ts`). Aqui só entram tabelas de configuração, que
// são pequenas e limitadas.
//
// Envolvido em React.cache: o layout (nav) e a página do hub consomem a mesma
// função na mesma render e o Prisma roda uma vez só.

import type { AccountMemberRole, DashboardLayoutContext } from "@prisma/client";
import { cache } from "react";

import { m } from "@/lib/messages";
import { prisma } from "@/server/prisma";

/** Contagens indexadas pelo `href` do link (mesma chave usada em `settings-nav-groups`). */
export type SettingsCounts = Record<string, string>;

/**
 * Contextos de dashboard personalizáveis (`DashboardLayout` tem
 * `@@unique([accountId, context])`, então há no máximo uma linha por contexto).
 *
 * Declarado como `Record<DashboardLayoutContext, true>` de propósito: se o enum
 * do Prisma ganhar um contexto novo, o typecheck quebra aqui em vez de a UI
 * passar a dizer "3 de 3" com um contexto fora da conta.
 */
const DASHBOARD_CONTEXTS: Record<DashboardLayoutContext, true> = {
  monthly: true,
  yearly: true,
  month_summary: true,
};
const DASHBOARD_CONTEXT_TOTAL = Object.keys(DASHBOARD_CONTEXTS).length;

/**
 * @param accountId conta corrente (multi-tenancy — todo where filtra por ela)
 * @param role papel do membro; `audit` e a família Conta são owner-only
 * @param userId dono da sessão — conectores MCP são user-scoped por decisão da Spec 63
 */
export const getSettingsCounts = cache(async function getSettingsCounts(
  accountId: string,
  role: AccountMemberRole,
  userId: string,
): Promise<SettingsCounts> {
  // viewer só enxerga Membros (carve-out da Spec 65, mantido pela Spec 67 D3).
  if (role === "viewer") {
    const members = await prisma.accountMember.count({ where: { accountId } });
    return { members: String(members) };
  }

  const [
    sectionsTotal,
    sectionsInactive,
    categories,
    subcategories,
    institutions,
    responsibles,
    tableTypes,
    models,
    dashboardsCustomized,
    templates,
    aliases,
    connectors,
    checklistItems,
    members,
    pendingInvites,
  ] = await Promise.all([
    prisma.section.count({ where: { accountId } }),
    prisma.section.count({ where: { accountId, isActive: false } }),
    prisma.category.count({ where: { accountId } }),
    // `Subcategory` não tem índice por accountId; filtrar pela relação usa o índice de categoryId.
    prisma.subcategory.count({ where: { category: { accountId } } }),
    prisma.institution.count({ where: { accountId } }),
    prisma.responsibleParty.count({ where: { accountId, archivedAt: null } }),
    prisma.tableType.count({ where: { accountId } }),
    prisma.tableTemplate.count({ where: { accountId } }),
    // B2: Dashboards não tem entidade "item" para contar — o JSON de widgets de
    // cada contexto custaria três leituras de Json só para somar. Um `count` na
    // tabela (≤ 3 linhas por conta) responde "quantos contextos você personalizou".
    prisma.dashboardLayout.count({ where: { accountId } }),
    prisma.csvTemplate.count({ where: { accountId } }),
    prisma.transactionAlias.count({ where: { accountId, archivedAt: null } }),
    prisma.mcpGrant.count({ where: { accountId, userId, revokedAt: null } }),
    prisma.checklistItem.count({ where: { accountId } }),
    prisma.accountMember.count({ where: { accountId } }),
    prisma.accountInvite.count({
      where: { accountId, status: "pending", expiresAt: { gt: new Date() } },
    }),
  ]);

  const counts: SettingsCounts = {
    sections: m.settings.hub.counts.sections(sectionsTotal, sectionsInactive),
    categories: m.settings.hub.counts.categories(categories, subcategories),
    institutions: String(institutions),
    responsibles: String(responsibles),
    "table-types": String(tableTypes),
    models: String(models),
    dashboards: m.settings.hub.counts.dashboards(dashboardsCustomized, DASHBOARD_CONTEXT_TOTAL),
    templates: String(templates),
    aliases: String(aliases),
    connectors: m.settings.hub.counts.connectors(connectors),
    checklist: String(checklistItems),
    members: m.settings.hub.counts.members(members, pendingInvites),
  };

  return counts;
});
