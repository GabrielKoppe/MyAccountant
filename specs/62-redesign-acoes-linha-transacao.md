# Spec 62 — Linha de Transação Expansível (gaveta de anexos + coluna de ações unificada)

> Status: ready
> Insumo: uso real da implementação v1 (coluna-de-ações com glyphs/primárias) + feedback do desenvolvedor (2026-07-08): "ícones de tamanhos diferentes/estranhos; view/edit/create muito diferentes; notas/fx/vínculos não pertencem à descrição — são atributos/anexos". Pivô de design aprovado por múltipla-escolha (linha expansível > indicador único > coluna dedicada). Reescreve esta spec in-place; a direção v1 vira histórico em §10.
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`frontend-design`](../skills/frontend-design/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`ui-feedback`](../skills/ui-feedback/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md)

---

## Contexto e histórico (por que esta spec mudou de direção)

A **v1** desta spec (§10) tratou o problema como "coluna de ações densa": reduziu 10 IconButtons a `[pendente][favorito][⋮]` e moveu nota/câmbio/vínculos para glyphs passivos — primeiro na descrição, depois na própria coluna de ações. Implementada e revisada, mas **o uso real revelou 3 problemas que a v1 não resolveu**:

1. **Ícones inconsistentes** — marcadores `fontSize:14`, primárias `18`, expansores do editor `16`, itens de menu `16` convivendo → visual "quebrado".
2. **Estado ainda tratado como quase-ação** — glyphs colados ao cluster de botões geram ambiguidade (clico? não clico?), e nota/fx/vínculo **não têm relação com a descrição nem com "ação"**: são **atributos que a transação tem** (dados/anexos).
3. **VIEW, EDIT e CREATE divergentes** — três layouts diferentes na mesma coluna (view: glyphs+toggles+menu; edit: 7 expansores; create: 4). Sem coerência entre modos.

A **v2** (esta spec) reenquadra: nota/câmbio/vínculos/tags/parcela = **anexos da linha**. Eles saem tanto da coluna de ações quanto da descrição e passam a viver numa **gaveta expansível** (master-detail). VIEW/EDIT/CREATE viram **estados de uma mesma linha**, não três layouts. Muito do que a v1 construiu é **reusado** (menu ⋮ único, toggles pendente/favorito, `MoveTransactionsDialog` único elevado à tabela, `RowActionsMenu`).

---

## 1. Problema

- **ROW-10** — Ícones de tamanhos e pesos diferentes coabitam a coluna de ações/linha (`TransactionRowActions.tsx` marcadores `fontSize:14` + primárias `18`; `TransactionRowEditor.tsx` botões `16`), sem escala consistente. Leitura "quebrada".
- **ROW-11** — Anexos tratados como (quase-)ação. Nota, câmbio e vínculos são **atributos** da transação, mas foram desenhados como glyphs colados ao cluster de botões (v1) → ambiguidade de affordance e ruído. Não pertencem nem à coluna de ações nem à célula de descrição (só o apelido é derivado da descrição — spec 61 §2.4).
- **ROW-12** — Divergência entre modos. VIEW, EDIT e CREATE usam três layouts distintos na região de ações/extras (`TransactionRow.tsx`, `TransactionRowEditor.tsx:554-640` 7 botões, `NewTransactionRow.tsx:574-615` 4 botões). Sem linguagem única.
- **ROW-13** — Sem visão consolidada dos extras. Para ver nota + câmbio + vínculos + tags + parcela de uma transação, o usuário precisa entrar em edição ou abrir múltiplos pontos (Drawer de parcela, dialog de vínculos, popover de tags). Não há um "resumo dos anexos" por linha em modo leitura.

> **Reuso da v1 (não é problema, é base):** o menu ⋮ único (`RowActionsMenu`), os toggles pendente/favorito, o `MoveTransactionsDialog` único e o `buildRowMenuItems` permanecem — a v2 evolui o modelo, não recomeça.

---

## 2. Solução

Direção escolhida: **linha expansível (master-detail)**. A linha tem 3 estados; a coluna de ações fica com **linguagem única** (mesmo tamanho de ícone, mesmo alinhamento, 160px) nos 3 modos.

### 2.1 Estado 1 — Repouso (VIEW colapsado) (ROW-11, ROW-12)

```
[✓] 15/06  Netflix     Assinaturas  R$45,90  João  #lazer         ⏳ ☆ ⋮
[✓] 15/06  Spotify     Streaming    R$21,90  Ana   #fixo    📎3   ⏳ ★ ⋮
```

- **Coluna de ações VIEW = `[📎N] [pendente] [favorito] [⋮]`**, todos `fontSize:18`, gap `layout.inline` (8px), alvo ~32px (D14 herdado). O `📎N` (indicador de anexos) aparece **apenas quando `countAttachments(tx) > 0`**.
- **`📎N`** = ícone `AttachFileOutlined` (MUI) + contagem em `Typography` (`text.secondary`). É **botão** (`aria-label` "Ver anexos (N)"). Clicar → abre/fecha a gaveta de leitura (estado 2). Um só ícone, um só tamanho — resolve ROW-10.
- **`countAttachments(tx)`** conta **tudo** (D-ATT): `(notes?1:0) + (originalCurrency?1:0) + linkCount + tags.length + (installmentGroupId?1:0)`. Regra documentada e ajustável (ex.: tags como `1`) — ver DD-62-ATT.
- **Toggles pendente/favorito** (reuso v1): `HourglassEmpty/Bottom` e `StarBorder/Star` (ativo `warning.main`), sempre visíveis, `aria-label` dinâmico, opacidade de repouso reduzida → plena em hover/foco/ativo.
- **`⋮`** abre `RowActionsMenu` (reuso v1), agora enxuto (§2.4).
- **Clicar numa célula de dado** (data/descrição/categoria/valor/resp) continua **iniciando edição** (`startEdit(campo)`) — hábito atual preservado. O `📎` é o **único** gatilho da gaveta de leitura (não conflita).
- **Descrição** mantém só o texto + varinha de apelido (spec 61 §2.4). Nenhum glyph de estado ali.
- **Tags** seguem na coluna de chips (visíveis de relance); **parcela** segue com indicador/coluna própria. Ambas também aparecem na gaveta (§2.2) — a gaveta é a visão agregada, não substitui os acessos próprios (D-ATT).

### 2.2 Estado 2 — Gaveta aberta (VIEW leitura) (ROW-11, ROW-13)

Clicar `📎N` expande uma sub-linha (`TableRow` `colSpan` + `Collapse` — mesma mecânica já usada no editor, `TransactionRowEditor.tsx:646`) com **todos os anexos, read-only**:

```
[✓] 15/06  Spotify     Streaming    R$21,90  Ana   #fixo    📎5   ⏳ ★ ⋮
    ┌── anexos ──────────────────────────────────────────────────────┐
    │ 📝  Renovação anual, cobrado em dólar                           │
    │ 💱  USD 8,99 · taxa 5,11                                         │
    │ 🔗  2 vínculos                                    [gerenciar]    │
    │ 🏷  #fixo  #lazer                                                │
    │ 📆  Parcela 3/12                                  [ver grupo]    │
    └─────────────────────────────────────────────────────────────────┘
```

