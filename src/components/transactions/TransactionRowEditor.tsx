"use client";

import AddLinkIcon from "@mui/icons-material/AddLink";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import FlashOnOutlinedIcon from "@mui/icons-material/FlashOnOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
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
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import { useEffect, useMemo, useState, useTransition } from "react";
import { NumericFormat } from "react-number-format";

import {
  listLinksForTransactionAction,
  deleteTransactionLinkAction,
} from "@/actions/transaction-links";
import { tagChipSx } from "@/components/tags/tagChipSx";
import { TagPopover } from "@/components/tags/TagPopover";
import { computeAliasApplication } from "@/lib/aliases/apply";
import { formatDateBr } from "@/lib/dates";
import { motion } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { centsToReais, reaisToCents, formatCentsToBrl } from "@/lib/money";
import { INVESTMENT_TYPES, TransactionPaymentMethod } from "@/lib/schemas/transaction";
import type { InvestmentType } from "@/lib/schemas/transaction";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";
import type { TransactionLinkItem } from "@/server/services/transaction-link-service";

import { AliasSuggestionPopover } from "./aliases/AliasSuggestionPopover";
import { useAliasMatch } from "./aliases/useAliasMatch";
import { CreatableEntitySelect } from "./CreatableEntitySelect";
import { LinkTransactionDialog } from "./LinkTransactionDialog";
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

  const [notesOpen, setNotesOpen] = useState<boolean>(() => !!editValues.notes);
  const [tagsOpen, setTagsOpen] = useState<boolean>(() => editValues.tags.length > 0);

  const [foreignCurrencyOpen, setForeignCurrencyOpen] = useState(
    () => !!editValues.originalCurrency,
  );
  const [advancedFxMode, setAdvancedFxMode] = useState(() => !!editValues.originalAmountCents);

  const [linksOpen, setLinksOpen] = useState(() => tx.linkCount > 0);
  const [links, setLinks] = useState<TransactionLinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [, startLinkTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!linksOpen) return;
    setLoadingLinks(true);
    startLinkTransition(async () => {
      const res = await listLinksForTransactionAction(accountId, { transactionId: tx.id });
      setLoadingLinks(false);
      if (res.ok) setLinks(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linksOpen]);

  const calculatedExchangeRate = useMemo(() => {
    if (!advancedFxMode || !editValues.originalAmountCents) return null;
    const brl = Number(BigInt(editValues.amountCents));
    const foreign = Number(BigInt(editValues.originalAmountCents));
    if (foreign === 0) return null;
    return Math.round((brl / foreign) * 1e6) / 1e6;
  }, [advancedFxMode, editValues.amountCents, editValues.originalAmountCents]);

  useEffect(() => {
    if (calculatedExchangeRate !== null) {
      setEditValues((prev) => ({ ...prev, exchangeRate: calculatedExchangeRate }));
    }
  }, [calculatedExchangeRate, setEditValues]);

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

        {/* Tags — célula com chips atuais, clique abre colapsável */}
        {!hiddenColumns.tags && (
          <TableCell
            sx={{ cursor: "pointer", maxWidth: 160, minWidth: 60, px: 1 }}
            onClick={() => setTagsOpen((o) => !o)}
          >
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

      {/* Gaveta da linha — toggles de seção + linhas colapsáveis (componente
          compartilhado com NewTransactionRow). */}
      <RowDrawer
        bgcolor="action.selected"
        note={{
          open: notesOpen,
          onToggle: () => setNotesOpen((o) => !o),
          hasContent: !!editValues.notes,
          content: (
            <TextField
              multiline
              minRows={2}
              maxRows={6}
              fullWidth
              size="small"
              variant="standard"
              // label={m.transactions.fields.notes}
              placeholder={m.transactions.fields.notesPlaceholder}
              value={editValues.notes ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({ ...prev, notes: e.target.value || null }))
              }
              onKeyDown={(e) => {
                if (e.key === "Escape") onCancel();
              }}
              sx={{ "& textarea": { fontSize: 13 } }}
              autoFocus={focusField === "notes"}
            />
          ),
        }}
        fx={{
          open: foreignCurrencyOpen,
          onToggle: () => setForeignCurrencyOpen((o) => !o),
          timeout: { enter: motion.duration.slow, exit: motion.duration.normal },
          content: (
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-end", flexWrap: "wrap" }}>
              <TextField
                {...sharedInputProps}
                label={m.transactions.foreignCurrency.currencyLabel}
                value={editValues.originalCurrency ?? ""}
                onChange={(e) =>
                  setEditValues((prev) => ({
                    ...prev,
                    originalCurrency: e.target.value.toUpperCase().slice(0, 3) || null,
                  }))
                }
                inputProps={{ maxLength: 3 }}
                sx={{ width: 140, "& input": { fontSize: 12 } }}
              />

              {/* Slide direcional: avançado entra da direita, simples da esquerda */}
              <Box
                key={String(advancedFxMode)}
                sx={{
                  display: "flex",
                  gap: 2,
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                  animation: `${advancedFxMode ? "fxSlideRight" : "fxSlideLeft"} ${motion.duration.slow}ms ${motion.easing.entrance}`,
                  "@keyframes fxSlideRight": {
                    from: { opacity: 0, transform: "translateX(10px)" },
                    to: { opacity: 1, transform: "translateX(0)" },
                  },
                  "@keyframes fxSlideLeft": {
                    from: { opacity: 0, transform: "translateX(-10px)" },
                    to: { opacity: 1, transform: "translateX(0)" },
                  },
                }}
              >
                {!advancedFxMode ? (
                  <NumericFormat
                    customInput={TextField}
                    {...sharedInputProps}
                    label={m.transactions.foreignCurrency.exchangeRateLabel}
                    value={editValues.exchangeRate ?? ""}
                    decimalSeparator=","
                    decimalScale={6}
                    allowNegative={false}
                    onValueChange={({ floatValue }) =>
                      setEditValues((prev) => ({
                        ...prev,
                        exchangeRate: floatValue ?? null,
                      }))
                    }
                    sx={{ width: 160, "& input": { fontSize: 12 } }}
                  />
                ) : (
                  <>
                    <NumericFormat
                      customInput={TextField}
                      {...sharedInputProps}
                      label={m.transactions.foreignCurrency.originalAmountLabel}
                      value={
                        editValues.originalAmountCents
                          ? Number(BigInt(editValues.originalAmountCents)) / 100
                          : ""
                      }
                      decimalSeparator=","
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={false}
                      onValueChange={({ floatValue }) => {
                        const cents =
                          floatValue !== undefined
                            ? BigInt(Math.round(floatValue * 100)).toString()
                            : null;
                        setEditValues((prev) => ({ ...prev, originalAmountCents: cents }));
                      }}
                      sx={{ width: 140, "& input": { fontSize: 12 } }}
                    />
                    <Tooltip title={m.transactions.foreignCurrency.calculatedRate} placement="top">
                      <TextField
                        {...sharedInputProps}
                        label={m.transactions.foreignCurrency.exchangeRateLabel}
                        value={
                          calculatedExchangeRate !== null
                            ? calculatedExchangeRate.toFixed(4)
                            : (editValues.exchangeRate?.toFixed(4) ?? "")
                        }
                        InputProps={{ readOnly: true }}
                        sx={{
                          width: 160,
                          "& input": {
                            fontSize: 12,
                            color: "text.secondary",
                            cursor: "default",
                          },
                        }}
                      />
                    </Tooltip>
                  </>
                )}
              </Box>

              <Button
                size="small"
                variant="text"
                color="inherit"
                sx={{
                  textTransform: "none",
                  fontSize: 12,
                  px: 2,
                  py: 1,
                  fontWeight: 400,
                  minWidth: 160,
                }}
                onClick={() => {
                  setAdvancedFxMode((v) => !v);
                  if (advancedFxMode) {
                    setEditValues((prev) => ({ ...prev, originalAmountCents: null }));
                  }
                }}
              >
                <Box
                  component="span"
                  key={String(advancedFxMode)}
                  sx={{
                    animation: `fxLabelIn ${motion.duration.slow}ms ${motion.easing.entrance}`,
                    animationDelay: `${motion.duration.fast}ms`,
                    animationFillMode: "backwards",
                    "@keyframes fxLabelIn": {
                      from: { opacity: 0 },
                      to: { opacity: 1 },
                    },
                  }}
                >
                  {advancedFxMode
                    ? "← Modo simples"
                    : m.transactions.foreignCurrency.fillOriginalAmount}
                </Box>
              </Button>
            </Box>
          ),
        }}
        links={{
          open: linksOpen,
          onToggle: () => setLinksOpen((o) => !o),
          action: (
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
                <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setLinkDialogOpen(true)}>
                  <AddLinkIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          ),
          content: (
            <>
              {/* Lista de vínculos em linha */}
              {loadingLinks ? (
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
                      <Box
                        sx={{ display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0 }}
                      >
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
                                setLinks((prev) => prev.filter((l) => l.id !== link.id));
                                setEditValues((prev) => ({
                                  ...prev,
                                  linkCount: Math.max(0, prev.linkCount - 1),
                                }));
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
            </>
          ),
        }}
        tags={
          !hiddenColumns.tags
            ? {
                open: tagsOpen,
                onToggle: () => setTagsOpen((o) => !o),
                hasContent: editValues.tags.length > 0,
                content: (
                  <TagPopover
                    anchorEl={null}
                    onClose={() => {}}
                    accountId={accountId}
                    transactionId={tx.id}
                    currentTags={editValues.tags}
                    onTagsChange={(tags) => setEditValues((prev) => ({ ...prev, tags }))}
                    inline
                  />
                ),
              }
            : null
        }
        onCreateAlias={onCreateAlias}
      />

      <LinkTransactionDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        accountId={accountId}
        transactionId={tx.id}
        onLinked={() => {
          startLinkTransition(async () => {
            const res = await listLinksForTransactionAction(accountId, { transactionId: tx.id });
            if (res.ok) {
              setLinks(res.data);
              setEditValues((prev) => ({ ...prev, linkCount: res.data.length }));
            }
          });
        }}
      />
    </>
  );
}
