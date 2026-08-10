# Spec 67 — Configurações: rota `/settings`, shell de página e padrões globais

> Status: pronta para implementação — decisões D1–D10 resolvidas em 2026-08-09 (ver §10)
> Insumo: protótipos aprovados **"MyAccountant Settings — Arquitetura"** (diagnóstico, 5 famílias, 4 arquétipos, shell, hub) e **"MyAccountant Settings — Todas as Páginas v2"** (15 páginas + catálogo de modais). Arquivos .html dentro da pasta ../docs/frames/.
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md) · [`react-best-practices`](../skills/react-best-practices/SKILL.md)
> Relacionadas: Spec 65 (sidebar) · Spec 66 (linha de transação) · Specs 68–72 (as 5 famílias)

---

## 0. Papel dos protótipos nesta série de specs

Os dois frames citados acima **são o blueprint normativo** desta refatoração. Eles definem, e devem ser seguidos, para:

- **hierarquia** — quais páginas existem, em que família, em que ordem;
- **agrupamento** — o que fica junto na mesma tela, na mesma aba, no mesmo bloco rotulado;
- **densidade** — altura de linha, tamanho de fonte relativo, quanta informação cabe por linha, quando há busca;
- **anatomia** — onde ficam breadcrumb, título, contagem, propósito, ação primária, toolbar, rodapé de salvar.

O que os frames **não** são: uma folha de estilo. O visual (cor, tipografia, raio, sombra, espaçamento absoluto) vem do **design system MUI já existente no projeto** (`theme`, tokens semânticos `accent.*`, `background.subtle`, `border.subtle`, `layout.*`). Toda estrutura desenhada no frame deve ser traduzida para componentes MUI existentes — nunca reimplementada com CSS solto ou hex literal. O mapeamento canônico está em §7.

Regra de conflito: **frame manda em estrutura, tema manda em pixel**. Se o frame mostra um chip com 20px de altura e o `Chip size="small"` do tema tem 24px, vale 24px.

---

## 1. Problema

`/[accountId]/settings/*` hoje é uma lista rasa de ~15 páginas CRUD (`settings/layout.tsx` + `SettingsNav.tsx`). Seis problemas concretos, todos catalogados no frame de arquitetura:

- **SET-01 · Navegação**: 15 itens sem hierarquia, separados por um único `Divider`. "Apelidos", "Modelos", "Templates" e "Tipos de tabela" são nomes ambíguos entre si — o usuário não sabe onde procurar sem abrir tudo.
- **SET-02 · Entrada**: não existe porta de entrada. O link "Configurações" da navegação cai em `/settings/general`, que é um formulário de owner. Não há visão do que já está configurado nem do que falta.
- **SET-03 · Padrão**: 15 páginas, 15 cabeçalhos diferentes. Título, contagem, busca e botão primário aparecem em posições distintas; cada página reensina o usuário a operá-la.
- **SET-04 · Escala**: Categorias e Apelidos crescem para centenas de linhas sem busca, filtro, agrupamento ou paginação — viram scroll infinito.
- **SET-05 · Objetos compostos em modal**: tipo de tabela, template de importação e modelo não cabem num diálogo de 480px; precisam de preview ao vivo lado a lado com os controles.
- **SET-06 · Dependências invisíveis**: excluir uma Categoria hoje não mostra que ela é referenciada por apelidos, de-para de templates, transações de modelos e filtros de widget.

Somam-se dois problemas de custo que o frame v2 resolveu e que valem para todas as páginas:

- **SET-07 · Contagem caríssima**: exibir "uso" por objeto em lista exige varrer todas as transações de todos os meses. O custo cresce indefinidamente com a conta.
- **SET-08 · Dois caminhos de criação**: o botão "Novo X" do header e o "Adicionar…" no fim da lista fazem coisas diferentes hoje (modal vs. linha), duplicando validação e confundindo.

---

## 2. Solução

Um **shell único** + **cinco famílias** + **um hub**. Esta spec entrega a moldura; as Specs 68–72 entregam o conteúdo de cada família dentro dela.

### 2.1 Hub em `/settings` (SET-02) — **NOVA FUNCIONALIDADE**

Nova rota `/[accountId]/settings` (index, hoje inexistente) com um card por família, cada linha do card levando à página e mostrando a contagem barata do objeto. No topo, um bloco **"N itens pedem atenção"** agregando sinalizadores acionáveis. O link "Configurações" da sidebar (Spec 65) passa a apontar para cá.

**Sinalizadores (D9)** — exatamente três, todos de leitura barata (tabelas pequenas, sem varrer transações):

| Sinalizador | Regra | Destino do "Revisar" |
|---|---|---|
| Apelido incompleto | `TransactionAlias` que não preenche **nenhum** campo de destino (nem descrição, nem categoria, nem responsável, nem método…) | `/settings/aliases?filter=incomplete` |
| Template quebrado | `CsvTemplate` cujo mapeamento referencia coluna/categoria inexistente | `/settings/templates?filter=broken` |
| Checklist não iniciado | mês corrente sem nenhuma `ChecklistCompletion` | `/settings/checklist` |

> A regra do apelido é a da spec ("nenhum campo preenchido"), **não** a do frame ("sem categoria") — apelido que só normaliza descrição é um uso legítimo e não deve ser sinalizado.

O botão "Revisar" leva ao destino do **primeiro** sinalizador presente, na ordem da tabela. O bloco inteiro não é renderizado quando não há nenhum sinalizador (sem placeholder vazio).

**Grade do hub (D23)** — o frame de arquitetura não põe as 5 famílias como cards iguais:

- grade de **3 colunas**; as famílias 1–4 são cards em **coluna** (entradas empilhadas);
- **Conta** é uma **faixa**: ocupa **2 colunas** (`grid-column: span 2`) e dispõe as entradas **lado a lado**, em colunas de largura igual separadas por borda **lateral** — é o que isola a administração no rodapé do hub em vez de deixá-la disputando atenção com o resto;
- cards da **mesma fileira têm a mesma altura**. Estrutura tem 4 páginas e as vizinhas têm 3: sem esticar, a fileira fica com as bases desencontradas. No CSS isso significa **não** usar `align-items: start` na grade e dar `height: 100%` ao card;
- **o card estica, a linha não.** A entrada da faixa tem a mesma altura de uma linha dos outros cards; a folga do card esticado fica como espaço vazio no rodapé dele, não distribuída nas linhas (`align-content: start` na grade interna). Sem isso as três entradas da Conta ficavam com o dobro da altura das linhas vizinhas;
- **tom do cabeçalho**: ícone e badge da Conta em `warning.main` (mostarda); as outras quatro famílias em `accent.primary`. É o que o frame faz — administração é baixa frequência e alto impacto, e o mostarda marca isso. Campo `tone` no catálogo.
  > Medição para quem revisitar: `warning.main` sobre `warning.light` dá ~2,8:1 em light e ~6,5:1 em dark — abaixo de AA no light. Mantido por fidelidade ao frame, por decisão do autor; se virar problema de leitura, o caminho é escurecer o token de warning no light, não trocar a semântica da cor.
