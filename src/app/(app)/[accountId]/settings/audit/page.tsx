import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAccountAccess } from "@/server/auth/session";
import { ForbiddenError } from "@/server/api/errors";
import { listAuditLogs } from "@/server/services/audit-service";
import { layout } from "@/lib/design-tokens";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId);
  if (member.role !== "owner") {
    throw new ForbiddenError("Apenas o owner pode ver a trilha de auditoria.");
  }
  const logs = await listAuditLogs(accountId);

  return (
    <Stack spacing={layout.section}>
      <PageHeader title="Trilha de auditoria" description="Ações sensíveis desta conta" />
      {logs.length === 0 ? (
        <EmptyState
          title="Nenhum evento registrado"
          description="Ações sensíveis aparecerão aqui."
        />
      ) : (
        <Card>
          <CardContent>
            <Stack spacing={layout.stack}>
              {logs.map((l) => (
                <Stack key={l.id} spacing={0.5}>
                  <Typography variant="body2" fontWeight={600}>
                    {l.action}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(l.actor?.name ?? l.actor?.email ?? "—") +
                      " · " +
                      l.createdAt.toLocaleString("pt-BR") +
                      " · " +
                      l.targetType +
                      (l.targetId ? ` (${l.targetId})` : "")}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
