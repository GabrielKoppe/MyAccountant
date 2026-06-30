/**
 * Calcula o valor de cada parcela sem acúmulo de arredondamento.
 * - Sem entrada: all = totalCents / count; última recebe o restante.
 * - Com entrada: parcela 1 = downPaymentCents; parcelas 2–N distribuídas do restante.
 * Retorna array de BigInt com comprimento = installmentCount.
 */
export function calcInstallmentAmounts(
  totalCents: bigint,
  installmentCount: number,
  downPaymentCents?: bigint,
): bigint[] {
  const n = BigInt(installmentCount);

  if (downPaymentCents != null) {
    const remaining = totalCents - downPaymentCents;
    const rest = installmentCount - 1;
    const restN = BigInt(rest);
    const perRest = remaining / restN;
    const remainder = remaining % restN;

    const amounts: bigint[] = [downPaymentCents];
    for (let i = 1; i < installmentCount; i++) {
      const isLast = i === installmentCount - 1;
      amounts.push(isLast ? perRest + remainder : perRest);
    }
    return amounts;
  }

  const perInstallment = totalCents / n;
  const remainder = totalCents % n;
  const amounts: bigint[] = [];
  for (let i = 0; i < installmentCount; i++) {
    const isLast = i === installmentCount - 1;
    amounts.push(isLast ? perInstallment + remainder : perInstallment);
  }
  return amounts;
}
