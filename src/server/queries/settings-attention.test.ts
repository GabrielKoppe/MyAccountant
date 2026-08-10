import { afterEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { formatMonthLabel } from "@/lib/dates";
import { m } from "@/lib/messages";
import { DEFAULT_MAPPING } from "@/lib/schemas/csv-import";

import { getSettingsAttention, INCOMPLETE_ALIAS_WHERE } from "./settings-attention";

// Mapeamento que passa no `importMappingSchema` (o DEFAULT_MAPPING sozinho não
// passa: `columns.date`/`columns.amount` são obrigatórios em amountMode single).
const healthyMapping = {
  ...DEFAULT_MAPPING,
  columns: { ...DEFAULT_MAPPING.columns, date: "Data", amount: "Valor" },
};
const structurallyBrokenMapping = { ...healthyMapping, columns: { date: "", notes: [] } };

/** Nenhum sinalizador ligado — cada teste liga só o seu. */
function setupQuietMocks() {
  prismaMock.transactionAlias.count.mockResolvedValue(0);
  prismaMock.csvTemplate.findMany.mockResolvedValue([] as never);
  prismaMock.category.findMany.mockResolvedValue([] as never);
  prismaMock.institution.findMany.mockResolvedValue([] as never);
  prismaMock.accountMember.findMany.mockResolvedValue([] as never);
  prismaMock.accountSettings.findUnique.mockResolvedValue({ monthStartDay: 1 } as never);
  // Conta sem nenhum item de checklist → a guarda do sinalizador (c) desliga.
  prismaMock.checklistItem.findFirst.mockResolvedValue(null as never);
  prismaMock.checklistCompletion.findFirst.mockResolvedValue(null as never);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("getSettingsAttention", () => {
  it("devolve [] quando não há nada pedindo atenção", async () => {
    setupQuietMocks();

    expect(await getSettingsAttention("acc-quiet")).toEqual([]);
  });

  it("nunca toca a tabela Transaction (SET-07)", async () => {
    setupQuietMocks();

    await getSettingsAttention("acc-cheap");

    expect(prismaMock.transaction.count).not.toHaveBeenCalled();
    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
    expect(prismaMock.transaction.groupBy).not.toHaveBeenCalled();
    expect(prismaMock.transaction.aggregate).not.toHaveBeenCalled();
  });

  it("filtra accountId em toda leitura (multi-tenancy)", async () => {
    setupQuietMocks();
    prismaMock.checklistItem.findFirst.mockResolvedValue({ id: "item-1" } as never);

    await getSettingsAttention("acc-tenant");

    for (const call of [
      prismaMock.transactionAlias.count.mock.calls[0]?.[0],
      prismaMock.csvTemplate.findMany.mock.calls[0]?.[0],
      prismaMock.category.findMany.mock.calls[0]?.[0],
      prismaMock.institution.findMany.mock.calls[0]?.[0],
      prismaMock.accountMember.findMany.mock.calls[0]?.[0],
      prismaMock.checklistItem.findFirst.mock.calls[0]?.[0],
      prismaMock.checklistCompletion.findFirst.mock.calls[0]?.[0],
    ]) {
      expect(call?.where).toMatchObject({ accountId: "acc-tenant" });
    }
    expect(prismaMock.accountSettings.findUnique.mock.calls[0]?.[0]?.where).toEqual({
      accountId: "acc-tenant",
    });
  });

  describe("(a) apelido incompleto", () => {
    it("sinaliza sozinho, com href do filtro pré-aplicado", async () => {
      setupQuietMocks();
      prismaMock.transactionAlias.count.mockResolvedValue(3);

      expect(await getSettingsAttention("acc-alias")).toEqual([
        {
          kind: "aliasIncomplete",
          label: m.settings.hub.signals.aliasIncomplete(3),
          href: "aliases?filter=incomplete",
          count: 3,
        },
      ]);
    });

    it("conta com a MESMA regra exportada para o filtro da página", async () => {
      setupQuietMocks();

      await getSettingsAttention("acc-alias-where");

      expect(prismaMock.transactionAlias.count).toHaveBeenCalledWith({
        where: { accountId: "acc-alias-where", ...INCOMPLETE_ALIAS_WHERE },
      });
    });

    it("a regra exige todos os 17 campos de destino nulos + nenhuma tag, e ignora arquivados", () => {
      // Identidade e condições NÃO entram: apelido que só tem gatilho/condição
      // continua não definindo nada, logo continua incompleto.
      expect(INCOMPLETE_ALIAS_WHERE).not.toHaveProperty("trigger");
      expect(INCOMPLETE_ALIAS_WHERE).not.toHaveProperty("triggerMode");
      expect(INCOMPLETE_ALIAS_WHERE).not.toHaveProperty("priority");
      expect(INCOMPLETE_ALIAS_WHERE).not.toHaveProperty("conditionInstitutionId");
      expect(INCOMPLETE_ALIAS_WHERE).not.toHaveProperty("minCents");
      expect(INCOMPLETE_ALIAS_WHERE).not.toHaveProperty("maxCents");
      // Apelido que só aplica tags é legítimo → `tags: none` faz parte da regra.
      expect(INCOMPLETE_ALIAS_WHERE.tags).toEqual({ none: {} });
      expect(INCOMPLETE_ALIAS_WHERE.archivedAt).toBeNull();

      const payloadFields = Object.entries(INCOMPLETE_ALIAS_WHERE).filter(
        ([key]) => key !== "tags" && key !== "archivedAt",
      );
      expect(payloadFields).toHaveLength(17);
      expect(payloadFields.every(([, value]) => value === null)).toBe(true);
    });
  });

  describe("(b) template quebrado", () => {
    it("sinaliza template estruturalmente inválido, ignorando os saudáveis", async () => {
      setupQuietMocks();
      prismaMock.csvTemplate.findMany.mockResolvedValue([
        { id: "t-ok", mapping: healthyMapping },
        { id: "t-broken", mapping: structurallyBrokenMapping },
      ] as never);

      expect(await getSettingsAttention("acc-template")).toEqual([
        {
          kind: "templateBroken",
          label: m.settings.hub.signals.templateBroken(1),
          href: "templates?filter=broken",
          count: 1,
        },
      ]);
    });

    it("sinaliza referência órfã (categoria excluída não limpa o Json do template)", async () => {
      setupQuietMocks();
      prismaMock.csvTemplate.findMany.mockResolvedValue([
        { id: "t-orphan", mapping: { ...healthyMapping, defaultCategoryId: "ccat_deleted1" } },
      ] as never);
      prismaMock.category.findMany.mockResolvedValue([{ id: "ccat_alive01" }] as never);

      const signals = await getSettingsAttention("acc-orphan");

      expect(signals).toHaveLength(1);
      expect(signals[0]).toMatchObject({ kind: "templateBroken", count: 1 });
    });

    it("não sinaliza quando todas as referências continuam existindo", async () => {
      setupQuietMocks();
      prismaMock.csvTemplate.findMany.mockResolvedValue([
        {
          id: "t-ok",
          mapping: {
            ...healthyMapping,
            defaultCategoryId: "ccat_alive01",
            defaultInstitutionId: "cinst_alive01",
            responsibleUserMappings: [{ text: "GABRIEL", userId: "cuser_alive01" }],
          },
        },
      ] as never);
      prismaMock.category.findMany.mockResolvedValue([{ id: "ccat_alive01" }] as never);
      prismaMock.institution.findMany.mockResolvedValue([{ id: "cinst_alive01" }] as never);
      prismaMock.accountMember.findMany.mockResolvedValue([{ userId: "cuser_alive01" }] as never);

      expect(await getSettingsAttention("acc-refs-ok")).toEqual([]);
    });
  });

  describe("(c) checklist não iniciado", () => {
    it("sinaliza o mês fiscal corrente quando não há nenhuma conclusão", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 15)); // 15/jul/2026
      setupQuietMocks();
      prismaMock.checklistItem.findFirst.mockResolvedValue({ id: "item-1" } as never);

      expect(await getSettingsAttention("acc-checklist")).toEqual([
        {
          kind: "checklistNotStarted",
          label: m.settings.hub.signals.checklistNotStarted(formatMonthLabel(2026, 7)),
          href: "checklist",
          count: 1,
        },
      ]);
      expect(prismaMock.checklistCompletion.findFirst).toHaveBeenCalledWith({
        where: {
          accountId: "acc-checklist",
          month: { accountId: "acc-checklist", year: 2026, month: 7 },
        },
        select: { id: true },
      });
    });

    it("respeita o monthStartDay da conta ao decidir qual é o mês corrente", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 15)); // 15/jul, antes da virada do dia 20
      setupQuietMocks();
      prismaMock.accountSettings.findUnique.mockResolvedValue({ monthStartDay: 20 } as never);
      prismaMock.checklistItem.findFirst.mockResolvedValue({ id: "item-1" } as never);

      const signals = await getSettingsAttention("acc-fiscal");

      expect(signals[0]?.label).toBe(
        m.settings.hub.signals.checklistNotStarted(formatMonthLabel(2026, 6)),
      );
    });

    it("NÃO sinaliza quando a conta não tem nenhum item de checklist (guarda)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 15));
      setupQuietMocks(); // checklistItem.findFirst → null

      expect(await getSettingsAttention("acc-no-checklist")).toEqual([]);
      // A guarda também poupa a query de conclusões.
      expect(prismaMock.checklistCompletion.findFirst).not.toHaveBeenCalled();
    });

    it("NÃO sinaliza quando o mês corrente já tem ao menos uma conclusão", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 15));
      setupQuietMocks();
      prismaMock.checklistItem.findFirst.mockResolvedValue({ id: "item-1" } as never);
      prismaMock.checklistCompletion.findFirst.mockResolvedValue({ id: "done-1" } as never);

      expect(await getSettingsAttention("acc-checklist-started")).toEqual([]);
    });
  });

  it("devolve os sinalizadores na ordem do §2.1 — é ela que define o destino do 'Revisar'", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15));
    setupQuietMocks();
    prismaMock.transactionAlias.count.mockResolvedValue(2);
    prismaMock.csvTemplate.findMany.mockResolvedValue([
      { id: "t-broken", mapping: structurallyBrokenMapping },
    ] as never);
    prismaMock.checklistItem.findFirst.mockResolvedValue({ id: "item-1" } as never);

    const signals = await getSettingsAttention("acc-all");

    expect(signals.map((s) => s.kind)).toEqual([
      "aliasIncomplete",
      "templateBroken",
      "checklistNotStarted",
    ]);
    expect(signals[0]?.href).toBe("aliases?filter=incomplete");
  });
});
