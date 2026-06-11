import { z } from "zod";
import { requireAccountAccess } from "@/server/auth/session";
import { getUnreadCount } from "@/server/services/notification-service";
import { defineRoute } from "@/server/api/route-helpers";
import { registry } from "@/server/api/openapi-registry";

registry.registerPath({
  method: "get",
  path: "/accounts/{accountId}/notifications",
  tags: ["Notifications"],
  request: {
    params: z.object({ accountId: z.string() }),
  },
  responses: {
    200: {
      description: "Contagem de notificações não lidas",
      content: {
        "application/json": {
          schema: z.object({
            ok: z.literal(true),
            data: z.object({ unreadCount: z.number() }),
          }),
        },
      },
    },
    401: { description: "Não autenticado" },
    403: { description: "Sem permissão" },
  },
});

export const GET = defineRoute({
  module: "api.notifications",
  handler: async (_input, { accountId }) => {
    const { user } = await requireAccountAccess(accountId);
    const unreadCount = await getUnreadCount(user.id, accountId);
    return { unreadCount };
  },
});
