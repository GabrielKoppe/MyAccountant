# Spec 10 — Importação CSV/XLSX

> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

## 1. Propósito

Define o fluxo de importação de extratos em CSV e XLSX para criar Finance Tables com Transactions em massa. Inclui templates salvos, mapeamento de colunas, preview obrigatório, e tratamento de erros.

## 2. Fluxo geral

```
[Upload arquivo]
       ↓
[Detectar formato + ler primeiras linhas]
       ↓
[Selecionar/criar template de mapeamento]
       ↓
[Mapear colunas (de → para)]
       ↓
[Preview com transformação aplicada]
       ↓
[Confirmar e salvar]
       ↓
[FinanceTable criada com transações]
```

## 3. Formatos suportados

- **CSV** — separadores `,` `;` `\t` (autodetect). Encoding configurável (`auto`/UTF-8/ISO-8859-1/Windows-1252), com auto-fallback UTF-8 → Windows-1252 (ver §8.3).
- **XLSX** — primeira sheet.

**Limites do MVP**:
- Tamanho máximo do arquivo: 5 MB.
- Linhas máximas: 5.000 (suficiente para um extrato anual generoso).

## 4. Templates de mapeamento

### 4.1 Conceito

Um **CsvTemplate** salva o mapeamento "este formato de arquivo do banco X corresponde a estas colunas do MyAccountant". Próxima vez que o usuário importar do mesmo banco, basta selecionar o template.

### 4.2 Estrutura

```ts
// CsvTemplate.mapping (JSON) — tipos em src/lib/schemas/csv-import.ts
{
  // Mapeamento de colunas do arquivo → campos do MyAccountant
  // Obrigatórios:
  columns: {
    date: "Data",              // nome da coluna no arquivo → occurredOn
    amount: "Valor",           // → amountCents (usado quando amountMode="single")
    // Colunas separadas de entrada/saída (usadas quando amountMode="creditDebit"):
    amountCredit: "Entrada(R$)", // → parte positiva do amountCents
    amountDebit: "Saída(R$)",    // → parte negativa do amountCents
    // Opcionais:
    description: "Descrição",  // → description
    notes: ["Data Contábil", "Nº do cartão"], // uma OU mais colunas → notes (ver nota)
    category: "Categoria",     // → categoryId (lookup por nome, criação configurável)
    subcategory: "SubCat",     // → subcategoryId (lookup dentro da category resolvida)
    institution: "Banco",      // → institutionId (lookup por nome)
    institutionText: "Banco",  // → institutionText (texto livre, sem FK)
    cardInstallment: "Parcela",// → cardInstallment (ex: "3/12")
    investmentType: "Tipo",    // → investmentType (texto livre)
    responsibleUser: "Nome no Cartão", // → responsibleUserId (lookup via responsibleUserMappings)
  },
  // Mapeamento de texto → userId para a coluna de responsável
  // Cada entrada: { text: valor literal na coluna, userId: id do membro na account }
  responsibleUserMappings: [
    { text: "GABRIEL KOPPE", userId: "clxxx..." },
    { text: "RAQUEL RACINE", userId: "clyyyy..." },
  ],

  // Configurações de parsing
  dateFormat: "DD/MM/YYYY",    // ou "DD/MM/YY", "YYYY-MM-DD", "MM/DD/YYYY"
  amountFormat: "brl",         // "brl" (1.234,56) ou "us" (1,234.56)
  amountSign: "raw",           // "raw" (mantém), "invert" (inverte), "abs" (absoluto)
  amountMode: "single",        // "single" (uma coluna com sinal) ou "creditDebit" (entrada − saída)
  csvDelimiter: ",",           // ou ";", "\t"
  hasHeader: true,
  skipRows: 0,                 // pular N linhas FÍSICAS no topo do arquivo ANTES da linha de cabeçalho
                               // (ex: os 8 blocos de metadados de um extrato C6 antes da tabela real)

  // Regras de filtragem
  ignoreEmptyRows: true,
  ignoreRowsWhere: [
    { column: "Descrição", contains: "Saldo anterior" },
  ],

  // Comportamento quando nome não é encontrado no cadastro
  defaultCategoryId: null,
  defaultInstitutionId: null,
  onCategoryNotFound: "create",      // "ignore" | "create" | "fail" — padrão: "create"
  onSubcategoryNotFound: "create",   // "ignore" | "create" — padrão: "create"
  onInstitutionNotFound: "ignore",   // "ignore" | "create" | "fail" — padrão: "ignore"
}
```

