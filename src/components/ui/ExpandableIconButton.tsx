"use client";

import type { ReactNode, MouseEvent } from "react";
import ButtonBase from "@mui/material/ButtonBase";
import type { SxProps, Theme } from "@mui/material/styles";

type Props = {
  icon: ReactNode;
  label: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  sx?: SxProps<Theme>;
};

/**
 * Botão que exibe apenas um ícone por padrão.
 * Ao passar o mouse, o texto desliza suavemente para a direita do ícone.
 * Sem borda, sem fundo — equivalente a variant="text".
 *
 * Uso:
 *   <ExpandableIconButton icon={<ClearIcon />} label="Limpar tudo" onClick={fn} />
 */
export function ExpandableIconButton({ icon, label, onClick, disabled = false, sx }: Props) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "6px",
        px: 0.75,
        py: 0.5,
        color: disabled ? "text.disabled" : "text.tertiary",
        fontSize: 16,
        transition: "color 0.15s ease",
        "&:hover": { color: "text.secondary" },
        "&:focus-visible": { outline: "2px solid", outlineColor: "border.focus", outlineOffset: 1 },
        "& .eib-label": {
          fontSize: "0.75rem",
          fontWeight: 500,
          lineHeight: 1,
          maxWidth: 0,
          overflow: "hidden",
          whiteSpace: "nowrap",
          marginLeft: 0,
          transition: "max-width 0.2s ease, margin-left 0.2s ease",
        },
        "&:hover .eib-label": {
          maxWidth: 120,
          marginLeft: "4px",
        },
        ...sx,
      }}
    >
      {icon}
      <span className="eib-label">{label}</span>
    </ButtonBase>
  );
}
