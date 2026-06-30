/** Sx padrão para chips de tag na célula da tabela — compacto mas consistente com o TagEditor. */
export function tagChipSx(color: string | null | undefined) {
  return {
    height: 22,
    fontSize: "0.72rem",
    bgcolor: color ? `${color}22` : "background.subtle",
    border: 1,
    borderColor: color ?? "divider",
    "& .MuiChip-label": { px: 0.75, overflow: "hidden", textOverflow: "ellipsis" },
  };
}
