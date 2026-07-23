import { describe, expect, it } from "vitest";

import {
  createGoalSchema,
  updateGoalSchema,
  deleteGoalSchema,
  archiveGoalSchema,
  addContributionSchema,
  deleteContributionSchema,
} from "./goal";

const goalId = "cljk3d4e500001abcdefgh1234";
const sectionId = "cljk3d4e500002abcdefgh5678";
const categoryId = "cljk3d4e500003abcdefgh9012";
const transactionId = "cljk3d4e500004abcdefgh3456";
const partyId = "cljk3d4e500005abcdefgh7890";
const contributionId = "cljk3d4e500006abcdefgh1122";

describe("createGoalSchema", () => {
  it("aceita payload válido mínimo (só nome e alvo)", () => {
    const result = createGoalSchema.safeParse({
      name: "Viagem ao Japão",
      targetCents: 2000000n,
    });

    expect(result.success).toBe(true);
  });

  it("aceita payload completo com deadline futura e dimensão", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);

    const result = createGoalSchema.safeParse({
      name: "Reserva de emergência",
      targetCents: 1000000n,
      deadline: future,
      sectionId,
      categoryId,
    });

    expect(result.success).toBe(true);
  });

  it("rejeita targetCents zero", () => {
    const result = createGoalSchema.safeParse({ name: "Meta", targetCents: 0n });
    expect(result.success).toBe(false);
  });

  it("rejeita targetCents negativo", () => {
    const result = createGoalSchema.safeParse({ name: "Meta", targetCents: -100n });
    expect(result.success).toBe(false);
  });

  it("aceita targetCents como BigInt nativo", () => {
    const result = createGoalSchema.safeParse({ name: "Meta", targetCents: 12345n });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.targetCents).toBe("bigint");
    }
  });

  it("rejeita nome vazio", () => {
    const result = createGoalSchema.safeParse({ name: "", targetCents: 1000n });
    expect(result.success).toBe(false);
  });

  it("rejeita nome ausente", () => {
    const result = createGoalSchema.safeParse({ targetCents: 1000n });
    expect(result.success).toBe(false);
  });

  it("rejeita deadline no passado", () => {
    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);

    const result = createGoalSchema.safeParse({
      name: "Meta",
      targetCents: 1000n,
      deadline: past,
    });

    expect(result.success).toBe(false);
  });

  it("aceita deadline igual a hoje", () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const result = createGoalSchema.safeParse({
      name: "Meta",
      targetCents: 1000n,
      deadline: today,
    });

    expect(result.success).toBe(true);
  });

  it("aceita ausência de deadline (opcional)", () => {
    const result = createGoalSchema.safeParse({ name: "Meta", targetCents: 1000n });
    expect(result.success).toBe(true);
  });

  // B1 (fix wave, blocker): deadline > 50 anos no futuro rejeitado — teto defensivo
  // contra monthsToComplete/glide-path explodindo (goal-service.ts:computePace).
  it("rejeita deadline mais de 50 anos no futuro", () => {
    const tooFar = new Date();
    tooFar.setUTCFullYear(tooFar.getUTCFullYear() + 51);

    const result = createGoalSchema.safeParse({
      name: "Meta",
      targetCents: 1000n,
      deadline: tooFar,
    });

    expect(result.success).toBe(false);
  });

  it("aceita deadline bem próxima do limite de 50 anos", () => {
    const almostTooFar = new Date();
    almostTooFar.setUTCHours(0, 0, 0, 0);
    almostTooFar.setUTCFullYear(almostTooFar.getUTCFullYear() + 49);

    const result = createGoalSchema.safeParse({
      name: "Meta",
      targetCents: 1000n,
      deadline: almostTooFar,
    });

    expect(result.success).toBe(true);
  });

  it("rejeita sectionId com formato de cuid inválido", () => {
    const result = createGoalSchema.safeParse({
      name: "Meta",
      targetCents: 1000n,
      sectionId: "not-a-cuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejeita categoryId com formato de cuid inválido", () => {
    const result = createGoalSchema.safeParse({
      name: "Meta",
      targetCents: 1000n,
      categoryId: "not-a-cuid",
    });

    expect(result.success).toBe(false);
  });

  it("aceita sectionId/categoryId nulos", () => {
    const result = createGoalSchema.safeParse({
      name: "Meta",
      targetCents: 1000n,
      sectionId: null,
      categoryId: null,
    });

    expect(result.success).toBe(true);
  });
});

describe("updateGoalSchema", () => {
  it("aceita payload válido com goalId", () => {
    const result = updateGoalSchema.safeParse({
      goalId,
      name: "Viagem ao Japão (atualizada)",
      targetCents: 2500000n,
    });

    expect(result.success).toBe(true);
  });

  it("rejeita quando goalId está ausente", () => {
    const result = updateGoalSchema.safeParse({
      name: "Meta",
      targetCents: 1000n,
    });

    expect(result.success).toBe(false);
  });

  it("rejeita goalId com formato inválido", () => {
    const result = updateGoalSchema.safeParse({
      goalId: "abc",
      name: "Meta",
      targetCents: 1000n,
    });

    expect(result.success).toBe(false);
  });

  it("rejeita targetCents zero também na edição", () => {
    const result = updateGoalSchema.safeParse({
      goalId,
      name: "Meta",
      targetCents: 0n,
    });

    expect(result.success).toBe(false);
  });
});

describe("deleteGoalSchema", () => {
  it("aceita goalId válido", () => {
    expect(deleteGoalSchema.safeParse({ goalId }).success).toBe(true);
  });

  it("rejeita goalId inválido", () => {
    expect(deleteGoalSchema.safeParse({ goalId: "abc" }).success).toBe(false);
  });

  it("rejeita payload vazio", () => {
    expect(deleteGoalSchema.safeParse({}).success).toBe(false);
  });
});

describe("archiveGoalSchema", () => {
  it("aceita archived true/false", () => {
    expect(archiveGoalSchema.safeParse({ goalId, archived: true }).success).toBe(true);
    expect(archiveGoalSchema.safeParse({ goalId, archived: false }).success).toBe(true);
  });

  it("rejeita archived não-booleano", () => {
    const result = archiveGoalSchema.safeParse({ goalId, archived: "true" });
    expect(result.success).toBe(false);
  });

  it("rejeita goalId com formato inválido", () => {
    const result = archiveGoalSchema.safeParse({ goalId: "abc", archived: true });
    expect(result.success).toBe(false);
  });
});

describe("addContributionSchema", () => {
  it("aceita payload válido mínimo", () => {
    const result = addContributionSchema.safeParse({
      goalId,
      amountCents: 50000n,
      contributedOn: new Date("2026-01-01"),
    });

    expect(result.success).toBe(true);
  });

  it("aceita payload completo com transactionId, responsiblePartyId e notes", () => {
    const result = addContributionSchema.safeParse({
      goalId,
      amountCents: 50000n,
      contributedOn: new Date("2026-01-01"),
      transactionId,
      responsiblePartyId: partyId,
      notes: "Aporte mensal",
    });

    expect(result.success).toBe(true);
  });

  it("aceita amountCents como BigInt nativo", () => {
    const result = addContributionSchema.safeParse({
      goalId,
      amountCents: 12345n,
      contributedOn: new Date("2026-01-01"),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.amountCents).toBe("bigint");
    }
  });

  it("rejeita amountCents zero", () => {
    const result = addContributionSchema.safeParse({
      goalId,
      amountCents: 0n,
      contributedOn: new Date("2026-01-01"),
    });

    expect(result.success).toBe(false);
  });

  it("rejeita amountCents negativo", () => {
    const result = addContributionSchema.safeParse({
      goalId,
      amountCents: -1n,
      contributedOn: new Date("2026-01-01"),
    });

    expect(result.success).toBe(false);
  });

  it("rejeita contributedOn futuro", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);

    const result = addContributionSchema.safeParse({
      goalId,
      amountCents: 1000n,
      contributedOn: future,
    });

    expect(result.success).toBe(false);
  });

  it("aceita contributedOn igual a hoje", () => {
    const result = addContributionSchema.safeParse({
      goalId,
      amountCents: 1000n,
      contributedOn: new Date(),
    });

    expect(result.success).toBe(true);
  });

  it("rejeita goalId inválido", () => {
    const result = addContributionSchema.safeParse({
      goalId: "abc",
      amountCents: 1000n,
      contributedOn: new Date("2026-01-01"),
    });

    expect(result.success).toBe(false);
  });

  it("rejeita transactionId com formato inválido", () => {
    const result = addContributionSchema.safeParse({
      goalId,
      amountCents: 1000n,
      contributedOn: new Date("2026-01-01"),
      transactionId: "not-a-cuid",
    });

    expect(result.success).toBe(false);
  });

  it("aceita transactionId/responsiblePartyId nulos (sem vínculo)", () => {
    const result = addContributionSchema.safeParse({
      goalId,
      amountCents: 1000n,
      contributedOn: new Date("2026-01-01"),
      transactionId: null,
      responsiblePartyId: null,
    });

    expect(result.success).toBe(true);
  });

  it("rejeita notes acima do limite de 2000 caracteres", () => {
    const result = addContributionSchema.safeParse({
      goalId,
      amountCents: 1000n,
      contributedOn: new Date("2026-01-01"),
      notes: "a".repeat(2001),
    });

    expect(result.success).toBe(false);
  });
});

describe("deleteContributionSchema", () => {
  it("aceita contributionId válido", () => {
    expect(deleteContributionSchema.safeParse({ contributionId }).success).toBe(true);
  });

  it("rejeita contributionId inválido", () => {
    expect(deleteContributionSchema.safeParse({ contributionId: "abc" }).success).toBe(false);
  });

  it("rejeita payload vazio", () => {
    expect(deleteContributionSchema.safeParse({}).success).toBe(false);
  });
});