> **Comportamento padrão de criação automática**: quando `onCategoryNotFound = "create"`, categorias novas são criadas automaticamente via `upsert` (idempotente). Idem para subcategorias. Isso significa que importar o mesmo arquivo duas vezes não duplica categorias. Instituições ficam em `"ignore"` por padrão pois geralmente o usuário quer controlar o cadastro de bancos.

> **Nota sobre `institutionText` vs `institution`**: `institution` mapeia para um registro FK (cadastrado), `institutionText` é texto livre que não exige cadastro — útil quando o CSV tem muitos estabelecimentos não cadastráveis.

> **Nota sobre `responsibleUser`**: diferente dos outros campos, a coluna de responsável não faz lookup direto. O valor da célula (ex: "GABRIEL KOPPE") é cruzado com `responsibleUserMappings` para resolver o `userId`. Isso permite que um extrato de cartão com múltiplos portadores (titular + adicional) seja importado com cada transação já atribuída ao membro correto. Quando um membro ainda não existe na account, deixe o campo sem mapear — pode ser atualizado manualmente depois ou quando o membro entrar e o template for editado.

> **Nota sobre `skipRows` (linhas iniciais)**: muitos bancos exportam um bloco de metadados antes da tabela real (ex: o C6 emite 8 linhas — nome do extrato, agência/conta, período, linhas em branco — antes da linha de cabeçalho `Data Lançamento,Data Contábil,...`). `skipRows` é o número de **linhas físicas** a descartar do topo do arquivo **antes** de identificar a linha de cabeçalho. Ele é aplicado na **tokenização** (client), não como filtro de linhas de dados. Consequências:
> - O arquivo é tokenizado **uma única vez** em uma matriz crua (`string[][]`, `header:false`). A partir dela, `headers` e `rows` são derivados reativamente: com `hasHeader=true`, `headers = matrix[skipRows]` e os dados começam em `matrix[skipRows + 1]`; com `hasHeader=false`, gera-se `coluna_0…coluna_N` e os dados começam em `matrix[skipRows]`.
> - Como as `rows` enviadas ao servidor **já excluem** o preâmbulo, `applyMappingToRows` **não** re-pula linhas (itera a partir do índice 0). `skipRows` fica no `mapping`/template apenas como metadado de tokenização.
> - A **"Amostra do arquivo"** (Step de mapeamento) reflete `skipRows` em tempo real: mostra as primeiras linhas físicas cruas com as linhas puladas esmaecidas e a linha de cabeçalho destacada, além da tabela já derivada. Assim o usuário ajusta o número e vê o efeito imediatamente.

> **Nota sobre `amountMode` (origem do valor)**: extratos bancários costumam ter **duas colunas** de valor — `Entrada(R$)` (créditos) e `Saída(R$)` (débitos) — em vez de uma coluna única com sinal. O `amountMode` controla como o `amountCents` é montado:
> - `"single"` (padrão): lê `columns.amount`, respeitando o sinal do arquivo + `amountSign`.
> - `"creditDebit"`: `amountCents = entrada − saída`. Cada coluna (`columns.amountCredit`, `columns.amountDebit`) é lida **em módulo** (`abs`), então o sinal vem de qual coluna tem valor — entrada é positiva, saída é negativa. Depois aplica `amountSign` sobre o resultado (`invert` troca a convenção, `abs` força positivo). Basta mapear ao menos uma das duas colunas; a coluna vazia numa linha conta como 0. Se ambas estiverem vazias na linha, é erro de parse (linha pulada).
> - No wizard, um toggle **"Origem do valor"** (Coluna única / Entrada e saída) alterna quais campos de coluna aparecem no mapeamento. `amountMode` é salvo no template.

> **Nota sobre `notes` (múltiplas colunas)**: `columns.notes` é um **array** de nomes de coluna. Para cada linha, cada coluna com célula não-vazia vira uma linha `"NomeDaColuna: valor"` no campo `notes` da transação, juntadas por `\n`. Ex: mapear `Data Contábil` + `Nº do cartão` gera `notes = "Data Contábil: 04/01/2026\nNº do cartão: 1234"`. Colunas vazias na linha são omitidas; se nenhuma tiver valor, `notes = null`. O label usa o **nome original da coluna do arquivo**. No wizard é um multi-select (chips). Templates antigos que salvaram `notes` como string única são normalizados para array (`z.preprocess`).

