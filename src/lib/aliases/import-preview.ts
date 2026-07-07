// Pura — descreve o que um apelido casado muda numa linha do preview de
// import (StepPreview, spec 61 §2.6/DD-08): campos visíveis (Descrição/
// Categoria, com o valor original do CSV) e campos ocultos (sem coluna no
// preview) que o apelido também define. amountCents nunca aparece aqui
// (DD-09 — import não aplica valor do apelido).
import type { PreviewRow } from "@/lib/csv-parser";
import { m } from "@/lib/messages";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

import {
  expenseTypeLabel,
  favoriteLabel,
  foreignCurrencyDisplay,
  paymentMethodLabel,
  pendingLabel,
} from "./apply";

export type AliasImportFieldChange = { label: string; oldDisplay: string; newDisplay: string };
export type AliasImportHiddenField = { label: string; display: string };

export type AliasImportPreview = {
  visibleChanges: AliasImportFieldChange[];
  hiddenFields: AliasImportHiddenField[];
};

const NONE_LABEL = "—";

export function describeAliasImportApplication(
  alias: SerializedTransactionAlias,
  parsed: NonNullable<PreviewRow["parsed"]>,
): AliasImportPreview {
  const visibleChanges: AliasImportFieldChange[] = [];

  if (alias.description !== null && alias.description !== parsed.description) {
    visibleChanges.push({
      label: m.transactions.fields.description,
      oldDisplay: parsed.description || NONE_LABEL,
      newDisplay: alias.description || NONE_LABEL,
    });
  }

  if (alias.categoryId !== null && alias.categoryName !== parsed.categoryName) {
    visibleChanges.push({
      label: m.transactions.fields.category,
      oldDisplay: parsed.categoryName || NONE_LABEL,
      newDisplay: alias.categoryName || NONE_LABEL,
    });
  }

  const hiddenFields: AliasImportHiddenField[] = [];

  if (alias.notes !== null) {
    hiddenFields.push({ label: m.transactions.fields.notes, display: alias.notes || NONE_LABEL });
  }
  if (alias.subcategoryId !== null) {
    hiddenFields.push({
      label: m.transactions.fields.subcategory,
      display: alias.subcategoryName ?? NONE_LABEL,
    });
  }
  if (alias.institutionId !== null || alias.institutionText !== null) {
    hiddenFields.push({
      label: m.transactions.fields.institution,
      display: alias.institutionName ?? alias.institutionText ?? NONE_LABEL,
    });
  }
  if (alias.responsiblePartyId !== null) {
    hiddenFields.push({
      label: m.transactions.fields.responsibleUser,
      display: alias.responsiblePartyName ?? NONE_LABEL,
    });
  }
  if (alias.expenseType !== null) {
    hiddenFields.push({
      label: m.transactions.expenseTypeLabel,
      display: expenseTypeLabel(alias.expenseType),
    });
  }
  if (alias.paymentMethod !== null) {
    hiddenFields.push({
      label: m.transactions.paymentMethodLabel,
      display: paymentMethodLabel(alias.paymentMethod),
    });
  }
  if (alias.isPending !== null) {
    hiddenFields.push({
      label: m.transactions.fields.isPending,
      display: pendingLabel(alias.isPending),
    });
  }
  if (alias.isFavorite !== null) {
    hiddenFields.push({
      label: m.transactions.fields.isFavorite,
      display: favoriteLabel(alias.isFavorite),
    });
  }
  // FX: fill-if-empty no import (DD-22) — o preview lista o que o apelido carrega
  // (moeda + valor original + câmbio); a aplicação real por linha só ocorre quando
  // o extrato não traz moeda estrangeira própria.
  const fxDisplay = foreignCurrencyDisplay(alias);
  if (fxDisplay !== null) {
    hiddenFields.push({ label: m.transactions.foreignCurrency.label, display: fxDisplay });
  }
  if (alias.tags.length > 0) {
    hiddenFields.push({
      label: m.transactions.fields.tags,
      display: alias.tags.map((t) => t.name).join(", "),
    });
  }

  return { visibleChanges, hiddenFields };
}
