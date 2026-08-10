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

/**
 * Revalida o hub de Configurações (Spec 67 §2.1).
 *
 * O hub é uma ROTA à parte (`/[accountId]/settings`), com as contagens baratas
 * de todos os objetos e os sinalizadores de atenção. Revalidar a página de uma
 * família NÃO o alcança — sem esta chamada, criar uma categoria deixa o card
 * "Estrutura" mostrando o número antigo até um reload manual.
 *
 * Chamado por todos os revalidadores de settings abaixo, nunca sozinho.
 */
export function revalidateSettingsHub(accountId: string) {
  revalidatePath(`/${accountId}/settings`);
}

/** Revalida configurações de seções. */
export function revalidateSections(accountId: string) {
  revalidatePath(`/${accountId}/settings/sections`);
  revalidateSettingsHub(accountId);
}

/** Revalida configurações de categorias. */
export function revalidateCategories(accountId: string) {
  revalidatePath(`/${accountId}/settings/categories`);
  revalidateSettingsHub(accountId);
}

/** Revalida configurações de instituições. */
export function revalidateInstitutions(accountId: string) {
  revalidatePath(`/${accountId}/settings/institutions`);
  revalidateSettingsHub(accountId);
}

/** Revalida configurações de tipos de tabela. */
export function revalidateTableTypes(accountId: string) {
  revalidatePath(`/${accountId}/settings/table-types`);
  revalidateSettingsHub(accountId);
}

/** Revalida o template do checklist mensal (settings). */
export function revalidateChecklist(accountId: string) {
  revalidatePath(`/${accountId}/settings/checklist`);
  revalidateSettingsHub(accountId);
}

/** Revalida a gestão de membros e convites (settings). */
export function revalidateMembers(accountId: string) {
  revalidatePath(`/${accountId}/settings/members`);
  revalidateSettingsHub(accountId);
}

/** Revalida os modelos de tabela (`TableTemplate`) — settings/models. */
export function revalidateTableTemplates(accountId: string) {
  revalidatePath(`/${accountId}/settings/models`);
  revalidateSettingsHub(accountId);
}

/** Revalida os templates de importação (`CsvTemplate`) — settings/templates. */
export function revalidateCsvTemplates(accountId: string) {
  revalidatePath(`/${accountId}/settings/templates`);
  revalidateSettingsHub(accountId);
}

/** Revalida os conectores MCP (settings/connectors). */
export function revalidateConnectors(accountId: string) {
  revalidatePath(`/${accountId}/settings/connectors`);
  revalidateSettingsHub(accountId);
}

/** Revalida configurações gerais da account. */
export function revalidateGeneralSettings(accountId: string) {
  revalidatePath(`/${accountId}/settings/general`);
  revalidatePath(`/${accountId}`);
  revalidateSettingsHub(accountId);
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
  revalidateSettingsHub(accountId);
}

/** Revalida dashboards (layout completo — usar com moderação). */
export function revalidateDashboards(accountId: string) {
  revalidatePath(`/${accountId}/dashboards`, "layout");
}

/**
 * Revalida a personalização de um dashboard (Spec 36): as páginas que o
 * renderizam, a página de edição em settings e o hub.
 *
 * O hub entra porque a contagem "N de 3 personalizados" (Spec 67 §4 B2) muda no
 * primeiro salvamento de cada contexto — e `revalidatePath("/settings/dashboards",
 * "layout")` NÃO alcança `/settings`, que é uma rota irmã, não ancestral.
 */
export function revalidateDashboardLayout(accountId: string) {
  revalidatePath(`/${accountId}/dashboards`, "layout");
  revalidatePath(`/${accountId}/settings/dashboards`, "layout");
  revalidateSettingsHub(accountId);
}

/** Revalida a gestão de apelidos de transação. */
export function revalidateTransactionAliases(accountId: string) {
  revalidatePath(`/${accountId}/settings/aliases`);
  revalidatePath(`/${accountId}`);
  revalidateSettingsHub(accountId);
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
