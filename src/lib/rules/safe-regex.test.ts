import { describe, expect, it } from "vitest";

import { isLikelyCatastrophicRegex } from "./safe-regex";

describe("isLikelyCatastrophicRegex", () => {
  it.each([
    ["quantificador aninhado clássico", "^(a+)+$"],
    ["estrela sobre grupo com estrela", "(a*)*"],
    ["estrela sobre grupo com mais", "(a+)*"],
    ["dot-star quantificado", "(.*)+"],
    ["grupo com \\d+ quantificado", "(\\d+)+"],
    ["grupo aninhado quantificado", "((\\d+)x){2,}"],
    ["repetição bounded gigante", "a{5000}"],
    ["repetição bounded superior gigante", "x{1,9999}"],
  ])("rejeita %s: %s", (_label, pattern) => {
    expect(isLikelyCatastrophicRegex(pattern)).toBe(true);
  });

  it("rejeita padrão absurdamente longo", () => {
    expect(isLikelyCatastrophicRegex("a".repeat(1001))).toBe(true);
  });

  it.each([
    ["alternância simples de gatilhos", "UBER|99APP|CABIFY"],
    ["âncoras + literais", "^IFOOD"],
    ["grupo sem quantificador aninhado", "(abc)+"],
    ["quantificador simples", "\\d+"],
    ["classe de caracteres quantificada", "[a-z]+"],
    ["grupo opcional (não amplifica)", "(a+)?"],
    ["repetição bounded pequena", "a{2,10}"],
    ["escape de parêntese literal", "\\(a+\\)+"],
  ])("aceita %s: %s", (_label, pattern) => {
    expect(isLikelyCatastrophicRegex(pattern)).toBe(false);
  });
});
