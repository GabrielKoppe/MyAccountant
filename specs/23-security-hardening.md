# Spec 23 — Hardening de Segurança (Abertura Pública)

> Status: implemented (SEC-01/02/04/08a/09 entregues 2026-07-20 — ver §9 e histórico git `feat(security): ...`)
> Insumo: docs/v2-analysis.md §5 SEC-01, SEC-02, SEC-04 · lacuna de recuperação de senha (`ForgotPasswordForm.tsx:31`, TODO nunca implementado) · entrevista de refinamento (2026-07-19) que estreitou o escopo para os itens *launch-gating* e construíveis hoje
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`env-validation`](../skills/env-validation/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`api-routes`](../skills/api-routes/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`email-resend`](../skills/email-resend/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md)

---

> **Nota de escopo (revisão 2026-07-19):** Esta spec foi estreitada para conter apenas os itens de segurança **implementáveis hoje** e que **bloqueiam a abertura pública** (fase V3.0): SEC-01, SEC-02, SEC-04, SEC-08a e SEC-09.
>
> Os itens que dependem de features ainda em `draft` — cripto de credencial bancária (spec 52), isolamento do assistente de IA (spec 55) e autorização granular de colaboração (specs 42–44) — **saíram desta spec** e viram **critério de aceite da spec que introduz cada superfície**. Eles estão listados no **§8 Registro de Ameaças** como ponteiros rastreáveis.
>
> **Regra mantida:** nenhuma das specs 52, 55, 42–44 deve ir a `approved` sem o item de segurança correspondente (SEC-05/06/07) contemplado na própria spec dona.

---

## 1. Problema

### SEC-01 — Ausência de rate limiting nas rotas de autenticação
Não há rate limiting em lugar nenhum do código (nenhuma dependência `@upstash/ratelimit`/`redis`; nenhum throttle em services ou actions). Consequências, todas expostas na abertura pública:

- **Login brute-force**: `/api/auth/callback/credentials` (provider Credentials real em `src/server/auth/index.ts:62-86`, verificação `bcrypt.compare` em `:78`) aceita tentativas ilimitadas de senha.
- **Spam de convites**: `inviteMember` (`src/server/services/member-service.ts:30`) dispara email a cada chamada, sem limite.
- **Spam de reset**: a recuperação de senha (ver SEC-09) precisa de limite por design para evitar spam + enumeração.
- **Spam de signup**: hoje o cadastro é contido pela allowlist (`env.ALLOWED_EMAILS`; Google checa `isSignupAllowed` em `src/server/auth/index.ts:102`). Ao remover a allowlist na abertura pública, o cadastro vira vetor de criação em massa de contas.

### SEC-02 — Token de convite armazenado em plaintext
`inviteMember` gera o token corretamente com `crypto.randomBytes(32).toString("hex")` (`src/server/services/member-service.ts:63,71`), mas grava o valor **raw** no banco. A coluna `account_invites.token` é `String @unique` + `@@index([token])` (`prisma/schema.prisma:237`). O lookup é feito diretamente pelo token raw em **três sítios** (`member-service.ts:118`, `:170`, `:224` — preview, aceite e decline). Se o banco vazar, todos os convites pendentes podem ser usados por um atacante.

### SEC-04 — Rotas `/api/v1/*` não são protegidas centralmente
O matcher do middleware **exclui** `/api/*` (`src/middleware.ts:38-40`: `"/((?!api|_next/static|...).*)"`). O wrapper `defineRoute` (`src/server/api/route-helpers.ts`) faz apenas validação e mapeamento de erro — **não faz auth**. Cada handler depende de chamar `requireAccountAccess` manualmente; um handler novo criado sem essa chamada fica completamente exposto (sem sequer exigir sessão).

### SEC-08a — Ações sensíveis não deixam trilha de auditoria
Operações que alteram o controle de uma Account colaborativa — troca de papel de membro, remoção/saída de membro, ciclo de convite — não gravam nenhum registro de quem fez o quê e quando. Não existe model `AuditLog` no schema (`prisma/schema.prisma`). Sem trilha, incidentes em contas compartilhadas são impossíveis de investigar.

### SEC-09 — Recuperação de senha inexistente e sem garantias de segurança
Não há fluxo de recuperação de senha: `src/components/**/ForgotPasswordForm.tsx:31` é um stub (`// TODO Fase 1: implementar`), nenhum email é enviado, e `src/actions/auth.ts` só contém `signupAction` (`:13`) e `logoutAction` (`:41`). Isso é um bloqueio de abertura pública (usuários que esquecem a senha ficam presos) **e** um problema de segurança quando construído: o token de reset teria os mesmos riscos do SEC-02 (plaintext) e do SEC-01 (spam/enumeração), e a sessão é JWT (`src/server/auth/index.ts:93`, `strategy: "jwt"`), logo uma troca de senha não invalida sessões antigas por padrão.

---

## 2. Solução

Backend de rate limiting escolhido para todos os itens de SEC-01/SEC-09: **Upstash Redis** via `@upstash/ratelimit` (REST). Não altera o deploy atual (app em Docker + Postgres no Neon) — é serviço externo via REST; adiciona apenas `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` (já previstos como opcionais em `src/lib/env.ts`), que passam a ser **obrigatórios em produção**.

### SEC-01 — Rate limiting
Criar um utilitário `src/server/security/rate-limit.ts` com limiters nomeados (sliding window) sobre `@upstash/ratelimit`. Aplicar:
- **login**: por IP, no fluxo de credentials.
- **signup**: por IP, na `signupAction`.
- **convites**: por `userId`, em `inviteMember`.
- **reset**: por email + por IP, na ação de solicitação (SEC-09).

Reusado depois por SEC-06 (limite do assistente) quando a spec 55 for construída.

### SEC-02 — Hash de token de convite
Armazenar apenas o **SHA-256** do token em `account_invites.token`. O token raw só é enviado no email. Nos três sítios de lookup (`member-service.ts:118,170,224`), calcular o SHA-256 do token recebido e comparar com a coluna. A unicidade e o índice continuam válidos (o hash é determinístico). Migration **hasheia in-place** os tokens plaintext existentes (preserva convites pendentes já enviados e remove o plaintext do banco).

### SEC-04 — Middleware para `/api/v1/*`
Incluir `/api/v1/:path*` no `config.matcher` e, no middleware, retornar `401` para requisições sem sessão a `/api/v1/*`. Esta é uma checagem de **autenticação** (há sessão?), **não** de autorização de Account — `requireAccountAccess` continua obrigatório em cada handler para o `403`. Rotas públicas permanecem fora: `/api/auth/*`, `/api/health`, `/api/docs`, `/api/openapi.json`.

### SEC-08a — Trilha de auditoria (ações existentes)
Criar o model `AuditLog` (`accountId`, `actorUserId`, `action`, `targetType`, `targetId`, `metadata`, `createdAt`) e um `auditService.record(...)` chamado nas ações sensíveis que já existem: troca de papel, remoção/saída de membro, ciclo de convite (enviado/aceito/revogado) e reset de senha concluído (SEC-09). Leitura restrita ao `owner` e filtrada por `accountId`.

### SEC-09 — Recuperação de senha segura
Fluxo completo, todo pré-autenticação (ações **públicas**, no padrão de `signupAction` — **não** usam `defineAction`/`requireAccountAccess`, pois reset é autenticação pura):
1. **Solicitação** (`requestPasswordResetAction`): rate limited (SEC-01). Gera token raw (`crypto.randomBytes`), grava **apenas o SHA-256** em nova tabela `password_reset_tokens` (`userId`, `tokenHash`, `expiresAt` = agora + 1h, `usedAt`). Responde **sempre com mensagem genérica** ("Se existe uma conta, enviamos instruções"), independentemente do email existir. Comportamento por caso, só visível no inbox: conta com senha → email com link; conta **só-Google** (sem `passwordHash`) → email guia "entre com Google, você não tem senha"; email inexistente → nenhum email.
2. **Redefinição** (`resetPasswordAction`): recebe token raw + nova senha, calcula SHA-256, valida existência/expiração/`usedAt`. Nova senha validada com o schema Zod de senha do signup. Ao sucesso: atualiza `passwordHash`, marca `usedAt`, apaga demais tokens pendentes do usuário e grava `auth.password_reset` no AuditLog.
3. **Invalidação de sessão**: adicionar `User.passwordChangedAt` (DateTime), atualizado no reset. Embutir o timestamp no JWT (callback `jwt`) e rejeitar (401) no callback `session` qualquer token emitido antes de `passwordChangedAt`.

Email via **Brevo + React Email** (`emailService.send`, fire-and-forget + log). Template novo em `src/emails/`.

---

## 3. User Stories

- Como operador do sistema, quero que tentativas repetidas de login de um mesmo IP sejam bloqueadas após N falhas, para conter brute-force na abertura pública.
- Como operador do sistema, quero que cadastro, convites e recuperação de senha tenham limite de frequência, para conter spam e criação em massa de contas.
- Como usuário, quero que tokens de convite no banco não permitam acesso mesmo em caso de vazamento do banco.
- Como desenvolvedor, quero que qualquer rota `/api/v1/*` exija sessão por padrão no middleware, sem depender de verificação manual em cada handler.
- Como usuário que esqueceu a senha, quero solicitar a redefinição por email e definir uma nova senha com segurança, sem que o sistema revele se meu email existe.
- Como usuário que redefiniu a senha por suspeita de comprometimento, quero que minhas sessões antigas deixem de valer imediatamente.
- Como `owner` de uma Account, quero uma trilha de auditoria das ações sensíveis (troca de papéis, convites, remoção de membros) para investigar incidentes.

---

## 4. Critérios de Aceitação

**SEC-01 — Rate limiting:**
- QUANDO um IP faz mais de 10 tentativas de login em uma janela de 15 minutos, AS PRÓXIMAS DEVEM ser rejeitadas com HTTP 429 e mensagem clara. (O rate limit roda no **middleware**, antes do handler NextAuth, então conta **todas** as tentativas do IP — não só as com falha; 10/15min é folgado para uso legítimo.)
- QUANDO um IP faz mais de 5 solicitações de cadastro (signup) em uma hora, AS PRÓXIMAS DEVEM ser rejeitadas com HTTP 429 e mensagem clara.
- QUANDO um usuário tenta enviar mais de 5 convites em uma hora, A AÇÃO DEVE ser bloqueada com mensagem de erro clara.
- QUANDO uma recuperação de senha é solicitada mais de 3 vezes em uma hora para o mesmo email (ou IP), AS PRÓXIMAS DEVEM retornar a mensagem genérica **sem** enviar email.
- O rate limiting DEVE usar Upstash Redis (`@upstash/ratelimit`); o app em produção NÃO DEVE iniciar sem `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`.
- A chave de limite DEVE ser o IP para login/signup e o `userId`/email para convites/reset.

**SEC-02 — Hash de token de convite:**
- QUANDO um convite é criado, O TOKEN ARMAZENADO EM `account_invites.token` DEVE ser o SHA-256 do token gerado, não o token raw.
- O TOKEN RAW DEVE ser enviado apenas no link de email e nunca persistido.
- QUANDO um usuário abre o link de aceite/preview/decline com o token raw, O SISTEMA DEVE calcular o SHA-256 e comparar com o banco nos três sítios de lookup.
- SE o hash não corresponder, O CONVITE DEVE ser rejeitado como inválido.
- A MIGRATION DEVE converter in-place os tokens plaintext dos convites **pendentes** para hash (preservando os convites já enviados). Tokens de convites já aceitos/revogados/expirados são inertes (nunca consultados no fluxo de aceite) e podem permanecer como estão.

**SEC-04 — Middleware para API:**
- QUANDO uma requisição sem sessão chega a qualquer rota `/api/v1/*`, O MIDDLEWARE DEVE retornar HTTP 401 com corpo JSON `{ "error": "Unauthorized" }`.
- As rotas `/api/auth/*`, `/api/health`, `/api/docs` e `/api/openapi.json` DEVEM permanecer públicas.
- A checagem de **autenticação** DEVE acontecer no middleware; a checagem de **autorização de Account** (`requireAccountAccess`, 403) DEVE continuar em cada handler (defense in depth).

