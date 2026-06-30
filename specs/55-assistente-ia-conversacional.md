# Spec 55 — Assistente de IA Conversacional

> Status: draft
> Insumo: levantamento estratégico e benchmark PFM (2026-06-29) — pilar Inteligência
> Skills: [`api-routes`](../skills/api-routes/SKILL.md) · [`env-validation`](../skills/env-validation/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md)

---

## 1. Problema

- **AI-01**: A análise dos dados financeiros hoje é **inteiramente manual**. O usuário tem o Sandbox de análise ad-hoc (spec 17) e os dashboards configuráveis (specs 11, 33–38), mas precisa construir cada visualização à mão. Não há forma de fazer uma pergunta em linguagem natural ("quanto gastei com restaurantes vs. mês passado?") e receber uma resposta ancorada nos próprios dados.
- **AI-02**: Concorrentes de PFM já entregam isso. **Monarch AI Assistant** e **Copilot Intelligence** oferecem chat em linguagem natural sobre os dados reais do usuário, com respostas factuais e citação dos números. O MyAccountant não tem nenhum equivalente — é uma lacuna competitiva no pilar de Inteligência.
- **AI-03**: As respostas analíticas precisam ser **confiáveis**. Um assistente que alucina valores ("você gastou R$ 1.234") é pior que não ter assistente. Qualquer solução tem de garantir que cada número exibido venha de uma query real, executada sob multi-tenancy estrito (só a Account ativa).

---

## 2. Solução

### 2.1 Assistente de chat com tool-use (AI-01, AI-02)

Introduzir um assistente conversacional que responde perguntas em linguagem natural sobre os dados da Account ativa. A implementação usa a **API da Anthropic com tool-use** (function calling): o modelo recebe a pergunta do usuário e um conjunto de *tools* que correspondem aos **serviços de query já existentes** em `src/server/queries/`. O modelo decide qual query chamar, com quais parâmetros; o servidor executa a query real e devolve o resultado ao modelo, que então redige a resposta em português.

- **Modelo**: usar os modelos Claude mais recentes e capazes — `claude-opus-4-8` como padrão (mais capaz, 1M de contexto) ou `claude-sonnet-4-6` quando custo/latência forem prioritários. Configurável via env.
- **API key e configuração**: lidas via `env` de `src/lib/env.ts` (bloco `server`). **Nunca** `process.env` direto.
- **Endpoint**: Route Handler em `src/app/api/v1/assistant/chat/route.ts` via `defineRoute` (skill `api-routes`), com `requireAccountAccess` no início — multi-tenancy estrito.
- **Tools = queries existentes**: cada tool é um wrapper fino sobre uma função de `src/server/queries/` (ex.: `getCategoryBreakdown`, `getSectionTotals`, `getMonthSummaryData`), sempre recebendo `accountId` da sessão — **jamais** vindo do input do modelo.
- **UI**: painel de chat client-side (`src/components/assistant/AssistantChat.tsx`) com streaming de resposta; respeita a fronteira RSC/Client (skill `rsc-client-boundary`).

### 2.2 Multi-tenancy estrito (AI-03)

- O `accountId` usado em **toda** tool é o da Account ativa resolvida pela sessão (`requireAccountAccess`), nunca um parâmetro que o modelo possa fornecer. O schema Zod de cada tool **não expõe** `accountId`.
- Os números exibidos vêm **exclusivamente** do retorno das tools (queries reais). O system prompt instrui o modelo a nunca inventar valores e a só citar números presentes nos resultados de tool.
- Cada interação (pergunta, tools chamadas, tokens, latência, resultado) é logada de forma estruturada via Pino (skill `logging`), com `accountId` e `userId`.

---

## 3. User Stories

- Como membro de uma Account, quero perguntar "quanto gastei com restaurantes este mês comparado ao anterior?" e receber uma resposta com os valores reais, para entender meus gastos sem montar um dashboard.
- Como usuário, quero que o assistente cite apenas números que existem nos meus dados, para confiar na resposta sem precisar conferir manualmente.
- Como owner de uma Account, quero ter certeza de que o assistente nunca acessa dados de outra Account, para preservar o isolamento entre tenants.
- Como desenvolvedor, quero que as tools do assistente reusem os serviços de query existentes, para não duplicar lógica de agregação nem abrir um caminho paralelo ao banco.

