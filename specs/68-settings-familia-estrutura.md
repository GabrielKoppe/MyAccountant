# Spec 68 — Configurações · Família 1: Estrutura

> Status: **implementada** em 2026-08-10 (decisões D1–D7 fechadas na mesma data)
> Insumo: frames **"MyAccountant Settings — Arquitetura"** e **"MyAccountant Settings — Todas as Páginas v2"** (telas 01 Seções, 02 Categorias, 03 Instituições, 04 Responsáveis; modais M2, M3, M4, M5, M8)
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md)
> Depende de: **Spec 67** (shell, modais, status, linha-fantasma, menu da linha)

---

## 0. Blueprint

As telas 01–04 do frame v2 são normativas para hierarquia, agrupamento de colunas, densidade e ordem de leitura. O visual sai do MUI/tema conforme a tabela de tradução da Spec 67 §7.2. Estrutura vem do frame; pixel vem do tema.

Esta é a família do **vocabulário da conta** — as quatro páginas que quase não mudam depois do setup e das quais todo o resto depende.

> **Nota de revisão (2026-08-10).** O mapeamento contra o código real encontrou 17 divergências entre a §7 original desta spec e o schema/estrutura de arquivos existentes: campos descritos como "já existem" que não existem, um enum novo que duplicaria um enum carregado por 55 arquivos, e uma mudança de modelo (§2.4) **já entregue**. As seis que mudavam o produto foram decididas e estão registradas em **§6.1**; as outras onze foram corrigidas em linha nas seções afetadas. **Este documento já reflete todas elas** — o que está escrito aqui é o que vai ser implementado.

---

## 1. Problema

- **EST-01 · Seções sem tipo visível**: o tipo da seção (`countType`) **existe** no banco e já decide o sinal do valor no total do mês, mas o usuário só o encontra dentro do modal de edição — não há coluna, não há badge, não há legenda. A informação que estrutura o mês é a menos visível da página.
- **EST-02 · Categoria sem seção padrão**: a categoria não declara em que seção ela normalmente cai. Quem classifica precisa saber isso de cabeça, e nada liga a árvore de categorias à estrutura do mês. *(O "tipo próprio de categoria" citado na versão anterior desta spec não existe no schema — não há coluna a remover; o que falta é o vínculo com a seção.)*
- **EST-03 · Categorias não escalam**: 18 categorias + 47 subcategorias em `Accordion` empilhado, sem busca, sem filtro por seção, sem recolher tudo, sem ordem manual.
- **EST-04 · Sem importação em massa**: montar a árvore de categorias de uma conta nova é dezenas de criações manuais; migrar de planilha é impossível.
- **EST-05 · Instituições são só um nome**: a tabela `institutions` tem `name` e nada mais. Não há tipo, não há final de cartão, não há agência/conta, não há CNPJ. O formulário é um `TextField` único, e cartão, corretora, carteira e empresa são indistinguíveis na lista e no select da transação.
- **EST-06 · Responsáveis: modelo pronto, apresentação faltando**: `ResponsiblePartyMember` e o vínculo N:N **já existem** e o formulário já vincula membros. O que falta é a leitura: a lista não mostra quem está vinculado, não dá para vincular sem abrir o modal, e "responsável sem ninguém" é indistinguível de "responsável com membros".
- **EST-07 · Duplicatas sem saída**: "Restaurante" e "Restaurantes" coexistem, e a única forma de resolver é excluir uma e reclassificar tudo à mão.
- **EST-08 · Exclusão às cegas**: excluir uma categoria referenciada por apelidos, de-para de templates, transações de modelo e filtros de widget não avisa nada (SET-06 da Spec 67).

---

## 2. Solução

Quatro páginas dentro do `SettingsPageShell`, duas de arquétipo B (com alça de arraste) e duas de arquétipo A. Em todas: `Table` no lugar de `Stack` de `Paper`, edição **inline** no lugar de modal de formulário, e as cinco primitivas da Spec 67 (`GhostRow`, `StatusCell`, `RowActionsMenu`, `SettingsToolbar`, `SettingsPagination`) — que hoje têm **zero consumidores** — finalmente em uso.

### 2.1 Seções — arquétipo B

Colunas: alça · **Nome** (ponto de cor + nome) · **Tipo** · **Modelos** · **Status** · menu.

- **Tipo de seção** (EST-01): renderiza o **`countType` existente**, não um enum novo (D1). São **quatro** valores, cada um com `Chip size="small"` + ícone:

  | `countType` | Rótulo | Ícone | Legenda na faixa |
  |---|---|---|---|
  | `subtract` | Saída | `NorthEast` | sai da conta |
  | `add` | Entrada | `SouthWest` | entra na conta |
  | `neutral` | Neutra | `SwapHoriz` | entra no total como informativo |
  | `ignore` | Ignorada | `DoNotDisturbOn` | não entra no total do mês |

  A **legenda dos quatro tipos** vai no slot `subheader` do shell — nunca no `toolbar`, que está sujeito ao gate dos 12 itens e esconderia a legenda numa lista de 6 seções (Spec 67 D12 existe para este caso).
- **Cor** é a identidade da seção: `Section.color` guarda uma **chave** de `accent-colors.ts` (nunca hex), do mesmo jeito que `ResponsibleParty.color`. `null` cai no fallback atual (`getChartColors(mode)` por índice), então nenhuma conta existente fica sem cor. A mesma cor é reusada no ponto de Categorias. **Widgets de dashboard continuam com a paleta por índice nesta spec** (D2 / §5).
- O tipo **não** é comunicado por cor — vai no badge.
- **Modelos** é contagem barata: quantos Modelos de tabela criam tabelas nesta seção, via `TableTemplate.autoSectionId` (é este campo, não `tableTypeId`, que faz um modelo criar tabela numa seção). `—` quando zero.
- A ordem das linhas **é** a ordem das abas do mês (arraste reordena, `@dnd-kit/sortable`).
- Seção **inativa** não aparece em meses novos e não aceita modelos; meses já criados ficam intactos (modal M8 explica exatamente isso).
- Status vem de `Section.isActive` **através do adapter** `resolveActive` da Spec 67 — o `StatusCell` nunca lê `isActive` direto (§7.1).

### 2.2 Categorias — arquétipo B

Colunas: alça · expandir · **Nome** (ponto de cor + nome + "N sub") · **Seção padrão** · **Status** · menu.

