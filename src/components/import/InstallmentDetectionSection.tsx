"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkIcon from "@mui/icons-material/Link";
import { useState } from "react";

import { formatDateBr } from "@/lib/dates";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";
import type { InstallmentSuggestion } from "@/lib/installment-detector";
import type { ImportGroupMatch } from "@/server/services/installment-service";

type Props = {
  suggestions: InstallmentSuggestion[];
  acceptedIds: Set<string>;
  onToggle: (id: string) => void;
  /** Parcelamentos existentes casados com cada sugestão (spec 73 §2.3) */
  matches?: Map<string, ImportGroupMatch>;
  /** Sugestões que o usuário optou por VINCULAR (em vez de criar grupo novo) */
  linkedIds?: Set<string>;
  onToggleLink?: (id: string, link: boolean) => void;
};

type MatchRowProps = {
  match: ImportGroupMatch | undefined;
  /** Descrição da sugestão — compõe o nome acessível do seletor */
  groupDescription: string;
  linked: boolean;
  disabled: boolean;
  onChange: (link: boolean) => void;
};

/**
 * Linha de vínculo: quando a sugestão casa com um `InstallmentGroup` existente,
 * oferece "vincular ao existente" (padrão) ou "criar novo grupo". Casamento
 * ambíguo só informa — vincular ao grupo errado é pior que criar um novo.
 */
function MatchRow({ match, groupDescription, linked, disabled, onChange }: MatchRowProps) {
  if (!match) return null;

  if (match.ambiguous) {
    return (
      <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.25 }}>
        {m.csvImport.installments.ambiguousMatch(match.candidateCount)}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5, flexWrap: "wrap" }}>
      <LinkIcon sx={{ fontSize: 14, color: linked ? "accent.primary" : "text.disabled" }} />
      <Typography variant="caption" color="text.secondary">
        {m.csvImport.installments.matchDetail(
          match.installmentCount,
          formatDateBr(match.startDate),
          match.pendingNumbers.length,
        )}
      </Typography>
      <Select
        size="small"
        value={linked ? "link" : "new"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "link")}
        // O Select do MUI não tem label visível aqui (o texto ao lado já explica);
        // SelectDisplayProps é o que chega no elemento com role="combobox".
        SelectDisplayProps={{
          "aria-label": m.csvImport.installments.linkChoiceLabel(groupDescription),
        }}
        sx={{ fontSize: 11, "& .MuiSelect-select": { py: 0.25, pl: 0.75 } }}
      >
        <MenuItem value="link" sx={{ fontSize: 12 }}>
          {m.csvImport.installments.linkToExisting}
        </MenuItem>
        <MenuItem value="new" sx={{ fontSize: 12 }}>
          {m.csvImport.installments.createNewGroup}
        </MenuItem>
      </Select>
    </Box>
  );
}

export function InstallmentDetectionSection({
  suggestions,
  acceptedIds,
  onToggle,
  matches = new Map(),
  linkedIds = new Set(),
  onToggleLink,
}: Props) {
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
                inputProps={{ "aria-label": suggestion.groupDescription || "Parcelamento" }}
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

                {/* Vínculo com parcelamento existente (spec 73 §2.3) */}
                <MatchRow
                  match={matches.get(suggestion.id)}
                  groupDescription={suggestion.groupDescription || "Parcelamento"}
                  linked={linkedIds.has(suggestion.id)}
                  disabled={!acceptedIds.has(suggestion.id)}
                  onChange={(link) => onToggleLink?.(suggestion.id, link)}
                />
              </Box>
            </Box>
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}
