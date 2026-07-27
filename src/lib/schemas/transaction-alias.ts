import { AliasMatchMode, AliasPriority } from "@prisma/client";
import { z } from "zod";

import { isLikelyCatastrophicRegex } from "../rules/safe-regex";

import { partyIdSchema } from "./responsible-party";
import { amountCentsSchema, cuidSchema } from "./shared";
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
  // Correspondência avançada (poderes herdados da Regra, spec 50): modo do
  // gatilho + prioridade no desempate + condições (AND com o gatilho).
  triggerMode: z.nativeEnum(AliasMatchMode).default(AliasMatchMode.contains),
  priority: z.nativeEnum(AliasPriority).default(AliasPriority.medium),
  conditionInstitutionId: cuidSchema.optional().nullable(),
  // Faixa de valor em BigInt centavos — NUNCA Float (money-handling).
  minCents: amountCentsSchema.optional().nullable(),
  maxCents: amountCentsSchema.optional().nullable(),
  description: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  amountCents: z.coerce.bigint().optional().nullable(),
  categoryId: cuidSchema.nullable().optional(),
  subcategoryId: cuidSchema.nullable().optional(),
  institutionId: cuidSchema.nullable().optional(),
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
  tagIds: z.array(cuidSchema),
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

// Correspondência avançada: no modo regex o próprio GATILHO é a expressão
// regular. Validamos aqui (no salvamento): precisa compilar E não ter forma de
// backtracking catastrófico (guarda anti-ReDoS; ver src/lib/rules/safe-regex.ts).
// O motor (match.ts) assume padrão válido em runtime.
function checkTriggerRegexValidity(
  data: { triggerMode?: AliasMatchMode | null; trigger?: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.triggerMode === "regex" && data.trigger) {
    try {
      new RegExp(data.trigger);
    } catch {
      ctx.addIssue({ code: "custom", message: "Expressão regular inválida", path: ["trigger"] });
      return;
    }
    if (isLikelyCatastrophicRegex(data.trigger)) {
      ctx.addIssue({
        code: "custom",
        message: "Expressão regular muito complexa (risco de travamento). Simplifique o padrão.",
        path: ["trigger"],
      });
    }
  }
}

export const createTransactionAliasSchema = basePayloadSchema.superRefine((data, ctx) => {
  checkInstitutionExclusivity(data, ctx);
  checkCategorySubcategoryPresence(data, ctx);
  checkForeignCurrencyPresence(data, ctx);
  checkTriggerRegexValidity(data, ctx);
});

export const updateTransactionAliasSchema = basePayloadSchema
  .partial()
  .extend({ aliasId: aliasIdSchema })
  .superRefine((data, ctx) => {
    checkInstitutionExclusivity(data, ctx);
    checkTriggerRegexValidity(data, ctx);
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
