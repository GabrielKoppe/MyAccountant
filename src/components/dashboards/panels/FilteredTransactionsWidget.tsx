"use client";

import { TopTransactionTable, type TxRow } from "./TopTransactionTable";

// Lista compacta de transações de um recorte filtrado (spec 36 §2.3).
// Reusa a tabela de transações; o cabeçalho/ícone vêm do WidgetContainer no cliente.
export function FilteredTransactionsWidget({ transactions }: { transactions: TxRow[] }) {
  return <TopTransactionTable transactions={transactions} />;
}
