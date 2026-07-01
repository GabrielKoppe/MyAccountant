import { addMonths } from "date-fns";
import { prisma } from "@/server/prisma";
import { NotFoundError, ConflictError } from "@/server/api/errors";
import { applyMappingToRows } from "@/lib/csv-parser";
import { calcInstallmentAmounts } from "@/lib/installment-utils";
import {
  importMappingSchema,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type ExecuteImportInput,
} from "@/lib/schemas/csv-import";

export type ImportResult = {
  tableId: string;
  imported: number;
  skipped: number;
  errors: { rowIndex: number; message: string }[];
  installmentGroupsCreated: number;
};

async function listTemplates(accountId: string) {
  return prisma.csvTemplate.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, mapping: true, createdAt: true },
  });
}

async function createTemplate(
  input: CreateTemplateInput,
  ctx: { accountId: string; userId: string },
) {
  const existing = await prisma.csvTemplate.findFirst({
    where: { accountId: ctx.accountId, name: input.name },
  });
  if (existing) throw new ConflictError("Já existe um template com este nome.");

  return prisma.csvTemplate.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      mapping: input.mapping as object,
      createdById: ctx.userId,
    },
    select: { id: true, name: true },
  });
}

async function updateTemplate(input: UpdateTemplateInput, ctx: { accountId: string }) {
  const tpl = await prisma.csvTemplate.findFirst({
    where: { id: input.templateId, accountId: ctx.accountId },
  });
  if (!tpl) throw new NotFoundError("Template");

  return prisma.csvTemplate.update({
    where: { id: input.templateId },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.mapping ? { mapping: input.mapping as object } : {}),
    },
    select: { id: true, name: true },
  });
}

async function deleteTemplate(templateId: string, ctx: { accountId: string }) {
  const tpl = await prisma.csvTemplate.findFirst({
    where: { id: templateId, accountId: ctx.accountId },
  });
  if (!tpl) throw new NotFoundError("Template");

  await prisma.csvTemplate.delete({ where: { id: templateId } });
}

