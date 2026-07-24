# Spec 66 — Reestruturação da Linha de Transação (leitura, edição e detalhe)

> Status: draft
> Insumo: catálogo de interações "Transação — Modelos de Interação" (protótipo/blueprint aprovado) + revisão de UX da linha atual. Modelo de linha escolhido: **A (colunas explícitas)** como padrão + **layout rico/pílulas (B) opcional, por tipo de tabela**; modal de detalhe na direção **1b (abas), somente leitura**.
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md) · [`react-best-practices`](../skills/react-best-practices/SKILL.md)

---

## 1. Problema

A transação é o principal ativo da aplicação e um objeto muito rico (~25 campos + tags, vínculos, parcelas e moeda estrangeira). Hoje a linha (`src/components/transactions/TransactionRow.tsx`) só exibe o subconjunto que o `TableType.hiddenColumns` libera, e o restante vive espremido em superfícies desalinhadas entre si. Quatro problemas concretos:

- **TX-01**: O `TransactionDetailDialog.tsx` apresenta ~15 pares label/valor numa **lista plana** dentro de um diálogo `sm`, misturando o essencial (valor, categoria) com metadados de histórico e vínculos. Sem hierarquia: tudo tem o mesmo peso visual, a leitura é longa e o dado importante não salta.
- **TX-02**: O painel do grupo de parcelas (`InstallmentGroupPanel`, aberto pelo badge de parcela na linha) **não segue o padrão visual de painel lateral** usado no resto do app — parece um componente de outra origem. O `InstallmentGroup` real (parcelamento com vínculo entre transações) é o conceito vigente; o campo `cardInstallment` (texto livre "3/12") **existe no schema mas não está em uso** — não é preenchido nem exibido em nenhuma coluna hoje.
- **TX-03**: Leitura e edição não compartilham o mesmo padrão de gaveta. A barra de gaveta (`RowDrawerToolbar`: nota, moeda, vínculos, tags) aparece tanto no modo edição quanto na visualização — mas na visualização **cada item só aparece se a transação tiver aquele dado preenchido** (uma transação sem nota não mostra a seção de nota). Falta padronizar os mesmos ícones/rótulos/ordem entre a gaveta de leitura, a de edição e o modal de detalhe, para o usuário reconhecer as mesmas seções nas três superfícies.
- **TX-04**: Campos ricos (tags, responsável, moeda estrangeira, parcela) ficam **fora da linha** quando o tipo de tabela oculta aquela coluna — o que é uma decisão **legítima e intencional** do usuário (densidade por tipo de tabela). O problema não é ocultar; é que esses campos **não têm uma superfície canônica garantida** onde sempre possam ser vistos, minando a confiança de que "nada se perdeu". Hoje essa garantia é frouxa e espalhada entre superfícies desalinhadas. (Solução: o modal de detalhe read-only vira o "ver tudo" canônico — TX-01c — sem poluir a linha com indicadores.)

> **Nota de escopo:** esta spec NÃO altera o modelo de dados da transação nem o mecanismo `hiddenColumns` por `TableType`, que **permanece o único controle de densidade** (o usuário configura, em Configurações → Tipos de tabela, quais colunas/dados cada tipo mostra, criando tipos diferentes para modelos de transação diferentes). Preserva 100% dos campos existentes e apenas reorganiza como são **exibidos, editados e detalhados**. A criação global de transação foi tratada na **Spec 65** (captura rápida) — aqui tratamos a linha dentro da tabela.

> **Frames = blueprint, não pixel-perfect.** O protótipo (`docs/frames/Spec 66 …`) é a **ideia de organização** das telas/componentes, não o recorte final. Regra inegociável: **nenhuma funcionalidade atual é removida** — o que o desenho simplifica deve ser **adaptado** ao novo modelo, nunca suprimido. A **única** exceção (drop intencional) é o campo legado `cardInstallment`, hoje sem uso (TX-02b). Utilitários, sub-features do editor, ações em massa e edições existentes seguem preservados, ainda que o frame não os desenhe.

---

## 2. Solução

Unificar as superfícies da transação em torno de três padrões coerentes: uma **linha com densidade controlável**, um **modal de detalhe hierárquico em abas** e um **painel de parcelas alinhado ao padrão lateral do app** — sem perder nenhum campo.

### 2.1 Linha com superfície completa e densidade controlada pelo tipo de tabela (TX-04)

- **TX-04a**: A densidade da linha continua **controlada pelo tipo de tabela** (`hiddenColumns`), configurado pelo usuário em Configurações → Tipos de tabela. Esta spec não introduz preferência global de densidade nem cookie — o controle é por tipo, como já funciona.
- **TX-04b**: A **organização visual da linha** (layout A = colunas explícitas × layout B = descrição rica com metadados em pílulas) é uma **propriedade do tipo de tabela**, escolhida no mesmo lugar onde hoje se configura o `hiddenColumns`. Assim o usuário decide, por tipo, tanto *quais* dados aparecem quanto *como* a linha os arranja. Requer **um campo novo em `TableType`** (ex.: `rowLayout: "columns" | "rich"`, default `"columns"`) — a única alteração de schema desta spec (ver §5). O layout **A (colunas) é o default e é uma adição, não substituição**: ele mantém **todos** os utilitários da tabela hoje existentes (ordenação por coluna, busca por descrição, seleção, etc.). O layout **B (rich/pílulas) é uma visualização adicional opt-in**: por ser orientado a descrição + pílulas, utilitários atrelados a colunas (ex.: ordenação por coluna) podem não se aplicar **dentro dele** — é uma **nova forma de ver**, escolhida pelo usuário, e não a remoção de nenhum utilitário do layout A.
- **TX-04c**: Ocultar uma coluna/pílula pelo tipo de tabela é uma decisão **intencional** do usuário — o dado não está "escondido", é **irrelevante para aquela seleção de dados**. Portanto **não** há indicador na linha sinalizando campos ocultos (nada de `more_horiz` ocupando espaço). Nenhuma informação se perde: o **modal de detalhe** (TX-01, somente leitura) é a superfície canônica onde **todo** campo do objeto continua visível, inclusive os que o tipo de tabela não mostra na linha.
- **TX-04d**: Independente do `rowLayout` do tipo de tabela (config **compartilhada** da Account), em viewports estreitos a linha DEVE degradar de forma legível, **nesta ordem de prioridade**: (1) **compactação** — a apresentação degrada para o formato `rich`/pílulas (mais compacto), como fallback **somente de renderização**, sem alterar a configuração compartilhada do `TableType`; (2) **rolagem horizontal** contida em `overflow-x: auto` **apenas como último recurso**, quando mesmo compactada a linha fica inviável — e o corpo da página nunca rola na horizontal. Nenhuma coluna preenchida fica inacessível em tela estreita.

### 2.2 Modal de detalhe hierárquico em abas — direção 1b (TX-01)

- **TX-01a**: Redesenhar `TransactionDetailDialog` com um **cabeçalho de destaque** fixo em que o **valor é o apex** — `MoneyValue` em escala grande (ex.: `h4`, JetBrains Mono, cor por sinal) —, seguido de **descrição** (`subtitle1`), **data** (`body2`) e **status**. A ordem de peso visual DEVE ser valor > descrição > data, antes de qualquer aba. **Favorita** e **Pendente** usam `<StatusBadge>` (Pendente→`warning`, Favorita→`neutral`) — **nunca** `<Chip>` para status. O **badge de parcela**, quando interativo, tem afordância clicável distinta (ao ser acionado seleciona a aba "Parcelas e vínculos") e não compartilha o visual dos status passivos.
- **TX-01b**: O corpo passa a ter **4 abas**: **Resumo** (categoria, instituição, responsável, moeda, **nota em leitura**), **Classificação** (tipo de gasto, forma de pagamento, tipo de investimento, tags), **Parcelas e vínculos** (cronograma do grupo + vínculos/`links[]` entre transações, na mesma aba) e **Histórico** (origem, criado por/em, editado por/em). O Histórico sai do meio da leitura essencial.
- **TX-01c**: O modal é a **superfície canônica de "ver tudo"** e reúne inclusive os campos que a linha oculta por `hiddenColumns` — garantindo que todo campo do objeto tenha um lar visível (resolve o vínculo com TX-04c). O modal é **somente leitura**: não edita campos in-place. A edição parcial que existia hoje no modal (tags e vínculos) é **descontinuada** em favor de um único caminho de edição (a linha inline, via botão "Editar" — TX-03c). A descontinuação atinge **apenas** adicionar/remover vínculos; a **navegação** para a transação vinculada (ação "abrir" na aba "Parcelas e vínculos") é **preservada para todos os papéis, inclusive `viewer`** — é navegação, não edição.
- **TX-01d**: O modal DEVE tratar estados por aba/subseção: enquanto carrega dados assíncronos (vínculos, cronograma) exibe indicador de carregamento; em falha exibe mensagem de erro com opção de recarregar; abas/subseções sem dado exibem `<EmptyState size="compact">` — nunca uma aba em branco. As quatro abas permanecem sempre presentes (a aba "Parcelas e vínculos" sem grupo nem links mostra `EmptyState`, não é ocultada).

