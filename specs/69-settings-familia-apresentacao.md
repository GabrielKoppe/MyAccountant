# Spec 69 — Configurações · Família 2: Apresentação

> Status: draft
> Insumo: frames **"MyAccountant Settings — Arquitetura"** e **"MyAccountant Settings — Todas as Páginas v2"** (telas 05 Tipos de tabela + 05b abas, 06 Modelos + 06b Transações do modelo, 07 Dashboards + 07b matriz tamanho→visualização + 07c paleta de widgets)
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`react-best-practices`](../skills/react-best-practices/SKILL.md)
> Depende de: **Spec 67** (shell, arquétipo C, modais) · **Spec 66** (linha de transação — `rowLayout`/densidade são hospedados aqui)

---

## 0. Blueprint

As telas 05, 05b, 06, 06b, 07, 07b e 07c do frame v2 são normativas. É a família mais estruturalmente exigente: três páginas de arquétipo C, todas com lista mestre à esquerda, abas no detalhe e **preview ao vivo** — o preview não é enfeite, é o que torna a configuração compreensível sem tentativa e erro.

---

## 1. Problema

- **APR-01 · Tipo de tabela configurado às cegas**: colunas visíveis, ordem e densidade são editados num modal sem ver o resultado. O usuário salva, volta ao mês, não gosta, e repete o ciclo.
- **APR-02 · Sem lugar para o `rowLayout` da Spec 66**: a Spec 66 introduz duas organizações de linha (colunas fixas vs. pílulas). Não existe hoje tela onde essa escolha caiba com preview.
- **APR-03 · Densidade é preferência de usuário, não do tipo**: hoje a densidade (quando existe) é global. Uma tabela de cartão com 8 colunas e uma de receitas com 5 pedem densidades diferentes.
- **APR-04 · Ambiguidade de arrastar × selecionar em chips de coluna**: no protótipo anterior, clicar num chip de coluna podia selecionar ou iniciar arraste.
- **APR-05 · Modelo de tabela não tem o que importa**: hoje o modelo define nome e tipo, mas **não** guarda as transações que ele deve criar — que é justamente a automação que o usuário quer. Também mistura campos que só fazem sentido sob automação (seção de destino, ordem) com campos gerais.
- **APR-06 · Dashboards é uma lista de blocos**: a página atual de dashboards em settings é uma lista de widgets ativáveis. Não representa a realidade — são **3 páginas reais** (Mensal, Anual, Resumo do mês) com layout espacial.
- **APR-07 · Tamanho e visualização desconectados**: um gráfico de rosca dentro de um bloco de 3 colunas é ilegível; nada impede hoje.
- **APR-08 · Sem visão de onde um tipo é usado**: mudar as colunas de "Cartão de crédito" afeta N modelos e N tabelas reais, invisivelmente.

---

## 2. Solução

### 2.1 Tipos de tabela — arquétipo C, 3 abas

Lista mestre (216–260px) com nome + resumo `8 col · pílulas · 2 modelos`; tipo sem modelo aparece esmaecido. Detalhe em três abas, rodapé de salvar fixo.

**Aba 1 · Colunas & layout**
- **Organização da linha** (Spec 66): dois cards com radio e miniatura — **A · Colunas fixas** (grade alinhada, boa para comparar valores) e **B · Pílulas** (atributos como chips, melhor para muitos campos opcionais).
- **Densidade** — **NOVA FUNCIONALIDADE** (APR-03): três cards `Compacta 36px/0.78rem`, `Padrão 44px/0.8125rem`, `Confortável 52px/0.8125rem`, cada um com miniatura de duas linhas reais. ⚠️ **Escala recalibrada — ver D9.** O frame desenha 28/36/44, mas a linha real media **52,5px**: nenhum dos três níveis reproduzia o tamanho atual, e como todo tipo existente nasce em `default`, a escala do frame encolheria toda tabela em ~31% de uma vez. É **propriedade do tipo**, não preferência do usuário. Implementação: enum `density` no `TableType` → atributo `data-density` na raiz da tabela → **3 variáveis CSS** (altura da linha, tamanho da fonte, altura do controle). Nenhum recálculo de layout em JS; vale para leitura, edição e a barra de gavetas.
- **Colunas visíveis**: chips arrastáveis num container; **só a alça arrasta e só o × remove** (APR-04) — clicar no corpo do chip não faz nada. Abaixo, **Disponíveis** com chips esmaecidos e `+` que adiciona ao fim.
- **Pré-visualização ao vivo**: duas linhas de transação de exemplo renderizadas com o layout, a densidade e as colunas escolhidas neste instante.

**Aba 2 · Comportamento**
- Ordenação padrão; Agrupar por (nenhum / categoria / responsável / parcela).
- Totais e linhas: total no rodapé, subtotal por grupo, seleção e edição em massa, manter a linha-fantasma de criação sempre visível.
- Colunas fixadas à esquerda (chips).
- **Ao criar linha nova, herdar** (chips): data da linha anterior, responsável, categoria, instituição.

**Aba 3 · Onde é usado** (APR-08)
- **Modelos de tabela que usam este tipo** — contagem barata, lista clicável com a seção de cada modelo.
- **Tabelas e transações reais** — contagem **sob demanda** (Spec 67 §2.4): cartão explicando o custo, botão "Contar", e depois o resultado com timestamp ("24 tabelas em 12 meses · 488 transações") e "Recontar". Cache de 24 h.

### 2.2 Modelos de tabela — arquétipo C, 3 abas

Lista mestre com `cartão de crédito · 6 transações`. Propósito: "Tabelas financeiras pré-montadas, com suas transações. Usadas ao criar um mês novo e ao adicionar uma tabela dentro de um mês."

**Aba 1 · Definição**
- Nome da tabela; Tipo de tabela (com hint "Define colunas, densidade e layout da linha").
- **Automação**: toggle "Criar esta tabela em todo mês novo". **Seção de destino** e **Ordem dentro da seção** aparecem **apenas sob a automação**, num bloco indentado com barra de acento — sem automação, o usuário escolhe a seção no momento de inserir a tabela.
- **Correções explícitas ao modelo atual**: **Instituição sai** (depende de redesenho da tabela financeira); **"Parcelas em aberto"** e **"recorrentes do mês anterior" saem** — o modelo já é a fonte do que será criado.

**Aba 2 · Transações do modelo** — **NOVA FUNCIONALIDADE, o core da automação** (APR-05)
- Mini-tabela editável renderizada **com o tipo do próprio modelo** (mesmo layout e densidade que a tabela real terá), com aviso "Linha renderizada com o tipo Cartão de crédito · layout pílulas".
- Colunas: alça · **Dia** · Descrição · Categoria · Responsável · Valor · menu.
- **Dia é relativo** — `dia 5`, `último dia`, `primeiro dia útil` — e resolve para a data real no mês em que a tabela nascer.
- **Valor 0,00 significa "criar em branco para o usuário preencher"**.
- Parcela aparece como chip na descrição (`3/12`) quando o item é parcelado.
- Linha-fantasma para adicionar; ação secundária **"Importar de um mês"** (puxa as transações de uma tabela real existente como ponto de partida); total do modelo no rodapé da lista.

**Aba 3 · Onde é usado** — meses/tabelas criados a partir deste modelo (contagem sob demanda, mesmo padrão da §2.1).

### 2.3 Dashboards — **REDESENHO COMPLETO** (APR-06)

> ⚠️ **Premissa desatualizada — ler §12/DIV-1 e §13/D1 antes de implementar.** O APR-06
> descreve a página de Dashboards como "uma lista de blocos ativáveis". Isso deixou de ser
> verdade nas Specs 33/36/38: existe um **editor de grid espacial completo** (arrastar com
> snap, redimensionar por alça com push, paleta arrastável, painel de configuração por
> widget, salvamento otimista), em **6 colunas** e com `sizeVariants` por widget. O que esta
> §2.3 pede e ainda NÃO existe é o comportamento em volta do grid (undo/redo, publicar ×
> descartar, paleta agrupada em gaveta, matriz tamanho→visualização, chip de tamanho, slot
> vazio) — **não** o grid em si. A decisão **D1** mantém as 6 colunas e entrega só o delta.

Não é lista de blocos: é um **editor de grid ao vivo**, no espírito de widgets de Android.

