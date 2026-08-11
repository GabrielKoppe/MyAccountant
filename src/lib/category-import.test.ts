import { describe, expect, it } from "vitest";

import {
  classifyCategoryImport,
  IMPORT_NAME_MAX_LENGTH,
  type AccountSnapshot,
} from "./category-import";

const SNAPSHOT: AccountSnapshot = {
  categories: [
    {
      id: "cat-ali",
      name: "Alimentação",
      subcategories: [{ id: "sub-mer", name: "Mercado" }],
    },
    { id: "cat-doa", name: "Doações", subcategories: [] },
  ],
};

describe("classifyCategoryImport — criar", () => {
  it("categoria nova", () => {
    const plan = classifyCategoryImport([{ name: "Educação" }], SNAPSHOT);

    expect(plan.rows[0]).toMatchObject({
      action: "create",
      name: "Educação",
      note: "nova categoria",
    });
    expect(plan.counts.create).toBe(1);
  });

  it("subcategoria nova sob pai que já existe na conta", () => {
    const plan = classifyCategoryImport([{ name: "Delivery", parent: "Alimentação" }], SNAPSHOT);

    expect(plan.rows[0]).toMatchObject({
      action: "create",
      note: "nova subcategoria",
      parentId: "cat-ali",
    });
  });

  it("subcategoria cujo pai é criado pelo PRÓPRIO arquivo, mesmo vindo depois", () => {
    // O pai aparece na linha 2; a linha 1 não pode ser marcada como erro por isso.
    const plan = classifyCategoryImport(
      [{ name: "Escola", parent: "Educação" }, { name: "Educação" }],
      SNAPSHOT,
    );

    expect(plan.rows[0].action).toBe("create");
    expect(plan.rows[1].action).toBe("create");
    expect(plan.counts.error).toBe(0);
  });
});

describe("classifyCategoryImport — coluna `seção` sem destino (UI abandonou Category.defaultSectionId)", () => {
  it("categoria nova com `seção` preenchida: cria e reporta a coluna como ignorada, nunca valida a seção", () => {
    // Antes isso validava a seção contra a conta e podia virar erro. Sem destino,
    // uma seção inexistente ("Saúde" não está no SNAPSHOT) não impede mais nada.
    const plan = classifyCategoryImport([{ name: "Farmácia", section: "Saúde" }], SNAPSHOT);

    expect(plan.rows[0]).toMatchObject({ action: "create" });
    expect(plan.rows[0].note).toContain("seção ignorada");
    expect(plan.counts.error).toBe(0);
  });

  it("categoria já existente com `seção` preenchida: NÃO é mais atualização, é ignorar", () => {
    const plan = classifyCategoryImport([{ name: "Alimentação", section: "Moradia" }], SNAPSHOT);

    expect(plan.rows[0]).toMatchObject({ action: "skip", existingId: "cat-ali" });
    expect(plan.rows[0].note).toContain("idêntica à existente");
    expect(plan.rows[0].note).toContain("seção ignorada");
  });

  it("subcategoria com `seção` preenchida: ignorada com nota de herança do pai", () => {
    const plan = classifyCategoryImport(
      [{ name: "Padaria", parent: "Alimentação", section: "Moradia" }],
      SNAPSHOT,
    );

    expect(plan.rows[0].action).toBe("create");
    expect(plan.rows[0].note).toContain("seção ignorada (herda do pai)");
  });

  it("`seção` vazia não gera observação", () => {
    const plan = classifyCategoryImport([{ name: "Educação", section: "  " }], SNAPSHOT);
    expect(plan.rows[0].note).not.toContain("seção");
  });
});

describe("classifyCategoryImport — ignorar (sem `seção`/`cor` não há mais o que atualizar)", () => {
  it("categoria existente é sempre ignorada", () => {
    const plan = classifyCategoryImport([{ name: "Alimentação" }], SNAPSHOT);

    expect(plan.rows[0]).toMatchObject({ action: "skip", note: "idêntica à existente" });
  });

  it("reimportar o mesmo arquivo não inventa mudanças", () => {
    const plan = classifyCategoryImport(
      [{ name: "Alimentação" }, { name: "Mercado", parent: "Alimentação" }, { name: "Doações" }],
      SNAPSHOT,
    );

    expect(plan.counts.update).toBe(0);
    expect(plan.counts.skip).toBe(3);
    expect(plan.totalChanges).toBe(0);
  });

  it("subcategoria já existente sob o mesmo pai é ignorada", () => {
    const plan = classifyCategoryImport([{ name: "Mercado", parent: "Alimentação" }], SNAPSHOT);

    expect(plan.rows[0]).toMatchObject({ action: "skip", existingId: "sub-mer" });
  });
});