### 4.3 CRUD de templates

Página: `/settings/templates`.

- **Criar**: form com todos os campos acima + preview com arquivo de teste.
- **Editar**: mesma tela.
- **Deletar**: confirmação simples.
- **Duplicar**: facilita criar variações.

### 4.4 Acesso

- Templates pertencem à **Account**.
- Owner e Editor podem criar/editar/deletar.
- Todos os membros podem **usar** templates (importar).

## 5. Fluxo de importação detalhado

### 5.1 Trigger
- Botão **"Importar CSV/XLSX"** no cabeçalho de cada Section no mês (ao lado de "Nova tabela").
- Abre o `ImportWizard` como Dialog independente (não passa pelo modal de Nova FinanceTable).
- A seção de destino vem pré-selecionada, mas pode ser trocada no Step de Configuração.

> **Nota de implementação**: o fluxo completo de import é gerenciado pelo `ImportWizard` (multi-step Dialog com MUI Stepper). O parse do arquivo acontece 100% no client (papaparse/xlsx) — nenhum arquivo é enviado ao servidor. O servidor recebe apenas as linhas parseadas (Record<string, string>[]) + o mapping, e re-executa o parsing para criar as transações de forma autoritativa.

### 5.2 Step 1 — Upload
- Input file (drag-and-drop ou click).
- Validação: extensão (.csv, .xlsx, .xls), tamanho ≤ 5 MB.
- O `File` selecionado fica no estado do wizard. A tokenização em **matriz crua** (`string[][]`, sem interpretar cabeçalho) roda num efeito via `parseFileToMatrix`: CSV via papaparse (`header:false`, delimitador auto-detectado) sobre o texto decodificado pelo `encoding`; XLSX via `sheet_to_json({ header: 1 })`.
- O efeito re-tokeniza quando o `encoding` muda (fecha o loop do seletor de encoding sem re-selecionar arquivo). A matriz resultante alimenta a derivação de `headers`/`rows` conforme `skipRows`/`hasHeader` (ver nota sobre `skipRows`).

> O servidor recebe as `rows` já derivadas (pós-`skipRows`) + o mapping, e re-aplica o parsing de data/valor de forma autoritativa.

### 5.3 Step 2 — Template
Opções:
- Selecionar template existente da Account.
- Criar novo template (avança para form de mapeamento).
- Importar sem template (avança direto, configurando inline).

### 5.4 Step 3 — Mapeamento (Step 2 no wizard atual)
Layout de **duas colunas** (colapsa para uma no mobile), com barra de **template salvo** full-width no topo e uma linha de intro.

- **Coluna esquerda — referência (amostra + leitura):**
  - **Amostra do arquivo** — tabela derivada (primeiras 5 linhas com os cabeçalhos corretos, pós-`skipRows`), com header fixo e scroll.
  - **Linhas do arquivo** (colapsável, badge "pulando N linhas") — primeiras ~12 linhas físicas cruas, `skipRows` iniciais esmaecidas/tachadas e cabeçalho destacado; controle "Pular linhas iniciais" + clique numa linha define o skip.
  - **Leitura do arquivo** (grupo) — `hasHeader`, `csvDelimiter`, `encoding` (só CSV). Ficam ao lado da amostra porque afetam o que ela mostra.
- **Coluna direita — mapeamento**, em grupos com card:
  1. **Data** — coluna de data + `dateFormat`.
  2. **Valor** — origem (toggle single / creditDebit) → `amount` ou `amountCredit`/`amountDebit`; abaixo, `amountFormat` (com chip de sugestão brl/us) + `amountSign`.
  3. **Categorização** — description, institution, category, subcategory (cada uma com switch "Criar automaticamente" quando mapeada).
  4. **Mais campos** (colapsável) — notes (multi), cardInstallment, investmentType, moeda estrangeira, responsável + mapeamento texto→membro.

> Cada grupo relacionado fica em um card com título (overline). O formato de data vive junto da coluna de data; formato/sinal do valor vivem junto do valor — nada de "seção de parsing" solta. `skipRows` fica só na amostra (controle visual).

**Validação ao avançar**:
- `date` e `amount` são obrigatórios.
- Demais opcionais.

### 5.5 Step 4 — Preview

Mostra as **5 primeiras linhas transformadas**, em formato de tabela do MyAccountant:

