# Spec 21 — Melhorias de Navegação e Arquitetura de Informação

> Status: implemented (MonthPickerNav, next-nprogress-bar, generateMetadata dinâmico, settings sidebar, AccountSwitcher — 2026-07-11)
> Insumo: docs/v2-analysis.md §3 UX-05, UX-07, UX-11, §8 IA 8.1, IA 8.2, IA 8.3
> Skills: [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md)

---

## 1. Problema

Cinco problemas de navegação e organização da informação que dificultam o uso do app no dia a dia:

- **UX-05**: Navegar entre meses exige N cliques nos botões anterior/próximo. Com 2+ anos de dados (24 meses), ir direto para março de 2025 sem navegar cronologicamente é impossível.
- **UX-07**: Ao navegar entre meses (que dispara um recarregamento RSC completo), não há indicador visual de que algo está carregando. O usuário não tem feedback e pode clicar múltiplas vezes.
- **UX-11**: O título da aba do browser é sempre "MyAccountant", sem identificar o mês ou seção atual. Impossibilita múltiplas abas para contextos diferentes.
- **IA 8.1**: O AppBar só tem ícones de Dashboards, Membros e Configurações. Não há acesso direto a meses anteriores nem a uma lista de todos os meses.
- **IA 8.2**: As configurações da account são divididas em 6+ sub-páginas independentes sem um menu lateral consolidado. O usuário precisa conhecer a URL de cada seção ou navegar por breadcrumbs.
- **IA 8.3**: A página do mês e o dashboard mensal têm propósitos sobrepostos. Ambos exibem gráficos de barras por seção, pizza de categorias e lista de transações em destaque. O usuário não tem clareza sobre quando usar cada um, e a página do mês acumula responsabilidades operacionais (entrada de dados) e analíticas (gráficos) ao mesmo tempo.

---

## 2. Solução

- **UX-05**: Transformar o rótulo de mês/ano no `MonthHeader` em um elemento clicável (cursor pointer no hover) que abre um popover com todos os meses agrupados por ano em acordeão colapsável. O ano do mês atualmente em visualização vem expandido por padrão. O mês atual aparece destacado como selecionado. Apenas meses com registro no banco são listados.
- **UX-07**: Adicionar a biblioteca `next-nprogress-bar` ao app, customizada com a cor `accent.primary` do tema, acionada durante navegações RSC.
- **UX-11**: Exportar `generateMetadata` em cada page.tsx com título dinâmico seguindo o padrão `[Localização] — [Especificidade] | [Nome da Account] | MyAccountant`. A página do mês é exceção: usa apenas `[Nome do Mês] [Ano] | [Nome da Account] | MyAccountant` (sem prefixo de localização).
- **IA 8.1**: Adicionar no AppBar um item "Meses" com ícone `CalendarToday` na primeira posição (antes de Dashboards), com dropdown que lista os 6 meses mais recentes com registro no banco.
- **IA 8.2**: Refatorar o layout de configurações para ter um sidebar vertical à esquerda com todos os links de configuração, e o conteúdo no painel principal à direita. Em mobile, o sidebar colapsa em um Drawer acessado por ícone hambúrguer.
- **IA 8.3**: Diferenciar claramente os propósitos da página de resumo do mês e do dashboard mensal. A **página do mês** deve ser uma central de operação — entrada de dados, revisão e navegação rápida. O **dashboard mensal** é o espaço analítico exclusivo (gráficos, drill-down, comparativos). Os gráficos analíticos (pizza de categorias, barras por seção) são **removidos** da página do mês e ficam apenas no dashboard. A página do mês ganha: total do mês em destaque no cabeçalho, KPIs de receitas/despesas/saldo, cards de seções com variação vs mês anterior, alerta de completude, e três listas operacionais (pendentes, favoritas, últimas adicionadas). Um link "Ver Dashboard" no cabeçalho conecta as duas páginas.

---

## 3. User Stories

