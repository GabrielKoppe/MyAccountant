import type {
  ArchiveTransactionAliasInput,
  CreateTransactionAliasInput,
  DeleteTransactionAliasInput,
  UpdateTransactionAliasInput,
} from "@/lib/schemas/transaction-alias";
import type { ActionContext } from "@/server/api/define-action";
import { AppError, ConflictError, NotFoundError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "transaction-alias-service" });

// ─── Ownership (IDOR) ───────────────────────────────────────────────────────
// Cada FK do payload precisa pertencer à mesma Account do apelido — sem
// exceção (spec 61 §4, critério de multi-tenancy).

async function assertCategoryOwned(accountId: string, categoryId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, accountId },
    select: { id: true },
  });
  if (!category) throw new NotFoundError("Categoria");
}

// DD-18: além de pertencer à Account, a subcategoria precisa ser filha da
// categoria efetiva do apelido (não é uma checagem de ownership, é de
// consistência — por isso lança VALIDATION, não NotFoundError).
async function assertSubcategoryOwned(
  accountId: string,
  subcategoryId: string,
  expectedCategoryId: string | null,
) {
  const subcategory = await prisma.subcategory.findFirst({
    where: { id: subcategoryId, accountId },
    select: { categoryId: true },
  });
  if (!subcategory) throw new NotFoundError("Subcategoria");
  // Sem categoria efetiva (ex.: categoria limpa no mesmo patch) também é violação —
  // subcategoria nunca fica órfã de categoria.
  if (!expectedCategoryId || subcategory.categoryId !== expectedCategoryId) {
    throw new AppError("VALIDATION", "Subcategoria não pertence à categoria selecionada");
  }
}

// DD-14: institutionId e institutionText são mutuamente exclusivos. No update
// parcial, precisa considerar o valor "efetivo" (novo, ou o já persistido
// quando o campo não foi tocado neste patch) — o Zod só vê o patch bruto.
function assertInstitutionExclusivity(
  effectiveInstitutionId: string | null,
  effectiveInstitutionText: string | null,
) {
  if (effectiveInstitutionId && effectiveInstitutionText) {
    throw new AppError("VALIDATION", "Instituição e texto livre não podem ser combinados");
  }
}

async function assertInstitutionOwned(accountId: string, institutionId: string) {
  const institution = await prisma.institution.findFirst({
    where: { id: institutionId, accountId },
    select: { id: true },
  });
  if (!institution) throw new NotFoundError("Instituição");
}

async function assertResponsiblePartyOwned(accountId: string, partyId: string) {
  const party = await prisma.responsibleParty.findFirst({
    where: { id: partyId, accountId },
    select: { id: true },
  });
  if (!party) throw new NotFoundError("Responsável");
}

async function assertTagsOwned(accountId: string, tagIds: string[]) {
  const uniqueIds = [...new Set(tagIds)];
  if (uniqueIds.length === 0) return;
  const count = await prisma.tag.count({ where: { id: { in: uniqueIds }, accountId } });
  if (count !== uniqueIds.length) throw new NotFoundError("Uma ou mais tags");
}

// ─── Funções exportadas ─────────────────────────────────────────────────────

