"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Fragment } from "react";

import { tagChipSx } from "@/components/tags/tagChipSx";
import { m } from "@/lib/messages";

import type { TransactionRow as TxRow } from "./types";

type Props = {
  tx: TxRow;
  isReadOnly: boolean;
  onManageLinks: () => void;
  onViewInstallmentGroup: () => void;
};

// Rótulo de seção — mesmo padrão dos colapsáveis de edição (TransactionRowEditor):
// caption em caixa alta, 10px, letterSpacing 0.5, weight 500, `text.primary`.
const LABEL_SX = {
  display: "block",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontSize: 10,
  fontWeight: 500,
} as const;

// Botão de ação inline (ex.: "Gerenciar vínculos", "Ver grupo") — mesma receita
// amenizada do botão inline do editor (TransactionRowEditor "Criar apelido"),
// para não competir com o rótulo calmo da seção.
const ACTION_BTN_SX = {
  textTransform: "none",
  fontSize: 12,
  px: 2,
  py: 1,
  fontWeight: 400,
  color: "text.secondary",
} as const;

/**
 * Seção read-only da gaveta de anexos. Espelha a estrutura dos colapsáveis de
 * edição (label em caixa alta + conteúdo, `px:2 py:1.5`), com uma ação opcional
 * alinhada à direita do rótulo (ex.: "Gerenciar vínculos", "Ver grupo").
 */
function Section({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ minHeight: 24, mb: 0.5 }}
      >
        <Typography variant="caption" color="text.primary" sx={LABEL_SX}>
          {label}
        </Typography>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

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
      <Section key="notes" label={m.transactions.fields.notes}>
        <Typography variant="body2" color="text.primary" sx={{ whiteSpace: "pre-wrap" }}>
          {tx.notes}
        </Typography>
      </Section>,
    );
  }

  if (tx.originalCurrency) {
    sections.push(
      <Section key="fx" label={m.transactions.foreignCurrency.label}>
        <Typography variant="body2" color="text.primary">
          {tx.originalCurrency}
          {tx.originalAmountCents && tx.originalAmountCents !== "0"
            ? ` ${(Number(BigInt(tx.originalAmountCents)) / 100).toFixed(2)}`
            : ""}
          {tx.exchangeRate ? ` · ${m.transactions.foreignCurrency.rateDisplay(tx.exchangeRate)}` : ""}
        </Typography>
      </Section>,
    );
  }

  if (tx.linkCount > 0) {
    sections.push(
      <Section
        key="links"
        label={m.transactions.links.title}
        action={
          !isReadOnly && (
            <Button size="small" variant="text" color="inherit" sx={ACTION_BTN_SX} onClick={onManageLinks}>
              {m.transactions.links.manage}
            </Button>
          )
        }
      >
        <Typography variant="body2" color="text.primary">
          {m.transactions.rowState.links(tx.linkCount)}
        </Typography>
      </Section>,
    );
  }

  if (tx.tags.length > 0) {
    sections.push(
      <Section key="tags" label={m.transactions.fields.tags}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {tx.tags.map((t) => (
            <Chip key={t.id} label={t.name} size="small" sx={tagChipSx(t.color)} />
          ))}
        </Box>
      </Section>,
    );
  }

  if (tx.installmentGroupId) {
    sections.push(
      <Section
        key="installment"
        label={m.transactions.installments.column}
        action={
          <Button size="small" variant="text" color="inherit" sx={ACTION_BTN_SX} onClick={onViewInstallmentGroup}>
            {m.transactions.attachments.viewGroup}
          </Button>
        }
      >
        <Typography variant="body2" color="text.primary">
          {tx.installmentNumber && tx.installmentGroupCount
            ? m.transactions.installments.badge(tx.installmentNumber, tx.installmentGroupCount)
            : "—"}
        </Typography>
      </Section>,
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
