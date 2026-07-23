"use client";

import { useState } from "react";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import type { SxProps, Theme } from "@mui/material/styles";

import { m } from "@/lib/messages";

/** Opção real (categoria, subcategoria ou instituição já existente). */
type EntityOption = { id: string; name: string };

/** Opção sintética "＋ Criar 'X'" injetada pelo filterOptions quando não há match exato. */
type CreateOptionType = { __create: true; inputValue: string };

type AutocompleteOptionType = EntityOption | CreateOptionType;

function isCreateOption(option: AutocompleteOptionType): option is CreateOptionType {
  return "__create" in option;
}

const filterEntityOptions = createFilterOptions<AutocompleteOptionType>();

type Props = {
  value: string | null;
  onChange: (id: string | null) => void;
  options: EntityOption[];
  /** Cria a entidade no server e devolve o novo id (ou null em caso de falha). */
  onCreate: (name: string) => Promise<string | null>;
  /** Gate: some a opção "＋ Criar" quando o usuário não pode criar (ex: sem permissão, sem categoria escolhida). */
  canCreate: boolean;
  disabled?: boolean;
  /** Variante do controle. Nas linhas de transação use "standard" para casar com as demais colunas. */
  variant?: "standard" | "outlined";
  autoFocus?: boolean;
  /** Label flutuante do MUI (mesmo comportamento de um TextField comum). Opcional e
   * retrocompatível: os call-sites de linha/inline (tabela, popover, Alias) não passam
   * esse prop e continuam sem label flutuante, só `ariaLabel` + placeholder. Os dialogs
   * (Meta/Orçamento/Patrimônio) passam `label` para o campo ficar visualmente igual aos
   * demais TextField do form, em vez da caption solta que existia antes. */
  label?: string;
  ariaLabel?: string;
  placeholderNone?: string;
  sx?: SxProps<Theme>;
};

/**
 * Select "criável" — Autocomplete freeSolo compartilhado por Categoria, Subcategoria e
 * Instituição na linha de transação (Spec V3 · Model D). Quando o texto digitado não bate
 * com nenhuma opção existente, injeta uma opção sintética "＋ Criar 'X'"; selecioná-la
 * dispara `onCreate` (server action já existente) e auto-seleciona o novo id assim que ele
 * volta. Opções existentes continuam selecionáveis normalmente, com dedupe por nome.
 */
