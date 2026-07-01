import { describe, expect, it } from "vitest";
import { prismaMock } from "@/../tests/mocks/prisma";
import {
  buildMonthCsv,
  buildYearCsv,
  getMonthDataForPdf,
  type ExportTransaction,
} from "./export-service";

// ─── Fixture ──────────────────────────────────────────────────────────────────

function buildExportTx(overrides: Partial<ExportTransaction> = {}): ExportTransaction {
  return {
    occurredOn: new Date("2024-03-15T00:00:00.000Z"),
    description: "Supermercado",
    amountCents: 15000n,
    sectionName: "Despesas",
    sectionCountType: "subtract",
    tableName: "Alimentação",
    categoryName: "Mercado",
    subcategoryName: null,
    institutionName: null,
    responsibleName: "Gabriel",
    isPending: false,
    isFavorite: false,
    notes: null,
    ...overrides,
  };
}

// Linhas brutas que o Prisma retorna (com relações aninhadas)
function buildPrismaRow(overrides?: {
  sectionName?: string;
  sectionCountType?: string;
  categoryName?: string | null;
  amountCents?: bigint;
}) {
  return {
    occurredOn: new Date("2024-03-15T00:00:00.000Z"),
    amountCents: overrides?.amountCents ?? 15000n,
    description: "Supermercado",
    notes: null,
    isPending: false,
    isFavorite: false,
    section: {
      name: overrides?.sectionName ?? "Despesas",
      countType: overrides?.sectionCountType ?? "subtract",
    },
    table: { name: "Alimentação" },
    category:
      overrides?.categoryName !== undefined
        ? overrides.categoryName
          ? { name: overrides.categoryName }
          : null
        : { name: "Mercado" },
    subcategory: null,
    institution: null,
    responsibleUser: null,
    month: { month: 3 },
  };
}

// ─── buildMonthCsv ────────────────────────────────────────────────────────────

