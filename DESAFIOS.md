# DESAFIOS.md — Fricções recorrentes

> Registro de fricções que ainda não cabem em um skill nem em uma spec. Ver CLAUDE.md §10 (Auto-aprendizado).

---

## `pnpm lint` está quebrado (Next 16 removeu `next lint`)

> **✅ RESOLVIDO (2026-07-20):** o script `lint` já é `eslint .` no `package.json` e `pnpm lint` roda normalmente (0 errors, apenas warnings de baseline `import/order`). Entrada mantida como histórico.

**Sintoma**: `docker compose exec app pnpm lint` (e `lint:fix`) falha com
`Invalid project directory provided, no such directory: /app/lint`.

**Causa**: o projeto foi atualizado para `next@16.2.6`, versão em que o comando
`next lint` foi removido do CLI (ver `npx next --help` — não há mais subcomando
`lint`). O script `lint` em `package.json` ainda chama `next lint`, que agora é
interpretado como um comando desconhecido. Tentar rodar `eslint` direto também
falha: o projeto usa `.eslintrc.json` (formato legado) com `eslint@9`, que por
padrão exige *flat config* (`eslint.config.js`); com
`ESLINT_USE_FLAT_CONFIG=false` o shim de compatibilidade (`@eslint/eslintrc`)
quebra ao tentar serializar a config de `next/core-web-vitals` (`eslint-config-next@16.2.6`
já é flat-config-only), gerando `TypeError: Converting circular structure to JSON`.

**Como evitar / próximo passo**: migrar `.eslintrc.json` → `eslint.config.mjs`
(flat config) e trocar o script `lint` para `eslint .` diretamente (sem depender
do wrapper `next lint`, que não existe mais). Isso é uma decisão técnica não-trivial
(mudança de formato de config, possível mudança de comportamento de regras) —
não decidir/aplicar silenciosamente numa task não relacionada; alinhar com o
desenvolvedor antes (opções: (a) migrar para flat config agora, (b) fixar
`next` numa versão anterior que ainda tem `next lint`, (c) trocar o script para
chamar `eslint` com `--config` explícito em formato legado via um pacote de
compat mantido). Até lá, mudanças de código devem ser validadas com
`pnpm typecheck` + `pnpm test`, já que `pnpm lint` não é confiável no estado atual.

---

## `pnpm add` falha com `ERR_PNPM_UNEXPECTED_STORE`

**Sintoma**: `docker compose exec app pnpm add <pkg>` falha com
`Unexpected store location` — o `node_modules` está linkado do store
`/root/.local/share/pnpm/store/v3`, mas o pnpm quer usar `/app/.pnpm-store/v3`.

**Causa**: a imagem instalou as deps com um store global (`/root/.local/share/pnpm/store/v3`)
diferente do default que o pnpm passou a querer no diretório do projeto.

**Como evitar**: rodar o add apontando o store existente:
`docker compose exec app pnpm add <pkg> --store-dir /root/.local/share/pnpm/store/v3`.
(Os warnings de `unmet peer` que aparecem — vitest/mui-nextjs/mcp-handler/swagger — são
baseline pré-existente, não do pacote adicionado.)

---

## Teste `NewTransactionRow.test.tsx` é flaky

**Sintoma**: `src/components/transactions/NewTransactionRow.test.tsx` (grupo
"aplicação manual de apelido — Fase 4") falha de forma intermitente na suíte
completa (1–3 testes), mas passa 8/8 quando rodado isolado. Cada caso leva 1,5–27s.

**Causa**: teste de UI com timers/popover/`useTransition` + snackbar; sob carga da
suíte completa (jsdom, ~890 testes) estoura timeouts de espera de forma não-determinística.

**Como evitar / próximo passo**: não bloquear merges por ele — re-rodar isolado
(`docker compose exec app pnpm test src/components/transactions/NewTransactionRow.test.tsx`)
para confirmar verde. Fix real (futuro): usar fake timers (`vi.useFakeTimers`) e
`findBy*`/`waitFor` com timeout explícito em vez de esperas implícitas; ou marcar
`{ retry: 2 }` nesses casos. Não relacionado à Spec 23.

---

