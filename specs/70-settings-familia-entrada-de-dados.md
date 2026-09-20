# Spec 70 — Configurações · Família 3: Entrada de dados

> Status: draft
> Insumo: frames **"MyAccountant Settings — Arquitetura"** e **"MyAccountant Settings — Todas as Páginas v2"** (telas 08 Templates de importação + 08b abas Data/valor e Categorização, 09 Apelidos, 10 Conectores de IA; modais M1 Apelido, M7 Criar template a partir de arquivo)
> Skills: [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`react-best-practices`](../skills/react-best-practices/SKILL.md)
> Depende de: **Spec 67** (shell, modais, status, paginação) · **Spec 68** (categorias/instituições/responsáveis são os destinos das regras)

---

## 0. Blueprint

As telas 08, 08b, 09 e 10 do frame v2 são normativas. Esta é a família que transforma **arquivo externo em transação** — a de maior densidade de configuração do produto, e onde o preview ao vivo é obrigatório: parsing sem preview é adivinhação.

---

## 1. Problema

- **ENT-01 · Template de importação num formulário único**: todas as opções de parsing (leitura do arquivo, mapeamento de colunas, data, valor, sinal, categorização) num único bloco. O usuário não sabe onde uma etapa termina e a outra começa.
- **ENT-02 · Sem preview do parsing**: não há como ver quantas linhas serão importadas, quantas serão ignoradas e quais têm problema antes de rodar a importação de verdade.
- **ENT-03 · Sinal ambíguo**: bancos representam débito/crédito de três formas diferentes (uma coluna com sinal; débito e crédito em colunas separadas; valor positivo + coluna D/C). Hoje só a primeira é suportada de forma explícita.
- **ENT-04 · Criar template do zero é caro**: o usuário precisa descobrir delimitador, encoding, linha de cabeçalho e formato de data por tentativa.
- **ENT-05 · Apelido é só descrição→descrição**: o apelido hoje reescreve a descrição e, no máximo, sugere categoria. Não consegue preencher responsável, método, instituição, nota — que é o trabalho repetitivo real.
- **ENT-06 · Regra de reconhecimento pobre**: só "contém". Falta começa com, termina com, igual, regex, sensibilidade a maiúsculas/acentos, e combinação E/OU.
- **ENT-07 · Apelidos não escalam**: 132 apelidos em lista contínua, com alerta de "sem categoria" que trata como erro uma escolha legítima do usuário.
- **ENT-08 · Ordem de precedência invisível**: quando apelido, de-para do template e padrão do template dizem coisas diferentes, ninguém sabe quem ganha.
- **ENT-09 · "Conectores de IA" prometia o que o produto não faz**: a tela sugeria guardar chave de IA e classificar automaticamente. A realidade é **MCP**: expor os dados desta conta para a IA que o usuário já usa.

---

## 2. Solução

### 2.1 Templates de importação — arquétipo C, **5 abas por etapa do parsing** (ENT-01)

Lista mestre com `CSV · 88 importações`; template com problema aparece em cor de aviso com o motivo ("coluna 'Valor' ausente"). **Preview ao vivo fixo à direita (352px) em todas as abas** (ENT-02), reprocessando o arquivo de amostra a cada mudança:

- mini-tabela das primeiras linhas parseadas, com linhas ignoradas marcadas ("2 linhas ignoradas no rodapé") e linhas com erro destacadas em aviso ("Data em formato inválido");
- placar: **38 linhas prontas · 1 linha com problema · 3 ignoradas por regra**.

**Aba 1 · Arquivo** — formato, codificação (com hint "Latin-1 para bancos antigos"), delimitador, qualificador de texto; linhas a ignorar (topo / linha do cabeçalho / rodapé, com hints "cabeçalhos institucionais", "0 = arquivo sem cabeçalho", "totais e avisos legais"); toggles de descarte (linhas vazias, linhas sem valor numérico, linhas que casem com um padrão); **arquivo de amostra** anexado ao template (nome, nº de linhas, quando foi enviado, botão de trocar).

**Aba 2 · Mapeamento** — coluna do arquivo → campo da transação.

**Aba 3 · Data e valor**
- **Data**: formato de entrada (detectado da amostra, aceita formato livre); **"Quando o dia estiver fora do mês da fatura"** → manter a data original **ou** deslocar para o mês de competência.
- **Valor**: separador decimal, separador de milhar, símbolo a remover.
- **Convenção de sinal** — **NOVA FUNCIONALIDADE** (ENT-03): três opções em cards com radio — (a) **uma coluna com sinal** (com toggle "inverter sinal"); (b) **débito e crédito em colunas separadas** (escolher a coluna de cada um); (c) **coluna de tipo (D/C)** (valor sempre positivo + coluna indicadora).
- **Parcelas**: regex de detecção na descrição (default `(\d+)/(\d+)$`, com validação ao vivo) que **cria o `InstallmentGroup` automaticamente**, e alternativa de coluna de parcela dedicada.