- **Três páginas** em `ToggleButtonGroup`: Mensal · Anual · Resumo do mês. Chip com `6 widgets · 4 linhas`.
- **Grid 12 colunas × linhas de 80px**; larguras permitidas 3 / 4 / 6 / 8 / 12; alturas 1 a 3. Canvas com guias verticais das colunas.
- **Arrastar** posiciona (alça no topo do widget), **alças nas bordas/canto redimensionam**, com snap ao grid. **Undo/redo** na toolbar. Cada widget mostra seu tamanho atual em chip (`4×2`).
- Widget selecionado ganha borda de acento + halo, e abre o **inspetor lateral (262px)**: Tamanho (colunas 3/4/6/8/12 e linhas 1/2/3), **Visualização** (radio com ícone), Fonte de dados, Filtros (chips), toggles "Mostrar título" e "Permitir interação do usuário", e no rodapé Duplicar / Excluir.
- **Slot vazio** tracejado no fim: "Arraste um widget aqui ou clique para escolher".
- **Paleta de widgets** (07c) como gaveta lateral, agrupada em **Do mês / Ao longo do tempo / Operacional**, cada card com o nome e os tamanhos suportados; widget já presente aparece esmaecido com "já está no layout".
- Toolbar com seletor de **dados de amostra** ("Dados de junho") — o editor mostra dados reais, não placeholder.
- Rodapé: "Layout alterado — N movimentações" + Descartar + **Publicar layout**. "Restaurar padrão" e "Ver a página" no header.

**Regra tamanho → visualização** (07b, APR-07) — **NOVA FUNCIONALIDADE**: cada widget declara quais visualizações aceita em cada largura. Ao redimensionar, uma visualização que se torna inválida é **substituída pela mais próxima válida** e o usuário é avisado por snackbar — nunca quebra em silêncio. Três estados: aceita · aceita com dados reduzidos · indisponível (com o motivo, ex. "precisa de 8 colunas").

Matriz normativa do frame:

| Visualização | 3 col | 4 col | 6 col | 8 col | 12 col |
|---|---|---|---|---|---|
| Medidor único | ✓ | — | — | — | — |
| Barras de progresso | — | ✓ | ✓ | ✓ | ✓ |
| Rosca com legenda | — | — | ✓ | ✓ | ✓ |
| Tabela compacta | — | ✓ | ✓ | ✓ | ✓ |
| Linha temporal | — | — | ✓ (dados reduzidos) | ✓ | ✓ |
| Mapa de calor | — | — | — | — | ✓ |

Catálogo de widgets do frame: Resumo em números (12×1) · Gasto por categoria · Por responsável · Maiores gastos · Pendentes · Evolução do saldo · Mapa de calor anual · Parcelas futuras · Meta vs. realizado · Checklist do mês (consome a definição da Spec 71).

---

## 3. User Stories

- Como usuário, quero escolher as colunas e o layout da linha vendo o resultado antes de salvar.
- Como usuário, quero que cada tipo de tabela tenha sua própria densidade, porque tabela de cartão e de receitas não têm a mesma quantidade de informação.
- Como usuário, quero arrastar chips de coluna sem medo de "selecionar" algo por engano.
- Como usuário, quero que meu modelo de tabela já venha com as transações fixas do mês (assinaturas, aluguel), com o dia certo.
- Como usuário, quero montar meu dashboard arrastando e redimensionando, vendo dados reais enquanto edito.
- Como usuário, quero ser avisado quando o tamanho que escolhi não suporta o gráfico que eu queria.
- Como usuário, quero saber quantos modelos e quantas tabelas reais dependem de um tipo antes de mudá-lo.

---

## 4. Critérios de Aceitação

**Tipos de tabela:**
- A página DEVE ser master-detail com lista à esquerda e três abas (Colunas & layout, Comportamento, Onde é usado).
- O TIPO DEVE persistir `rowLayout` ∈ `columns | pills`, `density` ∈ `compact | default | comfortable`, `visibleColumns` (ordenado), `pinnedColumns`, `inheritOnNewRow`, ordenação e agrupamento padrão, e os toggles de totais/seleção/linha-fantasma.
- `density` DEVE ser aplicada via `data-density` + variáveis CSS, e DEVE afetar altura de linha, tamanho de fonte e altura de controle na leitura, na edição e na barra de gavetas.
- A pré-visualização DEVE refletir layout, densidade e colunas **no mesmo render** em que a alteração é feita, sem salvar.
- No chip de coluna, ARRASTAR DEVE funcionar apenas pela alça e REMOVER apenas pelo ×; clicar no corpo NÃO DEVE ter efeito.
- A aba "Onde é usado" DEVE listar os modelos que usam o tipo sem contagem de transações, E DEVE contar tabelas/transações apenas quando o usuário acionar "Contar", exibindo timestamp e cache de 24 h.

**Modelos:**
- Os campos **Seção de destino** e **Ordem dentro da seção** DEVEM ser renderizados apenas quando "Criar esta tabela em todo mês novo" estiver ligado.
- O modelo NÃO DEVE ter campo de instituição, "parcelas em aberto" nem "recorrentes do mês anterior".
- A aba "Transações do modelo" DEVE permitir criar, editar, reordenar e excluir transações-modelo, renderizadas com o tipo de tabela do próprio modelo.
- O campo Dia DEVE aceitar dia fixo (1–31), "último dia" e "primeiro dia útil", E DEVE resolver para a data real do mês na criação da tabela.
- SE o valor de uma transação-modelo for 0,00, A TRANSAÇÃO criada DEVE ficar em branco para o usuário preencher.
- QUANDO um mês novo é criado, PARA CADA modelo com automação ligada DEVE ser criada uma tabela na seção configurada, na ordem configurada, com todas as transações do modelo resolvidas.
- SE a seção de destino estiver inativa (Spec 68), O MODELO NÃO DEVE criar tabela e DEVE ser sinalizado no hub como item que pede atenção.

**Dashboards:**
- A página DEVE editar três layouts independentes (Mensal, Anual, Resumo do mês) em grid de 12 colunas com linhas de 80px.
- ARRASTAR DEVE reposicionar com snap ao grid; AS ALÇAS DEVEM redimensionar dentro das larguras 3/4/6/8/12 e alturas 1–3.
- Undo e redo DEVEM cobrir mover, redimensionar, adicionar, duplicar e remover widget.
- QUANDO um widget é selecionado, O INSPETOR DEVE exibir tamanho, visualizações (com as inválidas desabilitadas e o motivo), fonte de dados, filtros e os dois toggles.
- SE o redimensionamento invalidar a visualização atual, O SISTEMA DEVE trocá-la pela mais próxima válida E avisar por snackbar.
- O layout só DEVE afetar a página real após "Publicar layout"; "Descartar" DEVE restaurar o último publicado.
- A paleta DEVE agrupar os widgets em Do mês / Ao longo do tempo / Operacional e marcar como indisponível o que já está no layout.
- O widget "Checklist do mês" DEVE consumir a definição de checklist (Spec 71), não uma lista própria.

---

## 5. Fora de Escopo

- Widgets novos além do catálogo listado; criação de widget customizado pelo usuário.
- Layout responsivo por breakpoint no editor (o grid de 12 colunas é o layout desktop; o colapso mobile da página real segue o comportamento atual).
- Compartilhar/exportar layout de dashboard entre contas.
- Redesenho da tabela financeira em si e do editor de transação — Spec 66.
- Instituição no modelo de tabela — depende do redesenho da tabela financeira, fora desta série.
- Biblioteca de gráficos nova: usar a já adotada no projeto.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Onde vive `rowLayout` | Tipo de tabela | É apresentação, não importação; e precisa de preview (APR-01/02) |
| Densidade | Propriedade do tipo, 3 níveis, via CSS vars | Tabelas diferentes pedem densidades diferentes; CSS vars evitam recálculo em JS |
| Chip de coluna | Alça arrasta, × remove, corpo inerte | Elimina a ambiguidade arrastar × selecionar (APR-04) |
| Modelo de tabela | Guarda as transações, com dia relativo | É a automação que o usuário realmente quer (APR-05) |
| Seção no modelo | Só sob automação | Sem automação a seção é escolhida na inserção; campo sempre visível mentiria |
| Dashboards | Editor de grid, 12 col × 80px, 3 páginas | Representa a realidade espacial da página (APR-06) |
| Tamanho × visualização | Matriz declarada por widget, com fallback avisado | Impede gráfico ilegível sem bloquear o usuário (APR-07) |
| Publicar vs. salvar | Layout tem publicação explícita | Editar dashboard é experimentação; o usuário decide quando vira oficial |
| Contagem de tabelas/transações | Sob demanda com cache 24 h | Custo cresce com a conta (Spec 67 §2.4) |

