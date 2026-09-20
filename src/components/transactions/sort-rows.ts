// Ordenação da tabela de transações (Spec 69 §2.1 · aba "Comportamento").
//
// Extraído do `TransactionTable` quando `TableType.defaultSort` ganhou consumidor.
// Duas mudanças em relação ao que vivia lá dentro:
//
// 1. O campo de ordenação passa a ser uma **chave de coluna** (`TableColumnKey`),
//    o mesmo vocabulário que a aba "Comportamento" grava em `defaultSort.key`.
//    Antes eram cinco nomes próprios (`amountCents`, `categoryId`, …) que não
//    casavam com nada do que é persistido — o de-para teria que existir em algum
//    lugar, e um de-para paralelo é exatamente o que sai de sincronia.
// 2. O estado deixa de ser anulável. `null` significava "cai no padrão fixo
//    occurredOn/desc"; agora o padrão é do TIPO, então ele é um valor de verdade
//    e o "resetar" do cabeçalho volta para ele.

import { m } from "@/lib/messages";
import { DEFAULT_TABLE_TYPE_SORT } from "@/lib/schemas/settings";
import type { TableColumnKey } from "@/lib/table-columns";

import type { TransactionRow as TxRow } from "./types";

export type SortDir = "asc" | "desc";
/**
 * Mesma FORMA de `DefaultSort` (`src/lib/schemas/settings.ts`) de propósito: é o
 * objeto que a aba "Comportamento" persiste, e a tabela consome sem tradução.
 */
export type SortState = { key: TableColumnKey; dir: SortDir };

/**
 * Piso de ordenação para quem renderiza a tabela sem tipo (ou fora do mês).
 * É o que o `TransactionTable` fazia quando `sort` era `null`: mais recente no
 * topo.
 *
 * É a MESMA constante que o default do banco (`DEFAULT_TABLE_TYPE_SORT`), e isso é
 * a invariante, não coincidência: tabela sem tipo e tipo que nunca foi mexido
 * mostram a mesma ordem. O default do P0 era `asc` e foi corrigido pela migração
 * `20260812120000_spec69_default_sort_desc_and_keep_ghost_row_off` justamente para
 * fechar essa diferença.
 */
export const FALLBACK_SORT: SortState = { ...DEFAULT_TABLE_TYPE_SORT };

/** Nomes resolvidos das entidades referenciadas por id, para ordenar por rótulo. */
export type SortLookups = {
  categoryById: Map<string, string>;
  subcategoryById: Map<string, string>;
  institutionById: Map<string, string>;
  partyById: Map<string, string>;
};

/**
 * Rótulo da parcela COMO A LINHA MOSTRA (mesma regra da célula "Parcela" em
 * `ColumnsRow`): grupo de parcelamento vira `3/12`; senão vale o texto livre
 * legado `cardInstallment`; senão não há parcela.
 */
export function installmentLabel(tx: TxRow): string | null {
  if (tx.installmentGroupId && tx.installmentNumber && tx.installmentGroupCount) {
    return m.transactions.installments.badge(tx.installmentNumber, tx.installmentGroupCount);
  }
  return tx.cardInstallment ?? null;
}

/**
 * Valor comparável de uma linha para uma chave de coluna.
 *
 * Strings vazias representam "campo em branco" e, por consequência, ficam no
 * começo em ordem crescente — a mesma leitura que qualquer planilha dá a uma
 * célula vazia. Quem quiser o vazio no fim inverte a direção.
 */
function sortValue(tx: TxRow, key: TableColumnKey, lookups: SortLookups): string | bigint {
  switch (key) {
    case "occurredOn":
      return tx.occurredOn;
    case "description":
      return tx.description ?? "";
    case "amount":
      return BigInt(tx.amountCents);
    case "category":
      return lookups.categoryById.get(tx.categoryId ?? "") ?? "";
    case "subcategory":
      return lookups.subcategoryById.get(tx.subcategoryId ?? "") ?? "";
    case "institution":
      return lookups.institutionById.get(tx.institutionId ?? "") ?? tx.institutionText ?? "";
    case "responsibleUser":
      return lookups.partyById.get(tx.responsiblePartyId ?? "") ?? "";
    case "paymentMethod":
      return tx.paymentMethod ? (m.transactions.paymentMethods[tx.paymentMethod] ?? "") : "";
    case "expenseType":
      return tx.expenseType ? (m.transactions.expenseTypes[tx.expenseType] ?? "") : "";
    case "investmentType":
      return tx.investmentType ?? "";
    case "cardInstallment":
      return installmentLabel(tx) ?? "";
    case "isPending":
      // Pendente primeiro em "crescente": o estado que pede ação vem antes.
      return tx.isPending ? "0" : "1";
    case "tags":
      return tx.tags.map((t) => t.name).join(", ");
    case "notes":
      return tx.notes ?? "";
  }
}

function compare(a: string | bigint, b: string | bigint): number {
  if (typeof a === "bigint" && typeof b === "bigint") {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return String(a).localeCompare(String(b));
}

/**
 * Ordena uma cópia das linhas. `Array.prototype.sort` é estável desde a ES2019,
 * então linhas com o mesmo valor preservam a ordem que vieram do servidor.
 */
export function sortRows(rows: TxRow[], sort: SortState, lookups: SortLookups): TxRow[] {
  return [...rows].sort((a, b) => {
    const cmp = compare(sortValue(a, sort.key, lookups), sortValue(b, sort.key, lookups));
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

/**
 * Ciclo de um clique no cabeçalho: coluna nova → crescente → decrescente →
 * **volta ao padrão do tipo**. Antes o terceiro passo devolvia `null`, que caía
 * num `occurredOn/desc` escrito no código; agora devolve o que o usuário
 * configurou na aba "Comportamento", que é o que ele espera de "voltar ao
 * padrão".
 */
export function nextSortState(
  current: SortState,
  key: TableColumnKey,
  fallback: SortState,
): SortState {
  if (current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  // 3º clique = voltar ao padrão do tipo. Exceto quando o padrão JÁ é este mesmo
  // estado (tipo com `{ mesma coluna, desc }`): aí o clique seria um no-op e o
  // cabeçalho pareceria quebrado. Nesse caso o ciclo recomeça em crescente.
  if (fallback.key === key && fallback.dir === "desc") return { key, dir: "asc" };
  return fallback;
}

/** `true` quando a ordenação em vigor não é a do tipo (habilita "voltar ao padrão"). */
export function isCustomSort(sort: SortState, fallback: SortState): boolean {
  return sort.key !== fallback.key || sort.dir !== fallback.dir;
}
