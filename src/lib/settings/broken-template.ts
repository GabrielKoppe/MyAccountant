// Spec 67 §2.1 (D9) — regra "template de importação quebrado".
//
// POR QUE UM MÓDULO PURO E SEPARADO: `CsvTemplate.mapping` é uma coluna `Json`
// SEM foreign key. Excluir uma Category/Institution ou remover um membro da
// conta NÃO limpa o mapeamento — o id órfão fica lá e só estoura na próxima
// importação. Logo a validação é feita em memória, e precisa existir em UM
// lugar só: o sinalizador do hub (`settings-attention.ts`) e o filtro
// `?filter=broken` da página de Templates consomem esta mesma função.
//
// Sem React e sem Prisma de propósito: testável direto, sem mock.

import { importMappingSchema } from "@/lib/schemas/csv-import";

/**
 * Conjuntos de ids que EXISTEM hoje na conta. O chamador é quem carrega —
 * assim a função continua pura e o custo da query fica visível em quem a faz.
 */
export type TemplateReferenceSets = {
  /** Ids de `Category` da conta. */
  categoryIds: ReadonlySet<string>;
  /** Ids de `Institution` da conta. */
  institutionIds: ReadonlySet<string>;
  /** `userId` dos `AccountMember` da conta. */
  memberUserIds: ReadonlySet<string>;
};

/**
 * Um template está quebrado por duas causas independentes:
 *
 * B1 · estrutural — o JSON não satisfaz mais o `importMappingSchema` (template
 *      salvo por versão antiga do schema, ou escrito à mão via import de JSON).
 * B2 · referência órfã — o mapeamento aponta para uma Category, Institution ou
 *      membro que não existe mais na conta.
 *
 * @param mapping o `CsvTemplate.mapping` cru (Prisma.JsonValue — pode ser qualquer coisa)
 */
export function isTemplateBroken(mapping: unknown, refs: TemplateReferenceSets): boolean {
  // B1 — se nem parseia, nem adianta olhar referência.
  const parsed = importMappingSchema.safeParse(mapping);
  if (!parsed.success) return true;

  const { defaultCategoryId, defaultInstitutionId, responsibleUserMappings } = parsed.data;

  // B2 — `null` é "sem padrão" e é legítimo; só id preenchido é verificado.
  if (defaultCategoryId !== null && !refs.categoryIds.has(defaultCategoryId)) return true;
  if (defaultInstitutionId !== null && !refs.institutionIds.has(defaultInstitutionId)) return true;

  return responsibleUserMappings.some((entry) => !refs.memberUserIds.has(entry.userId));
}
