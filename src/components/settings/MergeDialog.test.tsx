import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SnackbarProvider } from "notistack";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionError, actionSuccess } from "@/lib/action-result";
import { m } from "@/lib/messages";

import { MergeDialog, type MergeDialogOption, type MergeDialogProps } from "./MergeDialog";

const getConfigReferencesAction = vi.fn();
const mergeEntityAction = vi.fn();
vi.mock("@/actions/settings-merge", () => ({
  getConfigReferencesAction: (...args: unknown[]) => getConfigReferencesAction(...args),
  mergeEntityAction: (...args: unknown[]) => mergeEntityAction(...args),
}));

const countUsageAction = vi.fn();
vi.mock("@/actions/settings-usage", () => ({
  countUsageAction: (...args: unknown[]) => countUsageAction(...args),
}));

const t = m.settings.structureDialogs.merge;

const OPTIONS: MergeDialogOption[] = [
  { id: "cat-1", name: "Restaurantes", colorKey: null },
  { id: "cat-2", name: "Restaurante", colorKey: "green" },
];

function renderDialog(overrides: Partial<MergeDialogProps> = {}) {
  const onClose = vi.fn();
  const onMerged = vi.fn();
  render(
    <SnackbarProvider>
      <MergeDialog
        open
        onClose={onClose}
        accountId="acc-test-1"
        entity="category"
        options={OPTIONS}
        onMerged={onMerged}
        {...overrides}
      />
    </SnackbarProvider>,
  );
  return { onClose, onMerged };
}

/** Abre o Select pelo aria-label e clica na opção pelo texto (mesmo idioma de
 * `CategoriesManager.test.tsx`: `getByLabelText` → `click` → `findByRole("option")`). */
async function chooseOption(label: string, optionName: string) {
  await userEvent.click(screen.getByLabelText(label));
  await userEvent.click(await screen.findByRole("option", { name: optionName }));
}

/**
 * O botão de confirmar troca de rótulo: "Mesclar" antes das contagens e
 * "Mesclar N itens" depois (§2.5 — o botão nomeia o total movido). Casar pelo
 * prefixo cobre os dois estados sem duplicar cada asserção.
 */
const CONFIRM_LABEL = /^Mesclar/;

