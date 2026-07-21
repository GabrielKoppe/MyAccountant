import { toAccountSlug } from "@/lib/export-utils";
import { m } from "@/lib/messages";
import { AppError, ForbiddenError } from "@/server/api/errors";
import { requireAccountAccess } from "@/server/auth/session";
import { logger } from "@/server/logger";
import { buildAccountSnapshot } from "@/server/services/account-backup-service";

// Export do backup completo da Account em JSON (spec 64, Fase 1 — BKP-01).
// Owner-only: operação sobre a conta inteira (configuração + dados reais).

const log = logger.child({ module: "export.account-json" });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;

  try {
    const { member } = await requireAccountAccess(accountId);
    if (member.role !== "owner") {
      throw new ForbiddenError("Apenas o owner pode exportar o backup da conta");
    }

    const snapshot = await buildAccountSnapshot(accountId);

    const slug = toAccountSlug(snapshot.account.name);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `myaccountant-${slug}-${date}.json`;

    log.info({ accountId }, "Account JSON backup exported");

    return new Response(JSON.stringify(snapshot), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return Response.json({ error: err.code }, { status });
    }
    log.error({ err, accountId }, "Account JSON backup export failed");
    return Response.json({ error: "INTERNAL", message: m.export.error }, { status: 500 });
  }
}
