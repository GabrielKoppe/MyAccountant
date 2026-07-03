# Spec 05 — Configurações da Account

> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

## 1. Propósito

Define a página de configurações da Account, onde owner/editor configuram a estrutura que será usada em todos os meses: sections, categories, institutions, tipos de tabela, e templates de import.

## 2. Estrutura da página

```
/settings (dentro de uma Account)
├── /general          — Nome da account, currency, month_start_day, default responsible
├── /sections         — CRUD de sections
├── /categories       — CRUD de categories + subcategories
├── /institutions     — CRUD de institutions
├── /table-types      — Gerenciamento de tipos de tabela e colunas visíveis
├── /templates        — CRUD de templates de CSV/XLSX
├── /members          — (definido em 04-accounts-and-members.md)
└── /account          — (definido em 04-accounts-and-members.md)
```

## 3. Acesso

| Página | Owner | Editor | Viewer |
|---|---|---|---|
| `/general` | ✅ | ✅ | ❌ |
| `/sections` | ✅ | ✅ | ❌ |
| `/categories` | ✅ | ✅ | ❌ |
| `/institutions` | ✅ | ✅ | ❌ |
| `/table-types` | ✅ | ✅ | ❌ |
| `/templates` | ✅ | ✅ | ❌ |
| `/members` | ✅ | ❌ | ❌ |
| `/account` | ✅ | ❌ | ❌ |

## 4. Sub-páginas

### 4.1 General (`/settings/general`)

**Edita `AccountSettings`**:
- Nome da Account (na verdade fica em `Account.name`, mas exibe aqui).
- `currency` (select com BRL/USD/EUR — MVP só BRL).
- `monthStartDay` (slider/input 1-31).
- `defaultResponsibleUserId` (select de membros).
- `invertSignOnMoveByDefault` (switch, default `true`) — controla se o modal de mover transações pré-seleciona "inverter sinal" quando origem e destino têm convenção de `countType` oposta. Ver **spec 59**.

> `monthStartDay` é crítico: define quando uma transação cai em um mês vs outro. Ver `skills/date-timezone/SKILL.md`.

### 4.2 Sections (`/settings/sections`)

**Listagem** (drag-and-drop para reordenar via `order`):
- Nome
- Count type (badge colorido: add=verde, subtract=vermelho, ignore=cinza, neutral=azul)
- Status (active/inactive)
- Ações (editar, desativar, deletar)

**Criar/Editar**:
- Nome (único por Account).
- Count type (radio).
- `isActive` (switch).

**Desativar**:
- Confirmação rápida.
- Comportamento descrito em `07-sections.md`.

**Deletar**:
- Só permite se não houver Finance Tables associadas em nenhum mês.
- Se houver, mostra "Desative em vez de deletar" e lista os meses afetados.
- Confirmação por digitação.

**Reordenação**:
- Drag-and-drop atualiza `order` em todas as sections em uma única action.

### 4.3 Categories (`/settings/categories`)

**Listagem hierárquica**:
- Category (com expansão para mostrar subcategories).
- Ações em ambos os níveis.

**Criar Category**:
- Nome (único por Account).

**Criar Subcategory**:
- Nome (único dentro da Category).

**Deletar**:
- Category com subcategories → cascade delete das subcategories.
- Transações com `categoryId` da deletada → `categoryId = null` (FK SET NULL).
- Confirmação por digitação.

### 4.4 Institutions (`/settings/institutions`)

**Listagem simples**.

**Criar/Editar**:
- Nome (único por Account).

**Deletar**:
- Transações com `institutionId` da deletada → `institutionId = null`, mas mantém `institutionText` se houver.
- Confirmação simples.

### 4.5 Tipos de Tabela (`/settings/table-types`)

Gerencia os **tipos de tabela** da Account. Cada tipo define quais colunas ficam visíveis nas Finance Tables que o utilizam.

**Listagem**:
- Nome do tipo
- Indicador de "Padrão" (badge) — para o tipo com `isDefault=true`
- Colunas ocultas (chips mostrando quais estão ocultas)
- Ações: editar colunas, renomear, deletar (exceto o tipo padrão)

