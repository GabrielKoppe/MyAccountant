# Spec 04 — Accounts e Membros

## 1. Propósito

Define o fluxo de criação de Account, gerenciamento de membros, papéis (owner/editor/viewer) e convites por email.

## 2. Conceito

Uma **Account** é um espaço compartilhado por múltiplos `User`s. Toda Account tem **pelo menos um `owner`**. Cada membro tem um papel que define o que ele pode fazer.

## 3. Papéis e permissões

| Ação | Owner | Editor | Viewer |
|---|---|---|---|
| Criar/editar/deletar Months | ✅ | ✅ | ❌ |
| Criar/editar/deletar Finance Tables | ✅ | ✅ | ❌ |
| Criar/editar/deletar Transactions | ✅ | ✅ | ❌ |
| Criar/editar Dashboards | ✅ | ✅ | ❌ |
| Editar AccountSettings (sections, categories, etc.) | ✅ | ✅ | ❌ |
| Importar CSV/XLSX | ✅ | ✅ | ❌ |
| Exportar dados | ✅ | ✅ | ✅ |
| Visualizar dados e dashboards | ✅ | ✅ | ✅ |
| Convidar membros | ✅ | ❌ | ❌ |
| Remover membros | ✅ | ❌ | ❌ |
| Mudar papel de membros | ✅ | ❌ | ❌ |
| Deletar Account | ✅ (só o último owner) | ❌ | ❌ |
| Sair da Account | ✅ (se não for último owner) | ✅ | ✅ |

## 4. Fluxos

### 4.1 Criar Account

**Trigger**: Usuário no `/onboarding` (primeiro login sem Accounts) ou em `/select-account` (já tem Accounts e quer criar nova).

**Form**:
- Nome da Account (obrigatório, 1-80 chars).

**Server Action**:
1. `requireUser()`.
2. Cria `Account` com `createdById = user.id`.
3. Cria `AccountMember` com `role = owner`.
4. Cria `AccountSettings` com defaults.
5. **Pré-popula** com defaults úteis (configurável):
   - 4 Sections: "Entradas" (add), "Saídas" (subtract), "Cartão" (subtract), "Investimentos" (neutral).
   - 5 Categories básicas: "Alimentação", "Transporte", "Moradia", "Saúde", "Lazer".
6. Redireciona para a Account criada.

### 4.2 Convidar membro

**Trigger**: Owner em `/settings/members` → botão "Convidar".

**Form**:
- Email (obrigatório, formato válido).
- Role (owner/editor/viewer, default viewer).

**Server Action**:
1. `requireAccountAccess(accountId)`, verificar role = owner.
2. Validar Zod.
3. Verificar se já existe membro com esse email. Se sim → erro "Já é membro".
4. Verificar se há invite pendente para esse email. Se sim → erro "Convite já enviado".
5. Criar `AccountInvite` com:
   - `token` = random 32 chars
   - `expiresAt` = now + 7 dias
   - `status` = pending
6. Enviar email com link `https://app/invite/accept?token=<token>`.
7. Retornar sucesso.

### 4.3 Aceitar convite

**Cenário A**: Usuário já tem conta.
1. Click no link do email → `/invite/accept?token=<token>`.
2. Se não logado: redireciona para `/login?next=...`.
3. Se logado:
   - Server Action `acceptInvite(token)`.
   - Verifica token válido, não expirado, não revogado.
   - Verifica email do invite == email do user logado (case insensitive).
   - Cria `AccountMember` com role do invite.
   - Marca `AccountInvite.status = accepted`, `acceptedAt = now`.
   - Redireciona para a Account.

**Cenário B**: Usuário não tem conta.
1. Click no link → `/invite/accept?token=<token>`.
2. Página exibe: "Você foi convidado para a Account X. Crie uma conta para aceitar."
3. Botão leva para `/signup?invite=<token>` (token preserved).
4. Após signup, automaticamente executa o aceite.

