import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";

import type { StoredWidget } from "@/lib/schemas/dashboard-layout";

vi.mock("@/server/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));

import { prisma } from "@/server/prisma";

import {
  discardDraft,
  getEditorLayout,
  getLayout,
  publishDraft,
  saveDraft,
  upsertLayout,
} from "./dashboard-layout-service";

const db = prisma as unknown as DeepMockProxy<PrismaClient>;

const CTX = { accountId: "acc-1" } as Parameters<typeof saveDraft>[1];
const OTHER_ACCOUNT = "acc-2";

function widget(overrides: Partial<StoredWidget> = {}): StoredWidget {
  return {
    instanceId: "w1",
    widgetId: "kpi-income",
    visible: true,
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    sizeVariantId: "default",
    ...overrides,
  };
}

const PUBLISHED = [widget({ instanceId: "pub", x: 0 })];
const DRAFT = [widget({ instanceId: "pub", x: 3 })];

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Spec 69 §2.3 — publicar × descartar.
// A promessa auditável desta suíte: NENHUM caminho, além de `publishDraft`,
// escreve na coluna `widgets` a partir do editor. É `widgets` que as 3 páginas
// reais de dashboard leem.
// ─────────────────────────────────────────────────────────────────────────────

describe("getLayout — o que a página real lê", () => {
  it("lê o layout PUBLICADO e nunca seleciona o rascunho", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({ widgets: PUBLISHED } as never);

    const result = await getLayout("acc-1", "monthly");

    expect(result).toEqual(PUBLISHED);
    const args = db.dashboardLayout.findUnique.mock.calls[0][0];
    expect(args.select).toEqual({ widgets: true });
    expect(args.select).not.toHaveProperty("draft");
    // Multi-tenancy: sempre pela chave composta com o accountId recebido.
    expect(args.where).toEqual({ accountId_context: { accountId: "acc-1", context: "monthly" } });
  });

  it("com rascunho pendente, a página real continua vendo o publicado", async () => {
    // O `select` acima já garante isto no SQL; aqui a prova é de comportamento:
    // mesmo que a linha tenha rascunho, o retorno é o conteúdo de `widgets`.
    db.dashboardLayout.findUnique.mockResolvedValue({
      widgets: PUBLISHED,
      draft: DRAFT,
    } as never);

    await expect(getLayout("acc-1", "monthly")).resolves.toEqual(PUBLISHED);
  });
});

describe("getEditorLayout — o que o editor abre", () => {
  it("abre o rascunho quando existe, mantendo o publicado à parte", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({
      widgets: PUBLISHED,
      draft: DRAFT,
    } as never);

    const result = await getEditorLayout("acc-1", "monthly");

    expect(result.widgets).toEqual(DRAFT);
    expect(result.published).toEqual(PUBLISHED);
    expect(result.hasDraft).toBe(true);
  });

  it("sem rascunho, abre o publicado", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({
      widgets: PUBLISHED,
      draft: null,
    } as never);

    const result = await getEditorLayout("acc-1", "monthly");

    expect(result.widgets).toEqual(PUBLISHED);
    expect(result.hasDraft).toBe(false);
  });
});

describe("saveDraft — autosave do editor", () => {
  it("grava SÓ o rascunho numa linha existente (não toca em widgets)", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({ id: "l1" } as never);

    await saveDraft({ context: "monthly", widgets: DRAFT }, CTX);

    expect(db.dashboardLayout.update).toHaveBeenCalledOnce();
    const args = db.dashboardLayout.update.mock.calls[0][0];
    expect(args.data).toEqual({ draft: DRAFT });
    expect(args.data).not.toHaveProperty("widgets");
    expect(args.where).toEqual({ accountId_context: { accountId: "acc-1", context: "monthly" } });
  });

  it("sem linha no banco, cria com o PADRÃO publicado e o rascunho à parte", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue(null);

    await saveDraft({ context: "monthly", widgets: DRAFT }, CTX);

    const data = db.dashboardLayout.create.mock.calls[0][0].data as unknown as {
      widgets: StoredWidget[];
      draft: StoredWidget[];
      accountId: string;
    };
    // O publicado nasce como o layout padrão — nunca como o rascunho, senão
    // abrir o editor já publicaria.
    expect(data.draft).toEqual(DRAFT);
    expect(data.widgets).not.toEqual(DRAFT);
    expect(data.widgets.length).toBeGreaterThan(0);
    expect(data.accountId).toBe("acc-1");
  });

  it("recusa widget desconhecido antes de gravar", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({ id: "l1" } as never);

    await expect(
      saveDraft({ context: "monthly", widgets: [widget({ widgetId: "nao-existe" })] }, CTX),
    ).rejects.toThrow();
    expect(db.dashboardLayout.update).not.toHaveBeenCalled();
  });

  it("recusa widget fora dos limites da grade", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({ id: "l1" } as never);

    await expect(
      saveDraft({ context: "monthly", widgets: [widget({ x: 5, w: 3 })] }, CTX),
    ).rejects.toThrow();
    expect(db.dashboardLayout.update).not.toHaveBeenCalled();
  });

  it("multi-tenancy: grava sempre no accountId do contexto", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({ id: "l1" } as never);

    await saveDraft({ context: "monthly", widgets: DRAFT }, CTX);

    const args = db.dashboardLayout.update.mock.calls[0][0];
    expect(JSON.stringify(args.where)).not.toContain(OTHER_ACCOUNT);
    expect(args.where).toMatchObject({ accountId_context: { accountId: "acc-1" } });
  });
});

