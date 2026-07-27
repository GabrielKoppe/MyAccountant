"use client";

import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import SplitscreenOutlinedIcon from "@mui/icons-material/SplitscreenOutlined";
import StarIcon from "@mui/icons-material/Star";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { tagChipSx } from "@/components/tags/tagChipSx";
import { formatDateShort } from "@/lib/dates";
import { m } from "@/lib/messages";
import { displaySignInverts, formatCentsToBrl } from "@/lib/money";

import type { ColumnsRowProps } from "./ColumnsRow";
import { PartyAvatar } from "./PartyAvatar";
import { pillOutlineSx, pillSx, rowCheckboxCheckedIconSx, rowCheckboxIconSx } from "./pill-sx";
import { describeRowState } from "./row-state";
import { TransactionRowActions } from "./TransactionRowActions";

// Layout B (Spec 66 TX-04b) — descrição em destaque + metadados em pílulas.
// Mesmos dados/handlers do container (reusa `ColumnsRowProps`); só muda a FORMA
// (pílula × coluna), nunca o conjunto de campos. Sem indicador `more_horiz`
// (TX-04c): ocultar campo é intenção do usuário, não há pista na linha. As
// afordâncias rápidas (toggle Pendente/Favorito, chevron, menu ⋮) permanecem em
// TransactionRowActions. Pendente é exibido via chip discreto (sem ícone, minúsculo
// — Spec 66 · Fidelidade item 6); Favorita é um ★ inline antes do título (frame B).
export type RichRowProps = ColumnsRowProps;

