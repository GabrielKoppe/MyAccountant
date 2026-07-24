# Spec 65 — Navegação em Sidebar Lateral e Captura Rápida

> Status: approved
> Insumo: revisão de UX da navegação atual (AppBar por ícones) + protótipo "Opção 1a" aprovado pelo desenvolvedor
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md) · [`react-best-practices`](../skills/react-best-practices/SKILL.md)

---

## 1. Problema

A navegação principal hoje vive em uma `AppBar` horizontal (`src/app/(app)/[accountId]/layout.tsx`). Cinco problemas concretos de arquitetura de informação e descoberta:

- **NAV-01**: Em `src/components/ui/AppBarNavButtons.tsx`, os quatro destinos principais (Dashboards, Membros, Patrimônio, Configurações) são renderizados **apenas como `IconButton` + `Tooltip`**, sem rótulo textual visível. A descoberta depende de hover, e os itens têm peso visual idêntico — "Membros" (gestão) compete com "Patrimônio" (uso diário) sem hierarquia.
- **NAV-02**: A troca de conta (`AccountSwitcher.tsx`) e a navegação por meses (`MonthsDropdown.tsx`) ficam ambas comprimidas na mesma `Toolbar dense` (48px). A `AppBar` não escala: qualquer novo destino disputa espaço horizontal e agrava o problema NAV-01.
- **NAV-03**: Não há **captura rápida de transação global**. Para lançar um gasto, o usuário precisa navegar até um mês → aba de seção → tabela → botão "Nova transação" (fluxo em `src/components/months/*` + `src/components/transactions/*`). Não existe atalho acessível de qualquer tela.
- **NAV-04**: O menu de configurações (`src/app/(app)/[accountId]/settings/layout.tsx`) é uma **lista linear de ~15 itens** com apenas um `Divider` separando os itens de owner. Itens de naturezas distintas (estrutura de dados, importação, planejamento) competem em uma única lista plana, sem agrupamento por família.
- **NAV-05**: Em telas largas, a `AppBar` horizontal desperdiça altura vertical fixa (48px) em todas as páginas e não oferece ao usuário controle sobre o espaço da navegação (não recolhe).

> **Nota de escopo:** a separação de propósito entre "página do mês" (operacional) e "dashboard" (analítico) **já foi resolvida na Spec 21 (IA 8.3)**. Esta spec NÃO altera esse comportamento — apenas move o container de navegação de AppBar para sidebar.

---

## 2. Solução

Substituir a `AppBar` horizontal por uma **sidebar vertical persistente e recolhível** à esquerda, com rótulos, agrupamento e um botão de captura rápida no topo. Mudança **de container de navegação**, preservando todas as rotas, ações e comportamentos existentes.

> **Sobre o frame (`docs/frames/Spec 65`):** é blueprint, não pixel-perfect. Divergências conhecidas e intencionais: (a) o grupo "Principal" do frame mostra 3 itens — a spec adiciona Planejamento e Projeção (aditivo, nunca a menos); (b) a família "Planejamento" do frame de Configurações desenha "Orçamentos", mas essa rota **não existe** (orçamentos/metas moram em `/planning` top-level — §7.2); (c) o frame não desenha os estados de notificações, viewer, mobile (Drawer) nem o estado-vazio do quick-add — todos exigidos por §4. O estado-vazio do quick-add DEVE usar `<EmptyState>`.


### 2.1 Sidebar rotulada e agrupada (NAV-01, NAV-02, NAV-04)

- **NAV-01**: Novo componente `AppSidebar` renderiza cada destino como **ícone + rótulo textual** em `ListItemButton`. Item ativo destacado com o padrão já existente no settings sidebar (`bgcolor: "background.subtle"`, `borderRight: 2px accent.primary`, texto `accent.primary` peso 600).
- **NAV-02**: A sidebar hospeda, de cima para baixo: `AccountSwitcher` (topo), botão "Nova transação", `MonthsDropdown` (meses recentes), grupos de navegação, e um rodapé com o `UserMenuButton` (avatar + nome). As **notificações** (`NotificationBell`) deixam de ser um sino separado e passam a viver **dentro do menu do usuário** (abre ao clicar no avatar/conta no rodapé), como uma seção "Notificações" com a lista (marcação como lida ao **expandir** a seção — ver NAV-02b); o **contador de não lidas** aparece como badge no próprio avatar (visível também no rail recolhido de 64px), preservando a percepção rápida. A largura fixa da sidebar remove a disputa horizontal da AppBar.
- **NAV-04**: Os destinos são organizados em dois grupos com rótulo de grupo (`Typography variant="overline"`): **Principal** (Meses, Dashboards, Patrimônio, **Planejamento**, **Projeção** — as três de patrimônio/planejamento/projeção são páginas irmãs, mesmo tratamento de UI) e **Gestão** (Membros — visível a **todos** os papéis, Configurações). O sidebar interno de `/settings/*` (Spec 21 IA 8.2) é reorganizado em famílias: **Estrutura** (Seções, Categorias, Instituições, Responsáveis), **Importação** (Modelos, Templates, Aliases, Tipos de tabela), **Planejamento** (Checklist, Projeção/`forecast`), **Visualização** (dashboards), **Integrações** (Conectores) e **Conta** (Geral, Membros, Auditoria — Membros e Auditoria com ações restritas a owner). Mapa definitivo em §7.2.

### 2.2 Captura rápida global (NAV-03)

- **NAV-03**: Botão "Nova transação" (`contained`, `accent.primary`, ícone `Add`) fixo no topo da sidebar, visível em **todas** as telas da account. Abre um `DialogShell` reutilizável (`QuickAddTransactionDialog`) com os campos: Descrição, Valor (`NumericFormat` BRL), Data, **Tabela-alvo** (select), Categoria, Responsável e toggle Pendente.
- **Regra de destino (determinística, sem adivinhação):** o schema `createTransactionSchema` exige `tableId` (cuid). Uma `FinanceTable` pertence a exatamente uma Seção dentro de exatamente um Mês — portanto **o `tableId` escolhido resolve mês e seção sozinho**. Não há necessidade de inferir "mês fiscal atual". O select de tabela é pré-populado via `listTablesForMoveAction` (já existente, retorna todas as tabelas da account), rotulando cada opção como `Mês · Seção · Tabela`. Quando o usuário está numa aba de seção, essa tabela vem pré-selecionada.
- **Persistência e feedback:** ao salvar, chama `createTransactionAction(accountId, input)` existente. Essa Action **já chama `revalidateMonth(ctx.accountId, result.monthId)`** — logo, se a tela atual for o mês-alvo, ela se atualiza sozinha. Em qualquer tela, exibe snackbar de sucesso com link "Ver transação" → `/${accountId}/months/${monthId}?tab=${sectionId}`.
- **Papel:** visível apenas para `owner`/`editor` (a própria Action exige `requireRoles: ["owner","editor"]`; o botão espelha essa regra e fica oculto para `viewer`).