**Aba 4 · Categorização**
- **Ordem de aplicação explícita** — **NOVA FUNCIONALIDADE** (ENT-08), exibida como cadeia: **1 Apelidos → 2 De-para do arquivo → 3 Padrão do template → 4 deixar em branco**.
- **De-para**: categoria do arquivo → categoria interna, com contagem de linhas afetadas por regra e opção "não mapeado".
- **Campos preenchidos por padrão neste template**: responsável, instituição, método de pagamento.
- Toggle "Criar apelido automaticamente para descrições novas repetidas".

**Aba 5 · Histórico** — importações feitas com este template (data, arquivo, linhas criadas/ignoradas/com erro).

**Criar a partir de um arquivo** (modal **M7**, 620px) — **NOVA FUNCIONALIDADE** (ENT-04): dropzone (CSV/XLSX, até 10 MB), lista do que foi **detectado automaticamente** com check/erro por item (formato e delimitador, linha do cabeçalho, formato de data, N de M colunas mapeadas, e o que ficou ambíguo — ex. "Convenção de sinal ambígua · ajustar na aba"), campo de nome, e ação **"Criar e abrir"** que leva direto ao detalhe.

### 2.2 Apelidos — arquétipo A + modal (ENT-05, 06, 07)

Lista: **Padrão no extrato** (chip do operador + padrão em mono) · **Vira** · **Campos preenchidos** · **Status** · menu. Toolbar com busca, filtro por campo preenchido e ordenação. **Paginação** (20/página, com seletor) em vez de scroll infinito — é tela de manutenção: o usuário edita e precisa voltar ao mesmo ponto.

- **O alerta "sem categoria" sai** (ENT-07): apelido que só normaliza a descrição é uma escolha legítima. A célula mostra "só a descrição" em itálico, sem cor de aviso.
- **Campos preenchidos** aparece como chips resumidos (`categoria`, `responsável`, `+2`).
- **"Sugerir com IA" removido** — não está implementado; não anunciar o que não existe.
- Edição sempre em **modal M1 (720px)** — a regra não cabe na linha:
  - **Gatilho**: operador (`contém`, `começa com`, `termina com`, `igual a`, `regex`) + padrão, com validação ao vivo; toggles **Diferenciar maiúsculas** e **Ignorar acentos**; **testador embutido** ("Testar com uma descrição" → veredito `casa` / `não casa`); **segundo gatilho** com combinador **E / OU** (ENT-06).
  - **Campos preenchidos** — **NOVA FUNCIONALIDADE**: tabela de **qualquer campo da transação**, cada linha com um `Switch` (ligue só o que quiser sobrescrever), o valor, e a política **Ao conflitar**: `sobrescrever` ou `só se vazio`. Campos desligados mostram "desligado — não toca neste campo". Link "Mostrar os N campos restantes da transação".
  - Escopo: toggles **"Aplicar em importações futuras"** e **"Aplicar retroativamente às transações já existentes"** (este último, desligado por default, roda em lote com resumo antes de aplicar).
  - Rodapé com "Excluir apelido" à esquerda, Cancelar e Salvar à direita.
- **Mesclar** disponível no menu da linha (modal M5 da Spec 68).

### 2.3 Conectores de IA — arquétipo A, **REFEITO COMO MCP** (ENT-09)

Propósito, explícito no cabeçalho: "Expõem os dados desta conta para a IA que você já usa, via MCP. **A plataforma não guarda chave de IA nem chama modelo nenhum.**"

Lista: **Cliente** (nome + URL do endpoint em mono) · **Escopo** · **Último acesso** · **Status** (`conectado` / `revogado`) · menu. Sem toolbar.

Abaixo da lista, dois cartões explicativos:
- **Como conectar** — a URL `mcp://myaccountant.app/<slug>` copiável e o aviso de que **o token aparece uma única vez**;
- **O que a IA vê** — chips de escopo (transações, categorias, projeção) com os fora de escopo esmaecidos (membros, auditoria) e a nota "Escopo de escrita ainda não disponível".

Ações do menu: renomear, **revogar** (irreversível, o cliente perde acesso na hora), reemitir token.

---

## 3. User Stories

