import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { AccountMemberRole } from "@prisma/client";

import { getSettingsFamilies } from "@/components/settings/settings-catalog";
import { SettingsAttentionBanner } from "@/components/settings/SettingsAttentionBanner";
import { SettingsFamilyCard } from "@/components/settings/SettingsFamilyCard";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import type { AttentionSignal } from "@/server/queries/settings-attention";
import type { SettingsCounts } from "@/server/queries/settings-counts";

type Props = {
  accountId: string;
  role: AccountMemberRole;
  counts: SettingsCounts;
  signals: AttentionSignal[];
};

/**
 * Hub de Configurações (Spec 67 §2.1 — SET-02).
 *
 * A porta de entrada que não existia: em vez de cair num formulário de owner
 * (`/settings/general`), o usuário vê o que já está configurado e o que pede
 * atenção. As famílias vêm do catálogo canônico, então hub e nav nunca
 * divergem.
 *
 * Server Component: só lê e compõe. Nada aqui precisa de estado no cliente —
 * cada linha é um link.
 *
 * FORA DE ESCOPO por decisão da spec (§5): o campo de busca ⌘K desenhado no
 * frame. Não renderizamos nem desabilitado — campo morto ensina o usuário a
 * ignorar a interface.
 */
export function SettingsHub({ accountId, role, counts, signals }: Props) {
  const families = getSettingsFamilies(role);
  const flaggedHrefs = signals.map((signal) => signal.href.split("?")[0]);

  return (
    <Stack spacing={layout.stack}>
      <Box>
        <Typography variant="h2" component="h1">
          {m.settings.hub.title}
        </Typography>
        <Typography variant="body2" sx={{ mt: layout.micro }}>
          {m.settings.hub.subtitle}
        </Typography>
      </Box>

      <SettingsAttentionBanner signals={signals} accountId={accountId} />

      <Box
        sx={{
          display: "grid",
          gap: layout.stack,
          // 1 coluna no celular, 2 no tablet, 3 no desktop — o frame mostra 3.
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
          alignItems: "start",
        }}
      >
        {families.map((family) => (
          <SettingsFamilyCard
            key={family.key}
            family={family}
            accountId={accountId}
            counts={counts}
            flaggedHrefs={flaggedHrefs}
          />
        ))}
      </Box>
    </Stack>
  );
}