---

## 7. Referências Técnicas

| Item | Arquivo(s) |
|---|---|
| Tipos de tabela | `.../settings/table-types/page.tsx`, **novos** `src/components/settings/table-types/{TableTypeList,ColumnsLayoutTab,BehaviorTab,UsageTab,LivePreviewRow}.tsx` |
| Modelos | `.../settings/models/page.tsx`, **novos** `src/components/settings/models/{ModelList,DefinitionTab,ModelTransactionsTab}.tsx` |
| Dashboards | `.../settings/dashboards/page.tsx`, **novos** `src/components/settings/dashboards/{DashboardGridEditor,WidgetInspector,WidgetPalette,widget-registry.ts}.tsx` |
| Densidade | `src/components/transactions/*` (consumir `data-density`), token CSS em `src/theme/*` |
| Criação de mês | action existente de criação de mês — passa a resolver transações-modelo |

> ⚠️ **Follow-up da Spec 68 (revisão de estilo, 2026-08-11)**: a coluna "Modelos" da
> página de Seções (`SectionsManager`) conta `TableTemplate` por `autoSectionId`
> (`prisma.tableTemplate.groupBy({ by: ["autoSectionId"], where: { accountId,
> autoSectionId: { not: null } } })`, em `src/app/(app)/[accountId]/settings/sections/
> page.tsx`). Hoje essa coluna mostra **zero para toda seção**, e a contagem está
> **certa**: nenhum `TableTemplate` tem `autoSectionId` preenchido porque a página atual
> de Modelos não expõe esse campo — a "Aba 1 · Definição" desta spec (§2.2) é quem introduz
> o toggle "Criar esta tabela em todo mês novo" + **Seção de destino** que o preenche. A
> coluna de Seções só sai de zero quando esta spec (ou um recorte dela) for implementada.
> Não "consertar" contando de outra forma — a leitura correta É zero até então.

### 7.1 Prisma

> ⚠️ **Esboço greenfield — o schema vigente é o §14/P0.** Este bloco foi escrito sem o
> schema real à vista: `TableModel` é `TableTemplate`, `autoCreateMonthly` é `autoApply`,
> `targetSectionId` é `autoSectionId`, `TableModelTransaction` duplica `TableTemplateItem`
> (que já existe e já é consumido pela criação de mês), e `DashboardLayout` já existe com
> outra forma. Ver §12 (DIV-2, DIV-3) e §13 (D2).

```prisma
enum RowLayout { columns pills }
enum Density   { compact default comfortable }

model TableType {
  // ...
  rowLayout        RowLayout @default(columns)   // NOVO (Spec 66)
  density          Density   @default(default)   // NOVO
  visibleColumns   Json                           // NOVO — array ordenado de chaves
  pinnedColumns    Json    @default("[]")          // NOVO
  inheritOnNewRow  Json    @default("[\"occurredOn\"]")                 // NOVO — §16
  defaultSort      Json    @default("{\"key\":\"occurredOn\",\"dir\":\"desc\"}") // NOVO — §16
  groupBy          String?                        // NOVO
  showFooterTotal  Boolean @default(true)          // NOVO
  showGroupSubtotal Boolean @default(false)         // NOVO
  allowBulkEdit    Boolean @default(true)          // NOVO
  keepGhostRow     Boolean @default(false)         // NOVO — §16
}
```

> Os três defaults marcados **§16** não são os do frame: eles reproduzem o que a
> tabela do mês **já fazia antes desta spec**, porque o default de um campo recém-ligado
> vira comportamento retroativo de todo tipo já criado. Ver §16 para a tabela de
> antes/depois e as migrações.

```prisma
model TableModel {
  // ...
  autoCreateMonthly Boolean @default(false)
  targetSectionId   String?    // usado só quando autoCreateMonthly
  orderInSection    Int?
  transactions      TableModelTransaction[]   // NOVO — o core
}

model TableModelTransaction {              // NOVO
  id            String @id @default(cuid())
  tableModelId  String
  dayRule       String     // "5" | "last" | "firstBusiness"
  description   String
  categoryId    String?
  subcategoryId String?
  responsiblePartyId String?
  amountCents   BigInt     @default(0)   // 0 = criar em branco
  order         Int
}

model DashboardLayout {                    // NOVO (substitui a lista de blocos)
  id        String @id @default(cuid())
  accountId String
  page      DashboardPage   // monthly | yearly | monthSummary
  widgets   Json            // [{ id, type, x, y, w, h, viz, dataSource, filters, showTitle, interactive }]
  publishedAt DateTime?
  draft     Json?
}
```

### 7.2 Densidade por CSS vars

```tsx
// ✅ Correto — enum → data-attr → 3 vars; zero cálculo em JS
<TableContainer data-density={tableType.density}>
// theme/global (escala recalibrada — ver D9; os números vivem em src/lib/table-density.ts):
// [data-density="compact"]      { --row-h: 36px; --row-fs: 0.78rem;   --ctrl-h: 26px; }
// [data-density="default"]      { --row-h: 44px; --row-fs: 0.8125rem; --ctrl-h: 28px; }
// [data-density="comfortable"]  { --row-h: 52px; --row-fs: 0.8125rem; --ctrl-h: 30px; }
// `default` e `comfortable` compartilham o tamanho do texto de propósito: nesta escala
// quem varia é o RESPIRO VERTICAL. Três tamanhos de fonte fariam os valores monetários
// "pular" de tamanho ao trocar de densidade, o que é pior que o degrau ganho. O
// `compact` mantém a fonte menor porque em 36px o texto de 13px encosta nas bordas.

// ❌ Anti-padrão — medir e recalcular altura de linha em JS a cada render
```

### 7.3 Registro de widget com matriz de visualização

```tsx
// ✅ Correto — a matriz é dado, não if espalhado pela UI
export const WIDGETS = {
  categorySpend: {
    label: "Gasto por categoria",
    group: "month",
    viz: {
      donut:   { minCols: 6 },
      table:   { minCols: 4 },
    },
    defaultSize: { w: 6, h: 2 },
  },
  // ...
} satisfies Record<string, WidgetDef>;

// ao redimensionar:
const valid = pickNearestValidViz(def, nextSize, current.viz);
if (valid !== current.viz) enqueueSnackbar(`Visualização trocada para ${label(valid)} — ${reason}`);

// ❌ Anti-padrão — esconder a opção sem explicar por quê
```

### 7.4 Restrições do design system

- Abas com `Tabs`/`Tab`; contagem no rótulo via `Chip size="small"`.
- Lista mestre com `List` + `ListItemButton selected` — mesmo padrão de "ativo" do `SettingsNav`.
- Cards de escolha (layout, densidade, visualização) com `Paper variant="outlined"` + `Radio`, selecionado com borda `accent.primary` e `bgcolor: accent.subtle`.
- Grid editor: CSS Grid + handlers de pointer próprios ou a lib de DnD já usada; **não** introduzir nova dependência pesada sem necessidade.
- Rodapé de salvar/publicar: o mesmo do `SettingsPageShell` (Spec 67), com rótulo customizável ("Salvar tipo", "Salvar modelo", "Publicar layout").

---

## 8. Critérios de Teste

**E2E:**
- Trocar rowLayout de colunas para pílulas → preview muda imediatamente; salvar → tabela do mês reflete.
- Trocar densidade para Compacta → altura de linha da tabela real cai ao valor esperado; barra de gavetas acompanha.
- Remover coluna pelo × e reordenar pela alça; clicar no corpo do chip não muda seleção nem ordem.
- Aba "Onde é usado": lista de modelos aparece sem clique; contagem de transações só aparece após "Contar" e mostra timestamp.
- Modelo: ligar automação revela Seção e Ordem; desligar esconde e mantém o resto do formulário.
- Adicionar transação-modelo com "último dia" e valor 0,00; criar mês novo → tabela nasce na seção certa, transação no último dia do mês, valor em branco.
- Dashboard: arrastar widget para outra posição, redimensionar de 6 para 4 col com rosca ativa → visualização troca para tabela com snackbar; undo restaura.
- Publicar layout → página real reflete; descartar antes de publicar → página real intacta.

