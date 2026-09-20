// Valor, não só tipo: `Prisma.DbNull` é o jeito de gravar NULL numa coluna Json.
import { Prisma } from "@prisma/client";

import {
  WIDGET_REGISTRY,
  GRID_CONFIG,
  resolveLayout,
  type DashboardContext,
} from "@/components/dashboards/_core/widget-registry";
import type { UpdateDashboardLayoutInput, StoredWidget } from "@/lib/schemas/dashboard-layout";
import type { ActionContext } from "@/server/api/define-action";
import { AppError } from "@/server/api/errors";
import { prisma } from "@/server/prisma";

/**
 * Spec 36 — layout em grade 2D (StoredWidget[]). Filtra sempre por accountId.
 *
 * ⚠️ Spec 69 §2.3: devolve o layout **PUBLICADO** (`widgets`), nunca o rascunho.
 * É esta função que as 3 páginas reais de dashboard usam — se ela passar a ler
 * `draft`, o dashboard do usuário muda sem ele publicar, que é exatamente o que
 * a decisão "publicar × descartar" proíbe.
 */
export async function getLayout(
  accountId: string,
  context: DashboardContext,
): Promise<StoredWidget[]> {
  const record = await prisma.dashboardLayout.findUnique({
    where: { accountId_context: { accountId, context } },
    select: { widgets: true },
  });
  const stored = record ? (record.widgets as StoredWidget[]) : null;
  return resolveLayout(context, stored);
}

export type EditorLayout = {
  /** O que o editor abre: o rascunho quando existe, senão o publicado. */
  widgets: StoredWidget[];
  /** O último publicado — base da contagem de movimentações e do "Descartar". */
  published: StoredWidget[];
  hasDraft: boolean;
};

/**
 * Layout como o EDITOR o vê (Spec 69 §2.3): rascunho por cima do publicado.
 * Só o editor de Configurações usa isto — as páginas reais usam `getLayout`.
 */
export async function getEditorLayout(
  accountId: string,
  context: DashboardContext,
): Promise<EditorLayout> {
  const record = await prisma.dashboardLayout.findUnique({
    where: { accountId_context: { accountId, context } },
    select: { widgets: true, draft: true },
  });
  const published = resolveLayout(context, record ? (record.widgets as StoredWidget[]) : null);
  const hasDraft = record?.draft != null;
  return {
    published,
    hasDraft,
    widgets: hasDraft ? resolveLayout(context, record!.draft as StoredWidget[]) : published,
  };
}

/**
 * Valida um layout contra o registry do contexto: widgetId conhecido, config
 * válida e coordenadas dentro da grade. Roda tanto no rascunho quanto na
 * publicação — guarda que só existe na UI não existe (§15).
 */
function assertValidLayout(
  context: DashboardContext,
  widgets: UpdateDashboardLayoutInput["widgets"],
) {
  const registry = WIDGET_REGISTRY[context];

  // Validar cada item: widgetId conhecido + config válida se configSchema presente.
  for (const item of widgets) {
    const def = registry.find((d) => d.id === item.widgetId);
    if (!def) throw new AppError("NOT_FOUND", `Widget desconhecido: ${item.widgetId}`);
    if (def.configSchema && item.config !== undefined) {
      const result = def.configSchema.safeParse(item.config);
      if (!result.success) {
        throw new AppError("VALIDATION", `Config inválida para widget ${item.widgetId}`);
      }
    }
  }

  // Validar que coordenadas não ultrapassam os limites da grade.
  const { cols, maxRows } = GRID_CONFIG[context];
  for (const item of widgets) {
    if (item.x + item.w > cols || item.y + item.h > maxRows) {
      throw new AppError("VALIDATION", `Widget ${item.instanceId} fora dos limites da grade`);
    }
  }
}

/**
 * Grava o layout PUBLICADO direto (sem passar por rascunho).
 * Usado por quem age fora do editor — hoje o "Adicionar ao dashboard" do Sandbox.
 */
