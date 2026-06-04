"use client";

import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { layout } from "@/lib/design-tokens";

export interface EmptyStateProps {
  /** Icone grande no topo (ex: <InboxIcon sx={{ fontSize: 48 }} />) */
  icon?: ReactNode;
  /** Titulo principal (frase curta, sem ponto final) */
  title: string;
  /** Descricao explicativa */
  description?: string;
  /** Acao primaria sugerida (ex: <Button>Criar primeiro</Button>) */
  action?: ReactNode;
  /** Densidade: "default" para uso em paginas, "compact" para dentro de cards/tabs */
  size?: "default" | "compact";
}

/**
 * Estado vazio padronizado.
 *
 * Usado quando nao ha dados a exibir (lista vazia, busca sem resultados,
 * pagina nao configurada). Tom encorajador, nao alarmante.
 *
 * Layout vertical, centralizado:
 *   [Icone grande discreto]
 *   [Titulo]
 *   [Descricao]
 *   [Acao]
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "default",
}: EmptyStateProps) {
  const verticalPadding = size === "default" ? layout.section : layout.cluster;

  return (
    <Box
      sx={{
        py: verticalPadding,
        px: layout.cluster,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <Stack spacing={layout.stack} alignItems="center" sx={{ maxWidth: 400 }}>
        {icon && (
          <Box
            sx={{
              color: "text.tertiary",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: layout.inline,
            }}
          >
            {icon}
          </Box>
        )}

        <Stack spacing={layout.micro} alignItems="center">
          <Typography variant={size === "default" ? "h3" : "h4"} sx={{ color: "text.primary" }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {description}
            </Typography>
          )}
        </Stack>

        {action && <Box sx={{ mt: layout.inline }}>{action}</Box>}
      </Stack>
    </Box>
  );
}
