import { z } from "zod";

import { PERSONA_ICON_KEYS } from "@/lib/persona-icons";

import { accentColorKeySchema, cuidSchema } from "./shared";

// Id de party: aceita cuid (criadas no app) OU uuid (backfill da migração inicial).
// Não é um id que o cliente inventa — ele só ecoa o que veio do banco — então
// validamos apenas "string não-vazia" em vez de travar num formato específico.
export const partyIdSchema = z.string().min(1, "ID inválido");

// Ícone = chave de set curado (não emoji livre). Ver src/lib/persona-icons.ts.
export const iconKeySchema = z.enum(PERSONA_ICON_KEYS);
// Cor = chave da paleta accent do sistema. Ver src/lib/accent-colors.ts.
export const colorKeySchema = accentColorKeySchema;

const nameSchema = z.string().min(1, "Nome obrigatório").max(40).trim();

// Spec 68 D4 — o vínculo é 0..N para QUALQUER `kind`, e não mais "grupo exige ≥2".
// Era essa regra que impedia "nenhum — só rótulo" de existir: um responsável pode
// agrupar duas pessoas, uma só, ou nenhuma (aí é só um rótulo da transação).
const memberUserIdsSchema = z.array(cuidSchema);

// "Tudo é responsável" — a distinção "grupo" × "pessoa externa" morreu (eram os dois
// "responsável com 0..N membros"; nada os diferenciava de verdade). Criar pela UI
// não escolhe mais `kind`: nasce sempre `group` no service, com 0, 1 ou N membros —
// zero é "nomear alguém externo", um é "criar uma persona", N é "vincular vários".
// `personal` continua existindo no banco, mas é auto-gerido (ver `ensurePersonalParty`)
// e nunca nasce por este schema.
export const createResponsiblePartySchema = z.object({
  name: nameSchema,
  icon: iconKeySchema.nullable().optional(),
  color: colorKeySchema.nullable().optional(),
  memberUserIds: memberUserIdsSchema,
});

export const updateResponsiblePartySchema = z.object({
  partyId: partyIdSchema,
  name: nameSchema.optional(),
  icon: iconKeySchema.nullable().optional(),
  color: colorKeySchema.nullable().optional(),
  memberUserIds: memberUserIdsSchema.optional(),
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
