import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AttachmentIndicator } from "./AttachmentIndicator";

describe("AttachmentIndicator", () => {
  it("mostra a contagem e aria-label", () => {
    render(<AttachmentIndicator count={3} onClick={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Ver anexos (3)" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("3");
  });
  it("dispara onClick", async () => {
    const onClick = vi.fn();
    render(<AttachmentIndicator count={2} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver anexos (2)" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("reflete o estado da gaveta em aria-expanded", () => {
    const { rerender } = render(
      <AttachmentIndicator count={1} onClick={vi.fn()} expanded={true} />,
    );
    expect(screen.getByRole("button", { name: "Ver anexos (1)" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    rerender(<AttachmentIndicator count={1} onClick={vi.fn()} expanded={false} />);
    expect(screen.getByRole("button", { name: "Ver anexos (1)" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
