"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import Typography from "@mui/material/Typography";
import { useId, type KeyboardEvent, type ReactNode } from "react";

import { layout, motion, typography } from "@/lib/design-tokens";

const T_FAST = `${motion.duration.fast}ms ${motion.easing.standard}`;

export type ChoiceCardProps = {
  selected: boolean;
  onSelect: () => void;
  /** Rótulo da opção: "A · Colunas fixas", "Compacta", "Rosca com legenda". */
  label: string;
  /** Frase curta sob o rótulo ("Grade alinhada, boa para comparar valores."). */
  helper?: string;
  /** Medida em mono, no pé do card: "28px · 0.78rem". */
  meta?: string;
  /** Ícone à esquerda do rótulo (usado pela lista de visualizações do dashboard). */
  icon?: ReactNode;
  disabled?: boolean;
  /**
   * Por que está desabilitado ("precisa de 8 colunas").
   *
   * Renderizado VISÍVEL, não em tooltip: a matriz 07b (APR-07) existe justamente
   * para não deixar o usuário adivinhar por que a opção sumiu.
   */
  disabledReason?: string;
  /** Miniatura da opção (as duas linhas de exemplo da densidade, as pílulas do layout). */
  children?: ReactNode;
};

/**
 * Card de escolha das Configurações (Spec 69 §7.4): `Paper variant="outlined"` +
 * `Radio`, selecionado com borda `accent.primary` e fundo `accent.primarySubtle`.
 *
 * Usado por organização da linha, densidade e visualização de widget.
 *
 * **Acessibilidade** — o CARD é o `role="radio"`; o `Radio` do MUI é indicador
 * visual e nada mais (`aria-hidden` + `tabIndex: -1` no input, `readOnly` para o
 * React não reclamar de campo controlado sem `onChange`). Sem isso haveria dois
 * "radio" no mesmo lugar na árvore de acessibilidade — o card e o input dentro
 * dele. Quem chama é responsável por envolver os cards irmãos num
 * `role="radiogroup"` com `aria-label`.
 *
 * `tabIndex` é 0 em TODOS os cards habilitados, e não só no selecionado (roving
 * tabindex): daqui não dá para saber se algum irmão está marcado, e com `-1` em
 * todos um grupo sem escolha inicial sairia inteiro da ordem de tabulação.
 */
export function ChoiceCard({
  selected,
  onSelect,
  label,
  helper,
  meta,
  icon,
  disabled = false,
  disabledReason,
  children,
}: ChoiceCardProps) {
  const descriptionId = useId();
  const hasDescription = Boolean(helper) || Boolean(disabled && disabledReason);

  function handleSelect() {
    if (disabled) return;
    onSelect();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.key !== " " && event.key !== "Enter") return;
    // Espaço rolaria a página e Enter poderia submeter o formulário da aba.
    event.preventDefault();
    onSelect();
  }

  return (
    <Paper
      variant="outlined"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      aria-label={label}
      aria-describedby={hasDescription ? descriptionId : undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      sx={{
        flex: 1,
        minWidth: 0,
        p: 1.5,
        // String em px: um `borderRadius` numérico em `sx` é multiplicado por
        // `theme.shape.borderRadius` (=8) e viraria 64px (§15).
        borderRadius: "8px",
        cursor: disabled ? "not-allowed" : "pointer",
        // Desabilitado perde a moldura de escolha (mesmo marcado): o card ainda
        // se lê, mas não convida ao clique.
        borderColor: disabled
          ? "border.subtle"
          : selected
            ? "accent.primary"
            : "border.default",
        bgcolor: disabled
          ? "background.subtle"
          : selected
            ? "accent.primarySubtle"
            : "background.surface",
        // Tokens de motion no lugar dos 120ms/`ease` mágicos.
        transition: `border-color ${T_FAST}, background-color ${T_FAST}`,
        ...(disabled
          ? {}
          : {
              "&:hover": { borderColor: selected ? "accent.primary" : "border.strong" },
            }),
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "accent.primary",
          outlineOffset: "2px",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Radio
          checked={selected}
          disabled={disabled}
          size="small"
          disableRipple
          // Indicador puro: fora da ordem de tabulação e fora da árvore de
          // acessibilidade — quem tem papel de radio é o card.
          aria-hidden
          inputProps={{ tabIndex: -1, readOnly: true }}
          sx={{ p: 0 }}
        />

        {icon && (
          <Box
            aria-hidden
            sx={{
              display: "inline-flex",
              color: selected ? "accent.primary" : "text.tertiary",
            }}
          >
            {icon}
          </Box>
        )}

        <Typography
          component="span"
          sx={{
            fontSize: "0.76rem",
            fontWeight: selected
              ? typography.fontWeight.semibold
              : typography.fontWeight.medium,
            color: disabled ? "text.tertiary" : selected ? "accent.primary" : "text.secondary",
          }}
        >
          {label}
        </Typography>
      </Box>

      {hasDescription && (
        <Box id={descriptionId}>
          {helper && (
            <Typography variant="body2" sx={{ mt: layout.micro, color: "text.tertiary" }}>
              {helper}
            </Typography>
          )}
          {disabled && disabledReason && (
            <Typography
              variant="body2"
              sx={{ mt: layout.micro, color: "warning.main", fontSize: "0.72rem" }}
            >
              {disabledReason}
            </Typography>
          )}
        </Box>
      )}

      {children && <Box sx={{ mt: layout.inline }}>{children}</Box>}

      {meta && (
        <Typography
          variant="mono"
          component="div"
          sx={{
            mt: layout.inline,
            fontSize: "0.62rem",
            fontWeight: typography.fontWeight.medium,
            // `text.tertiary` e não `text.disabled`: a medida ("28px · 0.78rem") é
            // o dado que distingue as três densidades — não é decoração (§15).
            color: selected ? "accent.primary" : "text.tertiary",
          }}
        >
          {meta}
        </Typography>
      )}
    </Paper>
  );
}