### 2.3 Painel de parcelas unificado (TX-02)

- **TX-02a**: Redesenhar o `InstallmentGroupPanel` para seguir **o mesmo padrão de painel lateral** já adotado na navegação (Spec 65) e nas gavetas — cabeçalho com resumo do grupo (total, nº de parcelas, progresso), lista de parcelas com estado (paga / atual / prevista) e **três** ações no rodapé, com hierarquia definida e **apenas uma** `contained`: **"Lançar próxima"** (primária/accent, `contained`) reformula o *convert* por-item atual (`convertPendingInstallmentForExistingMonthAction`) num atalho para a próxima parcela pendente; **"Quitar antecipado"** (secundária, `outlined`, reusa `SettleInstallmentDialog`) é **preservada do rodapé atual**; **"Desfazer grupo"** (destrutiva, cor de perigo + ícone, **visualmente separada** por bloco/divisor) é **nova** neste redesenho (requer Server Action + confirmação). A capacidade de lançar uma parcela `waiting` específica que já tem mês (hoje o chip por-item "Criar neste mês" no cronograma) DEVE ser **preservada por item**; "Lançar próxima" é atalho **aditivo**, não a substitui. Nenhuma ação atual é removida.
- **TX-02b**: O `InstallmentGroup` real é o único conceito de parcela usado, e é o que abre o painel pelo badge de parcela na linha. A aba "Parcelas e vínculos" do modal (TX-01b) e o painel lateral compartilham o **mesmo componente de cronograma** (uma fonte de verdade visual). O campo `cardInstallment` (texto livre, hoje sem uso) **não é reintroduzido na UI** por esta spec — se no futuro voltar a ser usado, entra como legenda simples, mas não faz parte deste escopo.

### 2.4 Coerência leitura ↔ edição (TX-03)

- **TX-03a**: Manter a **edição inline** (`TransactionRowEditor`) como o caminho de edição rápida, mas alinhá-la visualmente à linha de leitura (mesmas colunas, mesma ordem) para que a transição leitura→edição não troque o modelo mental. **Todas as sub-features atuais do editor são preservadas** (alinhamento é só visual): `CreatableEntitySelect` (criar categoria/subcategoria/instituição on-the-fly, digitando), toggle de **tipo de gasto** (`expenseType`: fixed/variable/one_time), moeda estrangeira em **modo simples e avançado** (câmbio manual × valor original + câmbio calculado — impl. explicitada, não removida) e a **sugestão de apelido dentro do editor** (o ✨ aplica a `editValues` com desfazer, sem persistir). Também são preservados os **utilitários da tabela** no layout A: ordenação por coluna, busca por descrição no cabeçalho, auto-edição da linha recém-criada (`autoEdit`), o **agrupamento por data** (separadores de dia) e o `aria-label` de estado da linha. As **afordâncias rápidas na linha de leitura** também permanecem, sem entrar em edição: **toggle de Pendente** (marcar pago/pendente) e **toggle de Favorito** (★) direto na linha, o ✨ de apelido em leitura (aplica e **persiste** com desfazer) e o quick-edit de tags por popover — critérios em §4.
- **TX-03b**: Padronizar a barra de gaveta (`RowDrawerToolbar`: nota, moeda estrangeira, vínculos, tags, criar apelido) com os mesmos ícones/rótulos/ordem nas superfícies onde ela aparece: gaveta de leitura e gaveta de edição (o modal em abas é somente leitura — TX-01c). Comportamento por superfície: na **edição**, todos os itens ficam disponíveis (o usuário pode adicionar nota/moeda/etc.); na **leitura**, cada item da gaveta só é renderizado se a transação já tiver aquele dado preenchido (nota vazia → sem seção de nota) — como já ocorre hoje, agora com visual consistente. O **acesso à gaveta de leitura na linha** passa a ser um **chevron** (expand/collapse), exibido quando a transação tem conteúdo de gaveta (nota/moeda/vínculos/tags) — substitui o indicador `📎N` com contador atual, preservando a abertura da gaveta.
- **TX-03c**: Do modal de detalhe (somente leitura), o botão **"Editar"** leva à edição inline da linha correspondente (não a um segundo formulário divergente), fechando o loop entre as duas superfícies. O botão "Editar" só aparece para `owner`/`editor`; `viewer` abre o modal em leitura sem "Editar".

### 2.5 Seleção em massa consolidada (BULK — paridade + simplificação)

Hoje a `BulkActionBar` (`src/components/transactions/BulkActionBar.tsx`) espalha muitos controles avulsos na barra: marcar/desmarcar pendente, favoritar, tipo de gasto, forma de pagamento, categoria (definir/remover), adicionar tag, remover tag, mover, deletar e cancelar — funcional, porém poluído. A reestruturação **consolida sem perder capacidade** (o dono aprovou explicitamente a versão enxuta do frame §4):

- **BULK-01**: Os **setters de campo** passam a viver em um único diálogo **"Editar em massa"**: **categoria** (definir/remover), **tipo de gasto**, **forma de pagamento** e **favoritar**. O usuário escolhe o campo e o valor e a mudança aplica à seleção inteira — **mesma semântica** dos antigos controles avulsos (reusa `bulkUpdateAction`), num só lugar, economizando espaço e reduzindo carga visual. É exatamente o que o dono descreveu: editar a categoria no diálogo faz o mesmo que o antigo `setCategory`, só que centralizado.
- **BULK-02**: As ações que não são setters de campo permanecem como **botões diretos** na barra: **Marcar pago/pendente** (toggle nos dois sentidos — `isPending`), **Mover** (`MoveTransactionsDialog`), **Tags** (com **adicionar e remover** — `bulkAddTagAction`/`bulkRemoveTagAction`, ambas preservadas), **Excluir** (`bulkDeleteAction`, com confirmação quando a seleção é grande) e **cancelar seleção** (`onClear`).
- **BULK-03**: **Nenhuma** ação em massa existente é removida — apenas reorganizada entre o diálogo "Editar em massa" (setters) e os botões diretos (operações). Todas as Server Actions de bulk atuais são reutilizadas.

---

## 3. User Stories

- Como usuário, quero abrir o detalhe de uma transação e ver primeiro o valor, a descrição e o status, para entender a transação num relance sem ler uma lista longa.
- Como usuário, quero que os detalhes estejam agrupados por assunto (resumo, classificação, parcelas, histórico), para achar o que procuro sem rolar por tudo.
- Como usuário de cartão, quero ver o cronograma de parcelas num painel com o mesmo visual do resto do app, para não sentir que caí em outra tela.
- Como usuário em tela estreita, quero que a linha **compacte primeiro** (categoria, responsável e tags como etiquetas) e só role lateralmente em último caso, para não perder informação por falta de colunas — independentemente do layout configurado no tipo de tabela.
- Como usuário, quero saber que uma transação tem dados além dos exibidos na linha, para abrir o detalhe com confiança de que nada se perdeu.
- Como usuário, quero que editar uma transação use as mesmas seções que vejo ao lê-la, para não reaprender um segundo formulário.
- Como viewer, quero abrir o detalhe em modo leitura sem ações de edição, respeitando meu papel.
- Como usuário, quero aplicar mudanças a várias transações de uma vez por uma barra enxuta (um diálogo "Editar em massa" para campos, botões diretos para mover/tags/excluir), para agir em lote sem uma barra poluída — sem perder nenhuma das ações em massa que já tenho.

---

## 4. Critérios de Aceitação

**TX-01 — Modal de detalhe em abas:**
- QUANDO o usuário abre o detalhe de uma transação, O MODAL DEVE exibir um cabeçalho fixo em que o **valor** (`MoneyValue`) é o maior elemento tipográfico, seguido de descrição, data e **status via `<StatusBadge>`** (Favorita→`neutral`/Pendente→`warning`) + badge de parcela — antes de qualquer campo de detalhe. NÃO usar `<Chip>` para status.
- O CORPO DO MODAL DEVE organizar os campos em quatro abas: "Resumo", "Classificação", "Parcelas e vínculos" e "Histórico".
- O MODAL DEVE exibir **todos** os campos da transação, inclusive os que a linha oculta por `hiddenColumns` (nenhum campo do objeto fica sem superfície). A ABA "Resumo" DEVE exibir a nota (`notes`) em bloco somente leitura quando preenchida.
- A ABA "Parcelas e vínculos" DEVE permitir **navegar** para a transação vinculada a partir de cada item de `links[]` (ação "abrir", leitura) — preservada do modal atual e disponível para `viewer`.
- QUANDO uma aba ou subseção não tem dado (ex.: sem grupo nem `links[]`, ou sem tags), ELA DEVE renderizar `<EmptyState size="compact">`; enquanto carrega dados assíncronos exibe carregamento; em falha exibe erro com recarregar. As quatro abas permanecem sempre presentes.
- O MODAL DEVE ser **somente leitura** para todos os papéis (sem edição de campos in-place, inclusive tags e vínculos; a navegação de vínculos é preservada). Para `owner`/`editor`, DEVE exibir o botão "Editar" que leva à edição inline (TX-03c); ENQUANTO o papel for `viewer`, o botão "Editar" NÃO DEVE ser renderizado.

