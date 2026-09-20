"use client";

import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import { m } from "@/lib/messages";
import { DENSITY_VAR } from "@/lib/table-density";

type Props = {
  /** Se a gaveta de leitura da linha está expandida. */
  open: boolean;
  onClick: () => void;
};

// `--ctrl-h` quadrado (28px em densidade padrão) / ícone 16px — mesmo tamanho
// do cluster de ações da linha (favorito/pendente/⋮ em TransactionRowActions),
// para o chevron ficar realmente colado no ⋮ com gap 2px (spec 66 · Fidelidade,
// item 4/1). Sem `mr` embutido: o espaçamento do cluster é responsabilidade de
// quem posiciona o chevron (TransactionRowActions), não deste componente.
const BTN_SX = {
  p: 0.5,
  minWidth: DENSITY_VAR.controlHeight,
  minHeight: DENSITY_VAR.controlHeight,
} as const;
const ICON_SX = { fontSize: 16 } as const;

/** Chevron de expandir/colapsar a gaveta de leitura da linha (spec 66 TX-03b) —
 * substitui o indicador de anexos `📎N` (`AttachmentIndicator`), preservando a
 * mesma abertura/fechamento da gaveta. */
export function RowDrawerChevron({ open, onClick }: Props) {
  const label = open ? m.transactions.attachments.collapse : m.transactions.attachments.expand;

  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        aria-expanded={open}
        onClick={onClick}
        sx={{ ...BTN_SX, color: "text.secondary" }}
      >
        {open ? <ExpandLessIcon sx={ICON_SX} /> : <ExpandMoreIcon sx={ICON_SX} />}
      </IconButton>
    </Tooltip>
  );
}
