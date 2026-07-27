import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  CreateTableTypeInput,
  DeleteTableTypeInput,
  UpdateTableTypeInput,
} from "@/lib/schemas/settings";

const log = logger.child({ module: "table-type-service" });

export async function createTableType(input: CreateTableTypeInput, ctx: ActionContext) {
  const existing = await prisma.tableType.findUnique({
    where: { accountId_name: { accountId: ctx.accountId, name: input.name } },
  });
  if (existing) throw new ConflictError("Já existe um tipo de tabela com este nome.");

  const onlyHidden: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(input.hiddenColumns)) {
    if (value) onlyHidden[key] = true;
  }

  const tableType = await prisma.tableType.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      isDefault: false,
      hiddenColumns: onlyHidden,
      rowLayout: input.rowLayout ?? "columns",
    },
    select: { id: true },
  });

  log.info({ tableTypeId: tableType.id, accountId: ctx.accountId }, "TableType created");
  return { tableTypeId: tableType.id };
}

export async function updateTableType(input: UpdateTableTypeInput, ctx: ActionContext) {
  const tableType = await prisma.tableType.findUnique({
    where: { id: input.tableTypeId },
    select: { accountId: true, isDefault: true },
  });
  if (!tableType || tableType.accountId !== ctx.accountId)
    throw new NotFoundError("Tipo de tabela");

  if (input.name && !tableType.isDefault) {
    const nameConflict = await prisma.tableType.findFirst({
      where: { accountId: ctx.accountId, name: input.name, id: { not: input.tableTypeId } },
    });
    if (nameConflict) throw new ConflictError("Já existe um tipo com este nome.");
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.hiddenColumns !== undefined && !tableType.isDefault) {
    const onlyHidden: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(input.hiddenColumns)) {
      if (value) onlyHidden[key] = true;
    }
    data.hiddenColumns = onlyHidden;
  }
  // rowLayout é apenas apresentação (não muda dados) — editável inclusive no tipo
  // padrão, para o usuário poder ativar o layout "rich" mesmo sem criar um tipo novo.
  if (input.rowLayout !== undefined) {
    data.rowLayout = input.rowLayout;
  }

  await prisma.tableType.update({ where: { id: input.tableTypeId }, data });

  log.info({ tableTypeId: input.tableTypeId, accountId: ctx.accountId }, "TableType updated");
}

export async function deleteTableType(input: DeleteTableTypeInput, ctx: ActionContext) {
  const tableType = await prisma.tableType.findUnique({
    where: { id: input.tableTypeId },
    select: { accountId: true, isDefault: true },
  });
  if (!tableType || tableType.accountId !== ctx.accountId)
    throw new NotFoundError("Tipo de tabela");
  if (tableType.isDefault) throw new ForbiddenError("O tipo padrão não pode ser deletado.");

  const tableCount = await prisma.financeTable.count({
    where: { tableTypeId: input.tableTypeId, accountId: ctx.accountId },
  });
  if (tableCount > 0) {
    throw new ConflictError(`Não é possível deletar: há ${tableCount} tabela(s) usando este tipo.`);
  }

  await prisma.tableType.delete({ where: { id: input.tableTypeId } });

  log.info({ tableTypeId: input.tableTypeId, accountId: ctx.accountId }, "TableType deleted");
}
