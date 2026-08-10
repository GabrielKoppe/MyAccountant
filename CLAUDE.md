# CLAUDE.md — MyAccountant

> Documento de orientação (steering) para o Claude Code. **Leia este arquivo antes de qualquer task.** Ele contém o contexto persistente do projeto, convenções inegociáveis e ponteiros para as specs detalhadas.

---

## 1. O que é o MyAccountant

Aplicação web de organização financeira pessoal e colaborativa, estruturada por **Accounts** (grupos de usuários com permissões compartilhadas). Dados financeiros são organizados por mês → seção → tabela → transação.

**Diferencial**: colaboração entre membros de uma mesma Account com papéis (owner/editor/viewer) e flexibilidade total na organização das seções.

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript (strict) |
| Auth | NextAuth v5 (Auth.js) + Prisma Adapter |
| ORM | Prisma |
| Database | PostgreSQL 16 (em Docker localmente; Neon/VPS em prod) |
| Validação | Zod (server + client) |
| Forms | React Hook Form + `@hookform/resolvers/zod` |
| UI | Material UI v6 (`@mui/material`) + Emotion |
| Date pickers | `@mui/x-date-pickers` (adapter `date-fns`) |
| Charts | `recharts` (barras, pizza, treemap, sparkline) + `@nivo/sankey` (diagrama Sankey) |
| API REST | Route Handlers + `@asteasolutions/zod-to-openapi` + Swagger UI |
| Testing | Vitest + Testing Library + `vitest-mock-extended` |
| Email | Resend + React Email |
| Logging | Pino |
| Env vars | `@t3-oss/env-nextjs` |
| Containerização | Docker + Docker Compose (dev e prod) |
| CI | GitHub Actions |
| Deploy | Hybrid (Vercel + Neon) ou Docker em VPS (ver spec 12) |

---

## 3. Como o projeto está organizado

```
MyAccountant/
├── CLAUDE.md                    # Este arquivo
├── README.md                    # Visão humana do projeto
├── docker-compose.yml           # Stack local (postgres + app)
├── Dockerfile                   # Imagem de produção
├── Dockerfile.dev               # Imagem de desenvolvimento
├── .dockerignore
├── .env.example
├── .eslintrc.json
├── .prettierrc.json
├── .prettierignore
├── vitest.config.ts
├── .github/
│   ├── workflows/ci.yml
│   ├── dependabot.yml
│   └── pull_request_template.md
├── specs/                       # Specs por feature/fase
│   ├── 00-overview.md           # Visão geral + roadmap
│   ├── 01-domain-model.md       # Modelo de domínio
│   ├── 02-database-prisma.md    # Schema e convenções de DB
│   ├── 03-authentication.md     # NextAuth setup
│   ├── 04-accounts-and-members.md
│   ├── 05-account-settings.md
│   ├── 06-months.md
│   ├── 07-sections.md
│   ├── 08-finance-tables.md
│   ├── 09-transactions.md
│   ├── 10-csv-xlsx-import.md
│   ├── 11-dashboards.md
│   ├── 12-deployment-and-docker.md
│   ├── 13-testing.md            # Estratégia de testes (Vitest)
│   ├── 14-api-and-swagger.md    # REST API + OpenAPI
│   ├── 15-project-structure.md  # Camadas, naming, ESLint/Prettier
│   ├── 16-ci-cd.md              # GitHub Actions
│   └── 17-sandbox.md            # Sandbox de análise ad-hoc
└── skills/                      # Padrões reutilizáveis
    ├── design-system/SKILL.md   # Design system "Warm Calm" (tokens, paleta, tipografia)
    ├── money-handling/SKILL.md
    ├── multitenancy/SKILL.md
    ├── forms-zod-rhf/SKILL.md
    ├── prisma-conventions/SKILL.md
    ├── date-timezone/SKILL.md
    ├── mui-patterns/SKILL.md
    ├── server-actions/SKILL.md  # Padrão ActionResult, defineAction
    ├── email-resend/SKILL.md    # Resend + React Email
    ├── logging/SKILL.md         # Pino estruturado
    ├── env-validation/SKILL.md  # Zod env vars
    ├── testing/SKILL.md         # Vitest, mocks Prisma, fixtures, multi-tenancy tests
    ├── spec-writing/SKILL.md    # Como criar specs no modelo V2+ (specs 18+)
    ├── dashboard-widgets/SKILL.md # Criar e integrar widgets nos dashboards configuráveis
    ├── ui-feedback/SKILL.md     # Feedback de Server Actions: notistack, loading, useActionFeedback
    ├── api-routes/SKILL.md      # Route Handlers REST /api/v1/: defineRoute, OpenAPI, AppError
    └── rsc-client-boundary/SKILL.md # RSC vs Client, serialização BigInt/Date, React.cache, Suspense
```