- Componente novo **`TransactionRowDetails`** (presentacional, read-only): recebe `tx` + callbacks `onManageLinks`, `onViewInstallmentGroup`. Renderiza só as seções presentes (item ausente não aparece).
- Ícones das seções **tamanho único** (`fontSize:16`), rótulo/valor em `text.secondary`. `[gerenciar]` abre o `LinkTransactionDialog` existente; `[ver grupo]` abre o `InstallmentGroupPanel` (Drawer) existente — **reuso**, sem reimplementar.
- A gaveta é **leitura**; para alterar, o usuário entra em edição (estado 3), que abre a mesma região como formulário.

### 2.3 Estado 3 — Edição e Criação (EDIT/CREATE) (ROW-12)

EDIT e CREATE passam a compartilhar a **mesma linguagem**: campos-chave inline na linha + **gaveta de formulário** com as seções + commit `✓ ✕`.

```
[✓] 15/06▾ [Netflix   ][Assinat.][R$45,90][João]                    ✓ ✕
    ┌── editar ──────────────────────────────────────────────────────┐
    │ Nota      [ texto multi-linha______________________________ ]   │
    │ Câmbio    [ USD ][ 8,99 ][ taxa 5,11 ]                           │
    │ Vínculos  [ + adicionar ]   • Transf. Nubank            [x]      │
    │ Tags      [ #fixo ][ #lazer ][ + ]                               │
    │                                             [ Criar apelido ]    │
    └─────────────────────────────────────────────────────────────────┘
```

- **Coluna de ações EDIT/CREATE = `[✓ salvar] [✕ cancelar]`** (commits), `fontSize:18`, mesma célula 160px → alinhamento idêntico ao VIEW.
- **Os 7 expansores do editor somem da coluna de ações.** As seções (nota, câmbio, vínculos, tags) viram conteúdo da gaveta de edição, sempre acessíveis (seção vazia mostra "+ adicionar"; preenchida mostra o editor). Reusa os `Collapse`/editores já existentes em `TransactionRowEditor` — reorganizados para dentro da gaveta.
- **Criar apelido** (spec 61 §2.5 — exige visível no editor): vira ação no rodapé da gaveta de edição (`[Criar apelido]`). Delta registrado (§6).
- **CREATE**: mantém paridade com o que a criação já suporta hoje (nota + câmbio); vínculos/tags na criação seguem **fora de escopo** (não existem hoje em `NewTransactionRow`).
- Comportamento preservado: salvar/cancelar, entrada rápida (linha permanece após salvar no create), aplicação de apelido, feedback otimista.

### 2.4 Menu ⋮ enxuto (reuso + limpeza)

Com nota e vínculos agora na gaveta, o `⋮` (VIEW, não-viewer) fica: **Editar · Duplicar · Mover para… · Ver detalhes · Criar apelido · `<Divider>` · Excluir** (`danger.main`, por último). Removidos do menu: **Nota** (vira estado 3) e **Gerenciar vínculos** (vira `[gerenciar]` na gaveta / estado 3). Viewer (read-only): só **Ver detalhes** (a gaveta de leitura cobre a inspeção dos anexos; `[gerenciar]` de vínculos fica oculto/desabilitado para viewer).

### 2.5 Consistência de ícones (ROW-10)

Escala única na linha: ações (📎, pendente, favorito, ⋮, ✓, ✕) = `fontSize:18`; seções da gaveta = `fontSize:16`; nunca `14`. Sem mistura.

---

## 3. User Stories

- Como usuário, quero que nota/câmbio/vínculos/tags/parcela sejam tratados como **anexos** (dados que a transação tem), não como botões, para não confundir estado com ação.
- Como usuário, quero **ver todos os anexos de uma linha num lugar** (gaveta) sem entrar em edição.
- Como usuário, quero que **visualizar, editar e criar** usem a mesma linguagem visual, para não reaprender o layout a cada modo.
- Como usuário, quero abrir os anexos com **um clique no indicador `📎`** sem perder o clique-para-editar que já uso.
- Como usuário de teclado/leitor de tela, quero o indicador de anexos com nome acessível e a gaveta navegável.
- Como mantenedor, quero **reusar** o menu ⋮/toggles/MoveDialog da v1 e ter uma única escala de ícones.

---

## 4. Critérios de Aceitação

**ROW-10 (ícones consistentes):**
- TODOS os ícones da coluna de ações (📎, pendente, favorito, ⋮, ✓, ✕) DEVEM usar `fontSize:18`; as seções da gaveta `fontSize:16`; NENHUM ícone da linha DEVE usar `fontSize:14`.

**ROW-11 (anexos ≠ ação, ≠ descrição):**
- A CÉLULA DE DESCRIÇÃO NÃO DEVE exibir glyphs de nota/câmbio/vínculo (só texto + varinha de apelido).
- A COLUNA DE AÇÕES NÃO DEVE exibir nota/câmbio/vínculo como glyphs/botões separados; esses extras DEVEM ser acessíveis só via indicador `📎` → gaveta.

**ROW-12 (indicador + gatilho):**
- QUANDO `countAttachments(tx) > 0`, A COLUNA DE AÇÕES DEVE exibir o indicador `📎N` (ícone único + contagem) antes de pendente/favorito; QUANDO `= 0`, NÃO DEVE exibir o indicador.
- O `📎N` DEVE ter `aria-label` "Ver anexos (N)" e alternar a gaveta de leitura ao ser acionado.
- Clicar numa célula de dado DEVE continuar iniciando edição (não abrir a gaveta de leitura).

**ROW-13 (gaveta de leitura):**
- QUANDO a gaveta de leitura abre, ELA DEVE listar apenas as seções presentes (nota / câmbio / vínculos / tags / parcela), read-only, com ícones `fontSize:16`.
- A seção de vínculos DEVE oferecer `[gerenciar]` abrindo o `LinkTransactionDialog` existente; a de parcela `[ver grupo]` abrindo o `InstallmentGroupPanel` existente — SEM reimplementar nenhum dos dois.

**Contagem de anexos:**
- `countAttachments(tx)` DEVE retornar `(notes?1:0) + (originalCurrency?1:0) + linkCount + tags.length + (installmentGroupId?1:0)`.

**EDIT/CREATE (linguagem única):**
- A COLUNA DE AÇÕES em EDIT e CREATE DEVE conter exatamente `✓ salvar` e `✕ cancelar` (`fontSize:18`, mesma célula 160px do VIEW), SEM os expansores de nota/câmbio/vínculos/tags.
- As seções de nota/câmbio/vínculos/tags DEVEM viver na gaveta de edição (reusando os editores atuais); a de "Criar apelido" DEVE permanecer visível no editor (spec 61 §2.5).
- CREATE DEVE preservar nota + câmbio (paridade atual) e NÃO DEVE introduzir vínculos/tags na criação.
- EDIT/CREATE DEVEM preservar salvar/cancelar, entrada rápida e aplicação de apelido.

