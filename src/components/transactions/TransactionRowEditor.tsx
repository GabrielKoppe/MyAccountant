"use client";

import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import FlashOnOutlinedIcon from "@mui/icons-material/FlashOnOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import WavesOutlinedIcon from "@mui/icons-material/WavesOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { TransactionExpenseType } from "@prisma/client";
import { useSnackbar } from "notistack";
import { useMemo, useState } from "react";
import { NumericFormat } from "react-number-format";

import { tagChipSx } from "@/components/tags/tagChipSx";
import { computeAliasApplication } from "@/lib/aliases/apply";
import { motion } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { centsToReais, reaisToCents } from "@/lib/money";
import { INVESTMENT_TYPES, TransactionPaymentMethod } from "@/lib/schemas/transaction";
import type { InvestmentType } from "@/lib/schemas/transaction";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

import { AliasSuggestionPopover } from "./aliases/AliasSuggestionPopover";
import { useAliasMatch } from "./aliases/useAliasMatch";
import { CreatableEntitySelect } from "./CreatableEntitySelect";
import { useOptions } from "./OptionsContext";
import { ResponsiblePartySelect } from "./ResponsiblePartySelect";
import { RowDrawer } from "./RowDrawer";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  ResponsiblePartyOption,
  TransactionRow as TxRow,
} from "./types";