---

## 4. Como usar este projeto (workflow)

1. **Antes de implementar qualquer feature**: leia o spec relevante em `specs/`.
2. **Antes de tocar código novo**: verifique se há um skill aplicável em `skills/`.
3. **Após implementar**: se descobriu um padrão novo, atualize o skill correspondente ou crie um novo.
4. **Se o spec estiver desatualizado em relação ao código**: atualize o spec primeiro, depois o código (spec-anchored).

> **Regra de ouro**: o spec é a fonte da verdade. Se houver divergência entre spec e código, pare e alinhe antes de continuar.

---

## 5. Convenções inegociáveis

### 5.1 Dinheiro
- **Sempre `BigInt` em centavos** no banco e no domínio. Nunca `Float`.
- Conversão centavos ↔ reais acontece **apenas na camada de apresentação**.
- Ver `skills/money-handling/SKILL.md`.

### 5.2 Multi-tenancy
- **Toda query que toca dados de Account precisa filtrar por `accountId`**.
- Toda Server Action começa com `requireAccountAccess(accountId)` (via `defineAction`).
- Ver `skills/multitenancy/SKILL.md`.

### 5.3 Datas
- `occurred_on` é `date` (sem timezone). Tratamento de timezone fica **na camada de apresentação**, usando `user_settings.timezone`.
- Cálculos de "mês atual" respeitam `account_settings.month_start_day`.
- Ver `skills/date-timezone/SKILL.md`.

### 5.4 Validação
- **Zod schemas são fonte única**. O mesmo schema valida o form (RHF), a Server Action, e gera OpenAPI.
- Schemas ficam em `src/lib/schemas/` agrupados por entidade.
- Ver `skills/forms-zod-rhf/SKILL.md`.

### 5.5 Server Actions
- **Toda action usa `defineAction()`** do `src/server/api/define-action.ts`.
- Action é só transporte; lógica vai pro service em `src/server/services/`.
- Retorno padronizado: `ActionResult<T>` (discriminated union `ok: true|false`).
- Ver `skills/server-actions/SKILL.md`.

### 5.6 Camadas
- **UI** chama Action (mutação) ou faz query Prisma (read em RSC).
- **Action / Route Handler** valida + chama **Service**.
- **Service** contém lógica de negócio, acessa Prisma.
- Ver `specs/15-project-structure.md`.

### 5.7 Logging
- **Sem `console.log`** em código de produção. Use o logger Pino.
- Logs estruturados (campos, não string concat).
- Ver `skills/logging/SKILL.md`.

### 5.8 Env vars
- **Nunca `process.env.X` direto**. Sempre via `env` de `src/lib/env.ts`.
- Ver `skills/env-validation/SKILL.md`.

### 5.9 Email
- **Templates em React Email** (`src/emails/`).
- Envio via `emailService.send(...)`, nunca `resend.emails.send` direto.
- Fire-and-forget por padrão. Log de toda tentativa.
- Ver `skills/email-resend/SKILL.md`.

### 5.10 Idioma
- Specs e comentários explicativos: **português**.
- Código, identificadores, nomes de tabelas/campos: **inglês**.
- **Mensagens de UI: centralizadas em `src/lib/messages/pt-BR.ts`** (preparação para i18n futuro).
- Ver `specs/15-project-structure.md` §8.

