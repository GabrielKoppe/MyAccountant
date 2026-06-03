import "@/lib/json";

export function centsToReais(cents: bigint): number {
  return Number(cents) / 100;
}

export function reaisToCents(reais: number): bigint {
  return BigInt(Math.round(reais * 100));
}

export function formatCentsToBrl(cents: bigint, options?: { sign?: boolean }): string {
  const value = Number(cents) / 100;
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.abs(value));

  if (options?.sign && cents < 0n) {
    return `-${formatted}`;
  }

  return formatted;
}

export function parseBrlMaskToCents(value: string): bigint {
  // Remove "R$", spaces, separadores de milhar (.), mantém vírgula decimal
  const cleaned = value
    .replace(/R\$\s?/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const isNegative = cleaned.startsWith("-");
  const absolute = cleaned.replace("-", "").trim();
  const reais = parseFloat(absolute);

  if (isNaN(reais)) return 0n;

  const cents = BigInt(Math.round(reais * 100));
  return isNegative ? -cents : cents;
}
