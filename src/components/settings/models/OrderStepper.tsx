"use client";

import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { m } from "@/lib/messages";

const d = m.settings.presentation.models.definition;

export type OrderStepperProps = {
  /** Posição atual, 1-based — é o que o rótulo mostra ("1ª de 2"). */
  position: number;
  total: number;
  /** `delta` é −1 (subir) ou +1 (descer); o chamador aplica ao rascunho. */
  onMove: (delta: -1 | 1) => void;
  disabled?: boolean;
};

/**
 * "Ordem dentro da seção" (frame 06): ↑ ↓ e a posição em texto.
 *
 * Dois botões e um rótulo, e não um `Select` de números: a pergunta do usuário é
 * "antes ou depois do outro modelo?", não "qual inteiro?". O número absoluto não
 * significa nada sozinho — por isso o rótulo é sempre "Nª de M".
 */
export function OrderStepper({ position, total, onMove, disabled = false }: OrderStepperProps) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <IconButton
        size="small"
        aria-label={d.orderUp}
        onClick={() => onMove(-1)}
        disabled={disabled || position <= 1}
        sx={{ p: 0.25, border: 1, borderColor: "border.subtle", borderRadius: "6px" }}
      >
        <KeyboardArrowUpIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <IconButton
        size="small"
        aria-label={d.orderDown}
        onClick={() => onMove(1)}
        disabled={disabled || position >= total}
        sx={{ p: 0.25, border: 1, borderColor: "border.subtle", borderRadius: "6px" }}
      >
        <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
      </IconButton>
      {/* `text.tertiary`, nunca `text.disabled`: a posição É a informação do campo. */}
      <Typography variant="body2" sx={{ color: "text.tertiary" }}>
        {d.orderPosition(position, total)}
      </Typography>
    </Stack>
  );
}
