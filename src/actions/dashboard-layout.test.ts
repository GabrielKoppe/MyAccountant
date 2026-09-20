import { beforeEach, describe, expect, it, vi } from "vitest";

import "../../tests/mocks/auth";
import { TEST_CTX } from "../../tests/fixtures/account";
import type { StoredWidget } from "@/lib/schemas/dashboard-layout";
import { GRID_CONFIG } from "@/components/dashboards/_core/widget-registry";

// Mock next/cache e prisma para não falhar em ambiente de testes
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/server/prisma", async () => {
  const { mockDeep } = await import("vitest-mock-extended");
  const mock = mockDeep();
  return { prisma: mock };
});

// Mock do service de layout para isolar a action dos detalhes de Prisma
vi.mock("@/server/services/dashboard-layout-service");

import * as layoutService from "@/server/services/dashboard-layout-service";

// Import direto após os mocks
import { addAnalysisToDashboardAction } from "./dashboard-layout";

// Reexporta o mock com tipagem para uso nos testes
const serviceMock = vi.mocked(layoutService);

/** Layout do editor sem rascunho pendente (o caso comum). */
function editorLayout(widgets: StoredWidget[] = [], hasDraft = false) {
  return { widgets, published: widgets, hasDraft };
}

const VALID_SANDBOX_CONFIG = {
  periodType: "current_month" as const,
  groupBy: "category" as const,
  seriesBy: "none" as const,
  metric: "total" as const,
  chartType: "bar_grouped" as const,
};

describe("addAnalysisToDashboardAction", () => {
  // Só as CHAMADAS (não as implementações): cada caso afirma sobre o que a sua
  // própria execução chamou.
  beforeEach(() => vi.clearAllMocks());

  it("cria instância analysis com config e posição livre quando layout está vazio", async () => {
    // Layout do editor vazio (sem widgets e sem rascunho pendente)
    serviceMock.getEditorLayout.mockResolvedValue(editorLayout());
    serviceMock.upsertLayout.mockResolvedValue(undefined);

    const result = await addAnalysisToDashboardAction(TEST_CTX.accountId, {
      context: "monthly",
      config: VALID_SANDBOX_CONFIG,
    });

    expect(result.ok).toBe(true);
    expect(serviceMock.upsertLayout).toHaveBeenCalledOnce();
    const call = serviceMock.upsertLayout.mock.calls[0];
    const widgets = call[0].widgets;
    const analysisInstance = widgets[widgets.length - 1];
    expect(analysisInstance.widgetId).toBe("analysis");
    expect(analysisInstance.config).toMatchObject({ periodType: "current_month" });
    expect(analysisInstance.visible).toBe(true);
    expect(analysisInstance.instanceId).toBeTruthy();
  });

  it("usa ctx.accountId, nunca input.accountId — multi-tenancy", async () => {
    serviceMock.getEditorLayout.mockResolvedValue(editorLayout());
    serviceMock.upsertLayout.mockResolvedValue(undefined);

    await addAnalysisToDashboardAction(TEST_CTX.accountId, {
      context: "monthly",
      config: VALID_SANDBOX_CONFIG,
    });

    // Verificar que a leitura foi feita com o accountId correto
    expect(serviceMock.getEditorLayout).toHaveBeenCalledWith(TEST_CTX.accountId, "monthly");
    // Verificar que upsertLayout foi chamado com ctx que tem accountId correto
    expect(serviceMock.upsertLayout).toHaveBeenCalledWith(
      expect.objectContaining({ context: "monthly" }),
      expect.objectContaining({ accountId: TEST_CTX.accountId }),
    );
  });

  it("posiciona o widget dentro dos limites de cols e maxRows", async () => {
    serviceMock.getEditorLayout.mockResolvedValue(editorLayout());
    serviceMock.upsertLayout.mockResolvedValue(undefined);

    const result = await addAnalysisToDashboardAction(TEST_CTX.accountId, {
      context: "monthly",
      config: VALID_SANDBOX_CONFIG,
    });

    expect(result.ok).toBe(true);
    const call = serviceMock.upsertLayout.mock.calls[0];
    const widgets = call[0].widgets;
    const added = widgets[widgets.length - 1];
    const { cols, maxRows } = GRID_CONFIG["monthly"];
    expect(added.x + added.w).toBeLessThanOrEqual(cols);
    expect(added.y + added.h).toBeLessThanOrEqual(maxRows);
  });

  it("retorna erro quando a grade está cheia (maxRows atingido)", async () => {
    const { cols, maxRows } = GRID_CONFIG["monthly"];
    // Preenche toda a grade com widgets 1×1
    const fullLayout: StoredWidget[] = [];
    for (let y = 0; y < maxRows; y++) {
      for (let x = 0; x < cols; x++) {
        fullLayout.push({
          instanceId: `inst-${y}-${x}`,
          widgetId: "kpi-income",
          visible: true,
          x,
          y,
          w: 1,
          h: 1,
          sizeVariantId: "default",
        });
      }
    }
    serviceMock.getEditorLayout.mockResolvedValue(editorLayout(fullLayout));

    const result = await addAnalysisToDashboardAction(TEST_CTX.accountId, {
      context: "monthly",
      config: VALID_SANDBOX_CONFIG,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
    }
  });

  it("com rascunho pendente, o gráfico entra no RASCUNHO (não publica sozinho)", async () => {
    // Spec 69 §2.3: publicar aqui faria o usuário perder este widget ao publicar
    // o rascunho dele — e mexer no publicado sem ele pedir quebra o contrato.
    serviceMock.getEditorLayout.mockResolvedValue(editorLayout([], true));
    serviceMock.saveDraft.mockResolvedValue(undefined);

    const result = await addAnalysisToDashboardAction(TEST_CTX.accountId, {
      context: "monthly",
      config: VALID_SANDBOX_CONFIG,
    });

    expect(result.ok).toBe(true);
    expect(serviceMock.saveDraft).toHaveBeenCalledOnce();
    expect(serviceMock.upsertLayout).not.toHaveBeenCalled();
  });

  it("rejeita config inválida (schema Zod)", async () => {
    const result = await addAnalysisToDashboardAction(TEST_CTX.accountId, {
      context: "monthly",
      // config inválida: falta periodType
      config: { groupBy: "category" } as never,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
    }
  });
});
