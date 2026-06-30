"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
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
import FlashOnOutlinedIcon from "@mui/icons-material/FlashOnOutlined";
import LabelIcon from "@mui/icons-material/Label";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import AddLinkIcon from "@mui/icons-material/AddLink";
import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { tagChipSx } from "@/components/tags/tagChipSx";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import NoteIcon from "@mui/icons-material/Note";
import NoteOutlinedIcon from "@mui/icons-material/NoteOutlined";
import WavesOutlinedIcon from "@mui/icons-material/WavesOutlined";
import { NumericFormat } from "react-number-format";
import type { TransactionExpenseType } from "@prisma/client";

import { m } from "@/lib/messages";
import { centsToReais, reaisToCents, formatCentsToBrl } from "@/lib/money";
import { INVESTMENT_TYPES } from "@/lib/schemas/transaction";
import type { InvestmentType } from "@/lib/schemas/transaction";
import { TagPopover } from "@/components/tags/TagPopover";
import { LinkTransactionDialog } from "./LinkTransactionDialog";
import {
  listLinksForTransactionAction,
  deleteTransactionLinkAction,
} from "@/actions/transaction-links";
import type { TransactionLinkItem } from "@/server/services/transaction-link-service";
import type {
  CategoryOption,
  HiddenColumns,
  InstitutionOption,
  MemberOption,
  TransactionRow as TxRow,
} from "./types";
import { formatDateBr } from "@/lib/dates";

