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

/** Revalida configurações gerais da account. */
export function revalidateGeneralSettings(accountId: string) {
  revalidatePath(`/${accountId}/settings/general`);
  revalidatePath(`/${accountId}`);
}

/** Revalida configurações de metas/budgets. */
export function revalidateBudgets(accountId: string) {
  revalidatePath(`/${accountId}/settings/budgets`);
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