- Como usuário, quero configurar a importação etapa por etapa e ver, a cada mudança, quantas linhas serão importadas e quais têm problema.
- Como usuário, quero jogar o CSV do banco na tela e ter delimitador, cabeçalho e formato de data detectados para mim.
- Como usuário, quero declarar como meu banco representa débito e crédito, em vez de inverter valores à mão depois.
- Como usuário, quero que a parcela "3/12" na descrição vire um grupo de parcelas automaticamente.
- Como usuário, quero que um apelido preencha responsável e método, não só a descrição.
- Como usuário, quero uma regra com duas condições e sem sensibilidade a acentos, e quero testá-la antes de salvar.
- Como usuário, quero paginar 132 apelidos e voltar ao mesmo ponto depois de editar um.
- Como usuário, quero saber quem ganha quando apelido e template discordam.
- Como usuário, quero conectar meu cliente de IA aos meus dados sem entregar chave de API a esta plataforma.

---

## 4. Critérios de Aceitação

**Templates:**
- A página DEVE ser master-detail com cinco abas: Arquivo, Mapeamento, Data e valor, Categorização, Histórico.
- O PREVIEW DEVE estar visível em todas as abas e reprocessar o arquivo de amostra a cada alteração de parâmetro, sem salvar.
- O PREVIEW DEVE exibir o placar de linhas prontas / com problema / ignoradas, e marcar visualmente linhas ignoradas e linhas com erro.
- O TEMPLATE DEVE suportar as três convenções de sinal, e a escolhida DEVE ser aplicada tanto no preview quanto na importação real.
- O TEMPLATE DEVE armazenar o arquivo de amostra e permitir trocá-lo.
- QUANDO a regex de parcela casar, A IMPORTAÇÃO DEVE criar o `InstallmentGroup` correspondente.
- A ordem de aplicação da categorização DEVE ser exatamente: apelidos → de-para do arquivo → padrão do template → em branco; E DEVE estar visível na aba.
- SE um template estiver quebrado (coluna mapeada ausente no arquivo de amostra), ELE DEVE aparecer sinalizado na lista mestre e no bloco "pedem atenção" do hub.
- QUANDO o usuário cria template a partir de um arquivo, O DIÁLOGO DEVE listar o que foi detectado e o que ficou ambíguo, E "Criar e abrir" DEVE abrir o detalhe com esses valores preenchidos.

**Apelidos:**
- A lista DEVE paginar (default 20/página, seletor de tamanho) e preservar a página ao voltar de uma edição.
- A lista NÃO DEVE exibir alerta para apelido sem categoria; DEVE exibir "só a descrição".
- NÃO DEVE existir ação "Sugerir com IA".
- A edição DEVE ocorrer em modal de 720px.
- O GATILHO DEVE suportar os operadores contém / começa com / termina com / igual a / regex, os flags de maiúsculas e acentos, e um segundo gatilho combinado por E ou OU.
- O TESTADOR DEVE informar se o padrão casa com a descrição digitada, sem salvar.
- CADA campo da transação DEVE poder ser ligado individualmente com valor e política `sobrescrever` | `só se vazio`; campo desligado NÃO DEVE ser alterado pelo apelido.
- SE "Aplicar retroativamente" estiver ligado ao salvar, O SISTEMA DEVE exibir quantas transações serão afetadas e exigir confirmação antes de aplicar.
- A ação "Mesclar" DEVE estar disponível no menu da linha.

**Conectores:**
- A página NÃO DEVE conter campo de chave de API de provedor de IA.
- CADA conexão DEVE exibir cliente, URL do endpoint, escopo, último acesso e status `conectado` | `revogado`.
- QUANDO uma conexão é criada, O TOKEN DEVE ser exibido uma única vez, com aviso explícito.
- QUANDO uma conexão é revogada, O ACESSO DEVE cessar imediatamente e a linha DEVE aparecer atenuada com "revogado em DD/MM".
- O cartão "O que a IA vê" DEVE listar os escopos concedidos e marcar os não concedidos como fora de escopo.
- Escopo de escrita NÃO DEVE ser oferecido.

---

## 5. Fora de Escopo

