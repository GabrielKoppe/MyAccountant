# Spec 58 — Testes End-to-End

> Status: ready
> Insumo: revisão de código em `tests/`, `src/`, `docker-compose.yml`, `.github/workflows/ci.yml` (2026-07-20)
> Skills: [`testing`](../skills/testing/SKILL.md) · [`env-validation`](../skills/env-validation/SKILL.md)
> Relacionado: [`spec 13`](13-testing.md) (estratégia de testes) · [`spec 16`](16-ci-cd.md) (CI/CD) · [`spec 56`](56-paginacao-escala-queries.md) (paginação e escala de queries)

---

## 1. Problema

- **E2E-01**: A suíte atual cobre **services, queries e componentes** com Vitest — **~889 casos de teste** (`it`/`test`) em **77 arquivos** (`*.test.ts` / `*.test.tsx`) — mas **não há nenhum teste end-to-end**. Não existe Playwright nem qualquer driver de browser no projeto (`package.json` não lista nenhum; sem `e2e/`, sem `playwright.config.*`). Os testes exercitam unidades isoladas (mockando Prisma com `vitest-mock-extended`, ver `tests/mocks/prisma.ts`), nunca o fluxo real do usuário através de páginas, Server Actions, banco e navegação.
- **E2E-02**: Os fluxos críticos ponta-a-ponta **não têm cobertura**. Não há teste que verifique: criar mês → lançar transações → exportar; convidar e aceitar membro; import de CSV; navegação entre dashboards; redirecionamento de rota protegida; ausência de controles de escrita para `viewer`. Uma regressão que quebre a sequência (ex.: `createMonthAction` em `src/actions/months.ts:7` que falha após mudança de schema) só seria detectada manualmente.
- **E2E-03**: A estratégia de testes vigente **adia explicitamente o E2E** para "v2" (`skills/testing/SKILL.md` §12: *"Fluxos E2E ... fica para v2"*), e o skill proíbe `.spec.ts` de forma global (`skills/testing/SKILL.md` §2: *".test.ts (nunca .spec.ts)"*) — a convenção default do Playwright é `.spec.ts`. Sem reconciliar essas regras, a introdução do E2E entra em conflito com o skill.

---

## 2. Solução

### 2.1 Introduzir Playwright (E2E-01)

- Adicionar **Playwright** como ferramenta de teste E2E, com configuração própria (`playwright.config.ts`) separada da config do Vitest (`vitest.config.ts`, spec 13). Apenas **Chromium** no escopo inicial (DD-03).
- Os testes E2E ficam em `e2e/` e usam a extensão **`.spec.ts`** (convenção Playwright), isolados do `testMatch` do Vitest (DD-10). Autenticação reutilizada via `storageState` por papel quando aplicável.
- Os testes rodam contra a aplicação real subida em container, com **banco PostgreSQL dedicado** de teste e seed determinístico. Documentar o comando de execução via `docker compose` (alinhado à seção 8 do `CLAUDE.md`).

### 2.2 Banco dedicado e seed determinístico (DD-05, DD-06, DD-07)

- **Serviço compose dedicado** `postgres-e2e` (porta e volume próprios), isolado do postgres de dev. Antes da suíte, o `globalSetup` do Playwright roda `prisma migrate deploy` + seed E2E.
- **Seed = fixtures base** (`e2e/fixtures/seed.ts`, novo — separado do `prisma/seed.ts` de dev): usuários com senha conhecida (login por credentials), accounts com membros nos três papéis (`owner`/`editor`/`viewer`) e a configuração base de seções/categorias/instituições. Meses, tabelas e transações são criados **pela UI** dentro de cada cenário.
- **Isolamento por namespace**: cada cenário opera em escopo próprio (mês com ano/mês dedicado; cenários que mutam membership usam uma account própria do seed), permitindo execução em paralelo sem reset global entre testes.

### 2.3 Modo-teste que neutraliza dependências externas (DD-08)

- Introduzir uma **flag de ambiente de teste** (via `env` de `src/lib/env.ts`, ex.: `E2E=true`) que, no ambiente E2E:
  - **Desliga o rate-limit** do login/signup (evita `429` do middleware `src/middleware.ts:26-41` em logins repetidos; remove dependência de Upstash em CI).
  - Coloca o **`emailService` em modo no-op/capture** (sem envio real via Brevo); o convite (E2E-02 cenário 1b) é aceito pelo caminho `?inviteId=` (email-match), obtendo o `inviteId` por query direta no banco de teste — não depende de ler email.
  - Login **apenas por credentials**; Google OAuth fica fora de escopo do E2E (§5).

### 2.4 Cenários críticos (E2E-02)

Implementar **6 cenários** cobrindo os fluxos de maior valor (dentro da faixa 5–10 de DD-03). Cada cenário é um critério verificável na §4.

### 2.5 Pipeline (E2E-01, spec 16)

- Incluir a execução dos testes E2E no pipeline de CI (spec 16 — `.github/workflows/ci.yml`) como **job separado que roda em todo PR**: sobe a stack (`postgres-e2e` + app), roda `migrate deploy` + seed, executa Playwright Chromium. O job é **required status check** — falha no E2E **bloqueia o merge** e falha o pipeline.

### 2.6 Reconciliação de convenções (E2E-03)

- Atualizar `skills/testing/SKILL.md`: §2 passa a restringir a regra "nunca `.spec.ts`" ao Vitest em `src/` (unit/integração), permitindo `.spec.ts` sob `e2e/`; §12 deixa de listar "E2E fica para v2" (esta spec entrega o E2E).

---

## 3. User Stories

- Como desenvolvedor, quero testes E2E dos fluxos críticos, para detectar quebras de ponta-a-ponta antes do deploy, e não em produção.
- Como mantenedor, quero o E2E rodando como status check bloqueante no CI, para que um PR que quebre o fluxo de lançar/exportar transações não seja mesclado.
- Como novo contribuidor, quero documentação de como rodar o E2E via `docker compose`, para executar localmente sem montar o ambiente do zero.
- Como responsável por segurança, quero um teste E2E que confirme que um `viewer` não vê controles de escrita, para garantir que a autorização de papéis vale também na UI renderizada.

---

## 4. Critérios de Aceitação

**E2E-01 (infra):**
- Playwright DEVE estar instalado e configurado (`playwright.config.ts`), separado da config do Vitest, restrito a Chromium.
- OS testes E2E DEVEM residir em `e2e/` com extensão `.spec.ts` e NÃO DEVEM ser coletados pelo `testMatch` do Vitest (nem vice-versa).
- OS testes E2E DEVEM rodar contra a aplicação real com o serviço `postgres-e2e` dedicado, com `prisma migrate deploy` + seed determinístico (`e2e/fixtures/seed.ts`) executados no `globalSetup`.
- QUANDO a suíte E2E roda no ambiente de teste, O rate-limit de login/signup DEVE estar desligado e O `emailService` NÃO DEVE realizar envio real (no-op/capture).
- A forma de rodar os testes via `docker compose` DEVE estar documentada no `CLAUDE.md` §8.

