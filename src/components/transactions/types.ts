// Tipos compartilhados entre os componentes de transação

export type TransactionRow = {
  id: string;
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
  cardInstallment: string | null;
  investmentType: string | null;
  createdById: string;
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

export type HiddenColumns = Record<string, boolean>;