- ~~**Seção padrão**~~ — **REVOGADO em 2026-08-11 (D8).** A coluna foi retirada: *"não faz sentido nenhum, foi erro meu de projeto"*. Some da tabela, do formulário de criação e da importação; o filtro por seção da toolbar cai junto (a fonte de dados dele deixou de existir). `Category.defaultSectionId` permanece no banco marcada como **deprecada** — nenhuma migração destrutiva —, e pode ser removida numa limpeza futura.
- **Ponto de cor da categoria**: determinístico pela posição na lista (`fallbackIndex` do `ColorDot`). Sem a seção padrão não há de onde herdar cor, e §5 exclui cor própria por categoria. Subcategoria usa o do pai.
- Toolbar completa (`SettingsToolbar`): busca, filtro por seção, ordenação, botão recolher tudo. Ordenação: **ordem manual** (`Category.order`, novo) · **alfabética** · **usadas recentemente** (`lastUsedAt desc`). Não existe "mais usadas": contar uso exigiria varrer `Transaction`, que o SET-07 da Spec 67 proíbe em lista.
- Busca filtra a árvore **mantendo os pais visíveis**: uma subcategoria que casa arrasta o pai para o resultado, mesmo que o pai não case.
- Subcategorias são linhas indentadas com `bgcolor: "background.subtle"`, ícone `SubdirectoryArrowRight`, e o mesmo `StatusCell` das outras linhas. *(O frame desenha um Switch menor na subcategoria; o tema tem um único tamanho de Switch e criar um segundo seria divergir do design system para ganhar 3px — mantemos o padrão.)*
- Acima de 12 itens, o shell libera a toolbar; acima de 50, entra `SettingsPagination`.
- **Importar / Exportar** — **NOVA FUNCIONALIDADE**: menu secundário no header abrindo o modal **M4** (`size="editor"`, 720px — D6): escolhe CSV/XLSX com colunas `nome, pai, seção, cor`, mostra o resumo **Criar N · Atualizar N · Ignorar N**, a lista linha a linha com a ação e a observação de cada uma ("nova subcategoria", "seção Moradia (antes: sem seção)", "idêntica à existente"), e um toggle opcional "Desativar categorias que não estão no arquivo". Nada é gravado antes da confirmação.
  - ⚠️ **A coluna `cor` não tem destino** (D7). O frame a lista e traz a observação "cor muda para verde", mas D2 decidiu que categoria **não tem cor própria** — ela herda a da seção padrão. A coluna é **aceita** (a planilha do desenho importa sem erro) e **reportada como ignorada** na observação da linha. Recusá-la quebraria o arquivo do próprio frame; silenciar faria o usuário crer que a cor foi aplicada.
  - "Desativar as ausentes" **desativa, nunca exclui**: a categoria pode ter anos de transação atrás dela, e "não estava na planilha" não é motivo para destruir histórico.
  - O servidor **reclassifica** o arquivo na hora de aplicar, em vez de confiar no plano que o cliente exibiu — entre abrir o modal e confirmar, outra pessoa da conta pode ter mexido nas categorias.
- Linha-fantasma sempre visível no fim: Enter cria e abre a próxima; Esc cancela. O botão "Nova categoria" do header rola até ela — não abre modal.

### 2.3 Instituições — arquétipo A

Colunas: **Nome** (monograma colorido + nome) · **Tipo** · **Detalhes** · **Status** · menu. Sem toolbar (9 itens).

- **Tipo** é o enum **novo** `InstitutionKind { bank card broker wallet company }`. Ele é **nullable**: as instituições existentes têm só um nome, e adivinhar que "Nubank" é cartão e "Itaú" é banco rotularia dado do usuário por conta própria. Sem tipo, a coluna mostra `—` e a célula Detalhes fica vazia até o usuário classificar.
- **Detalhes adaptativos** — **NOVA FUNCIONALIDADE** (EST-05): a célula renderiza **só o que existe para o tipo**:
  - `card` → final do número + `fecha D / vence D`;
  - `bank` → agência + conta;
  - `company` → CNPJ;
  - `wallet` e `broker` → nada, com texto explicativo esmaecido ("corretora não tem detalhes").
- Ao trocar o tipo na edição inline, os campos de detalhe **trocam junto**, sem recarregar a linha, e o valor dos campos que saíram é descartado.
- `closingDay`/`dueDay` são **armazenados e exibidos** nesta spec. **O cálculo de parcelas não é tocado** (D3): não existe hoje nenhuma ligação entre `Institution` e `InstallmentGroup`, então não há paridade funcional a preservar — usar essas datas na matemática de parcela é comportamento novo e fica registrado como follow-up em §5.
- Monograma de 2 letras com cor derivada do nome via `accent-colors.ts` — identidade visual reconhecível na importação e no select de transação.

### 2.4 Responsáveis — arquétipo A

Colunas: **Nome** (avatar + nome) · **Membros vinculados** · **Status** · menu. Sem toolbar (4 itens).

- **O modelo N:N já existe** — `ResponsiblePartyMember(partyId, userId)`, e o formulário atual já vincula vários membros. Esta spec entrega a **apresentação e o atalho**: `AvatarGroup max={3}` + nomes na célula, botão `+` tracejado para vincular mais sem abrir o modal, e "nenhum — só rótulo" em itálico para responsável sem ninguém.
- **`ResponsiblePartyKind { personal group external }` permanece** (D4): é ele que governa o `PartyAvatar`, o responsável "pessoal" criado automaticamente para cada membro, e o default em `AccountSettings`. A spec anterior não o mencionava; removê-lo quebraria os três.
- **A regra de "grupo exige ≥2 membros" cai** (D4): o vínculo passa a ser **0..N** para qualquer `kind`, que é o que faz "nenhum — só rótulo" existir de verdade.
- Status vem de `ResponsibleParty.archivedAt` **através do adapter** `resolveActive` — `archivedAt: null` significa **ativo**, e é exatamente essa inversão que o adapter existe para não espalhar pelas listas.
- **A coluna "Padrão em" não é removida — ela nunca existiu.** Modelos de tabela não carregam responsável; o responsável vive em cada `TableTemplateItem` (ver Spec 69, aba "Transações do modelo"). A coluna fica fora, como o frame mostra.

### 2.5 Mesclar — **NOVA FUNCIONALIDADE** (EST-07)

Modal **M5** (`size="form"`, 560px), disponível no menu da linha de **Categorias**, **Instituições** e **Responsáveis** (e de Apelidos, na Spec 70):

- dois selects lado a lado: **Absorver** (será excluída) → **Manter** (recebe tudo);
- "O que será movido" como chips com as contagens reais: `31 transações · 2 apelidos · 1 de-para de template · 0 widgets`;
- **a mesclagem é irreversível** (D5). O aviso diz isso com essas palavras, o botão de confirmação nomeia o total movido, e o evento é registrado na Trilha de auditoria com as contagens. **Não há undo de 7 dias** — ver D5 para o motivo e §5 para o follow-up.

### 2.6 Uso e exclusão (EST-08)

