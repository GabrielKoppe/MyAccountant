import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import { AppSidebar } from "./AppSidebar";

// Pathname mutável: `vi.hoisted` porque a factory de `vi.mock` é içada acima
// das declarações do módulo. O objeto (não o valor) é capturado no closure, de
// modo que cada teste pode reescrever `.value` antes do `render` para
// exercitar o estado ativo dos itens de navegação.
const { mockPathname } = vi.hoisted(() => ({ mockPathname: { value: "/acc-1" } }));

// Router/pathname mockados — fora de uma árvore App Router real.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => mockPathname.value,
}));
vi.mock("@/actions/auth", () => ({
  logoutAction: vi.fn(),
}));
// UserMenuButton monta NotificationsMenuSection no topo do Menu — mock evita
// resolver a Action real (não testada aqui).
vi.mock("@/actions/notifications", () => ({
  listAndMarkAllReadAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));
// O toggle de recolher chama esta Action (fire-and-forget) — mock evita puxar next-auth.
vi.mock("@/actions/user-settings", () => ({
  saveSidebarCollapsedAction: vi.fn().mockResolvedValue(undefined),
}));
// AppSidebar monta CreateMonthModal (botão "Novo Mês") → createMonthAction puxa
// next-auth no load. Mock evita resolver o módulo real (não exercitado aqui).
vi.mock("@/actions/months", () => ({
  createMonthAction: vi.fn(),
}));

// Restaura o pathname default (raiz da account) entre testes — os que o
// sobrescrevem não podem vazar para os demais.
afterEach(() => {
  mockPathname.value = "/acc-1";
});

const baseProps = {
  accountId: "acc-1",
  currentAccountName: "Conta Teste",
  otherAccounts: [],
  recentMonths: [{ id: "m-1", label: "Janeiro 2026" }],
  lastMonth: null,
  userName: "Fulano",
  userImage: null,
  initialUnreadCount: 0,
};

/**
 * Spec 65 §10.3 (P4) — a partir do Drawer mobile, o conteúdo da sidebar é
 * renderizado DUAS vezes (Drawer `keepMounted` + coluna permanente). Só a
 * coluna permanente carrega o landmark `<nav aria-label={m.nav.ariaLabel}>`
 * (o Drawer não é rotulado como landmark — ver AppSidebar.tsx). Escopar as
 * queries a esse landmark evita ambiguidade de "múltiplos elementos"
 * independente de o Drawer estar aberto/fechado.
 */
function getPermanentNav() {
  return screen.getByRole("navigation", { name: m.nav.ariaLabel });
}

describe("AppSidebar — gating por papel (Spec 65 §10.3 P1/P4)", () => {
  it("viewer: NÃO renderiza o botão 'Novo Mês' (ação global só owner/editor)", () => {
    render(<AppSidebar {...baseProps} role="viewer" />);
    const nav = getPermanentNav();
    expect(
      within(nav).queryByRole("button", { name: m.months.newMonth }),
    ).not.toBeInTheDocument();
  });

  it.each(["owner", "editor"] as const)("%s: renderiza o botão 'Novo Mês'", (role) => {
    render(<AppSidebar {...baseProps} role={role} />);
    const nav = getPermanentNav();
    expect(within(nav).getByRole("button", { name: m.months.newMonth })).toBeInTheDocument();
  });

  it.each(["owner", "editor", "viewer"] as const)(
    "%s: 'Membros' aparece no grupo Gestão para todos os papéis",
    (role) => {
      render(<AppSidebar {...baseProps} role={role} />);
      const nav = getPermanentNav();
      expect(within(nav).getByRole("link", { name: m.settings.nav.members })).toBeInTheDocument();
    },
  );

  it("viewer: NÃO renderiza 'Configurações' (owner/editor apenas)", () => {
    render(<AppSidebar {...baseProps} role="viewer" />);
    const nav = getPermanentNav();
    expect(within(nav).queryByRole("link", { name: m.nav.settings })).not.toBeInTheDocument();
  });

  it.each(["owner", "editor"] as const)("%s: renderiza 'Configurações'", (role) => {
    render(<AppSidebar {...baseProps} role={role} />);
    const nav = getPermanentNav();
    expect(within(nav).getByRole("link", { name: m.nav.settings })).toBeInTheDocument();
  });

  it("renderiza os 5 itens do grupo Principal com rótulo textual (expandido)", () => {
    render(<AppSidebar {...baseProps} role="owner" />);
    const nav = getPermanentNav();
    expect(within(nav).getByText(m.nav.months)).toBeInTheDocument();
    expect(within(nav).getByText(m.nav.dashboards)).toBeInTheDocument();
    expect(within(nav).getByText(m.netWorth.navLabel)).toBeInTheDocument();
    expect(within(nav).getByText(m.goals.navLabel)).toBeInTheDocument();
    expect(within(nav).getByText(m.cashflowForecast.navLabel)).toBeInTheDocument();
  });
});

describe("AppSidebar — recolhido vs expandido (NAV-05)", () => {
  it("expandido (default): rótulo textual visível para cada item", () => {
    render(<AppSidebar {...baseProps} role="owner" />);
    const nav = getPermanentNav();
    expect(within(nav).getByText(m.nav.dashboards)).toBeInTheDocument();
  });

  it("recolhido (initialCollapsed): sem rótulo textual, mas com aria-label acessível", () => {
    render(<AppSidebar {...baseProps} role="owner" initialCollapsed />);
    const nav = getPermanentNav();
    expect(within(nav).queryByText(m.nav.dashboards)).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: m.nav.dashboards })).toBeInTheDocument();
  });

  it("recolhido: rodapé mantém o host do usuário (avatar) — nunca exibe o nome completo inline", () => {
    render(<AppSidebar {...baseProps} role="owner" initialCollapsed userName="Fulano" />);
    const nav = getPermanentNav();
    // UserMenuButton mostra só as iniciais fora do menu (nome completo só
    // aparece dentro do Menu, que fica desmontado enquanto fechado).
    expect(within(nav).getByText("F")).toBeInTheDocument();
    expect(within(nav).queryByText("Fulano")).not.toBeInTheDocument();
  });

  it("toggle de recolher/expandir: aria-label e aria-expanded refletem o estado", async () => {
    const user = userEvent.setup();
    render(<AppSidebar {...baseProps} role="owner" />);
    const nav = getPermanentNav();

    const collapseBtn = within(nav).getByRole("button", { name: m.nav.collapse });
    expect(collapseBtn).toHaveAttribute("aria-expanded", "true");

    await user.click(collapseBtn);

    const expandBtn = within(nav).getByRole("button", { name: m.nav.expand });
    expect(expandBtn).toHaveAttribute("aria-expanded", "false");
    expect(within(nav).queryByRole("button", { name: m.nav.collapse })).not.toBeInTheDocument();
  });

  it("itens recolhidos expõem Tooltip + aria-label (sem depender só do hover)", () => {
    render(<AppSidebar {...baseProps} role="owner" initialCollapsed />);
    const nav = getPermanentNav();
    const link = within(nav).getByRole("link", { name: m.nav.dashboards });
    expect(link).toHaveAttribute("aria-label", m.nav.dashboards);
  });
});

