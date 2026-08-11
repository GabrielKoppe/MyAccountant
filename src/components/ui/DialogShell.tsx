"use client";

import CloseIcon from "@mui/icons-material/Close";
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
import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from "react";

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
  /** Largura máxima em px do Paper. Quando definida, vence o maxWidth de breakpoint. */
  maxWidthPx?: number;
  /** Em mobile, abre fullscreen. Default: true. */
  fullScreenOnMobile?: boolean;
  /** Esconde o botao X (use somente se houver acoes obrigatorias) */
  hideCloseButton?: boolean;
  /**
   * Oculta o titulo VISUALMENTE, mantendo-o para leitores de tela (`aria-labelledby`).
   * Use quando o proprio conteudo ja tem um cabecalho de destaque que seria o apex
   * visual (ex.: o valor da transacao no modal de detalhe) e um titulo extra
   * competiria com ele. O header colapsa para a altura do botao X.
   */
  titleVisuallyHidden?: boolean;
  /**
   * Ícone à esquerda do título. No desenho dos modais, cada diálogo se anuncia por um
   * ícone com a cor da intenção (perigo em "excluir", atenção em "desativar", accent
   * no resto) — é o que faz a natureza da ação ser lida antes do texto.
   */
  titleIcon?: ReactNode;
  /**
   * Variante tipográfica do título. Default `h3` (20px) para não mexer nos diálogos
   * que já existiam; a família de Configurações passa `h5` (16px), que é a medida do
   * desenho.
   */
  titleVariant?: "h3" | "h4" | "h5";
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
  maxWidthPx,
  fullScreenOnMobile = true,
  hideCloseButton = false,
  hideContentScroll = false,
  loading = false,
  titleVisuallyHidden = false,
  titleIcon,
  titleVariant = "h3",
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
      // O `sx` do Paper vence as variantes do styled do MUI — inclusive o
      // `maxWidth: 100%` do fullScreen. Por isso a largura em px só entra fora do
      // fullScreen; senão o dialog ficaria estreito no meio da tela do celular.
      PaperProps={
        maxWidthPx !== undefined && !fullScreen ? { sx: { maxWidth: maxWidthPx } } : undefined
      }
      fullWidth
      fullScreen={fullScreen}
      aria-labelledby={titleId}
      disableEscapeKeyDown={loading}
    >
      <DialogTitle
        sx={{
          px: layout.card,
          // Titulo oculto: o header vira só a faixa do botao X (sem espaco morto);
          // o cabecalho de destaque do proprio conteudo assume o topo visual.
          pt: titleVisuallyHidden ? layout.inline : layout.card,
          pb: titleVisuallyHidden ? 0 : description !== undefined ? layout.stack : layout.card,
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={layout.inline}
        >
          {titleIcon && !titleVisuallyHidden && (
            // `aria-hidden` implícito: o ícone repete o que o título já diz; anunciá-lo
            // faria o leitor de tela ler duas vezes a mesma informação.
            <Box aria-hidden sx={{ display: "flex", alignItems: "center", flexShrink: 0, mt: "1px" }}>
              {titleIcon}
            </Box>
          )}
          <Typography
            id={titleId}
            variant={titleVariant}
            component="div"
            sx={
              titleVisuallyHidden
                ? // sr-only: continua no DOM para o aria-labelledby, sem ocupar espaco
                  {
                    // ATENÇÃO: no `sx` do MUI, `width: 1` significa 100% (não 1px) —
                    // usar string com unidade, senão o título "oculto" ocupa a largura
                    // toda e estoura o dialog na horizontal.
                    position: "absolute",
                    width: "1px",
                    height: "1px",
                    p: 0,
                    m: "-1px",
                    overflow: "hidden",
                    clip: "rect(0 0 0 0)",
                    whiteSpace: "nowrap",
                    border: 0,
                  }
                : { flex: 1, minWidth: 0 }
            }
          >
            {title}
          </Typography>
          {titleVisuallyHidden && <Box sx={{ flex: 1, minWidth: 0 }} />}
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
