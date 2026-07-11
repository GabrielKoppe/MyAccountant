# Spec 27 — Painel de Detalhes da Transação

> Status: implemented (TransactionDetailDialog integrado em TransactionTable — 2026-07-11)
> Insumo: docs/v2-analysis.md §5 SEC-03 (reinterpretado conforme feedback do usuário) · entrevista de refinamento 2026-06-09
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md)

---

## 1. Problema

- **FEAT-01**: O sistema registra `createdById`, `createdAt`, `updatedById` e `updatedAt` em cada transação (confirmado em `prisma/schema.prisma` no model `Transaction`), mas essas informações nunca são exibidas para o usuário. Em um contexto colaborativo (casal, família), saber "quem adicionou essa transação" ou "quando foi a última alteração" é uma informação útil para transparência e rastreabilidade.
- **FEAT-02**: Campos como `notes`, `cardInstallment`, `investmentType` e `institutionText` — que existem no schema e podem estar preenchidos — não têm um lugar consolidado onde o usuário possa visualizá-los sem entrar em modo de edição.
- **FEAT-03**: O menu ⋮ de cada transação (em `src/components/transactions/TransactionRow.tsx:625`) só é renderizado para owner/editor (`!isReadOnly`). Viewers, que mais se beneficiam de transparência (só consultam), hoje não têm nenhum ponto de entrada para informações da transação.

O usuário optou por não implementar um log de auditoria completo (muito pesado para o público-alvo) e sim por uma visão expandida e informativa da transação.

---

## 2. Solução

Adicionar uma opção **"Ver detalhes"** no menu ⋮ de cada transação. Ao clicar, um dialog (via `DialogShell`) abre com uma visão completa e organizada da transação, **somente leitura**:

- **FEAT-01**: Seção "Histórico" com criado por (avatar + nome), criado em, e — quando houver alteração registrada — última alteração por (avatar + nome) e alterado em. Timestamps no timezone do usuário.
- **FEAT-02**: Todos os campos **preenchidos** da transação (Data, Descrição, Valor, Categoria, Subcategoria, Instituição, Responsável, Notas, Parcela do cartão, Tipo de investimento), respeitando a configuração `hiddenColumns` da tabela.
- **FEAT-03**: O menu ⋮ passa a ser renderizado para **todos os papéis**. Para viewer contém apenas "Ver detalhes"; para owner/editor contém "Ver detalhes" + "Duplicar" + "Deletar". O painel é só leitura; a ação "Editar" só aparece para owner/editor.

---

## 3. User Stories

- Como usuário, quero ver todos os detalhes de uma transação em um lugar organizado, sem precisar entrar em modo de edição.
- Como membro de uma account colaborativa, quero saber quem criou ou editou uma transação e quando, para ter transparência sobre os dados.
- Como viewer (papel só leitura), quero conseguir abrir os detalhes de uma transação, para acompanhar quem lançou o quê mesmo sem permissão de edição.
- Como owner/editor, quero acessar o modo de edição a partir do painel de detalhes, como uma ação natural de continuidade.

---

## 4. Critérios de Aceitação

**FEAT-03 — Ponto de entrada e permissões:**

- O menu ⋮ de uma transação DEVE ser renderizado para todos os papéis (owner, editor, viewer).
- QUANDO o usuário (qualquer papel) abre o menu ⋮, A OPÇÃO "Ver detalhes" DEVE existir no topo do menu.
- PARA papel viewer, o menu ⋮ DEVE conter **apenas** "Ver detalhes".
- PARA papéis owner/editor, o menu ⋮ DEVE conter "Ver detalhes", "Duplicar" e "Deletar".

**FEAT-02 — Painel e campos:**

- QUANDO "Ver detalhes" é clicado, UM DIALOG (via `DialogShell`) DEVE abrir centralizado, sem recarregar a página e sem chamada adicional ao servidor.
- O dialog DEVE sempre exibir Data, Valor formatado e Descrição (Descrição vazia exibe "—").
- O dialog DEVE exibir os campos opcionais — Categoria, Subcategoria, Instituição, Responsável (avatar + nome), Notas, Parcela do cartão, Tipo de investimento — **apenas quando preenchidos**.
- Um campo opcional vazio NÃO DEVE aparecer (nem o label).
- SE o respectivo `hiddenColumns[key]` for `true`, O CAMPO NÃO DEVE ser exibido, mesmo que esteja preenchido (chaves: `category`, `subcategory`, `institution`, `responsibleUser`, `isPending`, `notes`, `cardInstallment`, `investmentType`).
- SE `institutionId` for nulo mas `institutionText` estiver preenchido, O CAMPO Instituição DEVE exibir `institutionText`.

