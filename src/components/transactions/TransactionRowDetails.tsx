"use client";

import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import NoteOutlinedIcon from "@mui/icons-material/NoteOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { tagChipSx } from "@/components/tags/tagChipSx";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";

import type { TransactionRow as TxRow } from "./types";

type Props = {
  tx: TxRow;
  isReadOnly: boolean;
  onManageLinks: () => void;
  onViewInstallmentGroup: () => void;
};

const ICON_SX = { fontSize: 16, color: "text.tertiary", flexShrink: 0 } as const;

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={layout.inline} alignItems="flex-start">
      {icon}
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
    </Stack>
  );
}

/** Gaveta de leitura (read-only) dos anexos da linha (spec 62 §2.2). Reusa os
 * dialogs existentes via callbacks — não reimplementa vínculos/parcela. */
export function TransactionRowDetails({ tx, isReadOnly, onManageLinks, onViewInstallmentGroup }: Props) {
  return (
    <Box sx={{ px: 2, py: 1.5, bgcolor: "background.subtle" }}>
      <Stack spacing={layout.stack}>
        {tx.notes && (
          <Row icon={<NoteOutlinedIcon sx={ICON_SX} />}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
              {tx.notes}
            </Typography>
          </Row>
        )}

        {tx.originalCurrency && (
          <Row icon={<CurrencyExchangeOutlinedIcon sx={ICON_SX} />}>
            <Typography variant="body2" color="text.secondary">
              {tx.originalCurrency}
              {tx.originalAmountCents ? ` ${formatCentsToBrl(BigInt(tx.originalAmountCents))}` : ""}
              {tx.exchangeRate ? ` · taxa ${tx.exchangeRate}` : ""}
            </Typography>
          </Row>
        )}

        {tx.linkCount > 0 && (
          <Row icon={<LinkOutlinedIcon sx={ICON_SX} />}>
            <Stack direction="row" spacing={layout.inline} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {m.transactions.rowState.links(tx.linkCount)}
              </Typography>
              {!isReadOnly && (
                <Button size="small" variant="text" onClick={onManageLinks}>
                  {m.transactions.links.manage}
                </Button>
              )}
            </Stack>
          </Row>
        )}

        {tx.tags.length > 0 && (
          <Row icon={<LabelOutlinedIcon sx={ICON_SX} />}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {tx.tags.map((t) => (
                <Chip key={t.id} label={t.name} size="small" sx={tagChipSx(t.color)} />
              ))}
            </Box>
          </Row>
        )}

        {tx.installmentGroupId && (
          <Row icon={<EventRepeatOutlinedIcon sx={ICON_SX} />}>
            <Stack direction="row" spacing={layout.inline} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {m.transactions.installments.column}{" "}
                {tx.installmentNumber && tx.installmentGroupCount
                  ? m.transactions.installments.badge(tx.installmentNumber, tx.installmentGroupCount)
                  : ""}
              </Typography>
              <Button size="small" variant="text" onClick={onViewInstallmentGroup}>
                {m.transactions.attachments.viewGroup}
              </Button>
            </Stack>
          </Row>
        )}
      </Stack>
    </Box>
  );
}
