// Serialização centralizada de transações: BigInt → string, Date → string ISO.
// Usar em todos os RSC que passam transações para Client Components.
// Nunca converter amountCents ou datas de transação inline — use este helper.

import type { InvestmentType } from "@/lib/schemas/transaction";
import type { TransactionRow } from "@/components/transactions/types";

type PrismaTransaction = {
  id: string;
  tableId: string;
  sectionId: string;
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
  responsibleUserId: string | null;
  cardInstallment: string | null;
  investmentType: string | null;
  createdById: string;
  createdAt: Date;
  updatedById: string | null;
  updatedAt: Date;
};

export function serializeTransaction(
  tx: PrismaTransaction,
): TransactionRow & { tableId: string; sectionId: string } {
  return {
    id: tx.id,
    tableId: tx.tableId,
    sectionId: tx.sectionId,
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
    responsibleUserId: tx.responsibleUserId,
    cardInstallment: tx.cardInstallment,
    investmentType: tx.investmentType as InvestmentType | null,
    createdById: tx.createdById,
    createdAt: tx.createdAt.toISOString(),
    updatedById: tx.updatedById,
    updatedAt: tx.updatedAt.toISOString(),
  };
}
