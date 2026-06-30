"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useState } from "react";

import { formatCentsToBrl } from "@/lib/money";
import type { InstallmentSuggestion } from "@/lib/installment-detector";

type Props = {
  suggestions: InstallmentSuggestion[];
  acceptedIds: Set<string>;
  onToggle: (id: string) => void;
};

export function InstallmentDetectionSection({ suggestions, acceptedIds, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (suggestions.length === 0) return null;

  const acceptedCount = suggestions.filter((s) => acceptedIds.has(s.id)).length;

  return (
    <Box
      sx={{
        mt: 2,
        border: 1,
        borderColor: "accent.primary",
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1,
          bgcolor: "accent.primarySubtle",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Typography variant="body2" fontWeight={600} color="accent.primary" sx={{ flex: 1 }}>
          Parcelamentos detectados
        </Typography>
        <Chip
          label={`${suggestions.length} sugestão${suggestions.length !== 1 ? "ões" : ""}`}
          size="small"
          sx={{
            height: 20,
            fontSize: 11,
            bgcolor: "accent.primary",
            color: "white",
            "& .MuiChip-label": { px: 0.75 },
          }}
        />
        {acceptedCount > 0 && (
          <Chip
            label={`${acceptedCount} confirmada${acceptedCount !== 1 ? "s" : ""}`}
            size="small"
            sx={{ height: 20, fontSize: 11, "& .MuiChip-label": { px: 0.75 } }}
          />
        )}
        <ExpandMoreIcon
          sx={{
            fontSize: 18,
            color: "accent.primary",
            transition: "transform 0.2s",
            transform: expanded ? "rotate(180deg)" : "none",
          }}
        />
      </Box>

      <Collapse in={expanded}>
        <Stack divider={<Divider />} spacing={0}>
          {/* Instrução */}
          <Alert severity="info" sx={{ borderRadius: 0, fontSize: 12, py: 0.5 }}>
            Confirme os agrupamentos abaixo para vincular as transações ao mesmo grupo de parcelas.
            Sugestões de alta confiança (✓/✓ em azul) são pré-marcadas.
          </Alert>

          {suggestions.map((suggestion) => (
            <Box
              key={suggestion.id}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
                px: 2,
                py: 1.25,
                bgcolor: acceptedIds.has(suggestion.id) ? "background.subtle" : "transparent",
              }}
            >
              <Checkbox
                size="small"
                checked={acceptedIds.has(suggestion.id)}
                onChange={() => onToggle(suggestion.id)}
                sx={{ p: 0.25, mt: 0.25 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="body2" fontWeight={500} sx={{ textTransform: "capitalize" }}>
                    {suggestion.groupDescription || "Parcelamento"}
                  </Typography>
                  <Chip
                    label={`${suggestion.lines.length}/${suggestion.installmentCount} parcelas`}
                    size="small"
                    sx={{ height: 18, fontSize: 10, "& .MuiChip-label": { px: 0.75 } }}
                  />
                  <Chip
                    label={suggestion.confidence === "high" ? "Alta confiança" : "Verificar"}
                    size="small"
                    color={suggestion.confidence === "high" ? "primary" : "default"}
                    variant="outlined"
                    sx={{ height: 18, fontSize: 10, "& .MuiChip-label": { px: 0.75 } }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
                  Total: {formatCentsToBrl(suggestion.totalAmountCents)} · {suggestion.lines.length}{" "}
                  linha{suggestion.lines.length !== 1 ? "s" : ""} · parcelas{" "}
                  {suggestion.lines.map((l) => l.installmentNumber).join(", ")}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}
