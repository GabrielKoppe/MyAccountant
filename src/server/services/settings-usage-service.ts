// Spec 67 §2.4 / §4 (SET-07) / §9 P5 — contagem REAL de transações por objeto de configuração.
//
// POR QUE SOB DEMANDA: contar transações de um objeto varre a tabela que mais
// cresce na conta, e o custo cresce indefinidamente com o histórico (SET-07).
// Por isso a coluna "Uso" saiu das listas — lá vale o `lastUsedAt`, gravado na
// escrita e lido de graça (`settings-usage-touch.ts`). A contagem real existe
// em exatamente três lugares, todos disparados por um gesto explícito do
// usuário: "Ver uso" no menu da linha (M3), a aba "Onde é usado" do arquétipo C
// e o diálogo de exclusão com realocação (M2).
//
// POR QUE CACHE: o mesmo objeto costuma ser consultado várias vezes seguidas
// (abrir o modal, fechar, reabrir, tentar excluir). O resultado vai para
// `UsageCount` e vale 24 h; "Recontar" na UI passa `force` e fura o cache.
//
// Contagem ZERO é cacheada igual às demais — é justamente o objeto sem uso que
// mais se consulta antes de excluir, e recontá-lo a cada abertura seria pagar a
// varredura completa toda vez.

import type { Prisma } from "@prisma/client";

import type { CountableUsageEntity } from "@/lib/schemas/settings-usage";
import { NotFoundError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "settings-usage-service" });

/**
 * Janela de validade de uma linha de `UsageCount` (Spec 67 §7.4 — TTL 24 h).
 * Exportada para o teste não repetir o número mágico.
 */
export const USAGE_COUNT_TTL_MS = 24 * 60 * 60 * 1000;

type CountableEntityDef = {
  /** Filtro que caracteriza "esta transação usa o objeto". */
  transactionWhere: (entityId: string) => Prisma.TransactionWhereInput;
  /** Quantas linhas do objeto existem NESTA conta — 0 significa "não é desta conta". */
  countInAccount: (accountId: string, entityId: string) => Promise<number>;
};

/**
 * Mapa entidade → filtro, para a regra de "o que conta como uso" morar num
 * lugar só. Sem isto, cada chamador (menu da linha, aba "Onde é usado", modal
 * de exclusão) reimplementaria a mesma cadeia de `if` e elas divergiriam.
 */
const COUNTABLE: Record<CountableUsageEntity, CountableEntityDef> = {
  section: {
    transactionWhere: (id) => ({ sectionId: id }),
    countInAccount: (accountId, id) => prisma.section.count({ where: { id, accountId } }),
  },
  category: {
    transactionWhere: (id) => ({ categoryId: id }),
    countInAccount: (accountId, id) => prisma.category.count({ where: { id, accountId } }),
  },
  subcategory: {
    transactionWhere: (id) => ({ subcategoryId: id }),
    countInAccount: (accountId, id) => prisma.subcategory.count({ where: { id, accountId } }),
  },
  institution: {
    transactionWhere: (id) => ({ institutionId: id }),
    countInAccount: (accountId, id) => prisma.institution.count({ where: { id, accountId } }),
  },
  responsibleParty: {
    transactionWhere: (id) => ({ responsiblePartyId: id }),
    countInAccount: (accountId, id) => prisma.responsibleParty.count({ where: { id, accountId } }),
  },
  tableType: {
    // `Transaction` não referencia `TableType`: o vínculo é indireto, pela
    // `FinanceTable` em que a transação vive.
    transactionWhere: (id) => ({ table: { tableTypeId: id } }),
    countInAccount: (accountId, id) => prisma.tableType.count({ where: { id, accountId } }),
  },
};

/**
 * Um ponto do histograma mensal do modal "Ver uso" (Spec 68 §2.6 / M3).
 * `month` é `"AAAA-MM"` — ordenável como string e independente de timezone.
 */
export type UsageMonthPoint = {
  month: string;
  transactions: number;
};

export type UsageCountResult = {
  /** Transações que referenciam o objeto. */
  transactions: number;
  /** Meses DISTINTOS com pelo menos uma dessas transações. */
  months: number;
  /**
   * Série por mês, em ordem cronológica (Spec 68 §2.6). Só os meses COM uso —
   * o gráfico preenche as lacunas, e gravar zeros inflária o cache à toa.
   *
   * Vem da MESMA varredura que produz `transactions`/`months`: contar duas vezes
   * a mesma coisa é o que o TTL de 24 h existe para evitar.
   */
  byMonth: UsageMonthPoint[];
  /** Quando a contagem foi feita — é este timestamp que a UI exibe. */
  countedAt: Date;
  /** `true` = veio de `UsageCount` sem varrer `Transaction`. */
  fromCache: boolean;
};

