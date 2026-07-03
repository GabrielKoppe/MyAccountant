"use client";

import { useEffect, useMemo, useState } from "react";
import type { TransactionExpenseType } from "@prisma/client";
import { NumericFormat } from "react-number-format";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import FlashOnOutlinedIcon from "@mui/icons-material/FlashOnOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import NoteIcon from "@mui/icons-material/Note";
import NoteOutlinedIcon from "@mui/icons-material/NoteOutlined";
import WavesOutlinedIcon from "@mui/icons-material/WavesOutlined";
import { useSnackbar } from "notistack";

import { createTransactionAction } from "@/actions/transactions";
import { reaisToCents } from "@/lib/money";
import { m } from "@/lib/messages";
import { INVESTMENT_TYPES } from "@/lib/schemas/transaction";
import type { InvestmentType } from "@/lib/schemas/transaction";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  ResponsiblePartyOption,
  TransactionRow,
} from "./types";
import { ResponsiblePartySelect } from "./ResponsiblePartySelect";

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
  onCreated,
  onCancel,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [amountCents, setAmountCents] = useState("0");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [responsiblePartyId, setResponsiblePartyId] = useState<string | null>(
    defaultResponsiblePartyId,
  );
  const [isPending, _setIsPending] = useState(false);
  const [investmentType, setInvestmentType] = useState<InvestmentType | null>(null);
  const [expenseType, setExpenseType] = useState<TransactionExpenseType | null>(null);
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

  const subcatsForCategory = categories.find((c) => c.id === categoryId)?.subcategories ?? [];
  const sharedInputProps = { size: "small" as const, variant: "standard" as const };

  async function handleSave() {
    if (saving) return;
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
      originalCurrency,
      exchangeRate,
      originalAmountCents: originalAmountCents !== null ? BigInt(originalAmountCents) : null,
    });

    setSaving(false);

    if (!result.ok) {
      enqueueSnackbar(result.error.message, { variant: "error" });
      return;
    }

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
  }

  return (
    <>
      <TableRow
        sx={{ bgcolor: "action.hover" }}
        onKeyDown={(e) => {
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição"
            fullWidth
          />
        </TableCell>

        {!hiddenColumns.category && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={categoryId ?? ""}
              onChange={(e) => {
                setCategoryId(e.target.value || null);
                setSubcategoryId(null);
              }}
              sx={{ minWidth: 110, fontSize: 13 }}
            >
              <MenuItem value="">
                <em>Nenhuma</em>
              </MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id} sx={{ fontSize: 13 }}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        )}

        {!hiddenColumns.subcategory && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={subcategoryId ?? ""}
              onChange={(e) => setSubcategoryId(e.target.value || null)}
              sx={{ minWidth: 110, fontSize: 13 }}
              disabled={!categoryId}
            >
              <MenuItem value="">
                <em>Nenhuma</em>
              </MenuItem>
              {subcatsForCategory.map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13 }}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        )}

        {!hiddenColumns.institution && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={institutionId ?? ""}
              onChange={(e) => setInstitutionId(e.target.value || null)}
              sx={{ minWidth: 110, fontSize: 13 }}
            >
              <MenuItem value="">
                <em>Nenhuma</em>
              </MenuItem>
              {institutions.map((i) => (
                <MenuItem key={i.id} value={i.id} sx={{ fontSize: 13 }}>
                  {i.name}
                </MenuItem>
              ))}
            </Select>
          </TableCell>
        )}

        <TableCell align="right">
          <NumericFormat
            customInput={TextField}
            {...sharedInputProps}
            value={0}
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
          <TableCell sx={{ px: 0.5, width: 28 }}>
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

        <TableCell align="right" sx={{ width: 200, minWidth: 200, whiteSpace: "nowrap", pr: 1 }}>
          <Tooltip title={m.transactions.actions.addNote}>
            <IconButton
              size="small"
              sx={{ p: 0.5 }}
              onClick={() => setNotesOpen((o) => !o)}
              color={notesOpen || notes ? "primary" : "default"}
            >
              {notesOpen || notes ? (
                <NoteIcon sx={{ fontSize: 16 }} />
              ) : (
                <NoteOutlinedIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title={m.transactions.foreignCurrency.label}>
            <IconButton
              size="small"
              sx={{ p: 0.5 }}
              onClick={() => setForeignCurrencyOpen((o) => !o)}
              color={foreignCurrencyOpen ? "primary" : "default"}
            >
              <CurrencyExchangeOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Salvar (Enter)">
            <IconButton
              size="small"
              sx={{ p: 0.5 }}
              onClick={handleSave}
              disabled={saving}
              color="primary"
            >
              <CheckIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Cancelar (Esc)">
            <IconButton size="small" sx={{ p: 0.5 }} onClick={onCancel}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>

      {/* Linha de nota */}
      <TableRow sx={{ bgcolor: "action.hover" }}>
        <TableCell colSpan={99} sx={{ p: 0, border: 0 }}>
          <Collapse in={notesOpen} unmountOnExit>
            <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
              <TextField
                multiline
                minRows={2}
                maxRows={6}
                fullWidth
                size="small"
                variant="standard"
                label={m.transactions.fields.notes}
                placeholder={m.transactions.fields.notesPlaceholder}
                value={notes ?? ""}
                onChange={(e) => setNotes(e.target.value || null)}
                sx={{ "& textarea": { fontSize: 13 } }}
                autoFocus
              />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      {/* Linha de moeda estrangeira */}
      <TableRow sx={{ bgcolor: "action.hover" }}>
        <TableCell colSpan={99} sx={{ p: 0, border: 0 }}>
          <Collapse in={foreignCurrencyOpen} unmountOnExit>
            <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{
                  display: "block",
                  mb: 1,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontSize: 10,
                }}
              >
                Anotação · Moeda estrangeira
              </Typography>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                <TextField
                  size="small"
                  variant="standard"
                  label={m.transactions.foreignCurrency.currencyLabel}
                  value={originalCurrency ?? ""}
                  onChange={(e) =>
                    setOriginalCurrency(e.target.value.toUpperCase().slice(0, 3) || null)
                  }
                  inputProps={{ maxLength: 3 }}
                  sx={{ width: 110, "& input": { fontSize: 13 } }}
                />
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
                    sx={{ width: 160, "& input": { fontSize: 13 } }}
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
                      sx={{ width: 140, "& input": { fontSize: 13 } }}
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
                          "& input": { fontSize: 13, color: "text.secondary", cursor: "default" },
                        }}
                      />
                    </Tooltip>
                  </>
                )}
                <Typography
                  variant="caption"
                  color="primary"
                  sx={{ cursor: "pointer" }}
                  onClick={() => {
                    setAdvancedFxMode((v) => !v);
                    if (advancedFxMode) setOriginalAmountCents(null);
                  }}
                >
                  {advancedFxMode
                    ? "← Modo simples"
                    : m.transactions.foreignCurrency.fillOriginalAmount}
                </Typography>
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