describe("publishDraft — o único caminho que muda a página real", () => {
  it("copia rascunho → widgets, carimba publishedAt e limpa o rascunho", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({
      widgets: PUBLISHED,
      draft: DRAFT,
    } as never);

    const result = await publishDraft("monthly", CTX);

    expect(result).toEqual(DRAFT);
    const data = db.dashboardLayout.update.mock.calls[0][0].data as unknown as {
      widgets: StoredWidget[];
      draft: unknown;
      publishedAt: Date;
    };
    expect(data.widgets).toEqual(DRAFT);
    expect(data.draft).not.toBeUndefined(); // Prisma.DbNull
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it("sem rascunho pendente é no-op e devolve o publicado", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({
      widgets: PUBLISHED,
      draft: null,
    } as never);

    await expect(publishDraft("monthly", CTX)).resolves.toEqual(PUBLISHED);
    expect(db.dashboardLayout.update).not.toHaveBeenCalled();
  });

  it("revalida o rascunho antes de publicar — guarda de UI não é guarda", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({
      widgets: PUBLISHED,
      draft: [widget({ widgetId: "nao-existe" })],
    } as never);

    await expect(publishDraft("monthly", CTX)).rejects.toThrow();
    expect(db.dashboardLayout.update).not.toHaveBeenCalled();
  });

  it("multi-tenancy: lê E grava sempre no accountId do contexto", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({
      widgets: PUBLISHED,
      draft: DRAFT,
    } as never);

    await publishDraft("monthly", CTX);

    // As DUAS queries: publicar lê antes de escrever, e a leitura é o ponto em
    // que um id vindo do cliente entraria — aqui não há nenhum, a chave composta
    // vem sempre de `ctx.accountId`.
    const read = db.dashboardLayout.findUnique.mock.calls[0][0];
    const write = db.dashboardLayout.update.mock.calls[0][0];
    expect(read.where).toEqual({ accountId_context: { accountId: "acc-1", context: "monthly" } });
    expect(write.where).toEqual({ accountId_context: { accountId: "acc-1", context: "monthly" } });
    expect(JSON.stringify([read.where, write.where])).not.toContain(OTHER_ACCOUNT);
  });
});

describe("discardDraft — a página real fica intacta", () => {
  it("limpa só o rascunho e devolve o publicado", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({ widgets: PUBLISHED } as never);

    const result = await discardDraft("monthly", CTX);

    expect(result).toEqual(PUBLISHED);
    const data = db.dashboardLayout.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(["draft"]);
  });

  it("multi-tenancy: lê E grava sempre no accountId do contexto", async () => {
    db.dashboardLayout.findUnique.mockResolvedValue({ widgets: PUBLISHED } as never);

    await discardDraft("monthly", CTX);

    const read = db.dashboardLayout.findUnique.mock.calls[0][0];
    const write = db.dashboardLayout.update.mock.calls[0][0];
    expect(read.where).toEqual({ accountId_context: { accountId: "acc-1", context: "monthly" } });
    expect(write.where).toEqual({ accountId_context: { accountId: "acc-1", context: "monthly" } });
    expect(JSON.stringify([read.where, write.where])).not.toContain(OTHER_ACCOUNT);
  });
});

describe("upsertLayout — escrita direta no publicado (Sandbox)", () => {
  it("grava widgets e carimba publishedAt", async () => {
    await upsertLayout({ context: "monthly", widgets: PUBLISHED }, CTX);

    const args = db.dashboardLayout.upsert.mock.calls[0][0];
    expect(args.update).toMatchObject({ widgets: PUBLISHED });
    expect((args.update as { publishedAt: Date }).publishedAt).toBeInstanceOf(Date);
    expect(args.where).toEqual({ accountId_context: { accountId: "acc-1", context: "monthly" } });
  });
});
