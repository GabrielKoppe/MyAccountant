# Spec 20 — Melhorias de UX nas Transações

> Status: draft
> Insumo: docs/v2-analysis.md §3 UX-02, UX-03, UX-08, UX-12
> Skills: [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md)

---

## 1. Problema

Quatro problemas de usabilidade identificados na interação com transações:

- **UX-02**: Deletar uma transação é imediato e irreversível. Um clique acidental no menu ⋮ → Deletar elimina dados financeiros permanentemente sem confirmação e sem possibilidade de desfazer. O snackbar atual exibe "Transação deletada" mas não oferece ação de recuperação.
- **UX-03**: Clicar em qualquer lugar da linha de transação abre o modo de edição. Em uso cotidiano com scroll ou trackpad, edições acidentais são frequentes e geram ruído.
- **UX-08**: O campo `notes` aparece apenas no formulário de edição inline. No modo de leitura, não há nenhum indicador de que uma nota existe. O usuário que escreve uma nota perde o contexto ao sair da edição e não consegue rever o conteúdo sem clicar para editar.
- **UX-12**: A cor do valor da transação é definida pelo sinal do número (verde se positivo, vermelho se negativo). Mas em seções do tipo `subtract` (gastos), um valor positivo representa uma despesa e deveria ser exibido em vermelho. A cor atualmente engana mais do que informa.

---

## 2. Solução

- **UX-02**: Implementar "undo de delete" via snackbar com ação. A transação some da UI imediatamente (otimista), mas a deleção no servidor ocorre apenas após um timeout de 5 segundos. Se o usuário clicar "Desfazer" antes do timeout, a transação é re-inserida na posição original sem nenhuma chamada ao servidor de exclusão.
- **UX-03**: Alterar o gatilho de edição de single-click na linha para um botão explícito no menu ⋮ (opção "Editar") ou double-click. Single-click mantém o comportamento de seleção para bulk actions.
- **UX-08**: Exibir um ícone de nota (MUI `NoteOutlined`) na coluna de ações quando `tx.notes` não for vazio, com tooltip que mostra o conteúdo completo da nota. No modo de edição, o campo `notes` deve estar visível por padrão como linha dedicada (não colapsado).
- **UX-12**: Passar `sectionCountType` como prop para `TransactionRow`. A cor do valor deve refletir o tipo econômico da transação: verde para seções `add` (renda), vermelho para seções `subtract` (gasto), cor neutra (text.primary) para `neutral` e `ignore`.

---

## 3. User Stories

- Como usuário, quero poder desfazer a deleção de uma transação nos primeiros segundos após deletar, para me recuperar de cliques acidentais.
- Como usuário, quero que a edição de uma transação seja iniciada por uma ação explícita (botão ou double-click), para não editar por acidente ao navegar pela lista.
- Como usuário, quero ver um indicador visual quando uma transação tem uma nota, e conseguir ler essa nota sem entrar em modo de edição.
- Como usuário, quero que a cor do valor de uma transação reflita se ela é uma receita ou uma despesa, independentemente do sinal matemático do número.

---

## 4. Critérios de Aceitação

**UX-02 — Undo de delete:**
- QUANDO o usuário clica em "Deletar" no menu ⋮, A TRANSAÇÃO DEVE desaparecer imediatamente da lista (otimista) e um snackbar DEVE aparecer com o texto "Transação deletada" e um botão "Desfazer".
- ENQUANTO o snackbar está visível (5 segundos), SE o usuário clicar "Desfazer", A TRANSAÇÃO DEVE reaparecer na posição original sem ter sido deletada no servidor.
- QUANDO o snackbar fechar sem "Desfazer" ser clicado, O SISTEMA DEVE efetuar a deleção real no servidor.

**UX-03 — Edição explícita:**
- QUANDO o usuário faz single-click em uma linha de transação, NENHUM modo de edição DEVE ser ativado.
- QUANDO o usuário faz double-click em uma linha de transação, O MODO DE EDIÇÃO DEVE ser ativado para aquela linha.
- QUANDO o usuário abre o menu ⋮ e clica em "Editar", O MODO DE EDIÇÃO DEVE ser ativado para aquela linha.
- O checkbox de seleção DEVE continuar respondendo a single-click normalmente.

**UX-08 — Notas visíveis:**
- QUANDO uma transação possui `notes` preenchido, O SISTEMA DEVE exibir o ícone de nota na coluna de ações em modo de leitura.
- QUANDO o usuário passa o mouse sobre o ícone de nota, O TOOLTIP DEVE exibir o conteúdo completo da nota.
- QUANDO o modo de edição está ativo, O CAMPO DE NOTAS DEVE estar visível e editável sem precisar de ação adicional.
- SE a nota não está preenchida, O ÍCONE NÃO DEVE aparecer.

**UX-12 — Cor semântica do valor:**
- QUANDO uma transação pertence a uma seção do tipo `add`, O VALOR DEVE ser exibido na cor `success.main` (verde).
- QUANDO uma transação pertence a uma seção do tipo `subtract`, O VALOR DEVE ser exibido na cor `error.main` (vermelho), independentemente do sinal matemático.
- QUANDO uma transação pertence a uma seção do tipo `neutral` ou `ignore`, O VALOR DEVE ser exibido na cor `text.primary` (neutra).

---

## 5. Fora de Escopo

- Editor de notas rico (markdown, formatação) — a nota permanece texto simples.
- Confirmação via dialog/modal para o delete (substituída pelo undo de snackbar).
- Alteração no comportamento de seleção por checkbox (permanece com single-click).
- Edição de múltiplas notas em bulk.

---

## 6. Referências Técnicas

| Item | Arquivo(s) a tocar |
|------|-------------------|
| UX-02, UX-03, UX-08, UX-12 | `src/components/transactions/TransactionRow.tsx` |
| UX-02 (cancelar deleção) | `src/components/transactions/TransactionTable.tsx` |
| Timeout de deleção | Usar `setTimeout` + `clearTimeout`; deleção no servidor após 5s |
| Prop `sectionCountType` | Adicionar em `TransactionRow` Props; passar de `SectionView` → `FinanceTableCard` → `TransactionTable` → `TransactionRow` |

- `notistack` já está integrado — usar `enqueueSnackbar` com a prop `action` para o botão Desfazer.
- O `countType` da seção já está disponível no objeto `section` em `SectionView`.
