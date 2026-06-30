import { prisma } from "@/server/prisma";
import { ConflictError, NotFoundError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import type { ActionContext } from "@/server/api/define-action";
import type {
  AddTagToTransactionInput,
  BulkAddTagInput,
  BulkRemoveTagInput,
  DeleteTagInput,
  RemoveTagFromTransactionInput,
  UpdateTagInput,
} from "@/lib/schemas/tag";

const MAX_TAGS_PER_TRANSACTION = 10;
const log = logger.child({ module: "tag-service" });

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getTransactionOrThrow(transactionId: string, accountId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { accountId: true },
  });
  if (!tx || tx.accountId !== accountId) throw new NotFoundError("Transação");
  return tx;
}

async function getTagOrThrow(tagId: string, accountId: string) {
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag || tag.accountId !== accountId) throw new NotFoundError("Tag");
  return tag;
}

// ─── Funções exportadas ───────────────────────────────────────────────────────

/** Lista todas as tags da account, ordenadas por nome. */
export async function listTags(accountId: string) {
  return prisma.tag.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      _count: { select: { transactions: true } },
    },
  });
}

/**
 * Adiciona uma tag a uma transação, criando a tag se não existir.
 * Respeita o limite de MAX_TAGS_PER_TRANSACTION.
 */
export async function addTagToTransaction(
  input: AddTagToTransactionInput,
  ctx: ActionContext,
): Promise<{ tagId: string; tagName: string; tagColor: string | null }> {
  await getTransactionOrThrow(input.transactionId, ctx.accountId);

  // Buscar ou criar a tag (case-insensitive)
  let tag = await prisma.tag.findFirst({
    where: {
      accountId: ctx.accountId,
      name: { equals: input.tagName, mode: "insensitive" },
    },
  });

  if (!tag) {
    tag = await prisma.tag.create({
      data: {
        accountId: ctx.accountId,
        name: input.tagName,
        color: input.color ?? null,
      },
    });
    log.info({ tagId: tag.id, name: tag.name }, "Tag created");
  }

  // Verificar limite
  const currentCount = await prisma.transactionTag.count({
    where: { transactionId: input.transactionId },
  });
  if (currentCount >= MAX_TAGS_PER_TRANSACTION) {
    throw new ConflictError(`Limite de ${MAX_TAGS_PER_TRANSACTION} tags por transação atingido.`);
  }

  // Upsert para evitar duplicatas
  await prisma.transactionTag.upsert({
    where: { transactionId_tagId: { transactionId: input.transactionId, tagId: tag.id } },
    create: { transactionId: input.transactionId, tagId: tag.id },
    update: {},
  });

  log.info({ transactionId: input.transactionId, tagId: tag.id }, "Tag added to transaction");
  return { tagId: tag.id, tagName: tag.name, tagColor: tag.color };
}

/** Remove uma tag de uma transação. */
export async function removeTagFromTransaction(
  input: RemoveTagFromTransactionInput,
  ctx: ActionContext,
) {
  await getTransactionOrThrow(input.transactionId, ctx.accountId);
  await getTagOrThrow(input.tagId, ctx.accountId);

  await prisma.transactionTag.deleteMany({
    where: { transactionId: input.transactionId, tagId: input.tagId },
  });

  log.info(
    { transactionId: input.transactionId, tagId: input.tagId },
    "Tag removed from transaction",
  );
}

/** Adiciona uma tag a múltiplas transações (bulk). Cria a tag se não existir. */
export async function bulkAddTag(input: BulkAddTagInput, ctx: ActionContext) {
  // Verificar que todas pertencem à account
  const txCount = await prisma.transaction.count({
    where: { id: { in: input.transactionIds }, accountId: ctx.accountId },
  });
  if (txCount !== input.transactionIds.length) throw new NotFoundError("Uma ou mais transações");

  // Buscar ou criar tag
  let tag = await prisma.tag.findFirst({
    where: {
      accountId: ctx.accountId,
      name: { equals: input.tagName, mode: "insensitive" },
    },
  });

  if (!tag) {
    tag = await prisma.tag.create({
      data: { accountId: ctx.accountId, name: input.tagName, color: input.color ?? null },
    });
  }

  // Inserir ignorando conflitos
  await prisma.transactionTag.createMany({
    data: input.transactionIds.map((txId) => ({ transactionId: txId, tagId: tag!.id })),
    skipDuplicates: true,
  });

  log.info({ tagId: tag.id, count: input.transactionIds.length }, "Bulk tag added");
  return { tagId: tag.id, tagName: tag.name, tagColor: tag.color };
}

/** Remove uma tag de múltiplas transações (bulk). */
export async function bulkRemoveTag(input: BulkRemoveTagInput, ctx: ActionContext) {
  await getTagOrThrow(input.tagId, ctx.accountId);

  await prisma.transactionTag.deleteMany({
    where: {
      tagId: input.tagId,
      transactionId: { in: input.transactionIds },
    },
  });

  log.info({ tagId: input.tagId, count: input.transactionIds.length }, "Bulk tag removed");
}

/** Atualiza nome/cor de uma tag. */
export async function updateTag(input: UpdateTagInput, ctx: ActionContext) {
  await getTagOrThrow(input.tagId, ctx.accountId);

  if (input.name) {
    const existing = await prisma.tag.findFirst({
      where: {
        accountId: ctx.accountId,
        name: { equals: input.name, mode: "insensitive" },
        id: { not: input.tagId },
      },
    });
    if (existing) throw new ConflictError(`Já existe uma tag com o nome "${input.name}".`);
  }

  await prisma.tag.update({
    where: { id: input.tagId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.color !== undefined && { color: input.color }),
    },
  });
}

/** Deleta uma tag (e remove de todas as transações). */
export async function deleteTag(input: DeleteTagInput, ctx: ActionContext) {
  await getTagOrThrow(input.tagId, ctx.accountId);
  await prisma.tag.delete({ where: { id: input.tagId } });
  log.info({ tagId: input.tagId }, "Tag deleted");
}
