// Spec 65 §7.4/§7.5/§10.3 (P2) — preferência de sidebar recolhida (NAV-05).
//
// Espelha `parseTheme`/`parseAccent` de `src/app/layout.tsx`: helper puro,
// sem I/O, lido no server a partir do cookie para evitar flash de layout no
// primeiro paint. A escrita do cookie é responsabilidade da Action
// `saveSidebarCollapsedAction` (P3, `src/actions/user-settings.ts`).

/** Nome do cookie que persiste o estado recolhido/expandido da sidebar. */
export const SIDEBAR_COLLAPSED_COOKIE = "sidebar_collapsed";

/**
 * Converte o valor bruto do cookie `sidebar_collapsed` em booleano.
 *
 * Único valor considerado "recolhido" é a string exata `"1"` — qualquer outro
 * valor (ausente, `"0"`, ou lixo) resulta em `false` (sidebar expandida por
 * padrão).
 */
export function parseSidebarCollapsed(value: string | undefined): boolean {
  return value === "1";
}