**Unit:**
- Resolução de `dayRule` para fevereiro, mês com feriado no dia 1 e mês de 31 dias.
- `pickNearestValidViz` para todas as combinações da matriz 07b.
- Serialização/desserialização de `visibleColumns` preservando ordem.
- Mapa `density` → variáveis CSS (3 níveis, 3 vars).
- Colisão no grid: inserir widget 6×2 num layout cheio escolhe o primeiro slot livre válido.

---

## 9. Plano de Migração Incremental

1. Prisma: campos novos em `TableType`, `TableModel`, tabela `TableModelTransaction`, tabela `DashboardLayout`. Backfill: colunas visíveis atuais → `visibleColumns`; `rowLayout = columns`; `density = default`; layouts de dashboard atuais → um `DashboardLayout` por página com posições derivadas da ordem atual.
2. Densidade primeiro (menor risco, ganho imediato): `data-density` + vars + consumo na tabela.
3. Tipos de tabela: master-detail com abas 1 e 2; preview ao vivo.
4. Aba 3 "Onde é usado" + contagem sob demanda (usa `settings-usage.ts` da Spec 67).
5. Modelos: aba Definição corrigida (automação condicional, campos removidos).
6. `TableModelTransaction` + aba "Transações do modelo" + "Importar de um mês".
7. Fiar a criação de mês para resolver transações-modelo (ponto de maior risco — feature flag).
8. Dashboards: `widget-registry` + matriz de visualização, depois `DashboardGridEditor`, depois `WidgetInspector` e `WidgetPalette`, por último publicar/descartar.
9. `pnpm typecheck` + `pnpm test` + e2e a cada passo.

> ⚠️ Esta §9 é o roteiro **original**, escrito antes do levantamento do código real. O
> roteiro **vigente** é o §14 (pacotes P0–P11), que corrige três premissas: o passo 7
> ("fiar a criação de mês") já está entregue pela Spec 73; o passo 1 não cria tabelas novas,
> estende as existentes; e o passo 8 não migra a geometria do grid. Onde os dois divergirem,
> vale o §14.

---

## 10. Inventário do código real (levantado em 2026-08-11)

O que já existe é o insumo mais importante do planejamento — metade desta spec descreve
coisas que já estão no repositório sob outro nome.

**Já entregue e reutilizável (Specs 67/68):**

| Peça | Arquivo | Uso nesta spec |
|---|---|---|
| Moldura da página, com rodapé de salvar e `saveLabel` customizável | `src/components/settings/SettingsPageShell.tsx` | as 3 páginas |
| Rodapé "N alterações não salvas · Descartar · Salvar" | `SettingsSaveBar.tsx` | via `dirtyCount` do shell |
| Tabela densa (linha 36px, cabeçalho mono, campos inline, linha-fantasma, menu de linha) | `src/components/settings/table/*` | aba "Transações do modelo" |
| Diálogo padronizado com ícone + tom | `SettingsDialog.tsx` | "Importar de um mês", confirmações |
| Rótulo de bloco mono/caixa-alta | `SettingsFieldLabel.tsx` | todos os blocos das abas |
| Select do frame | `table/SettingsSelect.tsx` | Ordenação, Agrupar por, Tipo, Seção, Dia |
| Menu de linha e densidade de menu | `RowActionsMenu.tsx`, `table/settings-menu-props.ts` | aba "Transações do modelo" |
| Arraste de linhas | `SortableRows.tsx` (`@dnd-kit`) | reordenar transações do modelo |
| Contagem sob demanda com cache de 24 h | `src/actions/settings-usage.ts`, `settings-usage-service.ts`, `UsageDialog.tsx` | as duas abas "Onde é usado" |
| Estado vazio, paginação, badge de status | `SettingsEmptyState`, `SettingsPagination`, `StatusCell` | listas mestre |

**Já entregue e afetado (Specs 33/36/38/73):**

| Peça | Arquivo | Situação |
|---|---|---|
| Editor de grid de dashboard (dnd-kit, resize com push, seleção) | `DashboardGridCanvas.tsx` (693 l.) | **estender** — não reescrever |
| Casca do editor (autosave otimista, restaurar padrão) | `DashboardGridEditor.tsx` | estender (undo/redo, publicar) |
| Paleta de widgets arrastável | `WidgetPalette.tsx` | estender (gaveta + grupos) |
| Inspetor do widget selecionado | `WidgetSettingsPanel.tsx` + `WidgetConfigForm.tsx` (1845 l.) | estender (tamanho + visualização) |
| Registro de ~40 widgets com `sizeVariants` | `dashboards/_core/widget-registry.ts` (825 l.) | estender (matriz de visualização) |
| Geometria pura do grid, com testes | `dashboards/_core/grid-layout.ts` | reusar |
| Aplicação de modelos na criação do mês | `src/server/services/month-service.ts` (`applyAutoTemplates`) | estender (`dayRule`, ordem, seção inativa) |

**Será substituído:**

| Peça | Arquivo | Por quê |
|---|---|---|
| Gerenciador de tipos em accordion + diálogos | `settings/table-types/TableTypesManager.tsx` (488 l.) | vira master-detail com 3 abas |
| Gerenciador de modelos em accordion | `settings/models/TableModelsManager.tsx` (637 l.) | vira master-detail com 3 abas |
| Editor de itens do modelo em diálogo | `settings/TemplateItemsEditor.tsx` (391 l.) | vira a aba 2, na tabela da Spec 68 |

---

## 11. Mapeamento frame → componente real

Legenda: **R** reusar como está · **E** estender · **N** novo.

### 11.1 Telas 05 e 05b — Tipos de tabela

| Elemento do frame | Componente real | |
|---|---|---|
| Breadcrumb, título, chip de contagem, "Novo tipo", frase de propósito | `SettingsPageShell` | R |
| Rodapé "2 alterações não salvas · Descartar · **Salvar tipo**" | `SettingsSaveBar` via `dirtyCount`/`saveLabel` | R |
| Lista mestre à esquerda com resumo `8 col · pílulas · 2 modelos`; tipo sem modelo esmaecido | `SettingsMasterDetail` + `List`/`ListItemButton selected` | **N** |
| Abas com contagem no rótulo | `SettingsTabs` (MUI `Tabs` na densidade das configs) | **N** |
| Cards com radio "A · Colunas fixas" / "B · Pílulas" e miniatura | `ChoiceCard` (`Paper variant="outlined"` + `Radio`, borda `accent.primary`) | **N** |
| Três cards de densidade com miniatura de 2 linhas reais | `ChoiceCard` + `DensityPreviewRows` | **N** |
| Chips de coluna: **só a alça arrasta, só o × remove, corpo inerte** | `ColumnChipList` sobre `@dnd-kit` | **N** |
| "Disponíveis" — chips esmaecidos com `+` | mesmo `ColumnChipList`, modo `available` | **N** |
| Pré-visualização ao vivo (2 linhas de exemplo) | `LivePreviewRow` | **N** |
| Aba 2 — Ordenação padrão, Agrupar por | `SettingsSelect` + `SettingsFieldLabel` | R |
| Aba 2 — 4 switches de totais e linhas | `Switch` + `FormControlLabel` | R |
| Aba 2 — chips "fixadas à esquerda" e "ao criar linha nova, herdar" | `ColumnChipList` em modo toggle (sem ordem) | E |
| Aba 3 — modelos que usam o tipo (contagem barata) | `List`/`ListItemButton` + `groupBy` do Prisma | R |
| Aba 3 — cartão "Contar", resultado com timestamp, "Recontar" | `OnDemandUsagePanel`, extraído do `UsageDialog` | **N** (extração) |

### 11.2 Telas 06 e 06b — Modelos de tabela

