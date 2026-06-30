# Spec 28 — Mobile Responsivo e PWA

> Status: draft
> Insumo: docs/v2-analysis.md §3 UX-09, §6 F-10 (confirmado pelo usuário: focar em PWA) · revisão para o V3 (docs/v3-strategy.md, 2026-06-30) — novas telas (net worth, metas, previsão, assinaturas, dívidas, divisão/acerto, fatura), chat de IA ([spec 55](55-assistente-ia-conversacional.md)) e conexão Open Finance ([spec 52](52-agregacao-open-finance-pluggy.md)) mudam o escopo mobile
> Skills: [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`dashboards-charts`](../skills/dashboards-charts/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md)

---

> **Nota de revisão (V3):** A spec original cobre a tela de Mês (lista de cards + bottom sheet) e a base de PWA, deixando dashboards/gráficos e push de fora. O V3 acrescenta um conjunto grande de telas novas e dois fluxos que são **nativamente mobile**: o **chat do assistente de IA** (lançar/consultar logo após um gasto — exatamente o caso de uso que motivou esta spec) e a **conexão bancária via Pluggy Connect** (widget mobile-first). Para não reacumular a dívida de "tela nascida só para desktop", esta revisão adota um princípio e adiciona a **Fase 3**.

> **Princípio (vale para todo o V3):** toda tela nova introduzida pelas specs 42–58 **nasce responsiva** — o critério de pronto de cada uma inclui funcionar em `< 768px`. Esta spec é o lar dos padrões mobile (cards, bottom sheet, bottom nav) que essas telas reusam.

---

## 1. Problema

O app é completamente inutilizável em telas mobile (< 768px):

- A `TransactionTable` usa `<Table>` MUI com múltiplas colunas que não cabem na tela. O usuário precisa scrollar horizontalmente para ver o valor — o campo mais importante.
- O modo de edição inline num mobile vira um formulário extremamente espremido.
- O AppBar com ícones pequenos é difícil de tocar com precisão.
- Não há suporte a PWA: sem ícone de app, sem instalação na tela inicial, sem cache offline.

Para um app de gestão financeira do dia a dia, onde o usuário frequentemente lança uma transação imediatamente após um gasto, a ausência de uma experiência mobile decente é um bloqueador crítico de uso cotidiano.

### 1.1 Lacunas adicionais no contexto V3

- **MOB-V3-01** — As novas telas do V3 (patrimônio/[46](46-patrimonio-liquido.md), metas/[47](47-metas-poupanca.md), previsão/[48](48-previsao-fluxo-caixa.md), assinaturas/[49](49-rastreamento-assinaturas.md), dívidas/[51](51-gestao-dividas.md), divisão e acerto de contas/[42](42-divisao-despesas-membros.md), fatura/[53](53-ciclo-fatura-cartao.md)) tendem a ser projetadas para desktop e herdar o mesmo problema do V1 se não houver padrão mobile pré-definido.
- **MOB-V3-02** — O **chat do assistente de IA** ([spec 55](55-assistente-ia-conversacional.md)) é o fluxo mais mobile que existe (digitar uma pergunta/lançamento em segundos), mas não há tela de chat pensada para toque (input fixo, teclado, histórico rolável).
- **MOB-V3-03** — A **conexão bancária** ([spec 52](52-agregacao-open-finance-pluggy.md)) acontece via Pluggy Connect, um widget mobile-first; sem um contêiner responsivo e tratamento de retorno/erro, a conexão fica truncada no celular.
- **MOB-V3-04** — A spec 29 (notificações in-app) já está implementada, mas seus eventos não chegam ao usuário quando o app está fechado. Como PWA, é possível entregar **Web Push** reusando os eventos que a spec 29 já produz — algo que a versão original desta spec deixou fora.

---

## 2. Solução

**Fase 1 — Layout responsivo (tela de Mês)**: Criar layouts alternativos ativados por breakpoint. Em mobile, a tabela de transações vira uma lista de cards, a edição vira um bottom sheet/dialog, e a navegação usa padrões touch-friendly.

**Fase 2 — PWA base**: Adicionar `manifest.json`, ícones e Service Worker para permitir instalação na tela inicial e cache de assets estáticos.

**Fase 3 — Telas do V3 em mobile (novo)**:
- **3a — Telas de leitura/análise** (net worth, previsão, assinaturas, dívidas, fatura): cada uma com layout mobile próprio — KPIs empilhados, gráficos com `dashboards-charts` em container `overflow-x: auto` e altura reduzida, listas em cards.
- **3b — Chat do assistente de IA**: tela de chat dedicada com input fixo no rodapé (acima do teclado), histórico rolável, e atalho de lançamento rápido. Reusa o bottom sheet quando aberto sobre a tela de Mês.
- **3c — Conexão Open Finance**: contêiner responsivo para o Pluggy Connect com tratamento de retorno (sucesso/erro/cancelado) sem quebrar a navegação.
- **3d — Divisão e acerto de contas** ([spec 42](42-divisao-despesas-membros.md)): seleção de membros e método de divisão em bottom sheet; tela de "quem deve a quem" em cards.

**Fase 4 — Web Push (novo)**: Service Worker recebe push dos eventos da spec 29; opt-in explícito do usuário; entrega notificação quando o app está fechado.

