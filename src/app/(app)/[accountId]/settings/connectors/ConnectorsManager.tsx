"use client";

import { useState, useTransition } from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import BlockIcon from "@mui/icons-material/Block";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";

import { revokeConnectorAction } from "@/actions/mcp-connectors";
import PageSettingsContainer from "@/components/settings/PageSettingsContainer";
import { DialogShell } from "@/components/ui/DialogShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { useActionFeedback } from "@/lib/hooks/use-action-feedback";
import { m } from "@/lib/messages";

type Connector = {
  id: string;
  clientName: string;
  createdAt: Date;
  lastUsedAt: Date | null;
};

type Props = {
  accountId: string;
  connectors: Connector[];
};

export function ConnectorsManager({ accountId, connectors }: Props) {
  const [isPending, startTransition] = useTransition();
  const [revokeTarget, setRevokeTarget] = useState<Connector | null>(null);
  const { handle } = useActionFeedback<void>({ successMessage: m.mcpConnectors.revokeSuccess });

  const cc = m.mcpConnectors;

  function confirmRevoke() {
    if (!revokeTarget) return;
    const target = revokeTarget;
    setRevokeTarget(null);
    startTransition(async () => {
      const result = await revokeConnectorAction(accountId, { grantId: target.id });
      handle(result);
    });
  }

  return (
    <PageSettingsContainer title={cc.title}>
      <>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {cc.description}
        </Typography>

        {connectors.length === 0 ? (
          <EmptyState
            icon={<SmartToyOutlinedIcon sx={{ fontSize: 48 }} />}
            title={cc.emptyTitle}
            description={cc.emptyDescription}
          />
        ) : (
          <Paper variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{cc.appColumn}</TableCell>
                  <TableCell>{cc.grantedAtColumn}</TableCell>
                  <TableCell>{cc.lastUsedColumn}</TableCell>
                  <TableCell align="right">{cc.actionsColumn}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {connectors.map((connector) => (
                  <TableRow key={connector.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {connector.clientName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {connector.createdAt.toLocaleDateString("pt-BR")}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {connector.lastUsedAt
                          ? connector.lastUsedAt.toLocaleDateString("pt-BR")
                          : cc.neverUsed}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={cc.revokeButton}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={isPending}
                            onClick={() => setRevokeTarget(connector)}
                          >
                            <BlockIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        <DialogShell
          open={!!revokeTarget}
          onClose={() => setRevokeTarget(null)}
          maxWidth="xs"
          title={cc.revokeTitle}
          description={revokeTarget ? cc.revokeConfirm(revokeTarget.clientName) : ""}
          actions={
            <>
              <Button onClick={() => setRevokeTarget(null)}>{m.common.cancel}</Button>
              <Button
                color="error"
                variant="contained"
                onClick={confirmRevoke}
                disabled={isPending}
              >
                {cc.revokeButton}
              </Button>
            </>
          }
        />
      </>
    </PageSettingsContainer>
  );
}
