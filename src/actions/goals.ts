"use server";

import {
  createGoalSchema,
  updateGoalSchema,
  deleteGoalSchema,
  archiveGoalSchema,
  addContributionSchema,
  deleteContributionSchema,
  linkSuggestedContributionSchema,
  getGoalDetailSchema,
  getGoalSuggestionsSchema,
} from "@/lib/schemas/goal";
import { defineAction } from "@/server/api/define-action";
import { revalidateGoals } from "@/server/api/revalidate";
import * as queries from "@/server/queries/goals";
import * as svc from "@/server/services/goal-service";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createGoalAction = defineAction({
  schema: createGoalSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const r = await svc.createGoal(input, ctx);
    revalidateGoals(ctx.accountId);
    return r;
  },
});

export const updateGoalAction = defineAction({
  schema: updateGoalSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.updateGoal(input, ctx);
    revalidateGoals(ctx.accountId);
  },
});

export const deleteGoalAction = defineAction({
  schema: deleteGoalSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.deleteGoal(input, ctx);
    revalidateGoals(ctx.accountId);
  },
});

export const archiveGoalAction = defineAction({
  schema: archiveGoalSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.archiveGoal(input, ctx);
    revalidateGoals(ctx.accountId);
  },
});

export const addContributionAction = defineAction({
  schema: addContributionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const r = await svc.addContribution(input, ctx);
    revalidateGoals(ctx.accountId);
    return r;
  },
});

export const deleteContributionAction = defineAction({
  schema: deleteContributionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.deleteContribution(input, ctx);
    revalidateGoals(ctx.accountId);
  },
});

export const linkSuggestedContributionAction = defineAction({
  schema: linkSuggestedContributionSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const r = await svc.linkTransactionAsContribution(input, ctx);
    revalidateGoals(ctx.accountId);
    return r;
  },
});

// ─── Leitura sob demanda do drawer de detalhe (§5.3/§12 Fase 9) ────────────
// Sem `requireRoles`: viewer também abre o drawer (só leitura — §5.2 "viewer → sem
// Aportar/Nova meta/⋮ de mutação; sugestões ocultas" é aplicado no client, que só
// chama getGoalSuggestionsAction quando `canEdit`). Mesmo mecanismo do drill-down dos
// dashboards (getDrawerTransactionsAction, src/actions/dashboards.ts): Server Action
// fina que só repassa ctx.accountId para a query React.cache já existente — nenhum
// cálculo é duplicado aqui.

export const getGoalDetailAction = defineAction({
  schema: getGoalDetailSchema,
  handler: async (input, ctx) => {
    return queries.getGoalDetail(ctx.accountId, input.goalId);
  },
});

export const getGoalSuggestionsAction = defineAction({
  schema: getGoalSuggestionsSchema,
  handler: async (input, ctx) => {
    return queries.getGoalSuggestions(ctx.accountId, input.goalId);
  },
});