- **Ver uso** (M3, `size="form"`, 560px): três KPIs (Transações · Meses · Último uso), histograma por mês, timestamp da contagem e "Recontar", com atalho "Ver as transações". A action `countUsageAction` **já existe** (Spec 67 §9 P5); o que falta é a **série mensal** para o histograma — nova coluna `UsageCount.byMonth` (Json), preenchida na mesma varredura que já calcula `transactions` e `months`, para não pagar duas passadas por `Transaction`.
- **Excluir com realocação** (M2, `size="form"`, 560px): lista de referências de configuração já verificadas (apelidos, de-para de templates, transações de modelos, filtros de widget), bloco de **transações reais contadas na hora** ("312 transações em 11 meses"), e select obrigatório de destino. "Sem categoria" é uma opção explícita, não um default silencioso. O botão nomeia o total: "Realocar 326 itens e excluir".
  - ⚠️ As referências de **de-para de template** vivem dentro de `CsvTemplate.mapping` (`Json`): não há coluna para filtrar, então a contagem carrega os templates da conta (poucos, limitados) e filtra em JS. É barato, mas **não** é um `count` indexado como as outras quatro.
- **Desativar** (M8, `size="confirm"`, 420px): confirmação curta explicando o efeito exato por tipo de objeto.

---

## 3. User Stories

- Como usuário, quero **ver** na lista se uma seção é de entrada, saída, neutra ou ignorada, sem abrir o modal de edição de cada uma.
- Como usuário, quero encontrar uma categoria entre 65 por busca e filtro de seção, sem rolar a árvore inteira.
- Como usuário, quero dizer em que seção uma categoria normalmente cai, para não decidir isso de cabeça a cada classificação.
- Como usuário novo, quero importar minha árvore de categorias de uma planilha e revisar o que será criado antes de gravar.
- Como usuário, quero que a instituição declare seu tipo e peça só os campos que fazem sentido para ele.
- Como usuário, quero ver na lista quem está vinculado a cada responsável e vincular mais um sem abrir formulário.
- Como usuário, quero mesclar duas categorias duplicadas em uma, levando transações e apelidos junto, sabendo antes que é irreversível.
- Como usuário, quero desativar uma seção que não uso mais sem perder os meses antigos.
- Como owner, quero ver o raio de impacto antes de excluir qualquer item de estrutura.

---

## 4. Critérios de Aceitação

**Seções:**
- A coluna Tipo DEVE exibir o `countType` da seção como chip com ícone, nos quatro valores (`subtract`/`add`/`neutral`/`ignore`), E a legenda dos quatro DEVE aparecer na faixa `subheader` da página **independentemente da quantidade de itens** (não sujeita ao gate dos 12).
- NENHUM enum novo de tipo de seção DEVE ser criado; a coluna DEVE ler `countType` (D1).
- A ordem das seções na lista DEVE ser a ordem das abas do mês; arrastar DEVE persistir a nova ordem via `reorderSectionsAction`.
- A coluna Modelos DEVE mostrar quantos `TableTemplate` têm `autoSectionId` igual à seção, e `—` quando zero.
- O ponto de cor DEVE usar `Section.color` quando presente E cair no fallback da paleta por índice quando `null` — nenhuma seção existente DEVE aparecer sem cor.
- QUANDO uma seção é desativada, ELA NÃO DEVE ser criada em meses novos NEM aceitar novos modelos, E os meses existentes DEVEM permanecer inalterados.

**Categorias:**
- A lista NÃO DEVE ter coluna de seção (D8), E a importação DEVE aceitar a coluna `seção` de planilhas antigas reportando-a como **ignorada** — nunca recusando o arquivo nem aplicando o valor.
- O ponto de cor da categoria DEVE ser determinístico pela posição; a subcategoria DEVE usar o do pai. NENHUMA coluna de cor por categoria DEVE ser criada.
- A exportação DEVE oferecer **CSV e JSON**, e a importação DEVE aceitar **CSV, XLSX e JSON** (D9).
- A toolbar DEVE conter busca, ordenação (manual / alfabética / usadas recentemente) e recolher tudo, E DEVE aparecer somente acima de 12 itens (gate do shell). *(O filtro por seção saiu com a coluna "Seção padrão" — D8.)*
- QUANDO a busca casa uma subcategoria, O PAI DELA DEVE permanecer visível.
- QUANDO o usuário clica em "Nova categoria", A PÁGINA DEVE rolar até a linha-fantasma e focar o campo de nome — E NÃO DEVE abrir modal.
- QUANDO o usuário abre "Importar categorias", O DIÁLOGO DEVE exibir Criar/Atualizar/Ignorar com as contagens e a lista linha a linha, E NADA DEVE ser gravado antes de "Aplicar N mudanças".
- SE o arquivo tiver uma linha cujo `pai` não existe nem no arquivo nem na conta, ESSA LINHA DEVE ser marcada como erro e não impedir as demais.

**Instituições:**
- A coluna Tipo DEVE aceitar `null` e exibir `—` para as instituições que ainda não foram classificadas; NENHUM tipo DEVE ser inferido do nome no backfill.
- A célula Detalhes DEVE renderizar apenas os campos aplicáveis ao tipo: `card` (final + fechamento + vencimento), `bank` (agência + conta), `company` (CNPJ), `wallet`/`broker` (nenhum, com texto explicativo).
- QUANDO o tipo é alterado na edição inline, OS CAMPOS DE DETALHE DEVEM ser substituídos pelos do novo tipo sem perder os demais campos da linha, E o valor dos campos que saíram DEVE ser descartado.
- O cálculo de `InstallmentGroup` NÃO DEVE ser alterado por esta spec (D3): `closingDay`/`dueDay` são persistidos e exibidos, e nada mais.

**Responsáveis:**
- UM responsável DEVE poder ter 0, 1 ou N membros vinculados, **para qualquer `kind`**, exibidos em `AvatarGroup max={3}` com os nomes.
- SE não houver membro vinculado, A CÉLULA DEVE exibir "nenhum — só rótulo".
- O botão `+` da célula DEVE vincular um membro sem abrir o modal de edição.
- `ResponsiblePartyKind` DEVE ser preservado; o responsável "pessoal" automático e o default em `AccountSettings` DEVEM continuar funcionando.
- A página NÃO DEVE renderizar toolbar de busca (≤12 itens).

**Mesclar:**
- O item "Mesclar" DEVE aparecer no menu da linha de Categorias, Instituições e Responsáveis.
- O DIÁLOGO DEVE exibir as contagens reais do que será movido antes de confirmar, E DEVE declarar explicitamente que a operação é irreversível.
- APÓS mesclar, o objeto absorvido DEVE deixar de existir, todas as referências DEVEM apontar para o mantido, E o evento DEVE constar na Trilha de auditoria com as contagens movidas.
- NENHUM mecanismo de undo DEVE ser prometido na UI (D5).

**Exclusão:**
- O diálogo de exclusão DEVE listar referências de configuração com contagem e contar transações na hora.
- O botão de confirmação DEVE permanecer desabilitado enquanto houver referências e nenhum destino escolhido.

**Migração:**
- A migração DEVE ser puramente aditiva: zero `DROP`, `TRUNCATE`, `DELETE` ou `RENAME`.