- **separador entre as entradas da faixa**: borda **lateral** em `divider`. Atenção à armadilha do `sx` registrada em `skills/design-system/SKILL.md` — shorthand de borda com valor responsivo reseta a cor para `currentColor` e o divider sai quase preto; usar longhand de `width`/`style`.

Recortes por papel: a faixa segue faixa para o `editor` (2 entradas, 2 colunas) e **volta a ser card em coluna** para o `viewer`, que só vê Membros — uma faixa de item único seria um card de 2/3 de largura sozinho na tela.

### 2.2 `SettingsPageShell` (SET-03) — **NOVO COMPONENTE**

Componente único que todas as 15 páginas usam. Sete regras, todas visíveis no frame de arquitetura:

1. **Breadcrumb** `Configurações / <Família>` acima do título, sempre.
2. **Contagem no título** — `Chip` ao lado do nome (`6 · 1 inativa`, `18 · 47 sub`, `últimos 90 dias`).
3. **Uma frase de propósito** abaixo do título, sempre — é o que desfaz a ambiguidade de "Modelos" vs "Templates" vs "Tipos" sem renomear nada.
4. **Uma única ação primária**, canto superior direito, `variant="contained"`. Secundárias como `variant="outlined"` à esquerda dela.
5. **Toolbar condicional** — busca/filtro/ordenação só aparecem acima de 12 itens. Listas curtas (Seções, Responsáveis, Conectores) não ganham busca. **O gate é do shell** (prop `itemCount`), não de cada página (D6).
6. **Estado vazio padronizado** — ícone, uma frase do que o objeto faz, ação primária e, quando existir, atalho de preset/importação.
7. **Barra de salvar fixa no rodapé** com "N alterações não salvas" — nunca um botão flutuando no meio do formulário. Só existe em formulários (arquétipos C e D); listas A/B salvam inline e não têm barra (D7).

**Tipografia e densidade (D5 · D15)**: o cabeçalho do shell segue a **escala do frame**, que é mais densa que a do resto do app — título `Typography variant="h4"` (18px, a variante deste tema mais próxima dos 17,6px do frame; o `h6` daqui vale 14px, menor que o corpo do texto), propósito em `body2`, breadcrumb em `caption`. Consequência direta: **o shell não reusa `PageHeader`** (que renderiza `h3` e não tem slot para o chip de contagem); monta o próprio cabeçalho com `Breadcrumbs` + `Typography` + `Chip`. Cor e espaçamento continuam vindo de tokens do tema — nenhum hex, nenhum `fontSize` avulso onde existe variante.

### 2.3 Quatro arquétipos (SET-05)

Toda página cai em um dos quatro. O arquétipo determina o layout interno; o shell é o mesmo.

| Arq. | Nome | Quando | Páginas |
|---|---|---|---|
| **A** | Lista simples | objeto de 2–5 campos, edita na linha | Instituições, Responsáveis, Apelidos, Conectores, Membros |
| **B** | Lista hierárquica | pai/filho, ordem importa | Seções, Categorias, Checklist |
| **C** | Master-detail | objeto composto com preview ao vivo | Tipos de tabela, Modelos, Templates, Dashboards |
| **D** | Formulário | campos em blocos rotulados + zona de perigo | Geral, Projeção, Auditoria |

### 2.4 Status em vez de contagem de uso (SET-07) — **MUDANÇA DE MODELO**

A coluna "Uso" desenhada na v1 **sai de todas as listas**. Entra uma coluna **Status** de duas partes: um `Switch` ativo/inativo e, ao lado, o rótulo de `lastUsedAt` ("jul/2026", "nunca usada", "desativado"). Leitura de custo zero — `lastUsedAt` é gravado na escrita, não calculado na leitura.

Contagem real de transações existe em **exatamente três lugares**, sempre sob demanda:
- menu da linha → **Ver uso** (modal M3, com cache de 24h);
- aba **"Onde é usado"** do arquétipo C (botão "Contar", resultado com timestamp e "Recontar");
- modal de **exclusão com realocação** (M2) — aí a contagem é obrigatória, é ela que trava a exclusão.

Referências **de configuração** (quantos apelidos, quantos de-para, quantos modelos, quantos widgets) continuam sendo contadas e exibidas livremente: vêm de tabelas pequenas e limitadas, e são o raio de impacto real de renomear ou excluir.

### 2.5 Um único caminho de criação (SET-08)

Nos arquétipos **A e B**, o botão primário do header **rola até a linha-fantasma no fim da lista e foca o primeiro campo** — mesmo resultado de clicar em "Adicionar…". Enter grava e abre a próxima linha; Esc cancela. Modal de criação só quando o objeto não cabe na linha (Apelidos) ou o arquétipo é C (criação abre o detalhe vazio).

### 2.6 Menu da linha padronizado

Sempre a mesma ordem, em toda página: **Editar · Duplicar · Ativar/desativar · Ver uso · Mesclar · Excluir**. Itens inaplicáveis **somem** — nunca aparecem desabilitados.

### 2.7 Catálogo de modais (`SettingsDialog`) — **NOVO COMPONENTE**

Três larguras: **420px** confirmação curta, **560px** formulário curto, **720px** editor com preview. Sempre: título que nomeia o objeto, corpo rolável, rodapé fixo com a primária à direita, Esc cancela.

`SettingsDialog` envolve o **`DialogShell` existente** e expõe `size: "confirm" | "form" | "editor"`. As larguras são **px explícitos** via `PaperProps` (D8) — **não** os breakpoints do MUI, que valem 444/600/900 e ficariam largos demais, sobretudo na confirmação. O M4 do frame (620px) é normalizado para 720: a regra das três larguras vence o desenho.

Os 8 modais catalogados no frame v2 (M1 apelido, M2 excluir com realocação, M3 ver uso, M4 importar categorias, M5 mesclar, M6 convidar, M7 template a partir de arquivo, M8 desativar) são implementados nas Specs 68–72 sobre este shell.

---

## 3. User Stories