**FEAT-01 — Histórico:**

- O dialog DEVE exibir, em seção separada "Histórico": Criado por (avatar + nome) e Criado em (data/hora).
- SE `updatedById` não for nulo, O DIALOG DEVE exibir Última alteração por (avatar + nome) e Alterado em (data/hora).
- SE `updatedById` for nulo, A LINHA DE ÚLTIMA ALTERAÇÃO NÃO DEVE ser exibida.
- Os timestamps "Criado em" e "Alterado em" DEVEM ser formatados no timezone do usuário (`UserSettings.timezone`), no formato `dd/MM/yyyy HH:mm`.
- SE o `createdById`/`updatedById` não estiver presente no array de membros atuais (ex-membro que saiu da account), O AVATAR DEVE usar um fallback genérico e O NOME DEVE exibir a mensagem "Usuário removido" (centralizada em `messages`).

**Edição e fechamento:**

- O dialog DEVE ter um botão "Editar" **apenas para owner/editor**; para viewer o botão NÃO DEVE aparecer.
- QUANDO "Editar" é clicado, O DIALOG DEVE fechar e a transação correspondente DEVE entrar em modo de edição inline na tabela.
- O dialog DEVE ser fechável clicando fora dele, no ícone X, ou pressionando Esc.
- Em mobile, o dialog DEVE ocupar a tela inteira (comportamento padrão `fullScreenOnMobile` do `DialogShell`).

---

## 5. Fora de Escopo

- Histórico de todas as versões anteriores da transação (log completo de alterações) — intencionalmente fora de escopo para manter o banco enxuto.
- Edição de campos diretamente no dialog (o dialog é somente leitura; edição ocorre no inline da tabela).
- Distinguir "edição de dado financeiro" de "toggle" (favoritar/marcar pendente) no Histórico — ver Decisão DD-06: qualquer alteração conta como "última alteração". Diferenciar exigiria mudança de backend e fica fora de escopo.
- Comentários no dialog (tratado em spec separada, spec 30).
- Anexos no dialog (tratado em spec separada, spec 30).

---

## 6. Decisões de Design

| # | Decisão | Escolha | Motivo |
|---|---------|---------|--------|
| DD-01 | Acesso ao painel | Todos os papéis; viewer só leitura (sem botão "Editar") | Transparência colaborativa é a motivação central (§1); viewers são os que mais se beneficiam de saber quem lançou |
| DD-02 | Ponto de entrada | Menu ⋮ sempre visível (hoje é só para não-viewers) | Reaproveita o componente existente; ponto de entrada único e consistente |
| DD-03 | Colunas ocultas | Respeitar `hiddenColumns` (ocultar no painel os mesmos campos ocultos na tabela) | Mantém consistência com a organização escolhida pela conta |
| DD-04 | Nomes de criador/atualizador | Resolver via array `members` já carregado; fallback "Usuário removido" para ex-membros | Evita query adicional por transação; trata o caso de ex-membro sem quebrar o layout |
| DD-05 | Formato dos timestamps | Timezone do usuário (`UserSettings.timezone`) + `dd/MM/yyyy HH:mm` (`formatInTimeZone`) | Consistência entre dispositivos (skill `date-timezone`); formato absoluto serve melhor à rastreabilidade do que relativo |
| DD-06 | Significado de "Última alteração" | Qualquer update conta (inclusive favoritar/marcar pendente) | Sem mudança de backend; `updatedById` já é setado em todo update. Histórico significa "último toque na transação" |
| DD-07 | Campos vazios | Ocultar label + valor; só Data/Valor/Descrição sempre presentes | Painel enxuto; alinhado ao "quando preenchidos" |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|------|--------------------|
| FEAT-03 — ⋮ sempre visível + item "Ver detalhes" | `src/components/transactions/TransactionRow.tsx` |
| Novo componente do painel | `src/components/transactions/TransactionDetailDialog.tsx` |
| Estado de qual transação está aberta + gatilho de edição inline | `src/components/transactions/TransactionTable.tsx` |
| Campos extras na query + timezone do usuário | `src/app/(app)/[accountId]/months/[monthId]/page.tsx` |
| Tipo da linha (campos de auditoria) | `src/components/transactions/types.ts` |
| Mensagens ("Ver detalhes", "Histórico", "Usuário removido", labels) | `src/lib/messages/pt-BR.ts` |