describe("MergeDialog", () => {
  beforeEach(() => {
    getConfigReferencesAction.mockReset();
    mergeEntityAction.mockReset();
    countUsageAction.mockReset();
    getConfigReferencesAction.mockResolvedValue(
      actionSuccess({
        groups: [
          { kind: "aliases", count: 2 },
          { kind: "templateDefaults", count: 1 },
          { kind: "templateItems", count: 0 },
          { kind: "widgetFilters", count: 0 },
          { kind: "accountDefault", count: 0 },
        ],
        total: 3,
      }),
    );
    countUsageAction.mockResolvedValue(
      actionSuccess({
        transactions: 31,
        months: 5,
        byMonth: [],
        countedAt: new Date("2026-08-10T12:00:00.000Z"),
        fromCache: true,
      }),
    );
  });

  it("mantém a confirmação desabilitada enquanto só um lado está escolhido", async () => {
    renderDialog();
    const confirmButton = screen.getByRole("button", { name: CONFIRM_LABEL });
    expect(confirmButton).toBeDisabled();

    await chooseOption(t.absorbLabel, "Restaurantes");
    expect(confirmButton).toBeDisabled();

    // Sem os dois lados, nenhuma contagem é buscada.
    expect(getConfigReferencesAction).not.toHaveBeenCalled();
    expect(countUsageAction).not.toHaveBeenCalled();
  });

  it("desabilita a confirmação e mostra o aviso quando os dois lados são o mesmo objeto", async () => {
    renderDialog();
    await chooseOption(t.absorbLabel, "Restaurantes");
    await chooseOption(t.keepLabel, "Restaurantes");

    expect(screen.getByRole("button", { name: CONFIRM_LABEL })).toBeDisabled();
    expect(screen.getByText(t.sameObject)).toBeInTheDocument();
    // Objetos iguais não geram uma busca de contagem — não há nada de útil a mostrar.
    expect(getConfigReferencesAction).not.toHaveBeenCalled();
  });

  it("mostra 'contando transações…' enquanto as contagens ainda não chegaram", async () => {
    let resolveRefs: (value: unknown) => void = () => undefined;
    getConfigReferencesAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefs = resolve;
        }),
    );

    renderDialog({ initialAbsorbedId: "cat-1" });
    await chooseOption(t.keepLabel, "Restaurante");

    expect(await screen.findByText(t.countingTransactions)).toBeInTheDocument();

    // Libera a promise pendente e espera o efeito assentar, para não vazar um
    // `setState` fora de `act(...)` para o próximo teste.
    resolveRefs(actionSuccess({ groups: [], total: 0 }));
    await waitFor(() => {
      expect(screen.queryByText(t.countingTransactions)).not.toBeInTheDocument();
    });
  });

  it("mostra os chips com as contagens reais, inclusive as zeradas, e habilita a confirmação", async () => {
    renderDialog({ initialAbsorbedId: "cat-1" });
    await chooseOption(t.keepLabel, "Restaurante");

    await waitFor(() => {
      expect(screen.getByText(t.transactionsChip(31))).toBeInTheDocument();
    });
    // "verificamos e não há" precisa aparecer igual a "verificamos e há" — os
    // grupos zerados NÃO somem da lista de chips.
    expect(screen.getByText("0 transações de modelos")).toBeInTheDocument();
    expect(screen.getByText("0 filtros de widget")).toBeInTheDocument();
    expect(screen.getByText("2 apelidos")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: CONFIRM_LABEL })).not.toBeDisabled();
    });
  });

  it("o botão nomeia o total movido assim que as contagens chegam (§2.5)", async () => {
    renderDialog({ initialAbsorbedId: "cat-1" });

    // Antes de escolher o outro lado não há contagem: rótulo genérico.
    expect(screen.getByRole("button", { name: t.confirm })).toBeInTheDocument();

    await chooseOption(t.keepLabel, "Restaurante");

    // 31 transações + (2 apelidos + 1 de-para + 0 + 0 + 0) = 34.
    // Numa operação sem undo (D5), o tamanho do que se move precisa estar no próprio
    // gesto de confirmar, não só na lista de chips acima dele.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: t.confirmWithTotal(34) })).toBeInTheDocument();
    });
  });

  it("sempre declara que a mesclagem é irreversível, sem prometer undo", () => {
    renderDialog();
    expect(screen.getByText(t.irreversible)).toBeInTheDocument();
  });

  it("ao confirmar com sucesso, chama onMerged e fecha o diálogo", async () => {
    mergeEntityAction.mockResolvedValue(
      actionSuccess({
        transactions: 31,
        aliases: 2,
        templateItems: 0,
        templateDefaults: 1,
        widgetFilters: 0,
        subcategories: 0,
      }),
    );
    const { onClose, onMerged } = renderDialog({ initialAbsorbedId: "cat-1" });
    await chooseOption(t.keepLabel, "Restaurante");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: CONFIRM_LABEL })).not.toBeDisabled();
    });
    await userEvent.click(screen.getByRole("button", { name: CONFIRM_LABEL }));

    await waitFor(() => {
      expect(mergeEntityAction).toHaveBeenCalledWith("acc-test-1", {
        entity: "category",
        absorbedId: "cat-1",
        keptId: "cat-2",
      });
    });
    expect(onMerged).toHaveBeenCalledWith({ absorbedId: "cat-1", keptId: "cat-2" });
    expect(onClose).toHaveBeenCalled();
  });

  it("em erro da action, mostra o erro e NÃO chama onMerged", async () => {
    mergeEntityAction.mockResolvedValue(actionError("CONFLICT", "Escolha dois objetos diferentes."));
    const { onMerged } = renderDialog({ initialAbsorbedId: "cat-1" });
    await chooseOption(t.keepLabel, "Restaurante");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: CONFIRM_LABEL })).not.toBeDisabled();
    });
    await userEvent.click(screen.getByRole("button", { name: CONFIRM_LABEL }));

    await waitFor(() => expect(mergeEntityAction).toHaveBeenCalled());
    expect(onMerged).not.toHaveBeenCalled();
  });
});
