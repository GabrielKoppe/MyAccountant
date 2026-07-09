"use client";

import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import LabelIcon from "@mui/icons-material/Label";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import NoteIcon from "@mui/icons-material/Note";
import NoteOutlinedIcon from "@mui/icons-material/NoteOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { CollapseProps } from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useEffect, useMemo, useState } from "react";
import { NumericFormat } from "react-number-format";

import { TagPopover } from "@/components/tags/TagPopover";
import { layout, motion } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

import { CollapsibleSectionRow } from "./CollapsibleSectionRow";
import { RowLinksSection } from "./RowLinksSection";

type Tag = { id: string; name: string; color: string | null };

type Props = {
  /** Fundo da toolbar e das linhas — `action.selected` na edição, `action.hover` na criação. */
  bgcolor: string;

  // ── Nota ──────────────────────────────────────────────────────────
  notes: string | null;
  onNotesChange: (value: string | null) => void;
  notesAutoFocus?: boolean;
  /** Esc no campo de nota (editor cancela; criação deixa o handler da linha agir). */
  onEscape?: () => void;

  // ── Moeda estrangeira (controlado) ───────────────────────────────
  /** Valor em BRL (centavos) — usado para calcular a taxa no modo avançado. */
  amountCents: string;
  originalCurrency: string | null;
  onOriginalCurrencyChange: (value: string | null) => void;
  exchangeRate: number | null;
  onExchangeRateChange: (value: number | null) => void;
  originalAmountCents: string | null;
  onOriginalAmountCentsChange: (value: string | null) => void;
  fxTimeout?: CollapseProps["timeout"];

  // ── Capacidades só do editor (exigem transação salva) ────────────
  /** Botão "Criar apelido" à direita da toolbar. */
  onCreateAlias?: () => void;
  /** Seção de vínculos — precisa de uma transação persistida. */
  links?: {
    accountId: string;
    transactionId: string;
    initialCount: number;
    onCountChange: (count: number) => void;
  };
  /** Seção de tags — `null`/omitido quando a coluna de tags está oculta ou no create. */
  tags?: {
    accountId: string;
    transactionId: string;
    value: Tag[];
    onChange: (tags: Tag[]) => void;
  } | null;
};

const BTN_SX = { p: 1, minWidth: 32, minHeight: 32 } as const;
const ICON_SX = { fontSize: 16 } as const;
const sharedInputProps = { size: "small" as const, variant: "standard" as const };

/**
 * Gaveta completa da linha de transação — caixa-preta: possui a barra de toggles,
 * as linhas colapsáveis E todos os campos (nota, câmbio com modo avançado,
 * vínculos, tags). Compartilhada entre `TransactionRowEditor` e `NewTransactionRow`;
 * o pai passa só dados (valor + onChange) e capacidades. Vínculos/tags só no
 * editor (exigem transação salva) — a seção de vínculos vive em `RowLinksSection`,
 * montada só quando `links` está presente (o create não carrega router/actions de
 * vínculo). No create, use `key` para resetar (entrada rápida): a gaveta
 * re-inicializa os toggles a partir do conteúdo vazio.
 */
