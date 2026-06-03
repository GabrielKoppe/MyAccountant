# Spec 23 — Hardening de Segurança

> Status: draft
> Insumo: docs/v2-analysis.md §5 SEC-01, SEC-02, SEC-04
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`env-validation`](../skills/env-validation/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md)

---

## 1. Problema

Três vulnerabilidades de segurança identificadas no V1 que devem ser corrigidas antes de qualquer abertura do produto para novos usuários:

- **SEC-01**: Não há rate limiting em rotas críticas. Qualquer atacante pode tentar milhares de combinações de senha em `/api/auth/callback/credentials` (brute force) sem nenhuma limitação. O mesmo vale para envio de emails de convite e recuperação de senha, que podem ser abusados para spam.
- **SEC-02**: O token de convite é gerado com `crypto.randomBytes(32)` (correto), mas armazenado em plaintext na tabela `account_invites`. Se o banco for comprometido, todos os convites pendentes podem ser usados por um atacante para entrar nas contas.
- **SEC-04**: O middleware do Next.js exclui explicitamente rotas `/api/*` do matcher de autenticação. Os route handlers de `/api/v1/*` dependem individualmente de chamar `requireAccountAccess` — um handler criado sem essa chamada ficaria completamente exposto.

---

## 2. Solução

- **SEC-01**: Implementar rate limiting com Redis via `@upstash/ratelimit` (ou equivalente) no middleware e/ou nos handlers de auth. Definir limites conservadores para as rotas de maior risco.
- **SEC-02**: Armazenar apenas o hash SHA-256 do token no banco. O token raw é enviado por email; na aceitação, o token recebido é hasheado e comparado com o valor no banco.
- **SEC-04**: Incluir `/api/v1/*` no matcher do middleware para que a autenticação seja verificada centralmente, mesmo que o handler individual esqueça de chamar `requireAccountAccess`.

---

## 3. User Stories

- Como operador do sistema, quero que tentativas repetidas de login de um mesmo IP sejam bloqueadas automaticamente após N falhas.
- Como operador do sistema, quero que tokens de convite armazenados no banco não permitam acesso mesmo em caso de vazamento do banco.
- Como desenvolvedor, quero que qualquer novo route handler em `/api/v1/*` seja protegido por autenticação por padrão, sem depender de verificação manual.

---

## 4. Critérios de Aceitação

**SEC-01 — Rate limiting:**
- QUANDO um IP faz mais de 10 tentativas de login com falha em uma janela de 15 minutos, AS PRÓXIMAS TENTATIVAS DESSE IP DEVEM ser rejeitadas com HTTP 429 e mensagem "Muitas tentativas. Tente novamente em X minutos."
- QUANDO um usuário tenta enviar mais de 5 convites em uma hora, A AÇÃO DEVE ser bloqueada com mensagem de erro clara.
- QUANDO um email de recuperação de senha é solicitado mais de 3 vezes em uma hora para o mesmo endereço, AS PRÓXIMAS SOLICITAÇÕES DEVEM retornar uma mensagem genérica sem enviar email (evitar enumeração + spam).
- O rate limiting DEVE ser baseado em IP para login e em userId/email para convites e reset.

**SEC-02 — Hash de token de convite:**
- QUANDO um convite é criado, O TOKEN ARMAZENADO NA TABELA `account_invites` DEVE ser o SHA-256 do token gerado, não o token raw.
- O TOKEN RAW DEVE ser enviado apenas no link de email e nunca persistido.
- QUANDO um usuário abre o link de aceite com o token raw na URL, O SISTEMA DEVE calcular SHA-256 do token recebido e comparar com o valor no banco.
- SE o hash não corresponder, O CONVITE DEVE ser rejeitado como inválido.

**SEC-04 — Middleware para API:**
- QUANDO uma requisição não autenticada chega a qualquer rota `/api/v1/*`, O MIDDLEWARE DEVE retornar HTTP 401 com corpo JSON `{ "error": "Unauthorized" }`.
- Rotas `/api/health` e `/api/docs` (Swagger) DEVEM permanecer públicas.
- A proteção DEVE acontecer no middleware, não depender de verificação individual em cada handler.

---

## 5. Fora de Escopo

- Autenticação de dois fatores (2FA).
- Bloqueio permanente de contas (apenas cooldown temporário).
- CAPTCHA em formulários de login.
- Rotação automática de chaves JWT.
- Criptografia de dados sensíveis em repouso além do token de convite.

---

## 6. Referências Técnicas

| Item | Arquivo(s) a tocar |
|------|-------------------|
| SEC-01 | `src/middleware.ts`, `src/server/auth/config.ts`, `src/actions/auth.ts` |
| SEC-02 | `src/server/services/member-service.ts` — funções `inviteMember` e `acceptInvite` |
| SEC-04 | `src/middleware.ts` — atualizar o `config.matcher` |

**SEC-01 — Opções de implementação de rate limiting:**
- `@upstash/ratelimit` com Upstash Redis (solução gerenciada, gratuita para baixo volume)
- `next-rate-limiter` com Redis local via Docker Compose
- Implementação em memória (não recomendada para múltiplas instâncias, mas aceitável para deploy single-instance)

**SEC-02 — Hash:**
```ts
import { createHash } from "crypto";
const tokenHash = createHash("sha256").update(token).digest("hex");
// Armazenar tokenHash no banco; enviar token raw por email
```

**SEC-04 — Matcher atualizado:**
```ts
matcher: [
  "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  "/api/v1/:path*",
]
```
Com lógica: se rota começa com `/api/v1/` e não há sessão, retornar `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`.

- Migration necessária para SEC-02: coluna `account_invites.token` deve ser atualizada (os tokens existentes em plaintext precisam ser invalidados ou a migration deve zerá-los).
