"use client";

import TablePagination from "@mui/material/TablePagination";

import { m } from "@/lib/messages";

/** Spec 67 §4 (SET-04) — escala padrão das listas de configurações. */
const DEFAULT_ROWS_PER_PAGE_OPTIONS = [20, 50, 100];

type Props = {
  /** Total de itens da lista (não o total da página). */
  count: number;
  /** Página atual, 0-based — mesma convenção do `TablePagination` do MUI. */
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  rowsPerPageOptions?: number[];
};

/**
 * Controle de paginação das listas longas de Configurações (Spec 67 §4 SET-04, D14).
 *
 * O **estado** (página atual, itens por página, fatiamento) é de cada página — depende
 * da fonte de dados, que o shell não conhece. Esta primitiva é só o controle, para que
 * Apelidos (Spec 70) e as demais listas acima de 50 itens não reimplementem os mesmos
 * rótulos em pt-BR nem a mesma densidade.
 *
 * Normaliza a API do MUI, que entrega `(event, page)` e um evento de input, para os
 * callbacks de um argumento — assim a página recebe números, não eventos.
 */
export function SettingsPagination({
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = DEFAULT_ROWS_PER_PAGE_OPTIONS,
}: Props) {
  return (
    <TablePagination
      // A lista pode ser um <Stack> de cards, não um <table>: sem `component="div"`
      // o MUI renderiza um <td> órfão e o HTML fica inválido.
      component="div"
      count={count}
      page={page}
      rowsPerPage={rowsPerPage}
      rowsPerPageOptions={rowsPerPageOptions}
      labelRowsPerPage={m.settings.shell.pagination.rowsPerPage}
      labelDisplayedRows={m.settings.shell.pagination.displayedRows}
      getItemAriaLabel={m.settings.shell.pagination.itemAriaLabel}
      onPageChange={(_event, nextPage) => onPageChange(nextPage)}
      onRowsPerPageChange={(event) => onRowsPerPageChange(parseInt(event.target.value, 10))}
      // A raiz do TablePagination é um TableCell: herda a borda e o padding do
      // override de MuiTableCell do tema. Quem posiciona é a página, não o controle.
      sx={{ borderBottom: 0, p: 0 }}
    />
  );
}
