import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";
import type { NotificationItem } from "@/server/services/notification-service";

import { NotificationsMenuSection } from "./NotificationsMenuSection";

// Router mockado: fora de uma árvore App Router real, useRouter lança invariant.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// Server Action mockada — capturamos os argumentos e controlamos o retorno.
const listAndMarkAllReadAction = vi.fn();
vi.mock("@/actions/notifications", () => ({
  listAndMarkAllReadAction: (...args: unknown[]) => listAndMarkAllReadAction(...args),
}));

const LINKED: NotificationItem = {
  id: "n1",
  type: "transactions_added",
  title: "Editor adicionou 2 transações",
  link: "month-1",
  count: 2,
  isRead: false,
  createdAt: new Date().toISOString(),
};

const UNLINKED: NotificationItem = {
  id: "n2",
  type: "invite_accepted",
  title: "Alguém entrou na conta",
  link: null,
  count: 1,
  isRead: true,
  createdAt: new Date().toISOString(),
};

function renderSection() {
  const onAllRead = vi.fn();
  const onCloseMenu = vi.fn();
  render(
    <NotificationsMenuSection
      accountId="acc-1"
      onAllRead={onAllRead}
      onCloseMenu={onCloseMenu}
    />,
  );
  return { onAllRead, onCloseMenu };
}

describe("NotificationsMenuSection", () => {
  beforeEach(() => {
    push.mockReset();
    listAndMarkAllReadAction.mockReset();
    listAndMarkAllReadAction.mockResolvedValue({ ok: true, data: [LINKED, UNLINKED] });
  });

  it("começa recolhida: não carrega nem marca como lida ao montar", () => {
    renderSection();
    expect(screen.getByRole("button", { name: m.notifications.title })).toBeInTheDocument();
    expect(listAndMarkAllReadAction).not.toHaveBeenCalled();
    expect(screen.queryByText(LINKED.title)).not.toBeInTheDocument();
  });

  it("ao expandir: carrega a lista, marca como lida e avisa o host (onAllRead)", async () => {
    const { onAllRead } = renderSection();

    await userEvent.click(screen.getByRole("button", { name: m.notifications.title }));

    expect(listAndMarkAllReadAction).toHaveBeenCalledWith("acc-1", {});
    expect(await screen.findByText(LINKED.title)).toBeInTheDocument();
    expect(screen.getByText(UNLINKED.title)).toBeInTheDocument();
    expect(onAllRead).toHaveBeenCalledTimes(1);
  });

  it("não re-marca como lida ao recolher e reexpandir (dispara só na 1ª expansão)", async () => {
    const { onAllRead } = renderSection();
    const summary = screen.getByRole("button", { name: m.notifications.title });

    await userEvent.click(summary); // expande
    await screen.findByText(LINKED.title);
    await userEvent.click(summary); // recolhe
    await userEvent.click(summary); // reexpande

    expect(listAndMarkAllReadAction).toHaveBeenCalledTimes(1);
    expect(onAllRead).toHaveBeenCalledTimes(1);
  });

  it("clicar numa notificação com link fecha o Menu ANTES de navegar (sem ?tab)", async () => {
    const { onCloseMenu } = renderSection();

    await userEvent.click(screen.getByRole("button", { name: m.notifications.title }));
    await userEvent.click(await screen.findByText(LINKED.title));

    expect(onCloseMenu).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/acc-1/months/month-1");
    // fecha o Menu antes do push
    expect(onCloseMenu.mock.invocationCallOrder[0]).toBeLessThan(
      push.mock.invocationCallOrder[0],
    );
  });

  it("mostra estado vazio quando não há notificações", async () => {
    listAndMarkAllReadAction.mockResolvedValue({ ok: true, data: [] });
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: m.notifications.title }));

    expect(await screen.findByText(m.notifications.empty)).toBeInTheDocument();
    expect(screen.getByText(m.notifications.emptyHint)).toBeInTheDocument();
  });
});
