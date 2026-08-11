"use client";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { SETTINGS_GUTTER } from "@/components/settings/settings-layout";
import { layout, typography } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { SECTION_COUNT_TYPES } from "@/lib/schemas/settings";

import { SectionKindChip } from "./SectionKindChip";

/**
 * Faixa "Tipos" da página de Seções (Spec 68 §2.1 item 3 / §4).
 *
 * Vai no slot `subheader` do `SettingsPageShell` — NUNCA no `toolbar`: o
 * toolbar só aparece acima de 12 itens (D6 da Spec 67), e uma conta com 6
 * seções (o caso comum) esconderia a legenda se ela dependesse desse gate.
 * Por isso este componente não recebe `itemCount` nenhum — ele é sempre
 * renderizado por inteiro, independente de quantas seções existem.
 *
 * Renderiza sempre os QUATRO tipos (D1 da Spec 68): o frame v2 desenha só três
 * pílulas nesta faixa ("Saída"/"Entrada"/"Neutra"), mas o schema real também
 * tem `ignore` — omiti-lo aqui deixaria "Ignorada" sem nenhuma explicação na
 * tela, mesmo aparecendo como badge nas linhas.
 */
export function SectionKindLegend() {
  const t = m.settings.structure.sections;

  return (
    <Stack
      direction="row"
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
      sx={{
        gap: layout.stack,
        px: SETTINGS_GUTTER,
        py: layout.inline,
        bgcolor: "background.surface",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Typography
        variant="caption"
        sx={{
          textTransform: "uppercase",
          letterSpacing: typography.letterSpacing.wide,
          color: "text.tertiary",
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {t.legendLabel}
      </Typography>

      {SECTION_COUNT_TYPES.map((countType) => (
        <Stack key={countType} direction="row" alignItems="center" spacing={layout.micro}>
          <SectionKindChip countType={countType} />
          <Typography variant="caption" sx={{ color: "text.tertiary", whiteSpace: "nowrap" }}>
            {t.kindHints[countType]}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