---

## 5. Fora de Escopo

- Cor por categoria individual — a categoria herda a cor da seção padrão (D2).
- **Cor da seção nos widgets de dashboard** — os 6+ componentes de gráfico (`SectionPieChart`, `MonthlyBarChart`, `MonthSectionBarChart`, `SectionCards`, `SectionBreakdownWidget`, `YearlyLineChart`) continuam com `getChartColors(mode)` por índice. **Follow-up** aberto por D2.
- **`closingDay`/`dueDay` alimentando o cálculo de parcela** — exige `institutionId` em `InstallmentGroup` e uma regra de retroatividade para as parcelas já criadas. **Follow-up** aberto por D3, território da Spec 73.
- **Undo da mesclagem** — cortado por D5. Se voltar à mesa, o desenho viável está registrado ali.
- Regras de rateio entre membros de um responsável compartilhado (divisão de valor) — só o vínculo é entregue aqui.
- Detecção automática de duplicatas sugerindo mesclagem — a mesclagem é sempre iniciada pelo usuário.
- Importação de instituições, responsáveis ou seções por arquivo — só Categorias ganha importação.
- Sincronização de instituições com Open Finance / agregadores.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Onde vive entrada/saída | No `countType` da **seção**, que já existe | Uma fonte de verdade; é a seção que estrutura o mês e já decide o sinal |
| Cor | Chave de `accent-colors.ts` na seção, herdada em categorias | Reuso; tipo comunicado por badge, não por cor (acessibilidade); chave em vez de hex proíbe cor fora do tema |
| Contagem exibida em lista | Só "Modelos" (configuração) | Transação é contada sob demanda (Spec 67 §2.4 / SET-07) |
| Detalhes de instituição | Renderização condicional por tipo, tipo nullable | Evita formulário com campos mortos e evita rotular dado existente por adivinhação |
| Responsável × membro | 0..N, `kind` preservado | Reflete "Compartilhado" e responsável-rótulo sem quebrar avatar/default/pessoal automático |
| Duplicatas | Mesclar irreversível, com auditoria | Ver D5 |
| Importação de categorias | Preview obrigatório com ações por linha | Grava só depois da conferência |
| Criação | Linha-fantasma, nunca modal | Regra global do frame: o botão do header rola até a linha |

### 6.1 Decisões fechadas com o desenvolvedor (2026-08-10)

**D1 · Tipo de seção reusa `countType`; nenhum enum novo.**
A §7.1 original pedia `enum SectionKind { outflow inflow neutral }`. `Section.countType: SectionCountType { add subtract ignore neutral }` já existe e é lido em **55 arquivos** (`month-total`, `forecast/project`, 8 widgets, `mcp/tools`, backup, export, PDF). Um segundo enum criaria duas fontes de verdade para a mesma pergunta — o defeito que o próprio EST-02 denunciava. Consequência aceita: a coluna e a legenda têm **quatro** tipos, não três, porque `ignore` ("não entra no total") e `neutral` ("entra como informativo") são semânticas distintas em dados existentes e colapsá-las perderia informação.

**D2 · `Section.color` é campo novo, com escopo limitado às listas.**
A §7.1 original dizia "já existe" — não existe. Novo `color String?` guardando chave de `accent-colors.ts`, `null` caindo no fallback por índice (nenhuma conta existente fica sem cor, nenhum backfill necessário). O ponto aparece em Seções e Categorias. Trocar a cor dos widgets de dashboard tem raio em 6+ componentes de gráfico e **fica como follow-up** (§5).

**D3 · Instituições ganham os campos; a matemática de parcelas não é tocada.**
O critério original dizia que `closingDay`/`dueDay` deviam "**continuar** alimentando o cálculo de `InstallmentGroup` (paridade funcional)". Premissa falsa: os dois campos não existem em lugar nenhum do schema nem do código, e `InstallmentGroup` não tem `institutionId` — não há paridade a preservar. Esta spec persiste e exibe os campos; ligá-los ao cálculo é comportamento novo, com raio no import de fatura, e fica como follow-up (§5).

**D4 · Responsáveis: `kind` preservado, vínculo relaxado para 0..N.**
A §2.4 original marcava o N:N como "MUDANÇA DE MODELO" — ele **já está entregue** (`ResponsiblePartyMember`, e o formulário já vincula vários). O que a spec não mencionava é o `ResponsiblePartyKind`, que governa `PartyAvatar`, o responsável pessoal automático e o default em `AccountSettings`; ele fica. A validação atual de "grupo exige ≥2 membros" cai, porque é ela que impede "nenhum — só rótulo" de existir.

**D5 · Mesclagem é irreversível: auditoria + confirmação forte, sem undo de 7 dias.**
Desfazer exige saber **quais** linhas se moveram. `AuditLog` cobre o registro, não a reversão, e `Transaction.updatedAt` é `@updatedAt` — tocado por qualquer edição posterior, logo inútil como âncora. O desenho viável era uma tabela nova (`MergeOperation` + ids movidos, com teto de tamanho), e a decisão foi **não** pagar esse custo agora. Em troca, a UI é honesta: o aviso diz "irreversível", o botão nomeia o total movido, e o evento vai para a Trilha com as contagens. Se o undo voltar à mesa, o caminho está aqui.

**D10 · Responsáveis: tudo é responsável, uma tabela só (2026-08-11).**
Regra nova do desenvolvedor: *"a ideia de pessoa externa morre e tudo vira responsável"*. Uma única tabela, todos tratados igual. Quem é convidado ao account ganha automaticamente seu responsável, **com o membro fixo e não editável**. Criar um responsável aceita **0 membros** (rótulo externo), **1** (persona) ou **N** (agrupar).
Implementação: `ResponsiblePartyKind` fica no banco com **dois papéis** — `personal` = automático de um usuário, travado; qualquer outro = comum com 0..N. `external` deixa de ser produzido (o valor permanece no enum do Postgres: remover valor de enum é destrutivo e desnecessário). Motivo de não refazer a modelagem: `Transaction`, `Budget`, `TableTemplateItem`, `AccountSettings.defaultResponsiblePartyId` e a dimensão de planejamento já apontam para esta tabela.
Três migrações corretivas de dados acompanham: `external → group`; criação do pessoal que faltava para membros antigos; e o conserto dos `personal` **sem membro vinculado** — que a UI nova, por travar essas linhas, não teria como resolver. Neste último, quem casa com um membro é vinculado; quem não casa com nenhum vira responsável comum (era rótulo do MVP, não responsável de usuário).