### 2.3 Sidebar recolhível (NAV-05)

- **NAV-05**: A sidebar alterna entre **expandida (200px, ícone + rótulo)** e **recolhida (64px, só ícone + tooltip)** por um botão no rodapé. A preferência é persistida (cookie `sidebar_collapsed`, mesmo mecanismo de `theme`/`accent_color` em `src/app/layout.tsx`) e lida no server para evitar flash. Abaixo de `md` (~900px), a sidebar vira `Drawer` temporário acionado por ícone hambúrguer (mesmo padrão já usado no settings sidebar mobile).

---

## 3. User Stories

- Como usuário novo, quero ver o nome de cada área de navegação sem passar o mouse, para descobrir o que o app oferece sem tentativa e erro.
- Como usuário no dia a dia, quero lançar uma transação de qualquer tela em um clique, para não atravessar mês → seção → tabela toda vez.
- Como usuário, quero que os destinos de uso frequente fiquem separados dos de administração, para encontrar o que preciso mais rápido.
- Como usuário em tela grande, quero recolher a navegação para ganhar área útil em tabelas e dashboards, e que essa escolha seja lembrada.
- Como usuário em celular, quero acessar a navegação por um menu que não ocupe espaço permanente na tela.
- Como qualquer membro (inclusive viewer), quero ver quem faz parte da conta e suas responsabilidades em "Membros", para conhecer o time — sem poder gerenciá-lo.
- Como owner, quero que as ações de gestão de membros (convidar, mudar papel, remover) e a Auditoria fiquem restritas a mim, e que o viewer não veja o botão de captura rápida.

---

## 4. Critérios de Aceitação

**NAV-01 — Sidebar rotulada:**
- QUANDO qualquer página de `/[accountId]/*` carrega, A NAVEGAÇÃO PRINCIPAL DEVE ser renderizada como sidebar vertical à esquerda, com cada destino exibindo ícone **e** rótulo textual (quando expandida).
- QUANDO o usuário está em uma rota, O ITEM CORRESPONDENTE DEVE estar destacado com `bgcolor: "background.subtle"`, `borderRight: 2px solid` `accent.primary` e texto em `accent.primary` peso 600.
- A `AppBar` horizontal atual (`Toolbar` em `[accountId]/layout.tsx`) NÃO DEVE mais existir nas páginas da account.

**NAV-02 — Estrutura da sidebar:**
- A sidebar DEVE conter, nesta ordem: `AccountSwitcher` no topo, botão "Nova transação", `MonthsDropdown` (meses recentes), grupo "Principal", grupo "Gestão", e rodapé com o host de usuário/notificações.
- `AccountSwitcher` e `MonthsDropdown` DEVEM ser reaproveitados (comportamento inalterado), apenas reposicionados — com ajuste de estilo para caber na sidebar (ver §7.6). O `AccountSwitcher` mantém o modo link-simples com 1 conta; o `MonthsDropdown` mantém navegação e estado vazio (o limite de 6 meses é do layout, não do componente — §7.6).
- O `UserMenuButton` NÃO é apenas reposicionado: ele ABSORVE o conteúdo do `NotificationBell` (ver NAV-02b). É a única mudança de comportamento entre os três reaproveitados.

**NAV-02b — Integração das notificações (redesenho, não reposicionamento):**
- Contagem, badge, polling de 5 min e refetch ao focar a aba DEVEM viver no **host sempre-montado** do rodapé (o botão de avatar), NÃO dentro do `Menu` — que desmonta ao fechar e PARARIA o polling.
- A **lista** (ícone por tipo, ponto de não-lida, tempo relativo, clique-navega, estado vazio, loading) vive dentro do menu, numa **seção/`Accordion` expansível** com região de scroll própria (o `Popover` atual é 360px/480px; o `Menu` é 240px e já denso — recriar o scroll, não empilhar itens crus).
- Marcar-como-lido HOJE dispara ao abrir o `Popover`. Como abrir o menu é frequente (tema/cor/conta/logout), a marcação NÃO DEVE disparar ao abrir o menu: DEVE disparar **apenas ao expandir a seção Notificações** dentro do menu. Um botão explícito "marcar todas como lidas" fica **fora de escopo** (§5). Abrir o menu para outro fim NÃO DEVE zerar o badge.
- O badge inicial vem do server (`getUnreadCount`) e funciona; o refresh client-side HOJE está QUEBRADO (lê `data.unreadCount` em vez de `data.data.unreadCount`) — a migração DEVE CORRIGIR, não preservar o bug.
- Ao clicar numa notificação, o `Menu` inteiro DEVE fechar antes do `router.push`. Destino: `/${accountId}/months/${monthId}` (o campo `link` É o monthId, SEM `?tab=`) — não confundir com o link do quick-add (§2.2), que tem `?tab=sectionId`.

**NAV-03 — Captura rápida:**
- O botão "Nova transação" DEVE estar visível no topo da sidebar em todas as telas da account para papéis `owner` e `editor`.
- ENQUANTO o papel do membro for `viewer`, O BOTÃO "Nova transação" NÃO DEVE ser renderizado.
- QUANDO o usuário clica em "Nova transação", UM DIÁLOGO DEVE abrir com os campos: Descrição, Valor, Data, Seção/Tabela, Categoria, Responsável e toggle Pendente.
- O select de tabela-alvo DEVE listar tabelas da account rotuladas como `Mês · Seção · Tabela`, e o `tableId` escolhido DEVE resolver mês+seção sem inferência adicional.
- QUANDO o usuário aciona a captura rápida a partir de uma aba de seção, A TABELA daquela seção/mês DEVE vir pré-selecionada.
- QUANDO o diálogo é salvo com sucesso, O SISTEMA DEVE chamar `createTransactionAction` (que já revalida o mês-alvo) e exibir snackbar de sucesso com link `/${accountId}/months/${monthId}?tab=${sectionId}`.
- SE a validação Zod falhar, O DIÁLOGO DEVE exibir os erros por campo sem fechar.
- SE a account não tiver nenhuma tabela ainda, O DIÁLOGO DEVE exibir estado vazio orientando criar uma tabela primeiro (sem permitir submit).