**Menu ⋮:**
- O `⋮` (não-viewer) DEVE listar Editar, Duplicar, Mover para…, Ver detalhes, Criar apelido, `<Divider>`, Excluir (`danger.main`); NÃO DEVE listar Nota nem Gerenciar vínculos.
- Viewer DEVE ver só Ver detalhes; a gaveta de leitura aparece normalmente; `[gerenciar]` de vínculos NÃO DEVE agir para viewer.

**PERF / memo:**
- Callbacks passados às linhas (incl. novo `onToggleDrawer`/equivalente) DEVEM ser `useCallback`-estáveis, preservando o `memo` de `TransactionRow`.
- A gaveta (leitura e edição) DEVE usar `Collapse`/render condicional (não montar conteúdo quando fechada).

**Modos e a11y:**
- Validado em light E dark; contagem do `📎` em `text.secondary`.
- Foco de teclado visível no `📎`, toggles, ⋮, ✓/✕; gaveta navegável.

---

## 5. Fora de Escopo

- **Reimplementar** mover (Spec 59), vínculos (`LinkTransactionDialog`), parcelamento (`InstallmentGroupPanel`), detalhe completo (`TransactionDetailDialog`) — a v2 só muda **pontos de entrada/apresentação**, não a lógica.
- **Vínculos/tags na criação** (`NewTransactionRow`) — não existem hoje; ficam fora.
- **Remover a coluna de tags (chips) ou o indicador/coluna de parcela** — permanecem (D-ATT); a gaveta é adição, não substituição.
- **Virtualização da tabela** (Spec 56).
- **Redesign de touch dedicado** (long-press, `pointer:coarse`) — coberto pelo tap-to-edit + toggles sempre visíveis + `📎`.
- **Multi-gaveta simultânea / animações elaboradas** — uma gaveta por vez por linha; `Collapse` simples.

---

## 6. Decisões de Design

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-62-V2-01 | Modelo geral | **Linha expansível (master-detail)** | Reenquadra extras como anexos (dados), não ações; unifica VIEW/EDIT/CREATE como estados de uma linha. Escolhido sobre "indicador único" e "coluna dedicada". |
| DD-62-V2-02 | Gatilho da gaveta de leitura | **Indicador `📎N` clicável** (único gatilho) | Comunica quantidade + serve de botão; não conflita com clique-para-editar (hábito preservado); sem coluna de chevron nova. |
| DD-62-ATT | O que `📎N` conta | **Tudo**: nota+câmbio+cada vínculo+cada tag+parcela | Pedido explícito do desenvolvedor. Regra `countAttachments` documentada e ajustável (ex.: tags como 1) sem refactor. Tags/parcela seguem com seus acessos próprios além da gaveta. |
| DD-62-V2-03 | Gaveta de leitura vs edição | **Mesma região, conteúdos distintos** | Leitura (read-only) via `📎`; edição via clique-célula/⋮→Editar abre a região como formulário. Unifica os 3 modos. |
| DD-62-V2-04 | Coluna de ações por modo | VIEW `📎 ⏳ ☆ ⋮` · EDIT/CREATE `✓ ✕` | Mesma célula (160px), mesma escala (18px), mesmo alinhamento → coerência visual; commits são naturais do modo edição. |
| DD-62-V2-05 | Ícone do indicador | **`AttachFileOutlined` + contagem** | Metáfora "anexo" honesta; um único ícone/tamanho resolve ROW-10. |
| DD-62-V2-06 | Menu ⋮ | Remove **Nota** e **Gerenciar vínculos** | Migraram para a gaveta; menu fica só com ações verdadeiras. |
| DD-62-V2-07 | Tags e parcela | **Coluna de chips e Drawer permanecem** + aparecem na gaveta | Chips são rótulo visível de relance (valor próprio); Drawer de parcela é acesso rico. Gaveta agrega sem remover. |
| DD-62-V2-08 | Criar apelido no editor | **Rodapé da gaveta de edição** | Preserva a exigência da spec 61 §2.5 (visível no editor) sem poluir a coluna de ações. |
| DD-14 (herdado) | Alvo de toque das ações | **~32px** | Mantido da v1 (reabriu A11Y-03 de forma consciente por densidade visual). |

### Delta contra specs vizinhas

- **vs Spec 61 §2.4 (varinha na descrição):** varinha permanece na descrição (única affordance ligada ao conteúdo). Nenhum glyph de estado divide a célula. Contenção de eventos da 61 permanece válida.
- **vs Spec 61 §2.5 (criar apelido no editor):** "Criar apelido" migra de botão na coluna de ações para o **rodapé da gaveta de edição** — continua visível no editor. Delta registrado (DD-62-V2-08).
- **vs Spec 59 (mover):** inalterada; "Mover para…" segue reusando `moveTransactionsAction`/`MoveTransactionsDialog`.
- **vs Spec 62 v1 (§10):** a coluna de ações com glyphs passivos + as decisões D1–D14 da v1 são **superseded** naquilo que conflita (glyphs na coluna/descrição, item "Nota" no ⋮, marcadores `fontSize:14`). Reusado da v1: `RowActionsMenu`, `buildRowMenuItems` (enxuto), toggles pendente/favorito, `MoveTransactionsDialog` único, estado centralizado em `TransactionTable`.

---

## 7. Referências Técnicas

| Item | Arquivo(s) |
|---|---|
| `countAttachments(tx)` (puro) | **novo** `src/components/transactions/attachments.ts` |
| Indicador `📎N` (AttachFile + contagem, clicável) | **novo** `src/components/transactions/AttachmentIndicator.tsx` |
| Gaveta de leitura (read-only, seções presentes) | **novo** `src/components/transactions/TransactionRowDetails.tsx` |
| Estado `drawerOpen` + render da gaveta (Collapse) + indicador na coluna de ações; remover marcadores passivos | `src/components/transactions/TransactionRow.tsx`, `src/components/transactions/TransactionRowActions.tsx` |
| Coluna de ações EDIT = `✓ ✕`; seções → gaveta de edição; criar apelido no rodapé | `src/components/transactions/TransactionRowEditor.tsx` |
| Coluna de ações CREATE = `✓ ✕`; gaveta nota+câmbio | `src/components/transactions/NewTransactionRow.tsx` |
| `⋮` enxuto (remover Nota, Gerenciar vínculos) | `src/components/transactions/row-menu-items.tsx` |
| Reuso (não alterar lógica) | `LinkTransactionDialog.tsx`, `InstallmentGroupPanel.tsx`, `MoveTransactionsDialog.tsx`, `RowActionsMenu.tsx` |
| Strings novas (`attachments.view`, `attachments.section.*`, `manageLinks`, `viewGroup`) / remover órfãs | `src/lib/messages/pt-BR.ts` |

