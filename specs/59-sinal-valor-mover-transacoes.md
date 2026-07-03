# Spec 59 — Tratar o sinal do valor ao mover transações entre seções

> Status: ready
> Insumo: revisão de código em `src/server/services/transaction-service.ts:251` (`moveTransactions`) e nos pontos de derivação de sinal (`src/lib/export-utils.ts:12`, `src/components/transactions/TransactionRow.tsx:90`, `src/components/finance-tables/FinanceTableCard.tsx:136`, `src/server/queries/sandbox.ts:65`)
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`ui-feedback`](../skills/ui-feedback/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

O sinal que o usuário vê em uma transação é **presentacional**: ele é derivado do `countType` da seção, não armazenado. `amountCents` guarda a magnitude com um sinal cru; a leitura muda conforme a convenção da seção.

Convenção de exibição observada no código (todos concordam):

- Em seção `subtract`, o sinal armazenado é **invertido** na exibição — `applyFinancialSign` retorna `-reais` (`export-utils.ts:12`); `TransactionRow` trata `amount < 0n` como positivo (`TransactionRow.tsx:90`); `FinanceTableCard` idem no total (`FinanceTableCard.tsx:136`).
- Em seção `add`, `neutral` e `ignore`, o valor é exibido **como está** (sinal armazenado preservado). `ignore` apenas não entra no total do mês, mas exibe o sinal cru.

- **BUG-01** — `moveTransactions` (`transaction-service.ts:251`) troca `tableId`/`sectionId`/`monthId` em um único `updateMany`, mas **nunca toca `amountCents`**. Ao mover uma transação de uma seção `subtract` para uma `add` (ou vice-versa), a mesma magnitude passa a ser reinterpretada sob a nova convenção e o valor **lê invertido** para o usuário. Não é multiplicação de sinal indevida — é reinterpretação silenciosa.
- **DLG-01** — O modal de mover (`MoveTransactionsDialog.tsx`) não informa nada sobre o efeito no sinal, nem oferece escolha. O usuário move às cegas.
- **CFG-01** — Não há default configurável na conta para o comportamento desejado (inverter vs preservar) quando as convenções diferem.

## 2. Solução

- **BUG-01** → Ao mover entre seções cuja **convenção de exibição difere** (exatamente um lado é `subtract`), e quando a opção "inverter sinal" estiver ativa, `moveTransactions` normaliza `amountCents` negando o valor (`× -1`, em BigInt centavos) na mesma operação de update. Toda a decisão passa por um helper puro e testável em `src/lib/money.ts` (`moveInvertsConvention` + `normalizeAmountOnMove`). Transações cujo source **não** difere do destino ficam intactas.
- **DLG-01** → Quando origem e destino têm convenção oposta, o modal exibe uma seção de sinal em linguagem clara, com toggle **Inverter sinal / Preservar valor armazenado** e **preview antes/depois** (via `formatCentsToBrl`) de uma transação da seleção. Quando as convenções coincidem, a seção de sinal fica oculta (nenhuma conversão é necessária).
- **CFG-01** → Novo campo `invertSignOnMoveByDefault: Boolean @default(true)` em `AccountSettings`, exposto no formulário de Configurações Gerais e usado para pré-selecionar o toggle no modal.

**Default = inverter** quando as convenções diferem: raramente se quer transformar um valor negativo em positivo sem intenção. O usuário sempre pode desmarcar no modal.

## 3. User Stories

- Como membro editor, quero que ao mover uma despesa de uma seção de gastos (`subtract`) para uma de receitas (`add`) o valor continue lendo com o mesmo significado, para não corromper meus totais.
- Como membro editor, quero ver antes de confirmar o que acontecerá com o sinal do valor, para mover com confiança.
- Como membro editor, quero poder preservar o valor armazenado em casos específicos, para lidar com estornos e correções manuais.
- Como owner, quero definir o comportamento padrão de inversão na conta, para não decidir a cada movimentação.

## 4. Critérios de Aceitação

### BUG-01 — Normalização de `amountCents`

- QUANDO uma transação é movida de uma seção `subtract` para uma seção `add`/`neutral`/`ignore` (ou vice-versa) E a opção inverter está ativa, `moveTransactions` DEVE gravar `amountCents = -amountCents` para essa transação, na mesma transação de banco.
- QUANDO origem e destino têm a **mesma** convenção de exibição (ambos `subtract`, ou ambos entre `add`/`neutral`/`ignore`), `moveTransactions` NÃO DEVE alterar `amountCents`, independentemente da flag.
- QUANDO a opção inverter está desativada, `moveTransactions` NÃO DEVE alterar `amountCents` em nenhuma combinação.
- ENQUANTO normaliza, `moveTransactions` DEVE restringir todo update por `accountId = ctx.accountId` e NÃO DEVE tocar transações de outra conta cujos ids sejam passados.
- A matemática de sinal DEVE ocorrer em BigInt centavos; NÃO DEVE haver conversão para Float.

### DLG-01 — Modal

- QUANDO a seção destino selecionada tem convenção oposta à da origem, o modal DEVE exibir a seção de sinal com toggle e preview antes/depois de ao menos uma transação.
- QUANDO as convenções coincidem, o modal NÃO DEVE exibir a seção de sinal.
- O toggle DEVE iniciar de acordo com `invertSignOnMoveByDefault` da conta.
- O modal DEVE reusar `<DialogShell>`, tokens semânticos do tema e `formatCentsToBrl`, e DEVE funcionar em light e dark.

### CFG-01 — Default configurável

- QUANDO o owner/editor salva Configurações Gerais, `invertSignOnMoveByDefault` DEVE ser persistido em `AccountSettings` e validado no server via `defineAction`.
- Contas existentes DEVEM assumir `true` por default (via `@default(true)` na migration).

## 5. Fora de Escopo

- Recalcular ou migrar retroativamente sinais de transações já existentes.
- Alterar a semântica de agregação de dashboards (`applyCountTypeSign` em `sandbox.ts`) — permanece como está.
- Tornar o sinal um valor armazenado canônico (persistir sinal exibido); a convenção continua presentacional por seção.
- Oferecer escolha de sinal quando o destino é a **mesma** seção/convenção.
- Tratar `ignore` como convenção distinta de `add`/`neutral` (decisão: só `subtract` inverte a exibição — ver Decisões de Design).

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| O que caracteriza "convenção oposta" | Exatamente um lado é `subtract` | É a única convenção que inverte o sinal exibido no código atual (`applyFinancialSign`, `TransactionRow`, `FinanceTableCard`). `add`/`neutral`/`ignore` exibem o sinal cru. |
| Default de inversão | `true` | Preserva o significado exibido; inversão acidental de sinal é o erro mais comum. |
| Escopo do source em `moveTransactions` | Único por movimentação (UI), mas service agrupa por convenção de origem | O modal é sempre acionado de uma única tabela (`BulkActionBar`), mas o service é robusto a ids de seções mistas via partição. |
| Modal quando convenções coincidem | Ocultar seção de sinal | Nada muda no sinal; evita ruído. |

## 7. Referências Técnicas

| Item | Arquivo |
|---|---|
| Helper puro de sinal (`displaySignInverts`, `moveInvertsConvention`, `normalizeAmountOnMove`) | `src/lib/money.ts` |
| Normalização na movimentação | `src/server/services/transaction-service.ts` (`moveTransactions`, `listTablesForMove`) |
| Schema do move (`invertSign`) | `src/lib/schemas/transaction.ts` (`moveTransactionsSchema`) |
| Modal | `src/components/transactions/MoveTransactionsDialog.tsx` |
| Threading de props | `src/components/transactions/BulkActionBar.tsx`, `TransactionTable.tsx` |
| Default da conta (schema + service + form + page) | `src/lib/schemas/settings.ts`, `src/server/services/account-settings-service.ts`, `src/app/(app)/[accountId]/settings/general/GeneralSettingsForm.tsx` + `page.tsx` |
| Prisma | `prisma/schema.prisma` (`AccountSettings.invertSignOnMoveByDefault`) + migration |
| Mensagens | `src/lib/messages/pt-BR.ts` (`financeTables`, `settings.general`) |
| Testes | `src/lib/money.test.ts`, `src/server/services/transaction-service.test.ts`, `src/server/services/account-settings-service.test.ts` |

### Helper de referência (`src/lib/money.ts`)

```ts
import type { SectionCountType } from "@prisma/client";

/** Convenção de exibição: apenas `subtract` inverte o sinal armazenado. */
export function displaySignInverts(countType: SectionCountType): boolean {
  return countType === "subtract";
}

/** True quando origem e destino exibem o sinal de forma oposta. */
export function moveInvertsConvention(
  source: SectionCountType,
  destination: SectionCountType,
): boolean {
  return displaySignInverts(source) !== displaySignInverts(destination);
}

/**
 * Normaliza amountCents ao mover entre seções. Quando `invert` está ativo e as
 * convenções diferem, nega o valor (BigInt) para preservar o significado exibido.
 */
export function normalizeAmountOnMove(
  amountCents: bigint,
  source: SectionCountType,
  destination: SectionCountType,
  invert: boolean,
): bigint {
  return invert && moveInvertsConvention(source, destination) ? -amountCents : amountCents;
}
```
