# Spec 64 — Backup da Account (Export/Import JSON)

> Status: approved
> Insumo: solicitação do usuário (owner precisa de backup da conta) + incidente real de perda de dado em dev (2026-07-21, `down -v` global + seed contra o banco dev) · mapeamento do grafo account-scoped em `prisma/schema.prisma` · entrevista de refinamento de produto (2026-07-21)
> Skills: [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`api-routes`](../skills/api-routes/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`ui-feedback`](../skills/ui-feedback/SKILL.md)

---

## 1. Problema

- **BKP-01**: Não existe backup/export da **account inteira**. O único export é CSV por mês/ano (`src/app/api/v1/accounts/[accountId]/months/[monthId]/export/csv/route.ts`, `.../years/[year]/export/csv/route.ts`) — parcial (só transações de um período), não inclui estrutura (seções, categorias, instituições, orçamentos, patrimônio, dashboards, parcelamentos…) e **não é re-importável**. Se o owner perde dados (o incidente de 2026-07-21 mostrou que tooling de dev — `down -v` global e seed contra o banco errado — apaga tudo sem recuperação), não há de onde restaurar.
- **BKP-02**: Não existe **import** de uma foto completa da account. O CSV import (`src/actions/csv-import.ts` → `src/server/services/csv-import-service.ts`) só ingere **transações** linha-a-linha para uma tabela existente; não recria a estrutura da conta nem permite restaurar um backup.

---

## 2. Solução

Dar ao **owner** um par Export/Import que tira e restaura uma "foto" versionada em JSON de **toda** a account — **configuração trabalhosa E dados reais** (26 modelos account-scoped). Botões em **Configurações → Geral**.

- **BKP-01 — Export**: `GET /api/v1/accounts/[accountId]/export/json` (owner-only) baixa um arquivo `myaccountant-<slug>-<data>.json` com o snapshot completo. Valores `BigInt` → string, `Decimal` → string, datas `@db.Date` → `"YYYY-MM-DD"`.
- **BKP-02 — Import**: `POST /api/v1/accounts/[accountId]/import/json` (owner-only) recebe o JSON (lido no browser) e recria o grafo:
  - **Modo `new`** (padrão, seguro): cria uma account **vazia** (settings + membership owner, **sem** os defaults de onboarding) e insere o snapshot nela. Nunca toca na conta atual.
  - **Modo `overwrite`**: apaga os dados account-scoped da conta atual (ordem reversa do insert, na mesma transação) e reinsere o snapshot — mantendo `accountId`, membros e convites, e **restaurando também o nome da conta e as `AccountSettings`** a partir do snapshot. Exige confirmação por digitação do **nome atual** da conta.

### 2.1 Formato do snapshot (cópia completa: config + dados reais)

```jsonc
{
  "formatVersion": 1,
  "app": "myaccountant",
  "exportedAt": "2026-07-21T12:00:00.000Z",
  "account": { "name": "Minha Conta", "settings": { "currency": "BRL", "monthStartDay": 1, "invertSignOnMoveByDefault": false, "onboardingCompletedAt": "2026-01-01T00:00:00.000Z", "defaultResponsiblePartyId": "<id|null>" } },
  "data": { /* os 26 grupos abaixo */ }
}
```

`data` cobre **toda** a conta (nome pt-BR → chave técnica):

| Grupo (pt-BR) | Chave(s) em `data` |
|---|---|
| Responsáveis | `responsibleParties`, `responsiblePartyMembers` |
| Tipos de tabela | `tableTypes` |
| Seções | `sections` |
| Categorias / Subcategorias | `categories`, `subcategories` |
| Instituições | `institutions` |
| Tags | `tags` |
| Modelos de importação CSV | `csvTemplates` |
| **Meses** | `months` |
| Modelos de tabela | `tableTemplates`, `tableTemplateItems` |
| Parcelamentos | `installmentGroups`, `pendingInstallments` |
| Tabelas dos meses | `financeTables` |
| **Transações** (dado real) | `transactions`, `transactionTags`, `transactionLinks` |
| Apelidos | `transactionAliases`, `transactionAliasTags` |
| Metas | `budgets` |
| Visualizações (dashboards) | `dashboardLayouts` |
| Checklist mensal | `checklistItems`, `checklistCompletions` |
| Patrimônio (net worth) | `balanceAccounts`, `balanceSnapshots` |

