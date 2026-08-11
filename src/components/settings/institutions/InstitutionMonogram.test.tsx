import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ACCENT_COLOR_KEYS } from "@/lib/accent-colors";

import { accentKeyForName, initialsFor, InstitutionMonogram } from "./InstitutionMonogram";

// Spec 68 §8 — "o monograma produz duas letras estáveis".

describe("initialsFor", () => {
  it("nome de uma palavra: as duas primeiras letras, maiúsculas", () => {
    expect(initialsFor("Nubank")).toBe("NU");
    expect(initialsFor("itau")).toBe("IT");
  });

  it("nome de duas ou mais palavras: inicial da 1ª + inicial da 2ª", () => {
    expect(initialsFor("Colégio Santa Rosa")).toBe("CS");
    expect(initialsFor("XP Investimentos")).toBe("XI");
  });

  it("ignora espaços extras nas bordas e entre palavras", () => {
    expect(initialsFor("  Banco   Central  ")).toBe("BC");
  });

  it("string vazia não quebra (retorna vazio)", () => {
    expect(initialsFor("   ")).toBe("");
  });
});

describe("accentKeyForName", () => {
  it("é determinística: o mesmo nome sempre cai na mesma chave", () => {
    const first = accentKeyForName("Nubank");
    const second = accentKeyForName("Nubank");
    expect(first).toBe(second);
  });

  it("sempre retorna uma chave válida de accent-colors.ts", () => {
    expect(ACCENT_COLOR_KEYS).toContain(accentKeyForName("Itaú"));
    expect(ACCENT_COLOR_KEYS).toContain(accentKeyForName(""));
  });

  it("nomes diferentes tendem a cair em chaves diferentes (não é uma constante disfarçada)", () => {
    const keys = new Set(
      ["Nubank", "Itaú", "XP Investimentos", "Colégio Santa Rosa", "Dinheiro"].map(
        accentKeyForName,
      ),
    );
    expect(keys.size).toBeGreaterThan(1);
  });
});

describe("InstitutionMonogram", () => {
  it("renderiza as duas letras do nome", () => {
    render(<InstitutionMonogram name="Nubank" />);
    expect(screen.getByText("NU")).toBeInTheDocument();
  });

  it("é aria-hidden (o nome completo já aparece ao lado, na célula)", () => {
    const { container } = render(<InstitutionMonogram name="Itaú" />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("a mesma instituição renderizada duas vezes produz o mesmo texto (estável)", () => {
    const { unmount } = render(<InstitutionMonogram name="Colégio Santa Rosa" />);
    expect(screen.getByText("CS")).toBeInTheDocument();
    unmount();

    render(<InstitutionMonogram name="Colégio Santa Rosa" />);
    expect(screen.getByText("CS")).toBeInTheDocument();
  });
});
