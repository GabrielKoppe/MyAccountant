import { z } from "zod";

import { partyIdSchema } from "./responsible-party";
import {
  TransactionExpenseType,
  TransactionPaymentMethod,
  investmentTypeSchema,
} from "./transaction";

// Id de apelido: sempre gerado pelo app (cuid) — sem cenário de backfill legado.
export const aliasIdSchema = z.string().cuid("ID inválido");

// Gatilho curto (<3 chars) é permitido — o aviso é só de UI (DD-19). Aqui só
// garantimos não-vazio (DD-18/§2.1) e um teto de tamanho.
const triggerSchema = z.string().trim().min(1, "Gatilho obrigatório").max(80);

// Payload — todos opcionais (patch parcial; DD-04). `null` = "não define".
const basePayloadSchema = z.object({
  trigger: triggerSchema,
  description: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  amountCents: z.coerce.bigint().optional().nullable(),
  categoryId: z.string().cuid("ID inválido").nullable().optional(),
  subcategoryId: z.string().cuid("ID inválido").nullable().optional(),
  institutionId: z.string().cuid("ID inválido").nullable().optional(),
  institutionText: z.string().max(80).optional().nullable(),
  responsiblePartyId: partyIdSchema.nullable().optional(),
  expenseType: z.nativeEnum(TransactionExpenseType).nullable().optional(),
  paymentMethod: z.nativeEnum(TransactionPaymentMethod).nullable().optional(),
  investmentType: investmentTypeSchema,
  cardInstallment: z
    .string()
    .regex(/^\d+\/\d+$/, "Formato: 3/12")
    .optional()
    .nullable(),
  isPending: z.boolean().nullable().optional(),
  isFavorite: z.boolean().nullable().optional(),
  // Moeda estrangeira (DD-22): fill-if-empty na importação (só quando o extrato
  // não traz FX; valor do extrato prevalece = DD-09). Não aplica no popover manual.
  originalCurrency: z.string().max(3).optional().nullable(),
  exchangeRate: z.coerce.number().positive().optional().nullable(),
  originalAmountCents: z.coerce.bigint().optional().nullable(),
  // Conjunto de tags do apelido (não da transação-alvo). [] = apelido não toca tags (DD-04).
  tagIds: z.array(z.string().cuid("ID inválido")),
});

// DD-14: institutionId e institutionText são mutuamente exclusivos.
function checkInstitutionExclusivity(
  data: { institutionId?: string | null; institutionText?: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.institutionId && data.institutionText) {
    ctx.addIssue({
      code: "custom",
      message: "Instituição e texto livre não podem ser combinados",
      path: ["institutionText"],
    });
  }
}

// DD-18 (backstop de presença): subcategoria exige categoria no mesmo payload.
// O vínculo pai/filho em si (subcat pertence à categoria) é checado no service
// contra o banco — aqui só valida presença, o que só é conclusivo na criação
// (no update parcial, o service resolve contra o valor já persistido).
function checkCategorySubcategoryPresence(
  data: { categoryId?: string | null; subcategoryId?: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.subcategoryId && !data.categoryId) {
    ctx.addIssue({
      code: "custom",
      message: "Selecione uma categoria para definir a subcategoria",
      path: ["subcategoryId"],
    });
  }
}

// DD-22: valor original / câmbio não fazem sentido sem a moeda que os denomina.
// A moeda sozinha é permitida (marca "este apelido é em USD"). Só no create — no
// update parcial o valor efetivo da moeda pode já estar persistido (não visível ao Zod).
function checkForeignCurrencyPresence(
  data: {
    originalCurrency?: string | null;
    originalAmountCents?: bigint | null;
    exchangeRate?: number | null;
  },
  ctx: z.RefinementCtx,
) {
  if ((data.originalAmountCents != null || data.exchangeRate != null) && !data.originalCurrency) {
    ctx.addIssue({
      code: "custom",
      message: "Informe a moeda para definir valor original ou câmbio",
      path: ["originalCurrency"],
    });
  }
}

export const createTransactionAliasSchema = basePayloadSchema.superRefine((data, ctx) => {
  checkInstitutionExclusivity(data, ctx);
  checkCategorySubcategoryPresence(data, ctx);
  checkForeignCurrencyPresence(data, ctx);
});

export const updateTransactionAliasSchema = basePayloadSchema
  .partial()
  .extend({ aliasId: aliasIdSchema })
  .superRefine((data, ctx) => {
    checkInstitutionExclusivity(data, ctx);
  });

export const archiveTransactionAliasSchema = z.object({
  aliasId: aliasIdSchema,
  archived: z.boolean(),
});

export const deleteTransactionAliasSchema = z.object({
  aliasId: aliasIdSchema,
});

export type CreateTransactionAliasInput = z.infer<typeof createTransactionAliasSchema>;
export type UpdateTransactionAliasInput = z.infer<typeof updateTransactionAliasSchema>;
export type ArchiveTransactionAliasInput = z.infer<typeof archiveTransactionAliasSchema>;
export type DeleteTransactionAliasInput = z.infer<typeof deleteTransactionAliasSchema>;
