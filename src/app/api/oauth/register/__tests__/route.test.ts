import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({ MCP_ENABLED: false }));
const mockRegisterClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@/server/mcp/oauth/clients", () => ({ registerClient: mockRegisterClient }));

import { OPTIONS, POST } from "@/app/api/oauth/register/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/oauth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  envMock.MCP_ENABLED = true;
});

describe("OPTIONS /api/oauth/register (CORS preflight)", () => {
  it("responde 204 ecoando a Origin da requisição", async () => {
    const request = new Request("http://localhost/api/oauth/register", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:6274" },
    });

    const response = OPTIONS(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:6274");
    expect(response.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
  });
});

describe("POST /api/oauth/register", () => {
  it("registra um client válido e responde 201 com client_id", async () => {
    mockRegisterClient.mockResolvedValue({
      id: "c1",
      clientId: "generated-client-id",
      clientName: "Claude Desktop",
      redirectUris: ["https://claude.ai/callback"],
      createdAt: new Date(),
    });

    const response = await POST(
      makeRequest({ client_name: "Claude Desktop", redirect_uris: ["https://claude.ai/callback"] }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(body.client_id).toBe("generated-client-id");
    expect(body.client_name).toBe("Claude Desktop");
    expect(body.redirect_uris).toEqual(["https://claude.ai/callback"]);
    expect(body.client_id_issued_at).toEqual(expect.any(Number));
    expect(body.token_endpoint_auth_method).toBe("none");
    expect(body.grant_types).toEqual(["authorization_code", "refresh_token"]);
    expect(body.response_types).toEqual(["code"]);
    expect(body.client_secret).toBeUndefined();
    expect(mockRegisterClient).toHaveBeenCalledWith({
      clientName: "Claude Desktop",
      redirectUris: ["https://claude.ai/callback"],
    });
  });

  it("usa 'MCP Client' como client_name padrão quando ausente", async () => {
    mockRegisterClient.mockResolvedValue({
      id: "c1",
      clientId: "generated-client-id",
      clientName: "MCP Client",
      redirectUris: ["http://localhost:3000/callback"],
      createdAt: new Date(),
    });

    await POST(makeRequest({ redirect_uris: ["http://localhost:3000/callback"] }));

    expect(mockRegisterClient).toHaveBeenCalledWith({
      clientName: "MCP Client",
      redirectUris: ["http://localhost:3000/callback"],
    });
  });

  it("aceita redirect_uris http://localhost (dev)", async () => {
    mockRegisterClient.mockResolvedValue({
      id: "c1",
      clientId: "x",
      clientName: "X",
      redirectUris: ["http://localhost:8080/cb"],
      createdAt: new Date(),
    });

    const response = await POST(makeRequest({ redirect_uris: ["http://localhost:8080/cb"] }));

    expect(response.status).toBe(201);
  });

  it("retorna 400 invalid_client_metadata quando redirect_uris está ausente", async () => {
    const response = await POST(makeRequest({ client_name: "X" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_client_metadata");
    expect(mockRegisterClient).not.toHaveBeenCalled();
  });

  it("retorna 400 invalid_client_metadata quando redirect_uris é um array vazio", async () => {
    const response = await POST(makeRequest({ redirect_uris: [] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_client_metadata");
  });

  it("retorna 400 invalid_client_metadata quando redirect_uris não é um array", async () => {
    const response = await POST(makeRequest({ redirect_uris: "https://claude.ai/callback" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_client_metadata");
  });

  it("retorna 400 invalid_client_metadata para redirect_uri não-https e não-localhost", async () => {
    const response = await POST(makeRequest({ redirect_uris: ["http://evil.example.com/cb"] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_client_metadata");
    expect(mockRegisterClient).not.toHaveBeenCalled();
  });

  it("retorna 400 invalid_client_metadata para uma URI inválida (não parseável)", async () => {
    const response = await POST(makeRequest({ redirect_uris: ["not-a-url"] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_client_metadata");
  });

  it("retorna 404 quando MCP_ENABLED está desligado", async () => {
    envMock.MCP_ENABLED = false;

    const response = await POST(makeRequest({ redirect_uris: ["https://claude.ai/callback"] }));

    expect(response.status).toBe(404);
    expect(mockRegisterClient).not.toHaveBeenCalled();
  });
});