**D11 · Densidade e moldura das quatro listas vêm de um módulo único (2026-08-11).**
`src/components/settings/table/` passa a ser a tabela das quatro páginas: altura de linha (34px, contra 55px do override global de `MuiTableCell`), cabeçalho curto em mono com fundo mais escuro, alça colada ao nome, elipses 16px cinza, seletor e campo inline que **não esticam a linha**, ações de edição na ordem X→check com o check em accent, marcação lateral de linha em edição, e a linha de criação **dentro** da tabela, alinhada às colunas. Motivo de não mexer no tema: o override global de `MuiTableCell` serve às tabelas de mês e de transações, densas por outro motivo.
Junto: o cap de largura (`containers.lg`) saiu das listas via `wideContent` — ficou só nos formulários —, e o scroll passou do wrapper do layout para a área de conteúdo do shell, de modo que **o cabeçalho da página e a toolbar não rolam** e o cabeçalho de coluna fica pregado no topo.

**D12 · Backfill de `lastUsedAt` (2026-08-11).**
A Spec 67 §7.4 escolheu gravar na escrita, sem backfill — então toda conta existente exibia "nunca usada" em objetos com centenas de transações. A informação não estava faltando: estava **errada**. Migração deriva a data da transação mais recente que referencia cada objeto. No banco de desenvolvimento: 4/9 seções, 29/37 categorias, 9/10 instituições e 3/4 responsáveis passaram a mostrar data real.

**D8 · A coluna "Seção padrão" de Categorias foi retirada (2026-08-11).**
Decisão do desenvolvedor ao ver a tela: *"não faz sentido nenhum, foi erro meu de projeto"*. Consequências em cascata, todas aplicadas: o `Select` inline sai; o `Chip "herda"` da subcategoria sai (ele existia só para dizer que ela herdava a seção do pai); o **filtro por seção da toolbar** sai, porque a fonte de dados dele deixou de existir; a coluna `seção` do arquivo de importação passa a ser tratada como a coluna `cor` (aceita, ignorada, reportada); e o ponto de cor da categoria, que derivava da seção, passa a ser determinístico pela posição. `Category.defaultSectionId` fica no banco **deprecada**, sem migração destrutiva.

**D9 · Importar e exportar categorias em CSV e JSON (2026-08-11).**
Pedido do desenvolvedor. Export oferece CSV e JSON (`{nome, pai}[]`); import aceita CSV, XLSX e JSON. O classificador (`category-import.ts`) já era agnóstico de formato — o ramo novo vive só no leitor de arquivo (`category-import-file.ts`).

**D7 · A coluna `cor` da importação é aceita e ignorada, com aviso na linha.**
Divergência encontrada **durante a implementação**, não no planejamento: o frame do M4 lista `cor` entre as colunas do arquivo, mas D2 tirou a cor própria da categoria (ela herda a da seção padrão). Ou seja, a coluna não tem para onde ir. Recusar o arquivo quebraria a planilha do próprio desenho; aceitar em silêncio faria o usuário concluir que a cor foi aplicada. A classificação aceita a coluna e escreve "cor ignorada" na observação da linha.

**D6 · M4 usa `size="editor"` (720px), não 620px.**
O catálogo de larguras da Spec 67 é fechado em 420/560/720 (D8 lá), e o `SettingsDialog` bloqueia largura sob medida de propósito. 720px dá 100px a mais que o frame, e a folga cai bem na tabela de preview de quatro colunas (Ação · Nome · Pai · Observação). Abrir uma quarta largura convidaria a quinta.

---

## 7. Referências Técnicas

> ⚠️ Os caminhos abaixo **corrigem** a versão anterior desta seção, que apontava para arquivos inexistentes (`src/actions/sections.ts`, `categories.ts`, `institutions.ts`).

| Item | Arquivo(s) | Situação |
|---|---|---|
| Rotas | `src/app/(app)/[accountId]/settings/{sections,categories,institutions,responsibles}/page.tsx` | existem, já usam o shell |
| Componentes de Seções | `src/components/settings/sections/*` | **novo diretório** — o `SectionsManager` atual sai de `app/.../sections/` |
| Componentes de Categorias | `src/components/settings/categories/*` | **novo diretório** — idem `CategoriesManager` |
| Componentes de Instituições | `src/components/settings/institutions/*` | **novo diretório** — idem `InstitutionsManager` |
| Componentes de Responsáveis | `src/components/settings/responsibles/*` | **novo diretório** — idem `ResponsiblePartiesManager` |
| Actions de seções/categorias/instituições | `src/actions/account-settings.ts` | **estender** (não existe `src/actions/sections.ts`) |
| Actions de responsáveis | `src/actions/responsible-parties.ts` | **estender** |
| Schemas | `src/lib/schemas/settings.ts` | **estender** (campos novos) |
| Mensagens | `src/lib/messages/pt-BR.ts` → bloco `settings.structure` | **novo bloco** |
| Contagem de uso | `src/actions/settings-usage.ts` + `src/server/services/settings-usage-service.ts` | **existem**; service ganha a série mensal |
| Importar categorias | **novo** `src/components/settings/categories/ImportCategoriesDialog.tsx` + **nova** `importCategoriesAction` | novo |
| Mesclar | **novo** `src/components/settings/MergeDialog.tsx` + **nova** `mergeEntityAction` | novo |
| Detalhes adaptativos | **novo** `src/components/settings/institutions/InstitutionDetailsFields.tsx` | novo |
| Ver uso (M3) | **novo** `src/components/settings/UsageDialog.tsx` | novo |
| Excluir com realocação (M2) | **novo** `src/components/settings/DeleteWithReallocationDialog.tsx` | novo |
| Arraste | `@dnd-kit/core` + `@dnd-kit/sortable` | já são dependências; padrão em `DashboardGridCanvas.tsx` |
| CSV/XLSX | `papaparse` + `xlsx` | já são dependências |

### 7.1 Prisma — o que muda de verdade

Migração **puramente aditiva**. Nomes abaixo são os reais do schema, não os da versão anterior desta spec.

```prisma
// ── NOVO ────────────────────────────────────────────────────────────────
enum InstitutionKind {
  bank
  card
  broker
  wallet
  company

  @@map("institution_kind")
}

model Section {
  // countType: SectionCountType  ← JÁ EXISTE (add|subtract|ignore|neutral). D1: é este
  //                                 campo que a coluna "Tipo" renderiza. NÃO criar enum novo.
  // isActive: Boolean            ← JÁ EXISTE. Ler SEMPRE via resolveActive(), nunca direto.
  color               String?    // NOVO — chave de accent-colors.ts (nunca hex). null = fallback por índice
  defaultOfCategories Category[] // NOVO — back-relation de Category.defaultSectionId
}

model Category {
  // NÃO existe campo kind/type nesta tabela — não há nada a remover (EST-02 corrigido)
  defaultSectionId String?  @map("default_section_id")  // NOVO
  order            Int      @default(0)                 // NOVO — arraste + "ordem manual"
  defaultSection   Section? @relation(fields: [defaultSectionId], references: [id], onDelete: SetNull)

  @@index([accountId, order])
}

model Subcategory {
  order Int @default(0)  // NOVO — ordem dentro do pai

  @@index([categoryId, order])
}

model Institution {
  kind       InstitutionKind? // NOVO e NULLABLE — ver §4: nenhum tipo é inferido do nome
  last4      String?          // NOVO — card
  closingDay Int?             // NOVO — card (exibido; NÃO alimenta InstallmentGroup — D3)
  dueDay     Int?             // NOVO — card (idem)
  branch     String?          // NOVO — bank
  accountNo  String?          @map("account_no") // NOVO — bank
  taxId      String?          @map("tax_id")     // NOVO — company
}

model UsageCount {
  byMonth Json? @map("by_month")  // NOVO — série do histograma do M3, preenchida na
                                  // MESMA varredura que já calcula transactions/months
}

// ── SEM MUDANÇA ─────────────────────────────────────────────────────────
// ResponsibleParty        — kind, icon, color, archivedAt, members[] JÁ EXISTEM
// ResponsiblePartyMember  — (partyId, userId) JÁ EXISTE; a mudança é só de validação (D4)
// AuditLog                — serve o registro da mesclagem como está
// (nenhuma tabela MergeOperation — D5 dispensou o undo)
```