```
Linha | Data       | Valor     | Descrição          | Cat. | Status
------|------------|-----------|--------------------|----- |--------
  1   | 03/01/2026 | 234,56    | Supermercado       | -    | ✓ OK
  2   | 05/01/2026 | 25,00     | Uber               | -    | ✓ OK
  3   | -          | -         | (parse error)      | -    | ⚠ ERRO
```

Indicadores:
- ✓ OK — linha válida.
- ⚠ ERRO — não foi possível parsear (data inválida, valor não numérico, etc.).
- ⊘ IGNORADA — linha caiu em regra de `ignoreRowsWhere` ou linha vazia.

**Ignorar manualmente (toggle por linha)**: o ícone de status de uma linha **OK** é clicável — o usuário pode marcá-la para ser ignorada (ex: transação duplicada que já existe). Vira o ícone "não importar" (`DoNotDisturbOn`, warning) e a linha fica tachada/esmaecida; clicar de novo reativa. Linhas com **erro** ou já **ignoradas por regra** não são clicáveis (evita reintroduzir linhas inválidas). Os `rowIndex` escolhidos vão para `manualIgnoreRows` no `ExecuteImportInput`; o service os conta como `skipped` e não cria transação.

Toggles:
- ☐ Mostrar só erros

**Resumo**:
- "X linhas serão importadas, Y serão ignoradas, Z têm erros." (reflete as ignoradas manualmente)

### 5.6 Step 5 — Configurações finais

Layout centralizado (coluna estreita, `mx: auto`), com um `<Alert>` de resumo no topo e dois cards `FieldGroup`:
- **Destino** — nome da FinanceTable, seção destino, `tableType` (default: `manual`), e um preview do destino ("Vai criar: Seção › Nome"). Checkbox "Contar no total do mês" com hint.
- **Mapeamento** — ☐ Salvar este mapeamento como template (input nome) + hint.

> Mês destino vem do contexto (mês corrente do wizard), não é escolhido aqui.

### 5.7 Step 6 — Confirmação

**Modal**:
- "Você está prestes a importar X transações para [Nome do Mês] → [Section] → [Nome da Tabela]."
- "Linhas com erro não serão importadas (Y linhas)."
- Botão: "Confirmar importação".

### 5.8 Step 7 — Processamento

**Server Action** (não streaming no MVP, processamento simples):
1. Parse completo do arquivo no server.
2. Aplica template.
3. Para cada linha:
   - Validar com Zod (mesmo schema de Transaction).
   - Resolver `categoryId` se mapeado por nome (lookup).
   - Resolver `institutionId` idem.
4. Criar `FinanceTable` em uma `$transaction`.
5. `createMany` das `Transaction`s válidas.
6. Retornar `{ tableId, imported: N, skipped: M, errors: [{ row, message }] }`.

### 5.9 Step 8 — Resultado

Tela:
- ✓ Importação concluída.
- "X transações importadas em [Nome da Tabela]."
- Se houve erros: download de CSV com linhas que falharam + motivos.
- Botão "Ver tabela" leva para a FinanceTable.

## 6. Tratamento de erros

### 6.1 Erros bloqueantes (toda a importação falha)
- Arquivo corrompido / impossível de parsear.
- Header esperado não encontrado.
- Mapeamento inválido (ex: data e valor não mapeados).

### 6.2 Erros por linha (linha pulada, restante continua)
- Data não parseável.
- Valor não numérico.
- Subcategoria não pertence à categoria mapeada.

> **Política do MVP**: importa o que pode, reporta o que falhou. Não é "all-or-nothing".

### 6.3 Categoria / Instituição não encontrada
Opções (configurável no template):
- **Ignorar** — transação importada com `categoryId = null`.
- **Criar automaticamente** — cria Category/Institution com aquele nome.
- **Falhar a linha** — linha vai para erros.

Default: **Ignorar**.

## 7. Resolução de duplicatas

> Cenário: usuário importa o mesmo extrato 2x por engano.

**MVP**: não há detecção automática. Usuário pode revisar e deletar duplicatas manualmente.

**v2**: dedup baseado em `(occurredOn, amountCents, description)` com confirmação.

## 8. Parsing details

### 8.1 Datas
Formatos suportados (configurável, em `DATE_FORMATS`):
- `DD/MM/YYYY` — `03/01/2026`
- `DD/MM/YY` — `03/01/26`
- `YYYY-MM-DD` — `2026-01-03`
- `YYYY/MM/DD` — `2026/01/03`
- `DD-MM-YYYY` — `03-01-2026`
- `DD.MM.YYYY` — `03.01.2026`
- `MM/DD/YYYY` — formato US
- Excel serial date (XLSX) — converter automaticamente.