async function executeImport(
  input: ExecuteImportInput,
  ctx: { accountId: string; userId: string },
): Promise<ImportResult> {
  // Verify resources belong to this account
  const [month, section, tableType] = await Promise.all([
    prisma.month.findFirst({ where: { id: input.monthId, accountId: ctx.accountId } }),
    prisma.section.findFirst({ where: { id: input.sectionId, accountId: ctx.accountId } }),
    prisma.tableType.findFirst({ where: { id: input.tableTypeId, accountId: ctx.accountId } }),
  ]);

  if (!month) throw new NotFoundError("Mês");
  if (!section) throw new NotFoundError("Seção");
  if (!tableType) throw new NotFoundError("Tipo de tabela");

  // Load categories, subcategories + institutions for name resolution
  const [categories, subcategories, institutions] = await Promise.all([
    prisma.category.findMany({
      where: { accountId: ctx.accountId },
      select: { id: true, name: true },
    }),
    prisma.subcategory.findMany({
      where: { accountId: ctx.accountId },
      select: { id: true, name: true, categoryId: true },
    }),
    prisma.institution.findMany({
      where: { accountId: ctx.accountId },
      select: { id: true, name: true },
    }),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  // subcategory lookup: "categoryId:name" → subcategoryId
  const subcategoryMap = new Map(
    subcategories.map((s) => [`${s.categoryId}:${s.name.toLowerCase()}`, s.id]),
  );
  const institutionMap = new Map(institutions.map((i) => [i.name.toLowerCase(), i.id]));

  // Normalize mapping — fills all .default() values (z.input<> types have optional fields)
  const mapping = importMappingSchema.parse(input.mapping);

  // Re-apply mapping server-side (authoritative parse)
  const previewRows = applyMappingToRows(input.rows, mapping);

  // Optionally save template
  if (input.saveTemplateAs) {
    await prisma.csvTemplate.upsert({
      where: { accountId_name: { accountId: ctx.accountId, name: input.saveTemplateAs } },
      create: {
        accountId: ctx.accountId,
        name: input.saveTemplateAs,
        mapping: mapping as object,
        createdById: ctx.userId,
      },
      update: { mapping: mapping as object },
    });
  }

  const importErrors: { rowIndex: number; message: string }[] = [];
  let skipped = 0;
  // rowIndexes que o usuário marcou para ignorar manualmente no preview
  const manualIgnore = new Set(input.manualIgnoreRows ?? []);

  type TxData = {
    rowIndex: number;
    occurredOn: Date;
    amountCents: bigint;
    description: string | null;
    notes: string | null;
    categoryId: string | null;
    subcategoryId: string | null;
    institutionId: string | null;
    cardInstallment: string | null;
    investmentType: string | null;
    responsibleUserId: string | null;
    installmentGroupId?: string;
    installmentNumber?: number;
    originalAmountCents: bigint | null;
    originalCurrency: string | null;
    exchangeRate: number | null;
  };
  const transactionData: TxData[] = [];

  for (const row of previewRows) {
    if (row.status === "ignored") {
      skipped++;
      continue;
    }
    if (row.status === "error" || !row.parsed) {
      importErrors.push({ rowIndex: row.rowIndex, message: row.error ?? "Erro desconhecido" });
      continue;
    }
    // Linha válida que o usuário optou por ignorar manualmente no preview
    if (manualIgnore.has(row.rowIndex)) {
      skipped++;
      continue;
    }

    // Resolve category
    let categoryId: string | null = mapping.defaultCategoryId;
    if (row.parsed.categoryName) {
      const found = categoryMap.get(row.parsed.categoryName.toLowerCase());
      if (found) {
        categoryId = found;
      } else if (mapping.onCategoryNotFound === "fail") {
        importErrors.push({
          rowIndex: row.rowIndex,
          message: `Categoria não encontrada: "${row.parsed.categoryName}"`,
        });
        continue;
      } else if (mapping.onCategoryNotFound === "create") {
        const newCat = await prisma.category.upsert({
          where: {
            accountId_name: { accountId: ctx.accountId, name: row.parsed.categoryName },
          },
          create: {
            accountId: ctx.accountId,
            name: row.parsed.categoryName,
            createdById: ctx.userId,
          },
          update: {},
          select: { id: true, name: true },
        });
        categoryMap.set(newCat.name.toLowerCase(), newCat.id);
        categoryId = newCat.id;
      }
    }

    // Resolve institution
    let institutionId: string | null = mapping.defaultInstitutionId;
    if (row.parsed.institutionName) {
      const found = institutionMap.get(row.parsed.institutionName.toLowerCase());
      if (found) {
        institutionId = found;
      } else if (mapping.onInstitutionNotFound === "fail") {
        importErrors.push({
          rowIndex: row.rowIndex,
          message: `Instituição não encontrada: "${row.parsed.institutionName}"`,
        });
        continue;
      } else if (mapping.onInstitutionNotFound === "create") {
        const newInst = await prisma.institution.upsert({
          where: {
            accountId_name: { accountId: ctx.accountId, name: row.parsed.institutionName },
          },
          create: {
            accountId: ctx.accountId,
            name: row.parsed.institutionName,
            createdById: ctx.userId,
          },
          update: {},
          select: { id: true, name: true },
        });
        institutionMap.set(newInst.name.toLowerCase(), newInst.id);
        institutionId = newInst.id;
      }
    }

    // Resolve subcategory (only if category was resolved)
    let subcategoryId: string | null = null;
    if (categoryId && row.parsed.subcategoryName) {
      const key = `${categoryId}:${row.parsed.subcategoryName.toLowerCase()}`;
      const foundSub = subcategoryMap.get(key);
      if (foundSub) {
        subcategoryId = foundSub;
      } else if (mapping.onSubcategoryNotFound === "create") {
        const newSub = await prisma.subcategory.upsert({
          where: { categoryId_name: { categoryId, name: row.parsed.subcategoryName } },
          create: { categoryId, accountId: ctx.accountId, name: row.parsed.subcategoryName },
          update: {},
          select: { id: true, name: true },
        });
        subcategoryMap.set(`${categoryId}:${newSub.name.toLowerCase()}`, newSub.id);
        subcategoryId = newSub.id;
      }
    }

    transactionData.push({
      rowIndex: row.rowIndex,
      occurredOn: new Date(row.parsed.occurredOn),
      amountCents: row.parsed.amountCents,
      description: row.parsed.description,
      notes: row.parsed.notes,
      categoryId,
      subcategoryId,
      institutionId,
      cardInstallment: row.parsed.cardInstallment,
      investmentType: row.parsed.investmentType,
      responsibleUserId: row.parsed.responsibleUserId,
      originalAmountCents: row.parsed.originalAmountCents ?? null,
      originalCurrency: row.parsed.originalCurrency ?? null,
      exchangeRate: row.parsed.exchangeRate ?? null,
    });
  }

  // Build rowIndex → transactionData index map for installment linking
  const rowIndexToTxIdx = new Map<number, number>();
  transactionData.forEach((t, i) => rowIndexToTxIdx.set(t.rowIndex, i));

  // Create FinanceTable + Transactions atomically
  const result = await prisma.$transaction(async (tx) => {
    const tableCount = await tx.financeTable.count({
      where: { monthId: input.monthId, sectionId: input.sectionId },
    });

    const table = await tx.financeTable.create({
      data: {
        accountId: ctx.accountId,
        monthId: input.monthId,
        sectionId: input.sectionId,
        tableTypeId: input.tableTypeId,
        name: input.tableName,
        countInMonth: input.countInMonth,
        sourceMethod: "import",
        displayOrder: tableCount,
        createdById: ctx.userId,
      },
    });

    // Create InstallmentGroups for accepted suggestions and link transactions
    let installmentGroupsCreated = 0;
    for (const suggestion of input.acceptedInstallments ?? []) {
      // Estima o total real da compra: totalAmountCents representa apenas as parcelas
      // presentes no CSV; escalamos pelo total de parcelas.
      const estimatedTotalCents =
        (suggestion.totalAmountCents * BigInt(suggestion.installmentCount)) /
        BigInt(suggestion.lines.length);

      const group = await tx.installmentGroup.create({
        data: {
          accountId: ctx.accountId,
          description: suggestion.groupDescription,
          totalCents: estimatedTotalCents,
          installmentCount: suggestion.installmentCount,
          startDate:
            transactionData.find((t) => suggestion.lines.some((l) => l.rowIndex === t.rowIndex))
              ?.occurredOn ?? new Date(),
          sectionId: input.sectionId,
          tableTypeId: input.tableTypeId,
        },
        select: { id: true },
      });
      installmentGroupsCreated++;

      for (const line of suggestion.lines) {
        const txIdx = rowIndexToTxIdx.get(line.rowIndex);
        if (txIdx !== undefined) {
          transactionData[txIdx].installmentGroupId = group.id;
          transactionData[txIdx].installmentNumber = line.installmentNumber;
        }
      }

      // Criar PendingInstallments para parcelas ausentes no CSV (instâncias suspensas)
      const presentNumbers = new Set(suggestion.lines.map((l) => l.installmentNumber));
      const missingNumbers = Array.from(
        { length: suggestion.installmentCount },
        (_, i) => i + 1,
      ).filter((n) => !presentNumbers.has(n));

      if (missingNumbers.length > 0) {
        // Deriva a data da parcela 1 a partir da primeira parcela presente
        const firstPresent = [...suggestion.lines].sort(
          (a, b) => a.installmentNumber - b.installmentNumber,
        )[0];
        const firstPresentTx = transactionData.find((t) => t.rowIndex === firstPresent.rowIndex);
        if (firstPresentTx) {
          const startDate = addMonths(
            firstPresentTx.occurredOn,
            -(firstPresent.installmentNumber - 1),
          );
          const amounts = calcInstallmentAmounts(estimatedTotalCents, suggestion.installmentCount);
          await tx.pendingInstallment.createMany({
            data: missingNumbers.map((num) => ({
              accountId: ctx.accountId,
              installmentGroupId: group.id,
              installmentNumber: num,
              amountCents: amounts[num - 1],
              expectedDate: addMonths(startDate, num - 1),
              description: suggestion.groupDescription,
            })),
          });
        }
      }
    }

    if (transactionData.length > 0) {
      const txSource = input.fileType === "xlsx" ? "xlsx_import" : "csv_import";
      await tx.transaction.createMany({
        data: transactionData.map((t) => ({
          accountId: ctx.accountId,
          monthId: input.monthId,
          tableId: table.id,
          sectionId: input.sectionId,
          occurredOn: t.occurredOn,
          amountCents: t.amountCents,
          description: t.description,
          notes: t.notes,
          subcategoryId: t.subcategoryId,
          cardInstallment: t.cardInstallment,
          investmentType: t.investmentType,
          responsibleUserId: t.responsibleUserId,
          categoryId: t.categoryId,
          institutionId: t.institutionId,
          source: txSource,
          installmentGroupId: t.installmentGroupId ?? null,
          installmentNumber: t.installmentNumber ?? null,
          originalAmountCents: t.originalAmountCents ?? null,
          originalCurrency: t.originalCurrency ?? null,
          exchangeRate: t.exchangeRate ?? null,
          createdById: ctx.userId,
          metadata: {},
        })),
      });
    }

    return { table, installmentGroupsCreated };
  });

  return {
    tableId: result.table.id,
    imported: transactionData.length,
    skipped,
    errors: importErrors,
    installmentGroupsCreated: result.installmentGroupsCreated,
  };
}

export const csvImportService = {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  executeImport,
};
