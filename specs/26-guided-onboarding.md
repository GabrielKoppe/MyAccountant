# Spec 26 — Onboarding Guiado

> Status: implemented (onboarding page + ChecklistWidget + checklist action — 2026-07-11)
> Insumo: docs/v2-analysis.md §3 UX-06
> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md)

---

## 1. Problema

O usuário que cria sua primeira Account precisa configurar manualmente Seções, Categorias e Instituições antes de conseguir usar o app de forma significativa. Não há nenhum guia que explique essa sequência. O resultado é que usuários novos chegam na tela inicial sem contexto, não sabem por onde começar e podem abandonar o app antes de perceber seu valor.

O fluxo atual:
1. Cria conta → redireciona para `/onboarding` → cria Account
2. Cai em `/[accountId]` sem nenhum mês → vê `NoMonthsState`
3. Precisa descobrir sozinho que deve ir em Configurações → Seções → criar seções → depois Categorias → depois criar mês

---

## 2. Solução

Após criar a primeira Account (ou qualquer Account sem onboarding concluído), redirecionar para um fluxo de onboarding guiado em `/[accountId]/setup`. O objetivo principal é **orientação**: o usuário entende como o app funciona antes de começar a usar. A criação de seções é a única ação oferecida no fluxo; tudo o mais é explicativo.

**Etapas do onboarding (stepper, fluxo unidirecional — sem botão Voltar):**

1. **Seções** — Explica o conceito de Seções e Tabelas Financeiras. Oferece sugestões clicáveis para criar seções (chips/cards com nomes e `countType` pré-definidos). O usuário pode aceitar sugestões, editar nomes/`countType` e criar as suas próprias. Cada seção é salva imediatamente ao ser adicionada.
2. **Página de Mês** — Explicativo: apresenta como a página de mês funciona (navegação por mês, tabelas financeiras, transações, totais por seção).
3. **Configurações** — Explicativo: mini-preview com cards (ícone + descrição curta) de Categorias, Instituições e Colunas Customizadas. Informa que essas configurações estão disponíveis no menu de Configurações.
4. **Pronto** — Resumo do que foi configurado. Se nenhuma seção foi criada, exibe aviso suave ("Você ainda não criou seções — transações precisam de seções para ser organizadas"). Botão "Criar meu primeiro mês" (abre o modal de criação de mês já existente) disponível independentemente.

---

## 3. User Stories

- Como novo usuário, quero ser guiado pelos primeiros passos de configuração, para conseguir usar o app sem precisar explorar sozinho o menu de configurações.
- Como novo usuário, quero entender como o app funciona (seções, mês, configurações) antes de começar a usar.
- Como novo usuário, quero aceitar sugestões de seções com um clique, para não precisar criar tudo do zero.
- Como usuário avançado, quero poder pular o onboarding e configurar manualmente, para não ser forçado a usar sugestões que não se encaixam no meu perfil.
- Como usuário, quero poder refazer o tour de configuração a qualquer momento, para tirar dúvidas sobre funcionalidades do app.

---

## 4. Critérios de Aceitação

