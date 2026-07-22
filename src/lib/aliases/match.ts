// Sem imports de server — client (UI + preview do import) e server (import) importam.
// Só tipos do @prisma/client (AliasMatchMode/AliasPriority são uniões de string
// literais em runtime; a comparação usa os literais, sem valor importado).
//
// AliasCandidate é o subset mínimo p/ o match. O tipo serializado completo
// (SerializedTransactionAlias) é um superset: payload + nomes denormalizados
// (categoryName/…) p/ o preview WYSIWYG do import. matchAlias<T> aceita o superset.
//
// minCents/maxCents chegam como string (BigInt serializado; mesmo serializer nos
// dois lados) e são comparados em BigInt — NUNCA Float (money-handling).
import type { AliasMatchMode, AliasPriority } from "@prisma/client";

export interface AliasCandidate {
  id: string;
  trigger: string; // case original — usado como fonte do padrão no modo regex
  triggerNormalized: string; // já em lowercase (coluna) — usado no modo contains
  triggerMode: AliasMatchMode; // "contains" (padrão) | "regex"
  priority: AliasPriority; // "high" | "medium" | "low" — 1º critério de desempate
  conditionInstitutionId: string | null; // condição avançada (AND) — instituição da transação
  minCents: string | null; // BigInt serializado; faixa de valor (AND)
  maxCents: string | null; // BigInt serializado; faixa de valor (AND)
  updatedAt: string; // UTC ISO (Date.toISOString) — mesmo serializer nos dois lados, senão o desempate diverge
}

// Entrada rica do match: gatilho contra a descrição + condições avançadas contra
// o valor e a instituição da transação-alvo.
export interface MatchInput {
  description: string | null | undefined;
  amountCents: bigint | null;
  institutionId: string | null;
}

const PRIORITY_RANK: Record<AliasPriority, number> = { high: 3, medium: 2, low: 1 };

function priorityRank(p: AliasPriority): number {
  return PRIORITY_RANK[p] ?? PRIORITY_RANK.medium;
}

// (a) O gatilho casa a descrição segundo o modo. contains = substring lowercase;
// regex = padrão (case original) testado contra a descrição original. Regex
// inválida nunca casa (defensivo — a validade é garantida no salvamento).
function triggerMatches(a: AliasCandidate, description: string, haystack: string): boolean {
  if (a.triggerMode === "regex") {
    try {
      return new RegExp(a.trigger).test(description);
    } catch {
      return false;
    }
  }
  return haystack.includes(a.triggerNormalized);
}

// (b) Faixa de valor (condição avançada, AND). Ausente dos dois lados = sem
// restrição. Preenchida mas sem valor na transação = não casa (condição não
// satisfazível). Comparação em BigInt.
function amountInRange(a: AliasCandidate, amountCents: bigint | null): boolean {
  if (a.minCents === null && a.maxCents === null) return true;
  if (amountCents === null) return false;
  if (a.minCents !== null && amountCents < BigInt(a.minCents)) return false;
  if (a.maxCents !== null && amountCents > BigInt(a.maxCents)) return false;
  return true;
}

// Desempate determinístico: prioridade (high>medium>low) → gatilho normalizado
// mais longo → updatedAt mais recente.
function isBetter(a: AliasCandidate, best: AliasCandidate): boolean {
  const pa = priorityRank(a.priority);
  const pb = priorityRank(best.priority);
  if (pa !== pb) return pa > pb;
  if (a.triggerNormalized.length !== best.triggerNormalized.length) {
    return a.triggerNormalized.length > best.triggerNormalized.length;
  }
  return a.updatedAt > best.updatedAt;
}

// Uma passada. Um apelido casa quando o gatilho casa E todas as condições
// avançadas PREENCHIDAS casam (AND). Dentre os que casam, um vencedor por isBetter.
export function matchAlias<T extends AliasCandidate>(
  input: MatchInput,
  aliases: readonly T[],
): T | null {
  const { description, amountCents, institutionId } = input;
  if (!description) return null;
  const haystack = description.toLowerCase();
  let best: T | null = null;
  for (const a of aliases) {
    if (!a.triggerNormalized) continue;
    if (!triggerMatches(a, description, haystack)) continue;
    // Condições avançadas (AND com o gatilho) — só as preenchidas restringem.
    if (a.conditionInstitutionId !== null && a.conditionInstitutionId !== institutionId) continue;
    if (!amountInRange(a, amountCents)) continue;
    if (best === null || isBetter(a, best)) best = a;
  }
  return best;
}
