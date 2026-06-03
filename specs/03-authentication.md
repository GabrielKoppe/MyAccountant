# Spec 03 — Autenticação

> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`email-resend`](../skills/email-resend/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`env-validation`](../skills/env-validation/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

## 1. Propósito

Define o fluxo de autenticação: signup, login (email/senha e Google OAuth), gerenciamento de sessão, e a tela de seleção de Account pós-login.

## 2. Tecnologia

- **NextAuth v5** (Auth.js)
- **Prisma Adapter** (`@auth/prisma-adapter`) — usado para OAuth accounts, não para sessões
- **Strategy**: `jwt` (tokens no cookie, não no banco)

> Mudança em relação ao design original: o Prisma Adapter não é compatível com o Edge Runtime do middleware Next.js. A solução é usar strategy `jwt` e separar a config em dois arquivos:
>
> - `src/server/auth/config.ts` — config edge-safe (sem Prisma, sem bcrypt). Usado no middleware.
> - `src/server/auth/index.ts` — config completa com Prisma Adapter e `authorize` real. Usado nas rotas e Server Actions.
>
> **Implicação**: sessões não ficam no banco (não há revogação imediata), mas o `userId` fica no JWT (`token.sub`). Para a maioria dos casos do MVP isso é aceitável.

## 3. Providers

### 3.1 Credentials (email/senha)
- Hash com `bcrypt` (cost 12).
- Validação Zod: email válido, senha ≥ 8 chars com 1 letra e 1 número.
- Resposta genérica em login fail ("Email ou senha incorretos"), não diferenciar email não cadastrado vs senha errada.

### 3.2 Google OAuth
- `GoogleProvider` do NextAuth.
- Scopes: `openid email profile`.
- **Account linking**: se o email já existe como Credentials, vincular automaticamente (mesma `User.id`).

> ⚠️ Atenção: NextAuth v5 tem comportamento default de account linking desabilitado. Habilitar com `allowDangerousEmailAccountLinking: true` **só após confirmar** que o provider verifica o email (Google verifica).

## 4. Fluxos

### 4.1 Signup com email/senha
1. Usuário preenche: nome, email, senha, confirmação de senha.
2. Validação Zod no client (RHF) e re-validação no server (Server Action).
3. Server Action:
   - Verifica se email já existe → erro "Email já cadastrado".
   - Cria `User` com `passwordHash`.
   - Cria `UserSettings` com defaults.
   - Envia email de verificação (Resend).
   - Faz login automaticamente.
4. Redireciona para `/onboarding` (criar primeira Account).

### 4.2 Login com email/senha
1. Usuário preenche email + senha.
2. Server Action valida e cria sessão.
3. Redireciona conforme regra de Account (ver §5).

### 4.3 Signup/Login com Google
1. Click em "Entrar com Google".
2. OAuth flow do NextAuth.
3. Se for primeiro login:
   - Cria `User` (sem `passwordHash`).
   - Cria `UserSettings` com defaults.
   - Marca `emailVerified` (Google já verificou).
4. Redireciona conforme regra de Account (ver §5).

### 4.4 Verificação de email
- Email enviado no signup com magic link de 24h.
- Click no link → marca `emailVerified` → redireciona para app.
- App permite uso mesmo sem verificar, mas exibe banner pedindo verificação.

### 4.5 Reset de senha
- "Esqueci minha senha" → input de email → envia magic link de 1h.
- Click no link → form de nova senha → atualiza `passwordHash`.
- Invalida todas as sessões ativas após reset.

## 5. Regra de Account pós-login

Conforme spec original:

```
Se usuário tem 0 Accounts → /onboarding (criar primeira)
Se usuário tem 1 Account → entra direto naquela Account
Se usuário tem 2+ Accounts → /select-account (estilo Netflix)
```

**Implementação**:
- Middleware em `middleware.ts` checa `auth()` e conta de memberships.
- "Última Account usada" salva em cookie (`lastAccountId`) para login direto na próxima sessão.
- Cookie expira em 30 dias.
- Botão "Trocar de Account" no menu do usuário leva para `/select-account` independente de quantas Accounts ele tem.

## 6. Estrutura de pastas

```
src/
├── server/
│   └── auth/
│       ├── config.ts       # Config edge-safe (sem Prisma) — usado pelo middleware
│       ├── index.ts        # Config completa com PrismaAdapter — usado nas rotas/actions
│       └── session.ts      # Helpers: requireUser, requireAccountAccess
├── lib/
│   └── schemas/
│       └── auth.ts         # Zod schemas (signup, login)
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (app)/
│   │   ├── onboarding/page.tsx
│   │   ├── select-account/page.tsx
│   │   └── ...
│   └── api/
│       └── auth/
│           └── [...nextauth]/route.ts  # importa de src/server/auth/index.ts
└── middleware.ts   # importa de src/server/auth/config.ts (edge-safe)
```

## 7. Sessão no servidor

```ts
// src/server/auth/session.ts
import { auth } from "@/server/auth";  // importa o handler completo (Node.js only)

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user;
}

export async function requireAccountAccess(accountId: string) {
  const user = await requireUser();
  const member = await prisma.accountMember.findUnique({
    where: { accountId_userId: { accountId, userId: user.id } }
  });
  if (!member) throw new ForbiddenError();
  return { user, member };
}
```

> ⚠️ **NUNCA usar `getServerSession` legado** — usar `auth()` do NextAuth v5.
> ⚠️ **NUNCA importar de `@/server/auth`** no middleware — sempre usar `@/server/auth/config`.

> Padrão: **toda Server Action começa com `requireAccountAccess(accountId)`**. Ver `skills/multitenancy/SKILL.md`.

## 8. UI

### 8.1 Páginas
- `/login`: form de login + botão Google + link signup + link "esqueci senha".
- `/signup`: form de signup + botão Google + link login.
- `/forgot-password`: form de email.
- `/reset-password?token=...`: form de nova senha.
- `/verify-email?token=...`: confirmação automática.

### 8.2 Componentes
- `<LoginForm />` — Server Component que renderiza `<LoginFormClient />`.
- `<SignupForm />` — idem.
- `<GoogleButton />` — botão estilizado.

### 8.3 Validação
- **Toda validação no Zod**, schemas em `src/lib/auth/schemas.ts`:
  ```ts
  export const signupSchema = z.object({
    name: z.string().min(2).max(80),
    email: z.string().email().toLowerCase(),
    password: z.string()
      .min(8)
      .regex(/[a-zA-Z]/, "Deve conter ao menos uma letra")
      .regex(/[0-9]/, "Deve conter ao menos um número"),
  });
  ```

## 9. Segurança

- Rate limiting em `/login` e `/signup`: 5 tentativas / 15min por IP. Usar Upstash Redis ou Vercel KV.
- CSRF: NextAuth lida automaticamente.
- Passwords: bcrypt cost 12.
- Sessões expiram em 30 dias (inactividade) ou 90 dias (absoluto).
- Cookies: `httpOnly`, `secure` (em prod), `sameSite=lax`.

## 10. Configurações do usuário (`/settings/profile`)

Página com:
- Editar nome.
- Trocar senha (se tem `passwordHash`).
- Vincular/desvincular Google.
- Theme, locale, timezone (de `UserSettings`).
- Ver invites pendentes (lista de `AccountInvite` com email = user.email e status = pending).
- Deletar conta (hard delete, com confirmação por digitação).

## 11. Decisões em aberto

- [ ] Magic link como provider primário (em vez de senha)?
- [ ] 2FA (TOTP)?
- [ ] "Lembrar de mim" toggle no login (afeta duração da sessão)?
- [ ] Limite de sessões simultâneas?
