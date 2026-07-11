# Spec 19 — Busca, Filtro e Ordenação de Transações

> Status: implemented (drawer, ordenação, busca por tabela, chips, URL params, totais filtrados em tabela e seção — entregue em conjunto com spec 41)
> Insumo: docs/v2-analysis.md §3 UX-01, §6 F-05, ajuste do usuário sobre UX-04
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md)

---

## 1. Problema

Hoje não existe nenhuma forma de buscar ou filtrar transações dentro de uma tabela financeira. Para encontrar uma transação específica, o usuário precisa rolar visualmente toda a lista. Também não é possível ordenar as transações por nenhum critério além da data de inserção. Com tabelas que acumulam dezenas ou centenas de registros ao longo do mês, isso se torna inviável no uso cotidiano.

O usuário explicitamente não quer paginação — a lista deve permanecer contínua e rolável. A solução é filtrar e ordenar os itens já carregados no cliente, sem queries adicionais ao banco.

---

## 2. Solução

### 2.1 Visão geral

Há dois níveis de controle, com escopos distintos:

| Controle | Escopo | Persistência |
|---|---|---|
| Filtros categóricos (ver conjunto-alvo abaixo) | Página inteira (todas as tabelas do mês) | URL via `searchParams` |
| Busca textual por descrição | Por tabela financeira individual | Efêmero (estado local) |
| Ordenação por coluna | Por tabela financeira individual | Efêmero (estado local) |

> **Atualização V2 (paridade de filtros).** O conjunto de campos filtráveis foi nivelado entre as
> três superfícies de filtro (drawer do mês, widget `filtered-transactions`, widget `analysis`).
> **Conjunto-alvo (9 campos)**: `categorias, instituições, responsável, pendentes, favoritas,
> tipo de transação (expenseType), origem (source), tags, método de pagamento (paymentMethod)`.
> A fonte única desses campos (valores de enum + contrato) vive em
> `src/lib/transaction-filters/fields.ts` (`TRANSACTION_FILTER_FIELDS` + arrays de enum). Um teste
> de paridade (`src/lib/transaction-filters/parity.test.ts`) quebra a compilação se um campo novo
> não for mapeado nas três superfícies — é o mecanismo que impede a assimetria histórica de voltar.

### 2.2 Filtros globais (por página)

Um botão **"Filtros"** é adicionado no cabeçalho da página do mês, ao lado das ações existentes. Ao clicar, abre um **drawer lateral** com:

- Multi-select de categorias
- Multi-select de instituições
- Multi-select de responsáveis
- Multi-select de tags
- Accordions de enum (seleção múltipla): tipo de transação, origem, **método de pagamento**
- Chips toggle para "Pendentes" e "Favoritas" (ativáveis simultaneamente)
- Botão "Limpar tudo" no rodapé do drawer

Quando há filtros ativos, o botão exibe um badge com o contador. Abaixo do botão aparecem **chips removíveis** representando cada filtro ativo (um chip por valor selecionado). Um chip "Limpar tudo ×" aparece junto aos chips ativos.

Os filtros categóricos são aditivos entre si (AND): categoria E instituição E responsável, todos aplicados simultaneamente. Dentro do mesmo campo, a seleção múltipla funciona como OR (categoria "Alimentação" OU "Transporte").

### 2.3 Busca por descrição (por tabela)

Cada `TransactionTable` exibe um **ícone de lupa** no cabeçalho. Ao clicar, um input de busca inline se expande. A busca filtra as linhas da tabela em tempo real (case-insensitive), sem afetar outras tabelas. O estado não vai para a URL — ao recarregar a página, a busca é perdida intencionalmente.

### 2.4 Ordenação (por tabela)

Colunas ordenáveis: `occurredOn`, `amountCents`, `description`, `categoryId` (exibe nome), `institutionId` (exibe nome). O cabeçalho de cada coluna ordenável é clicável:

- 1º clique: ordem crescente
- 2º clique: ordem decrescente
- 3º clique: volta ao padrão (`occurredOn` descendente — mais recente primeiro)

A ordenação é por tabela e efêmera (não vai para a URL).

### 2.5 Totais quando filtros estão ativos

**Total da tabela financeira**: quando filtros globais estão ativos, o valor do total muda para `warning.main` (mostarda) e aparece uma caption discreta abaixo — "X de Y transações" — sem alterar o tamanho ou layout do componente.