**E2E-02 (cenários — cada bullet é um teste que DEVE passar):**
- **1a (fluxo solo):** QUANDO um usuário autenticado por credentials cria um mês, cria uma tabela, lança transações e exporta o CSV pelo menu da UI, O download DEVE concluir sem erro e O corpo do CSV DEVE conter as transações lançadas.
- **1b (convite + aceite):** QUANDO um `owner` convida um usuário por email e esse usuário (com email correspondente, já cadastrado) aceita o convite pelo caminho `/invite/accept?inviteId=<id>`, O usuário convidado DEVE passar a ser membro da account (aparecer na lista de membros / obter acesso à account).
- **CSV import:** QUANDO o usuário importa um arquivo CSV válido pelo wizard (upload → mapping → preview → config → confirmar), AS TRANSAÇÕES DEVEM aparecer na tabela do mês após a tela de resultado.
- **Dashboards:** QUANDO o usuário navega para o dashboard mensal (`/{accountId}/dashboards/monthly/{monthId}`) e o anual (`/{accountId}/dashboards/yearly/{year}`), AS PÁGINAS DEVEM carregar e os widgets DEVEM renderizar sem erro (sem error boundary; ao menos um widget-chave visível).
- **Rota protegida:** QUANDO um usuário não autenticado acessa uma rota protegida, ELE DEVE ser redirecionado para `/login` com o `callbackUrl` preservado.
- **Viewer read-only:** QUANDO um membro `viewer` abre uma tabela de transações, O controle de adicionar linha e O menu de ações de escrita da linha NÃO DEVEM estar disponíveis.

**Pipeline:**
- O job E2E DEVE rodar em todo PR contra `main` (spec 16) como required status check; falha no E2E DEVE falhar o pipeline e bloquear o merge.

---

## 5. Fora de Escopo

- Testes E2E de **todos** os fluxos do app — esta spec entrega os 6 cenários críticos; cobertura ampla é incremental.
- **Google OAuth no E2E** — login E2E é apenas por credentials; testar o fluxo OAuth real com o provedor está fora de escopo.
- **Fluxo real de entrega/leitura de email** (Brevo) — o `emailService` roda em no-op/capture; o cenário de convite é aceito via `?inviteId=`, não pela leitura de um email entregue.
- **Asserção de conteúdo de PDF e de XLSX** — o cenário de export valida apenas o CSV do mês (o app não possui export XLSX; export PDF existe mas não tem asserção de conteúdo por ser texto de difícil extração).
- Testes de carga / performance (P95/P99 sob volume) — o E2E verifica comportamento, não desempenho sob volume; nenhuma spec de teste de carga existe hoje. A spec 56 trata de paginação/escala de queries (e emite telemetria de latência), não de testes de carga.
- Testes visuais/snapshot de pixel — verifica-se comportamento, não pixels.
- Testes cross-browser exaustivos (Safari/Firefox/Edge) — começar com Chromium; ampliar depois se necessário.
- Substituir os testes unitários/integração de Vitest — E2E é complementar, não substituto (spec 13 permanece).
- Reset transacional por teste — inviável em E2E real (o app usa conexão própria via HTTP); o isolamento é por namespace (DD-07).

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Ferramenta E2E | Playwright | Padrão maduro para Next.js; suporte a auto-wait, traces e CI |
| DD-02 | Banco do E2E | PostgreSQL dedicado com seed determinístico | Isola o E2E dos dados de dev; resultados reproduzíveis |
| DD-03 | Escopo inicial | 6 cenários críticos, Chromium | Cobertura de maior valor primeiro; ampliar incrementalmente |
| DD-04 | Profundidade do convite | Dividir o fluxo "criar Account → convite → mês → export" em **1a solo** (mês→transações→export) e **1b convite+aceite** | Um único teste ficaria sobrecarregado; separar dá asserções nítidas por fluxo sem estourar a faixa de 5–10 |
| DD-05 | Fronteira do setup | **Seed = fixtures base** (usuários c/ senha, accounts c/ membros nos 3 papéis, config de seções/categorias/instituições); mês/tabela/transação criados pela UI | Evita re-testar CRUD de account/seção em todo cenário; mantém o fluxo-alvo genuinamente ponta-a-ponta |
| DD-06 | Provisionamento do DB | **Serviço compose dedicado `postgres-e2e`**; `migrate deploy`+seed no `globalSetup` | Isolamento total do dev; reprodutível; alinhado a DD-02 |
| DD-07 | Isolamento entre cenários | **Namespace por cenário** (mês dedicado; account própria p/ cenários que mutam membership); sem reset global | Permite paralelismo e evita flakiness sem serializar via truncate+reseed |
| DD-08 | Dependências externas | **Modo-teste** (flag de env): rate-limit off, `emailService` no-op/capture, login credentials-only; convite aceito via `?inviteId=` | Determinístico e offline; sem `429` do middleware e sem depender de Upstash/Brevo/Google em CI |
| DD-09 | Asserção de export | **CSV do mês via clique no menu da UI** (captura o download event; assere o corpo) | True E2E (UI→route→arquivo); CSV é texto de asserção robusta, ao contrário de PDF |
| DD-10 | Nomenclatura dos arquivos E2E | **`e2e/*.spec.ts`** (convenção Playwright); atualizar `skills/testing/SKILL.md` §2 para restringir "nunca `.spec.ts`" ao Vitest em `src/` | Convenção familiar do Playwright; separação limpa Vitest (`.test.ts` ao lado do source) × Playwright (`.spec.ts` em `e2e/`) |
| DD-11 | Trigger do CI | **Job E2E em todo PR, bloqueante** (required status check) | Atende a user story "PR que quebre o fluxo não é mesclado"; detecta a quebra antes do merge, não depois |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Config Playwright | `playwright.config.ts` (novo — Chromium, `testDir: "e2e"`, `globalSetup`, `webServer` opcional) |
| Cenários E2E | `e2e/` (novo — ex.: `solo-flow.spec.ts`, `invite-accept.spec.ts`, `csv-import.spec.ts`, `dashboards.spec.ts`, `auth-redirect.spec.ts`, `viewer-readonly.spec.ts`) |
| Seed de teste | `e2e/fixtures/seed.ts` (novo — usuários c/ senha, accounts c/ owner/editor/viewer, config base) |
| Serviço de DB de teste | `docker-compose.yml` (novo serviço `postgres-e2e`) |
| Flag de modo-teste | `src/lib/env.ts` (nova var, ex.: `E2E`); consumida no rate-limit (`src/middleware.ts:26-41`) e no `emailService` (`src/server/email/email-service.ts`) |
| Pipeline CI | `.github/workflows/ci.yml` (spec 16 — novo job `e2e`, required check) |
| Documentação de execução | `CLAUDE.md` §8 · `specs/13-testing.md` |
| Reconciliação de skill | `skills/testing/SKILL.md` §2 (carve-out `.spec.ts`) e §12 (remover "E2E fica para v2") |

### Âncoras dos fluxos exercitados (aterradas no código)

