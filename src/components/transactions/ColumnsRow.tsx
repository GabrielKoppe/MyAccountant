"use client";

import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import CheckIcon from "@mui/icons-material/Check";
import FlashOnOutlinedIcon from "@mui/icons-material/FlashOnOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import StarIcon from "@mui/icons-material/Star";
import WavesOutlinedIcon from "@mui/icons-material/WavesOutlined";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { SectionCountType } from "@prisma/client";
import type { RefObject } from "react";

import { tagChipSx } from "@/components/tags/tagChipSx";
import { formatDateShort } from "@/lib/dates";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";

import { PartyAvatar } from "./PartyAvatar";
import { pillOutlineSx, pillSx, rowCheckboxCheckedIconSx, rowCheckboxIconSx } from "./pill-sx";
import { describeRowState } from "./row-state";
import { TransactionRowActions } from "./TransactionRowActions";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  ResponsiblePartyOption,
  RowMenuItem,
  TransactionRow as TxRow,
} from "./types";

// Extração fiel (Spec 66 P6) do <TableRow> de LEITURA que vivia em
// TransactionRow.tsx (layout A — colunas explícitas). Mesmo JSX/handlers: os
// overlays (SuggestionPopover, TagPopover, InstallmentGroupPanel,
// LinkTransactionDialog) e o drawer permanecem no container TransactionRow, que
// passa os dados/handlers por props. A célula de descrição só renderiza o ✨
// (gatilho da sugestão) — o Popover fica no container.
export type ColumnsRowProps = {
  tx: TxRow;
  isSelected: boolean;
  isReadOnly: boolean;
  sectionCountType: SectionCountType;
  hiddenColumns: HiddenColumns;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  parties: ResponsiblePartyOption[];
  localTags: { id: string; name: string; color: string | null }[];
  /** Se há sugestão de apelido ativa — renderiza o ✨ na descrição. */
  hasSuggestion: boolean;
  /** Ref do badge de parcela (devolução de foco ao fechar o painel — P5). */
  installmentBadgeRef: RefObject<HTMLDivElement | null>;
  onSelect: (id: string, checked: boolean) => void;
  onStartEdit: (field?: string) => void;
  onOpenSuggestion: (anchor: HTMLElement) => void;
  onOpenTags: (anchor: HTMLElement) => void;
  onOpenInstallmentPanel: () => void;
  // Ações da linha (TransactionRowActions)
  onTogglePending: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onViewDetails: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onCreateAlias: () => void;
  onDelete: () => void;
  onToggleDrawer: () => void;
  drawerOpen: boolean;
  onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>, items: RowMenuItem[]) => void;
};

