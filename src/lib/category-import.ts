// Spec 68 §2.2 (EST-04) — classificação linha a linha do arquivo de categorias.
//
// Função PURA, sem Prisma: recebe as linhas do arquivo e um retrato do que já existe
// na conta, e devolve o que aconteceria. É esse retorno que o modal M4 exibe — e nada
// é gravado antes de o usuário confirmar.
//
// Separar a classificação da gravação é o que torna o preview confiável: a mesma
// função decide o que mostrar e o que aplicar, então a lista conferida na tela é
// literalmente o plano executado.

/** Uma linha crua do CSV/XLSX/JSON, já com as colunas mapeadas. */
export type CategoryImportRow = {
  name: string;
  /** Nome do pai. Vazio = categoria de topo. */
  parent?: string;
  /**
   * Coluna `seção` de uma planilha antiga (a UI abandonou "Seção padrão" nesta
   * revisão — ver o comentário de depreciação em `Category.defaultSectionId`).
   * **Sem destino**: tratada exatamente como `color` abaixo — aceita para o arquivo
   * não quebrar, reportada como ignorada, nunca valida contra as seções da conta.
   */
  section?: string;
  /**
   * Coluna `cor` do arquivo do frame. **Sem destino** (D2: categoria não tem cor
   * própria — herda o fallback determinístico por posição). Aceita para a planilha
   * do desenho importar sem erro, e reportada como ignorada para o usuário não achar
   * que foi aplicada.
   */
  color?: string;
};

/**
 * Comprimento máximo de um nome vindo de arquivo.
 *
 * Generoso de propósito: o banco tem categorias de 60 caracteres criadas pelo import
 * de transações (que não passa por `createCategorySchema`), e o export do próprio app
 * as devolve. Recusá-las quebraria o ida-e-volta do arquivo que a ferramenta gerou.
 * O que este limite barra é lixo — e barra **por linha**, sem derrubar o arquivo.
 */
export const IMPORT_NAME_MAX_LENGTH = 120;

export type ImportAction = "create" | "update" | "skip" | "error";

export type ClassifiedRow = {
  /** Índice da linha no arquivo (1-based, sem contar o cabeçalho) — para a UI apontar. */
  line: number;
  name: string;
  parent: string | null;
  action: ImportAction;
  /** Frase curta do porquê: "nova categoria", "nova subcategoria · cor ignorada"… */
  note: string;
  /** Id do objeto existente, quando a ação é `skip`. */
  existingId?: string;
  /** Id do pai resolvido, quando é subcategoria a criar. */
  parentId?: string;
};

export type ImportPlan = {
  rows: ClassifiedRow[];
  counts: { create: number; update: number; skip: number; error: number };
  /** Quantas mudanças o botão de confirmação vai aplicar (`create` + `update`). Com
   * `seção`/`cor` sem destino, uma categoria de topo já existente nunca muda de
   * estado por reimportação — só `create` (nome novo) alimenta este total hoje. */
  totalChanges: number;
};

/** Retrato do que já existe na conta, no momento em que o arquivo foi lido. */
export type AccountSnapshot = {
  categories: Array<{
    id: string;
    name: string;
    subcategories: Array<{ id: string; name: string }>;
  }>;
};

/**
 * Comparação de nome tolerante: o usuário digita "alimentação" na planilha e
 * "Alimentação" está na conta — são a mesma categoria, e criar a segunda esbarraria
 * na unique `[accountId, name]` na hora de gravar.
 */
function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function classifyCategoryImport(
  rawRows: CategoryImportRow[],
  snapshot: AccountSnapshot,
): ImportPlan {
  const categoryByName = new Map(snapshot.categories.map((c) => [normalize(c.name), c]));

  // Um pai pode vir DEPOIS do filho no arquivo, ou ser criado pelo próprio arquivo.
  // Por isso a lista de pais válidos é montada antes de classificar qualquer linha.
  const topLevelInFile = new Set(
    rawRows.filter((r) => !r.parent?.trim() && r.name.trim()).map((r) => normalize(r.name)),
  );

  // Nome já visto neste arquivo (no mesmo nível) — a segunda ocorrência é duplicata.
  const seen = new Set<string>();

  const rows = rawRows.map((raw, index): ClassifiedRow => {
    const line = index + 1;
    const name = raw.name?.trim() ?? "";
    const parent = raw.parent?.trim() || null;
    const sectionGiven = Boolean(raw.section?.trim());
    const colorGiven = Boolean(raw.color?.trim());

    const base = { line, name, parent };

    if (!name) {
      return { ...base, action: "error", note: "nome vazio" };
    }

    // Linha longa demais é ERRO DA LINHA, não do arquivo: as outras seguem (§4).
    if (name.length > IMPORT_NAME_MAX_LENGTH) {
      return {
        ...base,
        action: "error",
        note: `nome muito longo (máx. ${IMPORT_NAME_MAX_LENGTH})`,
      };
    }

    const dupKey = `${normalize(parent ?? "")}/${normalize(name)}`;
    if (seen.has(dupKey)) {
      return { ...base, action: "error", note: "repetida no arquivo" };
    }
    seen.add(dupKey);

    // ── Subcategoria ────────────────────────────────────────────────────────
    if (parent) {
      const parentKey = normalize(parent);
      const parentInAccount = categoryByName.get(parentKey);
      const parentInFile = topLevelInFile.has(parentKey);

      // Critério da §4: linha com pai inexistente é ERRO e não impede as demais.
      if (!parentInAccount && !parentInFile) {
        return { ...base, action: "error", note: `pai "${parent}" não existe` };
      }

      const existingSub = parentInAccount?.subcategories.find(
        (s) => normalize(s.name) === normalize(name),
      );

      if (existingSub) {
        return {
          ...base,
          action: "skip",
          note: "idêntica à existente",
          existingId: existingSub.id,
        };
      }

      const notes = ["nova subcategoria"];
      // Subcategoria não tem seção própria — herda a do pai (§2.2). Dizer isso evita
      // que o usuário conclua que a coluna foi respeitada.
      if (sectionGiven) notes.push("seção ignorada (herda do pai)");
      if (colorGiven) notes.push("cor ignorada");

      return {
        ...base,
        action: "create",
        note: notes.join(" · "),
        parentId: parentInAccount?.id,
      };
    }

    // ── Categoria de topo ───────────────────────────────────────────────────
    const existing = categoryByName.get(normalize(name));

    if (!existing) {
      const notes = ["nova categoria"];
      if (sectionGiven) notes.push("seção ignorada");
      if (colorGiven) notes.push("cor ignorada");
      return { ...base, action: "create", note: notes.join(" · ") };
    }

    // Existe: sem `seção`/`cor` para gravar, uma categoria de topo já cadastrada
    // nunca muda de estado por reimportação — é sempre ignorar, nunca atualizar.
    const notes = ["idêntica à existente"];
    if (sectionGiven) notes.push("seção ignorada");
    if (colorGiven) notes.push("cor ignorada");
    return { ...base, action: "skip", note: notes.join(" · "), existingId: existing.id };
  });

  const counts = {
    create: rows.filter((r) => r.action === "create").length,
    update: rows.filter((r) => r.action === "update").length,
    skip: rows.filter((r) => r.action === "skip").length,
    error: rows.filter((r) => r.action === "error").length,
  };

  return { rows, counts, totalChanges: counts.create + counts.update };
}
