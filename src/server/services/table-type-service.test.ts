import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { TEST_CTX } from "@/../tests/fixtures/account";
import { NotFoundError } from "@/server/api/errors";

import { createTableType, updateTableType } from "./table-type-service";

describe("createTableType", () => {
  it("grava rowLayout do input", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue(null as any);
    prismaMock.tableType.create.mockResolvedValue({ id: "tt-new" } as any);

    await createTableType(
      { name: "Cartão", hiddenColumns: {}, rowLayout: "rich" },
      TEST_CTX,
    );

    expect(prismaMock.tableType.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accountId: "acc-test-1", rowLayout: "rich" }),
      }),
    );
  });

  it("default 'columns' quando rowLayout é omitido", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue(null as any);
    prismaMock.tableType.create.mockResolvedValue({ id: "tt-new" } as any);

    await createTableType({ name: "Simples", hiddenColumns: {} }, TEST_CTX);

    expect(prismaMock.tableType.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rowLayout: "columns" }),
      }),
    );
  });
});

describe("updateTableType — rowLayout", () => {
  it("multi-tenancy: tipo de outra account → NotFoundError, sem update", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue({
      accountId: "acc-outra",
      isDefault: false,
    } as any);

    await expect(
      updateTableType({ tableTypeId: "tt-alheio", rowLayout: "rich" }, TEST_CTX),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(prismaMock.tableType.update).not.toHaveBeenCalled();
  });

  it("persiste rowLayout para tipo da mesma account (não-default)", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      isDefault: false,
    } as any);
    prismaMock.tableType.update.mockResolvedValue({} as any);

    await updateTableType({ tableTypeId: "tt-1", rowLayout: "rich" }, TEST_CTX);

    expect(prismaMock.tableType.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tt-1" },
        data: expect.objectContaining({ rowLayout: "rich" }),
      }),
    );
  });

  it("tipo padrão (isDefault) ignora rowLayout — mesmo gate do hiddenColumns", async () => {
    prismaMock.tableType.findUnique.mockResolvedValue({
      accountId: "acc-test-1",
      isDefault: true,
    } as any);
    prismaMock.tableType.update.mockResolvedValue({} as any);

    await updateTableType({ tableTypeId: "tt-default", rowLayout: "rich" }, TEST_CTX);

    const call = prismaMock.tableType.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty("rowLayout");
  });
});
