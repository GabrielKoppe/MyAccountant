// Fonte única de rótulo/ícone/ordem das seções da gaveta de transação — spec 66
// TX-03b. Consumida pela gaveta de leitura (`TransactionRowDetails`), pela barra
// de ferramentas da edição (`RowDrawerToolbar`) e pelos cabeçalhos dos
// colapsáveis do editor/criação (`TransactionRowEditor`/`NewTransactionRow`),
// para que as três superfícies fiquem visualmente reconciliadas.

import type { SvgIconComponent } from "@mui/icons-material";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import LabelIcon from "@mui/icons-material/Label";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import LinkIcon from "@mui/icons-material/Link";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import NoteIcon from "@mui/icons-material/Note";
import NoteOutlinedIcon from "@mui/icons-material/NoteOutlined";
import PaymentsIcon from "@mui/icons-material/Payments";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";

import { m } from "@/lib/messages";

/** Chave canônica de cada seção da gaveta de transação (leitura e edição). */
export type DrawerSectionKey = "notes" | "fx" | "links" | "tags" | "installment";

/** Ordem canônica das seções da gaveta — a mesma na leitura
 * (`TransactionRowDetails`) e na edição (`RowDrawerToolbar`/`TransactionRowEditor`). */
export const DRAWER_SECTION_ORDER: readonly DrawerSectionKey[] = [
  "notes",
  "fx",
  "links",
  "tags",
  "installment",
];

export type DrawerSectionMeta = {
  label: string;
  /** Ícone padrão — seção fechada e sem conteúdo. */
  Icon: SvgIconComponent;
  /** Ícone preenchido — seção aberta ou já com conteúdo. */
  IconFilled: SvgIconComponent;
};

export const drawerSectionMeta: Record<DrawerSectionKey, DrawerSectionMeta> = {
  notes: {
    label: m.transactions.fields.notes,
    Icon: NoteOutlinedIcon,
    IconFilled: NoteIcon,
  },
  fx: {
    label: m.transactions.foreignCurrency.label,
    Icon: CurrencyExchangeOutlinedIcon,
    IconFilled: CurrencyExchangeIcon,
  },
  links: {
    label: m.transactions.links.title,
    Icon: LinkOutlinedIcon,
    IconFilled: LinkIcon,
  },
  tags: {
    label: m.transactions.tags.editTitle,
    Icon: LabelOutlinedIcon,
    IconFilled: LabelIcon,
  },
  installment: {
    label: m.transactions.installments.column,
    Icon: PaymentsOutlinedIcon,
    IconFilled: PaymentsIcon,
  },
};