**SEC-08a — Trilha de auditoria:**
- QUANDO ocorre troca de papel, remoção/saída de membro, envio/aceite/revogação de convite ou reset de senha concluído, O SISTEMA DEVE gravar um `AuditLog` com `actorUserId`, `action`, `targetType`, `targetId` e `createdAt`.
- A trilha DEVE ser legível apenas pelo `owner` da Account e DEVE ser filtrada por `accountId`.
- O `AuditLog` NÃO DEVE registrar exclusão de Account (o registro seria apagado em cascata junto com a conta).

**SEC-09 — Recuperação de senha:**
- QUANDO uma recuperação é solicitada, A RESPOSTA HTTP DEVE ser genérica e idêntica nos três casos (conta com senha, conta só-Google, email inexistente), sem revelar a existência da conta.
- QUANDO existe conta com senha, O SISTEMA DEVE enviar um email com link contendo o token raw; QUANDO a conta é só-Google, DEVE enviar um email orientando o login via Google; QUANDO o email não existe, NÃO DEVE enviar email.
- O TOKEN DE RESET DEVE ser gravado apenas como SHA-256 em `password_reset_tokens`, ser de uso único (`usedAt`) e expirar em 1 hora.
- SE o token for inválido, expirado ou já usado, A REDEFINIÇÃO DEVE ser rejeitada.
- QUANDO a redefinição conclui com sucesso, O SISTEMA DEVE atualizar `passwordHash`, definir `User.passwordChangedAt`, marcar `usedAt` e apagar os demais tokens pendentes do usuário.
- ENQUANTO existir um JWT emitido antes de `passwordChangedAt`, O SISTEMA DEVE rejeitá-lo (401) — sessões anteriores ao reset NÃO DEVEM continuar válidas.
- A nova senha DEVE ser validada pelo mesmo schema Zod de senha usado no cadastro.
- As ações de reset NÃO DEVEM usar `defineAction`/`requireAccountAccess` (são pré-autenticação, no padrão de `signupAction`).

---

## 5. Fora de Escopo

- **Itens de superfícies do V3** (SEC-05 cripto de conexão bancária, SEC-06 isolamento do assistente de IA, SEC-07 autorização granular): **movidos** para as specs donas (ver §8). Não são implementados aqui.
- **Autenticação de dois fatores (2FA)** — fora desta spec, mas com prioridade elevada; recomenda-se spec dedicada de 2FA/step-up antes de habilitar Open Finance ao público amplo (DD-10).
- **Permitir que conta só-Google defina uma senha** via reset (add-password / account linking) — forward-requirement no §8.
- **Auditoria de exclusão de Account** — exige mecanismo fora do `AuditLog` account-scoped (cascade); forward-requirement no §8.
- **Auditoria de export CSV/PDF** — não incluída agora (alto volume/ruído).
- Bloqueio permanente de contas (apenas cooldown temporário via rate limit).
- CAPTCHA em formulários de login/cadastro.
- Rotação automática de chaves JWT.
- Criptografia ponta-a-ponta de toda a base de dados em repouso.

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Escopo da Spec 23 | Estreitar para itens launch-gating e construíveis hoje (SEC-01/02/04/08a/09); mover SEC-05/06/07/08b para as specs donas | Status é único por spec; aprovar itens acoplados a features draft (sem código) geraria ambiguidade. Segurança nasce dentro da feature, não como passada posterior |
| DD-02 | Backend de rate limiting | Upstash Redis (`@upstash/ratelimit`, REST) | Não altera o deploy atual (Docker + Neon); serverless-safe e multi-instância; durável a restart; já previsto em `env.ts`. Alternativas descartadas: in-memory (zera no restart, burlável com >1 instância), Redis self-hosted (adiciona serviço ao stack) |
| DD-03 | Armazenamento de tokens (convite e reset) | Apenas SHA-256 no banco; raw só no email | Vazamento do banco não expõe tokens utilizáveis; hash determinístico preserva unicidade/índice e lookup |
| DD-04 | Migração do token de convite | Hashear in-place os tokens plaintext existentes | Fecha a vulnerabilidade sem invalidar convites pendentes já enviados por email |
| DD-05 | Proteção de `/api/v1/*` no middleware | Middleware garante autenticação (401); autorização (403) segue por-handler | Edge middleware não pode consultar `AccountMember` (autorização) de forma barata; `requireAccountAccess` continua como defense in depth |
| DD-06 | Recuperação de senha | Construir o fluxo nesta spec (token hasheado, uso único, exp 1h, resposta genérica) | Abertura pública exige reset; construir junto com suas defesas evita janela insegura |
| DD-07 | Anti-enumeração no reset | Resposta HTTP sempre genérica; diferenciação só no conteúdo do email | Não vaza existência de conta ao atacante, sem prender o usuário real (inclusive só-Google) |
| DD-08 | Invalidação de sessão no reset | `resetPassword` grava `User.passwordChangedAt`; o JWT carrega `loginAt` (timestamp do sign-in); **`requireUser` (Node) rejeita** o token quando `passwordChangedAt > loginAt` — comparação contra o **DB**, não no callback edge (o middleware edge não acessa Prisma) | Sessão é JWT (não revogável nativamente); a revogação exige checagem contra o DB, disponível só no contexto Node |
| DD-09 | Escopo do AuditLog (SEC-08a) | Eventos de controle da conta existentes; excluir `account.deleted` | Foco em investigar incidentes de colaboração; log account-scoped morreria em cascata na exclusão da conta |
| DD-10 | 2FA | Spec dedicada futura, recomendada antes da abertura ampla do Open Finance | Mantém o escopo desta spec, registrando a elevação de prioridade |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|------|-------------------|
| SEC-01 | `src/server/security/rate-limit.ts` (novo), `src/server/auth/index.ts` (login), `src/actions/auth.ts` (`signupAction`), `src/server/services/member-service.ts` (`inviteMember`), `src/lib/env.ts` (Upstash obrigatório em prod) |
| SEC-02 | `src/server/services/member-service.ts` — geração (`:63,71`) e lookups (`:118,170,224`); `prisma/migrations/**` (hash in-place) |
| SEC-04 | `src/middleware.ts` — `config.matcher` + retorno 401 para `/api/v1/*` |
| SEC-08a | `prisma/schema.prisma` (model `AuditLog`), `src/server/services/audit-service.ts` (novo), `src/server/services/member-service.ts` (chamadas de `record`) |
| SEC-09 | `prisma/schema.prisma` (`password_reset_tokens` + `User.passwordChangedAt`), `src/actions/auth.ts` (`requestPasswordResetAction`, `resetPasswordAction`), `src/server/services/auth-service.ts`, `src/server/auth/config.ts` (callbacks `jwt`/`session`), `src/emails/PasswordResetEmail.tsx` (novo), `ForgotPasswordForm.tsx` + página de redefinição, `src/lib/schemas/auth.ts` |

**SEC-01 — rate limiter (esboço):**
```ts
// src/server/security/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export const loginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "15 m"),
  prefix: "rl:login",
});
// ...signupLimiter, inviteLimiter, resetLimiter (por IP / userId / email)
```

**SEC-02 / SEC-09 — hash de token (reuso):**
```ts
import { createHash } from "crypto";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
// Armazenar hashToken(token); enviar token raw por email; comparar hashToken(recebido)
```

**SEC-04 — matcher + 401:**
```ts
// src/middleware.ts
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/api/v1/:path*",
  ],
};
// No middleware: se path começa com /api/v1/ e não há sessão →
//   NextResponse.json({ error: "Unauthorized" }, { status: 401 })
// Nunca aplicar a /api/auth, /api/health, /api/docs, /api/openapi.json.
// requireAccountAccess (403) permanece em cada handler.
```

**SEC-09 — invalidação de sessão via JWT:**
```ts
// callback jwt: token.pwdChangedAt = user.passwordChangedAt?.getTime()
// callback session: se token.iat * 1000 < token.pwdChangedAt → sessão inválida (401)
```

**Migrations necessárias:**
- SEC-02: `account_invites.token` passa a guardar o hash; a migration data-fix hasheia in-place os tokens dos convites **pendentes** (`WHERE status='pending'`, via `pgcrypto`).
- SEC-08a: nova tabela `audit_logs` com `@@index([accountId, createdAt])` e `onDelete: Cascade` de Account.
- SEC-09: nova tabela `password_reset_tokens` (`userId`, `tokenHash` `@unique`, `expiresAt`, `usedAt`, `@@index([userId])`) + coluna `users.password_changed_at DateTime?`.

---

## 8. Registro de Ameaças (itens movidos — rastreabilidade)

Itens de segurança que **não** são implementados nesta spec; cada um é **critério de aceite da spec dona** e deve estar contemplado antes de a spec dona ir a `approved`.

| Item | Ameaça | Spec dona (status) |
|---|---|---|
| SEC-05 | Segredos de conexão Open Finance em plaintext; webhook sem verificação de assinatura HMAC | [spec 52](52-agregacao-open-finance-pluggy.md) (draft) |
| SEC-06 | Vazamento entre tenants, prompt injection e abuso de custo no assistente de IA | [spec 55](55-assistente-ia-conversacional.md) (draft) |
| SEC-07 | IDOR entre membros; visibilidade por seção/papel imposta só na UI; papel `accountant` | [specs 42](42-divisao-despesas-membros.md)–[44](44-privacidade-granular-contador.md) (draft) |
| SEC-08b | Auditoria de conectar/desconectar banco, exportar IR, registrar acerto de contas | specs 52 / 54 / 42 (draft) |
| — | Permitir que conta só-Google defina senha (add-password / linking) | spec futura de autenticação |
| — | Auditoria de exclusão de Account (fora do `AuditLog` cascade) | spec futura |
| — | 2FA / step-up antes da abertura ampla do Open Finance | spec dedicada de 2FA (DD-10) |

---

## 9. Plano de Implementação

> **✅ Implementado em 2026-07-20** (17 commits `feat(security): ...` na `main`; typecheck limpo, suíte verde). Plano mantido como registro do que foi construído.
>
> Plano de execução task-por-task desta spec, escrito com a skill `writing-plans`. Integrado aqui (não em arquivo separado). Executado direto na `main`, sem branch/worktree, com commit por task.

> **For agentic workers:** Implemente task-por-task, em ordem. Cada passo é atômico (2-5 min). Steps usam checkbox (`- [ ]`) para tracking. **Execução direto na branch `main`** (sem branch/worktree, a pedido do dev) — o dev quer testar na main. Faça commits frequentes na main após cada task verde.

**Goal:** Fechar as 5 vulnerabilidades launch-gating da Spec 23 (SEC-01 rate limiting, SEC-02 hash de token de convite, SEC-04 proteção de `/api/v1`, SEC-08a trilha de auditoria, SEC-09 recuperação de senha segura) para permitir abertura pública do MyAccountant.

**Architecture:** Rate limiting via Upstash Redis (edge-safe, REST) num módulo compartilhado. Tokens (convite + reset) armazenados como SHA-256. Autenticação de `/api/v1` centralizada no middleware (401); autorização segue por-handler. Recuperação de senha como fluxo pré-auth (ações públicas) com invalidação de sessão via `passwordChangedAt` embutido no JWT e checado server-side. Auditoria via model `AuditLog` account-scoped.

**Tech Stack:** Next.js 15 (App Router), Prisma + PostgreSQL (Neon), NextAuth v5 (JWT strategy), Zod, React Hook Form + MUI, `@upstash/ratelimit` + `@upstash/redis`, `bcryptjs` (já presente), Vitest + `vitest-mock-extended`, React Email + Brevo.

## Global Constraints

- **Dinheiro:** não aplicável a esta spec (nenhum valor monetário tocado).
- **Multi-tenancy:** toda query nova que toca dados de Account filtra por `accountId` (AuditLog). `SKILL multitenancy`.
- **Tokens:** NUNCA persistir token raw. Só `createHash("sha256").update(token).digest("hex")`. Raw só em email/URL.
- **Env vars:** nunca `process.env.X` direto — sempre `env` de `@/lib/env`. `SKILL env-validation`.
- **Logging:** sem `console.log`. `const log = logger.child({ module: "..." })` de `@/server/logger`. Redact já cobre `*.token`/`*.password`/`*.secret`. `SKILL logging`.
- **UI:** só MUI + tokens do tema (`@/lib/design-tokens`), padrões RHF+Zod. Testar light E dark. `SKILL mui-patterns` / `design-system`.
- **Server Actions de Account:** `defineAction`. Ações **pré-auth** (signup/reset) NÃO usam `defineAction` — seguem o padrão de `signupAction`.
- **Prisma:** IDs `cuid()`, `@map`/`@@map` snake_case, `onDelete` explícito, timestamps `created_at`. `SKILL prisma-conventions`.
- **Idioma:** código/identificadores em inglês; mensagens de UI em pt-BR.
- **Comandos rodam no container:** prefixe com `docker compose exec app`. Test de um arquivo: `docker compose exec app pnpm test <path>`. Migration: `docker compose exec app pnpm prisma migrate dev --name <snake_case>`.

