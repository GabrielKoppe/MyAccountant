# Spec 62 — Redesign da Coluna de Ações da Linha de Transação

> Status: ready
> Insumo: revisão de código em `src/components/transactions/` (TransactionRowActions/TransactionRow/TransactionRowEditor/NewTransactionRow/TransactionTable) · auditorias `ui-critique` e `react-specialist` (2026-07-07) · entrevista de refinamento de produto (2026-07, decisões D1–D8 em §6) · delta contra spec 41 §TRN-09 e spec 09 §2.1/§3.3/§3.4
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`ui-feedback`](../skills/ui-feedback/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md)

---

## Contexto e histórico (por que esta spec existe)

A coluna de ações da linha de transação acumulou até **10 IconButtons idênticos** no modo visualização. Isso é um **drift de implementação**, não uma decisão de design:

- **Spec 09 §2.1** definiu a linha como `[…colunas…][ ⚐ ][ ⋮ ]` — um toggle de favorito visível + um **menu ⋮** contendo editar/duplicar/deletar (§3.3, §3.4).
- **Spec 41 §TRN-09** identificou que "o único ponto de ação é o ⋮ → 2 cliques para ações frequentes" e mandou **manter o ⋮** somando 2–3 quick-actions no hover: `[⚐][✓][⧉][⋮]`. A spec 41 §427 também previa "Vincular transação" **dentro do ⋮**.
- A **implementação da spec 41** (commit `75e821f`, Status da 41 = `implemented`) foi além do que a própria spec pedia: **removeu o ⋮** e inlinou todas as ações como ícones idênticos. Restaram as **props mortas** `menuAnchor`/`setMenuAnchor` como vestígio.

Reintroduzir o ⋮ para ações raras **realinha** com specs 09 e 41 — não desfaz decisão deliberada. O motivo original da remoção (frequentes em 2 cliques) fica endereçado mantendo as ações frequentes fora do menu (pendente + favorito visíveis).

---

## 1. Problema

- **ROW-01** — Densidade sem hierarquia. `TransactionRowActions.tsx:56-213` renderiza até 10 `IconButton` idênticos (`fontSize:16`, `p:0.5`, `gap:0.25`) numa `Box inline-flex`. Todos têm o mesmo peso visual: estado, ação frequente e ação rara competem por atenção. Não há hierarquia primária/secundária.
- **ROW-02** — Estado tratado como ação. Nota (`:64`), moeda estrangeira (`:78`), vínculos (`:102`, com contagem em `tx.linkCount` — `types.ts:40`), pendente (`:119`) e favorito (`:141`) são **sinais de estado** desenhados como botões idênticos às ações reais (editar, duplicar, excluir). O usuário não distingue "isto informa" de "isto age".
- **ROW-03** — Props mortas. `TransactionRowActions.tsx:27-28` declara `menuAnchor`/`setMenuAnchor` no `type Props`, mas o corpo (`:40-52`, `:56-213`) nunca as usa; `TransactionRow.tsx:778-779` as passa como no-op (`null` / `() => {}`). Vestígio da remoção do menu em `75e821f`.
- **A11Y-01** — Foco de teclado invisível. `TransactionRow.tsx:455-456` revela ícones só em `&:hover .action-icon`; não há `&:focus-within`. Ao tabular pelo teclado o foco pousa em botão com `opacity:0` — funcional mas invisível (viola design-system §9 "Focus visível").
- **A11Y-02** — Nome acessível ausente. Em `TransactionRowActions.tsx` só "criar apelido" (`:192`) tem `aria-label`. Os demais dependem de `<Tooltip title>`, que no MUI vira `aria-describedby`, **não** nome acessível — para leitor de tela os botões não têm nome (design-system §9 "IconButton sem aria-label").
- **A11Y-03** — Alvo de toque pequeno + dependência de hover. `iconSx={fontSize:16}` + `btnSx={p:0.5}` ≈ alvo 24px (abaixo de ~40px). E toda a affordance de ação depende de `:hover`, que **não existe em touch** (design-system §9 "Tooltip/hover em elemento touch-only").
- **UX-01** — Mover exige seleção em massa. Mover uma única transação hoje só é possível selecionando-a (checkbox) e usando a `BulkActionBar` (`MoveTransactionsDialog`, spec 09 §3.6) — não há atalho por linha. Fricção de 2 passos para uma ação de 1 registro. (Reconstruir o menu ⋮ abre a oportunidade de resolver sem duplicar o fluxo.)
- **PERF-01** — Nós permanentes por linha. Numa transação "limpa", a coluna já monta 8 pares `Tooltip+IconButton` permanentes (só ocultos por opacidade), multiplicados por N linhas de uma tabela densa. O custo real é a **contagem de nós interativos por linha**, não o portal do menu (o MUI só monta portal quando aberto — confirmado em `@mui/material` `BasePopper.js:199`, `Modal.js:204`). `TransactionRow` é `memo` (`TransactionRow.tsx:816`) — callbacks instáveis quebrariam a otimização.

---

## 2. Solução

Direção escolhida (Opção 5 — **Separação Estado/Ação**), aprovada após exploração de 5 alternativas e auditoria das 3 finalistas por `ui-critique` (ranking 5 > 2 > 3) e `react-specialist` (custo de render 5 < 2 < 3), refinada em entrevista de produto (D1–D8, §6).

### 2.1 Modo visualização — separar estado de ação (ROW-01, ROW-02)

**Sinais de estado saem da coluna de ações** e viram glyphs passivos de baixo contraste na **célula de descrição**, ao lado da varinha de apelido que já vive ali (spec 61 §2.4, `TransactionRow.tsx:501-515`). As **ações frequentes** (pendente + favorito) ficam como toggles visíveis na coluna; o resto vai para o ⋮:

```
[▢] 15/06  Netflix 📝 💱 🔗² ✨   Assinat.  R$45,90  João        ⏳  ☆  ⋮
            └── descrição ──┘└glyphs┘                          pend fav menu
```

- **Glyphs passivos na descrição** (só quando ativos, `text.tertiary`, `fontSize:14`, `flexShrink:0`, **não interativos**, `aria-hidden`): nota (📝 quando `tx.notes`), moeda estrangeira (💱 quando `tx.originalCurrency`), vínculos (🔗 + contagem quando `tx.linkCount>0` — o **número** em `text.secondary`, não `text.tertiary`, para passar contraste de texto pequeno). A varinha de apelido (✨ `accent.primary`) permanece como está (spec 61 §2.4 — interativa, é affordance, não estado passivo). **D2/D9**: a célula de descrição recebe um `aria-label` resumo (ex.: "Netflix — tem nota, moeda estrangeira, 2 vínculos") para o leitor de tela anunciar o estado uma vez por linha; os ícones em si são `aria-hidden`.
- **Coluna de ações (não-viewer) = 3 alvos**: [ **alternar pendente** ] [ **alternar favorito** ] [ **⋮** ] (D1).
  - **Alternar pendente** (`HourglassEmpty`/`HourglassBottom`) e **alternar favorito** (`StarBorder`/`Star`, ativo em `warning.main`), **sempre visíveis** (não hover-gated — D5, cobre touch). `aria-label` **dinâmico** em ambos (`markAsPending`/`markAsDone`; `addToFavorites`/`removeFromFavorites`).
  - Pendente **não** ganha glyph na descrição — o estado já é comunicado pelo dim da linha (`TransactionRow.tsx:453`, `opacity:0.65`) + o ícone da própria primária (D3). Favorito **não** é glyph passivo — é toggle visível (D1).
  - **Opacidade de repouso (D8)**: as primárias em repouso ficam com opacidade reduzida (~0.55) e plenas em `:hover`/`:focus-within` da linha; quando **ativas** (`isPending`/`isFavorite`), ficam plenas sempre (o estado é informação). Calmo (design-system "calmo > vibrante") mas tappable em touch. `ui-critique` valida o valor final no diff.
  - **⋮ (overflow)** abre `Menu` (§6.6): `Editar`, `Duplicar`, `Mover para…`, `Ver detalhes`, `Gerenciar vínculos`, `Criar apelido`, `<Divider>`, `Excluir` (`danger.main`, por último).
- **Viewers (read-only)**: sem primárias (não mutam). Coluna = só `⋮` com `Ver detalhes` e `Gerenciar vínculos` (paridade com o acesso atual ao dialog de vínculos, hoje exposto a todos em `:102-111`). Glyphs passivos na descrição aparecem normalmente (leitura).
- **Largura da coluna**: uniforme na tabela, governada pelas linhas EDIT/CREATE (7/4 botões, `width:200`). O ganho da Opção 5 é **clareza/densidade de alvos** no VIEW (10 → 3), **não** px; o header spacer (`TransactionTable.tsx:643`) permanece `width:200`.

### 2.2 Menu único + dialog de mover únicos, elevados à tabela (UX-01, PERF-01, D4, D6, D7)

Nem o `<Menu>` nem o `MoveTransactionsDialog` são montados por linha. Padrão de `MonthlyDashboardMenu.tsx:21-73`: **instância única** vive em `TransactionTable.tsx` (dono de `selected` `:155`, `detailTxId` `:173`, e callbacks estáveis via `useCallback` `:246/:259/:298/:325`). Desenho **(b)** — a *casca* sobe, o *conteúdo* vem da linha:

