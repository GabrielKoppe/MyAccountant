import type { TransactionRow } from "./types";

type AttachmentInput = Pick<
  TransactionRow,
  "notes" | "originalCurrency" | "linkCount" | "tags" | "installmentGroupId"
>;

/** Conta todos os anexos da linha (DD-62-ATT). Ajustável (ex.: tags como 1). */
export function countAttachments(tx: AttachmentInput): number {
  return (
    (tx.notes ? 1 : 0) +
    (tx.originalCurrency ? 1 : 0) +
    tx.linkCount +
    tx.tags.length +
    (tx.installmentGroupId ? 1 : 0)
  );
}
