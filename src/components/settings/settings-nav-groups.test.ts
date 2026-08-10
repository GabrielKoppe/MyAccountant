import { describe, expect, it } from "vitest";

import {
  buildSettingsNavGroups,
  isCollapsibleNavEntry,
  type NavEntry,
  type NavGroup,
  type NavLink,
} from "./settings-nav-groups";

/** Achata grupos → lista de hrefs (entradas colapsáveis viram seus subLinks). */
function flattenHrefs(groups: NavGroup[]): string[] {
  const flattenEntry = (entry: NavEntry): string[] =>
    isCollapsibleNavEntry(entry) ? entry.subLinks.map((sub) => sub.href) : [entry.href];

  return groups.flatMap((group) => group.entries.flatMap(flattenEntry));
}

// União real dos 17 links hoje espalhados em editorLinks/ownerLinks de
// settings/layout.tsx (Spec 65 §7.2) — nenhum link novo, apenas reagrupados.
const EXPECTED_OWNER_HREFS = [
  "sections",
  "categories",
  "institutions",
  "responsibles",
  "models",
  "templates",
  "aliases",
  "table-types",
  "checklist",
  "forecast",
  "dashboards/monthly",
  "dashboards/yearly",
  "dashboards/month-summary",
  "connectors",
  "general",
  "members",
  "audit",
];

describe("buildSettingsNavGroups", () => {
  it("owner: achatado é exatamente a união real dos 17 links (sem duplicar, sem inventar)", () => {
    const hrefs = flattenHrefs(buildSettingsNavGroups("owner"));
    expect(hrefs.sort()).toEqual([...EXPECTED_OWNER_HREFS].sort());
  });

  it("owner: sem órfão nem duplicata — cada href aparece uma única vez (Spec 67 §8)", () => {
    const hrefs = flattenHrefs(buildSettingsNavGroups("owner"));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toHaveLength(EXPECTED_OWNER_HREFS.length);
  });

  it("owner: 5 famílias na ordem da Spec 67 §6", () => {
    const groups = buildSettingsNavGroups("owner");
    expect(groups.map((g) => g.label)).toEqual([
      "Estrutura",
      "Apresentação",
      "Entrada de dados",
      "Planejamento",
      "Conta",
    ]);
  });

  it("reclassificação da Spec 67 §6: table-types e models em Apresentação, connectors em Entrada de dados", () => {
    const groups = buildSettingsNavGroups("owner");
    const byLabel = (label: string) => flattenHrefs(groups.filter((g) => g.label === label));

    expect(byLabel("Apresentação")).toEqual([
      "table-types",
      "models",
      "dashboards/monthly",
      "dashboards/yearly",
      "dashboards/month-summary",
    ]);
    expect(byLabel("Entrada de dados")).toEqual(["templates", "aliases", "connectors"]);
  });

  it("aplica as contagens baratas recebidas, e omite as ausentes", () => {
    const groups = buildSettingsNavGroups("owner", { categories: "18 · 47 sub", aliases: "132" });
    const entries = groups
      .flatMap((g) => g.entries)
      .filter((e): e is NavLink => !isCollapsibleNavEntry(e));

    expect(entries.find((e) => e.href === "categories")?.count).toBe("18 · 47 sub");
    expect(entries.find((e) => e.href === "aliases")?.count).toBe("132");
    expect(entries.find((e) => e.href === "sections")?.count).toBeUndefined();
  });

  it("nunca inclui 'budgets' (não existe rota settings/budgets — orçamentos moram em /planning)", () => {
    const hrefs = flattenHrefs(buildSettingsNavGroups("owner"));
    expect(hrefs).not.toContain("budgets");
  });

  it("owner: inclui forecast, members e audit", () => {
    const hrefs = flattenHrefs(buildSettingsNavGroups("owner"));
    expect(hrefs).toContain("forecast");
    expect(hrefs).toContain("members");
    expect(hrefs).toContain("audit");
  });

  it("editor: as mesmas 5 famílias, mas sem 'audit' (owner-only)", () => {
    const groups = buildSettingsNavGroups("editor");
    const hrefs = flattenHrefs(groups);

    expect(groups).toHaveLength(5);
    expect(hrefs).not.toContain("audit");
    expect(hrefs.sort()).toEqual(EXPECTED_OWNER_HREFS.filter((href) => href !== "audit").sort());
    expect(hrefs).toContain("forecast");
    expect(hrefs).toContain("members");
  });

  it("viewer: carve-out — só o grupo Conta com o único link Membros", () => {
    const groups = buildSettingsNavGroups("viewer");

    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toHaveLength(1);
    expect(flattenHrefs(groups)).toEqual(["members"]);
  });
});