describe("AppSidebar — Drawer mobile (Spec 65 §10.3 P4, NAV-05)", () => {
  it("hambúrguer tem aria-label e aria-expanded refletindo o Drawer", () => {
    render(<AppSidebar {...baseProps} role="owner" />);
    const hamburger = screen.getByRole("button", { name: m.nav.openMenu });
    expect(hamburger).toHaveAttribute("aria-expanded", "false");
  });

  it("hambúrguer abre o Drawer — o link acessível passa a ser o do Drawer, não mais o da coluna", async () => {
    const user = userEvent.setup();
    render(<AppSidebar {...baseProps} role="owner" />);
    const nav = getPermanentNav();

    // Fechado: o único link acessível é o da coluna permanente (Drawer fica
    // com `visibility:hidden` via Modal do MUI enquanto `open=false`).
    expect(screen.getAllByRole("link", { name: m.nav.dashboards })).toHaveLength(1);
    expect(within(nav).getByRole("link", { name: m.nav.dashboards })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: m.nav.openMenu }));

    // Aberto: o MUI marca o resto da página como `aria-hidden` enquanto o
    // Drawer é o modal do topo (comportamento padrão de a11y de Modal/Drawer)
    // — o link acessível agora é o de DENTRO do Drawer; a coluna permanente
    // deixa de ser alcançável enquanto o modal estiver aberto. `waitFor`
    // porque a marcação ocorre após o `onEnter` da transição de entrada.
    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: m.nav.dashboards })).toHaveLength(1);
      expect(within(nav).queryByRole("link", { name: m.nav.dashboards })).not.toBeInTheDocument();
    });
  });

  it("Drawer mobile não tem toggle de recolher (rail só existe na coluna permanente)", () => {
    render(<AppSidebar {...baseProps} role="owner" />);
    // Busca por aria-label bruta (não filtra por hidden/visibility, então o
    // resultado independe do Drawer estar aberto ou fechado — a existência
    // do botão é estática, definida por `onToggleCollapse` estar presente ou
    // não): deve existir exatamente 1 (o da coluna permanente). O Drawer
    // recebe `onToggleCollapse=undefined` e não renderiza o toggle.
    expect(screen.getAllByLabelText(m.nav.collapse)).toHaveLength(1);
  });
});

describe("AppSidebar — destino e estado ativo de 'Configurações' (Spec 67 §4 SET-02)", () => {
  /** Link "Configurações" da coluna permanente. */
  function getSettingsLink() {
    return within(getPermanentNav()).getByRole("link", { name: m.nav.settings });
  }

  it("aponta para o hub /{accountId}/settings — regressão: não mais /settings/general", () => {
    render(<AppSidebar {...baseProps} role="owner" />);
    expect(getSettingsLink()).toHaveAttribute("href", "/acc-1/settings");
  });

  it("fica ativo no próprio hub /settings", () => {
    mockPathname.value = "/acc-1/settings";
    render(<AppSidebar {...baseProps} role="owner" />);
    expect(getSettingsLink()).toHaveClass("Mui-selected");
  });

  it("continua ativo nas páginas filhas (ex.: /settings/general)", () => {
    mockPathname.value = "/acc-1/settings/general";
    render(<AppSidebar {...baseProps} role="owner" />);
    expect(getSettingsLink()).toHaveClass("Mui-selected");
  });

  it("NÃO fica ativo em /settings/members — quem acende é 'Membros' (Spec 65 §10.3 P1)", () => {
    mockPathname.value = "/acc-1/settings/members";
    render(<AppSidebar {...baseProps} role="owner" />);
    const nav = getPermanentNav();

    expect(getSettingsLink()).not.toHaveClass("Mui-selected");
    expect(within(nav).getByRole("link", { name: m.settings.nav.members })).toHaveClass(
      "Mui-selected",
    );
  });

  it("NÃO fica ativo em sub-rota de /settings/members", () => {
    mockPathname.value = "/acc-1/settings/members/invite";
    render(<AppSidebar {...baseProps} role="owner" />);
    expect(getSettingsLink()).not.toHaveClass("Mui-selected");
  });
});
