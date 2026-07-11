# Spec 20 — Melhorias de UX nas Transações

> Status: implemented (UX-02 undo-delete via DeleteUndoProvider, UX-03 edição por clique na célula — entregue em conjunto com spec 41)
> Insumo: docs/v2-analysis.md §3 UX-02, UX-03, UX-08, UX-12
> Skills: [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md)

---

## 1. Problema

Quatro problemas de usabilidade identificados na interação com transações:

- **UX-02**: Deletar uma transação é imediato e irreversível. Um clique acidental no menu ⋮ → Deletar elimina dados financeiros permanentemente sem confirmação e sem possibilidade de desfazer. O snackbar atual exibe "Transação deletada" mas não oferece ação de recuperação.
- **UX-03**: Clicar em qualquer lugar da linha de transação abre o modo de edição. Em uso cotidiano com scroll ou trackpad, edições acidentais são frequentes e geram ruído.

---

## 2. Solução

- **UX-02**: Implementar "undo de delete" via snackbar com ação. A transação some da UI imediatamente (otimista), mas a deleção no servidor ocorre apenas após um timeout de 5 segundos. Se o usuário clicar "Desfazer" antes do timeout, todas as transações acumuladas no batch são re-inseridas nas posições originais sem nenhuma chamada ao servidor de exclusão.
- **UX-03**: Remover o single-click na linha como gatilho de edição. A edição passa a ser iniciada por: (a) clique no ícone de lápis na coluna de ações, ou (b) clique direto em qualquer célula de valor da linha. Além disso, redesenhar a coluna de ações do modo de edição para ficar consistente com o modo de visualização, e melhorar o visual do menu ⋮.

---

## 3. User Stories

- Como usuário, quero poder desfazer a deleção de uma transação nos primeiros segundos após deletar, para me recuperar de cliques acidentais.
- Como usuário, quero que a edição de uma transação seja iniciada por uma ação explícita (ícone de lápis ou clique direto no campo), para não editar por acidente ao navegar pela lista.

---

## 4. Critérios de Aceitação

### UX-02 — Undo de delete

- QUANDO o usuário clica em "Deletar" no menu ⋮, A TRANSAÇÃO DEVE desaparecer imediatamente da lista (otimista) e um snackbar DEVE aparecer com o texto "1 transação deletada" e um botão "Desfazer".
- SE o usuário deletar mais transações enquanto o snackbar ainda está visível, O SNACKBAR DEVE acumular as deleções e atualizar o texto para "N transações deletadas". O timer de 5 segundos DEVE reiniciar a cada nova deleção.
- ENQUANTO o snackbar está visível, SE o usuário clicar "Desfazer", TODAS as transações acumuladas no batch DEVEM reaparecer em suas posições originais sem que nenhuma deleção tenha sido efetuada no servidor.
- QUANDO o snackbar fechar sem "Desfazer" ser clicado, O SISTEMA DEVE efetuar a deleção real de todas as transações acumuladas no servidor.
- SE o usuário navegar para outra página enquanto o snackbar ainda está visível, O SISTEMA DEVE efetuar a deleção no servidor imediatamente (via cleanup do `useEffect` ao desmontar o componente).
- SE a deleção no servidor falhar (após o timeout ou ao navegar), O SISTEMA DEVE exibir um snackbar de erro e as transações afetadas DEVEM reaparecer na lista (reversão otimista).

### UX-03 — Edição explícita

- QUANDO o usuário faz single-click em uma linha de transação (fora de campos interativos), NENHUM modo de edição DEVE ser ativado.
- QUANDO o usuário clica no ícone de lápis (EditIcon) na coluna de ações, O MODO DE EDIÇÃO DEVE ser ativado e o foco vai para o primeiro campo (data).
- QUANDO o usuário clica diretamente em qualquer célula de valor da linha (data, descrição, categoria, subcategoria, instituição, valor, responsável, tipo de investimento), O MODO DE EDIÇÃO DEVE ser ativado com foco no campo correspondente àquela célula.
- O checkbox de seleção DEVE continuar respondendo a single-click normalmente.
- O menu ⋮ DEVE conter apenas "Duplicar" e "Deletar" (a opção "Editar" foi removida por ser redundante com os novos gatilhos).
- A coluna de ações do modo de edição DEVE usar os mesmos tamanhos e estilos de ícone da coluna de ações do modo de visualização. O botão de salvar DEVE usar `CheckIcon` (não o caractere ✓). O botão de cancelar DEVE usar `CloseIcon`.
- O menu ⋮ DEVE ser redesenhado para ficar visualmente consistente com o design system do projeto (tamanho e espaçamento adequados).

### UX-03 — Posição do ícone de lápis na coluna de ações (view mode)

A ordem dos ícones na coluna de ações em view mode passa a ser:

`Nota | Pendente | Favorito | Editar (lápis) | ⋮`

---

## 5. Fora de Escopo

- Confirmação via dialog/modal para o delete (substituída pelo undo de snackbar).
- Alteração no comportamento de seleção por checkbox (permanece com single-click).
- Edição de múltiplas notas em bulk.
- Double-click como gatilho de edição (substituído por clique no lápis ou clique no campo).

---

## 6. Referências Técnicas

| Item | Arquivo(s) a tocar |
|------|-------------------|
| UX-02, UX-03 | `src/components/transactions/TransactionRow.tsx` |
| UX-02 (acumular batch + cancelar deleção) | `src/components/transactions/TransactionTable.tsx` |
| Timeout de deleção | `useRef` para o `setTimeout` + `clearTimeout`; batch de IDs pendentes em `useRef`; cleanup em `useEffect` retorna função que dispara delete imediato |
| UX-03 (clique no campo → foco) | Cada `TableCell` em view mode recebe `onClick` que chama `startEdit(fieldName)` |

- `notistack` já está integrado — usar `enqueueSnackbar` com a prop `action` para o botão "Desfazer". Usar `closeSnackbar` para fechar programaticamente ao clicar "Desfazer".
- O `countType` da seção já está disponível no objeto `section` em `SectionView`. A prop `sectionCountType` já existe em `TransactionRow`.
- O batch de IDs pendentes de deleção deve viver em `TransactionTable` (não em `TransactionRow`) para suportar acumulação entre linhas. `TransactionRow` recebe um callback `onDeleteRequested(id)` e não chama o servidor diretamente.
- Ícones: `EditIcon` (lápis), `CheckIcon` (salvar), `CloseIcon` (cancelar) — todos de `@mui/icons-material`.
