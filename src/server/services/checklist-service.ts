import type {
  CreateChecklistItemInput,
  DeleteChecklistItemInput,
  LinkChecklistTransactionInput,
  ReorderChecklistInput,
  ToggleChecklistCompletionInput,
  UnlinkChecklistTransactionInput,
  UpdateChecklistItemInput,
} from "@/lib/schemas/checklist";
import type { ActionContext } from "@/server/api/define-action";
import { ConflictError, NotFoundError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "checklist-service" });

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getItemOrThrow(itemId: string, accountId: string) {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    select: { accountId: true },
  });
  if (!item || item.accountId !== accountId) throw new NotFoundError("Item do checklist");
  return item;
}

async function assertMonthInAccount(monthId: string, accountId: string) {
  const month = await prisma.month.findUnique({
    where: { id: monthId },
    select: { accountId: true },
  });
  if (!month || month.accountId !== accountId) throw new NotFoundError("Mês");
}

// ─── Reads (RSC — recebem primitivos, sem ActionContext) ─────────────────────

/** Lista o template de itens da account, ordenado por position. */
export async function listChecklistItems(accountId: string) {
  return prisma.checklistItem.findMany({
    where: { accountId },
    orderBy: { position: "asc" },
    select: { id: true, label: true, position: true },
  });
}

export type ChecklistLinkedTransaction = {
  id: string;
  description: string | null;
  amountCents: string; // BigInt serializado (convenção money-handling / rsc-client-boundary)
  occurredOn: string; // "YYYY-MM-DD" — data da transação, exibida no chip do full
};

// Resultado do picker de vínculo — mesmos campos exibidos do vínculo.
export type ChecklistTxSearchResult = ChecklistLinkedTransaction;

export type ChecklistMonthItem = {
  id: string;
  label: string;
  position: number;
  done: boolean;
  completedByName: string | null;
  // Data de conclusão (YYYY-MM-DD) — deriva de `createdAt` da linha de conclusão
  // (linha-presente = concluído). Serializada como string na fronteira RSC→client
  // (convenção rsc-client-boundary: nunca Date cru).
  completedAt: string | null;
  // Transação vinculada (unilateral) à conclusão do mês, se houver.
  linkedTransaction: ChecklistLinkedTransaction | null;
};

/**
 * Itens do template + estado de conclusão para um mês específico.
 * Linha de conclusão presente = done; ausente = pendente (reset por mês).
 */
export async function listChecklistForMonth(
  accountId: string,
  monthId: string,
): Promise<ChecklistMonthItem[]> {
  await assertMonthInAccount(monthId, accountId);

  const items = await prisma.checklistItem.findMany({
    where: { accountId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      label: true,
      position: true,
      completions: {
        where: { monthId },
        select: {
          completedById: true,
          createdAt: true,
          completedBy: { select: { name: true } },
          transaction: {
            select: { id: true, description: true, amountCents: true, occurredOn: true },
          },
        },
      },
    },
  });

  return items.map((item) => {
    const completion = item.completions[0] ?? null;
    const tx = completion?.transaction ?? null;
    return {
      id: item.id,
      label: item.label,
      position: item.position,
      done: completion !== null,
      completedByName: completion?.completedBy.name ?? null,
      completedAt: completion ? completion.createdAt.toISOString().slice(0, 10) : null,
      linkedTransaction: tx
        ? {
            id: tx.id,
            description: tx.description,
            amountCents: tx.amountCents.toString(),
            occurredOn: tx.occurredOn.toISOString().slice(0, 10),
          }
        : null,
    };
  });
}

// ─── Mutations (via defineAction — recebem ActionContext) ────────────────────