- Como usuário, quero navegar diretamente para qualquer mês sem clicar múltiplas vezes nas setas, para economizar tempo ao revisar dados históricos.
- Como usuário, quero ver um indicador visual quando a página está carregando após uma navegação, para saber que o sistema respondeu ao meu clique.
- Como usuário com múltiplas abas abertas, quero que o título de cada aba identifique o mês e seção que estou visualizando.
- Como usuário, quero acessar meses recentes diretamente do menu principal sem precisar estar na página de um mês.
- Como usuário, quero navegar pelas configurações da conta usando um menu lateral persistente, sem precisar memorizar URLs.
- Como usuário, quero entender imediatamente ao abrir a página do mês se ela serve para lançar dados ou para analisar — sem precisar descobrir a diferença explorando o app.

---

## 4. Critérios de Aceitação

**UX-05 — Seletor de mês:**
- QUANDO o usuário passa o mouse sobre o rótulo de mês/ano no cabeçalho, O CURSOR DEVE mudar para `pointer` (sem ícone adicional permanente).
- QUANDO o usuário clica no rótulo de mês/ano no cabeçalho, UM POPOVER DEVE abrir exibindo todos os meses com registro no banco, agrupados por ano em acordeão colapsável (mais recente primeiro).
- O ano do mês atualmente em visualização DEVE estar expandido ao abrir o popover. O mês atual DEVE aparecer visualmente destacado como selecionado.
- QUANDO o usuário clica em um mês no popover, O SISTEMA DEVE navegar para aquele mês e fechar o popover.
- O popover DEVE ser acessível por teclado (setas para navegar, Enter para selecionar, Esc para fechar).

**UX-07 — Indicador de loading:**
- QUANDO uma navegação entre páginas é iniciada, UMA BARRA DE PROGRESSO DEVE aparecer no topo do app, com cor `accent.primary` do tema.
- QUANDO a navegação completa, A BARRA DEVE desaparecer suavemente.
- Implementação via biblioteca `next-nprogress-bar`.

**UX-11 — Título dinâmico:**
- O padrão geral de título é: `[Localização] — [Especificidade] | [Nome da Account] | MyAccountant`.
- A página de um mês DEVE usar o formato simplificado: `[Nome do Mês] [Ano] | [Nome da Account] | MyAccountant` (ex: "Janeiro 2026 | Família Silva | MyAccountant").
- As páginas de configurações DEVEM ter título no formato: `Configurações — [Nome da seção] | [Nome da Account] | MyAccountant` (ex: "Configurações — Geral | Família Silva | MyAccountant").
- Os dashboards DEVEM ter título no formato: `Dashboard [Tipo] — [Especificidade] | [Nome da Account] | MyAccountant` (ex: "Dashboard Mensal — Janeiro 2026 | Família Silva | MyAccountant").

**IA 8.1 — Meses no AppBar:**
- O AppBar DEVE ter um item de navegação "Meses" com ícone `CalendarToday` na primeira posição (ordem: Meses → Dashboards → Membros → Configurações).
- AO CLICAR, UM DROPDOWN DEVE mostrar os 6 meses mais recentes com registro no banco, ordenados do mais recente para o mais antigo.
- QUANDO o usuário clica em um mês no dropdown, O SISTEMA DEVE navegar para aquele mês.
- O link "Todos os meses" está fora do escopo desta spec (aguarda página dedicada futura).

**IA 8.2 — Layout de configurações:**
- As páginas em `/settings/*` DEVEM ter um sidebar persistente à esquerda com links para: Geral, Seções, Categorias, Instituições, Modelos de coluna, Modelos de tabela, Templates CSV, Análises.
- O item de menu ativo DEVE ser visualmente destacado.
- Em telas menores (mobile), o sidebar DEVE colapsar em um Drawer acessado por ícone hambúrguer no topo.
- "Membros" não entra no sidebar de configurações (já possui entrada no AppBar principal).

**IA 8.3 — Separação operacional/analítica:**

Layout do Resumo do Mês (de cima para baixo):