**Hora junto da data**: `parseDateString` descarta a parte de hora antes de parsear — `01/06/2026 10:26:53` e `2026-06-01T10:00` usam só a data (split no primeiro espaço ou `T`). Extratos costumam trazer timestamp.

Biblioteca: `date-fns/parse`.

### 8.2 Valores monetários

**Formato BRL** (`amountFormat: "brl"`):
- `1.234,56` → 123456 (centavos)
- `-1.234,56` → -123456
- `R$ 1.234,56` → 123456 (strip currency symbol)
- `1.234,56-` → -123456 (signal at end)
- `(1.234,56)` → -123456 (parênteses = negativo, padrão contábil)

> **Auto-detecção de formato**: `detectAmountFormat(values)` inspeciona a amostra das colunas de valor mapeadas e sugere `brl` ou `us` (o separador mais à direita é o decimal; só ponto com 3 dígitos após = milhar → brl). No Step de mapeamento aparece um chip clicável "Amostra parece US/BRL — aplicar" quando a sugestão difere do formato atual. Não altera nada sozinho — é sugestão.

**Formato US** (`amountFormat: "us"`):
- `1,234.56` → 123456
- `$1,234.56` → 123456

**Sinal**:
- `raw` — mantém o sinal do arquivo.
- `invert` — inverte (útil para CSVs de cartão onde despesas vêm negativas).
- `abs` — sempre positivo.

**Duas colunas (entrada/saída)** (`amountMode: "creditDebit"`):
- `entrada 5514.04` / `saída 0.00` → `551404` (positivo)
- `entrada 0.00` / `saída 249.00` → `-24900` (negativo)
- Cada coluna é parseada em módulo (`abs`); `amountCents = entrada − saída`; `amountSign` aplica sobre o resultado.
- Coluna vazia na linha = 0. Ambas vazias = erro de linha.

### 8.3 Encoding
- Controle `encoding` no mapping: `auto` (padrão), `utf-8`, `iso-8859-1`, `windows-1252`.
- `auto`: decodifica como UTF-8; se aparecer o caractere de substituição `�` (mojibake), refaz como Windows-1252. Cobre extratos BR exportados em Latin-1 (acentos quebrados).
- A decodificação usa `TextDecoder` sobre o `ArrayBuffer` do arquivo, antes do papaparse (ver `src/lib/import-file.ts`). Trocar o encoding no Step de mapeamento **re-tokeniza** o arquivo na hora (o `File` fica no estado do wizard).
- Só se aplica a CSV; XLSX carrega seu próprio encoding.

## 9. Server Actions

```ts
// src/actions/csv-import.ts — todas via defineAction

export const listTemplatesAction   // (accountId, {}) → CsvTemplate[]
export const createTemplateAction  // (accountId, CreateTemplateInput) → { id, name }
export const updateTemplateAction  // (accountId, UpdateTemplateInput) → { id, name }
export const deleteTemplateAction  // (accountId, { templateId }) → void
export const executeImportAction   // (accountId, ExecuteImportInput) → ImportResult
```

**Nota**: não há action de "previewImport" — o preview é feito 100% no client usando `applyMappingToRows` de `src/lib/csv-parser.ts`. O servidor só recebe as linhas já parseadas + o mapping, e re-aplica o parsing para a criação autoritativa das transações.

**`ImportResult`**:
```ts
{
  tableId: string;    // ID da FinanceTable criada
  imported: number;   // transações criadas com sucesso
  skipped: number;    // linhas ignoradas (vazias ou por regra)
  errors: { rowIndex: number; message: string }[];  // linhas com erro de parse
}
```

## 10. Validação (Zod) — schema real

