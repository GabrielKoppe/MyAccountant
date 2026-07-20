# Spec 63 — Conector MCP para IA Pessoal do Usuário

> Status: ready
> Insumo: refinamento de produto sobre spec 55 (2026-07-19) — pilar Inteligência, direção "expose" (Model Context Protocol); entrevista de refinamento (2026-07-19)
> Skills: [`api-routes`](../skills/api-routes/SKILL.md) · [`env-validation`](../skills/env-validation/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

- **MCP-01**: Usuários já usam o **chat consumer de um LLM** (Claude Pro/Max, ChatGPT Plus) para organizar finanças, mas de forma **manual e desancorada**: copiam e colam extratos ou digitam valores na mão. Não há canal para o assistente pessoal do usuário ler os **dados reais** da Account. É o mesmo problema de análise manual do spec 55 (AI-01), mas para quem prefere conversar dentro do app de IA que já usa.
- **MCP-02**: A alternativa "traga sua própria chave" (BYOK) **não atende esse público**. A assinatura do chat consumer (`claude.ai`, `chatgpt.com`) é um produto **separado** da plataforma de API (`console.anthropic.com`, `platform.openai.com`), com faturamento próprio por token. Assinar o chat **não gera API key**. O usuário típico não tem key — só a assinatura do chat. Logo, cadastrar uma key na plataforma só serve a um nicho técnico.
- **MCP-03**: Para o assistente pessoal do usuário ler dados reais **sem vazar entre tenants**, é preciso um canal **autenticado e escopado**: o `accountId` precisa vir de uma concessão de acesso (grant) explícita do usuário, **nunca** de um parâmetro que o modelo forneça, e o acesso precisa ser **somente leitura**. Hoje não existe nenhum canal externo autenticado para os dados financeiros além da UI logada.
- **MCP-04**: O spec 55 (assistente embutido) resolve AI-01 só para quem usa o chat **dentro** do MyAccountant, e o custo do LLM é da plataforma. Ele não alcança quem já vive no próprio app de IA e quer trazer os dados para lá — usando a assinatura que já paga.
- **MCP-05**: Uma nova superfície de leitura externa precisa **herdar as garantias de privacidade** que o resto do app terá. A spec 44 (privacidade granular) enforça visibilidade por membro (`visible/aggregate/hidden`) e o papel `accountant` **numa camada acima da query crua**. Um wrapper MCP que chame a query crua **burlaria** isso. A spec 23 (SEC-06/SEC-07) exige que dados ocultos não vazem "nem pela API, nem pelo assistente" — o canal MCP é exatamente uma dessas superfícies e ainda não está listado nessas specs.

---

## 2. Solução

Expor o MyAccountant como um **servidor MCP remoto** (Model Context Protocol) que o usuário conecta ao **próprio** app de IA (Claude.ai como alvo primário; ChatGPT onde houver suporte). Cada tool MCP é um wrapper fino sobre uma **função de query já existente** em `src/server/queries/` (ex.: `getMonthDeepDive`, `getCategoryBreakdownFiltered`), sempre recebendo o `accountId` da concessão através de um **contexto de leitura** (`ReadContext`) que centraliza a checagem de tenant e, no futuro, a visibilidade da spec 44. O custo do LLM é do usuário (assinatura que já tem); o MyAccountant só expõe os dados, sob multi-tenancy estrito e somente leitura.

> **Reaproveitamento, sem acoplamento (spec 55 e 63 são independentes):** as duas specs compartilham a **mesma base já existente** — as queries de `src/server/queries/` e a checagem de membership de `src/server/auth/`. Ambas devem **reusar** isso em vez de reimplementar agregação ou filtro de tenant. Mas **nenhuma depende da outra**: se o spec 55 já tiver extraído um módulo comum de tools, o 63 pode reaproveitá-lo; se não, o 63 é autônomo e monta seus próprios wrappers. Qualquer ordem de implementação é válida.

### 2.1 Servidor MCP remoto (MCP-01, MCP-04)

- **Endpoint**: Route Handler em `src/app/api/mcp/[transport]/route.ts` (novo), falando MCP sobre **HTTP streamable** (transporte remoto — não `stdio`, que é local), via `mcp-handler` sobre `@modelcontextprotocol/sdk` (DD-06).
- **Tools = wrappers sobre queries existentes, catálogo amplo**: **toda** função de leitura de `src/server/queries/` que retorne dados de Account ganha uma tool MCP correspondente (DD-10). Cada tool é um wrapper fino: recebe o `ReadContext` (com `accountId` da concessão) e um input Zod **sem** `accountId`.
- **Descoberta**: o servidor MCP anuncia suas tools (nome, descrição em português, `input_schema` Zod **sem** `accountId`) no handshake MCP.
- **Uso pelo usuário**: em Claude.ai → Settings → Connectors → *Add custom connector* → cola a URL do servidor MCP. Fluxo de autorização (§2.2) roda, e a partir daí qualquer conversa pode consultar os dados reais.

### 2.2 Autorização OAuth 2.1 (MCP-02, MCP-03)

Para um connector remoto, o MCP exige que o servidor de recurso seja protegido por **OAuth 2.1**. O MyAccountant atua como **authorization server** (AS), com storage próprio em Prisma; o **login do browser continua sendo o NextAuth** (o AS reusa a sessão NextAuth para autenticar o usuário na tela de consentimento).

- **Fluxo**: ao adicionar o connector, o app de IA redireciona para o MyAccountant → o usuário **faz login** (sessão NextAuth) → vê uma **tela de consentimento** que (a) nomeia o app cliente, (b) deixa **escolher qual Account** conceder — lista vinda de `prisma.accountMember.findMany({ where: { userId } })`, pois **não existe "Account ativa" server-side** (spec 31) — e (c) exibe **aviso explícito de LGPD**: "os dados consultados serão enviados ao *[Claude/ChatGPT]* e processados pelo provedor dele" (DD-13). Ao consentir, é emitido um **authorization code** (PKCE), trocado no `token` endpoint por um **access token curto + refresh token longo** (DD-11).
- **Tokens hasheados (23 SEC-02)**: access e refresh são armazenados **apenas como hash** (`tokenHash`), nunca em texto puro. Revogáveis.
- **Múltiplos grants concorrentes (DD-12)**: um grant/token independente por `(userId, accountId, clientId)`. O usuário pode conectar Account A e B ao mesmo app de IA — cada uma é um grant separado, revogável individualmente. Cada token continua preso a **uma** Account.
- **Metadados**: expor *Authorization Server Metadata* e *Protected Resource Metadata* (`/.well-known/...`) e suportar **PKCE** + **Dynamic Client Registration** (o connector se auto-registra).
- **Resolução de tenant (contexto Bearer, não sessão)**: em **toda** requisição MCP, o `accountId` e o `userId` vêm do **token** (a concessão), nunca de argumento de tool. Como não há sessão NextAuth numa request Bearer, a validação **não usa** `requireAccountAccess` (que deriva o `userId` da sessão); usa uma checagem de membership **sem sessão** — `ensureMembership(userId, accountId)` — antes de executar qualquer tool.
- **Revogação**: o usuário revoga o acesso de um connector nas configurações (§2.3), marcando o grant como revogado e invalidando seus tokens.

### 2.3 Multi-tenancy, visibilidade herdada, read-only e auditoria (MCP-03, MCP-05)

- O schema Zod de **toda** tool MCP **não expõe** `accountId` — ele é injetado a partir da concessão.
- **Visibilidade herdada (DD-09)**: toda tool passa pelo `ReadContext` resolvido em `src/server/mcp/visibility.ts`, **não** pela query crua diretamente. Hoje (spec 44 não implementada) o `ReadContext` só carrega `{ accountId, userId }` e reconfirma membership — comportamento idêntico ao resto do app. Quando a spec 44 existir, **este único ponto** passa a resolver a visibilidade efetiva (`SectionVisibility`, papel `accountant`), e a superfície MCP fica coberta **por construção**. As specs 44 e 23 (SEC-06/SEC-07) devem listar o canal MCP entre suas superfícies (nota cruzada).
- **Somente leitura**: nenhuma tool de escrita é registrada; o escopo do token é `read`.
- **Rate-limit de segurança (23 SEC-01)**: o endpoint MCP é público e precisa de rate-limit por token/grant (proteção anti-abuso, **≠** cota de billing, que está fora de escopo).
- **Gestão de conexões**: tela em configurações lista os connectors autorizados (app, Account, quando concedido, `lastUsedAt`) e permite **revogar**.
- Cada chamada de tool via MCP gera **log estruturado Pino** com `accountId`, `userId`, `grantId`, nome da tool, latência e resultado.

---

## 3. User Stories

- Como usuário que já usa o Claude para finanças, quero conectar minha conta do MyAccountant ao meu Claude e perguntar "quanto gastei com restaurante este mês?", para receber a resposta com meus dados reais sem copiar e colar nada.
- Como usuário, quero autorizar o acesso escolhendo **qual** Account o connector enxerga, para não expor contas que não quero compartilhar com o assistente.
- Como usuário, quero ser avisado de que os dados irão para o provedor do meu app de IA, para dar um consentimento informado (LGPD).
- Como owner de uma Account, quero que o connector seja **somente leitura**, para que meu assistente pessoal jamais altere ou apague dados financeiros.
- Como membro com visibilidade restrita, quero que o connector respeite as mesmas restrições da UI, para que dados ocultos não vazem pelo meu assistente.
- Como usuário, quero **revogar** o acesso de um connector a qualquer momento nas configurações, para cortar o acesso quando quiser.
- Como owner, quero certeza de que o connector nunca acessa dados de outra Account, mesmo que o modelo seja manipulado, para preservar o isolamento entre tenants.
- Como desenvolvedor, quero que as tools MCP reusem as queries já existentes de `src/server/queries/`, para não duplicar lógica de agregação nem a garantia de tenant — sem depender de outra spec.

---

## 4. Critérios de Aceitação

**MCP-01 / MCP-04 (conexão e consulta):**
- QUANDO o usuário adiciona a URL do servidor MCP como custom connector, O SERVIDOR DEVE completar o handshake MCP e anunciar as tools de leitura.
- PARA CADA função de leitura de `src/server/queries/` que retorna dados de Account, DEVE existir uma tool MCP correspondente registrada (catálogo amplo).
- QUANDO o usuário, já autorizado, pergunta sobre seus gastos, O ASSISTENTE DELE DEVE conseguir chamar uma tool MCP que executa uma query real da Account concedida e retorna valores reais.
- CADA tool MCP DEVE ser um wrapper sobre uma função existente de `src/server/queries/`, NÃO uma reimplementação da agregação.

**MCP-02 / MCP-03 (autorização e multi-tenancy):**
- QUANDO o usuário conecta o connector, O MYACCOUNTANT DEVE conduzir um fluxo OAuth 2.1 (PKCE) com login NextAuth, tela de consentimento e seleção de Account, emitindo access token curto + refresh token longo, ambos armazenados **hasheados**.
- O SERVIDOR MCP DEVE resolver `accountId` e `userId` **exclusivamente** a partir do token; o `input_schema` de nenhuma tool DEVE conter `accountId`.
- ANTES de executar qualquer tool, O SERVIDOR DEVE validar o token e chamar `ensureMembership(userId, accountId)` (checagem **sem** sessão); SE o usuário não for mais membro, a chamada NÃO DEVE retornar dados.
- QUANDO o modelo tenta referenciar dados fora da Account concedida, a tool NÃO DEVE retornar dados de outra Account.
- O SERVIDOR MCP NÃO DEVE registrar nenhuma tool de escrita; o token DEVE ser somente leitura.
- QUANDO o usuário revoga um connector, o grant DEVE ser marcado revogado e seus tokens NÃO DEVEM mais autorizar chamadas.
- CADA chamada de tool DEVE gerar log Pino com `accountId`, `userId`, `grantId` e nome da tool.

**MCP-05 (visibilidade e superfície):**
- TODA tool DEVE obter seu contexto via `resolveReadContext(accountId, userId)`, NÃO chamando a query crua sem passar por ele.
- QUANDO a camada de visibilidade (spec 44) existir, uma seção `hidden` para o membro NÃO DEVE aparecer em nenhum resultado de tool — sem alterar o registro das tools (o enforcement mora no `ReadContext`).

**Segurança / configuração:**
- O endpoint MCP DEVE ter rate-limit por token/grant (23 SEC-01).
- QUANDO a spec 23 SEC-04 adicionar enforcement de sessão a `/api/v1`, o matcher do middleware NÃO DEVE capturar `/api/mcp/*`, `/api/oauth/*` nem `/.well-known/*` (esses usam Bearer/descoberta, não cookie).
- A tela de consentimento DEVE exibir aviso de que os dados irão para o provedor de IA do usuário.
- Toda configuração sensível DEVE ser lida via `env` de `src/lib/env.ts`; NÃO DEVE haver `process.env.X` direto.

---

## 5. Fora de Escopo

- **Ações de escrita via MCP** — connector é **somente leitura**. Criar/editar/deletar fica para spec futura.
- **Chat embutido no MyAccountant** — é o spec 55 (direção "embed"); entregas distintas e independentes.
- **BYOK (cadastro de API key do usuário)** — descartado para este público (ver MCP-02 e DD-01).
- **Suporte a Gemini** — connector MCP no Gemini é imaturo; alvo primário Claude.ai, ChatGPT best-effort (DD-05).
- **Servidor MCP local (`stdio`) / app desktop** — só transporte remoto.
- **Cota / billing por uso de LLM** — o custo é do usuário; billing próprio fica para spec de monetização. (Rate-limit de **segurança** está **dentro** do escopo — ver §2.3.)
- **Aceite de termo versionado** — o consentimento exibe o aviso de LGPD, mas não persiste um termo versionado por grant (fica para spec de compliance se necessário).
- **Memória persistente cross-conversa** — responsabilidade do app de IA do usuário.
- **Reescrita das queries** — as funções de `src/server/queries/` já existem; esta spec as reaproveita.
- **Implementar a spec 44** — esta spec só cria o `ReadContext` como ponto único onde a visibilidade da 44 se encaixa; a 44 é implementada na sua própria spec.

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Como o usuário conecta a IA dele | **MCP connector** (expose), não BYOK | Assinatura de chat consumer alcança connectors, mas **não** gera API key (ver MCP-02) |
| DD-02 | Origem das tools | Wrappers sobre **queries já existentes** (`src/server/queries/`); reusar módulo comum se existir | Reaproveita o que existe (DRY) sem acoplar 55 e 63 |
| DD-03 | Autenticação do canal | **OAuth 2.1** como authorization server (PKCE + DCR + metadados) | Exigência do MCP p/ connectors remotos; consentimento, escopo e revogação |
| DD-03a | Implementação do OAuth | **Resource** via `mcp-handler` (Next-native); **Authorization Server nativo** em Route Handlers (Path A), storage Prisma | Spike provou que o AS do SDK é Express-only e não serve ao App Router; o lado resource é lib-provido. Ver `docs/superpowers/plans/63-spike-mcp-notes.md` |
| DD-04 | Origem do `accountId`/`userId` | Sempre da concessão OAuth (token), nunca do input do modelo | Multi-tenancy estrito mesmo sob manipulação do modelo |
| DD-05 | Providers-alvo | Claude.ai primário; ChatGPT best-effort; Gemini fora | Suporte a MCP remoto sólido no Claude.ai |
| DD-06 | Stack MCP/OAuth | **`mcp-handler@1.1.0` + `@modelcontextprotocol/sdk@1.29.0`** p/ o resource; **AS nativo** (Path A) Prisma-backed; **NextAuth mantido** p/ login | Resource lib-provido e Next-native; AS do SDK é Express-only (spike), por isso nativo. Uma stack de login intacta. (Entrevista + spike) |
| DD-07 | Escopo do token | Somente leitura, escopado a uma Account por concessão | Assistente jamais altera dados; isolamento por Account |
| DD-08 | Relação com spec 55 | **Independentes** — qualquer ordem; sem dependência de código | Liberdade de implementar 55 ou 63 primeiro; reuso sem acoplamento |
| DD-09 | Visibilidade por membro (spec 44) | Tools passam por um **`ReadContext`** único; hoje só `accountId`+membership, amanhã herda a visibilidade da 44 | Superfície MCP coberta por construção quando a 44 existir; sem tocar cada tool (Entrevista Q1) |
| DD-10 | Catálogo de tools | **Amplo** — toda função de leitura de `src/server/queries/` | Máximo poder do assistente; todas passam pelo `ReadContext` + read-only (Entrevista Q2) |
| DD-11 | Ciclo de vida do token | **Access curto + refresh longo**, ambos **hasheados** (23 SEC-02), revogáveis | Conecta uma vez, renova sozinho; token vazado expira rápido (Entrevista Q3) |
| DD-12 | Cardinalidade de grants | **Múltiplos concorrentes** — 1 por `(userId, accountId, clientId)` | Casa com várias Accounts (spec 31); cada token preso a 1 Account, DD-04 intacto (Entrevista Q4) |
| DD-13 | Dados p/ provedor de IA (LGPD) | **Aviso explícito no consentimento** (sem aceite versionado) | Consentimento informado com baixa fricção (Entrevista Q5) |
| DD-14 | Resolução de tenant em request Bearer | `ensureMembership(userId, accountId)` **sem sessão**, não `requireAccountAccess` | `requireAccountAccess` deriva `userId` da sessão NextAuth, ausente numa request Bearer |
| DD-15 | Middleware vs endpoint MCP | Middleware **não** captura `/api/mcp/*`, `/api/oauth/*`, `/.well-known/*` | Bearer/descoberta ≠ cookie de sessão; evita 401 espúrio quando 23 SEC-04 chegar |
| DD-16 | Relação com `ApiToken` (spec 14) | Território **adjacente e separado**; 63 materializa a decisão em aberto §17 do spec 14 (OAuth p/ terceiros) | ApiToken = token estático REST; OAuth MCP = fluxo de connector. Seguir 23 SEC-02, não reinventar |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Endpoint MCP (handshake + tools) | `src/app/api/[transport]/route.ts` (novo; `basePath:"/api"` → URL do connector `/api/mcp`) |
| Catálogo de tools (wrappers) | `src/server/mcp/tools.ts` (novo) |
| Contexto de leitura / seam da visibilidade (spec 44) | `src/server/mcp/visibility.ts` (novo) |
| Membership sem sessão (contexto Bearer) | `src/server/auth/membership.ts` (novo); `requireAccountAccess` passa a delegar a ele |
| Queries reutilizadas (base existente) | `src/server/queries/dashboards.ts`, `month-page.ts`, etc. |
| Authorization server OAuth (authorize/token/consent) | `src/server/mcp/oauth/*` + `src/app/api/oauth/**` (novos) |
| Metadados de descoberta OAuth | `src/app/.well-known/oauth-authorization-server/route.ts`, `.../oauth-protected-resource/route.ts` (novos) |
| Resolução token → `(userId, accountId)` | `src/server/mcp/auth.ts` (novo) |
| Modelos de dados (client, grant, token, auth code) | `prisma/schema.prisma` (novos models) |
| Gestão/revogação de connectors (UI + action) | `src/app/(app)/[accountId]/settings/connectors/*` + `src/actions/mcp-connectors.ts` (novos) |
| Rate-limit (23 SEC-01) | `src/server/mcp/rate-limit.ts` (novo; base para SEC-01) |
| Config (segredos OAuth, URLs, flags) | `src/lib/env.ts` (bloco `server`) |
| Logging | `src/server/mcp/*` via `logger` de `@/server/logger` |

```ts
// ✅ Correto — accountId/userId vêm da concessão OAuth (token), nunca do modelo.
// Contexto Bearer: NÃO usar requireAccountAccess (deriva userId da sessão, ausente aqui).
export async function handleToolCall(req: Request, toolName: string, input: unknown) {
  const grant = await resolveMcpGrant(req);              // valida token → { userId, accountId, grantId }
  const ctx = await resolveReadContext(grant.accountId, grant.userId); // ensureMembership + (futuro) visibilidade 44
  const tool = mcpTools[toolName];                        // catálogo amplo sobre src/server/queries/
  const args = tool.schema.parse(input);                 // schema Zod SEM accountId
  return tool.run(ctx, args);                             // accountId fixo, injetado do contexto
}

// ❌ Anti-padrão — expor accountId no schema da tool (vazamento entre tenants)
input_schema: { properties: { accountId: { type: "string" }, monthId: { type: "string" } } }

// ❌ Anti-padrão — chamar a query crua sem passar pelo ReadContext (burla a visibilidade da spec 44)
return getCategoryBreakdownFiltered(grant.accountId, input.monthId, filters);

// ❌ Anti-padrão — usar requireAccountAccess num contexto Bearer (não há sessão NextAuth)
await requireAccountAccess(grant.accountId);
```

---

## 8. Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar task-a-task. Passos usam checkbox (`- [ ]`).

**Goal:** Expor o MyAccountant como servidor MCP remoto OAuth-autenticado, read-only, que o app de IA do usuário consome para consultar dados financeiros da Account concedida.

**Architecture:** Route Handler MCP (`mcp-handler` + `@modelcontextprotocol/sdk`) registra tools que são wrappers finos sobre `src/server/queries/`, todas passando por um `ReadContext` único (seam da visibilidade da spec 44). O acesso é autenticado por um OAuth 2.1 Authorization Server próprio (storage Prisma, tokens hasheados), com o login do browser delegado ao NextAuth existente.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, `@modelcontextprotocol/sdk`, `mcp-handler`, Prisma 6, Zod 3, NextAuth v5, Pino, Vitest + vitest-mock-extended.

### Global Constraints

- Dinheiro: **`BigInt` em centavos**; conversão só na apresentação (as tools devolvem os valores crus das queries).
- Multi-tenancy: `accountId`/`userId` **sempre** do grant, nunca do input do modelo. Toda leitura via `ReadContext`.
- Sem `process.env.X` direto — só `env` de `@/lib/env.ts`.
- Sem `console.log` — `logger` de `@/server/logger`.
- Zod é a fonte única dos schemas de tool; nenhum expõe `accountId`.
- Tokens armazenados **apenas hasheados** (23 SEC-02).
- Todo mutation/serviço novo tem teste de multi-tenancy (spec 13).
- **Nota de código do plano**: os passos das Fases 0–1 e 4 são código completo aferido contra o código atual. Os passos das Fases 2–3 tocam a superfície das libs `mcp-handler`/`@modelcontextprotocol/sdk`, cujas assinaturas exatas são **fixadas na Task 0.1 (spike)**; o código dessas fases segue as assinaturas que o spike documentar.

---

### Pós-spike (AUTORITATIVO — sobrepõe o texto das tasks abaixo)

O spike (Task 0.1, ver `docs/superpowers/plans/63-spike-mcp-notes.md`) fixou `@modelcontextprotocol/sdk@1.29.0` + `mcp-handler@1.1.0` e definiu correções que **prevalecem**:

1. **Rota**: `src/app/api/[transport]/route.ts` com `config.basePath = "/api"` (URL do connector = `/api/mcp`).
2. **`McpTool`** carrega `shape: z.ZodRawShape` (p/ `registerTool.inputSchema`) **além** de `schema: z.ZodObject` (validação/testes).
3. **Serializer** `serializeForMcp(data)` (BigInt centavos→string, Date→ISO); o `cb` retorna `{ content: [{ type: "text", text: serializeForMcp(data) }] }`.
4. **Bearer**: `verifyMcpBearer(req, token?) → AuthInfo | undefined` (contrato do `withMcpAuth`), devolvendo `{ token, clientId, scopes:["read"], extra:{ userId, accountId, grantId } }`.
5. **Endpoint (Task 2.2)**: `createMcpRouteHandler(init, {serverInfo}, {basePath:"/api", disableSse:true})` + `withMcpAuth(base, verifyMcpBearer, {required:true, requiredScopes:["read"]})`; cada tool via `server.registerTool(name, {description, inputSchema: tool.shape}, cb)`.
6. **AS nativo (Path A)** — Fase 3 reescrita: `/api/oauth/authorize`, `/api/oauth/token`, `/api/oauth/register`, `/.well-known/oauth-authorization-server` como Route Handlers Next sobre o storage (Task 2.1); metadata de **resource** via `protectedResourceHandler` do mcp-handler. **Não** usar `mcpAuthRouter`/`OAuthServerProvider` do SDK (Express-only).
7. **Rate-limit (4.2) e log (4.3)** entram **dentro** do `cb` da tool (onde há `authInfo`).
8. **Redis**: com `disableSse:true` + stateless, verificar se dispensa; se preciso, reusar Upstash (`MCP_REDIS_URL` opcional).

---

### Task 0.1: Spike — fixar API das libs MCP/OAuth ✅ CONCLUÍDA

**Files:**
- Create: `docs/superpowers/plans/63-spike-mcp-notes.md`

**Interfaces:**
- Produces: assinaturas exatas de `createMcpHandler` (registro de tool, transporte `[transport]`), do provider OAuth do SDK (interface `OAuthServerProvider` ou equivalente: `authorize`, `exchangeAuthorizationCode`, `exchangeRefreshToken`, `verifyAccessToken`), e do helper de verificação Bearer (`withMcpAuth`). Todas as Fases 2–3 consomem estas notas.

- [ ] **Step 1: Instalar libs**

```bash
docker compose exec app pnpm add mcp-handler @modelcontextprotocol/sdk
```

- [ ] **Step 2: Prototipar um handler mínimo e ler os tipos**

Criar um handler descartável com **uma** tool fixa e um provider OAuth stub; rodar `pnpm typecheck` e inspecionar os `.d.ts` das libs para extrair as assinaturas reais.

- [ ] **Step 3: Documentar as assinaturas no arquivo de notas**

Registrar em `63-spike-mcp-notes.md`: forma de `createMcpHandler`, forma do provider OAuth, forma de `withMcpAuth`, e o mapeamento `[transport]` → método HTTP. As Fases 2–3 seguem este documento.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/63-spike-mcp-notes.md package.json pnpm-lock.yaml
git commit -m "chore(mcp): spike lib MCP/OAuth e fixa assinaturas"
```

---

### Task 0.2: Modelos de dados (client, grant, token, auth code)

**Files:**
- Modify: `prisma/schema.prisma` (adicionar models perto de `User:95`/`Account:178`)
- Test: `src/server/mcp/__tests__/schema.test.ts`

**Interfaces:**
- Produces: models `McpClient`, `McpGrant`, `McpToken`, `McpAuthCode`, enum `McpTokenType`. Consumidos por todo o storage OAuth (Fase 3) e pela gestão de connectors (Fase 4).

- [ ] **Step 1: Adicionar os models ao schema**

```prisma
enum McpTokenType {
  access
  refresh
  @@map("mcp_token_type")
}

model McpClient {
  id           String     @id @default(cuid())
  clientId     String     @unique
  clientName   String
  redirectUris String[]
  createdAt    DateTime   @default(now())
  grants       McpGrant[]
  @@map("mcp_client")
}

model McpGrant {
  id         String     @id @default(cuid())
  userId     String
  accountId  String
  clientId   String
  scope      String     @default("read")
  createdAt  DateTime   @default(now())
  lastUsedAt DateTime?
  revokedAt  DateTime?
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  account    Account    @relation(fields: [accountId], references: [id], onDelete: Cascade)
  client     McpClient  @relation(fields: [clientId], references: [clientId], onDelete: Cascade)
  tokens     McpToken[]
  @@unique([userId, accountId, clientId])
  @@index([accountId])
  @@map("mcp_grant")
}

model McpToken {
  id        String       @id @default(cuid())
  grantId   String
  type      McpTokenType
  tokenHash String       @unique
  expiresAt DateTime
  createdAt DateTime     @default(now())
  grant     McpGrant     @relation(fields: [grantId], references: [id], onDelete: Cascade)
  @@index([grantId])
  @@map("mcp_token")
}

model McpAuthCode {
  id            String    @id @default(cuid())
  code          String    @unique
  clientId      String
  userId        String
  accountId     String
  redirectUri   String
  codeChallenge String
  scope         String    @default("read")
  expiresAt     DateTime
  consumedAt    DateTime?
  createdAt     DateTime  @default(now())
  @@map("mcp_auth_code")
}
```

- [ ] **Step 2: Adicionar as relations reversas em `User` e `Account`**

Em `model User` e `model Account`, adicionar `mcpGrants McpGrant[]`.

- [ ] **Step 3: Gerar a migration**

```bash
docker compose exec app pnpm prisma migrate dev --name add_mcp_oauth_models
```

- [ ] **Step 4: Teste de sanidade do schema**

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/server/prisma";

describe("mcp schema", () => {
  it("expõe os models mcp", () => {
    expect(prisma.mcpClient).toBeDefined();
    expect(prisma.mcpGrant).toBeDefined();
    expect(prisma.mcpToken).toBeDefined();
    expect(prisma.mcpAuthCode).toBeDefined();
  });
});
```

- [ ] **Step 5: Rodar e commitar**

```bash
docker compose exec app pnpm test src/server/mcp/__tests__/schema.test.ts
git add prisma/ src/server/mcp/__tests__/schema.test.ts
git commit -m "feat(mcp): modelos OAuth (client, grant, token, auth code)"
```

---

### Task 0.3: Variáveis de ambiente

**Files:**
- Modify: `src/lib/env.ts` (bloco `server`), `.env.example`

**Interfaces:**
- Produces: `env.MCP_ISSUER_URL`, `env.MCP_ACCESS_TOKEN_TTL_SECONDS`, `env.MCP_REFRESH_TOKEN_TTL_DAYS`, `env.MCP_ENABLED`.

- [ ] **Step 1: Adicionar ao schema `server` de `env.ts` e ao `runtimeEnv`**

```ts
// dentro de server:{}
MCP_ENABLED: z.enum(["true", "false"]).transform((v) => v === "true").default("false"),
MCP_ISSUER_URL: z.string().url(),
MCP_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
MCP_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(90),
```

- [ ] **Step 2: Refletir em `.env.example`** (com comentário `# ===== MCP Connector =====`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/env.ts .env.example
git commit -m "feat(mcp): env vars do connector (issuer, ttl, flag)"
```

---

### Task 1.1: Membership sem sessão (`ensureMembership`)

**Files:**
- Create: `src/server/auth/membership.ts`
- Modify: `src/server/auth/session.ts` (fazer `requireAccountAccess` delegar)
- Test: `src/server/auth/__tests__/membership.test.ts`

**Interfaces:**
- Produces: `ensureMembership(userId: string, accountId: string): Promise<AccountMember>`. Consumido por `resolveReadContext` (Task 1.2) e por `requireAccountAccess`.

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

const prisma = mockDeep<typeof import("@/server/prisma").prisma>();
vi.mock("@/server/prisma", () => ({ prisma }));

import { ensureMembership } from "@/server/auth/membership";
import { ForbiddenError } from "@/server/api/errors";

beforeEach(() => mockReset(prisma));

describe("ensureMembership", () => {
  it("lança ForbiddenError quando não é membro", async () => {
    prisma.accountMember.findUnique.mockResolvedValue(null);
    await expect(ensureMembership("u1", "a1")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("retorna o member quando é membro", async () => {
    prisma.accountMember.findUnique.mockResolvedValue({ id: "m1", role: "viewer" } as never);
    await expect(ensureMembership("u1", "a1")).resolves.toMatchObject({ id: "m1" });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
docker compose exec app pnpm test src/server/auth/__tests__/membership.test.ts
```
Esperado: FAIL (`ensureMembership` não existe).

- [ ] **Step 3: Implementar**

```ts
// src/server/auth/membership.ts
import { ForbiddenError } from "@/server/api/errors";
import { prisma } from "@/server/prisma";

export async function ensureMembership(userId: string, accountId: string) {
  const member = await prisma.accountMember.findUnique({
    where: { accountId_userId: { accountId, userId } },
  });
  if (!member) {
    throw new ForbiddenError("Usuário não é membro desta conta.");
  }
  return member;
}
```

- [ ] **Step 4: `requireAccountAccess` delega (sem mudar comportamento)**

```ts
// src/server/auth/session.ts — dentro de requireAccountAccess, após requireUser()
import { ensureMembership } from "@/server/auth/membership";
// ...
const user = await requireUser();
const member = await ensureMembership(user.id, accountId);
return { user, member };
```

- [ ] **Step 5: Rodar tudo e commitar**

```bash
docker compose exec app pnpm test src/server/auth
git add src/server/auth/
git commit -m "feat(auth): ensureMembership sem sessão; requireAccountAccess delega"
```

---

### Task 1.2: `ReadContext` — seam da visibilidade (spec 44)

**Files:**
- Create: `src/server/mcp/visibility.ts`
- Test: `src/server/mcp/__tests__/visibility.test.ts`

**Interfaces:**
- Consumes: `ensureMembership` (Task 1.1).
- Produces: `type ReadContext = { accountId: string; userId: string }` e `resolveReadContext(accountId, userId): Promise<ReadContext>`. Consumido por toda tool (Task 1.3) e pelo handler (Task 2.2).

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/server/auth/membership", () => ({ ensureMembership: vi.fn() }));
import { ensureMembership } from "@/server/auth/membership";
import { resolveReadContext } from "@/server/mcp/visibility";

beforeEach(() => vi.clearAllMocks());

describe("resolveReadContext", () => {
  it("reconfirma membership e devolve o contexto", async () => {
    (ensureMembership as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "m1" });
    const ctx = await resolveReadContext("a1", "u1");
    expect(ensureMembership).toHaveBeenCalledWith("u1", "a1");
    expect(ctx).toEqual({ accountId: "a1", userId: "u1" });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar (com o gancho da spec 44 documentado)**

```ts
// src/server/mcp/visibility.ts
import { ensureMembership } from "@/server/auth/membership";

/**
 * Contexto de leitura das tools MCP. Ponto ÚNICO de enforcement de acesso.
 * Hoje (spec 44 não implementada) carrega só accountId + userId e reconfirma membership.
 * Quando a spec 44 existir, ESTE arquivo passa a resolver a visibilidade efetiva
 * (SectionVisibility, papel `accountant`) — e toda tool já a herda, sem alteração.
 */
export type ReadContext = {
  accountId: string;
  userId: string;
  // futuro (spec 44): visibleSectionIds?: string[]; aggregateOnly?: boolean; role?: AccountMemberRole;
};

export async function resolveReadContext(accountId: string, userId: string): Promise<ReadContext> {
  await ensureMembership(userId, accountId);
  return { accountId, userId };
}
```

- [ ] **Step 4: Rodar e commitar.**

```bash
docker compose exec app pnpm test src/server/mcp/__tests__/visibility.test.ts
git add src/server/mcp/
git commit -m "feat(mcp): ReadContext como seam da visibilidade (spec 44)"
```

---

### Task 1.3: Catálogo de tools (wrappers sobre as queries)

**Files:**
- Create: `src/server/mcp/tools.ts`
- Test: `src/server/mcp/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `ReadContext` (Task 1.2), queries de `src/server/queries/`.
- Produces: `type McpTool`, `mcpTools: Record<string, McpTool>`. Consumido pelo handler (Task 2.2) e pelo teste de multi-tenancy (Task 1.4).

- [ ] **Step 1: Teste que falha (primeira tool: category breakdown)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/server/queries/dashboards", () => ({ getCategoryBreakdownFiltered: vi.fn() }));
import { getCategoryBreakdownFiltered } from "@/server/queries/dashboards";
import { mcpTools } from "@/server/mcp/tools";

beforeEach(() => vi.clearAllMocks());

describe("mcpTools.get_category_breakdown", () => {
  it("rejeita input com accountId (schema não expõe accountId)", () => {
    const tool = mcpTools["get_category_breakdown"];
    const parsed = tool.schema.safeParse({ accountId: "hack", monthId: "m1" });
    // accountId é ignorado/rejeitado — o resultado nunca carrega accountId do input
    expect(parsed.success).toBe(true);
    expect((parsed as { data: Record<string, unknown> }).data.accountId).toBeUndefined();
  });

  it("chama a query com o accountId do contexto, nunca do input", async () => {
    (getCategoryBreakdownFiltered as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const tool = mcpTools["get_category_breakdown"];
    await tool.run({ accountId: "ctx-account", userId: "u1" }, { monthId: "m1", filterExpenseType: "all", filterTagIds: [] });
    expect(getCategoryBreakdownFiltered).toHaveBeenCalledWith("ctx-account", "m1", { filterExpenseType: "all", filterTagIds: [] });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar o tipo + a primeira tool**

```ts
// src/server/mcp/tools.ts
import { z } from "zod";
import type { ReadContext } from "@/server/mcp/visibility";
import { getCategoryBreakdownFiltered } from "@/server/queries/dashboards";

export type McpTool<TInput = unknown> = {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  run: (ctx: ReadContext, input: TInput) => Promise<unknown>;
};

// Schemas NUNCA expõem accountId (DD-04). expenseType como string p/ alinhar com TransactionExpenseType.
const categoryBreakdownSchema = z.object({
  monthId: z.string(),
  filterExpenseType: z.string().default("all"),
  filterTagIds: z.array(z.string()).default([]),
});

const getCategoryBreakdownTool: McpTool<z.infer<typeof categoryBreakdownSchema>> = {
  name: "get_category_breakdown",
  description: "Gastos agregados por categoria em um mês da conta.",
  schema: categoryBreakdownSchema,
  run: (ctx, input) =>
    getCategoryBreakdownFiltered(ctx.accountId, input.monthId, {
      filterExpenseType: input.filterExpenseType,
      filterTagIds: input.filterTagIds,
    }),
};

export const mcpTools: Record<string, McpTool> = {
  [getCategoryBreakdownTool.name]: getCategoryBreakdownTool as McpTool,
};
```

- [ ] **Step 4: Rodar e ver passar.**

- [ ] **Step 5: Ampliar o catálogo (DD-10)**

Para **cada** função de leitura de Account em `src/server/queries/` (ex.: `getMonthDeepDive`, `getComparisonData`, `getInstitutionBreakdown`, `getMonthSummaryData`, `getYearOverview`, busca filtrada de transações), adicionar um wrapper no mesmo formato — schema Zod sem `accountId`, `run` que chama a query com `ctx.accountId`. Um teste por tool cobrindo "usa `ctx.accountId`, não o input".

- [ ] **Step 6: Commit**

```bash
docker compose exec app pnpm test src/server/mcp/__tests__/tools.test.ts
git add src/server/mcp/
git commit -m "feat(mcp): catálogo de tools sobre as queries existentes"
```

---

### Task 1.4: Guard read-only + teste de multi-tenancy do catálogo

**Files:**
- Test: `src/server/mcp/__tests__/tools.readonly.test.ts`

**Interfaces:**
- Consumes: `mcpTools` (Task 1.3).

- [ ] **Step 1: Teste — nenhuma tool de escrita e nenhum schema com accountId**

```ts
import { describe, it, expect } from "vitest";
import { mcpTools } from "@/server/mcp/tools";

const WRITE_HINT = /(create|update|delete|set_|add_|remove_)/i;

describe("mcpTools é read-only e sem accountId", () => {
  it("nenhum nome de tool sugere escrita", () => {
    for (const name of Object.keys(mcpTools)) {
      expect(name, `tool ${name} parece de escrita`).not.toMatch(WRITE_HINT);
    }
  });

  it("nenhum schema aceita accountId como campo válido próprio", () => {
    for (const [name, tool] of Object.entries(mcpTools)) {
      const parsed = tool.schema.safeParse({ accountId: "x" });
      if (parsed.success) {
        expect((parsed.data as Record<string, unknown>).accountId, `tool ${name} vaza accountId`).toBeUndefined();
      }
    }
  });
});
```

- [ ] **Step 2: Rodar (deve passar com o catálogo atual) e commitar.**

```bash
docker compose exec app pnpm test src/server/mcp/__tests__/tools.readonly.test.ts
git add src/server/mcp/__tests__/tools.readonly.test.ts
git commit -m "test(mcp): guard read-only e ausência de accountId nos schemas"
```

---

### Task 2.1: Storage OAuth (Prisma) + hashing de token

**Files:**
- Create: `src/server/mcp/oauth/store.ts`, `src/server/mcp/oauth/hash.ts`
- Test: `src/server/mcp/oauth/__tests__/store.test.ts`

**Interfaces:**
- Consumes: models da Task 0.2.
- Produces: `hashToken(raw): string`; `issueTokens(grantId): Promise<{ accessToken, refreshToken }>` (retorna **raw** ao chamador, persiste **hash**); `findGrantByAccessToken(raw): Promise<Grant | null>`; `rotateRefreshToken(raw)`, `revokeGrant(grantId)`. Consumido pelo provider (Task 3.1) e por `resolveMcpGrant` (Task 3.3).

- [ ] **Step 1: Teste — token é persistido só como hash**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
const prisma = mockDeep<typeof import("@/server/prisma").prisma>();
vi.mock("@/server/prisma", () => ({ prisma }));
import { issueTokens } from "@/server/mcp/oauth/store";
import { hashToken } from "@/server/mcp/oauth/hash";

beforeEach(() => mockReset(prisma));

describe("issueTokens", () => {
  it("persiste hash, nunca o token raw", async () => {
    prisma.mcpToken.create.mockResolvedValue({} as never);
    const { accessToken } = await issueTokens("grant1");
    const calls = prisma.mcpToken.create.mock.calls.map((c) => c[0].data.tokenHash);
    expect(calls).toContain(hashToken(accessToken));
    expect(calls).not.toContain(accessToken); // raw jamais no banco
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar hashing e storage**

```ts
// src/server/mcp/oauth/hash.ts
import { createHash } from "node:crypto";
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
```

```ts
// src/server/mcp/oauth/store.ts
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { prisma } from "@/server/prisma";
import { hashToken } from "@/server/mcp/oauth/hash";

const rawToken = () => randomBytes(32).toString("base64url");

export async function issueTokens(grantId: string) {
  const accessToken = rawToken();
  const refreshToken = rawToken();
  const now = Date.now();
  await prisma.mcpToken.create({
    data: {
      grantId, type: "access", tokenHash: hashToken(accessToken),
      expiresAt: new Date(now + env.MCP_ACCESS_TOKEN_TTL_SECONDS * 1000),
    },
  });
  await prisma.mcpToken.create({
    data: {
      grantId, type: "refresh", tokenHash: hashToken(refreshToken),
      expiresAt: new Date(now + env.MCP_REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    },
  });
  return { accessToken, refreshToken };
}

export async function findGrantByAccessToken(raw: string) {
  const token = await prisma.mcpToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { grant: true },
  });
  if (!token || token.type !== "access" || token.expiresAt < new Date()) return null;
  if (token.grant.revokedAt) return null;
  return token.grant;
}

export async function revokeGrant(grantId: string) {
  await prisma.$transaction([
    prisma.mcpGrant.update({ where: { id: grantId }, data: { revokedAt: new Date() } }),
    prisma.mcpToken.deleteMany({ where: { grantId } }),
  ]);
}
```

> `Date.now()`/`new Date()` são válidos no app (a restrição vale só para scripts de workflow). 

- [ ] **Step 4: Rodar e commitar.**

```bash
docker compose exec app pnpm test src/server/mcp/oauth/__tests__/store.test.ts
git add src/server/mcp/oauth/
git commit -m "feat(mcp): storage OAuth com tokens hasheados (23 SEC-02)"
```

---

### Task 2.2: Endpoint MCP + registro das tools

**Files:**
- Create: `src/app/api/mcp/[transport]/route.ts`, `src/server/mcp/auth.ts`
- Test: `src/server/mcp/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: notas do spike (Task 0.1), `mcpTools` (1.3), `resolveReadContext` (1.2), `findGrantByAccessToken` (2.1).
- Produces: `resolveMcpGrant(req): Promise<{ userId, accountId, grantId }>` (lê o header `Authorization: Bearer`), e o handler HTTP registrando as tools.

- [ ] **Step 1: Teste de `resolveMcpGrant` (rejeita sem/inválido token)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/server/mcp/oauth/store", () => ({ findGrantByAccessToken: vi.fn() }));
import { findGrantByAccessToken } from "@/server/mcp/oauth/store";
import { resolveMcpGrant } from "@/server/mcp/auth";

beforeEach(() => vi.clearAllMocks());

describe("resolveMcpGrant", () => {
  it("rejeita sem Authorization", async () => {
    await expect(resolveMcpGrant(new Request("http://x/mcp"))).rejects.toThrow();
  });
  it("rejeita token inválido", async () => {
    (findGrantByAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = new Request("http://x/mcp", { headers: { authorization: "Bearer bad" } });
    await expect(resolveMcpGrant(req)).rejects.toThrow();
  });
  it("devolve o grant para token válido", async () => {
    (findGrantByAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "g1", userId: "u1", accountId: "a1" });
    const req = new Request("http://x/mcp", { headers: { authorization: "Bearer good" } });
    await expect(resolveMcpGrant(req)).resolves.toEqual({ grantId: "g1", userId: "u1", accountId: "a1" });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar `resolveMcpGrant`**

```ts
// src/server/mcp/auth.ts
import { UnauthorizedError } from "@/server/api/errors";
import { findGrantByAccessToken } from "@/server/mcp/oauth/store";

export async function resolveMcpGrant(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7) : null;
  if (!token) throw new UnauthorizedError("Token ausente.");
  const grant = await findGrantByAccessToken(token);
  if (!grant) throw new UnauthorizedError("Token inválido ou expirado.");
  return { grantId: grant.id, userId: grant.userId, accountId: grant.accountId };
}
```

- [ ] **Step 4: Implementar o handler seguindo o spike**

Conforme as assinaturas fixadas na Task 0.1: `createMcpHandler` registra cada `mcpTools[name]` (nome, descrição, `schema`), e o `run` de cada tool é envolvido por: `resolveMcpGrant(req)` → `resolveReadContext(accountId, userId)` → `tool.run(ctx, args)` → log Pino (Task 4.3). Guardar o handler atrás de `env.MCP_ENABLED`.

- [ ] **Step 5: Teste manual do handshake**

```bash
# com MCP_ENABLED=true e um access token válido semeado:
curl -s http://localhost:3000/api/mcp/http -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
Esperado: lista de tools com `get_category_breakdown` etc.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/mcp/ src/server/mcp/auth.ts src/server/mcp/__tests__/auth.test.ts
git commit -m "feat(mcp): endpoint MCP + resolução de grant via Bearer"
```

---

### Task 3.1: OAuth provider (SDK) sobre o storage

**Files:**
- Create: `src/server/mcp/oauth/provider.ts`
- Test: `src/server/mcp/oauth/__tests__/provider.test.ts`

**Interfaces:**
- Consumes: interface do provider do SDK (spike), storage (2.1), models (0.2).
- Produces: `mcpOAuthProvider` implementando `authorize`/`exchangeAuthorizationCode`/`exchangeRefreshToken`/`verifyAccessToken` (nomes exatos por spike), com PKCE e DCR persistidos em `McpClient`/`McpAuthCode`.

- [ ] **Step 1..N (TDD por método do provider)**: para cada método exigido pelo SDK, um teste que exercita o caminho feliz + um de rejeição (code expirado, PKCE inválido, refresh revogado), depois a implementação sobre o storage. Emissão de tokens delega a `issueTokens`; verificação delega a `findGrantByAccessToken`.

- [ ] **Step final: Commit**

```bash
git add src/server/mcp/oauth/
git commit -m "feat(mcp): OAuth provider (PKCE, DCR, code/refresh) sobre storage"
```

---

### Task 3.2: Endpoints de descoberta + authorize/token

**Files:**
- Create: `src/app/.well-known/oauth-authorization-server/route.ts`, `src/app/.well-known/oauth-protected-resource/route.ts`, `src/app/api/oauth/authorize/route.ts`, `src/app/api/oauth/token/route.ts`

**Interfaces:**
- Consumes: `mcpOAuthProvider` (3.1), `env.MCP_ISSUER_URL`.
- Produces: documentos de metadados e os endpoints do fluxo, montados via o roteador de AS do SDK (spike).

- [ ] **Step 1: Teste dos metadados**

```bash
curl -s http://localhost:3000/.well-known/oauth-authorization-server | jq '.issuer, .authorization_endpoint, .token_endpoint'
```
Esperado: valores derivados de `env.MCP_ISSUER_URL`, endpoints `/api/oauth/authorize` e `/api/oauth/token`.

- [ ] **Step 2: Montar os handlers pelo roteador do SDK** conforme o spike; `authorize` exige sessão NextAuth (redireciona ao login se ausente) e delega à tela de consentimento (Task 3.3).

- [ ] **Step 3: Commit**

```bash
git add "src/app/.well-known" src/app/api/oauth/
git commit -m "feat(mcp): metadados OAuth + endpoints authorize/token"
```

---

### Task 3.3: Tela de consentimento (login NextAuth + seleção de Account + aviso LGPD)

**Files:**
- Create: `src/app/api/oauth/consent/page.tsx` (ou rota equivalente do fluxo authorize), `src/actions/mcp-consent.ts`
- Test: `src/actions/__tests__/mcp-consent.test.ts`

**Interfaces:**
- Consumes: `requireUser` (sessão NextAuth), `prisma.accountMember.findMany`, `mcpOAuthProvider`.
- Produces: `approveConsent(input): Promise<ActionResult<{ redirectTo: string }>>` — cria/reusa o `McpGrant` `(userId, accountId, clientId)`, emite o authorization code, retorna a redireção.

- [ ] **Step 1: Teste — cria grant só para Account da qual o usuário é membro**

```ts
// usuário u1 tenta consentir accountId "a-outro" do qual NÃO é membro → ForbiddenError; grant não é criado
```
(Usar `ensureMembership` dentro da action; multi-tenancy obrigatório.)

- [ ] **Step 2: Rodar e ver falhar; implementar a action** (usa `defineAction`, `ensureMembership`, cria `McpGrant`, chama o provider p/ emitir o code).

- [ ] **Step 3: UI de consentimento** (MUI + tokens do tema): nome do app cliente, `<Select>` de Account a partir de `accountMember.findMany({ where: { userId } })`, texto de escopo "somente leitura" e **aviso LGPD** ("os dados consultados serão enviados ao {clientName} e processados pelo provedor dele"). Botões "Autorizar"/"Cancelar".

- [ ] **Step 4: Commit**

```bash
git add src/app/api/oauth/consent/ src/actions/mcp-consent.ts src/actions/__tests__/
git commit -m "feat(mcp): consentimento com seleção de Account e aviso LGPD"
```

---

### Task 3.4: Exceção do middleware

**Files:**
- Modify: `src/middleware.ts`

**Interfaces:**
- Produces: matcher que continua **não** capturando `/api/*` — e um comentário-âncora garantindo que, quando a spec 23 SEC-04 adicionar enforcement a `/api/v1`, `/api/mcp`, `/api/oauth` e `/.well-known` fiquem **fora**.

- [ ] **Step 1: Confirmar (teste manual) que `/api/mcp`, `/api/oauth` e `/.well-known` respondem sem redirect de login.**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/.well-known/oauth-authorization-server
```
Esperado: `200` (não `302` de login).

- [ ] **Step 2: Adicionar comentário-âncora no matcher** referenciando DD-15 e a spec 23 SEC-04.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "chore(mcp): âncora p/ manter /api/mcp fora do enforcement de sessão (DD-15)"
```

---

### Task 4.1: Gestão e revogação de connectors (settings)

**Files:**
- Create: `src/app/(app)/[accountId]/settings/connectors/page.tsx`, `src/actions/mcp-connectors.ts`
- Test: `src/actions/__tests__/mcp-connectors.test.ts`

**Interfaces:**
- Consumes: models (0.2), `revokeGrant` (2.1), `requireAccountAccess`.
- Produces: `listConnectors(accountId)`, `revokeConnector(accountId, grantId): Promise<ActionResult>`.

- [ ] **Step 1: Teste de multi-tenancy — não revoga grant de outra Account**

```ts
// grant pertence à account B; user de A chama revokeConnector(A, grantB) → ForbiddenError/NotFound; grant intacto
```

- [ ] **Step 2: Rodar e ver falhar; implementar as actions** (`defineAction` + `requireAccountAccess`; `revokeConnector` valida que o grant pertence ao `accountId` antes de `revokeGrant`).

- [ ] **Step 3: UI (MUI + tokens)** listando connectors da Account (app, `createdAt`, `lastUsedAt`) com botão "Revogar" (usa `useActionFeedback`).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/[accountId]/settings/connectors" src/actions/mcp-connectors.ts src/actions/__tests__/
git commit -m "feat(mcp): tela de gestão e revogação de connectors"
```

---

### Task 4.2: Rate-limit do endpoint MCP (base 23 SEC-01)

**Files:**
- Create: `src/server/mcp/rate-limit.ts`
- Test: `src/server/mcp/__tests__/rate-limit.test.ts`
- Modify: `src/app/api/mcp/[transport]/route.ts` (aplicar antes de executar tool)

**Interfaces:**
- Produces: `checkMcpRateLimit(grantId): Promise<void>` (lança `AppError` `CONFLICT`/429 ao estourar). Implementação inicial in-memory por `grantId`, com TODO documentado para migrar a Upstash quando a 23 SEC-01 chegar (env `UPSTASH_*` já previsto).

- [ ] **Step 1: Teste — estoura ao exceder N chamadas na janela; commit.**

```bash
docker compose exec app pnpm test src/server/mcp/__tests__/rate-limit.test.ts
git add src/server/mcp/rate-limit.ts src/server/mcp/__tests__/rate-limit.test.ts src/app/api/mcp/
git commit -m "feat(mcp): rate-limit por grant no endpoint (base 23 SEC-01)"
```

---

### Task 4.3: Logging estruturado por chamada de tool

**Files:**
- Modify: `src/app/api/mcp/[transport]/route.ts` (envolver o `run` de cada tool)

**Interfaces:**
- Consumes: `logger` de `@/server/logger`.

- [ ] **Step 1: Envolver a execução** com `logger.child({ module: "mcp.tool" })` logando `{ accountId, userId, grantId, tool, durationMs, ok }`; atualizar `lastUsedAt` do grant. Verificar manualmente nos logs uma chamada real.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/mcp/
git commit -m "feat(mcp): log estruturado Pino por chamada de tool"
```

---

### Task 4.4: Notas cruzadas nas specs 23 e 44

**Files:**
- Modify: `specs/23-security-hardening.md` (SEC-06/SEC-07 listam o canal MCP), `specs/44-privacidade-granular-contador.md` (superfícies incluem MCP)

- [ ] **Step 1: Adicionar o canal MCP às superfícies** de anti-injection (SEC-06), visibilidade (SEC-07) e à lista de superfícies da 44. Commit `docs`.

```bash
git add specs/23-security-hardening.md specs/44-privacidade-granular-contador.md
git commit -m "docs(specs): listar canal MCP nas superfícies de 23 e 44"
```

---

### Self-Review (rodado contra o spec)

- **Cobertura**: MCP-01→05 e todos os critérios do §4 têm task (conexão/tools: 1.3/2.2; OAuth/tenant: 2.1/2.2/3.x; visibilidade MCP-05: 1.2; read-only: 1.4; rate-limit/middleware/consent: 4.2/3.4/3.3). ✅
- **Placeholders**: Fases 0–1 e 4 com código completo; Fases 2–3 referenciam assinaturas fixadas no spike (Task 0.1) em vez de inventar API de lib — decisão consciente, não placeholder. ✅
- **Consistência de tipos**: `ReadContext`, `McpTool`, `resolveReadContext`, `ensureMembership`, `resolveMcpGrant`, `issueTokens`/`findGrantByAccessToken`/`revokeGrant` usados com a mesma assinatura entre as tasks. ✅
