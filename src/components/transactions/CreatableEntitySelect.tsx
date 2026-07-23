"use client";

import AddIcon from "@mui/icons-material/Add";
import Autocomplete, {
  createFilterOptions,
  type AutocompleteRenderInputParams,
} from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import type { SxProps, Theme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { FilterOptionsState } from "@mui/material/useAutocomplete";
import { useState } from "react";
import type { HTMLAttributes, Key } from "react";

import { m } from "@/lib/messages";

/** Opção real (categoria, subcategoria ou instituição já existente). */
type EntityOption = { id: string; name: string };

/** Opção sintética "＋ Criar 'X'" injetada pelo filterOptions quando não há match exato. */
type CreateOptionType = { __create: true; inputValue: string };

type AutocompleteOptionType = EntityOption | CreateOptionType;

// Aceita string porque, em freeSolo, o MUI pode passar o texto cru digitado (ex: como
// `value` em isOptionEqualToValue). O guard de `typeof` evita o TypeError do operador `in`.
function isCreateOption(
  option: AutocompleteOptionType | string,
): option is CreateOptionType {
  return typeof option === "object" && option !== null && "__create" in option;
}

const filterEntityOptions = createFilterOptions<AutocompleteOptionType>();

/** Props comuns aos dois modos (single e multi). */
type CommonProps = {
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
 * Modo single (padrão / retrocompatível): valor é um id ou null. Nenhum call-site
 * existente passa `multiple`, então esta é a forma resolvida por omissão.
 */
type SingleProps = CommonProps & {
  multiple?: false;
  value: string | null;
  onChange: (id: string | null) => void;
};

/**
 * Modo multi: valor é um array de ids. Renderiza os selecionados como <Chip> deletáveis
 * e continua oferecendo o "＋ Criar 'X'" (criar → adiciona o novo id ao array, com dedupe).
 */
type MultiProps = CommonProps & {
  multiple: true;
  value: string[];
  onChange: (ids: string[]) => void;
};

type Props = SingleProps | MultiProps;

/**
 * Select "criável" — Autocomplete freeSolo compartilhado por Categoria, Subcategoria e
 * Instituição na linha de transação (Spec V3 · Model D). Quando o texto digitado não bate
 * com nenhuma opção existente, injeta uma opção sintética "＋ Criar 'X'"; selecioná-la
 * dispara `onCreate` (server action já existente) e auto-seleciona o novo id assim que ele
 * volta. Opções existentes continuam selecionáveis normalmente, com dedupe por nome.
 *
 * Suporta dois modos via prop discriminada `multiple`:
 * - single (padrão): `value: string | null` + `onChange: (id) => void`.
 * - multi: `multiple: true` + `value: string[]` + `onChange: (ids) => void`.
 *
 * O corpo do Autocomplete (opções, filtro, render de item, popper, input) é compartilhado
 * entre os dois modos via `sharedProps`; só `value`/`onChange`/`multiple`/`renderTags`
 * variam por modo.
 */
export function CreatableEntitySelect(props: Props) {
  const {
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
  } = props;

  const [creating, setCreating] = useState(false);

  /**
   * Resolve um nome digitado para um id: dedupe (case-insensitive) contra as opções
   * existentes e, se não houver match e `canCreate`, chama `onCreate`. Compartilhado
   * pelos dois modos. Gerencia o spinner apenas em volta da criação real.
   */
  async function resolveName(name: string): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;

    // Dedupe: se já existe opção com esse nome (case-insensitive), reaproveita o id em vez
    // de chamar a action de novo — evita o erro de nome duplicado no server como fluxo normal.
    const existing = options.find((o) => o.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;

    if (!canCreate) return null;

    setCreating(true);
    const newId = await onCreate(trimmed);
    setCreating(false);
    return newId;
  }

  // Placeholder some quando já há chips no modo multi (senão fica sobreposto às tags).
  const placeholder =
    props.multiple && props.value.length > 0 ? undefined : (placeholderNone ?? m.common.none);

  // Config compartilhada: independente do modo (Multiple). `value`, `onChange`, `multiple`
  // e `renderTags` são adicionados por modo, abaixo.
  const sharedProps = {
    size: "small" as const,
    options,
    disabled: disabled || creating,
    freeSolo: true as const,
    // Sem isso, freeSolo esconde o indicador de dropdown e só abre a lista ao
    // digitar — aqui queremos a mesma descoberta de um <Select> comum: clicar
    // já mostra todas as opções existentes.
    openOnFocus: true,
    forcePopupIcon: true,
    selectOnFocus: true,
    clearOnBlur: true,
    handleHomeEndKeys: true,
    fullWidth: true,
    noOptionsText: m.transactions.options.noOptions,
    slotProps: {
      // Solta a largura do popper para além do controle: cresce com o conteúdo
      // (nomes longos), com piso = largura do controle e teto via maxWidth no Paper.
      // `style` inline é a única forma de sobrescrever a largura fixa que o MUI ancora
      // ao input (evita o `!important` proibido pelo DS). Ancorado à esquerda + shift
      // pra não vazar a viewport.
      popper: {
        placement: "bottom-start" as const,
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
    },
    filterOptions: (
      opts: AutocompleteOptionType[],
      params: FilterOptionsState<AutocompleteOptionType>,
    ) => {
      const filtered = filterEntityOptions(opts, params);
      const trimmed = params.inputValue.trim();
      const hasExactMatch = opts.some(
        (o) => !isCreateOption(o) && o.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (canCreate && trimmed !== "" && !hasExactMatch) {
        filtered.push({ __create: true, inputValue: trimmed });
      }
      return filtered;
    },
    getOptionLabel: (option: AutocompleteOptionType | string) => {
      if (typeof option === "string") return option;
      if (isCreateOption(option)) return option.inputValue;
      return option.name;
    },
    isOptionEqualToValue: (
      option: AutocompleteOptionType | string,
      val: AutocompleteOptionType | string,
    ) => {
      // freeSolo pode entregar strings cruas de ambos os lados — compara por igualdade.
      if (typeof option === "string" || typeof val === "string") return option === val;
      return !isCreateOption(option) && !isCreateOption(val) && option.id === val.id;
    },
    renderOption: (liProps: HTMLAttributes<HTMLLIElement> & { key?: Key }, option: AutocompleteOptionType) => {
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
    },
    renderInput: (params: AutocompleteRenderInputParams) => (
      <TextField
        {...params}
        variant={variant}
        autoFocus={autoFocus}
        label={label}
        placeholder={placeholder}
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
    ),
  };

  if (props.multiple) {
    const { value, onChange } = props;
    // Reconstrói os objetos selecionados a partir dos ids (ordem preservada; ignora ids
    // órfãos que não estejam mais em `options`).
    const selected = value
      .map((id) => options.find((o) => o.id === id))
      .filter((o): o is EntityOption => o != null);

    async function handleChangeMulti(newValues: (AutocompleteOptionType | string)[]) {
      const resolved: string[] = [];
      for (const v of newValues) {
        if (typeof v === "string") {
          // freeSolo: Enter sem opção destacada devolve a string crua — trata como criação/dedupe.
          const id = await resolveName(v);
          if (id) resolved.push(id);
        } else if (isCreateOption(v)) {
          const id = await resolveName(v.inputValue);
          if (id) resolved.push(id);
        } else {
          resolved.push(v.id);
        }
      }
      // Dedupe final (Set preserva a ordem de inserção).
      onChange([...new Set(resolved)]);
    }

    return (
      <Autocomplete<AutocompleteOptionType, true, false, true>
        {...sharedProps}
        multiple
        disableCloseOnSelect
        value={selected}
        onChange={(_event, newValue) => void handleChangeMulti(newValue)}
        renderTags={(tagValues, getTagProps) =>
          tagValues.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            const text =
              typeof option === "string"
                ? option
                : isCreateOption(option)
                  ? option.inputValue
                  : option.name;
            return (
              <Chip
                key={key}
                {...tagProps}
                size="small"
                label={text}
                // A11y: o CancelIcon do MUI não tem rótulo próprio, então o leitor
                // de tela anunciaria só "botão" ao focar a exclusão. Rotular o Chip
                // com o nome do item torna claro QUAL valor está sendo removido.
                aria-label={m.common.removeNamed(text)}
                sx={{
                  height: 24,
                  borderRadius: 1,
                  bgcolor: "surface.subtle",
                  border: 1,
                  borderColor: "border.default",
                  "& .MuiChip-label": { px: 1, fontSize: 12 },
                  "& .MuiChip-deleteIcon": {
                    fontSize: 16,
                    color: "text.tertiary",
                    "&:hover": { color: "text.secondary" },
                  },
                }}
              />
            );
          })
        }
        // Cresce com os chips: sem largura fixa (o modo single fixa 150 pra estabilizar a célula).
        sx={{ fontSize: 13, ...sx }}
      />
    );
  }

  const { value, onChange } = props;
  const selected = value ? (options.find((o) => o.id === value) ?? null) : null;

  function handleChangeSingle(newValue: AutocompleteOptionType | string | null) {
    if (newValue === null) {
      onChange(null);
      return;
    }
    // freeSolo: Enter sem opção destacada devolve a string crua digitada — tratamos
    // como tentativa de criação (com o mesmo dedupe da opção sintética).
    if (typeof newValue === "string") {
      void resolveName(newValue).then((id) => {
        if (id) onChange(id);
      });
      return;
    }
    if (isCreateOption(newValue)) {
      void resolveName(newValue.inputValue).then((id) => {
        if (id) onChange(id);
      });
      return;
    }
    onChange(newValue.id);
  }

  return (
    <Autocomplete<AutocompleteOptionType, false, false, true>
      {...sharedProps}
      value={selected}
      onChange={(_event, newValue) => handleChangeSingle(newValue)}
      // width fixa deixa input e popper estáveis: digitar não redimensiona a célula.
      sx={{ fontSize: 13, width: 150, ...sx }}
    />
  );
}
