"use client";

import type {
  TransactionExpenseType,
  TransactionPaymentMethod,
  TransactionSource,
} from "@prisma/client";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";

import type {
  CategoryOption,
  InstitutionOption,
  ResponsiblePartyOption,
  TransactionRow,
} from "@/components/transactions/types";

export type MonthFilterState = {
  categories: string[];
  institutions: string[];
  responsible: string[];
  pending: boolean;
  favorite: boolean;
  expenseTypes: TransactionExpenseType[];
  sources: TransactionSource[];
  tagIds: string[];
  paymentMethods: TransactionPaymentMethod[];
};

export const EMPTY_FILTERS: MonthFilterState = {
  categories: [],
  institutions: [],
  responsible: [],
  pending: false,
  favorite: false,
  expenseTypes: [],
  sources: [],
  tagIds: [],
  paymentMethods: [],
};

export function hasActiveFilters(filters: MonthFilterState): boolean {
  return (
    filters.categories.length > 0 ||
    filters.institutions.length > 0 ||
    filters.responsible.length > 0 ||
    filters.pending ||
    filters.favorite ||
    filters.expenseTypes.length > 0 ||
    filters.sources.length > 0 ||
    filters.tagIds.length > 0 ||
    filters.paymentMethods.length > 0
  );
}

export function countActiveFilters(filters: MonthFilterState): number {
  return (
    filters.categories.length +
    filters.institutions.length +
    filters.responsible.length +
    (filters.pending ? 1 : 0) +
    (filters.favorite ? 1 : 0) +
    (filters.expenseTypes.length > 0 ? 1 : 0) +
    (filters.sources.length > 0 ? 1 : 0) +
    (filters.tagIds.length > 0 ? 1 : 0) +
    (filters.paymentMethods.length > 0 ? 1 : 0)
  );
}

export function applyGlobalFilters(
  rows: TransactionRow[],
  filters: MonthFilterState,
): TransactionRow[] {
  if (!hasActiveFilters(filters)) return rows;
  return rows.filter((row) => {
    if (filters.categories.length > 0 && !filters.categories.includes(row.categoryId ?? ""))
      return false;
    if (filters.institutions.length > 0 && !filters.institutions.includes(row.institutionId ?? ""))
      return false;
    if (
      filters.responsible.length > 0 &&
      !filters.responsible.includes(row.responsiblePartyId ?? "")
    )
      return false;
    if (filters.pending && !row.isPending) return false;
    if (filters.favorite && !row.isFavorite) return false;
    if (
      filters.expenseTypes.length > 0 &&
      !filters.expenseTypes.includes(row.expenseType as TransactionExpenseType)
    )
      return false;
    if (filters.sources.length > 0 && !filters.sources.includes(row.source as TransactionSource))
      return false;
    if (filters.tagIds.length > 0 && !row.tags.some((t) => filters.tagIds.includes(t.id)))
      return false;
    if (
      filters.paymentMethods.length > 0 &&
      !filters.paymentMethods.includes(row.paymentMethod as TransactionPaymentMethod)
    )
      return false;
    return true;
  });
}

type FilterOptions = {
  categories: CategoryOption[];
  institutions: InstitutionOption[];
  parties: ResponsiblePartyOption[];
  tags: { id: string; name: string; color: string | null }[];
};

type MonthFilterContextValue = {
  filters: MonthFilterState;
  setFilters: (filters: MonthFilterState) => void;
  clearFilters: () => void;
  options: FilterOptions;
  updateTagInOptions: (tagId: string, name: string, color: string | null) => void;
  isActive: boolean;
  activeCount: number;
};

const MonthFilterContext = createContext<MonthFilterContextValue | null>(null);

type ProviderProps = {
  children: React.ReactNode;
  initialFilters: MonthFilterState;
  options: FilterOptions;
};

export function MonthFilterProvider({
  children,
  initialFilters,
  options: initialOptions,
}: ProviderProps) {
  const router = useRouter();
  const [filters, setFiltersState] = useState<MonthFilterState>(initialFilters);
  const [options, setOptions] = useState<FilterOptions>(initialOptions);

  const updateTagInOptions = useCallback((tagId: string, name: string, color: string | null) => {
    setOptions((prev) => ({
      ...prev,
      tags: prev.tags.map((t) => (t.id === tagId ? { ...t, name, color } : t)),
    }));
  }, []);

  const setFilters = useCallback(
    (newFilters: MonthFilterState) => {
      setFiltersState(newFilters);

      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
      );

      if (newFilters.categories.length > 0) {
        params.set("categories", newFilters.categories.join(","));
      } else {
        params.delete("categories");
      }

      if (newFilters.institutions.length > 0) {
        params.set("institutions", newFilters.institutions.join(","));
      } else {
        params.delete("institutions");
      }

      if (newFilters.responsible.length > 0) {
        params.set("responsible", newFilters.responsible.join(","));
      } else {
        params.delete("responsible");
      }

      if (newFilters.pending) {
        params.set("pending", "1");
      } else {
        params.delete("pending");
      }

      if (newFilters.favorite) {
        params.set("favorite", "1");
      } else {
        params.delete("favorite");
      }

      if (newFilters.expenseTypes.length > 0) {
        params.set("expenseTypes", newFilters.expenseTypes.join(","));
      } else {
        params.delete("expenseTypes");
      }

      if (newFilters.sources.length > 0) {
        params.set("sources", newFilters.sources.join(","));
      } else {
        params.delete("sources");
      }

      if (newFilters.tagIds.length > 0) {
        params.set("tagIds", newFilters.tagIds.join(","));
      } else {
        params.delete("tagIds");
      }

      if (newFilters.paymentMethods.length > 0) {
        params.set("paymentMethods", newFilters.paymentMethods.join(","));
      } else {
        params.delete("paymentMethods");
      }

      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router],
  );

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, [setFilters]);

  return (
    <MonthFilterContext.Provider
      value={{
        filters,
        setFilters,
        clearFilters,
        options,
        updateTagInOptions,
        isActive: hasActiveFilters(filters),
        activeCount: countActiveFilters(filters),
      }}
    >
      {children}
    </MonthFilterContext.Provider>
  );
}

export function useMonthFilters(): MonthFilterContextValue {
  const ctx = useContext(MonthFilterContext);
  if (!ctx) throw new Error("useMonthFilters must be used inside MonthFilterProvider");
  return ctx;
}
