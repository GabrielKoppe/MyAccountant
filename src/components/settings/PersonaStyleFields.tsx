"use client";

import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { PERSONA_ICON_COMPONENTS } from "@/components/transactions/PartyAvatar";
import { ACCENT_COLORS, getAccentPreset, type AccentColorKey } from "@/lib/accent-colors";
import { m } from "@/lib/messages";
import { PERSONA_ICONS, type PersonaIconKey } from "@/lib/persona-icons";

const rp = m.settings.responsibleParties;

type Props = {
  icon: string | null;
  color: string | null;
  onIconChange: (icon: PersonaIconKey | null) => void;
  onColorChange: (color: AccentColorKey | null) => void;
};

/** Botão-célula quadrado com estado selecionado (ring na cor accent). */
function Cell({
  selected,
  onClick,
  label,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={label}>
      <ButtonBase
        aria-label={label}
        onClick={onClick}
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          border: "1px solid",
          borderColor: selected ? "accent.primary" : "divider",
          bgcolor: selected ? "accent.primarySubtle" : "transparent",
          color: "text.secondary",
          transition: "all 120ms ease",
          "&:hover": { borderColor: "accent.primary" },
        }}
      >
        {children}
      </ButtonBase>
    </Tooltip>
  );
}

/**
 * Campos de estilo de uma persona (Spec 60): grade de ícones curados + grade de
 * cores accent do sistema. Ambos opcionais ("Nenhum" limpa a escolha).
 */
export function PersonaStyleFields({ icon, color, onIconChange, onColorChange }: Props) {
  const theme = useTheme();
  const mode = theme.palette.mode;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Ícone */}
      <Box>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          {rp.iconLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
          {rp.iconHint}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          <Cell selected={!icon} onClick={() => onIconChange(null)} label={rp.noneOption}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </Cell>
          {PERSONA_ICONS.map(({ key, label }) => {
            const IconComp = PERSONA_ICON_COMPONENTS[key as PersonaIconKey];
            return (
              <Cell
                key={key}
                selected={icon === key}
                onClick={() => onIconChange(key)}
                label={label}
              >
                <IconComp sx={{ fontSize: 18 }} />
              </Cell>
            );
          })}
        </Box>
      </Box>

      {/* Cor */}
      <Box>
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          {rp.colorLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
          {rp.colorHint}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
          <Cell selected={!color} onClick={() => onColorChange(null)} label={rp.noneOption}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </Cell>
          {ACCENT_COLORS.map((c) => {
            const selected = color === c.key;
            return (
              <Tooltip key={c.key} title={c.label}>
                <ButtonBase
                  aria-label={c.label}
                  onClick={() => onColorChange(c.key)}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    bgcolor: getAccentPreset(c.key, mode).primary,
                    outline: selected ? "2px solid" : "none",
                    outlineColor: "text.primary",
                    outlineOffset: 2,
                    transition: "outline 120ms ease",
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
