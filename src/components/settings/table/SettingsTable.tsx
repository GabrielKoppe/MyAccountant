"use client";

import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell, { type TableCellProps } from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow, { type TableRowProps } from "@mui/material/TableRow";
import type { ReactNode } from "react";

import { typography } from "@/lib/design-tokens";

import {
  SETTINGS_CELL_PADDING,
  SETTINGS_GRIP_WIDTH,
  SETTINGS_HEAD_HEIGHT,
  SETTINGS_MENU_WIDTH,
  SETTINGS_ROW_HEIGHT,
  SETTINGS_TABLE_FONT,
} from "./settings-table-tokens";

/**
 * A tabela das quatro páginas da família Estrutura (Spec 68, revisão de estilo).
 *
 * **Uma tabela, quatro páginas.** Seções, Categorias, Instituições e Responsáveis têm
 * colunas diferentes e nada mais: mesma altura de linha, mesmo cabeçalho, mesmos
 * ícones, mesmos campos em edição. Este módulo é o lugar onde isso é decidido — a
 * página declara suas colunas e o conteúdo das células, e não repinta a moldura.
 *
 * O que o componente resolve e que estava divergindo:
 *  - o cabeçalho encosta na faixa de cima (sem vão) e é curto;
 *  - a linha tem a densidade do frame, não os 55px do override global do tema;
 *  - a coluna da alça não leva padding, então o grip cola no nome;
 *  - o scroll é DAQUI: o cabeçalho da página fica parado e só o corpo rola.
 *
 * `fillHeight` liga o modo "o corpo rola sozinho". Use quando a página entrega a
 * tabela como último elemento de uma coluna com altura definida (é o caso das quatro).
 */
export type SettingsTableProps = {
  /** `colgroup` — a largura de cada coluna, na ordem. `undefined` = coluna elástica. */
  columns?: Array<number | string | undefined>;
  /** Cabeçalho: use `SettingsHeadCell`. */
  head: ReactNode;
  children: ReactNode;
  /**
   * Prega o cabeçalho de coluna no topo enquanto as linhas rolam.
   *
   * Quem rola é a área de conteúdo do `SettingsPageShell` (o cabeçalho da PÁGINA fica
   * parado). A tabela NÃO cria um segundo scroll: dois contêineres roláveis aninhados
   * dão duas barras e o teclado nunca sabe qual delas mover.
   */
  stickyHead?: boolean;
  /** Rótulo acessível da tabela — uma lista de configuração sem nome é só "tabela". */
  ariaLabel: string;
};

export function SettingsTable({
  columns,
  head,
  children,
  stickyHead = true,
  ariaLabel,
}: SettingsTableProps) {
  return (
    <TableContainer
      sx={{
        // Ocupa a largura toda: o frame não tem tabela mais estreita que o painel.
        width: "100%",
        // `visible`, não `auto`: o scroll é da área de conteúdo do shell. Um
        // `overflow` aqui criaria um segundo contêiner rolável e mataria o
        // `position: sticky` do cabeçalho de coluna.
        overflow: "visible",
      }}
    >
      <Table
        aria-label={ariaLabel}
        // `fixed`: as larguras do `colgroup` mandam, e o conteúdo de uma célula não
        // reorganiza a tabela inteira ao entrar em edição.
        sx={{ tableLayout: "fixed", width: "100%" }}
      >
        {columns && (
          <colgroup>
            {columns.map((width, index) => (
               
              <col key={index} style={width === undefined ? undefined : { width }} />
            ))}
          </colgroup>
        )}
        <TableHead
          sx={
            stickyHead
              ? {
                  position: "sticky",
                  top: 0,
                  // Acima das linhas que passam por baixo dele ao rolar.
                  zIndex: 2,
                }
              : undefined
          }
        >
          <TableRow>{head}</TableRow>
        </TableHead>
        <TableBody>{children}</TableBody>
      </Table>
    </TableContainer>
  );
}

/**
 * Célula de cabeçalho de coluna.
 *
 * Mono, minúscula, caixa alta, fundo mais escuro que as linhas e letra mais clara que
 * o rótulo esmaecido do tema — é o que dá ao cabeçalho o peso de "faixa de estrutura"
 * em vez de "primeira linha da lista". `borderTop: 0` de propósito: ele encosta na
 * faixa de cima (toolbar ou cabeçalho da página) sem vão.
 */
