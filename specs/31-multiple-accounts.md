# Spec 31 — Múltiplas Contas por Usuário

> Status: draft
> Insumo: feedback direto do usuário (identificado durante revisão do V1)
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

O V1 implementou o fluxo de criação de Account apenas no onboarding inicial (`/onboarding`). Após criar a primeira Account, não há nenhuma forma de criar uma segunda Account. A página `/select-account` lista as accounts do usuário, mas não tem botão de criação. Um usuário que queira, por exemplo, ter uma conta pessoal e uma conta de casal separadas, ou uma conta de trabalho, não consegue sem usar o onboarding de outro usuário.

Esta é uma limitação funcional relevante, não um bug do código existente — a lógica de negócio de criar múltiplas accounts não foi desenvolvida.

---

## 2. Solução

Permitir que um usuário já autenticado crie novas Accounts a qualquer momento, a partir da página `/select-account` e do menu de troca de conta no AppBar. O fluxo de criação reutiliza a lógica existente e redireciona para o onboarding guiado (spec 26) para a nova account.

---

## 3. User Stories

- Como usuário, quero criar uma segunda Account (ex: "Casal" + "Pessoal"), para manter finanças separadas sem precisar criar outro login.
- Como usuário, quero trocar de Account facilmente a partir de qualquer tela do app, sem precisar ir até `/select-account`.
- Como usuário, quero ver claramente em qual Account estou navegando no momento.

---

## 4. Critérios de Aceitação

**Criação de nova Account:**
- A página `/select-account` DEVE ter um botão "Nova conta" visível.
- AO CLICAR, O USUÁRIO DEVE ser redirecionado para um formulário de criação de Account (pode reutilizar o componente existente do onboarding ou criar uma rota dedicada `/accounts/new`).
- APÓS CRIAR A ACCOUNT, O USUÁRIO DEVE ser redirecionado para o onboarding guiado (spec 26) da nova account.
- Não há limite máximo de accounts por usuário (pode ser adicionado como configuração futura se necessário).

**Troca de Account no AppBar:**
- O nome da Account exibido no AppBar DEVE ser clicável (ou ter um ícone de dropdown ao lado).
- AO CLICAR, UM MENU DEVE listar todas as Accounts do usuário com indicação visual de qual está ativa.
- QUANDO o usuário seleciona outra Account, O SISTEMA DEVE navegar para `/{novaAccountId}` (última página visitada dessa account ou página padrão).
- O menu DEVE ter um item "+ Nova conta" no rodapé.

**Consistência:**
- O fluxo de troca de account DEVE atualizar o cookie/contexto de account ativa corretamente.
- Acessar `/{accountId}` de uma account da qual o usuário não é membro DEVE continuar resultando em redirect para `/home` (comportamento existente preservado).

---

## 5. Fora de Escopo

- Transferência de transações entre Accounts.
- Mesclagem de Accounts.
- Limite de Accounts por usuário (sem limite na V2).
- Pinagem ou ordenação de Accounts na lista.
- Ícone ou cor customizável por Account.

---

## 6. Referências Técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/app/(app)/select-account/page.tsx` | Adicionar botão "Nova conta" |
| `src/app/(app)/accounts/new/page.tsx` | Nova rota (ou modal na select-account) para criação de account |
| `src/app/(app)/[accountId]/layout.tsx` | Adicionar dropdown de troca de account no AppBar |
| `src/actions/accounts.ts` | Action `createAccount` já existe — verificar se pode ser reutilizada |
| `src/server/services/account-service.ts` | Verificar se `createAccount` está implementado ou precisa ser criado |

- A lógica de criação de Account já existe parcialmente no onboarding — auditar o que precisa ser extraído para ser reutilizável.
- Para o dropdown de troca de account no AppBar, buscar as accounts do usuário já acontece em `requireAccountAccess` — avaliar se pode ser reaproveitado ou se um novo fetch é necessário.
- O AccountMember criado ao criar nova Account DEVE ter role `owner` para o criador (mesmo comportamento do onboarding).