**NAV-04 — Agrupamento:**
- Os destinos principais DEVEM estar agrupados sob rótulos "Principal" (Meses, Dashboards, Patrimônio, **Planejamento**, **Projeção**) e "Gestão" (Membros, Configurações), cada grupo com um `Typography variant="overline"` como cabeçalho. Planejamento (`/planning`) e Projeção (`/forecast`) são páginas irmãs de Patrimônio e recebem o mesmo tratamento de UI (item rotulado no grupo Principal) — nenhuma rota fica órfã.
- O item "Membros" DEVE aparecer para **todos** os papéis (ver quem faz parte da conta e suas responsabilidades). As ações de **gestão** (convidar, mudar papel, remover) DEVEM permanecer restritas a `owner`; para `viewer`/`editor` a página abre em modo leitura. Isso exige uma exceção ao redirect atual de `viewer` em `/settings/*` (ver §7.1).
- O sidebar de `/settings/*` DEVE agrupar seus links nas famílias "Estrutura", "Importação", "Planejamento", "Visualização", "Integrações" e "Conta", cada família com cabeçalho `overline` (mapa em §7.2).

**NAV-05 — Recolhível:**
- QUANDO o usuário aciona o botão de recolher no rodapé da sidebar, A SIDEBAR DEVE alternar entre 200px (ícone + rótulo) e 64px (só ícone).
- ENQUANTO recolhida, cada item DEVE exibir seu rótulo via `Tooltip` no hover.
- A preferência de recolhido/expandido DEVE ser persistida em cookie e aplicada no server render (sem flash de layout ao recarregar).
- ENQUANTO a viewport for menor que o breakpoint `md`, A SIDEBAR DEVE ser um `Drawer` temporário acionado por ícone hambúrguer, e não ocupar espaço permanente.
- A transição expandir↔recolher anima **largura** (não `transform`/`opacity`): DEVE respeitar `prefers-reduced-motion` (sem animação quando reduzido) e limitar-se ao container da sidebar.
- Cada item recolhido DEVE ter `aria-label` (além do `Tooltip`); o botão de toggle DEVE ter `aria-label` e `aria-expanded`.
- No rail recolhido (64px), o rodapé DEVE manter o **avatar do usuário com o badge de não-lidas** (o frame desenha só o toggle ali — a spec exige avatar+badge). Verificar que 5 itens de "Principal" + 2 de "Gestão" + topo + rodapé cabem no rail sem scroll indesejado.


---

## 5. Fora de Escopo

- **Separação operacional × analítica** (página do mês vs dashboard) — já entregue na Spec 21 (IA 8.3); esta spec não a altera.
- **Alteração do core Meses → Seções → Tabelas Financeiras → Transação** — a hierarquia e o comportamento de **tabelas colapsáveis** permanecem exatamente como hoje. A sidebar troca só o container de navegação; não mexe na estrutura de dados nem no layout das páginas de mês/seção. (O frame simplifica a "Aba de Seção" só para ilustrar a nova moldura — a organização real mês→seção→N tabelas colapsáveis é preservada integralmente.)
- **Redesign visual dos widgets, KPIs, tabelas ou dashboards** — o conteúdo das páginas permanece idêntico; muda apenas o container de navegação.
- **Busca global / command palette (⌘K)** — considerada no protótipo (opção 1b) mas fora desta spec; pode virar spec futura.
- **Novos campos ou lógica de transação** no diálogo de captura rápida — reutiliza o schema e a Action existentes; não introduz parcelamento, tags ou anexos novos aqui.
- **Rail de múltiplos workspaces / troca visual entre contas** (opção 1c do protótipo) — o `AccountSwitcher` atual é mantido como está.
- **Alteração das rotas ou da estrutura de URLs** — todas as rotas `/[accountId]/*` permanecem idênticas.
- **Tema light** — a sidebar deve funcionar em light e dark (usa tokens semânticos), mas nenhum ajuste de paleta é feito aqui.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Container de navegação | Sidebar vertical à esquerda | Escala para novos destinos sem disputa horizontal; permite rótulos + agrupamento; padrão consolidado em apps de finanças/produtividade |
| Persistência do estado recolhido | Cookie lido no server | Mesmo mecanismo de `theme`/`accent_color`; evita flash de layout no primeiro paint |
| Captura rápida | `DialogShell` reutilizando Action existente | Não duplica lógica de criação; mantém validação Zod única |
| Escopo do agrupamento de settings | Reorganização dos links existentes | Resolve a lista rasa (NAV-04) sem criar novas telas |
| Comportamento mobile | `Drawer` temporário | Reaproveita o padrão já existente no settings sidebar (Spec 21 IA 8.2) |
| Notificações na sidebar | Badge/polling no host sempre-montado (avatar do rodapé); lista dentro do menu | Menu desmonta ao fechar → polling pararia; separa o "sempre-vivo" (contagem) do "sob demanda" (lista) |
| Gatilho de marcar-lido | Ao expandir a seção Notificações (não ao abrir o menu) | Abrir o menu p/ tema/logout não pode zerar o badge sem o usuário ver |


---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| NAV-01, NAV-02, NAV-05 | `src/app/(app)/[accountId]/layout.tsx` (remover `AppBar`/`Toolbar`, montar `AppSidebar` + área de conteúdo em flex row); **novo** `src/components/ui/AppSidebar.tsx` |
| NAV-02 (reuso) | `src/components/accounts/AccountSwitcher.tsx`, `src/components/months/MonthsDropdown.tsx`, `src/components/ui/UserMenuButton.tsx` (reposicionar; não reescrever); `src/components/ui/NotificationBell.tsx` (extrair a lista/lógica para dentro do menu do `UserMenuButton` + badge de não lidas no avatar; preservar polling/refetch) |
| NAV-03 | **novo** `src/components/transactions/QuickAddTransactionDialog.tsx`; Action de criação existente em `src/actions/transactions.ts`; schema em `src/lib/schemas/transaction*` |
| NAV-04 (settings) | `src/app/(app)/[accountId]/settings/layout.tsx` (reagrupar famílias + abrir exceção de leitura de `members` para viewer/editor), `src/components/settings/SettingsNav.tsx` (reagrupar links em famílias) |
| NAV-04 (Principal) | Itens Planejamento (`/planning`) e Projeção (`/forecast`) no grupo Principal, com o mesmo tratamento de Patrimônio; `AppBarNavButtons.tsx` (referência dos ícones `Savings`/`TrendingUp` a portar para a sidebar) |
| NAV-05 (cookie) | `src/app/layout.tsx` (ler cookie `sidebar_collapsed`), `src/actions/user-settings.ts` (persistir preferência) |