**Tipo padrão (Manual)**:
- Criado automaticamente ao criar a Account
- `isDefault=true` — não pode ser deletado
- `hiddenColumns={}` — todas as colunas visíveis
- Pode ser renomeado

**Criar tipo**:
- Nome (único por Account)
- Seleção de colunas visíveis (switches)

**Editar tipo**:
- Renomear
- Ajustar colunas visíveis (switches por coluna)
- Não afeta tabelas existentes imediatamente — a coluna visível muda na próxima renderização

**Deletar tipo**:
- Não pode deletar se houver Finance Tables usando este tipo
- Confirmação obrigatória

**Colunas configuráveis por tipo**:
- `category` — Categoria
- `subcategory` — Subcategoria
- `institution` — Instituição
- `responsibleUser` — Responsável
- `isPending` — Pendente
- `notes` — Notas
- `cardInstallment` — Parcela do cartão
- `investmentType` — Tipo de investimento

**Colunas sempre visíveis** (não configuráveis):
- `occurredOn` — Data
- `amount` — Valor
- `description` — Descrição

**Tipos pré-criados com a Account**:
| Nome | Colunas ocultas |
|---|---|
| Manual (padrão) | nenhuma |
| Cartão de crédito | `investmentType` |
| Investimentos | `cardInstallment` |

### 4.6 Templates (`/settings/templates`)

**Listagem**: templates de CSV/XLSX salvos.

**Criar/Editar template**: ver `10-csv-xlsx-import.md`.

## 5. Defaults ao criar Account

Quando uma Account é criada (ver `04-accounts-and-members.md` §4.1), o sistema pré-popula:

### 5.1 Sections default
| Order | Nome | Count Type |
|---|---|---|
| 1 | Entradas | add |
| 2 | Saídas | subtract |
| 3 | Cartão | subtract |
| 4 | Investimentos | neutral |

### 5.2 Categories default
- Alimentação (subs: Mercado, Restaurante, Delivery)
- Transporte (subs: Combustível, Uber/Táxi, Manutenção)
- Moradia (subs: Aluguel, Condomínio, Contas)
- Saúde (subs: Plano de saúde, Medicamentos, Consultas)
- Lazer (subs: Streaming, Cinema, Viagem)

### 5.3 Institutions default
Vazio (usuário cadastra).

### 5.4 Tipos de tabela default

| Nome | `isDefault` | Colunas ocultas |
|---|---|---|
| Manual | `true` | nenhuma |
| Cartão de crédito | `false` | `investmentType` |
| Investimentos | `false` | `cardInstallment` |

## 6. Server Actions

```ts
// src/actions/account-settings.ts

export async function updateAccountSettings(accountId: string, data: UpdateAccountSettingsInput);
export async function createSection(accountId: string, data: CreateSectionInput);
export async function updateSection(accountId: string, sectionId: string, data: UpdateSectionInput);
export async function reorderSections(accountId: string, orderedIds: string[]);
export async function deactivateSection(accountId: string, sectionId: string);
export async function deleteSection(accountId: string, sectionId: string);
// ... idem para categories, institutions, templates

// Tipos de tabela
export async function createTableType(accountId: string, data: CreateTableTypeInput);
export async function updateTableType(accountId: string, tableTypeId: string, data: UpdateTableTypeInput);
export async function deleteTableType(accountId: string, tableTypeId: string);
```

Cada uma:
1. `requireAccountAccess(accountId)` com role `owner` ou `editor` (não viewer).
2. Validação Zod.
3. Transação no banco.
4. `revalidatePath()` apropriado.

## 7. Edge cases

- **Renomear Section em uso**: permitido. Não há impacto além da label.
- **Mudar countType de Section em uso**: permitido, mas recalcula totais de todos os meses afetados. Mostrar aviso.
- **Deletar Category com transações vinculadas**: transações ficam com `categoryId = null`. Não é destrutivo.
- **Default responsible removido como membro**: `AccountSettings.defaultResponsibleUserId` fica como NULL (FK SET NULL).

## 8. Decisões em aberto

- [ ] Permitir reordenar Categories e Subcategories? — **v2**, MVP ordena por nome.
- [ ] Cores customizadas por Section? — **v2**, MVP usa cor derivada do countType.
- [ ] Templates compartilhados entre Accounts (marketplace)? — **v3**.
