"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { IconButton } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useState } from "react";

import { m } from "@/lib/messages";
import type { PageGuide } from "@/lib/page-guide";

import { PageInfoDialog } from "./PageInfoDialog";

export interface PageInfoButtonProps {
  /** Guia a ser exibido ao abrir o dialog. */
  guide: PageGuide;
  /** Rótulo acessível do botão. Padrão: `m.common.pageInfo.ariaLabel`. */
  ariaLabel?: string;
  /** Tamanho do IconButton. Padrão: "small". */
  size?: "small" | "medium";
  /** Override de estilo do IconButton. */
  sx?: SxProps<Theme>;
}

/**
 * Botão de "informações da página": um IconButton discreto que abre o
 * `PageInfoDialog` com o guia fornecido.
 *
 * É um client component, mas pode ser usado dentro de Server Components
 * (ex: no `actions` de um `PageHeader`).
 */
export function PageInfoButton({
  guide,
  ariaLabel,
  size = "small",
  sx,
}: PageInfoButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        size={size}
        aria-label={ariaLabel ?? m.common.pageInfo.ariaLabel}
        onClick={() => setOpen(true)}
        sx={{
          color: "text.tertiary",
          "&:hover": { color: "text.primary" },
          ...sx,
        }}
      >
        <InfoOutlinedIcon fontSize={size === "small" ? "small" : "medium"} />
      </IconButton>
      <PageInfoDialog open={open} onClose={() => setOpen(false)} guide={guide} />
    </>
  );
}
