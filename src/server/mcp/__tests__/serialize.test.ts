import { describe, it, expect } from "vitest";
import { serializeForMcp } from "@/server/mcp/serialize";

describe("serializeForMcp", () => {
  it("serializa BigInt (centavos) como string, sem perda de precisão", () => {
    const result = serializeForMcp({ amountCents: 123456789012345n });

    expect(result).toBe('{"amountCents":"123456789012345"}');
    expect(JSON.parse(result)).toEqual({ amountCents: "123456789012345" });
  });

  it("serializa BigInt negativo como string", () => {
    const result = serializeForMcp({ amountCents: -500n });

    expect(JSON.parse(result)).toEqual({ amountCents: "-500" });
  });

  it("serializa Date como string ISO", () => {
    const occurredOn = new Date("2026-01-15T00:00:00.000Z");

    const result = serializeForMcp({ occurredOn });

    expect(JSON.parse(result)).toEqual({ occurredOn: "2026-01-15T00:00:00.000Z" });
  });

  it("serializa estrutura aninhada com BigInt e Date juntos", () => {
    const data = {
      items: [
        { id: "t1", amountCents: 1000n, occurredOn: new Date("2026-02-01T12:00:00.000Z") },
        { id: "t2", amountCents: -250n, occurredOn: new Date("2026-02-02T08:30:00.000Z") },
      ],
    };

    const result = serializeForMcp(data);

    expect(JSON.parse(result)).toEqual({
      items: [
        { id: "t1", amountCents: "1000", occurredOn: "2026-02-01T12:00:00.000Z" },
        { id: "t2", amountCents: "-250", occurredOn: "2026-02-02T08:30:00.000Z" },
      ],
    });
  });

  it("preserva valores primitivos comuns (string, number, boolean, null)", () => {
    const result = serializeForMcp({ name: "abc", count: 3, active: true, categoryId: null });

    expect(JSON.parse(result)).toEqual({ name: "abc", count: 3, active: true, categoryId: null });
  });
});
