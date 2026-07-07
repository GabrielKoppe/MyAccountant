import { cache } from "react";

import {
  serializeTransactionAlias,
  type SerializedTransactionAlias,
} from "@/lib/serializers/transaction-alias";
import { prisma } from "@/server/prisma";

// Exportado para reuso em csv-import-service.ts, que recarrega uma lista
// fresca própria (DD-13) em vez de reusar a query cacheada abaixo.
export const ALIAS_INCLUDE = {
  category: { select: { name: true } },
  subcategory: { select: { name: true } },
  institution: { select: { name: true } },
  responsibleParty: { select: { name: true } },
  tags: { select: { tag: { select: { id: true, name: true } } } },
} as const;

/**
 * Apelidos ativos de uma Account, memoizado por render (RSC — DD-10).
 * Alimenta a page de Settings e o loader que repassa `aliases` por prop à
 * linha manual (TransactionTable) e ao ImportWizard (via SectionView).
 *
 * O `executeImport` (server, Fase 5) recarrega uma lista fresca à parte —
 * este cache é escopado ao request de renderização, não serve o import
 * autoritativo (DD-13).
 */
export const getActiveTransactionAliases = cache(
  async (accountId: string): Promise<SerializedTransactionAlias[]> => {
    const aliases = await prisma.transactionAlias.findMany({
      where: { accountId, archivedAt: null },
      orderBy: { trigger: "asc" },
      include: ALIAS_INCLUDE,
    });
    return aliases.map(serializeTransactionAlias);
  },
);
