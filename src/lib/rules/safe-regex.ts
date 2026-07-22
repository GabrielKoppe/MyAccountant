// Guarda anti-ReDoS para o modo `regex` das regras de auto-categorização (spec 50).
//
// A condição `descriptionMode = "regex"` aceita uma expressão regular arbitrária do
// usuário, avaliada no motor puro (`evaluate.ts`) contra a descrição da transação —
// por linha no import (loop síncrono) e por tecla no lançamento manual. O motor de
// regex do JS não tem timeout: um padrão com backtracking catastrófico (ex.: `(a+)+$`)
// pode travar o event loop do processo Node, afetando TODAS as accounts servidas por
// ele. Por isso, além de validar que a regex COMPILA, rejeitamos no salvamento os
// padrões cuja forma sugere backtracking exponencial.
//
// IMPORTANTE: esta é uma heurística CONSERVADORA (star height > 1), não um detector
// completo. Ela barra a classe dominante (quantificador aninhado) e repetições/tamanho
// gigantes, mas não cobre 100% dos casos (ex.: alternância sobreposta `(a|a)*`). A
// mitigação robusta (motor RE2 sem backtracking, ou avaliação em worker com timeout)
// fica registrada como follow-up (spec 50 §6 DD-14). Pode gerar falso-positivo raro em
// padrões legítimos exóticos — o custo é o usuário simplificar o padrão.

const MAX_PATTERN_LENGTH = 1000;
const MAX_REPETITION = 100;

function isDangerousQuantifierChar(c: string): boolean {
  // `?` é opcional (não amplifica backtracking); só `*`, `+` e repetição `{` importam.
  return c === "*" || c === "+" || c === "{";
}

// Detecta "star height > 1": um grupo cujo conteúdo já contém um quantificador e que é
// ele próprio quantificado (ex.: `(a+)+`, `(.*)+`, `((\d+)x){2,}`). Grupos aninhados
// propagam o sinal para o grupo-pai.
function hasNestedQuantifier(pattern: string): boolean {
  const groupHasQuantifier: boolean[] = [];
  let inClass = false;

  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];

    if (c === "\\") {
      i++; // pula o caractere escapado
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") {
      inClass = true;
      continue;
    }

    if (c === "(") {
      groupHasQuantifier.push(false);
    } else if (c === ")") {
      const innerHasQuantifier = groupHasQuantifier.pop() ?? false;
      const next = pattern[i + 1];
      const groupIsQuantified = next !== undefined && isDangerousQuantifierChar(next);
      // Grupo com quantificador interno E ele mesmo quantificado ⇒ backtracking exponencial.
      if (innerHasQuantifier && groupIsQuantified) return true;
      // Propaga para o grupo-pai: um subgrupo quantificado conta como quantificador dele.
      if (groupHasQuantifier.length > 0 && (innerHasQuantifier || groupIsQuantified)) {
        groupHasQuantifier[groupHasQuantifier.length - 1] = true;
      }
    } else if (isDangerousQuantifierChar(c)) {
      if (groupHasQuantifier.length > 0) {
        groupHasQuantifier[groupHasQuantifier.length - 1] = true;
      }
    }
  }

  return false;
}

// Rejeita repetições bounded gigantes (ex.: `a{5000}`, `x{1,9999}`), que também
// explodem o tempo/memória de avaliação.
function hasHugeBoundedRepetition(pattern: string): boolean {
  const repRe = /\{(\d+)(?:,(\d*))?\}/g;
  let m: RegExpExecArray | null;
  while ((m = repRe.exec(pattern)) !== null) {
    const lo = Number(m[1]);
    const hi = m[2] !== undefined && m[2] !== "" ? Number(m[2]) : lo;
    if (lo > MAX_REPETITION || hi > MAX_REPETITION) return true;
  }
  return false;
}

/**
 * Heurística conservadora: `true` se o padrão tem forma associada a backtracking
 * catastrófico (ReDoS) e deve ser rejeitado no salvamento da regra.
 */
export function isLikelyCatastrophicRegex(pattern: string): boolean {
  if (pattern.length > MAX_PATTERN_LENGTH) return true;
  if (hasHugeBoundedRepetition(pattern)) return true;
  if (hasNestedQuantifier(pattern)) return true;
  return false;
}