**Backfill:**

| Campo | Backfill | Motivo |
|---|---|---|
| `Section.color` | **nenhum** (fica `null`) | O fallback por índice já dá cor a toda seção existente; escrever chave agora congelaria uma escolha que o usuário não fez |
| `Category.order` | sequencial por `name asc`, por conta | A lista atual é alfabética; preserva a ordem que o usuário já vê |
| `Subcategory.order` | sequencial por `name asc`, por categoria | idem |
| `Category.defaultSectionId` | **nenhum** (fica `null`) | Adivinhar a seção pelo nome erraria; a coluna mostra `—` até o usuário escolher |
| `Institution.kind` | **nenhum** (fica `null`) | §4: nada é inferido do nome |
| `UsageCount.byMonth` | **nenhum** | Preenche na próxima contagem; TTL de 24h renova naturalmente |

**Status por entidade — sempre via adapter.** As quatro entidades guardam status em colunas diferentes e o `StatusCell` recebe `active` já normalizado por `resolveActive` (Spec 67 §7.4):

| Entidade | Coluna | Cuidado |
|---|---|---|
| `Section` | `isActive: Boolean` | `false` = inativa |
| `Category` / `Subcategory` / `Institution` | `status: SettingsStatus` | `inactive` = inativa |
| `ResponsibleParty` | `archivedAt: DateTime?` | **`null` = ATIVA** — inversão que o adapter existe para não espalhar |

### 7.2 Padrão de linha editável (arquétipos A e B)

```tsx
// ✅ Correto — linha-fantasma controlada, Enter cria e reabre.
// O componente GhostRow (Spec 67) já implementa Enter/Esc, o foco no primeiro campo
// e o hint; a página só fornece os campos e os callbacks.
<GhostRow
  ref={ghostRef}
  editing={draft !== null}
  canCommit={draft?.name.trim().length > 0}
  onStartEditing={() => setDraft(emptyDraft)}
  onCancel={() => setDraft(null)}
  onCommit={commitAndReopen}
>
  <TextField value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
</GhostRow>

// ❌ Anti-padrão — botão do header abrindo modal para um objeto de 2 campos
<Dialog open><TextField label="Nome" /></Dialog>

// ❌ Anti-padrão — reimplementar Enter/Esc/foco na página em vez de usar o GhostRow
```

### 7.3 Detalhes adaptativos

```tsx
// ✅ Correto — um mapa tipo → campos; a célula nunca renderiza campo morto
const DETAIL_FIELDS: Record<InstitutionKind, ReadonlyArray<InstitutionDetailField>> = {
  card: ["last4", "closingDay", "dueDay"],
  bank: ["branch", "accountNo"],
  company: ["taxId"],
  wallet: [],
  broker: [],
};

// `kind: null` (instituição não classificada) não entra no mapa: a célula mostra `—`.

// ❌ Anti-padrão — todos os campos sempre, desabilitando os que não se aplicam
```

### 7.4 Restrições do design system

- `Chip size="small"` para tipo de seção, contagens e "herda"; ícone via `icon` do próprio Chip.
- `AvatarGroup max={3}` para membros vinculados; avatar com iniciais e cor de token, nunca hex.
- Arraste com `@dnd-kit/core` + `@dnd-kit/sortable`; alça sempre `DragIndicator`, nunca a linha inteira arrastável.
- Ponto de cor: `Box` 8–9px, `borderRadius: "3px"` — **um único** `ColorDot` compartilhado por Seções, Categorias, chips de transação e legendas de widget.
- Borda de linha em edição: **longhand** (`borderLeftWidth` + `borderStyle` + `borderColor`). O shorthand `borderLeft: 2` dentro de valor responsivo reseta `border-left-color` para `currentColor` e a borda sai na cor do texto — armadilha documentada no skill `design-system`.
- Larguras de modal: só as três do catálogo (`confirm` 420 / `form` 560 / `editor` 720).
- Nenhum token `success.subtle` / `warning.subtle` / `error.subtle` — não existem no tema e o MUI descarta a regra em silêncio. Usar `.light` ou `danger.subtle`.

### 7.5 Mapeamento frame → componente (normativo)

**Reaproveitar sem alterar (11):** `SettingsPageShell`, `SettingsToolbar`, `SettingsPagination`, `GhostRow`, `StatusCell`, `RowActionsMenu`, `SettingsDialog`, `SettingsEmptyState`, `PartyAvatar`, `resolveActive`, `countUsageAction`.
Cinco dessas nasceram na Spec 67 com **zero consumidores**; esta spec é onde entram em uso.

**Estender (4):** `settings-usage-service` (série mensal), `account-settings.ts`, `responsible-parties.ts`, `pt-BR.ts`.

**Novo (14):** `ColorDot`, `SectionKindChip`, `SectionKindLegend`, `SectionsTable`, `CategoriesTree`, `CategoryRow`, `InstitutionMonogram`, `InstitutionDetailsFields`, `PartyMembersCell`, `UsageDialog`, `DeleteWithReallocationDialog`, `MergeDialog`, `ImportCategoriesDialog`, `useSortableRows`.

#### 01 · Seções

| Frame | Componente real | Situação |
|---|---|---|
| Painel · breadcrumb · título · chip · propósito · botão primário | `SettingsPageShell` | reaproveitar |
| Faixa "Tipos" com as pílulas explicadas | `SectionKindLegend` no slot `subheader` | novo |
| Cabeçalho de colunas (grid 22/1fr/108/96/132/30) | `TableHead` + `TableCell variant="head"` | novo (hoje é `Stack` de `Paper`) |
| `drag_indicator` + reordenar | `DragIndicator` + `useSortableRows` | novo |
| Ponto de cor + nome | `ColorDot` + `Typography` | novo |
| Pílula Saída/Entrada/Neutra/Ignorada | `SectionKindChip` (lê `countType`) | novo |
| "2" / "—" em Modelos | `Typography variant="caption"` mono | novo |
| Switch + "usada em jul" | `StatusCell` | reaproveitar |
| `more_horiz` | `RowActionsMenu` | reaproveitar |
| "Adicionar seção…" | `GhostRow` | reaproveitar |