export async function createTransactionAlias(
  input: CreateTransactionAliasInput,
  ctx: ActionContext,
) {
  if (input.categoryId) await assertCategoryOwned(ctx.accountId, input.categoryId);
  if (input.subcategoryId) {
    await assertSubcategoryOwned(ctx.accountId, input.subcategoryId, input.categoryId ?? null);
  }
  if (input.institutionId) await assertInstitutionOwned(ctx.accountId, input.institutionId);
  // Condição avançada: a instituição-condição também precisa pertencer à Account.
  if (input.conditionInstitutionId)
    await assertInstitutionOwned(ctx.accountId, input.conditionInstitutionId);
  if (input.responsiblePartyId)
    await assertResponsiblePartyOwned(ctx.accountId, input.responsiblePartyId);
  const tagIds = [...new Set(input.tagIds)];
  await assertTagsOwned(ctx.accountId, tagIds);

  const trigger = input.trigger.trim();
  const triggerNormalized = trigger.toLowerCase();
  const collision = await prisma.transactionAlias.findFirst({
    where: { accountId: ctx.accountId, triggerNormalized },
    select: { id: true },
  });
  if (collision) throw new ConflictError(`Já existe um apelido com o gatilho "${trigger}".`);

  const alias = await prisma.transactionAlias.create({
    data: {
      accountId: ctx.accountId,
      trigger,
      triggerNormalized,
      triggerMode: input.triggerMode,
      priority: input.priority,
      conditionInstitutionId: input.conditionInstitutionId ?? null,
      minCents: input.minCents ?? null,
      maxCents: input.maxCents ?? null,
      description: input.description ?? null,
      notes: input.notes ?? null,
      amountCents: input.amountCents ?? null,
      categoryId: input.categoryId ?? null,
      subcategoryId: input.subcategoryId ?? null,
      institutionId: input.institutionId ?? null,
      institutionText: input.institutionText ?? null,
      responsiblePartyId: input.responsiblePartyId ?? null,
      expenseType: input.expenseType ?? null,
      paymentMethod: input.paymentMethod ?? null,
      investmentType: input.investmentType ?? null,
      cardInstallment: input.cardInstallment ?? null,
      isPending: input.isPending ?? null,
      isFavorite: input.isFavorite ?? null,
      originalCurrency: input.originalCurrency ?? null,
      originalAmountCents: input.originalAmountCents ?? null,
      exchangeRate: input.exchangeRate ?? null,
      createdById: ctx.userId,
      tags: tagIds.length > 0 ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
    },
    select: { id: true },
  });

  log.info({ accountId: ctx.accountId, aliasId: alias.id, trigger }, "Transaction alias created");
  return alias;
}

