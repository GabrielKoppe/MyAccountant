# SKILL — Money Handling

## Quando usar

Sempre que tocar em valores monetários: criar/editar Transaction, agregar somas, mostrar valores na UI, parsear input do usuário, ou serializar para o cliente.

## Regras inegociáveis

1. **Sempre `BigInt` em centavos no domínio e no banco.** Nunca `Float`, `Decimal` ou `Number`.
2. **Conversão `cents ↔ reais` apenas na camada de apresentação** (no formatador, no input mask, no parser do form).
3. **`BigInt` não soma com `+ number`**. Tudo precisa ser BigInt na operação.
4. **`BigInt` não serializa nativo em JSON**. Configurar `toJSON` global.

## Por que não usar Float / Decimal

- `Float`: imprecisão binária (`0.1 + 0.2 !== 0.3`). Erros se acumulam em agregações.
- `Decimal` do Prisma: precisão correta mas overhead. Para o nosso domínio (centavos), `BigInt` é mais simples e rápido.
- `Number` (Int): precisão de 2^53, ok até 90 trilhões em centavos. Funciona, mas `BigInt` deixa explícito que é dinheiro e evita conversões implícitas perigosas.

## Padrões de implementação

### Schema Prisma

```prisma
model Transaction {
  amountCents BigInt @map("amount_cents")
}
```

### Zod schema

```ts
import { z } from "zod";

export const amountSchema = z.coerce.bigint(); // aceita string ou number e converte
```

### Server Action

```ts
// Recebe BigInt do form (após parse), persiste como BigInt
async function createTransaction(input: { amountCents: bigint; ... }) {
  return prisma.transaction.create({
    data: { amountCents: input.amountCents, ... }
  });
}
```

### Conversão centavos ↔ reais

```ts
// src/lib/money.ts

/**
 * Converte BigInt centavos para Number reais.
 * USE APENAS PARA EXIBIÇÃO. Não use para cálculos.
 */
export function centsToReais(cents: bigint): number {
  return Number(cents) / 100;
}

/**
 * Converte Number reais (do form) para BigInt centavos.
 * Multiplica por 100 e arredonda para evitar erros de float.
 */
export function reaisToCents(reais: number): bigint {
  return BigInt(Math.round(reais * 100));
}

/**
 * Parse de string mascarada "R$ 1.234,56" para BigInt centavos.
 */
export function parseBrlMaskToCents(masked: string): bigint {
  const normalized = masked
    .replace(/[^\d,-]/g, "")    // remove R$, espaços
    .replace(",", ".");          // BRL → ponto decimal
  const num = parseFloat(normalized);
  if (isNaN(num)) throw new Error(`Valor inválido: ${masked}`);
  return reaisToCents(num);
}

/**
 * Formata BigInt centavos para string BRL.
 */
export function formatCentsToBrl(cents: bigint, options?: { signed?: boolean }): string {
  const value = centsToReais(cents);
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
  if (options?.signed && cents > 0n) {
    return `+${formatted}`;
  }
  return formatted;
}
```

### Serialização JSON

```ts
// src/lib/json.ts (importado uma vez no entry point)

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString();
};
```

> **Atenção**: ao receber JSON no client, valores virão como **string**. Converter com `BigInt(value)` antes de usar em cálculos.

### Agregação no Prisma

```ts
// Funciona nativamente — Prisma retorna BigInt para campos BigInt.
const result = await prisma.transaction.aggregate({
  where: { accountId, monthId },
  _sum: { amountCents: true },
});
const total: bigint = result._sum.amountCents ?? 0n;
```

### Soma manual em loop

```ts
// ❌ Errado — `+` com mix de BigInt e Number quebra
let total = 0;
for (const t of transactions) {
  total += t.amountCents; // TypeError em runtime
}

// ✅ Certo — tudo BigInt
let total = 0n;
for (const t of transactions) {
  total = total + t.amountCents;
}
```

### Multiplicação por escalar (média)

```ts
// Média de N valores
const sum: bigint = ...;
const count: number = ...;

// Converter para Number só para a divisão (e só para exibição)
const averageCents: number = Number(sum) / count;
const averageReais: number = averageCents / 100;
```

> Cuidado: dividir BigInt por BigInt trunca (`10n / 3n === 3n`). Para média decimal, converter para Number.

### Sign convention

- Em sections com `countType=add` (entradas): valores positivos são entradas, negativos são estornos.
- Em sections com `countType=subtract` (saídas): valores positivos são despesas. **Usuário digita despesa como número positivo.**
- Em sections com `countType=neutral`: sinal vem do significado (+ = aporte, - = resgate, etc.).
- Em sections com `countType=ignore`: sinal preservado mas não usado.

## React Hook Form integration

```tsx
// Input com máscara monetária
import { Controller, useForm } from "react-hook-form";

<Controller
  name="amountCents"
  control={control}
  render={({ field }) => (
    <CurrencyInput
      value={field.value ? formatCentsToBrl(field.value) : ""}
      onChange={(masked) => {
        try {
          const cents = parseBrlMaskToCents(masked);
          field.onChange(cents);
        } catch {
          // Manter valor anterior se inválido
        }
      }}
    />
  )}
/>
```

## Testes

Todo módulo monetário precisa de teste:

```ts
describe("money", () => {
  it("converts cents to reais", () => {
    expect(centsToReais(12345n)).toBe(123.45);
  });

  it("parses BRL mask", () => {
    expect(parseBrlMaskToCents("R$ 1.234,56")).toBe(123456n);
    expect(parseBrlMaskToCents("-R$ 100,00")).toBe(-10000n);
  });

  it("handles edge cases", () => {
    expect(parseBrlMaskToCents("0")).toBe(0n);
    expect(formatCentsToBrl(0n)).toBe("R$ 0,00");
  });

  it("formats with sign", () => {
    expect(formatCentsToBrl(10000n, { signed: true })).toBe("+R$ 100,00");
    expect(formatCentsToBrl(-10000n, { signed: true })).toBe("-R$ 100,00");
  });
});
```

## Anti-patterns (não fazer)

❌ `amount: Float` no Prisma
❌ `amount * 100` no client com `Number` (imprecisão)
❌ Somar `transaction.amount` direto em map/reduce sem converter
❌ Salvar `amountCents` como string no banco
❌ Mostrar `Number(bigInt) / 100` direto na UI sem formatar
