"use server";

// Spec 68 §2.2 — transporte do modal M4 (importar categorias).
//
// Duas actions sobre a mesma classificação: `preview` só lê, `apply` grava. **Nada é
// gravado no preview** — é essa separação que sustenta a promessa da tela ("nada é
// gravado antes de você conferir esta lista").

import { categoryImportSchema } from "@/lib/schemas/settings";
import { defineAction } from "@/server/api/define-action";
import { revalidateCategories } from "@/server/api/revalidate";
import * as importService from "@/server/services/category-import-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

/** Classifica o arquivo e devolve o plano. Não grava nada. */
export const previewCategoryImportAction = defineAction({
  schema: categoryImportSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: (input, ctx) => importService.previewCategoryImport(input, ctx),
});

/**
 * Aplica o plano. O servidor RECLASSIFICA a partir do estado atual em vez de confiar
 * no que o cliente exibiu — entre abrir o modal e confirmar, outra pessoa da conta
 * pode ter mexido nas categorias.
 */
export const importCategoriesAction = defineAction({
  schema: categoryImportSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await importService.applyCategoryImport(input, ctx);
    revalidateCategories(ctx.accountId);
    return result;
  },
});