### 5.11 UI (Material UI + Design System)
- **Só MUI.** Não misturar com Tailwind, shadcn, CSS modules.
- **Sempre tokens semânticos** (`background.surface`, `accent.primary`), **nunca hex hardcoded** em componentes.
- Tema customizado "Warm Calm" definido em `src/lib/theme.ts` (light + dark).
- Tokens em `src/lib/design-tokens.ts`.
- Tipografia: Inter (sans) + JetBrains Mono (valores monetários).
- Cor é informação, não decoração: verde/vermelho/mostarda só com significado financeiro.
- Customização via `theme` + `sx prop` com tokens + `styled API`. **Nunca `!important` ou `style={}` inline com cores**.
- Ver `skills/design-system/SKILL.md` (tokens, padrões) e `skills/mui-patterns/SKILL.md` (integração MUI + Next.js).

### 5.12 Testes
- Vitest para unit + integration.
- Mock Prisma com `vitest-mock-extended`.
- **Sempre teste de multi-tenancy** em mutations.
- Ver `specs/13-testing.md`.

---

## 6. Fases de implementação

O projeto é dividido em fases independentemente testáveis. **Não pule fases**: cada uma assume a anterior como base.

| Fase | Conteúdo | Spec |
|---|---|---|
| 0 | Setup: Docker, Next.js, Prisma, NextAuth, Material UI | 02, 03, 12 |
| 1 | Auth (signup, login, OAuth) + seleção de Account | 03 |
| 2 | Accounts + Members + Invites | 04 |
| 3 | Account Settings (sections, categories, institutions, columns) | 05 |
| 4 | Months + navegação | 06, 07 |
| 5 | Finance Tables (CRUD + source methods) | 08 |
| 6 | Transactions (CRUD + bulk) | 09 |
| 7 | CSV/XLSX Import + Templates | 10 |
| 8 | Dashboards | 11 |

---

## 7. O que NUNCA fazer

### Backend / Dados
- ❌ Usar `Float` ou `Number` para valores monetários.
- ❌ Query sem filtro de `accountId` (vazamento entre tenants).
- ❌ Implementar feature sem ler o spec correspondente.
- ❌ Renomear `account` para `family` (resquício do MVP antigo — **não use**).
- ❌ Criar campos novos sem atualizar o spec de domínio (`01-domain-model.md`).
- ❌ Confiar em validação só no client. **Server Actions sempre revalidam com Zod**.
- ❌ Usar `getServerSession` legado — use `auth()` do NextAuth v5.
- ❌ Acessar `prisma` diretamente em Server Actions sem checar autorização do usuário.
- ❌ Rodar `pnpm` fora do container em dev (ambiente fica desalinhado).
- ❌ Lógica de negócio dentro de Server Action / Route Handler — **deve ir pro service**.
- ❌ `console.log` em código de produção — usar Pino logger.
- ❌ `process.env.X` direto no código — usar `env` de `src/lib/env.ts`.
- ❌ Hardcode de strings de UI em componentes — usar `src/lib/messages/`.
- ❌ Action sem teste de multi-tenancy quando há mutation.
- ❌ Action sem `defineAction()` wrapper — boilerplate fica fora de controle.

### UI / Design System
- ❌ Misturar **Tailwind**, **shadcn**, ou CSS modules com MUI — **só MUI**.
- ❌ Customizar componentes MUI via `!important` ou inline `style={}` — usar `sx`, `styled` ou tema.
- ❌ Hardcode de cores hex (`#1976d2`) em componentes — sempre tokens semânticos do tema.
- ❌ Usar `<Dialog>` cru do MUI — sempre **`<DialogShell>`** de `@/components/ui/DialogShell`.
- ❌ Criar estado vazio customizado — usar **`<EmptyState>`** de `@/components/ui/EmptyState`.
- ❌ Criar cabeçalho de página customizado — usar **`<PageHeader>`** de `@/components/ui/PageHeader`.
- ❌ Espaçamentos mágicos (`sx={{ p: 8 }}`, `spacing={6}`) — usar tokens semânticos de layout (`layout.page`, `layout.section`, `layout.cluster`, etc.) de `@/lib/design-tokens`.
- ❌ `success.50`, `error.50` — não existem no tema. Usar `success.light`, `warning.light`, `error.light` (o tema mapeia `.light` para o hex "subtle") ou `danger.subtle`. ⚠️ `success.subtle`, `warning.subtle` e `error.subtle` **não existem** — só `danger.subtle` e `neutral.subtle` (palettes customizadas com `main`+`subtle`). Token inexistente resolve para `undefined` e o MUI descarta a regra **em silêncio**, sem erro.
- ❌ `<Chip color="default" variant="outlined">` para status — usar `<StatusBadge variant="neutral">`.
- ❌ `elevation={N}` em `<Card>` — tema força elevation 0 + borda. Remover o prop.
- ❌ `fontWeight="bold"` em `<Typography variant="h1">` a `<Typography variant="h6">` — já vem do tema.
- ❌ `<Typography fontWeight="bold">` para enfatizar texto em headings — usar variante correta.
- ❌ Hardcode em SVG/recharts (`fill="#2e7d32"`) — usar `theme.palette.*` ou `getChartColors(mode)`.
- ❌ Implementar feature de UI sem testar em **light E dark mode**.
- ❌ Resolver o tema `system` via `useMediaQuery("(prefers-color-scheme: dark)")` no render inicial — no MUI v6 (useSyncExternalStore) o client lê o matchMedia ao vivo já no 1º render; se o SO estiver dark, diverge do SSR (que é sempre light) e TODOS os hashes de classe do Emotion quebram (hydration mismatch). `noSsr` não resolve. Aplique a preferência do SO só após montar (flag `mounted`), ou migre para CSS variables (`colorSchemes` + `prefers-color-scheme`). Ver `ThemeProviderClient.tsx`.

