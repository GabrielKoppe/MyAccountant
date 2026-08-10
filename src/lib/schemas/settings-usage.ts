// Spec 67 §2.4 / §9 P5 (SET-07) — contrato da contagem de uso sob demanda.
//
// Módulo PURO de propósito: é a fonte única do enum de entidades contáveis, e é
// importado tanto pelo client (modal "Ver uso") quanto pelo service. Nada de
// Prisma aqui — o service é que traduz cada entidade para um filtro de
// `Transaction` (ver `src/server/services/settings-usage-service.ts`).

import { z } from "zod";

import { cuidSchema } from "./shared";

/**
 * Entidades cuja contagem REAL de transações é calculável.
 *
 * Só entram as que têm caminho direto até `Transaction` (por FK própria ou pela
 * tabela). Entidades de configuração sem esse caminho — `tableTemplate`,
 * `csvTemplate`, `transactionAlias`, `checklistItem` — não têm "uso em
 * transações" a contar: o raio de impacto delas é de referências de
 * configuração, contadas à parte (Spec 67 §2.4, último parágrafo).
 */
export const COUNTABLE_USAGE_ENTITIES = [
  "section",
  "category",
  "subcategory",
  "institution",
  "responsibleParty",
  "tableType",
] as const;

export const countableUsageEntitySchema = z.enum(COUNTABLE_USAGE_ENTITIES);
export type CountableUsageEntity = z.infer<typeof countableUsageEntitySchema>;

export const countUsageSchema = z.object({
  entity: countableUsageEntitySchema,
  entityId: cuidSchema,
  /** `true` = "Recontar": ignora o cache de 24 h e varre `Transaction` de novo. */
  force: z.boolean().optional(),
});

export type CountUsageInput = z.infer<typeof countUsageSchema>;
