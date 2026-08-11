"use client";

import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectProps } from "@mui/material/Select";
import type { ReactNode } from "react";

import { radius, typography } from "@/lib/design-tokens";

import {
  SETTINGS_MENU_ITEM_SX,
  SETTINGS_SELECT_MENU_PROPS,
} from "./settings-menu-props";
import { SETTINGS_FIELD_HEIGHT, SETTINGS_TABLE_FONT } from "./settings-table-tokens";

export type SettingsSelectOption = {
  value: string;
  label: string;
  /** Conteúdo à esquerda do rótulo (ponto de cor, monograma, avatar). */
  adornment?: ReactNode;
};

export type SettingsSelectProps = Omit<SelectProps<string>, "size" | "variant" | "children"> & {
  options: SettingsSelectOption[];
  /** Rótulo da opção vazia. Ausente = o campo não oferece "nenhum". */
  emptyLabel?: string;
};

/**
 * O seletor da tabela de Configurações (Spec 68, revisão de estilo).
 *
 * O `Select` cru do MUI entra numa linha de tabela alto demais e com tipografia de
 * formulário — dentro de uma linha de 34px ele estica a linha e briga com o texto das
 * células vizinhas. Este envelope reproduz o campo do frame (`.fld`): baixo, cantos de
 * 7px, fonte do tamanho da linha, chevron discreto.
 *
 * Continua sendo o `Select` do MUI por baixo — teclado, `aria`, portal do menu e
 * integração com RHF vêm de graça; o que muda é só a medida.
 */
export function SettingsSelect({ options, emptyLabel, sx, ...rest }: SettingsSelectProps) {
  return (
    <Select<string>
      {...rest}
      displayEmpty={emptyLabel !== undefined || rest.displayEmpty}
      IconComponent={KeyboardArrowDownIcon}
      // Ancorado logo abaixo do campo (sem o salto do posicionamento padrão) e com a
      // MESMA densidade dos outros menus de Configurações — o popup de um seletor é um
      // `Menu` como qualquer outro, e sem isto as opções saíam em 16px dentro de um
      // campo de 13px.
      MenuProps={{ ...SETTINGS_SELECT_MENU_PROPS, ...rest.MenuProps }}
      sx={{
        height: SETTINGS_FIELD_HEIGHT,
        // NÃO estica por conta própria: dentro de uma célula quem quer a largura toda
        // passa o `fullWidth` do próprio MUI; numa faixa de controles (a toolbar de
        // Categorias) esticar empurrava os controles vizinhos para uma segunda linha.
        fontSize: SETTINGS_TABLE_FONT.field.size,
        // String em px: `borderRadius: 7` seria multiplicado por
        // `theme.shape.borderRadius` (8) e viraria 56px.
        borderRadius: `${radius.sm + 3}px`,
        "& .MuiSelect-select": {
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          // O padding do `size="small"` do tema é de formulário, não de linha.
          py: 0,
          pl: 1.25,
          minHeight: "unset !important",
        },
        "& .MuiSelect-icon": { fontSize: 16, color: "text.tertiary", right: 6 },
        ...sx,
      }}
    >
      {emptyLabel !== undefined && (
        <MenuItem value="" sx={SETTINGS_MENU_ITEM_SX}>
          <em style={{ fontStyle: "normal", opacity: 0.7 }}>{emptyLabel}</em>
        </MenuItem>
      )}
      {options.map((option) => (
        <MenuItem
          key={option.value}
          value={option.value}
          sx={{ ...SETTINGS_MENU_ITEM_SX, gap: 0.75 }}
        >
          {option.adornment}
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
}

/** Tipografia mono para as contagens/valores dentro da tabela. */
export const SETTINGS_MONO_SX = {
  fontFamily: typography.fontFamily.mono,
  fontSize: "0.75rem",
  color: "text.tertiary",
} as const;
