// Sem imports de server — client (UI + preview do import) e server (import) importam.
// AliasCandidate é o subset mínimo p/ o match. O tipo serializado completo
// (SerializedTransactionAlias) é um superset: payload + nomes denormalizados
// (categoryName/…) p/ o preview WYSIWYG do import. matchAlias<T> aceita o superset.
export interface AliasCandidate {
  id: string;
  trigger: string;
  triggerNormalized: string; // já em lowercase (coluna)
  updatedAt: string; // UTC ISO (Date.toISOString) — mesmo serializer nos dois lados, senão o desempate diverge
}

// Uma passada, chaves pré-normalizadas, desempate determinístico (gatilho mais
// longo → updatedAt mais recente).
export function matchAlias<T extends AliasCandidate>(
  description: string | null | undefined,
  aliases: readonly T[],
): T | null {
  if (!description) return null;
  const haystack = description.toLowerCase();
  let best: T | null = null;
  for (const a of aliases) {
    if (!a.triggerNormalized || !haystack.includes(a.triggerNormalized)) continue;
    if (
      best === null ||
      a.triggerNormalized.length > best.triggerNormalized.length ||
      (a.triggerNormalized.length === best.triggerNormalized.length && a.updatedAt > best.updatedAt)
    ) {
      best = a;
    }
  }
  return best;
}
