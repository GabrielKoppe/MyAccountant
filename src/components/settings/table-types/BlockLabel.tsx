"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

import { SettingsFieldLabel } from "@/components/settings/SettingsFieldLabel";
import { layout } from "@/lib/design-tokens";

export type BlockLabelProps = {
  children: ReactNode;
  /** Sufixo do frame ("· arraste pela alça para reordenar · × remove"). */
  hint?: ReactNode;
  /**
   * O que este controle faz **na tabela do mês** — vira o ícone de ajuda com
   * tooltip ao lado do rótulo. Ver `HelpTip`.
   */
  help?: string;
};

/**
 * Rótulo de bloco do frame (`.fl`): etiqueta mono + sufixo explicativo na mesma
 * linha, mais o ícone de ajuda quando o controle precisa de um.
 *
 * Este componente já teve uma marca de "§16 — gravado mas ainda não vale". Ela saiu
 * quando o último controle inerte da aba (`pinnedColumns`) passou a funcionar. Se um
 * dia um controle novo entrar sem consumidor, o caminho de volta está escrito no
 * `describe` do §16 em `BehaviorTab.test.tsx` — a peça não fica guardada aqui, porque
 * componente sem chamador envelhece junto com o resto do arquivo e ninguém percebe.
 */
export function BlockLabel({ children, hint, help }: BlockLabelProps) {
  return (
    <Box
      // Sem `mb` aqui: quem espaça o bloco abaixo é o próprio `SettingsFieldLabel`
      // (que já carrega `mb: layout.inline`). O badge repete essa margem para os
      // dois ficarem alinhados no centro óptico da mesma linha.
      sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: layout.inline }}
    >
      <SettingsFieldLabel>
        {children}
        {hint && (
          <Box
            component="span"
            sx={{
              ml: 0.5,
              textTransform: "none",
              letterSpacing: 0,
              fontWeight: 400,
              // Sempre terciário: o tom `accent` existia só para reproduzir a
              // etiqueta "· Spec 66" do frame, que saiu da tela por ser referência
              // de documento interno.
              color: "text.tertiary",
            }}
          >
            · {hint}
          </Box>
        )}
      </SettingsFieldLabel>
      {help && (
        // Mesma compensação de `mb` do badge: o `SettingsFieldLabel` carrega
        // `mb: layout.inline`, e sem repeti-la aqui o ícone desceria meio passo
        // em relação ao texto do rótulo.
        <Box sx={{ display: "inline-flex", mb: layout.inline }}>
          <HelpTip text={help} />
        </Box>
      )}
    </Box>
  );
}

/**
 * Ícone de ajuda de um controle: no hover **e no foco** explica o que ele faz na
 * tabela do mês.
 *
 * **Por que um `IconButton`, e não um `<span>` com `Tooltip` em volta.** Um alvo
 * inerte não entra na ordem de tabulação: o balão nunca abriria pelo teclado e o
 * leitor de tela não teria o que anunciar. O `<button>` resolve os dois de uma
 * vez — e, como o `title` do `Tooltip` é string, o MUI publica o texto como
 * `aria-label` do filho, então a ajuda está na árvore de acessibilidade mesmo
 * com o balão FECHADO (não depende de o usuário conseguir provocar o hover).
 *
 * **Por que `p: 0` + área de toque por `::after`.** Com o padding real do
 * `IconButton` o alvo mediria ~21px, mais que a linha do rótulo (15px), e cada
 * bloco da aba cresceria alguns pixels. O pseudo-elemento estende o alvo de
 * ponteiro para ~24px sem ocupar espaço nenhum no fluxo.
 *
 * `type="button"` vem do `ButtonBase`: dentro do formulário da aba, um botão sem
 * tipo submeteria o rascunho ao ser acionado pelo teclado.
 */
export function HelpTip({ text }: { text: string }) {
  return (
    // `enterTouchDelay={0}`: no toque não existe hover — sem isto o usuário
    // precisaria segurar o dedo 700ms para descobrir que há ajuda ali.
    <Tooltip title={text} enterTouchDelay={0}>
      <IconButton
        size="small"
        disableRipple
        sx={{
          p: 0,
          color: "text.tertiary",
          "&::after": {
            content: '""',
            position: "absolute",
            // Negativo dos dois lados: 14px do ícone + 5px de cada lado ≈ 24px.
            inset: "-5px",
            borderRadius: "50%",
          },
          // O `ButtonBase` zera o outline nativo; sem isto o foco por teclado
          // seria invisível — e o foco é o caminho principal para este tooltip.
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "accent.primary",
            outlineOffset: "2px",
            borderRadius: "50%",
          },
        }}
      >
        {/* Medida em px pelo `fontSize` do ícone: `fontSize="small"` (20px)
            dominaria o rótulo de 10px, e `inherit` (10px) sumiria. */}
        <InfoOutlinedIcon sx={{ fontSize: "0.875rem" }} />
      </IconButton>
    </Tooltip>
  );
}

/** Hint de campo (`.fhint` no frame): terciário, nunca `text.disabled` (§15). */
export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{ display: "block", mt: layout.micro, color: "text.tertiary" }}
    >
      {children}
    </Typography>
  );
}
