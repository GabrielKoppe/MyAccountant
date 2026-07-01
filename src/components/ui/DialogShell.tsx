"use client";

import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";
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

import { layout } from "@/lib/design-tokens";

export interface DialogShellProps {
  /** Estado de abertura */
  open: boolean;
  /** Callback ao fechar (X, backdrop, ESC). Bloqueado quando loading=true. */
  onClose: () => void;
  /** Titulo do dialog */
  title: string;
  /** Descricao opcional abaixo do titulo. String é renderizada em Typography; ReactNode é renderizado diretamente. */
  description?: ReactNode;
  /** Conteudo principal (opcional quando description cobre todo o conteudo do dialog) */
  children?: ReactNode;
  /** Acoes do rodape (botoes). Em mobile, ficam empilhadas. Quando loading=true, todos os botoes recebem disabled. */
  actions?: ReactNode;
  /** Largura maxima. Padrao: "sm" (640px). */
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Em mobile, abre fullscreen. Default: true. */
  fullScreenOnMobile?: boolean;
  /** Esconde o botao X (use somente se houver acoes obrigatorias) */
  hideCloseButton?: boolean;
  /** Esconde scroll do conteudo (raro, para conteudo pequeno) */
  hideContentScroll?: boolean;
  /** Estado de carregamento: bloqueia fechar (ESC, backdrop, X) e desabilita todos os botoes de actions. */
  loading?: boolean;
}

function injectDisabled(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === Fragment) {
      return cloneElement(child as ReactElement<{ children?: ReactNode }>, {
        children: injectDisabled((child.props as { children?: ReactNode }).children),
      });
    }
    return cloneElement(child as ReactElement<{ disabled?: boolean }>, { disabled: true });
  });
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
  loading = false,
}: DialogShellProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const fullScreen = fullScreenOnMobile && isMobile;
  const titleId = useId();

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={fullScreen}
      aria-labelledby={titleId}
      disableEscapeKeyDown={loading}
    >
      <DialogTitle
        sx={{
          px: layout.card,
          pt: layout.card,
          pb: description !== undefined ? layout.stack : layout.card,
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={layout.inline}
        >
          <Typography id={titleId} variant="h3" component="div" sx={{ flex: 1, minWidth: 0 }}>
            {title}
          </Typography>
          {!hideCloseButton && (
            <IconButton
              onClick={onClose}
              size="small"
              aria-label="Fechar"
              disabled={loading}
              sx={{
                color: "text.tertiary",
                "&:hover": { color: "text.primary" },
                flexShrink: 0,
                mt: "-2px",
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
        {description !== undefined &&
          (typeof description === "string" ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: layout.inline }}>
              {description}
            </Typography>
          ) : (
            <Box sx={{ mt: layout.inline }}>{description}</Box>
          ))}
      </DialogTitle>

      {children != null && (
        <DialogContent
          sx={{
            px: layout.card,
            pb: actions ? 0 : layout.card,
            overflow: hideContentScroll ? "hidden" : "auto",
            // Reserva o espaço da barra de rolagem sempre, evitando o "flick"/reflow
            // quando o scroll aparece ao trocar de step (ex: mapeamento é mais alto).
            scrollbarGutter: "stable",
          }}
        >
          {children}
        </DialogContent>
      )}

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
          {loading ? injectDisabled(actions) : actions}
        </DialogActions>
      )}
    </Dialog>
  );
}
