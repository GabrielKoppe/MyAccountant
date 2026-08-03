import { addMonths, format, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Ajusta um dia (1–31) para um mês específico, respeitando o último dia válido.
 * Ex: dia 31 em Junho → 30; dia 29 em Fevereiro não-bissexto → 28.
 */
export function applyDayToMonth(day: number, year: number, month: number): Date {
  const lastDay = getDaysInMonth(new Date(year, month - 1));
  return new Date(year, month - 1, Math.min(day, lastDay));
}

export function formatMonthLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  const label = format(date, "MMM/yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDateBr(date: Date | string): string {
  // parseLocalDate prevents UTC-vs-local timezone mismatch for YYYY-MM-DD strings
  const d = typeof date === "string" ? parseLocalDate(date) : date;
  return format(d, "dd/MM/yyyy");
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? parseLocalDate(date) : date;
  return format(d, "dd/MM", { locale: ptBR });
}

/**
 * Formata data no formato longo: "15 de junho". Usado nos headers de agrupamento.
 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === "string" ? parseLocalDate(date) : date;
  return format(d, "d 'de' MMMM", { locale: ptBR });
}

/**
 * Formata um timestamp (createdAt/updatedAt) no timezone do usuário como
 * "dd/MM/yyyy HH:mm". Usa Intl (built-in) para evitar dependência de date-fns-tz.
 * Recebe Date ou ISO string (timestamp UTC com hora — NÃO usar parseLocalDate aqui).
 */
export function formatDateTimeInTz(date: Date | string, timezone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getNextMonthSuggestion(lastMonth: { year: number; month: number }): {
  year: number;
  month: number;
} {
  if (lastMonth.month === 12) return { year: lastMonth.year + 1, month: 1 };
  return { year: lastMonth.year, month: lastMonth.month + 1 };
}

export function getMonthRange(
  year: number,
  month: number,
  monthStartDay: number,
): { start: Date; end: Date } {
  const daysInStart = getDaysInMonth(new Date(year, month - 1));
  const startDay = Math.min(monthStartDay, daysInStart);
  const start = new Date(year, month - 1, startDay, 0, 0, 0, 0);

  const nextMonthDate = addMonths(new Date(year, month - 1, 1), 1);
  const daysInNext = getDaysInMonth(nextMonthDate);
  const nextStartDay = Math.min(monthStartDay, daysInNext);
  const end = new Date(
    nextMonthDate.getFullYear(),
    nextMonthDate.getMonth(),
    nextStartDay - 1,
    23,
    59,
    59,
    999,
  );

  return { start, end };
}

export function getCurrentFiscalMonth(
  today: Date,
  monthStartDay: number,
): { year: number; month: number } {
  const day = today.getDate();
  if (day >= monthStartDay) {
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  }
  const prev = addMonths(today, -1);
  return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
}

// ─── Datas @db.Date em UTC (spec 73 §2.7) ────────────────────────────────────
// Colunas `@db.Date` (ex: PendingInstallment.expectedDate) são materializadas
// pelo Prisma como meia-noite **UTC**. Ler/gravar com os getters locais
// (getFullYear/getMonth) desloca a data para o mês adjacente em processo com
// offset de fuso não-zero. Estes helpers mantêm todo o cálculo em UTC — mesma
// convenção já usada em `src/server/queries/cashflow-forecast.ts`.

export type YearMonth = { year: number; month: number };

/** Desloca um par ano/mês por `offset` meses (aceita negativo). */
export function shiftYearMonth({ year, month }: YearMonth, offset: number): YearMonth {
  const zeroBased = year * 12 + (month - 1) + offset;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

/** Constrói uma data-only em UTC, ajustando o dia ao último válido do mês. */
export function utcDateOnly(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(day, lastDay)));
}

/** Extrai ano/mês de uma data `@db.Date` sem sofrer deslocamento de fuso. */
export function utcYearMonthOf(date: Date): YearMonth {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** Range fechado [primeiro dia, último instante] do mês, em UTC. */
export function utcMonthRange(year: number, month: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
