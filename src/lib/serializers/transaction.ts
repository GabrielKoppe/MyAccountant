// Serialização centralizada de transações: BigInt → string, Date → string ISO.
// Usar em todos os RSC que passam transações para Client Components.
// Nunca converter amountCents ou datas de transação inline — use este helper.

import type {
  TransactionExpenseType,
  TransactionPaymentMethod,
  TransactionSource,
} from "@prisma/client";
import type { InvestmentType } from "@/lib/schemas/transaction";
import type { TransactionRow } from "@/components/transactions/types";

type PrismaTransaction = {
  id: string;
  tableId: string;
  sectionId: string;
  monthId: string;
  occurredOn: Date;
  amountCents: bigint;
  description: string | null;
  notes: string | null;
  isPending: boolean;
  isFavorite: boolean;
  categoryId: string | null;
  subcategoryId: string | null;
  institutionId: string | null;
  institutionText: string | null;
  responsiblePartyId: string | null;
  cardInstallment: string | null;
  investmentType: string | null;
  expenseType: TransactionExpenseType | null;
  paymentMethod: TransactionPaymentMethod | null;
  source: TransactionSource;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentGroup: { id: string; description: string; installmentCount: number } | null;
  originalAmountCents: bigint | null;
  originalCurrency: string | null;
  exchangeRate: { toNumber: () => number } | null;
  createdById: string;
  createdAt: Date;
  updatedById: string | null;
  updatedAt: Date;
  tags?: { tag: { id: string; name: string; color: string | null } }[];
  _count?: { linksAsSource: number; linksAsTarget: number };
};

export function serializeTransaction(
  tx: PrismaTransaction,
): TransactionRow & { tableId: string; sectionId: string } {
  return {
    id: tx.id,
    tableId: tx.tableId,
    sectionId: tx.sectionId,
    monthId: tx.monthId,
    occurredOn: tx.occurredOn.toISOString().slice(0, 10),
    amountCents: tx.amountCents.toString(),
    description: tx.description,
    notes: tx.notes,
    isPending: tx.isPending,
    isFavorite: tx.isFavorite,
    categoryId: tx.categoryId,
    subcategoryId: tx.subcategoryId,
    institutionId: tx.institutionId,
    institutionText: tx.institutionText,
    responsiblePartyId: tx.responsiblePartyId,
    cardInstallment: tx.cardInstallment,
    investmentType: tx.investmentType as InvestmentType | null,
    expenseType: tx.expenseType,
    paymentMethod: tx.paymentMethod,
    source: tx.source,
    installmentGroupId: tx.installmentGroupId,
    installmentNumber: tx.installmentNumber,
    installmentGroupCount: tx.installmentGroup?.installmentCount ?? null,
    originalAmountCents: tx.originalAmountCents?.toString() ?? null,
    originalCurrency: tx.originalCurrency,
    exchangeRate: tx.exchangeRate?.toNumber() ?? null,
    tags: tx.tags?.map((t) => t.tag) ?? [],
    linkCount: (tx._count?.linksAsSource ?? 0) + (tx._count?.linksAsTarget ?? 0),
    createdById: tx.createdById,
    createdAt: tx.createdAt.toISOString(),
    updatedById: tx.updatedById,
    updatedAt: tx.updatedAt.toISOString(),
  };
}
