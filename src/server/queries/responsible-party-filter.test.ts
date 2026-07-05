import { describe, it, expect } from "vitest";

import { prismaMock } from "../../../tests/mocks/prisma";
import { responsiblePartyIdsForFilter } from "./responsible-party-filter";

describe("responsiblePartyIdsForFilter (A1 canonical resolver)", () => {
  it("returns [] for empty / nullish input without querying", async () => {
    expect(await responsiblePartyIdsForFilter("acc1", [])).toEqual([]);
    expect(await responsiblePartyIdsForFilter("acc1", null)).toEqual([]);
    expect(await responsiblePartyIdsForFilter("acc1", undefined)).toEqual([]);
    expect(prismaMock.responsibleParty.findMany).not.toHaveBeenCalled();
  });

  it("passes through valid partyIds and translates legacy userIds, deduped", async () => {
    // "p1","p2" resolvem como partyIds diretos; "u1" (userId legado) → party "p2"
    prismaMock.responsibleParty.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }] as never);
    prismaMock.responsiblePartyMember.findMany.mockResolvedValue([{ partyId: "p2" }] as never);

    const result = await responsiblePartyIdsForFilter("acc1", ["p1", "p2", "u1"]);

    expect(new Set(result)).toEqual(new Set(["p1", "p2"]));
    expect(result).toHaveLength(2); // p2 aparece nas duas fontes mas é deduplicado
  });

  it("scopes BOTH queries to the accountId (multi-tenancy)", async () => {
    prismaMock.responsibleParty.findMany.mockResolvedValue([] as never);
    prismaMock.responsiblePartyMember.findMany.mockResolvedValue([] as never);

    await responsiblePartyIdsForFilter("acc-x", ["v1"]);

    expect(prismaMock.responsibleParty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ accountId: "acc-x" }) }),
    );
    const memberCall = prismaMock.responsiblePartyMember.findMany.mock.calls[0]![0]!;
    expect(memberCall.where).toMatchObject({
      userId: { in: ["v1"] },
      party: { accountId: "acc-x", kind: "personal" },
    });
  });
});
