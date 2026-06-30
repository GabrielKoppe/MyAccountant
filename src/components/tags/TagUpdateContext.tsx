"use client";

import { createContext, useContext } from "react";

type TagUpdateFn = (tagId: string, name: string, color: string | null) => void;

/** Contexto que permite ao TagEditor propagar mudanças de nome/cor para todas as
 *  linhas da tabela sem prop drilling. Provido pelo TransactionTable. */
const TagUpdateContext = createContext<TagUpdateFn | null>(null);

export { TagUpdateContext };

export function useTagUpdate(): TagUpdateFn | null {
  return useContext(TagUpdateContext);
}
