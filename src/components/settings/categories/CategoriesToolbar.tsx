"use client";

import SwapVertIcon from "@mui/icons-material/SwapVert";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import IconButton from "@mui/material/IconButton";
import type { SelectChangeEvent } from "@mui/material/Select";
import Tooltip from "@mui/material/Tooltip";

import { SettingsToolbar } from "@/components/settings/SettingsToolbar";
import {
  SettingsSelect,
  type SettingsSelectOption,
} from "@/components/settings/table/SettingsSelect";
import { m } from "@/lib/messages";

import type { CategorySortMode } from "./categories-tree";

const t = m.settings.structure.categories;

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  sortMode: CategorySortMode;
  onSortModeChange: (value: CategorySortMode) => void;
  /** Há pelo menos uma categoria expandida — decide se o botão recolhe ou expande tudo. */
  hasExpanded: boolean;
  onToggleExpandAll: () => void;
};

const SORT_OPTIONS: SettingsSelectOption[] = [
  { value: "manual", label: t.sortManual },
  { value: "alphabetical", label: t.sortAlphabetical },
  { value: "recent", label: t.sortRecent },
];

/**
 * Faixa de controles da página de Categorias (revisão de estilo). Busca + ordenação +
 * "recolher/expandir tudo" — o filtro por seção saiu junto com a coluna "Seção padrão"
 * (a categoria não tem mais nada para filtrar por lá).
 *
 * `SettingsSelect`, não `<Select>` cru: é o que dá à ordenação a MESMA altura (28px) e
 * tipografia (13px) da busca — antes o controle usava medida de formulário e
 * desalinhava a faixa inteira (reclamação literal do desenvolvedor sobre esta tela).
 */
export function CategoriesToolbar({
  search,
  onSearchChange,
  sortMode,
  onSortModeChange,
  hasExpanded,
  onToggleExpandAll,
}: Props) {
  return (
    <SettingsToolbar
      search={{ value: search, onChange: onSearchChange, placeholder: t.searchPlaceholder }}
      sort={
        <SettingsSelect
          options={SORT_OPTIONS}
          value={sortMode}
          onChange={(event: SelectChangeEvent<string>) =>
            onSortModeChange(event.target.value as CategorySortMode)
          }
          inputProps={{ "aria-label": t.sortLabel }}
          startAdornment={<SwapVertIcon sx={{ fontSize: 16, color: "text.tertiary", ml: 0.75 }} />}
          sx={{ minWidth: 180 }}
        />
      }
      end={
        <Tooltip title={hasExpanded ? t.collapseAll : t.expandAll}>
          <IconButton
            size="small"
            aria-label={hasExpanded ? t.collapseAll : t.expandAll}
            onClick={onToggleExpandAll}
            sx={{ width: 28, height: 28 }}
          >
            {hasExpanded ? (
              <UnfoldLessIcon sx={{ fontSize: 16 }} />
            ) : (
              <UnfoldMoreIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      }
    />
  );
}
