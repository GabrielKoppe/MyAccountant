import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsHub } from "@/components/settings/SettingsHub";
import { layout } from "@/lib/design-tokens";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { m } from "@/lib/messages";
import { requireAccountAccess } from "@/server/auth/session";
import { getSettingsAttention } from "@/server/queries/settings-attention";
import { getSettingsCounts } from "@/server/queries/settings-counts";
import Box from "@mui/material/Box";

type Props = { params: Promise<{ accountId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, m.settings.hub.title);
}

/**
 * Hub de Configurações — rota `/[accountId]/settings` (Spec 67 §2.1, SET-02).
 *
 * Antes desta spec a rota não existia e o link "Configurações" da sidebar caía
 * em `/settings/general`, um formulário de owner.
 *
 * Papéis: `viewer` NÃO é redirecionado (carve-out da Spec 65 NAV-04, mantido
 * pela decisão D3) — vê o hub com apenas o card Conta e a linha Membros, que é
 * exatamente o que `getSettingsFamilies("viewer")` devolve.
 */
export default async function SettingsHubPage({ params }: Props) {
  const { accountId } = await params;
  const { member, user } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  // Sinalizadores só fazem sentido para quem pode agir sobre eles; o `viewer`
  // não edita nada de configuração.
  const [counts, signals] = await Promise.all([
    getSettingsCounts(accountId, member.role, user.id),
    member.role === "viewer" ? Promise.resolve([]) : getSettingsAttention(accountId),
  ]);

  return (
    <Box sx={{ p: layout.page }}>
      <SettingsHub accountId={accountId} role={member.role} counts={counts} signals={signals} />
    </Box>
  );
}
