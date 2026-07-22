"use client";

import { useEffect, useMemo, useState } from "react";

import { matchAlias } from "@/lib/aliases/match";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

const DEBOUNCE_MS = 280;

/**
 * Sugestão de apelido 100% client para o popover manual (§2.4), debounced na
 * descrição — sem chamada ao servidor por tecla. Roda o motor de apelido
 * (`matchAlias`) sobre a descrição digitada, mais `amountCents` e `institutionId`
 * da linha (condições avançadas de faixa/instituição do apelido). Só a descrição
 * é debounced; valor e instituição entram ao vivo (mudam por seleção, não por
 * digitação, e não precisam de folga).
 *
 * `enabled=false` mantém o hook montado (regra dos hooks) mas nunca sugere nada
 * (gate genérico; hoje os editores passam `true`, o modo visualização não usa
 * este hook). Retorna o apelido vencedor (desempate em `matchAlias`) ou null.
 */
export function useSuggestions(
  description: string,
  amountCents: bigint | null,
  institutionId: string | null,
  aliases: readonly SerializedTransactionAlias[],
  enabled: boolean,
): SerializedTransactionAlias | null {
  const [debounced, setDebounced] = useState(description);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(description), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [description]);

  return useMemo(
    () =>
      enabled
        ? matchAlias({ description: debounced, amountCents, institutionId }, aliases)
        : null,
    [enabled, debounced, amountCents, institutionId, aliases],
  );
}