| Elemento do frame | Componente real | |
|---|---|---|
| Lista mestre `cartão de crédito · 6 transações` | `SettingsMasterDetail` | R (o novo) |
| Aba 1 — Nome, Tipo de tabela com hint | `TextField` + `SettingsSelect` | R |
| Toggle "Criar esta tabela em todo mês novo" | `Switch` dentro de `DefinitionTab` | E (`AutoApplySection`) |
| Bloco indentado com barra de acento (Seção de destino, Ordem) — **só sob a automação** | `Box` com `borderLeft` em `accent.primary` | **N** |
| "Ordem dentro da seção" com ↑↓ e "1ª de 2" | `OrderStepper` | **N** |
| Aba 2 — mini-tabela editável (alça · Dia · Descrição · Categoria · Responsável · Valor · menu) | `SettingsTable` + `SettingsRow` + `SettingsCell` + `SettingsGripCell` + `SettingsMenuCell` | R |
| Aba 2 — edição inline com X e ✓ | `SettingsRowField` + `SettingsEditActions` | R |
| Aba 2 — linha-fantasma "Adicionar transação ao modelo…" | `SettingsGhostRow` | R |
| Aba 2 — campo Dia relativo (`dia 5`, `último dia`, `primeiro dia útil`) | `SettingsSelect` + `SettingsRowField` combinados em `DayRuleField` | **N** |
| Aba 2 — chip de parcela na descrição (`3/12`) | `Chip size="small"` (mesmo padrão da linha de transação) | R |
| Aba 2 — arraste para reordenar | `SortableRows` | R |
| Aba 2 — "Importar de um mês" | `ImportFromMonthDialog` sobre `SettingsDialog` | **N** |
| Aba 2 — aviso "Linha renderizada com o tipo X · layout pílulas" | faixa informativa igual à do `MergeDialog` | R |
| Aba 2 — total do modelo no rodapé da lista | `SettingsRow` de rodapé + `formatCentsToBrl` | R |
| Aba 3 — meses/tabelas criados a partir do modelo | `OnDemandUsagePanel` + `createdFromTemplateId` | E |

### 11.3 Telas 07, 07b e 07c — Dashboards

| Elemento do frame | Componente real | |
|---|---|---|
| Três páginas em `ToggleButtonGroup` | hoje são **3 rotas** (`/dashboards/monthly|yearly|month-summary`) | E — ver DIV-12 |
| Canvas com guias de coluna, arrastar, snap | `DashboardGridCanvas` | R |
| Alça de redimensionar no canto | `ResizeHandle` (dentro do canvas) | R |
| Chip de tamanho no widget (`4×2`) | `WidgetCardBody` | E |
| Undo / redo na toolbar | `useLayoutHistory` (pilha no `DashboardGridEditor`) | **N** |
| "Dados de junho" (seletor de dados de amostra) | `SettingsSelect` + parâmetro já aceito pelas queries de widget | **N** |
| Inspetor lateral 262px | `WidgetSettingsPanel` + `WidgetConfigForm` | E |
| Bloco "Tamanho" (colunas / linhas) no inspetor | seletor de `sizeVariant` existente, reapresentado como grade de botões | E |
| Bloco "Visualização" com radio, ícone e motivo do desabilitado | `VizPicker` + matriz no `widget-registry` | **N** |
| Slot vazio tracejado no fim do grid | `EmptySlotCard` | **N** |
| Paleta como gaveta lateral, agrupada em Do mês / Ao longo do tempo / Operacional | `WidgetPalette` | E |
| "já está no layout" no card do widget | já existe (singletons são escondidos) — passa a aparecer **esmaecido**, como no frame | E |
| Rodapé "Layout alterado — N movimentações · Descartar · **Publicar layout**" | `SettingsSaveBar` via `dirtyCount` do shell | R |
| "Restaurar padrão" e "Ver a página" no header | `secondaryActions` do shell | E |

---

## 12. Divergências entre a spec e o código real

| # | Divergência | Resolução |
|---|---|---|
| **DIV-1** | §2.3/APR-06 assume "lista de blocos"; existe editor de grid de **6 colunas** com `sizeVariants` | **D1** — incremental sobre o editor atual; a geometria de 12 colunas **não** entra |
| **DIV-2** | §7.1 cria `TableModelTransaction`; já existe `TableTemplateItem` com todos os campos e **consumido pela criação de mês** | **D2** — estender `TableTemplateItem` com `dayRule` |
| **DIV-3** | §7.1 chama `TableModel`/`autoCreateMonthly`/`targetSectionId`; o real é `TableTemplate`/`autoApply`/`autoSectionId` | Nomes reais mandam. Só `orderInSection` é campo novo |
| **DIV-4** | `rowLayout` no banco é `columns \| rich`; a spec diz `columns \| pills` | **D4** — renomear para `pills`, com migração de dados |
| **DIV-5** | §7.1 quer `visibleColumns` ordenado; hoje é `hiddenColumns` (mapa, sem ordem) e **o renderer não sabe reordenar** | **D3** — persistir a ordem e refletir no preview; a tabela real consome quando a Spec 66 chegar |
| **DIV-6** | §2.2 diz "Instituição sai", mas `TableTemplateItem.institutionId` está em uso e alimenta a transação criada | **D5** — mantém no banco e na aplicação; a coluna só aparece quando o tipo do modelo mostra instituição |
| **DIV-7** | §2.2 manda remover "parcelas em aberto" e "recorrentes do mês anterior" — que **não são campos do modelo**, são passos da criação de mês (Spec 73) | Nada a remover. **Não** mexer no `selection` do `createMonth`: é função entregue |
| **DIV-8** | Aba 3 de Modelos precisa saber QUAL modelo gerou a tabela; `FinanceTable` só grava `sourceMethod: "template"` | **D6** — `createdFromTemplateId` novo, sem backfill; a aba declara a data de corte |
| **DIV-9** | O modelo tem `tableTypeId` **e** `autoTableTypeId`; o frame mostra um campo só | **D7** — consolidar em `tableTypeId`; `autoTableTypeId` fica marcado deprecated |
| **DIV-10** | §9 passo 7 ("fiar a criação de mês para resolver transações-modelo") **já está feito** (Spec 73, `applyAutoTemplates`) | O delta real é `dayRule`, `orderInSection` e seção inativa |
| **DIV-11** | "Colunas fixadas à esquerda" e "Agrupar por categoria/responsável/parcela" não têm consumidor no renderer atual | **D8** — persistir tudo, ligar só o que a tabela já sabe fazer, e marcar na spec o que está inerte |
| **DIV-12** | O frame põe as 3 páginas de dashboard num `ToggleButtonGroup`; o app tem **3 rotas** distintas, já ligadas à navegação e ao `generateMetadata` | Manter as rotas (URL compartilhável, metadata correta) e renderizar o `ToggleButtonGroup` como **navegação entre elas** — mesma intenção visual, sem perder função |
| **DIV-13** | Frame 05 mostra densidade `36px / 0.82rem` para "Padrão"; a tabela de **Configurações** (Spec 68) usa 36px / 0.8125rem | Coincidência, não dependência: a densidade desta spec vale para a **tabela de transações**. Os tokens da Spec 68 não mudam |

---

## 13. Decisões de planejamento (2026-08-11)

