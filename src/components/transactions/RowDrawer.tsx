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
import type { CollapseProps } from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";

import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

import { CollapsibleSectionRow } from "./CollapsibleSectionRow";

type Section = { open: boolean; onToggle: () => void; content: React.ReactNode };
type NoteSection = Section & { hasContent: boolean };
type FxSection = Section & { timeout?: CollapseProps["timeout"] };
type LinksSection = Section & { action?: React.ReactNode };
type TagsSection = Section & { hasContent: boolean };

type Props = {
  /** Fundo da toolbar e das linhas — casa com o modo:
   *  `action.selected` na edição, `action.hover` na criação. */
  bgcolor: string;
  note: NoteSection;
  fx: FxSection;
  /** Só na edição — vínculo exige transação já salva. */
  links?: LinksSection;
  /** Só na edição — `null` quando a coluna de tags está oculta. */
  tags?: TagsSection | null;
  /** Só na edição — botão "Criar apelido" à direita da toolbar. */
  onCreateAlias?: () => void;
};

const BTN_SX = { p: 1, minWidth: 32, minHeight: 32 } as const;
const ICON_SX = { fontSize: 16 } as const;

/**
 * Gaveta completa da linha de transação: a barra de toggles de seção + as linhas
 * colapsáveis de cada seção, num único componente compartilhado entre o editor
 * (`TransactionRowEditor`) e a criação (`NewTransactionRow`). O conteúdo de cada
 * seção (os inputs) vem do pai via `content`, pois é ligado ao estado de cada
 * modo. Vínculos e tags só existem no editor (a criação não os passa, porque
 * exigem uma transação já salva). Ordem: nota · câmbio · vínculos · tags.
 */
export function RowDrawer({ bgcolor, note, fx, links, tags, onCreateAlias }: Props) {
  const noteLabel = note.open ? m.transactions.actions.hideNotes : m.transactions.actions.addNote;

  return (
    <>
      {/* Barra de ferramentas — toggles de seção + criar apelido */}
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

      {/* Linhas colapsáveis de cada seção */}
      <CollapsibleSectionRow open={note.open} bgcolor={bgcolor} label={m.transactions.fields.notes}>
        {note.content}
      </CollapsibleSectionRow>

      <CollapsibleSectionRow
        open={fx.open}
        bgcolor={bgcolor}
        label={m.transactions.foreignCurrency.label}
        timeout={fx.timeout}
      >
        {fx.content}
      </CollapsibleSectionRow>

      {links && (
        <CollapsibleSectionRow
          open={links.open}
          bgcolor={bgcolor}
          label={m.transactions.links.title}
          action={links.action}
        >
          {links.content}
        </CollapsibleSectionRow>
      )}

      {tags && (
        <CollapsibleSectionRow
          open={tags.open}
          bgcolor={bgcolor}
          label={m.transactions.tags.editTitle}
        >
          {tags.content}
        </CollapsibleSectionRow>
      )}
    </>
  );
}
