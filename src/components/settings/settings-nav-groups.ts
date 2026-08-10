// Spec 67 §2 / §4 (SET-01) — mapa único de famílias do sidebar de Configurações.
//
// Módulo PURO (sem "use client", sem hooks): fonte única de verdade para o
// agrupamento por família e para o gating por papel (owner/editor/viewer).
//
// Reclassificação da Spec 67 §6 em relação à Spec 65 §7.2: eram 6 famílias
// desiguais (Estrutura/Importação/Planejamento/Visualização/Integrações/Conta),
// viram 5 equilibradas por INTENÇÃO — "Tipos de tabela" e "Modelos" saem de
// Importação (não são importação, são apresentação) e "Conectores de IA" entra
// em Entrada de dados (sua função real é classificar o que entra).
//
// Nenhum link novo é criado aqui — apenas reagrupamento dos links reais.

import type { AccountMemberRole } from "@prisma/client";

import { getSettingsFamilies } from "@/components/settings/settings-catalog";

/** Contagem barata exibida à direita do rótulo (Spec 67 §4 SET-01). */
export type NavLink = { href: string; label: string; count?: string };

export type CollapsibleNavEntry = {
  type: "collapsible";
  label: string;
  count?: string;
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
 * Contagens baratas por objeto, para exibir à direita de cada link.
 *
 * Todas as chaves são opcionais: quando ausente, o link renderiza sem contagem.
 * Strings, não números — cada objeto formata a sua ("18 · 47 sub", "1 conectado").
 * Ver `getSettingsCounts` em `@/server/queries/settings-counts`.
 */
export type SettingsNavCounts = Partial<Record<string, string>>;

/**
 * Constrói os grupos (famílias) do sidebar de Configurações para um papel.
 *
 * - `owner`: as 5 famílias completas, incluindo Auditoria (Conta).
 * - `editor`: as mesmas 5 famílias, sem Auditoria (owner-only).
 * - `viewer`: carve-out do NAV-04 (Spec 65 §10.5, mantido pela Spec 67 D3) —
 *   apenas a família Conta, com o único link de Membros (em modo leitura; a
 *   página se auto-protege via `MembersTable`/`InviteForm`, que já restringem
 *   ações a owner).
 */
export function buildSettingsNavGroups(
  role: AccountMemberRole,
  counts: SettingsNavCounts = {},
): NavGroup[] {
  const link = (href: string, label: string): NavLink => ({
    href,
    label,
    ...(counts[href] !== undefined ? { count: counts[href] } : {}),
  });

  return getSettingsFamilies(role).map((family) => ({
    label: family.label,
    entries: family.entries.map(
      (entry): NavEntry =>
        // Item com sub-rotas (Dashboards) vira colapsável; os demais, link simples.
        entry.subRoutes
          ? {
              type: "collapsible",
              label: entry.label,
              ...(counts[entry.href] !== undefined ? { count: counts[entry.href] } : {}),
              subLinks: entry.subRoutes.map((sub) => link(sub.href, sub.label)),
            }
          : link(entry.href, entry.label),
    ),
  }));
}
