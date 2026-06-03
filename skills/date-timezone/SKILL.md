# SKILL — Datas e Timezones

## Quando usar

Sempre que tocar em datas: criar/exibir Transaction, calcular range de Mês, agregar dashboards, parsear input do usuário, ou converter timezones.

## Princípio

**Datas são complicadas. Não improvise.** Seguir convenções claras evita 90% dos bugs sutis.

## Modelo

| Campo | Tipo Prisma | Tipo JS | Storage | Significado |
|---|---|---|---|---|
| `occurredOn` | `DateTime @db.Date` | `Date` | só data (sem hora/tz) | Data da transação ("aconteceu no dia X") |
| `createdAt`, `updatedAt` | `DateTime` | `Date` | timestamp UTC com microseconds | Quando foi criada/modificada no sistema |
| `expiresAt` | `DateTime` | `Date` | timestamp UTC | Quando expira (invite, token) |
| `User.timezone` | `String` | `string` | IANA tz name | Timezone do usuário ("America/Sao_Paulo") |

## Tipos de uso

### 1. `occurredOn` — data sem timezone

Representa o **dia em que a transação aconteceu** no contexto do usuário. Não tem hora, não tem timezone.

- Postgres armazena como `date` (não `timestamptz`).
- Prisma declara: `occurredOn DateTime @db.Date`.
- TypeScript: `Date` mas só a parte de data importa.

```prisma
model Transaction {
  occurredOn DateTime @db.Date @map("occurred_on")
}
```

```ts
// Salvar
await prisma.transaction.create({
  data: {
    occurredOn: new Date("2026-01-15"), // UTC midnight
  },
});

// Exibir
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

format(transaction.occurredOn, "dd/MM/yyyy", { locale: ptBR });
// "15/01/2026"
```

⚠️ **Cuidado com timezone implícito — causa comum de Hydration Mismatch**:
```ts
// ❌ ERRADO — new Date("YYYY-MM-DD") cria UTC midnight
new Date("2026-06-01")
// Server (UTC):    01/06 ← renderiza correto
// Client (UTC-3):  31/05 ← React hydration mismatch!

// ❌ ERRADO — parseISO("YYYY-MM-DD") também cria UTC midnight
import { parseISO } from "date-fns";
parseISO("2026-06-01") // mesmo problema

// ✅ CERTO — parseLocalDate cria Date no horário local, sem ambiguidade de timezone
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day); // horário local, meia-noite local
}

// ✅ CERTO — as funções formatDateShort e formatDateBr usam parseLocalDate internamente
import { formatDateShort, formatDateBr } from "@/lib/dates";
formatDateShort("2026-06-01"); // → "01/06" (correto em qualquer timezone)
formatDateBr("2026-06-01");    // → "01/06/2026"
```

> **Regra**: strings `YYYY-MM-DD` (campo `occurredOn` serializado como string para o client) devem ser parseadas com `parseLocalDate`, nunca com `new Date()` ou `parseISO`. As funções `formatDateShort` e `formatDateBr` em `src/lib/dates.ts` já aplicam isso automaticamente quando recebem uma string.

### 2. `createdAt`, `updatedAt` — timestamps de sistema

Postgres armazena em UTC (`timestamptz`). Prisma converte para `Date` em JS (representação interna em UTC).

```ts
// Exibir em timezone do usuário
import { formatInTimeZone } from "date-fns-tz";

formatInTimeZone(
  transaction.createdAt,
  user.timezone, // "America/Sao_Paulo"
  "dd/MM/yyyy HH:mm",
  { locale: ptBR }
);
```

## `monthStartDay` — quando começa o mês fiscal

`AccountSettings.monthStartDay` define em que dia do mês a competência financeira começa.

**Exemplos**:
- `monthStartDay = 1` (default): Janeiro/2026 = 01/01/2026 a 31/01/2026.
- `monthStartDay = 5`: Janeiro/2026 = 05/01/2026 a 04/02/2026.
- `monthStartDay = 25`: Janeiro/2026 = 25/12/2025 a 24/01/2026 ⚠️ (começa no mês anterior!)

### Helper: range de um Mês

```ts
// src/lib/dates.ts
import { addMonths, setDate, subDays, startOfDay, endOfDay } from "date-fns";

export function getMonthRange(
  year: number,
  month: number, // 1-12
  monthStartDay: number
): { start: Date; end: Date } {
  // Mês "Janeiro/2026" com start day 5 = 05/01/2026 → 04/02/2026
  const start = startOfDay(setDate(new Date(year, month - 1, 1), monthStartDay));
  const nextMonthStart = setDate(addMonths(start, 1), monthStartDay);
  const end = endOfDay(subDays(nextMonthStart, 1));
  return { start, end };
}
```

> **Atenção** ao caso `monthStartDay > 28`: alguns meses não têm dia 30 ou 31. Usar `min(monthStartDay, lastDayOfMonth)`.

### Helper: mês corrente (para dashboard "este mês")

```ts
export function getCurrentMonth(
  today: Date,
  monthStartDay: number
): { year: number; month: number } {
  const day = today.getDate();
  if (day >= monthStartDay) {
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  } else {
    const prev = subMonths(today, 1);
    return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
  }
}
```

### Helper: próximo Mês a sugerir

Ao clicar "+ Novo mês", sugerir o **próximo mês após o último Mês criado**.

```ts
export function getNextMonthSuggestion(lastMonth: { year: number; month: number }) {
  if (lastMonth.month === 12) {
    return { year: lastMonth.year + 1, month: 1 };
  }
  return { year: lastMonth.year, month: lastMonth.month + 1 };
}
```

