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

describe("SettingsFamilyCard — faixa larga (família Conta no frame de arquitetura)", () => {
  const WIDE_FAMILY: SettingsFamily = {
    key: "account",
    label: "Conta",
    icon: "account",
    ownerBadge: true,
    wide: true,
    entries: [
      { href: "general", label: "Geral", subtitle: "Nome, moeda, fuso", icon: "general" },
      { href: "members", label: "Membros", subtitle: "Convites e papéis", icon: "members" },
      { href: "audit", label: "Trilha de auditoria", subtitle: "Últimos 90 dias", icon: "audit" },
    ],
  };

  /** A `<ul>` do card — em faixa vira grid de N colunas; em coluna, lista comum. */
  function listOf(container: HTMLElement) {
    const list = container.querySelector("ul");
    if (!list) throw new Error("lista do card não encontrada");
    return list;
  }

  /**
   * O número de colunas vive dentro de uma media query (`sm`), e o jsdom não
   * avalia media query — `toHaveStyle` só vê o valor base. Então a asserção é
   * sobre o CSS que o Emotion emitiu para as classes DESTE elemento.
   */
  function cssOf(element: Element) {
    const classes = Array.from(element.classList);
    return Array.from(document.querySelectorAll("style"))
      .map((style) => style.textContent ?? "")
      .filter((css) => classes.some((className) => css.includes(className)))
      .join("\n");
  }

  it("dispõe as entradas em colunas de largura igual, uma por página", () => {
    const { container } = render(
      <SettingsFamilyCard family={WIDE_FAMILY} accountId={ACCOUNT_ID} counts={{}} />,
    );

    const list = listOf(container);
    expect(list).toHaveStyle({ display: "grid" });
    expect(cssOf(list)).toMatch(/repeat\(\s*3\s*,\s*1fr\s*\)/);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("empilha em tela estreita — uma coluna só antes do breakpoint `sm`", () => {
    const { container } = render(
      <SettingsFamilyCard family={WIDE_FAMILY} accountId={ACCOUNT_ID} counts={{}} />,
    );

    // MUI emite até o `xs` dentro de `@media (min-width:0px)`, então a checagem
    // é sobre a regra e não sobre o estilo computado (jsdom ignora media query).
    expect(cssOf(listOf(container))).toMatch(/grid-template-columns:\s*1fr\s*[;}]/);
  });

  it("acompanha o recorte por papel: com 2 entradas, 2 colunas", () => {
    const { container } = render(
      <SettingsFamilyCard
        family={{ ...WIDE_FAMILY, entries: WIDE_FAMILY.entries.slice(0, 2) }}
        accountId={ACCOUNT_ID}
        counts={{}}
      />,
    );

    expect(cssOf(listOf(container))).toMatch(/repeat\(\s*2\s*,\s*1fr\s*\)/);
  });

  it("com uma única entrada volta a ser coluna — faixa de um item é card estreito disfarçado", () => {
    const { container } = render(
      <SettingsFamilyCard
        family={{ ...WIDE_FAMILY, entries: WIDE_FAMILY.entries.slice(0, 1) }}
        accountId={ACCOUNT_ID}
        counts={{}}
      />,
    );

    expect(listOf(container)).not.toHaveStyle({ display: "grid" });
  });

  it("família sem `wide` continua empilhada", () => {
    const { container } = renderCard();

    expect(listOf(container)).not.toHaveStyle({ display: "grid" });
  });
});
