"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { SxProps, Theme } from "@mui/material/styles";
import type { SvgIconProps } from "@mui/material/SvgIcon";

type Props = {
  /** Título principal do widget */
  title: string;
  /** Texto ou node exibido ao lado do título — ex: "2 metas", um badge de status */
  subtitle?: React.ReactNode;
  /**
   * Ícone MUI renderizado à esquerda do título.
   * Ex: `icon={SavingsIcon}`
   */
  icon?: React.ComponentType<SvgIconProps>;
  /**
   * Slot direito — ações (botões, menus, etc.).
   * stopPropagation aplicado automaticamente para não disparar colapso.
   */
  secondary?: React.ReactNode;
  /**
   * Slot direito adicional — conteúdo inline à direita do header antes do secondary.
   * Ex: badges, contadores, toggles informativos.
   */
  tertiary?: React.ReactNode;
  /** Habilita colapso com seta no cabeçalho (padrão: false) */
  collapsible?: boolean;
  /** Estado inicial do colapso — padrão: expandido */
  defaultExpanded?: boolean;
  children?: React.ReactNode;
  /** sx adicional aplicado ao Paper externo */
  sx?: SxProps<Theme>;
  /** sx adicional aplicado à área de conteúdo (p.ex. `{ overflow: "hidden" }` para impedir scroll interno) */
  contentSx?: SxProps<Theme>;
};

export function WidgetContainer({
  title,
  subtitle,
  icon: Icon,
  secondary,
  tertiary = null,
  collapsible = false,
  defaultExpanded = true,
  children,
  sx,
  contentSx,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasRightContent = secondary !== undefined || collapsible;

  return (
    <Paper
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...sx,
      }}
    >
      {/* ── Cabeçalho ── */}
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2.5,
          py: 1.5,
          ...(collapsible && { cursor: "pointer", userSelect: "none" }),
        }}
        onClick={collapsible ? () => setExpanded((v) => !v) : undefined}
      >
        {/* Esquerda: ícone + título + subtítulo */}
        <Stack direction="row" alignItems="center" gap={2}>
          {Icon && <Icon sx={{ fontSize: 16, color: "text.secondary" }} />}
          <Stack direction="column" spacing={0}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography variant="subtitle2" fontWeight="bold">
                {title}
              </Typography>
              {tertiary}
            </Stack>
            {subtitle !== undefined && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Stack>
        </Stack>

        {/* Direita: tertiary + secondary (com stopPropagation) + seta de colapso */}
        {hasRightContent && (
          <Stack direction="row" alignItems="center" gap={0.5}>
            {secondary !== undefined && (
              <Stack
                direction="row"
                alignItems="center"
                gap={0.5}
                onClick={(e) => e.stopPropagation()}
              >
                {secondary}
              </Stack>
            )}
            {collapsible && (
              <IconButton size="small">
                {expanded ? (
                  <ExpandLessIcon sx={{ fontSize: 18 }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            )}
          </Stack>
        )}
      </Box>

      {/* ── Conteúdo ── */}
      {collapsible ? (
        <Collapse in={expanded} sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <Box sx={{ px: 2.5, pb: 2, pt: 0.5, ...contentSx }}>{children}</Box>
        </Collapse>
      ) : (
        <Box
          sx={{ px: 2.5, pb: 2.5, pt: 0, flex: 1, minHeight: 0, overflow: "auto", ...contentSx }}
        >
          {children}
        </Box>
      )}
    </Paper>
  );
}
