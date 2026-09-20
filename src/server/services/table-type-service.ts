import {
  DEFAULT_INHERIT_ON_NEW_ROW,
  DEFAULT_KEEP_GHOST_ROW,
  DEFAULT_TABLE_TYPE_SORT,
  type CreateTableTypeInput,
  type DeleteTableTypeInput,
  type UpdateTableTypeInput,
} from "@/lib/schemas/settings";
import {
  hiddenColumnsFromVisible,
  normalizeVisibleColumns,
  visibleColumnsFromHidden,
  type TableColumnKey,
} from "@/lib/table-columns";
import type { ActionContext } from "@/server/api/define-action";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "table-type-service" });

/** Forma compacta do mapa legado: só as chaves ocultas, todas com `true`. */
function compactHidden(map: Record<string, boolean | undefined>): Record<string, boolean> {
  const onlyHidden: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(map)) {
    if (value) onlyHidden[key] = true;
  }
  return onlyHidden;
}

/**
 * Spec 69 P0 — a ESCRITA DUPLA: `visibleColumns` é a fonte da verdade (ordenada),
 * `hiddenColumns` é o espelho derivado que o renderer atual do mês ainda lê.
 * Sempre resolvidos JUNTOS, nunca por spread do input inteiro (§15).
 *
 * - se o chamador mandou `visibleColumns`, ele manda: o mapa é derivado dele;
 * - se mandou só `hiddenColumns` (chamador legado), a lista é derivada do mapa;
 * - se não mandou nenhum dos dois, retorna `null` — "não mencionei", nada muda.
 */
function resolveColumns(input: {
  visibleColumns?: readonly string[];
  hiddenColumns?: Record<string, boolean | undefined>;
}): { visibleColumns: TableColumnKey[]; hiddenColumns: Record<string, boolean> } | null {
  if (input.visibleColumns !== undefined) {
    const visibleColumns = normalizeVisibleColumns(input.visibleColumns);
    return { visibleColumns, hiddenColumns: hiddenColumnsFromVisible(visibleColumns) };
  }
  if (input.hiddenColumns !== undefined) {
    const hiddenColumns = compactHidden(input.hiddenColumns);
    return { visibleColumns: visibleColumnsFromHidden(hiddenColumns), hiddenColumns };
  }
  return null;
}

export async function createTableType(input: CreateTableTypeInput, ctx: ActionContext) {
  const existing = await prisma.tableType.findUnique({
    where: { accountId_name: { accountId: ctx.accountId, name: input.name } },
  });
  if (existing) throw new ConflictError("Já existe um tipo de tabela com este nome.");

  const columns = resolveColumns(input) ?? {
    visibleColumns: visibleColumnsFromHidden({}),
    hiddenColumns: {},
  };

  const tableType = await prisma.tableType.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      isDefault: false,
      hiddenColumns: columns.hiddenColumns,
      visibleColumns: columns.visibleColumns,
      rowLayout: input.rowLayout ?? "columns",
      density: input.density ?? "default",
      pinnedColumns: input.pinnedColumns ?? [],
      // Default `["occurredOn"]`, não `[]`: espelha o `@default` do Prisma e
      // preserva o comportamento de sempre da linha-fantasma (a data continua
      // valendo para o próximo lançamento). Ver `DEFAULT_INHERIT_ON_NEW_ROW`.
      inheritOnNewRow: input.inheritOnNewRow ?? DEFAULT_INHERIT_ON_NEW_ROW,
      // `desc` e linha-fantasma desligada: um tipo novo nasce reproduzindo o que a
      // tabela do mês já faz hoje. Ver `DEFAULT_TABLE_TYPE_SORT` /
      // `DEFAULT_KEEP_GHOST_ROW` — os mesmos valores do `@default` do Prisma.
      defaultSort: input.defaultSort ?? { ...DEFAULT_TABLE_TYPE_SORT },
      groupBy: input.groupBy ?? null,
      showFooterTotal: input.showFooterTotal ?? true,
      showGroupSubtotal: input.showGroupSubtotal ?? false,
      allowBulkEdit: input.allowBulkEdit ?? true,
      keepGhostRow: input.keepGhostRow ?? DEFAULT_KEEP_GHOST_ROW,
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

  // Construção CAMPO A CAMPO (§15): nunca `{ ...input }`. `undefined` = "não
  // mencionei" e o campo não pode entrar no `data`, senão o Prisma o sobrescreve.
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;

  // O conjunto de colunas continua bloqueado no tipo padrão — mesma regra de antes.
  if (!tableType.isDefault) {
    const columns = resolveColumns(input);
    if (columns) {
      data.visibleColumns = columns.visibleColumns;
      data.hiddenColumns = columns.hiddenColumns;
    }
  }

  // Os campos abaixo são só apresentação (não mudam dados) e são editáveis
  // inclusive no tipo padrão, para o usuário poder trocar layout/densidade sem
  // precisar criar um tipo novo.
  if (input.rowLayout !== undefined) data.rowLayout = input.rowLayout;
  if (input.density !== undefined) data.density = input.density;
  if (input.pinnedColumns !== undefined) data.pinnedColumns = input.pinnedColumns;
  if (input.inheritOnNewRow !== undefined) data.inheritOnNewRow = input.inheritOnNewRow;
  if (input.defaultSort !== undefined) data.defaultSort = input.defaultSort;
  if (input.groupBy !== undefined) data.groupBy = input.groupBy;
  if (input.showFooterTotal !== undefined) data.showFooterTotal = input.showFooterTotal;
  if (input.showGroupSubtotal !== undefined) data.showGroupSubtotal = input.showGroupSubtotal;
  if (input.allowBulkEdit !== undefined) data.allowBulkEdit = input.allowBulkEdit;
  if (input.keepGhostRow !== undefined) data.keepGhostRow = input.keepGhostRow;

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