| # | Decisão | Escolha | Consequência assumida |
|---|---|---|---|
| **D1** | Escopo de Dashboards | **Incremental** sobre o editor existente: 6 colunas mantidas, `sizeVariants` mantidas; entram undo/redo, publicar × descartar, paleta em gaveta agrupada, chip de tamanho, slot vazio e matriz tamanho→visualização adaptada às variantes | O grid continua com **6** colunas, não 12. Larguras seguem as variantes de cada widget, não o conjunto 3/4/6/8/12. Zero migração de layouts salvos e zero risco na página real |
| **D2** | Transações do modelo | Estender `TableTemplateItem` com `dayRule String?`; **não** criar `TableModelTransaction` | Migração aditiva; a automação de mês entregue pela Spec 73 continua funcionando sem reescrita. O nome canônico na spec passa a ser `TableTemplateItem` |
| **D3** | Ordem das colunas | Persistir `visibleColumns` ordenado e refletir **no preview** já; a tabela real do mês segue na ordem atual até o renderer da Spec 66 consumir o campo | A ordem fica correta no banco desde já. Divergência temporária entre preview e tabela real — **declarada na UI** (nota na aba), não escondida |
| **D4** | Nome do layout B | Renomear `rich` → `pills` no banco e no código | Uma migração de dados (`UPDATE`), ~8 arquivos tocados. Schema, spec 66, spec 69 e UI passam a dizer a mesma palavra |
| **D5** | Instituição no item do modelo | Campo mantido e continua sendo aplicado; a **coluna** na aba 2 só aparece quando o tipo de tabela do modelo mostra instituição | Fiel ao frame (o exemplo é um cartão, que não mostra) sem apagar dado de quem já usa |
| **D6** | Proveniência para a aba 3 de Modelos | `FinanceTable.createdFromTemplateId`, gravado daqui em diante, **sem backfill heurístico** | Tabelas criadas antes desta spec não entram na contagem. A aba diz isso explicitamente ("a partir de DD/MM/AAAA") em vez de exibir um número que parece total |
| **D7** | Tipo de tabela duplicado no modelo | Consolidar em `tableTypeId`; copiar `autoTableTypeId` onde estiver vazio; `month-service` passa a ler `tableTypeId`; `autoTableTypeId` fica deprecated (não é dropado agora) | Mesma cautela usada com `Category.defaultSectionId` na Spec 68: campo morto é marcado, não removido no mesmo passo em que se muda quem o lê |
| **D8** | Aba 2 "Comportamento" | Persistir **todos** os campos; ligar de verdade os que a tabela já sabe fazer (agrupamento, total no rodapé); os demais ficam gravados aguardando o renderer da Spec 66 | A aba fica completa como no frame. Os controles inertes são listados no §16 — se não estiverem listados, a promessa está quebrada |
| **D9** | Escala de densidade (2026-08-11, após medição) | **36 / 44 / 52px** em vez dos 28/36/44 do frame. `comfortable` (52px · 13px · controle 30px) é **clone exato** da linha atual — a promessa é que quem não quiser mudança nenhuma tenha um nome para escolher; `default` (44px) é o meio-termo; `compact` (36px) é o piso aceito | A medição no navegador mostrou a linha real em **52,5px** — nenhum nível do frame reproduzia o tamanho atual, e como o P0 grava `default` em todo tipo existente, a escala original encolheria **toda** tabela em ~31% de uma vez. Com a nova escala a mudança visível cai para −8,5px, e quem quiser o tamanho de sempre tem um nome para ele. A fonte de `default` fica em 13px (a de hoje): no nível padrão muda só a altura, não o tamanho do texto |

---

## 14. Plano de execução por pacotes

Regra: **um pacote por vez**, verificação ao fim de cada um, nada avança com verificação
pendente. Verificação mínima de todo pacote (dentro do container):
`pnpm typecheck` · `pnpm test` · `eslint` no escopo tocado.

### P0 · Prisma — migração aditiva

```prisma
model TableType {
  rowLayout         String  @default("columns")           // valores: columns | pills  (D4)
  density           String  @default("default")           // compact | default | comfortable
  visibleColumns    Json    @default("[]")                // array ORDENADO de chaves
  pinnedColumns     Json    @default("[]")
  inheritOnNewRow   Json    @default("[]")
  defaultSort       Json    @default("{\"key\":\"occurredOn\",\"dir\":\"asc\"}")
  groupBy           String?                               // null | category | responsible | installment
  showFooterTotal   Boolean @default(true)
  showGroupSubtotal Boolean @default(false)
  allowBulkEdit     Boolean @default(true)
  keepGhostRow      Boolean @default(true)
}
```

> 📌 **Este bloco é o que o P0 gravou — três destes defaults foram corrigidos depois.**
> `inheritOnNewRow` → `["occurredOn"]`, `defaultSort` → `{occurredOn, desc}`,
> `keepGhostRow` → `false`, no dia em que cada campo ganhou consumidor. O motivo e as
> migrações estão no §16; o schema real é o do §7.1. Não copiar daqui.

```prisma
model TableTemplate {
  orderInSection Int?                                     // só usado sob autoApply
  // autoTableTypeId — DEPRECATED (D7); consolidado em tableTypeId
}

model TableTemplateItem {
  dayRule String?                                         // "5" | "last" | "firstBusiness"  (D2)
}

model FinanceTable {
  createdFromTemplateId String?                           // proveniência (D6)
  @@index([accountId, createdFromTemplateId])
}
```

> **`String`, não `enum` do Postgres**, para `density` e `groupBy`: é o padrão que
> `rowLayout` já estabeleceu neste schema (validação via Zod). Introduzir enums nativos só
> para estes dois criaria duas convenções para a mesma coisa.

**Backfills (SQL, no mesmo arquivo de migração):**
1. `row_layout = 'pills' WHERE row_layout = 'rich'` (D4).
2. `visible_columns` = ordem canônica das colunas menos as marcadas em `hidden_columns`.
3. `day_rule = day::text` em todos os itens (D2).
4. `table_type_id = COALESCE(table_type_id, auto_table_type_id)` (D7).

`hiddenColumns` **permanece** e passa a ser escrito como espelho derivado de
`visibleColumns` (escrita dupla) enquanto o renderer atual o consumir — remover no mesmo
passo quebraria o mês.

**Verificação:** `prisma validate`, migração aplicada, `docker compose restart app`
(o `next dev` mantém o client antigo em memória — ver CLAUDE.md §8), consultas do mês OK.

### P1 · Densidade ponta a ponta

`data-density` na raiz da tabela + 3 variáveis CSS (`--row-h`, `--row-fs`, `--ctrl-h`)
consumidas na leitura, na edição e na barra de gavetas. `default` reproduz exatamente a
medida atual — quem não mexer em nada não vê diferença.

- Novo: `src/lib/table-density.ts` (mapa densidade → vars, testável isolado).
- Tocados: `TransactionTable.tsx`, linha de transação, `RowDrawerToolbar`, tema global.
- **Unit:** mapa densidade → 3 vars, 3 níveis.

### P2 · Primitivas compartilhadas

`SettingsMasterDetail`, `SettingsTabs`, `ChoiceCard`, `ColumnChipList`,
`OnDemandUsagePanel` (extraído do `UsageDialog`, que passa a consumi-lo).
Todas em `src/components/settings/`, todas com teste próprio, **nenhuma ligada a página
ainda** — é o pacote que as Specs 70/71/72 herdam.

- **Unit:** `ColumnChipList` — corpo do chip inerte, alça arrasta, × remove;
  `SettingsMasterDetail` — seleção e estado vazio; `OnDemandUsagePanel` — não conta antes do
  clique, mostra timestamp depois.

### P3 · Tipos de tabela — master-detail + Aba 1

Substitui `TableTypesManager`. Lista mestre com resumo `N col · layout · N modelos`,
aba "Colunas & layout" completa (organização da linha, densidade, colunas visíveis com
ordem, disponíveis, pré-visualização ao vivo), rodapé "Salvar tipo".

- Novos: `table-types/{TableTypeList,ColumnsLayoutTab,LivePreviewRow,DensityPreviewRows}.tsx`.
- Nota visível na aba: a ordem vale no preview e é gravada; a tabela do mês passa a
  respeitá-la com a Spec 66 (D3).
- **E2E:** trocar layout → preview muda no mesmo render; remover coluna pelo ×; reordenar
  pela alça; clicar no corpo do chip não faz nada; salvar e recarregar mantém a ordem.

### P4 · Tipos de tabela — Aba 2 (Comportamento)

Ordenação padrão, Agrupar por, 4 toggles, colunas fixadas, herdar ao criar linha.
Persistência de tudo; ligação real só de agrupamento e total no rodapé (D8).

- **Unit:** serialização/desserialização de `visibleColumns` e `pinnedColumns` preservando ordem.

### P5 · Tipos de tabela — Aba 3 (Onde é usado)

Lista de modelos por `groupBy` (barato, sem clique) + `OnDemandUsagePanel` para tabelas e
transações reais (`countUsageAction`, entidade `tableType` **já existe** no enum).

- **E2E:** lista de modelos aparece sem clique; contagem só após "Contar"; timestamp visível.

### P6 · Modelos — master-detail + Aba 1 (Definição)

Substitui `TableModelsManager`. Nome, Tipo de tabela (campo único, D7), toggle de automação
com bloco indentado revelando Seção de destino e Ordem dentro da seção.

- **E2E:** ligar automação revela Seção e Ordem; desligar esconde e **mantém o resto do
  formulário** intacto.

### P7 · Modelos — Aba 2 (Transações do modelo)

A aba usa a tabela da Spec 68 inteira. Campo Dia relativo, valor 0,00 = "criar em branco",
chip de parcela, arraste, linha-fantasma, total no rodapé, "Importar de um mês".
`TemplateItemsEditor` é removido no fim deste pacote, não antes.

