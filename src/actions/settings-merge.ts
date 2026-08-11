"use server";

// Spec 68 §2.5 / §2.6 — transporte dos diálogos M5 (mesclar) e M2 (excluir com
// realocação). Arquivo próprio, e não dentro de `account-settings.ts`: as duas
// operações valem para quatro entidades diferentes e não pertencem a nenhuma delas.

import { configReferencesSchema, mergeEntitySchema } from "@/lib/schemas/settings";
import { defineAction } from "@/server/api/define-action";
import {
  revalidateCategories,
  revalidateInstitutions,
  revalidateResponsibleParties,
} from "@/server/api/revalidate";
import * as mergeService from "@/server/services/settings-merge-service";
import * as referencesService from "@/server/services/settings-references-service";

// Mesclar e excluir são gestos de gestão de configuração. `viewer` só alcança a
// família Conta / Membros (Spec 67 §4, D3) e não tem de onde disparar isto.
const EDITOR_ROLES = ["owner", "editor"] as const;

/**
 * Revalida a página da entidade mesclada. Categoria e subcategoria compartilham a
 * mesma rota; a mesclagem também mexe em apelidos e widgets, mas essas páginas leem
 * do servidor a cada visita — revalidar rota que ninguém está vendo é custo à toa.
 */
function revalidateForEntity(entity: referencesService.ReferencedEntity, accountId: string) {
  if (entity === "category" || entity === "subcategory") revalidateCategories(accountId);
  else if (entity === "institution") revalidateInstitutions(accountId);
  else revalidateResponsibleParties(accountId);
}

/**
 * Contagem de referências de configuração — barata, sem tocar `Transaction`.
 * Alimenta os chips do M5 e a lista verificada do M2.
 */
export const getConfigReferencesAction = defineAction({
  schema: configReferencesSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: (input, ctx) =>
    referencesService.getConfigReferences(ctx.accountId, input.entity, input.entityId),
});

/**
 * Mescla dois objetos de estrutura. **IRREVERSÍVEL** (D5): não existe undo, e o
 * diálogo precisa ter dito isso antes de chamar aqui.
 */
export const mergeEntityAction = defineAction({
  schema: mergeEntitySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await mergeService.mergeEntity(input, ctx);
    revalidateForEntity(input.entity, ctx.accountId);
    return result;
  },
});
