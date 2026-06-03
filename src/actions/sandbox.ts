"use server";

import { z } from "zod";

import { prisma } from "@/server/prisma";
import { defineAction } from "@/server/api/define-action";
import { AppError } from "@/server/api/errors";
import { getSandboxData, listSavedAnalyses } from "@/lib/queries/sandbox";
import {
  getSandboxDataSchema,
  saveSandboxAnalysisSchema,
  deleteAnalysisSchema,
  togglePinSchema,
} from "@/lib/schemas/sandbox";
import type { SandboxConfig } from "@/lib/schemas/sandbox";

const MAX_PINNED = 4;

export const getSandboxDataAction = defineAction({
  schema: getSandboxDataSchema,
  handler: async (input, ctx) => {
    const result = await getSandboxData(ctx.accountId, input.config, {
      currentMonthId: input.currentMonthId,
    });
    return {
      series: result.series,
      rows: result.rows,
      grandTotalCents: result.grandTotalCents.toString(),
    };
  },
});

export const saveSandboxAnalysisAction = defineAction({
  schema: saveSandboxAnalysisSchema,
  handler: async (input, ctx) => {
    if (input.id) {
      // Update existing — only creator or owner can update
      const existing = await prisma.savedAnalysis.findFirst({
        where: { id: input.id, accountId: ctx.accountId },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Análise não encontrada.");
      if (existing.createdById !== ctx.userId && ctx.role !== "owner") {
        throw new AppError("FORBIDDEN", "Apenas o criador ou o dono pode editar esta análise.");
      }

      // If enabling pin, check limit
      if (input.isPinned && !existing.isPinned) {
        const pinnedCount = await prisma.savedAnalysis.count({
          where: {
            accountId: ctx.accountId,
            isPinned: true,
            id: { not: input.id },
          },
        });
        if (pinnedCount >= MAX_PINNED) {
          throw new AppError("VALIDATION", "Limite de 4 análises fixadas atingido.");
        }
      }

      const updated = await prisma.savedAnalysis.update({
        where: { id: input.id },
        data: {
          name: input.name,
          config: input.config as object,
          dashboardContext: input.dashboardContext,
          isPinned: input.isPinned,
        },
      });
      return { id: updated.id };
    }

    // Create new
    if (input.isPinned) {
      const pinnedCount = await prisma.savedAnalysis.count({
        where: { accountId: ctx.accountId, isPinned: true },
      });
      if (pinnedCount >= MAX_PINNED) {
        throw new AppError("VALIDATION", "Limite de 4 análises fixadas atingido.");
      }
    }

    const maxOrder = await prisma.savedAnalysis
      .aggregate({ where: { accountId: ctx.accountId, isPinned: true }, _max: { pinnedOrder: true } })
      .then((r) => r._max.pinnedOrder ?? -1);

    const created = await prisma.savedAnalysis.create({
      data: {
        accountId: ctx.accountId,
        createdById: ctx.userId,
        name: input.name,
        config: input.config as object,
        dashboardContext: input.dashboardContext,
        isPinned: input.isPinned,
        pinnedOrder: input.isPinned ? maxOrder + 1 : 0,
      },
    });
    return { id: created.id };
  },
});

export const deleteSandboxAnalysisAction = defineAction({
  schema: deleteAnalysisSchema,
  handler: async (input, ctx) => {
    const analysis = await prisma.savedAnalysis.findFirst({
      where: { id: input.analysisId, accountId: ctx.accountId },
    });
    if (!analysis) throw new AppError("NOT_FOUND", "Análise não encontrada.");
    if (analysis.createdById !== ctx.userId && ctx.role !== "owner") {
      throw new AppError("FORBIDDEN", "Apenas o criador ou o dono pode deletar esta análise.");
    }
    await prisma.savedAnalysis.delete({ where: { id: input.analysisId } });
    return { ok: true };
  },
});

export const togglePinAnalysisAction = defineAction({
  schema: togglePinSchema,
  handler: async (input, ctx) => {
    const analysis = await prisma.savedAnalysis.findFirst({
      where: { id: input.analysisId, accountId: ctx.accountId },
    });
    if (!analysis) throw new AppError("NOT_FOUND", "Análise não encontrada.");

    if (input.isPinned && !analysis.isPinned) {
      const pinnedCount = await prisma.savedAnalysis.count({
        where: {
          accountId: ctx.accountId,
          isPinned: true,
          id: { not: input.analysisId },
        },
      });
      if (pinnedCount >= MAX_PINNED) {
        throw new AppError("VALIDATION", "Limite de 4 análises fixadas atingido.");
      }
    }

    const maxOrder = analysis.isPinned
      ? analysis.pinnedOrder
      : await prisma.savedAnalysis
          .aggregate({
            where: { accountId: ctx.accountId, isPinned: true },
            _max: { pinnedOrder: true },
          })
          .then((r) => (r._max.pinnedOrder ?? -1) + 1);

    const updated = await prisma.savedAnalysis.update({
      where: { id: input.analysisId },
      data: {
        isPinned: input.isPinned,
        pinnedOrder: input.isPinned ? maxOrder : 0,
        ...(input.dashboardContext ? { dashboardContext: input.dashboardContext } : {}),
      },
    });
    return { id: updated.id, isPinned: updated.isPinned };
  },
});

export const listSavedAnalysesAction = defineAction({
  schema: z.object({}),
  handler: async (_input, ctx) => {
    return listSavedAnalyses(ctx.accountId);
  },
});

// Convenience wrappers for direct client use
export async function getSandboxDataClientAction(
  accountId: string,
  config: SandboxConfig,
  currentMonthId?: string,
) {
  return getSandboxDataAction(accountId, { config, currentMonthId });
}