describe("classifyCategoryImport — erros que não contaminam as outras linhas", () => {
  it("pai inexistente vira erro e as demais seguem (critério da §4)", () => {
    const plan = classifyCategoryImport(
      [{ name: "Escola", parent: "Educação" }, { name: "Farmácia" }],
      SNAPSHOT,
    );

    expect(plan.rows[0]).toMatchObject({ action: "error" });
    expect(plan.rows[0].note).toContain('pai "Educação" não existe');
    expect(plan.rows[1].action).toBe("create");
    expect(plan.counts.error).toBe(1);
    expect(plan.counts.create).toBe(1);
  });

  it("nome vazio vira erro", () => {
    const plan = classifyCategoryImport([{ name: "   " }], SNAPSHOT);

    expect(plan.rows[0]).toMatchObject({ action: "error", note: "nome vazio" });
  });

  it("nome repetido no arquivo: a segunda ocorrência é erro", () => {
    const plan = classifyCategoryImport([{ name: "Educação" }, { name: "educação" }], SNAPSHOT);

    expect(plan.rows[0].action).toBe("create");
    expect(plan.rows[1]).toMatchObject({ action: "error", note: "repetida no arquivo" });
  });

  it("o mesmo nome sob pais diferentes NÃO é duplicata", () => {
    const plan = classifyCategoryImport(
      [
        { name: "Educação" },
        { name: "Outros", parent: "Educação" },
        { name: "Outros", parent: "Alimentação" },
      ],
      SNAPSHOT,
    );

    expect(plan.counts.error).toBe(0);
  });
});

describe("classifyCategoryImport — normalização de nome", () => {
  it("casa ignorando caixa e acento, evitando violar a unique na gravação", () => {
    const plan = classifyCategoryImport([{ name: "alimentacao" }], SNAPSHOT);

    expect(plan.rows[0]).toMatchObject({ action: "skip", existingId: "cat-ali" });
  });
});

describe("classifyCategoryImport — coluna `cor` (D2)", () => {
  it("é aceita e reportada como ignorada, não como erro", () => {
    // Categoria não tem cor própria: usa o fallback determinístico por posição. A
    // planilha do desenho traz a coluna, então recusá-la quebraria o arquivo do
    // próprio frame — mas silenciar faria o usuário acreditar que a cor foi aplicada.
    const plan = classifyCategoryImport([{ name: "Educação", color: "verde" }], SNAPSHOT);

    expect(plan.rows[0].action).toBe("create");
    expect(plan.rows[0].note).toContain("cor ignorada");
  });

  it("cor vazia não gera observação", () => {
    const plan = classifyCategoryImport([{ name: "Educação", color: "  " }], SNAPSHOT);

    expect(plan.rows[0].note).not.toContain("cor");
  });
});

describe("classifyCategoryImport — totais", () => {
  it("totalChanges é só criar — sem `seção`/`cor` não há mais gatilho de atualização", () => {
    const plan = classifyCategoryImport(
      [
        { name: "Educação" }, // create
        { name: "Escola", parent: "Educação" }, // create
        { name: "Alimentação" }, // skip
        { name: "Doações" }, // skip
        { name: "Órfã", parent: "Inexistente" }, // error
      ],
      SNAPSHOT,
    );

    expect(plan.counts).toEqual({ create: 2, update: 0, skip: 2, error: 1 });
    expect(plan.totalChanges).toBe(2);
  });

  it("numera as linhas a partir de 1, para a UI apontar o arquivo", () => {
    const plan = classifyCategoryImport([{ name: "A" }, { name: "B" }], SNAPSHOT);

    expect(plan.rows.map((r) => r.line)).toEqual([1, 2]);
  });
});

describe("classifyCategoryImport — comprimento do nome (regressão do 'Dados inválidos')", () => {
  it("aceita nome de 60 caracteres — o app cria e exporta nomes assim", () => {
    // Caso real: "Supermercados / Mercearia / Padarias / Lojas de Conveniência" (60)
    // veio do import de transações, que cria categoria sem passar pelo schema de
    // criação. O bound de 50 no schema da IMPORTAÇÃO rejeitava o arquivo inteiro —
    // ou seja, o export do próprio app não voltava.
    const nome = "Supermercados / Mercearia / Padarias / Lojas de Conveniência";
    expect(nome.length).toBe(60);

    const plan = classifyCategoryImport([{ name: nome }], SNAPSHOT);

    expect(plan.rows[0].action).toBe("create");
    expect(plan.counts.error).toBe(0);
  });

  it("nome absurdo é erro DA LINHA — as outras continuam", () => {
    const plan = classifyCategoryImport(
      [
        { name: "x".repeat(IMPORT_NAME_MAX_LENGTH + 1) },
        { name: "Educação" },
      ],
      SNAPSHOT,
    );

    expect(plan.rows[0].action).toBe("error");
    expect(plan.rows[0].note).toContain("muito longo");
    // A garantia do §4: uma linha ruim não impede as demais.
    expect(plan.rows[1].action).toBe("create");
    expect(plan.counts.create).toBe(1);
  });
});
