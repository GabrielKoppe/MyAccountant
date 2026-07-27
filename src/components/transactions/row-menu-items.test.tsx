import { describe, expect, it, vi } from "vitest";

import { buildRowMenuItems } from "./row-menu-items";

const handlers = {
  onEdit: vi.fn(),
  onDuplicate: vi.fn(),
  onMove: vi.fn(),
  onViewDetails: vi.fn(),
  onCreateAlias: vi.fn(),
  onDelete: vi.fn(),
};

describe("buildRowMenuItems", () => {
  it("editor: itens na ordem correta, Excluir por último com divisor e danger", () => {
    const items = buildRowMenuItems({ isReadOnly: false, ...handlers });
    expect(items.map((i) => i.label)).toEqual([
      "Editar",
      "Duplicar",
      "Mover para…",
      "Ver detalhes",
      "Criar apelido",
      "Deletar",
    ]);
    const del = items.at(-1)!;
    expect(del.danger).toBe(true);
    expect(del.dividerBefore).toBe(true);
  });

  it("viewer: só Ver detalhes (leitura simples)", () => {
    const items = buildRowMenuItems({ isReadOnly: true, ...handlers });
    expect(items.map((i) => i.label)).toEqual(["Ver detalhes"]);
  });

  it("cada item dispara seu handler", () => {
    const items = buildRowMenuItems({ isReadOnly: false, ...handlers });
    items.find((i) => i.label === "Duplicar")!.onClick();
    expect(handlers.onDuplicate).toHaveBeenCalledTimes(1);
    items.find((i) => i.label === "Deletar")!.onClick();
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });
});