export function CreatableEntitySelect({
  value,
  onChange,
  options,
  onCreate,
  canCreate,
  disabled,
  variant = "standard",
  autoFocus,
  label,
  ariaLabel,
  placeholderNone,
  sx,
}: Props) {
  const [creating, setCreating] = useState(false);

  const selected = value ? (options.find((o) => o.id === value) ?? null) : null;

  async function handleCreate(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Dedupe: se já existe opção com esse nome (case-insensitive), seleciona em vez de
    // chamar a action de novo — evita o erro de nome duplicado no server como fluxo normal.
    const existing = options.find((o) => o.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      onChange(existing.id);
      return;
    }

    if (!canCreate) return;

    setCreating(true);
    const newId = await onCreate(trimmed);
    setCreating(false);
    if (newId) onChange(newId);
  }

  function handleChange(newValue: AutocompleteOptionType | string | null) {
    if (newValue === null) {
      onChange(null);
      return;
    }
    // freeSolo: Enter sem opção destacada devolve a string crua digitada — tratamos
    // como tentativa de criação (com o mesmo dedupe da opção sintética).
    if (typeof newValue === "string") {
      void handleCreate(newValue);
      return;
    }
    if (isCreateOption(newValue)) {
      void handleCreate(newValue.inputValue);
      return;
    }
    onChange(newValue.id);
  }

  return (
    <Autocomplete<AutocompleteOptionType, false, false, true>
      size="small"
      value={selected}
      onChange={(_event, newValue) => handleChange(newValue)}
      options={options}
      disabled={disabled || creating}
      freeSolo
      // Sem isso, freeSolo esconde o indicador de dropdown e só abre a lista ao
      // digitar — aqui queremos a mesma descoberta de um <Select> comum: clicar
      // já mostra todas as opções existentes.
      openOnFocus
      forcePopupIcon
      selectOnFocus
      clearOnBlur
      handleHomeEndKeys
      fullWidth
      noOptionsText={m.transactions.options.noOptions}
      slotProps={{
        // Solta a largura do popper para além do controle: cresce com o conteúdo
        // (nomes longos), com piso = largura do controle e teto via maxWidth no Paper.
        // `style` inline é a única forma de sobrescrever a largura fixa que o MUI ancora
        // ao input (evita o `!important` proibido pelo DS). Ancorado à esquerda + shift
        // pra não vazar a viewport.
        popper: {
          placement: "bottom-start",
          style: { width: "fit-content" },
          modifiers: [{ name: "preventOverflow", options: { padding: 8 } }],
        },
        // Borda + radius + surface dão o acabamento que o MUI não aplica por padrão no
        // Autocomplete (não há override no tema). Piso/teto de largura: >= controle, <= 320.
        paper: {
          sx: {
            mt: 0.5,
            minWidth: 150,
            maxWidth: 320,
            border: 1,
            borderColor: "border.default",
            borderRadius: 1, // radius.md (8px)
            boxShadow: "none", // DS: bordas, não sombras
            overflow: "hidden", // clipa os itens ao radius
            "& .MuiAutocomplete-noOptions": {
              fontSize: 13,
              color: "text.tertiary",
              py: 1.5,
            },
          },
        },
        listbox: { sx: { p: 0, maxHeight: 280 } },
      }}
      filterOptions={(opts, params) => {
        const filtered = filterEntityOptions(opts, params);
        const trimmed = params.inputValue.trim();
        const hasExactMatch = opts.some(
          (o) => !isCreateOption(o) && o.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (canCreate && trimmed !== "" && !hasExactMatch) {
          filtered.push({ __create: true, inputValue: trimmed });
        }
        return filtered;
      }}
      getOptionLabel={(option) => {
        if (typeof option === "string") return option;
        if (isCreateOption(option)) return option.inputValue;
        return option.name;
      }}
      isOptionEqualToValue={(option, val) =>
        !isCreateOption(option) && !isCreateOption(val) && option.id === val.id
      }
      renderOption={(liProps, option) => {
        const { key, ...rest } = liProps;
        if (isCreateOption(option)) {
          // Opção "criar" = botão fino de largura total, separado da lista por uma régua.
          return (
            <Box
              component="li"
              key={key}
              {...rest}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 0.75,
                minHeight: 40,
                px: 1.5,
                py: 1,
                borderTop: 1,
                borderColor: "border.subtle",
                color: "accent.primary",
                "&:hover, &.Mui-focused": { bgcolor: "accent.primarySubtle" },
              }}
            >
              <AddIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2" noWrap sx={{ fontSize: 13, fontWeight: 500 }}>
                {m.common.createNamed(option.inputValue)}
              </Typography>
            </Box>
          );
        }
        return (
          <Box
            component="li"
            key={key}
            {...rest}
            sx={{
              minHeight: 36,
              px: 1.5,
              py: 0.75,
              "&:hover, &.Mui-focused": { bgcolor: "action.hover" },
              '&[aria-selected="true"]': { bgcolor: "accent.primarySubtle" },
            }}
          >
            <Typography variant="body2" noWrap sx={{ fontSize: 13 }}>
              {option.name}
            </Typography>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          variant={variant}
          autoFocus={autoFocus}
          label={label}
          placeholder={placeholderNone ?? m.common.none}
          inputProps={{ ...params.inputProps, "aria-label": ariaLabel }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {creating && <CircularProgress size={14} sx={{ color: "text.tertiary" }} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          sx={{ "& input": { fontSize: 13 } }}
        />
      )}
      // width fixa deixa input e popper estáveis: digitar não redimensiona a célula.
      sx={{ fontSize: 13, width: 150, ...sx }}
    />
  );
}