export async function updateTransactionAlias(
  input: UpdateTransactionAliasInput,
  ctx: ActionContext,
) {
  const existing = await prisma.transactionAlias.findFirst({
    where: { id: input.aliasId, accountId: ctx.accountId },
    select: {
      categoryId: true,
      subcategoryId: true,
      institutionId: true,
      institutionText: true,
    },
  });
  if (!existing) throw new NotFoundError("Apelido");

  if (input.categoryId !== undefined && input.categoryId !== null) {
    await assertCategoryOwned(ctx.accountId, input.categoryId);
  }
  if (input.institutionId !== undefined && input.institutionId !== null) {
    await assertInstitutionOwned(ctx.accountId, input.institutionId);
  }
  if (input.conditionInstitutionId !== undefined && input.conditionInstitutionId !== null) {
    await assertInstitutionOwned(ctx.accountId, input.conditionInstitutionId);
  }
  if (input.responsiblePartyId !== undefined && input.responsiblePartyId !== null) {
    await assertResponsiblePartyOwned(ctx.accountId, input.responsiblePartyId);
  }
  const tagIds = input.tagIds !== undefined ? [...new Set(input.tagIds)] : undefined;
  if (tagIds !== undefined) {
    await assertTagsOwned(ctx.accountId, tagIds);
  }

  // DD-18: se categoria e/ou subcategoria mudam neste patch, a subcategoria
  // efetiva (valor novo, ou o já persistido quando não tocado) precisa
  // pertencer à categoria efetiva — inclusive quando a categoria é limpa
  // (categoryId: null) mas a subcategoria persistida permanece.
  if (input.categoryId !== undefined || input.subcategoryId !== undefined) {
    const effectiveCategoryId =
      input.categoryId !== undefined ? input.categoryId : existing.categoryId;
    const effectiveSubcategoryId =
      input.subcategoryId !== undefined ? input.subcategoryId : existing.subcategoryId;
    if (effectiveSubcategoryId) {
      await assertSubcategoryOwned(ctx.accountId, effectiveSubcategoryId, effectiveCategoryId);
    }
  }

  // DD-14: mesma lógica de valor efetivo para institutionId/institutionText.
  if (input.institutionId !== undefined || input.institutionText !== undefined) {
    const effectiveInstitutionId =
      input.institutionId !== undefined ? input.institutionId : existing.institutionId;
    const effectiveInstitutionText =
      input.institutionText !== undefined ? input.institutionText : existing.institutionText;
    assertInstitutionExclusivity(effectiveInstitutionId, effectiveInstitutionText);
  }

  let trigger: string | undefined;
  let triggerNormalized: string | undefined;
  if (input.trigger !== undefined) {
    trigger = input.trigger.trim();
    triggerNormalized = trigger.toLowerCase();
    const collision = await prisma.transactionAlias.findFirst({
      where: { accountId: ctx.accountId, triggerNormalized, id: { not: input.aliasId } },
      select: { id: true },
    });
    if (collision) throw new ConflictError(`Já existe um apelido com o gatilho "${trigger}".`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.transactionAlias.update({
      where: { id: input.aliasId },
      data: {
        ...(trigger !== undefined ? { trigger, triggerNormalized } : {}),
        ...(input.triggerMode !== undefined ? { triggerMode: input.triggerMode } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.conditionInstitutionId !== undefined
          ? { conditionInstitutionId: input.conditionInstitutionId }
          : {}),
        ...(input.minCents !== undefined ? { minCents: input.minCents } : {}),
        ...(input.maxCents !== undefined ? { maxCents: input.maxCents } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.subcategoryId !== undefined ? { subcategoryId: input.subcategoryId } : {}),
        ...(input.institutionId !== undefined ? { institutionId: input.institutionId } : {}),
        ...(input.institutionText !== undefined ? { institutionText: input.institutionText } : {}),
        ...(input.responsiblePartyId !== undefined
          ? { responsiblePartyId: input.responsiblePartyId }
          : {}),
        ...(input.expenseType !== undefined ? { expenseType: input.expenseType } : {}),
        ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
        ...(input.investmentType !== undefined ? { investmentType: input.investmentType } : {}),
        ...(input.cardInstallment !== undefined ? { cardInstallment: input.cardInstallment } : {}),
        ...(input.isPending !== undefined ? { isPending: input.isPending } : {}),
        ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
        ...(input.originalCurrency !== undefined
          ? { originalCurrency: input.originalCurrency }
          : {}),
        ...(input.originalAmountCents !== undefined
          ? { originalAmountCents: input.originalAmountCents }
          : {}),
        ...(input.exchangeRate !== undefined ? { exchangeRate: input.exchangeRate } : {}),
      },
    });

    if (tagIds !== undefined) {
      await tx.transactionAliasTag.deleteMany({ where: { aliasId: input.aliasId } });
      if (tagIds.length > 0) {
        await tx.transactionAliasTag.createMany({
          data: tagIds.map((tagId) => ({ aliasId: input.aliasId, tagId })),
        });
      }
    }
  });

  log.info({ accountId: ctx.accountId, aliasId: input.aliasId }, "Transaction alias updated");
}

export async function archiveTransactionAlias(
  input: ArchiveTransactionAliasInput,
  ctx: ActionContext,
) {
  const { count } = await prisma.transactionAlias.updateMany({
    where: { id: input.aliasId, accountId: ctx.accountId },
    data: { archivedAt: input.archived ? new Date() : null },
  });
  if (count === 0) throw new NotFoundError("Apelido");
}

export async function deleteTransactionAlias(
  input: DeleteTransactionAliasInput,
  ctx: ActionContext,
) {
  const { count } = await prisma.transactionAlias.deleteMany({
    where: { id: input.aliasId, accountId: ctx.accountId },
  });
  if (count === 0) throw new NotFoundError("Apelido");
  log.info({ accountId: ctx.accountId, aliasId: input.aliasId }, "Transaction alias deleted");
}
