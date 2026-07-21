import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/../tests/mocks/auth";

vi.mock("@/server/services/account-backup-service");

import { requireAccountAccess } from "@/server/auth/session";
import { importSnapshot } from "@/server/services/account-backup-service";

import { prismaMock } from "@/../tests/mocks/prisma";

import { POST } from "./route";

// Testes da route de import (spec 64, Fase 3 — BKP-02).
// Mocka auth (requireAccountAccess) e o service (importSnapshot) — a lógica de
// remap/atomicidade já é coberta em account-backup-service.test.ts.

const sessionMock = vi.mocked(requireAccountAccess);
const importMock = vi.mocked(importSnapshot);

const ACCOUNT_ID = "acc-1";
const USER_ID = "user-1";

// Data completa com os 26 arrays vazios — suficiente para passar no
// accountSnapshotSchema sem exercitar nenhuma linha (espelha
// src/lib/schemas/account-backup.test.ts).
function emptyData() {
  return {
    responsibleParties: [],
    responsiblePartyMembers: [],
    tableTypes: [],
    sections: [],
    categories: [],
    subcategories: [],
    institutions: [],
    tags: [],
    csvTemplates: [],
    months: [],
    tableTemplates: [],
    tableTemplateItems: [],
    installmentGroups: [],
    pendingInstallments: [],
    financeTables: [],
    transactions: [],
    transactionTags: [],
    transactionLinks: [],
    transactionAliases: [],
    transactionAliasTags: [],
    budgets: [],
    dashboardLayouts: [],
    checklistItems: [],
    checklistCompletions: [],
    balanceAccounts: [],
    balanceSnapshots: [],
  };
}

function validSnapshot() {
  return {
    formatVersion: 1 as const,
    app: "myaccountant" as const,
    exportedAt: "2026-07-21T12:00:00.000Z",
    account: {
      name: "Minha Conta",
      settings: {
        currency: "BRL",
        monthStartDay: 1,
        invertSignOnMoveByDefault: false,
        onboardingCompletedAt: null,
        defaultResponsiblePartyId: null,
      },
    },
    data: emptyData(),
  };
}

function makeRequest(body: unknown, headers?: Record<string, string>): Request {
  return new Request(`http://localhost/api/v1/accounts/${ACCOUNT_ID}/import/json`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function ctx() {
  return { params: Promise.resolve({ accountId: ACCOUNT_ID }) };
}

function mockOwner() {
  sessionMock.mockResolvedValue({
    user: { id: USER_ID, email: "owner@example.com" },
    member: { role: "owner" },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/v1/accounts/[accountId]/import/json", () => {
  it("responde 403 quando o membro é editor", async () => {
    sessionMock.mockResolvedValue({
      user: { id: USER_ID, email: "editor@example.com" },
      member: { role: "editor" },
    } as never);

    const res = await POST(makeRequest({ mode: "new", snapshot: validSnapshot() }), ctx());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(importMock).not.toHaveBeenCalled();
  });

  it("responde 403 quando o membro é viewer", async () => {
    sessionMock.mockResolvedValue({
      user: { id: USER_ID, email: "viewer@example.com" },
      member: { role: "viewer" },
    } as never);

    const res = await POST(makeRequest({ mode: "new", snapshot: validSnapshot() }), ctx());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(importMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando o snapshot é inválido", async () => {
    mockOwner();

    const res = await POST(
      makeRequest({ mode: "new", snapshot: { formatVersion: 2, data: {} } }),
      ctx(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("VALIDATION");
    expect(importMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando overwrite tem confirmName incorreto", async () => {
    mockOwner();
    prismaMock.account.findUnique.mockResolvedValue({ name: "Nome Real da Conta" } as never);

    const res = await POST(
      makeRequest({
        mode: "overwrite",
        confirmName: "Nome Errado",
        snapshot: validSnapshot(),
      }),
      ctx(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("VALIDATION");
    expect(body.fieldErrors?.confirmName).toBeTruthy();
    expect(importMock).not.toHaveBeenCalled();
  });

  it("chama importSnapshot em modo new e retorna ok", async () => {
    mockOwner();
    importMock.mockResolvedValue({ accountId: "new-acc", counts: { sections: 0 } });

    const res = await POST(makeRequest({ mode: "new", snapshot: validSnapshot() }), ctx());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ accountId: "new-acc", counts: { sections: 0 } });
    expect(importMock).toHaveBeenCalledWith(expect.objectContaining({ formatVersion: 1 }), {
      mode: "new",
      targetAccountId: ACCOUNT_ID,
      userId: USER_ID,
    });
  });

  it("responde 413 quando o content-length excede o cap de 8 MB", async () => {
    const res = await POST(
      makeRequest({ mode: "new", snapshot: validSnapshot() }, {
        "content-length": String(9 * 1024 * 1024),
      }),
      ctx(),
    );

    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("TOO_LARGE");
    expect(sessionMock).not.toHaveBeenCalled();
    expect(importMock).not.toHaveBeenCalled();
  });
});