### Padrão do item de navegação ativo (reusar do SettingsNav existente)

```tsx
// ✅ Correto — reaproveita o padrão de "ativo" já validado no projeto
<ListItemButton
  component={AppLink}
  href={fullHref}
  selected={isActive}
  sx={{
    borderRadius: 0,
    "&.Mui-selected": {
      bgcolor: "background.subtle",
      borderRight: 2,
      borderColor: "primary.main",
      "& .MuiListItemText-primary": { color: "primary.main", fontWeight: 600 },
    },
  }}
>
  <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36 }}>
    <CalendarMonthIcon fontSize="small" />
  </ListItemIcon>
  {!collapsed && <ListItemText primary="Meses" />}
</ListItemButton>

// ❌ Anti-padrão — não voltar a navegação só-ícone sem rótulo
<Tooltip title="Meses"><IconButton><CalendarMonthIcon /></IconButton></Tooltip>
```

### Estado recolhido lido no server (sem flash)

```tsx
// src/app/(app)/[accountId]/layout.tsx (Server Component)
import { cookies } from "next/headers";

const collapsed = (await cookies()).get("sidebar_collapsed")?.value === "1";

return (
  <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
    <AppSidebar accountId={accountId} role={member.role} initialCollapsed={collapsed} /* ...props reusados... */ />
    <Box component="main" sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
  </Box>
);
```

### Diálogo de captura rápida — reuso da Action, sem duplicar lógica

```tsx
// ✅ QuickAddTransactionDialog reutiliza a Action + schema existentes
const form = useForm<CreateTransactionInput>({ resolver: zodResolver(createTransactionSchema) });
const onSubmit = form.handleSubmit((values) =>
  startTransition(async () => {
    const result = await createTransactionAction(accountId, values); // Action já existente
    if (!result.ok) { /* setError por campo */ return; }
    enqueueSnackbar("Transação criada", { variant: "success" });
    onClose();
  }),
);

// ❌ Anti-padrão — recriar a lógica de criação/validação dentro do diálogo
```

### Restrições Warm Calm

- Usar apenas componentes do design system (`DialogShell`, `ListItemButton`, `Tooltip`, `Typography variant="overline"`, `MoneyValue`, `NumericFormat`) — sem componentes custom desnecessários.
- Espaçamentos via tokens semânticos (`layout.*`); cores via tokens (`accent.primary`, `background.subtle`, `border.subtle`); nunca hex literais.
- A sidebar DEVE respeitar light e dark mode via tokens.

### 7.1 Inventário de navegação (definitivo)

| Grupo | Item | `href` | Ícone (`@mui/icons-material`) | Papel | Componente reusado |
|---|---|---|---|---|---|
| Principal | Meses | `/${accountId}` (redireciona ao mês mais recente) | `CalendarMonth` | todos | — |
| Principal | Dashboards | `/${accountId}/dashboards` | `BarChart` | todos | — |
| Principal | Patrimônio | `/${accountId}/net-worth` | `AccountBalanceWallet` | todos | — |
| Principal | Planejamento | `/${accountId}/planning` | `Savings` | todos | — (página irmã de Patrimônio; rótulo `m.goals.navLabel`) |
| Principal | Projeção | `/${accountId}/forecast` | `TrendingUp` | todos | — (página irmã de Patrimônio; rótulo `m.cashflowForecast.navLabel`) |
| Gestão | Membros | `/${accountId}/settings/members` | `Group` | **todos** (viewer/editor em leitura; ações de gestão só owner) | — |
| Gestão | Configurações | `/${accountId}/settings/general` | `Settings` | owner/editor | — |
| Topo | Troca de conta | — | `UnfoldMore` | todos | `AccountSwitcher` (modo link simples quando há só 1 conta — preservar) |
| Topo | Meses recentes | — | `CalendarToday` | todos | `MonthsDropdown` (6 recentes; o `take:6` é do layout — §7.6) — comportamento mantido; rótulo textual no modo expandido |
| Rodapé | Notificações | — | `Notifications` | todos | `NotificationBell` — **lista** dentro do menu do usuário; **badge/contagem/polling** no host sempre-montado do avatar (ver NAV-02b) |
| Rodapé | Usuário/tema/logout/notificações | — | avatar | todos | `UserMenuButton` |

- `AppBarNavButtons.tsx` deixa de ser usado após a migração (ver §9). Todos os 6 destinos que ele hospedava hoje têm lar na nova sidebar: Dashboards, Membros, **Planejamento** (`Savings`→`/planning`), Patrimônio, **Projeção** (`TrendingUp`→`/forecast`) e Configurações. Nenhuma rota fica órfã.
- Hoje `viewer` é redirecionado para fora de **todo** `/settings/*` (`settings/layout.tsx`). Como "Membros" passa a ser visível a todos os papéis, é preciso **abrir uma exceção**: `viewer` (e `editor` não-owner) acessam `/${accountId}/settings/members` em **modo leitura** (lista de membros + responsabilidades), sem as ações de gestão (convidar, mudar papel, remover), que continuam owner-only. Os demais destinos de `/settings/*` seguem owner/editor.

### 7.2 Mapa de famílias do sidebar de Configurações

Reorganização dos `editorLinks`/`ownerLinks` de `settings/layout.tsx` (nenhum link novo; apenas agrupados por cabeçalho `overline`):