| Fluxo | Âncora |
|---|---|
| Login / redirect de rota protegida | rota `/login`; middleware `src/middleware.ts:60-63` (redirect + `callbackUrl`); rate-limit `src/middleware.ts:26-41` |
| Criar mês | `createMonthAction` `src/actions/months.ts:7-14`; rota `/{accountId}/months/{monthId}` `src/app/(app)/[accountId]/months/[monthId]/page.tsx` |
| Criar tabela | `src/actions/finance-tables.ts` |
| Lançar transação | `createTransactionAction` `src/actions/transactions.ts:20-28`; UI `src/components/transactions/NewTransactionRow.tsx:244` |
| Export CSV do mês | GET `src/app/api/v1/accounts/[accountId]/months/[monthId]/export/csv/route.ts`; menu `src/components/months/MonthHeader.tsx:77` (`csvUrl`) e `:173` (item CSV); service `src/server/services/export-service.ts` |
| Convite (criar/aceitar) | `inviteMemberAction` `src/actions/members.ts:21-29`; `acceptInviteAction` `src/actions/members.ts:75-93`; página de aceite `src/app/(auth)/invite/accept/page.tsx` (caminho `?inviteId=` em `page.tsx:14-20`); service `src/server/services/member-service.ts` |
| CSV import (wizard) | `src/components/csv-import/ImportWizard.tsx` (entrada `src/components/months/SectionView.tsx:245`); `executeImportAction` `src/actions/csv-import.ts:46-54` |
| Dashboards | mensal `src/app/(app)/[accountId]/dashboards/monthly/[monthId]/page.tsx`; anual `src/app/(app)/[accountId]/dashboards/yearly/[year]/page.tsx` |
| Viewer read-only | `canEdit` `src/app/(app)/[accountId]/months/[monthId]/page.tsx:103`; `isReadOnly` `src/components/transactions/TransactionTable.tsx:219`; add-row oculto `:492`; menu de ação `src/components/transactions/TransactionRowActions.tsx:84` |

> **Nota de reconciliação com specs vizinhas:** `spec 13` §12 adia E2E para "v2" — esta spec 58 **supera** esse adiamento (atualizar a nota no skill/spec durante a implementação). `spec 16` ganha o job `e2e`. `spec 56` (escala de queries) permanece disjunta — E2E aqui não cobre desempenho sob volume.

---

## 8. Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Goal:** Introduzir Playwright e 6 cenários E2E críticos, rodando contra a app real com Postgres dedicado e seed determinístico, em CI bloqueante.

**Architecture:** Um stack `docker compose` com perfil `e2e` sobe três serviços: `postgres-e2e` (DB isolado), `app-e2e` (Next em modo produção `next start`, `E2E=true`, que roda `migrate deploy` + seed no boot) e `e2e-runner` (imagem oficial do Playwright que roda as specs contra `http://app-e2e:3000`). O seed grava um manifesto de ids em `e2e/.auth/seed-manifest.json`; o `auth.setup.ts` faz login por papel e salva `storageState`. Cada cenário opera em namespace próprio (mês/ano dedicado; conta separada para o convite).

**Tech Stack:** Playwright (Chromium), `@playwright/test`, Prisma (seed + query de convite no teste), Next 16 `next start`, docker compose, bcryptjs (hash das senhas do seed).

### Global Constraints

- Node `>=22`, pnpm `9`. Playwright **fixado** em `1.49.1` — a versão do pacote `@playwright/test` e a tag da imagem `mcr.microsoft.com/playwright:v1.49.1-jammy` DEVEM ser idênticas.
- Todo comando de dev/CI roda **em container** (`CLAUDE.md` §8). **Não** criar branch, worktree, nem rodar git que faça pull (instrução do usuário). Commits, se houver, vão no branch atual.
- `.spec.ts` só sob `e2e/`. Vitest não coleta `e2e/` (`include: src/**` + `exclude: e2e/**`); Playwright só coleta `e2e/` (`testDir: "e2e"`).
- Env sempre via `src/lib/env.ts` — nunca `process.env.X` direto no código de app. (Scripts de seed/config podem ler `process.env`.)
- Sem `console.log` em código de produção (seed e configs de teste podem logar).
- Dinheiro em `BigInt` centavos; toda transação semeada usa `amountCents: <n>n`.

### Decisões de infra do plano (operacionalizam DD-06/DD-08)

- **CI não existe ainda:** não há `.github/workflows/` no repo. O plano cria `.github/workflows/e2e.yml` **standalone** (escopo E2E). Quando o `ci.yml` da spec 16 for materializado, o job `e2e` pode migrar para lá.
- **App em produção (`next start`)** no `app-e2e`, não `pnpm dev` — evita recompilação/flakiness. Como `next start` roda com `NODE_ENV=production`, é necessário o gate `!env.E2E` na guarda do rate-limit (Task 2), senão a exigência de Upstash em produção (`rate-limit.ts:21`) quebra o login.
- **inviteId via query direta no DB de teste** (DD-08): o `e2e-runner` recebe `DATABASE_URL` do `postgres-e2e` e usa `PrismaClient` para ler o convite pendente no cenário 1b.

### File Structure

| Arquivo | Responsabilidade |
|---|---|
| `playwright.config.ts` (novo) | Config Playwright: `testDir`, projeto `setup` + `chromium`, `baseURL`, retries/workers |
| `e2e/fixtures/seed.ts` (novo) | Reset + fixtures base determinísticas; grava `seed-manifest.json` |
| `e2e/fixtures/manifest.ts` (novo) | Helper que lê o manifesto + constante de senha |
| `e2e/fixtures/db.ts` (novo) | `PrismaClient` singleton p/ o cenário 1b (query do convite) |
| `e2e/fixtures/sample-import.csv` (novo) | CSV determinístico p/ o cenário de import |
| `e2e/auth.setup.ts` (novo) | Login por papel → `e2e/.auth/{role}.json` |
| `e2e/*.spec.ts` (novos) | Os 6 cenários + smoke |
| `docker-compose.yml` (mod) | Perfil `e2e`: `postgres-e2e`, `app-e2e`, `e2e-runner` |
| `src/lib/env.ts` (mod) | Nova var `E2E` |
| `src/server/email/client.ts` (mod) | No-op quando `env.E2E` |
| `src/server/security/rate-limit.ts` (mod) | Gate `!env.E2E` na guarda de produção |
| `vitest.config.ts` (mod) | `exclude` inclui `e2e/**` |
| `tsconfig.json` (mod) | `exclude` inclui `e2e` — o `next build` não type-checa specs de teste (desacopla o build de produção dos arquivos E2E) |
| `package.json` (mod) | dep `@playwright/test`, scripts `test:e2e` / `e2e:seed` |
| `.github/workflows/e2e.yml` (novo) | Job E2E bloqueante em PR |
| `CLAUDE.md` (mod) | §8: comandos de E2E |
| `skills/testing/SKILL.md` (mod) | §2 carve-out `.spec.ts`; §12 remove "E2E fica para v2" |
| `specs/13-testing.md` (mod) | §12: E2E deixa de ser "v2" |

---

### Task 1: Instalar e configurar Playwright (infra base)

**Files:**
- Modify: `package.json` (devDeps + scripts)
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Modify: `vitest.config.ts:12` (exclude)

**Produces:** `pnpm test:e2e` executável; `playwright.config.ts` com projetos `setup`+`chromium`; convenção `e2e/*.spec.ts` isolada do Vitest.

- [ ] **Step 1: Adicionar dependência e scripts.** Em `package.json`, adicionar em `devDependencies`: `"@playwright/test": "1.49.1"`. Em `scripts`: `"test:e2e": "playwright test"`, `"e2e:seed": "tsx e2e/fixtures/seed.ts"`.

- [ ] **Step 2: Isolar o Vitest e o `next build` do `e2e/`.** Em `vitest.config.ts`, trocar a linha `exclude: ["node_modules", ".next"],` por:

```ts
    exclude: ["node_modules", ".next", "e2e/**"],
```