Cada array guarda as linhas com seus **IDs de origem** (usados só para reconstruir o mapa de remap no import). A **análise** (gráficos/dashboards) é derivada das transações em tempo de render — não é armazenada; restaurar transações + configs de dashboard reconstrói a análise idêntica.

Modelos **excluídos** do snapshot: `Account`/`AccountMember`/`AccountInvite`, `User`/`UserSettings`, NextAuth (`OAuthAccount`/`Session`/`VerificationToken`), MCP (`McpClient`/`McpGrant`/`McpToken`/`McpAuthCode`), `PasswordResetToken`, `Notification`, `AuditLog`. Não há modelo de anexo/binário no schema (verificado: "anexo" é contagem de UI sobre campos já existentes — `src/components/transactions/attachments.ts`), nada a filtrar aí.

### 2.2 Remapeamento no import

Insere na **ordem topológica** (§7) dentro de **uma** `prisma.$transaction`, construindo um mapa `oldId → newId` (cuid novo) por modelo e reescrevendo **todas** as referências de ID:

1. **FKs reais** (ex.: `transaction.monthId/tableId/sectionId/categoryId/...`).
2. **Soft-refs** (colunas `String` sem relação Prisma declarada — fáceis de esquecer): `TableTemplate.autoSectionId`, `TableTemplate.autoTableTypeId`, `TableTemplateItem.categoryId/subcategoryId/institutionId`, `PendingInstallment.categoryId/subcategoryId`.
3. **Self-relation** `FinanceTable.sourceTableId` → inserir com `sourceTableId = null` e 2ª passada setando o id remapeado.
4. **IDs embutidos em blobs JSON** (invisíveis ao FK-remap — **deep-remap obrigatório**, verificado no código):
   - `DashboardLayout.widgets[].config`: `filterSectionIds`/`excludeSectionIds` (Section), `filterCategoryIds`/`categories` (Category), `filterInstitutionIds`/`institutions` (Institution), `filterTagIds`/`tags` (Tag), `filterMemberIds`/`responsible` (**ResponsibleParty**), `monthIds` (**Month**, via widget `analysis`). Widgets afetados: `kpi-custom`, `top-transactions`, `filtered-transactions`, `category-breakdown`, `analysis`.
   - `CsvTemplate.mapping`: `defaultCategoryId` (Category), `defaultInstitutionId` (Institution). `responsibleUserMappings[].userId` (User) → **dropado** (usuário não atravessa contas).
   - `Transaction.metadata.appliedAliasId` (TransactionAlias).
   - `TableType.hiddenColumns`: sem ids — tratado como opaco.
5. **Re-carimbo de usuário**: `createdById`/`updatedById`/`completedById` → o usuário que importa. `ResponsiblePartyMember` → **todos dropados** (usuários de origem não são membros do destino; o owner re-vincula pela UI — ver limitação §5). `Budget.memberUserId` → `null`. (`createdById` é `Restrict`, então precisa de um user id válido — o do importador.)

O deep-remap dos JSONs é **acoplado aos schemas de config** — se um widget novo ganhar um campo-id, o remap precisa ser atualizado (ver §6 DD-16 e teste de fidelidade na §8).

---

## 3. User Stories

- Como owner, quero exportar toda a minha conta (configs + meses + transações + patrimônio) em um arquivo JSON, para ter um backup que eu guardo por fora.
- Como owner, quero importar esse JSON como uma **conta nova**, para restaurar meus dados sem risco de sobrescrever nada.
- Como owner, quero (opcionalmente) **sobrescrever** a conta atual com um backup, para restaurar in-place quando eu tiver certeza.
- Como owner, quero que o import seja **atômico** e que dashboards/apelidos restaurados continuem funcionando, para não ficar com metade dos dados ou com visualizações quebradas.