- Coluna Instituição condicional ao tipo do modelo (D5).
- **Unit:** resolução de `dayRule` para fevereiro, mês com feriado no dia 1, mês de 31 dias.
- **E2E:** criar transação-modelo com "último dia" e valor 0,00.

### P8 · Criação de mês — resolver `dayRule`, ordem e seção inativa

Estende `applyAutoTemplates` (Spec 73) — **não** reescreve. Resolve `dayRule` para a data
real, respeita `orderInSection`, e pula modelo cuja seção esteja inativa, sinalizando no hub
(`settings-attention.ts`, que já existe).

- **E2E:** criar mês novo → tabela nasce na seção certa, na ordem certa, transação no último
  dia do mês, valor em branco.

### P9 · Modelos — Aba 3 (Onde é usado)

`createdFromTemplateId` gravado em P0/P8; a aba conta e declara a data de corte (D6).

### P10 · Dashboards — o delta do D1

Na ordem: (a) matriz de visualização no `widget-registry` + `pickNearestValidViz` com
snackbar; (b) `useLayoutHistory` (undo/redo cobrindo mover, redimensionar, adicionar,
duplicar, remover); (c) publicar × descartar (`DashboardLayout.draft` + `publishedAt`);
(d) paleta em gaveta agrupada em Do mês / Ao longo do tempo / Operacional, com o já-presente
esmaecido; (e) chip de tamanho, slot vazio, seletor de dados de amostra.

- **Unit:** `pickNearestValidViz` para todas as combinações da matriz 07b; colisão no grid
  ao inserir num layout cheio.
- **E2E:** redimensionar com visualização inválida → troca + snackbar; undo restaura;
  publicar reflete na página real; descartar deixa a página real intacta.

### P11 · Varredura final

E2E das 3 páginas, revisão de convenções (`myaccountant-reviewer`), crítica visual em
**light e dark** (`ui-critique`), atualização de skills e do `docs/plan-69-*.md`, e a lista
consolidada de divergências residuais — uma lista só, no fim.

---

## 15. Armadilhas herdadas das Specs 67 e 68 (não repetir)

Cada item abaixo custou uma sessão ou um bug reportado pelo usuário.

**Tema e tokens**
- `success.subtle`, `warning.subtle`, `error.subtle` **não existem**. Token inexistente
  resolve para `undefined` e o MUI **descarta a regra em silêncio**. Só `danger.subtle` e
  `neutral.subtle` existem.
- `text.disabled` mede ~2,1:1 e **não serve para texto que carrega informação** — usar
  `text.tertiary` (~4,7:1).
- `borderRadius` numérico em `sx` é multiplicado por `theme.shape.borderRadius` (=8). Para
  medida exata, string em px.
- O shorthand `borderLeft` dentro de qualquer valor responsivo reseta `border-left-color`
  para `currentColor`. Usar longhand (`borderLeftWidth`/`Style`/`Color`).
- Sobrescrever ícone dentro de `MenuItem` exige o seletor de **3 níveis**
  (`.MuiMenuItem-root .MuiListItemIcon-root svg`) — qualquer coisa mais curta perde para o
  seletor do próprio MUI. Três tentativas foram perdidas nisso na Spec 68.

**Formulários e campos**
- `label` num `TextField` de altura fixa (linha de tabela) renderiza um rótulo **flutuante
  sem para onde flutuar** — sai grande e descentralizado. `SettingsRowField` já converte
  `label` em `placeholder` + `aria-label`; usar sempre ele nas linhas.
- `Stack spacing` + `flexWrap` exige `useFlexGap`.

**Server actions e serviços**
- `undefined` ("não mencionei") × `null` ("limpar") em update parcial: tratar os dois como
  iguais apaga dado do usuário em silêncio. Já aconteceu com os detalhes de instituição.
- Normalizador que faz `{ ...values }` vaza campos que o chamador não pediu para mudar —
  construir a saída campo a campo.
- Guarda que só existe na UI não existe: a action tem que recusar sozinha.

**Listas e paginação**
- Fatia e controle de paginação derivados de condições **independentes** truncaram Categorias
  em 20 itens silenciosamente. Uma condição só (`isPaginated`) manda nos dois.
- Ao validar uma tela, **contar as linhas contra o chip de contagem** — foi exatamente o que
  não foi feito e o usuário encontrou o corte.

**Importação e validação**
- Limite de tamanho no schema da requisição **rejeita o arquivo inteiro** por causa de uma
  linha. O schema é sanidade; quem julga linha a linha é o classificador. Um arquivo
  exportado pelo próprio app falhou por isso.
- Testar com dado **do usuário**, não com dado inventado que só percorre o caminho feliz.

**DnD**
- `DndContext` injeta `<div>`s de acessibilidade — **inválido dentro de `<tbody>`**. Envolver
  a tabela inteira. Usar a flag `mounted` contra divergência de hidratação.

**Prisma e ambiente**
- Depois de `migrate`/`generate`, **reiniciar o app** (`docker compose restart app`): o
  `next dev` segue com o client antigo em memória e falha em runtime com typecheck limpo.
- Rodar o e2e reescreve o `node_modules` compartilhado e quebra o typecheck do dev até
  `pnpm prisma generate` + restart.
- `docker compose down -v` é **global** e apaga o banco de desenvolvimento. Nunca.

**Processo**
- Divergência entre spec e código: **atualizar a spec primeiro**, depois o código.
- Verificação em lote, uma lista consolidada — não erro a erro.

---

## 16. Controles persistidos mas ainda inertes (D3, D8)

Enquanto o renderer da Spec 66 não consumir estes campos, eles são **gravados e exibidos**,
mas não afetam a tabela do mês. Esta lista é a promessa auditável — se um item sair daqui,
é porque passou a funcionar de verdade.

| Campo | Onde é editado | Passa a valer com |
|---|---|---|
| Ordem de `visibleColumns` | Tipos · Aba 1 | renderer de colunas (Spec 66) |

### `pinnedColumns` saiu desta lista — agora vale, com recorte

Fixar coluna à esquerda tinha sido recusado por quatro motivos. O recorte a **duas
colunas** derruba o primeiro, que era o único bloqueio real:

**`PINNABLE_COLUMNS = ["occurredOn", "description"]`** (`src/lib/table-columns.ts`).
Só as colunas de **identificação** podem ser fixadas, e não por gosto: elas são o
**prefixo** da linha do layout A (`[seleção] [data] [descrição] […] [ações]`), então
o `left` de cada uma é a soma de larguras **declaradas** — nenhuma medição em JS,
nenhum `ResizeObserver`, nada para re-rodar quando a densidade, o conjunto de colunas
visíveis ou a largura do contêiner mudam. Fixar uma coluna do meio exigiria medir
todas as anteriores a cada mudança, que é o anti-padrão que a §7.2 rejeita — e é por
isso que a opção **não** se estende às demais colunas.

Como os outros três motivos ficaram:

1. ~~células sem largura fixa~~ → a célula presa (e a de seleção) recebe largura
   **fixa e igual** no cabeçalho, na linha de leitura, na linha em edição e na
   linha-fantasma. As constantes estão em `src/components/transactions/pinned-columns.ts`
   (48 / 148 / 224 px) e foram medidas contra o min-content real de cada coluna: em
   `table-layout: auto` um `width` menor que o min-content é ignorado em silêncio, e
   a coluna seguinte grudaria no lugar errado.
2. **abaixo de 640px continua valendo**: em `pills` (configurado ou por degradação de
   viewport) **nenhuma** coluna é presa, mesmo com valor gravado — `effectivePinnedColumns`.
3. `colSpan={99}` (cabeçalho de grupo, gaveta de linha, toolbar) **rola inteiro**, que
   é o comportamento normal de painel congelado — as linhas de colSpan ficam em faixas
   verticais próprias, então nenhuma célula presa as cobre. Exceção deliberada: o
   **rótulo** do cabeçalho de grupo gruda em `left`, senão o bloco perderia justamente
   a legenda que as colunas presas existem para ancorar. O subtotal do grupo continua
   no fim da linha e rola com ela.
4. O empilhamento fica em `z-index` 2 (corpo) / 3 (cabeçalho) — acima das demais
   células, muito abaixo do `zIndex.modal` (1300): menu ⋮, selects da edição e
   tooltips seguem abrindo por cima.

Duas consequências que não são óbvias e estão travadas em teste:

