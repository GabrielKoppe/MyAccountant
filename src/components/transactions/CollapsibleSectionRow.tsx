"use client";

import Collapse from "@mui/material/Collapse";
import type { CollapseProps } from "@mui/material/Collapse";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";

import SectionDrawer from "./SectionDrawer";

type Props = {
  /** Se a seção está expandida. */
  open: boolean;
  /** Fundo da linha — casa com o modo: `action.selected` na edição,
   *  `action.hover` na criação. */
  bgcolor: string;
  label: string;
  /**
   * @deprecated Frame 66 §7 — a gaveta não repete mais o ícone da seção no
   * cabeçalho (ele já vive no toggle da barra de ferramentas). Prop ignorada
   * (não é mais repassada ao `SectionDrawer`); mantida só para não quebrar os
   * call sites de `TransactionRowEditor`/`NewTransactionRow`, que ainda
   * passam `icon`. Remover de lá quando esses arquivos forem tocados.
   */
  icon?: React.ReactNode;
  /** Ação opcional à direita do rótulo (ex.: contador + "vincular"). */
  action?: React.ReactNode;
  /** Override do timeout do Collapse (ex.: câmbio no editor). */
  timeout?: CollapseProps["timeout"];
  children: React.ReactNode;
};

/**
 * Linha colapsável de seção da gaveta de transação:
 * `TableRow > TableCell (colSpan) > Collapse > SectionDrawer`.
 * Compartilhada entre `TransactionRowEditor` e `NewTransactionRow` para não
 * duplicar o boilerplate por seção. O conteúdo (inputs) vem via `children`.
 */
export function CollapsibleSectionRow({
  open,
  bgcolor,
  label,
  action,
  timeout,
  children,
}: Props) {
  return (
    <TableRow sx={{ bgcolor }}>
      <TableCell colSpan={99} sx={{ p: 0, border: 0 }}>
        <Collapse in={open} unmountOnExit timeout={timeout}>
          <SectionDrawer label={label} action={action}>
            {children}
          </SectionDrawer>
        </Collapse>
      </TableCell>
    </TableRow>
  );
}
