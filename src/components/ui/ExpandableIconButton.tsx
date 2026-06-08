"use client";

import type { ReactNode, MouseEvent } from "react";
import ButtonBase from "@mui/material/ButtonBase";
import type { SxProps, Theme } from "@mui/material/styles";

type Props = {
  icon: ReactNode;
  label: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  /** Direção em que o texto expande ao hover. Default: "right". */
  direction?: "right" | "left";
  sx?: SxProps<Theme>;
};

/**
 * Botão que exibe apenas um ícone por padrão.
 * Ao passar o mouse, o texto desliza suavemente para a direita ou esquerda do ícone.
 * Sem borda, sem fundo — equivalente a variant="text".
 *
 * Uso:
 *   <ExpandableIconButton icon={<ClearIcon />} label="Limpar tudo" onClick={fn} />
 *   <ExpandableIconButton icon={<ClearIcon />} label="Limpar tudo" direction="left" onClick={fn} />
 */
export function ExpandableIconButton({
  icon,
  label,
  onClick,
  disabled = false,
  direction = "right",
  sx,
}: Props) {
  const isLeft = direction === "left";

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
          ...(isLeft ? { marginRight: 0 } : { marginLeft: 0 }),
          transition: `max-width 0.2s ease, ${isLeft ? "margin-right" : "margin-left"} 0.2s ease`,
        },
        "&:hover .eib-label": {
          maxWidth: 120,
          ...(isLeft ? { marginRight: "4px" } : { marginLeft: "4px" }),
        },
        ...sx,
      }}
    >
      {isLeft ? (
        <>
          <span className="eib-label">{label}</span>
          {icon}
        </>
      ) : (
        <>
          {icon}
          <span className="eib-label">{label}</span>
        </>
      )}
    </ButtonBase>
  );
}
