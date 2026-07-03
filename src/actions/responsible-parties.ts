"use server";

import { defineAction } from "@/server/api/define-action";
import {
  archiveResponsiblePartySchema,
  createResponsiblePartySchema,
  deleteResponsiblePartySchema,
  updateResponsiblePartySchema,
} from "@/lib/schemas/responsible-party";
import * as svc from "@/server/services/responsible-party-service";
import { revalidateResponsibleParties } from "@/server/api/revalidate";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createResponsiblePartyAction = defineAction({
  schema: createResponsiblePartySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const result = await svc.createResponsibleParty(input, ctx);
    revalidateResponsibleParties(ctx.accountId);
    return result;
  },
});

export const updateResponsiblePartyAction = defineAction({
  schema: updateResponsiblePartySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.updateResponsibleParty(input, ctx);
    revalidateResponsibleParties(ctx.accountId);
  },
});

export const archiveResponsiblePartyAction = defineAction({
  schema: archiveResponsiblePartySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.archiveResponsibleParty(input, ctx);
    revalidateResponsibleParties(ctx.accountId);
  },
});

export const deleteResponsiblePartyAction = defineAction({
  schema: deleteResponsiblePartySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.deleteResponsibleParty(input, ctx);
    revalidateResponsibleParties(ctx.accountId);
  },
});
