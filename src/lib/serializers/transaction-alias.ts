// Serialização centralizada de apelidos de transação: BigInt → string, Date →
// ISO, + nomes denormalizados (categoria/subcategoria/instituição/responsável)
// para o preview WYSIWYG do import, que não recebe listas de opções (P1).

import type { TransactionExpenseType, TransactionPaymentMethod } from "@prisma/client";

import type { AliasCandidate } from "@/lib/aliases/match";
import type { InvestmentType } from "@/lib/schemas/transaction";

type PrismaTransactionAlias = {
  id: string;
  trigger: string;
  triggerNormalized: string;
  description: string | null;
  notes: string | null;
  amountCents: bigint | null;
  categoryId: string | null;
  category: { name: string } | null;
  subcategoryId: string | null;
  subcategory: { name: string } | null;
  institutionId: string | null;
  institution: { name: string } | null;
  institutionText: string | null;
  responsiblePartyId: string | null;
  responsibleParty: { name: string } | null;
  expenseType: TransactionExpenseType | null;
  paymentMethod: TransactionPaymentMethod | null;
  investmentType: string | null;
  cardInstallment: string | null;
  isPending: boolean | null;
  isFavorite: boolean | null;
  originalCurrency: string | null;
  originalAmountCents: bigint | null;
  exchangeRate: { toNumber: () => number } | null;
  archivedAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  tags: { tag: { id: string; name: string } }[];
};

// Superset de AliasCandidate (id/trigger/triggerNormalized/updatedAt) — o
// mesmo tipo serve o match (client + server) e o preview WYSIWYG do import.
export type SerializedTransactionAlias = AliasCandidate & {
  description: string | null;
  notes: string | null;
  amountCents: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  institutionId: string | null;
  institutionName: string | null;
  institutionText: string | null;
  responsiblePartyId: string | null;
  responsiblePartyName: string | null;
  expenseType: TransactionExpenseType | null;
  paymentMethod: TransactionPaymentMethod | null;
  investmentType: InvestmentType | null;
  cardInstallment: string | null;
  isPending: boolean | null;
  isFavorite: boolean | null;
  originalCurrency: string | null;
  originalAmountCents: string | null;
  exchangeRate: number | null;
  isArchived: boolean;
  createdById: string;
  createdAt: string;
  tags: { id: string; name: string }[];
};

export function serializeTransactionAlias(
  alias: PrismaTransactionAlias,
): SerializedTransactionAlias {
  return {
    id: alias.id,
    trigger: alias.trigger,
    triggerNormalized: alias.triggerNormalized,
    description: alias.description,
    notes: alias.notes,
    amountCents: alias.amountCents?.toString() ?? null,
    categoryId: alias.categoryId,
    categoryName: alias.category?.name ?? null,
    subcategoryId: alias.subcategoryId,
    subcategoryName: alias.subcategory?.name ?? null,
    institutionId: alias.institutionId,
    institutionName: alias.institution?.name ?? null,
    institutionText: alias.institutionText,
    responsiblePartyId: alias.responsiblePartyId,
    responsiblePartyName: alias.responsibleParty?.name ?? null,
    expenseType: alias.expenseType,
    paymentMethod: alias.paymentMethod,
    investmentType: alias.investmentType as InvestmentType | null,
    cardInstallment: alias.cardInstallment,
    isPending: alias.isPending,
    isFavorite: alias.isFavorite,
    originalCurrency: alias.originalCurrency,
    originalAmountCents: alias.originalAmountCents?.toString() ?? null,
    exchangeRate: alias.exchangeRate?.toNumber() ?? null,
    isArchived: alias.archivedAt !== null,
    createdById: alias.createdById,
    createdAt: alias.createdAt.toISOString(),
    updatedAt: alias.updatedAt.toISOString(),
    tags: alias.tags.map((t) => t.tag),
  };
}