E em `tsconfig.json`, trocar `"exclude": ["node_modules"]` por `"exclude": ["node_modules", "e2e"]` — senão o `next build` (com `noUnusedLocals`) type-checa os arquivos de teste e um import não usado em spec quebra o build de produção. Playwright transpila `e2e/` por conta própria (esbuild), sem depender do `include` do tsconfig.

- [ ] **Step 3: Criar `playwright.config.ts`.**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts$/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
  ],
});
```

- [ ] **Step 4: Criar smoke spec.**

```ts
// e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

test("página de login renderiza", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
});
```

- [ ] **Step 5: Instalar deps e verificar coleta (a app ainda não sobe aqui).**

Run: `docker compose exec app pnpm install && docker compose exec app pnpm exec playwright test --list`
Expected: lista inclui `smoke.spec.ts` e `auth.setup.ts` no projeto `setup` — sem erro de config. (Ainda não roda contra servidor; isso é a Task 2.)

- [ ] **Step 6: Verificar que o Vitest ignora `e2e/`.**

Run: `docker compose exec app pnpm test -- --run`
Expected: PASS, e nenhum arquivo de `e2e/` é coletado pelo Vitest.

- [ ] **Step 7: Commit.**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts vitest.config.ts e2e/smoke.spec.ts
git commit -m "test(e2e): scaffold Playwright config and smoke spec (spec 58 Task 1)"
```

---

### Task 2: Modo-teste, stack compose e seed determinístico

**Files:**
- Modify: `src/lib/env.ts:5-37` (server) e `:43-62` (runtimeEnv)
- Modify: `src/server/email/client.ts:11-16`
- Modify: `src/server/security/rate-limit.ts:21`
- Create: `src/server/email/client.test.ts`
- Create: `e2e/fixtures/seed.ts`, `e2e/fixtures/manifest.ts`
- Create: `e2e/auth.setup.ts`
- Modify: `docker-compose.yml` (perfil `e2e`)

**Produces:** var `env.E2E`; `emailService`/rate-limit neutralizados sob E2E; stack `docker compose --profile e2e`; `seed-manifest.json`; `storageState` por papel. Manifesto: `{ users: {owner,editor,viewer,invitee: email}, mainAccountId, inviteAccountId, roMonthId, roSectionId }`. Senha: `E2ePass123`.

- [ ] **Step 1: Adicionar `E2E` ao env.** Em `src/lib/env.ts`, dentro de `server:` adicionar:

```ts
    // E2E: quando "true", neutraliza deps externas (email no-op, rate-limit off). Ver spec 58.
    E2E: z.enum(["true", "false"]).transform((v) => v === "true").default("false"),
```

e em `runtimeEnv:` adicionar `E2E: process.env.E2E,`.

- [ ] **Step 2: No-op de email sob E2E.** Em `src/server/email/client.ts`, no início de `sendEmail` (antes de `parseEmailFrom`):

```ts
export async function sendEmail(options: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ messageId: string }> {
  // spec 58 (DD-08): em E2E não há envio real — evita rede/flakiness.
  if (env.E2E) return { messageId: "e2e-noop" };

  const sender = parseEmailFrom(env.EMAIL_FROM);
  // ... resto inalterado
```

- [ ] **Step 3: Rate-limit não exige Upstash sob E2E.** Em `src/server/security/rate-limit.ts:21`, trocar a guarda por:

```ts
    // SEC-01: em produção o rate limiting é obrigatório — exceto em E2E (spec 58 DD-08).
    if (env.NODE_ENV === "production" && !env.E2E && !redisSingleton) {
```

- [ ] **Step 4: Teste unitário do no-op de email (escrever primeiro).**

```ts
// src/server/email/client.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { E2E: true, EMAIL_FROM: "MyAccountant <e2e@localhost>", BREVO_API_KEY: "placeholder" },
}));

import { sendEmail } from "./client";

describe("sendEmail (modo E2E)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("não faz chamada de rede quando env.E2E é true", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await sendEmail({ to: ["a@b.com"], subject: "x", html: "<p>x</p>", text: "x" });
    expect(result.messageId).toBe("e2e-noop");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Rodar o teste.**

Run: `docker compose exec app pnpm test -- src/server/email/client.test.ts --run`
Expected: PASS.

- [ ] **Step 6: Criar o seed E2E.**

```ts
// e2e/fixtures/seed.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "E2ePass123";

const BASE_SECTIONS = [
  { name: "Entradas", countType: "add" as const, order: 0 },
  { name: "Saídas", countType: "subtract" as const, order: 1 },
  { name: "Investimentos", countType: "neutral" as const, order: 2 },
];
const BASE_TABLE_TYPES = [
  { name: "Manual", isDefault: true, hiddenColumns: {} },
  { name: "Cartão de crédito", isDefault: false, hiddenColumns: { investmentType: true } },
];
const BASE_CATEGORIES = [
  { name: "Alimentação", subs: ["Mercado", "Restaurante"] },
  { name: "Transporte", subs: ["Combustível", "Uber/Táxi"] },
];
const BASE_INSTITUTIONS = ["Banco A", "Banco B"];

async function reset() {
  await prisma.transaction.deleteMany();
  await prisma.financeTable.deleteMany();
  await prisma.month.deleteMany();
  await prisma.accountInvite.deleteMany();
  await prisma.tableType.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.institution.deleteMany();
  await prisma.section.deleteMany();
  await prisma.accountSettings.deleteMany();
  await prisma.accountMember.deleteMany();
  await prisma.account.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser(email: string, name: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  return prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      settings: { create: { theme: "system", locale: "pt-BR", timezone: "America/Sao_Paulo" } },
    },
    select: { id: true },
  });
}

async function seedConfig(accountId: string, ownerId: string) {
  await prisma.section.createMany({ data: BASE_SECTIONS.map((s) => ({ ...s, accountId })) });
  await prisma.tableType.createMany({ data: BASE_TABLE_TYPES.map((t) => ({ ...t, accountId })) });
  for (const name of BASE_INSTITUTIONS) {
    await prisma.institution.create({ data: { accountId, name, createdById: ownerId } });
  }
  for (const { name, subs } of BASE_CATEGORIES) {
    const cat = await prisma.category.create({ data: { accountId, name, createdById: ownerId } });
    await prisma.subcategory.createMany({
      data: subs.map((n) => ({ accountId, categoryId: cat.id, name: n })),
    });
  }
}

