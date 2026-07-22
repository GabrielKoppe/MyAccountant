// Pura — calcula o patch parcial (DD-04) e a lista de campos que mudam
// (preview do popover, §2.4) ao aplicar um APELIDO sobre os valores atuais de
// uma linha (NewTransactionRow / TransactionRowEditor / TransactionRow em modo
// visualização).
//
// Tags ficam fora do escopo aqui: TagEditor persiste tag a tag imediatamente
// (addTagToTransactionAction/removeTagFromTransactionAction), diferente do
// resto do payload da linha, que só persiste ao Salvar — aplicar tags por
// este caminho violaria "nada persiste até Salvar" (§2.4) ou exigiria
// reescrever a persistência de tags. Mesma categoria de decisão de escopo já
// tomada nas Fases 2/3 para investmentType/cardInstallment.
import type { TransactionExpenseType, TransactionPaymentMethod } from "@prisma/client";

import type {
  CategoryOption,
  InstitutionOption,
  ResponsiblePartyOption,
  TransactionRow,
} from "@/components/transactions/types";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { UpdateTransactionInput } from "@/lib/schemas/transaction";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

// Pick de TransactionRow em vez de duplicar os tipos à mão — evita divergir
// silenciosamente se TransactionRow ganhar/mudar campos no futuro.
export type SuggestionApplicableFields = Pick<
  TransactionRow,
  | "description"
  | "notes"
  | "amountCents"
  | "categoryId"
  | "subcategoryId"
  | "institutionId"
  | "responsiblePartyId"
  | "expenseType"
  | "paymentMethod"
  | "isPending"
>;

export type SuggestionPatch = Partial<SuggestionApplicableFields>;

export type SuggestionFieldChange = {
  field: keyof SuggestionApplicableFields;
  label: string;
  oldDisplay: string;
  newDisplay: string;
};

type LabelSources = {
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  parties: ResponsiblePartyOption[];
};

const NONE_LABEL = "—";

function categoryName(id: string | null, categories: CategoryOption[]): string {
  return (id && categories.find((c) => c.id === id)?.name) || NONE_LABEL;
}

function subcategoryName(
  categoryId: string | null,
  subcategoryId: string | null,
  categories: CategoryOption[],
): string {
  if (!subcategoryId) return NONE_LABEL;
  const category = categories.find((c) => c.id === categoryId);
  return category?.subcategories.find((s) => s.id === subcategoryId)?.name ?? NONE_LABEL;
}

function institutionName(id: string | null, institutions: InstitutionOption[]): string {
  return (id && institutions.find((i) => i.id === id)?.name) || NONE_LABEL;
}

function partyName(id: string | null, parties: ResponsiblePartyOption[]): string {
  return (id && parties.find((p) => p.id === id)?.name) || NONE_LABEL;
}

// Exportados para reuso em import-preview.ts (tooltip do preview de import).
export function expenseTypeLabel(value: TransactionExpenseType | null): string {
  return value ? (m.transactions.expenseTypes[value] ?? value) : m.transactions.expenseTypeNone;
}

export function paymentMethodLabel(value: TransactionPaymentMethod | null): string {
  return value ? (m.transactions.paymentMethods[value] ?? value) : m.transactions.paymentMethodNone;
}

export function pendingLabel(value: boolean): string {
  return value
    ? m.settings.transactionAliases.isPendingTrue
    : m.settings.transactionAliases.isPendingFalse;
}

export function favoriteLabel(value: boolean): string {
  return value
    ? m.settings.transactionAliases.isFavoriteTrue
    : m.settings.transactionAliases.isFavoriteFalse;
}

// "USD · 12,99 · R$ 5,1200" — null quando o apelido não define moeda estrangeira.
export function foreignCurrencyDisplay(alias: {
  originalCurrency: string | null;
  originalAmountCents: string | null;
  exchangeRate: number | null;
}): string | null {
  if (alias.originalCurrency === null) return null;
  const parts: string[] = [alias.originalCurrency];
  if (alias.originalAmountCents !== null) {
    parts.push((Number(BigInt(alias.originalAmountCents)) / 100).toFixed(2).replace(".", ","));
  }
  if (alias.exchangeRate !== null) {
    parts.push(`R$ ${alias.exchangeRate.toFixed(4).replace(".", ",")}`);
  }
  return parts.join(" · ");
}

/**
 * Calcula o patch parcial (DD-04) e a lista de campos que mudam (preview do
 * popover, §2.4) ao aplicar um apelido sobre os valores atuais de uma linha.
 * `alias=null` (nenhum casou) produz patch/changes vazios.
 *
 * Cada campo do apelido só entra quando está preenchido (`!== null`) e difere do
 * valor atual — um apelido "só de gatilho" (sem campos a definir) não gera nada.
 *
 * Categoria/subcategoria seguem DD-18: subcategoria explícita do apelido tem
 * prioridade; senão, troca de categoria limpa a subcategoria vigente que deixar
 * de ser filha da nova categoria.
 */
