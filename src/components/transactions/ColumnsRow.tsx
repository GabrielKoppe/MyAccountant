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
import type { PinnableColumnKey } from "@/lib/table-columns";
import { DENSITY_VAR } from "@/lib/table-density";

import { PartyAvatar } from "./PartyAvatar";
import { pillOutlineSx, pillSx, rowCheckboxCheckedIconSx, rowCheckboxIconSx } from "./pill-sx";
import { pinnedBodyCellSx, pinnedSelectCellSx } from "./pinned-columns";
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
  /**
   * Spec 69 §2.1 (`allowBulkEdit`) — desenha (ou não) a caixa de seleção da
   * linha. A CÉLULA continua sendo emitida em qualquer caso: ela é a coluna que
   * alinha o cabeçalho e o "+" da linha-fantasma. Default `true` para quem
   * renderiza a linha fora do mês.
   */
  selectable?: boolean;
  /**
   * Spec 69 §16 — colunas fixadas à esquerda, **já resolvidas** pela
   * `TransactionTable` (∩ `PINNABLE_COLUMNS` ∩ visíveis, na ordem das visíveis,
   * e vazio no layout de pílulas). A linha só aplica o `sx`; ela não decide.
   */
  pinnedColumns?: readonly PinnableColumnKey[];
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

/**
 * Spec 69 §7.2 — recipe de célula sob densidade: fonte em `--row-fs` e padding
 * vertical zerado. Quem manda na altura é o `height` do `<tr>` (que em tabelas
 * o CSS trata como MÍNIMO) — sem isso, o padding fixo somado ao conteúdo
 * impediria a linha de chegar aos 36/44/52px da escala. Nenhuma medição em JS.
 */
const CELL_SX = { fontSize: DENSITY_VAR.fontSize, py: 0 } as const;

/**
 * Spec 69 · acabamento visual — esmaecimento da linha PENDENTE.
 *
 * `opacity` num ancestral compõe o subárvore inteira como um GRUPO: o navegador
 * desenha tudo opaco e só então aplica o alfa uma vez. Por isso um descendente
 * com `opacity: 1` NÃO se resgata — ele continua saindo a 60%. A única saída é
 * tirar o elemento de dentro do escopo opaco.
 *
 * Então o fade não mora mais no `<tr>`: desce para as células (`& > td`), e a
 * célula que hospeda o chip "Pendente" fica de fora (`.row-pending-host`). Lá
 * dentro o fade é reaplicado item a item (`.row-dim`) em tudo que NÃO é o chip.
 *
 * O porquê: o esmaecimento comunica "esta linha ainda não aconteceu"; o chip é
 * justamente o rótulo que diz isso, e tem de continuar legível. Dentro do grupo
 * opaco o par do chip desabava para ~1,8:1 no light (medido sobre
 * `background.surface`) — abaixo até do mínimo de 3:1 de componente. Fora dele
 * o chip fica em `warning.onSubtle` sobre `warning.light`, que mede 4,51:1
 * (o antigo `warning.main` dava 2,77:1). Ver src/lib/theme-contrast.test.ts.
 */
export const PENDING_ROW_OPACITY = 0.6;
/** Célula que hospeda o chip de estado — não é esmaecida como um todo. */
export const PENDING_HOST_CLASS = "row-pending-host";
/** Elementos dentro da célula-host que ainda devem esmaecer (tudo menos o chip). */
export const PENDING_DIM_CLASS = "row-dim";

/**
 * Spec 69 §16 — célula de coluna FIXADA. Precisa sair do escopo opaco pelo mesmo
 * motivo que a célula-host, mas por uma razão diferente e mais dura: uma célula
 * presa a 60% de opacidade tem o **fundo** a 60% também, e o conteúdo que rola
 * por baixo dela aparece através. O fade volta item a item (`.row-dim`), como na
 * host — o esmaecimento continua valendo, só deixa de valer em bloco.
 */
export const PINNED_CELL_CLASS = "row-pinned-cell";

