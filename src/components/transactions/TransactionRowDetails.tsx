"use client";

import AddLinkIcon from "@mui/icons-material/AddLink";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { Fragment } from "react";

import { tagChipSx } from "@/components/tags/tagChipSx";
import { m } from "@/lib/messages";

import { DRAWER_SECTION_ORDER, drawerSectionMeta } from "./drawerSections";
import SectionDrawer from "./SectionDrawer";
import type { TransactionRow as TxRow } from "./types";

type Props = {
  tx: TxRow;
  isReadOnly: boolean;
  onManageLinks: () => void;
  onViewInstallmentGroup: () => void;
};

/**
 * Ação de texto do cabeçalho da gaveta (frame 66 §7 — ex.: "Vincular",
 * "Ver grupo"): `accent.primary`, `fontWeight:500`, `fontSize:0.72rem`, ícone
 * 14px. `<button>` nativo (em vez de `IconButton`) para o rótulo ficar
 * visível ao lado do ícone, mantendo foco/teclado de graça.
 */
function DrawerHeaderAction({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        border: 0,
        bgcolor: "transparent",
        p: 0,
        m: 0,
        cursor: "pointer",
        fontWeight: 500,
        fontSize: "0.72rem",
        fontFamily: "inherit",
        color: "accent.primary",
        "&:hover": { color: "accent.primaryHover" },
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

/**
 * Campo compacto da gaveta de moeda estrangeira (frame 66 §7.2): rótulo
 * pequeno (`text.tertiary`) + caixa mono, lado a lado com os outros dois
 * campos. Valor ausente vira "—" em `text.disabled` (mesma convenção do modal
 * de detalhe — frame §9).
 */
function FxField({ label, value }: { label: string; value: string }) {
  const isPlaceholder = value === "—";
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        title={label}
        sx={{
          display: "block",
          fontSize: "0.68rem",
          color: "text.tertiary",
          mb: "4px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          height: "32px",
          border: "1px solid",
          borderColor: "border.default",
          borderRadius: "7px",
          px: "10px",
          display: "flex",
          alignItems: "center",
          fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
          fontSize: "0.8rem",
          color: isPlaceholder ? "text.disabled" : "text.primary",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

/** Gaveta de leitura (read-only) dos anexos da linha (spec 62 §2.2). Reusa os
 * dialogs existentes via callbacks — não reimplementa vínculos/parcela. Segue
 * o padrão visual do frame 66 §7: cabeçalho de cada seção é só o rótulo
 * `.cap` (sem repetir o ícone — o ícone já vive no toggle da barra de
 * ferramentas), seções separadas por `Divider`. Ordem e rótulo de cada seção
 * vêm de `drawerSectionMeta`/`DRAWER_SECTION_ORDER` (spec 66 TX-03b) — a mesma
 * fonte usada pela barra de ferramentas da edição (`RowDrawerToolbar`). */
export function TransactionRowDetails({
  tx,
  isReadOnly,
  onManageLinks,
  onViewInstallmentGroup,
}: Props) {
  const sections: React.ReactNode[] = [];

  for (const key of DRAWER_SECTION_ORDER) {
    const meta = drawerSectionMeta[key];

    if (key === "notes" && tx.notes) {
      sections.push(
        <SectionDrawer key={key} label={meta.label}>
          <Box
            sx={{
              minHeight: "64px",
              border: "1px solid",
              borderColor: "border.default",
              borderRadius: "8px",
              bgcolor: "background.surface",
              padding: "10px 12px",
            }}
          >
            <Typography
              variant="body2"
              sx={{
                whiteSpace: "pre-wrap",
                fontSize: "0.8rem",
                lineHeight: 1.5,
                color: "text.secondary",
              }}
            >
              {tx.notes}
            </Typography>
          </Box>
        </SectionDrawer>,
      );
    } else if (key === "fx" && tx.originalCurrency) {
      const amountValue =
        tx.originalAmountCents && tx.originalAmountCents !== "0"
          ? (Number(BigInt(tx.originalAmountCents)) / 100).toFixed(2)
          : "—";
      const rateValue = tx.exchangeRate ? `R$${tx.exchangeRate.toFixed(2)}` : "—";
      sections.push(
        <SectionDrawer key={key} label={meta.label}>
          <Box sx={{ display: "flex", gap: "10px" }}>
            <FxField
              label={m.transactions.foreignCurrency.currencyLabel}
              value={tx.originalCurrency}
            />
            <FxField
              label={m.transactions.foreignCurrency.originalAmountLabel}
              value={amountValue}
            />
            <FxField
              label={m.transactions.foreignCurrency.exchangeRateLabel}
              value={rateValue}
            />
          </Box>
        </SectionDrawer>,
      );
    } else if (key === "links" && tx.linkCount > 0) {
      sections.push(
        <SectionDrawer
          key={key}
          label={meta.label}
          action={
            !isReadOnly && (
              <DrawerHeaderAction
                label={m.transactions.links.addLink}
                icon={<AddLinkIcon sx={{ fontSize: 14 }} />}
                onClick={onManageLinks}
              />
            )
          }
        >
          <Box
            sx={{
              border: "1px solid",
              borderColor: "border.subtle",
              borderRadius: "8px",
              bgcolor: "background.canvas",
              padding: "10px 12px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: 500, fontSize: "0.82rem", color: "text.primary" }}
            >
              {m.transactions.rowState.links(tx.linkCount)}
            </Typography>
          </Box>
        </SectionDrawer>,
      );
    } else if (key === "tags" && tx.tags.length > 0) {
      sections.push(
        <SectionDrawer key={key} label={meta.label}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {tx.tags.map((t) => (
              <Chip key={t.id} label={t.name} size="small" sx={tagChipSx(t.color)} />
            ))}
          </Box>
        </SectionDrawer>,
      );
    } else if (key === "installment" && tx.installmentGroupId) {
      sections.push(
        <SectionDrawer
          key={key}
          label={meta.label}
          action={
            <DrawerHeaderAction
              label={m.transactions.attachments.viewGroup}
              icon={<VisibilityIcon sx={{ fontSize: 14 }} />}
              onClick={onViewInstallmentGroup}
            />
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
