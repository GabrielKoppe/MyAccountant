import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({ MCP_ENABLED: false, MCP_ACCESS_TOKEN_TTL_SECONDS: 3600 }));
const mockConsumeAuthCode = vi.hoisted(() => vi.fn());
const mockVerifyPkceS256 = vi.hoisted(() => vi.fn());
const mockUpsertGrant = vi.hoisted(() => vi.fn());
const mockIssueTokens = vi.hoisted(() => vi.fn());
const mockRotateRefreshToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@/server/mcp/oauth/codes", () => ({ consumeAuthCode: mockConsumeAuthCode }));
vi.mock("@/server/mcp/oauth/pkce", () => ({ verifyPkceS256: mockVerifyPkceS256 }));
vi.mock("@/server/mcp/oauth/store", () => ({
  upsertGrant: mockUpsertGrant,
  issueTokens: mockIssueTokens,
  rotateRefreshToken: mockRotateRefreshToken,
}));

import { OPTIONS, POST } from "@/app/api/oauth/token/route";

const AUTH_CODE_RECORD = {
  id: "code-1",
  code: "hashed",
  clientId: "client-1",
  userId: "user-1",
  accountId: "acc-1",
  redirectUri: "https://claude.ai/callback",
  codeChallenge: "challenge-abc",
  scope: "read",
  expiresAt: new Date(Date.now() + 10_000),
  consumedAt: new Date(),
  createdAt: new Date(),
};

const GRANT = {
  id: "grant-1",
  userId: "user-1",
  accountId: "acc-1",
  clientId: "client-1",
  scope: "read",
  createdAt: new Date(),
  lastUsedAt: null,
  revokedAt: null,
};

const TOKENS = { accessToken: "access-raw", refreshToken: "refresh-raw" };

