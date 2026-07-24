// Spec 65 §7/§10.3 (P1) — helper de item de navegação ativo.
//
// Extraído do padrão já validado em `SettingsNav.tsx` (item ativo: match exato
// OU prefixo de rota) para reuso na `AppSidebar`. Módulo PURO (sem "use client",
// sem hooks) — testável isoladamente sem montar componentes.
//
// Não editar `SettingsNav.tsx` aqui: a adoção deste helper por ele fica fora
// do escopo de P1 (evita conflito com P7, que já reagrupou seu sidebar).

import type { SxProps, Theme } from "@mui/material/styles";

type IsNavItemActiveOptions = {
  /**
   * Quando `true`, exige match exato de `pathname === href` — sem considerar
   * prefixo. Use para hrefs "raiz" (ex.: `/${accountId}`) que, em modo
   * prefixo, marcariam ativo qualquer rota da account. Default: `false`.
   */
  exact?: boolean;
};

/**
 * Determina se `href` deve ser tratado como "ativo" para o `pathname` atual.
 *
 * - Sem `exact` (default): ativo em match exato OU quando `pathname` começa
 *   com `${href}/` (rota aninhada).
 * - Com `exact: true`: ativo somente em match exato.
 */
export function isNavItemActive(
  pathname: string,
  href: string,
  { exact = false }: IsNavItemActiveOptions = {},
): boolean {
  if (pathname === href) return true;
  if (exact) return false;
  return pathname.startsWith(`${href}/`);
}

/**
 * `sx` do item de navegação ativo — mesmo padrão do `SettingsNav`: fundo
 * `background.subtle`, borda direita 2px `primary.main`, texto peso 600.
 * Estende com a cor do ícone (`.MuiListItemIcon-root`) para o rail
 * recolhido, onde só o ícone fica visível (sem `ListItemText` para herdar a
 * cor via `.MuiListItemText-primary`).
 */
export const activeNavItemSx: SxProps<Theme> = {
  borderRadius: 0,
  "&.Mui-selected": {
    bgcolor: "background.subtle",
    borderRight: 2,
    borderColor: "primary.main",
    "& .MuiListItemText-primary": { color: "primary.main", fontWeight: 600 },
    "& .MuiListItemIcon-root": { color: "primary.main" },
  },
};