**TX-02 — Painel de parcelas unificado:**
- QUANDO o usuário clica no badge de parcela de uma linha que pertence a um `InstallmentGroup`, UM PAINEL LATERAL DEVE abrir seguindo o padrão de painel do app (cabeçalho com total/nº/progresso, lista de parcelas com estado, ações no rodapé).
- O RODAPÉ do painel DEVE oferecer as três ações com hierarquia definida e **apenas uma** `contained`: "Lançar próxima" (primária/accent), "Quitar antecipado" (`SettleInstallmentDialog`, `outlined` — **preservada** do rodapé atual) e "Desfazer grupo" (destrutiva, **visualmente separada**). "Desfazer grupo" é ação **nova** (requer Server Action + confirmação). Nenhuma ação do painel atual pode ser removida.
- O CRONOGRAMA DEVE manter a conversão **por parcela** ("Criar neste mês") para qualquer parcela `waiting` com mês existente; "Lançar próxima" no rodapé é atalho **aditivo** para a próxima pendente, não a substitui.
- TODOS os valores monetários do painel (total, entrada, valor pago) e do `<InstallmentSchedule>` (valor de cada parcela) DEVEM ser renderizados com `MoneyValue` (JetBrains Mono, cor por sinal).
- O CRONOGRAMA de parcelas exibido no painel lateral e na aba "Parcelas e vínculos" do modal DEVE ser renderizado pelo mesmo componente.
- O `InstallmentGroup` real DEVE ser o único conceito de parcela na UI; o campo `cardInstallment` (texto, sem uso hoje) NÃO DEVE ser reintroduzido por esta spec.
- SE a transação não pertence a nenhum `InstallmentGroup`, O BADGE que abre o painel NÃO DEVE ser renderizado.

**TX-03 — Coerência leitura ↔ edição:**
- QUANDO o usuário entra em edição inline, OS CAMPOS EDITÁVEIS DEVEM manter a mesma ordem e alinhamento das colunas da linha de leitura.
- A EDIÇÃO INLINE DEVE preservar todas as sub-features atuais do editor: `CreatableEntitySelect` (criar entidade on-the-fly), toggle de tipo de gasto, moeda estrangeira em modo **simples e avançado**, e a sugestão de apelido dentro do editor (✨). Nenhuma delas pode ser removida.
- OS UTILITÁRIOS da tabela (ordenação por coluna, busca por descrição, auto-edição da linha nova, **agrupamento por data**, `aria-label` de estado) DEVEM ser preservados no layout de colunas (A).
- A BARRA DE GAVETA (nota, moeda, vínculos, tags, criar apelido) DEVE usar os mesmos ícones, rótulos e ordem nas duas superfícies em que aparece: gaveta de leitura e gaveta de edição (o modal é somente leitura — TX-01c).
- ENQUANTO em modo leitura, CADA ITEM da gaveta DEVE ser renderizado apenas se a transação tiver aquele dado preenchido; em modo edição, TODOS os itens ficam disponíveis.
- QUANDO o usuário aciona "Editar" no modal de detalhe, O SISTEMA DEVE levar à edição inline da transação (não a um formulário divergente).
- QUANDO "Editar" é acionado no modal, O FOCO DEVE mover para o primeiro campo do editor inline (descrição), não ficar perdido no `body`; AO fechar o painel de parcelas, o foco DEVE retornar ao badge que o abriu.
- A LINHA DE LEITURA DEVE preservar as afordâncias rápidas atuais, sem entrar em edição: **toggle de Pendente** (marcar pago/pendente) e **toggle de Favorito** (★) direto na linha.
- QUANDO a descrição de uma transação casa com um apelido, A LINHA DE LEITURA DEVE exibir o ✨ que abre o popover de sugestão; "Aplicar" **persiste** e oferece desfazer, sem entrar em edição. O ✨ do **editor** aplica a `editValues` sem persistir. Ambos são preservados.
- CLICAR na célula de tags em modo leitura DEVE manter o popover de tags (quick-edit), sem entrar no editor.
- O MENU ⋮ da linha (owner/editor) DEVE preservar seus itens atuais — Editar, Duplicar, Mover para…, Ver detalhes, Criar apelido e Excluir; o `viewer` DEVE ver apenas "Ver detalhes", e o clique na linha abre o modal de detalhe (gesto canônico de "ver tudo").
- TODO gatilho por ícone DEVE ter `aria-label`; o **chevron** da gaveta DEVE expor `aria-expanded` refletindo aberto/fechado.

**TX-04 — Densidade (por tipo de tabela) e superfície de campos:**
- A DENSIDADE E O LAYOUT **configurados** da linha DEVEM ser determinados pelo **tipo de tabela** (`hiddenColumns` + `rowLayout`), pelo usuário em Configurações → Tipos de tabela — não por preferência global. A **configuração** não depende do viewport; apenas a **renderização** pode degradar em tela estreita (TX-04d), sem alterar a configuração compartilhada.
- O TIPO DE TABELA DEVE oferecer a escolha entre layout "colunas" (A) e "rico/pílulas" (B); o default DEVE ser "colunas". O layout "rico" (B) é uma visualização **adicional opt-in**; o layout "colunas" (A, default) DEVE preservar todos os utilitários da tabela (ordenação, busca, seleção).
- QUANDO um campo preenchido é ocultado pelo tipo de tabela, ELE NÃO PRECISA de pista na linha — ocultar é intenção do usuário, e o campo permanece acessível no modal de detalhe (somente leitura), que exibe **todos** os campos. NÃO DEVE haver indicador `more_horiz` de "campos ocultos" na linha.
- O MECANISMO `hiddenColumns`/`TableType` DEVE permanecer a fonte de verdade sobre **quais** dados aparecem e **como** a linha os arranja, por tipo de tabela.
- EM viewports estreitos, NENHUMA coluna preenchida pode ficar inacessível e o corpo da página NÃO DEVE rolar na horizontal. A degradação segue a ordem: (1) **compactar** — degradar a apresentação para `rich`/pílulas (fallback só de renderização, sem mudar o `rowLayout` compartilhado); (2) **rolagem horizontal** contida em `overflow-x: auto` **apenas como último recurso**, quando mesmo compactada a linha fica inviável.

**BULK — Seleção em massa (consolidada, sem perda):**
- QUANDO ≥1 transação está selecionada, UMA BARRA DE AÇÕES DEVE aparecer com: "Editar em massa", "Marcar pago/pendente", "Mover", "Tags", "Excluir" e um controle de cancelar seleção.
- O DIÁLOGO "Editar em massa" DEVE permitir definir, para a seleção inteira: categoria (definir/remover), tipo de gasto, forma de pagamento e favoritar — cobrindo os antigos controles avulsos sem perdê-los (mesma semântica de `bulkUpdateAction`).
- A AÇÃO de tags em massa DEVE oferecer **adicionar e remover** (ambas preservadas).
- NENHUMA ação de bulk existente pode ser removida; apenas realocada entre o diálogo "Editar em massa" e os botões diretos.

---

## 5. Fora de Escopo

