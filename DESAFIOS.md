# DESAFIOS.md — Fricções recorrentes

> Registro de fricções que ainda não cabem em um skill nem em uma spec. Ver CLAUDE.md §10 (Auto-aprendizado).

---

## `pnpm lint` está quebrado (Next 16 removeu `next lint`)

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