| Família | Itens (`href`) | Papel |
|---|---|---|
| Estrutura | `sections`, `categories`, `institutions`, `responsibles` | owner/editor |
| Importação | `models`, `templates`, `aliases`, `table-types` | owner/editor |
| Planejamento | `checklist`, `forecast` (config da Projeção) | owner/editor |
| Visualização | `dashboards/monthly`, `dashboards/yearly`, `dashboards/month-summary` (mantém `CollapsibleNavItem`) | owner/editor |
| Integrações | `connectors` | owner/editor |
| Conta | `general` (owner/editor) · `members` (leitura: todos · gestão: owner) · `audit` (owner) | ver célula |

> **Rotas reais** (conferidas em `settings/layout.tsx`): não existe `settings/budgets` — orçamentos/metas moram na página **top-level `/planning`** (grupo Principal). O link de settings `forecast` é a **configuração** da Projeção (horizonte, cenário, saldo inicial), distinto da página `/forecast`. `models` = "Modelos de tabela". Nenhum link novo é criado — apenas reagrupamento por cabeçalho `overline`.
> **Assinatura do `SettingsNav`:** hoje é lista **plana** (um `overline` global "Configurações" + um `Divider`). O agrupamento das 6 famílias exige passar **grupos rotulados** (não `NavEntry[]` plano). O padrão de item-ativo (`bgcolor background.subtle` + `borderRight primary.main` + `fontWeight 600`) já vive no `SettingsNav` e DEVE ser extraído para reuso na `AppSidebar` (§6).


### 7.3 Contrato do Quick-Add (campo → schema → Action)

Alvo: `createTransactionSchema` (`src/lib/schemas/transaction.ts`). Campos obrigatórios do schema: `occurredOn`, `amountCents`, `isPending`, `isFavorite`, `tableId`.

| Campo UI | Chave no `CreateTransactionInput` | Regra |
|---|---|---|
| Descrição | `description` | `string` ≤200, opcional/nullable |
| Valor | `amountCents` | `bigint` — converter com `parseBrlMaskToCents` (`src/lib/money.ts`) |
| Data | `occurredOn` | `Date` — default hoje (`getCurrentYearMonth`/`new Date()`) |
| Tabela-alvo | `tableId` | `cuid` **obrigatório** — resolve mês+seção |
| Categoria | `categoryId` (+ `subcategoryId`) | `cuid` opcional/nullable |
| Responsável | `responsiblePartyId` | `partyIdSchema` opcional/nullable |
| Pendente | `isPending` | `boolean` — do toggle |
| — | `isFavorite` | enviar sempre `false` (não exposto no quick-add) |

Campos avançados (`notes`, `cardInstallment`, `expenseType`, `paymentMethod`, moeda estrangeira, `investmentType`) **não** entram no quick-add — permanecem no editor completo de transação. Ver §5 Fora de Escopo.

> **Nuances do contrato (confirmadas no código):**
> - `listTablesForMoveAction` retorna **3 arrays** (`months`, `sections`, `tables`), não lista rotulada. O diálogo faz o join em memória (`table.monthId → months[].label`, `table.sectionId → sections[].name`) p/ montar `Mês · Seção · Tabela`. `sections` vem filtrado por `isActive:true` — tratar fallback de tabela apontando p/ seção inativa.
> - `createTransactionAction` retorna **só `{ transactionId }`** (sem `monthId`/`sectionId`). O link "Ver transação" DEVE **derivar** mês+seção da tabela selecionada (dados já em mãos via `listTablesForMove`).
> - `isFavorite` e `isPending` são `z.boolean()` **não-opcionais** — os `defaultValues` do RHF DEVEM setar `isFavorite: false` e um default de `isPending`, senão o `zodResolver` falha no submit.
> - `tableId` usa `z.string().cuid()` **estrito**. Tabelas novas usam `@default(cuid())`, mas há ids UUID legados no DB — confirmar que nenhuma tabela-alvo é UUID, senão o submit falha com "ID inválido".


### 7.4 Persistência do estado recolhido (espelhar `saveThemeAction`)

Nova Action em `src/actions/user-settings.ts`, seguindo o padrão exato de `saveThemeAction`/`saveAccentColorAction`:

```tsx
// ✅ Mesmo mecanismo já usado para theme/accent — cookie 1 ano, sameSite strict
export async function saveSidebarCollapsedAction(collapsed: boolean): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("sidebar_collapsed", collapsed ? "1" : "0", {
    path: "/", maxAge: 365 * 24 * 60 * 60, sameSite: "strict", httpOnly: false,
  });
}
```

Leitura no server (`(app)/[accountId]/layout.tsx`): `const collapsed = (await cookies()).get("sidebar_collapsed")?.value === "1";` passado como `initialCollapsed` ao `AppSidebar`. A sincronização com `UserSettings` (coluna nova no Prisma) fica **fora de escopo** — o cookie basta e evita migração de schema.

### 7.5 Constantes de layout nomeadas

```tsx
// AppSidebar.tsx — evitar números mágicos; espelha DRAWER_WIDTH do SettingsNav (220)
export const SIDEBAR_WIDTH = 200;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
// breakpoint: usar theme md (~900px) para alternar entre permanent e Drawer temporário
```

### 7.6 Adaptações dos componentes reaproveitados (o que muda ao portar)

Nenhum é 100% drop-in; ajuste mínimo para caber na sidebar sem reescrever a lógica:

| Componente | Estado hoje | Ajuste ao portar |
|---|---|---|
| `AccountSwitcher` | `Typography variant="h4"` + `flexGrow:1` (estilo de AppBar horizontal) | Reduzir/truncar (ellipsis) o nome para 200px; no rail de 64px exibir só as **iniciais da conta** (ex.: "FK"), como no frame |
| `MonthsDropdown` | Trigger `IconButton` só-ícone + `Tooltip`; renderiza todos os meses da prop | O **`take: 6` é do layout** — o novo `(app)/[accountId]/layout.tsx` DEVE replicá-lo, senão "6 recentes" quebra em silêncio. No modo expandido o trigger DEVE exibir rótulo textual (ex.: "Meses recentes") ao lado do ícone (não deixar só-ícone — NAV-01); no rail recolhido, só-ícone + `Tooltip` |
| `UserMenuButton` | `Menu` 240px, já denso (tema + accent accordion + conta + logout) | Absorve notificações (NAV-02b): badge no avatar (host sempre-montado) + seção-lista expansível. NÃO é reposicionamento |

---

## 8. Critérios de Teste

> Skill: [`e2e-testing`](../skills/e2e-testing/SKILL.md) · [`testing`](../skills/testing/SKILL.md). Seguir os padrões da Spec 58.