- Classificação automática por modelo de IA (a plataforma não chama modelo).
- Escopo de escrita no MCP.
- Conexão direta a bancos / Open Finance.
- Sugestão automática de apelidos a partir do histórico de importações.
- OFX/QIF e PDF de fatura — o template cobre CSV e XLSX.
- Importação de anexos/comprovantes.
- Editor visual de regex (o campo é texto com validação).

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Estrutura do template | Uma aba por etapa do parsing | O parsing É sequencial; a UI deve espelhar isso (ENT-01) |
| Preview | Fixo à direita, em todas as abas | Parsing sem preview é adivinhação (ENT-02) |
| Arquivo de amostra | Anexado ao template | Permite reprocessar sem novo upload e detectar quebra de layout do banco |
| Sinal | Três convenções explícitas | Cobre o que os bancos brasileiros de fato fazem (ENT-03) |
| Precedência | Cadeia visível de 4 passos | Torna o resultado previsível (ENT-08) |
| Apelido | Modal 720px com tabela de campos | A regra não cabe na linha; a tabela deixa explícito o que é tocado (ENT-05) |
| Ausência de categoria | Não é erro | É escolha legítima; alerta falso treina o usuário a ignorar alertas |
| Escala de apelidos | Paginação | Tela de manutenção precisa de posição estável, não de scroll infinito |
| Conectores | MCP, sem chave de IA | Descreve o que o produto realmente faz (ENT-09) |
| Token | Exibido uma vez | Padrão de segurança; nada de token recuperável |

---

## 7. Referências Técnicas

| Item | Arquivo(s) |
|---|---|
| Templates | `.../settings/templates/page.tsx`, **novos** `src/components/settings/templates/{TemplateList,FileTab,MappingTab,DateAmountTab,CategorizationTab,HistoryTab,LiveParsePreview}.tsx` |
| Criar de arquivo | **novo** `src/components/settings/templates/CreateTemplateFromFileDialog.tsx` + **nova** action `detectTemplateFromFileAction` |
| Apelidos | `.../settings/aliases/page.tsx`, **novos** `src/components/settings/aliases/{AliasTable,AliasDialog,TriggerEditor,FieldFillTable}.tsx` |
| Conectores | `.../settings/connectors/page.tsx`, **novos** `src/components/settings/connectors/{ConnectorTable,ConnectDialog}.tsx` |
| Parser | `src/lib/import/*` — extrair o parsing para ser chamável pelo preview **e** pela importação real (única fonte de verdade) |
| Motor de apelidos | `src/lib/aliases/apply.ts` — aplicar a mesma função na importação e no "aplicar retroativamente" |

### 7.1 Prisma

```prisma
enum SignConvention { signedColumn separateColumns typeColumn }
enum AliasOperator  { contains startsWith endsWith equals regex }
enum FillPolicy     { overwrite onlyIfEmpty }

model ImportTemplate {
  // ...
  fileFormat       String            // csv | xlsx
  encoding         String            @default("utf-8")
  delimiter        String            @default(",")
  textQualifier    String            @default("\"")
  skipTopRows      Int               @default(0)
  headerRow        Int               @default(1)
  skipBottomRows   Int               @default(0)
  dropEmptyRows    Boolean           @default(true)
  dropNonNumeric   Boolean           @default(true)
  skipPattern      String?
  columnMapping    Json
  dateFormat       String
  outOfMonthPolicy String            // keep | shiftToCompetence
  decimalSep       String            @default(",")
  thousandSep      String            @default(".")
  stripSymbols     String?
  signConvention   SignConvention    @default(signedColumn)
  invertSign       Boolean           @default(false)
  debitColumn      String?
  creditColumn     String?
  typeColumn       String?
  installmentRegex String?
  installmentColumn String?
  categoryMap      Json              // [{ fileValue, categoryId }]
  defaultResponsiblePartyId String?
  defaultInstitutionId      String?
  defaultPaymentMethod      String?
  autoCreateAliases Boolean          @default(false)
  sampleFileKey    String?           // NOVO — amostra persistida
  sampleRowCount   Int?
}

model Alias {
  // ...
  operator      AliasOperator @default(contains)
  pattern       String
  caseSensitive Boolean @default(false)
  ignoreAccents Boolean @default(true)
  secondOperator AliasOperator?
  secondPattern  String?
  combinator     String?         // AND | OR
  fills          AliasFieldFill[]   // NOVO — substitui os campos fixos
  applyOnImport  Boolean @default(true)
}

model AliasFieldFill {              // NOVO
  id      String @id @default(cuid())
  aliasId String
  field   String        // description | categoryId | responsiblePartyId | paymentMethod | ...
  value   Json
  policy  FillPolicy @default(onlyIfEmpty)
}

model McpConnection {              // substitui AiConnector
  id           String @id @default(cuid())
  accountId    String
  clientName   String
  endpointSlug String @unique
  tokenHash    String
  scopes       Json           // ["transactions","categories","forecast"]
  lastAccessAt DateTime?
  revokedAt    DateTime?
}
```

### 7.2 Parser único para preview e importação

