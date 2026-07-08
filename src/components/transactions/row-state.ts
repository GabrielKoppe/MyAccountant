import { m } from "@/lib/messages";

import type { TransactionRow } from "./types";

type RowStateInput = Pick<TransactionRow, "description" | "notes" | "originalCurrency" | "linkCount">;

/**
 * Monta o texto-resumo de estado da linha para o `aria-label` da célula de
 * descrição (leitor de tela anuncia descrição + estados ativos numa só passada).
 */
export function describeRowState(tx: RowStateInput): string {
  const baseText = tx.description?.trim() ?? "";
  const parts: string[] = [];
  if (tx.notes) parts.push(m.transactions.rowState.hasNote);
  if (tx.originalCurrency) parts.push(m.transactions.rowState.foreignCurrency);
  if (tx.linkCount > 0) parts.push(m.transactions.rowState.links(tx.linkCount));

  if (parts.length === 0) return baseText;
  if (!baseText) return parts.join(", ");
  return `${baseText} — ${parts.join(", ")}`;
}
