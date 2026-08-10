"use server";

// Spec 67 §2.4 / §9 P5 (SET-07) — transporte da contagem de uso sob demanda.
// Consumida pelo modal "Ver uso" (M3), pela aba "Onde é usado" e pelo diálogo
// de exclusão com realocação (M2), que são entregues nas Specs 68–72.

import { countUsageSchema } from "@/lib/schemas/settings-usage";
import { defineAction } from "@/server/api/define-action";
import * as svc from "@/server/services/settings-usage-service";

// Contar é caro (varre `Transaction`) e é gesto de gestão de configurações.
// `viewer` só alcança a família Conta / Membros (Spec 67 §4, D3) e não tem de
// onde disparar isto.
const EDITOR_ROLES = ["owner", "editor"] as const;

export const countUsageAction = defineAction({
  schema: countUsageSchema,
  requireRoles: [...EDITOR_ROLES],
  handler: (input, ctx) =>
    svc.countUsage({
      accountId: ctx.accountId,
      entity: input.entity,
      entityId: input.entityId,
      force: input.force,
    }),
});
