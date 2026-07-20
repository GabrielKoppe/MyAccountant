import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({ MCP_ENABLED: false }));
const mockGetClient = vi.hoisted(() => vi.fn());
const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@/server/mcp/oauth/clients", () => ({ getClient: mockGetClient }));
vi.mock("@/server/auth", () => ({ auth: mockAuth }));

import { GET } from "@/app/api/oauth/authorize/route";

const VALID_CLIENT = {
  id: "client-db-1",
  clientId: "client-1",
  clientName: "Claude Desktop",
  redirectUris: ["https://claude.ai/callback"],
  createdAt: new Date("2026-01-01"),
};

const VALID_REDIRECT_URI = "https://claude.ai/callback";

function buildUrl(params: Record<string, string | undefined>): string {
  const url = new URL("http://localhost/api/oauth/authorize");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

const VALID_PARAMS = {
  client_id: "client-1",
  redirect_uri: VALID_REDIRECT_URI,
  response_type: "code",
  code_challenge: "challenge-abc",
  code_challenge_method: "S256",
  state: "state-xyz",
};

beforeEach(() => {
  vi.clearAllMocks();
  envMock.MCP_ENABLED = true;
  mockGetClient.mockResolvedValue(VALID_CLIENT);
  mockAuth.mockResolvedValue(null);
});

describe("GET /api/oauth/authorize", () => {
  it("retorna 404 quando MCP_ENABLED está desligado", async () => {
    envMock.MCP_ENABLED = false;

    const response = await GET(new Request(buildUrl(VALID_PARAMS)));

    expect(response.status).toBe(404);
    expect(mockGetClient).not.toHaveBeenCalled();
  });

  it("client_id desconhecido: 400 sem redirect (anti open-redirect)", async () => {
    mockGetClient.mockResolvedValue(null);
    const maliciousRedirect = "https://evil.example.com/steal";

    const response = await GET(
      new Request(buildUrl({ ...VALID_PARAMS, client_id: "unknown-client", redirect_uri: maliciousRedirect })),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("location")).toBeNull();
    const body = await response.text();
    expect(body).not.toContain(maliciousRedirect);
  });

  it("redirect_uri não registrado para o client: 400 sem redirect (anti open-redirect)", async () => {
    const maliciousRedirect = "https://evil.example.com/steal";

    const response = await GET(new Request(buildUrl({ ...VALID_PARAMS, redirect_uri: maliciousRedirect })));

    expect(response.status).toBe(400);
    expect(response.headers.get("location")).toBeNull();
    const body = await response.text();
    expect(body).not.toContain(maliciousRedirect);
  });

  it("redirect_uri como prefixo/substring de uma URI registrada NÃO é aceito (igualdade estrita)", async () => {
    // client só tem "https://claude.ai/callback" registrado — um redirect_uri que apenas
    // começa com essa string não pode passar (guarda contra bypass por substring).
    const response = await GET(
      new Request(buildUrl({ ...VALID_PARAMS, redirect_uri: `${VALID_REDIRECT_URI}.evil.example.com` })),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("location")).toBeNull();
  });

  it("response_type diferente de 'code': redireciona ao client com error=invalid_request", async () => {
    const response = await GET(new Request(buildUrl({ ...VALID_PARAMS, response_type: "token" })));

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(location!.startsWith(VALID_REDIRECT_URI)).toBe(true);
    expect(new URL(location!).searchParams.get("error")).toBe("invalid_request");
  });

  it("code_challenge ausente: redireciona ao client com error=invalid_request", async () => {
    const response = await GET(new Request(buildUrl({ ...VALID_PARAMS, code_challenge: undefined })));

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(location!.startsWith(VALID_REDIRECT_URI)).toBe(true);
    expect(new URL(location!).searchParams.get("error")).toBe("invalid_request");
  });

  it("code_challenge_method ausente (não-S256): redireciona ao client com error=invalid_request", async () => {
    const response = await GET(new Request(buildUrl({ ...VALID_PARAMS, code_challenge_method: undefined })));

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(location!.startsWith(VALID_REDIRECT_URI)).toBe(true);
    expect(new URL(location!).searchParams.get("error")).toBe("invalid_request");
  });

  it("code_challenge_method='plain' (não-S256): redireciona ao client com error=invalid_request", async () => {
    const response = await GET(new Request(buildUrl({ ...VALID_PARAMS, code_challenge_method: "plain" })));

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(location!.startsWith(VALID_REDIRECT_URI)).toBe(true);
    expect(new URL(location!).searchParams.get("error")).toBe("invalid_request");
  });

  it("scope diferente de 'read': redireciona ao client com error=invalid_request", async () => {
    const response = await GET(new Request(buildUrl({ ...VALID_PARAMS, scope: "write" })));

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(location!.startsWith(VALID_REDIRECT_URI)).toBe(true);
    expect(new URL(location!).searchParams.get("error")).toBe("invalid_request");
  });

  it("parâmetros válidos, sem sessão: redireciona para /login preservando callbackUrl", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(new Request(buildUrl(VALID_PARAMS)));

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(location!.startsWith("http://localhost/login?callbackUrl=")).toBe(true);

    const callbackUrl = new URL(location!).searchParams.get("callbackUrl");
    expect(callbackUrl).not.toBeNull();
    expect(callbackUrl).toContain("/api/oauth/authorize");
    expect(callbackUrl).toContain("client_id=client-1");
  });

  it("parâmetros válidos, com sessão: redireciona para /oauth/consent com os parâmetros", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const response = await GET(new Request(buildUrl(VALID_PARAMS)));

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(location!.startsWith("http://localhost/oauth/consent?")).toBe(true);

    const locationParams = new URL(location!).searchParams;
    expect(locationParams.get("client_id")).toBe("client-1");
    expect(locationParams.get("redirect_uri")).toBe(VALID_REDIRECT_URI);
    expect(locationParams.get("response_type")).toBe("code");
    expect(locationParams.get("code_challenge")).toBe("challenge-abc");
    expect(locationParams.get("code_challenge_method")).toBe("S256");
    expect(locationParams.get("scope")).toBe("read");
    expect(locationParams.get("state")).toBe("state-xyz");
  });

  it("sem sessão: não chega a chamar getClient de novo nem vaza para redirect_uri do client", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(new Request(buildUrl(VALID_PARAMS)));

    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(location!.startsWith(VALID_REDIRECT_URI)).toBe(false);
  });
});
