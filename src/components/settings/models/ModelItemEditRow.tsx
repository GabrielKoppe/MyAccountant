"use client";

import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState, type KeyboardEvent } from "react";
import { NumericFormat } from "react-number-format";

import { SettingsFieldLabel } from "@/components/settings/SettingsFieldLabel";
import {
  SETTINGS_CELL_PADDING,
  SETTINGS_GRIP_WIDTH,
  SETTINGS_ROW_ICON,
} from "@/components/settings/table/settings-table-tokens";
import { SettingsGhostAddIcon } from "@/components/settings/table/SettingsGhostRow";
import {
  SettingsEditActions,
  SettingsRowField,
} from "@/components/settings/table/SettingsRowField";
import { SettingsSelect } from "@/components/settings/table/SettingsSelect";
import { ResponsiblePartySelect } from "@/components/transactions/ResponsiblePartySelect";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { centsToReais, reaisToCents } from "@/lib/money";
import { INVESTMENT_TYPES } from "@/lib/schemas/transaction";

import { DayRuleField } from "./DayRuleField";
import type { ModelItemDraft } from "./model-item-draft";
import type { ModelItemLookups } from "./ModelItemRow";

const t = m.settings.presentation.models.transactions;
const f = m.transactions.fields;

/** Altura dos campos da linha em edição — a mesma de `SETTINGS_FIELD_HEIGHT`. */
const FIELD_HEIGHT = 28;
const FIELD_SX = { height: FIELD_HEIGHT } as const;

export type ModelItemEditRowProps = {
  draft: ModelItemDraft;
  onChange: (patch: Partial<ModelItemDraft>) => void;
  onCancel: () => void;
  onCommit: () => void;
  canCommit: boolean;
  /** Linha de CRIAÇÃO (linha-fantasma aberta) — ganha o `+` no lugar da alça. */
  isNew?: boolean;
  lookups: ModelItemLookups;
  /**
   * A coluna Instituição está visível na tabela? (D5)
   * Quando NÃO está, o campo migra para "Mais campos" — ele continua existindo e
   * continua sendo aplicado na criação do mês; some a coluna, não o dado.
   */
  showInstitutionColumn: boolean;
  /** Nome para os aria-labels das ações. */
  name: string;
  disabled?: boolean;
};

/**
 * A linha de uma transação de modelo em EDIÇÃO (frame 06b, linha destacada).
 *
 * **Por que esta linha é uma grade própria e não o `LivePreviewRow`:** o preview
 * dimensiona as células para LEITURA (a data ocupa 52px, o valor 88px) e, no
 * layout de pílulas, some com a célula vazia. Campo de formulário precisa do
 * oposto — largura previsível, posição fixa, célula presente mesmo vazia. O
 * próprio frame faz essa troca: as linhas de leitura saem em pílulas e a linha
 * aberta vira uma grade de campos. Ler continua sendo "como vai ficar no mês";
 * editar é uma grade estável.
 *
 * Contrato de teclado idêntico ao da `SettingsGhostRow`: **Enter grava, Esc
 * cancela**, e os dois botões ficam visíveis (X primeiro, ✓ depois, em accent) —
 * quem não descobre o atalho tem como confirmar com o mouse.
 */
