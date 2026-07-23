import { formatCentsToBrl } from "@/lib/money";
// `import type` é APAGADO em runtime (tsc/swc) — não cria aresta no grafo de módulos,
// então este módulo continua PURO e client-safe mesmo o tipo vindo de
// queries/budgets.ts (que importa `prisma`). O ciclo é só de tipos (queries importa
// o VALOR getBudgetLabel daqui; aqui só o TIPO de lá), resolvido pelo compilador.
import type { BudgetWithDetails } from "@/server/queries/budgets";

/**
 * Rótulo automático quando `name` é null (Spec 25): junta os NOMES de cada dimensão
 * com ", " (ex: "Alimentação, Transporte") e separa dimensões distintas com " · "
 * (ex: "Alimentação, Transporte · Nubank"). Cai para só o valor-alvo quando não há
 * nenhuma dimensão resolvida.
 *
 * Vive aqui (módulo puro, só `formatCentsToBrl`) e não em queries/budgets.ts porque a
 * aba `planning/budgets` (client) precisa do rótulo e não pode depender em runtime de
 * um arquivo que importa `prisma`. queries/budgets.ts re-exporta para manter a API.
 */
export function getBudgetLabel(budget: BudgetWithDetails): string {
  const segments: string[] = [];
  const push = (names: string[]) => {
    if (names.length > 0) segments.push(names.join(", "));
  };
  push(budget.sections.map((s) => s.name));
  push(budget.categories.map((c) => c.name));
  push(budget.members.map((mb) => mb.name ?? "Membro"));
  push(budget.institutions.map((i) => i.name));
  push(budget.tableTypes.map((t) => t.name));

  const dimLabel = segments.join(" · ");
  const valueLabel = `até ${formatCentsToBrl(BigInt(budget.amountCents))}`;
  return budget.name || (dimLabel ? `${dimLabel} — ${valueLabel}` : valueLabel);
}
