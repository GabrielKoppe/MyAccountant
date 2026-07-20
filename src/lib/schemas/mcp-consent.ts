import { z } from "zod";

/**
 * Input de `approveConsent` (spec 63, Task 3.4).
 *
 * Reúne os parâmetros do fluxo OAuth/PKCE que já foram validados uma vez em
 * `/api/oauth/authorize` (e re-validados na tela de consentimento) com o
 * `accountId` que o usuário escolhe conceder. A action SEMPRE revalida
 * `clientId`/`redirectUri` no server antes de emitir qualquer code — nunca
 * confia nesses campos só porque vieram do form.
 */
export const approveConsentSchema = z.object({
  clientId: z.string().min(1),
  redirectUri: z.string().min(1),
  codeChallenge: z.string().min(1),
  scope: z.string().min(1).default("read"),
  state: z.string().optional(),
  accountId: z.string().min(1),
});

export type ApproveConsentInput = z.infer<typeof approveConsentSchema>;