**E2E (Playwright, `e2e/`):**
- Sidebar renderiza rótulos textuais de todos os destinos de "Principal" (Meses, Dashboards, Patrimônio, Planejamento, Projeção) e "Gestão" (Membros, Configurações); item da rota atual aparece destacado.
- `/planning` e `/forecast` são acessíveis pela sidebar (paridade com Patrimônio) — nenhum atalho da AppBar antiga fica sem lar.
- Membros: `viewer` vê o item e abre a página em leitura (lista + responsabilidades), sem botões de convidar/mudar papel/remover; `owner` vê as ações de gestão.
- Notificações: badge de não lidas visível no avatar do rodapé (inclusive recolhido); abrir o menu do usuário mostra a seção "Notificações"; **expandir** a seção carrega a lista e zera o badge; abrir o menu para outro fim (tema/logout) NÃO zera o badge. Não há botão "marcar todas como lidas" — a marcação é ao expandir (NAV-02b).
- Quick-add: abrir pela sidebar em uma tela qualquer, preencher e salvar → a transação aparece no mês/seção da tabela escolhida.
- `viewer` (usar `e2e/viewer-readonly.spec.ts` como base): o botão "Nova transação" **não** é renderizado.
- Recolher a sidebar, recarregar a página → permanece recolhida (cookie).
- Viewport mobile (&lt;md): sidebar não ocupa espaço permanente; hambúrguer abre o `Drawer`.

**Unit (Vitest):**
- Parse do cookie `sidebar_collapsed` no layout (`"1"`→true, ausente/`"0"`→false).
- Mapeamento família→itens do settings cobre todos os `editorLinks`/`ownerLinks` reais sem órfãos nem duplicados (inclui `forecast`; **não** inclui `budgets`).
- Filtro de papel: `Membros` visível a **todos** no grupo Gestão, com ações de gestão só para owner; botão quick-add só para owner/editor.

---

## 9. Plano de Migração Incremental

Ordem sugerida para não quebrar o app em nenhum commit:

1. **Criar `AppSidebar.tsx`** reaproveitando `AccountSwitcher`, `MonthsDropdown`, `UserMenuButton` (sem removê-los) e integrando o conteúdo do `NotificationBell` na seção "Notificações" do menu do usuário (badge de não lidas no avatar). Incluir Planejamento (`/planning`) e Projeção (`/forecast`) no grupo Principal, ao lado de Patrimônio. Estado recolhido via prop `initialCollapsed`.
2. **Trocar o shell** em `(app)/[accountId]/layout.tsx`: substituir `AppBar`/`Toolbar` por `<Box display=flex>` com `AppSidebar` + `<main>`. Ler cookie no server.
3. **Adicionar `saveSidebarCollapsedAction`** em `user-settings.ts` e fiar o toggle.
4. **Drawer mobile** + tooltips no estado recolhido.
5. **`QuickAddTransactionDialog.tsx`** reusando `createTransactionAction` + `listTablesForMoveAction`; fiar ao botão da sidebar.
6. **Reagrupar `SettingsNav.tsx`** nas famílias da §7.2 (só reordenar/rotular) e abrir a exceção de leitura de `/settings/members` para `viewer`/`editor` no redirect de `settings/layout.tsx`, mantendo as ações de gestão owner-only.
7. **`grep` por usos de `AppBarNavButtons`** → remover o arquivo se não houver mais referências.
8. Rodar `pnpm typecheck` + `pnpm test` + e2e da §8 a cada passo.

---

## 10. Plano de Implementação Detalhado

> Derivado do §9 por análise pacote-a-pacote contra o código real (arquivos/símbolos/testes/riscos confirmados, não presumidos). Cada pacote fecha em **um commit verde** (typecheck + unit passam; app não quebra). Implementar **um por vez**.

### 10.1 Ordem recomendada (por dependência + risco)

Os dois pacotes independentes e de maior risco vão **primeiro**, para de-riscar cedo num ambiente ainda estável (AppBar interina), antes da troca de shell.

| Onda | Pacote | Por quê nesta posição |
|---|---|---|
| 0 | **P5** — Notificações | 🔴 maior risco; independente; roda sobre a AppBar interina (build verde). Deixa o `UserMenuButton` já mesclado antes de P1 montar o rodapé. |
| 0 | **P7** — Settings + viewer | Independente da sidebar; toca só `/settings/*`. Pode ir em paralelo a P5. |
| 1 | **P1** — AppSidebar | Fundação de P2/P3/P4/P6. Rodapé monta **só** o `UserMenuButton` mesclado (pós-P5). |
| 2 | **P2** — Shell swap | Sobe a sidebar / remove a AppBar. A partir daqui a nav nova está no ar. |
| 3 | **P3** — Persistência · **P4** — Drawer/a11y · **P6** — QuickAdd | Todos dependem de P1; visíveis/testáveis após P2. |
| 4 | **P8** — Limpeza + verificação | Barreira final: remove `AppBarNavButtons`, roda a suíte inteira. |

**Grafo de dependências:**

```
P5 ─┐
P7 ─┤ (independentes)
    └─► P1 ─► P2 ─► { P3, P4, P6 } ─► P8
```

> **Nota de contrato P5↔P1:** o rodapé do `AppSidebar` (P1) monta apenas o `UserMenuButton` (com badge/lista de notificação já embutidos por P5) — **não** o antigo `NotificationBell`. Ao migrar o menu para o rodapé, ajustar `anchorOrigin`/`transformOrigin` para abrir **para cima** (o menu no rodapé não pode abrir para fora da tela).

### 10.2 Resumo dos pacotes

| Pacote | Cobre | Modelo | Esforço | Depende |
|---|---|---|---|---|
| P1 — AppSidebar | NAV-01, NAV-02, NAV-04 | Sonnet | M (~1 dia) | — |
| P2 — Shell swap | NAV-01, NAV-05 | Sonnet | S (~2-3h) | P1 |
| P3 — Persistência | NAV-05 | Sonnet | S (~1-2h) | P1 |
| P4 — Drawer/a11y | NAV-05, NAV-02b | Sonnet | M (~½ dia) | P1 |
| P5 — Notificações | NAV-02b | Sonnet | M (~½ dia) | — |
| P6 — QuickAdd | NAV-03 | Sonnet | M (~1 dia) | P1 |
| P7 — Settings/viewer | NAV-04 | Sonnet | M (~½ dia) | — |
| P8 — Cleanup/verify | todos | Sonnet | M (~½ dia) | P1–P7 |

