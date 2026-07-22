"use client";

import ArrowRightAltRoundedIcon from "@mui/icons-material/ArrowRightAltRounded";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { SuggestionFieldChange } from "@/lib/aliases/apply";
import { m } from "@/lib/messages";

type Props = {
  anchorEl: HTMLElement | null;
  changes: SuggestionFieldChange[];
  onApply: () => void;
  onClose: () => void;
};

/**
 * Preview do que aplicar o APELIDO casado faz na linha. Acabamento espelha o
 * popper do CreatableEntitySelect (borda `border.default` + radius md + sem
 * sombra), com três zonas: header off-white ("Sugestões"), corpo com os diffs
 * `antigo → novo` por campo, e footer com ações 50/50.
 */
export function SuggestionPopover({ anchorEl, changes, onApply, onClose }: Props) {
  const hasChanges = changes.length > 0;

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{
        paper: {
          "aria-label": m.transactions.aliasSuggestion.header,
          sx: {
            mt: 0.5,
            // Largura dirigida pelo conteúdo (igual ao popper do CreatableEntitySelect):
            // piso confortável para o footer de 2 botões, teto para não vazar a viewport.
            width: "fit-content",
            minWidth: 280,
            maxWidth: 400,
            border: 1,
            borderColor: "border.default",
            borderRadius: 1, // radius.md (8px) — igual ao popper do CreatableEntitySelect
            boxShadow: "none", // DS: bordas, não sombras
            overflow: "hidden", // clipa header/footer ao radius
          },
        },
      }}
      onKeyDown={(e) => {
        // Enter/Escape não podem borbulhar até o onKeyDown da TableRow (Salvar/Cancelar).
        if (e.key === "Enter" || e.key === "Escape") e.stopPropagation();
      }}
      // O popover é filho (na árvore React) da célula de descrição, que no modo
      // visualização tem onClick={startEdit}. Sem isto, clicar em "Aplicar" borbulha
      // e abre a edição indevidamente (DD-23). Cliques internos ficam contidos.
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header — faixa off-white com o rótulo genérico de sugestões */}
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: "background.subtle",
          borderBottom: 1,
          borderColor: "border.subtle",
        }}
      >
        <AutoFixHighOutlinedIcon sx={{ fontSize: 20, color: "accent.primary", flexShrink: 0 }} />
        <Typography variant="subtitle2" sx={{ lineHeight: 1.3, color: "text.primary" }}>
          {m.transactions.aliasSuggestion.header}
        </Typography>
      </Stack>

      {/* Corpo — diffs por campo, ou aviso de que nada se aplica. Scroll no
          próprio Box (não no Stack interno): a barra encosta na borda do paper e
          o padding vira folga entre conteúdo e barra. */}
      <Box sx={{ px: 2, py: 1.5, maxHeight: 340, overflowY: "auto" }}>
        {hasChanges ? (
          <Stack spacing={1.5}>
            {changes.map((change) => (
              <Box key={change.field}>
                <Typography
                  variant="caption"
                  sx={{ color: "text.tertiary", display: "block", mb: 0.25 }}
                >
                  {change.label}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: 12 }}>
                  <Box
                    component="span"
                    sx={{ color: "text.secondary", textDecoration: "line-through" }}
                  >
                    {change.oldDisplay}
                  </Box>
                  <ArrowRightAltRoundedIcon
                    sx={{ fontSize: 16, mx: 0.5, color: "text.tertiary", verticalAlign: "middle" }}
                  />
                  <Box component="span" sx={{ color: "text.primary", fontWeight: 500 }}>
                    {change.newDisplay}
                  </Box>
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ color: "text.secondary", fontSize: 12 }}>
            {m.transactions.aliasSuggestion.noApplicableFields}
          </Typography>
        )}
      </Box>

      {/* Footer — ações 50/50 separadas por borda */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: "border.subtle", "& > *": { flex: 1 } }}
      >
        <Button size="small" variant="outlined" onClick={onClose}>
          {m.transactions.aliasSuggestion.cancelButton}
        </Button>
        <Button size="small" variant="contained" onClick={onApply} disabled={!hasChanges}>
          {m.transactions.aliasSuggestion.applyButton}
        </Button>
      </Stack>
    </Popover>
  );
}