/** `sx` do esmaecimento da linha pendente — aplicar no `<TableRow>`. */
export const pendingRowSx = {
  "& > td": { opacity: PENDING_ROW_OPACITY },
  // Especificidade maior que `& > td` (0,2,1 × 0,1,1) → a célula-host reverte.
  [`& > td.${PENDING_HOST_CLASS}`]: { opacity: 1 },
  [`& > td.${PENDING_HOST_CLASS} .${PENDING_DIM_CLASS}`]: { opacity: PENDING_ROW_OPACITY },
  [`& > td.${PINNED_CELL_CLASS}`]: { opacity: 1 },
  [`& > td.${PINNED_CELL_CLASS} .${PENDING_DIM_CLASS}`]: { opacity: PENDING_ROW_OPACITY },
} as const;

/** Junta classes opcionais; `undefined` quando não sobra nenhuma. */
export function rowCellClass(
  ...parts: (string | false | null | undefined)[]
): string | undefined {
  const kept = parts.filter(Boolean);
  return kept.length > 0 ? kept.join(" ") : undefined;
}

export function ColumnsRow({
  tx,
  isSelected,
  isReadOnly,
  selectable = true,
  pinnedColumns = [],
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

  // Spec 69 §16 — `false` quando a coluna não está presa (item neutro do `sx`
  // em array), então o caminho "nada fixado" não muda uma linha sequer do DOM.
  const pinnedSelect = pinnedSelectCellSx(pinnedColumns);
  const pinnedDate = pinnedBodyCellSx(pinnedColumns, "occurredOn");
  const pinnedDescription = pinnedBodyCellSx(pinnedColumns, "description");

  return (
    <TableRow
      hover
      selected={isSelected}
      sx={{
        height: DENSITY_VAR.rowHeight,
        // Esmaecimento por célula (ver `pendingRowSx`): o chip "Pendente" fica
        // fora do escopo opaco para continuar legível.
        ...(tx.isPending ? pendingRowSx : null),
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
      <TableCell
        padding="checkbox"
        className={rowCellClass(pinnedSelect && PINNED_CELL_CLASS)}
        sx={[pinnedSelect]}
        onClick={(e) => e.stopPropagation()}
      >
        {selectable && (
          <Checkbox
            className={rowCellClass(pinnedSelect && PENDING_DIM_CLASS)}
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
        )}
      </TableCell>

      <TableCell
        className={rowCellClass(pinnedDate && PINNED_CELL_CLASS)}
        sx={[
          {
            ...CELL_SX,
            fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
            color: "text.secondary",
            whiteSpace: "nowrap",
            cursor: isReadOnly ? "default" : "pointer",
          },
          pinnedDate,
        ]}
        onClick={() => !isReadOnly && onStartEdit("occurredOn")}
      >
        {pinnedDate ? (
          // Presa, a célula sai do escopo opaco da linha pendente (senão o fundo
          // ficaria translúcido) — o fade volta aqui dentro.
          <Box component="span" className={PENDING_DIM_CLASS}>
            {formatDateShort(tx.occurredOn)}
          </Box>
        ) : (
          formatDateShort(tx.occurredOn)
        )}
      </TableCell>

      <TableCell
        // Célula-host do chip de estado: quando a linha está pendente ela NÃO é
        // esmaecida em bloco; o fade é reaplicado nos irmãos do chip (`.row-dim`).
        className={rowCellClass(
          tx.isPending && PENDING_HOST_CLASS,
          pinnedDescription && PINNED_CELL_CLASS,
        )}
        sx={[
          {
            ...CELL_SX,
            maxWidth: 200,
            cursor: isReadOnly ? "default" : "pointer",
            // Frame 66 §4: na linha selecionada a descrição vai para o accent.
            ...(isSelected && { color: "accent.primary" }),
          },
          pinnedDescription,
        ]}
        onClick={() => !isReadOnly && onStartEdit("description")}
        aria-label={describeRowState(tx)}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          {tx.isFavorite && (
            <StarIcon
              className={PENDING_DIM_CLASS}
              sx={{ fontSize: 14, color: "warning.main", mr: 0.5, flexShrink: 0 }}
            />
          )}
          <Box
            component="span"
            className={PENDING_DIM_CLASS}
            sx={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {tx.description}
          </Box>
          {/* Sem `.row-dim`: é o rótulo que explica o esmaecimento da linha. */}
          {tx.isPending && (
            <Chip
              label={m.transactions.fields.isPendingChip}
              size="small"
              sx={{
                ...pillSx,
                bgcolor: "warning.light",
                // Texto sobre fundo sutil → `onSubtle` (AA); `main` da 2,77:1.
                color: "warning.onSubtle",
                ml: 0.5,
                flexShrink: 0,
              }}
            />
          )}
          {hasSuggestion && (
            <Tooltip title={m.transactions.aliasSuggestion.header}>
              <IconButton
                className={PENDING_DIM_CLASS}
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
          sx={{ ...CELL_SX, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && onStartEdit("categoryId")}
        >
          {categories.find((c) => c.id === tx.categoryId)?.name ?? null}
        </TableCell>
      )}

      {!hiddenColumns.subcategory && (
        <TableCell
          sx={{ ...CELL_SX, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && onStartEdit("subcategoryId")}
        >
          {subcatsForCategory.find((s) => s.id === tx.subcategoryId)?.name ?? null}
        </TableCell>
      )}

      {!hiddenColumns.institution && (
        <TableCell
          sx={{ ...CELL_SX, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && onStartEdit("institutionId")}
        >
          {institutions.find((i) => i.id === tx.institutionId)?.name ?? tx.institutionText ?? null}
        </TableCell>
      )}

      {!hiddenColumns.paymentMethod && (
        <TableCell
          sx={{ ...CELL_SX, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && onStartEdit("paymentMethod")}
        >
          {tx.paymentMethod ? m.transactions.paymentMethods[tx.paymentMethod] : null}
        </TableCell>
      )}

      <TableCell
        align="right"
        sx={{
          ...CELL_SX,
          fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
          fontVariantNumeric: "tabular-nums",
          fontWeight: "medium",
          whiteSpace: "nowrap",
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
          sx={{ ...CELL_SX, cursor: isReadOnly ? "default" : "pointer" }}
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
          sx={{ ...CELL_SX, cursor: isReadOnly ? "default" : "pointer" }}
          onClick={() => !isReadOnly && onStartEdit("investmentType")}
        >
          {tx.investmentType ?? null}
        </TableCell>
      )}

      {/* Parcela estruturada ou texto legado */}
      {!hiddenColumns.cardInstallment && (
        <TableCell sx={{ ...CELL_SX, px: 1 }}>
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
        <TableCell sx={{ ...CELL_SX, px: 0.5, width: 28 }}>
          <Tooltip title={m.transactions.expenseTypeTooltips[tx.expenseType] ?? ""}>
            {/* `verticalAlign: middle` no lugar do antigo `marginTop: 6`: aquele
                offset compensava o padding vertical fixo da célula, que a
                densidade (Spec 69) zerou — quem centraliza agora é a linha. */}
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}
            >
              {tx.expenseType === "fixed" && (
                <LockOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              )}
              {tx.expenseType === "variable" && (
                <WavesOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              )}
              {tx.expenseType === "one_time" && (
                <FlashOnOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              )}
            </Box>
          </Tooltip>
        </TableCell>
      )}
      {!hiddenColumns.expenseType && !tx.expenseType && (
        <TableCell sx={{ ...CELL_SX, px: 0.5, width: 28 }} />
      )}

      {/* Célula de tags */}
      {!hiddenColumns.tags && (
        <TableCell
          sx={{ ...CELL_SX, cursor: "pointer", maxWidth: 160, minWidth: 60, px: 1 }}
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
                  <Chip
                    label={tag.name}
                    size="small"
                    sx={{ ...tagChipSx(tag.color), maxWidth: 72 }}
                  />
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