---

## 4. Critérios de Aceitação

**BKP-01 — Export**

- QUANDO o owner aciona o export, O SISTEMA DEVE retornar um arquivo JSON (`Content-Disposition: attachment`) com `formatVersion: 1` e os grupos de `data`, filtrando por `accountId` da conta ativa.
- O export DEVE incluir **configuração**: categorias, subcategorias, apelidos, instituições, responsáveis, checklist mensal, tipos de tabela, modelos de tabela, metas, dashboards, tags, seções e modelos de CSV.
- O export DEVE incluir **dados reais**: meses, tabelas, transações (com tags e links), parcelamentos e patrimônio (balance accounts + snapshots).
- QUANDO o snapshot é serializado, O SISTEMA DEVE converter `BigInt` → string, `Decimal` → string e datas `@db.Date` → `"YYYY-MM-DD"`. NÃO DEVE emitir `BigInt` cru.
- QUANDO qualquer papel diferente de `owner` aciona o export, O SISTEMA DEVE responder 403 (`FORBIDDEN`).
- O snapshot NÃO DEVE incluir `AccountMember`, `AccountInvite`, `User`/`UserSettings`, tokens OAuth/MCP/reset, notificações nem audit-log.

**BKP-02 — Import**

- QUANDO o owner importa em modo `new`, O SISTEMA DEVE criar uma account nova (vazia, sem defaults de onboarding) pertencente ao usuário e inserir todo o snapshot nela, sem tocar em nenhuma outra account.
- QUANDO o owner importa em modo `overwrite`, O SISTEMA DEVE apagar os dados account-scoped da conta atual e reinserir o snapshot na **mesma** `accountId`, preservando conta/membros/convites, e **restaurando nome + `AccountSettings`** do snapshot; e DEVE exigir que o usuário digite o **nome atual** da conta como confirmação.
- QUANDO o import roda, O SISTEMA DEVE executar tudo numa única `prisma.$transaction`; SE qualquer passo falhar, DEVE reverter por completo (nenhum estado parcial).
- QUANDO o import recria o grafo, O SISTEMA DEVE remapear todas as referências de ID (FKs reais + soft-refs + self-relation + **ids dentro dos blobs JSON** de dashboard/mapping/metadata) para os novos IDs, e re-carimbar `createdById`/`updatedById`/etc. para o usuário que importa.
- SE `formatVersion` ≠ 1 ou o JSON não passar no schema Zod, O SISTEMA DEVE rejeitar com erro claro e NÃO gravar nada.
- SE o payload exceder o cap de tamanho (§6 DD-07), O SISTEMA DEVE rejeitar antes de processar.
- QUANDO qualquer papel diferente de `owner` aciona o import, O SISTEMA DEVE responder 403 (`FORBIDDEN`).

**Multi-tenancy**

- QUANDO o export lê dados, TODA query DEVE filtrar por `accountId`; o arquivo NÃO DEVE conter dados de outra account.
- QUANDO o import (modo `overwrite`) apaga/insere, DEVE operar **somente** na `accountId` da conta ativa; NÃO DEVE afetar outras accounts.

**Round-trip / fidelidade**

- QUANDO um export é reimportado (modo `new`), a nova account DEVE ter as mesmas contagens por modelo e vínculos (FKs) equivalentes ao original.
- QUANDO um dashboard/analysis com filtros por entidade (ex.: `analysis.monthIds`, `kpi-custom.filterSectionIds`, `filtered-transactions.categories`) é restaurado, os ids dentro do `config` DEVEM apontar para as entidades remapeadas (a visualização funciona igual). Idem `Transaction.metadata.appliedAliasId` → apelido remapeado.

---

## 5. Fora de Escopo