---

## Phase A — Fundações (schema, crypto, rate-limit infra)

### Task 1: Schema Prisma — `passwordChangedAt`, `PasswordResetToken`, `AuditLog`

**Files:**
- Modify: `prisma/schema.prisma` (model `User` ~95-134, model `Account` ~179-214, e novos models)
- Migration gerada: `prisma/migrations/**`

**Interfaces:**
- Produces: coluna `users.password_changed_at DateTime?`; tabela `password_reset_tokens` (`id`, `userId`, `tokenHash @unique`, `expiresAt`, `usedAt`, `createdAt`); tabela `audit_logs` (`id`, `accountId`, `actorUserId?`, `action`, `targetType`, `targetId?`, `metadata Json?`, `createdAt`, `@@index([accountId, createdAt])`).

- [ ] **Step 1: Adicionar campo `passwordChangedAt` ao model `User`**

No model `User`, logo após `passwordHash  String?   @map("password_hash")`, adicionar:

```prisma
  passwordHash      String?   @map("password_hash")
  passwordChangedAt DateTime? @map("password_changed_at")
```

E no bloco de relations do `User`, adicionar as duas relations reversas (junto às demais, antes de `@@map("users")`):

```prisma
  passwordResetTokens PasswordResetToken[]
  auditLogsActed      AuditLog[]           @relation("AuditLogActor")
```

- [ ] **Step 2: Adicionar relation reversa de AuditLog ao model `Account`**

No model `Account`, no bloco de relations (antes de `@@map("accounts")`), adicionar:

```prisma
  auditLogs            AuditLog[]
```

- [ ] **Step 3: Adicionar os dois novos models ao final do schema (antes de nenhum, no fim do arquivo)**

```prisma
model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_reset_tokens")
}

model AuditLog {
  id          String   @id @default(cuid())
  accountId   String   @map("account_id")
  actorUserId String?  @map("actor_user_id")
  action      String
  targetType  String   @map("target_type")
  targetId    String?  @map("target_id")
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  actor   User?   @relation("AuditLogActor", fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([accountId, createdAt])
  @@map("audit_logs")
}
```

> Nota: `actorUserId` é nullable + `onDelete: SetNull` para **preservar a trilha** se o usuário for deletado depois (integridade de auditoria). `account` é `Cascade` — a trilha morre com a Account (DD-09).

- [ ] **Step 4: Validar o schema**

Run: `docker compose exec app pnpm prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Criar e aplicar a migration**

Run: `docker compose exec app pnpm prisma migrate dev --name add_password_reset_audit_log`
Expected: migration criada em `prisma/migrations/<ts>_add_password_reset_audit_log/`, aplicada sem erro, client regenerado.

- [ ] **Step 6: Typecheck**

Run: `docker compose exec app pnpm typecheck`
Expected: sem erros (o client Prisma novo já tem os tipos).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(security): add passwordChangedAt, PasswordResetToken, AuditLog models (SEC-08a/09)"
```

---

### Task 2: Utilitário `hashToken` (compartilhado SEC-02 + SEC-09)

**Files:**
- Create: `src/server/security/hash-token.ts`
- Test: `src/server/security/hash-token.test.ts`

**Interfaces:**
- Produces: `hashToken(token: string): string` (SHA-256 hex).

- [ ] **Step 1: Escrever o teste que falha**

Create `src/server/security/hash-token.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { hashToken } from "./hash-token";

describe("hashToken", () => {
  it("gera SHA-256 hex determinístico", () => {
    // SHA-256 de "abc" (valor conhecido)
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("é determinístico para a mesma entrada", () => {
    expect(hashToken("token-xyz")).toBe(hashToken("token-xyz"));
  });

  it("difere para entradas diferentes", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `docker compose exec app pnpm test src/server/security/hash-token.test.ts`
Expected: FAIL — "Cannot find module './hash-token'".

- [ ] **Step 3: Implementar**

Create `src/server/security/hash-token.ts`:

```ts
import { createHash } from "crypto";

/**
 * Hash SHA-256 (hex) de um token. Usado para armazenar tokens de convite (SEC-02)
 * e de recuperação de senha (SEC-09) em repouso — o token raw só trafega no email/URL.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `docker compose exec app pnpm test src/server/security/hash-token.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/server/security/hash-token.ts src/server/security/hash-token.test.ts
git commit -m "feat(security): add hashToken util (SEC-02/09)"
```

---

### Task 3: `RateLimitError` + status 429

**Files:**
- Modify: `src/lib/action-result.ts` (union `ActionErrorCode`)
- Modify: `src/server/api/errors.ts` (nova classe)
- Modify: `src/server/api/route-helpers.ts` (`ERROR_STATUS`)

**Interfaces:**
- Produces: código `"TOO_MANY_REQUESTS"`; `class RateLimitError extends AppError`; mapeamento `TOO_MANY_REQUESTS → 429`.

- [ ] **Step 1: Adicionar o código ao union**

Em `src/lib/action-result.ts`, no type `ActionErrorCode`, adicionar a variante:

```ts
export type ActionErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL";
```

- [ ] **Step 2: Adicionar `RateLimitError`**

Em `src/server/api/errors.ts`, após `UnauthorizedError`, adicionar:

```ts
export class RateLimitError extends AppError {
  constructor(message = "Muitas tentativas. Tente novamente mais tarde.") {
    super("TOO_MANY_REQUESTS", message);
  }
}
```

- [ ] **Step 3: Mapear para 429 nos route handlers**

Em `src/server/api/route-helpers.ts`, no objeto `ERROR_STATUS`, adicionar a linha:

```ts
const ERROR_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
};
```

- [ ] **Step 4: Typecheck**

Run: `docker compose exec app pnpm typecheck`
Expected: sem erros (o `defineAction` propaga `error.code` sem alteração).

- [ ] **Step 5: Commit**

```bash
git add src/lib/action-result.ts src/server/api/errors.ts src/server/api/route-helpers.ts
git commit -m "feat(security): add TOO_MANY_REQUESTS code + RateLimitError → 429 (SEC-01)"
```

---

### Task 4: Módulo de rate limiting Upstash + deps + env

**Files:**
- Modify: `package.json` (deps)
- Modify: `src/lib/env.ts` (Upstash vars)
- Modify: `.env.example`
- Create: `src/server/security/rate-limit.ts`
- Create: `src/server/security/request-ip.ts`
- Test: `src/server/security/rate-limit.test.ts`

**Interfaces:**
- Produces: `loginLimiter`, `signupLimiter`, `inviteLimiter`, `resetLimiter` (`Ratelimit | null`); `enforceRateLimit(limiter, key): Promise<void>` (throws `RateLimitError`); `getRequestIp(): Promise<string>`.
- Consumes: `RateLimitError` (Task 3), `env` (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).

- [ ] **Step 1: Instalar as dependências**

Run: `docker compose exec app pnpm add @upstash/ratelimit @upstash/redis`
Expected: adicionadas ao `package.json`.

- [ ] **Step 2: Declarar as env vars (server) e no runtimeEnv**

Em `src/lib/env.ts`, dentro de `server:`, após `ALLOWED_EMAILS`, adicionar:

```ts
    ALLOWED_EMAILS: z.string().optional(),

    // ===== Rate limiting (SEC-01) =====
    // Obrigatórias em produção — o boot falha sem elas (ver src/server/security/rate-limit.ts).
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
```

E em `runtimeEnv:`, adicionar as duas linhas:

```ts
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
```

- [ ] **Step 3: Atualizar `.env.example`**

Em `.env.example`, adicionar a seção:

```bash
# ===== Rate limiting (SEC-01) — obrigatório em produção =====
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

- [ ] **Step 4: Escrever o teste que falha (enforceRateLimit)**

Create `src/server/security/rate-limit.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { RateLimitError } from "@/server/api/errors";
import { enforceRateLimit } from "./rate-limit";

describe("enforceRateLimit", () => {
  it("no-op quando o limiter é null (Upstash não configurado)", async () => {
    await expect(enforceRateLimit(null, "k")).resolves.toBeUndefined();
  });

  it("passa quando limiter.limit retorna success=true", async () => {
    const limiter = { limit: vi.fn().mockResolvedValue({ success: true }) } as never;
    await expect(enforceRateLimit(limiter, "k")).resolves.toBeUndefined();
  });

  it("lança RateLimitError quando success=false", async () => {
    const limiter = { limit: vi.fn().mockResolvedValue({ success: false }) } as never;
    await expect(enforceRateLimit(limiter, "k")).rejects.toBeInstanceOf(RateLimitError);
  });
});
```

- [ ] **Step 5: Rodar e confirmar falha**

Run: `docker compose exec app pnpm test src/server/security/rate-limit.test.ts`
Expected: FAIL — módulo `./rate-limit` não existe.

- [ ] **Step 6: Implementar o módulo de rate limit**

Create `src/server/security/rate-limit.ts`:

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";
import { RateLimitError } from "@/server/api/errors";

const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// SEC-01: em produção o rate limiting é obrigatório — falha o boot se faltar config.
if (env.NODE_ENV === "production" && !redis) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN são obrigatórios em produção (SEC-01).",
  );
}

type Duration = `${number} ${"s" | "m" | "h" | "d"}`;

function makeLimiter(requests: number, window: Duration, prefix: string) {
  return redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window), prefix })
    : null;
}

export const loginLimiter = makeLimiter(10, "15 m", "rl:login");
export const signupLimiter = makeLimiter(5, "1 h", "rl:signup");
export const inviteLimiter = makeLimiter(5, "1 h", "rl:invite");
export const resetLimiter = makeLimiter(3, "1 h", "rl:reset");

/**
 * Consome uma unidade do limiter para `key`. No-op se o limiter for null
 * (dev/test sem Upstash). Lança RateLimitError (→ 429) quando a janela estoura.
 */
export async function enforceRateLimit(
  limiter: Ratelimit | null,
  key: string,
): Promise<void> {
  if (!limiter) return;
  const { success } = await limiter.limit(key);
  if (!success) throw new RateLimitError();
}
```

- [ ] **Step 7: Implementar o helper de IP**

Create `src/server/security/request-ip.ts`:

```ts
import { headers } from "next/headers";

/**
 * IP do cliente a partir dos headers de proxy. Usado como chave de rate limit
 * em Server Actions (SEC-01). Retorna "unknown" se nenhum header estiver presente.
 */
