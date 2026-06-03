# Spec 26 — Onboarding Guiado

> Status: draft
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

Após criar a primeira Account, redirecionar para um fluxo de onboarding guiado em etapas (stepper). O assistente de configuração oferece atalhos e sugestões, mas é sempre opcional — o usuário pode pular qualquer etapa.

**Etapas do onboarding:**
1. **Seções** — Criar as seções principais (com sugestões pré-definidas clicáveis: Renda, Gastos Fixos, Gastos Variáveis, Investimentos, Poupança). O usuário pode aceitar as sugestões, editar os nomes e/ou criar suas próprias.
2. **Categorias** — Adicionar categorias iniciais (sugestões por grupo: Alimentação, Transporte, Moradia, Saúde, Lazer...). Opcional.
3. **Pronto** — Resumo do que foi configurado + botão "Criar meu primeiro mês".

---

## 3. User Stories

- Como novo usuário, quero ser guiado pelos primeiros passos de configuração, para conseguir usar o app sem precisar explorar sozinho o menu de configurações.
- Como novo usuário, quero aceitar sugestões de seções e categorias com um clique, para não precisar criar tudo do zero.
- Como usuário avançado, quero poder pular o onboarding e configurar manualmente, para não ser forçado a usar sugestões que não se encaixam no meu perfil.

---

## 4. Critérios de Aceitação

- QUANDO um usuário completa a criação de uma nova Account (via onboarding ou criação de account adicional), SE A ACCOUNT NÃO TIVER SEÇÕES CONFIGURADAS, O SISTEMA DEVE redirecionar para o fluxo de onboarding guiado.
- O onboarding DEVE ser um stepper com no mínimo 2 etapas: Seções e Pronto.
- NA ETAPA DE SEÇÕES, O SISTEMA DEVE exibir sugestões clicáveis (chips/cards) com nomes pré-definidos e `countType` recomendado. Clicar adiciona a seção à lista da etapa.
- O USUÁRIO DEVE poder editar o nome e o `countType` de cada seção antes de confirmar.
- O USUÁRIO DEVE poder pular qualquer etapa clicando em "Pular".
- NA ETAPA FINAL, O SISTEMA DEVE exibir um resumo do que foi criado e um botão "Criar meu primeiro mês" que abre o modal de criação de mês.
- QUANDO o onboarding for concluído (com ou sem skip), O SISTEMA DEVE registrar que o onboarding foi feito para não exibir novamente (campo em `AccountSettings` ou `UserSettings`).

---

## 5. Fora de Escopo

- Configuração de Instituições no onboarding (menos crítica para o primeiro uso).
- Onboarding para accounts que já possuem dados (apenas para accounts novas sem seções).
- Tour interativo (tooltips sobre a interface) — o stepper cobre o essencial.
- Importação de dados durante o onboarding.

---

## 6. Referências Técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/app/(app)/onboarding/` | Refatorar ou criar sub-rota para o stepper guiado |
| `src/app/(app)/[accountId]/` | Lógica de redirect para onboarding se não houver seções |
| `prisma/schema.prisma` | Campo `onboardingCompletedAt` em `AccountSettings` |
| `src/components/onboarding/` | Novos componentes de stepper (OnboardingWizard, StepSections, StepDone) |

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

- Usar MUI `Stepper` component para o fluxo.
- As ações de criação de seções no onboarding DEVEM usar as mesmas `createSectionAction` existentes.
- O redirect para o onboarding deve ser verificado no layout de account (`src/app/(app)/[accountId]/layout.tsx`), não em cada page.
