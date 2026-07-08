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

> Plano TDD detalhado (bite-sized) gerado via skill `writing-plans` e colado aqui após aprovação do design. Esboço de fases:

| Fase | Conteúdo | Modelo |
|---|---|---|
| 1 | `attachments.ts` `countAttachments` + testes; `AttachmentIndicator` (📎 + contagem, clicável) + testes | Haiku/Sonnet |
| 2 | `TransactionRowDetails` (gaveta de leitura read-only, seções presentes, callbacks) + testes | Sonnet |
| 3 | `TransactionRowActions`: remover marcadores passivos; coluna VIEW = `📎 ⏳ ☆ ⋮`; wiring `onToggleDrawer` | Sonnet |
| 4 | `TransactionRow`: estado `drawerOpen`; render da gaveta (Collapse); contagem; remover código morto (glyphs, `startEditWithNote` se órfão) | Sonnet |
| 5 | `row-menu-items` enxuto (remover Nota + Gerenciar vínculos) + testes; strings `pt-BR` | Haiku |
| 6 | `TransactionRowEditor`: coluna = `✓ ✕`; seções → gaveta de edição; criar apelido no rodapé | Sonnet |
| 7 | `NewTransactionRow`: coluna = `✓ ✕`; gaveta nota+câmbio; preservar entrada rápida | Sonnet |
| 8 | Verificação: lint/typecheck/test; escala de ícones (grep `fontSize: 14`); light/dark; densidade | Sonnet |

Revisores: `myaccountant-reviewer` (convenções) + `ui-critique` (visual/a11y, escala de ícones, gaveta em light/dark) sobre o diff final.

---

## 10. Histórico — v1 (coluna de ações, superseded)

A v1 desta spec entregou (commits `3192dd1`..`1383764`) e foi revisada, mas o feedback de uso motivou o pivô da §2. Resumo do que a v1 fez e o que sobrevive:

- **v1 (superseded na apresentação):** coluna de ações reduzida a `[pendente][favorito][⋮]`; nota/câmbio/vínculos como glyphs passivos (primeiro na descrição, depois na coluna de ações, `fontSize:14`); item "Nota" e "Gerenciar vínculos" no ⋮; largura 200→160; alvo 40→32px (D14). Decisões D1–D14 documentadas no histórico do git.
- **Reusado pela v2 (sobrevive):** `RowActionsMenu` (menu único, sem Fragment-as-child), `MoveTransactionsDialog` único elevado à `TransactionTable`, toggles pendente/favorito com `aria-label` dinâmico + opacidade de repouso, callbacks `useCallback`-estáveis preservando `memo`, `buildRowMenuItems` (agora enxuto), alvo ~32px (DD-14).
- **Descontinuado pela v2:** glyphs passivos de estado (na descrição e na coluna de ações), `MARKER_ICON_SX` `fontSize:14`, item "Nota"/"Gerenciar vínculos" no ⋮, `describeRowState` como resumo de glyphs na descrição (pode ser reaproveitado para `aria-label` do indicador/gaveta, ou removido se ocioso).