export function computeSuggestion(
  alias: SerializedTransactionAlias | null,
  current: SuggestionApplicableFields,
  sources: LabelSources,
): { patch: SuggestionPatch; changes: SuggestionFieldChange[] } {
  const patch: SuggestionPatch = {};
  const changes: SuggestionFieldChange[] = [];

  function push(
    field: keyof SuggestionApplicableFields,
    label: string,
    oldDisplay: string,
    newDisplay: string,
  ) {
    changes.push({ field, label, oldDisplay, newDisplay });
  }

  if (!alias) return { patch, changes };

  if (alias.description !== null && alias.description !== current.description) {
    patch.description = alias.description;
    push(
      "description",
      m.transactions.fields.description,
      current.description || NONE_LABEL,
      alias.description || NONE_LABEL,
    );
  }

  if (alias.notes !== null && alias.notes !== current.notes) {
    patch.notes = alias.notes;
    push(
      "notes",
      m.transactions.fields.notes,
      current.notes || NONE_LABEL,
      alias.notes || NONE_LABEL,
    );
  }

  if (alias.amountCents !== null && alias.amountCents !== current.amountCents) {
    patch.amountCents = alias.amountCents; // DD-20: verbatim, sem inversão de sinal
    push(
      "amountCents",
      m.transactions.fields.amount,
      formatCentsToBrl(BigInt(current.amountCents), { sign: true }),
      formatCentsToBrl(BigInt(alias.amountCents), { sign: true }),
    );
  }

  // DD-18: subcategoria explícita do apelido tem prioridade sobre a limpeza por órfã.
  let effectiveCategoryId = current.categoryId;
  if (alias.categoryId !== null && alias.categoryId !== current.categoryId) {
    effectiveCategoryId = alias.categoryId;
    patch.categoryId = alias.categoryId;
    push(
      "categoryId",
      m.transactions.fields.category,
      categoryName(current.categoryId, sources.categories),
      categoryName(alias.categoryId, sources.categories),
    );
  }

  if (alias.subcategoryId !== null && alias.subcategoryId !== current.subcategoryId) {
    patch.subcategoryId = alias.subcategoryId;
    push(
      "subcategoryId",
      m.transactions.fields.subcategory,
      subcategoryName(current.categoryId, current.subcategoryId, sources.categories),
      subcategoryName(effectiveCategoryId, alias.subcategoryId, sources.categories),
    );
  } else if (patch.categoryId !== undefined && current.subcategoryId) {
    const stillChild = sources.categories
      .find((c) => c.id === effectiveCategoryId)
      ?.subcategories.some((s) => s.id === current.subcategoryId);
    if (!stillChild) {
      patch.subcategoryId = null; // órfã — limpa (DD-18)
      push(
        "subcategoryId",
        m.transactions.fields.subcategory,
        subcategoryName(current.categoryId, current.subcategoryId, sources.categories),
        NONE_LABEL,
      );
    }
  }

  if (alias.institutionId !== null && alias.institutionId !== current.institutionId) {
    patch.institutionId = alias.institutionId;
    push(
      "institutionId",
      m.transactions.fields.institution,
      institutionName(current.institutionId, sources.institutions),
      institutionName(alias.institutionId, sources.institutions),
    );
  }

  if (
    alias.responsiblePartyId !== null &&
    alias.responsiblePartyId !== current.responsiblePartyId
  ) {
    patch.responsiblePartyId = alias.responsiblePartyId;
    push(
      "responsiblePartyId",
      m.transactions.fields.responsibleUser,
      partyName(current.responsiblePartyId, sources.parties),
      partyName(alias.responsiblePartyId, sources.parties),
    );
  }

  if (alias.expenseType !== null && alias.expenseType !== current.expenseType) {
    patch.expenseType = alias.expenseType;
    push(
      "expenseType",
      m.transactions.expenseTypeLabel,
      expenseTypeLabel(current.expenseType),
      expenseTypeLabel(alias.expenseType),
    );
  }

  if (alias.paymentMethod !== null && alias.paymentMethod !== current.paymentMethod) {
    patch.paymentMethod = alias.paymentMethod;
    push(
      "paymentMethod",
      m.transactions.paymentMethodLabel,
      paymentMethodLabel(current.paymentMethod),
      paymentMethodLabel(alias.paymentMethod),
    );
  }

  if (alias.isPending !== null && alias.isPending !== current.isPending) {
    patch.isPending = alias.isPending;
    push(
      "isPending",
      m.transactions.fields.isPending,
      pendingLabel(current.isPending),
      pendingLabel(alias.isPending),
    );
  }

  return { patch, changes };
}

/**
 * Converte o patch de aplicação (SuggestionPatch) no input parcial de
 * `updateTransactionAction` — usado pela aplicação em MODO VISUALIZAÇÃO (DD-23),
 * que persiste na hora (não há passo "Salvar"). `amountCents` (string no
 * `TransactionRow`) vira `BigInt`; os demais campos passam como estão. Só inclui
 * as chaves realmente presentes no patch (patch parcial, DD-04). `institutionText`
 * fica de fora porque `computeSuggestion` não o cobre na aplicação manual
 * (mesma lacuna de escopo de tags/investmentType/cardInstallment, §2.4).
 */
export function suggestionPatchToUpdateInput(
  patch: SuggestionPatch,
): Partial<UpdateTransactionInput> {
  const input: Partial<UpdateTransactionInput> = {};
  if ("description" in patch) input.description = patch.description;
  if ("notes" in patch) input.notes = patch.notes;
  if ("amountCents" in patch && patch.amountCents !== undefined) {
    input.amountCents = BigInt(patch.amountCents);
  }
  if ("categoryId" in patch) input.categoryId = patch.categoryId;
  if ("subcategoryId" in patch) input.subcategoryId = patch.subcategoryId;
  if ("institutionId" in patch) input.institutionId = patch.institutionId;
  if ("responsiblePartyId" in patch) input.responsiblePartyId = patch.responsiblePartyId;
  if ("expenseType" in patch) input.expenseType = patch.expenseType;
  if ("paymentMethod" in patch) input.paymentMethod = patch.paymentMethod;
  if ("isPending" in patch) input.isPending = patch.isPending;
  return input;
}