- QUANDO um usuário acessa `/[accountId]` e `AccountSettings.onboardingCompletedAt` for `null`, O SISTEMA DEVE redirecionar para `/[accountId]/setup`.
- O onboarding DEVE ser um stepper com 4 etapas: Seções, Página de Mês, Configurações e Pronto. Navegação é **unidirecional** (sem botão Voltar).
- NA ETAPA DE SEÇÕES, O SISTEMA DEVE exibir sugestões clicáveis (chips/cards) com nomes pré-definidos e `countType` recomendado. Clicar adiciona a seção à lista e **salva imediatamente** via `createSectionAction`.
- O USUÁRIO DEVE poder editar o nome e o `countType` de cada seção antes de confirmar.
- O USUÁRIO DEVE poder pular qualquer etapa clicando em "Pular".
- NA ETAPA "PÁGINA DE MÊS", O SISTEMA DEVE exibir conteúdo explicativo sobre navegação por mês, tabelas financeiras e transações. Nenhuma ação de criação.
- NA ETAPA "CONFIGURAÇÕES", O SISTEMA DEVE exibir cards com ícone + descrição curta de Categorias, Instituições e Colunas Customizadas.
- NA ETAPA PRONTO, SE nenhuma seção foi criada, O SISTEMA DEVE exibir aviso suave informando que transações precisam de seções para ser organizadas.
- NA ETAPA PRONTO, O SISTEMA DEVE exibir o botão "Criar meu primeiro mês" que abre o modal de criação de mês existente. O botão estará disponível mesmo que nenhuma seção tenha sido criada.
- QUANDO o usuário chegar na etapa Pronto (com ou sem criar seções, com ou sem ter pulado etapas), O SISTEMA DEVE gravar `AccountSettings.onboardingCompletedAt = now()`.
- O SISTEMA DEVE exibir em Account Settings uma opção "Refazer tour de configuração" que reseta `onboardingCompletedAt` para `null`, fazendo com que o próximo acesso ao account redirecione para `/[accountId]/setup` novamente.
- Accounts existentes sem `onboardingCompletedAt` (campo nulo após migration) serão redirecionadas para o onboarding no próximo acesso.

---

## 5. Fora de Escopo

- Etapa de Categorias no onboarding (categorias virão principalmente de importação de dados).
- Criação de Tabelas Financeiras no onboarding (apenas conceito explicativo).
- Configuração de Instituições no onboarding.
- Tour interativo com tooltips sobre a interface.
- Importação de dados durante o onboarding.

---

## 6. Referências Técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/app/(app)/[accountId]/setup/page.tsx` | Nova rota para o stepper guiado |
| `src/app/(app)/[accountId]/layout.tsx` | Lógica de redirect para `/[accountId]/setup` se `onboardingCompletedAt` for `null` |
| `prisma/schema.prisma` | Campo `onboardingCompletedAt DateTime?` em `AccountSettings` |
| `src/components/onboarding/` | Novos componentes: `OnboardingWizard`, `StepSections`, `StepMonthPage`, `StepSettings`, `StepDone` |
| `src/app/(app)/[accountId]/settings/` | Opção "Refazer tour de configuração" na tela de configurações da account |
| `src/actions/onboarding.ts` | Action `completeOnboardingAction` para gravar `onboardingCompletedAt` |
| `src/actions/onboarding.ts` | Action `resetOnboardingAction` para resetar `onboardingCompletedAt` |

**Sugestões pré-definidas de seções:**
```ts
const SECTION_SUGGESTIONS = [
  { name: "Renda", countType: "add" },
  { name: "Gastos Fixos", countType: "subtract" },
  { name: "Gastos Variáveis", countType: "subtract" },
  { name: "Investimentos", countType: "ignore" },
  { name: "Poupança", countType: "ignore" },
];
```

**Conteúdo dos cards na etapa Configurações:**
```ts
const SETTINGS_CARDS = [
  {
    title: "Categorias",
    description: "Classifique transações por tipo (Alimentação, Transporte, Saúde…). Subcategorias permitem maior granularidade.",
  },
  {
    title: "Instituições",
    description: "Vincule transações a bancos, carteiras ou corretoras para rastrear de onde vem e para onde vai o dinheiro.",
  },
  {
    title: "Colunas Customizadas",
    description: "Adicione campos extras às suas tabelas (ex: Responsável, Parcela, Tipo de Investimento) conforme sua necessidade.",
  },
];
```

**Notas de implementação:**
- Usar MUI `Stepper` component (`orientation="horizontal"`, `alternativeLabel`) para o fluxo.
- As ações de criação de seções DEVEM usar `createSectionAction` existente.
- O redirect no layout deve verificar `AccountSettings.onboardingCompletedAt` — buscar via query Prisma no Server Component do layout.
- A rota `/[accountId]/setup` fica dentro do layout de account (`src/app/(app)/[accountId]/layout.tsx`), herdando proteção de autenticação e acesso ao account.
- `completeOnboardingAction` e `resetOnboardingAction` usam `defineAction` com `requireRoles: ["owner"]`.
