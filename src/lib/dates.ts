import { addMonths, getDaysInMonth, setDate } from "date-fns";

/**
 * Ajusta um dia (1–31) para um mês específico, respeitando o último dia válido.
 * Ex: dia 31 em Junho → 30; dia 29 em Fevereiro não-bissexto → 28.
 */
export function applyDayToMonth(day: number, year: number, month: number): Date {
  const lastDay = getDaysInMonth(new Date(year, month - 1));
  return new Date(year, month - 1, Math.min(day, lastDay));
}
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export function getNextMonthSuggestion(lastMonth: {
  year: number;
  month: number;
}): { year: number; month: number } {
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

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