export function ModelItemEditRow({
  draft,
  onChange,
  onCancel,
  onCommit,
  canCommit,
  isNew = false,
  lookups,
  showInstitutionColumn,
  name,
  disabled = false,
}: ModelItemEditRowProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const selectedCategory = lookups.categories.find((c) => c.id === draft.categoryId);

  // Medidas do frame 06b, apertadas ao mínimo legível de cada campo. O painel de
  // detalhe fica em ~635px numa janela de 1232 com a barra lateral do app aberta,
  // e é aí que a linha precisa caber sem rolagem no caso comum (tipo SEM coluna de
  // instituição, que é o exemplo do frame). Com a instituição, a lista rola
  // horizontalmente DENTRO do próprio contêiner — a página nunca rola de lado.
  const template = [
    `${SETTINGS_GRIP_WIDTH}px`,
    "92px",
    "minmax(110px, 1fr)",
    "128px",
    "112px",
    ...(showInstitutionColumn ? ["112px"] : []),
    "96px",
    "auto",
  ].join(" ");

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Um filho já tratou a tecla: Select aberto usa Enter para escolher e Esc
    // para fechar, sempre com preventDefault.
    if (event.defaultPrevented) return;

    if (event.key === "Escape") {
      onCancel();
      return;
    }
    if (event.key !== "Enter") return;
    // Nota é multilinha — Enter ali é quebra de linha, não gravar.
    if ((event.target as HTMLElement).tagName === "TEXTAREA") return;
    if (!canCommit) return;
    event.preventDefault();
    onCommit();
  }

  return (
    <Box
      onKeyDown={handleKeyDown}
      sx={{
        bgcolor: "background.subtle",
        // Longhand: o shorthand `borderLeft` dentro de valor responsivo reseta a
        // cor para `currentColor` e a faixa sai na cor do texto (§15).
        borderLeftWidth: "2px",
        borderLeftStyle: "solid",
        borderLeftColor: "accent.primary",
        borderBottomWidth: "1px",
        borderBottomStyle: "solid",
        borderBottomColor: "border.subtle",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: template,
          alignItems: "center",
          gap: 0.5,
          px: SETTINGS_CELL_PADDING.x,
          py: SETTINGS_CELL_PADDING.y,
        }}
      >
        <Box sx={{ textAlign: "right", color: "text.disabled" }}>
          {/* O `+` marca a linha de criação sem depender do texto — mesma posição
              em que a alça de arraste fica nas linhas de leitura. */}
          {isNew && <SettingsGhostAddIcon />}
        </Box>

        <DayRuleField
          value={draft.dayRule}
          onChange={(dayRule) => onChange({ dayRule })}
          disabled={disabled}
        />

        <SettingsRowField
          label={t.columnDescription}
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
          disabled={disabled}
          autoFocus={isNew}
        />

        <SettingsSelect
          fullWidth
          value={draft.categoryId}
          // Trocar de categoria invalida a subcategoria escolhida: mantê-la
          // gravaria uma subcategoria que não pertence mais à categoria da linha.
          onChange={(event) =>
            onChange({ categoryId: String(event.target.value), subcategoryId: "" })
          }
          options={lookups.categories.map((c) => ({ value: c.id, label: c.name }))}
          emptyLabel={t.categoryPlaceholder}
          disabled={disabled}
          inputProps={{ "aria-label": t.columnCategory }}
          sx={FIELD_SX}
        />

        <ResponsiblePartySelect
          value={draft.responsiblePartyId || null}
          onChange={(partyId) => onChange({ responsiblePartyId: partyId ?? "" })}
          parties={lookups.parties}
          ariaLabel={t.columnResponsible}
          sx={{ width: "100%", minWidth: 0, ...FIELD_SX }}
        />

        {showInstitutionColumn && (
          <SettingsSelect
            fullWidth
            value={draft.institutionId}
            onChange={(event) => onChange({ institutionId: String(event.target.value) })}
            options={lookups.institutions.map((i) => ({ value: i.id, label: i.name }))}
            emptyLabel={m.common.none}
            disabled={disabled}
            inputProps={{ "aria-label": t.columnInstitution }}
            sx={FIELD_SX}
          />
        )}

        <NumericFormat
          customInput={SettingsRowField}
          label={t.columnAmount}
          value={centsToReais(BigInt(draft.amountCents))}
          onValueChange={({ floatValue }) =>
            onChange({ amountCents: reaisToCents(floatValue ?? 0).toString() })
          }
          thousandSeparator="."
          decimalSeparator=","
          decimalScale={2}
          fixedDecimalScale
          allowNegative
          disabled={disabled}
          sx={{ "& .MuiOutlinedInput-input": { textAlign: "right" } }}
        />

        <Stack direction="row" alignItems="center" justifyContent="flex-end">
          {/* Os campos que não cabem na linha (subcategoria, parcela, investimento,
              pendente, notas — e instituição quando o tipo não a mostra) ficam
              aqui, no MESMO rascunho: um único ✓ grava tudo. */}
          <IconButton
            size="small"
            aria-label={t.moreFields}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            sx={{ p: 0.25, color: moreOpen ? "accent.primary" : "text.tertiary" }}
          >
            <TuneOutlinedIcon sx={{ fontSize: SETTINGS_ROW_ICON.size }} />
          </IconButton>
          <SettingsEditActions
            onCancel={onCancel}
            onCommit={onCommit}
            canCommit={canCommit && !disabled}
            name={name}
          />
        </Stack>
      </Box>

      <Collapse in={moreOpen} unmountOnExit>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
            gap: layout.stack,
            px: SETTINGS_CELL_PADDING.x,
            pb: layout.stack,
            pt: layout.micro,
          }}
        >
          <Box>
            <SettingsFieldLabel>{f.subcategory}</SettingsFieldLabel>
            <SettingsSelect
              fullWidth
              value={draft.subcategoryId}
              onChange={(event) => onChange({ subcategoryId: String(event.target.value) })}
              options={(selectedCategory?.subcategories ?? []).map((s) => ({
                value: s.id,
                label: s.name,
              }))}
              emptyLabel={m.common.none}
              disabled={disabled || !selectedCategory}
              inputProps={{ "aria-label": f.subcategory }}
              sx={FIELD_SX}
            />
          </Box>

          {/* D5 — a coluna some, o campo não: sem este bloco, quem usa um tipo que
              não mostra instituição perderia o acesso a um dado que a criação do
              mês continua aplicando. */}
          {!showInstitutionColumn && (
            <Box>
              <SettingsFieldLabel>{f.institution}</SettingsFieldLabel>
              <SettingsSelect
                fullWidth
                value={draft.institutionId}
                onChange={(event) => onChange({ institutionId: String(event.target.value) })}
                options={lookups.institutions.map((i) => ({ value: i.id, label: i.name }))}
                emptyLabel={m.common.none}
                disabled={disabled}
                inputProps={{ "aria-label": f.institution }}
                sx={FIELD_SX}
              />
            </Box>
          )}

          <Box>
            <SettingsFieldLabel>{f.cardInstallment}</SettingsFieldLabel>
            <SettingsRowField
              label={f.cardInstallment}
              placeholder="3/12"
              value={draft.cardInstallment}
              onChange={(event) => onChange({ cardInstallment: event.target.value })}
              disabled={disabled}
            />
          </Box>

          <Box>
            <SettingsFieldLabel>{f.investmentType}</SettingsFieldLabel>
            <SettingsSelect
              fullWidth
              value={draft.investmentType}
              onChange={(event) => onChange({ investmentType: String(event.target.value) })}
              options={INVESTMENT_TYPES.map((type) => ({ value: type, label: type }))}
              emptyLabel={m.transactions.investmentTypeNone}
              disabled={disabled}
              inputProps={{ "aria-label": f.investmentType }}
              sx={FIELD_SX}
            />
          </Box>

          <Box>
            <SettingsFieldLabel>{f.isPending}</SettingsFieldLabel>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={draft.isPending}
                  onChange={(event) => onChange({ isPending: event.target.checked })}
                  disabled={disabled}
                />
              }
              label={<Typography variant="body2">{f.isPending}</Typography>}
            />
          </Box>

          <Box sx={{ gridColumn: { sm: "span 2", md: "span 3" } }}>
            <SettingsFieldLabel>{f.notes}</SettingsFieldLabel>
            <TextField
              value={draft.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              placeholder={f.notesPlaceholder}
              slotProps={{ htmlInput: { "aria-label": f.notes } }}
              multiline
              minRows={2}
              fullWidth
              size="small"
              disabled={disabled}
            />
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
