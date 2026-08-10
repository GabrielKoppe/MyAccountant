import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { m } from "@/lib/messages";

import type { SettingsFamily } from "./settings-catalog";
import { SettingsFamilyCard } from "./SettingsFamilyCard";

const ACCOUNT_ID = "acc-test-1";

// Família sintética (não a do catálogo): o card não pode depender do conteúdo
// atual de `SETTINGS_FAMILIES` — reordenar as páginas lá não deve quebrar aqui.
const FAMILY: SettingsFamily = {
  key: "structure",
  label: "Estrutura",
  icon: "structure",
  entries: [
    { href: "sections", label: "Seções", subtitle: "Abas de cada mês", icon: "sections" },
    {
      href: "categories",
      label: "Categorias",
      subtitle: "Classificação das transações",
      icon: "categories",
    },
    {
      href: "institutions",
      label: "Instituições",
      subtitle: "Bancos e cartões",
      icon: "institutions",
    },
  ],
};

function renderCard(props: Partial<Parameters<typeof SettingsFamilyCard>[0]> = {}) {
  return render(
    <SettingsFamilyCard
      family={FAMILY}
      accountId={ACCOUNT_ID}
      counts={{ sections: "6", categories: "18 · 47 sub" }}
      {...props}
    />,
  );
}

describe("SettingsFamilyCard (Spec 67 §4 SET-02)", () => {
  it("renderiza o rótulo da família e uma linha por entrada", () => {
    renderCard();

    expect(screen.getByText("Estrutura")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(FAMILY.entries.length);
    for (const entry of FAMILY.entries) {
      expect(screen.getByText(entry.label)).toBeInTheDocument();
      expect(screen.getByText(entry.subtitle)).toBeInTheDocument();
    }
  });

  it("cada linha aponta para /[accountId]/settings/[href]", () => {
    renderCard();

    expect(screen.getByRole("link", { name: /Seções/ })).toHaveAttribute(
      "href",
      `/${ACCOUNT_ID}/settings/sections`,
    );
    expect(screen.getByRole("link", { name: /Categorias/ })).toHaveAttribute(
      "href",
      `/${ACCOUNT_ID}/settings/categories`,
    );
    expect(screen.getByRole("link", { name: /Instituições/ })).toHaveAttribute(
      "href",
      `/${ACCOUNT_ID}/settings/institutions`,
    );
  });

  it("mostra a contagem quando existe", () => {
    renderCard();

    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("18 · 47 sub")).toBeInTheDocument();
  });

  // Chave ausente em `counts` = página sem contagem barata (Geral, Auditoria).
  // A linha existe, mas nada de número — nem um "0" inventado.
  it("omite a contagem quando o href não está em counts", () => {
    renderCard();

    const link = screen.getByRole("link", { name: /Instituições/ });
    expect(link).toHaveTextContent("Instituições");
    expect(link).toHaveTextContent("Bancos e cartões");
    expect(link.textContent).toBe("InstituiçõesBancos e cartões");
  });

  it("não mostra o badge de owner sem ownerBadge", () => {
    renderCard();

    expect(screen.queryByText(m.settings.hub.ownerOnlyBadge)).not.toBeInTheDocument();
  });

  it("mostra o badge de owner quando a família tem ownerBadge", () => {
    renderCard({ family: { ...FAMILY, ownerBadge: true } });

    expect(screen.getByText(m.settings.hub.ownerOnlyBadge)).toBeInTheDocument();
  });

  it("sem flaggedHrefs, nenhuma linha tem ícone de alerta", () => {
    renderCard();

    expect(screen.queryByRole("img", { name: m.settings.hub.rowNeedsAttention })).toBeNull();
  });

  it("marca com o ícone de alerta apenas as linhas de flaggedHrefs", () => {
    renderCard({ flaggedHrefs: ["categories"] });

    // O alerta é acessível por texto, não só por cor.
    const alerts = screen.getAllByRole("img", { name: m.settings.hub.rowNeedsAttention });
    expect(alerts).toHaveLength(1);

    const flaggedRow = screen.getByRole("link", { name: /Categorias/ });
    expect(flaggedRow).toContainElement(alerts[0]);
  });
});