- Como usuário, quero abrir Configurações e ver o que já está configurado e o que pede atenção, em vez de cair num formulário de conta.
- Como usuário, quero que toda página de configuração se opere igual: mesma posição de título, contagem, busca e botão de criar.
- Como usuário, quero saber para que serve cada página lendo uma frase, sem clicar.
- Como usuário, quero criar um item na própria lista, sem abrir modal para um objeto de dois campos.
- Como usuário, quero desativar um objeto que não uso mais em vez de excluí-lo e perder histórico.
- Como usuário, quero descobrir quanto um objeto é usado quando eu pedir — não pagar essa conta em cada carregamento de página.
- Como owner, quero que excluir algo referenciado me obrigue a escolher o destino antes.

---

## 4. Critérios de Aceitação

> **Limite de entrega desta spec (D22).** A 67 entrega a **moldura**; as Specs 68–72 entregam o **conteúdo** de cada
> lista. O §9 P4 diz explicitamente "só o cabeçalho — conteúdo intacto", e é isso que foi feito. Consequência: alguns
> critérios abaixo se cumprem em duas etapas, e é preciso ser honesto sobre qual metade está pronta.
>
> | Critério | O que a 67 entrega | O que fica para 68–72 |
> |---|---|---|
> | SET-02 hub · SET-01 nav · SET-03 shell | **completo, na tela** | — |
> | SET-04 escala | gate dos 12 no shell + `SettingsToolbar` + `SettingsPagination`, com Apelidos como consumidor real | busca/filtro nas demais listas longas |
> | SET-07 status e uso | `status`/`lastUsedAt` no banco, escrita nos pontos de consumo, `StatusCell`, `formatLastUsedLabel`, `countUsageAction` com cache de 24 h | a **coluna Status** em cada lista e os modais M3/M8 — dependem do redesenho da linha |
> | SET-08 criação única | `GhostRow` com `focus()` imperativo e teclado (Enter/Esc) | trocar o modal pela linha-fantasma em cada página de arquétipo A/B |
> | SET-06 / modais | `SettingsDialog` com as 3 larguras, adotado nos modais existentes de settings | M1, M2, M4–M7 (conteúdo novo) |
>
> Um critério marcado como "fica para 68–72" **não está cumprido hoje na tela**. Está cumprido o contrato, com teste
> unitário — o que garante que a página que o adotar não vai reinventar a regra.

**SET-02 — Hub:**
- QUANDO o usuário acessa `/[accountId]/settings`, DEVE ver um card por família na ordem Estrutura → Apresentação → Entrada de dados → Planejamento → Conta, com uma linha por página e a contagem barata de cada objeto.
- O card **Conta** DEVE ser marcado com o badge "somente owner" e DEVE conter apenas os itens que o papel corrente pode acessar: `owner` vê Geral, Membros e Trilha de auditoria; `editor` vê Geral e Membros; `viewer` vê apenas Membros (D19).
- QUANDO existirem itens sinalizados, O BLOCO "N itens pedem atenção" DEVE aparecer no topo com uma ação "Revisar" apontando para o destino do primeiro sinalizador (§2.1); SE não houver nenhum, O BLOCO NÃO DEVE ser renderizado (sem placeholder vazio).
- O link "Configurações" da sidebar DEVE apontar para `/settings` (não mais `/settings/general`).
- O card **Apresentação** DEVE mostrar Dashboards como **uma única linha** apontando para `/settings/dashboards` (que redireciona para `monthly`) — não três (D4).

**SET-01 — Nav das famílias:**
- O `SettingsNav` DEVE agrupar os 15 links nas 5 famílias, cada família com cabeçalho `Typography variant="overline"`, e exibir a contagem do objeto à direita do rótulo quando houver.
- Os itens `ownerOnly` da família Conta (hoje, só a Trilha de auditoria) NÃO DEVEM ser renderizados para papéis diferentes de `owner` (D19).

**SET-03 — Shell:**
- TODAS as 15 páginas (17 rotas — ver D4) DEVEM renderizar através de `SettingsPageShell`, com breadcrumb, título, chip de contagem, frase de propósito e no máximo uma ação primária.
- A ação primária DEVE ser `variant="contained"`; ações secundárias `variant="outlined"`, sempre à esquerda dela.
- SE `dirtyCount` for `undefined`, A BARRA DE RODAPÉ NÃO DEVE ser renderizada (listas A/B, que salvam inline).
- SE `dirtyCount` for `0`, A BARRA DEVE ser renderizada com o texto "Nenhuma alteração" e os dois botões desabilitados.
- SE `dirtyCount` for `> 0`, A BARRA DEVE exibir "N alterações não salvas" + Descartar + Salvar habilitados.

**SET-04 — Escala:**
- SE `itemCount > 12`, O SHELL DEVE renderizar a `toolbar` recebida; SE `itemCount <= 12` ou `itemCount` for `undefined`, A TOOLBAR NÃO DEVE ser renderizada — mesmo que a prop `toolbar` tenha sido passada. **A decisão é do shell, não da página** (D6).
- SE a lista passar de 50 itens, DEVE usar paginação (não scroll infinito), com seletor de itens por página. O **estado** da paginação é de cada página (Specs 68–72), porque depende da fonte de dados; o shell não o conhece. Mas a Spec 67 entrega a primitiva **`SettingsPagination`** (sobre `TablePagination`, com os rótulos em pt-BR e a densidade do frame) para que Apelidos (Spec 70 §61) e as demais listas longas não reimplementem o mesmo controle — **D14**.

**SET-07 — Status e uso:**
- NENHUMA lista de configurações DEVE exibir contagem de transações como coluna.
- TODA lista de objeto desativável DEVE ter a coluna Status = `Switch` + rótulo de `lastUsedAt`; SE `lastUsedAt` for nulo, O RÓTULO DEVE ser "nunca usada/usado"; SE o objeto estiver inativo, DEVE ser "desativado" e a linha DEVE ser renderizada com opacidade reduzida.
- `StatusCell` DEVE receber `active: boolean` já normalizado (ver §7.4/D2) — NÃO DEVE conhecer `isActive`, `archivedAt` nem `status` diretamente.
- QUANDO o usuário aciona "Ver uso" no menu da linha, O SISTEMA DEVE contar sob demanda e exibir o resultado com timestamp e opção de recontar; O RESULTADO DEVE ser cacheado por 24 h.

**SET-08 — Criação única:**
- QUANDO o usuário clica na ação primária de uma página de arquétipo A ou B, A PÁGINA DEVE rolar até a linha-fantasma e focar seu primeiro campo — NÃO DEVE abrir modal.
- QUANDO o usuário pressiona Enter numa linha-fantasma válida, O ITEM DEVE ser criado e uma nova linha-fantasma DEVE receber o foco; Esc DEVE descartar a linha em edição.