- **Alteração do modelo de dados da transação** (Prisma `Transaction`) — nenhum campo novo, renomeado ou removido no objeto transação. A **única** alteração de schema desta spec é adicionar `rowLayout` ao `TableType` (TX-04b).
- **Substituição do mecanismo `hiddenColumns` / tipos de tabela** — permanece a fonte de verdade sobre densidade e layout por tipo; esta spec apenas o **estende** com `rowLayout`, sem migrar os tipos existentes (default `"columns"` reproduz o comportamento atual).
- **Reintrodução do `cardInstallment`** na UI — fora de escopo; o campo segue sem uso.
- **Criação global / captura rápida de transação** — entregue na Spec 65; aqui a criação inline dentro da tabela permanece como está (apenas alinhamento visual com a leitura).
- **Lógica de parcelamento** (como o `InstallmentGroup` é gerado, cálculo de valores) — tratada nas Specs 41/61; esta spec só redesenha a **visualização** do grupo.
- **Regras de sugestão de apelido** (matching, criação) — o popover de apelido é reaproveitado como está; nenhuma mudança na lógica de alias (Spec de aliases vigente).
- **Redesign de dashboards, KPIs ou telas fora da tabela de transações.**
- **Tema light** — todas as superfícies devem funcionar em light e dark via tokens, mas nenhum ajuste de paleta é feito aqui.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Modelo de linha | Escolha **por tipo de tabela** (colunas A / rico B) | Alinha ao controle que o usuário já tem (`hiddenColumns`); cada tipo serve um modelo de transação |
| Onde configurar o layout | Configurações → Tipos de tabela, junto de `hiddenColumns` | Um só lugar para decidir *o que* e *como* a linha mostra |
| Persistência do layout | Campo `rowLayout` no `TableType` (default `"columns"`) | Única mudança de schema; default reproduz o comportamento atual |
| Superfície canônica de "ver tudo" | Modal em abas (1b) | Mudança de baixo risco (reaproveita `DialogShell`); dá hierarquia sem inventar container novo |
| Padrão do painel de parcelas | Painel lateral padrão do app | Elimina o componente destoante; unifica com navegação/gavetas (Spec 65) |
| Fonte de verdade do cronograma | Um só componente compartilhado | Painel lateral e aba do modal não divergem |
| Loop leitura↔edição | "Editar" do modal → edição inline | Evita dois formulários; um único modelo mental |
| Editabilidade do modal | Modal somente leitura | A edição in-modal era parcial (só tags/vínculos) e divergente; um só caminho de edição (inline) simplifica |
| Seleção em massa | "Editar em massa" (setters) + botões diretos (operações) | Consolida a barra poluída sem perder ação alguma; mesma semântica das actions atuais |
| Rodapé de parcelas | 3 ações (Lançar próxima · Quitar antecipado · Desfazer grupo) | "Quitar antecipado" segue útil; nenhuma ação do painel atual é removida |
| Pista de campos ocultos | Sem indicador na linha | Coluna oculta pelo tipo é intenção do usuário (irrelevante p/ a seleção), não dado escondido; modal read-only já é o "ver tudo" |
| Layout rich (B) | Visualização adicional opt-in por tipo | Adiciona uma forma de ver; layout A (default) mantém todos os utilitários |
| Abrir gaveta na linha | Chevron (em vez de 📎N) | Afordância padrão de expand/collapse; abre a gaveta preservando o acesso |
| Degradação em tela estreita | Compactar primeiro (`rich`/pílulas); scroll lateral só em último recurso | Preserva densidade sem apelar para scroll; rolagem contida (`overflow-x`) é o fallback final, o corpo nunca rola |
| Status no cabeçalho/linha | `StatusBadge`, nunca `Chip` | Regra inegociável do DS (CLAUDE.md §5.11); `Chip`/botão só p/ o badge de parcela interativo |
| Estados do modal | `EmptyState`/carregando/erro por aba | Nunca aba em branco; DS exige `EmptyState` em área vazia |
| Navegação de vínculos | Preservada no modal read-only p/ todos (inclusive `viewer`) | É leitura, não edição; o modal é a única superfície do `viewer` |
| Quick-affordances da linha | Preservadas (toggle Pendente/Favorito, ✨ leitura, tags popover, group-by-date) | Contrato "nunca a menos" — afordâncias de leitura não somem no redesenho |
| `MoneyValue` em toda superfície de valor | Header do modal, painel e cronograma | Mono + sinal + cor consistentes; evita `Typography` cru com `formatCentsToBrl` |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| TX-01 (modal em abas) | `src/components/transactions/TransactionDetailDialog.tsx` (reestruturar em cabeçalho + `Tabs variant="scrollable"`, **somente leitura** + botão "Editar"→inline via slot `actions`; abas Resumo/Classificação/**Parcelas e vínculos**/Histórico); reusar `DialogShell`, `MoneyValue`, `StatusBadge` (status — **não** `Chip`), `EmptyState` (aba/subseção vazia), estados carregando/erro |
| TX-02 (painel de parcelas) | `src/components/installments/InstallmentGroupPanel.tsx` (redesenhar no padrão lateral; rodapé com 3 ações — 1 só `contained`; **"Quitar antecipado"** preservada reusando `SettleInstallmentDialog`, **"Lançar próxima"** reformula `convertPendingInstallmentForExistingMonthAction`, **"Desfazer grupo"** é **nova** e requer Server Action + confirmação; preservar o convert por-item "Criar neste mês"; valores via `MoneyValue`); **novo** componente de cronograma compartilhado `InstallmentSchedule.tsx` reusado pelo painel e pela aba do modal |
| TX-03 (leitura↔edição) | `src/components/transactions/TransactionRow.tsx`, `TransactionRowEditor.tsx`, `RowDrawerToolbar.tsx` (alinhar colunas/ícones/rótulos, **preservar** `CreatableEntitySelect`/toggle `expenseType`/moeda simples+avançado/✨ apelido e os utilitários de tabela); `TransactionRowActions.tsx` (**preservar** toggles rápidos de Pendente/Favorito na linha), `TransactionTable.tsx` (**preservar** agrupamento por data), `TagPopover` (**preservar** quick-edit de tags em leitura); `row-menu-items.tsx` (ação "Editar" a partir do detalhe + foco no 1º campo do editor) |
| TX-04 (densidade/layout) | `TransactionRow.tsx` (renderiza layout `columns`/`rich` conforme o tipo; **sem** indicador `more_horiz`); `TableType` (campo `rowLayout`); tela de Tipos de tabela em Configurações (seletor de layout) |
| TX-04 (hiddenColumns) | `TableType`/`hiddenColumns` — leitura; **estendido** com `rowLayout`, sem migrar tipos existentes |
| BULK (seleção em massa) | `src/components/transactions/BulkActionBar.tsx` (consolidar setters no diálogo "Editar em massa"; manter botões diretos Mover/Tags/Marcar pago/Excluir/cancelar); reusa `bulkUpdateAction`, `bulkDeleteAction`, `bulkAddTagAction`, `bulkRemoveTagAction`, `MoveTransactionsDialog` |

### Modal de detalhe — cabeçalho de destaque + abas (reusar `DialogShell`)

```tsx
// ✅ Correto — hierarquia: cabeçalho forte, depois abas por assunto.
// DialogShell EXIGE `title: string` (renderiza como h3 no header). Para não competir
// com o cabeçalho de destaque, `title` recebe um rótulo NEUTRO e o valor (apex) vai no corpo.
// "Editar" entra pelo slot `actions` (não <DialogActions> cru).
<DialogShell
  open={open}
  onClose={onClose}
  maxWidth="sm"
  title="Transação"
  actions={canEdit ? <Button variant="contained" onClick={onEditInline}>Editar</Button> : undefined}
>
  <TransactionDetailHeader tx={tx} /> {/* apex: MoneyValue h4 + descrição + data + StatusBadge */}
  <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
    <Tab label="Resumo" />
    <Tab label="Classificação" />
    <Tab label="Parcelas e vínculos" />
    <Tab label="Histórico" />
  </Tabs>
  {/* Abas são somente leitura — sem edição de campos in-place */}
  <TabPanel value={tab} index={0}><ResumoFields tx={tx} /></TabPanel>
  {/* ... */}
</DialogShell>
// Alternativa (decisão §12 futura): estender DialogShell com slot `header?: ReactNode`.

// ❌ Anti-padrão — lista plana de ~15 pares label/valor sem hierarquia (estado atual)
// ❌ Anti-padrão — <DialogActions> cru no corpo, ou <Chip> para status no cabeçalho
```

### Cronograma de parcelas compartilhado (uma fonte de verdade)

```tsx
// ✅ Um componente, dois hosts: painel lateral e aba do modal renderizam o mesmo
<InstallmentSchedule group={installmentGroup} currentId={tx.id} />

// InstallmentGroupPanel (lateral) e a aba "Parcelas e vínculos" do modal
// ambos montam <InstallmentSchedule/>. Sem duplicar markup do cronograma.

// ❌ Anti-padrão — painel de parcelas com layout próprio, divergente da aba do modal
```

### Densidade/layout da linha vem do tipo de tabela

```tsx
// TransactionRow recebe o tipo de tabela; o layout é propriedade do tipo, não do usuário/global.
// hiddenColumns decide QUAIS dados; rowLayout decide COMO a linha os arranja.
function TransactionRow({ tx, tableType }: Props) {
  return tableType.rowLayout === "rich"
    ? <RichRow tx={tx} hidden={tableType.hiddenColumns} />      // layout B (pílulas)
    : <ColumnsRow tx={tx} hidden={tableType.hiddenColumns} />;  // layout A (colunas, default)
}
```

```prisma
// Única mudança de schema — estende TableType; default reproduz o comportamento atual
model TableType {
  // ...campos existentes, incluindo hiddenColumns
  rowLayout String @default("columns") // "columns" | "rich"
}
```

### Campos ocultos pelo tipo de tabela — sem pista na linha (TX-04c)

Ocultar coluna/pílula é decisão intencional do tipo de tabela (dado irrelevante para aquela seleção, não escondido). **Não** há indicador na linha; o dado segue acessível no modal read-only, que é o "ver tudo".

