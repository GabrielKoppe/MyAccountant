import { describe, expect, it } from "vitest";

import {
  buildSettingsNavGroups,
  isCollapsibleNavEntry,
  type NavEntry,
  type NavGroup,
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

  it("owner: 6 famílias com cabeçalho overline", () => {
    const groups = buildSettingsNavGroups("owner");
    expect(groups).toHaveLength(6);
    expect(groups.every((g) => g.label.length > 0)).toBe(true);
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

  it("editor: as mesmas 6 famílias, mas sem 'audit' (owner-only)", () => {
    const groups = buildSettingsNavGroups("editor");
    const hrefs = flattenHrefs(groups);

    expect(groups).toHaveLength(6);
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
