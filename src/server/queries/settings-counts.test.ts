import { describe, expect, it } from "vitest";

import { m } from "@/lib/messages";

import { prismaMock } from "@/../tests/mocks/prisma";

import { getSettingsCounts } from "./settings-counts";

// `getSettingsCounts` é envolvido em `React.cache`: chamadas com os MESMOS
// argumentos são memoizadas. Cada teste usa um `accountId` próprio.

type CountOverrides = Partial<{
  sectionsTotal: number;
  sectionsInactive: number;
  categories: number;
  subcategories: number;
  institutions: number;
  responsibles: number;
  tableTypes: number;
  models: number;
  dashboards: number;
  templates: number;
  aliases: number;
  connectors: number;
  checklistItems: number;
  members: number;
  pendingInvites: number;
}>;

/** Todas as contagens em 0; cada teste liga só a sua. */
function setupCounts(overrides: CountOverrides = {}) {
  const v = {
    sectionsTotal: 0,
    sectionsInactive: 0,
    categories: 0,
    subcategories: 0,
    institutions: 0,
    responsibles: 0,
    tableTypes: 0,
    models: 0,
    dashboards: 0,
    templates: 0,
    aliases: 0,
    connectors: 0,
    checklistItems: 0,
    members: 0,
    pendingInvites: 0,
    ...overrides,
  };

  // `section.count` é chamado duas vezes — total e inativas — e só o `where`
  // distingue as duas.
  prismaMock.section.count.mockImplementation((async (args?: { where?: { isActive?: boolean } }) =>
    args?.where?.isActive === false ? v.sectionsInactive : v.sectionsTotal) as never);

  prismaMock.category.count.mockResolvedValue(v.categories);
  prismaMock.subcategory.count.mockResolvedValue(v.subcategories);
  prismaMock.institution.count.mockResolvedValue(v.institutions);
  prismaMock.responsibleParty.count.mockResolvedValue(v.responsibles);
  prismaMock.tableType.count.mockResolvedValue(v.tableTypes);
  prismaMock.tableTemplate.count.mockResolvedValue(v.models);
  prismaMock.dashboardLayout.count.mockResolvedValue(v.dashboards);
  prismaMock.csvTemplate.count.mockResolvedValue(v.templates);
  prismaMock.transactionAlias.count.mockResolvedValue(v.aliases);
  prismaMock.mcpGrant.count.mockResolvedValue(v.connectors);
  prismaMock.checklistItem.count.mockResolvedValue(v.checklistItems);
  prismaMock.accountMember.count.mockResolvedValue(v.members);
  prismaMock.accountInvite.count.mockResolvedValue(v.pendingInvites);

  return v;
}

