import { z } from "zod";

import { partyIdSchema } from "./responsible-party";
import { amountCentsSchema, cuidSchema, dateSchema } from "./shared";

const nameSchema = z.string().min(1, "Nome obrigatório").max(80).trim();

// targetCents / amountCents: BigInt centavos, sempre > 0 (GOAL-01 / GOAL-03, spec 47 §7).
const positiveCentsSchema = amountCentsSchema.positive("Valor deve ser maior que zero");

// contributedOn não pode ser futuro — mesmo padrão de capturedOn em balance-account.ts.
// "Hoje" é aceito (comparação pelo instante atual, não pelo início do dia).
const notFuture = (d: Date) => d <= new Date();
const futureMsg = "Data não pode ser futura";

// deadline não pode estar no passado — "hoje" é aceito. Comparação pelo início do
// dia em UTC (não local), pois z.coerce.date() interpreta strings "YYYY-MM-DD"
// como meia-noite UTC (ver skill date-timezone).
const notPast = (d: Date) => {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  return d >= startOfToday;
};
const pastMsg = "Prazo não pode estar no passado";

// Upper-bound do deadline (B1, fix wave spec 47 — blocker): sem teto, uma meta com
// prazo absurdamente distante combinada a um aporte médio minúsculo faz
// `monthsToComplete`/`projectedMonth` (goal-service.ts:computePace) disparar antes
// mesmo daquele clamp por MAX_HORIZON_MONTHS entrar em ação — barrar na entrada
// evita depender só do clamp do glide-path. 50 anos é folga generosa pra qualquer
// meta de poupança real. Mesmo estilo UTC de `notPast` acima.
const MAX_DEADLINE_YEARS = 50;
const notTooFarFuture = (d: Date) => {
  const maxDeadline = new Date();
  maxDeadline.setUTCHours(0, 0, 0, 0);
  maxDeadline.setUTCFullYear(maxDeadline.getUTCFullYear() + MAX_DEADLINE_YEARS);
  return d <= maxDeadline;
};
const tooFarMsg = "Prazo muito distante";

// Campos editáveis compartilhados entre criar/editar (idênticos — só o update soma goalId).
const goalFieldsSchema = z.object({
  name: nameSchema,
  targetCents: positiveCentsSchema,
  deadline: dateSchema
    .refine(notPast, pastMsg)
    .refine(notTooFarFuture, tooFarMsg)
    .optional()
    .nullable(),
  sectionId: cuidSchema.optional().nullable(),
  categoryId: cuidSchema.optional().nullable(),
});

export const createGoalSchema = goalFieldsSchema;

export const updateGoalSchema = goalFieldsSchema.extend({
  goalId: cuidSchema,
});

export const deleteGoalSchema = z.object({
  goalId: cuidSchema,
});

export const archiveGoalSchema = z.object({
  goalId: cuidSchema,
  archived: z.boolean(), // true=arquivar, false=desarquivar (DD-02)
});

export const addContributionSchema = z.object({
  goalId: cuidSchema,
  amountCents: positiveCentsSchema,
  contributedOn: dateSchema.refine(notFuture, futureMsg),
  // byUserId NÃO entra aqui — sempre do usuário autenticado (ctx), nunca do body (GOAL-03, §7).
  transactionId: cuidSchema.optional().nullable(),
  // partyIdSchema (não cuidSchema estrito): aceita cuid OU uuid legado, mesmo campo
  // de Transaction.responsiblePartyId (ver src/lib/schemas/transaction.ts).
  responsiblePartyId: partyIdSchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const deleteContributionSchema = z.object({
  contributionId: cuidSchema,
});

// Leitura sob demanda do drawer de detalhe (§5.3/§12 Fase 9) — Server Actions finas que
// só repassam accountId/goalId para getGoalDetail/getGoalSuggestions (queries/goals.ts).
// Schema próprio por ação (mesmo padrão de deleteGoalSchema/deleteContributionSchema
// acima, ainda que a forma seja idêntica — 1 schema por ação, não uma reexportação).
export const getGoalDetailSchema = z.object({
  goalId: cuidSchema,
});

export const getGoalSuggestionsSchema = z.object({
  goalId: cuidSchema,
});

// Vincular sugerido (§5.6/§11): 1 clique confirma o aporte a partir de uma transação
// sugerida. Sem amountCents/contributedOn/responsiblePartyId no body — tudo herdado da
// transação pelo service (linkTransactionAsContribution); byUserId sempre de ctx.
export const linkSuggestedContributionSchema = z.object({
  goalId: cuidSchema,
  transactionId: cuidSchema,
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type DeleteGoalInput = z.infer<typeof deleteGoalSchema>;
export type ArchiveGoalInput = z.infer<typeof archiveGoalSchema>;
export type AddContributionInput = z.infer<typeof addContributionSchema>;
export type DeleteContributionInput = z.infer<typeof deleteContributionSchema>;
export type LinkSuggestedContributionInput = z.infer<typeof linkSuggestedContributionSchema>;
export type GetGoalDetailInput = z.infer<typeof getGoalDetailSchema>;
export type GetGoalSuggestionsInput = z.infer<typeof getGoalSuggestionsSchema>;