---

## 4. Critérios de Aceitação

**AI-01 / AI-02:**
- QUANDO o usuário envia uma pergunta em linguagem natural sobre seus gastos, O ASSISTENTE DEVE responder em português com base no resultado de ao menos uma query real.
- QUANDO o modelo precisa de um dado, ELE DEVE chamar uma tool correspondente a uma função de `src/server/queries/` em vez de inventar o valor.
- A resposta DEVE ser transmitida via streaming na UI de chat.

**AI-03 (multi-tenancy e ancoragem):**
- O Route Handler do assistente DEVE chamar `requireAccountAccess(accountId)` antes de qualquer execução de tool.
- TODA tool DEVE receber o `accountId` da sessão; o schema Zod da tool NÃO DEVE conter um campo `accountId` preenchível pelo modelo.
- QUANDO o modelo tenta referenciar dados fora da Account ativa, a tool NÃO DEVE retornar dados de outra Account (filtro `accountId` obrigatório na query).
- O assistente NÃO DEVE exibir um número que não esteja presente em algum resultado de tool daquela conversa.
- CADA interação DEVE gerar um log estruturado Pino contendo `accountId`, `userId`, tools chamadas e contagem de tokens.
- A API key DEVE ser lida via `env` de `src/lib/env.ts`; NÃO DEVE haver `process.env.ANTHROPIC_API_KEY` direto no código.

---

## 5. Fora de Escopo

- **Ações de escrita pelo assistente** — esta spec é **somente leitura**. Criar/editar/deletar transações via chat fica para spec futura.
- **Fine-tuning** de modelo — usa-se o modelo base com tool-use.
- **Interface de voz** (speech-to-text / text-to-speech).
- **Text-to-SQL** — descartado por segurança (ver DD-02).
- **Memória persistente entre conversas** (cross-session) — cada conversa começa do zero nesta spec.
- **Limites de cota / billing por uso de IA** — tratado em spec própria quando houver monetização.

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Modelo Claude | `claude-opus-4-8` padrão (config para `claude-sonnet-4-6`) | Mais capaz e com 1M de contexto; sonnet como opção de custo/latência |
| DD-02 | Acesso aos dados | **Tool-use sobre queries existentes** (não text-to-SQL) | Tool-use força o `accountId` na camada de serviço e impede SQL arbitrário; text-to-SQL abriria risco de vazamento entre tenants e injeção |
| DD-03 | Origem do `accountId` | Sempre da sessão (`requireAccountAccess`), nunca do input do modelo | Garante multi-tenancy estrito mesmo que o modelo seja manipulado |
| DD-04 | Ancoragem de números | Só valores presentes em resultados de tool | Elimina alucinação de valores financeiros |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Endpoint do assistente | `src/app/api/v1/assistant/chat/route.ts` (novo) |
| Definição de tools (wrappers de query) | `src/server/services/assistant/tools.ts` (novo) |
| Queries reutilizadas | `src/server/queries/*.ts` (ex.: `dashboards.ts`, `month-page.ts`) |
| API key + modelo | `src/lib/env.ts` (adicionar `ANTHROPIC_API_KEY`, `ASSISTANT_MODEL`) |
| UI de chat | `src/components/assistant/AssistantChat.tsx` (novo) |
| Logging | `src/server/services/assistant/*` via logger Pino |

```ts
// ✅ Correto — accountId vem da sessão, nunca do modelo
const { accountId } = await requireAccountAccess(req);
const tool = {
  name: "get_category_breakdown",
  description: "Gastos agregados por categoria em um mês.",
  input_schema: {
    type: "object",
    properties: { monthId: { type: "string" } }, // SEM accountId aqui
    required: ["monthId"],
  },
};
// na execução da tool:
const result = await getCategoryBreakdown(accountId, input.monthId); // accountId fixo

// ❌ Anti-padrão — expor accountId ao modelo (vazamento entre tenants)
properties: { accountId: { type: "string" }, monthId: { type: "string" } }
```
