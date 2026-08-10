import type { SectionCountType } from "@prisma/client";

/**
 * Total de um mês a partir dos totais por seção, respeitando o `countType` de
 * cada seção (`add` soma, `subtract` subtrai, `neutral` soma preservando o
 * sinal, `ignore` não conta).
 *
 * Função pura, sem Prisma: vive em `src/lib` (e não mais em
 * `server/services/month-service.ts`) porque o preview ao vivo da Projeção em
 * Configurações (spec 71 §7.2) recalcula a projeção no client e precisa
 * exatamente da mesma matemática usada no servidor. O `import type` de
 * `@prisma/client` é apagado na compilação — nada do runtime do Prisma entra
 * no bundle do client.
 *
 * Ver skill money-handling: BigInt em centavos, nunca Float.
 */
export function calculateMonthTotal(
  sections: { id: string; countType: SectionCountType }[],
  sectionTotals: Record<string, bigint>,
): bigint {
  let total = 0n;
  for (const section of sections) {
    const sectionTotal = sectionTotals[section.id] ?? 0n;
    if (section.countType === "add") total += sectionTotal;
    else if (section.countType === "subtract") total -= sectionTotal;
    else if (section.countType === "neutral") total += sectionTotal;
    // "ignore" → não soma
  }
  return total;
}
