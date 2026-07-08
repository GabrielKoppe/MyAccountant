import { describe, expect, it, vi } from "vitest";

import { buildRowMenuItems } from "./row-menu-items";

const handlers = {
  onEdit: vi.fn(),
  onOpenNote: vi.fn(),
  onDuplicate: vi.fn(),
  onMove: vi.fn(),
  onViewDetails: vi.fn(),
  onManageLinks: vi.fn(),
  onCreateAlias: vi.fn(),
  onDelete: vi.fn(),
};

describe("buildRowMenuItems", () => {
  it("editor: itens na ordem correta, grupo Nota/leitura com divisor, Excluir por último com divisor e danger", () => {
    const items = buildRowMenuItems({ isReadOnly: false, ...handlers });
    expect(items.map((i) => i.label)).toEqual([
      "Editar",
      "Duplicar",
      "Mover para…",
      "Nota",
      "Ver detalhes",
      "Gerenciar vínculos",
      "Criar apelido a partir desta transação",
      "Deletar",
    ]);
    const note = items.find((i) => i.label === "Nota")!;
    expect(note.dividerBefore).toBe(true);
    const del = items.at(-1)!;
    expect(del.danger).toBe(true);
    expect(del.dividerBefore).toBe(true);
  });

  it("viewer: só ações de leitura, sem mutação, sem Nota", () => {
    const items = buildRowMenuItems({ isReadOnly: true, ...handlers });
    expect(items.map((i) => i.label)).toEqual(["Ver detalhes", "Gerenciar vínculos"]);
  });

  it("cada item dispara seu handler", () => {
    const items = buildRowMenuItems({ isReadOnly: false, ...handlers });
    items.find((i) => i.label === "Duplicar")!.onClick();
    expect(handlers.onDuplicate).toHaveBeenCalledTimes(1);
    items.find((i) => i.label === "Nota")!.onClick();
    expect(handlers.onOpenNote).toHaveBeenCalledTimes(1);
  });
});
