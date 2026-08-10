import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AttentionSignal } from "@/server/queries/settings-attention";

import { SettingsAttentionBanner } from "./SettingsAttentionBanner";

const ACCOUNT_ID = "acc-test-1";

const ALIAS_SIGNAL: AttentionSignal = {
  kind: "aliasIncomplete",
  label: "2 apelidos não preenchem nenhum campo",
  href: "aliases?filter=incomplete",
  count: 2,
};

const TEMPLATE_SIGNAL: AttentionSignal = {
  kind: "templateBroken",
  label: "1 template de importação com referência quebrada",
  href: "templates?filter=broken",
  count: 1,
};

function renderBanner(signals: AttentionSignal[]) {
  return render(<SettingsAttentionBanner signals={signals} accountId={ACCOUNT_ID} />);
}

describe("SettingsAttentionBanner (Spec 67 §2.1 / §4 SET-02)", () => {
  // Critério explícito do §4: sem sinalizador não há placeholder vazio.
  it("não renderiza nada quando não há sinalizadores", () => {
    const { container } = renderBanner([]);
    expect(container.firstChild).toBeNull();
  });

  it("soma os counts dos sinalizadores no título — não conta sinalizadores", () => {
    renderBanner([ALIAS_SIGNAL, TEMPLATE_SIGNAL]);

    // 2 apelidos + 1 template = 3 itens (e não "2 sinalizadores").
    expect(screen.getByText("3 itens pedem atenção")).toBeInTheDocument();
  });

  it("lista os labels separados por ' · '", () => {
    renderBanner([ALIAS_SIGNAL, TEMPLATE_SIGNAL]);

    expect(
      screen.getByText(`${ALIAS_SIGNAL.label} · ${TEMPLATE_SIGNAL.label}`),
    ).toBeInTheDocument();
  });

  it("aponta o 'Revisar' para o destino do PRIMEIRO sinalizador", () => {
    renderBanner([ALIAS_SIGNAL, TEMPLATE_SIGNAL]);

    expect(screen.getByRole("link", { name: "Revisar" })).toHaveAttribute(
      "href",
      `/${ACCOUNT_ID}/settings/aliases?filter=incomplete`,
    );
  });

  it("segue o primeiro da lista quando a ordem muda", () => {
    renderBanner([TEMPLATE_SIGNAL, ALIAS_SIGNAL]);

    expect(screen.getByRole("link", { name: "Revisar" })).toHaveAttribute(
      "href",
      `/${ACCOUNT_ID}/settings/templates?filter=broken`,
    );
  });

  it("usa o singular quando há um único item", () => {
    renderBanner([TEMPLATE_SIGNAL]);

    expect(screen.getByText("1 item pede atenção")).toBeInTheDocument();
    // Um sinalizador só: nada de separador pendurado no fim da frase.
    expect(screen.getByText(TEMPLATE_SIGNAL.label)).toBeInTheDocument();
  });

  // Conteúdo estático do primeiro paint não é live region (nada seria anunciado):
  // é uma região rotulada pelo próprio título, navegável por marcos.
  it("expõe o bloco como região rotulada pelo próprio título", () => {
    renderBanner([ALIAS_SIGNAL]);

    const region = screen.getByRole("region", { name: "2 itens pedem atenção" });
    expect(region).toBeInTheDocument();
    expect(region).toContainElement(screen.getByText(ALIAS_SIGNAL.label));
  });

  it("não usa live region — o bloco não muda depois do primeiro paint", () => {
    renderBanner([ALIAS_SIGNAL]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