/**
 * O `byMonth` cacheado é `Json` — o Prisma o devolve como `unknown`, e uma linha
 * gravada antes da Spec 68 vem `null`. Normalizar aqui evita que a UI precise
 * defender-se de um cache de formato antigo.
 */
function parseByMonth(raw: unknown): UsageMonthPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is UsageMonthPoint =>
      typeof p === "object" &&
      p !== null &&
      typeof (p as UsageMonthPoint).month === "string" &&
      typeof (p as UsageMonthPoint).transactions === "number",
  );
}

export type CountUsageParams = {
  accountId: string;
  entity: CountableUsageEntity;
  entityId: string;
  /** "Recontar": ignora um cache ainda válido. */
  force?: boolean;
  /** Instante de referência do TTL. Injetável para teste; em produção é `new Date()`. */
  now?: Date;
};

/**
 * Traduz os grupos `(monthId, _count)` em pontos `"AAAA-MM"` ordenados.
 *
 * Precisa de um segundo `SELECT` porque `Transaction` guarda `monthId`, e ano/mês
 * moram em `Month`. É uma leitura minúscula (uma linha por mês com uso) e indexada
 * por `accountId` — o `accountId` no where não é opcional: sem ele um `monthId`
 * intruso traria o rótulo de um mês de outra conta.
 */
async function buildMonthSeries(
  accountId: string,
  groups: Array<{ monthId: string; _count: { _all: number } }>,
): Promise<UsageMonthPoint[]> {
  if (groups.length === 0) return [];

  const months = await prisma.month.findMany({
    where: { accountId, id: { in: groups.map((g) => g.monthId) } },
    select: { id: true, year: true, month: true },
  });

  const labelById = new Map(
    months.map((mo) => [mo.id, `${mo.year}-${String(mo.month).padStart(2, "0")}`]),
  );

  return groups
    .flatMap((g) => {
      const month = labelById.get(g.monthId);
      // Mês que não é desta conta (ou sumiu entre as duas queries) não vira ponto:
      // um rótulo vazio no eixo do histograma seria pior que a lacuna.
      return month ? [{ month, transactions: g._count._all }] : [];
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Conta o uso de um objeto de configuração, servindo do cache quando ele ainda
 * vale.
 *
 * Multi-tenancy: `accountId` entra em TODO `where` — no do cache (pela chave
 * composta), no de posse do objeto e no de `Transaction`.
 */
export async function countUsage({
  accountId,
  entity,
  entityId,
  force = false,
  now = new Date(),
}: CountUsageParams): Promise<UsageCountResult> {
  const key = { accountId, entity, entityId };

  if (!force) {
    const cached = await prisma.usageCount.findUnique({
      where: { accountId_entity_entityId: key },
      select: { transactions: true, months: true, byMonth: true, countedAt: true },
    });

    // Cache dentro da janela responde SEM tocar em `Transaction` — é esse o
    // ponto inteiro do TTL.
    if (cached && now.getTime() - cached.countedAt.getTime() < USAGE_COUNT_TTL_MS) {
      return {
        transactions: cached.transactions,
        months: cached.months,
        byMonth: parseByMonth(cached.byMonth),
        countedAt: cached.countedAt,
        fromCache: true,
      };
    }
  }

  const def = COUNTABLE[entity];

  // Posse antes da varredura. Sem esta checagem o `count` devolveria 0 (o where
  // filtra por accountId de qualquer jeito) e ainda gravaria uma linha de cache
  // para um id que não é desta conta — lixo escrito a pedido de terceiro.
  const owned = await def.countInAccount(accountId, entityId);
  if (owned === 0) {
    log.warn({ accountId, entity, entityId }, "countUsage: objeto não pertence à conta");
    throw new NotFoundError("Objeto de configuração");
  }

  const where: Prisma.TransactionWhereInput = { accountId, ...def.transactionWhere(entityId) };

  const [transactions, monthGroups] = await Promise.all([
    prisma.transaction.count({ where }),
    // `groupBy` por `monthId` dá os meses distintos sem trazer as linhas. O
    // `_count` no mesmo groupBy também dá o histograma da Spec 68 §2.6 de graça
    // — é a mesma varredura, não uma segunda.
    prisma.transaction.groupBy({ by: ["monthId"], where, _count: { _all: true } }),
  ]);

  const months = monthGroups.length;
  const byMonth = await buildMonthSeries(accountId, monthGroups);

  await prisma.usageCount.upsert({
    where: { accountId_entity_entityId: key },
    create: { ...key, transactions, months, byMonth, countedAt: now },
    update: { transactions, months, byMonth, countedAt: now },
  });

  log.debug({ accountId, entity, entityId, transactions, months }, "Uso contado");

  return { transactions, months, byMonth, countedAt: now, fromCache: false };
}
