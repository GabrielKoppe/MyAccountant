// Spec 65 §7.2/§10.3 (P7) — mapa único de famílias do sidebar de Configurações.
//
// Módulo PURO (sem "use client", sem hooks): fonte única de verdade para o
// agrupamento por família (Estrutura/Importação/Planejamento/Visualização/
// Integrações/Conta) e para o gating por papel (owner/editor/viewer).
//
// Nenhum link novo é criado aqui — apenas reagrupamento dos editorLinks/
// ownerLinks reais que hoje vivem em settings/layout.tsx (ver §7.2 da spec).

import type { AccountMemberRole } from "@prisma/client";

import { m } from "@/lib/messages";

export type NavLink = { href: string; label: string };

export type CollapsibleNavEntry = {
  type: "collapsible";
  label: string;
  subLinks: NavLink[];
};

export type NavEntry = NavLink | CollapsibleNavEntry;

/** Type guard: estreita `NavEntry` para `CollapsibleNavEntry` (o ramo `else` vira `NavLink`). */
export function isCollapsibleNavEntry(entry: NavEntry): entry is CollapsibleNavEntry {
  return "type" in entry && entry.type === "collapsible";
}

export type NavGroup = {
  /** Cabeçalho `overline` da família (ex.: "Estrutura", "Conta"). */
  label: string;
  entries: NavEntry[];
};

/**
 * Constrói os grupos (famílias) do sidebar de Configurações para um papel.
 *
 * - `owner`: as 6 famílias completas, incluindo Auditoria (Conta).
 * - `editor`: as mesmas 6 famílias, sem Auditoria (owner-only).
 * - `viewer`: carve-out do NAV-04 — apenas a família Conta, com o único
 *   link de Membros (em modo leitura; a página se auto-protege via
 *   `MembersTable`/`InviteForm`, que já restringem ações a owner).
 */
export function buildSettingsNavGroups(role: AccountMemberRole): NavGroup[] {
  if (role === "viewer") {
    return [
      {
        label: m.settings.nav.groups.account,
        entries: [{ href: "members", label: m.settings.nav.members }],
      },
    ];
  }

  const isOwner = role === "owner";

  const accountEntries: NavLink[] = [
    { href: "general", label: m.settings.nav.general },
    { href: "members", label: m.settings.nav.members },
    ...(isOwner ? [{ href: "audit", label: m.settings.nav.audit }] : []),
  ];

  return [
    {
      label: m.settings.nav.groups.structure,
      entries: [
        { href: "sections", label: m.settings.nav.sections },
        { href: "categories", label: m.settings.nav.categories },
        { href: "institutions", label: m.settings.nav.institutions },
        { href: "responsibles", label: m.settings.nav.responsibles },
      ],
    },
    {
      label: m.settings.nav.groups.import,
      entries: [
        { href: "models", label: m.tableModels.title },
        { href: "templates", label: m.settings.nav.templates },
        { href: "aliases", label: m.settings.nav.aliases },
        { href: "table-types", label: m.settings.nav.tableTypes },
      ],
    },
    {
      label: m.settings.nav.groups.planning,
      entries: [
        { href: "checklist", label: m.settings.nav.checklist },
        { href: "forecast", label: m.settings.nav.forecast },
      ],
    },
    {
      label: m.settings.nav.groups.visualization,
      entries: [
        {
          type: "collapsible",
          label: m.settings.nav.groups.dashboardsLabel,
          subLinks: [
            { href: "dashboards/monthly", label: m.settings.nav.dashboards.monthly },
            { href: "dashboards/yearly", label: m.settings.nav.dashboards.yearly },
            { href: "dashboards/month-summary", label: m.settings.nav.dashboards.monthSummary },
          ],
        },
      ],
    },
    {
      label: m.settings.nav.groups.integrations,
      entries: [{ href: "connectors", label: m.settings.nav.connectors }],
    },
    {
      label: m.settings.nav.groups.account,
      entries: accountEntries,
    },
  ];
}