export async function getRequestIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
```

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `docker compose exec app pnpm test src/server/security/rate-limit.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/env.ts .env.example src/server/security/rate-limit.ts src/server/security/request-ip.ts src/server/security/rate-limit.test.ts
git commit -m "feat(security): add Upstash rate-limit module + IP helper + env (SEC-01)"
```

---

## Phase B — SEC-04: proteção de `/api/v1` no middleware

### Task 5: Middleware protege `/api/v1/*` (401) e limita login (429)

**Files:**
- Modify: `src/middleware.ts`

**Interfaces:**
- Consumes: `loginLimiter` (Task 4).
- Produces: 401 JSON para `/api/v1/*` sem sessão; 429 JSON para `POST /api/auth/callback/credentials` acima do limite.

> Middleware (edge) não é coberto por unit test na infra atual — verificação é manual (curl). O `enforceRateLimit`/`hashToken` já têm cobertura unitária.

- [ ] **Step 1: Reescrever o middleware**

Substituir o conteúdo de `src/middleware.ts` por:

```ts
import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import { authConfig } from "@/server/auth/config";
import { loginLimiter } from "@/server/security/rate-limit";

const { auth } = NextAuth(authConfig);

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];
const PUBLIC_ROUTES = ["/invite"];

function clientIp(req: { headers: Headers }): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // SEC-01: rate limit de login por IP (todas as tentativas na janela).
  if (req.method === "POST" && pathname === "/api/auth/callback/credentials") {
    if (loginLimiter) {
      const { success } = await loginLimiter.limit(`login:${clientIp(req)}`);
      if (!success) {
        return NextResponse.json(
          {
            error: "TooManyRequests",
            message: "Muitas tentativas de login. Tente novamente em alguns minutos.",
          },
          { status: 429 },
        );
      }
    }
    return NextResponse.next();
  }

  // SEC-04: /api/v1 exige sessão (autenticação). Autorização de Account segue por-handler.
  if (pathname.startsWith("/api/v1/")) {
    if (!req.auth?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ===== Fluxo de páginas (inalterado) =====
  const isAuthenticated = !!req.auth?.user?.id;
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  if (!isAuthenticated && !isAuthRoute && !isPublicRoute) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/api/v1/:path*",
    "/api/auth/callback/credentials",
  ],
};
```

> Nota: `/api/health`, `/api/docs`, `/api/openapi.json` e as rotas MCP **não** estão sob `/api/v1/` nem casam com o matcher — permanecem públicas/intactas. Confirme no Step 3 que nenhuma rota `/api/v1/*` depende de Bearer (todas usam sessão via `requireAccountAccess`).

- [ ] **Step 2: Typecheck + lint**

Run: `docker compose exec app pnpm typecheck && docker compose exec app pnpm lint`
Expected: sem erros.

- [ ] **Step 3: Verificação manual — 401 em `/api/v1` sem sessão**

Com o app rodando (`docker compose up -d`), e SEM cookie de sessão:

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/accounts/qualquer/months`
Expected: `401`

Confirme também que rota pública segue OK:
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health`
Expected: `200`

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(security): protect /api/v1 (401) + login rate limit in middleware (SEC-04/01)"
```

---

## Phase C — SEC-01: aplicar rate limit em signup e convites

### Task 6: Rate limit no `signupAction` (por IP)

**Files:**
- Modify: `src/actions/auth.ts` (`signupAction`)

**Interfaces:**
- Consumes: `signupLimiter`, `enforceRateLimit`, `getRequestIp`, `RateLimitError`.

> `src/actions/**` é excluído da cobertura; verificação por typecheck + teste manual. A lógica pura (enforceRateLimit) já é testada.

- [ ] **Step 1: Adicionar o rate limit ao `signupAction`**

Em `src/actions/auth.ts`, adicionar os imports:

```ts
import { AppError, RateLimitError } from "@/server/api/errors";
import { enforceRateLimit, signupLimiter } from "@/server/security/rate-limit";
import { getRequestIp } from "@/server/security/request-ip";
```

E no início do corpo de `signupAction`, ANTES do `signupSchema.safeParse`, inserir o bloco:

```ts
export async function signupAction(rawInput: unknown): Promise<ActionResult<{ userId: string }>> {
  try {
    await enforceRateLimit(signupLimiter, `signup:${await getRequestIp()}`);
  } catch (err) {
    if (err instanceof RateLimitError) return actionError("TOO_MANY_REQUESTS", err.message);
    throw err;
  }

  const parsed = signupSchema.safeParse(rawInput);
  // ... resto inalterado
```

- [ ] **Step 2: Typecheck**

Run: `docker compose exec app pnpm typecheck`
Expected: sem erros.

- [ ] **Step 3: Verificação manual (opcional, requer Upstash configurado)**

Com `UPSTASH_*` setado, submeter 6 cadastros do mesmo IP em <1h → o 6º retorna erro `TOO_MANY_REQUESTS` ("Muitas tentativas..."). Sem Upstash em dev, o limiter é no-op (comportamento inalterado).

- [ ] **Step 4: Commit**

```bash
git add src/actions/auth.ts
git commit -m "feat(security): rate limit signup by IP (SEC-01)"
```

---

### Task 7: Rate limit em `inviteMember` (por userId)

**Files:**
- Modify: `src/server/services/member-service.ts` (`inviteMember`)
- Modify: `src/server/services/member-service.test.ts` (novo teste)

**Interfaces:**
- Consumes: `enforceRateLimit`, `inviteLimiter`.

- [ ] **Step 1: Escrever o teste que falha**

Em `src/server/services/member-service.test.ts`, adicionar ao `describe("inviteMember", ...)` um novo teste (e o mock do módulo de rate-limit no topo do arquivo, junto aos outros `vi.mock`):

No topo, junto aos `vi.mock` existentes:

```ts
vi.mock("@/server/security/rate-limit", () => ({
  inviteLimiter: {},
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));
```

E o teste:

```ts
  it("aplica rate limit por userId antes de criar convite", async () => {
    const { enforceRateLimit } = await import("@/server/security/rate-limit");
    prismaMock.account.findUnique.mockResolvedValue({ name: "Conta" } as never);
    prismaMock.accountMember.findFirst.mockResolvedValue(null);
    prismaMock.accountInvite.findFirst.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ name: "H", email: "h@t.com" } as never);
    prismaMock.accountInvite.create.mockResolvedValue({ id: "inv-1" } as never);

    await inviteMember({ email: "novo@test.com", role: "editor" }, TEST_CTX);

    expect(enforceRateLimit).toHaveBeenCalledWith(expect.anything(), `invite:${TEST_CTX.userId}`);
  });
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `docker compose exec app pnpm test src/server/services/member-service.test.ts`
Expected: FAIL — `enforceRateLimit` não foi chamado (ainda não integrado).

- [ ] **Step 3: Integrar no service**

Em `src/server/services/member-service.ts`, adicionar o import:

```ts
import { enforceRateLimit, inviteLimiter } from "@/server/security/rate-limit";
```

E como PRIMEIRA linha do corpo de `inviteMember` (antes de buscar a account):

```ts
export async function inviteMember(input: InviteMemberInput, ctx: ActionContext) {
  const { email, role } = input;
  const { accountId, userId } = ctx;

  await enforceRateLimit(inviteLimiter, `invite:${userId}`);

  const account = await prisma.account.findUnique({
  // ... resto inalterado
```

- [ ] **Step 4: Rodar e confirmar que passa (e não quebrou os demais)**

Run: `docker compose exec app pnpm test src/server/services/member-service.test.ts`
Expected: PASS (todos, incluindo o novo).

- [ ] **Step 5: Commit**

```bash
git add src/server/services/member-service.ts src/server/services/member-service.test.ts
git commit -m "feat(security): rate limit member invites by userId (SEC-01)"
```

---

## Phase D — SEC-02: hash do token de convite

### Task 8: Hashear token na criação e nos lookups

**Files:**
- Modify: `src/server/services/member-service.ts` (`inviteMember`, `getInviteByToken`, `acceptInvite`, `declineInvite`)
- Modify: `src/server/services/member-service.test.ts`

**Interfaces:**
- Consumes: `hashToken` (Task 2).
- Comportamento: DB guarda `hashToken(raw)`; email/URL levam o raw; lookups comparam por `hashToken(raw)`.

- [ ] **Step 1: Escrever/ajustar os testes que falham**

Em `src/server/services/member-service.test.ts`, adicionar ao `describe("inviteMember", ...)`:

```ts
  it("armazena o HASH do token, não o token raw", async () => {
    const { hashToken } = await import("@/server/security/hash-token");
    prismaMock.account.findUnique.mockResolvedValue({ name: "Conta" } as never);
    prismaMock.accountMember.findFirst.mockResolvedValue(null);
    prismaMock.accountInvite.findFirst.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ name: "H", email: "h@t.com" } as never);
    prismaMock.accountInvite.create.mockResolvedValue({ id: "inv-1" } as never);

    await inviteMember({ email: "novo@test.com", role: "editor" }, TEST_CTX);

    const createArg = (prismaMock.accountInvite.create as any).mock.calls[0][0];
    const storedToken: string = createArg.data.token;
    // Deve ser um hash SHA-256 (64 hex), não os 64 hex do randomBytes(32) raw:
    expect(storedToken).toMatch(/^[a-f0-9]{64}$/);
    // E deve bater com hashToken de algum raw — verificamos indiretamente no lookup abaixo.
    expect(hashToken(storedToken)).not.toBe(storedToken); // hash de hash != hash
  });
```

E ajustar o `describe("acceptInvite", ...)` (e getInviteByToken/decline) para verificar o lookup por hash. Adicionar:

```ts
  it("acceptInvite busca o convite pelo HASH do token recebido", async () => {
    const { hashToken } = await import("@/server/security/hash-token");
    prismaMock.user.findUnique.mockResolvedValue({ name: "U", email: "u@t.com" } as never);
    prismaMock.accountInvite.findUnique.mockResolvedValue(null);

    await expect(acceptInvite("raw-token-abc", "user-1")).rejects.toBeInstanceOf(NotFoundError);

    expect(prismaMock.accountInvite.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: hashToken("raw-token-abc") } }),
    );
  });
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `docker compose exec app pnpm test src/server/services/member-service.test.ts`
Expected: FAIL (lookup ainda usa o token raw; store ainda é raw).

- [ ] **Step 3: Implementar o hashing no service**

Em `src/server/services/member-service.ts`, adicionar o import:

```ts
import { hashToken } from "@/server/security/hash-token";
```

Em `inviteMember`, ao criar o convite, guardar o hash (mantendo o raw só para a URL). Alterar o bloco de criação:

```ts
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invite = await prisma.accountInvite.create({
    data: {
      accountId,
      email,
      role,
      token: hashToken(token),
      expiresAt,
      invitedById: userId,
    },
  });

  const acceptUrl = `${env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${token}`;
```

Em `getInviteByToken`, trocar a linha do `where`:

```ts
  const invite = await prisma.accountInvite.findUnique({
    where: { token: hashToken(token) },
```

Em `acceptInvite`, trocar:

```ts
  const invite = await prisma.accountInvite.findUnique({
    where: { token: hashToken(token) },
    include: { account: { select: { id: true, name: true } } },
  });
```

Em `declineInvite`, trocar:

```ts
  const invite = await prisma.accountInvite.findUnique({ where: { token: hashToken(token) } });
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `docker compose exec app pnpm test src/server/services/member-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/member-service.ts src/server/services/member-service.test.ts
git commit -m "feat(security): store invite token as SHA-256 hash (SEC-02)"
```

---

### Task 9: Migration — hashear tokens de convite existentes in-place

**Files:**
- Create: `prisma/migrations/<ts>_hash_existing_invite_tokens/migration.sql` (via `migrate dev --create-only`)

**Interfaces:**
- Efeito: converte `account_invites.token` plaintext existente para SHA-256, sem invalidar convites pendentes já enviados.

> Postgres tem `digest()` na extensão `pgcrypto`. A migration habilita a extensão e atualiza as linhas cujo token ainda tem 64 hex de `randomBytes` (todas as atuais). Como `randomBytes(32).toString("hex")` e o SHA-256 hex têm ambos 64 chars, distinguimos por marca de "já migrado": rodamos o update uma única vez nesta migration (idempotência garantida por ser migration imutável aplicada uma vez).

- [ ] **Step 1: Criar a migration vazia**

Run: `docker compose exec app pnpm prisma migrate dev --create-only --name hash_existing_invite_tokens`
Expected: pasta de migration criada com `migration.sql` vazio (ou com no-op).

- [ ] **Step 2: Escrever o SQL de data-fix**

Substituir o conteúdo de `prisma/migrations/<ts>_hash_existing_invite_tokens/migration.sql` por:

```sql
-- SEC-02: hasheia in-place os tokens de convite que ainda estão em plaintext.
-- pgcrypto fornece digest(); encode(..., 'hex') gera o SHA-256 em hex (64 chars).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "account_invites"
SET "token" = encode(digest("token", 'sha256'), 'hex')
WHERE "status" = 'pending';
```

> Só convites `pending` importam (accepted/revoked/expired não são mais usados no lookup). Após esta migration, o token plaintext some do banco e os links de email pendentes continuam válidos (o app hasheia o raw recebido e bate com o hash gravado).

- [ ] **Step 3: Aplicar a migration**

Run: `docker compose exec app pnpm prisma migrate dev`
Expected: migration aplicada sem erro.

- [ ] **Step 4: Verificação manual (opcional)**

Se houver convites pendentes de teste, no `prisma studio` confirmar que `token` mudou para um hash e que um link de aceite antigo ainda resolve o convite.

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations
git commit -m "feat(security): hash existing invite tokens in-place migration (SEC-02)"
```

---

### Task 10: Adaptar safety-net de convite pendente ao hashing (via `inviteId`)

**Files:**
- Modify: `src/server/services/member-service.ts` (`getPendingInviteForEmail`)
- Modify: `src/app/(app)/home/page.tsx`
- Modify: `src/server/services/member-service.test.ts`

**Interfaces:**
- `getPendingInviteForEmail(email)` passa a retornar `{ id: string } | null` (não mais `{ token }`, que agora é hash inútil na URL).
- Produces: redirect do home para `/invite/accept?inviteId=<id>`.
- Consumes (no Task 11): a página de aceite passa a resolver por `inviteId` além de `token`.

> Motivo: `home/page.tsx` era o único lugar que lia o token **do banco** para montar a URL. Com o hash, isso quebra. A confiança no aceite já é email-match (não posse de token), então roteamos por `inviteId`.

- [ ] **Step 1: Ajustar o teste de `getPendingInviteForEmail`**

Em `src/server/services/member-service.test.ts`, no `describe("getPendingInviteForEmail", ...)`, ajustar a expectativa para `id` em vez de `token`:

```ts
  it("retorna o id do convite pendente mais recente", async () => {
    prismaMock.accountInvite.findFirst.mockResolvedValue({ id: "inv-9" } as never);
    const result = await getPendingInviteForEmail("convidado@test.com");
    expect(result).toEqual({ id: "inv-9" });
    expect(prismaMock.accountInvite.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true } }),
    );
  });
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `docker compose exec app pnpm test src/server/services/member-service.test.ts`
Expected: FAIL (ainda seleciona `token`).

- [ ] **Step 3: Alterar `getPendingInviteForEmail`**

Em `src/server/services/member-service.ts`, trocar o `select`:

```ts
export async function getPendingInviteForEmail(email: string) {
  return prisma.accountInvite.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
}
```

- [ ] **Step 4: Alterar o redirect do home**

Em `src/app/(app)/home/page.tsx`, trocar a linha do redirect:

```ts
      const invite = await getPendingInviteForEmail(user.email);
      if (invite) redirect(`/invite/accept?inviteId=${invite.id}`);
```

- [ ] **Step 5: Rodar teste + typecheck**

Run: `docker compose exec app pnpm test src/server/services/member-service.test.ts && docker compose exec app pnpm typecheck`
Expected: PASS + sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/member-service.ts src/app/\(app\)/home/page.tsx src/server/services/member-service.test.ts
git commit -m "feat(security): route pending-invite safety-net by inviteId (SEC-02)"
```

---

### Task 11: Aceite por `inviteId` (usuário autenticado, email-match)

**Files:**
- Modify: `src/server/services/member-service.ts` (novas fns `getInviteById`, `acceptInviteById`, `declineInviteById`; extrair core)
- Modify: `src/actions/members.ts` (aceitar `{ token?, inviteId? }`)
- Modify: `src/app/(auth)/invite/accept/page.tsx` (resolver por `inviteId`)
- Modify: `src/app/(auth)/invite/accept/InviteActions.tsx` (passar `inviteId`)
- Modify: `src/app/(auth)/invite/accept/InviteViews.tsx` (`InviteConfirmView` aceitar `inviteId`)
- Modify: `src/server/services/member-service.test.ts`

**Interfaces:**
- Produces: `getInviteById(inviteId)` (mesmo shape de `getInviteByToken`), `acceptInviteById(inviteId, userId)`, `declineInviteById(inviteId, userId)`.
- `acceptInviteAction({ token?, inviteId? })` / `declineInviteAction({ token?, inviteId? })`.

- [ ] **Step 1: Escrever o teste que falha (acceptInviteById)**

Em `src/server/services/member-service.test.ts`, novo describe:

```ts
describe("acceptInviteById", () => {
  it("aceita convite pendente por id quando o email do usuário bate", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ name: "U", email: "u@t.com" } as never);
    prismaMock.accountInvite.findUnique.mockResolvedValue({
      id: "inv-1",
      accountId: "acc-1",
      email: "u@t.com",
      role: "editor",
      status: "pending",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      invitedById: "owner-1",
      account: { id: "acc-1", name: "Conta" },
    } as never);
    prismaMock.accountMember.findUnique.mockResolvedValue(null);
    prismaMock.accountMember.create.mockResolvedValue({} as never);
    prismaMock.accountInvite.update.mockResolvedValue({} as never);

    const result = await acceptInviteById("inv-1", "user-1");
    expect(result).toEqual({ accountId: "acc-1" });
    expect(prismaMock.accountInvite.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv-1" } }),
    );
  });
});
```

(importar `acceptInviteById` no topo do teste.)

- [ ] **Step 2: Rodar e confirmar falha**

Run: `docker compose exec app pnpm test src/server/services/member-service.test.ts`
Expected: FAIL — `acceptInviteById` não existe.

- [ ] **Step 3: Refatorar `acceptInvite`/`declineInvite` para um core compartilhado + variantes por id**

Em `src/server/services/member-service.ts`, substituir as funções `acceptInvite` e `declineInvite` por esta estrutura (core + resolvers). Manter a assinatura pública `acceptInvite(token, userId)` / `declineInvite(token, userId)`:

```ts
type InviteWithAccount = {
  id: string;
  accountId: string;
  email: string;
  role: AccountMemberRole;
  status: string;
  expiresAt: Date;
  invitedById: string;
};

async function acceptResolvedInvite(
  invite: (InviteWithAccount & { account: { id: string; name: string } }) | null,
  userId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user) throw new UnauthorizedError();

  if (!invite) throw new NotFoundError("Convite");
  if (invite.status !== "pending")
    throw new ForbiddenError("Este convite já foi usado ou revogado.");
  if (invite.expiresAt < new Date()) throw new ForbiddenError("Este convite expirou.");
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new ForbiddenError(m.account.acceptInvite.wrongEmail);
  }

  const alreadyMember = await prisma.accountMember.findUnique({
    where: { accountId_userId: { accountId: invite.accountId, userId } },
  });
  if (alreadyMember) throw new ConflictError(m.account.acceptInvite.alreadyMember);

  await prisma.$transaction(async (tx) => {
    await tx.accountMember.create({
      data: {
        accountId: invite.accountId,
        userId,
        role: invite.role,
        addedById: invite.invitedById,
      },
    });
    await tx.accountInvite.update({
      where: { id: invite.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });
    await ensurePersonalParty(tx, invite.accountId, userId, user.name ?? user.email);
  });

  void notificationService.notifyInviteAccepted({
    accountId: invite.accountId,
    actorId: userId,
    role: invite.role,
  });

  log.info({ inviteId: invite.id, accountId: invite.accountId, userId }, "Invite accepted");
  return { accountId: invite.accountId };
}

export async function acceptInvite(token: string, userId: string) {
  const invite = await prisma.accountInvite.findUnique({
    where: { token: hashToken(token) },
    include: { account: { select: { id: true, name: true } } },
  });
  return acceptResolvedInvite(invite as never, userId);
}

export async function acceptInviteById(inviteId: string, userId: string) {
  const invite = await prisma.accountInvite.findUnique({
    where: { id: inviteId },
    include: { account: { select: { id: true, name: true } } },
  });
  return acceptResolvedInvite(invite as never, userId);
}

async function declineResolvedInvite(
  invite: InviteWithAccount | null,
  userId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) throw new UnauthorizedError();

  if (!invite) throw new NotFoundError("Convite");
  if (invite.status !== "pending")
    throw new ForbiddenError("Este convite já foi usado ou revogado.");
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new ForbiddenError(m.account.acceptInvite.wrongEmail);
  }

  await prisma.accountInvite.update({
    where: { id: invite.id },
    data: { status: "revoked" },
  });

  log.info({ inviteId: invite.id }, "Invite declined");
}

export async function declineInvite(token: string, userId: string) {
  const invite = await prisma.accountInvite.findUnique({ where: { token: hashToken(token) } });
  return declineResolvedInvite(invite as never, userId);
}

export async function declineInviteById(inviteId: string, userId: string) {
  const invite = await prisma.accountInvite.findUnique({ where: { id: inviteId } });
  return declineResolvedInvite(invite as never, userId);
}
```

Adicionar `getInviteById` (para a página renderizar por id), logo após `getInviteByToken`:

```ts
export async function getInviteById(inviteId: string) {
  if (!inviteId) return null;
  const invite = await prisma.accountInvite.findUnique({
    where: { id: inviteId },
    select: {
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      accountId: true,
      account: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });
  if (!invite) return null;
  const isExpired = invite.expiresAt < new Date();
  return {
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expiresAt,
    accountId: invite.accountId,
    accountName: invite.account.name,
    inviterName: invite.invitedBy.name ?? invite.invitedBy.email,
    isExpired,
    isValid: invite.status === "pending" && !isExpired,
  };
}
```

> Garanta que `AccountMemberRole` esteja importado no topo: `import type { AccountMemberRole } from "@prisma/client";`

- [ ] **Step 4: Atualizar as actions para aceitar token OU inviteId**

Substituir `acceptInviteAction`/`declineInviteAction` em `src/actions/members.ts`:

```ts
type InviteRef = { token?: string; inviteId?: string };

export async function acceptInviteAction(
  ref: InviteRef,
): Promise<ActionResult<{ accountId: string }>> {
  try {
    const user = await requireUser().catch(() => null);
    if (!user) return actionError("UNAUTHORIZED", "Você precisa estar logado.");

    const result = ref.inviteId
      ? await memberService.acceptInviteById(ref.inviteId, user.id)
      : await memberService.acceptInvite(ref.token ?? "", user.id);
    return actionSuccess(result);
  } catch (error) {
    if (error instanceof AppError) return actionError(error.code, error.message, error.fieldErrors);
    log.error({ err: error }, "Accept invite failed");
    return actionError("INTERNAL", "Erro inesperado. Tente novamente.");
  }
}

export async function declineInviteAction(ref: InviteRef): Promise<ActionResult<void>> {
  try {
    const user = await requireUser().catch(() => null);
    if (!user) return actionError("UNAUTHORIZED", "Você precisa estar logado.");

    if (ref.inviteId) await memberService.declineInviteById(ref.inviteId, user.id);
    else await memberService.declineInvite(ref.token ?? "", user.id);
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) return actionError(error.code, error.message, error.fieldErrors);
    log.error({ err: error }, "Decline invite failed");
    return actionError("INTERNAL", "Erro inesperado. Tente novamente.");
  }
}
```

- [ ] **Step 5: Atualizar `InviteActions.tsx` para o novo shape**

Em `src/app/(auth)/invite/accept/InviteActions.tsx`, trocar o `Props` e as chamadas:

```ts
type Props = {
  token?: string;
  inviteId?: string;
};

export function InviteActions({ token, inviteId }: Props) {
  // ...
  // dentro de handleAccept:
      const result = await acceptInviteAction({ token, inviteId });
  // dentro de handleDecline:
      const result = await declineInviteAction({ token, inviteId });
```

- [ ] **Step 6: Atualizar `InviteConfirmView` e a página de aceite**

Em `src/app/(auth)/invite/accept/InviteViews.tsx`, no `InviteConfirmView`, adicionar `inviteId?: string` às props e repassar para `<InviteActions token={token} inviteId={inviteId} />`.

Em `src/app/(auth)/invite/accept/page.tsx`, aceitar `inviteId` no searchParams e resolver por ele quando não houver token:

```ts
import { getInviteById, getInviteByToken } from "@/server/services/member-service";

type SearchParams = Promise<{ token?: string; inviteId?: string }>;

export default async function AcceptInvitePage({ searchParams }: { searchParams: SearchParams }) {
  const { token = "", inviteId = "" } = await searchParams;
  const invite = token ? await getInviteByToken(token) : inviteId ? await getInviteById(inviteId) : null;
  // ... blocos de estado inalterados ...
```

No cenário B (logado, email certo), passar `inviteId` ao confirm view:

```ts
  return (
    <InviteConfirmView
      inviterName={invite.inviterName}
      accountName={invite.accountName}
      roleLabel={roleLabel}
      token={token || undefined}
      inviteId={inviteId || undefined}
    />
  );
```

E no cenário A (sem sessão), preservar o param na callbackUrl:

```ts
        callbackUrl={
          token
            ? `/invite/accept?token=${encodeURIComponent(token)}`
            : `/invite/accept?inviteId=${encodeURIComponent(inviteId)}`
        }
```

- [ ] **Step 7: Rodar testes + typecheck + lint**

Run: `docker compose exec app pnpm test src/server/services/member-service.test.ts && docker compose exec app pnpm typecheck && docker compose exec app pnpm lint`
Expected: PASS + sem erros.

- [ ] **Step 8: Verificação manual do fluxo**

Fluxo email-link (token) e fluxo safety-net (inviteId): ver Test Plan §D.

- [ ] **Step 9: Commit**

```bash
git add src/server/services/member-service.ts src/actions/members.ts "src/app/(auth)/invite/accept" src/server/services/member-service.test.ts
git commit -m "feat(security): accept/decline invite by inviteId for authed email-match (SEC-02)"
```

---

## Phase E — SEC-08a: trilha de auditoria

### Task 12: `audit-service` + gravação nos eventos de membro

**Files:**
- Create: `src/server/services/audit-service.ts`
- Test: `src/server/services/audit-service.test.ts`
- Modify: `src/server/services/member-service.ts` (gravar em invite/accept/decline/role/remove/leave)

**Interfaces:**
- Produces: `recordAudit(input: { accountId; actorUserId; action; targetType; targetId?; metadata? }): Promise<void>`; `AuditAction` union.
- Actions gravadas: `member.role_changed`, `member.removed`, `member.left`, `invite.sent`, `invite.accepted`, `invite.revoked`. (`auth.password_reset` é gravado no Task 15.)

- [ ] **Step 1: Escrever o teste que falha**

Create `src/server/services/audit-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { recordAudit } from "./audit-service";

describe("recordAudit", () => {
  it("cria um AuditLog com os campos fornecidos", async () => {
    prismaMock.auditLog.create.mockResolvedValue({ id: "log-1" } as never);

    await recordAudit({
      accountId: "acc-1",
      actorUserId: "user-1",
      action: "member.role_changed",
      targetType: "member",
      targetId: "user-2",
      metadata: { from: "editor", to: "owner" },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        accountId: "acc-1",
        actorUserId: "user-1",
        action: "member.role_changed",
        targetType: "member",
        targetId: "user-2",
        metadata: { from: "editor", to: "owner" },
      },
    });
  });

  it("não lança se a gravação falhar (auditoria é best-effort)", async () => {
    prismaMock.auditLog.create.mockRejectedValue(new Error("db down"));
    await expect(
      recordAudit({ accountId: "a", actorUserId: "u", action: "invite.sent", targetType: "invite" }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `docker compose exec app pnpm test src/server/services/audit-service.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o service**

Create `src/server/services/audit-service.ts`:

```ts
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";

const log = logger.child({ module: "audit-service" });

export type AuditAction =
  | "member.role_changed"
  | "member.removed"
  | "member.left"
  | "invite.sent"
  | "invite.accepted"
  | "invite.revoked"
  | "auth.password_reset";

export type RecordAuditInput = {
  accountId: string;
  actorUserId: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Grava uma entrada de auditoria (SEC-08a). Best-effort: uma falha aqui NÃO
 * deve derrubar a operação de negócio — apenas logamos o erro.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        accountId: input.accountId,
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (err) {
    log.error({ err, action: input.action, accountId: input.accountId }, "Failed to record audit log");
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `docker compose exec app pnpm test src/server/services/audit-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Gravar auditoria nos eventos de `member-service`**

Em `src/server/services/member-service.ts`, importar:

```ts
import { recordAudit } from "@/server/services/audit-service";
```

Adicionar chamadas `void recordAudit(...)` (fire-and-forget, best-effort) logo após cada `log.info` de sucesso:

- `inviteMember` (após criar): `void recordAudit({ accountId, actorUserId: userId, action: "invite.sent", targetType: "invite", targetId: invite.id, metadata: { email, role } });`
- `revokeInvite`: `void recordAudit({ accountId: ctx.accountId, actorUserId: ctx.userId, action: "invite.revoked", targetType: "invite", targetId: invite.id });`
- `acceptResolvedInvite` (após tx): `void recordAudit({ accountId: invite.accountId, actorUserId: userId, action: "invite.accepted", targetType: "invite", targetId: invite.id, metadata: { role: invite.role } });`
- `removeMember`: `void recordAudit({ accountId: ctx.accountId, actorUserId: ctx.userId, action: "member.removed", targetType: "member", targetId: input.targetUserId });`
- `updateMemberRole`: `void recordAudit({ accountId: ctx.accountId, actorUserId: ctx.userId, action: "member.role_changed", targetType: "member", targetId: input.targetUserId, metadata: { role: input.role } });`
- `leaveAccount`: `void recordAudit({ accountId: ctx.accountId, actorUserId: ctx.userId, action: "member.left", targetType: "member", targetId: ctx.userId });`

- [ ] **Step 6: Ajustar o mock de rate-limit/audit nos testes de member-service (se necessário)**

Adicionar ao topo de `src/server/services/member-service.test.ts` (junto aos `vi.mock`):

```ts
vi.mock("@/server/services/audit-service", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));
```

- [ ] **Step 7: Rodar toda a suíte de member-service + audit**

Run: `docker compose exec app pnpm test src/server/services/member-service.test.ts src/server/services/audit-service.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/services/audit-service.ts src/server/services/audit-service.test.ts src/server/services/member-service.ts src/server/services/member-service.test.ts
git commit -m "feat(security): audit trail for member/invite events (SEC-08a)"
```

---

### Task 13: Leitura da trilha (owner-only) + página mínima

**Files:**
- Modify: `src/server/services/audit-service.ts` (`listAuditLogs`)
- Create: `src/actions/audit.ts` (opcional — usamos RSC direto)
- Create: `src/app/(app)/[accountId]/settings/audit/page.tsx`
- Test: `src/server/services/audit-service.test.ts`

**Interfaces:**
- Produces: `listAuditLogs(accountId, limit?): Promise<AuditEntry[]>` (filtrado por accountId, ordenado desc). Autorização `owner` feita na page via `requireAccountAccess` + checagem de `member.role`.

- [ ] **Step 1: Teste de `listAuditLogs`**

Adicionar em `src/server/services/audit-service.test.ts`:

```ts
import { listAuditLogs } from "./audit-service";

describe("listAuditLogs", () => {
  it("busca logs filtrados por accountId, mais recentes primeiro", async () => {
    prismaMock.auditLog.findMany.mockResolvedValue([{ id: "l1" }] as never);
    const result = await listAuditLogs("acc-1", 50);
    expect(result).toEqual([{ id: "l1" }]);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: "acc-1" },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `docker compose exec app pnpm test src/server/services/audit-service.test.ts`
Expected: FAIL — `listAuditLogs` não existe.

- [ ] **Step 3: Implementar `listAuditLogs`**

Adicionar em `src/server/services/audit-service.ts`:

```ts
export async function listAuditLogs(accountId: string, limit = 100) {
  return prisma.auditLog.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `docker compose exec app pnpm test src/server/services/audit-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Criar a página (RSC, owner-only)**

Create `src/app/(app)/[accountId]/settings/audit/page.tsx`:

```tsx
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAccountAccess } from "@/server/auth/session";
import { ForbiddenError } from "@/server/api/errors";
import { listAuditLogs } from "@/server/services/audit-service";
import { layout } from "@/lib/design-tokens";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId);
  if (member.role !== "owner") {
    throw new ForbiddenError("Apenas o owner pode ver a trilha de auditoria.");
  }
  const logs = await listAuditLogs(accountId);

  return (
    <Stack spacing={layout.section}>
      <PageHeader title="Trilha de auditoria" subtitle="Ações sensíveis desta conta" />
      {logs.length === 0 ? (
        <EmptyState title="Nenhum evento registrado" description="Ações sensíveis aparecerão aqui." />
      ) : (
        <Card>
          <CardContent>
            <Stack spacing={layout.stack} divider={<span />}>
              {logs.map((l) => (
                <Stack key={l.id} spacing={0.5}>
                  <Typography variant="body2" fontWeight={600}>
                    {l.action}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {l.actor?.name ?? l.actor?.email ?? "—"} ·{" "}
                    {l.createdAt.toLocaleString("pt-BR")} · {l.targetType}
                    {l.targetId ? ` (${l.targetId})` : ""}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
```

> `requireAccountRole` NÃO existe no `session.ts` (só `requireUser`/`requireAccountAccess`), por isso a checagem de `owner` é inline via `member.role`. Ajuste imports de `PageHeader`/`EmptyState` para os paths reais (`@/components/ui/*`) se divergirem.

- [ ] **Step 6: Typecheck + lint**

Run: `docker compose exec app pnpm typecheck && docker compose exec app pnpm lint`
Expected: sem erros.

- [ ] **Step 7: Verificação manual**

Como `owner`, acessar `/<accountId>/settings/audit` → ver eventos. Como `editor`/`viewer` → deve dar 403/erro (bloqueado pela checagem de `member.role`).

- [ ] **Step 8: Commit**

```bash
git add src/server/services/audit-service.ts src/server/services/audit-service.test.ts "src/app/(app)/[accountId]/settings/audit"
git commit -m "feat(security): owner-only audit log read + page (SEC-08a)"
```

---

## Phase F — SEC-09: recuperação de senha segura

### Task 14: Schema Zod de reset

**Files:**
- Modify: `src/lib/schemas/auth.ts`

**Interfaces:**
- Produces: `requestPasswordResetSchema` (`{ email }`), `resetPasswordSchema` (`{ token, password }`), `resetPasswordFormSchema` (+ confirmPassword), tipos.

- [ ] **Step 1: Adicionar os schemas**

Em `src/lib/schemas/auth.ts`, após `signupFormSchema`, adicionar (reusando a regra de senha do signup):

```ts
const passwordRule = z
  .string()
  .min(8, "Senha deve ter pelo menos 8 caracteres")
  .regex(/[a-zA-Z]/, "Deve conter ao menos uma letra")
  .regex(/[0-9]/, "Deve conter ao menos um número");

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token obrigatório"),
  password: passwordRule,
});

export const resetPasswordFormSchema = z
  .object({
    password: passwordRule,
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
```

> Opcional (DRY): refatorar `signupSchema.password` para usar `passwordRule`. Não obrigatório.

- [ ] **Step 2: Typecheck**

Run: `docker compose exec app pnpm typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/schemas/auth.ts
git commit -m "feat(security): password reset Zod schemas (SEC-09)"
```

---

### Task 15: Service de reset (`auth-service`)

**Files:**
- Modify: `src/server/services/auth-service.ts` (`requestPasswordReset`, `resetPassword`)
- Test: `src/server/services/auth-service.test.ts` (criar se não existir)

**Interfaces:**
- Produces:
  - `requestPasswordReset(email: string): Promise<void>` — sempre "silencioso" (anti-enumeração); envia email conforme o caso.
  - `resetPassword(rawToken: string, newPassword: string): Promise<void>` — valida token (hash/exp/used), atualiza `passwordHash` + `passwordChangedAt`, marca `usedAt`, apaga tokens pendentes, grava `auth.password_reset` no AuditLog (por membership).
- Consumes: `hashToken`, `recordAudit` (Task 12), `emailService`, templates de email (Task 16), `bcrypt`.

> **Dependência de ordem:** o service importa `passwordResetEmailTemplate`/`oauthOnlyResetEmailTemplate` de `@/emails`, criados na **Task 16**. O teste desta task mocka `@/emails` e `@/server/services/audit-service`, então roda verde isolado; mas `typecheck`/`build` só ficam verdes após a Task 16. Se preferir manter todo commit verde no typecheck, faça a **Task 16 antes desta**.

- [ ] **Step 1: Escrever os testes que falham**

Create `src/server/services/auth-service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/../tests/mocks/prisma";
import { hashToken } from "@/server/security/hash-token";

vi.mock("@/server/email/email-service", () => ({
  emailService: { send: vi.fn().mockResolvedValue({ ok: true }) },
}));
vi.mock("@/emails", () => ({
  passwordResetEmailTemplate: {},
  oauthOnlyResetEmailTemplate: {},
}));
vi.mock("@/server/services/audit-service", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

import { requestPasswordReset, resetPassword } from "./auth-service";

beforeEach(() => {
  prismaMock.$transaction.mockImplementation(async (arg: any) =>
    typeof arg === "function" ? arg(prismaMock) : Promise.all(arg),
  );
});

describe("requestPasswordReset", () => {
  it("não envia email nem cria token quando o email não existe", async () => {
    const { emailService } = await import("@/server/email/email-service");
    prismaMock.user.findUnique.mockResolvedValue(null);

    await requestPasswordReset("naoexiste@test.com");

    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it("cria token hasheado e envia email quando a conta tem senha", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "u@test.com",
      passwordHash: "hash",
    } as never);
    prismaMock.passwordResetToken.create.mockResolvedValue({} as never);

    await requestPasswordReset("u@test.com");

    const createArg = (prismaMock.passwordResetToken.create as any).mock.calls[0][0];
    expect(createArg.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createArg.data.userId).toBe("u1");
  });

  it("não cria token quando a conta é só-Google (sem passwordHash)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "u@test.com",
      passwordHash: null,
    } as never);

    await requestPasswordReset("u@test.com");

    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  it("rejeita token inexistente/expirado/usado", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);
    await expect(resetPassword("raw", "NovaSenha1")).rejects.toThrow();
  });

  it("atualiza senha, seta passwordChangedAt e marca token como usado", async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "t1",
      userId: "u1",
      tokenHash: hashToken("raw"),
      expiresAt: new Date(Date.now() + 3600_000),
      usedAt: null,
    } as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.passwordResetToken.update.mockResolvedValue({} as never);
    prismaMock.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 } as never);
    prismaMock.accountMember.findMany.mockResolvedValue([] as never);

    await resetPassword("raw", "NovaSenha1");

    const userUpdate = (prismaMock.user.update as any).mock.calls[0][0];
    expect(userUpdate.where).toEqual({ id: "u1" });
    expect(userUpdate.data.passwordHash).toEqual(expect.any(String));
    expect(userUpdate.data.passwordChangedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `docker compose exec app pnpm test src/server/services/auth-service.test.ts`
Expected: FAIL — `requestPasswordReset`/`resetPassword` não existem.

- [ ] **Step 3: Implementar as funções no `auth-service`**

Em `src/server/services/auth-service.ts`, adicionar imports:

```ts
import crypto from "crypto";

import { env } from "@/lib/env";
import { ForbiddenError } from "@/server/api/errors";
import { emailService } from "@/server/email/email-service";
import { passwordResetEmailTemplate, oauthOnlyResetEmailTemplate } from "@/emails";
import { hashToken } from "@/server/security/hash-token";
import { recordAudit } from "@/server/services/audit-service";
```

(`ConflictError` já é importado; `bcrypt`, `prisma`, `logger` também.)

E adicionar as funções:

```ts
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h (SEC-09)

/**
 * SEC-09: solicita reset de senha. SEMPRE silencioso do ponto de vista do chamador
 * (anti-enumeração) — a diferenciação acontece só no conteúdo do email.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  // Email inexistente → nada.
  if (!user) {
    log.info({ email: "[hidden]" }, "Password reset requested for unknown email");
    return;
  }

  // Conta só-Google (sem senha) → email guia, sem token.
  if (!user.passwordHash) {
    void emailService.send({
      to: user.email,
      template: oauthOnlyResetEmailTemplate,
      props: {},
    });
    log.info({ userId: user.id }, "Password reset requested for OAuth-only account");
    return;
  }

  // Conta com senha → gera token, grava hash, envia link.
  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`;
  void emailService.send({
    to: user.email,
    template: passwordResetEmailTemplate,
    props: { resetUrl, expiresInMinutes: 60 },
  });
  log.info({ userId: user.id }, "Password reset email sent");
}

/**
 * SEC-09: redefine a senha a partir do token raw. Invalida sessões antigas via
 * passwordChangedAt (checado em requireUser). Uso único + expiração.
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new ForbiddenError("Link de redefinição inválido ou expirado.");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: now },
    });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    });
    // Apaga demais tokens pendentes do usuário.
    await tx.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
    });
  });

  // SEC-08a: audita o reset em cada Account de que o usuário é membro (o AuditLog é
  // account-scoped; o reset em si não tem accountId).
  const memberships = await prisma.accountMember.findMany({
    where: { userId: record.userId },
    select: { accountId: true },
  });
  for (const { accountId } of memberships) {
    void recordAudit({
      accountId,
      actorUserId: record.userId,
      action: "auth.password_reset",
      targetType: "user",
      targetId: record.userId,
    });
  }

  log.info({ userId: record.userId }, "Password reset completed");
}
```

> Nota: `resetPassword` é pré-auth (escopo de usuário, sem `accountId`). Como o `AuditLog` é account-scoped, gravamos uma entrada `auth.password_reset` para cada membership do usuário. Se ele não for membro de nenhuma Account, nada é auditado (só o `log.info`), o que é aceitável.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `docker compose exec app pnpm test src/server/services/auth-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/auth-service.ts src/server/services/auth-service.test.ts
git commit -m "feat(security): password reset service (request/reset) (SEC-09)"
```

---

### Task 16: Templates de email de reset (Brevo + React Email)

**Files:**
- Create: `src/emails/password-reset.tsx`
- Create: `src/emails/oauth-only-reset.tsx`
- Modify: `src/emails/index.ts` (barrel)

**Interfaces:**
- Produces: `passwordResetEmailTemplate` (props `{ resetUrl: string; expiresInMinutes: number }`), `oauthOnlyResetEmailTemplate` (props `{}`).

- [ ] **Step 1: Template de reset com link**

Create `src/emails/password-reset.tsx`:

```tsx
import { Button, Heading, Text } from "@react-email/components";

import { EmailLayout } from "@/emails/components/EmailLayout";

export type PasswordResetEmailProps = {
  resetUrl: string;
  expiresInMinutes: number;
};

export function PasswordResetEmail({ resetUrl, expiresInMinutes }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Redefinição de senha do MyAccountant">
      <Heading className="text-2xl font-bold text-gray-900">Redefinir senha</Heading>
      <Text className="text-gray-700">
        Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para escolher uma nova.
      </Text>
      <Button
        href={resetUrl}
        className="my-4 inline-block rounded bg-blue-600 px-6 py-3 text-white font-medium"
      >
        Redefinir senha
      </Button>
      <Text className="text-sm text-gray-600">
        O link expira em {expiresInMinutes} minutos. Se você não pediu isso, ignore este email — sua
        senha continua a mesma.
      </Text>
    </EmailLayout>
  );
}

export const passwordResetEmailTemplate = {
  subject: "Redefinição de senha — MyAccountant",
  Component: PasswordResetEmail,
};

export default PasswordResetEmail;
```

- [ ] **Step 2: Template guia para conta só-Google**

Create `src/emails/oauth-only-reset.tsx`:

```tsx
import { Heading, Text } from "@react-email/components";

import { EmailLayout } from "@/emails/components/EmailLayout";

export type OAuthOnlyResetEmailProps = Record<string, never>;

export function OAuthOnlyResetEmail() {
  return (
    <EmailLayout preview="Sobre o acesso à sua conta MyAccountant">
      <Heading className="text-2xl font-bold text-gray-900">Você usa login com Google</Heading>
      <Text className="text-gray-700">
        Recebemos um pedido de redefinição de senha, mas sua conta não tem senha — você entra pelo
        botão <strong>Entrar com Google</strong>. Use-o na tela de login.
      </Text>
      <Text className="text-sm text-gray-600">
        Se você não fez este pedido, pode ignorar este email.
      </Text>
    </EmailLayout>
  );
}

export const oauthOnlyResetEmailTemplate = {
  subject: "Acesso à sua conta — MyAccountant",
  Component: OAuthOnlyResetEmail,
};

export default OAuthOnlyResetEmail;
```

- [ ] **Step 3: Exportar no barrel**

Em `src/emails/index.ts`, adicionar:

```ts
export { inviteEmailTemplate } from "./invite";
export { passwordResetEmailTemplate } from "./password-reset";
export { oauthOnlyResetEmailTemplate } from "./oauth-only-reset";
```

- [ ] **Step 4: Typecheck**

Run: `docker compose exec app pnpm typecheck`
Expected: sem erros.

- [ ] **Step 5: Preview (opcional)**

Run: `docker compose exec app pnpm email` → abrir http://localhost:3001 e conferir os dois templates.

- [ ] **Step 6: Commit**

```bash
git add src/emails/password-reset.tsx src/emails/oauth-only-reset.tsx src/emails/index.ts
git commit -m "feat(security): password reset email templates (SEC-09)"
```

---

### Task 17: Actions públicas de reset + rate limit + auditoria

**Files:**
- Modify: `src/actions/auth.ts` (`requestPasswordResetAction`, `resetPasswordAction`)

**Interfaces:**
- Produces:
  - `requestPasswordResetAction(rawInput): Promise<ActionResult<void>>` — rate limited (email+IP), sempre resposta genérica de sucesso.
  - `resetPasswordAction(rawInput): Promise<ActionResult<void>>` — valida schema, chama `resetPassword`, retorna sucesso/erro.

- [ ] **Step 1: Implementar as actions**

Em `src/actions/auth.ts`, adicionar imports:

```ts
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/schemas/auth";
import { requestPasswordReset, resetPassword, createUser, isSignupAllowed } from "@/server/services/auth-service";
import { enforceRateLimit, resetLimiter, signupLimiter } from "@/server/security/rate-limit";
import { getRequestIp } from "@/server/security/request-ip";
import { RateLimitError } from "@/server/api/errors";
```

(ajuste os imports existentes para não duplicar.)

Adicionar as funções:

```ts
const GENERIC_RESET_MESSAGE =
  "Se existe uma conta com esse email, enviamos instruções de redefinição.";

export async function requestPasswordResetAction(
  rawInput: unknown,
): Promise<ActionResult<{ message: string }>> {
  const parsed = requestPasswordResetSchema.safeParse(rawInput);
  if (!parsed.success) {
    // Mesmo em erro de formato, resposta genérica (não vaza nada).
    return actionSuccess({ message: GENERIC_RESET_MESSAGE });
  }

  try {
    const ip = await getRequestIp();
    await enforceRateLimit(resetLimiter, `reset:${parsed.data.email.toLowerCase()}`);
    await enforceRateLimit(resetLimiter, `reset-ip:${ip}`);
  } catch (err) {
    if (err instanceof RateLimitError) {
      // Ainda genérico — não revela se o email existe.
      return actionSuccess({ message: GENERIC_RESET_MESSAGE });
    }
    throw err;
  }

  try {
    await requestPasswordReset(parsed.data.email);
  } catch (error) {
    log.error({ err: error }, "Password reset request failed");
    // Silencioso: não expõe erro ao usuário.
  }

  return actionSuccess({ message: GENERIC_RESET_MESSAGE });
}

export async function resetPasswordAction(rawInput: unknown): Promise<ActionResult<void>> {
  const parsed = resetPasswordSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return actionError("VALIDATION", "Dados inválidos", fieldErrors);
  }

  try {
    await resetPassword(parsed.data.token, parsed.data.password);
    return actionSuccess(undefined);
  } catch (error) {
    if (error instanceof AppError) return actionError(error.code, error.message, error.fieldErrors);
    log.error({ err: error }, "Password reset failed");
    return actionError("INTERNAL", "Erro ao redefinir senha. Tente novamente.");
  }
}
```

> Nota: a auditoria `auth.password_reset` **já é gravada no service `resetPassword`** (Task 15, loop sobre as memberships do usuário). O action não precisa gravar nada de auditoria — apenas transporta o resultado.

- [ ] **Step 2: Typecheck + testes**

Run: `docker compose exec app pnpm typecheck && docker compose exec app pnpm test src/server/services/auth-service.test.ts`
Expected: sem erros; testes verdes.

- [ ] **Step 3: Commit**

```bash
git add src/actions/auth.ts
git commit -m "feat(security): password reset actions (request/reset) with rate limit (SEC-09)"
```

---

### Task 18: Invalidação de sessão — `passwordChangedAt` no JWT + `requireUser`

**Files:**
- Modify: `src/server/auth/config.ts` (callbacks `jwt`/`session` + tipo `Session`)
- Modify: `src/server/auth/index.ts` (authorize retorna `passwordChangedAt`)
- Modify: `src/server/auth/session.ts` (`requireUser` checa freshness)

**Interfaces:**
- JWT carrega `loginAt` (ms do sign-in). `session.user.loginAt`.
- `requireUser()` rejeita (401) se `user.passwordChangedAt.getTime() > session.user.loginAt`.

> Middleware (edge) não pode consultar Prisma, então a revogação real acontece em `requireUser` (Node). Refina o DD-08 da spec (o sketch do DD-08 comparava iat vs pwdChangedAt no mesmo token, o que não revoga tokens antigos).

- [ ] **Step 1: Embutir `loginAt` no JWT e expor na Session**

Em `src/server/auth/config.ts`, estender o tipo `Session` e os callbacks:

```ts
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      loginAt?: number;
    } & DefaultSession["user"];
  }
}

// JWT custom claim (necessário para `token.loginAt` compilar).
declare module "next-auth/jwt" {
  interface JWT {
    loginAt?: number;
  }
}
```

E nos callbacks:

```ts
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.loginAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.loginAt = typeof token.loginAt === "number" ? token.loginAt : undefined;
      }
      return session;
    },
  },
```

- [ ] **Step 2: Checar freshness em `requireUser`**

Substituir `src/server/auth/session.ts` por:

```ts
import { UnauthorizedError } from "@/server/api/errors";
import { auth } from "@/server/auth";
import { ensureMembership } from "@/server/auth/membership";
import { prisma } from "@/server/prisma";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  // SEC-09: rejeita sessões emitidas antes da última troca de senha.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordChangedAt: true },
  });
  const loginAt = session.user.loginAt;
  if (
    dbUser?.passwordChangedAt &&
    (!loginAt || dbUser.passwordChangedAt.getTime() > loginAt)
  ) {
    throw new UnauthorizedError("Sua sessão expirou. Faça login novamente.");
  }

  return session.user as { id: string; email: string; name?: string | null; loginAt?: number };
}

export async function requireAccountAccess(accountId: string) {
  const user = await requireUser();
  const member = await ensureMembership(user.id, accountId);
  return { user, member };
}
```

> `requireAccountAccess` chama `requireUser`, então a checagem cobre também o fluxo de Account. Custo: +1 `findUnique` por request autenticado (aceitável; otimizável depois). O contexto MCP usa `ensureMembership` direto (não passa por `requireUser`) e não é afetado.

- [ ] **Step 3: (Opcional) authorize retornar passwordChangedAt**

Não é estritamente necessário (a checagem lê o DB fresco em `requireUser`). O `loginAt` é setado no jwt callback no sign-in. Deixe `authorize` como está.

- [ ] **Step 4: Typecheck**

Run: `docker compose exec app pnpm typecheck`
Expected: sem erros.

- [ ] **Step 5: Verificação manual (crítica)**

Ver Test Plan §F-4 (login em 2 browsers, reset num, confirmar que o outro é deslogado no próximo request).

- [ ] **Step 6: Commit**

```bash
git add src/server/auth/config.ts src/server/auth/session.ts
git commit -m "feat(security): invalidate sessions issued before password reset (SEC-09)"
```

---

### Task 19: UI — `ForgotPasswordForm` + página/formulário de reset

**Files:**
- Modify: `src/components/auth/ForgotPasswordForm.tsx`
- Create: `src/components/auth/ResetPasswordForm.tsx`
- Create: `src/app/(auth)/reset-password/page.tsx`

**Interfaces:**
- Consumes: `requestPasswordResetAction`, `resetPasswordAction`, `resetPasswordFormSchema`.

- [ ] **Step 1: Ligar o `ForgotPasswordForm` à action**

Substituir o corpo do `onSubmit` e imports em `src/components/auth/ForgotPasswordForm.tsx`:

```tsx
import { requestPasswordResetAction } from "@/actions/auth";
// ...
  async function onSubmit(values: FormValues) {
    await requestPasswordResetAction({ email: values.email });
    // Sempre "sucesso" (anti-enumeração): mostramos a mesma mensagem genérica.
    setSubmitted(true);
  }
```

(o resto do componente — `submitted` → `<Alert severity="success">{m.auth.resetLinkSent}</Alert>` — permanece.)

- [ ] **Step 2: Criar o `ResetPasswordForm`**

Create `src/components/auth/ResetPasswordForm.tsx` (copia o padrão de `SignupForm`):

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useSnackbar } from "notistack";

import { resetPasswordAction } from "@/actions/auth";
import { resetPasswordFormSchema, type ResetPasswordFormValues } from "@/lib/schemas/auth";
import { layout } from "@/lib/design-tokens";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [invalid, setInvalid] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    const result = await resetPasswordAction({ token, password: values.password });
    if (result.ok) {
      enqueueSnackbar("Senha redefinida. Faça login.", { variant: "success" });
      router.push("/login");
      return;
    }
    if (result.error.code === "FORBIDDEN") {
      setInvalid(true);
      return;
    }
    if (result.error.fieldErrors) {
      Object.entries(result.error.fieldErrors).forEach(([field, message]) =>
        form.setError(field as keyof ResetPasswordFormValues, { message }),
      );
      return;
    }
    enqueueSnackbar(result.error.message, { variant: "error" });
  }

  if (invalid) {
    return (
      <Stack spacing={layout.stack}>
        <Alert severity="error">Link inválido ou expirado. Solicite um novo.</Alert>
        <Button variant="outlined" href="/forgot-password" fullWidth>
          Solicitar novo link
        </Button>
      </Stack>
    );
  }

  return (
    <Stack component="form" onSubmit={form.handleSubmit(onSubmit)} spacing={layout.stack}>
      <Controller
        name="password"
        control={form.control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            fullWidth
          />
        )}
      />
      <Controller
        name="confirmPassword"
        control={form.control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            fullWidth
          />
        )}
      />
      <Button
        type="submit"
        variant="contained"
        size="large"
        fullWidth
        disabled={form.formState.isSubmitting}
      >
        Redefinir senha
      </Button>
    </Stack>
  );
}
```

- [ ] **Step 3: Criar a página de reset**

Create `src/app/(auth)/reset-password/page.tsx` (espelhando `forgot-password/page.tsx` + `AuthCard`):

```tsx
import Alert from "@mui/material/Alert";

import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <AuthCard title="Redefinir senha" subtitle="Escolha uma nova senha para sua conta">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert severity="error">Link inválido. Solicite um novo em “Esqueci minha senha”.</Alert>
      )}
    </AuthCard>
  );
}
```

> Confira a assinatura real de `AuthCard` (props `title`/`subtitle`) em `src/components/auth/AuthCard.tsx` e ajuste se necessário (use o mesmo uso de `forgot-password/page.tsx`).

- [ ] **Step 4: Typecheck + lint**

Run: `docker compose exec app pnpm typecheck && docker compose exec app pnpm lint`
Expected: sem erros.

- [ ] **Step 5: Verificação manual**

Ver Test Plan §F.

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/ForgotPasswordForm.tsx src/components/auth/ResetPasswordForm.tsx "src/app/(auth)/reset-password"
git commit -m "feat(security): forgot/reset password UI (SEC-09)"
```

---

### Task 20: Verificação final integrada

- [ ] **Step 1: Suíte completa**

Run: `docker compose exec app pnpm test`
Expected: toda a suíte verde.

- [ ] **Step 2: Typecheck + lint + format**

Run: `docker compose exec app pnpm typecheck && docker compose exec app pnpm lint && docker compose exec app pnpm format:check`
Expected: sem erros.

- [ ] **Step 3: Build (valida env de produção-like)**

Run: `docker compose exec app pnpm build` (com `UPSTASH_*` setado, ou `SKIP_ENV_VALIDATION=1` se só quiser compilar)
Expected: build ok.

- [ ] **Step 4: Commit final (se houver ajustes de format)**

```bash
git add -A
git commit -m "chore(security): final checks for spec 23 hardening"
```

---

## Test Plan (execução manual pós-implementação)

Pré-requisitos: `docker compose up -d`; para exercitar rate limiting de verdade, configure uma instância Upstash (free) e preencha `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` no `.env`. Sem Upstash, os limiters são no-op (dev) — teste as demais partes normalmente e o rate limit em staging com Upstash.

### §A — Rate limiting (SEC-01)
1. **Login brute-force:** com Upstash configurado, faça 11 POSTs a `/api/auth/callback/credentials` do mesmo IP em <15min (11 logins na tela). Esperado: a partir da 11ª tentativa, HTTP **429** com JSON `{ "error": "TooManyRequests", ... }`.
2. **Signup:** 6 cadastros do mesmo IP em <1h → 6º retorna `TOO_MANY_REQUESTS` (mensagem "Muitas tentativas...").
3. **Convite:** como owner, envie 6 convites em <1h → 6º bloqueado.
4. **Reset:** solicite reset 4× para o mesmo email em <1h → a resposta continua genérica (não vaza), mas nenhum email extra é enviado a partir do 4º.

### §B — `/api/v1` protegido (SEC-04)
1. `curl -i http://localhost:3000/api/v1/accounts/x/months` **sem cookie** → **401** `{"error":"Unauthorized"}`.
2. Mesma rota logado (cookie de sessão) → passa pelo middleware (o 403/404 vem do handler conforme o caso).
3. `curl -i http://localhost:3000/api/health` → **200** (pública).
4. `curl -i http://localhost:3000/api/docs` → **200** (Swagger, pública).
5. Endpoint MCP (se aplicável) → inalterado (não sob `/api/v1`).

### §C — Hash de token de convite (SEC-02)
1. Envie um convite. No `prisma studio` (`docker compose exec app pnpm prisma studio ...`), confirme que `account_invites.token` é um hash (64 hex) e **não** aparece na URL do email como igual ao do banco.
2. Abra o link do email (`/invite/accept?token=<raw>`) → convite carrega e aceita normalmente.
3. Migration: com um convite pendente criado ANTES da Task 9, rode a migration e confirme que o link antigo ainda resolve (hash-in-place preservou).
4. Token adulterado na URL → tela "convite inválido".

### §D — Safety-net por inviteId (SEC-02 / Task 10-11)
1. Crie um convite para `x@test.com`. Cadastre-se com `x@test.com` **sem** clicar no link do email. Ao cair em `/home`, deve ser redirecionado para `/invite/accept?inviteId=...` e conseguir aceitar (email-match).
2. Usuário logado com email diferente do convite (via inviteId) → tela "email errado", sem aceitar.

### §E — Auditoria (SEC-08a)
1. Como owner, faça: trocar papel de um membro, remover um membro, enviar/revogar convite. Acesse `/<accountId>/settings/audit` → os eventos aparecem, mais recentes primeiro, com ator e timestamp.
2. Como `editor`/`viewer`, acessar `/<accountId>/settings/audit` → **bloqueado** (403).
3. Confirme no DB que `audit_logs.account_id` está preenchido e que deletar a Account remove os logs (cascade).

### §F — Recuperação de senha (SEC-09)
1. **Conta com senha:** `/forgot-password` com email existente → mensagem genérica de sucesso; email de reset chega (Brevo); link `/reset-password?token=...` abre o form; nova senha válida → redireciona para login; login com a nova senha funciona; login com a senha antiga **falha**.
2. **Anti-enumeração:** `/forgot-password` com email inexistente → **mesma** mensagem genérica; nenhum email enviado.
3. **Conta só-Google:** `/forgot-password` com email de conta Google-only → mesma mensagem genérica; email recebido é o "entre com Google" (sem link de reset).
4. **Invalidação de sessão (crítico):** logue a MESMA conta em 2 navegadores (A e B). No A, complete um reset de senha. No B, faça qualquer navegação autenticada → deve ser deslogado/401 ("Sua sessão expirou"). Login no B com a nova senha funciona.
5. **Token:** link expirado (>1h) ou reutilizado → tela "link inválido ou expirado".
6. **Validação:** senha < 8 chars / sem número → erro de campo no form.

### Setup de Upstash para teste
1. Criar conta free em upstash.com → criar um Redis database.
2. Copiar `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` para o `.env`.
3. Reiniciar o container: `docker compose restart app`.

---

## Notas de rollback e riscos

- **Migrations** (Tasks 1, 9): são aditivas + data-fix. Para reverter, `prisma migrate resolve`/nova migration. O hash-in-place (Task 9) é **irreversível** (não dá para recuperar o token raw) — mas os convites pendentes continuam funcionando via link do email.
- **Upstash ausente em produção:** o boot **falha** por design (SEC-01). Garanta as env vars antes do deploy.
- **DD-08:** a invalidação de sessão é enforced em `requireUser` (DB check), não no callback edge — o §6 DD-08 já reflete isso.
- **Custo +1 query/request** em `requireUser` (passwordChangedAt). Otimização futura: cachear ou mover o check para `ensureMembership`.