export function RowDrawer({
  bgcolor,
  notes,
  onNotesChange,
  notesAutoFocus,
  onEscape,
  amountCents,
  originalCurrency,
  onOriginalCurrencyChange,
  exchangeRate,
  onExchangeRateChange,
  originalAmountCents,
  onOriginalAmountCentsChange,
  fxTimeout,
  onCreateAlias,
  links,
  tags,
}: Props) {
  // Estado de UI da gaveta (init a partir do conteúdo presente no mount).
  const [notesOpen, setNotesOpen] = useState(() => !!notes);
  const [fxOpen, setFxOpen] = useState(() => !!originalCurrency);
  const [tagsOpen, setTagsOpen] = useState(() => (tags ? tags.value.length > 0 : false));
  const [linksOpen, setLinksOpen] = useState(() => (links ? links.initialCount > 0 : false));
  const [advancedFxMode, setAdvancedFxMode] = useState(() => !!originalAmountCents);

  const noteLabel = notesOpen ? m.transactions.actions.hideNotes : m.transactions.actions.addNote;

  // Taxa calculada automaticamente (modo avançado) → propaga para o pai.
  const calculatedExchangeRate = useMemo(() => {
    if (!advancedFxMode || !originalAmountCents) return null;
    const brl = Number(BigInt(amountCents));
    const foreign = Number(BigInt(originalAmountCents));
    if (foreign === 0) return null;
    return Math.round((brl / foreign) * 1e6) / 1e6;
  }, [advancedFxMode, amountCents, originalAmountCents]);

  useEffect(() => {
    if (calculatedExchangeRate !== null) onExchangeRateChange(calculatedExchangeRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatedExchangeRate]);

  return (
    <>
      {/* Barra de ferramentas — toggles de seção + criar apelido */}
      <TableRow>
        <TableCell colSpan={99} sx={{ py: 0.5, border: 0, bgcolor }}>
          <Stack direction="row" spacing={layout.inline} alignItems="center" sx={{ px: 2 }}>
            <Tooltip title={noteLabel}>
              <IconButton
                size="small"
                sx={BTN_SX}
                onClick={() => setNotesOpen((o) => !o)}
                aria-label={noteLabel}
                color={notesOpen ? "primary" : "default"}
              >
                {notesOpen || notes ? <NoteIcon sx={ICON_SX} /> : <NoteOutlinedIcon sx={ICON_SX} />}
              </IconButton>
            </Tooltip>

            <Tooltip title={m.transactions.foreignCurrency.label}>
              <IconButton
                size="small"
                sx={BTN_SX}
                onClick={() => setFxOpen((o) => !o)}
                aria-label={m.transactions.foreignCurrency.label}
                color={fxOpen ? "primary" : "default"}
              >
                <CurrencyExchangeOutlinedIcon sx={ICON_SX} />
              </IconButton>
            </Tooltip>

            {links && (
              <Tooltip title={m.transactions.links.title}>
                <IconButton
                  size="small"
                  sx={BTN_SX}
                  onClick={() => setLinksOpen((o) => !o)}
                  aria-label={m.transactions.links.title}
                  color={linksOpen ? "primary" : "default"}
                >
                  <LinkOutlinedIcon sx={ICON_SX} />
                </IconButton>
              </Tooltip>
            )}

            {tags && (
              <Tooltip title={m.transactions.tags.editTitle}>
                <IconButton
                  size="small"
                  sx={BTN_SX}
                  onClick={() => setTagsOpen((o) => !o)}
                  aria-label={m.transactions.tags.editTitle}
                  color={tagsOpen || tags.value.length > 0 ? "primary" : "default"}
                >
                  {tagsOpen || tags.value.length > 0 ? (
                    <LabelIcon sx={ICON_SX} color="inherit" />
                  ) : (
                    <LabelOutlinedIcon sx={ICON_SX} />
                  )}
                </IconButton>
              </Tooltip>
            )}

            {onCreateAlias && (
              <>
                <Box sx={{ flex: 1 }} />
                <Button
                  variant="text"
                  size="small"
                  color="inherit"
                  startIcon={<BookmarkAddOutlinedIcon color="inherit" sx={ICON_SX} />}
                  onClick={onCreateAlias}
                  sx={{
                    textTransform: "none",
                    fontSize: 12,
                    px: 2,
                    py: 1,
                    fontWeight: 400,
                    color: "text.secondary",
                  }}
                >
                  {m.transactions.actions.createAlias}
                </Button>
              </>
            )}
          </Stack>
        </TableCell>
      </TableRow>

      {/* Nota */}
      <CollapsibleSectionRow open={notesOpen} bgcolor={bgcolor} label={m.transactions.fields.notes}>
        <TextField
          multiline
          minRows={2}
          maxRows={6}
          fullWidth
          size="small"
          variant="standard"
          placeholder={m.transactions.fields.notesPlaceholder}
          value={notes ?? ""}
          onChange={(e) => onNotesChange(e.target.value || null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onEscape?.();
          }}
          sx={{ "& textarea": { fontSize: 13 } }}
          autoFocus={notesAutoFocus}
        />
      </CollapsibleSectionRow>

      {/* Moeda estrangeira */}
      <CollapsibleSectionRow
        open={fxOpen}
        bgcolor={bgcolor}
        label={m.transactions.foreignCurrency.label}
        timeout={fxTimeout}
      >
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-end", flexWrap: "wrap" }}>
          <TextField
            {...sharedInputProps}
            label={m.transactions.foreignCurrency.currencyLabel}
            value={originalCurrency ?? ""}
            onChange={(e) =>
              onOriginalCurrencyChange(e.target.value.toUpperCase().slice(0, 3) || null)
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
                value={exchangeRate ?? ""}
                decimalSeparator=","
                decimalScale={6}
                allowNegative={false}
                onValueChange={({ floatValue }) => onExchangeRateChange(floatValue ?? null)}
                sx={{ width: 160, "& input": { fontSize: 12 } }}
              />
            ) : (
              <>
                <NumericFormat
                  customInput={TextField}
                  {...sharedInputProps}
                  label={m.transactions.foreignCurrency.originalAmountLabel}
                  value={originalAmountCents ? Number(BigInt(originalAmountCents)) / 100 : ""}
                  decimalSeparator=","
                  decimalScale={2}
                  fixedDecimalScale
                  allowNegative={false}
                  onValueChange={({ floatValue }) => {
                    onOriginalAmountCentsChange(
                      floatValue !== undefined
                        ? BigInt(Math.round(floatValue * 100)).toString()
                        : null,
                    );
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
              if (advancedFxMode) onOriginalAmountCentsChange(null);
            }}
          >
            <Box
              component="span"
              key={String(advancedFxMode)}
              sx={{
                animation: `fxLabelIn ${motion.duration.slow}ms ${motion.easing.entrance}`,
                animationDelay: `${motion.duration.fast}ms`,
                animationFillMode: "backwards",
                "@keyframes fxLabelIn": { from: { opacity: 0 }, to: { opacity: 1 } },
              }}
            >
              {advancedFxMode
                ? "← Modo simples"
                : m.transactions.foreignCurrency.fillOriginalAmount}
            </Box>
          </Button>
        </Box>
      </CollapsibleSectionRow>

      {/* Vínculos (editor) — componente próprio, montado só quando há links */}
      {links && (
        <RowLinksSection
          open={linksOpen}
          bgcolor={bgcolor}
          accountId={links.accountId}
          transactionId={links.transactionId}
          onCountChange={links.onCountChange}
        />
      )}

      {/* Tags (editor) */}
      {tags && (
        <CollapsibleSectionRow
          open={tagsOpen}
          bgcolor={bgcolor}
          label={m.transactions.tags.editTitle}
        >
          <TagPopover
            anchorEl={null}
            onClose={() => {}}
            accountId={tags.accountId}
            transactionId={tags.transactionId}
            currentTags={tags.value}
            onTagsChange={tags.onChange}
            inline
          />
        </CollapsibleSectionRow>
      )}
    </>
  );
}