```ts
// attachments.ts (referência)
import type { TransactionRow } from "./types";

type AttachmentInput = Pick<
  TransactionRow,
  "notes" | "originalCurrency" | "linkCount" | "tags" | "installmentGroupId"
>;

/** Conta todos os anexos da linha (DD-62-ATT). Ajustável (ex.: tags como 1). */
export function countAttachments(tx: AttachmentInput): number {
  return (
    (tx.notes ? 1 : 0) +
    (tx.originalCurrency ? 1 : 0) +
    tx.linkCount +
    tx.tags.length +
    (tx.installmentGroupId ? 1 : 0)
  );
}
```

---

## 8. Cenários de Teste (mínimo)

- `countAttachments`: zero, só nota, nota+câmbio, com N vínculos, com M tags, parcelada, tudo somado.
- VIEW limpo (0 anexos): sem `📎`; coluna = `⏳ ☆ ⋮`.
- VIEW com anexos: `📎N` com N correto; clicar abre gaveta; clicar de novo fecha.
- Gaveta de leitura: só seções presentes; `[gerenciar]` abre LinkDialog; `[ver grupo]` abre InstallmentPanel.
- Clique em célula de dado abre EDIÇÃO (não a gaveta de leitura).
- EDIT: coluna = `✓ ✕`; seções na gaveta; "Criar apelido" visível; salvar/cancelar funcionam.
- CREATE: coluna = `✓ ✕`; gaveta nota+câmbio; entrada rápida preservada (regressões de `NewTransactionRow.test.tsx` continuam verdes).
- ⋮ (editor): Editar, Duplicar, Mover para…, Ver detalhes, Criar apelido, `<Divider>`, Excluir; sem Nota/Gerenciar vínculos. Viewer: só Ver detalhes.
- Ícones: nenhum `fontSize:14` na linha; ações `18`, seções `16`.
- `memo`: alterar outra linha não re-renderiza linhas não afetadas (callbacks estáveis).
- Light E dark; foco de teclado visível.

---

## 9. Plano de Implementação

> Plano TDD bite-sized (gerado via `writing-plans`). Fonte única — o arquivo em `docs/superpowers/plans/` aponta para cá. Comandos rodam no container: `docker compose exec app <cmd>`.

**Goal:** Transformar a linha de transação num master-detail: extras (nota/câmbio/vínculos/tags/parcela) viram anexos numa gaveta expansível acionada por um indicador `📎N`; VIEW/EDIT/CREATE ficam com coluna de ações de linguagem única.

**Architecture:** Indicador `📎N` (novo `AttachmentIndicator`) na coluna de ações abre uma sub-linha `Collapse` de leitura (novo `TransactionRowDetails`, read-only) hospedada em `TransactionRow` (que já detém `linkDialogOpen`/`installmentPanelOpen`). EDIT/CREATE trocam os expansores da coluna por `✓ ✕` e movem as seções para a gaveta de formulário (reusa os `Collapse` já existentes no editor). Menu ⋮ e toggles reusados da v1.

**Tech Stack:** Next.js 15 (Client Components), TS strict, MUI v6 + tokens, Vitest + Testing Library + userEvent.

### 9.1 Global Constraints

- MUI-only + tokens semânticos; sem hex; sem `!important`/`style` com cor. (CLAUDE.md §5.11)
- Todo `IconButton` com `aria-label`; ícones = import nomeado de `@mui/icons-material`. (design-system §9)
- Strings em `src/lib/messages/pt-BR.ts` (`m`); sem string hardcoded. (CLAUDE.md §5.10)
- `TransactionRow` é `memo` — callbacks vindos de `TransactionTable` (`onOpenMenu`/`onOpenMove`) permanecem `useCallback`-estáveis. (§4 PERF)
- Menu destrutivo: positivas primeiro, `<Divider>`, Excluir por último em `danger.main`. (design-system §6.6)
- **Escala de ícone única:** ações `fontSize:18`; seções da gaveta `fontSize:16`; **nenhum `fontSize:14`** na linha. (§4 ROW-10)
- Paridade light/dark; contagem do `📎` em `text.secondary`.
- Não reimplementar mover/vínculos/parcela/detalhe — reusar dialogs existentes.

### 9.2 File Structure

**Novos:**
- `src/components/transactions/attachments.ts` — `countAttachments(tx)`. Puro.
- `src/components/transactions/AttachmentIndicator.tsx` — botão `📎N` (AttachFileOutlined + contagem).
- `src/components/transactions/TransactionRowDetails.tsx` — gaveta de leitura read-only (seções presentes + callbacks).

**Modificados:**
- `row-menu-items.tsx` — remove `onOpenNote`/`onManageLinks`; ordem enxuta.
- `TransactionRowActions.tsx` — remove marcadores passivos + `onStartEditWithNote`/`onOpenLinkDialog`; adiciona `📎` (via `AttachmentIndicator`) + `onToggleDrawer`.
- `TransactionRow.tsx` — estado `drawerOpen`; sub-linha `Collapse` com `TransactionRowDetails`; remove `startEditWithNote` se órfão; wiring.
- `TransactionRowEditor.tsx` — coluna = `✓ ✕`; seções (nota/câmbio/vínculos/tags) → gaveta; criar apelido no rodapé.
- `NewTransactionRow.tsx` — coluna = `✓ ✕`; gaveta nota+câmbio.
- `pt-BR.ts` — `attachments.{view, viewGroup}`; remover `actions.note` órfã (se sair).

**Novos testes:** `attachments.test.ts`, `AttachmentIndicator.test.tsx`, `TransactionRowDetails.test.tsx`. Atualizados: `row-menu-items.test.tsx`, `TransactionRowActions.test.tsx`.

---

### Task 1: `countAttachments` + `AttachmentIndicator` + strings

**Files:** Create `attachments.ts`, `attachments.test.ts`, `AttachmentIndicator.tsx`, `AttachmentIndicator.test.tsx`; Modify `pt-BR.ts`.

**Interfaces produced:**
- `countAttachments(tx: Pick<TransactionRow,"notes"|"originalCurrency"|"linkCount"|"tags"|"installmentGroupId">): number`
- `<AttachmentIndicator count={number} onClick={() => void} />`
- `m.transactions.attachments.{ view:(n:number)=>string; viewGroup:string }`

- [ ] **Step 1: strings em `pt-BR.ts`** — no bloco `transactions:`, logo antes de `actions: {` (linha ~841), inserir:
```ts
    attachments: {
      view: (n: number) => `Ver anexos (${n})`,
      viewGroup: "Ver grupo",
    },
```

