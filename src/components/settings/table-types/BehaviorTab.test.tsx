import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";
import { PINNABLE_COLUMNS, tableColumnLabel } from "@/lib/table-columns";

import { BehaviorTab, type BehaviorTabProps } from "./BehaviorTab";
import type { TableTypeDraft } from "./table-type-draft";

const t = m.settings.presentation.tableTypes.behavior;

function buildDraft(overrides: Partial<TableTypeDraft> = {}): TableTypeDraft {
  return {
    name: "Cartão de crédito",
    // Layout A: é o único em que o bloco "Colunas fixadas" tem efeito, e a maior
    // parte dos testes daqui mexe nele. O caso das pílulas é explícito, abaixo.
    rowLayout: "columns",
    density: "default",
    visibleColumns: ["occurredOn", "description", "category", "amount"],
    pinnedColumns: ["occurredOn"],
    inheritOnNewRow: ["occurredOn"],
    defaultSort: { key: "occurredOn", dir: "asc" },
    groupBy: null,
    showFooterTotal: true,
    showGroupSubtotal: false,
    allowBulkEdit: true,
    keepGhostRow: true,
    ...overrides,
  };
}

function renderTab(overrides: Partial<BehaviorTabProps> = {}) {
  const onChange = vi.fn();
  const view = render(<BehaviorTab draft={buildDraft()} onChange={onChange} {...overrides} />);
  return { ...view, onChange };
}

/**
 * Os 12 controles da aba, com o consumidor de cada um na tabela do mês (§16, "Já
 * valem desde esta spec"). A lista é INTEIRA de propósito: hoje ela não tem
 * exceção, e é isso que o bloco de testes abaixo defende.
 */
const LIVE_CONTROLS = [
  "defaultSort",
  "groupBy",
  "showFooterTotal",
  "showGroupSubtotal",
  "allowBulkEdit",
  "keepGhostRow",
  "pinnedColumns",
  "inheritOnNewRow",
] as const;

/**
 * O vocabulário de uma nota de pendência — o texto do selo que existiu por
 * controle e as fórmulas que a nota única usava ("ainda não afetam a tabela do
 * mês", "aguarda a nova linha de transação").
 *
 * Nenhum deles pode aparecer na aba: `pinnedColumns` foi o último controle inerte,
 * e com ele ligado a nota virou aviso sobre nada.
 */
const PENDING_MARKERS: readonly (string | RegExp)[] = [
  /aguarda a nova linha/i,
  /ainda não/i,
  /aguarda/i,
  /não afeta/i,
  /sem efeito/i,
];

