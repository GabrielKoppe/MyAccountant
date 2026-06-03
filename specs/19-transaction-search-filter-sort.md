# Spec 19 — Busca, Filtro e Ordenação de Transações

> Status: draft
> Insumo: docs/v2-analysis.md §3 UX-01, §6 F-05, ajuste do usuário sobre UX-04
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md)

---

## 1. Problema

Hoje não existe nenhuma forma de buscar ou filtrar transações dentro de uma tabela financeira. Para encontrar uma transação específica, o usuário precisa rolar visualmente toda a lista. Também não é possível ordenar as transações por nenhum critério além da data de inserção. Com tabelas que acumulam dezenas ou centenas de registros ao longo do mês, isso se torna inviável no uso cotidiano.

O usuário explicitamente não quer paginação — a lista deve permanecer contínua e rolável. A solução é filtrar e ordenar os itens já carregados no cliente, sem queries adicionais ao banco.

---

## 2. Solução

Adicionar uma barra de controles acima da `TransactionTable` com:
- Campo de busca textual (filtra pela descrição)
- Filtros colapsáveis por campos categóricos
- Ordenação por clique no cabeçalho das colunas

O estado de busca, filtros e ordenação deve ser preservado na URL (via `searchParams`) para que o usuário possa compartilhar ou recarregar a página com o mesmo estado.

Toda a lógica de filtragem e ordenação acontece no cliente (sobre os dados já carregados), sem nenhuma nova chamada ao servidor.

---

## 3. User Stories

- Como usuário, quero digitar parte de uma descrição e ver apenas as transações correspondentes, para encontrar rapidamente o que procuro.
- Como usuário, quero filtrar transações por categoria, instituição ou responsável, para analisar um subconjunto específico.
- Como usuário, quero filtrar por status (pendentes / favoritas), para revisar os itens que ainda precisam de atenção.
- Como usuário, quero ordenar as transações clicando no cabeçalho de uma coluna (data, valor, descrição, categoria, instituição), para comparar itens facilmente.
- Como usuário, quero que meus filtros fiquem na URL, para que ao recarregar a página a visualização seja mantida.

---

## 4. Critérios de Aceitação

- QUANDO o usuário digita texto na barra de busca, O SISTEMA DEVE filtrar as linhas exibidas em tempo real, ocultando transações cuja descrição não contenha o texto (comparação case-insensitive).
- QUANDO o usuário seleciona um filtro de categoria, APENAS as transações dessa categoria DEVEM ser exibidas.
- QUANDO o usuário seleciona um filtro de instituição ou responsável, O SISTEMA DEVE aplicar o filtro de forma aditiva (e não substitutiva) em relação a outros filtros ativos.
- QUANDO o usuário ativa o filtro "Pendentes", APENAS transações com `isPending = true` DEVEM ser exibidas.
- QUANDO o usuário ativa o filtro "Favoritas", APENAS transações com `isFavorite = true` DEVEM ser exibidas.
- QUANDO o usuário clica no cabeçalho de uma coluna ordenável, AS TRANSAÇÕES DEVEM ser reordenadas por aquele campo (primeiro clique: crescente; segundo clique: decrescente; terceiro clique: volta ao padrão).
- QUANDO há filtros ou ordenação ativos, OS PARÂMETROS DEVEM estar refletidos na URL.
- QUANDO o usuário clica em "Limpar filtros", TODOS os filtros e ordenação DEVEM ser removidos e a lista volta ao estado padrão.
- SE nenhuma transação corresponder aos filtros ativos, O SISTEMA DEVE exibir uma mensagem de estado vazio indicando que nenhum resultado foi encontrado com os filtros atuais.
- ENQUANTO filtros estão ativos, O TOTAL DA TABELA exibido no card DEVE corresponder às transações visíveis (filtradas), não ao total real — com indicação visual de que a visualização está filtrada.

---

## 5. Fora de Escopo

- Busca global cross-month (buscar em todos os meses) — planejada para spec futura (F-02).
- Filtros server-side com queries ao banco.
- Paginação — o usuário não quer paginação, a lista deve permanecer rolável.
- Salvar combinações de filtros como "visualizações" nomeadas.
- Filtro por valor (range de amount) — pode ser adicionado em iteração futura desta spec.
- Ordenação de seções e tabelas dentro das configurações — essa funcionalidade existe e mantém o comportamento atual (botões ▲▼).

---

## 6. Referências Técnicas

| Componente | Arquivo(s) a tocar |
|------------|-------------------|
| Barra de filtros (novo componente) | `src/components/transactions/TransactionFilters.tsx` (novo) |
| Tabela de transações | `src/components/transactions/TransactionTable.tsx` |
| Estado dos filtros | hook local no componente ou contexto; estado espelhado em URL |
| Parâmetros de URL | `src/app/(app)/[accountId]/months/[monthId]/page.tsx` — `searchParams` |

- Colunas ordenáveis: `occurredOn`, `amountCents`, `description`, `categoryId` (exibe nome), `institutionId` (exibe nome).
- A filtragem e ordenação são puramente client-side sobre o array `rows` em `TransactionTable`.
- Skill de forms/zod não se aplica aqui (sem mutação, apenas estado local de UI).