### 10.3 Detalhe por pacote

#### P1 — AppSidebar `feat(nav): adiciona AppSidebar com grupos Principal/Gestão e helper de item ativo`
- **new** `src/components/ui/nav-active.ts` — extrai o padrão de item-ativo do `SettingsNav`: `isNavItemActive(pathname, href, {exact?})` + `activeNavItemSx` (bgcolor `background.subtle` / borderRight 2 `primary.main` / fontWeight 600 + `.Mui-selected .MuiListItemIcon-root` color `primary.main` p/ o rail). Não editar `SettingsNav` aqui (adoção fica em P7, evita conflito).
- **new** `src/components/ui/AppSidebar.tsx` — `'use client'`; exporta `SIDEBAR_WIDTH=200`/`SIDEBAR_COLLAPSED_WIDTH=64`. Props: `accountId`, `role: AccountMemberRole`, `initialCollapsed`, `currentAccountName`, `otherAccounts`, `recentMonths`, `userName/userImage`, `initialUnreadCount`. Ordem §7.1: AccountSwitcher → botão Nova transação (só `owner/editor`) → MonthsDropdown → grupo Principal (Meses/Dashboards/Patrimônio/Planejamento/Projeção) → grupo Gestão (Membros[todos]/Configurações[owner-editor]) → spacer → rodapé (UserMenuButton mesclado). Ativo: Meses = base exato **ou** prefixo `/months`; Configurações = prefixo `/settings` **e não** `/settings/members`. Ponto de montagem do QuickAdd fica **comentado** (não importar — compila sem P6).
- **edit** `AccountSwitcher.tsx` (+`collapsed?`), `MonthsDropdown.tsx` (+`showLabel?`) — **prop-gated** (prop ausente = render legado; AppBar interina intocada). Expandido: nome truncado (`subtitle1`, ellipsis); rail: iniciais da conta + Tooltip.
- **edit** `pt-BR.ts` — novo namespace `nav` (labels de grupo + aria); reusar `m.goals.navLabel`/`m.cashflowForecast.navLabel`/`m.transactions.newTransaction` (zero string hardcoded).
- **Testes:** unit `nav-active` (exact vs prefixo; casos Meses/Configurações/Membros), render por papel (viewer sem botão; Membros p/ todos), collapsed vs expanded. **Risco-chave:** só validável in-app após P2 → cobrir por unit isolado; caber 5+2 itens no rail sem scroll (List dense + spacer).

#### P2 — Shell swap `refactor(nav): troca AppBar por shell de AppSidebar e lê cookie no server`
- **edit** `src/app/(app)/[accountId]/layout.tsx` — remover `AppBar`/`Toolbar` + os 5 imports que migram p/ o AppSidebar; capturar `member` (hoje descartado) p/ passar `role`; **manter `take:6`** na query de meses; ler `parseSidebarCollapsed((await cookies()).get(...))`. JSX vira `<Box flex><AppSidebar .../><Box component=main sx={{ flex:1, minWidth:0 }}>{children}</Box></Box>` (`minWidth:0` obrigatório — evita overflow de tabelas/charts).
- **new** `src/lib/sidebar-preference.ts` (+`.test.ts`) — `SIDEBAR_COLLAPSED_COOKIE` + `parseSidebarCollapsed(v)=== '1'` (helper puro testável; reusado por P3).
- **Testes:** unit do parse (`"1"`→true; ausente/`"0"`/outro→false). e2e: AppBar some, sidebar presente, sem overflow horizontal, cookie=1 → rail no 1º paint (sem flash).

#### P3 — Persistência `feat(sidebar): persiste estado recolhido em cookie (NAV-05)`
- **edit** `src/actions/user-settings.ts` — `saveSidebarCollapsedAction(collapsed)` espelhando o cookie de `saveThemeAction` (path/maxAge 1 ano/sameSite strict/httpOnly false); **sem** `auth()`/DB (fora de escopo).
- **edit** `AppSidebar.tsx` — handler de toggle: estado otimista → `document.cookie` imediato (paridade `ThemeProviderClient`) → action fire-and-forget.
- **new** `user-settings.test.ts` — mock `next/headers`; assere shape do cookie p/ `true`/`false`. **Risco:** persistência sem-flash só fecha com P2 lendo o cookie → gate do e2e de reload em P2.

#### P4 — Drawer/a11y `feat(nav): drawer mobile, rail recolhido e a11y/motion (NAV-05)`
- **edit** `AppSidebar.tsx` — extrair `SidebarContent({collapsed,onNavigate,onToggleCollapse})` compartilhado por Drawer e coluna (padrão `NavItems` do SettingsNav). Abaixo de `md`: hambúrguer + `Drawer variant="temporary"` (keepMounted, `xs:block md:none`); permanente `md+`. Transição **só** de `width` no container + guarda `prefers-reduced-motion:reduce → transition:none` (comentar que animar width é exigência de NAV-05, contra a regra geral). Toggle: `aria-label` + `aria-expanded`; itens recolhidos: `Tooltip` + `aria-label`. Rodapé recolhido: avatar+badge sem nome.
- **edit** `layout.tsx` (`flexDirection: {xs:column, md:row}`), `pt-BR.ts` (aria strings). **new** `AppSidebar.test.tsx` + `e2e/sidebar.spec.ts` (viewport, toggle, reducedMotion — o que é CSS-media não roda em jsdom).