- [ ] **Step 2: teste `attachments.test.ts` (falha)**
```ts
import { describe, expect, it } from "vitest";

import { countAttachments } from "./attachments";

const base = {
  notes: null,
  originalCurrency: null,
  linkCount: 0,
  tags: [] as { id: string; name: string; color: string | null }[],
  installmentGroupId: null,
};

describe("countAttachments", () => {
  it("zero quando não há extras", () => {
    expect(countAttachments(base)).toBe(0);
  });
  it("soma nota + câmbio + vínculos + tags + parcela", () => {
    expect(
      countAttachments({
        notes: "x",
        originalCurrency: "USD",
        linkCount: 2,
        tags: [{ id: "1", name: "a", color: null }],
        installmentGroupId: "g1",
      }),
    ).toBe(6);
  });
  it("conta cada tag e cada vínculo individualmente", () => {
    expect(
      countAttachments({ ...base, linkCount: 3, tags: [{ id: "1", name: "a", color: null }, { id: "2", name: "b", color: null }] }),
    ).toBe(5);
  });
});
```
Run: `docker compose exec app pnpm test src/components/transactions/attachments.test.ts` → FAIL (import).

- [ ] **Step 3: implementar `attachments.ts`**
```ts
import type { TransactionRow } from "./types";

type AttachmentInput = Pick<
  TransactionRow,
  "notes" | "originalCurrency" | "linkCount" | "tags" | "installmentGroupId"
>;

/** Conta todos os anexos da linha (DD-62-ATT). Ajustável (ex.: tags como 1). */
export function countAttachments(tx: AttachmentInput): number {
  return (
    (tx.notes ? 1 : 0) +
    (tx.originalCurrency ? 1 : 0) +
    tx.linkCount +
    tx.tags.length +
    (tx.installmentGroupId ? 1 : 0)
  );
}
```
Run mesmo teste → PASS (3).

- [ ] **Step 4: teste `AttachmentIndicator.test.tsx` (falha)**
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AttachmentIndicator } from "./AttachmentIndicator";

