"use client";

import { useEffect, useMemo, useState } from "react";

import { matchAlias } from "@/lib/aliases/match";
import type { SerializedTransactionAlias } from "@/lib/serializers/transaction-alias";

const DEBOUNCE_MS = 280;

/**
 * Detecção de apelido 100% client, debounced (§2.4) — sem chamada ao servidor
 * por tecla. `enabled=false` mantém o hook montado (regra dos hooks) mas nunca
 * retorna match — usado pelo editor para não acender no mount (descriptionDirty).
 */
export function useAliasMatch(
  description: string,
  aliases: readonly SerializedTransactionAlias[],
  enabled: boolean,
): SerializedTransactionAlias | null {
  const [debounced, setDebounced] = useState(description);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(description), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [description]);

  return useMemo(
    () => (enabled ? matchAlias(debounced, aliases) : null),
    [debounced, aliases, enabled],
  );
}