export function SettingsHeadCell({ children, sx, ...rest }: TableCellProps) {
  return (
    <TableCell
      {...rest}
      sx={{
        height: SETTINGS_HEAD_HEIGHT,
        px: SETTINGS_CELL_PADDING.x,
        py: 0,
        // Mais escuro que a linha (que fica em `background.surface`).
        bgcolor: "background.canvas",
        color: "text.secondary",
        fontFamily: typography.fontFamily.mono,
        fontSize: SETTINGS_TABLE_FONT.head.size,
        fontWeight: SETTINGS_TABLE_FONT.head.weight,
        letterSpacing: SETTINGS_TABLE_FONT.head.letterSpacing,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        borderTop: 0,
        ...sx,
      }}
    >
      {children}
    </TableCell>
  );
}

/** Célula de dados. Densidade do frame; nada de `padding` do override global. */
export function SettingsCell({ children, sx, ...rest }: TableCellProps) {
  return (
    <TableCell
      {...rest}
      sx={{
        px: SETTINGS_CELL_PADDING.x,
        py: SETTINGS_CELL_PADDING.y,
        fontSize: SETTINGS_TABLE_FONT.row.size,
        ...sx,
      }}
    >
      {children}
    </TableCell>
  );
}

/**
 * Célula da alça de arraste — **sem padding horizontal**, para o grip encostar no nome.
 * O vão de 32px que existia vinha dos 16px de padding do tema em cada lado.
 */
export function SettingsGripCell({ children, sx, ...rest }: TableCellProps) {
  return (
    <TableCell
      {...rest}
      sx={{
        width: SETTINGS_GRIP_WIDTH,
        px: 0,
        py: SETTINGS_CELL_PADDING.y,
        // O ícone fica encostado à direita da célula, colado na coluna seguinte.
        textAlign: "right",
        ...sx,
      }}
    >
      {children}
    </TableCell>
  );
}

/** Célula do menu da linha (elipses), estreita e alinhada à direita. */
export function SettingsMenuCell({ children, sx, ...rest }: TableCellProps) {
  return (
    <TableCell
      {...rest}
      align="right"
      sx={{
        width: SETTINGS_MENU_WIDTH,
        px: 0.5,
        py: SETTINGS_CELL_PADDING.y,
        ...sx,
      }}
    >
      {children}
    </TableCell>
  );
}

export type SettingsRowProps = TableRowProps & {
  /**
   * Marca a linha como "em edição": faixa lateral em accent + fundo destacado.
   *
   * O frame usa essa marca em TODAS as páginas (`border-left: 2px solid accent` +
   * `background: subtle`); antes só Instituições a tinha, e nas outras não havia como
   * saber qual linha estava aberta.
   */
  editing?: boolean;
  /** Linha de sub-nível (subcategoria): fundo levemente distinto. */
  nested?: boolean;
};

/**
 * Linha de dados.
 *
 * `height` fixa é o que impede a linha de crescer quando as células trocam texto por
 * campo — o motivo de a edição inline "engordar" a tabela antes. Os campos têm altura
 * menor que a linha (ver `SETTINGS_FIELD_HEIGHT`), então cabem sem empurrar nada.
 */
export function SettingsRow({ editing, nested, sx, children, ...rest }: SettingsRowProps) {
  return (
    <TableRow
      {...rest}
      sx={{
        height: SETTINGS_ROW_HEIGHT,
        ...(nested ? { bgcolor: "background.subtle" } : {}),
        ...(editing
          ? {
              bgcolor: "background.subtle",
              // Longhand: o shorthand `borderLeft` dentro de qualquer valor
              // responsivo reseta `border-left-color` para `currentColor`, e a faixa
              // sai na cor do texto. Ver skills/design-system.
              "& > td:first-of-type": {
                borderLeftWidth: "2px",
                borderLeftStyle: "solid",
                borderLeftColor: "accent.primary",
              },
            }
          : {}),
        ...sx,
      }}
    >
      {children}
    </TableRow>
  );
}