**Notificação in-app**:
- Se o email do invite corresponde a um User existente, mostrar badge no menu do usuário e em `/settings/profile` com invites pendentes.

### 4.4 Recusar / revogar convite

- **Convidado pode recusar**: action em `/settings/profile` → marca `status = revoked`.
- **Owner pode revogar**: ação em `/settings/members` → marca `status = revoked`. Link enviado por email para de funcionar.

### 4.5 Remover membro

**Trigger**: Owner em `/settings/members` → botão "Remover" ao lado do membro.

**Server Action**:
1. `requireAccountAccess(accountId)`, role = owner.
2. **Não pode remover a si mesmo** se for o único owner.
3. **Não pode remover outro owner** se for o último owner (sem isso, account fica sem owner).
4. Deletar `AccountMember`.
5. **Não deleta** transações criadas pelo membro removido (mantém histórico, `createdById` aponta para User órfão da Account).

### 4.6 Mudar papel de membro

**Trigger**: Owner em `/settings/members` → dropdown de role.

**Regras**:
- Não pode rebaixar o último owner.
- Owner pode promover/rebaixar qualquer outro membro.

### 4.7 Sair da Account

**Trigger**: Qualquer membro em `/settings/account` → "Sair desta Account".

**Regras**:
- Owner não pode sair se for o único.
- Se for o único owner com outros membros: erro pedindo para promover alguém antes.
- Confirmação obrigatória.

### 4.8 Deletar Account

**Trigger**: Owner em `/settings/account` → "Deletar Account".

**Regras**:
- Confirmação por digitação ("digite o nome da Account para confirmar").
- Hard delete em cascade (ver schema).
- Email para todos os membros notificando.

## 5. UI

### 5.1 Páginas
- `/onboarding` — criar primeira Account.
- `/select-account` — listagem visual estilo Netflix.
- `/settings/members` — listar membros + convites pendentes + botão convidar.
- `/settings/account` — config geral da account (nome, deletar, sair).
- `/invite/accept?token=...` — aceitar convite.

### 5.2 Componentes
- `<AccountCard />` — card de Account em `/select-account` com nome, número de membros, último acesso.
- `<MembersTable />` — listagem com role + ações.
- `<InvitesList />` — invites pendentes com ação revogar.
- `<InviteForm />` — modal de convite.

## 6. Email templates

### 6.1 Convite
**Assunto**: "Você foi convidado para a Account [Nome] no MyAccountant"

**Corpo**:
> Olá!
>
> [Nome do convidador] convidou você para a Account "[Nome da Account]" no MyAccountant como [papel].
>
> [Botão: Aceitar convite] (link com token)
>
> O convite expira em 7 dias.
>
> Se você não esperava este convite, pode ignorar este email.

## 7. Validação (Zod)

```ts
// src/lib/schemas/account.ts

export const createAccountSchema = z.object({
  name: z.string().min(1).max(80).trim(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(["owner", "editor", "viewer"]).default("viewer"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["owner", "editor", "viewer"]),
});
```

## 8. Edge cases

- **Convite enviado para email que ainda não tem conta**: usuário cria conta → token continua válido → aceita.
- **Convite com email diferente de capitalização**: normaliza tudo para lowercase no save e no compare.
- **Token de convite vazado**: revogar pelo dashboard de owner. Não há mitigação adicional além disso.
- **Owner deleta sua própria conta de User**: precisa promover outro owner ou deletar a Account primeiro.
- **Last owner edge case**: validar em todo delete/role-change de membro. Não confiar só na UI.

## 9. Decisões em aberto

- [ ] Convite com link sem login (registra direto na Account ao clicar)? — **Decisão atual: não**, signup obrigatório.
- [ ] Limite de membros por Account? — **Decisão atual: não no MVP**.
- [ ] Convite com permissão por seção (granular)? — **v2**.