```tsx
// ✅ A linha renderiza só o que o tipo de tabela expõe — sem indicador de "há mais"
<ColumnsRow tx={tx} hidden={tableType.hiddenColumns} />
// Todo campo (inclusive os ocultos pelo tipo) tem lar garantido no modal de detalhe (TX-01c).

// ❌ Anti-padrão — poluir a linha com um `more_horiz` "há campos ocultos"
//    (o usuário escolheu ocultar; não é surpresa a sinalizar)
```

### Restrições Warm Calm

- Usar apenas componentes do design system (`DialogShell`, `Tabs`/`Tab`, `MoneyValue`, `StatusBadge`, `Tooltip`, `Chip`, painel lateral padrão) — **status/estado financeiro sempre em `StatusBadge`, nunca `Chip`**; sem containers custom desnecessários.
- Espaçamentos via tokens semânticos (`layout.*`); cores via tokens (`accent.primary`, `background.subtle`, `border.subtle`, `success/warning/danger`); nunca hex literais.
- Estados de valor (positivo/negativo/estorno) via `MoneyValue`, que DEVE exibir **sinal explícito (+/−) além da cor** — o sinal nunca é comunicado só por cor; nunca colorir texto com hex manual.
- **Cor é informação, nunca o único sinal**: todo estado/severidade por cor (status Favorita/Pendente/parcela, ações destrutivas Excluir/Desfazer grupo, estados de parcela paga/atual/prevista) DEVE parear a cor com ícone e/ou rótulo textual.
- Todas as superfícies (linha, modal, painel, gaveta) DEVEM funcionar em light e dark via tokens.

### 7.1 Mapa de campos → superfície (definitivo)

Onde cada campo do objeto aparece após a reestruturação. "Linha (cond.)" = exibido na linha se o `hiddenColumns` do tipo permitir; caso contrário, acessível pelo modal de detalhe (somente leitura), sem pista na linha.

> A coluna **Linha (layout A)** = colunas explícitas; **Linha (layout B)** = descrição rica com pílulas. Qual layout se aplica depende do `rowLayout` do tipo de tabela; *quais* itens aparecem depende do `hiddenColumns`. Campo preenchido e oculto pelo tipo → continua acessível no **modal de detalhe (read-only)**, sem indicador na linha (TX-04c). No layout B, todo campo que o `hiddenColumns` mantém visível é renderizado como pílula; o layout só muda a **forma** (coluna × pílula), não o **conjunto** de campos.

| Campo | Linha (layout A) | Linha (layout B) | Modal (aba) |
|---|---|---|---|
| `occurredOn` | coluna Data | prefixo da descrição | Cabeçalho |
| `description` | coluna Descrição | título | Cabeçalho |
| `amountCents` | coluna Valor (`MoneyValue`) | valor à direita | Cabeçalho |
| `isPending` | esmaecida + `StatusBadge` + **toggle rápido** | `StatusBadge` + **toggle** | Cabeçalho (status via `StatusBadge`) |
| `isFavorite` | ★ (**toggle**) na descrição | ★ (**toggle**) | Cabeçalho (status via `StatusBadge`) |
| `categoryId` / `subcategoryId` | coluna (cond.) | pílula | Resumo |
| `institutionId`/`institutionText` | coluna (cond.) | pílula | Resumo |
| `responsiblePartyId` | coluna (cond.) | pílula (avatar) | Resumo |
| `originalCurrency`/`originalAmountCents`/`exchangeRate` | valor pontilhado + tooltip | pílula moeda | Resumo |
| `expenseType` | coluna (cond., ícone) | pílula (cond.) | Classificação |
| `paymentMethod` | coluna (cond.) | pílula (cond.) | Classificação |
| `investmentType` | coluna (cond.) | pílula (cond.) | Classificação |
| `tags[]` | coluna (cond.) | pílulas | Classificação |
| `cardInstallment` (texto) | — (sem uso) | — (sem uso) | — (sem uso) |
| `installmentGroup`/`Number` | badge → painel (cond.) | badge → painel (cond.) | Parcelas e vínculos (cronograma) |
| `links` (`linkCount` na linha; `linksAsSource`/`linksAsTarget` no schema) | chevron → gaveta (cond.) | chevron → gaveta (cond.) | Parcelas e vínculos (fetch async; navegar p/ vinculada) |
| `notes` | chevron → gaveta | chevron → gaveta | Resumo (bloco Nota, read-only) — edição via gaveta inline |
| `source` | — | — | Histórico |
| `createdBy`/`updatedBy` + timestamps | — | — | Histórico |
| `metadata` (JSON) | — | — | — (sem uso hoje; fora da UI nesta spec) |

### 7.2 Estrutura das abas do modal (definitivo)

| Aba | Campos |
|---|---|
| Resumo | categoria › subcategoria, instituição, responsável, moeda estrangeira (orig. + câmbio), nota (`notes`, bloco read-only, só se preenchida) |
| Classificação | tipo de gasto, forma de pagamento, tipo de investimento, tags |
| Parcelas e vínculos | Duas subseções com cabeçalho próprio: (1) `<InstallmentSchedule>` (cronograma do grupo) — só quando há grupo; (2) Vínculos (`links[]`: reembolsado por / pago por / relaciona-se), cada um com ação **abrir** (navega ao alvo — leitura, inclusive `viewer`) — só quando há links. Se só uma subseção existir, exibir só ela; se nenhuma, a aba mostra `<EmptyState size="compact">` (TX-01d). |
| Histórico | origem (`source`), criado por/em, editado por/em (`metadata` fica fora — sem uso hoje) |

---

## 8. Critérios de Teste

> Skill: [`e2e-testing`](../skills/e2e-testing/SKILL.md) · [`testing`](../skills/testing/SKILL.md). Seguir os padrões da Spec 58.

**E2E (Playwright, `e2e/`):**
- Abrir o detalhe de uma transação → cabeçalho mostra valor (`MoneyValue`, maior elemento) / descrição / status via `StatusBadge` (não `Chip`); as 4 abas ("Resumo", "Classificação", "Parcelas e vínculos", "Histórico") existem, navegam e permanecem sempre presentes; o modal é somente leitura.
- Transação simples (sem grupo/links/tags): a aba "Parcelas e vínculos" e as subseções sem dado exibem `<EmptyState>` — nunca uma aba em branco; a nota preenchida aparece em bloco read-only na aba "Resumo".
- Transação com vínculo (`links[]`): a aba "Parcelas e vínculos" lista os vínculos e a ação "abrir" navega para a transação alvo — inclusive como `viewer`.
- Transação com `InstallmentGroup`: clicar no badge de parcela abre o painel lateral; o cronograma exibido é o mesmo da aba "Parcelas e vínculos"; o rodapé oferece as três ações (Lançar próxima, Quitar antecipado, Desfazer grupo) e o cronograma mantém "Criar neste mês" por parcela.
- Transação com campos preenchidos ocultos pelo tipo de tabela: a linha NÃO exibe indicador `more_horiz`; o modal de detalhe mostra o campo mesmo assim (nada se perde).
- Criar um tipo de tabela com `rowLayout: "rich"` → as linhas daquele tipo renderizam o layout de pílulas; tipo com `"columns"` renderiza colunas com os utilitários (ordenação/busca).
- Seleção em massa: selecionar ≥2 → barra aparece; "Editar em massa" define categoria/tipo de gasto/forma de pagamento/favorita para toda a seleção; Tags oferece adicionar e remover; Mover/Marcar pago/Excluir/cancelar seguem disponíveis.
- Edição inline: `CreatableEntitySelect` cria categoria on-the-fly; toggle de tipo de gasto, moeda simples/avançado e ✨ apelido funcionam no editor.
- `viewer` (usar `e2e/viewer-readonly.spec.ts` como base): o modal abre em leitura, sem botão "Editar".
- "Editar" no modal → entra em edição inline da linha correspondente.
- Gaveta em leitura: transação sem nota NÃO mostra a seção de nota; a mesma transação em edição oferece adicionar nota; o chevron abre/fecha a gaveta e expõe `aria-expanded`.
- Afordâncias rápidas na linha de leitura: toggle de Pendente e toggle de Favorito alteram o estado sem entrar em edição; ✨ de apelido em leitura persiste com desfazer; clicar na célula de tags abre o popover sem entrar em edição.
- Agrupamento por data: a tabela mantém os separadores de dia no layout de colunas (A).
- "Editar" no modal → entra em edição inline e o foco vai para o primeiro campo (descrição); fechar o painel de parcelas devolve o foco ao badge que o abriu.
- Viewport estreito: com tipo `columns`, a linha compacta primeiro (degrada a apresentação) e nenhuma coluna preenchida fica inacessível; o corpo da página não rola na horizontal (scroll só como último recurso, contido).

