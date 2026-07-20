import { z } from "zod";

/**
 * Input de `revokeConnectorAction` (spec 63, Task 4.1).
 *
 * O `grantId` identifica o `McpGrant` a revogar. A action SEMPRE revalida no
 * server que esse grant pertence à `accountId` do chamador antes de revogar
 * — nunca confia apenas no fato de o formulário ter enviado o id.
 */
export const revokeConnectorSchema = z.object({
  grantId: z.string().cuid("ID inválido"),
});

export type RevokeConnectorInput = z.infer<typeof revokeConnectorSchema>;
