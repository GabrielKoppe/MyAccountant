import { NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  CreateBalanceAccountInput,
  UpdateBalanceAccountInput,
  ArchiveBalanceAccountInput,
  DeleteBalanceAccountInput,
  UpsertBalanceSnapshotInput,
  UpsertBalanceSnapshotsInput,
} from "@/lib/schemas/balance-account";

const log = logger.child({ module: "balance-account-service" });

async function assertOwned(id: string, ctx: ActionContext) {
  const row = await prisma.balanceAccount.findUnique({ where: { id }, select: { accountId: true } });
  if (!row || row.accountId !== ctx.accountId) throw new NotFoundError("Conta patrimonial");
}

export async function createBalanceAccount(input: CreateBalanceAccountInput, ctx: ActionContext) {
  const created = await prisma.balanceAccount.create({
    data: {
      accountId: ctx.accountId,
      kind: input.kind,
      name: input.name,
      institutionId: input.institutionId ?? null,
      createdById: ctx.userId,
    },
    select: { id: true },
  });
  log.info({ balanceAccountId: created.id, accountId: ctx.accountId }, "BalanceAccount created");
  return { balanceAccountId: created.id };
}

export async function updateBalanceAccount(input: UpdateBalanceAccountInput, ctx: ActionContext) {
  await assertOwned(input.balanceAccountId, ctx); // kind NÃO é atualizado
  await prisma.balanceAccount.update({
    where: { id: input.balanceAccountId },
    data: { name: input.name, institutionId: input.institutionId ?? null },
  });
}

export async function archiveBalanceAccount(input: ArchiveBalanceAccountInput, ctx: ActionContext) {
  await assertOwned(input.balanceAccountId, ctx);
  await prisma.balanceAccount.update({
    where: { id: input.balanceAccountId },
    data: { archivedAt: input.archived ? new Date() : null }, // data de corte do carry-forward
  });
}

export async function deleteBalanceAccount(input: DeleteBalanceAccountInput, ctx: ActionContext) {
  await assertOwned(input.balanceAccountId, ctx);
  await prisma.balanceAccount.delete({ where: { id: input.balanceAccountId } }); // cascade nos snapshots
}

export async function upsertBalanceSnapshot(input: UpsertBalanceSnapshotInput, ctx: ActionContext) {
  await assertOwned(input.balanceAccountId, ctx);
  await prisma.balanceSnapshot.upsert({
    where: {
      balanceAccountId_capturedOn: {
        balanceAccountId: input.balanceAccountId,
        capturedOn: input.capturedOn,
      },
    },
    create: {
      accountId: ctx.accountId,
      balanceAccountId: input.balanceAccountId,
      balanceCents: input.balanceCents,
      capturedOn: input.capturedOn,
      createdById: ctx.userId,
    },
    update: { balanceCents: input.balanceCents },
  });
}

export async function upsertBalanceSnapshots(input: UpsertBalanceSnapshotsInput, ctx: ActionContext) {
  const ids = input.entries.map((e) => e.balanceAccountId);
  const owned = await prisma.balanceAccount.findMany({
    where: { id: { in: ids }, accountId: ctx.accountId }, // ✅ todas da account
    select: { id: true },
  });
  if (owned.length !== new Set(ids).size) throw new NotFoundError("Conta patrimonial");
  await prisma.$transaction(
    input.entries.map((e) =>
      prisma.balanceSnapshot.upsert({
        where: {
          balanceAccountId_capturedOn: {
            balanceAccountId: e.balanceAccountId,
            capturedOn: input.capturedOn,
          },
        },
        create: {
          accountId: ctx.accountId,
          balanceAccountId: e.balanceAccountId,
          balanceCents: e.balanceCents,
          capturedOn: input.capturedOn,
          createdById: ctx.userId,
        },
        update: { balanceCents: e.balanceCents },
      }),
    ),
  );
  log.info({ accountId: ctx.accountId, count: input.entries.length }, "Balance snapshots upserted");
}
