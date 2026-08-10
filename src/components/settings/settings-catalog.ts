// Spec 67 §6 — catálogo canônico das 5 famílias de Configurações.
//
// FONTE ÚNICA: o nav (`settings-nav-groups`) e o hub (`SettingsHub`) derivam
// daqui. É o que garante o critério do §8 — "mapeamento família→páginas cobre
// as 17 rotas sem órfão nem duplicata" — em UM lugar só, em vez de duas listas
// que se desencontram na primeira página nova.
//
// Módulo PURO: sem JSX, sem React. O ícone é uma CHAVE resolvida em
// `settings-icons.tsx` — assim o catálogo continua testável sem renderizar nada.

import type { AccountMemberRole } from "@prisma/client";

import { m } from "@/lib/messages";

export type SettingsFamilyKey = "structure" | "presentation" | "dataEntry" | "planning" | "account";

export type SettingsIconKey =
  | "sections"
  | "categories"
  | "institutions"
  | "responsibles"
  | "tableTypes"
  | "models"
  | "dashboards"
  | "templates"
  | "aliases"
  | "connectors"
  | "forecast"
  | "checklist"
  | "general"
  | "members"
  | "audit";

export type SettingsEntry = {
  /** Chave da contagem barata e do link, relativa a `/[accountId]/settings/`. */
  href: string;
  label: string;
  /** Subtítulo do hub — diz o que a página faz, em 3–5 palavras. */
  subtitle: string;
  icon: SettingsIconKey;
  /** Rotas extras que este item representa no nav (Dashboards = 3 sub-rotas, D4). */
  subRoutes?: Array<{ href: string; label: string }>;
  /** Só `owner` vê (Trilha de auditoria). */
  ownerOnly?: boolean;
};

export type SettingsFamily = {
  key: SettingsFamilyKey;
  label: string;
  icon: "structure" | "presentation" | "dataEntry" | "planning" | "account";
  /** A família inteira só aparece para `owner`? (Conta é marcada, mas ver §4.) */
  ownerBadge?: boolean;
  /**
   * Card largo do hub: ocupa duas colunas do grid e dispõe as entradas EM LINHA,
   * lado a lado, em vez de empilhadas (frame de arquitetura, `grid-column: span 2`
   * + `grid-template-columns: 1fr 1fr 1fr`).
   *
   * É o desenho da família Conta: administração de baixa frequência e alto
   * impacto, isolada no rodapé do hub numa faixa própria — não mais um card
   * igual aos outros quatro.
   */
  wide?: boolean;
  /**
   * Cor do ícone e do badge no cabeçalho do card.
   *
   * O frame de arquitetura usa `--accent` nas quatro primeiras famílias e
   * `--warning` na Conta: administração é de baixa frequência e alto impacto, e
   * o mostarda é o aviso disso. Default `accent`.
   */
  tone?: "accent" | "warning";
  entries: SettingsEntry[];
};

/**
 * As 5 famílias, na ordem em que aparecem no nav e no hub.
 *
 * Reclassificação da Spec 67 §6 frente à Spec 65 §7.2: "Tipos de tabela" e
 * "Modelos" saíram de Importação (não são importação — são apresentação) e
 * "Conectores de IA" entrou em Entrada de dados (sua função real é classificar
 * o que entra).
 */
