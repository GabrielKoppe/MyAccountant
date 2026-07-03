import type { ResponsiblePartyKind, ResponsiblePartyOption } from "@/components/transactions/types";

/** Registro mínimo de party para montar a opção de exibição. */
export type PartyDisplayRecord = {
  id: string;
  name: string;
  kind: ResponsiblePartyKind;
  icon: string | null;
  color: string | null;
  members: {
    userId: string;
    user: { name: string | null; email: string; image: string | null };
  }[];
};

/**
 * Monta a opção de exibição de uma party (Spec 60 §2.4):
 * - `personal` cujo membro ainda pertence à Account → nome/foto ao vivo do User.
 * - demais (group/external, ou membro que saiu) → snapshot em `party.name`, sem foto.
 */
export function toResponsiblePartyOption(
  p: PartyDisplayRecord,
  currentMemberIds: Set<string>,
): ResponsiblePartyOption {
  let name = p.name;
  let imageUrl: string | null = null;
  if (p.kind === "personal" && p.members.length === 1) {
    const link = p.members[0];
    if (currentMemberIds.has(link.userId)) {
      name = link.user.name ?? link.user.email;
      imageUrl = link.user.image;
    }
  }
  return { id: p.id, name, kind: p.kind, icon: p.icon, color: p.color, imageUrl };
}
