"use client";

import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField, { type TextFieldProps } from "@mui/material/TextField";

import { radius } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

import {
  SETTINGS_FIELD_HEIGHT,
  SETTINGS_ROW_ICON,
  SETTINGS_TABLE_FONT,
} from "./settings-table-tokens";

/**
 * Campo de texto dentro de uma linha em edição (Spec 68, revisão de estilo).
 *
 * O `TextField size="small"` do tema tem altura e tipografia de formulário: dentro de
 * uma linha de 34px ele estica a linha e o texto digitado sai maior que o das células
 * ao lado, que é exatamente a sensação de "input alto e letra grande". Aqui a altura
 * cabe na linha e a fonte é a MESMA da célula — o campo ocupa o lugar do texto, sem
 * mudar a medida da tabela.
 */
export type SettingsRowFieldProps = Omit<TextFieldProps, "label" | "size" | "variant"> & {
  /**
   * Nome do campo. Vira **placeholder + `aria-label`**, nunca o `label` flutuante do
   * MUI.
   *
   * Motivo: o `label` do `TextField` é renderizado DENTRO do contorno e sobe para o
   * entalhe ao focar. Numa linha de 28px ele não tem para onde subir — sai em tamanho
   * de formulário, fora do eixo vertical e por cima do texto digitado. Era exatamente
   * o que acontecia na coluna "Detalhes" de Instituições.
   *
   * Convertendo aqui, o chamador continua escrevendo `label` e não tem como errar; e o
   * campo mantém nome acessível, que um `placeholder` sozinho não dá.
   */
  label?: string;
  /**
   * Altura do contorno, quando o campo NÃO está dentro de uma linha de tabela — os
   * 33px dos formulários das abas de Tipos e Modelos (`.fld` do frame) contra os 28px
   * de `SETTINGS_FIELD_HEIGHT`, que existem para caber numa linha de 36px.
   *
   * **Por que uma prop, e não `sx`**: o `sx` do chamador é espalhado por ÚLTIMO, e
   * `& .MuiOutlinedInput-root` é um objeto aninhado — passar
   * `{ "& .MuiOutlinedInput-root": { height: 33 } }` substituía o objeto inteiro e
   * levava embora o `fontSize` e o `borderRadius` definidos aqui. O campo voltava aos
   * 16px do tema (era exatamente o "Nome do tipo" com letra grande), e nada no code
   * review denunciava: o seletor está certo, só não é somado. Com a altura entrando
   * pela prop, nenhum chamador precisa mais tocar nesse seletor.
   */
  fieldHeight?: number | string;
};

export function SettingsRowField({
  sx,
  label,
  inputProps,
  fieldHeight = SETTINGS_FIELD_HEIGHT,
  ...rest
}: SettingsRowFieldProps) {
  return (
    <TextField
      {...rest}
      // `label` NUNCA é repassado ao MUI — ver a explicação no tipo acima.
      placeholder={rest.placeholder ?? label}
      inputProps={{ ...(label ? { "aria-label": label } : {}), ...inputProps }}
      fullWidth
      sx={{
        "& .MuiOutlinedInput-root": {
          height: fieldHeight,
          fontSize: SETTINGS_TABLE_FONT.field.size,
          // String em px — numérico seria multiplicado por `theme.shape.borderRadius`.
          borderRadius: `${radius.sm + 3}px`,
        },
        "& .MuiOutlinedInput-input": { py: 0, px: 1.25 },
        // Erro de validação numa linha de tabela não tem onde caber: o campo fica
        // vermelho e a mensagem vai para o snackbar.
        "& .MuiFormHelperText-root": { display: "none" },
        ...sx,
      }}
    />
  );
}

export type SettingsEditActionsProps = {
  onCancel: () => void;
  onCommit: () => void;
  canCommit?: boolean;
  /** Nome do objeto — compõe os aria-labels; uma lista tem dezenas de "Salvar". */
  name: string;
};

/**
 * As duas ações de uma linha em edição: **cancelar primeiro, confirmar depois**.
 *
 * A ordem não é estética: o botão que grava é o último da linha, encostado na borda,
 * no mesmo lugar onde o menu de ações estava — o gesto de "terminar" acontece sempre
 * no mesmo ponto. E o check usa a cor de accent, porque é a ação primária da linha;
 * antes ele saía na cor do texto, com o mesmo peso do cancelar.
 */
export function SettingsEditActions({
  onCancel,
  onCommit,
  canCommit = true,
  name,
}: SettingsEditActionsProps) {
  return (
    <Stack direction="row" spacing={0} justifyContent="flex-end" alignItems="center">
      <IconButton
        size="small"
        onClick={onCancel}
        aria-label={`${m.common.cancel}: ${name}`}
        sx={{ p: 0.25, color: "text.tertiary" }}
      >
        <CloseIcon sx={{ fontSize: SETTINGS_ROW_ICON.size }} />
      </IconButton>
      <IconButton
        size="small"
        onClick={onCommit}
        disabled={!canCommit}
        aria-label={`${m.common.save}: ${name}`}
        sx={{ p: 0.25, color: "accent.primary" }}
      >
        <CheckIcon sx={{ fontSize: SETTINGS_ROW_ICON.size }} />
      </IconButton>
    </Stack>
  );
}

/**
 * Ícone do menu da linha — pequeno e cinza, como no frame.
 *
 * Vinha 20px e branco (a cor default do `IconButton`), competindo com o nome da linha
 * por atenção numa coluna que é só um atalho. Este é o ícone que o `RowActionsMenu`
 * renderiza; exportado aqui para que a medida viva junto das outras da tabela.
 */
export function SettingsRowMenuIcon() {
  return <MoreHorizIcon sx={{ fontSize: SETTINGS_ROW_ICON.menuSize, color: "text.tertiary" }} />;
}

/** Ícone da alça de arraste, na medida da tabela. */
export function SettingsGripIcon() {
  return <DragIndicatorIcon sx={{ fontSize: SETTINGS_ROW_ICON.size, color: "text.disabled" }} />;
}
