"use client";

import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import FlashOnOutlinedIcon from "@mui/icons-material/FlashOnOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import WavesOutlinedIcon from "@mui/icons-material/WavesOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
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
import { useSnackbar } from "notistack";
import { useEffect, useMemo, useRef, useState } from "react";
import { NumericFormat } from "react-number-format";

import { createTransactionAction } from "@/actions/transactions";
import { computeSuggestion } from "@/lib/aliases/apply";
import { motion } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { centsToReais, reaisToCents } from "@/lib/money";
import {
  INVESTMENT_TYPES,
  TransactionExpenseType,
  TransactionPaymentMethod,
} from "@/lib/schemas/transaction";
import type { InvestmentType } from "@/lib/schemas/transaction";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

import { SuggestionPopover } from "./aliases/SuggestionPopover";
import { useSuggestions } from "./aliases/useSuggestions";
import { CollapsibleSectionRow } from "./CollapsibleSectionRow";
import { CreatableEntitySelect } from "./CreatableEntitySelect";
import { useOptions } from "./OptionsContext";
import { ResponsiblePartySelect } from "./ResponsiblePartySelect";
import { RowDrawerToolbar } from "./RowDrawerToolbar";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  ResponsiblePartyOption,
  TransactionRow,
} from "./types";

type Props = {
  tableId: string;
  monthId: string;
  accountId: string;
  currentUserId: string;
  hiddenColumns: HiddenColumns;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  parties: ResponsiblePartyOption[];
  defaultResponsiblePartyId: string | null;
  aliases: SerializedTransactionAlias[];
  onCreated: (tx: TransactionRow) => void;
  onCancel: () => void;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewTransactionRow({
  tableId,
  monthId,
  accountId,
  currentUserId,
  hiddenColumns,
  categories,
  institutions,
  parties,
  defaultResponsiblePartyId,
  aliases,
  onCreated,
  onCancel,
}: Props) {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { onCreateCategory, onCreateSubcategory, onCreateInstitution, canManageOptions } =
    useOptions();
  const [saving, setSaving] = useState(false);
  // Foco reposicionado na descrição após cada salvamento (fluxo de entrada rápida).
  const descriptionRef = useRef<HTMLInputElement>(null);
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [amountCents, setAmountCents] = useState("0");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [responsiblePartyId, setResponsiblePartyId] = useState<string | null>(
    defaultResponsiblePartyId,
  );
  const [isPending, setIsPending] = useState(false);
  const [investmentType, setInvestmentType] = useState<InvestmentType | null>(null);
  // Default "Evento único" pré-selecionado para reduzir fricção no lançamento manual (Spec 41).
  const [expenseType, setExpenseType] = useState<TransactionExpenseType | null>(
    TransactionExpenseType.one_time,
  );
  const [paymentMethod, setPaymentMethod] = useState<TransactionPaymentMethod | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [originalCurrency, setOriginalCurrency] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [originalAmountCents, setOriginalAmountCents] = useState<string | null>(null);
  const [foreignCurrencyOpen, setForeignCurrencyOpen] = useState(false);
  const [advancedFxMode, setAdvancedFxMode] = useState(false);

  const calculatedExchangeRate = useMemo(() => {
    if (!advancedFxMode || !originalAmountCents) return null;
    const brl = Number(BigInt(amountCents));
    const foreign = Number(BigInt(originalAmountCents));
    if (foreign === 0) return null;
    return Math.round((brl / foreign) * 1e6) / 1e6;
  }, [advancedFxMode, amountCents, originalAmountCents]);

  useEffect(() => {
    if (calculatedExchangeRate !== null) setExchangeRate(calculatedExchangeRate);
  }, [calculatedExchangeRate]);

  // Sugestão manual (Fase 4) — apelido. Linha nova sempre habilitada (não há
  // "mount com descrição preenchida" a evitar, ao contrário do editor).
  const [suggestionAnchorEl, setSuggestionAnchorEl] = useState<HTMLElement | null>(null);
  const matchedAlias = useSuggestions(description, BigInt(amountCents), institutionId, aliases, true);
  const suggestion = useMemo(
    () =>
      matchedAlias
        ? computeSuggestion(
            matchedAlias,
            {
              description,
              notes,
              amountCents,
              categoryId,
              subcategoryId,
              institutionId,
              responsiblePartyId,
              expenseType,
              paymentMethod,
              isPending,
            },
            { categories, institutions, parties },
          )
        : null,
    [
      matchedAlias,
      description,
      notes,
      amountCents,
      categoryId,
      subcategoryId,
      institutionId,
      responsiblePartyId,
      expenseType,
      paymentMethod,
      isPending,
      categories,
      institutions,
      parties,
    ],
  );
  // Ícone acende em qualquer match (mesmo um apelido que não produza nenhuma
  // mudança aplicável aqui — ex.: apelido só-de-tags); o popover trata o caso de
  // 0 mudanças com uma mensagem + botão desabilitado.
  const hasSuggestion = matchedAlias !== null;

  function handleApplySuggestion() {
    if (!suggestion || suggestion.changes.length === 0) return;
    const { patch, changes } = suggestion;
    const snapshot = {
      description,
      notes,
      amountCents,
      categoryId,
      subcategoryId,
      institutionId,
      responsiblePartyId,
      expenseType,
      paymentMethod,
      isPending,
    };

    if (patch.description !== undefined) setDescription(patch.description ?? "");
    if (patch.notes !== undefined) setNotes(patch.notes ?? null);
    if (patch.amountCents !== undefined) setAmountCents(patch.amountCents);
    if (patch.categoryId !== undefined) setCategoryId(patch.categoryId);
    if (patch.subcategoryId !== undefined) setSubcategoryId(patch.subcategoryId);
    if (patch.institutionId !== undefined) setInstitutionId(patch.institutionId);
    if (patch.responsiblePartyId !== undefined) setResponsiblePartyId(patch.responsiblePartyId);
    if (patch.expenseType !== undefined) setExpenseType(patch.expenseType);
    if (patch.paymentMethod !== undefined) setPaymentMethod(patch.paymentMethod);
    if (patch.isPending !== undefined) setIsPending(patch.isPending);

    setSuggestionAnchorEl(null);

    enqueueSnackbar(m.transactions.aliasSuggestion.applied(matchedAlias?.trigger ?? "", changes.length), {
      variant: "info",
      action: (snackKey) => (
        <Button
          size="small"
          color="inherit"
          onClick={() => {
            setDescription(snapshot.description);
            setNotes(snapshot.notes);
            setAmountCents(snapshot.amountCents);
            setCategoryId(snapshot.categoryId);
            setSubcategoryId(snapshot.subcategoryId);
            setInstitutionId(snapshot.institutionId);
            setResponsiblePartyId(snapshot.responsiblePartyId);
            setExpenseType(snapshot.expenseType);
            setPaymentMethod(snapshot.paymentMethod);
            setIsPending(snapshot.isPending);
            closeSnackbar(snackKey);
          }}
        >
          {m.transactions.aliasSuggestion.undo}
        </Button>
      ),
    });
  }

  const subcatsForCategory = categories.find((c) => c.id === categoryId)?.subcategories ?? [];
  const sharedInputProps = { size: "small" as const, variant: "standard" as const };

  async function handleSave() {
    if (saving) return;
    // A linha permanece aberta após salvar (entrada rápida): um Enter perdido ou
    // duplo na linha ainda intocada não deve criar um lançamento fantasma
    // (sem descrição e com valor zero). Ignora o save nesse estado pristino.
    if (!description.trim() && amountCents === "0") return;
    setSaving(true);

    const result = await createTransactionAction(accountId, {
      tableId,
      occurredOn: new Date(occurredOn),
      amountCents: BigInt(amountCents),
      description: description || null,
      notes: notes,
      isPending,
      isFavorite: false,
      categoryId,
      subcategoryId,
      institutionId,
      responsiblePartyId,
      investmentType,
      expenseType,
      paymentMethod,
      originalCurrency,
      exchangeRate,
      originalAmountCents: originalAmountCents !== null ? BigInt(originalAmountCents) : null,
    });

    setSaving(false);

    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }

    // A linha continua aberta, então o toast é o sinal de que o lançamento foi
    // salvo. Curto para não empilhar durante lançamentos em sequência.
    enqueueSnackbar(m.transactions.created, { variant: "success", autoHideDuration: 1500 });

    const now = new Date().toISOString();
    onCreated({
      id: result.data.transactionId,
      monthId,
      occurredOn,
      amountCents,
      description: description || null,
      notes: notes,
      isPending,
      isFavorite: false,
      categoryId,
      subcategoryId,
      institutionId,
      institutionText: null,
      responsiblePartyId,
      cardInstallment: null,
      investmentType,
      expenseType: expenseType ?? null,
      paymentMethod: paymentMethod ?? null,
      source: "manual" as const,
      installmentGroupId: null,
      installmentNumber: null,
      installmentGroupCount: null,
      originalAmountCents: originalAmountCents,
      originalCurrency: originalCurrency,
      exchangeRate: exchangeRate,
      tags: [],
      linkCount: 0,
      createdById: currentUserId,
      createdAt: now,
      updatedById: null,
      updatedAt: now,
    });

    // Entrada rápida: a linha permanece aberta. Limpa os campos editáveis,
    // preserva a data e volta o tipo ao default (one_time); a descrição recebe
    // o foco para o próximo lançamento. ESC/cancelar continua fechando a linha.
    setDescription("");
    setAmountCents("0");
    setCategoryId(null);
    setSubcategoryId(null);
    setInstitutionId(null);
    setResponsiblePartyId(defaultResponsiblePartyId);
    setIsPending(false);
    setInvestmentType(null);
    setExpenseType(TransactionExpenseType.one_time);
    setPaymentMethod(null);
    setNotes(null);
    setNotesOpen(false);
    setOriginalCurrency(null);
    setExchangeRate(null);
    setOriginalAmountCents(null);
    setForeignCurrencyOpen(false);
    setAdvancedFxMode(false);
    descriptionRef.current?.focus();
  }

  return (
    <>
      <TableRow
        sx={{ bgcolor: "action.hover" }}
        onKeyDown={(e) => {
          if (suggestionAnchorEl) return; // guard: popover de sugestão trata seu próprio Enter/Escape
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onCancel();
        }}
      >
        <TableCell padding="checkbox">
          <Checkbox size="small" disabled />
        </TableCell>

        <TableCell>
          <TextField
            {...sharedInputProps}
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            inputProps={{ style: { fontSize: 13 } }}
            sx={{ width: 120 }}
            autoFocus
          />
        </TableCell>

        <TableCell>
          <TextField
            {...sharedInputProps}
            inputRef={descriptionRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição"
            fullWidth
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {/* Slot de largura fixa: só a opacidade anima (Fade), a largura do
                      adornment nunca muda — evita "respiro" no campo ao digitar. */}
                  <Box sx={{ width: 24, display: "flex", justifyContent: "center" }}>
                    <Fade in={hasSuggestion} unmountOnExit timeout={motion.duration.normal}>
                      <Tooltip title={m.transactions.aliasSuggestion.header}>
                        <IconButton
                          size="small"
                          onClick={(e) => setSuggestionAnchorEl(e.currentTarget)}
                          aria-label={m.transactions.aliasSuggestion.header}
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
          {suggestion && (
            <SuggestionPopover
              anchorEl={suggestionAnchorEl}
              changes={suggestion.changes}
              onApply={handleApplySuggestion}
              onClose={() => setSuggestionAnchorEl(null)}
            />
          )}
        </TableCell>

        {!hiddenColumns.category && (
          <TableCell>
            <CreatableEntitySelect
              value={categoryId}
              onChange={(id) => {
                setCategoryId(id);
                setSubcategoryId(null);
              }}
              options={categories}
              onCreate={onCreateCategory}
              canCreate={canManageOptions}
              variant="standard"
              ariaLabel={m.transactions.fields.category}
              placeholderNone={m.common.none}
              sx={{ minWidth: 110 }}
            />
          </TableCell>
        )}

        {!hiddenColumns.subcategory && (
          <TableCell>
            <CreatableEntitySelect
              value={subcategoryId}
              onChange={setSubcategoryId}
              options={subcatsForCategory}
              onCreate={(name) => {
                if (!categoryId) return Promise.resolve(null);
                return onCreateSubcategory(categoryId, name);
              }}
              canCreate={canManageOptions && !!categoryId}
              disabled={!categoryId}
              variant="standard"
              ariaLabel={m.transactions.fields.subcategory}
              placeholderNone={m.common.none}
              sx={{ minWidth: 110 }}
            />
          </TableCell>
        )}

        {!hiddenColumns.institution && (
          <TableCell>
            <CreatableEntitySelect
              value={institutionId}
              onChange={setInstitutionId}
              options={institutions}
              onCreate={onCreateInstitution}
              canCreate={canManageOptions}
              variant="standard"
              ariaLabel={m.transactions.fields.institution}
              placeholderNone={m.common.none}
              sx={{ minWidth: 110 }}
            />
          </TableCell>
        )}

        {!hiddenColumns.paymentMethod && (
          <TableCell>
            <Select
              {...sharedInputProps}
              displayEmpty
              value={paymentMethod ?? ""}
              onChange={(e) =>
                setPaymentMethod((e.target.value || null) as TransactionPaymentMethod | null)
              }
              aria-label={m.transactions.paymentMethodLabel}
              sx={{ minWidth: 120, fontSize: 13 }}
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

        <TableCell align="right">
          <NumericFormat
            customInput={TextField}
            {...sharedInputProps}
            value={centsToReais(BigInt(amountCents))}
            thousandSeparator="."
            decimalSeparator=","
            decimalScale={2}
            fixedDecimalScale
            allowNegative
            onValueChange={({ floatValue }) =>
              setAmountCents(reaisToCents(floatValue ?? 0).toString())
            }
            inputProps={{ style: { textAlign: "right", width: 100, fontSize: 13 } }}
          />
        </TableCell>

        {!hiddenColumns.responsibleUser && (
          <TableCell>
            <ResponsiblePartySelect
              value={responsiblePartyId}
              onChange={setResponsiblePartyId}
              parties={parties}
              variant="standard"
              sx={{ minWidth: 90 }}
            />
          </TableCell>
        )}

        {!hiddenColumns.investmentType && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={investmentType ?? ""}
              onChange={(e) => setInvestmentType((e.target.value || null) as InvestmentType | null)}
              sx={{ minWidth: 120, fontSize: 13 }}
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

        {/* Parcela — vazio na criação (parcelamentos são criados via dialog na Fase 8) */}
        {!hiddenColumns.cardInstallment && <TableCell />}

        {/* Tipo de gasto (expenseType) */}
        {!hiddenColumns.expenseType && (
          <TableCell sx={{ px: 0.5, width: 24 }}>
            <Tooltip title={m.transactions.expenseTypeLabel}>
              <ToggleButtonGroup
                value={expenseType}
                exclusive
                size="small"
                onChange={(_e, val) =>
                  setExpenseType((val as TransactionExpenseType | null) ?? null)
                }
                sx={{ "& .MuiToggleButton-root": { px: 0.75, py: 0.25, fontSize: 12 } }}
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

        {/* Placeholder para coluna de tags — a criação de tags ocorre após salvar */}
        {!hiddenColumns.tags && <TableCell sx={{ px: 1, minWidth: 60 }} />}

        <TableCell align="right" sx={{ width: 160, minWidth: 160, whiteSpace: "nowrap", pr: 1 }}>
          <Tooltip title={m.transactions.actions.save}>
            <IconButton
              size="small"
              sx={{ p: 1, minWidth: 32, minHeight: 32 }}
              onClick={handleSave}
              aria-label={m.transactions.actions.save}
              disabled={saving}
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

      {/* Barra de ferramentas da gaveta — toggles de nota + câmbio
          (componente compartilhado com TransactionRowEditor). */}
      <RowDrawerToolbar
        bgcolor="action.hover"
        note={{ open: notesOpen, onToggle: () => setNotesOpen((o) => !o), hasContent: !!notes }}
        fx={{ open: foreignCurrencyOpen, onToggle: () => setForeignCurrencyOpen((o) => !o) }}
      />

      {/* Seções colapsáveis da gaveta — CollapsibleSectionRow compartilhado com TransactionRowEditor */}
      <CollapsibleSectionRow
        open={notesOpen}
        bgcolor="action.hover"
        label={m.transactions.fields.notes}
      >
        <TextField
          multiline
          minRows={2}
          maxRows={6}
          fullWidth
          size="small"
          variant="standard"
          placeholder={m.transactions.fields.notesPlaceholder}
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value || null)}
          sx={{ "& textarea": { fontSize: 13 } }}
          autoFocus
        />
      </CollapsibleSectionRow>

      <CollapsibleSectionRow
        open={foreignCurrencyOpen}
        bgcolor="action.hover"
        label={m.transactions.foreignCurrency.label}
      >
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-end", flexWrap: "wrap" }}>
          <TextField
            size="small"
            variant="standard"
            label={m.transactions.foreignCurrency.currencyLabel}
            value={originalCurrency ?? ""}
            onChange={(e) => setOriginalCurrency(e.target.value.toUpperCase().slice(0, 3) || null)}
            inputProps={{ maxLength: 3 }}
            sx={{ width: 140, "& input": { fontSize: 12 } }}
          />
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
                size="small"
                variant="standard"
                label={m.transactions.foreignCurrency.exchangeRateLabel}
                value={exchangeRate ?? ""}
                decimalSeparator=","
                decimalScale={6}
                allowNegative={false}
                onValueChange={({ floatValue }) => setExchangeRate(floatValue ?? null)}
                sx={{ width: 160, "& input": { fontSize: 12 } }}
              />
            ) : (
              <>
                <NumericFormat
                  customInput={TextField}
                  size="small"
                  variant="standard"
                  label={m.transactions.foreignCurrency.originalAmountLabel}
                  value={originalAmountCents ? Number(BigInt(originalAmountCents)) / 100 : ""}
                  decimalSeparator=","
                  decimalScale={2}
                  fixedDecimalScale
                  allowNegative={false}
                  onValueChange={({ floatValue }) => {
                    setOriginalAmountCents(
                      floatValue !== undefined
                        ? BigInt(Math.round(floatValue * 100)).toString()
                        : null,
                    );
                  }}
                  sx={{ width: 140, "& input": { fontSize: 12 } }}
                />
                <Tooltip title={m.transactions.foreignCurrency.calculatedRate} placement="top">
                  <TextField
                    size="small"
                    variant="standard"
                    label={m.transactions.foreignCurrency.exchangeRateLabel}
                    value={
                      calculatedExchangeRate !== null
                        ? calculatedExchangeRate.toFixed(4)
                        : (exchangeRate?.toFixed(4) ?? "")
                    }
                    InputProps={{ readOnly: true }}
                    sx={{
                      width: 160,
                      "& input": { fontSize: 12, color: "text.secondary", cursor: "default" },
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
              if (advancedFxMode) setOriginalAmountCents(null);
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
      </CollapsibleSectionRow>
    </>
  );
}
