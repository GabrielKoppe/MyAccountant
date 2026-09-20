// Spec 69 §2.2 / §14 P7 — estado editável de UMA transação de modelo.
//
// Módulo PURO: sem React, sem Prisma. Guarda a tradução item ↔ rascunho ↔ payload
// da action, que é onde a Spec 68 (§15) já pagou caro duas vezes: `undefined`
// ("não mencionei") tratado como `null` ("limpar") apaga dado em silêncio, e
// `{ ...values }` vaza campo que o chamador não pediu para mudar.

import type { RowLayout } from "@/lib/schemas/settings";
import type { InvestmentType } from "@/lib/schemas/transaction";
import { TABLE_COLUMN_KEYS, type TableColumnKey } from "@/lib/table-columns";
import { DENSITIES, type Density } from "@/lib/table-density";

/** O item como ele chega do RSC — `amountCents` serializado em string (BigInt). */
export type ModelItem = {
  id: string;
  day: number;
  dayRule: string | null;
  amountCents: string;
  description: string | null;
  // `notes` só entrou depois que `listTemplates` passou a selecioná-lo: escrever
  // um campo que a tela não LÊ apagaria a nota de quem já tem uma (a armadilha
  // `undefined` × `null` da §15, na direção mais cara).
  notes: string | null;
  isPending: boolean;
  categoryId: string | null;
  subcategoryId: string | null;
  institutionId: string | null;
  responsiblePartyId: string | null;
  cardInstallment: string | null;
  investmentType: string | null;
  displayOrder: number;
};

/**
 * Rascunho da linha. Tudo string (`""` = "nenhum") menos os dois booleanos: é o
 * formato que os campos do formulário falam, e converter uma vez na fronteira
 * evita `value={x ?? ""}` espalhado por seis campos.
 *
 * `amountCents` é mantido em CENTAVOS, não no texto digitado: o editor antigo
 * guardava a string mascarada e a reconvertia com `replace(/\./g,"")` sobre um
 * valor que o `NumericFormat` já entregava sem máscara — o que multiplicava por
 * 10 qualquer valor com centavos. Aqui o campo entrega `floatValue` e a única
 * conversão acontece em `reaisToCents`.
 */
export type ModelItemDraft = {
  dayRule: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  institutionId: string;
  responsiblePartyId: string;
  amountCents: string;
  cardInstallment: string;
  investmentType: string;
  isPending: boolean;
  notes: string;
};

export const EMPTY_ITEM_DRAFT: ModelItemDraft = {
  dayRule: "1",
  description: "",
  categoryId: "",
  subcategoryId: "",
  institutionId: "",
  responsiblePartyId: "",
  amountCents: "0",
  cardInstallment: "",
  investmentType: "",
  isPending: false,
  notes: "",
};

export function draftFromItem(item: ModelItem): ModelItemDraft {
  return {
    // `dayRule` pode ser `null` em item anterior à Spec 69 — a coluna `day` é a
    // fonte de verdade nesse caso (mesmo fallback de `parseDayRule`).
    dayRule: item.dayRule ?? String(item.day),
    description: item.description ?? "",
    categoryId: item.categoryId ?? "",
    subcategoryId: item.subcategoryId ?? "",
    institutionId: item.institutionId ?? "",
    responsiblePartyId: item.responsiblePartyId ?? "",
    amountCents: item.amountCents,
    cardInstallment: item.cardInstallment ?? "",
    investmentType: item.investmentType ?? "",
    isPending: item.isPending,
    notes: item.notes ?? "",
  };
}

/**
 * Um item precisa dizer ALGUMA coisa: ou tem descrição, ou tem valor.
 *
 * Não exige valor (como o editor antigo exigia): "valor 0,00 = criar em branco
 * para o usuário preencher" é um caso legítimo e central da spec — bloquear ali
 * proibiria justamente a linha que o modelo existe para criar.
 */
export function canCommitItemDraft(draft: ModelItemDraft): boolean {
  return draft.description.trim() !== "" || draft.amountCents !== "0";
}

/**
 * Payload das actions de item, montado CAMPO A CAMPO.
 *
 * `null` (e não `undefined`) nos campos vazios: no update parcial os dois são
 * coisas diferentes — `undefined` é "não mencionei" e deixaria a categoria antiga
 * gravada quando o usuário acabou de limpá-la.
 */
export function itemInputFromDraft(draft: ModelItemDraft) {
  return {
    dayRule: draft.dayRule,
    amountCents: BigInt(draft.amountCents),
    description: draft.description.trim() || null,
    notes: draft.notes.trim() || null,
    isPending: draft.isPending,
    categoryId: draft.categoryId || null,
    subcategoryId: draft.subcategoryId || null,
    institutionId: draft.institutionId || null,
    responsiblePartyId: draft.responsiblePartyId || null,
    cardInstallment: draft.cardInstallment.trim() || null,
    // O rascunho guarda string (é o que o `Select` fala); o domínio é o enum de
    // `INVESTMENT_TYPES`, e o campo só oferece valores desse enum.
    investmentType: (draft.investmentType || null) as InvestmentType | null,
  };
}

/** Aplica o rascunho ao item local, sem esperar o round-trip do servidor. */
export function itemFromDraft(base: ModelItem, draft: ModelItemDraft): ModelItem {
  const input = itemInputFromDraft(draft);
  return {
    ...base,
    dayRule: draft.dayRule,
    day: dayFromRule(draft.dayRule, base.day),
    amountCents: draft.amountCents,
    description: input.description,
    notes: input.notes,
    isPending: input.isPending,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    institutionId: input.institutionId,
    responsiblePartyId: input.responsiblePartyId,
    cardInstallment: input.cardInstallment,
    investmentType: draft.investmentType || null,
  };
}

