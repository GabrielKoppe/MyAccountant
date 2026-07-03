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

  // Estilo base — igual para todos os filtros não coloridos
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

  /** Prefixo em negrito antes do valor — ex: "Categoria: " */
  function label(prefix: string, value: string) {
    return (
      <Box component="span" sx={{ fontSize: "inherit" }}>
        <Box component="span" sx={{ fontWeight: 600, opacity: 0.7 }}>
          {prefix}:{" "}
        </Box>
        {value}
      </Box>
    );
  }

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
          <Chip
            key={id}
            label={label("Categoria", cat.name)}
            size="small"
            onDelete={() => removeCategory(id)}
            sx={chipSx}
          />
        );
      })}

      {filters.institutions.map((id) => {
        const inst = options.institutions.find((i) => i.id === id);
        if (!inst) return null;
        return (
          <Chip
            key={id}
            label={label("Instituição", inst.name)}
            size="small"
            onDelete={() => removeInstitution(id)}
            sx={chipSx}
          />
        );
      })}

      {filters.responsible.map((id) => {
        const party = options.parties.find((p) => p.id === id);
        if (!party) return null;
        return (
          <Chip
            key={id}
            label={label("Responsável", party.icon ? `${party.icon} ${party.name}` : party.name)}
            size="small"
            onDelete={() => removeResponsible(id)}
            sx={chipSx}
          />
        );
      })}

      {filters.pending && (
        <Chip
          label={label("Filtro", m.transactions.filters.pending)}
          size="small"
          onDelete={() => setFilters({ ...filters, pending: false })}
          sx={chipSx}
        />
      )}

      {filters.favorite && (
        <Chip
          label={label("Filtro", m.transactions.filters.favorite)}
          size="small"
          onDelete={() => setFilters({ ...filters, favorite: false })}
          sx={chipSx}
        />
      )}

      {filters.expenseTypes.map((type) => (
        <Chip
          key={type}
          label={label("Tipo", m.transactions.expenseTypes[type])}
          size="small"
          onDelete={() =>
            setFilters({ ...filters, expenseTypes: filters.expenseTypes.filter((t) => t !== type) })
          }
          sx={chipSx}
        />
      ))}

      {filters.sources.map((src) => (
        <Chip
          key={src}
          label={label("Origem", m.transactions.sources[src])}
          size="small"
          onDelete={() =>
            setFilters({ ...filters, sources: filters.sources.filter((s) => s !== src) })
          }
          sx={chipSx}
        />
      ))}

      {filters.tagIds.map((tagId) => {
        const tag = options.tags.find((t) => t.id === tagId);
        if (!tag) return null;
        // Tags usam a cor da própria tag em vez do estilo accent
        const tagChipSx = tag.color
          ? {
              ...chipSx,
              bgcolor: `${tag.color}22`,
              color: "text.primary",
              borderColor: tag.color,
              "& .MuiChip-deleteIcon": { color: tag.color, fontSize: 15, mx: 0.25 },
            }
          : chipSx;
        return (
          <Chip
            key={tagId}
            label={label("Tag", tag.name)}
            size="small"
            onDelete={() =>
              setFilters({ ...filters, tagIds: filters.tagIds.filter((id) => id !== tagId) })
            }
            sx={tagChipSx}
          />
        );
      })}

      <ExpandableIconButton
        icon={<ClearIcon sx={{ fontSize: 15 }} />}
        label={m.transactions.filters.clearAll}
        onClick={clearFilters}
      />
    </Box>
  );
}
