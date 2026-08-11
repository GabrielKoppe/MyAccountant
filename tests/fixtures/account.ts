import type { Account, AccountInvite, AccountMember, Section } from "@prisma/client";

export function buildAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-test-1",
    name: "Conta de Teste",
    createdAt: new Date("2026-01-01"),
    createdById: "user-test-1",
    ...overrides,
  };
}

export function buildAccountMember(overrides: Partial<AccountMember> = {}): AccountMember {
  return {
    accountId: "acc-test-1",
    userId: "user-test-1",
    role: "owner",
    addedById: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

export function buildSection(overrides: Partial<Section> = {}): Section {
  return {
    id: "sec-test-1",
    accountId: "acc-test-1",
    name: "Gastos",
    countType: "subtract",
    isActive: true,
    order: 0,
    // Spec 68 §2.1: chave de accent-colors. Nulo = fallback da paleta por índice,
    // que é o estado de toda seção anterior à spec.
    color: null,
    // Spec 67 §7.4: gravado só na escrita que consome a seção; legado nasce nulo.
    lastUsedAt: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

export function buildAccountInvite(overrides: Partial<AccountInvite> = {}): AccountInvite {
  return {
    id: "invite-test-1",
    accountId: "acc-test-1",
    email: "convidado@test.com",
    role: "editor",
    token: "abc123token",
    status: "pending",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    invitedById: "user-test-1",
    acceptedAt: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

export const TEST_CTX = {
  userId: "user-test-1",
  accountId: "acc-test-1",
  role: "owner" as const,
};
