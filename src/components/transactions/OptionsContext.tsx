"use client";

import { createContext, useContext } from "react";

type OptionsContextValue = {
  onCreateCategory: (name: string) => Promise<string | null>;
  onCreateSubcategory: (categoryId: string, name: string) => Promise<string | null>;
  onCreateInstitution: (name: string) => Promise<string | null>;
  /** Gate global: reflete `canEdit` do TransactionTable (papel do usuário na Account). */
  canManageOptions: boolean;
};

/** Contexto que dá aos CreatableEntitySelect da linha acesso às actions de criação
 *  (categoria/subcategoria/instituição) sem prop drilling. Provido pelo TransactionTable. */
const OptionsContext = createContext<OptionsContextValue | null>(null);

export { OptionsContext };

export function OptionsProvider({
  value,
  children,
}: {
  value: OptionsContextValue;
  children: React.ReactNode;
}) {
  return <OptionsContext.Provider value={value}>{children}</OptionsContext.Provider>;
}

export function useOptions(): OptionsContextValue {
  const ctx = useContext(OptionsContext);
  if (!ctx) {
    throw new Error("useOptions deve ser usado dentro de um OptionsProvider");
  }
  return ctx;
}
