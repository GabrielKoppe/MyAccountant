# Spec 21 — Melhorias de Navegação e Arquitetura de Informação

> Status: draft
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

- **UX-05**: Transformar o rótulo de mês/ano no `MonthHeader` em um elemento clicável que abre um popover/dropdown com todos os meses agrupados por ano, permitindo navegação direta.
- **UX-07**: Adicionar uma barra de progresso linear no topo do app (estilo GitHub/YouTube) acionada durante navegações RSC.
- **UX-11**: Exportar `generateMetadata` em cada page.tsx com um título dinâmico descritivo.
- **IA 8.1**: Adicionar no AppBar um item "Meses" com dropdown que lista os 6 meses mais recentes + link "Ver todos".
- **IA 8.2**: Refatorar o layout de configurações para ter um sidebar vertical à esquerda com todos os links de configuração, e o conteúdo no painel principal à direita.
- **IA 8.3**: Diferenciar claramente os propósitos da página do mês e do dashboard mensal. A **página do mês** deve ser focada em operação (navegar pelas seções, ver e editar transações). O **dashboard mensal** deve ser o espaço analítico (gráficos, drill-down, comparativos). O resumo da página do mês pode manter os totais por seção e as listas de pendentes/favoritas (informação operacional), mas os gráficos analíticos (pizza de categorias, barras comparativas) pertencem ao dashboard.

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
- QUANDO o usuário clica no rótulo de mês/ano no cabeçalho, UM POPOVER DEVE abrir exibindo todos os meses disponíveis agrupados por ano (mais recente primeiro).
- QUANDO o usuário clica em um mês no popover, O SISTEMA DEVE navegar para aquele mês e fechar o popover.
- O popover DEVE ser acessível por teclado (setas para navegar, Enter para selecionar, Esc para fechar).

**UX-07 — Indicador de loading:**
- QUANDO uma navegação entre páginas é iniciada, UMA BARRA DE PROGRESSO DEVE aparecer no topo do app.
- QUANDO a navegação completa, A BARRA DEVE desaparecer suavemente.

**UX-11 — Título dinâmico:**
- A página de um mês DEVE ter título no formato: `[Nome do Mês] [Ano] | [Nome da Account] | MyAccountant` (ex: "Janeiro 2026 | Família Silva | MyAccountant").
- As páginas de configurações DEVEM ter título no formato: `[Nome da seção] — Configurações | MyAccountant`.
- A página de dashboard DEVE ter título descritivo incluindo o contexto (mensal/anual).

**IA 8.1 — Meses no AppBar:**
- O AppBar DEVE ter um item de navegação "Meses" (ícone + label ou dropdown).
- AO CLICAR, UM DROPDOWN DEVE mostrar os 6 meses mais recentes com seus rótulos (ex: "Jan 2026") e um link "Todos os meses" no rodapé.
- QUANDO o usuário clica em um mês no dropdown, O SISTEMA DEVE navegar para aquele mês.

**IA 8.2 — Layout de configurações:**
- As páginas em `/settings/*` DEVEM ter um sidebar persistente à esquerda com links para: Geral, Seções, Categorias, Instituições, Modelos de coluna, Modelos de tabela, Templates CSV, Análises, Membros.
- O item de menu ativo DEVE ser visualmente destacado.
- Em telas menores (mobile), o sidebar DEVE colapsar em um menu hambúrguer ou dropdown no topo.

**IA 8.3 — Separação operacional/analítica:**
- A aba "Resumo" da página do mês DEVE manter: total do mês, totais por seção (cards clicáveis), lista de transações pendentes e lista de favoritas.
- Os gráficos analíticos atualmente no resumo do mês (pizza de categorias, barras por seção com drill-down) DEVEM ser movidos ou duplicados para o dashboard mensal, e removidos da página do mês.
- O dashboard mensal DEVE ter um link de acesso rápido "Ver mês atual" que navega de volta para a página operacional do mês.
- A distinção entre as duas páginas DEVE ser comunicada visualmente: a página do mês tem tom operacional (tabelas, ações), o dashboard tem tom analítico (gráficos, insights).

---

## 5. Fora de Escopo

- Busca global cross-feature (buscar transações por nome em todos os meses) — spec separada.
- Redesign completo do AppBar — as mudanças são aditivas.
- Página dedicada "Todos os meses" com visualização em calendário — pode ser adicionada em iteração futura.
- Persistência do mês atual em cookie/sessão entre acessos.
- Redesign visual profundo dos dashboards (apenas reposicionamento de conteúdo existente entre páginas).

---

## 6. Referências Técnicas

| Item | Arquivo(s) a tocar |
|------|-------------------|
| UX-05 | `src/components/months/MonthHeader.tsx` |
| UX-07 | `src/app/layout.tsx` ou `src/app/(app)/layout.tsx` — adicionar componente de progress bar |
| UX-11 | Todos os `page.tsx` relevantes — exportar `generateMetadata` |
| IA 8.1 | `src/app/(app)/[accountId]/layout.tsx` |
| IA 8.2 | `src/app/(app)/[accountId]/settings/layout.tsx` |
| IA 8.3 | `src/components/months/MonthSummary.tsx` (remover `CategoryPieChart` e `MonthSectionBarChart`), `src/app/(app)/[accountId]/dashboards/monthly/[monthId]/page.tsx` (receber os componentes migrados) |

- Biblioteca sugerida para progress bar: `nprogress` ou implementação própria com MUI `LinearProgress`.
- O seletor de mês de UX-05 pode usar MUI `Popover` + lista simples, sem biblioteca de date picker.
- `generateMetadata` é nativo do Next.js App Router — sem dependências adicionais.
