"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

import { SettingsFieldLabel } from "@/components/settings/SettingsFieldLabel";
import { SettingsRowField } from "@/components/settings/table/SettingsRowField";
import { SettingsSelect } from "@/components/settings/table/SettingsSelect";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

import { clampInsertionIndex, type AutomationMember, type ModelDraft } from "./model-draft";
import { OrderStepper } from "./OrderStepper";

const d = m.settings.presentation.models.definition;

/**
 * Altura dos campos deste formulário.
 *
 * 33px, e não os 28px de `SETTINGS_FIELD_HEIGHT`: aqueles 28 existem para caber
 * DENTRO de uma linha de tabela de 36px. Aqui os campos são o conteúdo principal
 * de uma aba, e é a medida do frame (`.fld`).
 */
const FORM_FIELD_HEIGHT = 33;

const FIELD_SX = { height: FORM_FIELD_HEIGHT } as const;

export type ModelDefinitionSection = { id: string; name: string; isActive: boolean };

export type ModelDefinitionTabProps = {
  draft: ModelDraft;
  onChange: (patch: Partial<ModelDraft>) => void;
  tableTypes: { id: string; name: string }[];
  /** TODAS as seções, inclusive as inativas — uma seção inativa já escolhida precisa aparecer. */
  sections: ModelDefinitionSection[];
  /** Os OUTROS modelos automáticos da seção escolhida. Vazio = o campo Ordem não aparece. */
  siblings: AutomationMember[];
  disabled?: boolean;
};

/**
 * Aba 1 · Definição (Spec 69 §2.2, frame 06).
 *
 * Duas regras que não são estéticas:
 *
 * 1. **Seção de destino e Ordem só existem sob a automação.** Sem automação, a
 *    seção é escolhida no momento de inserir a tabela — um campo sempre visível
 *    mentiria sobre quando ele vale (§6, "Seção no modelo").
 * 2. **Desligar o toggle esconde, não apaga.** O rascunho guarda seção e ordem; só
 *    a renderização some. Religar devolve o que estava lá.
 *
 * O que NÃO está aqui, de propósito: instituição (nunca foi campo do modelo — DIV-6/7)
 * e o `autoTableTypeId` (deprecated, consolidado em `tableTypeId` — D7).
 */
export function ModelDefinitionTab({
  draft,
  onChange,
  tableTypes,
  sections,
  siblings,
  disabled = false,
}: ModelDefinitionTabProps) {
  const selectedSection = sections.find((s) => s.id === draft.autoSectionId);
  const sectionInactive = selectedSection !== undefined && !selectedSection.isActive;

  // Seção inativa não é oferecida na lista, mas a que JÁ está escolhida entra
  // mesmo inativa: sem ela o `Select` renderiza vazio e o usuário perde o valor
  // gravado só por abrir a tela.
  const sectionOptions = sections
    .filter((s) => s.isActive || s.id === draft.autoSectionId)
    .map((s) => ({ value: s.id, label: s.name }));

  const total = siblings.length + 1;
  const position = clampInsertionIndex(draft.orderInSection, siblings.length) + 1;

  function handleMove(delta: -1 | 1) {
    const nextIndex = Math.min(siblings.length, Math.max(0, position - 1 + delta));
    onChange({ orderInSection: nextIndex });
  }

  return (
    <Box sx={{ py: layout.stack }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: layout.stack,
          mb: layout.stack,
        }}
      >
        <Box>
          <SettingsFieldLabel>{d.nameLabel}</SettingsFieldLabel>
          <SettingsRowField
            label={d.nameLabel}
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
            disabled={disabled}
            // Altura pela PROP, nunca por `sx`: um `sx` com `& .MuiOutlinedInput-root`
            // substitui o objeto aninhado do componente e leva a tipografia embora.
            fieldHeight={FORM_FIELD_HEIGHT}
          />
        </Box>

        <Box>
          <SettingsFieldLabel>{d.tableTypeLabel}</SettingsFieldLabel>
          <SettingsSelect
            fullWidth
            value={draft.tableTypeId}
            onChange={(event) => onChange({ tableTypeId: event.target.value })}
            options={tableTypes.map((type) => ({ value: type.id, label: type.name }))}
            emptyLabel={m.common.none}
            disabled={disabled}
            inputProps={{ "aria-label": d.tableTypeLabel }}
            sx={FIELD_SX}
          />
          <FieldHint>{tableTypes.length === 0 ? d.tableTypeEmpty : d.tableTypeHint}</FieldHint>
        </Box>
      </Box>

      <SettingsFieldLabel>{d.automationTitle}</SettingsFieldLabel>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={draft.autoApply}
            onChange={(event) => onChange({ autoApply: event.target.checked })}
            disabled={disabled}
          />
        }
        label={<Typography variant="body2">{d.autoApplyLabel}</Typography>}
      />

      {draft.autoApply && (
        <Box
          sx={{
            mt: layout.inline,
            ml: 0.5,
            pl: 1.75,
            // Longhand obrigatório: o shorthand `borderLeft` dentro de qualquer
            // valor responsivo reseta `border-left-color` para `currentColor` e a
            // barra sai na cor do texto (§15).
            borderLeftWidth: "2px",
            borderLeftStyle: "solid",
            borderLeftColor: "accent.primary",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: layout.stack,
            }}
          >
            <Box>
              <SettingsFieldLabel>{d.sectionLabel}</SettingsFieldLabel>
              <SettingsSelect
                fullWidth
                value={draft.autoSectionId}
                onChange={(event) => onChange({ autoSectionId: event.target.value })}
                options={sectionOptions}
                emptyLabel={m.common.none}
                disabled={disabled}
                error={draft.autoSectionId === ""}
                inputProps={{ "aria-label": d.sectionLabel }}
                sx={FIELD_SX}
              />
              {draft.autoSectionId === "" ? (
                <Typography
                  variant="caption"
                  sx={{ display: "block", mt: layout.micro, color: "error.main" }}
                >
                  {d.sectionRequired}
                </Typography>
              ) : (
                <FieldHint>{d.sectionHint}</FieldHint>
              )}
            </Box>

            {/* A ordem só faz sentido quando há OUTRO modelo automático disputando a
                mesma seção — é o que o frame diz no hint ("Só aparece porque…"). */}
            {siblings.length > 0 && (
              <Box>
                <SettingsFieldLabel>{d.orderLabel}</SettingsFieldLabel>
                <OrderStepper
                  position={position}
                  total={total}
                  onMove={handleMove}
                  disabled={disabled}
                />
                <FieldHint>{d.orderHint(selectedSection?.name ?? "")}</FieldHint>
              </Box>
            )}
          </Box>

          {sectionInactive && (
            <Stack
              direction="row"
              spacing={layout.inline}
              alignItems="flex-start"
              sx={{
                mt: layout.stack,
                p: layout.stack,
                borderRadius: "8px",
                border: 1,
                borderColor: "warning.main",
                bgcolor: "warning.light",
              }}
            >
              <InfoOutlinedIcon fontSize="small" sx={{ color: "warning.main", mt: "2px" }} />
              <Typography variant="body2" color="text.secondary">
                {d.sectionInactive}
              </Typography>
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}

/** Hint de campo (`.fhint` no frame): terciário, nunca `text.disabled` (§15). */
function FieldHint({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{ display: "block", mt: layout.micro, color: "text.tertiary" }}
    >
      {children}
    </Typography>
  );
}