async function main() {
  await reset();

  const owner = await createUser("owner@e2e.test", "E2E Owner");
  const editor = await createUser("editor@e2e.test", "E2E Editor");
  const viewer = await createUser("viewer@e2e.test", "E2E Viewer");
  const invitee = await createUser("invitee@e2e.test", "E2E Invitee");

  const main = await prisma.account.create({
    data: {
      name: "E2E Main",
      createdById: owner.id,
      settings: { create: { currency: "BRL", monthStartDay: 1 } },
      members: {
        create: [
          { userId: owner.id, role: "owner" },
          { userId: editor.id, role: "editor" },
          { userId: viewer.id, role: "viewer" },
        ],
      },
    },
    select: { id: true },
  });
  await seedConfig(main.id, owner.id);

  const invite = await prisma.account.create({
    data: {
      name: "E2E Invite",
      createdById: owner.id,
      settings: { create: { currency: "BRL", monthStartDay: 1 } },
      members: { create: [{ userId: owner.id, role: "owner" }] },
    },
    select: { id: true },
  });
  await seedConfig(invite.id, owner.id);

  // Fixture read-only p/ o cenário viewer (viewer não pode criar dados):
  // mês 2099/12 na conta principal, com 1 tabela e 1 transação na seção "Saídas".
  const saidas = await prisma.section.findFirstOrThrow({
    where: { accountId: main.id, name: "Saídas" },
    select: { id: true },
  });
  const roMonth = await prisma.month.create({
    data: { accountId: main.id, year: 2099, month: 12, createdById: owner.id },
    select: { id: true },
  });
  const roTable = await prisma.financeTable.create({
    data: {
      accountId: main.id,
      monthId: roMonth.id,
      sectionId: saidas.id,
      name: "Contas fixas",
      createdById: owner.id,
    },
    select: { id: true },
  });
  await prisma.transaction.create({
    data: {
      accountId: main.id,
      monthId: roMonth.id,
      tableId: roTable.id,
      sectionId: saidas.id,
      occurredOn: new Date("2099-12-05"),
      amountCents: 12345n,
      description: "Aluguel",
      createdById: owner.id,
    },
  });

  const manifest = {
    users: {
      owner: "owner@e2e.test",
      editor: "editor@e2e.test",
      viewer: "viewer@e2e.test",
      invitee: "invitee@e2e.test",
    },
    mainAccountId: main.id,
    inviteAccountId: invite.id,
    roMonthId: roMonth.id,
    roSectionId: saidas.id,
  };
  mkdirSync(join(process.cwd(), "e2e/.auth"), { recursive: true });
  writeFileSync(join(process.cwd(), "e2e/.auth/seed-manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("E2E seed OK:", manifest.mainAccountId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 7: Criar o helper de manifesto.**

```ts
// e2e/fixtures/manifest.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const E2E_PASSWORD = "E2ePass123";

export type SeedManifest = {
  users: Record<"owner" | "editor" | "viewer" | "invitee", string>;
  mainAccountId: string;
  inviteAccountId: string;
  roMonthId: string;
  roSectionId: string;
};

export function manifest(): SeedManifest {
  const path = join(process.cwd(), "e2e/.auth/seed-manifest.json");
  return JSON.parse(readFileSync(path, "utf8")) as SeedManifest;
}
```

- [ ] **Step 8: Criar `auth.setup.ts` (login por papel).**

```ts
// e2e/auth.setup.ts
import { test as setup } from "@playwright/test";
import { E2E_PASSWORD, manifest } from "./fixtures/manifest";

const ROLES = ["owner", "editor", "viewer", "invitee"] as const;

for (const role of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const email = manifest().users[role];
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Senha").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
    await page.context().storageState({ path: `e2e/.auth/${role}.json` });
  });
}
```

- [ ] **Step 9: Adicionar o perfil `e2e` ao `docker-compose.yml`** (novos serviços + volume `postgres-e2e-data` e `e2e-runner-node-modules`).

```yaml
  postgres-e2e:
    image: postgres:16-alpine
    profiles: ["e2e"]
    environment:
      POSTGRES_USER: myaccountant
      POSTGRES_PASSWORD: e2e_password
      POSTGRES_DB: myaccountant_e2e
    ports:
      - "5433:5432"
    volumes:
      - postgres-e2e-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myaccountant -d myaccountant_e2e"]
      interval: 5s
      timeout: 5s
      retries: 10

  app-e2e:
    build:
      context: .
      dockerfile: Dockerfile.dev
    profiles: ["e2e"]
    command: sh -c "pnpm install --no-frozen-lockfile && pnpm prisma generate && pnpm prisma migrate deploy && pnpm exec tsx e2e/fixtures/seed.ts && pnpm build && pnpm start -p 3000"
    environment:
      E2E: "true"
      DATABASE_URL: postgresql://myaccountant:e2e_password@postgres-e2e:5432/myaccountant_e2e?schema=public
      DIRECT_URL: postgresql://myaccountant:e2e_password@postgres-e2e:5432/myaccountant_e2e?schema=public
      NEXTAUTH_URL: http://app-e2e:3000
      AUTH_TRUST_HOST: "true"
      NEXTAUTH_SECRET: e2e_secret_change_me_min_32_chars_padding_ok
      GOOGLE_CLIENT_ID: placeholder
      GOOGLE_CLIENT_SECRET: placeholder
      BREVO_API_KEY: placeholder
      EMAIL_FROM: MyAccountant <e2e@localhost>
      NEXT_PUBLIC_APP_URL: http://app-e2e:3000
      LOG_LEVEL: warn
    volumes:
      - ./:/app
      - app-e2e-node-modules:/app/node_modules
    depends_on:
      postgres-e2e:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/login >/dev/null 2>&1 || exit 1"]
      interval: 5s
      timeout: 10s
      retries: 40

  e2e-runner:
    image: mcr.microsoft.com/playwright:v1.49.1-jammy
    profiles: ["e2e"]
    working_dir: /app
    environment:
      PLAYWRIGHT_BASE_URL: http://app-e2e:3000
      DATABASE_URL: postgresql://myaccountant:e2e_password@postgres-e2e:5432/myaccountant_e2e?schema=public
      CI: "true"
    volumes:
      - ./:/app
      - e2e-runner-node-modules:/app/node_modules
    depends_on:
      app-e2e:
        condition: service_healthy
    command: sh -c "corepack enable && corepack prepare pnpm@9.15.4 --activate && pnpm install --frozen-lockfile && pnpm prisma generate && pnpm exec playwright test"
```

Adicionar em `volumes:`: `postgres-e2e-data:`, `app-e2e-node-modules:`, `e2e-runner-node-modules:`.

> Nota: o `command` roda `prisma generate` **antes** do seed — o volume `app-e2e-node-modules` sobe vazio e `migrate deploy` não gera o client, então sem o `generate` explícito o `new PrismaClient()` do seed quebra com *"@prisma/client did not initialize yet"*. Em seguida `migrate deploy` + seed rodam **antes** do `build` para garantir DB pronto e semeado quando o servidor sobe (`pnpm build` re-roda generate/migrate, idempotente). `NODE_ENV=production` vem de `next start`. O `e2e-runner` roda `corepack enable` (cria o shim `pnpm` no PATH) **e** `corepack prepare pnpm@9.15.4 --activate` (pina a versão, igual ao `Dockerfile.dev`) — `prepare --activate` sozinho baixa mas não põe o shim no PATH (`sh: pnpm: not found`) — usar o pnpm default do corepack quebra o `install --frozen-lockfile` com `Cannot find matching keyid` (verificação de assinatura do lockfile por uma versão diferente da que o gerou).

- [ ] **Step 10: Subir a stack e validar smoke + setup contra a app real.**

Run: `docker compose --profile e2e up --build --abort-on-container-exit --exit-code-from e2e-runner postgres-e2e app-e2e e2e-runner`
Expected: `e2e-runner` roda `auth.setup.ts` (4 logins, gera `e2e/.auth/*.json`) e `smoke.spec.ts` PASS; exit code 0. Logs de `app-e2e` mostram `E2E seed OK:`.

- [ ] **Step 11: Commit.**

```bash
git add src/lib/env.ts src/server/email/client.ts src/server/email/client.test.ts \
        src/server/security/rate-limit.ts e2e/fixtures/seed.ts e2e/fixtures/manifest.ts \
        e2e/auth.setup.ts docker-compose.yml
git commit -m "test(e2e): compose e2e stack, deterministic seed, test-mode gates (spec 58 Task 2)"
```

---

### Task 3: Cenário — redirect de rota protegida

**Files:** Create: `e2e/auth-redirect.spec.ts`
**Consumes:** `manifest()` (Task 2).

- [ ] **Step 1: Escrever o teste.**

```ts
// e2e/auth-redirect.spec.ts
import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";

// Sem storageState → sessão anônima.
test.use({ storageState: { cookies: [], origins: [] } });

test("rota protegida redireciona para /login com callbackUrl", async ({ page }) => {
  const target = `/${manifest().mainAccountId}`;
  await page.goto(target);
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
});
```

- [ ] **Step 2: Rodar.** Run: `docker compose --profile e2e up --build --abort-on-container-exit --exit-code-from e2e-runner postgres-e2e app-e2e e2e-runner` → Expected: `auth-redirect.spec.ts` PASS.

- [ ] **Step 3: Commit.** `git add e2e/auth-redirect.spec.ts && git commit -m "test(e2e): protected-route redirect scenario (spec 58 Task 3)"`

---

### Task 4: Cenário — viewer read-only

**Files:** Create: `e2e/viewer-readonly.spec.ts`
**Consumes:** `storageState` `viewer.json`; `manifest()` (`mainAccountId`, `roMonthId`, `roSectionId`).

- [ ] **Step 1: Escrever o teste.**

```ts
// e2e/viewer-readonly.spec.ts
import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/viewer.json" });

test("viewer não vê controles de escrita na tabela", async ({ page }) => {
  const m = manifest();
  await page.goto(`/${m.mainAccountId}/months/${m.roMonthId}?tab=${m.roSectionId}`);

  // Leitura funciona: a tabela e a transação semeadas aparecem.
  await expect(page.getByText("Contas fixas")).toBeVisible();
  await expect(page.getByText("Aluguel")).toBeVisible();

  // Escrita indisponível: add-row e toggles de linha ausentes.
  await expect(page.getByRole("button", { name: "Nova transação" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Marcar como pendente" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Adicionar aos favoritos" })).toHaveCount(0);
});
```

- [ ] **Step 2: Rodar** (mesmo comando da Task 3). Expected: `viewer-readonly.spec.ts` PASS.

- [ ] **Step 3: Commit.** `git add e2e/viewer-readonly.spec.ts && git commit -m "test(e2e): viewer read-only scenario (spec 58 Task 4)"`

---

### Task 5: Cenário 1a — fluxo solo (mês → tabela → transações → export CSV)

**Files:** Create: `e2e/solo-flow.spec.ts`
**Consumes:** `storageState` `owner.json`; `manifest()` (`mainAccountId`, `roSectionId` — as seções são da conta, reusáveis em qualquer mês). Namespace: **ano 2098 / mês Janeiro**.

- [ ] **Step 1: Escrever o teste.**

```ts
// e2e/solo-flow.spec.ts
import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/owner.json" });

test("criar mês, tabela, transação e exportar CSV com a transação", async ({ page }) => {
  const m = manifest();
  await page.goto(`/${m.mainAccountId}`);

  // 1. Criar mês 2098/Janeiro.
  await page.getByRole("button", { name: /Novo mês|Criar primeiro mês/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click(); // único combobox no dialog = select de mês
  await page.getByRole("option", { name: "Janeiro" }).click();
  await dialog.getByLabel("Ano").fill("2098");
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();
  await page.waitForURL(/\/months\/[^/?]+/, { timeout: 15_000 });
  const monthId = page.url().match(/\/months\/([^/?]+)/)![1];

  // 2. Abrir a seção "Saídas" e criar uma tabela.
  await page.goto(`/${m.mainAccountId}/months/${monthId}?tab=${m.roSectionId}`);
  await page.getByRole("button", { name: "Adicionar tabela" }).first().click();
  const tableDialog = page.getByRole("dialog");
  await tableDialog.getByLabel("Nome da tabela").fill("Mercado");
  await tableDialog.getByRole("button", { name: "Criar" }).click();
  await expect(tableDialog).toBeHidden();

  // 3. Lançar uma transação na linha inline.
  await page.getByRole("button", { name: "Nova transação" }).first().click();
  await page.getByPlaceholder("Descrição").fill("Compra teste E2E");
  // NOTA DE RUN: os campos de data e valor da nova linha não têm label/testid estável.
  // Confirmar no 1º run: escopar a linha em edição (a que contém "Salvar (Enter)") e
  // preencher a célula de valor via getByRole("textbox") por posição, ou teclar o valor.
  // Ex.: const row = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Salvar (Enter)" }) });
  //      await row.getByRole("spinbutton").fill("100,00");  // ajustar ao componente real
  await page.getByRole("button", { name: "Salvar (Enter)" }).click();
  await expect(page.getByText("Compra teste E2E")).toBeVisible();

  // 4. Exportar CSV pelo menu e checar o conteúdo.
  await page.goto(`/${m.mainAccountId}/months/${monthId}?tab=summary`);
  await page.getByRole("button", { name: "Mais opções" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("menuitem", { name: "CSV" }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain("Compra teste E2E");
});
```

- [ ] **Step 2: Rodar e ajustar selectors da nova-linha** (ver NOTA DE RUN). Expected: `solo-flow.spec.ts` PASS; o CSV contém "Compra teste E2E".

- [ ] **Step 3: Commit.** `git add e2e/solo-flow.spec.ts && git commit -m "test(e2e): solo flow month→table→tx→CSV export (spec 58 Task 5)"`

---

### Task 6: Cenário 2 — import CSV

**Files:** Create: `e2e/csv-import.spec.ts`, `e2e/fixtures/sample-import.csv`
**Consumes:** `storageState` `owner.json`; `manifest()` (`mainAccountId`, `roSectionId`). Namespace: **ano 2098 / mês Fevereiro**.

- [ ] **Step 1: Criar o CSV de exemplo.**

```
data,descricao,valor
05/02/2098,Padaria E2E,-25.90
06/02/2098,Salario E2E,3000.00
```

- [ ] **Step 2: Escrever o teste.**

```ts
// e2e/csv-import.spec.ts
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/owner.json" });

test("importar CSV faz as transações aparecerem na tabela", async ({ page }) => {
  const m = manifest();

  // Criar mês 2098/Fevereiro e abrir a seção.
  await page.goto(`/${m.mainAccountId}`);
  await page.getByRole("button", { name: /Novo mês|Criar primeiro mês/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Fevereiro" }).click();
  await dialog.getByLabel("Ano").fill("2098");
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();
  await page.waitForURL(/\/months\/[^/?]+/, { timeout: 15_000 });
  const monthId = page.url().match(/\/months\/([^/?]+)/)![1];
  await page.goto(`/${m.mainAccountId}/months/${monthId}?tab=${m.roSectionId}`);

  // Abrir o wizard e carregar o arquivo.
  await page.getByRole("button", { name: "Importar CSV/XLSX" }).first().click();
  await page.locator('input[type="file"]').setInputFiles(join(process.cwd(), "e2e/fixtures/sample-import.csv"));

  // Avançar Upload → Mapeamento → Pré-visualização → Configuração.
  // NOTA DE RUN: confirmar no 1º run se o mapeamento automático já resolve as colunas
  // (data/descricao/valor). Se precisar de ajuste manual de coluna no passo Mapeamento,
  // adicionar as interações aqui antes de cada "Próximo".
  await page.getByRole("button", { name: "Próximo" }).click(); // Upload → Mapeamento
  await page.getByRole("button", { name: "Próximo" }).click(); // Mapeamento → Pré-visualização
  await page.getByRole("button", { name: "Próximo" }).click(); // Pré-visualização → Configuração
  await page.getByRole("button", { name: "Confirmar importação" }).click();

  // Fechar o wizard (tela de resultado) e verificar as transações na tabela.
  await expect(page.getByText("Padaria E2E")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Salario E2E")).toBeVisible();
});
```

- [ ] **Step 3: Rodar e ajustar o passo de Mapeamento se necessário** (ver NOTA DE RUN). Expected: `csv-import.spec.ts` PASS.

- [ ] **Step 4: Commit.** `git add e2e/csv-import.spec.ts e2e/fixtures/sample-import.csv && git commit -m "test(e2e): CSV import wizard scenario (spec 58 Task 6)"`

---

### Task 7: Cenário 3 — dashboards

**Files:** Create: `e2e/dashboards.spec.ts`
**Consumes:** `storageState` `owner.json`; `manifest()` (`mainAccountId`, `roMonthId` — o mês read-only 2099/12 tem dados p/ o dashboard mensal).

- [ ] **Step 1: Escrever o teste.**

```ts
// e2e/dashboards.spec.ts
import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";

test.use({ storageState: "e2e/.auth/owner.json" });

test("dashboards anual e mensal carregam e renderizam widgets", async ({ page }) => {
  const m = manifest();

  // Anual: nav "Dashboards" redireciona para o ano mais recente.
  await page.goto(`/${m.mainAccountId}`);
  await page.getByRole("link", { name: "Dashboards" }).click();
  await page.waitForURL(/\/dashboards\/yearly\/\d+/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Visão Anual" })).toBeVisible();
  await expect(page.getByText("Total do Ano")).toBeVisible();

  // Mensal: navegar direto para o mês read-only (tem dados semeados).
  await page.goto(`/${m.mainAccountId}/dashboards/monthly/${m.roMonthId}`);
  await expect(page.getByText("Total do Mês")).toBeVisible({ timeout: 15_000 });
  // Sem crash: nenhum error boundary do Next visível.
  await expect(page.getByText(/Application error|something went wrong/i)).toHaveCount(0);
});
```

- [ ] **Step 2: Rodar.** Expected: `dashboards.spec.ts` PASS.

- [ ] **Step 3: Commit.** `git add e2e/dashboards.spec.ts && git commit -m "test(e2e): dashboards render scenario (spec 58 Task 7)"`

---

### Task 8: Cenário 1b — convite + aceite

**Files:** Create: `e2e/invite-accept.spec.ts`, `e2e/fixtures/db.ts`
**Consumes:** `storageState` `owner.json` e `invitee.json`; `manifest()` (`inviteAccountId`, `users.invitee`); `env DATABASE_URL` (runner → `postgres-e2e`).
**Produces:** `db` (PrismaClient singleton) para ler o convite pendente (DD-08).

- [ ] **Step 1: Criar o helper de DB.**

```ts
// e2e/fixtures/db.ts
import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient();
```

- [ ] **Step 2: Escrever o teste.**

```ts
// e2e/invite-accept.spec.ts
import { test, expect } from "@playwright/test";
import { manifest } from "./fixtures/manifest";
import { db } from "./fixtures/db";

test.afterAll(async () => {
  await db.$disconnect();
});

test("owner convida e o convidado aceita, virando membro", async ({ browser }) => {
  const m = manifest();
  const inviteeEmail = m.users.invitee;

  // 1. Owner cria o convite pela UI (conta isolada do convite).
  const ownerCtx = await browser.newContext({ storageState: "e2e/.auth/owner.json" });
  const ownerPage = await ownerCtx.newPage();
  await ownerPage.goto(`/${m.inviteAccountId}/settings/members`);
  await ownerPage.getByRole("button", { name: "Convidar membro" }).click();
  const dialog = ownerPage.getByRole("dialog");
  await dialog.getByLabel("Email do convidado").fill(inviteeEmail);
  await dialog.getByLabel("Papel").click();
  await ownerPage.getByRole("option", { name: "Editor" }).click();
  await dialog.getByRole("button", { name: "Enviar convite" }).click();
  await expect(dialog).toBeHidden();
  await ownerCtx.close();

  // 2. Ler o convite pendente direto no DB de teste (DD-08 — email é no-op).
  const invite = await db.accountInvite.findFirstOrThrow({
    where: { accountId: m.inviteAccountId, email: inviteeEmail, status: "pending" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  // 3. Convidado (logado, email correspondente) aceita via ?inviteId=.
  const inviteeCtx = await browser.newContext({ storageState: "e2e/.auth/invitee.json" });
  const inviteePage = await inviteeCtx.newPage();
  await inviteePage.goto(`/invite/accept?inviteId=${invite.id}`);
  await inviteePage.getByRole("button", { name: "Aceitar e entrar" }).click();
  await inviteePage.waitForURL((url) => !url.pathname.startsWith("/invite"), { timeout: 15_000 });
  await inviteeCtx.close();

  // 4. Verificar membership criada.
  const invitee = await db.user.findUniqueOrThrow({ where: { email: inviteeEmail }, select: { id: true } });
  const membership = await db.accountMember.findUnique({
    where: { accountId_userId: { accountId: m.inviteAccountId, userId: invitee.id } },
  });
  expect(membership).not.toBeNull();
  expect(membership?.role).toBe("editor");
});
```

- [ ] **Step 3: Rodar.** Expected: `invite-accept.spec.ts` PASS. (O `Papel` select é `TextField select` → `getByLabel("Papel")` funciona; opções `Proprietário/Editor/Visualizador`.)

- [ ] **Step 4: Commit.** `git add e2e/invite-accept.spec.ts e2e/fixtures/db.ts && git commit -m "test(e2e): invite + accept scenario (spec 58 Task 8)"`

---

### Task 9: Job E2E no CI (bloqueante)

**Files:** Create: `.github/workflows/e2e.yml`

- [ ] **Step 1: Criar o workflow.**

```yaml
# .github/workflows/e2e.yml
name: E2E

on:
  pull_request:
    branches: [main]

concurrency:
  group: e2e-${{ github.ref }}
  cancel-in-progress: true

jobs:
  e2e:
    name: Playwright E2E
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run E2E stack
        run: |
          docker compose --profile e2e up --build \
            --abort-on-container-exit --exit-code-from e2e-runner \
            postgres-e2e app-e2e e2e-runner

      - name: Tear down
        if: always()
        run: docker compose --profile e2e down -v

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          if-no-files-found: ignore
```

- [ ] **Step 2: Verificar sintaxe do workflow.** Run: `docker run --rm -v "$PWD":/repo rhysd/actionlint:latest -color /repo/.github/workflows/e2e.yml` (ou `actionlint` local). Expected: sem erros.

- [ ] **Step 3: Documentar o status check obrigatório.** No corpo do PR / descrição da task, registrar que em GitHub → Settings → Branches → regra de `main`, o check **`Playwright E2E`** deve ser marcado como *required* (config de UI, não versionável). Ref.: spec 16 §6.

- [ ] **Step 4: Commit.** `git add .github/workflows/e2e.yml && git commit -m "ci(e2e): blocking Playwright job on PRs (spec 58 Task 9)"`

---

### Task 10: Documentação e reconciliação de convenções

**Files:** Modify: `CLAUDE.md` §8; `skills/testing/SKILL.md` §2 e §12; `specs/13-testing.md` §12

- [ ] **Step 1: Documentar execução em `CLAUDE.md` §8** (após o bloco de Tests). Adicionar:

```bash
# E2E (Playwright) — sobe stack dedicada (postgres-e2e + app-e2e) e roda os testes
docker compose --profile e2e up --build --abort-on-container-exit --exit-code-from e2e-runner postgres-e2e app-e2e e2e-runner
docker compose --profile e2e down -v        # limpar (volume do DB de teste)

# Re-semear o DB de teste sem recriar a stack
docker compose exec app-e2e pnpm exec tsx e2e/fixtures/seed.ts
```

- [ ] **Step 2: Reconciliar `skills/testing/SKILL.md` §2.** Trocar a regra global por uma escopada:

`**Regra**: arquivo de teste ao lado do arquivo de origem. Arquivos `.test.ts` (nunca `.spec.ts`) **para testes Vitest em `src/`**. Testes E2E de Playwright usam `.spec.ts` sob `e2e/` (ver `specs/58-testes-e2e.md`).`

- [ ] **Step 3: Reconciliar `skills/testing/SKILL.md` §12.** Remover o bullet `❌ Fluxos E2E (ex: login → criar account → criar mês) — fica para v2` e substituir por: `Fluxos E2E ponta-a-ponta são cobertos por Playwright em `e2e/` (spec 58) — não por Vitest.`

- [ ] **Step 4: Reconciliar `specs/13-testing.md` §12** (se listar E2E como "v2"): apontar para a spec 58 como entrega do E2E.

- [ ] **Step 5: Commit.** `git add CLAUDE.md skills/testing/SKILL.md specs/13-testing.md && git commit -m "docs(e2e): document run cmds; reconcile testing skill/spec 13 (spec 58 Task 10)"`

---

### Self-Review (rodado contra a §4)

- **Cobertura da §4:** E2E-01 infra → Tasks 1, 2, 9, 10. Cenário 1a → Task 5. Cenário 1b → Task 8. CSV import → Task 6. Dashboards → Task 7. Rota protegida → Task 3. Viewer read-only → Task 4. Pipeline bloqueante → Task 9. ✅ Sem lacunas.
- **Placeholders:** os dois pontos de ajuste em runtime (célula de valor da nova-linha na Task 5; passo de Mapeamento na Task 6) estão marcados como **NOTA DE RUN** com a estratégia concreta — são os únicos selectors que o mapeamento estático não conseguiu fixar; devem ser confirmados no 1º run. Nenhum "TODO/TBD" cego.
- **Consistência de tipos:** `manifest()` retorna `SeedManifest` com `mainAccountId`/`inviteAccountId`/`roMonthId`/`roSectionId`/`users.{owner,editor,viewer,invitee}` — usados exatamente com esses nomes em todas as specs. `db` (PrismaClient) consistente Task 8.
- **Convenções:** `.spec.ts` só em `e2e/`; env via `env.E2E`; dinheiro `BigInt` no seed; sem edição de componente (selectors resolvidos por role/label/combobox-no-dialog). ✅

---

### 8.1 Ajustes aplicados na implementação (suíte verificada **green**: 10 passed / 0 failed)

Ao rodar o stack real (`docker compose --profile e2e`), a implementação divergiu do plano nos pontos abaixo. Os arquivos em `e2e/` + os fixes de fonte são a verdade; esta seção registra os deltas.

**Bug de produto encontrado pelo E2E (corrigido na fonte):**
- `src/components/finance-tables/FinanceTableCard.tsx` — `const isReadOnly = !sectionIsActive;` **ignorava `canEdit`** (recebido como prop). Um `viewer` via "Nova transação"/"Adicionar tabela" (viola §4). Corrigido para `!sectionIsActive || !canEdit`. Os toggles de linha (TransactionTable) já gateavam certo — por isso só o add-row vazava. **O teste `viewer-readonly` pegou isso.**

**Fixes de infra (fonte):**
- `next.config.ts` — `output: "standalone"` + `next start` é **não-suportado** (assets/hidratação inconsistentes → login flaky). Tornado condicional: `output: process.env.E2E === "true" ? undefined : "standalone"`. Prod inalterado.
- `docker-compose.yml` `app-e2e.command` — adicionado `pnpm prisma generate` **antes** do seed (volume `node_modules` vazio → `new PrismaClient()` quebrava); env `AUTH_TRUST_HOST: "true"` (NextAuth v5 exige host confiável em produção); serviços nomeados explicitamente no `up` (perfil `e2e` não exclui os serviços default `app`/`postgres`).
- `docker-compose.yml` `e2e-runner.command` — `corepack enable && corepack prepare pnpm@9.15.4 --activate` (pnpm default quebrava `--frozen-lockfile` com `Cannot find matching keyid`; `prepare --activate` sozinho não põe o shim no PATH).
- `tsconfig.json` — `exclude` inclui `"e2e"` (senão `next build`/`noUnusedLocals` type-checa specs e quebra o build de produção).
- `pnpm-lock.yaml` — regenerado com `@playwright/test` (o `--frozen-lockfile` do runner exige lockfile atualizado). **Revisar antes de commitar** — o `install --lockfile-only` re-resolveu vários deps para o patch mais novo dentro das ranges `^`.

**Fixes de teste:**
- **Login robusto (`e2e/fixtures/login.ts`, novo):** `loginAs()` re-tenta o submit até o cookie `authjs.session-token` aparecer (clique pré-hidratação vira no-op; checa cookie, não URL — robusto ao destino do redirect). Usado por `auth.setup.ts` e `invite-accept`.
- **`auth.setup.ts`:** só `owner`/`editor`/`viewer` (invitee saiu — login inline em `invite-accept`, p/ não bloquear os 6 cenários). Botão "Entrar" com `exact: true` (colide com "Entrar com Google" por substring).
- **`playwright.config.ts`:** `workers: 1` + `fullyParallel: false` (server E2E único; logins paralelos em server frio flakeavam); `timeout: 90_000` + `expect.timeout: 10_000`.
- **`e2e/fixtures/seed.ts`:** `onboardingCompletedAt` nas contas (senão `/{accountId}` redireciona p/ `/setup` e não há "Novo mês"); conta-home do `invitee` (login de usuário sem conta trava no pós-login).
- **`solo-flow` / `csv-import`:** navegam direto a uma página de mês (`/months/{roMonthId}`, tem "Novo mês") em vez do root; resolvem o `monthId` criado via `db` (não por URL). Célula de valor da nova-linha = `input[type="text"]:not([placeholder]):not([aria-label])`.
- **`csv-import`:** o StepMapping não auto-mapeia — o teste seleciona colunas data/valor/descrição + formato **US** (CSV usa `.` decimal com delimitador `,`); StepConfig exige nome da tabela + seção; finaliza por "Ver tabela" (fecha o wizard e navega à tabela).
- **`invite-accept`:** aceite verificado por **poll no DB** da membership (o aceite pode não redirecionar p/ fora de `/invite`); cleanup idempotente no início (reruns).

> **Comando canônico de verificação:** `docker compose --profile e2e up --build --abort-on-container-exit --exit-code-from e2e-runner postgres-e2e app-e2e e2e-runner`. Localmente, se o one-shot for interrompido, sobe-se `postgres-e2e`+`app-e2e` detached (`up -d --wait`) e roda-se `e2e-runner` à parte.
