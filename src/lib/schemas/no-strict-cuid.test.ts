import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guarda de regressão: IDs de entidade NÃO podem usar `z.string().cuid()` estrito.
 *
 * Motivo (bug real, Spec 66): o banco tem ids UUID **legados** do MVP convivendo
 * com cuid — em produção, ~48% das transações e vários tipos de tabela, categorias
 * e instituições são UUID. O `.cuid()` estrito rejeita esses ids, e a Server Action
 * falha na validação ANTES do handler: a UI quebra em silêncio ("ID inválido",
 * toggle que não salva, painel que não carrega). Chegamos a acumular 103 ocorrências
 * assim, espalhadas por 14 arquivos.
 *
 * Solução canônica: `cuidSchema` (src/lib/schemas/shared.ts) — aceita cuid OU uuid e
 * continua rejeitando lixo (ex.: "abc"), preservando o valor da validação.
 *
 * Decisão de não migrar os ids (registrada aqui para quem encontrar este teste):
 * migrar as PKs exigiria reescrever 26 FKs + ids embutidos em `dashboard_layouts.widgets`
 * (JSON) e nos arrays `budgets.*_ids` — estes dois SEM proteção de FK (Postgres não
 * suporta FK em array), além de quebrar URLs salvas e o contrato da API v1. Risco alto,
 * ganho cosmético. O formato do id é irrelevante desde que a validação aceite os dois.
 */

const SCAN_DIRS = ["src/lib/schemas", "src/actions"];

/**
 * Exceções conscientes: arquivo → trecho da linha que autoriza o `.cuid()` estrito.
 * Só entram aqui entidades cujos ids são SEMPRE gerados pelo app (sem linhagem legada).
 */
const ALLOWLIST: Record<string, string[]> = {
  "src/lib/schemas/transaction-alias.ts": ["aliasIdSchema"],
};

const STRICT_CUID = "z.string().cuid(";

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsFiles(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Ignora ocorrências dentro de comentário de linha (documentação do próprio bug). */
function isComment(line: string, index: number): boolean {
  const before = line.slice(0, index);
  return before.includes("//") || before.trimStart().startsWith("*");
}

describe("IDs de entidade não usam z.string().cuid() estrito", () => {
  it("todo schema de id usa cuidSchema (aceita uuid legado), salvo exceções documentadas", () => {
    const root = process.cwd();
    const offenders: string[] = [];

    for (const dir of SCAN_DIRS) {
      for (const file of listTsFiles(join(root, dir))) {
        const rel = relative(root, file).replaceAll("\\", "/");
        if (rel.endsWith("no-strict-cuid.test.ts")) continue;

        const allowed = ALLOWLIST[rel] ?? [];
        readFileSync(file, "utf8")
          .split("\n")
          .forEach((line, i) => {
            const idx = line.indexOf(STRICT_CUID);
            if (idx === -1) return;
            if (isComment(line, idx)) return;
            if (allowed.some((token) => line.includes(token))) return;
            offenders.push(`${rel}:${i + 1} → ${line.trim()}`);
          });
      }
    }

    expect(
      offenders,
      offenders.length === 0
        ? ""
        : `Encontrado \`${STRICT_CUID}\` em id de entidade. O banco tem ids UUID legados ` +
            `e o .cuid() estrito os REJEITA, quebrando a Server Action em silêncio.\n` +
            `Troque por \`cuidSchema\` (de "@/lib/schemas/shared" ou "./shared").\n` +
            `Se o id for comprovadamente sempre-cuid, documente e adicione à ALLOWLIST ` +
            `deste teste.\n\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("cuidSchema aceita cuid e uuid legado, mas rejeita lixo", async () => {
    const { cuidSchema } = await import("./shared");

    expect(cuidSchema.safeParse("cmru3ftkb0007ph431xv608z8").success).toBe(true);
    expect(cuidSchema.safeParse("4391f79e-44cc-4af3-aa33-0c4ed60a5a17").success).toBe(true);
    expect(cuidSchema.safeParse("abc").success).toBe(false);
    expect(cuidSchema.safeParse("").success).toBe(false);
  });
});
