// Habilitar serialização de BigInt em JSON.
// Necessário porque Prisma retorna BigInt para campos monetários (amountCents)
// e JSON.stringify falha por padrão com BigInt.
// Importar este módulo cedo no ciclo de vida (ex: em server-side code) garante
// que todos os contextos que serializem BigInt funcionem corretamente.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
