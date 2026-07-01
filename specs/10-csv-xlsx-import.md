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

- **CSV** — UTF-8, separadores `,` `;` `\t` (autodetect).
- **XLSX** — primeira sheet.
- **Encoding**: detectar via biblioteca (chardet ou similar). Default UTF-8 com BOM.

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
    amount: "Valor",           // → amountCents (parseado conforme amountFormat)
    // Opcionais:
    description: "Descrição",  // → description
    notes: "Observações",      // → notes
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
- Tokenização client-side do arquivo inteiro em uma **matriz crua** (`string[][]`, sem interpretar cabeçalho): CSV via papaparse (`header:false`, delimitador auto-detectado), XLSX via `sheet_to_json({ header: 1 })`.
- A matriz é guardada no estado do wizard; `headers`/`rows` são derivados dela conforme `skipRows`/`hasHeader` (ver nota sobre `skipRows`). Isso permite recalcular a amostra sem re-ler o arquivo.

> O servidor recebe as `rows` já derivadas (pós-`skipRows`) + o mapping, e re-aplica o parsing de data/valor de forma autoritativa.

### 5.3 Step 2 — Template
Opções:
- Selecionar template existente da Account.
- Criar novo template (avança para form de mapeamento).
- Importar sem template (avança direto, configurando inline).

### 5.4 Step 3 — Mapeamento (Step 2 no wizard atual)
Tela dividida:
- **Esquerda**: amostra do arquivo. Contém dois blocos:
  - **Linhas cruas** — primeiras ~10 linhas físicas do arquivo, com as `skipRows` iniciais esmaecidas/tachadas e a linha de cabeçalho destacada. Um controle numérico "Pular linhas iniciais" fica junto, para o usuário ajustar e ver o efeito na hora.
  - **Tabela derivada** — as primeiras 5 linhas de dados já com os cabeçalhos corretos (pós-`skipRows`).
- **Direita**: form de mapeamento em seções:
  1. **Template salvo** — select para aplicar mapeamento de um template existente (preenche o form automaticamente)
  2. **Colunas essenciais**: date *, amount *, description, category, subcategory, institution
  3. **Campos adicionais** (colapsável): notes, institutionText, cardInstallment, investmentType
  4. **Configurações de parsing**: dateFormat, amountFormat, amountSign
  5. **Opções avançadas** (colapsável): hasHeader, skipRows, csvDelimiter
  - Quando coluna de category/subcategory/institution é mapeada, aparece switch "Criar automaticamente se não encontrado"

> `skipRows` aparece em dois lugares (junto da amostra e nas opções avançadas) apontando para o mesmo campo do mapping — ambos refletem/atualizam o mesmo valor.

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
- ⊘ IGNORADA — linha caiu em regra de `ignoreRowsWhere`.

Toggles:
- ☐ Mostrar só erros
- ☐ Mostrar só linhas que serão importadas

**Resumo**:
- "X linhas serão importadas, Y serão ignoradas, Z têm erros."

### 5.6 Step 5 — Configurações finais

Antes de confirmar:
- Nome da FinanceTable.
- Section destino.
- Mês destino (default: mês corrente).
- `tableType` (default: `manual`).
- ☐ Salvar este mapeamento como template (input nome).

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
Formatos suportados (configurável):
- `DD/MM/YYYY` — `03/01/2026`
- `DD/MM/YY` — `03/01/26`
- `YYYY-MM-DD` — `2026-01-03`
- `MM/DD/YYYY` — formato US
- Excel serial date (XLSX) — converter automaticamente.

Biblioteca: `date-fns/parse`.

### 8.2 Valores monetários

**Formato BRL** (`amountFormat: "brl"`):
- `1.234,56` → 123456 (centavos)
- `-1.234,56` → -123456
- `R$ 1.234,56` → 123456 (strip currency symbol)
- `1.234,56-` → -123456 (signal at end)

**Formato US** (`amountFormat: "us"`):
- `1,234.56` → 123456
- `$1,234.56` → 123456

**Sinal**:
- `raw` — mantém o sinal do arquivo.
- `invert` — inverte (útil para CSVs de cartão onde despesas vêm negativas).
- `abs` — sempre positivo.

### 8.3 Encoding
- Auto-detect (UTF-8, ISO-8859-1, Windows-1252).
- Se falhar: pedir para o usuário re-exportar como UTF-8.

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
    amount: z.string().min(1),     // obrigatório
    description: z.string().optional(),
    notes: z.string().optional(),
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
  csvDelimiter: z.string().default(","),
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
});

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