**Total da seção**: o valor real permanece sempre visível. Quando filtros globais estão ativos, exibe ao lado o valor filtrado + percentual (ex: "R$ 8.420,00 · filtrado R$ 1.240,00 · 14,7%"), permitindo comparação entre total real e total filtrado.

---

## 3. User Stories

- Como usuário, quero clicar no ícone de lupa de uma tabela e digitar parte de uma descrição para encontrar rapidamente uma transação específica naquela tabela.
- Como usuário, quero abrir o drawer de filtros e selecionar múltiplas categorias, instituições ou responsáveis para analisar um subconjunto específico em todas as tabelas do mês.
- Como usuário, quero filtrar por status (pendentes / favoritas), para revisar os itens que ainda precisam de atenção.
- Como usuário, quero ordenar as transações de uma tabela clicando no cabeçalho de uma coluna (data, valor, descrição, categoria, instituição), para comparar itens facilmente.
- Como usuário, quero que meus filtros globais fiquem na URL, para que ao recarregar a página a visualização seja mantida.
- Como usuário, quero ver o total filtrado ao lado do total real, para entender rapidamente a proporção que os itens filtrados representam.

---

## 4. Critérios de Aceitação

- QUANDO o usuário clica no ícone de lupa de uma tabela e digita texto, O SISTEMA DEVE filtrar as linhas daquela tabela em tempo real, ocultando transações cuja descrição não contenha o texto (comparação case-insensitive). As demais tabelas não são afetadas.
- QUANDO o usuário seleciona categorias no drawer, APENAS as transações dessas categorias (OR entre selecionadas) DEVEM ser exibidas em todas as tabelas.
- QUANDO o usuário seleciona múltiplos valores em campos diferentes (ex: categoria + instituição), O SISTEMA DEVE aplicar os filtros de forma aditiva/AND entre campos e OR dentro do mesmo campo.
- QUANDO o usuário ativa o chip "Pendentes", APENAS transações com `isPending = true` DEVEM ser exibidas.
- QUANDO o usuário ativa o chip "Favoritas", APENAS transações com `isFavorite = true` DEVEM ser exibidas.
- "Pendentes" e "Favoritas" PODEM ser ativados simultaneamente — o sistema exibe transações que satisfaçam ambas as condições.
- QUANDO o usuário clica no cabeçalho de uma coluna ordenável, AS TRANSAÇÕES DAQUELA TABELA DEVEM ser reordenadas (1º clique: crescente; 2º clique: decrescente; 3º clique: volta a `occurredOn` descendente).
- QUANDO há filtros globais ativos, OS PARÂMETROS DEVEM estar refletidos na URL. Busca textual e ordenação NÃO vão para a URL.
- QUANDO o usuário clica em "Limpar tudo" (drawer ou chip), TODOS os filtros globais DEVEM ser removidos e a lista volta ao estado padrão. Busca textual e ordenação são independentes e não são afetadas.
- QUANDO filtros globais estão ativos, O BOTÃO "Filtros" DEVE exibir um badge com o número de filtros ativos e chips removíveis devem aparecer abaixo do botão.
- SE nenhuma transação de uma tabela corresponder aos filtros ativos, O SISTEMA DEVE exibir dentro daquela tabela uma ilustração + mensagem "Nenhuma transação encontrada para os filtros ativos." + botão "Limpar filtros".
- ENQUANTO filtros globais estão ativos, O TOTAL DA TABELA DEVE mudar para `warning.main` com caption "X de Y transações" abaixo, sem alterar o layout do componente.
- ENQUANTO filtros globais estão ativos, O TOTAL DA SEÇÃO DEVE exibir o valor real e ao lado o valor filtrado com percentual (ex: "filtrado R$ 1.240,00 · 14,7%").

---

## 5. Fora de Escopo

- Busca global cross-month (buscar em todos os meses) — planejada para spec futura (F-02).
- Filtros server-side com queries ao banco **para o drawer do mês**. O drawer filtra **client-side**
  (predicado `applyGlobalFilters` sobre as linhas já carregadas) — decisão consciente. **Assimetria de
  execução deliberada**: os widgets `filtered-transactions` e `analysis` filtram os MESMOS 9 campos, mas
  **server-side** (`where` Prisma), porque operam sobre queries próprias. Os dois caminhos compartilham só
  os valores/contrato de `fields.ts`, não o builder — não unificar até a spec 56 (paginação) decidir o
  futuro do carregamento do mês (que pode colapsar o predicado client-side em `where`).