describe("buildMonthCsv", () => {
  it("começa com BOM UTF-8", () => {
    const csv = buildMonthCsv([]);
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("inclui linha de cabeçalho com todas as colunas", () => {
    const csv = buildMonthCsv([]);
    const header = csv.split("\r\n")[0]!.replace("﻿", "");
    expect(header).toBe(
      "Data,Descrição,Valor,Seção,Tabela,Categoria,Subcategoria,Instituição,Responsável,Pendente,Favorita,Notas",
    );
  });

  it("aplica sinal negativo para seções subtract", () => {
    const csv = buildMonthCsv([
      buildExportTx({ amountCents: 15000n, sectionCountType: "subtract" }),
    ]);
    expect(csv).toContain("-150.00");
  });

  it("mantém valor positivo para seções add", () => {
    const csv = buildMonthCsv([buildExportTx({ amountCents: 200000n, sectionCountType: "add" })]);
    expect(csv).toContain("2000.00");
    expect(csv).not.toContain("-2000.00");
  });

  it("exibe Sim / Não para campos booleanos", () => {
    const csv = buildMonthCsv([buildExportTx({ isPending: true, isFavorite: false })]);
    const dataRow = csv.split("\r\n")[1]!;
    const cells = dataRow.split(",");
    expect(cells[9]).toBe("Sim"); // Pendente
    expect(cells[10]).toBe("Não"); // Favorita
  });

  it("formata data como DD/MM/YYYY", () => {
    const csv = buildMonthCsv([
      buildExportTx({ occurredOn: new Date("2024-07-04T00:00:00.000Z") }),
    ]);
    expect(csv).toContain("04/07/2024");
  });

  it("converte campos null em strings vazias", () => {
    const csv = buildMonthCsv([buildExportTx({ categoryName: null, notes: null })]);
    const dataRow = csv.split("\r\n")[1]!;
    const cells = dataRow.split(",");
    expect(cells[5]).toBe(""); // Categoria
    expect(cells[11]).toBe(""); // Notas
  });

  it("usa CRLF como separador de linhas", () => {
    const csv = buildMonthCsv([buildExportTx()]);
    expect(csv).toContain("\r\n");
  });

  it("gera uma linha de dados por transação", () => {
    const csv = buildMonthCsv([buildExportTx(), buildExportTx()]);
    const lines = csv.split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(3); // cabeçalho + 2 dados
  });
});

// ─── buildYearCsv ─────────────────────────────────────────────────────────────

describe("buildYearCsv", () => {
  it("tem 'Mês' como primeira coluna do cabeçalho", () => {
    const csv = buildYearCsv([]);
    const header = csv.split("\r\n")[0]!.replace("﻿", "");
    expect(header.startsWith("Mês,")).toBe(true);
  });

  it("inclui o número do mês na primeira célula de cada linha de dados", () => {
    const tx = { ...buildExportTx(), monthNum: 7 };
    const csv = buildYearCsv([tx]);
    const dataRow = csv.split("\r\n")[1]!;
    expect(dataRow.startsWith("7,")).toBe(true);
  });

  it("mantém as demais colunas iguais ao CSV mensal", () => {
    const tx = { ...buildExportTx({ sectionCountType: "subtract" }), monthNum: 3 };
    const csv = buildYearCsv([tx]);
    const header = csv.split("\r\n")[0]!.replace("﻿", "");
    expect(header).toContain("Data,Descrição,Valor");
  });
});

// ─── getMonthDataForPdf ───────────────────────────────────────────────────────

describe("getMonthDataForPdf", () => {
  const accountId = "acc-test-1";
  const monthId = "month-1";

  it("retorna null quando o mês não existe", async () => {
    prismaMock.month.findFirst.mockResolvedValue(null);
    prismaMock.account.findUnique.mockResolvedValue({ name: "Conta" } as any);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const result = await getMonthDataForPdf(accountId, monthId);
    expect(result).toBeNull();
  });

  it("retorna null quando a account não existe", async () => {
    prismaMock.month.findFirst.mockResolvedValue({ year: 2024, month: 3 } as any);
    prismaMock.account.findUnique.mockResolvedValue(null);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const result = await getMonthDataForPdf(accountId, monthId);
    expect(result).toBeNull();
  });

  it("calcula monthTotal: seções add somam, subtract subtraem", async () => {
    prismaMock.month.findFirst.mockResolvedValue({ year: 2024, month: 3 } as any);
    prismaMock.account.findUnique.mockResolvedValue({ name: "Conta" } as any);
    prismaMock.transaction.findMany.mockResolvedValue([
      buildPrismaRow({ sectionName: "Receitas", sectionCountType: "add", amountCents: 500000n }),
      buildPrismaRow({
        sectionName: "Despesas",
        sectionCountType: "subtract",
        amountCents: 150000n,
      }),
    ] as any);

    const result = await getMonthDataForPdf(accountId, monthId);
    expect(result!.monthTotal).toBe(350000n); // 500000 - 150000
  });

  it("seções neutral não afetam o monthTotal", async () => {
    prismaMock.month.findFirst.mockResolvedValue({ year: 2024, month: 3 } as any);
    prismaMock.account.findUnique.mockResolvedValue({ name: "Conta" } as any);
    prismaMock.transaction.findMany.mockResolvedValue([
      buildPrismaRow({ sectionName: "Receitas", sectionCountType: "add", amountCents: 100000n }),
      buildPrismaRow({ sectionName: "Outros", sectionCountType: "neutral", amountCents: 50000n }),
    ] as any);

    const result = await getMonthDataForPdf(accountId, monthId);
    expect(result!.monthTotal).toBe(100000n);
  });

  it("retorna top 8 categorias ordenadas por valor absoluto decrescente", async () => {
    prismaMock.month.findFirst.mockResolvedValue({ year: 2024, month: 3 } as any);
    prismaMock.account.findUnique.mockResolvedValue({ name: "Conta" } as any);

    const rows = ["A", "B", "C", "D", "E", "F", "G", "H", "I"].map((cat, i) =>
      buildPrismaRow({ categoryName: cat, amountCents: BigInt((9 - i) * 100) }),
    );
    prismaMock.transaction.findMany.mockResolvedValue(rows as any);

    const result = await getMonthDataForPdf(accountId, monthId);
    expect(result!.topCategories).toHaveLength(8);
    expect(result!.topCategories[0]!.name).toBe("A");
    expect(result!.topCategories[7]!.name).toBe("H");
  });

  it("ignora transações sem categoria no ranking", async () => {
    prismaMock.month.findFirst.mockResolvedValue({ year: 2024, month: 3 } as any);
    prismaMock.account.findUnique.mockResolvedValue({ name: "Conta" } as any);
    prismaMock.transaction.findMany.mockResolvedValue([
      buildPrismaRow({ categoryName: null }),
    ] as any);

    const result = await getMonthDataForPdf(accountId, monthId);
    expect(result!.topCategories).toHaveLength(0);
  });

  it("preenche os metadados corretamente", async () => {
    prismaMock.month.findFirst.mockResolvedValue({ year: 2024, month: 3 } as any);
    prismaMock.account.findUnique.mockResolvedValue({ name: "Minha Conta" } as any);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const result = await getMonthDataForPdf(accountId, monthId);
    expect(result!.accountName).toBe("Minha Conta");
    expect(result!.year).toBe(2024);
    expect(result!.month).toBe(3);
    expect(result!.monthLabel).toBe("Março 2024");
  });

  it("filtra transações pelo accountId correto", async () => {
    prismaMock.month.findFirst.mockResolvedValue({ year: 2024, month: 3 } as any);
    prismaMock.account.findUnique.mockResolvedValue({ name: "Conta" } as any);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    await getMonthDataForPdf(accountId, monthId);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId }),
      }),
    );
  });
});
