# Spec 28 — Mobile Responsivo e PWA

> Status: draft
> Insumo: docs/v2-analysis.md §3 UX-09, §6 F-10 (confirmado pelo usuário: focar em PWA)
> Skills: [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md)

---

## 1. Problema

O app é completamente inutilizável em telas mobile (< 768px):

- A `TransactionTable` usa `<Table>` MUI com múltiplas colunas que não cabem na tela. O usuário precisa scrollar horizontalmente para ver o valor — o campo mais importante.
- O modo de edição inline num mobile vira um formulário extremamente espremido.
- O AppBar com ícones pequenos é difícil de tocar com precisão.
- Não há suporte a PWA: sem ícone de app, sem instalação na tela inicial, sem cache offline.

Para um app de gestão financeira do dia a dia, onde o usuário frequentemente lança uma transação imediatamente após um gasto, a ausência de uma experiência mobile decente é um bloqueador crítico de uso cotidiano.

---

## 2. Solução

**Fase 1 — Layout responsivo**: Criar layouts alternativos ativados por breakpoint para as telas principais. Em mobile, a tabela de transações vira uma lista de cards, a edição vira um bottom sheet/dialog, e a navegação usa padrões touch-friendly.

**Fase 2 — PWA**: Adicionar `manifest.json`, ícones e Service Worker para permitir instalação na tela inicial e cache de assets estáticos.

---

## 3. User Stories

- Como usuário de smartphone, quero visualizar minhas transações do mês em uma lista clara e legível, sem precisar scrollar horizontalmente.
- Como usuário de smartphone, quero adicionar e editar transações em um formulário adequado para toque, não em uma linha de tabela espremida.
- Como usuário de smartphone, quero instalar o MyAccountant na tela inicial do meu celular como se fosse um app, para acessar rapidamente.
- Como usuário em conexão instável, quero que a interface básica do app carregue mesmo offline (pelo menos a shell).

---

## 4. Critérios de Aceitação

**Layout mobile (< 768px) — Transações:**
- QUANDO o viewport é < 768px, A TABELA DE TRANSAÇÕES DEVE ser substituída por uma lista de cards verticais.
- CADA CARD DEVE exibir: data, descrição, valor (destaque), categoria e status (pendente/favorita).
- QUANDO o usuário toca em um card, UM BOTTOM SHEET (MUI `Drawer` anchor="bottom") DEVE abrir com o formulário de edição completo.
- O bottom sheet DEVE ter campos com tamanho de toque adequado (min 44px de altura).

**Layout mobile — Navegação:**
- O AppBar em mobile DEVE ter apenas o nome da account e o menu do usuário.
- AS AÇÕES SECUNDÁRIAS (Dashboards, Membros, Configurações) DEVEM estar em um menu hambúrguer ou bottom navigation bar.
- O seletor de mês DEVE ser facilmente tocável.

**PWA:**
- O app DEVE ter um `manifest.json` válido com: nome, descrição, ícones (512x512, 192x192), `display: "standalone"`, `theme_color`, `background_color`.
- O app DEVE ter ícones em todos os tamanhos necessários para iOS e Android.
- UM SERVICE WORKER DEVE fazer cache dos assets estáticos (`_next/static/*`) para que a shell do app carregue offline.
- O app DEVE ser instalável ("Adicionar à tela inicial") em dispositivos iOS e Android.
- QUANDO o usuário está offline, O SISTEMA DEVE exibir uma tela de "Sem conexão" clara, sem mensagem de erro genérica do browser.

---

## 5. Fora de Escopo

- Sincronização de dados offline (os dados financeiros requerem conexão para leitura e escrita — apenas a shell/UI é cacheada).
- Notificações push nativas (parte da spec 29 se implementada como PWA notification).
- React Native ou app nativo — mantém-se web.
- Gestos de swipe para deletar transações (pode ser adicionado em iteração futura).
- Adaptação do dashboard/gráficos para mobile (prioridade mais baixa — focar na tela de mês primeiro).

---

## 6. Referências Técnicas

**Arquivos a tocar:**
| Área | Arquivo(s) |
|------|-----------|
| Manifest PWA | `public/manifest.json` (novo) |
| Ícones | `public/icons/` (novos) |
| Service Worker | `public/sw.js` ou via `next-pwa` |
| Meta tags PWA | `src/app/layout.tsx` |
| TransactionTable mobile | `src/components/transactions/TransactionTable.tsx` + novo `TransactionCardList.tsx` |
| Formulário mobile | Novo `TransactionMobileForm.tsx` (bottom sheet) |
| AppBar mobile | `src/app/(app)/[accountId]/layout.tsx` |

**Bibliotecas:**
- `next-pwa` para simplificar a geração de Service Worker com Next.js (alternativa: configuração manual via `public/sw.js`).
- MUI `useMediaQuery` com breakpoint `theme.breakpoints.down("sm")` para condicionar layouts.
- MUI `SwipeableDrawer` para o bottom sheet de edição mobile.

**Breakpoints:**
- Mobile: `< 768px` (sm)
- Desktop: `≥ 768px`

**Geração de ícones:**
- Ferramentas: `pwa-asset-generator` ou similar
- Tamanhos necessários: 72, 96, 128, 144, 152, 192, 384, 512
