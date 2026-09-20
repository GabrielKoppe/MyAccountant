import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import { ModelUsedByTab, PROVENANCE_CUTOFF_LABEL } from "./ModelUsedByTab";

// A contagem sob demanda de `Transaction` não tem caminho a partir de um modelo
// (`tableTemplate` está fora de `COUNTABLE_USAGE_ENTITIES`). O mock existe para
// PROVAR que esta aba não a dispara — nem na montagem, nem depois.
const countUsageAction = vi.fn();
vi.mock("@/actions/settings-usage", () => ({
  countUsageAction: (...args: unknown[]) => countUsageAction(...args),
}));

const u = m.settings.presentation.models.usedBy;

describe("ModelUsedByTab", () => {
  it("não dispara contagem de transações ao montar", () => {
    render(
      <ModelUsedByTab usage={{ tables: 3, months: 2 }} cutoffDate={PROVENANCE_CUTOFF_LABEL} />,
    );

    expect(countUsageAction).not.toHaveBeenCalled();
  });

  it("mostra tabelas e meses criados a partir do modelo", () => {
    render(<ModelUsedByTab usage={{ tables: 24, months: 12 }} cutoffDate="11/08/2026" />);

    expect(screen.getByText(u.title)).toBeInTheDocument();
    expect(screen.getByText(u.result(24, 12))).toBeInTheDocument();
  });

  it("sem proveniência, diz que nada nasceu do modelo — não mostra zero solto", () => {
    render(<ModelUsedByTab usage={{ tables: 0, months: 0 }} cutoffDate="11/08/2026" />);

    expect(screen.getByText(u.empty)).toBeInTheDocument();
    expect(screen.queryByText(u.result(0, 0))).not.toBeInTheDocument();
  });

  it("declara a data de corte sempre — com ou sem resultado (D6)", () => {
    const { rerender } = render(
      <ModelUsedByTab usage={{ tables: 5, months: 3 }} cutoffDate="11/08/2026" />,
    );
    expect(screen.getByText(u.cutoffNote("11/08/2026"))).toBeInTheDocument();

    rerender(<ModelUsedByTab usage={{ tables: 0, months: 0 }} cutoffDate="11/08/2026" />);
    expect(screen.getByText(u.cutoffNote("11/08/2026"))).toBeInTheDocument();
  });

  it("a data de corte é fixa — não depende do relógio da máquina", () => {
    expect(PROVENANCE_CUTOFF_LABEL).toBe("11/08/2026");
  });
});
