import { AppError } from "@/server/api/errors";
import { requireAccountAccess } from "@/server/auth/session";
import { logger } from "@/server/logger";
import { getUnreadCount } from "@/server/services/notification-service";

const log = logger.child({ module: "api.notifications" });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;

  try {
    const { user } = await requireAccountAccess(accountId);
    const unreadCount = await getUnreadCount(user.id, accountId);
    return Response.json({ unreadCount });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return Response.json({ error: err.code }, { status });
    }
    log.error({ err, accountId }, "Failed to fetch notification count");
    return Response.json({ error: "INTERNAL" }, { status: 500 });
  }
}
