import "@/lib/json";
import type { SectionCountType } from "@prisma/client";

/**
 * Convenção de exibição de sinal por tipo de seção. Apenas `subtract` inverte o
 * sinal armazenado na exibição (ver `applyFinancialSign`, `TransactionRow`,
 * `FinanceTableCard`). `add`, `neutral` e `ignore` exibem o sinal cru.
 */
export function displaySignInverts(countType: SectionCountType): boolean {
  return countType === "subtract";
}

/** True quando origem e destino exibem o sinal de forma oposta. */
export function moveInvertsConvention(
  source: SectionCountType,
  destination: SectionCountType,
): boolean {
  return displaySignInverts(source) !== displaySignInverts(destination);
}

/**
 * Normaliza `amountCents` ao mover uma transação entre seções. Quando `invert`
 * está ativo e as convenções de exibição diferem, nega o valor (em BigInt
 * centavos) para preservar o significado exibido ao usuário.
 */
export function normalizeAmountOnMove(
  amountCents: bigint,
  source: SectionCountType,
  destination: SectionCountType,
  invert: boolean,
): bigint {
  return invert && moveInvertsConvention(source, destination) ? -amountCents : amountCents;
}

export function centsToReais(cents: bigint): number {
  return Number(cents) / 100;
}

export function reaisToCents(reais: number): bigint {
  return BigInt(Math.round(reais * 100));
}

// Instância cacheada — criar Intl.NumberFormat é custoso; reutilizar é ~10x mais rápido
const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCentsToBrl(cents: bigint, options?: { sign?: boolean }): string {
  const value = Number(cents) / 100;
  const formatted = BRL_FORMATTER.format(Math.abs(value));

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

/**
 * Converte BigInt centavos para string formatada para uso em inputs numéricos
 * (sem símbolo de moeda, usando vírgula como separador decimal).
 * Ex: 1234n → "12,34"
 */
export function centsToBrlInput(cents: bigint): string {
  const reais = Number(cents) / 100;
  return reais.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
