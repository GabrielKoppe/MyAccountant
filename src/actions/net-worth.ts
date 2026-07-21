"use server";

import { defineAction } from "@/server/api/define-action";
import * as svc from "@/server/services/balance-account-service";
import { revalidateNetWorth } from "@/server/api/revalidate";
import {
  createBalanceAccountSchema,
  updateBalanceAccountSchema,
  archiveBalanceAccountSchema,
  deleteBalanceAccountSchema,
  upsertBalanceSnapshotSchema,
  upsertBalanceSnapshotsSchema,
} from "@/lib/schemas/balance-account";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createBalanceAccountAction = defineAction({
  schema: createBalanceAccountSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const r = await svc.createBalanceAccount(input, ctx);
    revalidateNetWorth(ctx.accountId);
    return r;
  },
});

export const updateBalanceAccountAction = defineAction({
  schema: updateBalanceAccountSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.updateBalanceAccount(input, ctx);
    revalidateNetWorth(ctx.accountId);
  },
});

export const archiveBalanceAccountAction = defineAction({
  schema: archiveBalanceAccountSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.archiveBalanceAccount(input, ctx);
    revalidateNetWorth(ctx.accountId);
  },
});

export const deleteBalanceAccountAction = defineAction({
  schema: deleteBalanceAccountSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.deleteBalanceAccount(input, ctx);
    revalidateNetWorth(ctx.accountId);
  },
});

export const upsertBalanceSnapshotAction = defineAction({
  schema: upsertBalanceSnapshotSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.upsertBalanceSnapshot(input, ctx);
    revalidateNetWorth(ctx.accountId);
  },
});

export const upsertBalanceSnapshotsAction = defineAction({
  schema: upsertBalanceSnapshotsSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.upsertBalanceSnapshots(input, ctx);
    revalidateNetWorth(ctx.accountId);
  },
});
