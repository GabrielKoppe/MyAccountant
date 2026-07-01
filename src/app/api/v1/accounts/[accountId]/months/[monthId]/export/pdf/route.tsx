import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import React from "react";

import { AppError } from "@/server/api/errors";
import { requireAccountAccess } from "@/server/auth/session";
import { logger } from "@/server/logger";
import { getMonthDataForPdf } from "@/server/services/export-service";
import { toAccountSlug } from "@/lib/export-utils";
import { m } from "@/lib/messages";
import { MonthPdfDocument } from "@/components/export/MonthPdfDocument";

const log = logger.child({ module: "export.month-pdf" });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ accountId: string; monthId: string }> },
) {
  const { accountId, monthId } = await params;

  try {
    await requireAccountAccess(accountId);

    const pdfData = await getMonthDataForPdf(accountId, monthId);

    if (!pdfData) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    if (pdfData.transactions.length === 0) {
      return Response.json({ code: "NO_DATA", message: m.export.noData }, { status: 422 });
    }

    const element = React.createElement(MonthPdfDocument, {
      data: pdfData,
    }) as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);
    const arrayBuffer = new Uint8Array(buffer);

    const slug = toAccountSlug(pdfData.accountName);
    const monthStr = String(pdfData.month).padStart(2, "0");
    const filename = `${slug}_${pdfData.year}-${monthStr}.pdf`;

    log.info({ accountId, monthId, count: pdfData.transactions.length }, "Month PDF exported");

    return new Response(arrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === "UNAUTHORIZED" ? 401 : 403;
      return Response.json({ error: err.code }, { status });
    }
    log.error({ err, accountId, monthId }, "Month PDF export failed");
    return Response.json({ error: "INTERNAL", message: m.export.error }, { status: 500 });
  }
}
