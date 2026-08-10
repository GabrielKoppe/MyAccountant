// Spec 67 §2.4 / §7.4 (SET-07, decisão D2) — estado ativo/inativo e rótulo de último uso.
//
// POR QUE ESTE MÓDULO EXISTE: as entidades de configuração NÃO têm um único
// mecanismo de "ativo". Três já tinham o seu antes da Spec 67 e continuam com
// ele (migrar seria destrutivo e criaria dupla fonte de verdade):
//
//   Section          -> isActive: Boolean
//   ResponsibleParty -> archivedAt: DateTime?
//   TransactionAlias -> archivedAt: DateTime?
//   demais           -> status: SettingsStatus (active | inactive)
//
// A UI nunca lê essas colunas: normaliza aqui para um `active: boolean` e é
// isso que `StatusCell` consome. Módulo PURO — sem React, sem Prisma.

import { formatMonthLabel } from "@/lib/dates";
import { m } from "@/lib/messages";

/** Valor do enum `SettingsStatus` do Prisma (Spec 67 §7.4). */
export type SettingsStatusValue = "active" | "inactive";

/** Gênero do substantivo para concordar o rótulo ("nunca usada" / "nunca usado"). */
export type SettingsGender = "f" | "m";

/**
 * As três formas de guardar "ativo" que convivem no schema.
 * Discriminada de propósito: o chamador declara a forma e não há como
 * confundir `archivedAt: null` (ativo) com `isActive: false` (inativo).
 */
export type ActiveSource =
  | { kind: "isActive"; isActive: boolean }
  | { kind: "archivedAt"; archivedAt: Date | string | null }
  | { kind: "status"; status: SettingsStatusValue };

/** Qual mecanismo cada entidade de configuração usa (Spec 67 §7.4). */
export const ACTIVE_SOURCE_KIND = {
  Section: "isActive",
  ResponsibleParty: "archivedAt",
  TransactionAlias: "archivedAt",
  Category: "status",
  Subcategory: "status",
  Institution: "status",
  TableType: "status",
  TableTemplate: "status",
  CsvTemplate: "status",
  ChecklistItem: "status",
} as const satisfies Record<string, ActiveSource["kind"]>;

export type SettingsEntityName = keyof typeof ACTIVE_SOURCE_KIND;

/** Normaliza qualquer um dos três mecanismos para um booleano. */
export function resolveActive(source: ActiveSource): boolean {
  switch (source.kind) {
    case "isActive":
      return source.isActive;
    case "archivedAt":
      return source.archivedAt === null || source.archivedAt === undefined;
    case "status":
      return source.status === "active";
  }
}

/**
 * Rótulo ao lado do toggle de status (Spec 67 §4 SET-07).
 *
 * Precedência — inativo vence sempre: um objeto desativado mostra "desativado",
 * não o mês em que foi usado pela última vez. É o estado que o usuário precisa
 * ver primeiro.
 *
 *   inativo            -> "desativado"
 *   ativo, sem uso     -> "nunca usada" / "nunca usado"
 *   ativo, com uso     -> "Jul/2026"
 *
 * `lastUsedAt` chega como `Date` (RSC) ou string ISO (serializado na fronteira
 * client). O mês é lido em UTC para o rótulo não oscilar com o fuso de quem
 * abre a página — é uma referência grosseira de recência, não um carimbo.
 */
export function formatLastUsedLabel({
  active,
  lastUsedAt,
  gender = "f",
}: {
  active: boolean;
  lastUsedAt: Date | string | null | undefined;
  gender?: SettingsGender;
}): string {
  if (!active) return m.settings.shell.status.deactivated;
  if (lastUsedAt === null || lastUsedAt === undefined) {
    return m.settings.shell.status.neverUsed(gender);
  }

  const date = lastUsedAt instanceof Date ? lastUsedAt : new Date(lastUsedAt);
  if (Number.isNaN(date.getTime())) return m.settings.shell.status.neverUsed(gender);

  return formatMonthLabel(date.getUTCFullYear(), date.getUTCMonth() + 1);
}
