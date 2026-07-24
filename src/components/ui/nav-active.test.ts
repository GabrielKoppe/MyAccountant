import { describe, expect, it } from "vitest";

import { activeNavItemSx, isNavItemActive } from "./nav-active";

describe("isNavItemActive", () => {
  describe("modo default (prefixo)", () => {
    it("é ativo em match exato", () => {
      expect(isNavItemActive("/acc-1/dashboards", "/acc-1/dashboards")).toBe(true);
    });

    it("é ativo em rota aninhada (prefixo + '/')", () => {
      expect(isNavItemActive("/acc-1/months/m-1", "/acc-1/months")).toBe(true);
    });

    it("não é ativo quando o pathname só compartilha o prefixo textual (sem '/')", () => {
      // "/acc-1/settings-x" NÃO deve casar com "/acc-1/settings" — precisa do "/".
      expect(isNavItemActive("/acc-1/settings-x", "/acc-1/settings")).toBe(false);
    });

    it("não é ativo em rota totalmente distinta", () => {
      expect(isNavItemActive("/acc-1/net-worth", "/acc-1/dashboards")).toBe(false);
    });
  });

  describe("modo exact", () => {
    it("é ativo somente em match exato", () => {
      expect(isNavItemActive("/acc-1", "/acc-1", { exact: true })).toBe(true);
    });

    it("NÃO é ativo em rota aninhada quando exact:true", () => {
      // Caso "Meses": href base "/acc-1" não pode capturar "/acc-1/dashboards".
      expect(isNavItemActive("/acc-1/dashboards", "/acc-1", { exact: true })).toBe(false);
    });
  });

  describe("caso Meses (base exata OU prefixo /months) — §10.3 P1", () => {
    const accountId = "acc-1";
    const monthsHref = `/${accountId}`;
    const isMonthsActive = (pathname: string) =>
      isNavItemActive(pathname, monthsHref, { exact: true }) ||
      isNavItemActive(pathname, `${monthsHref}/months`);

    it("ativo na raiz da account", () => {
      expect(isMonthsActive("/acc-1")).toBe(true);
    });

    it("ativo em /months/:id", () => {
      expect(isMonthsActive("/acc-1/months/m-42")).toBe(true);
    });

    it("ativo em /months (sem id)", () => {
      expect(isMonthsActive("/acc-1/months")).toBe(true);
    });

    it("NÃO ativo em outra rota da account (ex.: dashboards)", () => {
      expect(isMonthsActive("/acc-1/dashboards")).toBe(false);
    });
  });

  describe("caso Configurações (prefixo /settings e NÃO /settings/members) — §10.3 P1", () => {
    const accountId = "acc-1";
    const settingsBase = `/${accountId}/settings`;
    const membersHref = `${settingsBase}/members`;
    const isSettingsActive = (pathname: string) =>
      isNavItemActive(pathname, settingsBase) && !isNavItemActive(pathname, membersHref);

    it("ativo em /settings/general", () => {
      expect(isSettingsActive("/acc-1/settings/general")).toBe(true);
    });

    it("ativo na raiz /settings", () => {
      expect(isSettingsActive("/acc-1/settings")).toBe(true);
    });

    it("NÃO ativo em /settings/members (Membros tem item próprio)", () => {
      expect(isSettingsActive("/acc-1/settings/members")).toBe(false);
    });

    it("NÃO ativo em /settings/members/sub-rota", () => {
      expect(isSettingsActive("/acc-1/settings/members/invite")).toBe(false);
    });
  });

  describe("caso Membros (destino próprio)", () => {
    const accountId = "acc-1";
    const membersHref = `/${accountId}/settings/members`;

    it("ativo em /settings/members", () => {
      expect(isNavItemActive("/acc-1/settings/members", membersHref)).toBe(true);
    });

    it("ativo em rota aninhada de members", () => {
      expect(isNavItemActive("/acc-1/settings/members/invite", membersHref)).toBe(true);
    });

    it("NÃO ativo em /settings/general", () => {
      expect(isNavItemActive("/acc-1/settings/general", membersHref)).toBe(false);
    });
  });
});

describe("activeNavItemSx", () => {
  it("define bgcolor, borderRight e cor do texto/ícone sob .Mui-selected", () => {
    const selected = (
      activeNavItemSx as unknown as {
        "&.Mui-selected": Record<string, unknown>;
      }
    )["&.Mui-selected"];

    expect(selected.bgcolor).toBe("background.subtle");
    expect(selected.borderColor).toBe("primary.main");
    expect((selected["& .MuiListItemText-primary"] as Record<string, unknown>).color).toBe(
      "primary.main",
    );
    expect((selected["& .MuiListItemIcon-root"] as Record<string, unknown>).color).toBe(
      "primary.main",
    );
  });
});