#### 02 · Categorias

| Frame | Componente real | Situação |
|---|---|---|
| Toolbar (busca · filtro · ordenação · recolher) | `SettingsToolbar` (slots `search`/`filters`/`sort`/`end`) | reaproveitar |
| Chevron de expandir | `IconButton` + `Set` de expandidos | novo |
| Ponto + nome + "4 sub" | `ColorDot` + `Chip size="small"` | novo |
| Linha de subcategoria (fundo distinto, indent) | `TableRow` `bgcolor: "background.subtle"` + `SubdirectoryArrowRight` | novo |
| "Seção padrão" / "herda" | `Select` inline / `Chip "herda"` | novo |
| Linha-fantasma com hint | `GhostRow` | reaproveitar |
| Menu "Importar / Exportar" | `secondaryActions` do shell + `Menu` | reaproveitar |
| Paginação (>50) | `SettingsPagination` | reaproveitar |
| `Accordion` atual | — | **substituído** por Table hierárquico |

#### 03 · Instituições

| Frame | Componente real | Situação |
|---|---|---|
| Monograma 22px colorido | `InstitutionMonogram` | novo |
| Coluna Tipo (texto / select em edição) | `Select size="small"` | novo |
| Célula Detalhes adaptativa | `InstitutionDetailsFields` + `DETAIL_FIELDS` | novo |
| "corretora não tem detalhes" / "—" | `Typography variant="caption"` itálico | novo |
| Linha em edição com borda esquerda accent | `TableRow` + borda **longhand** | novo |
| Status · menu · linha-fantasma | `StatusCell` · `RowActionsMenu` · `GhostRow` | reaproveitar |

#### 04 · Responsáveis

| Frame | Componente real | Situação |
|---|---|---|
| Avatar do nome | `PartyAvatar` | reaproveitar |
| Avatares + nomes dos membros | `PartyMembersCell` (`AvatarGroup max={3}`) | novo |
| Botão `+` tracejado | `IconButton` borda dashed + `Menu` de membros | novo |
| "nenhum — só rótulo" | `Typography` itálico | novo |
| Ausência de toolbar (4 itens) | gate >12 do shell | reaproveitar |

#### Modais

| Frame | Componente | Largura |
|---|---|---|
| M2 · Excluir com realocação | `DeleteWithReallocationDialog` | `form` (560) |
| M3 · Ver uso | `UsageDialog` | `form` (560) |
| M4 · Importar categorias | `ImportCategoriesDialog` | `editor` (720 — D6) |
| M5 · Mesclar | `MergeDialog` | `form` (560) |
| M8 · Desativar | `SettingsDialog size="confirm"` | `confirm` (420) |

---

## 8. Critérios de Teste

