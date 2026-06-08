import { AppError } from "@/server/api/errors";
import { requireAccountAccess } from "@/server/auth/session";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import { buildMonthCsv, getMonthTransactionsForExport } from "@/server/services/export-service";
import { toAccountSlug } from "@/lib/export-utils";
import { m } from "@/lib/messages";

const log = logger.child({ module: "export.month-csv" });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ accountId: string; monthId: string }> },
) {
  const { accountId, monthId } = await params;

  try {
    await requireAccountAccess(accountId);

    const [monthMeta, account] = await Promise.all([
      prisma.month.findFirst({
        where: { id: monthId, accountId },
        select: { year: true, month: true },
      }),
      prisma.account.findUnique({
        where: { id: accountId },
        select: { name: true },
      }),
    ]);

    if (!monthMeta || !account) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const transactions = await getMonthTransactionsForExport(accountId, monthId);

    if (transactions.length === 0) {
      return Response.json(
        { code: "NO_DATA", message: m.export.noData },
        { status: 422 },
      );
    }

    const csv = buildMonthCsv(transactions);
    const slug = toAccountSlug(account.name);
    const monthStr = String(monthMeta.month).padStart(2, "0");
    const filename = `${slug}_${monthMeta.year}-${monthStr}.csv`;

    log.info({ accountId, monthId, count: transactions.length }, "Month CSV exported");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return Response.json({ error: err.code }, { status });
    }
    log.error({ err, accountId, monthId }, "Month CSV export failed");
    return Response.json({ error: "INTERNAL", message: m.export.error }, { status: 500 });
  }
}