---

## 8. Comandos comuns

Todo trabalho de dev acontece **dentro de containers**. Use `docker compose exec app <comando>` ou abra um shell.

```bash
# Subir/parar stack
docker compose up -d
docker compose down

# Logs do app
docker compose logs -f app

# Abrir shell no container
docker compose exec app sh

# Comandos comuns (com prefix `docker compose exec app`)
docker compose exec app pnpm dev               # (já roda como CMD, normalmente desnecessário)

# Prisma
docker compose exec app pnpm prisma migrate dev --name <descritivo_em_snake_case>
docker compose exec app pnpm prisma migrate deploy
docker compose exec app pnpm prisma generate
# ⚠️ Após migrate/generate, REINICIE o dev app: `docker compose restart app`.
# O `next dev` mantém o Prisma Client (singleton em src/server/prisma.ts) carregado em
# memória desde o boot. `migrate dev`/`generate` atualizam o client no disco (typecheck vê),
# mas o processo em execução segue com o client ANTIGO → queries em runtime pedem colunas
# dropadas (ex.: PrismaClientKnownRequestError "column budgets.section_id does not exist")
# mesmo com typecheck limpo. Reiniciar recria o singleton com o client novo.
docker compose exec app pnpm prisma studio --browser none --hostname 0.0.0.0
docker compose exec app pnpm prisma validate
docker compose exec app pnpm prisma format

# Lint / format / typecheck
docker compose exec app pnpm lint
docker compose exec app pnpm lint:fix
docker compose exec app pnpm format
docker compose exec app pnpm format:check
docker compose exec app pnpm typecheck

# Tests
docker compose exec app pnpm test
docker compose exec app pnpm test:watch
docker compose exec app pnpm test:coverage

# E2E (Playwright) — sobe stack dedicada (postgres-e2e + app-e2e) e roda os testes
docker compose --profile e2e up --build --abort-on-container-exit --exit-code-from e2e-runner postgres-e2e app-e2e e2e-runner

# Limpar SÓ o DB de teste (NUNCA use `down -v`: apaga TAMBÉM o volume do dev postgres-data)
docker compose --profile e2e down
docker volume rm my-accountant_postgres-e2e-data

# Re-semear o DB de teste sem recriar a stack (SEMPRE contra app-e2e — NUNCA contra app/dev)
docker compose exec app-e2e pnpm exec tsx e2e/fixtures/seed.ts
```

