import HistoryIcon from "@mui/icons-material/History";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { containers, layout } from "@/lib/design-tokens";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { m } from "@/lib/messages";
import { ForbiddenError } from "@/server/api/errors";
import { requireAccountAccess } from "@/server/auth/session";
import { listAuditLogs } from "@/server/services/audit-service";

type Props = { params: Promise<{ accountId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, m.settings.nav.audit);
}

export default async function AuditPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role !== "owner") {
    throw new ForbiddenError("Apenas o owner pode ver a trilha de auditoria.");
  }
  const logs = await listAuditLogs(accountId);

  return (
    <SettingsPageShell
      family="Conta"
      title={m.settings.nav.audit}
      // O frame prescreve o chip "últimos 90 dias", mas `listAuditLogs` não filtra
      // por data: pega os N eventos mais recentes (`take: 100`). Exibir "90 dias"
      // seria uma afirmação falsa, então o chip mostra o que a página realmente
      // carregou. Trocar por período exige mudar a query — escopo da Spec 72.
      count={String(logs.length)}
      purpose={m.settings.purposes.audit}
      // A página lança ForbiddenError para quem não é owner (ver guard acima).
      ownerOnly
      itemCount={logs.length}
    >
      {/* O shell não limita largura; este Box preserva a largura de leitura que o
          antigo PageSettingsContainer aplicava (containers.md). */}
      <Box sx={{ maxWidth: containers.md }}>
        {logs.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon sx={{ fontSize: 48 }} />}
            title={m.settings.audit.emptyTitle}
            description={m.settings.audit.emptyDescription}
          />
        ) : (
          <Card>
            <CardContent>
              <Stack divider={<Divider flexItem />} spacing={layout.stack}>
                {logs.map((l) => (
                  <Stack key={l.id} spacing={0.5}>
                    <Typography variant="body2" fontWeight={600}>
                      {m.settings.audit.actionLabel(l.action)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(l.actor?.name ?? l.actor?.email ?? m.settings.audit.unknownActor) +
                        " · " +
                        l.createdAt.toLocaleString("pt-BR")}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>
    </SettingsPageShell>
  );
}
