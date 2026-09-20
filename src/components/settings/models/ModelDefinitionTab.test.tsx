import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import type { ModelDraft } from "./model-draft";
import { ModelDefinitionTab, type ModelDefinitionTabProps } from "./ModelDefinitionTab";

const d = m.settings.presentation.models.definition;

const TABLE_TYPES = [
  { id: "tt-card", name: "Cartão de crédito" },
  { id: "tt-checking", name: "Conta corrente" },
];

const SECTIONS = [
  { id: "sec-cards", name: "Cartões", isActive: true },
  { id: "sec-old", name: "Antiga", isActive: false },
];

function buildDraft(overrides: Partial<ModelDraft> = {}): ModelDraft {
  return {
    name: "Cartão Nubank",
    tableTypeId: "tt-card",
    autoApply: false,
    autoSectionId: "",
    orderInSection: null,
    ...overrides,
  };
}

function renderTab(overrides: Partial<ModelDefinitionTabProps> = {}) {
  const onChange = vi.fn();

  const view = render(
    <ModelDefinitionTab
      draft={buildDraft()}
      onChange={onChange}
      tableTypes={TABLE_TYPES}
      sections={SECTIONS}
      siblings={[]}
      {...overrides}
    />,
  );

  return { ...view, onChange };
}

describe("ModelDefinitionTab", () => {
  describe("campos gerais", () => {
    it("mostra nome e tipo de tabela com o hint do frame", () => {
      renderTab();

      expect(screen.getByLabelText(d.nameLabel)).toHaveValue("Cartão Nubank");
      expect(screen.getByText(d.tableTypeHint)).toBeInTheDocument();
    });

    it("não oferece campo de instituição (DIV-6/DIV-7 — nunca existiu no modelo)", () => {
      renderTab();

      expect(screen.queryByText(/institui/i)).not.toBeInTheDocument();
    });
  });

  describe("automação — revelar e esconder (critério de aceite §14/P6)", () => {
    it("com o toggle DESLIGADO, Seção e Ordem não existem na tela", () => {
      renderTab({ draft: buildDraft({ autoApply: false }) });

      expect(screen.queryByLabelText(d.sectionLabel)).not.toBeInTheDocument();
      expect(screen.queryByText(d.orderLabel)).not.toBeInTheDocument();
    });

    it("ligar o toggle pede autoApply: true ao dono do rascunho", async () => {
      const { onChange } = renderTab({ draft: buildDraft({ autoApply: false }) });

      await userEvent.click(screen.getByRole("checkbox", { name: d.autoApplyLabel }));

      expect(onChange).toHaveBeenCalledWith({ autoApply: true });
    });

    it("com o toggle LIGADO, a Seção aparece", () => {
      renderTab({ draft: buildDraft({ autoApply: true, autoSectionId: "sec-cards" }) });

      expect(screen.getByLabelText(d.sectionLabel)).toBeInTheDocument();
    });

    it("desligar esconde Seção e Ordem e MANTÉM o resto do formulário", async () => {
      const { rerender, onChange } = renderTab({
        draft: buildDraft({ autoApply: true, autoSectionId: "sec-cards" }),
        siblings: [{ id: "tpl-2", name: "Cartão Itaú", orderInSection: 0 }],
      });

      expect(screen.getByLabelText(d.sectionLabel)).toBeInTheDocument();
      expect(screen.getByText(d.orderLabel)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("checkbox", { name: d.autoApplyLabel }));
      expect(onChange).toHaveBeenCalledWith({ autoApply: false });

      // O dono do rascunho só apaga o toggle — seção e ordem seguem no rascunho.
      rerender(
        <ModelDefinitionTab
          draft={buildDraft({ autoApply: false, autoSectionId: "sec-cards" })}
          onChange={onChange}
          tableTypes={TABLE_TYPES}
          sections={SECTIONS}
          siblings={[{ id: "tpl-2", name: "Cartão Itaú", orderInSection: 0 }]}
        />,
      );

      expect(screen.queryByLabelText(d.sectionLabel)).not.toBeInTheDocument();
      expect(screen.queryByText(d.orderLabel)).not.toBeInTheDocument();
      // O resto do formulário continua exatamente como estava.
      expect(screen.getByLabelText(d.nameLabel)).toHaveValue("Cartão Nubank");
      expect(screen.getByLabelText(d.tableTypeLabel)).toHaveTextContent("Cartão de crédito");
    });
  });

  describe("seção de destino", () => {
    it("cobra a seção quando a automação está ligada sem escolha", () => {
      renderTab({ draft: buildDraft({ autoApply: true, autoSectionId: "" }) });

      expect(screen.getByText(d.sectionRequired)).toBeInTheDocument();
    });

    it("avisa que uma seção inativa não criará tabela", () => {
      renderTab({ draft: buildDraft({ autoApply: true, autoSectionId: "sec-old" }) });

      expect(screen.getByText(d.sectionInactive)).toBeInTheDocument();
    });

    it("seção ativa não dispara o aviso", () => {
      renderTab({ draft: buildDraft({ autoApply: true, autoSectionId: "sec-cards" }) });

      expect(screen.queryByText(d.sectionInactive)).not.toBeInTheDocument();
    });
  });

  describe("ordem dentro da seção", () => {
    it("só aparece quando há OUTRO modelo automático na mesma seção", () => {
      renderTab({ draft: buildDraft({ autoApply: true, autoSectionId: "sec-cards" }) });

      expect(screen.queryByText(d.orderLabel)).not.toBeInTheDocument();
    });

    it("mostra a posição e o motivo de existir", () => {
      renderTab({
        draft: buildDraft({ autoApply: true, autoSectionId: "sec-cards", orderInSection: 0 }),
        siblings: [{ id: "tpl-2", name: "Cartão Itaú", orderInSection: 1 }],
      });

      expect(screen.getByText(d.orderPosition(1, 2))).toBeInTheDocument();
      expect(screen.getByText(d.orderHint("Cartões"))).toBeInTheDocument();
    });

    it("descer move para a próxima posição da fila", async () => {
      const { onChange } = renderTab({
        draft: buildDraft({ autoApply: true, autoSectionId: "sec-cards", orderInSection: 0 }),
        siblings: [{ id: "tpl-2", name: "Cartão Itaú", orderInSection: 1 }],
      });

      await userEvent.click(screen.getByRole("button", { name: d.orderDown }));

      expect(onChange).toHaveBeenCalledWith({ orderInSection: 1 });
    });

    it("não deixa subir quem já é o primeiro", () => {
      renderTab({
        draft: buildDraft({ autoApply: true, autoSectionId: "sec-cards", orderInSection: 0 }),
        siblings: [{ id: "tpl-2", name: "Cartão Itaú", orderInSection: 1 }],
      });

      expect(screen.getByRole("button", { name: d.orderUp })).toBeDisabled();
    });
  });
});
