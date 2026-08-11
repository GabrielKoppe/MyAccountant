"use client";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Popover from "@mui/material/Popover";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import { useState } from "react";

import { ColorDot } from "@/components/settings/ColorDot";
import { ACCENT_COLORS, getAccentPreset, type AccentColorKey } from "@/lib/accent-colors";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

type Props = {
  /** Chave de `accent-colors.ts`, ou `null` = sem cor gravada (fallback por índice). */
  value: AccentColorKey | null;
  /** Semeia o `ColorDot` do gatilho quando `value` é `null`. */
  fallbackIndex: number;
  onChange: (next: AccentColorKey | null) => void;
};

/** Aresta do swatch dentro do popover — menor que o `ColorDot` de 9px das listas
 * porque aqui o alvo já é maior (`ButtonBase` de 24px cobre a área de toque). */
const SWATCH_SIZE = 16;

/**
 * Seletor de cor compacto para a edição inline de linha (Spec 68 §2.1 item 5).
 *
 * Só os presets de `accent-colors.ts` — grava a CHAVE, nunca hex (D2). O
 * gatilho é o próprio `ColorDot` da linha; clicar nele abre um popover com os
 * swatches em vez de reabrir a grade grande de `PersonaStyleFields` (pensada
 * para um formulário de página inteira, não para uma célula de 24px).
 */
export function SectionColorPicker({ value, fallbackIndex, onChange }: Props) {
  const theme = useTheme();
  const mode = theme.palette.mode as "light" | "dark";
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const t = m.settings.structure.sections;

  return (
    <>
      <Tooltip title={t.colorLabel}>
        <ButtonBase
          aria-label={t.colorLabel}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            p: layout.micro,
            borderRadius: "4px",
            "&:hover": { bgcolor: "background.subtle" },
          }}
        >
          <ColorDot colorKey={value} fallbackIndex={fallbackIndex} size={12} />
        </ButtonBase>
      </Tooltip>

      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box
          sx={{
            p: layout.inline,
            display: "flex",
            flexWrap: "wrap",
            gap: layout.micro,
            maxWidth: 200,
          }}
        >
          <Tooltip title={t.colorNone}>
            <ButtonBase
              aria-label={t.colorNone}
              onClick={() => {
                onChange(null);
                setAnchorEl(null);
              }}
              sx={{
                width: SWATCH_SIZE,
                height: SWATCH_SIZE,
                borderRadius: "4px",
                borderWidth: "1px",
                borderStyle: "dashed",
                borderColor: value === null ? "accent.primary" : "border.default",
              }}
            />
          </Tooltip>
          {ACCENT_COLORS.map((preset) => (
            <Tooltip key={preset.key} title={preset.label}>
              <ButtonBase
                aria-label={preset.label}
                onClick={() => {
                  onChange(preset.key);
                  setAnchorEl(null);
                }}
                sx={{
                  width: SWATCH_SIZE,
                  height: SWATCH_SIZE,
                  borderRadius: "4px",
                  bgcolor: getAccentPreset(preset.key, mode).primary,
                  outline: value === preset.key ? "2px solid" : "none",
                  outlineColor: "text.primary",
                  outlineOffset: 1,
                }}
              />
            </Tooltip>
          ))}
        </Box>
      </Popover>
    </>
  );
}