```tsx
// ✅ Correto — a mesma função alimenta o preview e a importação real
const result = parseWithTemplate(sampleBuffer, templateDraft); // pure, sem I/O
setPreview({ rows: result.rows, ready: result.ready, errors: result.errors, skipped: result.skipped });

// ❌ Anti-padrão — preview "aproximado" com lógica própria
// (divergência entre o que o usuário vê e o que é importado é o pior bug possível aqui)
```

### 7.3 Aplicação de apelido com política por campo

```tsx
// ✅ Correto — política decide por campo; campo desligado não é tocado
for (const fill of alias.fills) {
  const current = tx[fill.field];
  if (fill.policy === "onlyIfEmpty" && current != null && current !== "") continue;
  tx[fill.field] = fill.value;
}

// ❌ Anti-padrão — sobrescrever tudo sempre, ou tocar campos não configurados
```

### 7.4 Restrições do design system

- Preview do parsing: `Paper variant="outlined"` + `Table size="small"`; linha ignorada com `bgcolor: "background.subtle"` e ícone `VisibilityOff`; linha com erro com `bgcolor: "warning.subtle"`.
- Convenção de sinal e visualizações: `RadioGroup` em cards `Paper variant="outlined"`.
- Padrão/regex em `TextField` com `sx={{ fontFamily: "monospace" }}` e validação por `InputAdornment` (`CheckCircle`/`Error`).
- Paginação com `TablePagination`.
- Chips de campo preenchido: `Chip size="small"`, com o ponto de cor da categoria quando aplicável.
- URL do MCP em `TextField` readOnly + `IconButton` de copiar + `enqueueSnackbar("Copiado")`.

---

## 8. Critérios de Teste

**E2E:**
- Criar template a partir de CSV do Nubank: detecção preenche formato, cabeçalho e data; "Criar e abrir" leva ao detalhe.
- Alterar "linhas a ignorar no rodapé" de 0 para 2 → placar do preview muda de 40 para 38 prontas.
- Selecionar convenção "débito e crédito em colunas separadas" e mapear as colunas → preview mostra sinais corretos; importar de verdade produz os mesmos valores do preview.
- Regex de parcela `(\d+)/(\d+)$` em "Notebook 3/12" → transação importada pertence a um `InstallmentGroup` com 12 parcelas.
- De-para "restaurante → Restaurante" tem precedência menor que um apelido que define outra categoria (verificar cadeia).
- Apelido: criar regra regex com dois gatilhos combinados por OU, testar no modal, salvar; importar arquivo → campos ligados preenchidos, campos desligados intactos.
- Apelido com "só se vazio": transação que já tem responsável não é alterada.
- Aplicar retroativamente: confirmação mostra o total e, após aplicar, as transações antigas refletem.
- Paginar apelidos até a página 3, editar um, salvar → volta na página 3.
- Conectar cliente MCP: token exibido uma vez; recarregar não mostra novamente; revogar → status revogado e acesso negado.

**Unit:**
- `parseWithTemplate`: encoding Latin-1, delimitador `;`, milhar `.`, decimal `,`, símbolo `R$`, linhas de rodapé, linha com data inválida.
- Três convenções de sinal, incluindo `invertSign`.
- `outOfMonthPolicy`: dia 28 numa fatura de competência do mês seguinte.
- Matching de apelido: acentos, maiúsculas, E/OU, regex inválida (não deve derrubar a importação).
- `applyFills`: políticas `overwrite` e `onlyIfEmpty` por campo.

---

## 9. Plano de Migração Incremental

1. Extrair o parsing atual para `src/lib/import/parseWithTemplate.ts` **puro** e fazer a importação real passar a usá-lo (sem mudança de comportamento). Pré-requisito de tudo.
2. Prisma: campos novos em `ImportTemplate`; `AliasFieldFill`; `McpConnection`. Backfill: apelido com categoria atual → uma linha `AliasFieldFill(categoryId, onlyIfEmpty)`; descrição → `AliasFieldFill(description, overwrite)`.
3. Templates: master-detail + abas 1 e 2 + `LiveParsePreview`.
4. Abas 3 e 4 (sinal, parcelas, de-para, precedência) — cada uma um commit.
5. Aba 5 Histórico.
6. `CreateTemplateFromFileDialog` + `detectTemplateFromFileAction`.
7. Apelidos: lista com paginação e status; remover alerta e "Sugerir com IA".
8. `AliasDialog` com `TriggerEditor` + `FieldFillTable`; depois "aplicar retroativamente" (feature flag).
9. Conectores: migrar `AiConnector` → `McpConnection`, tela nova, revogação.
10. `pnpm typecheck` + `pnpm test` + e2e a cada passo.
