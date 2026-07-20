import { describe, it, expect } from "vitest";
import { prisma } from "@/server/prisma";

describe("mcp schema", () => {
  it("expõe os models mcp", () => {
    expect(prisma.mcpClient).toBeDefined();
    expect(prisma.mcpGrant).toBeDefined();
    expect(prisma.mcpToken).toBeDefined();
    expect(prisma.mcpAuthCode).toBeDefined();
  });
});