- Paginação — o usuário não quer paginação, a lista deve permanecer rolável.
- Salvar combinações de filtros como "visualizações" nomeadas.
- Filtro por valor (range de amount) — pode ser adicionado em iteração futura desta spec.
- Ordenação de seções e tabelas dentro das configurações — essa funcionalidade existe e mantém o comportamento atual (botões ▲▼).
- Busca textual refletida na URL — é efêmera por design (escopo por tabela tornaria a URL ilegível).
- Ordenação refletida na URL — é efêmera por design (mesma razão).

---

## 6. Decisões de Design (registradas no refinamento)

| Decisão | Escolha |
|---|---|
| Escopo dos filtros categóricos | Página inteira (todas as tabelas do mês) |
| Escopo da busca textual | Por tabela, efêmera |
| Escopo da ordenação | Por tabela, efêmera |
| UI dos filtros globais | Drawer lateral (botão no cabeçalho da página) |
| Seleção nos filtros categóricos | Multi-select (OR dentro do campo, AND entre campos) |
| UI de "Pendentes" / "Favoritas" | Chips toggle dentro do drawer (combináveis) |
| Feedback de filtros ativos | Badge no botão + chips removíveis abaixo |
| "Limpar tudo" | No drawer (rodapé) e na área de chips ativos |
| Ordenação padrão | `occurredOn` descendente (mais recente primeiro) |
| Estado vazio | Ilustração + mensagem + botão "Limpar filtros" inline |
| Total da tabela filtrado | `warning.main` + caption "X de Y" (sem mudar layout) |
| Total da seção com filtro ativo | Valor real sempre visível + filtrado + percentual ao lado |
| **Conjunto-alvo de filtros (V2)** | 9 campos nivelados nas 3 superfícies; fonte única em `fields.ts` |
| **Semântica canônica de "responsável" (V2 / A1)** | `responsiblePartyId` (todas as kinds de persona: personal/group/external), igual nas 3 superfícies. Widgets resolvem via `responsiblePartyIdsForFilter` (partyId + fallback legado userId→party pessoal). Aposenta a ponte `personalPartyIdsForUsers` nos 3 surfaces-alvo. |
| **Filtro de relação que resolve para vazio (V2)** | Degrada para "sem filtro" (mostra tudo), consistente com todos os filtros de relação quando o id selecionado some (ex.: party/categoria removida). Não é 0-resultados. |
| **Escopo A1** | Apenas os 3 surfaces-alvo. `kpi-custom` e `budgets` seguem na semântica legada (userId via `personalPartyIdsForUsers`) — consistentes internamente, fora do conjunto-alvo. |

---

## 7. Referências Técnicas

| Componente | Arquivo(s) a tocar |
|------------|-------------------|
| Botão + drawer de filtros globais (novo) | `src/components/transactions/TransactionFilterDrawer.tsx` (novo) |
| Chips de filtros ativos (novo) | `src/components/transactions/ActiveFilterChips.tsx` (novo) |
| Busca por tabela + ordenação (novo) | lógica em `src/components/transactions/TransactionTable.tsx` |
| Cabeçalho da página do mês | `src/app/(app)/[accountId]/months/[monthId]/page.tsx` — adicionar botão Filtros + `searchParams` |
| Total da tabela filtrado | componente de total dentro de `TransactionTable.tsx` |
| Total da seção filtrado | componente de total na seção |

- `isFavorite`, `responsiblePartyId` (responsável — **não** mais `responsibleUserId`, removido na Spec 60 Fase 5), `expenseType`, `source`, `paymentMethod` e a relação `tags` já existem no schema do Prisma.
- Colunas ordenáveis: `occurredOn`, `amountCents`, `description`, `categoryId` (exibe nome), `institutionId` (exibe nome).
- A filtragem e ordenação do **drawer** são puramente client-side sobre o array `rows` em `MonthFilterContext.applyGlobalFilters` (os widgets fazem `where` Prisma — ver §5).
- Fonte única dos campos filtráveis: `src/lib/transaction-filters/fields.ts`. Resolver canônico de "responsável": `responsiblePartyIdsForFilter` em `src/server/queries/responsible-party-filter.ts`.
- Skill de forms/zod não se aplica ao drawer (sem mutação, apenas estado local de UI); aplica-se aos forms de config dos widgets.
- Filtros globais persistidos em URL como `searchParams`: `categories`, `institutions`, `responsible`, `pending`, `favorite`, `expenseTypes`, `sources`, `tags`, `paymentMethods`.
