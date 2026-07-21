import { z } from "zod";

import { accountSnapshotSchema } from "@/lib/schemas/account-backup";
import { AppError, ForbiddenError } from "@/server/api/errors";
import { requireAccountAccess } from "@/server/auth/session";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import { importSnapshot } from "@/server/services/account-backup-service";

// Import do backup completo da Account em JSON (spec 64, Fase 3 — BKP-02).
// Owner-only: operação sobre a conta inteira (configuração + dados reais).
// POST (não Server Action, DD-04): o corpo de uma conta inteira pode passar
// facilmente do limite de 1 MB de uma Server Action.

const log = logger.child({ module: "import.account-json" });

// DD-07: cap de tamanho do corpo — rejeita ANTES de qualquer parse/processamento.
const MAX_BODY_BYTES = 8 * 1024 * 1024;

const importBodySchema = z.object({
  mode: z.enum(["new", "overwrite"]),
  confirmName: z.string().optional(),
  snapshot: accountSnapshotSchema,
});

const ERROR_STATUS: Record<string, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;

  try {
    // DD-07: cap de tamanho — antes de qualquer autenticação/parse.
    const contentLength = Number(req.headers.get("content-length"));
    if (contentLength > MAX_BODY_BYTES) {
      return Response.json(
        {
          error: "TOO_LARGE",
          message: "O arquivo de backup excede o limite de 8 MB.",
        },
        { status: 413 },
      );
    }

    const { user, member } = await requireAccountAccess(accountId);
    if (member.role !== "owner") {
      throw new ForbiddenError("Apenas o owner pode importar o backup da conta");
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return Response.json(
        { error: "VALIDATION", message: "JSON inválido" },
        { status: 400 },
      );
    }

    const parsed = importBodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          error: "VALIDATION",
          message: "Dados inválidos no backup enviado",
          fieldErrors: Object.fromEntries(
            Object.entries(parsed.error.flatten().fieldErrors).map(([k, msgs]) => [
              k,
              Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : "",
            ]),
          ),
        },
        { status: 400 },
      );
    }

    const body = parsed.data;

    if (body.mode === "overwrite") {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { name: true },
      });
      if (!account || body.confirmName !== account.name) {
        return Response.json(
          {
            error: "VALIDATION",
            message: "Nome de confirmação não confere com o nome atual da conta",
            fieldErrors: { confirmName: "Digite o nome atual da conta para confirmar" },
          },
          { status: 400 },
        );
      }
    }

    const result = await importSnapshot(body.snapshot, {
      mode: body.mode,
      targetAccountId: accountId,
      userId: user.id,
    });

    log.info({ accountId, mode: body.mode, userId: user.id }, "Account JSON backup imported");

    return Response.json({ ok: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      const status = ERROR_STATUS[err.code] ?? 500;
      return Response.json({ ok: false, error: { code: err.code, message: err.message } }, { status });
    }
    log.error({ err, accountId }, "Account JSON backup import failed");
    return Response.json(
      { ok: false, error: { code: "INTERNAL", message: "Erro interno ao importar o backup" } },
      { status: 500 },
    );
  }
}