#### P5 — Notificações 🔴 `refactor(ui): notificações no host do avatar + lista em Accordion no menu`
- **new** `src/components/ui/NotificationsMenuSection.tsx` — a **lista** dentro do Menu num `Accordion` (mesmo padrão do accordion de accent já provado no menu), scroll próprio (~320px). Marcação dispara **só** no `onChange`-expand (`listAndMarkAllReadAction`). Clique: `onCloseMenu()` **antes** do `router.push('/{accountId}/months/{link}')` (link É o monthId, **sem** `?tab`). Porta ícone-por-tipo/ponto/tempo relativo/estados vazio+loading.
- **edit** `src/components/ui/UserMenuButton.tsx` — **host sempre-montado**: props opcionais `accountId?`/`initialUnreadCount?` (guard `if(!accountId)` p/ os layouts sem conta). Traz `POLL_INTERVAL_MS`/foco-debounce; `refreshCount` **corrigido** → lê `json.data.unreadCount`. `<Badge>` no avatar. Monta `<NotificationsMenuSection>` no topo do Menu.
- **edit** `layout.tsx` (interino) — remove `NotificationBell`, alimenta `UserMenuButton` com `accountId`/`unreadCount`. **delete** `NotificationBell.tsx` (grep confirmou uso só nesse layout).
- **new** `NotificationsMenuSection.test.tsx` + `UserMenuButton.test.tsx` (**teste de regressão do bug**: fetch `{ok,data:{unreadCount:7}}` + avançar timer → badge=7). **edit** `e2e/fixtures/seed.ts` (hoje **zero** notificações — semear ≥1 não-lida com link + ≥1 sem link). **new** `e2e/notifications-menu.spec.ts`.
- **Riscos-chave:** fronteira host↔menu (contagem/polling fora do Menu que desmonta); deletar `NotificationBell` só com o layout já editado; `UserMenuButton` reusado em layouts sem `accountId` (guard).

#### P6 — QuickAdd `feat: QuickAddTransactionDialog para captura rápida (NAV-03)`
- **new** `QuickAddTransactionDialog.tsx` — `DialogShell` + RHF. `defaultValues` **DEVEM** ter `isFavorite:false`+`isPending:false`+`occurredOn:hoje`+`tableId:""` (z.boolean/coerce não-opcionais). Ao abrir: `Promise.all([listTablesForMoveAction, listQuickAddOptionsAction])`. Tabela-alvo: **join em memória** dos 3 arrays → rótulo `Mês · Seção · Tabela` (fallback seção inativa). Snackbar "Ver transação": **derivar** `monthId`+`sectionId` da tabela escolhida (Action só retorna `{transactionId}`). Pré-seleção via `usePathname/useSearchParams`. `<EmptyState>` quando 0 tabelas. **Não** usar `useOptions()` (lança fora do provider) — categoria criável via `createCategoryAction` + estado local (padrão `BudgetFormDialog`).
- **edit** `transactions.ts` (+`listQuickAddOptionsAction`), `transaction-service.ts` (+`listQuickAddOptions` → `{categories,parties}`, multi-tenant), `pt-BR.ts` (`transactions.quickAdd.*`). **new** `quick-add-helpers.ts` (`buildTableOptions`/`buildTransactionLink` puros p/ unit).
- **Nota de escopo:** Categoria/Responsável **não têm fonte client existente** → o pacote adiciona uma action/service (além de "só o componente"). Valor: seguir a convenção do codebase (`NumericFormat.onValueChange → reaisToCents`), não `parseBrlMaskToCents` — mesmo resultado em centavos. `tableId` cuid estrito: confirmar que nenhuma tabela-alvo é UUID legado antes de confiar.

#### P7 — Settings/viewer `feat(settings): 6 famílias por overline + /settings/members em leitura p/ viewer`
- **new** `src/components/settings/settings-nav-groups.ts` — módulo **puro**: tipos + `buildSettingsNavGroups(role): NavGroup[]` (fonte única do mapa §7.2 + gating). owner=6 famílias c/ audit; editor=6 sem audit; viewer=**só** {Conta:[members]}.
- **edit** `SettingsNav.tsx` — assinatura plana → `groups: NavGroup[]`; remove overline global + divider; itera grupos com overline por família.
- **edit** `settings/layout.tsx` — usa `buildSettingsNavGroups(member.role)`; **carve-out do viewer** (ver §10.5).
- **edit** `pt-BR.ts` (`settings.nav.groups.*` + `dashboardsLabel`). **Testes:** unit de completude (achatado owner == união real dos 17 links; sem `budgets`; com `forecast`/`members`/`audit`; viewer = 1 grupo/1 link). e2e viewer lê members mas é barrado em general/connectors.

#### P8 — Cleanup/verify `chore(nav): remove AppBarNavButtons e valida suíte (spec 65)`
- **delete** `AppBarNavButtons.tsx` — só após `grep -rn AppBarNavButtons src` = 0 refs de código (P2 removeu as de `layout.tsx`; ocorrências em specs são prose). **edit condicional** `e2e/forecast.spec.ts`/`dashboards.spec.ts` (links `Projeção`/`Dashboards` agora resolvem via AppSidebar; ajustar só se a suíte acusar).
- **Verificação:** `pnpm typecheck` + `pnpm test` + e2e §8 (nunca `docker compose down -v` — limpar só o volume e2e, CLAUDE.md §8). Barreira: se e2e por nome de link falhar, corrigir rótulo/aria-label no AppSidebar (P1/P4), **não** relaxar o teste.

### 10.4 Cross-cutting

- **Mensagens** (`pt-BR.ts`): novo namespace `nav` (P1/P4) + `transactions.quickAdd.*` (P6) + `settings.nav.groups.*`/`dashboardsLabel` (P7). Zero string de UI hardcoded (CLAUDE.md §5.10).
- **Seed e2e**: `e2e/fixtures/seed.ts` não tem notificações — P5 semeia (senão os e2e de badge/lista/navegação não têm dados).
- **Reidratar Prisma**: nenhum pacote mexe no schema (cookie no lugar de coluna — §7.4), então sem `migrate`. Se algum dia sincronizar preferência no DB, aí sim reiniciar o app após `migrate` (CLAUDE.md §8).

### 10.5 Decisão pendente (resolver ao chegar em P7)

**Mecanismo do carve-out do viewer em `/settings/members`:**
- **Opção 2 (recomendada):** remover o redirect global de `settings/layout.tsx:44` e adicionar guard `if (role==='viewer') redirect` nas 3 páginas de conteúdo hoje sem guard próprio (`connectors`, `models`, `templates`); `members` fica sem guard → viewer entra em leitura (gestão já é owner-gated em `MembersTable`/`InviteForm`). Cada página se auto-protege (convenção de 11/16 páginas), sem depender de header.
- **Opção 1:** manter o redirect no layout, lendo o path via header `x-pathname` setado no `middleware.ts` e carveando só `members`. Toca infra global compartilhada.

> Impacta **quais arquivos** P7 toca. Default do plano: **Opção 2**. Confirmar antes de implementar P7.
> Resposta: **Opção 2**
