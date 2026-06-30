# Skills — MyAccountant

> Catálogo dos **skills** (padrões reutilizáveis) do projeto. Complementa o `CLAUDE.md` (§3) e as `specs/`.
> **Regra de ouro:** antes de tocar em código de uma área, verifique se há um skill aplicável aqui e leia-o.

---

## O que é um skill (e o que NÃO é)

Um skill deste projeto é um **guia de padrão concreto e específico do MyAccountant**: ele responde "como fazemos *X* **neste** código", com as convenções inegociáveis, os wrappers/utilitários reais (`defineAction`, `useActionFeedback`, tokens do tema, etc.) e exemplos alinhados ao nosso stack (Next.js 15 + TypeScript + Prisma + MUI v6 + Zod).

**Não pertencem a esta pasta:**

- ❌ "Personas" genéricas de agente (`backend-developer`, `database-administrator`, `mobile-developer`, …) — descrições de papel multi-stack, sem contexto do projeto, que duplicam ou contradizem nossas convenções. **Persona é subagente, não skill** → mora em `.claude/agents/` (ver fim).
- ❌ Skills de estilo/preferência pessoal (ex.: modos de comunicação). Esses vão em `~/.claude/skills/`, não no repositório.
- ❌ Guias que assumem arquiteturas que não usamos (microserviços, Kafka, data warehouse/BI, HA/replicação de banco, React Native/Flutter).

> Uma leva de personas genéricas multi-stack foi adicionada e depois removida em 2026-06-30 por não se encaixarem no projeto; as que faziam sentido viraram **subagents sob medida** em `.claude/agents/`. Antes de adicionar um skill novo de fonte externa, confirme que ele descreve um padrão **deste** código — caso contrário, ele só polui a seleção de skills.

### Convenções de formato

A maioria dos skills do projeto começa com `# SKILL — <Título>` (ou `# Skill: <Título>`) seguido de uma seção **`## Quando usar`** em português. As exceções são dois skills de **fonte externa** com frontmatter YAML — `react-best-practices` (Vercel) e `frontend-design` (Anthropic); veja a observação no fim.

---

## Catálogo

### Domínio & dados

| Skill | Quando usar |
|---|---|
| [money-handling](money-handling/SKILL.md) | Qualquer valor monetário: `BigInt` em centavos no domínio/DB, conversão p/ reais só na apresentação. |
| [multitenancy](multitenancy/SKILL.md) | Toda query/action/route que toca dados de `Account`: filtrar sempre por `accountId`, `requireAccountAccess`. |
| [date-timezone](date-timezone/SKILL.md) | Datas e timezones: `occurred_on` sem tz, cálculo de "mês" com `month_start_day`, conversões na apresentação. |
| [prisma-conventions](prisma-conventions/SKILL.md) | Mexer no `schema.prisma`, migrations, queries/mutations: naming, índices e patterns comuns. |

### Server, API & infra de aplicação

| Skill | Quando usar |
|---|---|
| [server-actions](server-actions/SKILL.md) | Toda Server Action: wrapper `defineAction`, retorno `ActionResult`, validação, autorização e erros. |
| [api-routes](api-routes/SKILL.md) | Route Handlers REST em `/api/v1/`: `defineRoute`, auth, `AppError`, OpenAPI/Swagger. |
| [env-validation](env-validation/SKILL.md) | Variáveis de ambiente: sempre via `env` (Zod), nunca `process.env.X` direto. |
| [logging](logging/SKILL.md) | Logs no servidor: Pino estruturado, sem `console.log` em produção. |
| [email-resend](email-resend/SKILL.md) | Envio de email (verificação, invite, reset, notificações): React Email + `emailService`. |

### Forms & validação

| Skill | Quando usar |
|---|---|
| [forms-zod-rhf](forms-zod-rhf/SKILL.md) | Qualquer formulário: Zod como fonte única + React Hook Form, mensagens em pt-BR, mesmo schema no client e server. |

### UI & design system