/**
 * Espelho local de `dayRuleToDay` do servidor: `last` → 31 (ordena por último),
 * `firstBusiness` → 1. Existe para o item recém-editado já aparecer na posição
 * certa sem recarregar a página.
 */
function dayFromRule(rule: string, fallback: number): number {
  if (rule === "last") return 31;
  if (rule === "firstBusiness") return 1;
  const parsed = Number(rule);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : fallback;
}

/**
 * O item recém-criado, montado a partir do rascunho + o `id` devolvido pela
 * action.
 *
 * Só o `id` vem do servidor de propósito: o resto do registro é exatamente o que
 * acabamos de enviar, e arrastar um `amountCents` BigInt de volta pela fronteira
 * da Server Action só para reler o que já está no rascunho é custo sem ganho.
 * (A importação é o caso oposto: lá os dados NASCEM no servidor, e por isso ela
 * devolve a lista inteira já com `amountCents` em string.)
 */
export function newItemFromDraft(
  id: string,
  draft: ModelItemDraft,
  displayOrder: number,
): ModelItem {
  const base: ModelItem = {
    id,
    day: 1,
    dayRule: null,
    amountCents: "0",
    description: null,
    notes: null,
    isPending: false,
    categoryId: null,
    subcategoryId: null,
    institutionId: null,
    responsiblePartyId: null,
    cardInstallment: null,
    investmentType: null,
    displayOrder,
  };
  return itemFromDraft(base, draft);
}

export function sumItemCents(items: readonly ModelItem[]): bigint {
  return items.reduce((total, item) => total + BigInt(item.amountCents), 0n);
}

// ─── Reordenação (arraste) ─────────────────────────────────────────────────────

/**
 * A lista reordenada, com `displayOrder` renumerado de 0 a N−1.
 *
 * Ids desconhecidos são ignorados e itens que o arraste não mencionou vão para o
 * fim na ordem em que estavam: a lista devolvida tem sempre os MESMOS itens da
 * entrada, nunca menos. Perder uma linha por causa de um id fora de sincronia
 * seria uma exclusão silenciosa.
 */
export function reorderItems(
  items: readonly ModelItem[],
  orderedIds: readonly string[],
): ModelItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const picked: ModelItem[] = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (!item) continue;
    byId.delete(id);
    picked.push(item);
  }
  return [...picked, ...byId.values()].map((item, index) => ({ ...item, displayOrder: index }));
}

/**
 * As escritas que a reordenação exige: só os itens cuja posição final difere da
 * gravada.
 *
 * Arrastar uma linha desloca todas as que estão entre a origem e o destino — por
 * isso o patch é por LISTA, não pela linha arrastada. Gravar só a arrastada
 * deixaria duas linhas com o mesmo `displayOrder` e a ordem passaria a ser
 * decidida pelo desempate (`day`), não pelo usuário.
 */
export function itemOrderPatches(
  items: readonly ModelItem[],
  orderedIds: readonly string[],
): { itemId: string; displayOrder: number }[] {
  const stored = new Map(items.map((item) => [item.id, item.displayOrder]));
  return reorderItems(items, orderedIds)
    .map((item) => ({ itemId: item.id, displayOrder: item.displayOrder }))
    .filter((patch) => stored.get(patch.itemId) !== patch.displayOrder);
}

// ─── Colunas da mini-tabela ────────────────────────────────────────────────────

/**
 * As colunas que uma transação de MODELO tem (frame 06b): dia · descrição ·
 * categoria · responsável · valor.
 *
 * É um subconjunto fixo das colunas da linha real, e não `visibleColumns` do tipo:
 * o modelo guarda os campos que ele sabe preencher, e nenhum tipo de tabela pode
 * fazer um modelo ganhar "tags" ou "método de pagamento", que ele não tem.
 */
const BASE_ITEM_COLUMNS: readonly TableColumnKey[] = [
  "occurredOn",
  "description",
  "category",
  "responsibleUser",
  "amount",
];

/**
 * D5 — a **coluna** Instituição só aparece quando o tipo de tabela do modelo
 * mostra instituição. O CAMPO continua existindo e continua sendo aplicado na
 * criação do mês: quando a coluna não está aqui, ele é editado em "Mais campos".
 */
export function modelItemColumns(
  typeVisibleColumns: readonly TableColumnKey[] | undefined,
): TableColumnKey[] {
  const showInstitution = (typeVisibleColumns ?? []).includes("institution");
  if (!showInstitution) return [...BASE_ITEM_COLUMNS];

  const columns = [...BASE_ITEM_COLUMNS];
  // Antes de "valor", que é sempre a última — a ordem canônica de
  // `TABLE_COLUMNS` também põe `institution` antes de `amount`.
  columns.splice(columns.indexOf("amount"), 0, "institution");
  return columns;
}

/** Ordem canônica, para o teste não depender da literal acima. */
export const CANONICAL_COLUMN_ORDER = TABLE_COLUMN_KEYS;

// ─── Normalizadores do tipo de tabela ──────────────────────────────────────────
//
// O banco guarda `rowLayout`/`density` como `String` (§14 P0: a validação é do
// Zod, não do Postgres). O RSC entrega o que está lá; estes dois guardam a
// fronteira para a UI nunca receber um valor fora do domínio.

export function normalizeRowLayout(raw: string | null | undefined): RowLayout {
  return raw === "pills" ? "pills" : "columns";
}

export function normalizeDensity(raw: string | null | undefined): Density {
  return (DENSITIES as readonly string[]).includes(raw ?? "") ? (raw as Density) : "default";
}