## `next typegen` após rota top-level nova (Next 16)

**Sintoma**: `pnpm typecheck` falha com erro de tipo de rota (`.next/types/routes.d.ts`
stale) ao adicionar uma rota top-level nova (ex.: `/planning`).

**Causa**: Next 16 gera tipos de rota em build; o cache não conhece a rota nova
mid-session.

**Como evitar**: rodar `docker compose exec app npx next typegen` antes do
`typecheck` ao criar rota nova (regenera sem `next build` completo).

---

## `eslint --fix` / `import/order` quebra teste com mock indireto

**Sintoma**: teste que dependia de `vi.mock` registrado num helper (ex.:
`tests/mocks/prisma.ts` importado como `prismaMock`) passa a tentar conexão real
(Postgres) e falha após um `eslint --fix`.

**Causa**: `import/order` reordenou o import do helper de mock para depois do
módulo testado; como o `vi.mock` mora no helper (não é hoisted pelo Vitest como um
`vi.mock` no próprio arquivo), o mock não é registrado a tempo.

**Como evitar**: NÃO rodar `eslint --fix`/`import/order` em arquivos de teste com
mock indireto; a ordem de import é semanticamente significativa. Blindar com
`// eslint-disable-next-line import/order` + comentário na linha do import do helper.

---

## Suíte E2E acumulou rótulos stale (drift da Spec 66) — 2026-08-03

**Sintoma**: ao rodar a suíte E2E completa pela primeira vez em muito tempo (durante
a Spec 73), 14 de 34 testes falhavam. As falhas eram por **rótulo/locator que não
existe mais**, não por bug de produto:

| E2E esperava | Rótulo/afordância real hoje |
|---|---|
| `button "Importar CSV/XLSX"` | `m.csvImport.importButton` = **"Importar"** |
| `button "Adicionar tabela"` | `m.financeTables.createButton` = **"Nova tabela"** |
| `button "Salvar (Enter)"` | `m.transactions.actions.save` = **"Salvar"** |
| `button "Quitar antecipado"` (rodapé do painel) | `settleShort` = **"Quitar parcelas"** |
| `button "1/3"` (badge de parcela) | nome acessível é **"Parcela 1 de 3 — …"** |
| `tab "Parcelas e vínculos"` | **"Parcelas"** |
| `getByText("Grupo de parcelamento")` no painel | overline **"Parcelamento"** |
| `button "Mais opções"` (menu de export) | não encontrado |

**Causa**: a Spec 66 (reestruturação da linha/painel/modal) renomeou rótulos e trocou
afordâncias sem atualizar os E2E, e a suíte não roda no fluxo de dev local (só o
unit roda em `pnpm test`). O drift ficou invisível até alguém rodar o perfil `e2e`.

O caso do badge é o menos óbvio: o `Chip` clicável está dentro de um `Tooltip`, e o
**MUI escreve `aria-label` com o título do tooltip no filho**, sobrescrevendo o nome
acessível. Então `getByRole("button", { name: "1/3" })` nunca casa — o nome é
`"Parcela 1 de 3 — Grupo de parcelamento"`. Vale para qualquer `Chip`/`IconButton`
curto embrulhado em `Tooltip`.

**Como evitar**:
- Ao renomear string de UI em `src/lib/messages/pt-BR.ts`, `grep` o literal em `e2e/`
  antes de fechar o pacote. Rótulo é contrato de teste.
- Rodar o perfil `e2e` ao fechar pacote que mexe em linha/painel/modal de transação
  (não só `pnpm test`).
- Para elemento curto dentro de `Tooltip`, o locator estável é o **nome acessível
  derivado do tooltip** (`{ name: /^Parcela 1 de 3/ }`), não o texto visível.

**Pendente** (não corrigido na Spec 73, exige decisão de produto — spec 66 §10 vs
código): aba `"Parcelas e vínculos"` → `"Parcelas"`, cabeçalho do painel
`"Grupo de parcelamento"` → overline `"Parcelamento"`, e o menu `"Mais opções"` do
export em `solo-flow`. Testes afetados: `transaction-detail.spec.ts` (3),
`transaction-detail-edit.spec.ts` (2), `solo-flow.spec.ts` (1).