type Props = {
  tx: TxRow;
  editValues: TxRow;
  setEditValues: React.Dispatch<React.SetStateAction<TxRow>>;
  isSelected: boolean;
  focusField: string;
  hiddenColumns: HiddenColumns;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  parties: ResponsiblePartyOption[];
  accountId: string;
  aliases: SerializedTransactionAlias[];
  onSelect: (id: string, checked: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  /** Cria apelido a partir dos valores em edição (DD-24). */
  onCreateAlias: () => void;
};

export function TransactionRowEditor({
  tx,
  editValues,
  setEditValues,
  isSelected,
  focusField,
  hiddenColumns,
  categories,
  institutions,
  parties,
  accountId,
  aliases,
  onSelect,
  onSave,
  onCancel,
  onCreateAlias,
}: Props) {
  const subcatsForCategory =
    categories.find((c) => c.id === editValues.categoryId)?.subcategories ?? [];

  const { onCreateCategory, onCreateSubcategory, onCreateInstitution, canManageOptions } =
    useOptions();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const sharedInputProps = { size: "small" as const, variant: "standard" as const };

  // Aplicação manual de apelido — o ícone acende sempre que há match, inclusive
  // no mount (DD-23, revê a regra `descriptionDirty` original). Como a aplicação
  // nunca é automática (exige clique em "Aplicar"), acender no mount é affordance.
  const [aliasAnchorEl, setAliasAnchorEl] = useState<HTMLElement | null>(null);
  const matchedAlias = useAliasMatch(editValues.description ?? "", aliases, true);
  const aliasApplication = useMemo(
    () =>
      matchedAlias
        ? computeAliasApplication(
            matchedAlias,
            {
              description: editValues.description,
              notes: editValues.notes,
              amountCents: editValues.amountCents,
              categoryId: editValues.categoryId,
              subcategoryId: editValues.subcategoryId,
              institutionId: editValues.institutionId,
              responsiblePartyId: editValues.responsiblePartyId,
              expenseType: editValues.expenseType,
              paymentMethod: editValues.paymentMethod,
              isPending: editValues.isPending,
            },
            { categories, institutions, parties },
          )
        : null,
    [matchedAlias, editValues, categories, institutions, parties],
  );
  // Ícone acende em qualquer match (mesmo um apelido só-de-tags, que não produz
  // nenhuma mudança aplicável aqui — tags ficam fora do escopo desta fase); o
  // popover trata o caso de 0 mudanças com uma mensagem + botão desabilitado.
  const hasAliasMatch = matchedAlias !== null;

  function handleApplyAlias() {
    if (!matchedAlias || !aliasApplication || aliasApplication.changes.length === 0) return;
    const { patch, changes } = aliasApplication;
    const snapshot = editValues;

    setEditValues((prev) => ({ ...prev, ...patch }));
    setAliasAnchorEl(null);

    enqueueSnackbar(m.transactions.aliasSuggestion.applied(matchedAlias.trigger, changes.length), {
      variant: "info",
      action: (snackKey) => (
        <Button
          size="small"
          color="inherit"
          onClick={() => {
            setEditValues(snapshot);
            closeSnackbar(snackKey);
          }}
        >
          {m.transactions.aliasSuggestion.undo}
        </Button>
      ),
    });
  }

  return (
    <>
      <TableRow
        sx={{ bgcolor: "action.selected" }}
        onKeyDown={(e) => {
          if (aliasAnchorEl) return; // guard: popover de apelido trata seu próprio Enter/Escape
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
      >
        <TableCell padding="checkbox">
          <Checkbox
            checked={isSelected}
            onChange={(e) => onSelect(tx.id, e.target.checked)}
            size="small"
          />
        </TableCell>

        {/* Data */}
        <TableCell>
          <TextField
            {...sharedInputProps}
            type="date"
            value={editValues.occurredOn.slice(0, 10)}
            onChange={(e) => setEditValues((prev) => ({ ...prev, occurredOn: e.target.value }))}
            sx={{ width: 120, "& input": { fontSize: 13 } }}
            autoFocus={focusField === "occurredOn"}
          />
        </TableCell>

        {/* Descrição */}
        <TableCell>
          <TextField
            {...sharedInputProps}
            value={editValues.description ?? ""}
            onChange={(e) => {
              setEditValues((prev) => ({ ...prev, description: e.target.value }));
            }}
            placeholder="Descrição"
            fullWidth
            autoFocus={focusField === "description"}
            sx={{ "& input": { fontSize: 13 } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {/* Slot de largura fixa: só a opacidade anima (Fade), a largura do
                      adornment nunca muda — evita "respiro" no campo ao digitar. */}
                  <Box sx={{ width: 24, display: "flex", justifyContent: "center" }}>
                    <Fade in={hasAliasMatch} unmountOnExit timeout={motion.duration.normal}>
                      <Tooltip
                        title={m.transactions.aliasSuggestion.tooltip(matchedAlias?.trigger ?? "")}
                      >
                        <IconButton
                          size="small"
                          onClick={(e) => setAliasAnchorEl(e.currentTarget)}
                          aria-label={m.transactions.aliasSuggestion.tooltip(
                            matchedAlias?.trigger ?? "",
                          )}
                          sx={{ p: 0.25 }}
                        >
                          <AutoFixHighOutlinedIcon sx={{ fontSize: 16, color: "accent.primary" }} />
                        </IconButton>
                      </Tooltip>
                    </Fade>
                  </Box>
                </InputAdornment>
              ),
            }}
          />
          {matchedAlias && aliasApplication && (
            <AliasSuggestionPopover
              anchorEl={aliasAnchorEl}
              trigger={matchedAlias.trigger}
              changes={aliasApplication.changes}
              onApply={handleApplyAlias}
              onClose={() => setAliasAnchorEl(null)}
            />
          )}
        </TableCell>

        {/* Categoria */}
        {!hiddenColumns.category && (
          <TableCell>
            <CreatableEntitySelect
              value={editValues.categoryId}
              onChange={(id) =>
                setEditValues((prev) => ({
                  ...prev,
                  categoryId: id,
                  subcategoryId: null,
                }))
              }
              options={categories}
              onCreate={onCreateCategory}
              canCreate={canManageOptions}
              variant="standard"
              ariaLabel={m.transactions.fields.category}
              placeholderNone={m.common.none}
              sx={{ minWidth: 110 }}
              autoFocus={focusField === "categoryId"}
            />
          </TableCell>
        )}

        {/* Subcategoria */}
        {!hiddenColumns.subcategory && (
          <TableCell>
            <CreatableEntitySelect
              value={editValues.subcategoryId}
              onChange={(id) => setEditValues((prev) => ({ ...prev, subcategoryId: id }))}
              options={subcatsForCategory}
              onCreate={(name) => {
                if (!editValues.categoryId) return Promise.resolve(null);
                return onCreateSubcategory(editValues.categoryId, name);
              }}
              canCreate={canManageOptions && !!editValues.categoryId}
              disabled={!editValues.categoryId}
              variant="standard"
              ariaLabel={m.transactions.fields.subcategory}
              placeholderNone={m.common.none}
              sx={{ minWidth: 110 }}
              autoFocus={focusField === "subcategoryId"}
            />
          </TableCell>
        )}

        {/* Instituição */}
        {!hiddenColumns.institution && (
          <TableCell>
            <CreatableEntitySelect
              value={editValues.institutionId}
              onChange={(id) => setEditValues((prev) => ({ ...prev, institutionId: id }))}
              options={institutions}
              onCreate={onCreateInstitution}
              canCreate={canManageOptions}
              variant="standard"
              ariaLabel={m.transactions.fields.institution}
              placeholderNone={m.common.none}
              sx={{ minWidth: 110 }}
              autoFocus={focusField === "institutionId"}
            />
          </TableCell>
        )}

        {/* Método de pagamento */}
        {!hiddenColumns.paymentMethod && (
          <TableCell>
            <Select
              {...sharedInputProps}
              displayEmpty
              value={editValues.paymentMethod ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({
                  ...prev,
                  paymentMethod: (e.target.value || null) as TransactionPaymentMethod | null,
                }))
              }
              aria-label={m.transactions.paymentMethodLabel}
              sx={{ minWidth: 120, fontSize: 13 }}
              autoFocus={focusField === "paymentMethod"}
            >
              <MenuItem value="">
                <em>{m.transactions.paymentMethodNone}</em>
              </MenuItem>
              {Object.values(TransactionPaymentMethod).map((pm) => (
                <MenuItem key={pm} value={pm} sx={{ fontSize: 13 }}>
                  {m.transactions.paymentMethods[pm]}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        )}

        {/* Valor */}
        <TableCell align="right">
          <NumericFormat
            customInput={TextField}
            {...sharedInputProps}
            value={centsToReais(BigInt(editValues.amountCents))}
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={2}
            fixedDecimalScale
            allowNegative
            onValueChange={({ floatValue }) => {
              const cents = reaisToCents(floatValue ?? 0);
              setEditValues((prev) => ({ ...prev, amountCents: cents.toString() }));
            }}
            sx={{ "& input": { textAlign: "right", width: 100, fontSize: 13 } }}
            autoFocus={focusField === "amountCents"}
          />
        </TableCell>

        {/* Responsável */}
        {!hiddenColumns.responsibleUser && (
          <TableCell>
            <ResponsiblePartySelect
              value={editValues.responsiblePartyId}
              onChange={(partyId) =>
                setEditValues((prev) => ({ ...prev, responsiblePartyId: partyId }))
              }
              parties={parties}
              variant="standard"
              sx={{ minWidth: 90 }}
              autoFocus={focusField === "responsibleUserId"}
            />
          </TableCell>
        )}

        {/* Tipo de investimento */}
        {!hiddenColumns.investmentType && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.investmentType ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({
                  ...prev,
                  investmentType: (e.target.value || null) as InvestmentType | null,
                }))
              }
              sx={{ minWidth: 120, fontSize: 13 }}
              autoFocus={focusField === "investmentType"}
            >
              <MenuItem value="">
                <em>Nenhum</em>
              </MenuItem>
              {INVESTMENT_TYPES.map((t) => (
                <MenuItem key={t} value={t} sx={{ fontSize: 13 }}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        )}

        {/* Parcela — read-only no editor (parcelamentos são criados via dialog) */}
        {!hiddenColumns.cardInstallment && (
          <TableCell sx={{ px: 1 }}>
            {editValues.installmentGroupId &&
            editValues.installmentNumber &&
            editValues.installmentGroupCount ? (
              <Chip
                label={`${editValues.installmentNumber}/${editValues.installmentGroupCount}`}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: 11, "& .MuiChip-label": { px: 0.75 } }}
              />
            ) : editValues.cardInstallment ? (
              <Typography variant="caption" color="text.secondary">
                {editValues.cardInstallment}
              </Typography>
            ) : null}
          </TableCell>
        )}

        {/* Tipo de gasto (expenseType) */}
        {!hiddenColumns.expenseType && (
          <TableCell sx={{ px: 0.5 }}>
            <Tooltip title={m.transactions.expenseTypeLabel}>
              <ToggleButtonGroup
                value={editValues.expenseType ?? null}
                exclusive
                size="small"
                onChange={(_e, val) =>
                  setEditValues((prev) => ({
                    ...prev,
                    expenseType: (val as TransactionExpenseType | null) ?? null,
                  }))
                }
                sx={{ "& .MuiToggleButton-root": { px: 2, py: 1, fontSize: 12 } }}
              >
                <Tooltip title={m.transactions.expenseTypeTooltips.fixed}>
                  <ToggleButton value="fixed" aria-label={m.transactions.expenseTypes.fixed}>
                    <LockOutlinedIcon sx={{ fontSize: 14 }} />
                  </ToggleButton>
                </Tooltip>
                <Tooltip title={m.transactions.expenseTypeTooltips.variable}>
                  <ToggleButton value="variable" aria-label={m.transactions.expenseTypes.variable}>
                    <WavesOutlinedIcon sx={{ fontSize: 14 }} />
                  </ToggleButton>
                </Tooltip>
                <Tooltip title={m.transactions.expenseTypeTooltips.one_time}>
                  <ToggleButton value="one_time" aria-label={m.transactions.expenseTypes.one_time}>
                    <FlashOnOutlinedIcon sx={{ fontSize: 14 }} />
                  </ToggleButton>
                </Tooltip>
              </ToggleButtonGroup>
            </Tooltip>
          </TableCell>
        )}

        {/* Tags — célula com chips atuais (a gaveta abre pelo ícone de tags na toolbar) */}
        {!hiddenColumns.tags && (
          <TableCell sx={{ maxWidth: 160, minWidth: 60, px: 1 }}>
            {editValues.tags.length > 0 ? (
              <Box
                sx={{
                  display: "flex",
                  gap: 0.5,
                  flexWrap: "nowrap",
                  overflow: "hidden",
                  alignItems: "center",
                }}
              >
                {editValues.tags.slice(0, 2).map((tag) => (
                  <Chip
                    key={tag.id}
                    label={tag.name}
                    size="small"
                    sx={{ ...tagChipSx(tag.color), maxWidth: 72 }}
                  />
                ))}
                {editValues.tags.length > 2 && (
                  <Chip
                    label={`+${editValues.tags.length - 2}`}
                    size="small"
                    sx={{ fontSize: 11, height: 20, "& .MuiChip-label": { px: 0.75 } }}
                  />
                )}
              </Box>
            ) : (
              <LabelOutlinedIcon sx={{ fontSize: 16, color: "text.disabled", display: "block" }} />
            )}
          </TableCell>
        )}

        {/* Ações */}
        <TableCell align="right" sx={{ width: 160, minWidth: 160, whiteSpace: "nowrap", pr: 1 }}>
          <Tooltip title={m.transactions.actions.save}>
            <IconButton
              size="small"
              sx={{ p: 1, minWidth: 32, minHeight: 32 }}
              onClick={onSave}
              aria-label={m.transactions.actions.save}
              color="primary"
            >
              <CheckIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={m.transactions.actions.cancel}>
            <IconButton
              size="small"
              sx={{ p: 1, minWidth: 32, minHeight: 32 }}
              onClick={onCancel}
              aria-label={m.transactions.actions.cancel}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>

      {/* Gaveta da linha — caixa-preta compartilhada com NewTransactionRow. */}
      <RowDrawer
        bgcolor="action.selected"
        notes={editValues.notes}
        onNotesChange={(v) => setEditValues((prev) => ({ ...prev, notes: v }))}
        notesAutoFocus={focusField === "notes"}
        onEscape={onCancel}
        amountCents={editValues.amountCents}
        originalCurrency={editValues.originalCurrency}
        onOriginalCurrencyChange={(v) =>
          setEditValues((prev) => ({ ...prev, originalCurrency: v }))
        }
        exchangeRate={editValues.exchangeRate}
        onExchangeRateChange={(v) => setEditValues((prev) => ({ ...prev, exchangeRate: v }))}
        originalAmountCents={editValues.originalAmountCents}
        onOriginalAmountCentsChange={(v) =>
          setEditValues((prev) => ({ ...prev, originalAmountCents: v }))
        }
        fxTimeout={{ enter: motion.duration.slow, exit: motion.duration.normal }}
        onCreateAlias={onCreateAlias}
        links={{
          accountId,
          transactionId: tx.id,
          initialCount: tx.linkCount,
          onCountChange: (n) => setEditValues((prev) => ({ ...prev, linkCount: n })),
        }}
        tags={
          !hiddenColumns.tags
            ? {
                accountId,
                transactionId: tx.id,
                value: editValues.tags,
                onChange: (t) => setEditValues((prev) => ({ ...prev, tags: t })),
              }
            : null
        }
      />
    </>
  );
}
