import { describe, expect, it } from "vitest";

import { hashToken } from "./hash-token";

describe("hashToken", () => {
  it("gera SHA-256 hex determinístico", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("é determinístico para a mesma entrada", () => {
    expect(hashToken("token-xyz")).toBe(hashToken("token-xyz"));
  });

  it("difere para entradas diferentes", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});