## Filtros de Transaction por Mês

Quando o filtro `monthId` está disponível, use ele:
```ts
where: { accountId, monthId }
```

Quando precisar filtrar por range de data (ex: dashboard), use `getMonthRange`:
```ts
const { start, end } = getMonthRange(2026, 1, account.settings.monthStartDay);
where: {
  accountId,
  occurredOn: { gte: start, lte: end },
}
```

> **Cuidado**: a tabela `Month` é um agrupamento explícito. Uma transação está na FinanceTable de Janeiro mesmo que sua `occurredOn` seja 02/02 (lançamento atrasado). Para "transações **fiscalmente** de janeiro", use range; para "transações no mês de janeiro do app", use `monthId`.

## Parseing de datas em CSV import

Ver `specs/10-csv-xlsx-import.md` §8.1. Resumo:

```ts
import { parse } from "date-fns";

const formats = {
  "DD/MM/YYYY": "dd/MM/yyyy",
  "DD/MM/YY": "dd/MM/yy",
  "YYYY-MM-DD": "yyyy-MM-dd",
  "MM/DD/YYYY": "MM/dd/yyyy",
};

export function parseCsvDate(value: string, format: keyof typeof formats): Date {
  const parsed = parse(value, formats[format], new Date());
  if (isNaN(parsed.getTime())) {
    throw new Error(`Data inválida: "${value}" (formato esperado: ${format})`);
  }
  return parsed;
}
```

**Excel serial dates** (XLSX) vêm como número:
```ts
import * as XLSX from "xlsx";

function excelSerialToDate(serial: number): Date {
  return XLSX.SSF.parse_date_code(serial);
}
```

## UI patterns

### Date picker (MUI X)

```tsx
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { ptBR } from "date-fns/locale";

// Em algum layout ou provider raiz
<LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
  {children}
</LocalizationProvider>

// Uso
<DatePicker
  label="Data"
  value={date}
  onChange={onChange}
  format="dd/MM/yyyy"
/>
```

### Exibição de data (relativa quando faz sentido)

```ts
import { formatRelative } from "date-fns";

formatRelative(date, new Date(), { locale: ptBR });
// "hoje às 14:30" / "ontem às 10:15" / "15/01/2026"
```

## Timezone do usuário

`UserSettings.timezone` (default `America/Sao_Paulo`).

### Conversão display
```ts
import { formatInTimeZone } from "date-fns-tz";

formatInTimeZone(createdAt, user.timezone, "dd/MM/yyyy HH:mm");
```

### "Hoje" no timezone do usuário
```ts
import { toZonedTime } from "date-fns-tz";

const todayInUserTz = toZonedTime(new Date(), user.timezone);
const startOfTodayInUserTz = startOfDay(todayInUserTz);
```

## Edge cases

### Mudança de horário de verão
- `America/Sao_Paulo` não tem mais DST (desde 2019).
- Outros timezones ainda têm. Sempre use libs (`date-fns-tz`), nunca subtração manual.

### `monthStartDay = 31`
- Em meses de 30 dias, ajustar para último dia disponível (`Math.min(31, lastDayOfMonth)`).
- Documentar no tooltip da config: "Em meses sem este dia, usa o último dia disponível".

### Transação em 29/02 (ano bissexto)
- Ao "copiar transação para próximo mês" com `updateDates`, 29/02 vira 28/02 (ou 01/03 em ano bissexto). Decisão: mapear para último dia do mês destino se não existir o dia.

### Range que cruza ano
- `getMonthRange(2025, 12, 25)` retorna `25/12/2025 → 24/01/2026`. Funciona naturalmente com `date-fns`.

### Servidor em UTC vs cliente em BRT
- Servidor (Vercel, Neon) sempre em UTC.
- `new Date()` no servidor retorna UTC. No cliente, retorna local.
- **Para "hoje" em decisões de negócio**: sempre converta para o timezone do user (do `UserSettings`).

## Bibliotecas

- **`date-fns`**: manipulação básica
- **`date-fns-tz`**: timezone conversion
- **`date-fns/locale/ptBR`**: formatação em português

> Não usar Moment (deprecated) nem Luxon (overkill para nosso caso).

## Anti-patterns

❌ `new Date(string)` com formato BR ("15/01/2026"). Use `parse`.
❌ `Date.now() - Date.now()` para diff em dias (não dá conta de DST/leap).
❌ Comparar `occurredOn` com timestamp tendo hora (always set time to midnight).
❌ Assumir que servidor está no timezone do usuário.
❌ Salvar string formatada no banco. Use `Date` / `@db.Date`.
❌ Esquecer de passar `locale: ptBR` em `format`.

## Testes

```ts
describe("getMonthRange", () => {
  it("monthStartDay=1 returns calendar month", () => {
    const r = getMonthRange(2026, 1, 1);
    expect(r.start.toISOString()).toContain("2026-01-01");
    expect(r.end.toISOString()).toContain("2026-01-31");
  });

  it("monthStartDay=5 crosses calendar month", () => {
    const r = getMonthRange(2026, 1, 5);
    expect(r.start.toISOString()).toContain("2026-01-05");
    expect(r.end.toISOString()).toContain("2026-02-04");
  });

  it("monthStartDay=31 in February clamps to last day", () => {
    const r = getMonthRange(2026, 2, 31);
    // Fev 2026 não tem dia 31, usa dia 28
    expect(r.start.getDate()).toBe(28);
  });
});
```
