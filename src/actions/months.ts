"use server";

import {
  createMonthSchema,
  deleteMonthSchema,
  previewMonthAutomationsSchema,
} from "@/lib/schemas/months";
import { defineAction } from "@/server/api/define-action";
import * as monthService from "@/server/services/month-service";

export const createMonthAction = defineAction({
  schema: createMonthSchema,
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    const result = await monthService.createMonth(input, ctx);
    return result;
  },
});

/**
 * Lista o que a criação do mês vai lançar (modelos `autoApply` + parcelas
 * previstas), sem escrever nada — passo "Automações" do dialog (spec 73 §2.4).
 */
export const previewMonthAutomationsAction = defineAction({
  schema: previewMonthAutomationsSchema,
  requireRoles: ["owner", "editor"],
  handler: async (input, ctx) => {
    return monthService.previewMonthAutomations(input, ctx);
  },
});

export const deleteMonthAction = defineAction({
  schema: deleteMonthSchema,
  requireRoles: ["owner"],
  handler: async (input, ctx) => {
    await monthService.deleteMonth(input, ctx);
  },
});