export function RichRow({
  tx,
  isSelected,
  isReadOnly,
  hiddenColumns,
  sectionCountType,
  categories,
  institutions,
  parties,
  localTags,
  hasSuggestion,
  installmentBadgeRef,
  onSelect,
  onStartEdit,
  onOpenSuggestion,
  onOpenTags,
  onOpenInstallmentPanel,
  onTogglePending,
  onToggleFavorite,
  onViewDetails,
  onDuplicate,
  onMove,
  onCreateAlias,
  onDelete,
  onToggleDrawer,
  drawerOpen,
  onOpenMenu,
}: RichRowProps) {
  const amount = BigInt(tx.amountCents);
  const displayAmount = displaySignInverts(sectionCountType) ? -amount : amount;
  const amountColor =
    displayAmount > 0n ? "success.main" : displayAmount < 0n ? "danger.main" : "text.tertiary";

  const category = tx.categoryId ? categories.find((c) => c.id === tx.categoryId) : null;
  const subcategory =
    category && tx.subcategoryId
      ? category.subcategories.find((s) => s.id === tx.subcategoryId)
      : null;
  const institution = tx.institutionId
    ? institutions.find((i) => i.id === tx.institutionId)
    : null;
  const institutionLabel = institution?.name ?? tx.institutionText ?? null;
  const party = tx.responsiblePartyId
    ? parties.find((p) => p.id === tx.responsiblePartyId)
    : null;

  const hasInstallment = Boolean(
    tx.installmentGroupId && tx.installmentNumber && tx.installmentGroupCount,
  );

  return (
    <TableRow
      hover
      selected={isSelected}
      sx={{
        opacity: tx.isPending ? 0.6 : 1,
        // Linha selecionada (frame 66 §4): fundo accent sutil — não o
        // `action.selected` cinza padrão do MUI.
        "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "accent.primarySubtle" },
        // Em repouso só o ⋮ aparece; as acoes rapidas surgem no hover/foco
        // (mesma regra do layout A — frame "colunas refinado").
        "& .row-primary": { opacity: 0, transition: "opacity 0.15s" },
        "&:hover .row-primary, &:focus-within .row-primary": { opacity: 1 },
        "& .row-primary--active": { opacity: 1 },
        // `more_vert` (sempre visível): cinza discreto em repouso, secundário
        // no hover/foco — nunca "branco" (Spec 66 · Fidelidade item 5).
        "& .row-more-vert": { color: "text.disabled", transition: "color 0.15s" },
        "&:hover .row-more-vert, &:focus-within .row-more-vert": { color: "text.secondary" },
      }}
    >
      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onChange={(e) => onSelect(tx.id, e.target.checked)}
          size="small"
          disabled={isReadOnly}
          icon={<Box component="span" sx={rowCheckboxIconSx} />}
          checkedIcon={
            <Box component="span" sx={rowCheckboxCheckedIconSx}>
              <CheckIcon sx={{ fontSize: 12 }} />
            </Box>
          }
        />
      </TableCell>

      <TableCell
        sx={{ cursor: isReadOnly ? "default" : "pointer", py: 1 }}
        onClick={() => !isReadOnly && onStartEdit("description")}
        aria-label={describeRowState(tx)}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* Data — coluna fixa à esquerda, mono (Spec 66 TX-04b, frame B) */}
          <Typography
            component="span"
            color="text.secondary"
            sx={{
              fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
              fontSize: "0.8rem",
              minWidth: 40,
              flexShrink: 0,
            }}
          >
            {formatDateShort(tx.occurredOn)}
          </Typography>

          {/* Bloco central: título + pílulas */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              {/* Favorita = ★ na descrição (não StatusBadge) */}
              {tx.isFavorite && (
                <StarIcon sx={{ fontSize: 16, color: "warning.main", flexShrink: 0 }} />
              )}
              <Typography
                component="span"
                variant="body2"
                // Frame 66 §4: na linha selecionada a descrição vai para o accent.
                color={isSelected ? "accent.primary" : "text.primary"}
                fontWeight={500}
                sx={{ fontSize: "0.82rem", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {tx.description || (
                  <Typography component="span" variant="caption" color="text.disabled">
                    —
                  </Typography>
                )}
              </Typography>

              {hasSuggestion && (
                <Tooltip title={m.transactions.aliasSuggestion.header}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSuggestion(e.currentTarget);
                    }}
                    aria-label={m.transactions.aliasSuggestion.header}
                    sx={{ p: 0.25, flexShrink: 0 }}
                  >
                    <AutoFixHighOutlinedIcon sx={{ fontSize: 16, color: "accent.primary" }} />
                  </IconButton>
                </Tooltip>
              )}

              {/* Pendente = pílula discreta (sem ícone, minúsculo) — nunca StatusBadge. */}
              {tx.isPending && (
                <Chip
                  label={m.transactions.fields.isPendingChip}
                  size="small"
                  sx={{
                    ...pillSx,
                    bgcolor: "warning.subtle",
                    color: "warning.main",
                  }}
                />
              )}
            </Box>

            {/* Pílulas de metadados (gated por hiddenColumns) — linha com gap 5px, mt 4px */}
            <Box sx={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap", mt: 0.5 }}>
              {!hiddenColumns.category && category && (
                <Chip
                  size="small"
                  icon={<SellOutlinedIcon />}
                  label={subcategory ? `${category.name} › ${subcategory.name}` : category.name}
                  sx={pillSx}
                />
              )}
              {!hiddenColumns.institution && institutionLabel && (
                <Chip size="small" label={institutionLabel} sx={pillSx} />
              )}
              {!hiddenColumns.responsibleUser && party && (
                <Chip
                  size="small"
                  avatar={
                    <PartyAvatar
                      kind={party.kind}
                      icon={party.icon}
                      color={party.color}
                      imageUrl={party.imageUrl}
                      name={party.name}
                      size={13}
                    />
                  }
                  label={party.name}
                  sx={pillSx}
                />
              )}
              {tx.originalCurrency && (
                <Tooltip
                  title={[
                    "Moeda estrangeira",
                    tx.originalAmountCents && tx.originalAmountCents !== "0"
                      ? `${tx.originalCurrency} ${(Number(BigInt(tx.originalAmountCents)) / 100).toFixed(2)}`
                      : tx.originalCurrency,
                    tx.exchangeRate ? `câmbio R$${tx.exchangeRate.toFixed(2)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  arrow
                >
                  <Chip
                    size="small"
                    icon={<CurrencyExchangeOutlinedIcon />}
                    label={tx.originalCurrency}
                    sx={pillSx}
                  />
                </Tooltip>
              )}
              {/* Parcela = pílula contornada clicável que abre o painel unificado */}
              {hasInstallment && (
                <Tooltip
                  title={m.transactions.installments.badgeTooltip(
                    tx.installmentNumber!,
                    tx.installmentGroupCount!,
                    m.transactions.installments.panelTitle,
                  )}
                >
                  <Chip
                    ref={installmentBadgeRef}
                    icon={<SplitscreenOutlinedIcon />}
                    label={m.transactions.installments.badge(
                      tx.installmentNumber!,
                      tx.installmentGroupCount!,
                    )}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenInstallmentPanel();
                    }}
                    sx={{ ...pillOutlineSx, cursor: "pointer" }}
                  />
                </Tooltip>
              )}
              {!hiddenColumns.tags &&
                localTags.map((tag) => (
                  <Chip
                    key={tag.id}
                    label={tag.name}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTags(e.currentTarget);
                    }}
                    sx={{ ...tagChipSx(tag.color), maxWidth: 120, cursor: "pointer" }}
                  />
                ))}
              {!hiddenColumns.tags && localTags.length === 0 && (
                // Afordancia de "adicionar tag": preservada, mas so aparece no
                // hover/foco (`row-primary`) para nao poluir a linha em repouso.
                <Chip
                  className="row-primary"
                  label={m.transactions.fields.tags}
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTags(e.currentTarget);
                  }}
                  sx={{
                    ...pillSx,
                    color: "text.disabled",
                    bgcolor: "transparent",
                    border: "1px dashed",
                    borderColor: "border.subtle",
                    cursor: "pointer",
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Bloco direito: valor, mono, centralizado com a linha */}
          <Box sx={{ flexShrink: 0, textAlign: "right" }}>
            <Typography
              component="span"
              sx={{
                fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                fontWeight: 500,
                fontSize: "0.8rem",
                fontVariantNumeric: "tabular-nums",
                color: amountColor,
              }}
            >
              {formatCentsToBrl(displayAmount)}
            </Typography>
          </Box>
        </Box>
      </TableCell>

      <TransactionRowActions
        tx={tx}
        isReadOnly={isReadOnly}
        onStartEdit={() => onStartEdit()}
        onTogglePending={onTogglePending}
        onToggleFavorite={onToggleFavorite}
        onViewDetails={onViewDetails}
        onDuplicate={onDuplicate}
        onMove={onMove}
        onCreateAlias={onCreateAlias}
        onDelete={onDelete}
        onToggleDrawer={onToggleDrawer}
        drawerOpen={drawerOpen}
        onOpenMenu={onOpenMenu}
      />
    </TableRow>
  );
}