**Unit (Vitest):**
- `rowLayout` do tipo de tabela seleciona o componente de linha correto (`"rich"`→pílulas; ausente/`"columns"`→colunas).
- Mapa campo→superfície (§7.1) cobre todos os campos **de domínio** do `Transaction` sem órfãos (todo campo tem lar, ao menos no modal read-only). O universo auditado é uma **whitelist explícita** de campos de negócio — exclui campos estruturais/roteamento (`id`, `accountId`, `monthId`, `tableId`, `sectionId`), FKs, relações estruturais e back-relations (`checklistCompletions`, `goalContributions`), que não têm superfície de UI.
- `InstallmentSchedule` renderiza estados paga/atual/prevista corretamente a partir de um `InstallmentGroup` mock.
- Barra de massa: o conjunto de ações disponíveis cobre 1:1 as ações da `BulkActionBar` atual (nenhuma some) — setters no diálogo "Editar em massa", operações nos botões diretos.
- Gaveta de leitura: a lista de seções exibidas contém apenas os itens com dado preenchido.

---

## 9. Plano de Migração Incremental

Ordem sugerida para não quebrar o app em nenhum commit:

1. **Extrair `InstallmentSchedule.tsx`** a partir do markup de parcelas atual (sem mudar comportamento), e fazer o `InstallmentGroupPanel` consumi-lo.
2. **Redesenhar `InstallmentGroupPanel`** no padrão de painel lateral (cabeçalho/lista/rodapé), ainda usando `InstallmentSchedule`. Rodapé com as **três** ações e hierarquia definida (1 só `contained`): "Lançar próxima" (primária), "Quitar antecipado" (`SettleInstallmentDialog`, **preservada**) e "Desfazer grupo" (destrutiva, separada — **nova**, requer Server Action + confirmação). Preservar o convert por-item "Criar neste mês" no cronograma; valores via `MoneyValue`.
3. **Reestruturar `TransactionDetailDialog`** em cabeçalho + `Tabs variant="scrollable"` (4 abas: Resumo/Classificação/**Parcelas e vínculos**/Histórico), montando `InstallmentSchedule` na aba "Parcelas e vínculos". Cabeçalho com valor (`MoneyValue`) como apex e status via `StatusBadge` (não `Chip`); `title` neutro + "Editar" pelo slot `actions`. Estados por aba/subseção (`EmptyState`/carregando/erro — nunca aba em branco) e **preservar a navegação** para a transação vinculada (leitura, inclusive `viewer`). Modal **somente leitura** para todos; botão "Editar" (→inline) só para `owner`/`editor`, ausente para `viewer`.
4. **Alinhar `TransactionRowEditor`/`RowDrawerToolbar`** às colunas/ícones/rótulos da leitura (TX-03), **preservando** todas as sub-features do editor (`CreatableEntitySelect`, toggle `expenseType`, moeda simples/avançado, ✨ apelido) e os utilitários da tabela (ordenação/busca/`autoEdit`/**agrupamento por data**/`aria-label`). **Preservar** as afordâncias rápidas de leitura (toggle Pendente/Favorito, ✨ leitura persistente, popover de tags). Trocar o indicador `📎N` pelo **chevron** (com `aria-expanded`) que abre a gaveta de leitura; ao entrar em edição pelo modal, mover o foco para o 1º campo.
5. **Ligar "Editar" do modal → edição inline** (`row-menu-items.tsx`).
6. **Estender `TableType` com `rowLayout`** (migração Prisma, default `"columns"`) + adicionar o seletor de layout na tela de Tipos de tabela; fazer `TransactionRow` renderizar `columns`/`rich` conforme o tipo. O layout `rich` (B) é adição opt-in; `columns` (A) mantém os utilitários. **Sem** indicador `more_horiz` de campos ocultos. Implementar a **degradação por viewport estreito** (TX-04d): compactar primeiro (apresentação `rich`/pílulas, sem mudar o `rowLayout` compartilhado); rolagem horizontal contida (`overflow-x: auto`) só como último recurso, sem o corpo da página rolar.
7. **Consolidar a `BulkActionBar`** (BULK): mover os setters (categoria, tipo de gasto, forma de pagamento, favoritar) para o diálogo "Editar em massa"; manter botões diretos (Marcar pago/pendente, Mover, Tags add/remove, Excluir, cancelar). Reutilizar as Server Actions de bulk existentes — nenhuma ação removida.
8. Rodar `pnpm typecheck` + `pnpm test` + e2e da §8 a cada passo.

---

## 10. Plano de Implementação Detalhado

> Derivado do §9 e dos critérios TX-01..TX-04 + BULK por análise pacote-a-pacote **contra o código real** (símbolos/props/linhas verificados, não presumidos — ver validação abaixo). Cada pacote fecha em **um commit verde** (typecheck + unit passam; app não quebra). Implementar **um por vez**. "Nunca a menos": nenhuma afordância atual some.
>
> **Correções de spec aplicadas pela validação** (nomes-fantasma → nomes reais): `amount`→`originalAmountCents`, `rate`→`exchangeRate`, `links[]`→`linkCount` na linha + relações `linksAsSource`/`linksAsTarget` (fetch async); §8 "sem órfão" restrito a **campos de domínio** (whitelist, exclui estruturais/back-relations). **Achados que viraram trabalho** (não estavam no §9): (1) `MoneyValue`+`formatCentsToBrl` **não** exibem sinal `+/−` hoje → pacote **P0**; (2) gaveta de **leitura** (`TransactionRowDetails`) e de **edição** (`RowDrawerToolbar`) são **componentes diferentes** → reconciliar em **P4**; (3) `TransactionRow` é monolítico (~750 linhas) → split em **P6**; (4) "Desfazer grupo" **não existe** (action nova) e sua semântica é decisão de produto → **P2** + §10.5; (5) `bulkUpdateAction` roda hoje **sem `monthId`** (setters quebrados em runtime) e "remover categoria" envia `''` → **P7** corrige como regressão.

### 10.1 Ordem recomendada (por dependência + risco)

Fundações e o pacote independente de **maior risco** (P4, reconciliação da gaveta + editor FX) vão **primeiro**, para de-riscar cedo. O núcleo visível (modal/painel/linha) vem depois de P0/P1; a barreira final valida a suíte.

| Onda | Pacotes | Por quê nesta posição |
|---|---|---|
| 0 | **P0** · **P1** · **P4** · **P7** | Todos `dependsOn: []`. **P4** 🔴 é o de maior risco (gaveta dupla + FX do editor) → cedo. **P0** (sinal `MoneyValue`) e **P1** (`InstallmentSchedule`) são fundações de P2/P3. **P7** (bulk) é isolado e corrige bug de runtime. |
| 1 | **P2** · **P3** · **P6** | P2/P3 dependem de P0+P1 (valor com sinal + cronograma). **P6** 🔴 (maior pacote, Opus) depende de P4 (extrai a linha já no formato final). Núcleo da spec. |
| 2 | **P5** | Fecha o loop leitura↔edição; depende de P3 (modal) + P4 (editor). |
| 3 | **P8** | Barreira final: código morto, seed e2e, teste de cobertura §7.1, suíte inteira. Depende de todos. |

**Grafo de dependências:**

```
P0 ─┐
P1 ─┤ (fundações)              ┌─► P2 ─┐
P4 ─┤ (independente, 🔴)   P0,P1 ┤       │
P7 ─┘ (independente)           └─► P3 ─┼─► P5   (P5 ← P3 + P4)
                          P4 ──► P6 ───┤
                                       └─────────► P8 (← P0..P7)
```

> **Contenção de arquivos quentes:** `TransactionRow.tsx` é tocado por P4/P5/P6 e `TransactionTable.tsx` por P3/P6; `pt-BR.ts` por P2/P3/P4/P6/P7. Reforça a regra "um pacote por vez" e a ordem P4→P6, P3→P5. P6 extrai `ColumnsRow` a partir da linha **já** no formato final do P4.

### 10.2 Resumo dos pacotes

| Pacote | Cobre | Modelo | Esforço | Depende |
|---|---|---|---|---|
| P0 — MoneyValue sinal +/− | §6/§7 (req. Warm Calm) | Sonnet | S (~2-3h) | — |
| P1 — Extrair `InstallmentSchedule` | TX-02, TX-02b | Sonnet | M (~½ dia) | — |
| P2 — Painel de parcelas + Desfazer grupo | TX-02, TX-02a | Sonnet | M (~1 dia) | P0, P1 |
| P3 — Modal em abas (read-only) | TX-01a–d, TX-04c | Sonnet | M (~1 dia) | P0, P1 |
| P4 — Gaveta leitura↔edição + chevron | TX-03a, TX-03b | Sonnet | L (~1-1½ dia) | — |
| P5 — "Editar" modal→inline + foco | TX-03, TX-03c | Sonnet | M (~½ dia) | P3, P4 |
| P6 — `rowLayout` + Columns/RichRow + viewport | TX-04a–d | **Opus** | L (~2 dias) | P4 |
| P7 — Consolidar `BulkActionBar` | BULK-01/02/03 | Sonnet | M (~½ dia) | — |
| P8 — Limpeza + seed e2e + verificação | TX-01c, TX-02, TX-04 | Sonnet | M (~½ dia) | P0–P7 |

