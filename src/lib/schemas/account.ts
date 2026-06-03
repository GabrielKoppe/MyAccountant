import { z } from "zod";

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
  targetUserId: z.string().cuid("ID inválido"),
  role: z.enum(["owner", "editor", "viewer"]),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const removeMemberSchema = z.object({
  targetUserId: z.string().cuid("ID inválido"),
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

export const revokeInviteSchema = z.object({
  inviteId: z.string().cuid("ID inválido"),
});

export type RevokeInviteInput = z.infer<typeof revokeInviteSchema>;
