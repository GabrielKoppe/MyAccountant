"use client";

import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import LabelIcon from "@mui/icons-material/Label";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import NoteIcon from "@mui/icons-material/Note";
import NoteOutlinedIcon from "@mui/icons-material/NoteOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";

import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

type Toggle = { open: boolean; onToggle: () => void };

type Props = {
  /** Fundo da célula — casa com o fundo das linhas do modo:
   *  `action.selected` na edição, `action.hover` na criação. */
  bgcolor: string;
  /** Toggle da seção de nota. `hasContent` mantém o ícone preenchido quando há
   *  nota mesmo com o painel fechado (o `color` só acende quando aberto). */
  note: Toggle & { hasContent: boolean };
  /** Toggle da seção de moeda estrangeira. */
  fx: Toggle;
  /** Toggle de vínculos — só na edição (a criação não tem vínculos). */
  links?: Toggle;
  /** Toggle de tags — só na edição; `null` quando a coluna de tags está oculta. */
  tags?: (Toggle & { hasContent: boolean }) | null;
  /** Botão "Criar apelido" à direita — só na edição. */
  onCreateAlias?: () => void;
};

const BTN_SX = { p: 1, minWidth: 32, minHeight: 32 } as const;
const ICON_SX = { fontSize: 16 } as const;

/**
 * Barra de ferramentas da gaveta de transação: toggles de seção (nota / câmbio /
 * vínculos / tags) + "Criar apelido". Compartilhada entre o editor
 * (`TransactionRowEditor`) e a criação (`NewTransactionRow`) para que as duas
 * fiquem idênticas — referência de design é o editor. Vínculos, tags e criar
 * apelido são opcionais (não existem no modo criação).
 */
export function RowDrawerToolbar({ bgcolor, note, fx, links, tags, onCreateAlias }: Props) {
  const noteLabel = note.open ? m.transactions.actions.hideNotes : m.transactions.actions.addNote;

  return (
    <TableRow>
      <TableCell colSpan={99} sx={{ py: 0.5, border: 0, bgcolor }}>
        <Stack direction="row" spacing={layout.inline} alignItems="center" sx={{ px: 2 }}>
          <Tooltip title={noteLabel}>
            <IconButton
              size="small"
              sx={BTN_SX}
              onClick={note.onToggle}
              aria-label={noteLabel}
              color={note.open ? "primary" : "default"}
            >
              {note.open || note.hasContent ? (
                <NoteIcon sx={ICON_SX} />
              ) : (
                <NoteOutlinedIcon sx={ICON_SX} />
              )}
            </IconButton>
          </Tooltip>

          <Tooltip title={m.transactions.foreignCurrency.label}>
            <IconButton
              size="small"
              sx={BTN_SX}
              onClick={fx.onToggle}
              aria-label={m.transactions.foreignCurrency.label}
              color={fx.open ? "primary" : "default"}
            >
              <CurrencyExchangeOutlinedIcon sx={ICON_SX} />
            </IconButton>
          </Tooltip>

          {links && (
            <Tooltip title={m.transactions.links.title}>
              <IconButton
                size="small"
                sx={BTN_SX}
                onClick={links.onToggle}
                aria-label={m.transactions.links.title}
                color={links.open ? "primary" : "default"}
              >
                <LinkOutlinedIcon sx={ICON_SX} />
              </IconButton>
            </Tooltip>
          )}

          {tags && (
            <Tooltip title={m.transactions.tags.editTitle}>
              <IconButton
                size="small"
                sx={BTN_SX}
                onClick={tags.onToggle}
                aria-label={m.transactions.tags.editTitle}
                color={tags.open || tags.hasContent ? "primary" : "default"}
              >
                {tags.open || tags.hasContent ? (
                  <LabelIcon sx={ICON_SX} color="inherit" />
                ) : (
                  <LabelOutlinedIcon sx={ICON_SX} />
                )}
              </IconButton>
            </Tooltip>
          )}

          {onCreateAlias && (
            <>
              <Box sx={{ flex: 1 }} />
              <Button
                variant="text"
                size="small"
                color="inherit"
                startIcon={<BookmarkAddOutlinedIcon color="inherit" sx={ICON_SX} />}
                onClick={onCreateAlias}
                sx={{
                  textTransform: "none",
                  fontSize: 12,
                  px: 2,
                  py: 1,
                  fontWeight: 400,
                  color: "text.secondary",
                }}
              >
                {m.transactions.actions.createAlias}
              </Button>
            </>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
}
