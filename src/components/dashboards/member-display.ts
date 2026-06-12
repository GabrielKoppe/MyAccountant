import { m } from "@/lib/messages";

/**
 * Nome de exibição de um responsável: acrescenta o sufixo "(ex-membro)"
 * quando o responsável não é mais membro atual da Account.
 * Compartilhado entre MemberBreakdownChart e MemberTrendChart.
 */
export function memberDisplayName(name: string, isFormerMember: boolean): string {
  return isFormerMember ? `${name} ${m.dashboards.members.formerMemberSuffix}` : name;
}

/**
 * Mapa estável id-de-série → cor, a partir da paleta de gráficos.
 * Garante a mesma cor por série entre donut, barras e tendência no mesmo render.
 */
export function buildMemberColorMap(
  ids: string[],
  palette: readonly string[],
): Map<string, string> {
  const map = new Map<string, string>();
  ids.forEach((id, i) => map.set(id, palette[i % palette.length]));
  return map;
}