type Props = {
  tx: TxRow;
  editValues: TxRow;
  setEditValues: React.Dispatch<React.SetStateAction<TxRow>>;
  isSelected: boolean;
  notesOpen: boolean;
  setNotesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tagsOpen: boolean;
  setTagsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  focusField: string;
  hiddenColumns: HiddenColumns;
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  members: MemberOption[];
  accountId: string;
  onSelect: (id: string, checked: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function TransactionRowEditor({
  tx,
  editValues,
  setEditValues,
  isSelected,
  notesOpen,
  setNotesOpen,
  tagsOpen,
  setTagsOpen,
  focusField,
  hiddenColumns,
  categories,
  institutions,
  members,
  accountId,
  onSelect,
  onSave,
  onCancel,
}: Props) {
  const subcatsForCategory =
    categories.find((c) => c.id === editValues.categoryId)?.subcategories ?? [];

  const sharedInputProps = { size: "small" as const, variant: "standard" as const };

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
            onChange={(e) => setEditValues((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Descrição"
            fullWidth
            autoFocus={focusField === "description"}
            sx={{ "& input": { fontSize: 13 } }}
          />
        </TableCell>

        {/* Categoria */}
        {!hiddenColumns.category && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.categoryId ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({
                  ...prev,
                  categoryId: e.target.value || null,
                  subcategoryId: null,
                }))
              }
              sx={{ minWidth: 110, fontSize: 13 }}
              autoFocus={focusField === "categoryId"}
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

        {/* Subcategoria */}
        {!hiddenColumns.subcategory && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.subcategoryId ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({ ...prev, subcategoryId: e.target.value || null }))
              }
              sx={{ minWidth: 110, fontSize: 13 }}
              disabled={!editValues.categoryId}
              autoFocus={focusField === "subcategoryId"}
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

        {/* Instituição */}
        {!hiddenColumns.institution && (
          <TableCell>
            <Select
              {...sharedInputProps}
              value={editValues.institutionId ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({ ...prev, institutionId: e.target.value || null }))
              }
              sx={{ minWidth: 110, fontSize: 13 }}
              autoFocus={focusField === "institutionId"}
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
            <Select
              {...sharedInputProps}
              value={editValues.responsibleUserId ?? ""}
              onChange={(e) =>
                setEditValues((prev) => ({ ...prev, responsibleUserId: e.target.value || null }))
              }
              sx={{ minWidth: 90, fontSize: 13 }}
              autoFocus={focusField === "responsibleUserId"}
            >
              <MenuItem value="">
                <em>Nenhum</em>
              </MenuItem>
              {members.map((mem) => (
                <MenuItem key={mem.id} value={mem.id} sx={{ fontSize: 13 }}>
                  {mem.name ?? mem.email}
                </MenuItem>
              ))}
            </Select>
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
              <LabelOutlinedIcon sx={{ fontSize: 14, color: "text.disabled", display: "block" }} />
            )}
          </TableCell>
        )}

        {/* Ações */}
        <TableCell align="right" sx={{ width: 200, minWidth: 200, whiteSpace: "nowrap", pr: 1 }}>
          <Tooltip
            title={notesOpen ? m.transactions.actions.hideNotes : m.transactions.actions.addNote}
          >
            <IconButton size="small" sx={{ p: 0.5 }} onClick={() => setNotesOpen((o) => !o)}>
              {notesOpen || (editValues.notes && editValues.notes.length > 0) ? (
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
              color={"default"}
            >
              <CurrencyExchangeOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={m.transactions.links.title}>
            <IconButton
              size="small"
              sx={{ p: 0.5 }}
              onClick={() => setLinksOpen((o) => !o)}
              color={"default"}
            >
              <LinkOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          {!hiddenColumns.tags && (
            <Tooltip title={m.transactions.tags.editTitle}>
              <IconButton size="small" sx={{ p: 0.5 }} onClick={() => setTagsOpen((o) => !o)}>
                {tagsOpen || editValues.tags.length > 0 ? (
                  <LabelIcon sx={{ fontSize: 16 }} color={"inherit"} />
                ) : (
                  <LabelOutlinedIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={m.transactions.actions.save}>
            <IconButton size="small" sx={{ p: 0.5 }} onClick={onSave} color="primary">
              <CheckIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={m.transactions.actions.cancel}>
            <IconButton size="small" sx={{ p: 0.5 }} onClick={onCancel}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>

      {/* Linha de notas colapsável */}
      <TableRow sx={{ bgcolor: "action.selected" }}>
        <TableCell colSpan={99} sx={{ p: 0, border: 0 }}>
          <Collapse in={notesOpen} unmountOnExit>
            <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
              <Typography
                variant="caption"
                color="text.primary"
                sx={{
                  display: "block",
                  mb: 1,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontSize: 10,
                  fontWeight: 500,
                }}
              >
                {m.transactions.fields.notes}
              </Typography>
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
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      {/* Linha de tags colapsável */}
      {!hiddenColumns.tags && (
        <TableRow sx={{ bgcolor: "action.selected" }}>
          <TableCell colSpan={99} sx={{ p: 0, border: 0 }}>
            <Collapse in={tagsOpen} unmountOnExit>
              <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
                <Typography
                  variant="caption"
                  color="text.primary"
                  sx={{
                    display: "block",
                    mb: 1,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    fontSize: 10,
                    fontWeight: 500,
                  }}
                >
                  Tags
                </Typography>
                <TagPopover
                  anchorEl={null}
                  onClose={() => {}}
                  accountId={accountId}
                  transactionId={tx.id}
                  currentTags={editValues.tags}
                  onTagsChange={(tags) => setEditValues((prev) => ({ ...prev, tags }))}
                  inline
                />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}

      {/* Linha de moeda estrangeira colapsável */}
      <TableRow sx={{ bgcolor: "action.selected" }}>
        <TableCell colSpan={99} sx={{ p: 0, border: 0 }}>
          <Collapse in={foreignCurrencyOpen} unmountOnExit>
            <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
              <Typography
                variant="caption"
                color="text.primary"
                sx={{
                  display: "block",
                  mb: 1,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontSize: 10,
                  fontWeight: 500,
                }}
              >
                Anotação · Moeda estrangeira
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
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
                  sx={{ width: 110, "& input": { fontSize: 13 } }}
                />
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
                    sx={{ width: 160, "& input": { fontSize: 13 } }}
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
                      sx={{ width: 140, "& input": { fontSize: 13 } }}
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
                    if (advancedFxMode) {
                      setEditValues((prev) => ({ ...prev, originalAmountCents: null }));
                    }
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
      {/* Linha de vínculos colapsável */}
      <TableRow sx={{ bgcolor: "action.selected" }}>
        <TableCell colSpan={99} sx={{ p: 0, border: 0 }}>
          <Collapse in={linksOpen} unmountOnExit>
            <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
              {/* Cabeçalho com contador e botão de adicionar */}
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.75 }}>
                <Typography
                  variant="caption"
                  color="text.primary"
                  sx={{
                    display: "block",
                    mb: 1,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    fontSize: 10,
                    fontWeight: 500,
                  }}
                >
                  {m.transactions.links.title}
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
                </Typography>
                <Tooltip title={m.transactions.links.addLink}>
                  <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setLinkDialogOpen(true)}>
                    <AddLinkIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>

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

                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            fontFamily: "var(--font-jetbrains-mono), monospace",
                            fontSize: 11,
                            flexShrink: 0,
                          }}
                        >
                          {link.linkedTransaction.amountCents
                            ? formatCentsToBrl(BigInt(link.linkedTransaction.amountCents))
                            : ""}
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
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

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
