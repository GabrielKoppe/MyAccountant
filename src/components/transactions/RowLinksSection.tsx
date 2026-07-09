"use client";

import AddLinkIcon from "@mui/icons-material/AddLink";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  deleteTransactionLinkAction,
  listLinksForTransactionAction,
} from "@/actions/transaction-links";
import { formatDateBr } from "@/lib/dates";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { TransactionLinkItem } from "@/server/services/transaction-link-service";

import { CollapsibleSectionRow } from "./CollapsibleSectionRow";
import { LinkTransactionDialog } from "./LinkTransactionDialog";

type Props = {
  open: boolean;
  bgcolor: string;
  accountId: string;
  transactionId: string;
  /** Sincroniza o contador de vínculos no pai (badge/estado). */
  onCountChange: (count: number) => void;
};

/**
 * Seção de vínculos da gaveta (só do editor — vínculo exige transação salva).
 * Isolada em componente próprio para que a criação, que não passa vínculos, não
 * carregue o `useRouter`/actions de vínculo (evita acoplar o create ao router).
 * Renderizada por `RowDrawer` apenas quando a capacidade `links` está presente.
 */
export function RowLinksSection({ open, bgcolor, accountId, transactionId, onCountChange }: Props) {
  const [links, setLinks] = useState<TransactionLinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    startTransition(async () => {
      const res = await listLinksForTransactionAction(accountId, { transactionId });
      setLoading(false);
      if (res.ok) setLinks(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId, transactionId]);

  return (
    <>
      <CollapsibleSectionRow
        open={open}
        bgcolor={bgcolor}
        label={m.transactions.links.title}
        action={
          <>
            {links.length > 0 && (
              <Typography
                component="span"
                variant="caption"
                color="accent.primary"
                sx={{ ml: 0.75, fontSize: 10 }}
              >
                ({links.length})
              </Typography>
            )}
            <Tooltip title={m.transactions.links.addLink}>
              <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setDialogOpen(true)}>
                <AddLinkIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </>
        }
      >
        {loading ? (
          <Typography variant="caption" color="text.disabled">
            Carregando...
          </Typography>
        ) : links.length === 0 ? (
          <Typography variant="caption" color="text.disabled">
            {m.transactions.links.empty}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {links.map((link) => (
              <Box
                key={link.id}
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 1,
                  px: 2,
                  py: 1,
                  bgcolor: "background.subtle",
                  border: 1,
                  borderColor: "border.subtle",
                  borderRadius: 1,
                  maxWidth: 280,
                }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0 }}>
                  <Typography variant="caption" color="text.tertiary" display="block">
                    {m.transactions.links.types[link.type]}
                  </Typography>
                  <Typography variant="body2" fontWeight={500} noWrap>
                    {link.linkedTransaction.description ?? "—"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateBr(link.linkedTransaction.occurredOn)} ·{" "}
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}
                    >
                      {link.linkedTransaction.amountCents
                        ? formatCentsToBrl(BigInt(link.linkedTransaction.amountCents))
                        : ""}
                    </Typography>
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Tooltip title="Ir para o mês e seção desta transação">
                    <IconButton
                      size="small"
                      sx={{ p: 0.125, flexShrink: 0 }}
                      onClick={() => {
                        router.push(
                          `/${accountId}/months/${link.linkedTransaction.monthId}?tab=${link.linkedTransaction.sectionId}`,
                        );
                      }}
                    >
                      <OpenInNewIcon sx={{ fontSize: 12, color: "text.secondary" }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={m.transactions.links.removeLink}>
                    <IconButton
                      size="small"
                      sx={{ p: 0.125, flexShrink: 0 }}
                      onClick={async () => {
                        const res = await deleteTransactionLinkAction(accountId, {
                          linkId: link.id,
                        });
                        if (res.ok) {
                          setLinks((prev) => {
                            const next = prev.filter((l) => l.id !== link.id);
                            onCountChange(next.length);
                            return next;
                          });
                        }
                      }}
                    >
                      <RemoveCircleOutlineIcon sx={{ fontSize: 12, color: "error.main" }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </CollapsibleSectionRow>

      <LinkTransactionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        accountId={accountId}
        transactionId={transactionId}
        onLinked={() => {
          startTransition(async () => {
            const res = await listLinksForTransactionAction(accountId, { transactionId });
            if (res.ok) {
              setLinks(res.data);
              onCountChange(res.data.length);
            }
          });
        }}
      />
    </>
  );
}
