"use client";

import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { layout } from "@/lib/design-tokens";

export interface SectionProps {
  /** Titulo da secao (H2 visual) */
  title?: string;
  /** Descricao opcional abaixo do titulo */
  description?: string;
  /** Acao do lado direito do titulo (botao secundario, link) */
  action?: ReactNode;
  /** Conteudo da secao */
  children: ReactNode;
  /** id opcional para deep-link */
  id?: string;
}

/**
 * Secao de pagina com cabecalho consistente.
 *
 * Layout:
 *  [Titulo H2]                [Acao]
 *  [Descricao]
 *  ─────────────────────────────────
 *  [Conteudo]
 *
 * Use entre PageHeader e o conteudo da pagina, agrupando blocos logicos.
 * Quando a pagina tem multiplas secoes, envolva-as em um <Stack spacing={layout.section}>.
 */
export function Section({
  title,
  description,
  action,
  children,
  id,
}: SectionProps) {
  const hasHeader = title || action;

  return (
    <Box component="section" id={id}>
      {hasHeader && (
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={layout.stack}
          sx={{ mb: layout.cluster }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {title && <Typography variant="h2">{title}</Typography>}
            {description && (
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mt: layout.micro }}
              >
                {description}
              </Typography>
            )}
          </Box>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Stack>
      )}

      {children}
    </Box>
  );
}