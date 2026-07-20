import { describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({ MCP_ISSUER_URL: undefined as string | undefined }));

vi.mock("@/lib/env", () => ({ env: envMock }));

import { GET, OPTIONS } from "@/app/.well-known/oauth-protected-resource/api/mcp/route";

function makeRequest(
  url = "http://localhost:3000/.well-known/oauth-protected-resource/api/mcp",
): Request {
  return new Request(url);
}

describe("GET /.well-known/oauth-protected-resource/api/mcp", () => {
  it("retorna metadata RFC 9728 com `resource` apontando para /api/mcp (path-inserted)", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resource).toBe("http://localhost:3000/api/mcp");
    expect(body.authorization_servers).toEqual(["http://localhost:3000"]);
  });

  it("usa MCP_ISSUER_URL quando configurado, em vez do origin da request", async () => {
    envMock.MCP_ISSUER_URL = "https://issuer.example.com";

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.resource).toBe("https://issuer.example.com/api/mcp");
    expect(body.authorization_servers).toEqual(["https://issuer.example.com"]);

    envMock.MCP_ISSUER_URL = undefined;
  });
});

describe("OPTIONS /.well-known/oauth-protected-resource/api/mcp", () => {
  it("responde a CORS preflight", async () => {
    const response = OPTIONS();

    expect(response.status).toBeLessThan(400);
  });
});
