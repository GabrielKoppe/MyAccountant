"use client";

import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
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
  /**
   * Gatilho do apelido que casou com a descrição. Quando informado, o cabeçalho
   * nomeia o apelido — `Apelido "NETFLIX"` (frame §11) — em vez do rótulo genérico.
   */
  trigger?: string | null;
};

/**
 * Preview do que aplicar o APELIDO casado faz na linha (Spec 66 §11). Container
 * fixo de 340px, três zonas: header (ícone + rótulo), corpo em linhas
 * `rótulo → valor novo` (o valor antigo não aparece — só o campo e o valor que
 * a aplicação vai gravar) e footer com "Agora não" / "Aplicar" em botões
 * pequenos (h30).
 */
export function SuggestionPopover({ anchorEl, changes, onApply, onClose, trigger }: Props) {
  const headerLabel = trigger
    ? m.transactions.aliasSuggestion.headerWithTrigger(trigger)
    : m.transactions.aliasSuggestion.header;
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
          "aria-label": headerLabel,
          sx: {
            mt: 0.5,
            width: 340,
            border: 1,
            borderColor: "border.subtle",
            borderRadius: 1.25, // 10px (shape.borderRadius=8 × 1.25)
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
      {/* Header — ícone + rótulo, sem faixa de fundo própria (mesma superfície do popover) */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "border.subtle" }}
      >
        <AutoFixHighOutlinedIcon sx={{ fontSize: 17, color: "accent.primary", flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 600, fontSize: "0.82rem", color: "text.primary" }}>
          {headerLabel}
        </Typography>
      </Stack>

      {/* Corpo — uma linha por campo: rótulo → valor novo (o valor atual não é
          exibido; a seta só indica "vai virar isto"), ou aviso de que nada se
          aplica. Scroll no próprio Box: a barra encosta na borda do paper e o
          padding vira folga entre conteúdo e barra. */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1.75,
          maxHeight: 340,
          overflowY: "auto",
        }}
      >
        {hasChanges ? (
          changes.map((change) => (
            <Box
              key={change.field}
              sx={{ display: "flex", alignItems: "center", gap: 2, fontSize: "0.78rem" }}
            >
              <Box component="span" sx={{ width: 80, flexShrink: 0, color: "text.tertiary" }}>
                {change.label}
              </Box>
              <ArrowRightAltIcon sx={{ fontSize: 16, color: "text.disabled", flexShrink: 0 }} />
              <Box
                component="span"
                sx={{
                  color: "text.primary",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {change.newDisplay}
              </Box>
            </Box>
          ))
        ) : (
          <Typography variant="body2" sx={{ color: "text.secondary", fontSize: 12 }}>
            {m.transactions.aliasSuggestion.noApplicableFields}
          </Typography>
        )}
      </Box>

      {/* Footer — botões pequenos (h30), alinhados à direita */}
      <Stack
        direction="row"
        spacing={1}
        justifyContent="flex-end"
        sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: "border.subtle" }}
      >
        <Button
          variant="text"
          onClick={onClose}
          sx={{
            height: 30,
            px: 1.5,
            fontWeight: 500,
            fontSize: "0.78rem",
            color: "text.secondary",
          }}
        >
          {m.transactions.aliasSuggestion.cancelButton}
        </Button>
        <Button
          variant="contained"
          onClick={onApply}
          disabled={!hasChanges}
          sx={{ height: 30, px: 1.75, fontWeight: 600, fontSize: "0.78rem" }}
        >
          {m.transactions.aliasSuggestion.applyButton}
        </Button>
      </Stack>
    </Popover>
  );
}