- **Fundo opaco obrigatório.** É o fundo da célula presa que impede o conteúdo de
  passar visível por baixo. Por isso o esmaecimento da linha **pendente** não pode
  valer em bloco nela (`opacity: .6` levaria o fundo junto): a célula presa sai do
  escopo opaco como a célula-host do chip, e o fade volta item a item (`.row-dim`).
- **Hover.** O `<TableRow hover>` do MUI pinta um **véu** translúcido (`action.hover`)
  sobre o que já estava lá; a célula presa reproduz o mesmo véu como `background-image`
  sobre a sua cor opaca. Trocar isso por um token de cor erra o pixel.

A ordem de `visibleColumns` continua inerte pelo motivo (4) original: o custo é do
renderer, não do campo.

> ⚠️ **Pendente na tela de Configurações.** A aba "Comportamento" ainda oferece
> **todas** as colunas visíveis para fixar e ainda exibe a nota "são salvas aqui, mas
> ainda não afetam a tabela do mês". As duas coisas precisam mudar: oferecer só
> `PINNABLE_COLUMNS` e trocar a nota. O renderer é defensivo enquanto isso — filtra
> por `PINNABLE_COLUMNS` o que estiver gravado, então uma coluna fixada pela tela
> antiga simplesmente não gruda, em vez de quebrar a grade.

### Já valem desde esta spec

`rowLayout`, `density`, conjunto de colunas visíveis, `showFooterTotal`,
`inheritOnNewRow`, `defaultSort`, `groupBy` (**os quatro valores**),
`showGroupSubtotal`, `allowBulkEdit` e `keepGhostRow`.

- **`showFooterTotal`** — `FinanceTableCard` esconde o total da tabela (e o total
  filtrado que o acompanha) quando o tipo tem o toggle desligado. Tabela sem tipo
  (`tableTypeId: null`) cai em `true`, o comportamento de sempre.
- **`inheritOnNewRow`** — `NewTransactionRow` lê as 4 chaves ao limpar a linha após
  salvar: chave presente = o valor do lançamento recém-criado sobrevive; chave
  ausente = o campo volta ao ponto de partida (`category` leva a subcategoria
  junto; `responsibleUser` volta ao **default da conta**, não a vazio).
- **`defaultSort`** — `TransactionTable` nasce ordenado pelo campo do tipo
  (`sort-rows.ts`); clicar no cabeçalho continua reordenando na hora, e o "resetar"
  volta para o valor do tipo em vez de um padrão fixo.
- **`groupBy`** — agrupa a tabela do mês nos quatro valores. Continua **não sendo**
  `FinanceTable.groupByDate`, que é campo **por tabela**, pré-existente a esta spec
  e alternável no menu ⋮ do card; os dois seguem separados.
- **`showGroupSubtotal`**, **`allowBulkEdit`**, **`keepGhostRow`** — subtotal no
  cabeçalho de cada bloco, caixas de seleção + barra de ações em massa, e linha
  vazia de criação sempre visível no fim da tabela.

> ⚠️ **Ligar um campo obriga a rever o `@default` dele.** O default do P0 descrevia a
> tela que a spec quer, não a que existia — e no dia em que o consumidor entra, o
> default vira comportamento retroativo de **todos** os tipos já criados. Três campos
> precisaram de correção, sempre pelo mesmo princípio: **o default reproduz o que a
> tabela do mês já faz hoje.**
>
> | Campo | Default do P0 | Default corrigido | O que o P0 teria mudado sem aviso |
> |---|---|---|---|
> | `inheritOnNewRow` | `[]` | `["occurredOn"]` | a linha-fantasma pararia de preservar a data entre lançamentos |
> | `defaultSort` | `{occurredOn, asc}` | `{occurredOn, desc}` | a tabela inverteria a ordem — ela sempre mostrou do mais novo para o mais antigo |
> | `keepGhostRow` | `true` | `false` | uma linha vazia permanente grudaria no fim de toda tabela |
>
> Migrações: `20260811230000_spec69_inherit_on_new_row_default_occurred_on` e
> `20260812120000_spec69_default_sort_desc_and_keep_ghost_row_off` — aditivas, com
> backfill guardado em quem ainda estava no default antigo. O default vive numa
> **constante única** por campo em `src/lib/schemas/settings.ts`
> (`DEFAULT_INHERIT_ON_NEW_ROW`, `DEFAULT_TABLE_TYPE_SORT`, `DEFAULT_KEEP_GHOST_ROW`),
> consumida pelo `@default` do Prisma, pelo `createTableType`, pela linha otimista do
> `TableTypesManager` e pelo restore de backup. `FALLBACK_SORT` (tabela **sem** tipo)
> é a mesma constante de `DEFAULT_TABLE_TYPE_SORT`: ter ou não ter tipo não pode
> mudar nada para quem nunca abriu a aba "Comportamento".

---

## 17. Follow-ups abertos

| # | Item | Aberto por |
|---|---|---|
| FU-1 | Grid de 12 colunas (spec original §2.3): exige revisar `sizeVariants` de ~40 widgets, migrar `DashboardLayout` salvos e ajustar o render das 3 páginas reais | D1 |
| FU-2 | Backfill de `createdFromTemplateId` para tabelas anteriores a esta spec, se a heurística de nome+seção se mostrar aceitável | D6 |
| FU-3 | Dropar `TableTemplate.autoTableTypeId` e `TableType.hiddenColumns` depois que a Spec 66 consumir `visibleColumns` | D7, P0 |
| FU-4 | Widget "Checklist do mês" consumir a definição da Spec 71 (hoje tem lista própria) | §2.3 |
| FU-5 | Herdados da Spec 68 e ainda abertos: FU-5 (mesclar/ver uso na linha de subcategoria), FU-7 (`settings-service.test.ts` × `settings-split.test.ts`), FU-8 (`loginAs` flaky) | Spec 68 §10 |
| FU-6 | **Seletor de "dados de amostra"** no editor de dashboards: o canvas desenha cards (`WidgetCardBody`), não widgets com dado real — os dados vêm de queries RSC nas páginas. Ligar o seletor exige renderizar widgets de verdade no editor | P10, decisão declarada em comentário |
| FU-7 | **`member-breakdown`: registry × componente divergem.** O registry declara `{ view: "donut" \| "bars" }`, o componente lê `config.chartType` — o toggle **já é inerte hoje**, antes desta spec. Alinhar destrava o widget no eixo config em uma linha | P10 |
| FU-8 | **Botões de TEXTO da barra de gavetas não respeitam `--ctrl-h`.** Diagnóstico pronto: a variável chega ao elemento, mas **nenhuma declaração de `height` é emitida** para aquele `MuiButton`, enquanto os `IconButton` da mesma barra emitem — o `sx` não está chegando ao componente. Em `default` o valor coincide, então não é visível hoje | P1 |
| FU-9 | **`text.tertiary` sobre `background.subtle`: 4,26:1 claro / 4,16:1 escuro** — reprova AA. Atinge o **cabeçalho de tabela** (`MuiTableCell.head` usa exatamente esse par) e linhas aninhadas. Não corrigido junto com o `onSubtle` porque escurecer `text.tertiary` no claro repinta legenda/`caption`/`overline` em todo o app — é decisão de identidade | P11 |
| FU-10 | **Os 12 presets de accent configuráveis nunca foram medidos.** `accent.primary` sobre `accent.primarySubtle` passa no índigo (4,54/4,69), mas os outros 11 são desconhecidos | P11 |
| FU-11 | Strings PT hardcoded em `WidgetConfigForm.tsx:~1348-1356` ("Eixo X", "Eixo Y", "Séries", "Gráfico", "Período", "Filtros") e as 2 linhas de exemplo do preview em `table-types/preview-samples.ts` — as únicas fora de `m.*` nesta série | P11 |
| FU-12 | `WidgetCardBody.tsx` e `DashboardGridCanvas.tsx` ainda usam `primary.main`/`action.hover`/`action.selected` em alguns trechos (vocabulário MUI cru em vez do semântico) | P11 |
| FU-13 | **10 falhas de e2e pré-existentes** (`notifications-menu`, `sidebar` ×2, `solo-flow`, `transaction-detail` ×3, `transaction-detail-edit` ×2, `viewer-readonly`) — as mesmas de antes desta série. `dashboards.spec.ts` **saiu** da lista (asserção obsoleta corrigida no P11) | P11 |