- **Anexos/arquivos binários** — não existem no schema; nada a exportar.
- **Membros, convites e usuários** — vínculos de identidade; não são portáveis entre contas/instalações.
- **Audit-log** — `targetId` é texto livre com IDs que ficariam obsoletos; fora do snapshot.
- **Backup agendado/automático** e **armazenamento no servidor** — o arquivo é baixado/enviado pelo owner; nada é guardado pelo app.
- **Criptografia do arquivo** — o JSON é texto claro; proteção fica com o owner.
- **Não substitui o backup de infraestrutura** — este é um backup **lógico do usuário**; a proteção do banco em produção (Neon PITR/snapshots) é independente e continua responsabilidade do deploy (spec 12).
- **Não substitui o CSV import/export (spec 10)** — complementar: CSV é por-transação/planilha; este é a conta inteira.
- **Compatibilidade entre versões divergentes de schema** — só `formatVersion: 1`; um snapshot de um schema futuro/incompatível é rejeitado, não migrado.
- **Merge/append** numa conta existente — só `new` (conta vazia) ou `overwrite` (substitui). Sem mesclagem.
- **Import por editor/viewer** — owner-only.
- **Vínculos `ResponsiblePartyMember`** — dropados no import (usuários não atravessam contas); o owner re-vincula manualmente. No modo `new`, a account é criada vazia (sem a party pessoal do owner) — considerar `ensurePersonalParty` pós-import como follow-up.

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Modos de import | `new` (padrão) + `overwrite` (confirmação por digitação) | `new` é seguro (nunca apaga); `overwrite` atende "restaurar in-place" com trava anti-acidente |
| DD-02 | Conta do modo `new` | Criada **vazia** (sem os defaults de onboarding) | Defaults colidiriam com o snapshot (`@@unique([accountId, name])` em section/category/tableType) |
| DD-03 | Entrega do export | Route handler **GET** com `Response` cru (não `defineRoute`) | Padrão dos exports CSV existentes (§7 do skill `api-routes`); download com `Content-Disposition` |
| DD-04 | Entrega do import | Route handler **POST** (não Server Action) | Server Action tem limite de corpo de 1 MB; uma account inteira pode passar disso |
| DD-05 | Atomicidade | Todo o import numa `prisma.$transaction` | Import parcial deixaria a conta corrompida; ou tudo ou nada |
| DD-06 | Remap de IDs | Novo `cuid()` por linha + mapa `oldId→newId`; 2 passadas para self-relation | IDs de origem não podem ser reusados (colisão / vínculo errado entre contas) |
| DD-07 | Cap de tamanho | Rejeita corpo > ~8 MB (ajustável) | Evita timeout/abuso; account típica cabe folgado |
| DD-08 | Versão | `formatVersion: 1`; ≠1 → rejeita. Sobe a cada mudança incompatível de schema | Evita importar formato incompatível silenciosamente |
| DD-09 | Owner-only | Export e import exigem `role === "owner"` (route + UI) | Operação de conta inteira; consistente com a Zona de Perigo |
| DD-10 | User-refs de terceiros | `ResponsiblePartyMember` de outros usuários dropado; `Budget.memberUserId` → null; `createdById` etc. → importador | Usuários da conta de origem podem não existir no destino (`createdById` é `Restrict`) |
| DD-11 | IDs em blobs JSON | **Deep-remap** dos campos conhecidos (dashboard config, CsvTemplate mapping, `metadata.appliedAliasId`) | FK-remap não enxerga ids dentro de Json; sem isso dashboards/analysis/aliases restaurados quebram |
| DD-12 | Escopo do `overwrite` | Restaura também **nome + AccountSettings** do snapshot; confirma digitando o nome **atual** | Restore fiel; a confirmação prova a intenção sobre ESTA conta |
| DD-13 | User-refs dentro de JSON | `CsvTemplate.mapping.responsibleUserMappings` (User) dropados; `filterMemberIds`/`responsible` (ResponsibleParty) remapeados; `userId` legado dropado | Mesma razão de DD-10 aplicada aos blobs |
| DD-14 | Delete do `overwrite` | Ordem reversa derivada da **mesma lista de modelos** do insert (fonte única) | Evita deixar linha órfã quando o schema crescer (lição do incidente do seed) |
| DD-15 | Serialização de dinheiro | JSON = string; decode via `z.coerce.bigint()`; `exchangeRate` Decimal = string | `BigInt`/`Decimal` não serializam nativo; coerce valida na entrada |
| DD-16 | Manutenção do deep-remap | Registro central dos campos-id por widget + teste de fidelidade que falha se um config novo tiver id não mapeado | O remap é acoplado aos schemas de config; precisa de um guard-rail |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Schema Zod do snapshot (todas as linhas + `formatVersion`) | `src/lib/schemas/account-backup.ts` (novo) |
| Service de backup (build + import + remap) | `src/server/services/account-backup-service.ts` (novo) |
| Deep-remap de ids em JSON (dashboard/mapping/metadata) | `src/server/services/account-backup-remap.ts` (novo — registro central por widget) |
| Criação de account **vazia** (modo `new`) | `src/server/services/account-service.ts` (novo `createBareAccount`) |
| Route export | `src/app/api/v1/accounts/[accountId]/export/json/route.ts` (novo — espelhar `.../months/[monthId]/export/csv/route.ts`) |
| Route import | `src/app/api/v1/accounts/[accountId]/import/json/route.ts` (novo — POST, owner-only, Zod, cap de tamanho) |
| UI (seção Geral) | `src/app/(app)/[accountId]/settings/general/AccountDataSection.tsx` (novo) + wire em `.../general/page.tsx` (entre `TourResetSection` e `AccountDangerZone`) |
| Download no client | reutilizar `src/lib/hooks/use-export-download.ts` |
| Leitura de arquivo no client | `await file.text()` + `JSON.parse` (padrão análogo a `src/lib/import-file.ts`) |
| Labels | `src/lib/messages/pt-BR.ts` (bloco `settings.backup`) |