---

## 3. User Stories

- Como usuário de smartphone, quero visualizar minhas transações do mês em uma lista clara e legível, sem precisar scrollar horizontalmente.
- Como usuário de smartphone, quero adicionar e editar transações em um formulário adequado para toque, não em uma linha de tabela espremida.
- Como usuário de smartphone, quero instalar o MyAccountant na tela inicial do meu celular como se fosse um app, para acessar rapidamente.
- Como usuário em conexão instável, quero que a interface básica do app carregue mesmo offline (pelo menos a shell).
- Como usuário no celular, quero perguntar ao assistente "quanto gastei em mercado esse mês?" num chat confortável de digitar com o polegar.
- Como usuário no celular, quero conectar meu banco pelo Pluggy sem que o fluxo quebre ao voltar para o app.
- Como usuário, quero receber uma notificação no celular quando algo relevante acontecer na minha Account, mesmo com o app fechado.

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

**PWA base:**
- O app DEVE ter um `manifest.json` válido com: nome, descrição, ícones (512x512, 192x192), `display: "standalone"`, `theme_color`, `background_color`.
- O app DEVE ter ícones em todos os tamanhos necessários para iOS e Android.
- UM SERVICE WORKER DEVE fazer cache dos assets estáticos (`_next/static/*`) para que a shell do app carregue offline.
- O app DEVE ser instalável ("Adicionar à tela inicial") em dispositivos iOS e Android.
- QUANDO o usuário está offline, O SISTEMA DEVE exibir uma tela de "Sem conexão" clara, sem mensagem de erro genérica do browser.

**Fase 3 — Telas do V3 (MOB-V3-01/02/03):**
- QUANDO qualquer tela nova do V3 é aberta em < 768px, ELA NÃO DEVE exigir scroll horizontal para ler a informação primária; gráficos que não cabem DEVEM ficar em container com `overflow-x: auto` próprio.
- A TELA DE CHAT do assistente DEVE manter o campo de entrada visível acima do teclado virtual e o histórico rolável, em < 768px.
- QUANDO o usuário inicia a conexão bancária no mobile, O FLUXO DO PLUGGY CONNECT DEVE abrir em contêiner responsivo e, ao retornar (sucesso/erro/cancelado), O APP DEVE exibir o estado correto sem tela em branco.

**Fase 4 — Web Push (MOB-V3-04):**
- O ENVIO DE PUSH DEVE depender de opt-in explícito do usuário (permissão do browser solicitada em contexto, não no primeiro load).
- QUANDO um evento da spec 29 ocorre e o usuário deu opt-in, UMA WEB PUSH NOTIFICATION DEVE ser entregue mesmo com o app fechado.
- A push NÃO DEVE conter valores financeiros sensíveis no corpo visível (apenas resumo do tipo de evento).

---

## 5. Fora de Escopo

- Sincronização de dados offline (os dados financeiros requerem conexão para leitura e escrita — apenas a shell/UI é cacheada).
- React Native ou app nativo — mantém-se web/PWA.
- Gestos de swipe para deletar transações (pode ser adicionado em iteração futura).
- Lançamento de transação **por voz** no chat de IA (futuro).
- Personalização avançada da bottom navigation por usuário.

> **Movido para dentro do escopo nesta revisão:** notificações push (agora Fase 4, via Web Push da PWA, reusando a spec 29) e adaptação mobile de dashboards/telas de análise (agora Fase 3a) — ambas eram "fora de escopo" na versão V2 e passam a ser necessárias com o V3.

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
| AppBar / bottom nav mobile | `src/app/(app)/[accountId]/layout.tsx` |
| Chat de IA mobile (Fase 3b) | tela da spec 55 + novo `AssistantChatMobile.tsx` |
| Pluggy Connect mobile (Fase 3c) | contêiner da spec 52 |
| Web Push (Fase 4) | `public/sw.js` (handler `push`), endpoint de subscription, reuso dos eventos da spec 29 |

**Bibliotecas:**
- `next-pwa` para simplificar a geração de Service Worker com Next.js (alternativa: configuração manual via `public/sw.js`).
- MUI `useMediaQuery` com breakpoint `theme.breakpoints.down("sm")` para condicionar layouts. **Atenção:** não usar `useMediaQuery({ noSsr: true })` no ThemeProvider (causa hydration mismatch — ver CLAUDE.md §7).
- MUI `SwipeableDrawer` para o bottom sheet de edição mobile.
- Web Push API + `web-push` (server) para a Fase 4.

**Breakpoints:**
- Mobile: `< 768px` (sm)
- Desktop: `≥ 768px`

**Geração de ícones:**
- Ferramentas: `pwa-asset-generator` ou similar
- Tamanhos necessários: 72, 96, 128, 144, 152, 192, 384, 512

**Sequenciamento no V3:**
- Fases 1–2 são pré-requisito de uso mobile (cabem na **V3.0**).
- Fase 3 acompanha as specs que introduzem cada tela (3b com a 55, 3c com a 52, 3d com a 42) — o princípio "nasce responsiva" evita uma fase de retrabalho.
- Fase 4 (Web Push) é oportunista após a Fase 2, já que a spec 29 (eventos) está pronta.
