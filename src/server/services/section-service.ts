import { ConflictError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  CreateSectionInput,
  DeleteSectionInput,
  ReorderSectionsInput,
  UpdateSectionInput,
} from "@/lib/schemas/settings";

const log = logger.child({ module: "section-service" });

export async function createSection(input: CreateSectionInput, ctx: ActionContext) {
  const maxOrder = await prisma.section.aggregate({
    where: { accountId: ctx.accountId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  const existing = await prisma.section.findUnique({
    where: { accountId_name: { accountId: ctx.accountId, name: input.name } },
  });
  if (existing) throw new ConflictError("Já existe uma seção com este nome.");

  const section = await prisma.section.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      countType: input.countType,
      isActive: input.isActive,
      // Spec 68 §2.1 — chave de accent-colors. `undefined` (campo ausente) e `null`
      // caem no mesmo lugar: sem cor gravada, a apresentação usa o fallback por índice.
      color: input.color ?? null,
      order: nextOrder,
    },
    select: { id: true, name: true },
  });

  log.info({ sectionId: section.id, accountId: ctx.accountId }, "Section created");
  return { sectionId: section.id };
}

export async function updateSection(input: UpdateSectionInput, ctx: ActionContext) {
  const section = await prisma.section.findUnique({
    where: { id: input.sectionId },
    select: { accountId: true },
  });
  if (!section || section.accountId !== ctx.accountId) throw new NotFoundError("Seção");

  if (input.name) {
    const nameConflict = await prisma.section.findFirst({
      where: {
        accountId: ctx.accountId,
        name: input.name,
        id: { not: input.sectionId },
      },
    });
    if (nameConflict) throw new ConflictError("Já existe uma seção com este nome.");
  }

  await prisma.section.update({
    where: { id: input.sectionId },
    data: {
      name: input.name,
      countType: input.countType,
      isActive: input.isActive,
      // `undefined` = o chamador não mencionou a cor (ex.: toggle de status inline),
      // e o Prisma ignora o campo. `null` = "tirar a cor", e é gravado.
      color: input.color,
    },
  });

  log.info({ sectionId: input.sectionId, accountId: ctx.accountId }, "Section updated");
}

export async function reorderSections(input: ReorderSectionsInput, ctx: ActionContext) {
  await prisma.$transaction(
    input.orderedIds.map((id, index) =>
      prisma.section.updateMany({
        where: { id, accountId: ctx.accountId },
        data: { order: index },
      }),
    ),
  );

  log.info({ accountId: ctx.accountId }, "Sections reordered");
}

export async function deleteSection(input: DeleteSectionInput, ctx: ActionContext) {
  const section = await prisma.section.findUnique({
    where: { id: input.sectionId },
    select: { accountId: true },
  });
  if (!section || section.accountId !== ctx.accountId) throw new NotFoundError("Seção");

  const tableCount = await prisma.financeTable.count({
    where: { sectionId: input.sectionId, accountId: ctx.accountId },
  });
  if (tableCount > 0) {
    throw new ConflictError(
      `Não é possível deletar: há ${tableCount} tabela(s) financeira(s) associada(s). Desative a seção em vez de deletar.`,
    );
  }

  await prisma.section.delete({ where: { id: input.sectionId } });

  log.info({ sectionId: input.sectionId, accountId: ctx.accountId }, "Section deleted");
}