export function ColumnsRow({
  tx,
  isSelected,
  isReadOnly,
  sectionCountType,
  hiddenColumns,
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
}: ColumnsRowProps) {
  const amount = BigInt(tx.amountCents);
  const isPositive = sectionCountType === "subtract" ? amount < 0n : amount >= 0n;

  const subcatsForCategory = categories.find((c) => c.id === tx.categoryId)?.subcategories ?? [];

  return (
    <TableRow
      hover
      selected={isSelected}
      sx={{
        opacity: tx.isPending ? 0.6 : 1,
        // Linha selecionada (frame 66 §4): fundo accent sutil — não o
        // `action.selected` cinza padrão do MUI.
        "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "accent.primarySubtle" },
        // Ações rápidas (chevron da gaveta, pendente, favorito): invisíveis em
        // repouso — só o ⋮ fica sempre visível (frame 66 · Colunas, REFINADO).
        // Revelam no hover/foco da linha (:focus-within cobre navegação por
        // teclado); estado ativo (ex.: favorita marcada, pendente) permanece
        // sempre visível via `.row-primary--active`, pois é informação, não só ação.
        "& .row-primary": { opacity: 0, transition: "opacity 0.15s" },
        "&:hover .row-primary, &:focus-within .row-primary": { opacity: 1 },
        "& .row-primary--active": { opacity: 1 },
        "& .tag-hint-icon": { opacity: 0, transition: "opacity 0.15s" },
        "&:hover .tag-hint-icon": { opacity: 1 },
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
        sx={{
          fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
          fontSize: 13,
          color: "text.secondary",
          whiteSpace: "nowrap",
          py: 1.5,
          cursor: isReadOnly ? "default" : "pointer",
        }}
        onClick={() => !isReadOnly && onStartEdit("occurredOn")}
      >
        {formatDateShort(tx.occurredOn)}
      </TableCell>

      <TableCell
        sx={{
          fontSize: 13,
          maxWidth: 200,
          py: 1.5,
          cursor: isReadOnly ? "default" : "pointer",
          // Frame 66 §4: na linha selecionada a descrição vai para o accent.
          ...(isSelected && { color: "accent.primary" }),
        }}
        onClick={() => !isReadOnly && onStartEdit("description")}
        aria-label={describeRowState(tx)}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          {tx.isFavorite && (
            <StarIcon sx={{ fontSize: 14, color: "warning.main", mr: 0.5, flexShrink: 0 }} />
          )}
          <Box
            component="span"
            sx={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {tx.description}
          </Box>
          {tx.isPending && (
            <Chip
              label={m.transactions.fields.isPendingChip}
              size="small"
              sx={{
                ...pillSx,
                bgcolor: "warning.subtle",
                color: "warning.main",
                ml: 0.5,
                flexShrink: 0,
              }}
            />
          )}
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
        </Box>
      </TableCell>

      {!hiddenColumns.category && (
        <TableCell
          sx={{ fontSize: 13, py: 1.5, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && onStartEdit("categoryId")}
        >
          {categories.find((c) => c.id === tx.categoryId)?.name ?? null}
        </TableCell>
      )}

      {!hiddenColumns.subcategory && (
        <TableCell
          sx={{ fontSize: 13, py: 1.5, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && onStartEdit("subcategoryId")}
        >
          {subcatsForCategory.find((s) => s.id === tx.subcategoryId)?.name ?? null}
        </TableCell>
      )}

      {!hiddenColumns.institution && (
        <TableCell
          sx={{ fontSize: 13, py: 1.5, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && onStartEdit("institutionId")}
        >
          {institutions.find((i) => i.id === tx.institutionId)?.name ?? tx.institutionText ?? null}
        </TableCell>
      )}

      {!hiddenColumns.paymentMethod && (
        <TableCell
          sx={{ fontSize: 13, py: 1.5, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && onStartEdit("paymentMethod")}
        >
          {tx.paymentMethod ? m.transactions.paymentMethods[tx.paymentMethod] : null}
        </TableCell>
      )}

      <TableCell
        align="right"
        sx={{
          fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
          fontVariantNumeric: "tabular-nums",
          fontWeight: "medium",
          fontSize: 13,
          whiteSpace: "nowrap",
          py: 1.5,
          color: isPositive ? "success.main" : "error.main",
          cursor: isReadOnly ? "default" : "pointer",
        }}
        onClick={() => !isReadOnly && onStartEdit("amountCents")}
      >
        {tx.originalCurrency ? (
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
            <span>{formatCentsToBrl(amount)}</span>
          </Tooltip>
        ) : (
          formatCentsToBrl(amount)
        )}
      </TableCell>

      {!hiddenColumns.responsibleUser && (
        <TableCell
          sx={{ py: 1.5, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && onStartEdit("responsibleUserId")}
        >
          {(() => {
            const party = tx.responsiblePartyId
              ? parties.find((p) => p.id === tx.responsiblePartyId)
              : null;
            if (!party) {
              return null;
            }
            return (
              <Tooltip title={party.name}>
                <Box component="span" sx={{ display: "inline-flex" }}>
                  <PartyAvatar
                    kind={party.kind}
                    icon={party.icon}
                    color={party.color}
                    imageUrl={party.imageUrl}
                    name={party.name}
                    size={24}
                  />
                </Box>
              </Tooltip>
            );
          })()}
        </TableCell>
      )}

      {!hiddenColumns.investmentType && (
        <TableCell
          sx={{ fontSize: 13, py: 1.5, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && onStartEdit("investmentType")}
        >
          {tx.investmentType ?? null}
        </TableCell>
      )}

      {/* Parcela estruturada ou texto legado */}
      {!hiddenColumns.cardInstallment && (
        <TableCell sx={{ px: 1, py: 1.5 }}>
          {tx.installmentGroupId && tx.installmentNumber && tx.installmentGroupCount ? (
            <Tooltip
              title={m.transactions.installments.badgeTooltip(
                tx.installmentNumber,
                tx.installmentGroupCount,
                m.transactions.installments.panelTitle,
              )}
            >
              <Chip
                ref={installmentBadgeRef}
                label={m.transactions.installments.badge(
                  tx.installmentNumber,
                  tx.installmentGroupCount,
                )}
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenInstallmentPanel();
                }}
                sx={{ ...pillOutlineSx, cursor: "pointer" }}
              />
            </Tooltip>
          ) : tx.cardInstallment ? (
            <Typography variant="caption" color="text.secondary">
              {tx.cardInstallment}
            </Typography>
          ) : null}
        </TableCell>
      )}
      {!hiddenColumns.expenseType && tx.expenseType && (
        <TableCell sx={{ px: 0.5, width: 28 }}>
          <Tooltip title={m.transactions.expenseTypeTooltips[tx.expenseType] ?? ""}>
            <span style={{ display: "inline-flex", alignItems: "center", marginTop: 6 }}>
              {tx.expenseType === "fixed" && (
                <LockOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              )}
              {tx.expenseType === "variable" && (
                <WavesOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              )}
              {tx.expenseType === "one_time" && (
                <FlashOnOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              )}
            </span>
          </Tooltip>
        </TableCell>
      )}
      {!hiddenColumns.expenseType && !tx.expenseType && <TableCell sx={{ px: 0.5, width: 28 }} />}

      {/* Célula de tags */}
      {!hiddenColumns.tags && (
        <TableCell
          sx={{ cursor: "pointer", maxWidth: 160, minWidth: 60, px: 1, py: 1.5 }}
          onClick={(e) => onOpenTags(e.currentTarget)}
        >
          {localTags.length > 0 ? (
            <Box
              sx={{
                display: "flex",
                gap: 0.5,
                flexWrap: "nowrap",
                overflow: "hidden",
                alignItems: "center",
              }}
            >
              {localTags.slice(0, 2).map((tag) => (
                <Tooltip key={tag.id} title={tag.name} disableInteractive>
                  <Chip label={tag.name} size="small" sx={{ ...tagChipSx(tag.color), maxWidth: 72 }} />
                </Tooltip>
              ))}
              {localTags.length > 2 && (
                <Chip label={`+${localTags.length - 2}`} size="small" sx={pillSx} />
              )}
            </Box>
          ) : (
            <Tooltip title={m.transactions.tags.addTooltip}>
              <LabelOutlinedIcon
                className="tag-hint-icon"
                sx={{ fontSize: 16, color: "text.disabled", display: "block" }}
              />
            </Tooltip>
          )}
        </TableCell>
      )}

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