### 10.3 Detalhe por pacote

#### P0 — MoneyValue sinal +/− `feat(money): adiciona sinal +/- opt-in em MoneyValue e formatCentsToBrl`
- **edit** `src/lib/money.ts` — `formatCentsToBrl` ganha `options.sign?: boolean | "always"`: `"always"` prefixa `+` p/ `cents > 0n` e `-` p/ `< 0n`; `sign: true` segue **só** `-` (1:1 atual); `0n` sem sinal. Tratar `"always"` **antes** do boolean (também é truthy).
- **edit** `src/components/ui/MoneyValue.tsx` — nova prop **opt-in** `showSign?: boolean` (default `false`); chama `formatCentsToBrl(cents, showSign ? { sign: "always" } : undefined)`. Cor/mono/estilos inalterados → render idêntico ao atual quando omitido.
- **edit** `src/lib/money.test.ts` (+casos `"always"` +não-regressão `sign:true` sem `+`) · **new** `src/components/ui/MoneyValue.test.tsx` (default sem sinal; `showSign` com `+/-/∅`; `variant` custom).
- **Risco-chave:** não regredir callers de `{ sign: true }` (`aliases/apply.ts`, `ForecastManager.tsx`) → `+` só em `"always"`; `showSign` default `false` blinda `GoalsManager`/`NetWorthManager`/`MonthHeader`.

#### P1 — Extrair InstallmentSchedule `refactor(installments): extrai cronograma para componente InstallmentSchedule compartilhado`
- **new** `src/components/installments/InstallmentSchedule.tsx` — move **verbatim** `chipBaseSx` + `ItemStatusChip` + o markup da lista (hoje `InstallmentGroupPanel.tsx:31-88,226-278`). Estados `paid`/`pending`/`waiting` via `StatusBadge`; **"Criar neste mês"** por-item preservado (`onConvert(pendingInstallmentId)`, guard `canEdit`). Única mudança: valor da parcela passa de `formatCentsToBrl` cru → `<MoneyValue variant="body2"/>` (AC TX-02). Props: `{ items, installmentCount, canEdit?, convertingId?, onConvert? }` (opcionais habilitam host read-only de P3).
- **edit** `InstallmentGroupPanel.tsx` — consome `<InstallmentSchedule>`; remove o markup migrado (cabeçalho/rodapé/reload intactos).
- **new** `InstallmentSchedule.test.tsx` (estados; convert; caminho read-only `canEdit=false`; `MoneyValue`). Sem novo e2e (regressão pelos fluxos existentes).
- **Risco-chave:** `MoneyValue` muda a cor do valor (positivo→success) — validar light/dark; props opcionais não são especulativas (caminho read-only exercido em teste).

#### P2 — Painel de parcelas + Desfazer grupo `feat(parcelas): redesenha painel lateral e adiciona desfazer grupo`
- **edit** `src/lib/schemas/installment.ts` — `undoInstallmentGroupSchema = z.object({ installmentGroupId: z.string().cuid("ID inválido") })` + tipo.
- **edit** `src/server/services/installment-service.ts` — `undoInstallmentGroup(input, ctx)` **multi-tenant** (escopa por `accountId`); default **não-destrutivo** (ver §10.5): `updateMany` desvincula (`installmentGroupId/installmentNumber → null`), apaga `PendingInstallment` futuras, apaga `InstallmentGroup`, tudo em `$transaction`.
- **edit** `src/actions/installments.ts` — `undoInstallmentGroupAction = defineAction({ schema, requireRoles: [...EDITOR_ROLES], handler })`.
- **edit** `installment-service.test.ts` — **teste multi-tenancy** (grupo de outra account → `NotFoundError`) + happy path (desvincula + deleta pendências + deleta grupo).
- **edit** `InstallmentGroupPanel.tsx` — mesma assinatura de Props (não toca `TransactionRow`). Cabeçalho: total via `<MoneyValue showSign variant="h5"/>` + progresso. Rodapé **3 ações, 1 só `contained`**: "Lançar próxima" (contained; acha o próximo `pendingInstallmentId` waiting-com-mês e reusa `convertPendingInstallmentForExistingMonthAction`; disabled+Tooltip se não houver), "Quitar antecipado" (outlined, `SettleInstallmentDialog` — **preservada**), "Desfazer grupo" (destrutiva separada, `DialogShell` de confirmação).
- **edit** `pt-BR.ts` (`transactions.installments.*`: launchNext*, undo*, loadError).
- **Riscos-chave:** semântica do desfazer (§10.5); "Lançar próxima" só com mês aberto (guard); confirmação aninhada no Drawer usa `DialogShell` (focus-trap próprio).

#### P3 — Modal em abas read-only `feat: reestrutura modal de detalhe da transação em abas somente leitura`
- **edit** `TransactionDetailDialog.tsx` — reescrita: **remove** props `hiddenColumns` (modal = "ver tudo"), `onTagsChange`, `onLinkCountChanged`, `onViewLinkedTransaction` (morto). `title="Transação"` neutro; cabeçalho no `children` (**não** há slot `header` — validado): `<MoneyValue variant="h4" showSign>` apex + descrição + data + `<StatusBadge>` (Pendente→`warning`/Favorita→`neutral`, **não** `Chip`) + badge de parcela clicável. 4 abas `Tabs variant="scrollable"` **read-only**: Resumo (+`notes` bloco read-only), Classificação, **Parcelas e vínculos** (`<InstallmentSchedule>` de P1 + vínculos via **fetch async** unindo `linksAsSource`/`linksAsTarget`; navegar via `router.push+onClose`, papel-agnóstico), Histórico. `EmptyState size="compact"`/carregando/erro por aba (TX-01d). "Editar" via slot `actions` só `owner`/`editor`. Normalizar sinal por seção (`displaySignInverts(sectionCountType)`).
- **edit** `TransactionTable.tsx` — remover os 4 props extintos do `<TransactionDetailDialog>`.
- **edit** `pt-BR.ts` (`transactions.detail.tabs.*`, empties) · **delete** `src/components/tags/TagDetailEditor.tsx` (órfão após read-only; `TagEditor` permanece) · **new** `TransactionDetailDialog.test.tsx`.
- **Riscos-chave:** acoplar à assinatura real de `InstallmentSchedule` (P1); precisa de **query/action nova** p/ os vínculos (DTO da linha só tem `linkCount`); remover edição in-modal é exigência de TX-01c (não é perda — segue na linha/gaveta).

#### P4 — Gaveta leitura↔edição + chevron `feat(transactions): reconcilia gaveta de leitura/edicao e troca indicador de anexos por chevron`
- **new** `src/components/transactions/drawerSections.tsx` — fonte única de ícones/rótulos/ordem canônica (`notes, fx, links, tags, installment`), consumida por leitura e edição (TX-03b).
- **new** `RowDrawerChevron.tsx` (+`.test.tsx`) — chevron expand/collapse com `aria-expanded` + `aria-label` dinâmico; substitui `AttachmentIndicator` (📎N).
- **edit** `RowDrawerToolbar.tsx` (ícones/rótulos de `drawerSectionMeta`, lógica de toggle intacta), `TransactionRowDetails.tsx` (reordena p/ ordem canônica + ícones), `SectionDrawer.tsx`/`CollapsibleSectionRow.tsx` (+prop `icon?`), `TransactionRowActions.tsx` (troca `AttachmentIndicator`→`RowDrawerChevron`, mantém gate `countAttachments(tx)>0`), `TransactionRowEditor.tsx`/`NewTransactionRow.tsx` (passa `icon` aos `CollapsibleSectionRow` — **sem tocar** FX/`CreatableEntitySelect`/`expenseType`/✨), `pt-BR.ts`.
- **delete** `AttachmentIndicator.tsx` + `.test.tsx`.
- **Riscos-chave 🔴:** não regredir FX simples↔avançado nem `CreatableEntitySelect`/toggle/✨ (mudar só a **origem** de ícones/rótulos, não o JSX/estado); manter gate do chevron idêntico (inclui `installmentGroup`).

#### P5 — "Editar" modal→inline + foco `feat(transações): editar no modal foca a descrição inline e devolve o foco ao badge de parcela`
- **edit** `TransactionRow.tsx` — no efeito `autoEdit`: `startEdit("description")` (não `occurredOn`) + foco imperativo via `requestAnimationFrame(() => descriptionInputRef.current?.focus())` (roda **depois** do restore-focus do Modal); `onClose` do painel devolve foco ao `installmentBadgeRef`.
- **edit** `TransactionRowEditor.tsx` — prop `descriptionInputRef?` + `inputRef` no `TextField` de descrição (mantém `autoFocus`).
- **new** `TransactionRow.test.tsx` (foco na descrição; regressão: `occurredOn` não focado) · **new** `e2e/transaction-detail-edit.spec.ts`.
- **Riscos-chave:** restore-focus do `Dialog` compete com o handler de "Editar" → foco imperativo em `rAF`; depende de P3 preservar `onEdit→editRequestId→autoEdit` e de P4 manter o campo Descrição.

