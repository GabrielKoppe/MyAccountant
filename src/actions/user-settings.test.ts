// Spec 65 §7.4/§10.3 (P3) — `saveSidebarCollapsedAction` (NAV-05).
//
// Cobre só o novo comportamento (persistência do cookie de sidebar
// recolhida). `@/server/auth` e o service de user-settings são mockados
// para isolar o teste da árvore pesada de NextAuth/Prisma (nenhum dos dois é
// chamado por esta action — ver §7.4: "sem auth()/DB").

import { beforeEach, describe, expect, it, vi } from "vitest";

const setCookieMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: setCookieMock })),
}));

vi.mock("@/server/auth", () => ({ auth: authMock }));

vi.mock("@/server/services/user-settings-service", () => ({
  saveTheme: vi.fn(),
  saveAccentColor: vi.fn(),
}));

import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/sidebar-preference";

import { saveSidebarCollapsedAction } from "./user-settings";

const EXPECTED_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 365 * 24 * 60 * 60,
  sameSite: "strict",
  httpOnly: false,
};

describe("saveSidebarCollapsedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persiste '1' quando collapsed=true, com o shape exato do cookie", async () => {
    await saveSidebarCollapsedAction(true);

    expect(setCookieMock).toHaveBeenCalledTimes(1);
    expect(setCookieMock).toHaveBeenCalledWith(
      SIDEBAR_COLLAPSED_COOKIE,
      "1",
      EXPECTED_COOKIE_OPTIONS,
    );
  });

  it("persiste '0' quando collapsed=false, com o shape exato do cookie", async () => {
    await saveSidebarCollapsedAction(false);

    expect(setCookieMock).toHaveBeenCalledTimes(1);
    expect(setCookieMock).toHaveBeenCalledWith(
      SIDEBAR_COLLAPSED_COOKIE,
      "0",
      EXPECTED_COOKIE_OPTIONS,
    );
  });

  it("não chama auth()/DB — fora de escopo (§7.4, ao contrário de saveThemeAction)", async () => {
    await saveSidebarCollapsedAction(true);

    expect(authMock).not.toHaveBeenCalled();
  });
});