### Ordem topológica de insert (import)

```
1 responsibleParties · 2 tableTypes · 3 sections · 4 categories · 5 subcategories · 6 institutions ·
7 tags · 8 csvTemplates · 9 months · 10 accountSettings(defaultResponsiblePartyId) ·
11 tableTemplates · 12 tableTemplateItems · 13 installmentGroups ·
14 financeTables (self-ref sourceTableId em 2ª passada) · 15 transactions · 16 transactionTags ·
17 transactionLinks · 18 transactionAliases · 19 transactionAliasTags · 20 pendingInstallments ·
21 responsiblePartyMembers (só do importador) · 22 budgets · 23 dashboardLayouts ·
24 checklistItems · 25 checklistCompletions · 26 balanceAccounts · 27 balanceSnapshots
```
**Delete (modo `overwrite`, sem apagar a Account)** = ordem **reversa** do insert, derivada da mesma lista (DD-14). Satisfaz os FKs `Restrict` (transações/tabelas/installmentGroups antes de sections/months).

### Deep-remap de JSON — campos por coluna

- `DashboardLayout.widgets[].config`: `kpi-custom` (`filterSectionIds`→Section, `filterCategoryIds`→Category, `filterMemberIds`→ResponsibleParty), `top-transactions` (`excludeSectionIds`→Section), `filtered-transactions` (`categories`→Category, `institutions`→Institution, `responsible`→ResponsibleParty, `tags`→Tag), `category-breakdown` (`filterTagIds`→Tag), `analysis` (`monthIds`→Month, `filterSectionIds`→Section, `filterCategoryIds`→Category, `filterMemberIds`→ResponsibleParty, `filterInstitutionIds`→Institution, `filterTagIds`→Tag).
- `CsvTemplate.mapping`: `defaultCategoryId`→Category, `defaultInstitutionId`→Institution; `responsibleUserMappings` dropado.
- `Transaction.metadata`: `appliedAliasId`→TransactionAlias.

