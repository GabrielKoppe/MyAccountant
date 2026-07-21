import { describe, expect, it } from "vitest";

import {
  computeCurrentNetWorth,
  buildMonthlySeries,
  type NwAccount,
  type NwSnapshot,
} from "./net-worth-service";

// ─── computeCurrentNetWorth ───────────────────────────────────────────────

describe("computeCurrentNetWorth", () => {
  it("deve somar ativos e subtrair passivos (não-arquivados, com snapshot)", () => {
    const accounts: NwAccount[] = [
      { id: "a1", kind: "asset", archivedAt: null },
      { id: "a2", kind: "liability", archivedAt: null },
    ];
    const latestByAccount = new Map<string, bigint>([
      ["a1", 100000n],
      ["a2", 30000n],
    ]);

    const result = computeCurrentNetWorth(accounts, latestByAccount);

    expect(result.assetsCents).toBe(100000n);
    expect(result.liabilitiesCents).toBe(30000n);
    expect(result.netCents).toBe(70000n);
  });

  it("deve ignorar conta arquivada mesmo com snapshot presente", () => {
    const accounts: NwAccount[] = [
      { id: "a1", kind: "asset", archivedAt: null },
      { id: "a3", kind: "asset", archivedAt: new Date("2026-01-01") },
    ];
    const latestByAccount = new Map<string, bigint>([
      ["a1", 100000n],
      ["a3", 999999n],
    ]);

    const result = computeCurrentNetWorth(accounts, latestByAccount);

    expect(result.assetsCents).toBe(100000n);
    expect(result.netCents).toBe(100000n);
  });

  it("deve ignorar conta não-arquivada sem nenhum snapshot", () => {
    const accounts: NwAccount[] = [
      { id: "a1", kind: "asset", archivedAt: null },
      { id: "a4", kind: "asset", archivedAt: null }, // sem entrada no map
    ];
    const latestByAccount = new Map<string, bigint>([["a1", 100000n]]);

    const result = computeCurrentNetWorth(accounts, latestByAccount);

    expect(result.assetsCents).toBe(100000n);
    expect(result.netCents).toBe(100000n);
  });
});

// ─── buildMonthlySeries ───────────────────────────────────────────────────

describe("buildMonthlySeries", () => {
  const MONTH_START_DAY = 1;
  const months = [
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
    { year: 2026, month: 3 },
  ];

  const accounts: NwAccount[] = [
    { id: "nubank", kind: "asset", archivedAt: null },
    { id: "apto", kind: "asset", archivedAt: null },
    { id: "loan", kind: "liability", archivedAt: new Date("2026-03-05") },
  ];

  const snapshots: NwSnapshot[] = [
    { balanceAccountId: "nubank", balanceCents: 10000n, capturedOn: new Date("2026-01-15") },
    { balanceAccountId: "apto", balanceCents: 500000n, capturedOn: new Date("2026-02-10") },
    { balanceAccountId: "loan", balanceCents: 20000n, capturedOn: new Date("2026-01-05") },
  ];

  it("deve fazer carry-forward do último saldo conhecido mês a mês", () => {
    const series = buildMonthlySeries(accounts, snapshots, months, MONTH_START_DAY);

    // Jan: nubank 10000 (asset) - loan 20000 (liability, ainda não arquivado) ; apto sem snapshot
    expect(series[0]).toEqual({
      year: 2026,
      month: 1,
      assetsCents: 10000n,
      liabilitiesCents: 20000n,
      netCents: 10000n - 20000n,
    });
    // Fev: nubank carrega 10000 + apto 500000 (1º snapshot) - loan 20000
    expect(series[1]).toEqual({
      year: 2026,
      month: 2,
      assetsCents: 10000n + 500000n,
      liabilitiesCents: 20000n,
      netCents: 10000n + 500000n - 20000n,
    });
    // Mar: nubank 10000 + apto 500000 (loan arquivado em 05/03, some do cálculo)
    expect(series[2]).toEqual({
      year: 2026,
      month: 3,
      assetsCents: 10000n + 500000n,
      liabilitiesCents: 0n,
      netCents: 10000n + 500000n,
    });
  });

  it("conta nova deve contribuir com 0 antes do primeiro snapshot", () => {
    const series = buildMonthlySeries(accounts, snapshots, months, MONTH_START_DAY);

    // no mês de Jan, "apto" ainda não tem snapshot (1º é em fev) — não deve contribuir
    const jan = series[0];
    const withoutApto = 10000n - 20000n;
    expect(jan.netCents).toBe(withoutApto);
  });

  it("conta arquivada preserva o passado e para de contribuir a partir de archivedAt", () => {
    const series = buildMonthlySeries(accounts, snapshots, months, MONTH_START_DAY);

    // Jan e Fev: loan (archivedAt 2026-03-05) ainda contribui (-20000)
    expect(series[0].netCents).toBe(10000n - 20000n);
    expect(series[1].netCents).toBe(10000n + 500000n - 20000n);
    // Mar: archivedAt (05/03) <= fim de março → não contribui mais
    expect(series[2].netCents).toBe(10000n + 500000n);
  });
});
