"use client";

import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";

import { m } from "@/lib/messages";
import { DENSITY_VAR } from "@/lib/table-density";

import { drawerSectionMeta } from "./drawerSections";

type Toggle = { open: boolean; onToggle: () => void };

type Props = {
  /** Toggle da seção de nota. `hasContent` mantém o ícone preenchido quando há
   *  nota mesmo com o painel fechado (a cor só acende com `open`). */
  note: Toggle & { hasContent: boolean };
  /** Toggle da seção de moeda estrangeira. */
  fx: Toggle;
  /** Toggle de vínculos — só na edição (a criação não tem vínculos). */
  links?: Toggle;
  /** Toggle de tags — só na edição; `null` quando a coluna de tags está oculta. */
  tags?: (Toggle & { hasContent: boolean }) | null;
  /** Botão "Criar apelido" à direita — só na edição. */
  onCreateAlias?: () => void;
  /** Ações Salvar/Cancelar — só na edição (a criação salva via Enter/✓ na própria
   *  linha). Ficam numa linha própria, junto dos toggles, para não competir por
   *  largura com os campos da linha de edição (bugfix layout — spec 66). */
  actions?: { onSave: () => void; onCancel: () => void };
  /** Cor de fundo da barra. Default `background.subtle` (edição, frame §5); a
   *  linha de criação passa `accent.primarySubtle` para manter a identidade
   *  visual de "novo" ao longo de toda a linha (frame §6). */
  bgcolor?: string;
};

// Ícones-gaveta (nota/câmbio/vínculos/tags): quadrados em `--ctrl-h` (Spec 69
// §7.2 — a barra de gavetas segue a MESMA densidade da linha), ícone 17px,
// ativo em accent.primary — spec 66 §5 item 4. `padding:0` porque o tamanho
// final é travado por width/height, não pelo padding interno do IconButton.
const DRAWER_BTN_SX = {
  width: DENSITY_VAR.controlHeight,
  height: DENSITY_VAR.controlHeight,
  padding: 0,
  borderRadius: "8px",
} as const;
const DRAWER_ICON_SX = { fontSize: 17 } as const;

/** Botões de texto da barra (criar apelido / cancelar / salvar) — mesma altura
 *  de controle dos ícones, para a barra inteira respirar na mesma densidade. */
const DRAWER_TEXT_BTN_SX = { height: DENSITY_VAR.controlHeight, borderRadius: "8px" } as const;

function drawerIconColor(active: boolean) {
  return active ? "accent.primary" : "text.secondary";
}

/**
 * Barra de ferramentas da gaveta de transação: toggles de seção (nota / câmbio /
 * vínculos / tags) + "Criar apelido" + Salvar/Cancelar. Compartilhada entre o
 * editor (`TransactionRowEditor`) e a criação (`NewTransactionRow`) para que as
 * duas fiquem idênticas — referência de design é o editor. Vínculos, tags, criar
 * apelido e Salvar/Cancelar são opcionais (não existem no modo criação, que salva
 * via Enter/✓ na própria linha).
 *
 * Fundo sempre `background.subtle` (spec 66 §5 item 4/8) — independe do modo
 * (edição/criação), que é sinalizado pela cor da linha acima, não pela barra.
 */
export function RowDrawerToolbar({
  note,
  fx,
  links,
  tags,
  onCreateAlias,
  actions,
  bgcolor = "background.subtle",
}: Props) {
  const noteLabel = note.open ? m.transactions.actions.hideNotes : m.transactions.actions.addNote;
  const noteMeta = drawerSectionMeta.notes;
  const fxMeta = drawerSectionMeta.fx;
  const linksMeta = drawerSectionMeta.links;
  const tagsMeta = drawerSectionMeta.tags;

  return (
    <TableRow>
      <TableCell colSpan={99} sx={{ p: 0, border: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            bgcolor,
            borderTop: "1px solid",
            borderColor: "border.subtle",
          }}
        >
          <Tooltip title={noteLabel}>
            <IconButton
              size="small"
              sx={{ ...DRAWER_BTN_SX, color: drawerIconColor(note.open) }}
              onClick={note.onToggle}
              aria-label={noteLabel}
            >
              {note.open || note.hasContent ? (
                <noteMeta.IconFilled sx={DRAWER_ICON_SX} />
              ) : (
                <noteMeta.Icon sx={DRAWER_ICON_SX} />
              )}
            </IconButton>
          </Tooltip>

          <Tooltip title={fxMeta.label}>
            <IconButton
              size="small"
              sx={{ ...DRAWER_BTN_SX, color: drawerIconColor(fx.open) }}
              onClick={fx.onToggle}
              aria-label={fxMeta.label}
            >
              <fxMeta.Icon sx={DRAWER_ICON_SX} />
            </IconButton>
          </Tooltip>

          {links && (
            <Tooltip title={linksMeta.label}>
              <IconButton
                size="small"
                sx={{ ...DRAWER_BTN_SX, color: drawerIconColor(links.open) }}
                onClick={links.onToggle}
                aria-label={linksMeta.label}
              >
                <linksMeta.Icon sx={DRAWER_ICON_SX} />
              </IconButton>
            </Tooltip>
          )}

          {tags && (
            <Tooltip title={tagsMeta.label}>
              <IconButton
                size="small"
                sx={{ ...DRAWER_BTN_SX, color: drawerIconColor(tags.open) }}
                onClick={tags.onToggle}
                aria-label={tagsMeta.label}
              >
                {tags.open || tags.hasContent ? (
                  <tagsMeta.IconFilled sx={DRAWER_ICON_SX} />
                ) : (
                  <tagsMeta.Icon sx={DRAWER_ICON_SX} />
                )}
              </IconButton>
            </Tooltip>
          )}

          <Box sx={{ flex: 1 }} />

          {onCreateAlias && (
            <Button
              variant="text"
              color="inherit"
              onClick={onCreateAlias}
              startIcon={<BookmarkAddOutlinedIcon sx={{ fontSize: 15 }} />}
              sx={{
                ...DRAWER_TEXT_BTN_SX,
                px: "8px",
                fontWeight: 400,
                fontSize: "0.76rem",
                color: "text.secondary",
                "& .MuiButton-startIcon": { marginRight: "5px", marginLeft: 0 },
              }}
            >
              {m.transactions.actions.createAlias}
            </Button>
          )}

          {actions && (
            <>
              <Button
                variant="text"
                color="inherit"
                onClick={actions.onCancel}
                sx={{
                  ...DRAWER_TEXT_BTN_SX,
                  px: "12px",
                  fontWeight: 500,
                  fontSize: "0.78rem",
                  color: "text.secondary",
                }}
              >
                {m.transactions.actions.cancel}
              </Button>
              <Button
                variant="text"
                onClick={actions.onSave}
                sx={{
                  ...DRAWER_TEXT_BTN_SX,
                  px: "14px",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  bgcolor: "accent.primary",
                  color: "background.canvas",
                  "&:hover": { bgcolor: "accent.primaryHover" },
                }}
              >
                {m.transactions.actions.save}
              </Button>
            </>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
}