```ts
// src/lib/schemas/csv-import.ts

export const importMappingSchema = z.object({
  columns: z.object({
    date: z.string().min(1),       // obrigatório
    amount: z.string().default(""),// obrigatório quando amountMode="single" (ver superRefine)
    amountCredit: z.string().optional(), // entrada — usado quando amountMode="creditDebit"
    amountDebit: z.string().optional(),  // saída  — usado quando amountMode="creditDebit"
    description: z.string().optional(),
    notes: z.preprocess(          // aceita string antiga → array; cada coluna vira "Nome: valor"
      (v) => (typeof v === "string" ? (v ? [v] : []) : Array.isArray(v) ? v : []),
      z.array(z.string()),
    ),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    institution: z.string().optional(),
    institutionText: z.string().optional(),
    cardInstallment: z.string().optional(),
    investmentType: z.string().optional(),
  }),
  dateFormat: z.string().default("DD/MM/YYYY"),
  amountFormat: z.enum(["brl", "us"]).default("brl"),
  amountSign: z.enum(["raw", "invert", "abs"]).default("raw"),
  amountMode: z.enum(["single", "creditDebit"]).default("single"),
  csvDelimiter: z.string().default(","),
  encoding: z.enum(["auto", "utf-8", "iso-8859-1", "windows-1252"]).default("auto"),
  hasHeader: z.boolean().default(true),
  skipRows: z.number().int().min(0).default(0),
  ignoreEmptyRows: z.boolean().default(true),
  ignoreRowsWhere: z.array(z.object({ column: z.string().min(1), contains: z.string().min(1) })).default([]),
  defaultCategoryId: z.string().cuid().nullable().default(null),
  defaultInstitutionId: z.string().cuid().nullable().default(null),
  onCategoryNotFound: z.enum(["ignore", "create", "fail"]).default("create"),
  onSubcategoryNotFound: z.enum(["ignore", "create"]).default("create"),
  onInstitutionNotFound: z.enum(["ignore", "create", "fail"]).default("ignore"),
  // Mapeamento texto da coluna responsibleUser → userId
  responsibleUserMappings: z.array(z.object({
    text: z.string().min(1),
    userId: z.string().cuid(),
  })).default([]),
})
// amount é obrigatório em "single"; em "creditDebit" exige ao menos uma das colunas entrada/saída
.superRefine((val, ctx) => { /* ver src/lib/schemas/csv-import.ts */ });

// ⚠️ Atenção TypeScript: schemas com .default() em objetos aninhados causam
// inferência do tipo INPUT (opcional) em vez do tipo OUTPUT quando usados com
// defineAction. Solução: exportar tipos com z.input<> e normalizar com
// importMappingSchema.parse() dentro do service.
export type ImportMapping = z.infer<typeof importMappingSchema>;    // tipo output (campos required)
export type ExecuteImportInput = z.input<typeof executeImportSchema>; // tipo input (campos opcionais)
```

## 11. Bibliotecas sugeridas

- **CSV parsing**: `papaparse` (já no allowlist do projeto).
- **XLSX parsing**: `xlsx` (SheetJS).
- **Date parsing**: `date-fns`.
- **Currency parsing**: handler próprio (regex + normalização).

## 12. Performance

- Para 5.000 linhas: processamento server-side deve completar em < 30s.
- Considerar background job (Vercel cron, Inngest) se passar disso.
- **MVP**: síncrono, com spinner.

## 13. Edge cases

- **Linha duplicada no arquivo**: importa todas (não há dedup no MVP).
- **Valor com vírgula sem decimal** (ex: `100,`): tratar como `100,00`.
- **Coluna com texto onde deveria ser número**: erro de linha.
- **Cabeçalho com nomes idênticos**: papaparse desambigua automaticamente (`Coluna`, `Coluna_1`).
- **Arquivo sem header**: configurar `hasHeader: false`, mapear por índice de coluna (`coluna_0`, `coluna_1`, ...).
- **Preâmbulo de banco antes da tabela** (ex: extrato C6 com 8 linhas de metadados): configurar `skipRows` = nº de linhas do preâmbulo. A linha de cabeçalho real passa a ser reconhecida e as colunas ficam mapeáveis. A "Amostra do arquivo" mostra o efeito em tempo real (ver §5.4).
- **Cabeçalhos duplicados/vazios na matriz derivada**: ao derivar `headers` de `matrix[skipRows]`, células vazias viram `coluna_<i>` e nomes repetidos são desambiguados com sufixo `_1`, `_2`, … (mesma semântica do papaparse com `header:true`).

## 14. Decisões em aberto

- [ ] Suporte a PDF (extratos de banco)? — **fora do MVP**, complexo.
- [ ] Importação direta via OFX/QIF? — **v2**.
- [ ] Importação programada (sync com banco via Open Finance)? — **v3+**.
- [ ] Templates compartilhados entre Accounts (community templates)? — **v3**.

## 15. Exemplos reais de CSV e XSLX 

- Para facilitar o desenvolvimento o coloquei dois exemplos reais na pasta `exemples`, caso seja pedido alguma senha é "108408".