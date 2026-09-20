// Agrupamento em blocos da tabela de transações (Spec 69 §2.1 · aba
// "Comportamento": `TableType.groupBy` + `showGroupSubtotal`).
//
// ─── Precedência entre `TableType.groupBy` e `FinanceTable.groupByDate` ───────
//
// São dois campos diferentes, em níveis diferentes, e continuam existindo os
// dois (a §16 da Spec 69 avisa que confundi-los foi erro na primeira leitura):
//
//   • `TableType.groupBy` — POR TIPO. Vale para as quatro dimensões
//     (`date | category | responsible | installment`) e é o **padrão** de toda
//     tabela daquele tipo.
//   • `FinanceTable.groupByDate` — POR TABELA, booleano, alternável no menu ⋮ do
//     card. Existe desde antes desta spec e só fala de UMA dimensão: data.
//
// A regra adotada (`resolveGrouping`) é: **o toggle da tabela manda no eixo
// DATA; o tipo manda no resto.** Ou seja
//
//   groupByDate = true                 → agrupa por data, dê o tipo o que der
//   groupByDate = false, tipo = date   → não agrupa (o usuário desagrupou ESTA tabela)
//   groupByDate = false, tipo = outro  → agrupa pela dimensão do tipo
//   groupByDate = false, tipo = null   → não agrupa
//
// Por quê assim: o toggle do ⋮ é uma decisão explícita, feita naquela tabela,
// depois de ver os dados — não pode ser sobrescrita por um padrão herdado. Mas
// ele é um booleano sobre data; ler o `false` dele como "não agrupe por nada"
// daria a um controle que nunca falou de categoria o poder de vetar categoria.
// A alternativa (o tipo sempre vencer) transformaria o item de menu num botão
// que não faz nada em metade dos tipos — pior, porque ele continua na tela.

import { formatDateLong } from "@/lib/dates";
import { m } from "@/lib/messages";
import type { GroupBy } from "@/lib/schemas/settings";

import { installmentLabel } from "./sort-rows";
import type { TransactionRow as TxRow } from "./types";

export type RowGroup = {
  /** Identidade estável do bloco (id da entidade, ISO da data, rótulo da parcela). */
  key: string;
  label: string;
  rows: TxRow[];
  /** Soma das linhas do bloco, em centavos. `BigInt` ponta a ponta. */
  subtotalCents: bigint;
  /** Bloco dos que não têm valor nesta dimensão — sempre o último. */
  isEmptyBucket: boolean;
};

export type GroupLookups = {
  categoryById: Map<string, string>;
  partyById: Map<string, string>;
};

/**
 * Decide a dimensão de agrupamento efetiva da tabela. Ver o bloco de
 * precedência no topo do arquivo.
 *
 * `sortField` entra porque o agrupamento por DATA só faz sentido com as linhas
 * ordenadas por data — é a regra que já existia (blocos por data eram suprimidos
 * ao ordenar por valor) e que se perde se o agrupamento passar a bucketizar
 * cegamente. As outras três dimensões não dependem da ordenação: os blocos são
 * montados por chave, não por vizinhança.
 */
export function resolveGrouping(
  typeGroupBy: GroupBy,
  tableGroupByDate: boolean,
  sortField: string,
): GroupBy {
  const effective: GroupBy = tableGroupByDate ? "date" : typeGroupBy === "date" ? null : typeGroupBy;
  if (effective === "date" && sortField !== "occurredOn") return null;
  return effective;
}

/** Chave + rótulo do bloco a que a linha pertence. `key: null` = bloco "sem …". */
function bucketOf(
  tx: TxRow,
  groupBy: Exclude<GroupBy, null>,
  lookups: GroupLookups,
): { key: string; label: string } | null {
  switch (groupBy) {
    case "date":
      // Data nunca é nula na transação — não existe bloco "sem data".
      return { key: tx.occurredOn, label: formatDateLong(tx.occurredOn) };
    case "category": {
      const name = tx.categoryId ? lookups.categoryById.get(tx.categoryId) : undefined;
      return name ? { key: tx.categoryId!, label: name } : null;
    }
    case "responsible": {
      const name = tx.responsiblePartyId ? lookups.partyById.get(tx.responsiblePartyId) : undefined;
      return name ? { key: tx.responsiblePartyId!, label: name } : null;
    }
    case "installment": {
      // Agrupa pelo rótulo que a coluna "Parcela" EXIBE — a dimensão que o
      // usuário vê. Ver `installmentLabel`.
      const label = installmentLabel(tx);
      return label ? { key: label, label } : null;
    }
  }
}

/**
 * Rótulo do bloco que recolhe as linhas sem valor na dimensão.
 *
 * ⚠️ Reuso de chaves de OUTRO namespace (`m.dashboards.members.*`): as frases
 * "Sem categoria" e "Sem responsável" já existem lá, e este arquivo não pode
 * editar `src/lib/messages/pt-BR.ts` nesta rodada. `installment` cai em
 * `m.common.none` porque **não existe** uma string "Sem parcela" no catálogo —
 * está reportado como pendência.
 */
function emptyBucketLabel(groupBy: Exclude<GroupBy, null>): string {
  switch (groupBy) {
    case "date":
      return "";
    case "category":
      return m.dashboards.members.uncategorized;
    case "responsible":
      return m.dashboards.members.unassigned;
    case "installment":
      return m.common.none;
  }
}

/**
 * Monta os blocos preservando a ordem em que as chaves aparecem nas linhas já
 * ordenadas (o bloco herda a posição da sua primeira linha), com o bloco "sem …"
 * sempre por último. Assim, agrupar não reordena as linhas: só as separa.
 */
export function groupRows(
  rows: TxRow[],
  groupBy: Exclude<GroupBy, null>,
  lookups: GroupLookups,
): RowGroup[] {
  const byKey = new Map<string, RowGroup>();
  const empty: RowGroup = {
    key: "",
    label: emptyBucketLabel(groupBy),
    rows: [],
    subtotalCents: 0n,
    isEmptyBucket: true,
  };

  for (const tx of rows) {
    const bucket = bucketOf(tx, groupBy, lookups);
    const group =
      bucket === null
        ? empty
        : (byKey.get(bucket.key) ??
          (() => {
            const created: RowGroup = {
              key: bucket.key,
              label: bucket.label,
              rows: [],
              subtotalCents: 0n,
              isEmptyBucket: false,
            };
            byKey.set(bucket.key, created);
            return created;
          })());
    group.rows.push(tx);
    group.subtotalCents += BigInt(tx.amountCents);
  }

  const groups = Array.from(byKey.values());
  if (empty.rows.length > 0) groups.push(empty);
  return groups;
}