**Cabeçalho (PageHeader):**
- Título com o nome do mês/ano.
- Total do mês em `MoneyValue` em destaque ao lado do título (fonte maior, JetBrains Mono).
- Ações: botão "Importar CSV" (outlined) + "Nova Transação" (contained).
- Link discreto "Ver Dashboard →" (text button) que navega para o dashboard mensal do mês atual.

**Seção 1 — KPIs (sem título de seção):**
- 3 `KpiCard` em grid horizontal: Receitas do mês, Despesas do mês, Saldo do mês.
- Cada card exibe delta percentual vs mês anterior (`intent: "negative-is-good"` para despesas).

**Seção 2 — Seções:**
- Grid de cards clicáveis, um por seção da account: nome da seção + total + variação % vs mês anterior.
- Clicar em um card navega diretamente para aquela seção no mês.
- Se houver seções sem nenhuma transação no mês: exibir `Alert severity="info"` abaixo do grid ("N seções sem transações este mês"). O alerta é condicional — não aparece quando todas as seções têm dados.

**Seção 3 — Atividade (3 colunas):**
- **Pendentes**: lista de transações pendentes de revisão, com contagem em badge no título da coluna e botão "Resolver agora" que navega filtrando a lista.
- **Favoritas**: lista de transações marcadas como favoritas no mês.
- **Últimas adicionadas**: últimas 5–8 transações criadas/modificadas, com acesso rápido a edição inline.

**Restrições de design (Warm Calm):**
- Gráficos analíticos (pizza de categorias, barras por seção com drill-down) são **removidos** da página do mês e existem **apenas no dashboard mensal**.
- Usar `KpiCard`, `Section`, `Alert`, `MoneyValue`, `StatusBadge` do design system — sem componentes customizados desnecessários.
- Densidade média: sem excesso de informação por card, espaçamentos via tokens semânticos (`layout.section`, `layout.cluster`).

**Dashboard mensal:**
- DEVE receber os gráficos analíticos removidos do resumo: `CategoryPieChart` e `MonthSectionBarChart`.
- DEVE ter um link de acesso rápido "Ver mês" que navega para a página operacional do mês sendo visualizado (link contextual, não para o mês corrente do calendário).

---

## 5. Fora de Escopo

- Busca global cross-feature (buscar transações por nome em todos os meses) — spec separada.
- Redesign completo do AppBar — as mudanças são aditivas.
- Página dedicada "Todos os meses" com visualização em calendário — pode ser adicionada em iteração futura. O link "Todos os meses" no dropdown do AppBar é omitido até essa página existir.
- Persistência do mês atual em cookie/sessão entre acessos.
- Redesign visual profundo dos dashboards (apenas reposicionamento de conteúdo existente entre páginas).

---

## 6. Referências Técnicas

| Item | Arquivo(s) a tocar |
|------|-------------------|
| UX-05 | `src/components/months/MonthHeader.tsx` |
| UX-07 | `src/app/layout.tsx` ou `src/app/(app)/layout.tsx` — adicionar `next-nprogress-bar` |
| UX-11 | Todos os `page.tsx` relevantes — exportar `generateMetadata` |
| IA 8.1 | `src/app/(app)/[accountId]/layout.tsx` |
| IA 8.2 | `src/app/(app)/[accountId]/settings/layout.tsx` |
| IA 8.3 | `src/components/months/MonthSummary.tsx` (remover `CategoryPieChart` e `MonthSectionBarChart`; adicionar KpiCards, grid de seções, Alert de completude, 3 listas operacionais), `src/app/(app)/[accountId]/dashboards/monthly/[monthId]/page.tsx` (receber `CategoryPieChart` e `MonthSectionBarChart` migrados + link "Ver mês") |

- Biblioteca de progress bar: `next-nprogress-bar` — customizar com `color={theme.palette.accent?.primary}` ou equivalente do token semântico.
- O seletor de mês de UX-05 usa MUI `Popover` + `Accordion` por ano, com `List` de meses dentro de cada painel. Sem biblioteca de date picker.
- `generateMetadata` é nativo do Next.js App Router — sem dependências adicionais. Pode acessar o banco via Prisma para buscar nome da account/mês.