**Unit:**
- `SectionKindChip`: os **quatro** valores de `countType` mapeiam para rótulo + ícone, sem valor órfão.
- `SectionKindLegend` renderiza mesmo com `itemCount` baixo (vai no `subheader`, não no `toolbar`).
- Cor de seção: `color` presente vence; `null` cai no fallback por índice.
- `DETAIL_FIELDS` cobre os 5 tipos de instituição, sem campo órfão; `kind: null` não renderiza campo.
- Troca de tipo na edição descarta o valor dos campos que saíram.
- Categorias: busca que casa subcategoria mantém o pai no resultado; filtro por seção reduz corretamente; ordenação "usadas recentemente" ordena por `lastUsedAt desc` com `null` no fim.
- Ponto de cor da categoria deriva da seção padrão; subcategoria herda do pai.
- Parser do CSV/XLSX de categorias: classificação criar/atualizar/ignorar/**erro** por linha, incluindo pai inexistente e cor inválida.
- Responsáveis: 0, 1 e N membros renderizam célula correta; 0 membros dá "nenhum — só rótulo" para **qualquer** `kind`.
- `resolveActive` é a única leitura de status nas quatro listas (nenhum acesso direto a `isActive`/`status`/`archivedAt` nos componentes).
- Merge: união de referências sem duplicar; objeto absorvido deixa de existir; evento gravado em `AuditLog` com as contagens.
- **Multi-tenancy em toda mutation nova** (`importCategoriesAction`, `mergeEntityAction`, updates de campo novo): `accountId` de outra conta é rejeitado.
- `UsageCount.byMonth` é preenchido na mesma varredura de `transactions`/`months` (uma passada, não duas).

**E2E:**
- Criar seção pela linha-fantasma, definir tipo Entrada (`add`), arrastar para a 2ª posição → abas do mês refletem a ordem e o tipo.
- Desativar seção → não aparece na criação do próximo mês; mês anterior intacto.
- Buscar "merc" em Categorias filtra a árvore mantendo os pais visíveis; filtro por seção reduz corretamente.
- Definir seção padrão de uma categoria → a subcategoria passa a exibir "herda".
- Importar CSV de categorias: preview mostra 14 criar / 7 atualizar / 3 ignorar; cancelar não grava nada; aplicar grava exatamente 21.
- Trocar tipo de instituição de Cartão para Corretora → campos de fechamento/vencimento desaparecem e o valor é descartado.
- Vincular dois membros a "Compartilhado" pelo `+` da célula → `AvatarGroup` com 2; desvincular todos → "nenhum — só rótulo".
- Mesclar "Restaurantes" em "Restaurante" → 31 transações movidas, absorvida sumiu, evento na auditoria. **O diálogo declara que é irreversível e não oferece undo.**
- Excluir categoria com 312 transações: confirmação bloqueada até escolher destino; após excluir, transações apontam ao destino.

---

## 9. Plano de Pacotes

Um pacote por vez. Ao fim de cada um: `typecheck` + unit afetados + e2e do pacote, e **uma lista consolidada** de divergências — não erro a erro. Nenhum pacote avança com verificação pendente ou falhando.

| # | Pacote | Conteúdo | Depende de |
|---|---|---|---|
| **P1** | Schema + backfill | Uma migração aditiva: `Section.color`, `Category.defaultSectionId`+`order`, `Subcategory.order`, `enum InstitutionKind` + 7 campos de instituição, `UsageCount.byMonth`. Backfill da tabela de §7.1. Schemas Zod e mensagens novas. | — |
| **P2** | Seções | `SectionsTable`, `SectionKindChip`, `SectionKindLegend` no `subheader`, contagem Modelos, `ColorDot`, `StatusCell`, `RowActionsMenu`, `GhostRow`, arraste com `useSortableRows`. Sai o modal de criação. | P1 |
| **P3** | Categorias | Árvore em `Table`, `SettingsToolbar` completa, "Seção padrão"/"herda", `ColorDot` herdado, linha-fantasma, arraste, `SettingsPagination`. Sai o `Accordion`. | P1, P2 (`ColorDot`) |
| **P4** | Instituições | `InstitutionMonogram`, `InstitutionDetailsFields` + `DETAIL_FIELDS`, edição inline por tipo, `kind` nullable com `—`. | P1 |
| **P5** | Responsáveis | `PartyMembersCell` (`AvatarGroup` + `+` inline), vínculo 0..N, "nenhum — só rótulo", `kind` preservado. | P1 |
| **P6** | Mesclar | `MergeDialog` + `mergeEntityAction` + registro em `AuditLog`, sem undo (D5). Item "Mesclar" no `RowActionsMenu` de Categorias, Instituições e Responsáveis. | P3, P4, P5 |
| **P7** | Importar categorias | `ImportCategoriesDialog` (`size="editor"`) + `importCategoriesAction`, parser CSV/XLSX com classificação por linha, toggle "desativar as ausentes". | P3, D6 |
| **P8** | Fiar M2/M3/M8 | `UsageDialog` (com `byMonth`), `DeleteWithReallocationDialog` (referências + contagem na hora + destino obrigatório), M8 nas quatro páginas. | P2–P5, P1 (`byMonth`) |

**Movimentação de arquivos (P2–P5).** Cada pacote move seu manager de `src/app/(app)/[accountId]/settings/<pg>/XManager.tsx` para `src/components/settings/<pg>/`, junto com a reescrita. As `page.tsx` continuam onde estão (RSC de carga) e passam a importar do novo caminho. As actions **não** se movem — dividir `account-settings.ts` seria churn sem ganho.

**Verificação (todo pacote, dentro do container):**

```bash
docker compose exec app pnpm typecheck
docker compose exec app pnpm test
bash scripts/e2e.sh <spec-do-pacote>
```

**P1 tem passos extra obrigatórios**, sob pena de erro em runtime com typecheck limpo:

```bash
docker compose exec app pnpm prisma migrate dev --name spec68_estrutura_<descritivo>
docker compose exec app pnpm prisma generate
docker compose restart app   # o next dev mantém o Prisma Client antigo em memória
```

E **depois de qualquer execução de e2e** (o runner escreve no `node_modules` compartilhado):

```bash
docker compose up -d
docker compose exec app pnpm prisma generate
docker compose restart app
```

> Ver `CLAUDE.md` §8 para o histórico dos dois incidentes que motivaram esses dois blocos.

---

## 10. Follow-ups abertos

| # | Item | Aberto por |
|---|---|---|
| FU-1 | Widgets de dashboard passarem a usar `Section.color` em vez da paleta por índice (6+ componentes de gráfico) | D2 |
| FU-2 | `closingDay`/`dueDay` alimentarem o cálculo de `InstallmentGroup` (exige `institutionId` no grupo + regra de retroatividade) | D3 |
| FU-3 | Undo da mesclagem, se voltar à mesa: `MergeOperation` + ids movidos com teto de tamanho | D5 |
| FU-4 | Contagem de "de-para em templates" é varredura de `CsvTemplate.mapping` (Json) em JS, não `count` indexado — revisitar se o volume de templates crescer | §2.6 |
| FU-5 | **Mesclar / Ver uso / excluir com realocação na linha de SUBCATEGORIA.** O backend já suporta (inclusive a guarda de "mesmo pai"), mas a UI expõe as três ações só na linha de categoria. Duplicata de subcategoria ("Mercado" sob dois pais) é caso real. | §2.5, fronteira da implementação |
| FU-6 | Responsáveis **pessoais** ficam numa listagem separada, sem `StatusCell` nem "Ver uso" — o frame os desenha na mesma tabela das demais linhas. Comportamento herdado da tela anterior, preservado; a spec não decidiu a apresentação. | crítica visual |
| FU-7 | `settings-service.test.ts` e `settings-split.test.ts` são quase-duplicatas pré-existentes que **divergiram** nesta entrega (os testes novos entraram só no primeiro). Consolidar num arquivo antes que virem duas fontes de verdade. | revisão de convenções |
| FU-8 | `loginAs` (`e2e/fixtures/login.ts`) é flaky sob carga: o setup do `viewer` estoura os 45 s e derruba a suíte inteira por dependência de projeto. Reproduzido 3× nesta sessão em specs que passavam minutos antes. | verificação final |

---

## 11. Notas de implementação (2026-08-10)

**O que a implementação descobriu, além das 17 divergências do planejamento:**

- **`stripInapplicableDetails` apagava detalhes em update parcial.** `kind: undefined` ("não mencionei") era tratado como `null` ("sem tipo"), e o payload do toggle de status inline — `{ institutionId, name, status }` — zerava final do cartão, agência e CNPJ em silêncio. Corrigido na fonte, com dois testes de regressão; a armadilha (`undefined` × `null` ao derivar campos) foi para `skills/server-actions/SKILL.md`.
- **`updateResponsibleParty` recusava membros em `external`.** O guard `kind !== "group"` sobreviveu ao D4: o botão "+" da célula aparece em grupo e em externo, e clicar num externo estourava. Agora só `personal` é protegido (ele é automático de um membro).
- **`DndContext` não pode envolver só o `<TableBody>`.** O dnd-kit injeta `<div>`s de acessibilidade como irmãos do conteúdo, e `<div>` dentro de `<tbody>` é HTML inválido, com warning de hidratação. Documentado em `SortableRows.tsx`. Em Categorias, o painel de subcategorias virou uma `<TableRow colSpan>` com `<Table>` aninhada — `<table>` dentro de `<td>` é válido.
- **`text.disabled` mede ~2,1:1 e não serve para texto que carrega informação.** Estava em "nenhum — só rótulo", "corretora não tem detalhes", nos rótulos do histograma e em dois rodapés. Padronizado em `text.tertiary` (~4,7:1), o mesmo que o `StatusCell` já escolhera pelo mesmo motivo.
- **Guardas que a UI mascarava, mas a action não tinha**: mesclar responsável `personal` (excluiria o automático de um membro) e mesclar subcategorias de pais diferentes (deixaria `categoryId` e `subcategoryId` incoerentes). As duas agora falham no serviço, com teste.
- **Exclusão com realocação reusa `mergeEntityAction`** quando há destino: mesclar É "mover tudo para o destino e excluir". Sem destino, cai na action de exclusão existente e as FKs viram `null` — que é o "sem categoria" explícito. Nenhuma action nova, nenhuma segunda implementação do mesmo movimento.

**Verificação da entrega:** `pnpm typecheck` limpo · `pnpm test` **1882/1883** (a única falha, `table-type-service.test.ts`, é anterior a esta spec) · `eslint` 0 erros no escopo · e2e `settings-structure` **6/6** e `settings-hub` sem regressão · app responde.