describe("getSettingsCounts", () => {
  it("nunca toca a tabela Transaction (SET-07)", async () => {
    setupCounts();

    await getSettingsCounts("acc-cheap", "owner", "user-1");

    expect(prismaMock.transaction.count).not.toHaveBeenCalled();
    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
    expect(prismaMock.transaction.groupBy).not.toHaveBeenCalled();
    expect(prismaMock.transaction.aggregate).not.toHaveBeenCalled();
  });

  it("filtra accountId em toda contagem (multi-tenancy)", async () => {
    setupCounts();

    await getSettingsCounts("acc-tenant", "owner", "user-1");

    for (const call of [
      prismaMock.section.count.mock.calls[0]?.[0],
      prismaMock.section.count.mock.calls[1]?.[0],
      prismaMock.category.count.mock.calls[0]?.[0],
      prismaMock.institution.count.mock.calls[0]?.[0],
      prismaMock.responsibleParty.count.mock.calls[0]?.[0],
      prismaMock.tableType.count.mock.calls[0]?.[0],
      prismaMock.tableTemplate.count.mock.calls[0]?.[0],
      prismaMock.dashboardLayout.count.mock.calls[0]?.[0],
      prismaMock.csvTemplate.count.mock.calls[0]?.[0],
      prismaMock.transactionAlias.count.mock.calls[0]?.[0],
      prismaMock.mcpGrant.count.mock.calls[0]?.[0],
      prismaMock.checklistItem.count.mock.calls[0]?.[0],
      prismaMock.accountMember.count.mock.calls[0]?.[0],
      prismaMock.accountInvite.count.mock.calls[0]?.[0],
    ]) {
      expect(call?.where).toMatchObject({ accountId: "acc-tenant" });
    }

    // `Subcategory` não tem coluna accountId — o recorte vai pela relação.
    expect(prismaMock.subcategory.count.mock.calls[0]?.[0]?.where).toEqual({
      category: { accountId: "acc-tenant" },
    });
    // Conectores MCP são user-scoped (Spec 63), além do recorte por conta.
    expect(prismaMock.mcpGrant.count.mock.calls[0]?.[0]?.where).toMatchObject({
      userId: "user-1",
      revokedAt: null,
    });
  });

  it("recorta o viewer para a única contagem que ele enxerga (D3)", async () => {
    setupCounts({ members: 4, categories: 99 });

    const counts = await getSettingsCounts("acc-viewer", "viewer", "user-1");

    expect(counts).toEqual({ members: "4" });
    expect(prismaMock.accountMember.count).toHaveBeenCalledWith({
      where: { accountId: "acc-viewer" },
    });
    // O carve-out existe para NÃO pagar as outras 14 contagens.
    expect(prismaMock.category.count).not.toHaveBeenCalled();
    expect(prismaMock.dashboardLayout.count).not.toHaveBeenCalled();
    expect(prismaMock.accountInvite.count).not.toHaveBeenCalled();
  });

  it("omite a chave das páginas sem contagem — nunca inventa '0'", async () => {
    setupCounts();

    const counts = await getSettingsCounts("acc-absent", "owner", "user-1");

    expect(counts).not.toHaveProperty("general");
    expect(counts).not.toHaveProperty("audit");
    expect(counts).not.toHaveProperty("forecast");
  });

  describe("rótulos (todos vindos de m.settings.hub.counts)", () => {
    it("seções: só o total quando não há inativa; singular e plural quando há", async () => {
      setupCounts({ sectionsTotal: 6 });
      expect((await getSettingsCounts("acc-sec-0", "owner", "u")).sections).toBe("6");

      setupCounts({ sectionsTotal: 6, sectionsInactive: 1 });
      expect((await getSettingsCounts("acc-sec-1", "owner", "u")).sections).toBe(
        m.settings.hub.counts.sections(6, 1),
      );
      expect((await getSettingsCounts("acc-sec-1", "owner", "u")).sections).toBe("6 · 1 inativa");

      setupCounts({ sectionsTotal: 6, sectionsInactive: 2 });
      expect((await getSettingsCounts("acc-sec-2", "owner", "u")).sections).toBe("6 · 2 inativas");
    });

    it("categorias: só o total quando não há subcategoria; '· N sub' quando há", async () => {
      setupCounts({ categories: 18 });
      expect((await getSettingsCounts("acc-cat-0", "owner", "u")).categories).toBe("18");

      setupCounts({ categories: 18, subcategories: 1 });
      expect((await getSettingsCounts("acc-cat-1", "owner", "u")).categories).toBe("18 · 1 sub");

      setupCounts({ categories: 18, subcategories: 47 });
      expect((await getSettingsCounts("acc-cat-n", "owner", "u")).categories).toBe(
        m.settings.hub.counts.categories(18, 47),
      );
    });

    it("conectores: '0', singular e plural", async () => {
      setupCounts({ connectors: 0 });
      expect((await getSettingsCounts("acc-conn-0", "owner", "u")).connectors).toBe("0");

      setupCounts({ connectors: 1 });
      expect((await getSettingsCounts("acc-conn-1", "owner", "u")).connectors).toBe("1 conectado");

      setupCounts({ connectors: 3 });
      expect((await getSettingsCounts("acc-conn-3", "owner", "u")).connectors).toBe("3 conectados");
    });

    it("membros: só o total sem convite pendente; singular e plural com convite", async () => {
      setupCounts({ members: 3 });
      expect((await getSettingsCounts("acc-mem-0", "owner", "u")).members).toBe("3");

      setupCounts({ members: 3, pendingInvites: 1 });
      expect((await getSettingsCounts("acc-mem-1", "owner", "u")).members).toBe("3 · 1 convite");

      setupCounts({ members: 3, pendingInvites: 2 });
      expect((await getSettingsCounts("acc-mem-2", "owner", "u")).members).toBe(
        m.settings.hub.counts.members(3, 2),
      );
      expect(m.settings.hub.counts.members(3, 2)).toBe("3 · 2 convites");
    });

    it("dashboards: quantos dos 3 contextos estão personalizados (B2)", async () => {
      setupCounts({ dashboards: 0 });
      expect((await getSettingsCounts("acc-dash-0", "owner", "u")).dashboards).toBe(
        "0 de 3 personalizados",
      );

      setupCounts({ dashboards: 1 });
      expect((await getSettingsCounts("acc-dash-1", "owner", "u")).dashboards).toBe(
        "1 de 3 personalizado",
      );

      setupCounts({ dashboards: 3 });
      expect((await getSettingsCounts("acc-dash-3", "owner", "u")).dashboards).toBe(
        m.settings.hub.counts.dashboards(3, 3),
      );
      // Uma linha por contexto (`@@unique([accountId, context])`) — um `count`
      // simples, sem carregar o Json de widgets.
      expect(prismaMock.dashboardLayout.count).toHaveBeenLastCalledWith({
        where: { accountId: "acc-dash-3" },
      });
      expect(prismaMock.dashboardLayout.findMany).not.toHaveBeenCalled();
      expect(prismaMock.dashboardLayout.findUnique).not.toHaveBeenCalled();
    });

    it("conta o que não tem plural especial como número puro", async () => {
      setupCounts({
        institutions: 5,
        responsibles: 2,
        tableTypes: 4,
        models: 7,
        templates: 9,
        aliases: 12,
        checklistItems: 8,
      });

      expect(await getSettingsCounts("acc-plain", "owner", "u")).toMatchObject({
        institutions: "5",
        responsibles: "2",
        "table-types": "4",
        models: "7",
        templates: "9",
        aliases: "12",
        checklist: "8",
      });
    });
  });
});
