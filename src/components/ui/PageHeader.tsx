"use client";

import { Box, Breadcrumbs, Link as MuiLink, Stack, Typography } from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import NextLink from "next/link";
import type { ReactNode } from "react";

import { layout } from "@/lib/design-tokens";

export type Breadcrumb = {
  label: string;
  href?: string;
};

export interface PageHeaderProps {
  /** Titulo principal da pagina */
  title: string;
  /** Descricao opcional logo abaixo do titulo */
  description?: string;
  /** Trilha de navegacao acima do titulo */
  breadcrumbs?: Breadcrumb[];
  /** Acoes alinhadas a direita (botoes, menus) */
  actions?: ReactNode;
}

/**
 * Cabecalho padronizado de pagina.
 *
 * Layout:
 *  [Breadcrumbs (opcional)]
 *  [Titulo H1]                          [Acoes]
 *  [Descricao (opcional)]
 *
 * Use no topo de toda pagina de conteudo principal.
 */
export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <Stack spacing={layout.inline} sx={{ mb: layout.section }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          aria-label="breadcrumb"
          sx={{
            color: "text.tertiary",
            "& .MuiBreadcrumbs-separator": {
              color: "text.disabled",
            },
          }}
        >
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            if (isLast || !crumb.href) {
              return (
                <Typography
                  key={i}
                  variant="body2"
                  sx={{ color: isLast ? "text.primary" : "text.tertiary" }}
                >
                  {crumb.label}
                </Typography>
              );
            }
            return (
              <MuiLink
                key={i}
                component={NextLink}
                href={crumb.href}
                variant="body2"
                underline="hover"
                sx={{ color: "text.tertiary" }}
              >
                {crumb.label}
              </MuiLink>
            );
          })}
        </Breadcrumbs>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={layout.stack}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h1">{title}</Typography>
          {description && (
            <Typography variant="body1" sx={{ color: "text.secondary", mt: layout.micro }}>
              {description}
            </Typography>
          )}
        </Box>

        {actions && (
          <Stack direction="row" spacing={layout.inline} sx={{ flexShrink: 0 }}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