describe("AttachmentIndicator", () => {
  it("mostra a contagem e aria-label", () => {
    render(<AttachmentIndicator count={3} onClick={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Ver anexos (3)" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("3");
  });
  it("dispara onClick", async () => {
    const onClick = vi.fn();
    render(<AttachmentIndicator count={2} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver anexos (2)" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```
Run → FAIL (import).

- [ ] **Step 5: implementar `AttachmentIndicator.tsx`**
```tsx
"use client";

import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { m } from "@/lib/messages";

type Props = {
  count: number;
  onClick: () => void;
};

const BTN_SX = { p: 1, minWidth: 32, minHeight: 32 } as const;

/** Indicador de anexos (📎N) — abre a gaveta de leitura da linha (spec 62 §2.1). */
export function AttachmentIndicator({ count, onClick }: Props) {
  const label = m.transactions.attachments.view(count);
  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        onClick={onClick}
        sx={{ ...BTN_SX, color: "text.secondary" }}
      >
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
          <AttachFileOutlinedIcon sx={{ fontSize: 18 }} />
          <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>
            {count}
          </Typography>
        </Box>
      </IconButton>
    </Tooltip>
  );
}
```
Run → PASS (2).

- [ ] **Step 6: commit**
```bash
git add src/components/transactions/attachments.ts src/components/transactions/attachments.test.ts src/components/transactions/AttachmentIndicator.tsx src/components/transactions/AttachmentIndicator.test.tsx src/lib/messages/pt-BR.ts
git commit -m "feat(transactions): countAttachments + AttachmentIndicator (📎 anexos)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `TransactionRowDetails` — gaveta de leitura

**Files:** Create `TransactionRowDetails.tsx`, `TransactionRowDetails.test.tsx`.

**Interfaces:**
- Consumes: `TransactionRow`, `tagChipSx` (`@/components/tags/tagChipSx`), `formatCentsToBrl` (`@/lib/money`).
- Produces: `<TransactionRowDetails tx={TxRow} isReadOnly={boolean} onManageLinks={()=>void} onViewInstallmentGroup={()=>void} />`

- [ ] **Step 1: teste `TransactionRowDetails.test.tsx` (falha)**
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TransactionRowDetails } from "./TransactionRowDetails";
import type { TransactionRow as TxRow } from "./types";

const TX: TxRow = {
  id: "tx-1", monthId: "m-1", occurredOn: "2026-06-15", amountCents: "4590",
  description: "Netflix", notes: null, isPending: false, isFavorite: false,
  categoryId: null, subcategoryId: null, institutionId: null, institutionText: null,
  responsiblePartyId: null, cardInstallment: null, investmentType: null, expenseType: null,
  paymentMethod: null, source: "manual", installmentGroupId: null, installmentNumber: null,
  installmentGroupCount: null, originalAmountCents: null, originalCurrency: null, exchangeRate: null,
  tags: [], linkCount: 0, createdById: "u-1", createdAt: "2026-06-15T00:00:00.000Z",
  updatedById: null, updatedAt: "2026-06-15T00:00:00.000Z",
};

function renderDetails(tx: Partial<TxRow> = {}) {
  const onManageLinks = vi.fn();
  const onViewInstallmentGroup = vi.fn();
  render(
    <TransactionRowDetails
      tx={{ ...TX, ...tx }}
      isReadOnly={false}
      onManageLinks={onManageLinks}
      onViewInstallmentGroup={onViewInstallmentGroup}
    />,
  );
  return { onManageLinks, onViewInstallmentGroup };
}

describe("TransactionRowDetails", () => {
  it("mostra só a seção de nota quando só há nota", () => {
    renderDetails({ notes: "Renovação anual" });
    expect(screen.getByText("Renovação anual")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerenciar vínculos" })).not.toBeInTheDocument();
  });
  it("seção de vínculos: [gerenciar] dispara onManageLinks", async () => {
    const { onManageLinks } = renderDetails({ linkCount: 2 });
    await userEvent.click(screen.getByRole("button", { name: "Gerenciar vínculos" }));
    expect(onManageLinks).toHaveBeenCalledTimes(1);
  });
  it("seção de parcela: [ver grupo] dispara onViewInstallmentGroup", async () => {
    const { onViewInstallmentGroup } = renderDetails({
      installmentGroupId: "g1", installmentNumber: 3, installmentGroupCount: 12,
    });
    await userEvent.click(screen.getByRole("button", { name: "Ver grupo" }));
    expect(onViewInstallmentGroup).toHaveBeenCalledTimes(1);
  });
  it("viewer: seção de vínculos não oferece [gerenciar]", () => {
    renderDetails({ linkCount: 1 });
    // (re-render com isReadOnly=true feito abaixo)
  });
  it("tags: renderiza chips das tags", () => {
    renderDetails({ tags: [{ id: "1", name: "lazer", color: null }] });
    expect(screen.getByText("lazer")).toBeInTheDocument();
  });
});
```
Run → FAIL (import).

- [ ] **Step 2: implementar `TransactionRowDetails.tsx`**
```tsx
"use client";

import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import NoteOutlinedIcon from "@mui/icons-material/NoteOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { tagChipSx } from "@/components/tags/tagChipSx";
import { layout } from "@/lib/design-tokens";
import { m } from "@/lib/messages";
import { formatCentsToBrl } from "@/lib/money";

import type { TransactionRow as TxRow } from "./types";

type Props = {
  tx: TxRow;
  isReadOnly: boolean;
  onManageLinks: () => void;
  onViewInstallmentGroup: () => void;
};

const ICON_SX = { fontSize: 16, color: "text.tertiary", flexShrink: 0 } as const;

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={layout.inline} alignItems="flex-start">
      {icon}
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
    </Stack>
  );
}

/** Gaveta de leitura (read-only) dos anexos da linha (spec 62 §2.2). Reusa os
 * dialogs existentes via callbacks — não reimplementa vínculos/parcela. */
export function TransactionRowDetails({ tx, isReadOnly, onManageLinks, onViewInstallmentGroup }: Props) {
  return (
    <Box sx={{ px: 2, py: 1.5, bgcolor: "background.subtle" }}>
      <Stack spacing={layout.stack}>
        {tx.notes && (
          <Row icon={<NoteOutlinedIcon sx={ICON_SX} />}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
              {tx.notes}
            </Typography>
          </Row>
        )}

        {tx.originalCurrency && (
          <Row icon={<CurrencyExchangeOutlinedIcon sx={ICON_SX} />}>
            <Typography variant="body2" color="text.secondary">
              {tx.originalCurrency}
              {tx.originalAmountCents ? ` ${formatCentsToBrl(BigInt(tx.originalAmountCents))}` : ""}
              {tx.exchangeRate ? ` · taxa ${tx.exchangeRate}` : ""}
            </Typography>
          </Row>
        )}

        {tx.linkCount > 0 && (
          <Row icon={<LinkOutlinedIcon sx={ICON_SX} />}>
            <Stack direction="row" spacing={layout.inline} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {m.transactions.rowState.links(tx.linkCount)}
              </Typography>
              {!isReadOnly && (
                <Button size="small" variant="text" onClick={onManageLinks}>
                  {m.transactions.links.manage}
                </Button>
              )}
            </Stack>
          </Row>
        )}

        {tx.tags.length > 0 && (
          <Row icon={<LabelOutlinedIcon sx={ICON_SX} />}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {tx.tags.map((t) => (
                <Chip key={t.id} label={t.name} size="small" sx={tagChipSx(t.color)} />
              ))}
            </Box>
          </Row>
        )}

        {tx.installmentGroupId && (
          <Row icon={<EventRepeatOutlinedIcon sx={ICON_SX} />}>
            <Stack direction="row" spacing={layout.inline} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {m.transactions.installments.column}{" "}
                {tx.installmentNumber && tx.installmentGroupCount
                  ? m.transactions.installments.badge(tx.installmentNumber, tx.installmentGroupCount)
                  : ""}
              </Typography>
              <Button size="small" variant="text" onClick={onViewInstallmentGroup}>
                {m.transactions.attachments.viewGroup}
              </Button>
            </Stack>
          </Row>
        )}
      </Stack>
    </Box>
  );
}
```
> Ajustar o teste "viewer" (Step 1) para renderizar com `isReadOnly={true}` e assertar ausência do botão "Gerenciar vínculos". Run → PASS.

- [ ] **Step 3: rodar + commit**
```bash
docker compose exec app pnpm test src/components/transactions/TransactionRowDetails.test.tsx
git add src/components/transactions/TransactionRowDetails.tsx src/components/transactions/TransactionRowDetails.test.tsx
git commit -m "feat(transactions): TransactionRowDetails (gaveta de leitura de anexos)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `row-menu-items` enxuto (remove Nota + Gerenciar vínculos)

**Files:** Modify `row-menu-items.tsx`, `row-menu-items.test.tsx`.

**Interface produced:** `buildRowMenuItems(opts: { isReadOnly; onEdit; onDuplicate; onMove; onViewDetails; onCreateAlias; onDelete }): RowMenuItem[]` — sem `onOpenNote`/`onManageLinks`.

- [ ] **Step 1: atualizar `row-menu-items.test.tsx`** — remover `onOpenNote`/`onManageLinks` dos handlers; nova ordem editor = `["Editar","Duplicar","Mover para…","Ver detalhes","Criar apelido a partir desta transação","Deletar"]` (Deletar com `danger` + `dividerBefore`); viewer = `["Ver detalhes"]`. Run → FAIL.

- [ ] **Step 2: reescrever `row-menu-items.tsx`**
```tsx
import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import EditIcon from "@mui/icons-material/Edit";
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
  onCreateAlias: () => void;
  onDelete: () => void;
};

/** Itens do menu ⋮ (spec 62 v2 §2.4). Nota e Gerenciar vínculos migraram para a
 * gaveta de anexos. Viewer só vê Ver detalhes. Excluir por último (danger). */
export function buildRowMenuItems(opts: BuildOpts): RowMenuItem[] {
  const a = m.transactions.actions;

  if (opts.isReadOnly) {
    return [{ label: a.viewDetails, icon: <VisibilityOutlinedIcon sx={ICON_SX} />, onClick: opts.onViewDetails }];
  }

  return [
    { label: a.edit, icon: <EditIcon sx={ICON_SX} />, onClick: opts.onEdit },
    { label: a.duplicate, icon: <ContentCopyIcon sx={ICON_SX} />, onClick: opts.onDuplicate },
    { label: a.moveTo, icon: <DriveFileMoveOutlinedIcon sx={ICON_SX} />, onClick: opts.onMove },
    { label: a.viewDetails, icon: <VisibilityOutlinedIcon sx={ICON_SX} />, onClick: opts.onViewDetails },
    { label: a.createAlias, icon: <BookmarkAddOutlinedIcon sx={ICON_SX} />, onClick: opts.onCreateAlias },
    { label: a.delete, icon: <DeleteIcon sx={ICON_SX} />, onClick: opts.onDelete, danger: true, dividerBefore: true },
  ];
}
```
Run → PASS.

- [ ] **Step 3: commit**
```bash
git add src/components/transactions/row-menu-items.tsx src/components/transactions/row-menu-items.test.tsx
git commit -m "refactor(transactions): trim ⋮ menu (Nota/Gerenciar vínculos → gaveta)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `TransactionRowActions` — coluna VIEW `📎 ⏳ ☆ ⋮`

**Files:** Modify `TransactionRowActions.tsx`, `TransactionRowActions.test.tsx`.

**Interface produced (novo Props):** remove `onStartEditWithNote`, `onOpenLinkDialog`; adiciona `onToggleDrawer: () => void`.

- [ ] **Step 1: atualizar `TransactionRowActions.test.tsx`** — em `renderActions` spies: remover `onStartEditWithNote`, `onOpenLinkDialog`; adicionar `onToggleDrawer`. Remover os testes de marcadores passivos e do item "Nota". Novos/ajustados:
  - editor mostra pendente/favorito/⋮ (mantém);
  - quando `tx` tem anexos (ex.: `linkCount:2`), mostra botão "Ver anexos (2)" e clicar chama `onToggleDrawer`;
  - quando `tx` limpo (0 anexos), NÃO há botão "Ver anexos";
  - `⋮` chama `onOpenMenu` com itens `["Editar","Duplicar","Mover para…","Ver detalhes","Criar apelido a partir desta transação","Deletar"]`.
  Run → FAIL.

- [ ] **Step 2: reescrever `TransactionRowActions.tsx`**
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

import { m } from "@/lib/messages";

import { AttachmentIndicator } from "./AttachmentIndicator";
import { countAttachments } from "./attachments";
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
  onToggleDrawer: () => void;
  onOpenMenu: (e: React.MouseEvent<HTMLButtonElement>, items: RowMenuItem[]) => void;
};

const ICON_SX = { fontSize: 18 } as const;
const BTN_SX = { p: 1, minWidth: 32, minHeight: 32 } as const;
const GAP = 0.5;

export function TransactionRowActions({
  tx, isReadOnly, onStartEdit, onTogglePending, onToggleFavorite, onViewDetails,
  onDuplicate, onMove, onCreateAlias, onDelete, onToggleDrawer, onOpenMenu,
}: Props) {
  const pendingLabel = tx.isPending ? m.transactions.actions.markAsDone : m.transactions.actions.markAsPending;
  const favoriteLabel = tx.isFavorite ? m.transactions.actions.removeFromFavorites : m.transactions.actions.addToFavorites;
  const attachmentCount = countAttachments(tx);

  const items = buildRowMenuItems({
    isReadOnly,
    onEdit: onStartEdit,
    onDuplicate,
    onMove,
    onViewDetails,
    onCreateAlias,
    onDelete,
  });

  return (
    <TableCell
      align="right"
      sx={{ width: 160, minWidth: 160, whiteSpace: "nowrap", pr: 1 }}
      onClick={(e) => e.stopPropagation()}
    >
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: GAP }}>
        {attachmentCount > 0 && <AttachmentIndicator count={attachmentCount} onClick={onToggleDrawer} />}

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
                {tx.isPending ? <HourglassBottomIcon sx={ICON_SX} /> : <HourglassEmptyIcon sx={ICON_SX} />}
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
Run → PASS. (Typecheck do projeto vai falhar em `TransactionRow.tsx` até a Task 5 — esperado, não rodar isolado.)

- [ ] **Step 3: commit**
```bash
git add src/components/transactions/TransactionRowActions.tsx src/components/transactions/TransactionRowActions.test.tsx
git commit -m "refactor(transactions): action column = 📎 anexos + toggles + ⋮

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `TransactionRow` — estado da gaveta + sub-linha + wiring

**Files:** Modify `TransactionRow.tsx`.

- [ ] **Step 1: imports** — adicionar `import Collapse from "@mui/material/Collapse";` e `import { TransactionRowDetails } from "./TransactionRowDetails";`.

- [ ] **Step 2: estado** — junto aos `useState` (linha ~114): `const [drawerOpen, setDrawerOpen] = useState(false);`.

- [ ] **Step 3: remover `startEditWithNote` órfão** — a função (linha ~143) e o comentário acima só existiam para o item "Nota" do menu. Após atualizar o call-site (Step 5), remover a definição. Confirmar sem outros usos: `docker compose exec app grep -n "startEditWithNote" src/components/transactions/TransactionRow.tsx`.

- [ ] **Step 4: envolver o retorno de leitura num Fragment + sub-linha da gaveta** — localize `// Modo leitura\n  return (\n    <TableRow` (linha ~451) e o fechamento `</TableRow>\n  );` (linha ~819). Trocar para:
```tsx
  // Modo leitura
  return (
    <>
      <TableRow
        hover
        selected={isSelected}
        sx={{ /* ...inalterado... */ }}
      >
        {/* ...conteúdo atual da linha, incl. <TransactionRowActions .../> e os dialogs/aliasDialog... */}
      </TableRow>
      {drawerOpen && (
        <TableRow>
          <TableCell colSpan={99} sx={{ p: 0, border: 0 }}>
            <Collapse in={drawerOpen} unmountOnExit>
              <TransactionRowDetails
                tx={tx}
                isReadOnly={isReadOnly}
                onManageLinks={() => setLinkDialogOpen(true)}
                onViewInstallmentGroup={() => setInstallmentPanelOpen(true)}
              />
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
```
> Os dialogs (`InstallmentGroupPanel`, `LinkTransactionDialog`) e `{aliasDialog}` permanecem dentro do `<TableRow>` principal (portam via portal) — não precisam mover.

- [ ] **Step 5: atualizar o call-site de `<TransactionRowActions>`** (linha ~782) — remover `onStartEditWithNote={startEditWithNote}` e `onOpenLinkDialog={() => setLinkDialogOpen(true)}`; adicionar `onToggleDrawer={() => setDrawerOpen((o) => !o)}`. Demais props inalteradas.

- [ ] **Step 6: typecheck** — `docker compose exec app pnpm typecheck` → PASS (0 erros). Se acusar `Typography`/imports órfãos em `TransactionRow.tsx`, remover só os não usados.

- [ ] **Step 7: commit**
```bash
git add src/components/transactions/TransactionRow.tsx
git commit -m "feat(transactions): expandable read drawer wired to 📎 indicator

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `TransactionRowEditor` — coluna `✓ ✕` + gaveta de edição

**Files:** Modify `TransactionRowEditor.tsx`.

**Objetivo:** a célula de ações (`:554-640`) passa a conter só `✓ salvar` e `✕ cancelar` (`fontSize:18`). Os 5 botões expansores (nota/câmbio/vínculos/tags/criar-apelido) saem da célula. As seções colapsáveis já existentes (`Collapse` de notas `:646`, tags `:690`, câmbio `:724`, vínculos `:843`) passam a ser **sempre renderizadas na gaveta** (uma única sub-região abaixo da linha), cada seção com seu rótulo; a de "Criar apelido" vira um `Button variant="text"` no rodapé da gaveta.

- [ ] **Step 1: reduzir a célula de ações** — substituir o bloco `:554-640` por só os dois `IconButton` de salvar/cancelar com `fontSize:18`, `aria-label`, `sx={{ p: 1, minWidth: 32, minHeight: 32 }}`. Remover os expansores e seus `Tooltip`.

- [ ] **Step 2: abrir as seções da gaveta por padrão** — as seções deixam de depender dos toggles `notesOpen`/`foreignCurrencyOpen`/`linksOpen`/`tagsOpen` da célula (removidos). Trocar cada `Collapse in={xOpen}` para `in` sempre `true` **quando em edição** (a linha inteira já é o editor), OU manter os estados mas inicializá-los abertos e sem botão de toggle. Escolha simples: renderizar as seções diretamente (sem `Collapse`), agrupadas numa `<TableRow><TableCell colSpan={99}>` com `Stack` — nota, câmbio, vínculos, tags — reusando os editores internos que já existem em cada bloco `Collapse` atual (mover o conteúdo de dentro dos `Collapse` para dentro do `Stack`).

- [ ] **Step 3: criar apelido no rodapé** — abaixo das seções, `<Button variant="text" startIcon={<BookmarkAddOutlinedIcon sx={{ fontSize: 16 }} />} onClick={onCreateAlias}>{m.transactions.actions.createAlias}</Button>` (preserva spec 61 §2.5).

- [ ] **Step 4: limpar props/estados órfãos** — se `notesOpen`/`setNotesOpen`/`tagsOpen`/`setTagsOpen` (props vindas de `TransactionRow`) ficarem sem uso, remover das `Props` do editor e do call-site em `TransactionRow.tsx` (linha ~426-427). `docker compose exec app grep -n "notesOpen\|tagsOpen" src/components/transactions/TransactionRow*.tsx`.

- [ ] **Step 5: verificação** — `docker compose exec app pnpm typecheck && docker compose exec app pnpm test src/components/transactions`. Verificação manual (sem RTL do editor): abrir edição de uma transação, confirmar `✓ ✕` na coluna, seções na gaveta, criar-apelido visível, salvar/cancelar OK.

- [ ] **Step 6: commit**
```bash
git add src/components/transactions/TransactionRowEditor.tsx src/components/transactions/TransactionRow.tsx
git commit -m "refactor(transactions): editor = ✓✕ column + sections in drawer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `NewTransactionRow` — coluna `✓ ✕` + gaveta nota+câmbio

**Files:** Modify `NewTransactionRow.tsx`.

- [ ] **Step 1: reduzir a célula de ações** (`:573-624`) — só `✓ salvar` (`handleSave`, `disabled={saving}`) e `✕ cancelar` (`onCancel`), `fontSize:18`, `sx={{ p:1, minWidth:32, minHeight:32 }}`, `aria-label`. Remover os expansores de nota e câmbio da célula.
- [ ] **Step 2: seções na gaveta** — nota e câmbio renderizadas diretamente na sub-região (reusar os `Collapse` existentes convertidos em seções sempre visíveis, como na Task 6). Manter entrada rápida (foco na descrição após salvar) intacta.
- [ ] **Step 3: verificação** — `docker compose exec app pnpm typecheck && docker compose exec app pnpm test src/components/transactions/NewTransactionRow.test.tsx` → os 8 testes existentes DEVEM continuar verdes (testam comportamento de create, não layout dos botões; ajustar só se algum assert casar num tooltip/label removido).
- [ ] **Step 4: commit**
```bash
git add src/components/transactions/NewTransactionRow.tsx
git commit -m "refactor(transactions): create row = ✓✕ column + note/fx in drawer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Verificação final

**Files:** nenhum (gate).

- [ ] **Step 1:** `docker compose exec app pnpm lint && docker compose exec app pnpm typecheck && docker compose exec app pnpm test` → tudo verde, 0 erro de lint.
- [ ] **Step 2: escala de ícones** — `docker compose exec app grep -rn "fontSize: 14" src/components/transactions/*.tsx` → nenhuma ocorrência em código de linha (view/actions/details/editor/new-row). Exceção conhecida: `tag-hint-icon` do editor/`LabelOutlinedIcon` placeholder — se restar, subir para 16.
- [ ] **Step 3: props/strings órfãs** — `docker compose exec app grep -rn "onStartEditWithNote\|onOpenLinkDialog\|onOpenNote\|onManageLinks\|MARKER_ICON" src/components/transactions` → nenhuma. `actions.note` em `pt-BR.ts` removida se sem uso (`grep -rn "actions.note" src`).
- [ ] **Step 4: visual (humano)** — light E dark: `📎N` legível (contagem `text.secondary`); gaveta de leitura abre/fecha; edição/criação com `✓ ✕` + gaveta; sem hydration warning.
- [ ] **Step 5: commit final (se houve ajuste)**
```bash
git add -A && git commit -m "chore(transactions): lint/icon-scale pass for expandable row

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### 9.3 Self-Review (autor do plano)

**Cobertura §4:** ROW-10 (escala única) → Tasks 4/6/7 + gate Task 8 Step 2. ROW-11 (anexos fora de ação/descrição) → Tasks 2/4/5. ROW-12 (indicador + gatilho, clique-edita preservado) → Tasks 1/4/5. ROW-13 (gaveta leitura) → Tasks 2/5. `countAttachments` regra → Task 1. EDIT/CREATE `✓✕` + gaveta → Tasks 6/7. Menu ⋮ enxuto + viewer → Task 3. PERF/memo (callbacks estáveis já em `TransactionTable`; gaveta via `Collapse`) → Tasks 4/5. Light/dark → Task 8.

**Placeholders:** nenhum "TBD"; arquivos novos com código completo; big-files com passos+âncoras+snippets (mesma abordagem da v1).

**Consistência de tipos:** `countAttachments` assinatura igual em Tasks 1/4. `AttachmentIndicator` props `{count,onClick}` iguais em 1/4. `buildRowMenuItems` opts (sem `onOpenNote`/`onManageLinks`) iguais em 3/4. `TransactionRowActions` novo Props (`onToggleDrawer`, sem `onStartEditWithNote`/`onOpenLinkDialog`) casa com o call-site da Task 5. `TransactionRowDetails` props `{tx,isReadOnly,onManageLinks,onViewInstallmentGroup}` iguais em 2/5.

Revisores: `myaccountant-reviewer` (convenções) + `ui-critique` (visual/a11y, escala de ícones, gaveta em light/dark) sobre o diff final.

---

## 10. Histórico — v1 (coluna de ações, superseded)

A v1 desta spec entregou (commits `3192dd1`..`1383764`) e foi revisada, mas o feedback de uso motivou o pivô da §2. Resumo do que a v1 fez e o que sobrevive:

- **v1 (superseded na apresentação):** coluna de ações reduzida a `[pendente][favorito][⋮]`; nota/câmbio/vínculos como glyphs passivos (primeiro na descrição, depois na coluna de ações, `fontSize:14`); item "Nota" e "Gerenciar vínculos" no ⋮; largura 200→160; alvo 40→32px (D14). Decisões D1–D14 documentadas no histórico do git.
- **Reusado pela v2 (sobrevive):** `RowActionsMenu` (menu único, sem Fragment-as-child), `MoveTransactionsDialog` único elevado à `TransactionTable`, toggles pendente/favorito com `aria-label` dinâmico + opacidade de repouso, callbacks `useCallback`-estáveis preservando `memo`, `buildRowMenuItems` (agora enxuto), alvo ~32px (DD-14).
- **Descontinuado pela v2:** glyphs passivos de estado (na descrição e na coluna de ações), `MARKER_ICON_SX` `fontSize:14`, item "Nota"/"Gerenciar vínculos" no ⋮, `describeRowState` como resumo de glyphs na descrição (pode ser reaproveitado para `aria-label` do indicador/gaveta, ou removido se ocioso).
