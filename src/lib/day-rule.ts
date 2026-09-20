import { m } from "@/lib/messages";

/**
 * Spec 69 §2.2 (D2) — "Dia" de uma transação de modelo é RELATIVO: resolve para
 * a data real do mês em que a tabela nascer.
 *
 * Persistido em `TableTemplateItem.dayRule` como string: `"5"`, `"last"` ou
 * `"firstBusiness"`. A coluna `day` (Int, NOT NULL) continua existindo e é
 * mantida em espelho por `dayRuleToDay` — ela ainda ordena os itens e alimenta
 * quem não conhece `dayRule`.
 *
 * Módulo PURO: sem Prisma, sem React. Só date-fns não é necessário aqui — a
 * aritmética de calendário cabe em `Date` nativo.
 */
export type DayRule = { kind: "fixed"; day: number } | { kind: "last" } | { kind: "firstBusiness" };

export const DAY_RULE_LAST = "last";
export const DAY_RULE_FIRST_BUSINESS = "firstBusiness";

/** Aceita `last`, `firstBusiness` ou um inteiro de 1 a 31. */
export const DAY_RULE_PATTERN = /^(?:last|firstBusiness|[1-9]|[12][0-9]|3[01])$/;

export function isDayRuleString(raw: unknown): raw is string {
  return typeof raw === "string" && DAY_RULE_PATTERN.test(raw);
}

function clampDay(day: number): number {
  if (!Number.isFinite(day)) return 1;
  return Math.min(31, Math.max(1, Math.trunc(day)));
}

/**
 * `raw` vem do banco e pode ser `null` (item anterior à Spec 69) ou lixo — nos
 * dois casos cai no `fallbackDay`, que é a coluna `day` do próprio item.
 */
export function parseDayRule(raw: string | null | undefined, fallbackDay: number): DayRule {
  if (raw === DAY_RULE_LAST) return { kind: "last" };
  if (raw === DAY_RULE_FIRST_BUSINESS) return { kind: "firstBusiness" };
  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    const parsed = Number(raw);
    if (parsed >= 1 && parsed <= 31) return { kind: "fixed", day: parsed };
  }
  return { kind: "fixed", day: clampDay(fallbackDay) };
}

export function serializeDayRule(rule: DayRule): string {
  switch (rule.kind) {
    case "last":
      return DAY_RULE_LAST;
    case "firstBusiness":
      return DAY_RULE_FIRST_BUSINESS;
    case "fixed":
      return String(clampDay(rule.day));
  }
}

/**
 * Valor a gravar na coluna legada `day` (NOT NULL, usada no `orderBy`).
 * `last` vira 31 para ordenar por último; `firstBusiness` vira 1.
 */
export function dayRuleToDay(rule: DayRule): number {
  switch (rule.kind) {
    case "last":
      return 31;
    case "firstBusiness":
      return 1;
    case "fixed":
      return clampDay(rule.day);
  }
}

/**
 * Resolve a regra para a data real de um mês (`month` 1–12).
 *
 * - `fixed` com dia maior que o mês cai no ÚLTIMO dia (31 em fevereiro → 28/29);
 * - `last` é o último dia do mês;
 * - `firstBusiness` é o primeiro dia útil, considerando ÚTIL = segunda a sexta.
 *   **Sem calendário de feriados** — decisão consciente: um calendário nacional
 *   (móvel, com variação estadual e municipal) é dependência e manutenção que a
 *   Spec 69 não pede. Se um feriado cair no primeiro dia útil, a transação nasce
 *   nele e o usuário ajusta a data na tabela.
 *
 * Constrói a data em horário LOCAL, igual a `applyDayToMonth` de `@/lib/dates` —
 * `occurred_on` é `@db.Date` (sem timezone) e as duas precisam concordar.
 */
export function resolveDayRule(rule: DayRule, year: number, month: number): Date {
  const lastDay = daysInMonth(year, month);

  switch (rule.kind) {
    case "last":
      return new Date(year, month - 1, lastDay);
    case "firstBusiness": {
      const date = new Date(year, month - 1, 1);
      // 0 = domingo, 6 = sábado.
      while (date.getDay() === 0 || date.getDay() === 6) {
        date.setDate(date.getDate() + 1);
      }
      return date;
    }
    case "fixed":
      return new Date(year, month - 1, Math.min(clampDay(rule.day), lastDay));
  }
}

/** Dias do mês (`month` 1–12). Dia 0 do mês seguinte = último dia deste. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Rótulo para a UI — "dia 5", "último dia", "primeiro dia útil". */
export function formatDayRule(rule: DayRule): string {
  const labels = m.settings.presentation.models.transactions.dayRule;
  switch (rule.kind) {
    case "last":
      return labels.last;
    case "firstBusiness":
      return labels.firstBusiness;
    case "fixed":
      return labels.fixed(clampDay(rule.day));
  }
}