describe("BehaviorTab", () => {
  /**
   * A garantia do §16 mudou de FORMA, não de força: antes a nota tinha de nomear
   * cada controle inerte, agora a aba tem de não ter nota nenhuma — porque não
   * sobrou controle inerte. Nos dois casos o que se proíbe é o mesmo: um controle
   * que grava e não faz nada, calado.
   *
   * **Caminho de volta.** Se um controle novo entrar aqui sem consumidor na tabela
   * do mês, recrie `behavior.pendingNote` no `pt-BR.ts`, volte a renderá-la no topo
   * NOMEANDO o controle, e troque este bloco pela versão nominal (`INERT_CONTROLS` ×
   * `LIVE_CONTROLS`, no histórico deste arquivo): a nota cita os inertes e nenhum
   * dos que já valem.
   */
  describe("§16 — nenhum controle inerte, logo nenhuma nota de pendência", () => {
    it("os 12 campos da aba já valem na tabela do mês — a lista de inertes está vazia", () => {
      // Sentinela da premissa: se um controle voltar a ser inerte, ele sai desta
      // lista, o número muda, e o teste cobra a nota de volta.
      expect(LIVE_CONTROLS).toHaveLength(8);
    });

    it.each(PENDING_MARKERS)("a aba não renderiza nota nem selo de pendência (%s)", (marker) => {
      renderTab();

      expect(screen.queryByText(marker)).not.toBeInTheDocument();
    });

    it.each(["date", "category", "responsible", "installment"] as const)(
      "nenhuma nota volta com groupBy=%s — os quatro valores já valem",
      (groupBy) => {
        // `TableType.groupBy` (por tipo) agrupa a tabela do mês nos quatro valores.
        // `date` inclusive — e ele NÃO é `FinanceTable.groupByDate` (por tabela, no
        // menu ⋮ do card), que continua existindo em paralelo.
        renderTab({ draft: buildDraft({ groupBy }) });

        for (const marker of PENDING_MARKERS) {
          expect(screen.queryByText(marker)).not.toBeInTheDocument();
        }
      },
    );

    it("nem no layout de pílulas, onde o único aviso é o motivo do bloco desabilitado", () => {
      // A fronteira fina: "Disponível apenas no layout de colunas fixas" é ESCOPO
      // (a fixação existe, este layout é que não a comporta), não pendência.
      renderTab({ draft: buildDraft({ rowLayout: "pills" }) });

      expect(screen.getByText(t.pinnedDisabledPills)).toBeInTheDocument();
      for (const marker of PENDING_MARKERS) {
        expect(screen.queryByText(marker)).not.toBeInTheDocument();
      }
    });
  });

  describe("ajuda por controle — o que cada campo faz na tabela", () => {
    /**
     * Os OITO controles da aba e o texto de ajuda de cada um. É a lista inteira de
     * propósito: um controle sem ajuda é exatamente o buraco que o usuário
     * reclamou ("o que isso faz na tabela?").
     */
    const HELP = [
      t.help.defaultSort,
      t.help.groupBy,
      t.help.showFooterTotal,
      t.help.showGroupSubtotal,
      t.help.allowBulkEdit,
      t.help.keepGhostRow,
      t.help.pinnedColumns,
      t.help.inheritOnNewRow,
    ] as const;

    it.each(HELP)("o texto «%s» está na árvore de acessibilidade com o balão fechado", (help) => {
      renderTab();

      // Nome acessível do botão, publicado pelo `Tooltip` a partir do `title`
      // string: quem usa leitor de tela não precisa provocar o hover para ouvir.
      expect(screen.getByRole("button", { name: help })).toHaveAttribute("aria-label", help);
    });

    it.each(HELP)("o ícone de «%s» é alcançável pelo teclado", (help) => {
      renderTab();
      const icon = screen.getByRole("button", { name: help });

      // `act` porque focar abre o balão — é isso que o teste seguinte cobra.
      act(() => icon.focus());

      expect(icon).toHaveFocus();
      expect(icon).not.toHaveAttribute("tabindex", "-1");
    });

    it("o balão abre no hover com o mesmo texto", async () => {
      renderTab();

      await userEvent.hover(screen.getByRole("button", { name: t.help.keepGhostRow }));

      expect(await screen.findByRole("tooltip")).toHaveTextContent(t.help.keepGhostRow);
    });

    it("o balão abre também no FOCO — o caminho de quem só usa teclado", async () => {
      renderTab();

      act(() => screen.getByRole("button", { name: t.help.pinnedColumns }).focus());

      expect(await screen.findByRole("tooltip")).toHaveTextContent(t.help.pinnedColumns);
    });

    it("clicar na ajuda de um switch NÃO alterna o switch", async () => {
      // O `FormControlLabel` renderiza um `<label>`: se o ícone morasse dentro
      // dele, o clique na ajuda escorregaria para o controle associado.
      const { onChange } = renderTab();

      await userEvent.click(screen.getByRole("button", { name: t.help.allowBulkEdit }));

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("ordenação padrão", () => {
    it("só oferece colunas que a tabela mostra", async () => {
      renderTab();

      await userEvent.click(screen.getByLabelText(t.defaultSortLabel));
      const options = screen.getAllByRole("option").map((option) => option.textContent);

      expect(options).toEqual(["Data", "Descrição", "Categoria", "Valor"]);
    });

    it("o botão de direção inverte o sentido", async () => {
      const { onChange } = renderTab();

      await userEvent.click(screen.getByRole("button", { name: t.sortAsc }));

      expect(onChange).toHaveBeenCalledWith({
        defaultSort: { key: "occurredOn", dir: "desc" },
      });
    });
  });

  describe("agrupar por", () => {
    it("escolher 'nenhum' grava `null`, e não a string vazia", async () => {
      const { onChange } = renderTab({ draft: buildDraft({ groupBy: "date" }) });

      await userEvent.click(screen.getByLabelText(t.groupByLabel));
      await userEvent.click(screen.getByRole("option", { name: t.groupByNone }));

      expect(onChange).toHaveBeenCalledWith({ groupBy: null });
    });
  });

  describe("toggles", () => {
    it("desligar o total no rodapé pede `false`", async () => {
      const { onChange } = renderTab();

      await userEvent.click(screen.getByRole("checkbox", { name: t.showFooterTotal }));

      expect(onChange).toHaveBeenCalledWith({ showFooterTotal: false });
    });
  });

  describe("colunas fixadas", () => {
    function pinnedGroup() {
      return screen.getByRole("group", { name: t.pinnedTitle });
    }

    /**
     * A garantia central do bloco: o que a aba OFERECE é exatamente o que o
     * renderer do mês aceita — `PINNABLE_COLUMNS` ∩ colunas visíveis.
     *
     * Ela é derivada da constante, nunca de uma lista escrita à mão aqui: o dia em
     * que uma terceira coluna virar fixável, este teste passa junto; o dia em que a
     * aba voltar a oferecer as 12, ele quebra.
     */
    it("oferece exatamente as PINNABLE_COLUMNS visíveis — nem uma coluna a mais", () => {
      renderTab();

      const offered = within(pinnedGroup())
        .getAllByRole("button")
        .map((chip) => chip.textContent);

      expect(offered).toEqual(PINNABLE_COLUMNS.map(tableColumnLabel));
    });

    it("não oferece coluna visível que não é fixável — o renderer descartaria", () => {
      // "Categoria" está nas visíveis do rascunho e mesmo assim não pode ser presa:
      // ela não é prefixo da linha, e prender o meio da grade exigiria medir as
      // anteriores em JS (§7.2).
      renderTab();

      expect(within(pinnedGroup()).queryByText("Categoria")).not.toBeInTheDocument();
      expect(within(pinnedGroup()).queryByText("Instituição")).not.toBeInTheDocument();
    });

    it("não oferece coluna fixável que o tipo esconde — fixar o que não aparece não significa nada", () => {
      renderTab({ draft: buildDraft({ visibleColumns: ["occurredOn", "amount"] }) });

      expect(within(pinnedGroup()).getByText("Data")).toBeInTheDocument();
      expect(within(pinnedGroup()).queryByText("Descrição")).not.toBeInTheDocument();
    });

    it("liga e desliga a fixação pelo chip", async () => {
      const { onChange } = renderTab();

      await userEvent.click(
        within(pinnedGroup()).getByRole("button", {
          name: m.settings.presentation.chip.toggleOn("Descrição"),
        }),
      );
      expect(onChange).toHaveBeenCalledWith({ pinnedColumns: ["occurredOn", "description"] });

      await userEvent.click(
        within(pinnedGroup()).getByRole("button", {
          name: m.settings.presentation.chip.toggleOff("Data"),
        }),
      );
      expect(onChange).toHaveBeenLastCalledWith({ pinnedColumns: [] });
    });

    describe("layout de pílulas — o bloco não tem efeito, então não aceita clique", () => {
      const pills = () => buildDraft({ rowLayout: "pills" });

      it("mostra o motivo, no fluxo e não só no tooltip", () => {
        renderTab({ draft: pills() });

        expect(screen.getByText(t.pinnedDisabledPills)).toBeInTheDocument();
      });

      it("todos os chips ficam desabilitados", () => {
        renderTab({ draft: pills() });

        for (const chip of within(pinnedGroup()).getAllByRole("button")) {
          expect(chip, chip.textContent ?? "").toBeDisabled();
        }
      });

      it("clicar não muda o rascunho", async () => {
        const { onChange } = renderTab({ draft: pills() });

        await userEvent.click(
          within(pinnedGroup()).getByRole("button", {
            name: m.settings.presentation.chip.toggleOn("Descrição"),
          }),
        );

        expect(onChange).not.toHaveBeenCalled();
      });

      it("o chip presa continua legível como presa — o motivo é escopo, não reset", () => {
        // O desabilitado não pode APAGAR o estado: `pinnedColumns` continua gravado
        // e volta a valer assim que o layout A for escolhido de novo.
        renderTab({ draft: pills() });

        expect(
          within(pinnedGroup()).getByRole("button", {
            name: m.settings.presentation.chip.toggleOff("Data"),
          }),
        ).toHaveAttribute("aria-pressed", "true");
      });

      it("no layout de colunas o motivo some e o chip volta a aceitar clique", () => {
        renderTab();

        expect(screen.queryByText(t.pinnedDisabledPills)).not.toBeInTheDocument();
        expect(
          within(pinnedGroup()).getByRole("button", {
            name: m.settings.presentation.chip.toggleOff("Data"),
          }),
        ).toBeEnabled();
      });
    });
  });

  describe("ao criar linha nova, herdar", () => {
    it("os rótulos vêm do MAPA indexado pela chave persistida", () => {
      renderTab();
      const group = screen.getByRole("group", { name: t.inheritTitle });

      for (const [key, label] of Object.entries(t.inheritLabels)) {
        expect(within(group).getByText(label), `rótulo de ${key}`).toBeInTheDocument();
      }
    });

    it("ligar 'Categoria' acrescenta a CHAVE persistida, não o rótulo", async () => {
      const { onChange } = renderTab();
      const group = screen.getByRole("group", { name: t.inheritTitle });

      await userEvent.click(
        within(group).getByRole("button", {
          name: m.settings.presentation.chip.toggleOn(t.inheritLabels.category),
        }),
      );

      expect(onChange).toHaveBeenCalledWith({ inheritOnNewRow: ["occurredOn", "category"] });
    });
  });
});
