/**
 * Serializador usado pelas respostas das tools MCP (Task 2.2 consome isto).
 *
 * Dinheiro é sempre `BigInt` em centavos no domínio (skill money-handling) — `JSON.stringify`
 * nativo não sabe serializar `BigInt` (lança `TypeError`), então convertemos para string para
 * não perder precisão. `Date` já é serializado como ISO string pelo `JSON.stringify` nativo
 * (via `Date.prototype.toJSON`), então nenhum tratamento extra é necessário para ela.
 */
export function serializeForMcp(data: unknown): string {
  return JSON.stringify(data, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}
