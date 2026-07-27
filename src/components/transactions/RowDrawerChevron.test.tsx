import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RowDrawerChevron } from "./RowDrawerChevron";

describe("RowDrawerChevron", () => {
  it("fechado: aria-expanded=false e aria-label de expandir", () => {
    render(<RowDrawerChevron open={false} onClick={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Ver detalhes da linha" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("aberto: aria-expanded=true e aria-label de ocultar", () => {
    render(<RowDrawerChevron open={true} onClick={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Ocultar detalhes da linha" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("dispara onClick", async () => {
    const onClick = vi.fn();
    render(<RowDrawerChevron open={false} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver detalhes da linha" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("aria-label alterna conforme o estado (rerender)", () => {
    const { rerender } = render(<RowDrawerChevron open={false} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Ver detalhes da linha" })).toBeInTheDocument();

    rerender(<RowDrawerChevron open={true} onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Ocultar detalhes da linha" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver detalhes da linha" })).not.toBeInTheDocument();
  });
});