export async function upsertLayout(
  input: UpdateDashboardLayoutInput,
  ctx: ActionContext,
): Promise<void> {
  const { context, widgets } = input;
  assertValidLayout(context as DashboardContext, widgets);

  await prisma.dashboardLayout.upsert({
    where: { accountId_context: { accountId: ctx.accountId, context } },
    create: {
      accountId: ctx.accountId,
      context,
      widgets: widgets as unknown as Prisma.InputJsonValue,
      publishedAt: new Date(),
    },
    update: { widgets: widgets as unknown as Prisma.InputJsonValue, publishedAt: new Date() },
  });
}

/**
 * Grava o RASCUNHO do editor (Spec 69 §2.3). Não toca em `widgets` — a página
 * real segue mostrando o último publicado até o usuário clicar em "Publicar".
 *
 * O `create` grava o mesmo layout nos dois lados: sem linha no banco não há
 * "publicado" nenhum, e deixar `widgets` vazio faria a página real perder os
 * widgets padrão só porque alguém abriu o editor.
 */
export async function saveDraft(
  input: UpdateDashboardLayoutInput,
  ctx: ActionContext,
): Promise<void> {
  const { context, widgets } = input;
  assertValidLayout(context as DashboardContext, widgets);
  const json = widgets as unknown as Prisma.InputJsonValue;

  const existing = await prisma.dashboardLayout.findUnique({
    where: { accountId_context: { accountId: ctx.accountId, context } },
    select: { id: true },
  });

  if (!existing) {
    const published = resolveLayout(context as DashboardContext, null);
    await prisma.dashboardLayout.create({
      data: {
        accountId: ctx.accountId,
        context,
        widgets: published as unknown as Prisma.InputJsonValue,
        draft: json,
      },
    });
    return;
  }

  await prisma.dashboardLayout.update({
    where: { accountId_context: { accountId: ctx.accountId, context } },
    data: { draft: json },
  });
}

/**
 * Publica o rascunho: copia `draft` → `widgets`, carimba `publishedAt` e limpa
 * o rascunho. Publica o que ESTÁ gravado, não o que o cliente mandar.
 * Devolve o layout publicado resultante.
 */
export async function publishDraft(
  context: DashboardContext,
  ctx: ActionContext,
): Promise<StoredWidget[]> {
  const record = await prisma.dashboardLayout.findUnique({
    where: { accountId_context: { accountId: ctx.accountId, context } },
    select: { widgets: true, draft: true },
  });
  if (!record) throw new AppError("NOT_FOUND", "Layout não encontrado");
  if (record.draft == null) {
    // Nada pendente: publicar é no-op, não erro (o botão pode ter sido clicado
    // duas vezes, ou outra aba publicou antes).
    return resolveLayout(context, record.widgets as StoredWidget[]);
  }

  const draft = record.draft as StoredWidget[];
  assertValidLayout(context, draft);
  await prisma.dashboardLayout.update({
    where: { accountId_context: { accountId: ctx.accountId, context } },
    data: {
      widgets: draft as unknown as Prisma.InputJsonValue,
      draft: Prisma.DbNull,
      publishedAt: new Date(),
    },
  });
  return resolveLayout(context, draft);
}

/** Descarta o rascunho e devolve o publicado — a página real não é tocada. */
export async function discardDraft(
  context: DashboardContext,
  ctx: ActionContext,
): Promise<StoredWidget[]> {
  const record = await prisma.dashboardLayout.findUnique({
    where: { accountId_context: { accountId: ctx.accountId, context } },
    select: { widgets: true },
  });
  if (!record) return resolveLayout(context, null);

  await prisma.dashboardLayout.update({
    where: { accountId_context: { accountId: ctx.accountId, context } },
    data: { draft: Prisma.DbNull },
  });
  return resolveLayout(context, record.widgets as StoredWidget[]);
}
