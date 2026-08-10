"use client";

import SearchIcon from "@mui/icons-material/Search";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import type { ReactNode } from "react";

import { SETTINGS_GUTTER } from "@/components/settings/settings-layout";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

/** Largura máxima da busca: além disso o campo vira o assunto da faixa, e não é. */
const SEARCH_MAX_WIDTH = 280;
/** Piso para o campo não colapsar antes de a faixa quebrar em duas linhas. */
const SEARCH_MIN_WIDTH = 160;

type Props = {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /** controles de filtro (Button + Menu montados pela página) */
  filters?: ReactNode;
  /** controle de ordenação */
  sort?: ReactNode;
  /** conteúdo alinhado à direita: contadores, botão de recolher tudo */
  end?: ReactNode;
};

/**
 * Faixa de controles de escala das páginas de Configurações (Spec 67 §2.2, regra 5).
 *
 * Este componente NÃO decide se aparece. O gate dos 12 itens é do `SettingsPageShell`
 * (decisão D6): a página entrega `itemCount` e o shell escolhe renderizar ou não a
 * toolbar. Aqui é só a faixa — assim uma lista curta nunca ganha busca por engano,
 * e nenhuma página reimplementa a regra.
 *
 * A faixa é intencionalmente burra sobre o conteúdo: `filters`, `sort` e `end` são
 * slots. Quem sabe o que filtrar/ordenar é a página; o que se padroniza aqui é a
 * anatomia (posição, densidade, fundo, borda), que é justamente o que o SET-03 pede.
 */
export function SettingsToolbar({ search, filters, sort, end }: Props) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      flexWrap="wrap"
      sx={{
        // `gap` via sx (não o prop `spacing` do Stack): com flexWrap, `spacing`
        // aplica margin nos filhos e a segunda linha fica sem respiro. `gap` é
        // CSS de verdade e vale para linha e coluna.
        gap: layout.inline,
        // Mesma goteira do cabeçalho e do rodapé: é o que alinha o campo de busca
        // com o título da página (ver `settings-layout.ts`).
        px: SETTINGS_GUTTER,
        py: layout.micro,
        // `background.surface` (e não `background.subtle`): sobre o canvas da página
        // o tom "subtle" é imperceptível no light e uma faixa nítida no dark — a
        // faixa precisa ler igual nos dois temas, como já faz a barra de salvar.
        bgcolor: "background.surface",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      {search && (
        <TextField
          // size/variant vêm dos defaultProps do tema — repassar aqui só criaria
          // um segundo lugar para mudar a densidade.
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
          placeholder={search.placeholder ?? m.settings.shell.searchPlaceholder}
          inputProps={{ "aria-label": m.settings.shell.searchLabel }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16, color: "text.tertiary" }} />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1, minWidth: SEARCH_MIN_WIDTH, maxWidth: SEARCH_MAX_WIDTH }}
        />
      )}

      {filters}
      {sort}

      {/* `ml: "auto"` come a sobra do eixo e empurra o `end` para a direita sem
          precisar de espaçador vazio. Quando a faixa quebra, o `end` desce inteiro. */}
      {end && (
        <Stack direction="row" alignItems="center" sx={{ gap: layout.inline, ml: "auto" }}>
          {end}
        </Stack>
      )}
    </Stack>
  );
}
