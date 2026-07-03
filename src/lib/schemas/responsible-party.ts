import { z } from "zod";

// Emoji único: exige um único grapheme contendo pictograma. Rejeita string arbitrária.
export const emojiSchema = z
  .string()
  .trim()
  .refine((s) => s.length > 0 && /\p{Extended_Pictographic}/u.test(s), "Escolha um emoji")
  .refine((s) => [...new Intl.Segmenter().segment(s)].length === 1, "Apenas um emoji");

const nameSchema = z.string().min(1, "Nome obrigatório").max(40).trim();

// Só `group` e `external` são criáveis via UI. `personal` é auto-gerido (uma por membro).
export const createResponsiblePartySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("group"),
    name: nameSchema,
    icon: emojiSchema.nullable().optional(),
    memberUserIds: z
      .array(z.string().cuid("ID inválido"))
      .min(2, "Grupo exige ao menos 2 membros"),
  }),
  z.object({
    kind: z.literal("external"),
    name: nameSchema,
    icon: emojiSchema.nullable().optional(),
  }),
]);

export const updateResponsiblePartySchema = z.object({
  partyId: z.string().cuid("ID inválido"),
  name: nameSchema.optional(),
  icon: emojiSchema.nullable().optional(),
  memberUserIds: z.array(z.string().cuid("ID inválido")).min(2, "Grupo exige ao menos 2 membros").optional(),
});

export const archiveResponsiblePartySchema = z.object({
  partyId: z.string().cuid("ID inválido"),
  archived: z.boolean(),
});

export const deleteResponsiblePartySchema = z.object({
  partyId: z.string().cuid("ID inválido"),
});

export type CreateResponsiblePartyInput = z.infer<typeof createResponsiblePartySchema>;
export type UpdateResponsiblePartyInput = z.infer<typeof updateResponsiblePartySchema>;
export type ArchiveResponsiblePartyInput = z.infer<typeof archiveResponsiblePartySchema>;
export type DeleteResponsiblePartyInput = z.infer<typeof deleteResponsiblePartySchema>;