export const SETTINGS_FAMILIES: SettingsFamily[] = [
  {
    key: "structure",
    label: m.settings.nav.groups.structure,
    icon: "structure",
    entries: [
      {
        href: "sections",
        label: m.settings.nav.sections,
        subtitle: m.settings.hub.rows.sections,
        icon: "sections",
      },
      {
        href: "categories",
        label: m.settings.nav.categories,
        subtitle: m.settings.hub.rows.categories,
        icon: "categories",
      },
      {
        href: "institutions",
        label: m.settings.nav.institutions,
        subtitle: m.settings.hub.rows.institutions,
        icon: "institutions",
      },
      {
        href: "responsibles",
        label: m.settings.nav.responsibles,
        subtitle: m.settings.hub.rows.responsibles,
        icon: "responsibles",
      },
    ],
  },
  {
    key: "presentation",
    label: m.settings.nav.groups.presentation,
    icon: "presentation",
    entries: [
      {
        href: "table-types",
        label: m.settings.nav.tableTypes,
        subtitle: m.settings.hub.rows.tableTypes,
        icon: "tableTypes",
      },
      {
        href: "models",
        label: m.tableModels.title,
        subtitle: m.settings.hub.rows.models,
        icon: "models",
      },
      {
        // D4: uma linha no hub e um item colapsável no nav — nunca três linhas.
        href: "dashboards",
        label: m.settings.nav.groups.dashboardsLabel,
        subtitle: m.settings.hub.rows.dashboards,
        icon: "dashboards",
        subRoutes: [
          { href: "dashboards/monthly", label: m.settings.nav.dashboards.monthly },
          { href: "dashboards/yearly", label: m.settings.nav.dashboards.yearly },
          { href: "dashboards/month-summary", label: m.settings.nav.dashboards.monthSummary },
        ],
      },
    ],
  },
  {
    key: "dataEntry",
    label: m.settings.nav.groups.dataEntry,
    icon: "dataEntry",
    entries: [
      {
        href: "templates",
        label: m.settings.nav.templates,
        subtitle: m.settings.hub.rows.templates,
        icon: "templates",
      },
      {
        href: "aliases",
        label: m.settings.nav.aliases,
        subtitle: m.settings.hub.rows.aliases,
        icon: "aliases",
      },
      {
        href: "connectors",
        label: m.settings.nav.connectors,
        subtitle: m.settings.hub.rows.connectors,
        icon: "connectors",
      },
    ],
  },
  {
    key: "planning",
    label: m.settings.nav.groups.planning,
    icon: "planning",
    entries: [
      {
        href: "forecast",
        label: m.settings.nav.forecast,
        subtitle: m.settings.hub.rows.forecast,
        icon: "forecast",
      },
      {
        href: "checklist",
        label: m.settings.nav.checklist,
        subtitle: m.settings.hub.rows.checklist,
        icon: "checklist",
      },
    ],
  },
  {
    key: "account",
    label: m.settings.nav.groups.account,
    icon: "account",
    ownerBadge: true,
    // Faixa larga no rodapé do hub, com as entradas lado a lado — ver `wide`.
    wide: true,
    tone: "warning",
    entries: [
      {
        href: "general",
        label: m.settings.nav.general,
        subtitle: m.settings.hub.rows.general,
        icon: "general",
      },
      {
        href: "members",
        label: m.settings.nav.members,
        subtitle: m.settings.hub.rows.members,
        icon: "members",
      },
      {
        href: "audit",
        label: m.settings.nav.audit,
        subtitle: m.settings.hub.rows.audit,
        icon: "audit",
        ownerOnly: true,
      },
    ],
  },
];

/**
 * Recorta o catálogo pelo papel do membro.
 *
 * - `owner`: tudo.
 * - `editor`: tudo menos os itens `ownerOnly` (hoje, só a Trilha de auditoria).
 * - `viewer`: carve-out do NAV-04 (Spec 65 §10.5, mantido pela Spec 67 D3) —
 *   apenas a família Conta com o único link de Membros. O `viewer` NÃO é
 *   redirecionado para fora de `/settings/*`.
 *
 * O `ownerBadge` ("somente owner") só sobrevive para o `owner`: para qualquer
 * outro papel ele mentiria — o `editor` abre Geral e Membros da família Conta.
 */
export function getSettingsFamilies(role: AccountMemberRole): SettingsFamily[] {
  if (role === "viewer") {
    const account = SETTINGS_FAMILIES.find((family) => family.key === "account");
    const members = account?.entries.find((entry) => entry.href === "members");
    if (!account || !members) return [];
    // `wide: false` — a faixa larga existe para dispor VÁRIAS entradas lado a
    // lado; com o único link de Membros ela viraria um card de 2/3 de largura
    // sozinho no hub.
    return [{ ...account, ownerBadge: false, wide: false, entries: [members] }];
  }

  if (role === "owner") return SETTINGS_FAMILIES;

  return SETTINGS_FAMILIES.map((family) => ({
    ...family,
    ownerBadge: false,
    entries: family.entries.filter((entry) => !entry.ownerOnly),
  }));
}

/** Todas as rotas reais que o catálogo cobre (Dashboards conta como 3 — D4). */
export function listSettingsRoutes(role: AccountMemberRole): string[] {
  return getSettingsFamilies(role).flatMap((family) =>
    family.entries.flatMap((entry) =>
      entry.subRoutes ? entry.subRoutes.map((sub) => sub.href) : [entry.href],
    ),
  );
}
