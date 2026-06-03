# MyAccountant — Análise Pós-V1 e Roadmap de Maturidade

> Documento de análise independente, com olhar de cliente, analista de produto e especialista em UI/UX.
> Baseado em revisão completa do código-fonte, schema e fluxos do V1. Data: **2026-06-02**.

---

## TL;DR

O V1 entregou uma base sólida: arquitetura limpa em camadas, multi-tenancy correto, BigInt para dinheiro, design system consistente. O produto está funcional e coerente. Os principais gaps para maturação são: **experiência mobile nula**, **sem busca/filtro de transações**, **bugs sutis na tabela de transações**, **N+1 queries em seções** e **ausência total de exportação de dados**. Este documento mapeia tudo por prioridade.

---

## 1. Pontos Fortes do V1

Antes de listar o que melhorar, vale registrar o que funciona bem — para que o rumo não mude por acidente.

### 1.1 Arquitetura
- `defineAction()` é um padrão elegante: auth + RBAC + validação Zod + erro estruturado em um só lugar. Toda action se beneficia gratuitamente.
- Multi-tenancy não deixa brechas: `requireAccountAccess()` + `accountId` em toda query. Certo por construção.
- Camadas respeitadas: UI → Action → Service → Prisma. Nenhuma lógica de negócio vazou para os componentes.
- BigInt em centavos do banco até a tela — zero risco de erro de ponto flutuante.
- Logging estruturado com Pino em todos os serviços. Rastreabilidade boa desde o dia 1.

### 1.2 UX
- **Edição inline de transações** (clicar na linha para editar) é fluida e economiza tempo.
- **Atualização otimista com rollback** em caso de erro: o usuário vê resposta imediata e o dado é revertido se o servidor falhar.
- **Bulk actions** (selecionar várias transações para alterar categoria, mover, deletar) é um diferencial raro em apps financeiros pessoais.
- **Sandbox de análise** com gráficos configuráveis é um diferencial de produto real.
- **Diagrama Sankey** (renda → categorias) é uma visualização poderosa e pouco comum.
- **Cor de destaque por usuário** mostra atenção ao detalhe de personalização.
- Temas light/dark com tokens semânticos garante consistência visual.

### 1.3 Dados
- Schema bem pensado: `sectionId` desnormalizado em `Transaction` evita JOINs custosos nos reports.
- `countInMonth` por tabela + `countType` por seção = sistema flexível de controle de saldo.
- `metadata JSON` em `Transaction` garante extensibilidade sem migration.

---

## 2. Bugs Identificados

