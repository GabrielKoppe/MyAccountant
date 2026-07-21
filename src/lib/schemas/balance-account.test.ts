import { describe, expect, it } from "vitest";

import {
  createBalanceAccountSchema,
  updateBalanceAccountSchema,
  archiveBalanceAccountSchema,
  deleteBalanceAccountSchema,
  upsertBalanceSnapshotSchema,
  upsertBalanceSnapshotsSchema,
} from "./balance-account";

const balanceAccountId = "cljk3d4e500001abcdefgh1234";
const institutionId = "cljk3d4e500002abcdefgh5678";

describe("createBalanceAccountSchema", () => {
  it("aceita payload válido com kind", () => {
    const result = createBalanceAccountSchema.safeParse({
      kind: "asset",
      name: "Conta Corrente",
      institutionId,
    });

    expect(result.success).toBe(true);
  });

  it("rejeita quando kind está ausente", () => {
    const result = createBalanceAccountSchema.safeParse({
      name: "Conta Corrente",
      institutionId,
    });

    expect(result.success).toBe(false);
  });
});

describe("updateBalanceAccountSchema", () => {
  it("aceita payload válido sem kind (imutável)", () => {
    const result = updateBalanceAccountSchema.safeParse({
      balanceAccountId,
      name: "Conta Poupança",
      institutionId: null,
    });

    expect(result.success).toBe(true);
  });
});

describe("archiveBalanceAccountSchema", () => {
  it("aceita archived true/false", () => {
    expect(archiveBalanceAccountSchema.safeParse({ balanceAccountId, archived: true }).success).toBe(true);
    expect(archiveBalanceAccountSchema.safeParse({ balanceAccountId, archived: false }).success).toBe(true);
  });
});

describe("deleteBalanceAccountSchema", () => {
  it("aceita balanceAccountId válido", () => {
    expect(deleteBalanceAccountSchema.safeParse({ balanceAccountId }).success).toBe(true);
  });
});

describe("upsertBalanceSnapshotSchema", () => {
  it("rejeita capturedOn futuro", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);

    const result = upsertBalanceSnapshotSchema.safeParse({
      balanceAccountId,
      balanceCents: 10000n,
      capturedOn: future,
    });

    expect(result.success).toBe(false);
  });

  it("aceita balanceCents negativo", () => {
    const result = upsertBalanceSnapshotSchema.safeParse({
      balanceAccountId,
      balanceCents: -50000n,
      capturedOn: new Date("2026-01-01"),
    });

    expect(result.success).toBe(true);
  });
});

describe("upsertBalanceSnapshotsSchema", () => {
  it("rejeita entries vazio", () => {
    const result = upsertBalanceSnapshotsSchema.safeParse({
      capturedOn: new Date("2026-01-01"),
      entries: [],
    });

    expect(result.success).toBe(false);
  });

  it("aceita lote válido com balanceCents negativo", () => {
    const result = upsertBalanceSnapshotsSchema.safeParse({
      capturedOn: new Date("2026-01-01"),
      entries: [
        { balanceAccountId, balanceCents: -1234n },
        { balanceAccountId: institutionId, balanceCents: 9999n },
      ],
    });

    expect(result.success).toBe(true);
  });
});
