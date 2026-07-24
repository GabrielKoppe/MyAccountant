import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserMenuButton } from "./UserMenuButton";

const POLL_INTERVAL_MS = 5 * 60_000;

// Router e logout mockados (fora de uma árvore App Router / server real).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/actions/auth", () => ({
  logoutAction: vi.fn(),
}));
// NotificationsMenuSection (montado no topo do Menu) importa esta Action — mock evita
// resolver o módulo real. O badge/polling testado aqui NÃO depende dela.
vi.mock("@/actions/notifications", () => ({
  listAndMarkAllReadAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

describe("UserMenuButton — badge de notificações (host sempre-montado)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renderiza o avatar sem badge quando não há não-lidas", () => {
    render(
      <UserMenuButton
        userName="Fulano"
        userImage={null}
        accountId="acc-1"
        initialUnreadCount={0}
      />,
    );
    expect(screen.getByText("F")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("mostra o badge com a contagem inicial vinda do server", () => {
    render(
      <UserMenuButton
        userName="Fulano"
        userImage={null}
        accountId="acc-1"
        initialUnreadCount={3}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  // Regressão do bug: o refresh lia json.unreadCount (a rota responde
  // { ok, data: { unreadCount } }) → sempre undefined. A correção lê json.data.unreadCount.
  it("atualiza o badge no polling lendo json.data.unreadCount (regressão)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { unreadCount: 7 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <UserMenuButton
        userName="Fulano"
        userImage={null}
        accountId="acc-1"
        initialUnreadCount={0}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/accounts/acc-1/notifications");
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("não faz polling quando não há accountId (guard dos layouts sem conta)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<UserMenuButton userName="Fulano" userImage={null} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
