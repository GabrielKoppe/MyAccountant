import { describe, it, expect } from "vitest";

import { mcpTools } from "@/server/mcp/tools";

const WRITE_HINT = /(create|update|delete|set_|add_|remove_)/i;

describe("mcpTools é read-only e sem accountId", () => {
  it("nenhum nome de tool sugere escrita", () => {
    for (const name of Object.keys(mcpTools)) {
      expect(name, `tool ${name} parece de escrita`).not.toMatch(WRITE_HINT);
    }
  });

  it("nenhum shape de tool declara accountId", () => {
    for (const [name, tool] of Object.entries(mcpTools)) {
      expect(Object.keys(tool.shape), `tool ${name} expõe accountId`).not.toContain(
        "accountId",
      );
    }
  });
});
