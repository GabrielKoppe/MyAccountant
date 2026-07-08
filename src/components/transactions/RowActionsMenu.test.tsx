import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RowActionsMenu } from "./RowActionsMenu";
import type { RowMenuItem } from "./types";

function sample(onDelete = vi.fn()): RowMenuItem[] {
  return [
    { label: "Editar", icon: <EditIcon />, onClick: vi.fn() },
    { label: "Deletar", icon: <DeleteIcon />, onClick: onDelete, danger: true, dividerBefore: true },
  ];
}

describe("RowActionsMenu", () => {
  it("renderiza os itens em ordem quando aberto", () => {
    render(<RowActionsMenu anchorEl={document.body} items={sample()} onClose={vi.fn()} />);
    const names = screen.getAllByRole("menuitem").map((el) => el.textContent);
    expect(names).toEqual(["Editar", "Deletar"]);
  });

  it("renderiza um divisor antes do item com dividerBefore", () => {
    render(<RowActionsMenu anchorEl={document.body} items={sample()} onClose={vi.fn()} />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("clicar num item dispara onClick e onClose", async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(<RowActionsMenu anchorEl={document.body} items={sample(onDelete)} onClose={onClose} />);
    await userEvent.click(screen.getByRole("menuitem", { name: "Deletar" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("não renderiza nada quando anchorEl é null", () => {
    render(<RowActionsMenu anchorEl={null} items={sample()} onClose={vi.fn()} />);
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });
});