### Serialização (encode/decode)

`BigInt` → string (`z.coerce.bigint()` no decode) · `Decimal(18,6)` → string · `@db.Date` → `"YYYY-MM-DD"` (decode `parseLocalDate`). Campos BigInt: `amountCents`/`originalAmountCents` (Transaction, TransactionAlias, TableTemplateItem), `totalCents`/`downPaymentCents` (InstallmentGroup), `amountCents` (PendingInstallment, Budget), `balanceCents` (BalanceSnapshot). Decimal: `exchangeRate` (Transaction, TransactionAlias). Datas: `occurredOn`, `startDate`, `expectedDate`, `capturedOn`.

### Nota — soft-refs a remapear (sem relação Prisma declarada)

`TableTemplate.autoSectionId`, `TableTemplate.autoTableTypeId`, `TableTemplateItem.{categoryId,subcategoryId,institutionId}`, `PendingInstallment.{categoryId,subcategoryId}`. São `String?` cruas — se não remapear, apontam para IDs inexistentes.

---

## 8. Plano de Implementação

> Executar após `Status: approved` (✔). Dev no container (`docker compose exec -T app ...`). Sem branch/worktree/git. Cada fase: implementa + testa + `typecheck`.

### 8.1 Padrões (reuso)

| Camada | Regra | Template |
|---|---|---|
| Multi-tenancy | Toda query filtra `accountId`; import opera só na account destino | `skills/multitenancy` |
| Dinheiro | `BigInt` centavos; string na fronteira; `z.coerce.bigint()` no decode | `skills/money-handling` |
| Route download | `Response` cru + `Content-Disposition` (não `defineRoute`) | `.../months/[monthId]/export/csv/route.ts` |
| Owner guard (route) | `requireAccountAccess` + `if (member.role !== "owner") throw new ForbiddenError(...)` | `settings/audit/page.tsx` |
| Owner guard (UI) | render condicional `role === "owner"` | `AccountDangerZone.tsx` |
| Confirm destrutivo | digitar nome da conta | `AccountDangerZone.tsx` |
| Download client | `useExportDownload().download(url)` | `src/lib/hooks/use-export-download.ts` |
| Feedback | `useActionFeedback`/`enqueueSnackbar` + `useTransition` | `skills/ui-feedback` |
| Zod | schema único + `z.infer` | `skills/forms-zod-rhf` |
| Modelos (fonte única) | Uma lista ordenada de modelos dirige insert **e** delete (reverso) | DD-14 |

### 8.2 Fases

**Fase 0 — Schema Zod do snapshot** · *Sonnet*
- `src/lib/schemas/account-backup.ts`: `accountSnapshotSchema` = `{ formatVersion: z.literal(1), app: z.literal("myaccountant"), exportedAt, account: {...}, data: { <26 arrays com row-schemas> } }`. Dinheiro `z.coerce.bigint()`, datas `z.string()`. Exportar `AccountSnapshot` type.
- **Testes**: parse snapshot válido; rejeita `formatVersion` errado; rejeita array faltando; aceita dinheiro string.
- **DoD**: typecheck + testes verdes.

**Fase 1 — Export (service + route)** · *Sonnet*
- `account-backup-service.ts` → `buildAccountSnapshot(accountId)` — lê os 26 modelos (`where: { accountId }`), serializa (BigInt/Decimal/Date). Sem incluir modelos excluídos. Dirigido pela **lista única de modelos** (DD-14).
- `export/json/route.ts` (GET): `requireAccountAccess` + owner assert → `buildAccountSnapshot` → `Response(JSON, { headers: Content-Type + Content-Disposition })`. Filename via `toAccountSlug` + data.
- **Testes**: service filtra accountId (conta B não vaza); route 403 p/ editor/viewer; snapshot inclui todos os grupos da §2.1.
- **DoD**: baixa JSON válido; owner-only.