### 7.1 FEAT-03 — Menu ⋮ para todos os papéis

Hoje, em `TransactionRow.tsx:625`, todo o bloco de ações de edição (incluindo o ⋮) está dentro de `{!isReadOnly && (...)}`. Extrair o menu ⋮ para fora desse guard e condicionar **os itens**, não o menu:

```tsx
// ✅ Correto — menu sempre renderizado, itens condicionais ao papel
<Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
  <MenuItem onClick={handleViewDetails}>
    <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
    {m.transactions.actions.viewDetails}
  </MenuItem>
  {!isReadOnly && [
    <MenuItem key="dup" onClick={handleDuplicate}>…Duplicar…</MenuItem>,
    <MenuItem key="del" onClick={handleDelete} sx={{ color: "error.main" }}>…Deletar…</MenuItem>,
  ]}
</Menu>

// ❌ Anti-padrão — manter o ⋮ inteiro dentro de {!isReadOnly && ...} (viewer nunca acessa o painel)
```

### 7.2 Dados adicionais necessários na query da página do mês

A query atual em `page.tsx:99` seleciona apenas `createdById`. Adicionar os campos de auditoria e carregar o timezone do usuário:

```ts
// prisma.transaction.findMany select — adicionar:
select: {
  // campos existentes...
  createdById: true,
  createdAt: true,   // novo
  updatedById: true, // novo
  updatedAt: true,   // novo
}

// Timezone do usuário (1 query, passado como prop até o dialog):
const userSettings = await prisma.userSettings.findUnique({
  where: { userId: session.user.id },
  select: { timezone: true },
});
const timezone = userSettings?.timezone ?? "America/Sao_Paulo";
```

- Os nomes de `createdBy` e `updatedBy` são resolvidos pelo array `members` já carregado na página, usando `createdById`/`updatedById` como chave de lookup — **sem query adicional**. Quando o id não estiver em `members` (ex-membro), usar o fallback "Usuário removido" (DD-04).
- `createdAt`/`updatedAt` são `DateTime` (timestamp UTC) e devem ser serializados como ISO string para o client, formatados no dialog com `formatInTimeZone(date, timezone, "dd/MM/yyyy HH:mm", { locale: ptBR })`.
- `updatedById` é nullable: nulo significa "nunca editado explicitamente" → não exibir a linha de última alteração (DD-06).

### 7.3 Tipo da linha (`types.ts`)

Adicionar ao `TransactionRow`:

```ts
export type TransactionRow = {
  // ... existentes
  createdById: string;
  createdAt: string;        // ISO string
  updatedById: string | null;
  updatedAt: string;        // ISO string
};
```

### 7.4 Gatilho de edição inline a partir do dialog

O estado `editing` vive em cada `TransactionRow` (local). Para o botão "Editar" do dialog (que vive no nível da `TransactionTable`) acionar a edição inline da linha correta, levantar um estado de "pedido de edição" na `TransactionTable`:

```tsx
// TransactionTable: controla o dialog e o pedido de edição
const [detailTxId, setDetailTxId] = useState<string | null>(null);
const [editRequestId, setEditRequestId] = useState<string | null>(null);

// onEdit do dialog:
function handleEditFromDetail(txId: string) {
  setDetailTxId(null);        // fecha o dialog
  setEditRequestId(txId);     // sinaliza a linha
}

// Cada TransactionRow recebe:
<TransactionRow
  autoEdit={editRequestId === tx.id}
  onAutoEditConsumed={() => setEditRequestId(null)}
  …
/>
```

Na `TransactionRow`, um `useEffect` que chama `startEdit()` quando `autoEdit` vira `true` e então chama `onAutoEditConsumed()`.

### 7.5 Componente `TransactionDetailDialog`

- Client Component, recebe a transação (já serializada), `members`, `hiddenColumns`, `timezone`, `canEdit` (owner/editor) e callbacks `onClose`/`onEdit` como props. Sem chamada ao servidor para abrir.
- Usar `<DialogShell>` de `@/components/ui/DialogShell` (nunca `<Dialog>` cru). `maxWidth="sm"`; `fullScreenOnMobile` já é `true` por padrão.
- Valores monetários via `<MoneyValue>` (ou `formatCentsToBrl`); avatares via `<Avatar>` (iniciais como fallback).
- Botão "Editar" nas `actions` do `DialogShell`, renderizado apenas se `canEdit`.
- Campos: renderizar apenas os preenchidos e não ocultos por `hiddenColumns` (DD-03, DD-07). Seção "Histórico" separada por `<Divider>`.