**SET-06 / modais:**
- Todo modal de configurações DEVE usar uma das três larguras (420 / 560 / 720) e ter rodapé fixo com a primária à direita.
- QUANDO o usuário exclui um objeto com referências de configuração, O DIÁLOGO DEVE listar as referências por tipo com contagem e EXIGIR um destino de realocação antes de habilitar a exclusão.

**Papéis:**
- `editor` DEVE acessar as famílias 1–4; da família Conta DEVE ver Geral e Membros, mas NÃO DEVE ver Trilha de auditoria (owner-only).
- `viewer` **NÃO é redirecionado para fora de `/settings/*`** — o carve-out da Spec 65 §4 (NAV-04) / §10.5 (Opção 2) é mantido: `viewer` acessa `/settings/members` em modo leitura, e o `SettingsNav` mostra apenas a família Conta com o único link de Membros (D3). No hub, `viewer` vê apenas o card Conta com a linha Membros.

> Correção de D3: o texto anterior desta spec ("viewer continua redirecionado para fora de `/settings/*` — comportamento atual mantido") descrevia um comportamento que **não** é o atual. O redirect global foi removido de propósito em `settings/layout.tsx` pela Spec 65. A Spec 65 vence.

---

## 5. Fora de Escopo

- Conteúdo específico de cada página — está nas Specs 68 a 72.
- Busca global ⌘K dentro de configurações — o campo aparece no frame do hub, mas a implementação fica para spec futura; nesta spec o hub não tem busca funcional.
- Redesenho da sidebar principal — Spec 65.
- Redesenho da linha de transação em si — Spec 66. Esta spec apenas hospeda os campos `rowLayout`/`density` (Spec 69).
- Tema light/dark: deve funcionar em ambos por usar tokens, mas nenhum ajuste de paleta é feito aqui.
- Página nova de **Metas por categoria** — decisão aberta registrada no frame v2, não entra em nenhuma das 6 specs.

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Porta de entrada | Hub em `/settings` com cards por família | Resolve SET-02 e serve de onboarding sem criar wizard separado |
| Agrupamento | 5 famílias por **intenção** (estruturar, apresentar, alimentar, planejar, administrar) | 3–4 itens por família fica abaixo do limite de leitura por varredura |
| Reclassificação | Tipos de tabela e Modelos saem de "Importação" → "Apresentação"; Conectores entram em "Entrada de dados" | Corrige a taxonomia da Spec 65 §7.2: eram 6 famílias desiguais, viram 5 equilibradas |
| Uso por objeto | `lastUsedAt` + referências baratas; transações só sob demanda | Contagem de transação em lista tem custo que cresce com a conta (SET-07) |
| Desativar vs. excluir | `status` em 12 entidades | Objeto que saiu de uso não precisa ser destruído; preserva histórico dos meses fechados |
| Criação | Um caminho por arquétipo | Elimina divergência de validação entre modal e linha (SET-08) |
| Modais | 3 larguras fixas | Previsibilidade; evita diálogo sob medida por tela |
| Densidade | Definida pelo frame, valores do tema | Frame é blueprint de estrutura, não folha de estilo (§0) |

---

## 7. Referências Técnicas

### 7.1 Arquivos

| Item | Arquivo(s) | Estado |
|---|---|---|
| Hub (rota) | `src/app/(app)/[accountId]/settings/page.tsx` | **novo** |
| Hub (UI) | `src/components/settings/SettingsHub.tsx`, `SettingsFamilyCard.tsx`, `SettingsAttentionBanner.tsx` | **novos** |
| Sinalizadores do hub | `src/server/queries/settings-attention.ts` (+ `src/lib/settings/broken-template.ts`, regra pura) | **novo** |
| Shell | `src/components/settings/SettingsPageShell.tsx` | **novo** |
| Toolbar do shell | `src/components/settings/SettingsToolbar.tsx` | **novo** |
| Paginação de lista | `src/components/settings/SettingsPagination.tsx` (sobre `TablePagination`) | **novo** (D14) |
| Barra de salvar | `src/components/settings/SettingsSaveBar.tsx` | **novo** |
| Estado vazio | `src/components/settings/SettingsEmptyState.tsx` (envolve `@/components/ui/EmptyState`) | **novo sobre reuso** |
| Modais | `src/components/settings/SettingsDialog.tsx` (envolve `@/components/ui/DialogShell`) | **novo sobre reuso** |
| Linha-fantasma | `src/components/settings/GhostRow.tsx` | **novo** |
| Status | `src/components/settings/StatusCell.tsx` + `src/lib/settings-status.ts` (`formatLastUsed`, `isActive` adapter) | **novos** |
| Menu da linha | `src/components/settings/RowActionsMenu.tsx` | **novo** |
| Nav em famílias | `src/components/settings/settings-nav-groups.ts`, `SettingsNav.tsx`, `settings/layout.tsx` | **estende** |
| Catálogo das famílias | `src/components/settings/settings-catalog.ts` + `settings-icons.tsx` | **novo** — fonte única de nav e hub |
| Contagens do nav/hub | `src/server/queries/settings-counts.ts` | **novo** |
| Revalidação do hub | `src/server/api/revalidate.ts` (`revalidateSettingsHub`) | **estende** |
| Uso sob demanda | `src/actions/settings-usage.ts` | **novo** |
| Rótulos | `src/lib/messages/pt-BR.ts` (`m.settings.nav.groups.*`) | **estende** |
| Link da sidebar | `src/components/ui/AppSidebar.tsx` (Spec 65) | **estende** |
| Shell antigo | `src/components/settings/PageSettingsContainer.tsx` | **deletar** ao fim do P4 |

> `@/components/ui/PageHeader` **não** é reusado aqui: renderiza `h3` e não tem slot para o chip de contagem, e a densidade do shell segue o frame (D5). Fica intocado para o resto do app.

### 7.2 Tradução frame → MUI (canônica para as Specs 68–72)