**Fase 2 — Import (service + deep-remap)** · *Opus/Sonnet (lógica crítica)*
- `account-backup-remap.ts` → registro central: `remapWidgetConfig(widgetId, config, idMaps)`, `remapCsvMapping(mapping, idMaps)`, `remapTransactionMetadata(metadata, idMaps)`. Fonte única dos campos-id por widget (DD-11/DD-13/DD-16).
- `account-backup-service.ts` → `importSnapshot(snapshot, { mode, targetAccountId, userId })`:
  - valida `formatVersion`; monta `IdMap` por modelo.
  - `new`: `createBareAccount(userId, name)`; `overwrite`: wipe reverso + restaura account.name/settings.
  - insere na ordem topológica remapeando FKs (reais + soft-refs) + **deep-remap de JSON** + 2ª passada `sourceTableId` + re-carimbo de user + drop/null de user-refs.
  - tudo em `prisma.$transaction`. Retorna `{ accountId, counts }`.
- `account-service.ts` → `createBareAccount(...)`.
- **Testes**: round-trip (build→import `new`→contagens batem); **fidelidade JSON** (dashboard `analysis.monthIds`/`filterSectionIds` e `metadata.appliedAliasId` apontam para ids remapeados); remap soft-ref + self-relation; re-carimbo de user; overwrite apaga+reinsere+restaura nome/settings na mesma accountId; multi-tenancy; rollback em falha; **guard-rail** DD-16 (teste que percorre os configSchemas e falha se um campo-id novo não estiver no registro de remap).
- **DoD**: testes verdes; atomicidade coberta.

**Fase 3 — Import (route)** · *Sonnet*
- `import/json/route.ts` (POST): owner assert; cap ~8 MB (Content-Length → 413); `accountSnapshotSchema.safeParse(await req.json())` → `VALIDATION`; body `{ mode, confirmName?, snapshot }` (overwrite exige `confirmName === account.name` atual); chama `importSnapshot`; envelope `{ ok, data }` + mapeia `AppError`.
- **Testes**: 403 não-owner; 400 JSON inválido; overwrite sem `confirmName` correto → rejeita.
- **DoD**: import nos 2 modos via route.

**Fase 4 — UI** · *Sonnet*
- `AccountDataSection.tsx` (`role === "owner"`): botão **Exportar** (`useExportDownload`); botão **Importar** → `DialogShell`: `<input type="file" accept=".json">` → `file.text()`+`JSON.parse` (try/catch) → preview (nome + contagens) → escolher modo → se `overwrite`, `TextField` "digite o nome da conta" → POST → sucesso: snackbar + (`new`) trocar p/ nova conta / (`overwrite`) `router.refresh`.
- wire em `general/page.tsx`; bloco `settings.backup` em `pt-BR.ts`.
- **DoD**: light+dark; owner-only; fluxo completo.

**Fase 5 — Verificação** · *Sonnet*
- `docker compose exec -T app pnpm typecheck && pnpm lint && pnpm test`.
- Manual: export→import `new` (conta idêntica, dashboards funcionam); overwrite com confirmação (nome/settings restaurados); editor não vê botões.

### 8.3 Rastreamento

| Fase | Descrição | Modelo | Status |
|---|---|---|---|
| 0 | Schema Zod snapshot | Sonnet | ✅ |
| 1 | Export service + route | Sonnet | ✅ |
| 2 | Import service + deep-remap | Opus/Sonnet | ✅ |
| 3 | Import route | Sonnet | ✅ |
| 4 | UI (seção Geral) | Sonnet | ✅ |
| 5 | Verificação | Sonnet | ✅ |

### 8.4 Ordem de dependências

```
Fase 0 (Zod) ─┬─ Fase 1 (export) ───────────────────────────┐
              └─ Fase 2 (import service + deep-remap) ─ Fase 3 (import route) ─┬─ Fase 4 (UI) ─ Fase 5 (verificação)
                 (Fase 1 e Fase 2 podem ir em paralelo após a 0)               ┘
```
