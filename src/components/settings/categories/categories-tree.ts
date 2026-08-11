// Spec 68 §2.2 — lógica pura da árvore de Categorias (busca, ordenação). Módulo SEM
// React: fica testável isoladamente dos componentes que o consomem (`CategoriesManager`,
// `CategoryRow`), como pede o §8 da spec.

import {
  SETTINGS_GRIP_WIDTH,
  SETTINGS_MENU_WIDTH,
} from "@/components/settings/table/settings-table-tokens";

export type CategoryStatus = "active" | "inactive";

/**
 * Spec 68 §2.2 — as três ordenações da toolbar. NÃO existe "mais usadas": contar uso
 * varreria `Transaction` numa lista, o que o SET-07 da Spec 67 proíbe (§2.2).
 */
export type CategorySortMode = "manual" | "alphabetical" | "recent";

export type SubcategoryItem = {
  id: string;
  name: string;
  order: number;
  status: CategoryStatus;
  lastUsedAt: Date | string | null;
};

export type CategoryItem = {
  id: string;
  name: string;
  order: number;
  status: CategoryStatus;
  lastUsedAt: Date | string | null;
  subcategories: SubcategoryItem[];
};

/** Quem está sendo renomeado no momento (RowActionsMenu → "Editar"). Um só por vez. */
export type EditTarget =
  | { scope: "category"; id: string }
  | { scope: "subcategory"; id: string; categoryId: string };

/**
 * Larguras das colunas da tabela (alça · expandir · Nome · Status · menu — revisão de
 * estilo). "Seção padrão" saiu da lista (decisão do desenvolvedor: a coluna nunca fez
 * sentido — ver o comentário de depreciação em `Category.defaultSectionId` no schema).
 *
 * `drag`/`menu` vêm dos tokens compartilhados da tabela de Configurações — a alça e o
 * menu são a MESMA medida nas quatro páginas da família Estrutura. `expand` é
 * específico de Categorias (é a única lista com hierarquia) e usa a largura da alça
 * por simetria visual, já que os dois ícones ficam lado a lado na mesma faixa.
 */
export const CATEGORY_TABLE_COLUMNS = {
  drag: SETTINGS_GRIP_WIDTH,
  expand: SETTINGS_GRIP_WIDTH,
  status: 150,
  menu: SETTINGS_MENU_WIDTH,
} as const;

/** Total de colunas da tabela — alimenta o `colSpan` do painel expandido de
 * subcategorias e o `columnCount` das duas linhas-fantasma (categoria e subcategoria). */
export const CATEGORY_COLUMN_COUNT = 5;

/**
 * Normaliza para comparação de busca: sem acento e sem caixa, para que "alimentacao"
 * ache "Alimentação". Local ao módulo (mesmo raciocínio do `TransactionAliasesManager`):
 * é comparação de string de UI, não regra de domínio — não vira util de `@/lib`.
 */
function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();
}

/**
 * Critério de aceite (Spec 68 §4): busca que casa uma subcategoria PUXA o pai para o
 * resultado mesmo que o nome do pai não bata — só que aqui só as subcategorias que
 * casaram aparecem, não a árvore inteira. Quando é o NOME DO PAI que bate, a árvore
 * inteira dele aparece (o usuário buscou a categoria, não uma subcategoria específica).
 */
export function filterCategoryTree(
  categories: CategoryItem[],
  { query }: { query: string },
): CategoryItem[] {
  const normalizedQuery = normalizeForSearch(query.trim());
  if (!normalizedQuery) return categories;

  const result: CategoryItem[] = [];
  for (const category of categories) {
    const categoryMatches = normalizeForSearch(category.name).includes(normalizedQuery);
    if (categoryMatches) {
      result.push(category);
      continue;
    }
    const matchingSubs = category.subcategories.filter((sub) =>
      normalizeForSearch(sub.name).includes(normalizedQuery),
    );
    if (matchingSubs.length > 0) {
      result.push({ ...category, subcategories: matchingSubs });
    }
  }
  return result;
}

type Sortable = { name: string; order: number; lastUsedAt: Date | string | null };

function timeValue(value: Date | string | null): number | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

/**
 * Um comparador por modo, reusado nos dois níveis da árvore (categorias de topo E
 * subcategorias dentro de cada pai) — a spec não distingue ordenação por nível.
 */
function compareBySortMode(mode: CategorySortMode) {
  return (a: Sortable, b: Sortable): number => {
    if (mode === "alphabetical") return a.name.localeCompare(b.name, "pt-BR");
    if (mode === "recent") {
      const at = timeValue(a.lastUsedAt);
      const bt = timeValue(b.lastUsedAt);
      // `lastUsedAt desc, com null no fim` (Spec 68 §2.2) — nunca usada é "menos
      // recente" que qualquer uso real, então vai para o final da lista.
      if (at === null && bt === null) return 0;
      if (at === null) return 1;
      if (bt === null) return -1;
      return bt - at;
    }
    return a.order - b.order; // manual (default)
  };
}

export function sortCategoryTree(
  categories: CategoryItem[],
  mode: CategorySortMode,
): CategoryItem[] {
  const compare = compareBySortMode(mode);
  return [...categories].sort(compare).map((category) => ({
    ...category,
    subcategories: [...category.subcategories].sort(compare),
  }));
}

/** Composição filtro + ordenação — é o que a toolbar e a tabela consomem direto. */
export function getVisibleCategories(
  categories: CategoryItem[],
  filter: { query: string },
  sortMode: CategorySortMode,
): CategoryItem[] {
  return sortCategoryTree(filterCategoryTree(categories, filter), sortMode);
}
