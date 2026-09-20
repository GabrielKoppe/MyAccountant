import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { m } from "@/lib/messages";

import {
  SettingsTabPanel,
  SettingsTabs,
  settingsTabId,
  settingsTabPanelId,
} from "./SettingsTabs";

const tabsMessages = m.settings.presentation.tabs;

const TABS = [
  { value: "columns", label: tabsMessages.columnsLayout },
  { value: "behavior", label: tabsMessages.behavior },
  { value: "usedBy", label: tabsMessages.usedBy, count: 2 },
];

function renderTabs(value = "columns") {
  const onChange = vi.fn();

  render(
    <>
      <SettingsTabs tabs={TABS} value={value} onChange={onChange} ariaLabel="Abas do tipo" />
      <SettingsTabPanel value="columns" activeValue={value}>
        <p>conteúdo de colunas</p>
      </SettingsTabPanel>
      <SettingsTabPanel value="behavior" activeValue={value}>
        <p>conteúdo de comportamento</p>
      </SettingsTabPanel>
    </>,
  );

  return { onChange };
}

describe("SettingsTabs", () => {
  it("renderiza um tablist nomeado com uma aba por item", () => {
    renderTabs();

    const tablist = screen.getByRole("tablist", { name: "Abas do tipo" });
    expect(tablist).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("marca só a aba ativa como selecionada", () => {
    renderTabs("behavior");

    expect(screen.getByRole("tab", { name: tabsMessages.behavior })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: tabsMessages.columnsLayout })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("chama onChange com o VALOR da aba, não com o índice", async () => {
    const { onChange } = renderTabs();

    await userEvent.click(screen.getByRole("tab", { name: tabsMessages.behavior }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("behavior");
  });

  it("mostra a contagem no rótulo quando o item traz count", () => {
    renderTabs();

    // O nome acessível junta rótulo e contagem — é assim que o leitor de tela
    // anuncia "Onde é usado 2".
    expect(
      screen.getByRole("tab", { name: new RegExp(`${tabsMessages.usedBy}\\s*2`) }),
    ).toBeInTheDocument();
  });

  describe("ligação aba ↔ painel", () => {
    it("aria-controls da aba aponta para o id do painel correspondente", () => {
      renderTabs();

      const tab = screen.getByRole("tab", { name: tabsMessages.columnsLayout });
      expect(tab).toHaveAttribute("id", settingsTabId("columns"));
      expect(tab).toHaveAttribute("aria-controls", settingsTabPanelId("columns"));
    });

    it("o painel ativo aponta de volta para a aba e é o único renderizado", () => {
      renderTabs();

      const panel = screen.getByRole("tabpanel");
      expect(panel).toHaveAttribute("id", settingsTabPanelId("columns"));
      expect(panel).toHaveAttribute("aria-labelledby", settingsTabId("columns"));
      expect(screen.getByText("conteúdo de colunas")).toBeInTheDocument();
      // O painel inativo é DESMONTADO — não apenas escondido.
      expect(screen.queryByText("conteúdo de comportamento")).not.toBeInTheDocument();
    });
  });
});
