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
