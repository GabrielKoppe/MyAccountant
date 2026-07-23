/**
 * Helpers de revalidação de rotas para Server Actions.
 *
 * Centraliza as chamadas de revalidatePath para evitar duplicação e garantir
 * que todas as rotas afetadas por uma mutação sejam sempre revalidadas juntas.
 *
 * Regra (da spec 15 e skill performance): nunca usar "layout" para mutações
 * de dados de página — invalida toda a subárvore incluindo AppBar e navbar.
 */
import { revalidatePath } from "next/cache";

/** Revalida a página de um mês e seu dashboard mensal. */
export function revalidateMonth(accountId: string, monthId: string) {
  revalidatePath(`/${accountId}/months/${monthId}`);
  revalidatePath(`/${accountId}/dashboards/monthly/${monthId}`);
}

/** Revalida a raiz da account (home com lista de meses). */
export function revalidateAccountHome(accountId: string) {
  revalidatePath(`/${accountId}`);
}

/** Revalida configurações de seções. */
export function revalidateSections(accountId: string) {
  revalidatePath(`/${accountId}/settings/sections`);
}

/** Revalida configurações de categorias. */
export function revalidateCategories(accountId: string) {
  revalidatePath(`/${accountId}/settings/categories`);
}

/** Revalida configurações de instituições. */
export function revalidateInstitutions(accountId: string) {
  revalidatePath(`/${accountId}/settings/institutions`);
}

/** Revalida configurações de tipos de tabela. */
export function revalidateTableTypes(accountId: string) {
  revalidatePath(`/${accountId}/settings/table-types`);
}

/** Revalida o template do checklist mensal (settings). */
export function revalidateChecklist(accountId: string) {
  revalidatePath(`/${accountId}/settings/checklist`);
}

/** Revalida configurações gerais da account. */
export function revalidateGeneralSettings(accountId: string) {
  revalidatePath(`/${accountId}/settings/general`);
  revalidatePath(`/${accountId}`);
}

/** Revalida a aba Orçamento do hub de planejamento (spec 47 §11 — antes settings/budgets). */
export function revalidateBudgets(accountId: string) {
  revalidatePath(`/${accountId}/planning/budgets`);
  // O `BudgetsWidget` também vive nos dashboards mensais e no resumo do mês (`/months/[monthId]`
  // e `/dashboards/monthly/[monthId]`). Sem revalidar essas árvores, um orçamento criado/editado
  // só aparecia no widget após um reload manual (o RSC servia dado em cache). "layout" revalida as
  // páginas [monthId] aninhadas sem precisar do id concreto. Dispara só em mutação de budget (raro).
  revalidatePath(`/${accountId}/dashboards`, "layout");
  revalidatePath(`/${accountId}/months`, "layout");
}

/** Revalida a gestão de responsáveis (personas). */
export function revalidateResponsibleParties(accountId: string) {
  revalidatePath(`/${accountId}/settings/responsibles`);
  revalidatePath(`/${accountId}`);
}

/** Revalida dashboards (layout completo — usar com moderação). */
export function revalidateDashboards(accountId: string) {
  revalidatePath(`/${accountId}/dashboards`, "layout");
}

/** Revalida a gestão de apelidos de transação. */
export function revalidateTransactionAliases(accountId: string) {
  revalidatePath(`/${accountId}/settings/aliases`);
  revalidatePath(`/${accountId}`);
}

/** Revalida a página de patrimônio líquido. */
export function revalidateNetWorth(accountId: string) {
  revalidatePath(`/${accountId}/net-worth`);
}

/** Revalida configurações de forecast e o dashboard anual (layout completo — usar com moderação). */
export function revalidateForecastSettings(accountId: string) {
  revalidatePath(`/${accountId}/forecast`);
  revalidatePath(`/${accountId}/dashboards/yearly`, "layout");
}

/** Revalida a aba Metas do hub de planejamento (spec 47). */
export function revalidateGoals(accountId: string) {
  revalidatePath(`/${accountId}/planning/goals`);
}
