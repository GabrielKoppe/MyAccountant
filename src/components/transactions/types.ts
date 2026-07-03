// Tipos compartilhados entre os componentes de transação

import type { TransactionExpenseType, TransactionSource } from "@prisma/client";

import type { InvestmentType } from "@/lib/schemas/transaction";
import type { HiddenColumns } from "@/lib/schemas/settings";

export type { HiddenColumns };

export type TransactionRow = {
  id: string;
  monthId: string;
  occurredOn: string; // ISO date "YYYY-MM-DD"
  amountCents: string; // BigInt serializado como string
  description: string | null;
  notes: string | null;
  isPending: boolean;
  isFavorite: boolean;
  categoryId: string | null;
  subcategoryId: string | null;
  institutionId: string | null;
  institutionText: string | null;
  responsibleUserId: string | null;
  responsiblePartyId: string | null;
  cardInstallment: string | null;
  investmentType: InvestmentType | null;
  expenseType: TransactionExpenseType | null;
  source: TransactionSource;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentGroupCount: number | null;
  originalAmountCents: string | null; // BigInt serializado como string
  originalCurrency: string | null;
  exchangeRate: number | null;
  tags: { id: string; name: string; color: string | null }[];
  linkCount: number;
  createdById: string;
  createdAt: string; // ISO string (timestamp UTC)
  updatedById: string | null;
  updatedAt: string; // ISO string (timestamp UTC)
};

export type CategoryOption = {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
};

export type InstitutionOption = { id: string; name: string };

export type MemberOption = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type ResponsiblePartyKind = "personal" | "group" | "external";

// Opção de responsável (persona) para o seletor de transação. `name` já vem
// resolvido (nome ao vivo do membro para `personal` atual; snapshot para os demais).
export type ResponsiblePartyOption = {
  id: string;
  name: string;
  kind: ResponsiblePartyKind;
  icon: string | null;
};
