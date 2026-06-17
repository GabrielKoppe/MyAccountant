import type { CategorySum } from "@/lib/queries/dashboards";
import { BarList } from "./BarList";

type Props = {
  categories: CategorySum[];
};

/**
 * @deprecated Use `BarList` diretamente com `BarItem[]`.
 * Mantido como adapter para retrocompatibilidade.
 */
export function CategoryBarList({ categories }: Props) {
  const items = categories.map((c) => ({
    id: c.categoryId,
    name: c.name,
    valueCents: c.totalCents,
  }));
  return <BarList items={items} emptyMessage="Nenhuma categoria com transações." />;
}
