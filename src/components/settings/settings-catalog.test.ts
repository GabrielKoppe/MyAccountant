import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getSettingsFamilies,
  listSettingsRoutes,
  SETTINGS_FAMILIES,
  type SettingsEntry,
} from "./settings-catalog";

/**
 * Guard do critério da Spec 67 §8: "o mapeamento família→páginas cobre as 17
 * rotas sem órfão nem duplicata".
 *
 * As 17 rotas reais hoje (Dashboards conta como 3 sub-rotas — D4). Lista
 * literal de propósito: se alguém adicionar/remover uma página, o teste tem
 * que quebrar e forçar a decisão consciente, e não seguir o catálogo.
 */
const EXPECTED_OWNER_ROUTES = [
  "sections",
  "categories",
  "institutions",
  "responsibles",
  "table-types",
  "models",
  "dashboards/monthly",
  "dashboards/yearly",
  "dashboards/month-summary",
  "templates",
  "aliases",
  "connectors",
  "forecast",
  "checklist",
  "general",
  "members",
  "audit",
];

/** Raiz das páginas de configuração no App Router (cwd do vitest = raiz do projeto). */
const SETTINGS_DIR = path.join(process.cwd(), "src", "app", "(app)", "[accountId]", "settings");

/** `"dashboards/monthly"` → `<SETTINGS_DIR>/dashboards/monthly/page.tsx`. */
function pageFileFor(route: string): string {
  return path.join(SETTINGS_DIR, ...route.split("/"), "page.tsx");
}

function allEntries(): SettingsEntry[] {
  return SETTINGS_FAMILIES.flatMap((family) => family.entries);
}

describe("SETTINGS_FAMILIES", () => {
  it("tem exatamente as 5 famílias, na ordem da Spec 67 §6", () => {
    expect(SETTINGS_FAMILIES.map((family) => family.key)).toEqual([
      "structure",
      "presentation",
      "dataEntry",
      "planning",
      "account",
    ]);

    // Rótulos visíveis literais: a ordem que o usuário lê no nav e no hub.
    expect(SETTINGS_FAMILIES.map((family) => family.label)).toEqual([
      "Estrutura",
      "Apresentação",
      "Entrada de dados",
      "Planejamento",
      "Conta",
    ]);
  });

  it("toda entrada tem subtitle não vazio e icon preenchido (o hub depende dos dois)", () => {
    for (const entry of allEntries()) {
      expect(entry.subtitle, `subtitle de "${entry.href}"`).toBeTruthy();
      expect(entry.subtitle.trim(), `subtitle de "${entry.href}"`).not.toBe("");
      expect(entry.icon, `icon de "${entry.href}"`).toBeTruthy();
    }
  });

  it("nenhuma entrada aparece em duas famílias", () => {
    const hrefs = allEntries().map((entry) => entry.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("nenhuma sub-rota colide com outra rota do catálogo", () => {
    const routes = listSettingsRoutes("owner");
    expect(new Set(routes).size).toBe(routes.length);
  });
});

describe("listSettingsRoutes", () => {
  it("owner: exatamente as 17 rotas reais, sem órfão nem duplicata (Spec 67 §8)", () => {
    const routes = listSettingsRoutes("owner");

    expect(routes).toHaveLength(17);
    expect(new Set(routes).size).toBe(routes.length);
    expect([...routes].sort()).toEqual([...EXPECTED_OWNER_ROUTES].sort());
  });

  it("editor: não vê 'audit', mas vê 'general' e 'members'", () => {
    const routes = listSettingsRoutes("editor");

    expect(routes).not.toContain("audit");
    expect(routes).toContain("general");
    expect(routes).toContain("members");
    expect([...routes].sort()).toEqual(
      EXPECTED_OWNER_ROUTES.filter((route) => route !== "audit").sort(),
    );
  });

  it("viewer: carve-out do NAV-04 — só 'members'", () => {
    expect(listSettingsRoutes("viewer")).toEqual(["members"]);
  });
});

describe("getSettingsFamilies", () => {
  it("editor: as mesmas 5 famílias, só sem os itens ownerOnly", () => {
    const families = getSettingsFamilies("editor");

    expect(families.map((family) => family.key)).toEqual(
      SETTINGS_FAMILIES.map((family) => family.key),
    );
    const entries = families.flatMap((family) => family.entries);
    expect(entries.some((entry) => entry.ownerOnly)).toBe(false);
  });

  // O badge "somente owner" da família Conta mentiria para o editor: ele abre
  // Geral e Membros, as duas linhas que sobram do card para ele.
  it("editor: nenhuma família traz o badge de owner", () => {
    const families = getSettingsFamilies("editor");

    const account = families.find((family) => family.key === "account");
    expect(account?.ownerBadge).toBeFalsy();
    expect(account?.entries.map((entry) => entry.href)).toEqual(["general", "members"]);
    expect(families.every((family) => !family.ownerBadge)).toBe(true);
  });

  it("owner: a família Conta mantém o badge de owner", () => {
    const account = getSettingsFamilies("owner").find((family) => family.key === "account");

    expect(account?.ownerBadge).toBe(true);
  });

  it("viewer: só a família Conta, só a entrada members, sem badge de owner", () => {
    const families = getSettingsFamilies("viewer");

    expect(families).toHaveLength(1);
    expect(families[0].key).toBe("account");
    expect(families[0].entries).toHaveLength(1);
    expect(families[0].entries[0].href).toBe("members");
    // O badge "somente owner" da família Conta não pode vazar para o viewer.
    expect(families[0].ownerBadge).toBeFalsy();
  });

  it("owner: devolve o catálogo completo", () => {
    expect(getSettingsFamilies("owner")).toEqual(SETTINGS_FAMILIES);
  });
});

describe("catálogo × disco", () => {
  // Sem esta âncora, um cwd diferente faria TODOS os existsSync falharem com
  // uma mensagem enganosa ("rota órfã") em vez de "caminho base errado".
  it("encontra o diretório de páginas de configuração a partir do cwd do vitest", () => {
    expect(fs.existsSync(SETTINGS_DIR), `diretório não encontrado: ${SETTINGS_DIR}`).toBe(true);
  });

  it("toda rota do catálogo tem um page.tsx real (pega órfão de verdade)", () => {
    const orphans = listSettingsRoutes("owner").filter(
      (route) => !fs.existsSync(pageFileFor(route)),
    );
    expect(orphans, `rotas do catálogo sem page.tsx: ${orphans.join(", ")}`).toEqual([]);
  });

  it("todo href de entrada (inclusive o pai 'dashboards') tem um page.tsx real", () => {
    const orphans = allEntries()
      .map((entry) => entry.href)
      .filter((href) => !fs.existsSync(pageFileFor(href)));
    expect(orphans, `hrefs de entrada sem page.tsx: ${orphans.join(", ")}`).toEqual([]);
  });
});
