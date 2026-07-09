"use client";

import AddLinkIcon from "@mui/icons-material/AddLink";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { IconButton, Tooltip } from "@mui/material";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { Fragment } from "react";

import { tagChipSx } from "@/components/tags/tagChipSx";
import { m } from "@/lib/messages";

import SectionDrawer from "./SectionDrawer";
import type { TransactionRow as TxRow } from "./types";

type Props = {
  tx: TxRow;
  isReadOnly: boolean;
  onManageLinks: () => void;
  onViewInstallmentGroup: () => void;
};

/** Gaveta de leitura (read-only) dos anexos da linha (spec 62 §2.2). Reusa os
 * dialogs existentes via callbacks — não reimplementa vínculos/parcela. Segue o
 * padrão visual dos colapsáveis de edição: seções rotuladas separadas por
 * `Divider`, fundo `action.selected`. */
export function TransactionRowDetails({
  tx,
  isReadOnly,
  onManageLinks,
  onViewInstallmentGroup,
}: Props) {
  const sections: React.ReactNode[] = [];

  if (tx.notes) {
    sections.push(
      <SectionDrawer key="notes" label={m.transactions.fields.notes}>
        <Typography variant="body2" color="text.primary" sx={{ whiteSpace: "pre-wrap" }}>
          {tx.notes}
        </Typography>
      </SectionDrawer>,
    );
  }

  if (tx.originalCurrency) {
    sections.push(
      <SectionDrawer key="fx" label={m.transactions.foreignCurrency.label}>
        <Typography variant="body2" color="text.primary">
          {tx.originalCurrency}
          {tx.originalAmountCents && tx.originalAmountCents !== "0"
            ? ` ${(Number(BigInt(tx.originalAmountCents)) / 100).toFixed(2)}`
            : ""}
          {tx.exchangeRate
            ? ` · ${m.transactions.foreignCurrency.rateDisplay(tx.exchangeRate)}`
            : ""}
        </Typography>
      </SectionDrawer>,
    );
  }

  if (tx.linkCount > 0) {
    sections.push(
      <SectionDrawer
        key="links"
        label={m.transactions.links.title}
        action={
          !isReadOnly && (
            <Tooltip title={m.transactions.links.addLink}>
              <IconButton size="small" sx={{ p: 0.25 }} onClick={onManageLinks}>
                <AddLinkIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          )
        }
      >
        <Typography variant="body2" color="text.primary">
          {m.transactions.rowState.links(tx.linkCount)}
        </Typography>
      </SectionDrawer>,
    );
  }

  if (tx.tags.length > 0) {
    sections.push(
      <SectionDrawer key="tags" label={m.transactions.fields.tags}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {tx.tags.map((t) => (
            <Chip key={t.id} label={t.name} size="small" sx={tagChipSx(t.color)} />
          ))}
        </Box>
      </SectionDrawer>,
    );
  }

  if (tx.installmentGroupId) {
    sections.push(
      <SectionDrawer
        key="installment"
        label={m.transactions.installments.column}
        action={
          <Tooltip title={m.transactions.attachments.viewGroup}>
            <IconButton size="small" sx={{ p: 0.25 }} onClick={onViewInstallmentGroup}>
              <VisibilityIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Tooltip>
        }
      >
        <Typography variant="body2" color="text.primary">
          {tx.installmentNumber && tx.installmentGroupCount
            ? m.transactions.installments.badge(tx.installmentNumber, tx.installmentGroupCount)
            : "—"}
        </Typography>
      </SectionDrawer>,
    );
  }

  return (
    <Box sx={{ bgcolor: "action.selected" }}>
      {sections.map((section, i) => (
        <Fragment key={i}>
          {i > 0 && <Divider />}
          {section}
        </Fragment>
      ))}
    </Box>
  );
}
