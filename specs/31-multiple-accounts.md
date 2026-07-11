# Spec 31 — Múltiplas Contas por Usuário

> Status: implemented (AccountSwitcher no layout da Account — 2026-07-11)
> Insumo: feedback direto do usuário (identificado durante revisão do V1)
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

O V1 implementou o fluxo de criação de Account apenas no onboarding inicial (`/onboarding`). Após criar a primeira Account, não há nenhuma forma de criar uma segunda Account. A página `/select-account` lista as accounts do usuário, mas não tem botão de criação. Um usuário que queira, por exemplo, ter uma conta pessoal e uma conta de casal separadas, ou uma conta de trabalho, não consegue sem usar o onboarding de outro usuário.

Esta é uma limitação funcional relevante, não um bug do código existente — a lógica de negócio de criar múltiplas accounts não foi desenvolvida.

---

## 2. Solução

Permitir que um usuário já autenticado crie novas Accounts a qualquer momento, a partir da página `/select-account` e do menu de troca de conta no AppBar. O fluxo de criação usa uma rota dedicada `/accounts/new` (não reutiliza o `/onboarding`, que tem UX de primeiro uso) e redireciona para o onboarding guiado (spec 26) da nova account.

---

## 3. User Stories

- Como usuário, quero criar uma segunda Account (ex: "Casal" + "Pessoal"), para manter finanças separadas sem precisar criar outro login.
- Como usuário, quero trocar de Account facilmente a partir de qualquer tela do app, sem precisar ir até `/select-account`.
- Como usuário, quero ver claramente em qual Account estou navegando no momento.

---

## 4. Critérios de Aceitação

### Criação de nova Account (`/accounts/new`)

- A página `/select-account` DEVE ter um botão "Nova conta" que navega para `/accounts/new`.
- A rota `/accounts/new` DEVE ter layout simplificado: AppBar com avatar/nome do usuário à direita + botão "Cancelar" à esquerda. Sem os itens de navegação da app (meses, dashboards, configurações, etc.).
- O botão "Cancelar" DEVE usar o query param `?from=/{accountId}` para retornar à account de origem quando o usuário veio de dentro de uma account. Sem `from` param (ex: veio da `/select-account`), redireciona para `/select-account`.
- O formulário de `/accounts/new` DEVE conter apenas o campo "Nome da conta".
- Nomes de Account DEVEM ser únicos por usuário (case-sensitive). Tentar criar uma account com nome já existente para o mesmo usuário DEVE retornar erro de validação no campo "Nome da conta".
- APÓS CRIAR A ACCOUNT com sucesso, O SISTEMA DEVE redirecionar para `/[novaAccountId]/setup` (onboarding guiado — spec 26).
- Não há limite máximo de accounts por usuário.
- O `createAccountAction` existente em `src/actions/accounts.ts` DEVE ser reutilizado. A validação de unicidade DEVE ser adicionada ao `account-service.ts`.

### Troca de Account no AppBar

- QUANDO o usuário tem **2 ou mais** Accounts, o nome da Account no AppBar DEVE exibir um ícone chevron (▼) à direita e ser clicável, abrindo um menu dropdown.
- QUANDO o usuário tem **apenas 1** Account, o nome permanece como link simples para `/{accountId}` (comportamento atual preservado). Sem chevron, sem dropdown.
- O menu dropdown DEVE exibir:
  1. A Account ativa no topo, destacada visualmente (sem interação — indica posição atual).
  2. Um separador.
  3. As demais Accounts do usuário em ordem de criação (mais antiga primeiro).
  4. Um item "+ Nova conta" fixado no rodapé do menu.
- AO CLICAR em outra Account no menu, O SISTEMA DEVE navegar para `/{novaAccountId}` (raiz da account — página padrão).
- AO CLICAR em "+ Nova conta" no menu, O SISTEMA DEVE navegar para `/accounts/new?from=/{accountIdAtual}`.

### Consistência

- O fluxo de troca de account é tratado inteiramente via navegação de URL — não há cookie de "account ativa" adicional.
- Acessar `/{accountId}` de uma account da qual o usuário não é membro DEVE continuar resultando em redirect para `/home` (comportamento existente preservado).

---

## 5. Fora de Escopo

- Rastreamento de "última página visitada por account" — ao trocar de account, navega sempre para a raiz (`/{accountId}`).
- Transferência de transações entre Accounts.
- Mesclagem de Accounts.
- Limite de Accounts por usuário (sem limite).
- Pinagem ou ordenação manual de Accounts na lista.
- Ícone ou cor customizável por Account.

---

## 6. Referências Técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/app/(app)/select-account/page.tsx` | Alterar botão existente (`href="/onboarding"`) para `href="/accounts/new"` |
| `src/app/(app)/accounts/new/page.tsx` | Nova rota com layout simplificado e formulário de criação de account |
| `src/app/(app)/accounts/layout.tsx` | Layout simplificado (AppBar com usuário + Cancelar) para o grupo `/accounts/*` |
| `src/app/(app)/[accountId]/layout.tsx` | Adicionar `AccountSwitcher` no AppBar (visível apenas com 2+ accounts) |
| `src/components/accounts/AccountSwitcher.tsx` | Novo componente Client: chevron + Menu dropdown com lista de accounts |
| `src/actions/accounts.ts` | `createAccountAction` existente — reutilizar sem modificação |
| `src/server/services/account-service.ts` | Adicionar validação de unicidade de nome por usuário (case-sensitive) antes de criar |
| `src/lib/schemas/account.ts` | Verificar se o schema de criação já está adequado (apenas campo `name`) |

**Notas de implementação:**

- `createAccount` no service já cria `AccountMember` com `role: "owner"` para o criador — comportamento correto, não precisa ser alterado.
- `createAccountAction` usa `requireUser` (não `requireAccountAccess`) — correto para uma ação que não pertence a nenhuma account existente.
- Para o `AccountSwitcher`, o `AccountLayout` precisará buscar todas as memberships do usuário autenticado (query adicional: `prisma.accountMember.findMany({ where: { userId } })`). Avaliar se vale memoizar ou fazer lazy load no clique.
- O redirect no layout do `/accounts/new` DEVE preservar o query param `from` ao montar o botão Cancelar.
- A validação de unicidade no service DEVE usar `prisma.account.findFirst` verificando se alguma account do `createdById` já tem o mesmo `name` (comparação exata — case-sensitive).
- A rota `/accounts/new` fica fora do grupo `[accountId]`, portanto não herda o layout de account nem o redirect de onboarding do spec 26.