| Skill | Quando usar |
|---|---|
| [design-system](design-system/SKILL.md) | Antes de criar/alterar qualquer UI: filosofia "Warm Calm", tokens semânticos, layout, wrappers e componentes MUI permitidos. |
| [mui-patterns](mui-patterns/SKILL.md) | Integração de MUI com Next.js App Router, RSC e React Hook Form. |
| [ui-feedback](ui-feedback/SKILL.md) | Feedback de Server Actions na UI: loading, erros inline, toasts (notistack) e `useActionFeedback`. |
| [rsc-client-boundary](rsc-client-boundary/SKILL.md) | RSC vs Client Components, serialização na fronteira (BigInt/Date) e carregamento progressivo. |
| [frontend-design](frontend-design/SKILL.md) | Direção criativa ao criar/redesenhar UI: tese visual, tipografia intencional, fugir de defaults "templados". Complemento criativo do `design-system` (skill da Anthropic — ver observação no fim). |
| [mui-motion](mui-motion/SKILL.md) | Motion/animação intencional: tokens `motion.duration`/`motion.easing`, transições MUI (Fade/Grow/Collapse), reveal de charts e `prefers-reduced-motion`. |
| [dark-mode](dark-mode/SKILL.md) | Disciplina de dark mode: cor por token que vira no modo, hierarquia por superfície (não sombra), dessaturação semântica, charts e contraste no escuro. |

### Dashboards

| Skill | Quando usar |
|---|---|
| [dashboard-widgets](dashboard-widgets/SKILL.md) | Criar, registrar e integrar widgets nos dashboards configuráveis (grade 2D, Spec 36). |
| [dashboards-charts](dashboards-charts/SKILL.md) | Camada **técnica** de visualizações: conversão `BigInt`→`Number`, paleta via design system, `recharts`/`@nivo/sankey`, DrillDown e sparkline. |
| [chart-strategy](chart-strategy/SKILL.md) | Camada de **decisão e criatividade**: qual gráfico responde à pergunta, anti-padrões de escolha, complementos de insight (meta, média móvel, YoY/MoM, benchmark). Complementa `dashboards-charts`. |

### Performance

| Skill | Quando usar |
|---|---|
| [performance](performance/SKILL.md) | Padrões de performance do projeto (Spec 39): `loading.tsx` vs Suspense, `revalidatePath`, `React.cache()`, `dynamic()` p/ charts, agregação no Postgres. |
| [react-best-practices](react-best-practices/SKILL.md) | Guia geral de performance React/Next.js da Vercel (70 regras, 8 categorias) — ao escrever/revisar/refatorar componentes e data fetching. |

### Testes

| Skill | Quando usar |
|---|---|
| [testing](testing/SKILL.md) | Toda feature/alteração em service ou utilitário: Vitest + Testing Library, mock de Prisma com `vitest-mock-extended`, fixtures e teste obrigatório de multi-tenancy em mutations. |
| [e2e-testing](e2e-testing/SKILL.md) | Abordagem/convenções de testes ponta-a-ponta (Playwright) para a spec 58: app real em Docker, auth fixture, seed de DB, fluxos críticos e multi-tenancy E2E. |

### Processo & meta

| Skill | Quando usar |
|---|---|
| [spec-writing](spec-writing/SKILL.md) | Criar ou revisar specs no modelo V2+ (specs 18+): formato canônico, estrutura, qualidade e checklist. |

---

## Skills de fonte externa

Dois skills aqui não são padrões "deste código" — são guias genéricos de alta qualidade, mantidos por serem diretamente úteis ao stack:

- **[`react-best-practices`](react-best-practices/SKILL.md)** — base de regras de performance React/Next.js da **Vercel Engineering** (MIT). Frontmatter YAML + diretório [`rules/`](react-best-practices/rules/) (um arquivo por regra) + [`AGENTS.md`](react-best-practices/AGENTS.md) compilado (70 regras, 8 categorias). Complementa [`performance`](performance/SKILL.md) e [`rsc-client-boundary`](rsc-client-boundary/SKILL.md).
- **[`frontend-design`](frontend-design/SKILL.md)** — guia de **direção criativa de design** da **Anthropic**. Não prescreve paleta; ensina a pensar design intencional e fugir do "template default". Complementa o [`design-system`](design-system/SKILL.md) (que fixa os tokens/paleta "Warm Calm"): este diz *o quê* é fixo, o `frontend-design` diz *como pensar* o visual.

