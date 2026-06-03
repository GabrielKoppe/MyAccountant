"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import ClearIcon from "@mui/icons-material/Clear";

import { m } from "@/lib/messages";
import { useMonthFilters } from "@/components/months/MonthFilterContext";
import { ExpandableIconButton } from "@/components/ui/ExpandableIconButton";

export function ActiveFilterChips() {
  const { filters, setFilters, clearFilters, options, isActive } = useMonthFilters();

  if (!isActive) return null;

  function removeCategory(id: string) {
    setFilters({ ...filters, categories: filters.categories.filter((c) => c !== id) });
  }

  function removeInstitution(id: string) {
    setFilters({ ...filters, institutions: filters.institutions.filter((i) => i !== id) });
  }

  function removeResponsible(id: string) {
    setFilters({ ...filters, responsible: filters.responsible.filter((r) => r !== id) });
  }

  const chipSx = {
    height: 28,
    fontSize: "0.8125rem",
    bgcolor: "accent.primarySubtle",
    color: "accent.primary",
    border: 1,
    borderColor: "accent.primary",
    px: 0.25,
    "& .MuiChip-deleteIcon": { color: "accent.primary", fontSize: 15, mx: 0.25 },
    "& .MuiChip-label": { px: 1.25 },
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1,
        px: 3,
        py: 1.25,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.subtle",
      }}
    >
      {filters.categories.map((id) => {
        const cat = options.categories.find((c) => c.id === id);
        if (!cat) return null;
        return (
          <Chip key={id} label={cat.name} size="small" onDelete={() => removeCategory(id)} sx={chipSx} />
        );
      })}

      {filters.institutions.map((id) => {
        const inst = options.institutions.find((i) => i.id === id);
        if (!inst) return null;
        return (
          <Chip key={id} label={inst.name} size="small" onDelete={() => removeInstitution(id)} sx={chipSx} />
        );
      })}

      {filters.responsible.map((id) => {
        const member = options.members.find((m) => m.id === id);
        if (!member) return null;
        return (
          <Chip key={id} label={member.name ?? member.email} size="small" onDelete={() => removeResponsible(id)} sx={chipSx} />
        );
      })}

      {filters.pending && (
        <Chip
          label={m.transactions.filters.pending}
          size="small"
          onDelete={() => setFilters({ ...filters, pending: false })}
          sx={chipSx}
        />
      )}

      {filters.favorite && (
        <Chip
          label={m.transactions.filters.favorite}
          size="small"
          onDelete={() => setFilters({ ...filters, favorite: false })}
          sx={chipSx}
        />
      )}

      <ExpandableIconButton
        icon={<ClearIcon sx={{ fontSize: 15 }} />}
        label={m.transactions.filters.clearAll}
        onClick={clearFilters}
      />
    </Box>
  );
}