function makeRequest(params: Record<string, string>): Request {
  const body = new URLSearchParams(params);
  return new Request("http://localhost/api/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

const VALID_CODE_PARAMS = {
  grant_type: "authorization_code",
  code: "raw-code",
  code_verifier: "verifier-abc",
  redirect_uri: "https://claude.ai/callback",
  client_id: "client-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  envMock.MCP_ENABLED = true;
  envMock.MCP_ACCESS_TOKEN_TTL_SECONDS = 3600;
  mockConsumeAuthCode.mockResolvedValue(AUTH_CODE_RECORD);
  mockVerifyPkceS256.mockReturnValue(true);
  mockUpsertGrant.mockResolvedValue(GRANT);
  mockIssueTokens.mockResolvedValue(TOKENS);
  mockRotateRefreshToken.mockResolvedValue(TOKENS);
});

describe("OPTIONS /api/oauth/token (CORS preflight)", () => {
  it("responde 204 ecoando a Origin da requisição", async () => {
    const request = new Request("http://localhost/api/oauth/token", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:6274" },
    });

    const response = OPTIONS(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:6274");
    expect(response.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
  });
});

describe("POST /api/oauth/token", () => {
  it("inclui Access-Control-Allow-Origin ecoando a Origin em toda resposta (sucesso e erro)", async () => {
    const successResponse = await POST(makeRequest(VALID_CODE_PARAMS));
    expect(successResponse.headers.get("access-control-allow-origin")).toBe("*");

    mockConsumeAuthCode.mockResolvedValue(null);
    const errorRequest = makeRequest(VALID_CODE_PARAMS);
    errorRequest.headers.set("origin", "http://localhost:6274");
    const errorResponse = await POST(errorRequest);
    expect(errorResponse.headers.get("access-control-allow-origin")).toBe("http://localhost:6274");
  });

  it("retorna 404 quando MCP_ENABLED está desligado", async () => {
    envMock.MCP_ENABLED = false;

    const response = await POST(makeRequest(VALID_CODE_PARAMS));

    expect(response.status).toBe(404);
    expect(mockConsumeAuthCode).not.toHaveBeenCalled();
  });

  describe("grant_type=authorization_code", () => {
    it("caminho feliz: troca o code por um par de tokens", async () => {
      const response = await POST(makeRequest(VALID_CODE_PARAMS));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(body).toEqual({
        access_token: "access-raw",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "refresh-raw",
        scope: "read",
      });

      expect(mockConsumeAuthCode).toHaveBeenCalledWith("raw-code");
      expect(mockVerifyPkceS256).toHaveBeenCalledWith("verifier-abc", "challenge-abc");
      expect(mockUpsertGrant).toHaveBeenCalledWith("user-1", "acc-1", "client-1");
      expect(mockIssueTokens).toHaveBeenCalledWith("grant-1");
    });

    it("replay: consumeAuthCode retorna null (code já usado/expirado) → 400 invalid_grant, sem emitir tokens", async () => {
      mockConsumeAuthCode.mockResolvedValue(null);

      const response = await POST(makeRequest(VALID_CODE_PARAMS));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({ error: "invalid_grant" });
      expect(mockVerifyPkceS256).not.toHaveBeenCalled();
      expect(mockUpsertGrant).not.toHaveBeenCalled();
      expect(mockIssueTokens).not.toHaveBeenCalled();
    });

    it("code_verifier errado (verifyPkceS256 → false) → 400 invalid_grant, sem emitir tokens", async () => {
      mockVerifyPkceS256.mockReturnValue(false);

      const response = await POST(makeRequest(VALID_CODE_PARAMS));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({ error: "invalid_grant" });
      expect(mockUpsertGrant).not.toHaveBeenCalled();
      expect(mockIssueTokens).not.toHaveBeenCalled();
    });

    it("redirect_uri divergente do vinculado ao code → 400 invalid_grant, sem emitir tokens", async () => {
      const response = await POST(
        makeRequest({ ...VALID_CODE_PARAMS, redirect_uri: "https://evil.example.com/cb" }),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({ error: "invalid_grant" });
      expect(mockIssueTokens).not.toHaveBeenCalled();
    });

    it("client_id divergente do vinculado ao code → 400 invalid_grant, sem emitir tokens", async () => {
      const response = await POST(makeRequest({ ...VALID_CODE_PARAMS, client_id: "outro-client" }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({ error: "invalid_grant" });
      expect(mockIssueTokens).not.toHaveBeenCalled();
    });
  });

  describe("grant_type=refresh_token", () => {
    it("caminho feliz: rotaciona o refresh e retorna o novo par", async () => {
      const response = await POST(
        makeRequest({ grant_type: "refresh_token", refresh_token: "old-refresh-raw" }),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(mockRotateRefreshToken).toHaveBeenCalledWith("old-refresh-raw");
      expect(body).toEqual({
        access_token: "access-raw",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "refresh-raw",
        scope: "read",
      });
    });

    it("refresh_token inválido/revogado (rotateRefreshToken → null) → 400 invalid_grant", async () => {
      mockRotateRefreshToken.mockResolvedValue(null);

      const response = await POST(
        makeRequest({ grant_type: "refresh_token", refresh_token: "bad-refresh" }),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({ error: "invalid_grant" });
    });
  });

  it("grant_type não suportado → 400 unsupported_grant_type", async () => {
    const response = await POST(makeRequest({ grant_type: "client_credentials" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "unsupported_grant_type" });
    expect(mockConsumeAuthCode).not.toHaveBeenCalled();
    expect(mockRotateRefreshToken).not.toHaveBeenCalled();
  });

  it("Content-Type inválido (application/json) → 400 invalid_request, sem chamar consumeAuthCode/issueTokens", async () => {
    const request = new Request("http://localhost/api/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(VALID_CODE_PARAMS),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ error: "invalid_request" });
    expect(mockConsumeAuthCode).not.toHaveBeenCalled();
    expect(mockIssueTokens).not.toHaveBeenCalled();
  });

  it("sem Content-Type → 400 invalid_request, sem chamar consumeAuthCode/issueTokens", async () => {
    const request = new Request("http://localhost/api/oauth/token", {
      method: "POST",
      body: new URLSearchParams(VALID_CODE_PARAMS).toString(),
    });
    request.headers.delete("content-type");

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ error: "invalid_request" });
    expect(mockConsumeAuthCode).not.toHaveBeenCalled();
    expect(mockIssueTokens).not.toHaveBeenCalled();
  });
});