- `TransactionTable` guarda `{ anchorEl, items }` (`items: RowMenuItem[]`), populado no clique pela própria linha, que já tem `tx`/`isReadOnly`/closures de negócio (`handleDuplicate`, `openCreateAlias`, `handleDelete`) em escopo.
- `TransactionRowActions` expõe `onOpenMenu: (e, items) => void` (substituindo as props mortas). O callback repassado às linhas nos **dois** sites de `.map` (`TransactionTable.tsx:713` agrupado por data, `:767` plano) deve ser `useCallback` **estável** — arrow inline quebraria o `memo` de `TransactionRow.tsx:816`.
- **Mover para… (D4)**: reusa `MoveTransactionsDialog` (props `selectedIds: string[]`, `onMoved: (ids)=>void` — `MoveTransactionsDialog.tsx:51,54`) invocado com `selectedIds={[tx.id]}`. Uma única instância hospedada em `TransactionTable`, aberta com o id da linha via o item de menu, reusando o `onMoved` já existente para reconciliar `rows`. **Spec 62 NÃO implementa nem altera a lógica de sinal ao mover** — isso é da Spec 59 (`transaction-service.ts` `moveTransactions`; testes de sinal já em `transaction-service.test.ts:646`); como o code path é o mesmo do move bulk, o comportamento de sinal é **herdado**, não duplicado.

### 2.3 Modos edição e criação — manter linguagem de expansores + commit (D-05, DD-62-05)

EDIT e CREATE têm semântica distinta do VIEW: seus botões são **expansores de sub-painel** + **commit** (salvar/cancelar), não ações sobre um registro existente. **Não** viram menu. Aplicam-se apenas as correções de base (§2.4). Layout preservado:

```
EDIT    [▢] [15/06][Netflix   ][Assin.][R$45,90][João]  📝 💱 🔗 🏷 ✨   ✓  ✕
CREATE  [▢] [data ][descrição ][categ.][valor  ][resp]  📝 💱             ✓  ✕
```

- **EDIT** (`TransactionRowEditor.tsx:554-617`): mantém expansores (nota/fx/vínculos/tags), **criar apelido** (spec 61 §2.5 exige o botão visível no editor — preservado), `Salvar` (`accent.primary` via `color="primary"`, já em `:608`) + `Cancelar`.
- **CREATE** (`NewTransactionRow.tsx:574-615`): mantém expansores (nota/fx) + `Salvar`/`Cancelar`.

### 2.4 Correções de base — aplicam a todos os modos (ROW-03, A11Y-01/02/03)

- **ROW-03**: remover `menuAnchor`/`setMenuAnchor` do `type Props` e do call-site (`TransactionRow.tsx:778-779`); expor `onOpenMenu`.
- **A11Y-01**: adicionar `&:focus-within .action-icon { opacity: 1 }` ao lado do `:hover` em `TransactionRow.tsx:455-456`.
- **A11Y-02**: `aria-label` explícito em **todo** `IconButton` (não confiar no Tooltip).
- **A11Y-03**: alvo de toque ≥ 40px nos botões que sobrevivem na coluna (2 primárias + ⋮). Glyphs passivos não têm alvo (não interativos), então não dependem de hover/touch — as ações frequentes (primárias) são **sempre visíveis** (opacidade de repouso reduzida, D8), não `opacity:0`.

---

## 3. User Stories

- Como usuário, quero distinguir num relance o que é **estado** da transação (tem nota, moeda estrangeira, vínculo) do que é **ação** que posso executar, para não precisar ler 10 ícones idênticos.
- Como usuário, quero alternar "pendente/pago" e "favorito" em **um clique** direto na linha, para reconciliar rápido sem abrir menu.
- Como usuário, quero mover uma única transação sem precisar selecioná-la em massa, para realocar rápido pelo menu da própria linha.
- Como usuário de teclado/leitor de tela, quero que cada botão tenha nome acessível e foco visível, e que o estado (nota/fx/vínculos) seja anunciado, para operar a tabela sem mouse.
- Como usuário de celular (sem hover), quero acessar todas as ações por toque, sem depender de passar o mouse.
- Como desenvolvedor, quero uma única instância de menu e de dialog de mover na tabela e props sem código morto, para reduzir nós por linha e manter o `memo` da linha eficaz.
- Como mantenedor, quero a linha realinhada com specs 09/41, para que código e spec voltem a concordar.

---

## 4. Critérios de Aceitação

**ROW-01 / ROW-02 (separação estado/ação, modo visualização):**
- QUANDO uma transação tem nota, moeda estrangeira ou vínculo(s), A CÉLULA DE DESCRIÇÃO DEVE exibir o glyph passivo correspondente (`text.tertiary`, não interativo, `aria-hidden`; contagem de vínculos em `text.secondary`), e A COLUNA DE AÇÕES NÃO DEVE exibir esses sinais como botões.
- QUANDO a transação não tem determinado estado, O GLYPH correspondente NÃO DEVE ser renderizado.
- A CÉLULA DE DESCRIÇÃO DEVE ter um `aria-label` resumindo descrição + estados ativos (nota / moeda estrangeira / N vínculos).
- A COLUNA DE AÇÕES (não-viewer) DEVE conter exatamente 3 alvos interativos: alternar pendente, alternar favorito e o ⋮.
- QUANDO o usuário clica na primária de pendente, A TRANSAÇÃO DEVE alternar `isPending` (comportamento de `togglePending`, feedback otimista); QUANDO clica na de favorito, DEVE alternar `isFavorite` (`toggleFavorite`).
- ENQUANTO uma primária está em repouso e inativa, ELA DEVE ficar visível com opacidade reduzida (não `opacity:0`) e atingir opacidade plena em `:hover`/`:focus-within` da linha; QUANDO ativa (`isPending`/`isFavorite`), DEVE ficar em opacidade plena sempre.
- QUANDO o usuário abre o ⋮ (não-viewer), O MENU DEVE listar, nesta ordem, Editar, Duplicar, Mover para…, Ver detalhes, Gerenciar vínculos, Criar apelido e, após um `<Divider>`, Excluir em `danger.main` (design-system §6.6).
- SE o usuário é viewer (read-only), A COLUNA DE AÇÕES DEVE conter só o ⋮ com Ver detalhes e Gerenciar vínculos, e NÃO DEVE exibir primárias nem ações de mutação.

**Mover para… (D4):**
- QUANDO o usuário clica em "Mover para…", O SISTEMA DEVE abrir o mesmo `MoveTransactionsDialog` do fluxo bulk, com `selectedIds` = `[id da linha]`.
- O FLUXO DE MOVER POR LINHA NÃO DEVE reimplementar a lógica de sinal ao mover — DEVE reusar `moveTransactionsAction` (a semântica de sinal é da Spec 59).

**ROW-03 (props mortas):**
- O `type Props` de `TransactionRowActions` NÃO DEVE declarar `menuAnchor`/`setMenuAnchor`; `TransactionRow` NÃO DEVE passá-las.

**PERF-01 / memo:**
- A ÁRVORE NÃO DEVE conter uma instância de `<Menu>` nem de `MoveTransactionsDialog` por linha; DEVE haver uma única instância de cada no nível de `TransactionTable`.
- O callback `onOpenMenu` passado às linhas (nos dois `.map`, `:713` e `:767`) DEVE ser referencialmente estável (`useCallback`), preservando o `memo` de `TransactionRow`.

**A11Y-01/02/03:**
- QUANDO o foco de teclado chega a um botão de ação, ELE DEVE estar visível (`opacity:1` via `:focus-within`).
- TODO `IconButton` da coluna de ações DEVE ter `aria-label` explícito; as primárias DEVEM ter `aria-label` dinâmico conforme o estado.
- As primárias DEVEM ser acessíveis em touch (sempre visíveis, não hover-gated); os alvos de pendente, favorito e ⋮ DEVEM ter ≥ 40px.

**Edição / Criação:**
- O MODO EDIÇÃO DEVE preservar os expansores (nota/fx/vínculos/tags), o botão Criar apelido (spec 61 §2.5) e Salvar/Cancelar, aplicando `aria-label` + `:focus-within`.
- O MODO CRIAÇÃO DEVE preservar os expansores (nota/fx) e Salvar/Cancelar, aplicando `aria-label` + `:focus-within`.

