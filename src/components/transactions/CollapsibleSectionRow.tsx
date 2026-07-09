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
export function CollapsibleSectionRow({ open, bgcolor, label, action, timeout, children }: Props) {
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