#### P6 — rowLayout + ColumnsRow/RichRow + viewport `feat(transactions): adiciona rowLayout ao TableType e divide a linha em ColumnsRow/RichRow`
- **edit** `prisma/schema.prisma` — `TableType.rowLayout String @default("columns") @map("row_layout")` (único schema; default reproduz atual) · **new** `prisma/migrations/<ts>_add_row_layout_to_table_type/migration.sql` (`ALTER TABLE ... ADD COLUMN ... DEFAULT 'columns'`; após migrate/generate **reiniciar app** — CLAUDE §8).
- **edit** `src/lib/schemas/settings.ts` (`ROW_LAYOUTS`/`rowLayoutSchema`/`RowLayout` + `rowLayout` opcional em create/update) (+`settings.test.ts`), `table-type-service.ts` (persiste `rowLayout`; **default fica travado** — mesmo gate do `hiddenColumns`, ver §10.5) (+`table-type-service.test.ts` multi-tenancy), `settings/table-types/page.tsx` + `TableTypesManager.tsx` (seletor de layout no painel expandido), `pt-BR.ts` (`settings.tableTypes.layout*`).
- **edit** cascata de props: `month-page.ts` (select `rowLayout` + `SectionTable`), `SectionView.tsx`, `FinanceTableCard.tsx` (repassam `rowLayout` até `TransactionTable`).
- **new** `row-layout.ts` (+`.test.ts`) — `resolveRowLayout(configured, isNarrow)` (viewport estreito → `rich`; normaliza) + `useIsNarrow(ref)` (ResizeObserver, `false` até `mounted` p/ **não** quebrar hydration).
- **new** `ColumnsRow.tsx` (extração **fiel** do `TableRow` de leitura atual, todos os utilitários), `RichRow.tsx` (+`.test.tsx`) (layout B pílulas gated por `hiddenColumns`; **sem** `more_horiz`; `MoneyValue`; `StatusBadge`).
- **edit** `TransactionTable.tsx` (prop `rowLayout`; `effectiveLayout = resolveRowLayout(...)`; header de colunas só em `columns`, mínimo em `rich`), `TransactionRow.tsx` (vira container: mantém estado/handlers/edição/drawer; delega leitura a `ColumnsRow`/`RichRow`).
- **Riscos-chave 🔴:** refatorar o componente mais usado → `ColumnsRow` = movimentação mecânica (mesmo JSX/handlers); sequenciar **após P4**; SSR sempre `columns` (override só pós-mount); reiniciar app pós-migração (singleton Prisma, CLAUDE §8).

#### P7 — Consolidar BulkActionBar `feat(transactions): consolida BulkActionBar com diálogo Editar em massa`
- **edit** `BulkActionBar.tsx` — Props inalteradas. Diálogo **"Editar em massa"** (`DialogShell`): categoria (definir/**remover**=`categoryId:null`, não `''`), tipo de gasto, forma de pagamento, favoritar — patch combinado via `bulkUpdateAction`. Botões diretos: Marcar pago/pendente (`isPending`), Mover (`MoveTransactionsDialog`), Tags add+remove (`bulkAddTagAction`/`bulkRemoveTagAction`), Excluir (`bulkDeleteAction`, confirmação se seleção grande), cancelar. **Corrige bug:** passar `monthId` (prop) em **toda** chamada `bulkUpdateAction` (hoje ausente → setters quebrados).
- **edit** `pt-BR.ts` (`transactions.bulk.*`) · **new** `BulkActionBar.test.tsx` (cobertura 1:1; regressão `monthId`; remover categoria `null`; confirmação em `count>5`).
- **Riscos-chave:** patch combinado é equivalente (só campos tocados entram); manter prop `institutions` sem setter (não existia — "nunca a mais"); subcategoria em massa fora de escopo (§10.5).

#### P8 — Limpeza + seed e2e + verificação `chore(spec-66): remove código morto, semeia fixtures e2e e adiciona guarda de cobertura de campos (§7.1)`
- **delete** `TagDetailEditor.tsx` (grep `= 0` antes) · **edit** `TransactionTable.tsx`/`TransactionDetailDialog.tsx` (remove `onViewLinkedTransaction` morto se P3 deixou resíduo).
- **new** `field-surface-coverage.test.ts` — universo = `Object.keys(Prisma.TransactionScalarFieldEnum)`; 3 buckets disjuntos (`DOMAIN_FIELD_SURFACES` / `STRUCTURAL_FIELDS` / `NO_UI_FIELDS` c/ `cardInstallment`+`metadata`); união == enum, sem stale (guarda de §7.1 sem falso-negativo).
- **edit** `e2e/fixtures/seed.ts` (+`seedSpec66Fixtures`: vínculos `TransactionLink` + `InstallmentGroup` num **mês dedicado isolado** 2099/11) + `manifest.ts` · **new** `e2e/transaction-detail.spec.ts` (cenários §8 que dependem das fixtures).
- **Verificação:** `pnpm typecheck` + `pnpm test` + e2e §8. **Nunca `docker compose down -v`** — limpar só volume e2e (CLAUDE §8). Barreira: teste por rótulo falhando → corrigir rótulo/`aria-label`, **não** relaxar o teste.

### 10.4 Cross-cutting

- **Mensagens** (`src/lib/messages/pt-BR.ts`): tocado por P2 (`installments.*`), P3 (`detail.tabs.*`), P4 (`attachments` chevron), P6 (`settings.tableTypes.layout*`), P7 (`transactions.bulk.*`). Editar sub-blocos isolados p/ minimizar conflito; zero string hardcoded (CLAUDE §5.10). **Arquivo quente** — sequenciar.
- **Migração Prisma**: só **P6** (`rowLayout`, aditiva, default `"columns"`). Após `migrate dev`/`generate`, **`docker compose restart app`** (singleton Prisma — CLAUDE §8).
- **Seed e2e** (`e2e/fixtures/seed.ts`): hoje **não** tem `TransactionLink` nem cenário de `InstallmentGroup` para o modal/painel → **P8** semeia (senão os e2e de vínculos/parcelas ficam sem dados). Mês isolado 2099/11 p/ não furar forecast/dashboards.
- **Componente base `MoneyValue`** (P0): fundação transversal — P1/P2/P3 consomem `showSign`; sem P0 o sinal `+/−` não aparece (mas tudo compila e passa unit, o sinal "acende" quando P0 aterrissa).
- **Bugs de runtime encontrados** (corrigidos em P7, não eram escopo): `bulkUpdateAction` chamado **sem `monthId`** (obrigatório desde a Spec 39 → setters de campo quebrados) e "remover categoria" enviando `''` (falha `cuid`). Regressões travadas por teste.
- **Multi-tenancy** (CLAUDE §5.12): única mutation nova = `undoInstallmentGroupAction` (P2) → teste de multi-tenancy obrigatório. Demais reusam actions já escopadas por `accountId`.

### 10.5 Decisões pendentes (resolver ao chegar no pacote)

**1. Semântica de "Desfazer grupo" (P2) — destrutiva, decisão de produto:**
- **Opção A (recomendada, default do plano):** **não-destrutivo** — desvincula as transações já lançadas (`installmentGroupId`/`installmentNumber → null`, permanecem como transações normais), apaga as `PendingInstallment` futuras e apaga o `InstallmentGroup` (alinhado ao FK `onDelete: SetNull` já no schema).
- **Opção B:** **destrutivo** — além disso, exclui também as transações já lançadas do grupo.
> Muda o corpo do `$transaction` e o texto de confirmação. **Confirmar antes de implementar P2.**

**2. Subcategoria em massa (P7):** `bulkUpdateSchema` **não** tem `subcategoryId` (a barra antiga também não oferecia). **Default: fora de escopo** — "categoria em massa" = `categoryId`. Se desejado, exige estender `bulkUpdateSchema` + service + teste de multi-tenancy (decisão de produto separada).

**3. `rowLayout` do tipo de tabela **padrão** é editável? (P6):** hoje o tipo `isDefault` tem `hiddenColumns` **travado** (toggles desabilitados; service recusa). **Default recomendado:** aplicar o **mesmo gate** ao `rowLayout` — o tipo padrão permanece `columns` e não-editável (baixo risco; `columns` = comportamento atual). Alternativa: liberar `rowLayout` no default (é só apresentação). **Confirmar ao implementar P6.**

> **Já resolvidas (não pendentes):** sinal `MoneyValue` → P0 prop-gated (`showSign`, sem regressão); navegação de vínculo no modal → `router.push + onClose` papel-agnóstico (reusa o caminho vivo; `onViewLinkedTransaction` era código morto, removido em P8); cabeçalho de destaque → no `children` do `DialogShell` (não há slot `header`).
