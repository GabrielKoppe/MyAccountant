import { describe, expect, it } from "vitest";

import { countAttachments } from "./attachments";

const base = {
  notes: null,
  originalCurrency: null,
  linkCount: 0,
  tags: [] as { id: string; name: string; color: string | null }[],
  installmentGroupId: null,
};

describe("countAttachments", () => {
  it("zero quando não há extras", () => {
    expect(countAttachments(base)).toBe(0);
  });
  it("soma nota + câmbio + vínculos + tags + parcela", () => {
    expect(
      countAttachments({
        notes: "x",
        originalCurrency: "USD",
        linkCount: 2,
        tags: [{ id: "1", name: "a", color: null }],
        installmentGroupId: "g1",
      }),
    ).toBe(6);
  });
  it("conta cada tag e cada vínculo individualmente", () => {
    expect(
      countAttachments({ ...base, linkCount: 3, tags: [{ id: "1", name: "a", color: null }, { id: "2", name: "b", color: null }] }),
    ).toBe(5);
  });
});
