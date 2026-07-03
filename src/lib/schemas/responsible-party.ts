import { z } from "zod";

import { ACCENT_COLOR_KEYS } from "@/lib/accent-colors";
import { PERSONA_ICON_KEYS } from "@/lib/persona-icons";

// Id de party: aceita cuid (criadas no app) OU uuid (backfill da migração inicial).
// Não é um id que o cliente inventa — ele só ecoa o que veio do banco — então
// validamos apenas "string não-vazia" em vez de travar num formato específico.
export const partyIdSchema = z.string().min(1, "ID inválido");

// Ícone = chave de set curado (não emoji livre). Ver src/lib/persona-icons.ts.
export const iconKeySchema = z.enum(PERSONA_ICON_KEYS);
// Cor = chave da paleta accent do sistema. Ver src/lib/accent-colors.ts.
export const colorKeySchema = z.enum(ACCENT_COLOR_KEYS as [string, ...string[]]);

const nameSchema = z.string().min(1, "Nome obrigatório").max(40).trim();

// Só `group` e `external` são criáveis via UI. `personal` é auto-gerido (uma por membro).
export const createResponsiblePartySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("group"),
    name: nameSchema,
    icon: iconKeySchema.nullable().optional(),
    color: colorKeySchema.nullable().optional(),
    memberUserIds: z
      .array(z.string().cuid("ID inválido"))
      .min(2, "Grupo exige ao menos 2 membros"),
  }),
  z.object({
    kind: z.literal("external"),
    name: nameSchema,
    icon: iconKeySchema.nullable().optional(),
    color: colorKeySchema.nullable().optional(),
  }),
]);

export const updateResponsiblePartySchema = z.object({
  partyId: partyIdSchema,
  name: nameSchema.optional(),
  icon: iconKeySchema.nullable().optional(),
  color: colorKeySchema.nullable().optional(),
  memberUserIds: z.array(z.string().cuid("ID inválido")).min(2, "Grupo exige ao menos 2 membros").optional(),
});

export const archiveResponsiblePartySchema = z.object({
  partyId: partyIdSchema,
  archived: z.boolean(),
});

export const deleteResponsiblePartySchema = z.object({
  partyId: partyIdSchema,
});

export type CreateResponsiblePartyInput = z.infer<typeof createResponsiblePartySchema>;
export type UpdateResponsiblePartyInput = z.infer<typeof updateResponsiblePartySchema>;
export type ArchiveResponsiblePartyInput = z.infer<typeof archiveResponsiblePartySchema>;
export type DeleteResponsiblePartyInput = z.infer<typeof deleteResponsiblePartySchema>;
