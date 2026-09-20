import { z } from "zod";

import { DAY_RULE_PATTERN } from "@/lib/day-rule";

import { partyIdSchema } from "./responsible-party";
import { cuidSchema } from "./shared";
import { investmentTypeSchema } from "./transaction";

/**
 * Spec 69 §2.2 (D2) — "Dia" relativo do item de modelo: `"5"`, `"last"` ou
 * `"firstBusiness"`. A coluna `day` continua obrigatória e é mantida em espelho
 * pelo serviço (`dayRuleToDay`), porque ainda ordena os itens.
 */
export const dayRuleSchema = z
  .string()
  .regex(DAY_RULE_PATTERN, 'Dia inválido — use 1 a 31, "last" ou "firstBusiness".');

// Campos de um item de modelo (equivale a uma transação sem data completa)
const templateItemFields = z.object({
  // `day` deixou de ser obrigatório na entrada: quem envia `dayRule` já disse
  // tudo, e o serviço deriva a coluna legada. Um dos dois tem que vir — garantido
  // pelo `superRefine` de `addTemplateItemSchema`.
  day: z.number().int().min(1).max(31).optional(),
  dayRule: dayRuleSchema.optional(),
  amountCents: z.coerce.bigint(),
  description: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  isPending: z.boolean().default(false),
  categoryId: cuidSchema.nullable().optional(),
  subcategoryId: cuidSchema.nullable().optional(),
  institutionId: cuidSchema.nullable().optional(),
  responsiblePartyId: partyIdSchema.nullable().optional(),
  cardInstallment: z
    .string()
    .regex(/^\d+\/\d+$/, "Formato: 3/12")
    .optional()
    .nullable(),
  investmentType: investmentTypeSchema,
  // Spec 69 §2.2 / P7 — a ordem da lista É a ordem em que as transações nascem na
  // tabela do mês, então o arraste precisa persistir. Fica em `templateItemFields`
  // (e não só no `add`) porque é o `update` que o reordenamento usa.
  displayOrder: z.number().int().min(0).optional(),
});

export const createTemplateFromTableSchema = z.object({
  tableId: cuidSchema,
  name: z.string().min(1, "Nome é obrigatório").max(80).trim(),
});

export const createTemplateManualSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80).trim(),
  description: z.string().max(200).optional(),
  tableTypeId: cuidSchema.nullable().optional(),
  countInMonth: z.boolean().default(true),
});

export const updateTemplateSchema = z.object({
  templateId: cuidSchema,
  name: z.string().min(1).max(80).trim().optional(),
  description: z.string().max(200).optional().nullable(),
  // Spec 69 D7 — campo ÚNICO do tipo de tabela do modelo. `autoTableTypeId`
  // continua aceito só para compatibilidade; o serviço mantém os dois em espelho.
  tableTypeId: cuidSchema.nullable().optional(),
  countInMonth: z.boolean().optional(),
  autoApply: z.boolean().optional(),
  autoSectionId: cuidSchema.nullable().optional(),
  // Spec 69 §2.2 — ordem do modelo dentro da seção de destino (só sob automação).
  orderInSection: z.number().int().min(0).nullable().optional(),
  /** @deprecated Spec 69 D7 — use `tableTypeId`. */
  autoTableTypeId: cuidSchema.nullable().optional(),
});

export const deleteTemplateSchema = z.object({
  templateId: cuidSchema,
});

export const addTemplateItemSchema = templateItemFields
  .extend({
    templateId: cuidSchema,
  })
  .superRefine((value, ctx) => {
    if (value.day === undefined && value.dayRule === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dayRule"],
        message: "Informe o dia da transação do modelo.",
      });
    }
  });

export const updateTemplateItemSchema = templateItemFields.partial().extend({
  itemId: cuidSchema,
});

export const deleteTemplateItemSchema = z.object({
  itemId: cuidSchema,
});

/**
 * Spec 69 §2.2 / P7 — "Importar de um mês": puxa as transações de uma tabela real
 * já existente como ponto de partida do modelo.
 *
 * Só os dois ids: **é append, não substituição.** Não há campo de "modo" porque
 * não existe modo — as transações atuais do modelo são preservadas e as
 * importadas entram no fim, sempre. Um flag aqui abriria a porta para o
 * comportamento destrutivo que a spec não pede.
 */
export const importTemplateItemsFromTableSchema = z.object({
  templateId: cuidSchema,
  tableId: cuidSchema,
});

export const applyTemplateSchema = z.object({
  templateId: cuidSchema,
  monthId: cuidSchema,
  sectionId: cuidSchema,
  name: z.string().min(1, "Nome é obrigatório").max(80).trim(),
  tableTypeId: cuidSchema.optional(),
  countInMonth: z.boolean().optional(),
});

export type CreateTemplateFromTableInput = z.infer<typeof createTemplateFromTableSchema>;
export type CreateTemplateManualInput = z.input<typeof createTemplateManualSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type DeleteTemplateInput = z.infer<typeof deleteTemplateSchema>;
export type AddTemplateItemInput = z.input<typeof addTemplateItemSchema>;
export type UpdateTemplateItemInput = z.infer<typeof updateTemplateItemSchema>;
export type DeleteTemplateItemInput = z.infer<typeof deleteTemplateItemSchema>;
export type ImportTemplateItemsFromTableInput = z.infer<typeof importTemplateItemsFromTableSchema>;
export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;