> ⚠️ **Aviso de dados**: `docker compose down -v` é **global** — remove todos os volumes top-level do projeto, incluindo `postgres-data` (dev), independente de `--profile`. Para limpar só o DB de teste, use os comandos acima (`down` sem `-v` + `docker volume rm my-accountant_postgres-e2e-data`). O seed E2E (`e2e/fixtures/seed.ts`) faz um **reset global** das tabelas (deleta todas as linhas) — só deve rodar contra o container `app-e2e` (banco `myaccountant_e2e`), **nunca** contra `app` (dev), sob risco de apagar os dados de desenvolvimento.
>
> ⚠️ **`docker compose --profile e2e down` (sem `-v`) também para/remove os containers `app`/`postgres` do dev** (confirmado na prática) — serviços sem `profiles:` no compose são sempre considerados ativos, então entram no escopo do `down` junto com `postgres-e2e`/`app-e2e`/`e2e-runner`. Os dados do dev **não são perdidos** (o volume `postgres-data` não é tocado sem `-v`), mas o stack de dev fica fora do ar até você rodar `docker compose up -d` de novo. Se estiver com o dev rodando e só quiser limpar o e2e, rode `docker compose up -d` logo em seguida para restaurar o `app`/`postgres` do dev.

```bash
# Email preview (React Email)
docker compose exec app pnpm email   # http://localhost:3001

# Swagger UI
# Acesse http://localhost:3000/api/docs no navegador

# Reset do DB (cuidado — apaga TODOS os volumes, dev + e2e; só use para reset total intencional do dev)
docker compose down -v
docker compose up -d
docker compose exec app pnpm prisma migrate dev
```

> Ver `specs/12-deployment-and-docker.md` para detalhes de containerização e deploy.

---

## 9. Quando estiver em dúvida

1. Verifique o spec da feature em `specs/`.
2. Verifique se há um skill em `skills/` para o padrão.
3. Se ainda houver dúvida, **pergunte ao desenvolvedor com opções claras** (use multiple choice quando possível).
4. **Não chute**: implementação errada custa mais que uma pergunta extra.

---

## 10. Auto-aprendizado

**Objetivo**: transformar fricção recorrente em melhoria permanente do projeto — não repetir o mesmo erro em sessões futuras.

**Ao iniciar uma sessão**: se `DESAFIOS.md` existir na raiz, leia-o antes de começar a task.

**Ao encontrar fricção, erro repetível ou padrão não óbvio durante a sessão**, roteie o aprendizado — nesta ordem de prioridade (pare no primeiro que se aplicar):

1. **É corrigível agora?** → Corrija na fonte (código, config, doc) nesta sessão.
2. **É sobre um padrão de código?** → Atualize o `skills/<nome>/SKILL.md` correspondente (ou crie um novo skill).
3. **É sobre o comportamento de uma feature?** → Atualize o `specs/NN-*.md` correspondente.
4. **Nenhum acima?** → Registre em `DESAFIOS.md` na raiz, com: **sintoma** (o que travou), **causa** (por quê), **como evitar** (o que fazer da próxima vez).

**Regra de ouro**: prefira corrigir a fonte (código/skill/spec) a acumular notas em `DESAFIOS.md`. O `DESAFIOS.md` é o último recurso — só para o que ainda não cabe em skill nem spec.

---

## 11. Gestão de contexto

**Tarefa multi-step**: antes de começar, registre plano e progresso num arquivo `.md` (o quê já foi feito, o quê falta, decisões tomadas). Atualize a cada passo concluído — assim eu posso compactar ou abrir nova sessão sem perder contexto.

**Quando o contexto atual não for mais necessário** (fim de uma sub-tarefa, mudança de assunto): sugira `/compact` ou nova sessão, para economizar tokens. Não espere eu pedir.

**Ao terminar um passo**, diga qual modelo o próximo passo precisa e por quê:

| Modelo | Quando |
|---|---|
| **Opus** | Decisão de design, arquitetura, ou plano ainda ambíguo. |
| **Sonnet** | Plano claro, implementação de complexidade média. |
| **Haiku** | Tarefa puramente mecânica (rename, format, boilerplate repetitivo). |

---

## 12. Decisões técnicas

**Quando surgir uma decisão técnica** (escolha de stack, biblioteca, padrão de código, segurança, manutenibilidade), NÃO escolha silenciosamente. Apresente, nesta ordem:

1. **Opções** — as alternativas viáveis, com prós e contras de cada uma.
2. **Trade-offs** — impacto concreto em complexidade, manutenção, performance e lock-in.
3. **Recomendação** — sua escolha, justificada por critérios técnicos, `DRY` e código limpo.

Use múltipla escolha (`AskUserQuestion`) quando as opções forem discretas e comparáveis.