## Subagents relacionados (`.claude/agents/`)

Personas de desenvolvimento não vivem aqui (skill ≠ persona). As que valem a pena foram escritas **sob medida** para o stack do MyAccountant como subagents, selecionáveis pela ferramenta Agent:

- **`myaccountant-reviewer`** — revisor read-only que checa as convenções inegociáveis do projeto (BigInt, multi-tenancy, `defineAction`, MUI-only, Pino, Zod, RSC).
- **`react-specialist`** — React 19 + Next.js 15 + MUI v6, server-action-centric (sem Redux/Zustand/Tailwind).
- **`architect-reviewer`** — revisão de arquitetura macro calibrada para o monólito modular spec-anchored (não microserviços), com contexto do V3.
- **`ui-critique`** — auditor visual/UX read-only: cor & contraste, hierarquia, densidade, paridade light/dark, motion e a11y, na lente "Warm Calm".

Skills de uso geral/pessoal (ex.: `caveman`) e padrões de dev (superpowers, playwright, etc.) ficam em `~/.claude/skills/`, fora do repo.

---

## Pool de ideias & skills planejadas (V3)

Boas ideias do levantamento de skills externas (2026-06-30) que **não** viraram skill agora — nascem junto da feature/spec correspondente (workflow "skill segue implementação"). Origem entre parênteses.

| Ideia / skill futura | Forma | Gatilho (spec/feature) | Origem |
|---|---|---|---|
| **open-finance-sync** | skill nova | spec 52 (Pluggy): idempotência, dedup, webhooks, jobs, segredos via `env` | system-design (BOTEC, api-design, task-scheduling, resilience, caching) |
| **ai-assistant** | skill nova | spec 55: tool-use com `accountId` estrito, streaming, custo | built-in `claude-api` |
| Paginação por cursor / escala | estender `prisma-conventions` + `performance` | spec 56 | system-design (api-design, data-storage) |
| Autorização intra-Account | estender `multitenancy` | specs 42/43/44 (visão por membro, privacidade, papel accountant) | designer-skills (state-machine p/ permissão) |
| **form-design** (UX de formulário) | partes em `forms-zod-rhf` | ao mexer em forms de transação/import/onboarding | designer-skills |
| **error-handling-ux** / **loading-states** / **feedback-patterns** | partes em `ui-feedback` | ao tocar erros/skeletons/feedback | designer-skills |
| **onboarding-design** | ideia | revisão do onboarding (spec 26) | designer-skills |
| **search-ux** | ideia | busca de transações (spec 19) | designer-skills |
| **design-principles** | estender `design-system` (formalizar "Warm Calm" em 3–5 princípios) | ao consolidar o design system | designer-skills + taste-skill |
| Regras "fintech" + 25 chart types | ideia em `frontend-design`/`chart-strategy` | ao desenhar telas hero novas (net worth, previsão) | ui-ux-pro-max (só ler — é Tailwind, não instalar) |
| **figma → MUI** | skill, se adotar Figma | se incorporar Figma ao fluxo | figma-implement-design |
| Detecção automática de anti-padrões (CLI) | avaliar ferramenta | se quiser QA visual automatizado | impeccable (só o CLI) |

> **Não instalado por decisão:** `impeccable`/`motion-design` global (design fica melhor no projeto), `context7` (avaliar depois), `claude-mem` (infra pesada + já há memória no `~/.claude`), `taste-skill`/`ui-ux-pro-max` (Tailwind, conflita com MUI-only), `system-design`/`brandkit`/`theme-factory` (fora de escopo / superados pelo que já existe).
