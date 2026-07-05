import { z } from "zod";

// Schema único (fonte da verdade) para o checklist mensal — valida form (RHF),
// Server Action e gera tipos. Ver skill forms-zod-rhf.

const checklistLabel = z
  .string()
  .min(1, "Descrição obrigatória")
  .max(120, "Máximo 120 caracteres")
  .trim();

// `monthId` opcional no create/delete: quando o item é adicionado/removido inline
// pelo widget (B1), a action revalida também o mês atual além de /settings/checklist.
export const createChecklistItemSchema = z.object({
  label: checklistLabel,
  monthId: z.string().cuid("ID inválido").optional(),
});

export const updateChecklistItemSchema = z.object({
  itemId: z.string().cuid("ID inválido"),
  label: checklistLabel,
});

export const deleteChecklistItemSchema = z.object({
  itemId: z.string().cuid("ID inválido"),
  monthId: z.string().cuid("ID inválido").optional(),
});

export const reorderChecklistSchema = z.object({
  orderedIds: z.array(z.string().cuid("ID inválido")).min(1),
});

// `done` é o estado desejado (não um flip): mantém o toggle idempotente e livre
// de corrida — on = upsert, off = deleteMany. Ver §3.9 do design.
export const toggleChecklistCompletionSchema = z.object({
  itemId: z.string().cuid("ID inválido"),
  monthId: z.string().cuid("ID inválido"),
  done: z.boolean(),
});

// Vínculo unilateral item↔transação (só no lado do checklist). Vincular marca o
// item como concluído (a conclusão passa a existir com transactionId).
export const linkChecklistTransactionSchema = z.object({
  itemId: z.string().cuid("ID inválido"),
  monthId: z.string().cuid("ID inválido"),
  transactionId: z.string().cuid("ID inválido"),
});

export const unlinkChecklistTransactionSchema = z.object({
  itemId: z.string().cuid("ID inválido"),
  monthId: z.string().cuid("ID inválido"),
});

// Busca de transações do mês para o picker de vínculo (escopo: mês atual).
export const searchChecklistTransactionsSchema = z.object({
  monthId: z.string().cuid("ID inválido"),
  query: z.string().max(120).optional(),
});

export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
export type DeleteChecklistItemInput = z.infer<typeof deleteChecklistItemSchema>;
export type ReorderChecklistInput = z.infer<typeof reorderChecklistSchema>;
export type ToggleChecklistCompletionInput = z.infer<typeof toggleChecklistCompletionSchema>;
export type LinkChecklistTransactionInput = z.infer<typeof linkChecklistTransactionSchema>;
export type UnlinkChecklistTransactionInput = z.infer<typeof unlinkChecklistTransactionSchema>;
export type SearchChecklistTransactionsInput = z.infer<typeof searchChecklistTransactionsSchema>;
