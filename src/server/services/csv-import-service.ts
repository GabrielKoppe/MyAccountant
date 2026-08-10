import { randomUUID } from "crypto";

import type { TransactionExpenseType, TransactionPaymentMethod } from "@prisma/client";

import { applyMappingToRows } from "@/lib/csv-parser";
import { shiftYearMonth, utcDateOnly } from "@/lib/dates";
import { calcInstallmentAmounts } from "@/lib/installment-utils";
import {
  importMappingSchema,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type ExecuteImportInput,
} from "@/lib/schemas/csv-import";
import { serializeTransactionAlias } from "@/lib/serializers/transaction-alias";
import { NotFoundError, ConflictError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import { personalPartyMapForAccount } from "@/server/queries/responsible-party-filter";
import { ALIAS_INCLUDE } from "@/server/queries/transaction-aliases";

import { touchLastUsed } from "./settings-usage-touch";

const log = logger.child({ module: "csv-import-service" });

// `createManyAndReturn` não garante a ordem das linhas retornadas (a API não
// aceita `orderBy`, e um import grande pode ser chunkado pelo Prisma em vários
// INSERTs) — vincular tags por índice posicional seria arriscado com dados
// financeiros. Geramos o id nós mesmos e usamos createMany simples. O id não
// precisa ser um cuid "de verdade": só precisa passar em todo `z.string().cuid()`
// espalhado pelo app (regex de Zod: `/^c[^\s-]{8,}$/i`) — por isso o prefixo "c".
function generateTransactionId(): string {
  return `c${randomUUID().replace(/-/g, "")}`;
}

export type ImportResult = {
  tableId: string;
  imported: number;
  skipped: number;
  errors: { rowIndex: number; message: string }[];
  installmentGroupsCreated: number;
  /** Parcelas vinculadas a um InstallmentGroup que já existia (spec 73 §2.3) */
  installmentGroupsLinked: number;
  /** Linhas não vinculadas porque o número de parcela já estava lançado no grupo */
  installmentLinesSkipped: number;
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

  // Apelidos (spec 61 §2.6) — recarga fresca própria, independente do cache de
  // request da query RSC (DD-13): o servidor é sempre autoritativo no dual-run.
  const aliasRecords = await prisma.transactionAlias.findMany({
    where: { accountId: ctx.accountId, archivedAt: null },
    include: ALIAS_INCLUDE,
  });
  const aliases = aliasRecords.map(serializeTransactionAlias);
  const aliasById = new Map(aliases.map((a) => [a.id, a]));
  const aliasIgnoreRows = new Set(input.aliasIgnoreRows ?? []);

  // Normalize mapping — fills all .default() values (z.input<> types have optional fields)
  const mapping = importMappingSchema.parse(input.mapping);

  // Re-apply mapping server-side (authoritative parse) — mesmo match do client (dual-run, DD-13)
  const previewRows = applyMappingToRows(input.rows, mapping, aliases);

  // Optionally save template
  // `savedTemplateId`: o template gravado agora também foi USADO por esta
  // importação (spec 67 §7.4) — o `select` existe só para conhecer o id no toque
  // de `lastUsedAt` lá embaixo. Nenhum outro comportamento muda.
  let savedTemplateId: string | null = null;
  if (input.saveTemplateAs) {
    const saved = await prisma.csvTemplate.upsert({
      where: { accountId_name: { accountId: ctx.accountId, name: input.saveTemplateAs } },
      create: {
        accountId: ctx.accountId,
        name: input.saveTemplateAs,
        mapping: mapping as object,
        createdById: ctx.userId,
      },
      update: { mapping: mapping as object },
      select: { id: true },
    });
    savedTemplateId = saved.id;
  }

  const importErrors: { rowIndex: number; message: string }[] = [];
  let skipped = 0;
  // rowIndexes que o usuário marcou para ignorar manualmente no preview
  const manualIgnore = new Set(input.manualIgnoreRows ?? []);

  type TxData = {
    id: string;
    rowIndex: number;
    occurredOn: Date;
    amountCents: bigint;
    description: string | null;
    notes: string | null;
    categoryId: string | null;
    subcategoryId: string | null;
    institutionId: string | null;
    institutionText: string | null;
    cardInstallment: string | null;
    investmentType: string | null;
    responsiblePartyId: string | null;
    expenseType: TransactionExpenseType | null;
    paymentMethod: TransactionPaymentMethod | null;
    isPending: boolean;
    isFavorite: boolean;
    tagIds: string[];
    appliedAliasId: string | null;
    aliasTrigger: string | null;
    installmentGroupId?: string;
    installmentNumber?: number;
    originalAmountCents: bigint | null;
    originalCurrency: string | null;
    exchangeRate: number | null;
  };
  const transactionData: TxData[] = [];
  // O parser resolve o responsável para userId de membro (responsibleUserMappings);
  // traduz p/ a party pessoal, já que a transação é atribuída por responsiblePartyId.
  const personalPartyMap = await personalPartyMapForAccount(ctx.accountId);

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

    // ─── Apelido (spec 61 §2.6) — payload sobrescreve o CSV (DD-17), exceto
    // amountCents (NUNCA aplicado no import — DD-09). Opt-out por linha via
    // aliasIgnoreRows (DD-16); só aplica quando a linha não foi opt-out.
    let description = row.parsed.description;
    let notes = row.parsed.notes;
    let institutionText: string | null = null;
    let cardInstallment = row.parsed.cardInstallment;
    let investmentType = row.parsed.investmentType;
    let responsiblePartyId = row.parsed.responsibleUserId
      ? (personalPartyMap.get(row.parsed.responsibleUserId) ?? null)
      : null;
    let expenseType: TransactionExpenseType | null = null;
    let paymentMethod: TransactionPaymentMethod | null = null;
    let isPending = false;
    let isFavorite = false;
    // FX do extrato: valor sempre prevalece (DD-09). O apelido só preenche
    // quando o extrato não trouxe moeda estrangeira (fill-if-empty, DD-22).
    let originalAmountCents = row.parsed.originalAmountCents ?? null;
    let originalCurrency = row.parsed.originalCurrency ?? null;
    let exchangeRate = row.parsed.exchangeRate ?? null;
    let tagIds: string[] = [];
    let appliedAliasId: string | null = null;
    let aliasTrigger: string | null = null;

    const alias = row.parsed.appliedAliasId ? aliasById.get(row.parsed.appliedAliasId) : undefined;
    if (alias && !aliasIgnoreRows.has(row.rowIndex)) {
      appliedAliasId = alias.id;
      aliasTrigger = alias.trigger;
      if (alias.description !== null) description = alias.description;
      if (alias.notes !== null) notes = alias.notes;
      if (alias.categoryId !== null) categoryId = alias.categoryId;
      if (alias.institutionId !== null || alias.institutionText !== null) {
        institutionId = alias.institutionId;
        institutionText = alias.institutionText;
      }
      if (alias.subcategoryId !== null) {
        subcategoryId = alias.subcategoryId; // DD-18: subcategoria explícita do apelido tem prioridade
      } else if (alias.categoryId !== null && subcategoryId) {
        const stillChild = subcategories.some(
          (s) => s.id === subcategoryId && s.categoryId === categoryId,
        );
        if (!stillChild) subcategoryId = null; // órfã após troca de categoria — limpa (DD-18)
      }
      if (alias.responsiblePartyId !== null) responsiblePartyId = alias.responsiblePartyId;
      if (alias.cardInstallment !== null) cardInstallment = alias.cardInstallment;
      if (alias.investmentType !== null) investmentType = alias.investmentType;
      if (alias.expenseType !== null) expenseType = alias.expenseType;
      if (alias.paymentMethod !== null) paymentMethod = alias.paymentMethod;
      if (alias.isPending !== null) isPending = alias.isPending;
      if (alias.isFavorite !== null) isFavorite = alias.isFavorite;
      // Moeda estrangeira fill-if-empty (DD-22): só preenche quando o extrato
      // não trouxe FX próprio; se trouxe (moeda OU valor original), o extrato
      // prevalece (DD-09). Checar os dois porque o extrato pode trazer só o
      // valor original sem a moeda (mapeamento sem coluna de moeda).
      if (
        originalCurrency === null &&
        originalAmountCents === null &&
        alias.originalCurrency !== null
      ) {
        originalCurrency = alias.originalCurrency;
        originalAmountCents =
          alias.originalAmountCents !== null ? BigInt(alias.originalAmountCents) : null;
        exchangeRate = alias.exchangeRate;
      }
      if (alias.tags.length > 0) tagIds = alias.tags.map((t) => t.id);
    }

    transactionData.push({
      id: generateTransactionId(),
      rowIndex: row.rowIndex,
      occurredOn: new Date(row.parsed.occurredOn),
      amountCents: row.parsed.amountCents,
      description,
      notes,
      categoryId,
      subcategoryId,
      institutionId,
      institutionText,
      cardInstallment,
      investmentType,
      responsiblePartyId,
      expenseType,
      paymentMethod,
      isPending,
      isFavorite,
      tagIds,
      appliedAliasId,
      aliasTrigger,
      originalAmountCents,
      originalCurrency,
      exchangeRate,
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

    // Create/link InstallmentGroups for accepted suggestions and link transactions
    let installmentGroupsCreated = 0;
    let installmentGroupsLinked = 0;
    let installmentLinesSkipped = 0;

    for (const suggestion of input.acceptedInstallments ?? []) {
      // ─── Âncora do cronograma (spec 73 §2.1) ──────────────────────────────
      // A parcela de MAIOR número presente no arquivo é a que pertence à fatura
      // sendo importada, então ela ocupa o mês de competência escolhido no
      // wizard. `occurredOn` é a data da COMPRA — o extrato a repete em todas as
      // parcelas, então ela NÃO serve de âncora (spec 73 §1 BUG-01).
      const anchor = [...suggestion.lines].sort(
        (a, b) => b.installmentNumber - a.installmentNumber,
      )[0];
      const anchorTx = anchor
        ? transactionData.find((t) => t.rowIndex === anchor.rowIndex)
        : undefined;
      if (!anchor || !anchorTx) continue;

      // Dia da compra, reaplicado em cada competência (ajustado ao último dia
      // válido do mês por `utcDateOnly` — compra dia 31 → fevereiro dia 28).
      const anchorDay = anchorTx.occurredOn.getUTCDate();
      const expectedDateFor = (installmentNumber: number) => {
        const slot = shiftYearMonth(
          { year: month.year, month: month.month },
          installmentNumber - anchor.installmentNumber,
        );
        return utcDateOnly(slot.year, slot.month, anchorDay);
      };

      // ─── Vínculo com parcelamento existente (spec 73 §2.3) ────────────────
      if (suggestion.existingGroupId) {
        const existing = await tx.installmentGroup.findFirst({
          where: { id: suggestion.existingGroupId, accountId: ctx.accountId }, // ✅ multi-tenancy
          select: {
            id: true,
            transactions: { select: { installmentNumber: true } },
            pendingInstallments: {
              where: { settledAt: null },
              select: { id: true, installmentNumber: true },
            },
          },
        });
        if (!existing) throw new NotFoundError("Parcelamento a vincular");

        const takenNumbers = new Set(
          existing.transactions
            .map((t) => t.installmentNumber)
            .filter((n): n is number => n !== null),
        );

        for (const line of suggestion.lines) {
          const txIdx = rowIndexToTxIdx.get(line.rowIndex);
          if (txIdx === undefined) continue;

          // Número já lançado no grupo: importa a linha SEM vínculo. Dois itens
          // com o mesmo installmentNumber quebrariam o cronograma e o progresso.
          if (takenNumbers.has(line.installmentNumber)) {
            installmentLinesSkipped++;
            continue;
          }

          transactionData[txIdx].installmentGroupId = existing.id;
          transactionData[txIdx].installmentNumber = line.installmentNumber;
          takenNumbers.add(line.installmentNumber);

          // A pendente deste número acabou de ser materializada por esta linha.
          const consumed = existing.pendingInstallments.find(
            (pi) => pi.installmentNumber === line.installmentNumber,
          );
          if (consumed) await tx.pendingInstallment.delete({ where: { id: consumed.id } });
        }

        installmentGroupsLinked++;
        continue;
      }

      // ─── Novo grupo ───────────────────────────────────────────────────────
      // Estima o total real da compra: totalAmountCents representa apenas as parcelas
      // presentes no CSV; escalamos pelo total de parcelas.
      // `BigInt(...)`: o tipo de entrada é `z.input<>` (z.coerce.bigint aceita
      // string), então não dá para assumir bigint sem coagir.
      const estimatedTotalCents =
        (BigInt(suggestion.totalAmountCents) * BigInt(suggestion.installmentCount)) /
        BigInt(suggestion.lines.length);

      const group = await tx.installmentGroup.create({
        data: {
          accountId: ctx.accountId,
          description: suggestion.groupDescription,
          totalCents: estimatedTotalCents,
          installmentCount: suggestion.installmentCount,
          startDate: expectedDateFor(1),
          sectionId: input.sectionId,
          tableTypeId: input.tableTypeId,
          // A fatura é a fonte das parcelas deste grupo: lançar na criação do
          // mês duplicaria a linha do CSV (spec 73 §2.4).
          autoCreateOnNewMonth: false,
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
        const amounts = calcInstallmentAmounts(estimatedTotalCents, suggestion.installmentCount);
        await tx.pendingInstallment.createMany({
          data: missingNumbers.map((num) => ({
            accountId: ctx.accountId,
            installmentGroupId: group.id,
            installmentNumber: num,
            amountCents: amounts[num - 1],
            expectedDate: expectedDateFor(num),
            description: suggestion.groupDescription,
          })),
        });
      }
    }

    if (transactionData.length > 0) {
      const txSource = input.fileType === "xlsx" ? "xlsx_import" : "csv_import";
      // id gerado por nós (generateTransactionId) — createMany não retorna as
      // linhas criadas, e createManyAndReturn não garante a ordem de retorno
      // (sem orderBy; um import grande pode ser chunkado em vários INSERTs).
      // Conhecer o id de antemão é o que permite vincular as tags do apelido
      // em transaction_tags logo abaixo sem depender de nenhuma ordem.
      await tx.transaction.createMany({
        data: transactionData.map((t) => ({
          id: t.id,
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
          responsiblePartyId: t.responsiblePartyId,
          categoryId: t.categoryId,
          institutionId: t.institutionId,
          institutionText: t.institutionText,
          expenseType: t.expenseType,
          paymentMethod: t.paymentMethod,
          isPending: t.isPending,
          isFavorite: t.isFavorite,
          source: txSource,
          installmentGroupId: t.installmentGroupId ?? null,
          installmentNumber: t.installmentNumber ?? null,
          originalAmountCents: t.originalAmountCents ?? null,
          originalCurrency: t.originalCurrency ?? null,
          exchangeRate: t.exchangeRate ?? null,
          createdById: ctx.userId,
          metadata: t.appliedAliasId
            ? { appliedAliasId: t.appliedAliasId, aliasTrigger: t.aliasTrigger }
            : {},
        })),
      });

      // tagIds do apelido substitui o conjunto (não faz união) — cada linha só
      // entra aqui quando o próprio apelido define ≥1 tag (DD-04).
      const tagPairs = transactionData.flatMap((t) =>
        t.tagIds.map((tagId) => ({ transactionId: t.id, tagId })),
      );
      if (tagPairs.length > 0) {
        await tx.transactionTag.createMany({ data: tagPairs, skipDuplicates: true });
      }
    }

    return { table, installmentGroupsCreated, installmentGroupsLinked, installmentLinesSkipped };
  });

  const aliasesApplied = transactionData.filter((t) => t.appliedAliasId !== null).length;
  log.info(
    { accountId: ctx.accountId, tableId: result.table.id, aliasesApplied },
    "CSV import concluído",
  );

  // ─── lastUsedAt (spec 67 §2.4/§7.4, SET-07) ─────────────────────────────────
  // A importação é uma das escritas que "consomem" objetos de configuração, então
  // é aqui que a recência deles é registrada. Regras:
  //  • FORA da `$transaction` e sem `await`: é telemetria de rótulo, não pode
  //    atrasar a resposta nem desfazer um import já commitado;
  //  • só objetos que de fato entraram em `transactionData` (linhas realmente
  //    importadas) — linhas com erro ou ignoradas não contam como uso;
  //  • `touchLastUsed` dedupe ids, descarta nulos e filtra por `accountId`.
  void touchLastUsed(ctx.accountId, {
    section: [input.sectionId],
    tableType: [input.tableTypeId],
    // Categorias/subcategorias/instituições auto-criadas pelo upsert
    // (`onCategoryNotFound: "create"` etc.) também entram: nasceram para atender
    // uma linha deste arquivo, logo foram usadas agora.
    category: transactionData.map((t) => t.categoryId),
    subcategory: transactionData.map((t) => t.subcategoryId),
    institution: transactionData.map((t) => t.institutionId),
    // Responsável pode vir do apelido OU do de-para de responsável do mapeamento
    // (`responsibleUserMappings` → party pessoal). Os dois são uso real.
    responsibleParty: transactionData.map((t) => t.responsiblePartyId),
    transactionAlias: transactionData.map((t) => t.appliedAliasId),
    // `templateId`: modelo escolhido no passo de mapeamento (informado pelo
    // wizard). `savedTemplateId`: modelo gravado por "salvar como template"
    // nesta mesma importação.
    csvTemplate: [input.templateId, savedTemplateId],
  });

  return {
    tableId: result.table.id,
    imported: transactionData.length,
    skipped,
    errors: importErrors,
    installmentGroupsCreated: result.installmentGroupsCreated,
    installmentGroupsLinked: result.installmentGroupsLinked,
    installmentLinesSkipped: result.installmentLinesSkipped,
  };
}

export const csvImportService = {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  executeImport,
};
