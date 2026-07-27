import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MoneyValue } from "./MoneyValue";

describe("MoneyValue", () => {
  describe("showSign omitido (padrão)", () => {
    it("não exibe sinal negativo para valor negativo", () => {
      render(<MoneyValue cents={-10000n} />);
      expect(screen.getByText((text) => text.includes("100"))).not.toHaveTextContent("-");
    });

    it("não exibe sinal positivo para valor positivo", () => {
      render(<MoneyValue cents={10000n} />);
      expect(screen.getByText((text) => text.includes("100"))).not.toHaveTextContent("+");
    });
  });

  describe("showSign=true", () => {
    it("exibe sinal positivo para valor positivo", () => {
      render(<MoneyValue cents={10000n} showSign />);
      expect(screen.getByText((text) => text.includes("+"))).toBeInTheDocument();
    });

    it("exibe sinal negativo para valor negativo", () => {
      render(<MoneyValue cents={-10000n} showSign />);
      expect(screen.getByText((text) => text.includes("-"))).toBeInTheDocument();
    });

    it("não exibe sinal para valor zero", () => {
      render(<MoneyValue cents={0n} showSign />);
      const el = screen.getByText((text) => text.includes("0"));
      expect(el).not.toHaveTextContent("+");
      expect(el).not.toHaveTextContent("-");
    });
  });

  describe("variant customizado", () => {
    it("renderiza sem quebrar com variant='h4'", () => {
      render(<MoneyValue cents={12345n} variant="h4" />);
      expect(screen.getByText((text) => text.includes("123"))).toBeInTheDocument();
    });
  });
});
