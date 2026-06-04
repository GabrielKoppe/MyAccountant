"use client";

import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { ReactNode } from "react";

import { layout } from "@/lib/design-tokens";

export interface DialogShellProps {
  /** Estado de abertura */
  open: boolean;
  /** Callback ao fechar (X, backdrop, ESC) */
  onClose: () => void;
  /** Titulo do dialog */
  title: string;
  /** Descricao opcional abaixo do titulo */
  description?: string;
  /** Conteudo principal */
  children: ReactNode;
  /** Acoes do rodape (botoes). Em mobile, ficam empilhadas. */
  actions?: ReactNode;
  /** Largura maxima. Padrao: "sm" (640px). */
  maxWidth?: "xs" | "sm" | "md" | "lg";
  /** Em mobile, abre fullscreen. Default: true. */
  fullScreenOnMobile?: boolean;
  /** Esconde o botao X (use somente se houver acoes obrigatorias) */
  hideCloseButton?: boolean;
  /** Esconde scroll do conteudo (raro, para conteudo pequeno) */
  hideContentScroll?: boolean;
  /** Aria label customizado (default: usa title) */
  ariaLabel?: string;
}

/**
 * Dialog padronizado com header (titulo + close), body e actions.
 *
 * Estrutura:
 *   ┌──────────────────────────────────────┐
 *   │ Titulo                            [×]│
 *   │ Descricao opcional                   │
 *   ├──────────────────────────────────────┤
 *   │ [Conteudo]                           │
 *   │                                      │
 *   ├──────────────────────────────────────┤
 *   │              [Cancelar] [Confirmar]  │
 *   └──────────────────────────────────────┘
 *
 * Use SEMPRE em vez de <Dialog> direto do MUI para garantir consistencia.
 */
export function DialogShell({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  maxWidth = "sm",
  fullScreenOnMobile = true,
  hideCloseButton = false,
  hideContentScroll = false,
  ariaLabel,
}: DialogShellProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const fullScreen = fullScreenOnMobile && isMobile;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={fullScreen}
      aria-label={ariaLabel ?? title}
    >
      <DialogTitle
        sx={{
          px: layout.card,
          pt: layout.card,
          pb: description ? layout.inline : layout.card,
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={layout.stack}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h3" component="div">
              {title}
            </Typography>
            {description && (
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mt: layout.micro }}
              >
                {description}
              </Typography>
            )}
          </Box>
          {!hideCloseButton && (
            <IconButton
              onClick={onClose}
              size="small"
              aria-label="Fechar"
              sx={{
                color: "text.tertiary",
                "&:hover": { color: "text.primary" },
                mt: -1,
                mr: -1,
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          px: layout.card,
          pb: actions ? 0 : layout.card,
          overflow: hideContentScroll ? "hidden" : "auto",
        }}
      >
        {children}
      </DialogContent>

      {actions && (
        <DialogActions
          sx={{
            px: layout.card,
            py: layout.stack,
            gap: layout.inline,
            flexDirection: { xs: "column-reverse", sm: "row" },
            "& > :not(:first-of-type)": {
              ml: { xs: 0, sm: layout.inline },
              mb: { xs: layout.inline, sm: 0 },
            },
            "& > *": {
              width: { xs: "100%", sm: "auto" },
            },
          }}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
}