### BUG-01 — Duplicar transação insere no topo, não abaixo do original
**Arquivo:** [src/components/transactions/TransactionTable.tsx:77](src/components/transactions/TransactionTable.tsx#L77)

```ts
function onDuplicated(newTx: TxRow) {
  setRows((prev) => {
    const idx = prev.findIndex((r) => r.id === newTx.id.replace(/-copy$/, ""));
    // ↑ newTx.id é um UUID real (ex: "cma4x..."). .replace(/-copy$/, "") não muda nada.
    // idx sempre será -1 → splice(-1+1, 0, newTx) = splice(0, 0, newTx) = insere no topo.
```

**Impacto:** Ao duplicar uma transação, ela aparece no topo da tabela em vez de logo abaixo do original. Gera confusão para o usuário.

**Correção sugerida:**
```ts
// Em TransactionRow.handleDuplicate:
onDuplicated({ ...tx, id: result.data.transactionId, _sourceId: tx.id });

// Em TransactionTable.onDuplicated:
function onDuplicated(newTx: TxRow & { _sourceId: string }) {
  setRows((prev) => {
    const idx = prev.findIndex((r) => r.id === newTx._sourceId);
    const copy = [...prev];
    copy.splice(idx + 1, 0, newTx);
    return copy;
  });
}
```

---

### BUG-02 — Transações silenciosamente cortadas em `take: 300`
**Arquivo:** [src/app/(app)/[accountId]/months/[monthId]/page.tsx:62](src/app/(app)/[accountId]/months/[monthId]/page.tsx#L62)

```ts
prisma.transaction.findMany({
  where: { accountId, monthId },
  orderBy: { occurredOn: "desc" },
  take: 300,  // ← corte silencioso
```

**Impacto:** Se um mês tiver mais de 300 transações (comum para contas familiares ou empresariais com muitas entradas), as mais antigas são **silenciosamente omitidas**. Totais de seção ficam errados no dashboard mensal. Não há aviso ao usuário.

**Correção sugerida:** Carregar transações por tabela sob demanda (lazy), ou mostrar um aviso quando o limite for atingido.

---

### BUG-03 — N+1 queries em `getSectionTotals`
**Arquivo:** [src/server/services/month-service.ts:81](src/server/services/month-service.ts#L81)

```ts
const results = await Promise.all(
  sectionIds.map(async (sectionId) => {
    const agg = await prisma.transaction.aggregate({ ... });  // 1 query por seção
  }),
);
```

**Impacto:** Para uma account com 6 seções, isso dispara 6 queries separadas no banco a cada carregamento da página do mês. O arquivo `dashboards.ts` já tem a solução correta com `batchSectionTotals` usando `groupBy` — 1 query para todas as seções. A inconsistência aumenta latência desnecessariamente.

**Correção:** Migrar `getSectionTotals` para usar `groupBy` com `{ by: ["sectionId"] }`, igual à implementação em `dashboards.ts`.

---

### BUG-04 — Notes nunca visíveis no modo de leitura
**Arquivo:** [src/components/transactions/TransactionRow.tsx](src/components/transactions/TransactionRow.tsx)

O campo `notes` existe no schema, é carregado no `TransactionRow`, aparece no form de edição, mas **não é exibido em nenhum lugar no modo de leitura**. Se um usuário escreve uma nota em uma transação e sai da edição, não há como ver essa nota sem clicar para editar novamente.

---

### BUG-05 — `formatCentsToBrl` ignora a moeda da conta
**Arquivo:** [src/lib/money.ts:11](src/lib/money.ts#L11)

```ts
export function formatCentsToBrl(cents: bigint, ...): string {
  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",  // ← hardcoded, ignora AccountSettings.currency
  }).format(Math.abs(value));
```

**Impacto:** O campo `currency` em `AccountSettings` foi definido no schema, mas não é usado. Uma conta configurada com USD ou EUR ainda exibe "R$" em todo o app.

---

## 3. Melhorias de UX

### UX-01 — Sem busca e filtro nas transações (prioridade alta)

O problema mais impactante para usuários com uso intenso. Hoje, para encontrar uma transação específica, é preciso rolar toda a tabela visualmente. Não há:
- Busca por descrição
- Filtro por categoria/instituição/responsável
- Filtro por data/valor
- Ordenação por coluna (clicar no header)

**Sugestão:** Adicionar uma barra de filtros acima da tabela (colapsável para não poluir) com busca textual e selects para os campos principais.

---

### UX-02 — Delete de transação sem confirmação nem undo

**Arquivo:** [src/components/transactions/TransactionRow.tsx:128](src/components/transactions/TransactionRow.tsx#L128)

```ts
async function handleDelete() {
  setMenuAnchor(null);
  onOptimisticDelete(tx.id);  // remove imediatamente da UI
  // ... sem dialog de confirmação, sem undo
}
```

A deleção é instantânea e irreversível. Um clique acidental elimina dados financeiros permanentemente. O snackbar "Transação deletada" aparece mas não tem ação de desfazer.

**Sugestão:** Usar `enqueueSnackbar` com `action: <Button onClick={handleUndo}>Desfazer</Button>` e um timeout de 5 segundos antes de realmente deletar no servidor.

---

### UX-03 — Edição ao clicar na linha inteira causa acidentais

Clicar em qualquer lugar da linha abre o modo de edição. Em telas touch ou trackpads, é fácil acionar edição sem intenção, especialmente ao scrollar ou selecionar texto.

**Sugestão:** Adicionar um botão de edição explícito no menu de ações (⋮), ou exigir double-click para entrar em modo de edição, com single-click apenas para seleção.

---

### UX-04 — Reordenação de seções e tabelas com botões ▲▼ (prioridade média)

A reordenação atual usa botões de seta que movem um item por vez. Com 5+ seções, reposicionar do fim ao topo requer N cliques. Drag-and-drop seria naturalmente esperado aqui.

**Sugestão:** Usar `@dnd-kit/core` (leve, acessível, funciona com SSR) para drag-and-drop em seções e tabelas dentro de uma seção.

---

### UX-05 — Navegação de meses sem contexto temporal

A navegação anterior/próximo no MonthHeader funciona, mas não há uma visão de calendário ou lista de meses para "ir direto" para um mês específico. Com 24+ meses de dados, navegar um por um fica custoso.

**Sugestão:** Adicionar um seletor de mês em formato de picker (ex: `MMM/YYYY` em dropdown) no cabeçalho.

---

### UX-06 — Onboarding/configuração inicial é lento

O usuário que cria uma nova Account precisa ir em Configurações → Seções, Configurações → Categorias, Configurações → Instituições antes de poder usar o app de verdade. Não há assistente de configuração inicial.

**Sugestão:** Ao criar a primeira Account, um stepper de 3 passos: "Crie suas seções (ex: Renda, Gastos, Investimentos)" → "Adicione categorias" → "Pronto, crie seu primeiro mês".

---

### UX-07 — Sem feedback visual de loading em transições de página

Ao navegar entre meses (que recarregam todo o RSC), não há indicador de loading. O usuário pode clicar várias vezes achando que não funcionou.

**Sugestão:** Usar `useFormStatus` ou um contexto de navegação para mostrar uma barra de progresso linear no topo (estilo YouTube/GitHub) durante SSR reloads.

---

### UX-08 — Campo "Notas" escondido no formulário de edição inline

Notas não aparecem no modo de leitura (BUG-04) e no modo de edição ficam ocultas (não há campo visível na edição inline). O campo só está acessível se já houver uma nota. Isso reduz drasticamente o uso de um recurso útil.

**Sugestão:** Mostrar um ícone 📝 na linha quando há nota, com tooltip exibindo o conteúdo. No modo de edição, tornar o campo de notas visível por padrão (como linha secundária ou accordion).

---

### UX-09 — Mobile inutilizável

A tabela de transações usa `<Table>` MUI com múltiplas colunas, overflow horizontal e edição inline. Em telas < 768px, a experiência é quebrada: o usuário precisa scrollar horizontalmente para ver o valor, a edição inline vira um formulário espremido.

**Sugestão para V2:** Criar um layout alternativo para mobile (card por transação, swipe to delete, bottom sheet para edição) acionado por breakpoint.

---

### UX-10 — Sem empty state para seções sem transações

Quando uma seção existe mas não tem nenhuma tabela/transação no mês, não há visual que convide à ação. O usuário vê apenas uma área vazia.

---

### UX-11 — Título da tab do browser não tem contexto

O título da página no browser é sempre "MyAccountant" sem indicar o mês/seção atual. Dificulta quem usa múltiplas abas.

**Sugestão:** `<title>Janeiro 2026 – Gastos | MyAccountant</title>`

---

### UX-12 — Cor do valor da transação não considera o tipo da seção

Na TransactionRow, o valor é verde se positivo e vermelho se negativo:
```ts
color: isPositive ? "success.main" : "error.main"
```

Mas em seções do tipo `subtract` (gastos), um valor positivo deveria ser vermelho (é uma despesa). A cor deveria considerar o `countType` da seção, não apenas o sinal do número.

---

## 4. Melhorias de Performance

### PERF-01 — `getSectionTotals` dispara N queries (já coberto em BUG-03)

### PERF-02 — `listTablesForMove` carrega TODAS as tabelas da account

**Arquivo:** [src/server/services/transaction-service.ts:222](src/server/services/transaction-service.ts#L222)

```ts
tables: prisma.financeTable.findMany({ where: { accountId } })  // sem limite
```

Para uma account com 3 anos de dados (36 meses × 5 seções × 3 tabelas = 540 tabelas), isso carrega 540 registros toda vez que o modal "Mover transações" é aberto.

**Sugestão:** Limitar a 12 meses mais recentes + adicionar busca server-side no modal.

---

### PERF-03 — Página do mês sem nenhum cache

A página `/[accountId]/months/[monthId]` refaz todas as queries a cada visita. Com Next.js App Router, é possível usar `unstable_cache` ou `revalidatePath` para cachear dados que mudam apenas quando há mutação.

---

### PERF-04 — Dashboard anual pode ser lento para accounts antigas

`getYearDeepDive` carrega dados de 12 meses em paralelo. Para accounts com muitos dados, as queries de `groupBy` podem ser lentas sem índices adequados.

**Sugestão adicional de índice:**
```sql
CREATE INDEX ON transactions(account_id, occurred_on);
CREATE INDEX ON transactions(account_id, month_id, category_id);
```
(o schema já tem `@@index([accountId, occurredOn])`, mas a combinação com `category_id` para `groupBy` beneficiaria do índice composto)

---

### PERF-05 — Lookup linear em arrays no render de TransactionRow

**Arquivo:** [src/components/transactions/TransactionRow.tsx](src/components/transactions/TransactionRow.tsx)

```ts
categories.find((c) => c.id === tx.categoryId)  // O(n) por render
institutions.find((i) => i.id === tx.institutionId)  // O(n) por render
members.find((m) => m.id === tx.responsibleUserId)  // O(n) × 3 por render
```

Para uma tabela com 200 linhas, 50 categorias e 10 membros: `200 × (50 + 10 + 10 + 10)` = 16.000 operações de busca por renderização completa da tabela.

**Sugestão:** Converter as listas em Maps no componente pai antes de passar como props:
```ts
const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
```

---

## 5. Melhorias de Segurança

### SEC-01 — Sem rate limiting em rotas críticas

Não há proteção contra:
- **Brute force em login** (`/api/auth/callback/credentials`): tentar milhares de senhas
- **Abuso de convites**: enviar centenas de emails de convite
- **Abuso de recuperação de senha**: enviar emails de reset em massa

**Sugestão:** Adicionar rate limiting com `upstash/ratelimit` (Redis) ou `next-rate-limiter` no middleware ou nas rotas de auth.

---

### SEC-02 — Token de convite gerado com `crypto.randomBytes(32)` mas sem hashing no banco

**Arquivo:** [src/server/services/member-service.ts:53](src/server/services/member-service.ts#L53)

O token é armazenado em plaintext no banco (`account_invites.token`). Se houver vazamento do banco, todos os convites pendentes podem ser usados.

**Sugestão:** Armazenar `SHA256(token)` no banco, e enviar o token real por email. Comparar `SHA256(tokenRecebido) === tokenNoBanco` na aceitação.

---

### SEC-03 — Sem audit log de mutações

Para um app financeiro colaborativo, saber "quem deletou essa transação" ou "quem mudou o valor para X" é crítico. Hoje há `createdById`/`updatedById` em `FinanceTable` e `Transaction`, mas:
- Não há histórico de alterações (só o último `updatedById`)
- Não há log de deleções
- Não há log de alterações em configurações (seções, categorias)

**Sugestão V2:** Tabela `audit_log` com `(accountId, userId, entityType, entityId, action, diff, createdAt)`. Registrar creates, updates, deletes de entidades financeiras críticas.

---

### SEC-04 — Middleware não protege rotas `/api/v1/*`

**Arquivo:** [src/middleware.ts:32](src/middleware.ts#L32)

```ts
matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
```

Todas as rotas que começam com `/api/` ficam fora do middleware. As rotas `/api/v1/*` dependem individualmente de checagem de auth nos route handlers. Se algum route handler for criado sem `requireAccountAccess`, fica exposto.

**Sugestão:** Incluir `/api/v1/*` no matcher e checar auth no middleware para essa rota.

---

### SEC-05 — Sem validação de `Content-Type` em uploads CSV/XLSX

O wizard de importação aceita uploads. Não há verificação do tipo real do arquivo (apenas extensão/MIME do browser), o que pode aceitar arquivos malformados ou com payloads inesperados.

---

## 6. Funcionalidades para V2

Organizadas por impacto estimado no produto.

### F-01 — Exportação de dados (alta prioridade)

Único item da lista "não entregue no V1" que é frequentemente bloqueador de adoção. Usuários precisam de backup dos seus dados e integração com Excel/Contador.

- Exportar transações do mês atual em CSV/XLSX
- Exportar relatório mensal em PDF (resumo + seções + categorias)
- Exportar ano completo

---

### F-02 — Busca global de transações

Uma barra de busca acessível de qualquer lugar que permita buscar por descrição, valor aproximado, categoria. Resultado lista as transações com link para o mês/tabela correspondente.

---

### F-03 — Transações recorrentes automáticas

Hoje o usuário pode criar `TableTemplate` com transações recorrentes e aplicar ao criar uma tabela. Mas é um processo manual a cada mês. 

**Sugestão:** Opção "Aplicar automaticamente ao criar mês" no template. Ao criar um mês, as transações do template são criadas automaticamente nas seções configuradas.

---

### F-04 — Orçamento por seção/categoria

Definir metas de gasto:
- "Gastar no máximo R$2.000/mês em Alimentação"
- "Gastar no máximo R$5.000/mês em Gastos totais"

No dashboard mensal, exibir progresso em relação à meta (barra de progresso, % utilizado, alerta quando ultrapassa).

---

### F-05 — Filtros avançados e busca em transações

Já citado em UX-01. Detalhando o escopo:
- Busca textual em `description` (ILIKE)
- Filtro por `categoryId`, `institutionId`, `responsibleUserId`
- Filtro por range de `amountCents`
- Filtro por `occurredOn` range
- Filtro por `isPending`, `isFavorite`
- Ordenação por coluna (data, valor, descrição)
- Persistência dos filtros no URL via searchParams

---

### F-06 — Notificações in-app

Para accounts colaborativas (cônjuge, sócio), não há como saber que alguém adicionou uma transação. Um sistema de notificação básico:
- "João adicionou 3 transações em Gastos/Março 2026"
- "Maria alterou o valor de uma transação"
- Badge de notificações no ícone de membros

---

### F-07 — Comentários em transações

Para contas colaborativas, a capacidade de comentar em uma transação ("esse gasto foi o jantar de aniversário") sem poluir a descrição principal.

Modelo sugerido: `TransactionComment { id, transactionId, accountId, userId, text, createdAt }`.

---

### F-08 — Anexos em transações

Foto do recibo, comprovante de pagamento. Integração com storage (S3/R2). Campo `attachments JSON` ou tabela separada.

---

### F-09 — Multi-moeda

O campo `currency` em `AccountSettings` já existe mas não é usado. Para accounts internacionais ou com investimentos em dólar:
- Transações podem ter `currency` própria
- Conversão pela taxa do dia para o total do mês
- `MoneyValue` component usa a moeda da account/transação

---

### F-10 — App mobile (PWA ou React Native)

A web não é usável em mobile (UX-09). Para um app de gestão financeira diária, mobile é fundamental.

**Recomendação:** Antes de React Native, otimizar a web para mobile com layouts responsivos + `manifest.json` + Service Worker para criar uma boa PWA. Custo/benefício muito melhor no curto prazo.

---

### F-11 — Importação direta de extratos bancários (OFX/PDF)

Além de CSV/XLSX, suporte ao formato OFX (padrão dos bancos brasileiros). Parsing de PDF de extrato via `pdf-parse` + heurísticas.

---

### F-12 — Relatórios comparativos entre meses

"Quanto gastei mais em Alimentação em março comparado com fevereiro?" com variação percentual e gráfico de evolução lado a lado. O dashboard anual já traz dados anuais, mas o comparativo mensal detalhado por categoria falta.

---

### F-13 — Tags em transações

Além de categoria/subcategoria, tags livres para cross-cutting concerns: `#ferias`, `#trabalho`, `#filho`. Permite análises que cruzam seções.

---

### F-14 — "Modo Orçamento" (planejamento vs real)

Criar um mês de "planejamento" com valores esperados, e comparar lado a lado com o mês real. Para planejamento financeiro familiar/empresarial.

---

### F-15 — Lembretes/alertas configuráveis

- "Me avise quando os gastos do mês ultrapassarem R$X"
- "Me avise quando uma transação pendente ainda estiver pendente após 30 dias"
- Entrega via email (Resend já está integrado)

---

## 7. Dívida Técnica a Pagar

### DT-01 — Status `README.md` desatualizado

```
🚧 Em planejamento — fase 0 (setup) ainda não iniciada.
```

O README ainda diz que o projeto está no planejamento. Deve ser atualizado para refletir o V1 entregue.

---

### DT-02 — Testes insuficientes

O setup de Vitest está configurado mas não há evidência de cobertura real. Para o V2, pelo menos:
- Testes unitários nos services críticos (transações, contas, convites)
- Teste de integração para `defineAction` + schema + service
- Teste E2E para o fluxo de convite (email → aceite → acesso)

---

### DT-03 — `hiddenColumns` como `Json` no banco sem tipagem forte

```prisma
hiddenColumns Json @default("{}")
```

O campo é deserializado com `as Record<string, boolean>` nos componentes mas não há garantia de estrutura. Uma mudança no nome de uma coluna quebraria silenciosamente a configuração de todos os `TableType` existentes.

**Sugestão:** Zod schema para validar/migrar o JSON na leitura.

---

### DT-04 — `investmentType` como string livre sem enum

```ts
investmentType: String?
```

Sem enum, não há validação, não há lista de opções no UI. O campo aceita qualquer string. Para analytics futuro (agrupar por tipo de investimento), isso é problemático.

---

### DT-05 — Sem migração de dados para `accentColor`

A migration `20260602194554_add_accent_color` adiciona o campo mas usuários existentes sem `user_settings` ainda não têm a preferência. O código usa `@default("indigo")` no schema, então funciona, mas uma migration de seed para criar `UserSettings` para usuários existentes seria mais limpa.

---

### DT-06 — `Intl.NumberFormat` instanciado a cada chamada de `formatCentsToBrl`

**Arquivo:** [src/lib/money.ts:12](src/lib/money.ts#L12)

```ts
const formatted = new Intl.NumberFormat("pt-BR", { ... }).format(Math.abs(value));
```

`Intl.NumberFormat` é caro para instanciar. Com centenas de chamadas por render (uma por célula de valor), vale cachear a instância:

```ts
const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
```

---

## 8. Análise da Hierarquia de Informação (IA/UX)

### 8.1 O menu de navegação principal é minimalista demais

O AppBar atual tem: `[nome da conta] [Dashboards] [Membros] [Configurações] [Usuário]`

Não há acesso direto aos meses passados sem navegar pela seta do mês atual. Não há link para "Todos os meses". Para usuários que alternam frequentemente entre meses, isso é doloroso.

**Sugestão:** Adicionar ao AppBar ou a um menu lateral: "Meses" (lista) ou um dropdown com os últimos 6 meses.

### 8.2 Configurações estão fragmentadas

Para configurar a account, o usuário precisa navegar entre 6+ sub-páginas de configuração (Geral, Seções, Categorias, Instituições, Modelos, Templates...). Não há visão consolidada.

**Sugestão:** Layout de configurações com sidebar vertical à esquerda mostrando todas as seções, painel principal à direita — como fazem Notion, Linear, GitHub Settings.

### 8.3 Dashboard vs. Mês: propósitos sobrepostos

A página do mês já tem gráficos (barras por seção, pizza de categorias, lista de pendentes/favoritos). O dashboard mensal tem uma visão muito similar. Para o usuário, qual é a diferença e quando usar cada um?

**Sugestão:** Diferenciar mais claramente:
- **Página do Mês** = operacional (entrar dados, editar transações)
- **Dashboard Mensal** = analítico (visualizar tendências, drill-down, comparativos)

---

## 9. Matriz de Priorização

| # | Item | Impacto | Esforço | Prioridade |
|---|---|---|---|---|
| BUG-01 | Fix duplicate inserts at top | Alto | Baixo | **Urgente** |
| BUG-03 | Fix N+1 em getSectionTotals | Alto | Baixo | **Urgente** |
| BUG-04 | Mostrar notes no view mode | Médio | Baixo | **Alta** |
| BUG-05 | Usar currency da account | Médio | Médio | Alta |
| UX-01 | Busca/filtro em transações | Muito Alto | Alto | **Alta** |
| UX-02 | Undo para delete de transação | Alto | Baixo | **Alta** |
| UX-05 | Seletor de mês direto | Alto | Baixo | Alta |
| UX-07 | Indicador de loading em navegação | Médio | Baixo | Alta |
| UX-11 | Title dinâmico no browser | Baixo | Muito Baixo | Fácil de fazer |
| UX-12 | Cor do valor conforme tipo da seção | Médio | Baixo | Alta |
| F-01 | Exportação CSV/PDF | Muito Alto | Médio | **Alta** |
| F-03 | Transações recorrentes automáticas | Alto | Médio | Alta |
| F-04 | Orçamento por seção/categoria | Alto | Alto | Média |
| F-06 | Notificações in-app | Médio | Alto | Média |
| UX-04 | Drag and drop para reordenação | Médio | Médio | Média |
| UX-06 | Onboarding guiado | Alto | Médio | Média |
| UX-09 | Layout mobile | Muito Alto | Muito Alto | V2.1 |
| SEC-01 | Rate limiting | Alto | Médio | Alta (antes de abrir o produto) |
| SEC-02 | Hash do token de convite | Médio | Baixo | Alta |
| SEC-03 | Audit log | Alto | Alto | V2 |
| PERF-02 | Limitar listTablesForMove | Médio | Baixo | Alta |
| PERF-05 | Maps para lookup de categorias/membros | Médio | Baixo | Alta |
| DT-01 | Atualizar README | Baixo | Muito Baixo | **Agora** |

---

## 10. Proposta de Roadmap V2

### V2.0 — Estabilidade e Polimento (4–6 semanas)
- [ ] Corrigir BUG-01, BUG-03, BUG-04, BUG-05
- [ ] Undo de delete (UX-02)
- [ ] Busca/filtro básico em transações (UX-01)
- [ ] Seletor de mês direto no header (UX-05)
- [ ] Exportação CSV do mês atual (F-01 simplificado)
- [ ] Rate limiting em auth e convites (SEC-01)
- [ ] Hash de token de convite (SEC-02)
- [ ] Atualizar README (DT-01)
- [ ] Otimizações de performance (PERF-02, PERF-05)

### V2.1 — Novas Funcionalidades (6–10 semanas)
- [ ] Layout mobile responsivo (UX-09)
- [ ] Transações recorrentes automáticas (F-03)
- [ ] Orçamento por seção (F-04 simplificado)
- [ ] Notificações por email para ações de membros (F-06 simplificado)
- [ ] Drag and drop para reordenação (UX-04)
- [ ] Onboarding guiado (UX-06)
- [ ] Exportação PDF (F-01 completo)
- [ ] Audit log básico (SEC-03)

### V2.2 — Crescimento (10+ semanas)
- [ ] Multi-moeda (F-09)
- [ ] Busca global (F-02)
- [ ] Comentários em transações (F-07)
- [ ] Relatórios comparativos (F-12)
- [ ] Lembretes configuráveis (F-15)
- [ ] Importação OFX (F-11)
- [ ] PWA / Service Worker (F-10 fase 1)

---

## 11. Observações Finais

O MyAccountant V1 tem uma base técnica invejável para um projeto pessoal. A arquitetura é disciplinada, as convenções são seguidas, o schema é bem pensado. Isso é raro e vale preservar.

O maior risco para o V2 não é técnico — é de produto: o app tem muita profundidade (sandbox de análise, sankey, table templates, modelos de coluna) mas onboarding duro e ausência de mobile podem inibir a adoção por não-técnicos. A lacuna entre "é impressionante" e "consigo usar no dia a dia" passa principalmente por busca de transações, exportação e experiência mobile.

Os bugs identificados (especialmente BUG-01 e BUG-03) são correções pequenas com impacto alto — deveriam entrar antes de qualquer nova feature.
