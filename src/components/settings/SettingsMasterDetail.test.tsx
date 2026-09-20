import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import { SettingsMasterDetail, type SettingsMasterDetailProps } from "./SettingsMasterDetail";

const ITEMS = [
  { id: "credit", name: "Cartão de crédito", summary: "8 col · pílulas · 2 modelos" },
  { id: "checking", name: "Conta corrente", summary: "6 col · colunas · 3 modelos" },
  { id: "refunds", name: "Reembolsos", summary: "6 col · sem modelo", dimmed: true },
];

function renderMasterDetail(overrides: Partial<SettingsMasterDetailProps> = {}) {
  const onSelect = vi.fn();

  render(
    <SettingsMasterDetail
      items={ITEMS}
      selectedId="credit"
      onSelect={onSelect}
      emptyLabel={m.settings.presentation.masterEmpty}
      ariaLabel={m.settings.presentation.masterListLabel}
      {...overrides}
    >
      <p>painel de detalhe</p>
    </SettingsMasterDetail>,
  );

  return { onSelect };
}

describe("SettingsMasterDetail", () => {
  describe("lista mestre", () => {
    it("renderiza nome e resumo de cada item, e o detalhe ao lado", () => {
      renderMasterDetail();

      expect(screen.getByText("Cartão de crédito")).toBeInTheDocument();
      expect(screen.getByText("8 col · pílulas · 2 modelos")).toBeInTheDocument();
      expect(screen.getByText("Reembolsos")).toBeInTheDocument();
      expect(screen.getByText("painel de detalhe")).toBeInTheDocument();
    });

    /**
     * O selo é opcional de propósito: Modelos (e as Specs 70–72) usam a MESMA
     * primitiva sem passar `badge`, e nada nesses itens pode mudar por isso.
     */
    it("mostra o selo do item na linha do nome, sem tocar no resumo", () => {
      renderMasterDetail({
        items: [{ id: "credit", name: "Cartão de crédito", summary: "8 col", badge: "Padrão" }],
      });

      const item = screen.getByRole("button", { name: /Cartão de crédito/ });
      expect(within(item).getByText("Padrão")).toBeInTheDocument();
      expect(within(item).getByText("8 col")).toBeInTheDocument();
    });

    it("item sem selo não renderiza selo nenhum", () => {
      renderMasterDetail();

      expect(screen.queryByText("Padrão")).not.toBeInTheDocument();
    });

    it("nomeia a lista para leitor de tela", () => {
      renderMasterDetail();

      expect(
        screen.getByRole("navigation", { name: m.settings.presentation.masterListLabel }),
      ).toBeInTheDocument();
    });
  });

  describe("seleção", () => {
    it("marca o item selecionado com aria-current", () => {
      renderMasterDetail();

      const selected = screen.getByRole("button", { name: /Cartão de crédito/ });
      expect(selected).toHaveAttribute("aria-current", "true");

      const other = screen.getByRole("button", { name: /Conta corrente/ });
      expect(other).not.toHaveAttribute("aria-current");
    });

    it("clicar num item chama onSelect com o id — e não com o índice", async () => {
      const { onSelect } = renderMasterDetail();

      await userEvent.click(screen.getByRole("button", { name: /Conta corrente/ }));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith("checking");
    });

    it("item esmaecido continua selecionável", async () => {
      const { onSelect } = renderMasterDetail();

      await userEvent.click(screen.getByRole("button", { name: /Reembolsos/ }));

      expect(onSelect).toHaveBeenCalledWith("refunds");
    });

    it("sem seleção, nenhum item é o atual", () => {
      renderMasterDetail({ selectedId: null });

      expect(screen.getByRole("button", { name: /Cartão de crédito/ })).not.toHaveAttribute(
        "aria-current",
      );
    });
  });

  describe("rodapé da coluna de detalhe", () => {
    it("sem `footer`, nada é renderizado no lugar", () => {
      renderMasterDetail();

      expect(screen.queryByTestId("save-bar")).not.toBeInTheDocument();
    });

    /**
     * A geometria do bug: o rodapé do `SettingsPageShell` é irmão da área de conteúdo
     * e corria por baixo da coluna da lista. Aqui ele tem de ser DESCENDENTE da coluna
     * de detalhe — é o que o mantém ao lado da lista, e não sobre ela.
     */
    it("com `footer`, o rodapé fica DENTRO da coluna de detalhe, não ao lado da lista", () => {
      renderMasterDetail({ footer: <div data-testid="save-bar">Salvar tipo</div> });

      const footer = screen.getByTestId("save-bar");
      const detail = screen.getByText("painel de detalhe").parentElement!.parentElement!;
      const master = screen.getByRole("navigation", {
        name: m.settings.presentation.masterListLabel,
      });

      expect(detail).toContainElement(footer);
      // Irmão da lista mestre seria a largura do painel inteiro — exatamente o que
      // atravessava a lista.
      expect(master.parentElement).not.toBe(footer.parentElement);
      expect(master).not.toContainElement(footer);
    });
  });

  describe("estado vazio", () => {
    it("substitui a divisão inteira pelo SettingsEmptyState", () => {
      renderMasterDetail({ items: [], emptyLabel: "Nenhum tipo de tabela" });

      expect(screen.getByText("Nenhum tipo de tabela")).toBeInTheDocument();
      // Sem itens não há lista mestre nem detalhe — a tela toda é o estado vazio.
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
      expect(screen.queryByText("painel de detalhe")).not.toBeInTheDocument();
    });

    it("renderiza descrição e ação quando fornecidas", () => {
      renderMasterDetail({
        items: [],
        emptyLabel: "Nenhum tipo de tabela",
        emptyDescription: "Definem colunas visíveis e densidade.",
        emptyAction: <button type="button">Novo tipo</button>,
      });

      expect(screen.getByText("Definem colunas visíveis e densidade.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Novo tipo" })).toBeInTheDocument();
    });
  });
});