**Modos (light/dark) e densidade:**
- TODOS os glyphs e botões DEVEM ser validados em light E dark; nenhum contador numérico DEVE usar `text.tertiary` (usar `text.secondary`).
- QUANDO a descrição, todos os glyphs (nota+fx+vínculo#) e a varinha coexistem numa viewport estreita (~600px), A DESCRIÇÃO DEVE truncar por `text-overflow: ellipsis` **antes** dos glyphs (glyphs `flexShrink:0`), e os glyphs NÃO DEVEM ser empurrados para fora da célula.

---

## 5. Fora de Escopo

- **Reprojetar EDIT/CREATE** além das correções de base — a densidade problemática é do VIEW; os expansores permanecem (DD-62-05).
- **Tornar os glyphs da descrição clicáveis** (toggle inline pela descrição) — DD-62-02: glyphs são passivos; toggles via primárias + menu.
- **Redesign de touch dedicado** (toque na linha → painel de detalhes; long-press → seleção/barra de ações) — D5: a affordance touch é resolvida pelas primárias sempre visíveis + ⋮ (≥40px). Detecção `pointer:coarse` e gestos mobile ficam para spec futura.
- **Lógica de sinal ao mover** — owned pela Spec 59; a Spec 62 só adiciona o ponto de entrada por linha reusando o fluxo existente.
- **Extrair um componente reutilizável `RowActionMenu`/`RowMenuItem` genérico** para outras tabelas — o menu único vive em `TransactionTable`; generalizar cross-feature é escopo futuro (candidato a `src/components/ui/`).
- **Mudar o comportamento de duplicar/excluir/favoritar/vínculos/mover** em si — só muda o *ponto de entrada*, não a lógica (`handleDuplicate`, `handleDelete`, `moveTransactionsAction`, etc. permanecem).
- **Tuning fino do "ruído visual" das primárias sempre visíveis** (valor exato da opacidade de repouso) — decidido na implementação + auditoria `ui-critique`; o critério só fixa "reduzida em repouso, plena em hover/foco/ativo".
- **Virtualização da tabela** — Spec 56 (paginação/escala).
- **Confirmação de exclusão via DialogShell + undo** — já existe (`DeleteUndoProvider`); esta spec só realoca o gatilho de Excluir para o menu.

---

## 6. Decisões de Design

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-62-01 (D1) | Ação(ões) primária(s) visível(is) em VIEW | **Pendente + Favorito** (ambos), sempre visíveis + ⋮ → 3 alvos | Reconciliação (pago/pendente) e marcação de favorito são as ações mais frequentes; mantê-las a 1 clique é o objetivo central da 41 §TRN-09. Favorito deixa de ser glyph passivo e volta a toggle (também realinha com 09 §2.1). |
| DD-62-02 (D2) | Glyphs da descrição são clicáveis? | **Não — passivos** (nota/fx/vínculo#), `aria-hidden` + `aria-label` resumo na célula | Separação limpa estado×ação; interação por hover/aria em glyph minúsculo é risco de a11y (`ui-critique`). Resumo único por linha evita verbosidade do leitor de tela. |
| DD-62-03 (D3) | Pendente ganha glyph na descrição? | **Não** | Redundante: pendente já é sinalizado pelo dim da linha + ícone da primária. |
| DD-62-04 (D6/D7) | Onde mora o estado do menu / dialog de mover | **Instância única em `TransactionTable`**, conteúdo fornecido pela linha (desenho b) | Perf: MUI não monta portal fechado, mas N instâncias na árvore são imposto evitável (`react-specialist`); desenho (b) não sobe lógica de negócio da linha. `onOpenMenu` estável preserva o `memo`. |
| DD-62-05 (D-05) | EDIT/CREATE viram menu? | **Não** — mantêm expansores + commit | Semântica distinta (sub-painéis + salvar/cancelar); densidade já baixa (7 e 4); respeita 61 §2.5 (criar apelido visível no editor). |
| DD-62-06 | Reviver o ⋮ removido em `75e821f` | **Sim** | Realinha com 09 §2.1/§3.3/§3.4 e com a intenção da 41 §TRN-09/§427 (que mandavam manter o ⋮). |
| DD-62-07 (D4) | "Mover" por linha | **Adicionar "Mover para…" no ⋮**, reusando `MoveTransactionsDialog` com `[id]` | Conveniência de mover 1 linha sem seleção em massa; reuso total do fluxo/ação existente → sem duplicar semântica de sinal (Spec 59). |
| DD-62-08 (D5) | Comportamento em touch | **Manter tap-to-edit por célula; primárias+⋮ sempre visíveis ≥40px cobrem touch** | Escopo mínimo; sem `pointer:coarse`. Com primárias sempre visíveis, o motivo do "toque abre painel" da 41 §TRN-09 caiu. Redesign mobile → Fora de Escopo. |
| DD-62-09 (D8) | Opacidade de repouso das primárias | **Reduzida em repouso (~0.55), plena em hover/foco/ativo** | "Calmo > vibrante" (design-system) sem sacrificar toque (não `opacity:0`); valor final validado por `ui-critique`. |

### Delta contra specs congeladas / vizinhas

- **vs Spec 61 §2.4 (varinha na descrição)**: a varinha permanece na célula de descrição, mas agora **divide a célula** com novos glyphs passivos de estado. A contenção de eventos de 61 §2.4 (`stopPropagation` no ícone/popover; guard `if (aliasPopoverOpen) return` no `onKeyDown` da linha) **permanece válida e obrigatória**. Glyphs passivos não têm `onClick`, logo não introduzem novo risco de borbulhamento.
- **vs Spec 61 §2.5 (criar apelido na linha)**: no **modo visualização**, "Criar apelido" deixa de ser ícone visível na coluna de ações e passa a ser **item do menu ⋮** (mesmo handler `openCreateAlias(tx)`). No **modo edição**, permanece botão visível ao lado de Salvar/Cancelar (inalterado). Delta registrado aqui.
- **vs Spec 09 §2.1**: a região evolui de `[⚐][⋮]` para `[glyphs na descrição][⏳][☆][⋮]` — favorito **continua** toggle visível (alinhado), pendente é **adicionado** como toggle visível, sinais migram para a descrição; §3.3 (duplicar) e §3.4 (excluir) seguem no ⋮ (a impl 41 havia removido o ⋮; esta spec o restaura).
- **vs Spec 59 (ready — sinal ao mover)**: 62 adiciona ponto de entrada por linha ("Mover para…") reusando `moveTransactionsAction`/`MoveTransactionsDialog`; **não** implementa nem altera a lógica de sinal (propriedade da 59). O comportamento de sinal é herdado pelo code path comum.
- **vs Spec 57 (draft — refator de transação)**: 57 §2.2 extrai `useTransactionEditor()` + célula reusável nos *internos* de `TransactionRowEditor`/`NewTransactionRow`; **não** toca a coluna de ações/menu. Ambas draft/independentes tocam esses 2 arquivos em **regiões distintas** (57: inputs de campo; 62: a11y das células de ação). Nota de sequenciamento: quem entrar depois reconcilia âncoras de linha; sem conflito lógico.

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| ROW-01/02, primárias pendente+favorito, ⋮ com itens (incl. Mover para…), ROW-03 | `src/components/transactions/TransactionRowActions.tsx` |
| Glyphs passivos + `aria-label` resumo na descrição, `:focus-within`, wiring `onOpenMenu`, remover call-site das props mortas | `src/components/transactions/TransactionRow.tsx` |
| Instância única de `<Menu>` + `MoveTransactionsDialog` + estado `{anchorEl, items}` + `onOpenMenu` estável; wiring nos dois `.map` (`:713`, `:767`) | `src/components/transactions/TransactionTable.tsx` |
| Tipo `RowMenuItem` | `src/components/transactions/types.ts` |
| Reuso do dialog de mover (props `selectedIds`/`onMoved`) | `src/components/transactions/MoveTransactionsDialog.tsx` (não alterar) |
| Base fixes (aria-label, :focus-within) | `src/components/transactions/TransactionRowEditor.tsx`, `src/components/transactions/NewTransactionRow.tsx` |
| Padrão de menu único (referência) | `src/components/dashboards/monthly/MonthlyDashboardMenu.tsx` |
| Strings novas/renomeadas (`actions.more`, `actions.moveTo`) | `src/lib/messages/pt-BR.ts` |

### Tipo compartilhado (referência)

```ts
// types.ts
export type RowMenuItem = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;        // aplica color: "danger.main"
  dividerBefore?: boolean; // insere <Divider> antes do item
};
```

### Menu único + dialog de mover na tabela (referência — desenho b)

```tsx
// TransactionTable.tsx
const [rowMenu, setRowMenu] = useState<{ anchorEl: HTMLElement; items: RowMenuItem[] } | null>(null);
const [moveIds, setMoveIds] = useState<string[] | null>(null); // dialog único de mover por linha

const handleOpenRowMenu = useCallback(
  (e: React.MouseEvent<HTMLButtonElement>, items: RowMenuItem[]) => {
    setRowMenu({ anchorEl: e.currentTarget, items });
  },
  [],
);

// ...passar onOpenMenu={handleOpenRowMenu} para cada linha nos DOIS .map (:713 e :767)
// (referência estável → preserva memo). O item "Mover para…" chama setMoveIds([tx.id]).

<Menu
  anchorEl={rowMenu?.anchorEl ?? null}
  open={!!rowMenu}
  onClose={() => setRowMenu(null)}
  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
  transformOrigin={{ vertical: "top", horizontal: "right" }}
  slotProps={{ paper: { sx: { minWidth: 180 } } }}
>
  {rowMenu?.items.map((item, i) => [
    item.dividerBefore ? <Divider key={`d-${i}`} /> : null,
    <MenuItem
      key={i}
      onClick={() => { item.onClick(); setRowMenu(null); }}
      sx={{ py: 0.75, fontSize: 13, ...(item.danger ? { color: "danger.main" } : {}) }}
    >
      <ListItemIcon sx={{ minWidth: 32, ...(item.danger ? { color: "danger.main" } : {}) }}>
        {item.icon}
      </ListItemIcon>
      {item.label}
    </MenuItem>,
  ])}
</Menu>

<MoveTransactionsDialog
  open={!!moveIds}
  onClose={() => setMoveIds(null)}
  accountId={accountId}
  selectedIds={moveIds ?? []}
  onMoved={(ids) => { /* reusar o mesmo caminho de reconciliação do move bulk */ setMoveIds(null); }}
  /* ...demais props que o move bulk já passa */
/>
```

### Coluna de ações — VIEW (referência)

```tsx
// TransactionRowActions.tsx  (✅ correto)
<TableCell align="right" sx={{ width: 200, minWidth: 200, whiteSpace: "nowrap", pr: 1 }}
  onClick={(e) => e.stopPropagation()}>  {/* largura uniforme com EDIT/CREATE; ganho é densidade, não px */}
  <Box sx={{ display: "inline-flex", alignItems: "center", gap: layout.micro }}>
    {!isReadOnly && (
      <>
        <Tooltip title={tx.isPending ? m.transactions.actions.markAsDone : m.transactions.actions.markAsPending}>
          <IconButton
            size="small"
            onClick={onTogglePending}
            aria-label={tx.isPending ? m.transactions.actions.markAsDone : m.transactions.actions.markAsPending}
            className={`row-primary${tx.isPending ? " row-primary--active" : ""}`}
            sx={{ p: 1, color: "text.secondary" }}
          >
            {tx.isPending ? <HourglassBottomIcon sx={{ fontSize: 18 }} /> : <HourglassEmptyIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title={tx.isFavorite ? m.transactions.actions.removeFromFavorites : m.transactions.actions.addToFavorites}>
          <IconButton
            size="small"
            onClick={onToggleFavorite}
            aria-label={tx.isFavorite ? m.transactions.actions.removeFromFavorites : m.transactions.actions.addToFavorites}
            className={`row-primary${tx.isFavorite ? " row-primary--active" : ""}`}
            sx={{ p: 1, color: tx.isFavorite ? "warning.main" : "text.secondary" }}
          >
            {tx.isFavorite ? <StarIcon sx={{ fontSize: 18 }} /> : <StarBorderIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
      </>
    )}
    <Tooltip title={m.transactions.actions.more}>
      <IconButton
        size="small"
        aria-label={m.transactions.actions.more}
        onClick={(e) => onOpenMenu(e, buildMenuItems())}
        sx={{ p: 1, color: "text.secondary" }}
      >
        <MoreVertIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  </Box>
</TableCell>

// ❌ Anti-padrão: 10 IconButtons idênticos misturando estado e ação (estado atual)
```

### Opacidade de repouso das primárias (referência — D8)

```tsx
// TransactionRow.tsx:452-459  (✅ substituir a mecânica .action-icon no VIEW)
sx={{
  opacity: tx.isPending ? 0.65 : 1,
  "& .row-primary": { opacity: 0.55, transition: "opacity 0.15s" }, // repouso: visível mas discreto (tappable)
  "&:hover .row-primary, &:focus-within .row-primary": { opacity: 1 },
  "& .row-primary--active": { opacity: 1 }, // estado ativo é informação → pleno sempre
}}
```

> Para os botões de EDIT/CREATE que continuam com reveal por hover, manter a classe `.action-icon` e **adicionar o par `:focus-within`** (A11Y-01).

### Glyphs passivos + resumo a11y na descrição (referência)

```tsx
// TransactionRow.tsx — célula de descrição
<TableCell aria-label={describeRowState(tx)} /* "Netflix — tem nota, moeda estrangeira, 2 vínculos" */>
  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
    <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {tx.description || "—"}
    </Box>
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: layout.micro, flexShrink: 0, color: "text.tertiary" }}>
      {tx.notes && <NoteIcon sx={{ fontSize: 14 }} aria-hidden />}
      {tx.originalCurrency && <CurrencyExchangeOutlinedIcon sx={{ fontSize: 14 }} aria-hidden />}
      {tx.linkCount > 0 && (
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }} aria-hidden>
          <LinkOutlinedIcon sx={{ fontSize: 14 }} />
          <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>{tx.linkCount}</Typography>
        </Box>
      )}
      {/* varinha de apelido (spec 61 §2.4) permanece interativa, com seu próprio aria-label — não aria-hidden */}
    </Box>
  </Box>
</TableCell>
```

---

## 8. Cenários de Teste (mínimo)

- Transação limpa (sem estado) → descrição sem glyphs; coluna = [pendente][favorito][⋮] (editor).
- Transação com nota + fx + 2 vínculos → 3 glyphs passivos na descrição (📝💱🔗²); `aria-label` da célula resume os 3; favorito **não** é glyph (é toggle na coluna).
- Clique na primária de pendente → `isPending` alterna otimista; `aria-label` muda; dim da linha reflete. Idem favorito → `isFavorite` + estrela preenchida `warning.main`.
- Primária inativa em repouso → opacidade reduzida, visível e clicável; hover/foco da linha → opacidade plena; ativa → plena sempre.
- Abrir ⋮ (editor) → itens na ordem: Editar, Duplicar, Mover para…, Ver detalhes, Gerenciar vínculos, Criar apelido, `<Divider>`, Excluir (`danger.main`).
- "Mover para…" → abre `MoveTransactionsDialog` com `selectedIds=[id]`; mover comporta-se como mover essa única linha em massa.
- Viewer → coluna só com ⋮ (Ver detalhes, Gerenciar vínculos); sem primárias; glyphs passivos visíveis.
- Teclado: Tab até pendente/favorito/⋮ → foco visível (`:focus-within`); Enter aciona.
- Leitor de tela: primárias anunciam estado dinâmico; célula de descrição anuncia descrição + estados.
- `memo`: alterar seleção de outra linha não re-renderiza linhas não afetadas (`onOpenMenu` estável).
- Uma única `<Menu>` e um único `MoveTransactionsDialog` na árvore (não N).
- Light E dark: contraste dos glyphs e da contagem de vínculos (contagem em `text.secondary`).
- Densidade ~600px: descrição elipsa antes dos glyphs; glyphs não saem da célula.

---

## 9. Plano de Implementação

> Plano completo (TDD, bite-sized) gerado via skill `writing-plans`. Fonte única — o arquivo `docs/superpowers/plans/2026-07-08-redesign-acoes-linha-transacao.md` aponta para esta seção em vez de duplicá-la.

**Goal:** Separar estado (sinais passivos) de ação na linha de transação — coluna de ações do modo visualização passa de até 10 IconButtons idênticos para `[pendente][favorito][⋮]`, com sinais de estado migrando para a célula de descrição como glyphs passivos.

**Architecture:** Modo visualização ganha 2 primárias visíveis (pendente/favorito) + um menu overflow `⋮` que reúne o resto (Editar, Duplicar, Mover para…, Ver detalhes, Gerenciar vínculos, Criar apelido, Excluir). O `<Menu>` e o `MoveTransactionsDialog` são **instâncias únicas** no `TransactionTable` (não por linha); a linha fornece dinamicamente os itens via callback estável (preserva `memo`). Sinais de estado (nota, moeda estrangeira, contagem de vínculos) viram glyphs passivos (`aria-hidden`) na célula de descrição, com um `aria-label`-resumo na célula. Edição/criação mantêm a linguagem de expansores + commit (só correções de a11y).

**Tech Stack:** Next.js 15 (App Router, Client Components), TypeScript strict, Material UI v6 + tokens do tema, Vitest + Testing Library + userEvent, notistack.

### 9.1 Global Constraints

- **MUI-only + tokens semânticos.** Sem hex hardcoded; cores via tokens (`text.tertiary`, `text.secondary`, `warning.main`, `danger.main`). Sem `!important`, sem `style={}` com cor. (CLAUDE.md §5.11)
- **Todo `IconButton` tem `aria-label`.** Ícones: import nomeado de `@mui/icons-material`. (design-system §9)
- **Strings de UI centralizadas em `src/lib/messages/pt-BR.ts`** (exportadas como `m`). Sem string hardcoded em componente. (CLAUDE.md §5.10)
- **`TransactionRow` é `memo`** (`TransactionRow.tsx:816`) — callbacks passados às linhas DEVEM ser `useCallback` referencialmente estáveis. (§4 PERF-01)
- **Menu destrutivo:** ações positivas primeiro, `<Divider>`, item destrutivo por último em `danger.main`. (design-system §6.6)
- **Paridade light/dark** obrigatória; validar contagem de vínculos em `text.secondary` (não `text.tertiary`). (§4)
- **Comandos rodam no container:** prefixar com `docker compose exec app`. `pnpm test <path>` = `vitest run` filtrado.
- **Sem `console.log`** (Pino em produção; não aplicável aqui, mas não introduzir). (CLAUDE.md §5.7)
- **Não reimplementar lógica de sinal ao mover** — reusar `moveTransactionsAction`/`MoveTransactionsDialog` (propriedade da Spec 59). (§6 DD-62-07)

### 9.2 File Structure

**Novos arquivos:**
- `src/components/transactions/row-state.ts` — `describeRowState(tx)`: monta o texto-resumo de estado para o `aria-label` da célula de descrição. Puro.
- `src/components/transactions/row-menu-items.tsx` — `buildRowMenuItems(opts)`: monta o array `RowMenuItem[]` do menu ⋮ (editor vs viewer). Puro (recebe handlers).
- `src/components/transactions/RowActionsMenu.tsx` — componente presentacional que renderiza um `RowMenuItem[]` num `<Menu>` MUI. Instância única, hospedada no `TransactionTable`.

**Modificados:**
- `src/components/transactions/types.ts` — adiciona o tipo `RowMenuItem`.
- `src/components/transactions/TransactionRowActions.tsx` — reescrito: primárias (pendente+favorito) + ⋮ chamando `onOpenMenu`. Remove props mortas + `onStartEditWithNote`.
- `src/components/transactions/TransactionRow.tsx` — glyphs passivos + `aria-label`-resumo na descrição; mecânica de opacidade `.row-primary` + `:focus-within`; passa `onOpenMenu`/`onMove`; remove call-site das props mortas.
- `src/components/transactions/TransactionTable.tsx` — estado `{anchorEl, items}` + `moveIds`; `handleOpenRowMenu`/`handleOpenMove` estáveis; renderiza `<RowActionsMenu>` + um `<MoveTransactionsDialog>` único; wiring nos dois `.map` (`:713`, `:767`).
- `src/components/transactions/TransactionRowEditor.tsx` — correções de a11y (`aria-label`, `:focus-within` herdado).
- `src/components/transactions/NewTransactionRow.tsx` — idem.
- `src/lib/messages/pt-BR.ts` — `transactions.rowState.*`, `transactions.actions.more`, `transactions.actions.moveTo`, `transactions.links.manage`.

**Novos testes:** `row-state.test.ts`, `row-menu-items.test.tsx`, `RowActionsMenu.test.tsx`, `TransactionRowActions.test.tsx` (todos co-locados em `src/components/transactions/`).

### Task 1: Fundação — tipo `RowMenuItem`, `describeRowState`, strings de estado

**Files:**
- Modify: `src/components/transactions/types.ts`
- Create: `src/components/transactions/row-state.ts`
- Create: `src/components/transactions/row-state.test.ts`
- Modify: `src/lib/messages/pt-BR.ts`

**Interfaces:**
- Produces: `type RowMenuItem = { label: string; icon: ReactNode; onClick: () => void; danger?: boolean; dividerBefore?: boolean }`
- Produces: `describeRowState(tx: Pick<TransactionRow, "description" | "notes" | "originalCurrency" | "linkCount">): string`
- Produces: `m.transactions.rowState.{ hasNote: string; foreignCurrency: string; links: (n: number) => string }`

- [ ] **Step 1: Adicionar strings de estado em `pt-BR.ts`**

Localize o bloco `transactions:` (linha ~689) e, logo antes de `actions: {` (linha ~836), insira:

```ts
    rowState: {
      hasNote: "tem nota",
      foreignCurrency: "moeda estrangeira",
      links: (n: number) => `${n} ${n === 1 ? "vínculo" : "vínculos"}`,
    },
```

- [ ] **Step 2: Adicionar o tipo `RowMenuItem` em `types.ts`**

No topo de `types.ts`, adicione o import de `ReactNode`:

```ts
import type { ReactNode } from "react";
```

Ao final do arquivo, adicione:

```ts
export type RowMenuItem = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** aplica color: "danger.main" no item e no ícone */
  danger?: boolean;
  /** insere um <Divider> antes deste item */
  dividerBefore?: boolean;
};
```

- [ ] **Step 3: Escrever o teste que falha — `row-state.test.ts`**

```ts
import { describe, expect, it } from "vitest";

import { describeRowState } from "./row-state";

const base = { description: "Netflix", notes: null, originalCurrency: null, linkCount: 0 };

describe("describeRowState", () => {
  it("retorna só a descrição quando não há estado", () => {
    expect(describeRowState(base)).toBe("Netflix");
  });

  it("lista nota, moeda estrangeira e vínculos (plural)", () => {
    expect(
      describeRowState({ description: "Netflix", notes: "x", originalCurrency: "USD", linkCount: 2 }),
    ).toBe("Netflix — tem nota, moeda estrangeira, 2 vínculos");
  });

  it("usa singular para 1 vínculo", () => {
    expect(describeRowState({ ...base, linkCount: 1 })).toBe("Netflix — 1 vínculo");
  });

  it("retorna só os estados quando não há descrição", () => {
    expect(describeRowState({ description: null, notes: "x", originalCurrency: null, linkCount: 0 })).toBe(
      "tem nota",
    );
  });
});
```

- [ ] **Step 4: Rodar o teste e ver falhar**

Run: `docker compose exec app pnpm test src/components/transactions/row-state.test.ts`
Expected: FAIL — "Failed to resolve import './row-state'".

- [ ] **Step 5: Implementar `row-state.ts`**

```ts
import { m } from "@/lib/messages";

import type { TransactionRow } from "./types";

type RowStateInput = Pick<TransactionRow, "description" | "notes" | "originalCurrency" | "linkCount">;

/**
 * Monta o texto-resumo de estado da linha para o `aria-label` da célula de
 * descrição (leitor de tela anuncia descrição + estados ativos numa só passada).
 */
export function describeRowState(tx: RowStateInput): string {
  const baseText = tx.description?.trim() ?? "";
  const parts: string[] = [];
  if (tx.notes) parts.push(m.transactions.rowState.hasNote);
  if (tx.originalCurrency) parts.push(m.transactions.rowState.foreignCurrency);
  if (tx.linkCount > 0) parts.push(m.transactions.rowState.links(tx.linkCount));

  if (parts.length === 0) return baseText;
  if (!baseText) return parts.join(", ");
  return `${baseText} — ${parts.join(", ")}`;
}
```

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `docker compose exec app pnpm test src/components/transactions/row-state.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 7: Commit**

```bash
git add src/components/transactions/types.ts src/components/transactions/row-state.ts src/components/transactions/row-state.test.ts src/lib/messages/pt-BR.ts
git commit -m "feat(transactions): add RowMenuItem type + describeRowState helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2: `buildRowMenuItems` — conteúdo do menu ⋮ (editor vs viewer)

**Files:**
- Create: `src/components/transactions/row-menu-items.tsx`
- Create: `src/components/transactions/row-menu-items.test.tsx`
- Modify: `src/lib/messages/pt-BR.ts`

**Interfaces:**
- Consumes: `RowMenuItem` (Task 1)
- Produces:
  ```ts
  buildRowMenuItems(opts: {
    isReadOnly: boolean;
    onEdit: () => void;
    onDuplicate: () => void;
    onMove: () => void;
    onViewDetails: () => void;
    onManageLinks: () => void;
    onCreateAlias: () => void;
    onDelete: () => void;
  }): RowMenuItem[]
  ```
- Produces: `m.transactions.actions.moveTo`, `m.transactions.links.manage`

- [ ] **Step 1: Adicionar strings em `pt-BR.ts`**

No bloco `transactions.actions` (após `createAlias:` linha ~840), adicione:

```ts
      moveTo: "Mover para…",
```

No bloco `transactions.links` (após `addLink:` linha ~906), adicione:

```ts
      manage: "Gerenciar vínculos",
```

- [ ] **Step 2: Escrever o teste que falha — `row-menu-items.test.tsx`**

```tsx
import { describe, expect, it, vi } from "vitest";

import { buildRowMenuItems } from "./row-menu-items";

const handlers = {
  onEdit: vi.fn(),
  onDuplicate: vi.fn(),
  onMove: vi.fn(),
  onViewDetails: vi.fn(),
  onManageLinks: vi.fn(),
  onCreateAlias: vi.fn(),
  onDelete: vi.fn(),
};

describe("buildRowMenuItems", () => {
  it("editor: itens na ordem correta, Excluir por último com divisor e danger", () => {
    const items = buildRowMenuItems({ isReadOnly: false, ...handlers });
    expect(items.map((i) => i.label)).toEqual([
      "Editar",
      "Duplicar",
      "Mover para…",
      "Ver detalhes",
      "Gerenciar vínculos",
      "Criar apelido a partir desta transação",
      "Deletar",
    ]);
    const del = items.at(-1)!;
    expect(del.danger).toBe(true);
    expect(del.dividerBefore).toBe(true);
  });

  it("viewer: só ações de leitura, sem mutação", () => {
    const items = buildRowMenuItems({ isReadOnly: true, ...handlers });
    expect(items.map((i) => i.label)).toEqual(["Ver detalhes", "Gerenciar vínculos"]);
  });

  it("cada item dispara seu handler", () => {
    const items = buildRowMenuItems({ isReadOnly: false, ...handlers });
    items.find((i) => i.label === "Duplicar")!.onClick();
    expect(handlers.onDuplicate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `docker compose exec app pnpm test src/components/transactions/row-menu-items.test.tsx`
Expected: FAIL — "Failed to resolve import './row-menu-items'".

- [ ] **Step 4: Implementar `row-menu-items.tsx`**

```tsx
import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import EditIcon from "@mui/icons-material/Edit";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import { m } from "@/lib/messages";

import type { RowMenuItem } from "./types";

const ICON_SX = { fontSize: 16 } as const;

type BuildOpts = {
  isReadOnly: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onViewDetails: () => void;
  onManageLinks: () => void;
  onCreateAlias: () => void;
  onDelete: () => void;
};

/**
 * Monta os itens do menu ⋮ da linha. Viewers (read-only) só veem ações de
 * leitura. Ordem: positivas primeiro; Excluir por último com <Divider> e danger
 * (design-system §6.6).
 */
export function buildRowMenuItems(opts: BuildOpts): RowMenuItem[] {
  const a = m.transactions.actions;

  const readItems: RowMenuItem[] = [
    { label: a.viewDetails, icon: <VisibilityOutlinedIcon sx={ICON_SX} />, onClick: opts.onViewDetails },
    { label: m.transactions.links.manage, icon: <LinkOutlinedIcon sx={ICON_SX} />, onClick: opts.onManageLinks },
  ];

  if (opts.isReadOnly) return readItems;

  return [
    { label: a.edit, icon: <EditIcon sx={ICON_SX} />, onClick: opts.onEdit },
    { label: a.duplicate, icon: <ContentCopyIcon sx={ICON_SX} />, onClick: opts.onDuplicate },
    { label: a.moveTo, icon: <DriveFileMoveOutlinedIcon sx={ICON_SX} />, onClick: opts.onMove },
    ...readItems,
    { label: a.createAlias, icon: <BookmarkAddOutlinedIcon sx={ICON_SX} />, onClick: opts.onCreateAlias },
    { label: a.delete, icon: <DeleteIcon sx={ICON_SX} />, onClick: opts.onDelete, danger: true, dividerBefore: true },
  ];
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `docker compose exec app pnpm test src/components/transactions/row-menu-items.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add src/components/transactions/row-menu-items.tsx src/components/transactions/row-menu-items.test.tsx src/lib/messages/pt-BR.ts
git commit -m "feat(transactions): add buildRowMenuItems for row overflow menu

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3: `RowActionsMenu` — componente presentacional do menu único

**Files:**
- Create: `src/components/transactions/RowActionsMenu.tsx`
- Create: `src/components/transactions/RowActionsMenu.test.tsx`

**Interfaces:**
- Consumes: `RowMenuItem` (Task 1)
- Produces: `<RowActionsMenu anchorEl={HTMLElement | null} items={RowMenuItem[]} onClose={() => void} />`

- [ ] **Step 1: Escrever o teste que falha — `RowActionsMenu.test.tsx`**

```tsx
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RowActionsMenu } from "./RowActionsMenu";
import type { RowMenuItem } from "./types";

function sample(onDelete = vi.fn()): RowMenuItem[] {
  return [
    { label: "Editar", icon: <EditIcon />, onClick: vi.fn() },
    { label: "Deletar", icon: <DeleteIcon />, onClick: onDelete, danger: true, dividerBefore: true },
  ];
}

describe("RowActionsMenu", () => {
  it("renderiza os itens em ordem quando aberto", () => {
    render(<RowActionsMenu anchorEl={document.body} items={sample()} onClose={vi.fn()} />);
    const names = screen.getAllByRole("menuitem").map((el) => el.textContent);
    expect(names).toEqual(["Editar", "Deletar"]);
  });

  it("renderiza um divisor antes do item com dividerBefore", () => {
    render(<RowActionsMenu anchorEl={document.body} items={sample()} onClose={vi.fn()} />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("clicar num item dispara onClick e onClose", async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(<RowActionsMenu anchorEl={document.body} items={sample(onDelete)} onClose={onClose} />);
    await userEvent.click(screen.getByRole("menuitem", { name: "Deletar" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("não renderiza nada quando anchorEl é null", () => {
    render(<RowActionsMenu anchorEl={null} items={sample()} onClose={vi.fn()} />);
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `docker compose exec app pnpm test src/components/transactions/RowActionsMenu.test.tsx`
Expected: FAIL — "Failed to resolve import './RowActionsMenu'".

- [ ] **Step 3: Implementar `RowActionsMenu.tsx`**

```tsx
"use client";

import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import type { RowMenuItem } from "./types";

type Props = {
  anchorEl: HTMLElement | null;
  items: RowMenuItem[];
  onClose: () => void;
};

/**
 * Menu ⋮ único da tabela de transações. Uma instância vive no TransactionTable;
 * o conteúdo (`items`) é fornecido pela linha que o abre (desenho b da spec 62).
 */
export function RowActionsMenu({ anchorEl, items, onClose }: Props) {
  return (
    <Menu
      anchorEl={anchorEl}
      open={!!anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{ paper: { sx: { minWidth: 180 } } }}
    >
      {items.flatMap((item, i) => [
        item.dividerBefore ? <Divider key={`d-${i}`} /> : null,
        <MenuItem
          key={i}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          sx={{ py: 0.75, fontSize: 13, ...(item.danger ? { color: "danger.main" } : {}) }}
        >
          <ListItemIcon sx={{ minWidth: 32, ...(item.danger ? { color: "danger.main" } : {}) }}>
            {item.icon}
          </ListItemIcon>
          {item.label}
        </MenuItem>,
      ])}
    </Menu>
  );
}
```

> **Nota pós-implementação (Task 3, achado de revisão):** a versão original desta referência usava `<Fragment key={i}>` para agrupar divisor+item. MUI's `MenuList` injeta `autoFocus`/`tabIndex` no filho no índice ativo via `React.cloneElement` — envolver em `Fragment` faz essas props caírem no Fragment, não no `MenuItem`, quebrando o foco de teclado (confirmado contra `@mui/material@6.5.0`, `MenuList.js:191-234`, e o próprio dev-warning do MUI para esse padrão). Corrigido para array plano (`.flatMap`), alinhado ao padrão já usado na referência de §7/Task 6.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `docker compose exec app pnpm test src/components/transactions/RowActionsMenu.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/transactions/RowActionsMenu.tsx src/components/transactions/RowActionsMenu.test.tsx
git commit -m "feat(transactions): add RowActionsMenu (single overflow menu)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 4: Reescrever `TransactionRowActions` — primárias + ⋮

**Files:**
- Modify (rewrite): `src/components/transactions/TransactionRowActions.tsx`
- Create: `src/components/transactions/TransactionRowActions.test.tsx`
- Modify: `src/lib/messages/pt-BR.ts`

**Interfaces:**
- Consumes: `buildRowMenuItems` (Task 2), `RowMenuItem` (Task 1)
- Produces: novo `Props` de `TransactionRowActions`:
  ```ts
  type Props = {
    tx: TxRow;
    isReadOnly: boolean;
    onStartEdit: () => void;
    onTogglePending: (e: React.MouseEvent) => void;
    onToggleFavorite: (e: React.MouseEvent) => void;
    onViewDetails: () => void;
    onDuplicate: () => void;
    onMove: () => void;
    onCreateAlias: () => void;
    onDelete: () => void;
    onOpenLinkDialog: () => void;
    onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>, items: RowMenuItem[]) => void;
  };
  ```
  Removidas: `menuAnchor`, `setMenuAnchor`, `onStartEditWithNote`.

- [ ] **Step 1: Adicionar string `actions.more` em `pt-BR.ts`**

No bloco `transactions.actions`, adicione:

```ts
      more: "Mais ações",
```

- [ ] **Step 2: Escrever o teste que falha — `TransactionRowActions.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TransactionRowActions } from "./TransactionRowActions";
import type { TransactionRow as TxRow } from "./types";

const TX: TxRow = {
  id: "tx-1",
  monthId: "m-1",
  occurredOn: "2026-06-15",
  amountCents: "4590",
  description: "Netflix",
  notes: null,
  isPending: false,
  isFavorite: false,
  categoryId: null,
  subcategoryId: null,
  institutionId: null,
  institutionText: null,
  responsiblePartyId: null,
  cardInstallment: null,
  investmentType: null,
  expenseType: null,
  paymentMethod: null,
  source: "manual",
  installmentGroupId: null,
  installmentNumber: null,
  installmentGroupCount: null,
  originalAmountCents: null,
  originalCurrency: null,
  exchangeRate: null,
  tags: [],
  linkCount: 0,
  createdById: "u-1",
  createdAt: "2026-06-15T00:00:00.000Z",
  updatedById: null,
  updatedAt: "2026-06-15T00:00:00.000Z",
};

function renderActions(props: Partial<Parameters<typeof TransactionRowActions>[0]> = {}) {
  const spies = {
    onStartEdit: vi.fn(),
    onTogglePending: vi.fn(),
    onToggleFavorite: vi.fn(),
    onViewDetails: vi.fn(),
    onDuplicate: vi.fn(),
    onMove: vi.fn(),
    onCreateAlias: vi.fn(),
    onDelete: vi.fn(),
    onOpenLinkDialog: vi.fn(),
    onOpenMenu: vi.fn(),
  };
  render(
    <table>
      <tbody>
        <tr>
          <TransactionRowActions tx={TX} isReadOnly={false} {...spies} {...props} />
        </tr>
      </tbody>
    </table>,
  );
  return spies;
}

describe("TransactionRowActions", () => {
  it("editor: mostra as primárias (pendente, favorito) e o ⋮ com aria-label", () => {
    renderActions();
    expect(screen.getByRole("button", { name: "Marcar como pendente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar aos favoritos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais ações" })).toBeInTheDocument();
  });

  it("viewer: esconde as primárias, mantém só o ⋮", () => {
    renderActions({ isReadOnly: true });
    expect(screen.queryByRole("button", { name: "Marcar como pendente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar aos favoritos" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais ações" })).toBeInTheDocument();
  });

  it("clicar na primária de pendente chama onTogglePending", async () => {
    const spies = renderActions();
    await userEvent.click(screen.getByRole("button", { name: "Marcar como pendente" }));
    expect(spies.onTogglePending).toHaveBeenCalledTimes(1);
  });

  it("clicar no ⋮ chama onOpenMenu com os itens do editor", async () => {
    const spies = renderActions();
    await userEvent.click(screen.getByRole("button", { name: "Mais ações" }));
    expect(spies.onOpenMenu).toHaveBeenCalledTimes(1);
    const items = spies.onOpenMenu.mock.calls[0][1];
    expect(items.map((i: { label: string }) => i.label)).toEqual([
      "Editar",
      "Duplicar",
      "Mover para…",
      "Ver detalhes",
      "Gerenciar vínculos",
      "Criar apelido a partir desta transação",
      "Deletar",
    ]);
  });

  it("aria-label dinâmico quando já pendente/favorito", () => {
    renderActions({ tx: { ...TX, isPending: true, isFavorite: true } });
    expect(screen.getByRole("button", { name: "Marcar como concluída" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover dos favoritos" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `docker compose exec app pnpm test src/components/transactions/TransactionRowActions.test.tsx`
Expected: FAIL — o componente atual não tem os botões nomeados nem `onOpenMenu`/`onMove`.

- [ ] **Step 4: Reescrever `TransactionRowActions.tsx` por completo**

Substitua **todo** o conteúdo do arquivo por:

```tsx
"use client";

import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import Tooltip from "@mui/material/Tooltip";

import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";

import { buildRowMenuItems } from "./row-menu-items";
import type { RowMenuItem, TransactionRow as TxRow } from "./types";

type Props = {
  tx: TxRow;
  isReadOnly: boolean;
  onStartEdit: () => void;
  onTogglePending: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onViewDetails: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onCreateAlias: () => void;
  onDelete: () => void;
  onOpenLinkDialog: () => void;
  onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>, items: RowMenuItem[]) => void;
};

const ICON_SX = { fontSize: 18 } as const;
const BTN_SX = { p: 1 } as const;

export function TransactionRowActions({
  tx,
  isReadOnly,
  onStartEdit,
  onTogglePending,
  onToggleFavorite,
  onViewDetails,
  onDuplicate,
  onMove,
  onCreateAlias,
  onDelete,
  onOpenLinkDialog,
  onOpenMenu,
}: Props) {
  const pendingLabel = tx.isPending
    ? m.transactions.actions.markAsDone
    : m.transactions.actions.markAsPending;
  const favoriteLabel = tx.isFavorite
    ? m.transactions.actions.removeFromFavorites
    : m.transactions.actions.addToFavorites;

  const items = buildRowMenuItems({
    isReadOnly,
    onEdit: onStartEdit,
    onDuplicate,
    onMove,
    onViewDetails,
    onManageLinks: onOpenLinkDialog,
    onCreateAlias,
    onDelete,
  });

  return (
    <TableCell
      align="right"
      sx={{ width: 200, minWidth: 200, whiteSpace: "nowrap", pr: 1 }}
      onClick={(e) => e.stopPropagation()}
    >
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: layout.micro }}>
        {!isReadOnly && (
          <>
            <Tooltip title={pendingLabel}>
              <IconButton
                size="small"
                onClick={onTogglePending}
                aria-label={pendingLabel}
                className={`row-primary${tx.isPending ? " row-primary--active" : ""}`}
                sx={{ ...BTN_SX, color: "text.secondary" }}
              >
                {tx.isPending ? (
                  <HourglassBottomIcon sx={ICON_SX} />
                ) : (
                  <HourglassEmptyIcon sx={ICON_SX} />
                )}
              </IconButton>
            </Tooltip>

            <Tooltip title={favoriteLabel}>
              <IconButton
                size="small"
                onClick={onToggleFavorite}
                aria-label={favoriteLabel}
                className={`row-primary${tx.isFavorite ? " row-primary--active" : ""}`}
                sx={{ ...BTN_SX, color: tx.isFavorite ? "warning.main" : "text.secondary" }}
              >
                {tx.isFavorite ? <StarIcon sx={ICON_SX} /> : <StarBorderIcon sx={ICON_SX} />}
              </IconButton>
            </Tooltip>
          </>
        )}

        <Tooltip title={m.transactions.actions.more}>
          <IconButton
            size="small"
            aria-label={m.transactions.actions.more}
            onClick={(e) => onOpenMenu(e, items)}
            sx={{ ...BTN_SX, color: "text.secondary" }}
          >
            <MoreVertIcon sx={ICON_SX} />
          </IconButton>
        </Tooltip>
      </Box>
    </TableCell>
  );
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `docker compose exec app pnpm test src/components/transactions/TransactionRowActions.test.tsx`
Expected: PASS (5 testes).

> Nota: `TransactionRow.tsx` ainda passa as props antigas (`menuAnchor`/`setMenuAnchor`/`onStartEditWithNote`) e não passa `onMove`/`onOpenMenu` — o **typecheck vai falhar** até a Task 5. Isso é esperado; não rode `typecheck` isolado agora.

- [ ] **Step 6: Commit**

```bash
git add src/components/transactions/TransactionRowActions.tsx src/components/transactions/TransactionRowActions.test.tsx src/lib/messages/pt-BR.ts
git commit -m "refactor(transactions): row actions = primaries (pending/favorite) + overflow menu

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 5: `TransactionRow` — glyphs passivos, aria-resumo, opacidade, wiring

**Files:**
- Modify: `src/components/transactions/TransactionRow.tsx`

**Interfaces:**
- Consumes: `describeRowState` (Task 1), novo `Props` de `TransactionRowActions` (Task 4)
- Produces: `TransactionRow` (via `TransactionRowBase`) passa a exigir 2 novas props do pai: `onOpenMenu` e `onOpenMove`:
  ```ts
  onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>, items: RowMenuItem[]) => void;
  onOpenMove: (ids: string[]) => void;
  ```

- [ ] **Step 1: Adicionar os imports necessários no topo de `TransactionRow.tsx`**

Adicione (junto aos imports de ícones já existentes) os ícones de glyph e o helper/tipo:

```tsx
import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import NoteIcon from "@mui/icons-material/Note";

import { layout } from "@/lib/design-tokens";

import { describeRowState } from "./row-state";
import type { RowMenuItem } from "./types";
```

> Se algum desses imports já existir no arquivo, não duplique — mantenha um só.

- [ ] **Step 2: Adicionar as 2 novas props ao `type Props` e ao destructuring**

No `type Props` (linha ~54), adicione:

```ts
  onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>, items: RowMenuItem[]) => void;
  onOpenMove: (ids: string[]) => void;
```

No destructuring de `TransactionRowBase({ ... })` (linha ~76), adicione `onOpenMenu,` e `onOpenMove,`.

- [ ] **Step 3: Trocar a mecânica de reveal no `sx` do `TableRow` (modo leitura)**

Localize (linha ~452-459):

```tsx
      sx={{
        opacity: tx.isPending ? 0.65 : 1,
        // Ícones de ação: ocultos por padrão, visíveis no hover
        "& .action-icon": { opacity: 0, transition: "opacity 0.15s" },
        "&:hover .action-icon": { opacity: 1 },
        // Estado ativo (favorito, pendente, nota): sempre levemente visível
        "& .action-icon--active": { opacity: 0.75 },
      }}
```

Substitua por:

```tsx
      sx={{
        opacity: tx.isPending ? 0.65 : 1,
        // Primárias (pendente/favorito): visíveis mas discretas em repouso (tappable em touch),
        // plenas no hover/foco da linha; estado ativo = pleno sempre.
        "& .row-primary": { opacity: 0.55, transition: "opacity 0.15s" },
        "&:hover .row-primary, &:focus-within .row-primary": { opacity: 1 },
        "& .row-primary--active": { opacity: 1 },
      }}
```

- [ ] **Step 4: Adicionar `aria-label`-resumo à célula de descrição e os glyphs passivos**

Localize a `TableCell` de descrição (linha ~477) e adicione `aria-label={describeRowState(tx)}` na `TableCell`. Dentro do `Box` interno (linha ~485), **após** o `Box component="span"` do texto e **antes** do bloco condicional da varinha (`matchedAlias && ...`, linha ~501), insira o cluster de glyphs:

```tsx
          <Box
            component="span"
            aria-hidden
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: layout.micro,
              flexShrink: 0,
              color: "text.tertiary",
            }}
          >
            {tx.notes && <NoteIcon sx={{ fontSize: 14 }} />}
            {tx.originalCurrency && <CurrencyExchangeOutlinedIcon sx={{ fontSize: 14 }} />}
            {tx.linkCount > 0 && (
              <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
                <LinkOutlinedIcon sx={{ fontSize: 14 }} />
                <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>
                  {tx.linkCount}
                </Typography>
              </Box>
            )}
          </Box>
```

> A varinha de apelido (`matchedAlias && aliasApplication && ...`, linha ~501-515) permanece **fora** deste cluster e **interativa** (não `aria-hidden`) — não altere.

- [ ] **Step 5: Atualizar o call-site de `<TransactionRowActions>`**

Localize (linha ~775-789) e substitua o bloco por:

```tsx
      <TransactionRowActions
        tx={tx}
        isReadOnly={isReadOnly}
        onStartEdit={() => startEdit()}
        onTogglePending={togglePending}
        onToggleFavorite={toggleFavorite}
        onViewDetails={handleViewDetails}
        onDuplicate={handleDuplicate}
        onMove={() => onOpenMove([tx.id])}
        onCreateAlias={() => openCreateAlias(tx)}
        onDelete={handleDelete}
        onOpenLinkDialog={() => setLinkDialogOpen(true)}
        onOpenMenu={onOpenMenu}
      />
```

> Isto remove `menuAnchor={null}`, `setMenuAnchor={() => {}}` e `onStartEditWithNote={startEditWithNote}` (props mortas / não mais usadas). Se `startEditWithNote` ficar sem nenhum outro uso no arquivo após esta mudança, remova sua definição também (ver Step 6).

- [ ] **Step 6: Remover `startEditWithNote` se ficou órfão**

Run: `docker compose exec app grep -n "startEditWithNote" src/components/transactions/TransactionRow.tsx`
- Se aparecer **só a definição** (`const startEditWithNote = ...`) e nenhum uso, remova a definição.
- Se não aparecer nada, ok.

- [ ] **Step 7: Typecheck (esperado passar após Task 4 + esta task, exceto pelo pai)**

Run: `docker compose exec app pnpm typecheck`
Expected: FAIL apenas em `TransactionTable.tsx` (ainda não passa `onOpenMenu`/`onOpenMove` às linhas). Nenhum erro em `TransactionRow.tsx`/`TransactionRowActions.tsx`. Prossiga para a Task 6 (o typecheck limpa lá).

- [ ] **Step 8: Commit**

```bash
git add src/components/transactions/TransactionRow.tsx
git commit -m "feat(transactions): passive state glyphs + aria summary + primary opacity in row

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 6: `TransactionTable` — Menu + MoveDialog únicos, callbacks estáveis

**Files:**
- Modify: `src/components/transactions/TransactionTable.tsx`

**Interfaces:**
- Consumes: `RowActionsMenu` (Task 3), `RowMenuItem` (Task 1), `MoveTransactionsDialog` (existente), novo `Props` de `TransactionRow` (Task 5)
- Produces: (nenhum consumidor a jusante)

- [ ] **Step 1: Adicionar imports no topo de `TransactionTable.tsx`**

```tsx
import { RowActionsMenu } from "./RowActionsMenu";
import type { RowMenuItem } from "./types";
```

> `MoveTransactionsDialog` já é importado pelo `BulkActionBar`, mas **não** por `TransactionTable`. Adicione também:

```tsx
import { MoveTransactionsDialog } from "./MoveTransactionsDialog";
```

- [ ] **Step 2: Adicionar estado + callbacks estáveis (após os `useState` existentes, ~linha 178)**

```tsx
  const [rowMenu, setRowMenu] = useState<{ anchorEl: HTMLElement; items: RowMenuItem[] } | null>(null);
  const [moveIds, setMoveIds] = useState<string[] | null>(null);

  const handleOpenRowMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, items: RowMenuItem[]) => {
      setRowMenu({ anchorEl: e.currentTarget, items });
    },
    [],
  );
  const handleOpenMove = useCallback((ids: string[]) => setMoveIds(ids), []);
```

- [ ] **Step 3: Passar as novas props nos DOIS sites de `.map` de `<TransactionRow>`**

Localize os dois usos de `<TransactionRow` (linhas ~713 agrupado e ~767 plano). Em **cada** um, adicione:

```tsx
                          onOpenMenu={handleOpenRowMenu}
                          onOpenMove={handleOpenMove}
```

> Ambos os callbacks são estáveis (`useCallback` com deps `[]`) → preserva o `memo` de `TransactionRow`.

- [ ] **Step 4: Renderizar as instâncias únicas de `RowActionsMenu` e `MoveTransactionsDialog`**

Antes do fechamento do JSX raiz do componente (junto de onde `BulkActionBar` é renderizado, ~linha 498; pode ser logo após), adicione:

```tsx
      <RowActionsMenu
        anchorEl={rowMenu?.anchorEl ?? null}
        items={rowMenu?.items ?? []}
        onClose={() => setRowMenu(null)}
      />

      <MoveTransactionsDialog
        accountId={accountId}
        sourceTableId={tableId}
        sourceMonthId={monthId}
        sourceCountType={sectionCountType}
        sampleAmountCents={
          moveIds ? String(rows.find((r) => r.id === moveIds[0])?.amountCents ?? "") : undefined
        }
        selectedIds={moveIds ?? []}
        open={!!moveIds}
        onClose={() => setMoveIds(null)}
        onMoved={(ids) => {
          onBulkMoved(ids);
          setMoveIds(null);
        }}
      />
```

> `onBulkMoved` é o mesmo handler de reconciliação já passado ao `BulkActionBar` (linha ~511). Confirme o nome exato:
> Run: `docker compose exec app grep -n "onBulkMoved\|onMoved={" src/components/transactions/TransactionTable.tsx`
> Use o identificador que o `BulkActionBar` recebe em `onMoved`.

- [ ] **Step 5: Typecheck limpo**

Run: `docker compose exec app pnpm typecheck`
Expected: PASS (0 erros).

- [ ] **Step 6: Rodar toda a suíte de transações**

Run: `docker compose exec app pnpm test src/components/transactions`
Expected: PASS — inclui os testes das Tasks 1–4 + os testes pré-existentes (`NewTransactionRow`, `CreatableEntitySelect`) sem regressão.

- [ ] **Step 7: Verificação manual (o repo não faz RTL de TransactionTable)**

Com `docker compose up -d`, abra uma tabela financeira com transações e verifique:
1. Linha (editor) mostra `⏳ ☆ ⋮`; primárias discretas em repouso, plenas ao passar o mouse.
2. Clicar ⋮ abre menu: Editar, Duplicar, Mover para…, Ver detalhes, Gerenciar vínculos, Criar apelido, ─── Excluir (vermelho).
3. "Mover para…" abre o dialog de mover com a transação da linha.
4. Transação com nota/moeda/vínculo mostra os glyphs junto da descrição; sem eles quando não há estado.
5. Tab pelo teclado: primárias/⋮ ficam visíveis ao receber foco.
6. Viewer (conta com papel viewer): linha mostra só `⋮` com Ver detalhes + Gerenciar vínculos.

- [ ] **Step 8: Commit**

```bash
git add src/components/transactions/TransactionTable.tsx
git commit -m "feat(transactions): single overflow menu + per-row move dialog in table

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 7: Correções de a11y em edição e criação

**Files:**
- Modify: `src/components/transactions/TransactionRowEditor.tsx`
- Modify: `src/components/transactions/NewTransactionRow.tsx`

**Interfaces:** nenhuma nova.

- [ ] **Step 1: `aria-label` em todos os IconButtons da célula de ações do editor**

Em `TransactionRowEditor.tsx` (bloco ~554-617), adicione `aria-label` a cada `IconButton` que hoje só tem `<Tooltip>`. Use os títulos já existentes:

```tsx
// nota
<IconButton size="small" sx={{ p: 0.5 }} aria-label={notesOpen ? m.transactions.actions.hideNotes : m.transactions.actions.addNote} onClick={() => setNotesOpen((o) => !o)}>
// moeda estrangeira
<IconButton size="small" sx={{ p: 0.5 }} aria-label={m.transactions.foreignCurrency.label} onClick={() => setForeignCurrencyOpen((o) => !o)} color={"default"}>
// vínculos
<IconButton size="small" sx={{ p: 0.5 }} aria-label={m.transactions.links.title} onClick={() => setLinksOpen((o) => !o)} color={"default"}>
// tags
<IconButton size="small" sx={{ p: 0.5 }} aria-label={m.transactions.tags.editTitle} onClick={() => setTagsOpen((o) => !o)}>
// salvar
<IconButton size="small" sx={{ p: 0.5 }} aria-label={m.transactions.actions.save} onClick={onSave} color="primary">
// cancelar
<IconButton size="small" sx={{ p: 0.5 }} aria-label={m.transactions.actions.cancel} onClick={onCancel}>
```

> O botão "criar apelido" já tem `aria-label` (linha ~602) — não duplique.

- [ ] **Step 2: `aria-label` nos IconButtons da célula de ações do NewTransactionRow**

Em `NewTransactionRow.tsx` (bloco ~574-615), adicione `aria-label` aos botões de nota, moeda, salvar e cancelar (reutilizando os títulos dos Tooltips existentes: `m.transactions.actions.addNote`, `m.transactions.foreignCurrency.label`, `"Salvar (Enter)"`→`m.transactions.actions.save`, `"Cancelar (Esc)"`→`m.transactions.actions.cancel`).

- [ ] **Step 3: Garantir foco visível nos reveals por hover que restaram**

Run: `docker compose exec app grep -rn "\.action-icon" src/components/transactions`
- Para **cada** ocorrência de `"&:hover .action-icon": { opacity: 1 }` que ainda exista (editor/new-row), adicione o par de foco na mesma regra `sx`:

```tsx
        "&:hover .action-icon, &:focus-within .action-icon": { opacity: 1 },
```

- Se nenhuma ocorrência de `.action-icon` restar (só `TransactionRow` a usava, e a Task 5 a substituiu por `.row-primary`), não há nada a fazer — registre isso.

- [ ] **Step 4: Typecheck + testes**

Run: `docker compose exec app pnpm typecheck && docker compose exec app pnpm test src/components/transactions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/transactions/TransactionRowEditor.tsx src/components/transactions/NewTransactionRow.tsx
git commit -m "fix(transactions): aria-labels + focus-visible on edit/create action buttons

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 8: Verificação final (lint, typecheck, testes, light/dark, densidade)

**Files:** nenhum (gate de qualidade).

- [ ] **Step 1: Lint + format + typecheck + testes completos**

Run:
```bash
docker compose exec app pnpm lint
docker compose exec app pnpm typecheck
docker compose exec app pnpm test
```
Expected: todos PASS, 0 erros de lint.

- [ ] **Step 2: Confirmar ausência de props mortas e de hex hardcoded**

Run:
```bash
docker compose exec app grep -rn "menuAnchor\|setMenuAnchor" src/components/transactions
docker compose exec app grep -rnE "#[0-9a-fA-F]{6}" src/components/transactions/TransactionRowActions.tsx src/components/transactions/RowActionsMenu.tsx src/components/transactions/row-menu-items.tsx
```
Expected: nenhuma saída (props mortas removidas; sem hex).

- [ ] **Step 3: Verificação visual light E dark**

Com `docker compose up -d`, no navegador, alternando o tema (ThemeToggle):
1. Glyphs de estado legíveis em light **e** dark; contagem de vínculos usa `text.secondary` (contraste ok).
2. Estrela de favorito ativa em `warning.main`; item Excluir do menu em `danger.main` nos dois modos.
3. Primárias: repouso discreto, hover/foco pleno, ativo pleno.
4. Sem warning de hydration no console.

- [ ] **Step 4: Verificação de densidade (~600px)**

Reduza a viewport para ~600px numa linha com descrição longa + nota + moeda + vínculos:
- A descrição trunca com reticências **antes** dos glyphs; os glyphs não saem da célula (`flexShrink:0`).

- [ ] **Step 5: Commit final (se houve ajuste de lint/format)**

```bash
git add -A
git commit -m "chore(transactions): lint/format pass for row actions redesign

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> Se nada mudou no Step 5, pule o commit.

- [ ] **Step 6: Atualizar a spec para `approved` (opcional, após aprovação do revisor)**

Após revisão do diff por `myaccountant-reviewer` + `ui-critique`, se aprovado, mude este arquivo de `Status: ready` para `Status: approved` e commite.

### 9.11 Self-Review (autor do plano)

**1. Cobertura da spec 62:**
- ROW-01/02 (separação estado/ação) → Tasks 4, 5. ✅
- ROW-03 (props mortas) → Task 4 (tipo) + Task 5 (call-site) + Task 8 (grep de confirmação). ✅
- UX-01 / DD-62-07 (Mover por linha) → Tasks 2 (item) + 6 (dialog). ✅
- A11Y-01 (:focus-within) → Task 5 (`.row-primary`) + Task 7 (`.action-icon` residual). ✅
- A11Y-02 (aria-label) → Tasks 4, 7. ✅
- A11Y-03 (alvo ≥40px `p:1` + sempre visível) → Task 4 (`BTN_SX={p:1}`, primárias fora do hover-gate). ✅
- PERF-01 / memo (Menu+Dialog únicos, callback estável, dois `.map`) → Tasks 3, 6. ✅
- Glyphs passivos + aria-resumo → Tasks 1 (`describeRowState`) + 5. ✅
- Menu §6.6 (ordem, divisor, danger) → Tasks 2, 3. ✅
- Viewer (só ⋮ leitura) → Tasks 2, 4. ✅
- Light/dark + densidade → Task 8. ✅
- EDIT/CREATE preservados + base fixes → Task 7. ✅

**2. Placeholders:** nenhum "TBD/TODO"; todo passo de código traz o código; comandos com saída esperada.

**3. Consistência de tipos:** `RowMenuItem` (Task 1) usado igual em Tasks 2/3/4/5/6. `describeRowState` assinatura idêntica em Tasks 1/5. `buildRowMenuItems` opts idênticos em Tasks 2/4. `onOpenMenu(e, items)` e `onOpenMove(ids)` consistentes entre Tasks 4/5/6. `MoveTransactionsDialog` props batem com `MoveTransactionsDialog.tsx:44-55`.

Revisores sugeridos: `myaccountant-reviewer` (convenções) + `ui-critique` (visual/a11y light/dark, opacidade de repouso) sobre o diff final.