| Elemento no frame | Componente MUI | Notas |
|---|---|---|
| Painel de página | `Box` + `Paper variant="outlined"` | sem sombra; borda `border.subtle` |
| Breadcrumb | `Breadcrumbs` + `Typography variant="caption"` | separador `/` |
| Título | `Typography variant="h4"` | D5/D15: escala do frame. `h6` neste tema é 14px — não é o `h6` de 20px do MUI default |
| Chip de contagem | `Chip size="small" variant="outlined"` | texto em `text.tertiary` |
| Frase de propósito | `Typography variant="body2" color="text.tertiary"` | D20: `text.secondary` (#4A453C) é quase o primário e competia com o título; o frame usa o tom terciário |
| Ação primária / secundária | `Button variant="contained"` / `variant="outlined"` `size="small"` | ícone via `startIcon` |
| Toolbar | `Stack direction="row"` + `TextField size="small"` + `Button` com `Menu` | |
| Cabeçalho de lista | `TableHead` + `TableCell` `variant="head"` | rótulos em `overline` |
| Linha de lista | `TableRow` + `TableCell` `size="small"` | grid do frame vira larguras de coluna |
| Alça de arraste | `DragIndicator` + `@dnd-kit/core` + `@dnd-kit/sortable` | já são dependências do projeto |
| Pílula/badge | `Chip size="small"` | ponto de cor = `Box` 8px `borderRadius: "3px"` |
| Toggle de status | `Switch size="small"` | |
| Abas do arquétipo C | `Tabs` + `Tab` | contagem no rótulo via `Chip` |
| Lista mestre (260px) | `List` + `ListItemButton selected` | mesmo padrão de "ativo" do `SettingsNav` |
| Rodapé de salvar | `Paper` sticky bottom + `Stack` | |
| Grupo de opções exclusivas | `ToggleButtonGroup exclusive` ou `RadioGroup` em cards | cards quando a opção precisa de preview |
| Campo de formulário | `TextField size="small"` / `Select` / `Autocomplete` | rótulo acima via `InputLabel` estilo do frame |
| Hint de campo | `FormHelperText` | |
| Bloco rotulado | `Typography variant="overline"` + `Stack` | |
| Zona de perigo | `Paper` com `bgcolor: "danger.subtle"` + `Button color="error"` | **`error.subtle` não existe no tema**; os tokens reais são `danger.subtle` / `danger.main` (`error.light` é alias de `danger.subtle`) |
| Modal | `SettingsDialog size="confirm"\|"form"\|"editor"` → 420 / 560 / 720 px explícitos sobre `DialogShell` | D8: **não** usar `maxWidth` xs/sm/md, que valem 444/600/900 |
| Estado vazio | **novo** `SettingsEmptyState` sobre `EmptyState` existente | acrescenta o slot de atalho preset/importação, que o `EmptyState` não tem |
| Menu da linha | `IconButton` + `Menu`/`MenuItem` | itens inaplicáveis não renderizados |
| Snackbar de feedback | `enqueueSnackbar` existente | |

### 7.3 Contrato do `SettingsPageShell`

```tsx
type SettingsPageShellProps = {
  family: "Estrutura" | "Apresentação" | "Entrada de dados" | "Planejamento" | "Conta";
  title: string;
  count?: string;              // "18 · 47 sub" — string, não número: cada página formata a sua
  purpose: string;             // obrigatório (Regra 3)
  primaryAction?: { label: string; icon?: ReactNode; onClick: () => void };
  secondaryActions?: Array<{ label: string; icon?: ReactNode; onClick: () => void }>;
  toolbar?: ReactNode;         // busca/filtro/ordenação — renderizado só se itemCount > 12 (Regra 5)
  itemCount?: number;          // D6: o gate dos 12 é do shell, não da página
  subheader?: ReactNode;       // D12: faixa informativa NUNCA sujeita ao gate (legendas, avisos)
  ownerOnly?: boolean;         // pinta o chip "owner"
  dirtyCount?: number;         // D7: undefined ⇒ sem barra | 0 ⇒ barra desabilitada | >0 ⇒ ativa (Regra 7)
  saveLabel?: string;          // D13: default "Salvar"; Spec 69 usa "Salvar tipo", "Publicar layout"…
  onSave?: () => void;
  onDiscard?: () => void;
  children: ReactNode;
};
```

**D12 · `toolbar` vs `subheader`.** A Spec 68 §2.1 põe uma *legenda de tipos* na faixa abaixo do cabeçalho de **Seções**, que tem 6 itens — o gate dos 12 a esconderia. São coisas diferentes e ganham slots diferentes: `toolbar` é o controle de escala (busca/filtro/ordenação) e obedece ao gate; `subheader` é faixa informativa e **sempre** renderiza. O teste do §8 continua valendo sem ressalva.

**D13 · `saveLabel`.** A Spec 69 §274 exige rótulo customizável no rodapé ("Salvar tipo", "Salvar modelo", "Publicar layout"). Default `"Salvar"`.

Regras do contrato que os testes do §8 verificam:

| Entrada | Resultado |
|---|---|
| `itemCount` ausente ou `<= 12` | toolbar **não** renderiza, mesmo com `toolbar` passado |
| `itemCount > 12` | toolbar renderiza |
| `dirtyCount` ausente | barra de rodapé **não** renderiza |
| `dirtyCount === 0` | barra com "Nenhuma alteração", Descartar e Salvar `disabled` |
| `dirtyCount > 0` | barra com "N alterações não salvas", ambos habilitados |
| `secondaryActions` | sempre `variant="outlined"`, **à esquerda** da primária |

```tsx
// ✅ Correto — página só declara conteúdo; moldura vem do shell
<SettingsPageShell
  family="Estrutura"
  title="Categorias"
  count="18 · 47 sub"
  purpose="Classificam cada transação. Usadas por apelidos, templates de importação e widgets de dashboard."
  primaryAction={{ label: "Nova categoria", icon: <AddIcon />, onClick: focusGhostRow }}
  toolbar={<CategoriesToolbar />}
>
  <CategoriesTree />
</SettingsPageShell>

// ❌ Anti-padrão — cabeçalho próprio por página (é exatamente o SET-03)
<Box><Typography variant="h6">Categorias</Typography><Button>Nova</Button></Box>
```

### 7.4 Prisma — campos novos desta spec

**Correção D1** — a lista original citava 5 entidades que não existem no schema. Os nomes reais são:

| Nome no texto original | Model real | Observação |
|---|---|---|
| `TableModel` | `TableTemplate` (+ `TableTemplateItem`) | |
| `ImportTemplate` | `CsvTemplate` | |
| `Alias` | `TransactionAlias` | |
| `ChecklistGroup` | — | **não existe**: o checklist é plano (`ChecklistItem` + `ChecklistCompletion`). Sai do escopo |
| `AiConnector` | `McpClient` (Spec 63) | **`McpToken.lastUsedAt` já existe** — não duplicar. `McpClient` entra apenas para `status` |

Escopo real: **10 entidades** — `Section`, `Category`, `Subcategory`, `Institution`, `ResponsibleParty`, `TableType`, `TableTemplate`, `CsvTemplate`, `TransactionAlias`, `ChecklistItem`.

**Estado ativo/inativo (D2) — estratégia adapter, sem migração destrutiva.**
Três entidades já têm um mecanismo próprio e **continuam com ele**; `status` é adicionado **apenas** onde não existe nada:

| Entidade | Fonte da verdade de "ativo" | Ação |
|---|---|---|
| `Section` | `isActive: Boolean` (já existe) | mantém |
| `ResponsibleParty` | `archivedAt: DateTime?` (já existe) | mantém |
| `TransactionAlias` | `archivedAt: DateTime?` (já existe) | mantém |
| demais 7 | — | adicionar `status SettingsStatus @default(active)` |

A UI nunca lê essas colunas direto: `src/lib/settings-status.ts` expõe um normalizador por entidade que devolve `active: boolean`, e `StatusCell` só conhece esse booleano. Zero dupla fonte de verdade, zero backfill.

```prisma
enum SettingsStatus { active inactive }   // só nas 7 entidades sem mecanismo próprio

status      SettingsStatus @default(active)
lastUsedAt  DateTime?                      // nas 10 (exceto onde já existe, ex.: McpToken)
```

- `lastUsedAt` é atualizado **na escrita** que usa o objeto (criar/editar transação, rodar importação, criar mês a partir de modelos) — nunca calculado em leitura.
- Migração puramente aditiva: `status` com default `active`, `lastUsedAt` nulo para o legado (renderiza "nunca usada" até o primeiro uso).
- Cache de contagem sob demanda: tabela `UsageCount { entity, entityId, transactions, months, countedAt }`, TTL 24 h.

### 7.5 Cabeçalhos das 15 páginas (extraídos do frame v2 — normativo para o P4)

Formato do chip é livre por página (`count` é string). Ações listadas são as do frame; as que dependem de funcionalidade das Specs 68–72 entram junto com elas — no P4 migra-se o que a página **já** tem.

| Família | Título | Chip | Ação primária | Frase de propósito |
|---|---|---|---|---|
| Estrutura | Seções | `6 · 1 inativa` | Nova seção | As abas de cada mês. A ordem aqui é a ordem das abas. Seção inativa não aparece em meses novos nem aceita modelos. |
| Estrutura | Categorias | `18 · 47 sub` | Nova categoria | Classificam cada transação. Usadas por apelidos, templates de importação e widgets de dashboard. |
| Estrutura | Instituições | `9` | Nova instituição | Bancos, cartões, corretoras e empresas. Campo opcional da transação e agrupador da importação. |
| Estrutura | Responsáveis | `4` | Novo responsável | Quem paga ou recebe. Um responsável pode agrupar vários membros da conta, ou nenhum — é só um rótulo da transação. |
| Apresentação | Tipos de tabela | `5` | Novo tipo | Definem colunas visíveis, densidade e formato da linha para cada tabela do mês. |
| Apresentação | Modelos de tabela | `7` | Novo modelo | Tabelas financeiras pré-montadas, com suas transações. Usadas ao criar um mês novo e ao adicionar uma tabela dentro de um mês. |
| Apresentação | Dashboards | — (D24) | — (secundárias: Restaurar padrão · Ver a página) | Monte cada página arrastando widgets no grid. O que você vê aqui é exatamente o que o usuário vê na página. |
| Entrada de dados | Templates de importação | `4` | Novo (secundária: Criar a partir de um arquivo) | Cada etapa do parsing tem sua aba. O preview à direita reprocessa o arquivo de amostra a cada mudança. |
| Entrada de dados | Apelidos | `132` | Novo apelido | Regra de reconhecimento por descrição do extrato. Pode preencher qualquer campo da transação — os que você deixar em branco continuam em branco, sem alerta. |
| Entrada de dados | Conectores de IA | `1 conectado` | Nova conexão | Expõem os dados desta conta para a IA que você já usa, via MCP. A plataforma não guarda chave de IA nem chama modelo nenhum. |
| Planejamento | Projeção | — | — (secundárias: Voltar ao padrão · Abrir /forecast) | Parâmetros que alimentam o gráfico da página de projeção. Cada campo explica o que muda — e o gráfico à direita reage na hora. |
| Planejamento | Checklist mensal | `11 itens · 3 grupos` | Novo item | A definição do ritual de fechamento. Não há progresso aqui — quem marca é o widget de Checklist, dentro de cada mês. |
| Conta | Geral | — (chip `owner`) | — | Identidade, padrões e manutenção desta conta. Afetam todos os membros. |
| Conta | Membros | `3 · 1 convite` | Convidar | Quem acessa esta conta e com qual papel. Owner vê tudo; editor não acessa a família Conta; viewer só lê. |
| Conta | Trilha de auditoria | `últimos 90 dias` | — (secundária: Exportar CSV) | Toda alteração de estrutura, papel e exclusão em massa. Somente leitura. |

> O chip de Checklist ("3 grupos") pressupõe `ChecklistGroup`, que **não existe** e ficou fora do escopo por D1 — no P4 o chip de Checklist mostra só a contagem de itens; agrupamento é decisão da Spec 71.
> Dashboards **não tem contagem** (D24): as três páginas (mensal, anual, resumo) são fixas, então qualquer número ali é ruído — `3` é constante, e "N personalizados" mede algo que ninguém pediu para saber. A linha do hub e o item do nav saem só com rótulo e subtítulo.
> As três sub-rotas de Dashboards (`monthly`, `yearly`, `month-summary`) usam o mesmo título "Dashboards" com o nome da página no chip.

### 7.6 Restrições do design system

- Nada de hex literal, nada de `style` inline com cor: usar tokens (`accent.primary`, `background.subtle`, `border.subtle`, `text.tertiary`, `layout.*`).
- Nenhum componente novo que duplique um MUI existente. Componentes novos permitidos são apenas os **composições** listadas em §7.1.
- Espaçamentos por tokens `layout.*`; densidade das listas via `size="small"` + as variáveis de densidade da Spec 69 quando a tabela for de transação.

---

## 8. Critérios de Teste

**E2E (Playwright):**
- `/settings` renderiza 5 cards para `owner` e 4 para `editor` (sem o card Conta), com contagens; clicar numa linha navega para a página certa.
- Toda página de settings expõe breadcrumb, título, frase de propósito e no máximo um botão `contained` no header — **varredura automatizada pelas 17 rotas** (15 páginas, com Dashboards contando 3 sub-rotas; ver D4).
- Clicar na ação primária em Categorias foca a linha-fantasma; Enter cria e mantém o foco na próxima linha.
- Lista com ≤12 itens (Responsáveis) não tem campo de busca; lista com >12 (Apelidos) tem.
- Desativar um objeto: linha fica atenuada, rótulo passa a "desativado", objeto deixa de ser oferecido em selects de criação.
- Excluir objeto com referências: botão de confirmação só habilita depois de escolher destino.
- `editor` vê Geral e Membros mas não Trilha de auditoria; **`viewer` acessa `/settings/members` em leitura** e vê apenas o card/família Conta (D3).

**Unit (Vitest):**
- Mapeamento família→páginas cobre as 17 rotas sem órfão nem duplicata (atualizar `settings-nav-groups.test.ts`).
- Formatação de `lastUsedAt` → rótulo ("jul/2026", "nunca usada", "desativado").
- Normalizador de status: `Section.isActive`, `ResponsibleParty.archivedAt` e `TransactionAlias.archivedAt` → mesmo `active: boolean` (D2).
- Regra da toolbar: `itemCount > 12` ⇒ toolbar presente; `<= 12` ou ausente ⇒ ausente **mesmo com `toolbar` passado**.
- `dirtyCount` → `undefined` sem barra, `0` desabilitada, `> 0` ativa.
- Ordem do `RowActionsMenu` e omissão (não desabilitação) dos itens inaplicáveis.
- `SettingsDialog`: cada `size` produz a largura em px esperada (420/560/720).
- Sinalizadores do hub: cada regra do §2.1 liga/desliga isoladamente; nenhum sinalizador ⇒ banner não renderiza.

---

## 9. Plano de Execução (pacotes)

Ordem de dependência: **P1 → P2 → P3 → P4 → P0 → P5 → P6**. O Prisma (P0) foi movido para depois da UI porque, pela estratégia adapter (D2), nenhuma primitiva depende de coluna nova: `StatusCell` recebe `active`/`lastUsedAt` como props puras. Nenhum pacote avança com verificação pendente ou falhando.

Todos os comandos rodam no container: `docker compose exec app <cmd>`.

### P1 · Primitivas isoladas — nenhuma página tocada

Entrega: `SettingsPageShell`, `SettingsToolbar`, `SettingsSaveBar`, `SettingsEmptyState`, `SettingsDialog`, `StatusCell`, `GhostRow`, `RowActionsMenu`, `src/lib/settings-status.ts`.

- Shell monta o próprio cabeçalho (D5), **sem** `PageHeader`.
- Gate da toolbar por `itemCount` (D6) e semântica de `dirtyCount` (D7) dentro do shell.
- `SettingsDialog` com larguras px explícitas (D8) sobre `DialogShell`.
- Testes unitários de todas as regras do §7.3 e do §8.

Verificação: `pnpm typecheck` + `pnpm test`.

### P2 · Nav nas 5 famílias

Entrega: `settings-nav-groups.ts` regrupado (Estrutura · Apresentação · Entrada de dados · Planejamento · Conta), contagens à direita do rótulo, `settings-counts.ts`, novas chaves em `messages/pt-BR.ts` (`presentation`, `dataEntry`; saem `import`, `visualization`, `integrations`) e correção do typo `"Connectors de IA"` → `"Conectores de IA"`.

- Reclassificação do §6: Tipos de tabela e Modelos → Apresentação; Conectores → Entrada de dados.
- Dashboards continua um `CollapsibleNavItem` com 3 sub-links (D4).
- Carve-out do `viewer` preservado (D3).

Verificação: `pnpm typecheck` + `settings-nav-groups.test.ts` atualizado (17 rotas, sem órfão nem duplicata).

### P3 · Hub em `/settings`

Entrega: `settings/page.tsx`, `SettingsHub`, `SettingsFamilyCard`, `SettingsAttentionBanner`, `settings-attention.ts`, e o redirect do link da sidebar (`AppSidebar`: `${settingsBase}/general` → `${settingsBase}`).

- Cards na ordem Estrutura → Apresentação → Entrada de dados → Planejamento → Conta.
- Card Conta só para `owner`, com badge "somente owner".
- Banner de atenção pelas 3 regras do §2.1; ausente quando não há sinalizador.
- **Sem** campo de busca ⌘K (§5) — não renderizar nem desabilitado.

Verificação: `pnpm typecheck` + `pnpm test` + e2e do hub (5 cards owner / 4 editor / card Conta apenas para viewer).

### P4 · Migrar as 15 páginas (17 rotas) para o shell

Só o cabeçalho; conteúdo intacto. **Um commit por página**, na ordem das famílias. Ao final, deletar `PageSettingsContainer.tsx` e conferir que nenhuma referência sobrou.

Verificação: `pnpm typecheck` + `pnpm test` a cada página; ao fim, e2e de varredura das 17 rotas (breadcrumb, título, propósito, no máximo um `contained`).

### P0 · Prisma

Entrega: `enum SettingsStatus` + `status` nas 7 entidades sem mecanismo próprio, `lastUsedAt` nas 10, tabela `UsageCount`. Migração aditiva (§7.4).

Verificação: `prisma validate` + `prisma migrate dev` + **`docker compose restart app`** (obrigatório — ver CLAUDE.md §8) + `pnpm typecheck`.

### P5 · Uso sob demanda

Entrega: escrita de `lastUsedAt` nos pontos de consumo (criar/editar transação, importação, criação de mês a partir de modelos) + `src/actions/settings-usage.ts` com cache de 24 h sobre `UsageCount`.

Escopo fechado em D10: **a infraestrutura é do 67; os modais M2 e M3 concretos são das Specs 68–72.**

Verificação: `pnpm typecheck` + `pnpm test` (inclusive multi-tenancy da action).

### P6 · Varredura final

E2E completo + passada visual em **light e dark** (`claude-in-chrome`) contra os critérios do §4, entregando **uma lista consolidada** de divergências.

Só então entram as Specs 68 → 69 → 70 → 71 → 72, na ordem.

---

## 10. Decisões resolvidas (2026-08-09)

| # | Questão | Decisão |
|---|---|---|
| D1 | 5 dos 12 nomes de entidade do §7.4 não existem | Usar nomes reais do Prisma; escopo cai para 10 entidades. `ChecklistGroup` e `AiConnector` saem (§7.4) |
| D2 | `status` duplicaria `isActive`/`archivedAt` existentes | Adapter: manter mecanismos existentes, `status` só onde não há nada, `StatusCell` recebe `active: boolean` normalizado (§7.4) |
| D3 | §4 dizia que `viewer` é redirecionado para fora de `/settings/*` | Falso: Spec 65 (NAV-04) vence. `viewer` acessa `/settings/members` em leitura; §4 corrigido |
| D4 | "15 páginas" vs 17 rotas reais | Dashboards = 1 linha no hub/nav, 3 sub-rotas com shell. E2E varre 17 rotas |
| D5 | §7.2 pede `h6`, o projeto usa `h3` em título de página | Manter a escala do frame (`h6`, densidade menor). Consequência: shell **não** reusa `PageHeader` (§2.2) |
| D6 | Gate dos 12 itens: shell ou página? | Shell, via `itemCount`. Paginação (>50) fica com cada página (§4, §7.3) |
| D7 | Quando a barra de salvar existe | `undefined` sem barra · `0` desabilitada · `>0` ativa (§4, §7.3) |
| D8 | Larguras de modal não batem com MUI nem com `containers` | px explícitos no `SettingsDialog` (420/560/720); M4 normalizado de 620 → 720 (§2.7) |
| D9 | Regra do bloco "pedem atenção" diverge entre spec e frame | Regra da spec (apelido sem **nenhum** campo preenchido); "Revisar" leva ao primeiro sinalizador com filtro (§2.1) |
| D10 | `settings-usage.ts` no 67 ou nas 68–72? | Infra (UsageCount + action + escrita de `lastUsedAt`) no 67; modais M2/M3 nas famílias (§9 P5) |
| D11 | *(reservado — numeração usada pela Spec 71)* | — |
| D12 | Legenda de tipos de Seções (6 itens) sumiria pelo gate dos 12 | Dois slots: `toolbar` (gated) e `subheader` (nunca gated) — §7.3 |
| D13 | Spec 69 exige "Salvar tipo"/"Publicar layout" no rodapé | `saveLabel?: string`, default "Salvar" — §7.3 |
| D14 | Spec 70 lista "paginação" como entrega do 67, mas D6 deixou o estado com a página | 67 entrega a primitiva `SettingsPagination`; o estado continua na página — §4 |

### Decisões tomadas durante a implementação

| # | Questão | Decisão |
|---|---|---|
| D15 | D5 mandou manter a escala do frame (título ≈ 1.1rem/17.6px), mas neste tema `h6` = **14px** (não os 20px do MUI default) — seria menor que o corpo do texto | Título usa **`h4`** (18px/600), a variante existente mais próxima do frame. Breadcrumb em `caption` (12px). A frase de propósito fica em `body2` (14px) como manda o §7.2 — o frame usa 11.8px, abaixo do mínimo de corpo do projeto |
| D16 | Arquétipo C (master-detail) precisa que a lista mestre encoste na borda do painel | Prop `disableContentPadding` no shell |
| D17 | O hub é uma rota própria; revalidar `/settings/<família>` não o alcança, e as contagens ficariam obsoletas após cada mutação | `revalidateSettingsHub(accountId)` chamado por **todos** os revalidadores de settings. Os caminhos que não tinham revalidador ganharam um: `revalidateMembers`, `revalidateTableTemplates`, `revalidateCsvTemplates`, `revalidateConnectors` e `revalidateDashboardLayout` — `revalidatePath` solto em action de settings é proibido, porque é exatamente o que deixa o card com número velho |
| D18 | `settings-counts` e `settings-attention` são leitura de RSC, não regra de negócio | Vivem em `src/server/queries/` (convenção real do repo, com `React.cache`), não em `services/` como dizia o §7.1 original |
| D19 | **A spec se contradizia sobre `editor` × família Conta**: §4 dizia ao mesmo tempo "o card Conta só para owner" e "editor não acessa a família Conta" — mas hoje `editor` acessa `/settings/general` e `/settings/members` (só `viewer` é barrado em Geral, e só `owner` em Auditoria) | Mantido o comportamento atual, que é o menos destrutivo: a família Conta aparece com o badge "somente owner" e é **recortada por papel** — `owner` vê os 3 itens, `editor` vê Geral e Membros, `viewer` vê só Membros. Tirar acesso do `editor` seria uma regressão de permissão e precisa de decisão de produto explícita |
| D20 | §7.2 mandava a frase de propósito em `text.secondary`, mas neste tema esse token é `#4A453C` — quase indistinguível do texto primário, então a frase competia visualmente com o título em vez de apoiá-lo (o frame usa o tom terciário) | Frase de propósito passa a **`text.tertiary`**. Só a cor muda: continua `body2` (14px), como D15 fixou. §7.2 atualizado |
| D23 | O hub foi implementado com 5 cards iguais em coluna e `align-items: start`, mas o frame de arquitetura mostra **Conta como faixa de 2 colunas com as entradas lado a lado** e os cards de cada fileira com **altura igual** | Campo `wide` no catálogo (hoje só `account`): `grid-column: span 2` + entradas em `repeat(N, 1fr)` com separador lateral; grade sem `align-items: start` e card com `height: 100%`. `wide` cai para `false` no recorte do `viewer` (uma entrada só). Documentado em §2.1 |
| D24 | A contagem de Dashboards foi de `N de 3 personalizados` (D21) para `N/3` e, por fim, para **nenhuma** | As três páginas de dashboard são **fixas**: `3` é constante e "personalizados" não é uma pergunta do usuário. A chave `dashboards` saiu de `settings-counts`, com a query de `DashboardLayout` e a revalidação do hub em `revalidateDashboardLayout` — contagem que não existe não precisa ser invalidada. No caminho descobriu-se que a versão em prosa também atropelava o rótulo no nav de 220px, o que motivou os rótulos do nav passarem a truncar (`noWrap` + `minWidth: 0`) |
| D22 | **Onde a 67 termina e as 68–72 começam.** Os critérios de SET-04/07/08 e dos modais são sobre a TELA, mas o §9 P4 manda migrar "só o cabeçalho — conteúdo intacto" | Tabela explícita no topo da §4 separando o que está pronto na tela do que depende do redesenho da linha. Onde deu para fechar sem invadir o conteúdo, fechou-se: busca e paginação em Apelidos (SET-04) e `SettingsDialog` nos 26 modais existentes (D8) |
| D21 | *(revogada por D24 — Dashboards não tem contagem)* | — |

### Correções pontuais aplicadas junto

- `error.subtle` **não existe** no tema → `danger.subtle` (§7.2).
- `messages/pt-BR.ts` → `"Connectors de IA"` vira `"Conectores de IA"` (P2).
- O frame **Arquitetura** ainda mostra a coluna "Uso" com contagens e "3 sem uso" na toolbar: está desatualizado frente ao v2/SET-07. Vale o **v2**.
- `@dnd-kit/core` e `@dnd-kit/sortable` já são dependências — não avaliar outra lib de DnD.
