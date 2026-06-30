# SKILL — Testes End-to-End (Playwright)

## Quando usar

Ao implementar/escrever testes ponta-a-ponta — fluxos reais de usuário no navegador contra o app rodando. Complementa [`testing`](../testing/SKILL.md) (Vitest unit/integration, mock de Prisma): o E2E cobre a **integração real** (UI → action → service → DB) que os mocks não pegam.

> **Status:** Playwright ainda **não está instalado** (é a [spec 58](../../specs/58-testes-e2e.md)). Este skill define a **abordagem e convenções** para quando ela for implementada. Para a mecânica do Playwright em si, há o skill global `playwright-skill` (`~/.claude/skills/`).

---

## 1. Alvo e ambiente

- O app roda em **Docker na porta 3000** (`NEXTAUTH_URL=http://localhost:3000`). Os testes apontam para `baseURL: http://localhost:3000`.
- Testar contra o **app real + banco semeado** — **não** mockar backend (isso é papel do `testing`/Vitest). E2E sem backend real não tem valor.
- CI: rodar headless no GitHub Actions (ver spec 16), com o stack do `docker-compose` de pé.

---

## 2. Estrutura

```
tests/
├── e2e/                      # specs Playwright (separado dos unit/integration)
│   ├── auth.spec.ts
│   ├── transactions.spec.ts
│   └── ...
├── e2e/fixtures/             # auth fixture, seed helpers
playwright.config.ts          # baseURL :3000, projetos (chromium + 1 viewport mobile)
```

---

## 3. Convenções

### Auth (não logar via UI em todo teste)
Login programático uma vez → `storageState` reutilizável entre specs. Logar pela UI só **no** teste de login.

### Multi-tenancy (crítico — é o diferencial do app)
Semear uma `Account` com **membros de papéis diferentes** (owner/editor/viewer) e cobrir E2E:
- viewer **não** consegue editar/criar (botões ausentes/desabilitados e action negada);
- dados de uma Account **nunca** aparecem em outra. Espelha a regra de `multitenancy` no nível de fluxo.

### Banco
Seed determinístico via script Prisma + reset entre runs (banco de teste dedicado no compose, ou transação/cleanup). Sem seed, o teste vira flaky.

### Seletores e espera
- `getByRole`/`getByLabel` > CSS; `data-testid` só em pontos sem semântica.
- **Esperar por estado** (`await expect(...).toBeVisible()`), nunca `waitForTimeout`/sleep.
- Screenshot/trace on failure.

---

## 4. Fluxos críticos para a spec 58 (5–10, não cobertura total)

A meta da spec 58 é "fluxos críticos cobertos", não 100%. Priorizar:
1. Signup/login → seleção de Account → dashboard carrega.
2. Criar transação (BigInt/centavos → valor correto exibido).
3. Editar transação inline + undo.
4. Import CSV (upload → preview → confirma → aparece na tabela).
5. Navegação de meses (respeita `month_start_day`).
6. **Permissão**: viewer bloqueado de mutar (multi-tenancy E2E).
7. Dashboard/widget renderiza com dados semeados.

> Conforme o V3 avança, somar fluxos das specs novas (ex.: confirmação de sync Pluggy — spec 52).

---

## 5. Anti-padrões

❌ Mockar backend em E2E (use Vitest p/ isso).
❌ Logar pela UI em todo teste (use `storageState`).
❌ `waitForTimeout`/sleep — esperar por estado.
❌ Testes dependentes de ordem ou de dado pré-existente não semeado.
❌ Pular o fluxo de permissão/multi-tenancy — é o que mais importa neste app.
