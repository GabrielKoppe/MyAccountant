import { z } from "zod";

import { cuidSchema } from "./shared";

export const createAccountSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(80),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email("Email inválido").toLowerCase().trim(),
  role: z.enum(["owner", "editor", "viewer"]),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  targetUserId: cuidSchema,
  role: z.enum(["owner", "editor", "viewer"]),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const removeMemberSchema = z.object({
  targetUserId: cuidSchema,
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

export const revokeInviteSchema = z.object({
  inviteId: cuidSchema,
});

export type RevokeInviteInput = z.infer<typeof revokeInviteSchema>;