export async function createChecklistItem(input: CreateChecklistItemInput, ctx: ActionContext) {
  const existing = await prisma.checklistItem.findUnique({
    where: { accountId_label: { accountId: ctx.accountId, label: input.label } },
    select: { id: true },
  });
  if (existing) throw new ConflictError("Já existe um item com esta descrição.");

  const last = await prisma.checklistItem.findFirst({
    where: { accountId: ctx.accountId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  const item = await prisma.checklistItem.create({
    data: {
      accountId: ctx.accountId,
      label: input.label,
      position,
      createdById: ctx.userId,
    },
    select: { id: true },
  });

  log.info({ itemId: item.id, accountId: ctx.accountId }, "Checklist item created");
  return { itemId: item.id };
}

export async function updateChecklistItem(input: UpdateChecklistItemInput, ctx: ActionContext) {
  await getItemOrThrow(input.itemId, ctx.accountId);

  const conflict = await prisma.checklistItem.findFirst({
    where: { accountId: ctx.accountId, label: input.label, id: { not: input.itemId } },
    select: { id: true },
  });
  if (conflict) throw new ConflictError("Já existe um item com esta descrição.");

  await prisma.checklistItem.update({
    where: { id: input.itemId },
    data: { label: input.label },
  });

  log.info({ itemId: input.itemId, accountId: ctx.accountId }, "Checklist item updated");
}

export async function deleteChecklistItem(input: DeleteChecklistItemInput, ctx: ActionContext) {
  await getItemOrThrow(input.itemId, ctx.accountId);

  // Cascade em ChecklistCompletion remove o estado de todos os meses.
  await prisma.checklistItem.delete({ where: { id: input.itemId } });

  log.info({ itemId: input.itemId, accountId: ctx.accountId }, "Checklist item deleted");
}

export async function reorderChecklist(input: ReorderChecklistInput, ctx: ActionContext) {
  const items = await prisma.checklistItem.findMany({
    where: { accountId: ctx.accountId, id: { in: input.orderedIds } },
    select: { id: true },
  });
  if (items.length !== input.orderedIds.length) throw new NotFoundError("Item do checklist");

  await prisma.$transaction(
    input.orderedIds.map((id, index) =>
      prisma.checklistItem.update({ where: { id }, data: { position: index } }),
    ),
  );

  log.info({ accountId: ctx.accountId, count: input.orderedIds.length }, "Checklist reordered");
}

/**
 * Marca/desmarca a conclusão de um item para um mês. Idempotente (§3.9):
 * done=true → upsert no @@unique([itemId, monthId]); done=false → deleteMany.
 * Guarda tenant write-time: item E mês devem pertencer à account do ctx.
 */
export async function toggleChecklistCompletion(
  input: ToggleChecklistCompletionInput,
  ctx: ActionContext,
) {
  await getItemOrThrow(input.itemId, ctx.accountId);
  await assertMonthInAccount(input.monthId, ctx.accountId);

  if (input.done) {
    await prisma.checklistCompletion.upsert({
      where: { itemId_monthId: { itemId: input.itemId, monthId: input.monthId } },
      create: {
        accountId: ctx.accountId,
        itemId: input.itemId,
        monthId: input.monthId,
        completedById: ctx.userId,
      },
      update: {},
    });
  } else {
    await prisma.checklistCompletion.deleteMany({
      where: { itemId: input.itemId, monthId: input.monthId, accountId: ctx.accountId },
    });
  }

  log.info(
    { itemId: input.itemId, monthId: input.monthId, done: input.done, accountId: ctx.accountId },
    "Checklist completion toggled",
  );
}

/**
 * Vincula uma transação a um item (vínculo unilateral no lado do checklist).
 * Vincular MARCA o item como concluído (upsert da conclusão com transactionId).
 * Guarda tenant write-time: item, mês e transação devem pertencer à account do ctx;
 * a transação deve ser do próprio mês (escopo do picker).
 */
export async function linkChecklistTransaction(
  input: LinkChecklistTransactionInput,
  ctx: ActionContext,
) {
  await getItemOrThrow(input.itemId, ctx.accountId);
  await assertMonthInAccount(input.monthId, ctx.accountId);

  const tx = await prisma.transaction.findUnique({
    where: { id: input.transactionId },
    select: { accountId: true, monthId: true },
  });
  if (!tx || tx.accountId !== ctx.accountId || tx.monthId !== input.monthId) {
    throw new NotFoundError("Transação");
  }

  await prisma.checklistCompletion.upsert({
    where: { itemId_monthId: { itemId: input.itemId, monthId: input.monthId } },
    create: {
      accountId: ctx.accountId,
      itemId: input.itemId,
      monthId: input.monthId,
      completedById: ctx.userId,
      transactionId: input.transactionId,
    },
    update: { transactionId: input.transactionId },
  });

  log.info(
    { itemId: input.itemId, monthId: input.monthId, transactionId: input.transactionId },
    "Checklist transaction linked",
  );
}

/** Remove o vínculo de transação, mantendo a conclusão (item continua concluído). */
export async function unlinkChecklistTransaction(
  input: UnlinkChecklistTransactionInput,
  ctx: ActionContext,
) {
  await getItemOrThrow(input.itemId, ctx.accountId);

  await prisma.checklistCompletion.updateMany({
    where: { itemId: input.itemId, monthId: input.monthId, accountId: ctx.accountId },
    data: { transactionId: null },
  });

  log.info({ itemId: input.itemId, monthId: input.monthId }, "Checklist transaction unlinked");
}

/**
 * Busca transações do mês (escopo do picker de vínculo). Filtra por accountId+monthId
 * e, opcionalmente, por trecho da descrição. Retorna centavos serializados (string).
 */
export async function searchChecklistTransactions(
  accountId: string,
  monthId: string,
  query?: string,
): Promise<ChecklistTxSearchResult[]> {
  await assertMonthInAccount(monthId, accountId);

  const q = query?.trim();
  const rows = await prisma.transaction.findMany({
    where: {
      accountId,
      monthId,
      ...(q ? { description: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { occurredOn: "desc" },
    take: 50,
    select: { id: true, description: true, amountCents: true, occurredOn: true },
  });

  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    amountCents: r.amountCents.toString(),
    occurredOn: r.occurredOn.toISOString().slice(0, 10),
  }));
}
