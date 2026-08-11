import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { InstitutionDetails } from "@/lib/institution-details";
import { m } from "@/lib/messages";

import { InstitutionDetailsFields } from "./InstitutionDetailsFields";

const t = m.settings.structure.institutions;

const EMPTY: InstitutionDetails = {
  last4: null,
  closingDay: null,
  dueDay: null,
  branch: null,
  accountNo: null,
  taxId: null,
};

// Spec 68 §8 — "a célula Detalhes renderizando o conjunto certo por tipo (cinco
// tipos + null)".
describe("InstitutionDetailsFields — leitura", () => {
  it("kind null: mostra '—'", () => {
    render(<InstitutionDetailsFields mode="read" kind={null} values={EMPTY} />);
    expect(screen.getByText(t.detailsEmpty)).toBeInTheDocument();
  });

  it("card: final + fechamento/vencimento, em uma linha só", () => {
    render(
      <InstitutionDetailsFields
        mode="read"
        kind="card"
        values={{ ...EMPTY, last4: "4471", closingDay: 8, dueDay: 15 }}
      />,
    );
    expect(screen.getByText(t.cardDetails("4471", 8, 15))).toBeInTheDocument();
  });

  it("card sem nenhum valor preenchido: cai no '—' (não mostra separador solto)", () => {
    render(<InstitutionDetailsFields mode="read" kind="card" values={EMPTY} />);
    expect(screen.getByText(t.detailsEmpty)).toBeInTheDocument();
  });

  it("bank: agência + conta", () => {
    render(
      <InstitutionDetailsFields
        mode="read"
        kind="bank"
        values={{ ...EMPTY, branch: "0192", accountNo: "34567-8" }}
      />,
    );
    expect(screen.getByText(t.bankDetails("0192", "34567-8"))).toBeInTheDocument();
  });

  it("company: CNPJ", () => {
    render(
      <InstitutionDetailsFields
        mode="read"
        kind="company"
        values={{ ...EMPTY, taxId: "12.345.678/0001-90" }}
      />,
    );
    expect(screen.getByText(t.companyDetails("12.345.678/0001-90"))).toBeInTheDocument();
  });

  it("company sem CNPJ: cai no '—'", () => {
    render(<InstitutionDetailsFields mode="read" kind="company" values={EMPTY} />);
    expect(screen.getByText(t.detailsEmpty)).toBeInTheDocument();
  });

  it("wallet: texto explicativo esmaecido, não célula vazia", () => {
    render(<InstitutionDetailsFields mode="read" kind="wallet" values={EMPTY} />);
    expect(screen.getByText(t.noDetailsFor(t.kindLabels.wallet))).toBeInTheDocument();
  });

  it("broker: texto explicativo esmaecido, não célula vazia", () => {
    render(<InstitutionDetailsFields mode="read" kind="broker" values={EMPTY} />);
    expect(screen.getByText(t.noDetailsFor(t.kindLabels.broker))).toBeInTheDocument();
  });
});

describe("InstitutionDetailsFields — edição", () => {
  it("kind null: hint para classificar, nenhum campo", () => {
    render(<InstitutionDetailsFields mode="edit" kind={null} values={EMPTY} onChange={vi.fn()} />);
    expect(screen.getByText(t.kindUnsetHint)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("card: renderiza os três campos de cartão, e só eles", () => {
    render(<InstitutionDetailsFields mode="edit" kind="card" values={EMPTY} onChange={vi.fn()} />);
    expect(screen.getByLabelText(t.fields.last4)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.closingDay)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.dueDay)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.branch)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.taxId)).not.toBeInTheDocument();
  });

  it("bank: renderiza agência e conta, e só eles", () => {
    render(<InstitutionDetailsFields mode="edit" kind="bank" values={EMPTY} onChange={vi.fn()} />);
    expect(screen.getByLabelText(t.fields.branch)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.accountNo)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.last4)).not.toBeInTheDocument();
  });

  it("company: renderiza só o CNPJ", () => {
    render(
      <InstitutionDetailsFields mode="edit" kind="company" values={EMPTY} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText(t.fields.taxId)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.fields.branch)).not.toBeInTheDocument();
  });

  it("wallet e broker: nenhum campo, só o texto explicativo", () => {
    const { unmount } = render(
      <InstitutionDetailsFields mode="edit" kind="wallet" values={EMPTY} onChange={vi.fn()} />,
    );
    expect(screen.getByText(t.noDetailsFor(t.kindLabels.wallet))).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    unmount();

    render(
      <InstitutionDetailsFields mode="edit" kind="broker" values={EMPTY} onChange={vi.fn()} />,
    );
    expect(screen.getByText(t.noDetailsFor(t.kindLabels.broker))).toBeInTheDocument();
  });
});
