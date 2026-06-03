# SKILL — Email com Resend + React Email

## Quando usar

Toda vez que o app precisar enviar email: verificação, invite, reset de senha, notificações.

## Stack

- **[Resend](https://resend.com)** — API de envio, 3.000 emails/mês free.
- **[React Email](https://react.email)** — templates JSX tipados, com preview server.

```bash
pnpm add resend @react-email/components @react-email/render
pnpm add -D react-email
```

## Princípio

1. **Templates em JSX**, tipados, com props.
2. **Um módulo `email-service`** centraliza envio e logging.
3. **Fire-and-forget**: falha no envio NÃO quebra o fluxo de negócio (auth funciona mesmo se email cair). Loga warn.
4. **Todo envio é logado** com destinatário (mascarado), template, status.

## Setup

### Configuração base

```ts
// src/server/email/client.ts

import { Resend } from "resend";

import { env } from "@/lib/env";

export const resend = new Resend(env.RESEND_API_KEY);
```

### Email service

```ts
// src/server/email/email-service.ts

import { render } from "@react-email/render";

import { env } from "@/lib/env";
import { logger } from "@/server/logger";
import { resend } from "@/server/email/client";

const log = logger.child({ module: "email-service" });

export type EmailTemplate<TProps> = {
  subject: string | ((props: TProps) => string);
  Component: (props: TProps) => JSX.Element;
};

type SendEmailOptions<TProps> = {
  to: string | string[];
  template: EmailTemplate<TProps>;
  props: TProps;
  /** Se true, lança em erro. Default: false (fire-and-forget). */
  throwOnError?: boolean;
};

export const emailService = {
  async send<TProps>(options: SendEmailOptions<TProps>): Promise<{ ok: boolean; id?: string }> {
    const { to, template, props, throwOnError = false } = options;

    const subject =
      typeof template.subject === "function" ? template.subject(props) : template.subject;

    const html = await render(template.Component(props));
    const text = await render(template.Component(props), { plainText: true });

    const recipients = Array.isArray(to) ? to : [to];
    const maskedRecipients = recipients.map(maskEmail);

    try {
      const result = await resend.emails.send({
        from: env.EMAIL_FROM,
        to: recipients,
        subject,
        html,
        text,
      });

      if (result.error) {
        log.warn(
          { to: maskedRecipients, subject, error: result.error },
          "Email send failed (resend error)",
        );
        if (throwOnError) {
          throw new Error(`Email send failed: ${result.error.message}`);
        }
        return { ok: false };
      }

      log.info({ to: maskedRecipients, subject, emailId: result.data?.id }, "Email sent");
      return { ok: true, id: result.data?.id };
    } catch (err) {
      log.error({ err, to: maskedRecipients, subject }, "Email send threw");
      if (throwOnError) throw err;
      return { ok: false };
    }
  },
};

/** Mascara email para log: user@example.com → u***@example.com */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "[invalid]";
  return `${name.charAt(0)}***@${domain}`;
}
```

## Templates

### Estrutura

```
src/emails/
├── components/
│   ├── EmailLayout.tsx        # layout compartilhado (header, footer)
│   ├── Button.tsx             # botão CTA estilizado
│   └── ...
├── welcome.tsx
├── invite.tsx
├── password-reset.tsx
├── email-verify.tsx
└── index.ts                   # registry
```

### Layout compartilhado

```tsx
// src/emails/components/EmailLayout.tsx
import { Body, Container, Head, Html, Img, Preview, Section, Tailwind } from "@react-email/components";

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-8 max-w-md rounded bg-white p-8 shadow">
            <Section>
              <Img
                src="https://app.myaccountant.com/logo.png"
                width="120"
                alt="MyAccountant"
              />
            </Section>
            {children}
            <Section className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-500">
              Você recebeu este email porque tem uma conta no MyAccountant. Se não foi você, ignore.
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

> **Nota**: React Email tem suporte a Tailwind embedded **só nos templates** (vai inline no email). Não confundir com a regra "só MUI no app" — emails são contexto totalmente diferente (clientes de email não rodam JS, MUI não funciona).

### Template: convite

```tsx
// src/emails/invite.tsx
import { Button, Heading, Text } from "@react-email/components";

import { EmailLayout } from "@/emails/components/EmailLayout";

export type InviteEmailProps = {
  inviterName: string;
  accountName: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
};

export function InviteEmail({
  inviterName,
  accountName,
  role,
  acceptUrl,
  expiresInDays,
}: InviteEmailProps) {
  return (
    <EmailLayout preview={`${inviterName} convidou você para ${accountName}`}>
      <Heading>Você foi convidado!</Heading>
      <Text>
        <strong>{inviterName}</strong> convidou você para participar da Account{" "}
        <strong>{accountName}</strong> no MyAccountant como <strong>{role}</strong>.
      </Text>
      <Button
        href={acceptUrl}
        className="my-4 inline-block rounded bg-blue-600 px-6 py-3 text-white"
      >
        Aceitar convite
      </Button>
      <Text className="text-sm text-gray-600">
        O convite expira em {expiresInDays} dias. Se você não esperava este convite, pode ignorá-lo.
      </Text>
    </EmailLayout>
  );
}

// Exportação no formato esperado pelo emailService
export const inviteEmailTemplate = {
  subject: (props: InviteEmailProps) =>
    `${props.inviterName} convidou você para ${props.accountName}`,
  Component: InviteEmail,
};

// Default export para preview server do React Email
export default InviteEmail;
```

### Registry

```ts
// src/emails/index.ts
export { inviteEmailTemplate } from "./invite";
export { welcomeEmailTemplate } from "./welcome";
export { passwordResetEmailTemplate } from "./password-reset";
export { emailVerifyEmailTemplate } from "./email-verify";
```

## Uso

```ts
// Em um service
import { emailService } from "@/server/email/email-service";
import { inviteEmailTemplate } from "@/emails";

export async function inviteToAccount(input) {
  // ... criar AccountInvite no DB

  // Fire-and-forget: email pode falhar sem quebrar o convite
  await emailService.send({
    to: input.email,
    template: inviteEmailTemplate,
    props: {
      inviterName: input.inviter.name,
      accountName: input.account.name,
      role: input.role,
      acceptUrl: `${env.NEXT_PUBLIC_APP_URL}/invite/accept?token=${invite.token}`,
      expiresInDays: 7,
    },
  });

  return invite;
}
```

## Preview server (dev)

React Email tem um preview server. Configurar:

```json
// package.json
{
  "scripts": {
    "email": "email dev --dir src/emails --port 3001"
  }
}
```

```bash
docker compose exec app pnpm email
# → http://localhost:3001 — preview de todos os templates
```

> Você visualiza cada template em diferentes clientes e ajusta antes de enviar de verdade.

## Templates do MVP

| Template | Trigger | Spec |
|---|---|---|
| `welcomeEmail` | Signup completo | `03-authentication.md` |
| `emailVerifyEmail` | Signup (verificação) | `03-authentication.md` |
| `passwordResetEmail` | Esqueci minha senha | `03-authentication.md` |
| `inviteEmail` | Owner convida membro | `04-accounts-and-members.md` |

## Configuração no Resend

1. Criar conta em [resend.com](https://resend.com).
2. Verificar domínio (DNS records: SPF, DKIM, DMARC).
3. Gerar API key (Settings → API Keys).
4. Configurar `RESEND_API_KEY` e `EMAIL_FROM` no `.env`.

### Em dev sem domínio
Resend permite enviar de `onboarding@resend.dev` para **seu próprio email cadastrado**. Útil para testes locais.

```bash
EMAIL_FROM="MyAccountant <onboarding@resend.dev>"
# Só funciona enviando para o email da sua conta Resend
```

## Tratamento de erros

### Padrão: fire-and-forget com warn
```ts
const result = await emailService.send({ to, template, props });
if (!result.ok) {
  log.warn({ to: maskEmail(to) }, "Email failed but flow continues");
  // não throw — operação principal já foi feita
}
```

### Quando lançar (`throwOnError: true`)
- Reset de senha (sem o email, o usuário fica preso). Mas: já mandou o link na resposta? Não, segurança não permite. Então: throw e dá rollback.
- Geralmente: prefira fire-and-forget + dashboard de "reenviar email" para o usuário.

## Anti-patterns

❌ Enviar email **dentro** de uma `prisma.$transaction` (se commit falha, email já foi)
❌ Logar email completo do destinatário em produção (use `maskEmail`)
❌ HTML inline gigante no código (use React Email)
❌ Hard-code do `from` (use `env.EMAIL_FROM`)
❌ Esperar resposta do email pra continuar fluxo crítico (fire-and-forget)
❌ Esquecer de configurar SPF/DKIM (email cai em spam)

## Checklist

- [ ] Template criado em `src/emails/`.
- [ ] Preview testado em `pnpm email` em múltiplos clientes (Gmail, Outlook).
- [ ] Sender exporta no formato `EmailTemplate<Props>`.
- [ ] Service chama via `emailService.send`, não usa `resend.emails.send` direto.
- [ ] Falha de email **não quebra** o fluxo de negócio (a menos que seja realmente crítico).
- [ ] Log de envio inclui template name + recipient mascarado.
