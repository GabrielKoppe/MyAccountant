# Spec 61 — Apelidos de Transação

> Status: implemented (Fases 1–6 entregues em 2026-07; ver §9 para checklist e notas de revisão por fase). Extensão 2026-07-07: campos `isFavorite` (DD-21) e moeda estrangeira `originalCurrency`/`originalAmountCents`/`exchangeRate` (DD-22) + redesign do modal de criação (seções colapsáveis).
> Extensão 2026-07-07 (2) — melhorias de uso (Fase 7): (a) o ícone de apelido **acende sempre que há match** na descrição, tanto em modo edição quanto em **modo visualização** (remove o gate `descriptionDirty`, DD-23); no modo visualização a aplicação **persiste imediatamente** via `updateTransactionAction` + undo, reusando o mesmo popover; (b) botão **criar apelido a partir da transação** também na **linha editável** (DD-24); (c) botão **trocar gatilho ↔ descrição** no modal (DD-25); (d) **criação inline** (＋ Criar) de categoria/subcategoria/instituição habilitada no modal, em todos os contextos (DD-26).
> **Extensão 2026-07-22 — Fusão da spec 50 (Regras de Auto-categorização) no Apelido.** O Apelido absorveu os poderes da antiga `CategorizationRule` (que foi **removida**; spec 50 marcada `superseded`). Campos novos em `TransactionAlias`: **`triggerMode`** (`contains` padrão | `regex` — enum `AliasMatchMode`), **`priority`** (`high`|`medium`|`low` — enum `AliasPriority`, default `medium`), **`conditionInstitutionId`** (condição, ≠ do `institutionId` de ação), **`minCents`/`maxCents`** (faixa de valor, `BigInt`). O gatilho continua o núcleo (modo `contains`); regex + condição de instituição + faixa ficam numa seção **"Correspondência avançada"** (colapsável, fechada por padrão) no modal. **Desempate**: um apelido vence por `priority` (Alta>Média>Baixa) → gatilho normalizado mais longo → `updatedAt` (sem acúmulo/stopOnMatch — decisão de UX: 1 vencedor). `matchAlias` passou a receber `{ description, amountCents, institutionId }` e avaliar as condições (AND). Guarda anti-ReDoS (`src/lib/rules/safe-regex.ts`) valida o gatilho regex no salvamento. Migração `merge_rules_into_aliases`.
> Insumo: brief do desenvolvedor (2026-07-05) + revisão de código (âncoras re-verificadas em `src/`, `prisma/schema.prisma` — jul/2026) + revisão adversarial (arquitetura, formato, convenções) + entrevista de refinamento de produto (2026-07-06): decisões DD-08/DD-09 e DD-16..DD-20 confirmadas com o dev
> Skills: [`spec-writing`](../skills/spec-writing/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`mui-motion`](../skills/mui-motion/SKILL.md) · [`dark-mode`](../skills/dark-mode/SKILL.md) · [`ui-feedback`](../skills/ui-feedback/SKILL.md) · [`rsc-client-boundary`](../skills/rsc-client-boundary/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

- **ALIAS-01 (entrada manual repetitiva)**: lançamentos recorrentes com a mesma descrição exigem redigitar o mesmo conjunto de campos toda vez. Ex.: "Sistema de Gás" sempre é categoria "Conta", responsável X, `expenseType = fixed`, 2 tags, valor fixo. Hoje o usuário preenche célula a célula em `src/components/transactions/NewTransactionRow.tsx` (descrição em `:247-255`, categoria em `:259-272`, responsável em `:355-361`, `expenseType` em `:392-416`, tags só via edição posterior — célula vazia na criação `:422`) e em `src/components/transactions/TransactionRowEditor.tsx`. Não há reuso de um "modelo" de lançamento.

- **ALIAS-02 (import não aplica padrões repetidos)**: a importação CSV/XLSX cria transações "cruas" e o usuário re-categoriza/re-taggeia em massa depois. O pipeline autoritativo `createMany` em `src/server/services/csv-import-service.ts:367-392` **não grava** `tags`, `expenseType`, `paymentMethod` nem `isPending` — o objeto `PreviewRow.parsed` (`src/lib/csv-parser.ts:65-79`) sequer possui esses campos. Descrições que se repetem entre extratos (ex.: "CEG GAS SA") não recebem tratamento consistente.

- **ALIAS-03 (não é possível capturar um lançamento como modelo)**: um lançamento já preenchido corretamente não pode ser transformado em modelo reutilizável. O único atalho existente é duplicar a transação (`handleDuplicate` em `src/components/transactions/TransactionRow.tsx:234-241`), que copia uma vez e não persiste um padrão.

---

## 2. Solução

Introduzir a entidade **`TransactionAlias`** (por Account): um **gatilho** de texto associado a um conjunto de valores-alvo de campos de transação. Quando o gatilho aparece na descrição de uma transação (entrada/edição manual **e** importação), o sistema oferece aplicar o apelido, sobrescrevendo os campos definidos.

> **Fronteira de escopo (crítica — não confundir com a Spec 50).** A Spec 50 (`regras-auto-categorizacao`, `draft`, **não implementada**) propõe um **motor de regras if-then automático** com prioridade, `stopOnMatch`, condições ricas (`contains`/`regex` + instituição + faixa de valor) que roda **silenciosamente** no import e opcionalmente na criação manual. Apelidos são o **oposto em intenção**: nascem de uma decisão **deliberada e nomeada** do usuário ("apelidar esta descrição") e só se aplicam **com confirmação explícita** (popover na linha manual; marcação visível + reaplicação autoritativa no import). Não há motor de prioridade, regex, nem faixa de valor. Apelido faz **match direto de substring** na descrição. As duas features podem coexistir; a precedência quando ambas tocarem o mesmo campo fica registrada na §6 (apelido, por ser intencional, tem precedência). **Esta spec não implementa nada da Spec 50.**

### 2.1 Entidade + join de tags (ALIAS-01, ALIAS-02, ALIAS-03)

`TransactionAlias` tenant-scoped, espelhando o slice de `ResponsibleParty`. Campos-alvo **todos opcionais** (patch parcial): o usuário escolhe quais o apelido define. Tags via join próprio `TransactionAliasTag`. Ver modelo em §7.

- **Gatilho (`trigger`) é obrigatório e distinto do payload**: o gatilho é o campo separado que dispara o match; a `description` do payload é o texto que substituirá a descrição da transação ao aplicar. São **campos diferentes** (o gatilho pode ser "CEG" e a `description` "Sistema de Gás"). No Zod: `trigger` é `.trim().min(1)` (não-vazio); os campos de payload são opcionais.
- **Aviso de gatilho curto (DD-19)**: gatilhos com menos de 3 caracteres casam quase toda descrição. O form exibe um **aviso não-bloqueante** ("gatilho curto pode casar demais") quando `trigger.trim().length < 3`. Não é erro de validação — o Zod aceita (o risco de falso-positivo é do usuário, DD-02); é só um empurrão de UX no form.
- **`institutionId` vs `institutionText`**: mutuamente exclusivos com prioridade de `institutionId` (espelha a regra da `Transaction`, Spec 01 §3.9). Validar no Zod (`.refine`): não definir os dois no mesmo apelido.
- **Consistência categoria/subcategoria (DD-18)**: o sistema **não** valida em lugar nenhum que a subcategoria pertence à categoria (nem DB, nem Zod, nem service — verificado). O apelido **espelha a regra da linha** (`NewTransactionRow.tsx:261-264`): (a) no form, o seletor de subcategoria é **escopado à categoria escolhida** (desabilitado sem categoria; reseta ao trocar), e o Zod tem `.refine` de backstop — `subcategoryId` definido ⇒ `categoryId` definido **e** é o pai da subcategoria; (b) **ao aplicar** (manual e import), se o apelido define/troca `categoryId` e a subcategoria vigente na transação **não** for filha da nova categoria, a subcategoria é **limpa** — igual ao reset que a linha já faz. Impede órfãos introduzidos pelo patch parcial (DD-04).

Semântica de **patch parcial** (decisão de design, §6): um apelido **só define valores; nunca limpa**. Coluna `null` no apelido = "campo não faz parte do patch" = deixa a transação intacta. Não existe "definir como vazio" — para limpar um campo o usuário edita a transação manualmente. Para tags: apelido com **≥1 tag** substitui o conjunto de tags da transação; apelido com **0 tags** não toca nas tags.

### 2.2 Semântica de match (ALIAS-01, ALIAS-02)

- **Substring, case-insensitive.** O gatilho dispara se `descriçãoNormalizada.includes(gatilhoNormalizado)` (ambos em lowercase). Responsabilidade do usuário gerir gatilhos curtos/ambíguos; documentar o risco de falso positivo (§5).
- **Desempate** (obrigatório, manual e import) quando múltiplos apelidos casam a mesma descrição: vence o de **gatilho mais longo**; empate → **`updatedAt` mais recente**.
- A regra vive em **uma função pura** `matchAlias(description, aliases)` (`src/lib/aliases/match.ts`) reusada por UI (client) e import (client preview + server autoritativo). Chaves são **pré-normalizadas** (coluna `triggerNormalized` em lowercase); a função lowercaseia a descrição **uma vez** e faz **uma passada** de filtro — sem lookup por caractere nem chamada ao servidor.
- **Normalização simétrica**: gatilho e descrição usam a **mesma** normalização (apenas `toLowerCase()`, sem trim/acento/Unicode fold — substring literal). `triggerNormalized` é gravado lowercase no service; a descrição é lowercased em runtime.
- **Determinismo do dual-run**: `matchAlias` é determinística **dada a mesma lista de apelidos**. Para o desempate por `updatedAt` bater nos dois lados, `AliasCandidate.updatedAt` DEVE ser sempre a mesma string UTC (`Date.toISOString()`), produzida pelo serializer único (§7). O match roda sobre a descrição **antes** de qualquer payload (o payload pode conter uma nova `description` — DD-04 — mas isso **não** realimenta o match).

### 2.3 CRUD em Settings (ALIAS-01)

- Rota `src/app/(app)/[accountId]/settings/aliases/` (page server + manager client) espelhando `settings/responsibles/`. Link novo em `src/app/(app)/[accountId]/settings/layout.tsx` (`editorLinks`, `:24-36`).
- **Formulário reutilizável** `TransactionAliasFormDialog` (baseado em `DialogShell`), compartilhado entre o settings e a criação-a-partir-de-transação (§2.5) — **DRY**. Editores de campo reusam `CreatableEntitySelect` (categoria/subcategoria/instituição), `ResponsiblePartySelect` (responsável), `ToggleButtonGroup` (`expenseType`), editor de tags (padrão `TagPopover`/`TagEditor`) e input monetário com máscara BRL (`money-handling`).
- **Dependências invertidas por props (obrigatório p/ DRY)**: `CreatableEntitySelect` já recebe `options`/`onCreate`/`canCreate` por props (não usa `useOptions`), então o dialog é reutilizável fora do `OptionsProvider`. O `TransactionAliasFormDialog` DEVE receber por props: as listas (`categories`, `subcategories`, `institutions`, `responsibleParties`, `tags`), os callbacks `onCreate*` e `canManageOptions`, além de `initialValues` e `onSubmit`. Em Settings essas deps vêm dos loaders da própria página; na criação-a-partir-de-transação vêm das props que o `TransactionTable` já possui. **Não** acoplar o dialog a `OptionsContext`.
- **Criação inline habilitada (DD-26)**: os 3 `CreatableEntitySelect` (categoria/subcategoria/instituição) recebem `onCreateCategory`/`onCreateSubcategory`/`onCreateInstitution` (opcionais) + `canCreateOptions`; quando presentes, a opção "＋ Criar 'X'" aparece (`canCreate = canCreateOptions && !!onCreate*`, subcategoria também `&& !!categoryId`). O dono da **lista de opções** é o pai (mesmo padrão do `TransactionTable`): o callback cria no server e **atualiza a lista** que volta ao dialog por prop, então a opção nova aparece e o display selecionado resolve. Na criação-a-partir-de-transação os callbacks vêm de `useOptions()` (via `TransactionRow`, já sob `OptionsProvider`); em Settings → Apelidos, a `Manager` sobe `categories`/`institutions` para state e provê callbacks que chamam as mesmas actions (`createCategoryAction`/…). Sem callbacks → fallback ao comportamento antigo (sem ＋ Criar).
- **Trocar gatilho ↔ descrição (DD-25)**: `IconButton` (`SwapVertIcon`) **inline no `endAdornment` (canto direito) do campo Gatilho** que troca os dois valores no form (`getValues`/`setValue`, com `shouldValidate`/`shouldDirty`). Colocá-lo entre os dois campos abria um buraco no fluxo do formulário (ajuste pós-feedback do dev). Atalho para o fluxo comum de criar-a-partir-de-transação, onde a descrição vem pré-preenchida e o usuário quer usá-la como gatilho (ou vice-versa) sem redigitar. Gatilho é `min(1)`; a descrição pode ser vazia → ao trocar, uma descrição vazia vira gatilho vazio (o form barra no submit, comportamento correto).
- `EmptyState`, `PageHeader`/`PageSettingsContainer`, `StatusBadge` (arquivado) conforme DS. Feedback via `useSnackbar` (`ui-feedback`).

### 2.4 Aplicação manual na linha (ALIAS-01)

Detecção via **ícone no campo descrição + Popover de preview + undo por snackbar** (recomendação do auditor UX; autocomplete / sublinhado in-text / chip descartados por prevenção de erro, a11y e layout shift).

- **Ícone** no `endAdornment` do `TextField` de descrição (`NewTransactionRow.tsx:247-255`; `TransactionRowEditor.tsx:177-187`): oculto sem match; fade-in (`<Fade>`, token `mui-motion`, só `opacity`) ao casar; cor `accent.primary` (é affordance de UI — **não** verde/mostarda, não é informação financeira). Ícone: `AutoFixHighOutlinedIcon` (evitar `FlashOn`, já usado em `expenseType`).
- **Popover** (espelhar `src/components/tags/TagPopover.tsx:42-60`) listando **apenas os campos que mudam**: valor atual riscado (`text.disabled`) → valor novo (`text.primary`). Ids resolvidos para nomes via as mesmas fontes que a linha usa: categoria/subcategoria/instituição pelas **listas de opções que a linha recebe por prop** (não via `OptionsContext`, que só expõe callbacks); responsável via a lista de parties da linha; `expenseType`/`paymentMethod` via `src/lib/messages/pt-BR.ts`. Rodapé: `Button variant="contained"` "Aplicar" + `Button variant="text"` "Cancelar". **Não usar `DialogShell`/modal** aqui — quebraria a entrada rápida inline; o popover já é a confirmação.
- **Undo**: snapshot do estado local **antes** de aplicar; ao aplicar, `enqueueSnackbar("Apelido '{gatilho}' aplicado — N campos atualizados", { action: "Desfazer" })` restaura o snapshot. Nada persiste até **Salvar** a linha.
- **Valor / sinal (DD-20, money-handling)**: quando o apelido define `amountCents`, a aplicação manual grava o valor em centavos **com o sinal cru capturado** (verbatim) no estado local. O sinal é **relativo à convenção da seção** (`src/lib/money.ts:5-11`: só seções `subtract` invertem a exibição; `normalizeAmountOnMove` negocia o sinal ao mover entre convenções). **Não** há lógica de inversão na aplicação: como o resultado é WYSIWYG no estado local + undo, o usuário vê o valor exibido na linha antes de Salvar e ajusta se ficar com sinal estranho. (No import o `amountCents` do apelido **não** é aplicado — DD-09.)
- **Consistência categoria/subcategoria ao aplicar (DD-18)**: se o apelido define/troca `categoryId`, a subcategoria vigente é limpa quando deixa de ser filha da nova categoria (ver §2.1). Aplicado no snapshot local antes do Salvar.
- **Detecção debounced** (250–300ms), 100% client, sem chamada ao servidor por tecla. Os apelidos chegam à linha pela árvore do `TransactionTable` (onde a linha vive) — **via prop** (não estender `OptionsContext`, que é callbacks-only; ver DD-10). O caminho de import é **separado** (§2.6).
- **Após aplicar**, a `description` pode mudar (DD-04) e casar **outro** apelido; a detecção recomputa sobre a nova descrição (o ícone pode reacender). Não há laço porque a aplicação nunca é automática — sempre exige clique em "Aplicar".
- **Validar em light E dark** (ícone `accent.primary`, popover): `skills/dark-mode`.
- **Editor (DD-23, revê a decisão original)**: o ícone acende **sempre que há match**, inclusive no mount — sem o gate `descriptionDirty`. A regra antiga ("só após editar a descrição nesta sessão") gerava fricção real: para ver a sugestão numa transação já casada o usuário tinha de entrar em edição e alterar a descrição para disparar o gatilho. Como a aplicação **nunca é automática** (sempre exige clique em "Aplicar"), acender no mount é affordance, não risco.
- **Modo visualização (DD-23)**: a linha **salva** (não em edição) também exibe o ícone ao lado da descrição quando há match (mesma UI/interação do editor: hover→tooltip, clique→`AliasSuggestionPopover` com o preview atual→novo e botões Aplicar/Cancelar). ⚠️ **Contenção de eventos**: o popover é filho (na árvore React) da célula de descrição, que no modo visualização tem `onClick={startEdit}`; sem `stopPropagation` no `onClick` do popover (e no `onClick` do ícone), clicar "Aplicar" borbulha e abre a edição indevidamente. O `AliasSuggestionPopover` faz `stopPropagation` de click **e** de Enter/Escape. A diferença é a persistência: como não há passo "Salvar" no modo visualização, **Aplicar persiste imediatamente** via `updateTransactionAction` (otimista + `onOptimisticUpdate`), com **snackbar "Desfazer"** que reverte pelo mesmo caminho (re-aplica os valores antigos). Só disponível para não-viewers (aplicar muta dado). `amountCents`/`isPending`/etc. seguem o mesmo `computeAliasApplication` do editor; tags continuam fora (§2.4 nota de escopo). O match aqui é direto sobre `tx.description` (estático — sem debounce; o `useAliasMatch` debounced continua só nos editores, onde a descrição muda por tecla).
- **Risco de teclado (obrigatório)**: `onKeyDown` da `TableRow` captura Enter→salvar / Escape→cancelar (`NewTransactionRow.tsx:225-228`; `TransactionRowEditor.tsx:149-154`). O `Popover` renderiza em portal, mas eventos React re-propagam pela **árvore de componentes** — Enter/Escape dentro do popover borbulham até a `TableRow`. Tratar com `stopPropagation` no `onKeyDown` do popover **e** guard `if (aliasPopoverOpen) return` no `onKeyDown` da linha (defesa em profundidade).

### 2.5 Criar apelido a partir de transação (ALIAS-03)

- Botão novo no bloco **editor-only** de `src/components/transactions/TransactionRowActions.tsx:160-195` (+ prop em `:22-35`, wiring em `TransactionRow.tsx:578-591`, handler análogo a `handleDuplicate:234-241`). Ícone sugerido: `BookmarkAddOutlinedIcon`.
- Abre `TransactionAliasFormDialog` (o **mesmo** form da §2.3) **pré-preenchido** com os campos atuais da transação e com o **gatilho vazio** para o usuário nomear.
- **Também na linha editável (DD-24)**: o mesmo botão aparece na célula de ações de `TransactionRowEditor.tsx` (ao lado de Salvar/Cancelar), capturando os **valores em edição** (`editValues` + `localTags` — WYSIWYG, não os valores salvos), via prop `onCreateAlias` repassada por `TransactionRow`. O `TransactionAliasFormDialog` é renderizado tanto no branch de leitura quanto no de edição (nó extraído/compartilhado), pois `TransactionRow` retorna cedo o editor quando `editing`.

### 2.6 Integração com import (ALIAS-02)

Chave de arquitetura: o pipeline roda `applyMappingToRows` **duas vezes** (client preview em `ImportWizard.tsx:203`; server autoritativo em `csv-import-service.ts:117`), e o client envia as **linhas cruas** + `mapping` — o server **re-parseia**. Portanto o único ponto que precisa ser idêntico nos dois lados é o **match** (determinístico). A **aplicação do payload** acontece onde os dados vivem (client para exibir; server para persistir), usando os IDs que o próprio apelido já guarda — sem resolver nome↔id no parser puro.

- **Match no parser (puro, dual-run)**: `applyMappingToRows(rows, mapping, aliases?)` ganha um parâmetro opcional `aliases` (default `[]` — retrocompatível) e escreve **apenas** `parsed.appliedAliasId: string | null` por linha (via `matchAlias`), **somente** quando `parsed` existe (linhas `status: "error"` não têm `parsed`). Nada mais muda no parser.
- **Como o `ImportWizard` recebe os apelidos + nomes denormalizados (P1, DD-08)**: ⚠️ o `ImportWizard` **não** está sob o `OptionsProvider` (montado só dentro de `TransactionTable`) — é renderizado por `SectionView` (árvore irmã) e hoje recebe por prop apenas `accountId`, `monthId`, `sections`, `tableTypes`, `members`, `preSelectedSectionId` (**verificado** em `SectionView.tsx:242-249`). **Não recebe `categories`/`institutions`.** Logo o wizard não tem como resolver `alias.categoryId`→nome para o preview WYSIWYG. **Correção**: o apelido chega ao wizard **por prop** (`SectionView`→`ImportWizard`), e o **serializer** (`serializeTransactionAlias`, §7) carrega os **nomes denormalizados** (`categoryName`, `subcategoryName`, `institutionName`, `responsiblePartyName`, e as tags com nome) além dos ids. Assim o preview renderiza rótulos sem depender de listas de opções. Ver DD-10.
- **Autoridade e paridade (dual-run)**: o **servidor é autoritativo** — ele recarrega a lista fresca de apelidos por `accountId` no `executeImport` e re-aplica o match sobre as linhas cruas. O preview no client é **indicativo**: usa a lista que o client tinha ao abrir o wizard. Dada a **mesma** lista, `matchAlias` produz resultado idêntico nos dois lados (DD-06); se um apelido for criado/editado/arquivado entre abrir o preview e confirmar, o resultado **persistido** é sempre o do servidor. Registrar isso na UI não é necessário; a persistência é a verdade.
- **Aplicação autoritativa (server)**: em `csv-import-service.ts`, ao montar cada `TxData` (loop `:255-272`), se `parsed.appliedAliasId` **e a linha não está no conjunto de opt-out** (`input.aliasIgnoreRows`, ver DD-16), mesclar o payload do apelido (só campos definidos) sobre a linha: `categoryId`, `subcategoryId`, `institutionId`/`institutionText`, `responsiblePartyId`, `expenseType`, `paymentMethod`, `investmentType`, `cardInstallment`, `isPending`, `isFavorite` (DD-21), `description`, `notes`, e `tagIds` (se o apelido define ≥1 tag). A **moeda estrangeira** (`originalCurrency`/`originalAmountCents`/`exchangeRate`) é **fill-if-empty** (DD-22): só preenche quando o extrato não trouxe FX (`originalCurrency === null && originalAmountCents === null`).
  - **Precedência apelido vs CSV (DD-17)**: quando o CSV mapeou um valor para um campo (o mapeamento suporta `category`/`subcategory`/`institution`/`responsibleUser`/`notes`/`description` — **verificado** em `csv-import.ts:5-29`) **e** o apelido também define esse campo, **o apelido vence** (sobrescreve o valor do CSV). Consistente com o patch da entrada manual (DD-04) e com DD-11. A **única exceção** é `amountCents`: **nunca aplicado no import (DD-09)** — o valor real do extrato sempre prevalece; o override de valor só vale na entrada manual.
  - **Consistência categoria/subcategoria (DD-18)**: ao aplicar `categoryId` do apelido, aplicar a regra de limpeza de subcategoria órfã descrita em §2.1.
  - O match usou a descrição **importada** (pré-payload); o `description` do payload só afeta o valor gravado, nunca o match. Gravar proveniência em `metadata` (`{ appliedAliasId, aliasTrigger }`). Emitir log Pino estruturado ao fim (`logger.info({ accountId, aliasesApplied }, ...)`) — como não há histórico (DD-05), o log é a única trilha observável.
- **`createMany` (`:367-392`)** não persiste relações nem retorna IDs. Estratégia (§7): gerar `id` (cuid) por transação no service; incluir no `data` do `transaction.createMany` os campos hoje ausentes (`expenseType`, `paymentMethod`, `isPending`, `institutionText`); após o insert, `transactionTag.createMany({ data: pares (transactionId, tagId), skipDuplicates: true })` **no mesmo `$transaction`** (`:280`). Tags do apelido são resolvidas de forma análoga à de categoria (`:188-203`, account-scoped por `@@unique([accountId, name])`).
- **Preview (`StepPreview.tsx`) — WYSIWYG (DD-08) + toggle por linha (DD-16)**: **sem colunas novas** (o preview tem 6 colunas — `#` / Status / Data / Valor / Descrição / Categoria — em `StepPreview.tsx:126-133`; uma coluna a mais espremeria). Nas linhas casadas, as colunas visíveis (Categoria, Descrição) mostram o **valor aplicado** (rótulos vindos do serializer com nomes denormalizados, P1) — o que será salvo — para o usuário confirmar o que persiste. A coluna **Valor mantém o valor real do extrato** (apelido não aplica `amountCents` — DD-09).
  - **Ícone de apelido clicável (DD-16)**: cada linha casada recebe um ícone accent (ex.: `AutoFixHighOutlinedIcon`) que **alterna aplicar / não-aplicar o apelido** naquela linha — **mesma interação** do ícone de Status que já alterna importar/ignorar a linha (`onToggleRow`→`manualIgnoredRows`, `StepPreview.tsx:156-175`; `ImportWizard.tsx:371-378`). Mantém um segundo conjunto por linha (`aliasIgnoredRows`) no estado do wizard, enviado ao `executeImportAction` (`ImportWizard.tsx:246`) como `aliasIgnoreRows` e honrado pelo server (ver §2.6 "Aplicação autoritativa"). **Tooltip** no ícone: estado (aplicando / desligado) + o que muda / o que é oculto (original→aplicado das colunas visíveis + campos ocultos: tags, `expenseType`, responsável, método).
  - **Quando desligado** numa linha, as colunas visíveis daquela linha voltam a exibir os valores crus do extrato (a linha **continua** sendo importada — só sem o apelido). Contagem opcional "N linhas com apelido" no Resumo.

> **Consistência de domínio (ver §7)**: o import só persistirá `tags`/`expenseType`/`paymentMethod`/`isPending`/`institutionText` porque essas colunas **já existem** em `prisma/schema.prisma` (`expenseType` `:435`, relação `tags` `:459`, `paymentMethod`, `isPending`, `institutionText`). A tabela `Transaction` na Spec 01 §3.9 está **desatualizada** (não lista `tags`/`expenseType`/`responsiblePartyId`) — esta spec registra o delta e recomenda backfill; não introduz colunas novas na `Transaction`.

---

## 3. User Stories

- Como membro **owner/editor**, quero cadastrar um apelido (gatilho + campos-alvo) em Settings, para reaplicar lançamentos recorrentes sem redigitar.
- Como usuário, quero que ao digitar uma descrição que contém um gatilho um ícone discreto acenda no campo, para eu decidir se aplico o apelido — sem que nada mude sozinho.
- Como usuário, quero um preview claro (atual → novo) antes de aplicar e um "Desfazer" após aplicar, para não perder dados por engano.
- Como usuário importando um extrato, quero que linhas cujo texto casa um apelido sejam marcadas e recebam os campos do apelido ao confirmar, para não re-categorizar em massa.
- Como usuário, quero transformar uma transação já preenchida em apelido, para capturar um padrão que descobri na prática.
- Como membro **viewer**, não devo poder criar/editar/aplicar apelidos que mutem dados (read-only).

---

## 4. Critérios de Aceitação

**ALIAS-01 — CRUD e escopo**
- QUANDO um owner/editor cadastra um apelido `CEG` (descrição "Sistema de Gás", categoria "Conta", responsável X, `expenseType = fixed`, 2 tags, valor Y) em Settings → Apelidos, ENTÃO ele aparece na lista, é editável e arquivável.
- QUANDO o usuário tenta salvar um apelido com gatilho vazio (ou só espaços), ENTÃO o form NÃO DEVE submeter e o service DEVE rejeitar (`trigger` `.trim().min(1)`).
- QUANDO o gatilho tem menos de 3 caracteres (não-vazio), ENTÃO o form DEVE exibir um **aviso não-bloqueante** ("gatilho curto pode casar demais") mas DEVE **permitir salvar** — não é erro de validação (DD-19).
- QUANDO o usuário define `institutionId` **e** `institutionText` no mesmo apelido, ENTÃO a validação DEVE rejeitar (mutuamente exclusivos).
- QUANDO o usuário escolhe uma subcategoria no form, ENTÃO o seletor DEVE estar escopado à categoria escolhida (desabilitado sem categoria; reseta ao trocar de categoria) e o service DEVE rejeitar (`.refine`) um `subcategoryId` cuja categoria-pai difira do `categoryId` do apelido (DD-18).
- QUANDO um viewer acessa Settings → Apelidos, ENTÃO a UI NÃO DEVE oferecer criar/editar/arquivar (paridade com `responsibles`).
- **Multi-tenancy**: QUANDO um usuário da Account A tenta ler/editar/arquivar/deletar um apelido da Account B (id forjado), ENTÃO o service DEVE filtrar por `accountId` e lançar `NotFoundError`/`ForbiddenError` — o apelido de B é invisível para A. QUANDO um apelido referencia `categoryId`, `subcategoryId`, `institutionId`, `responsiblePartyId` **ou** qualquer `tagId` de outra Account, ENTÃO a criação/edição DEVE ser rejeitada — **cada uma das 5 FKs** valida ownership contra `accountId` (nenhuma exceção).

**ALIAS-02 — Match**
- QUANDO a descrição contém o gatilho (case-insensitive, em qualquer posição), ENTÃO `matchAlias` DEVE considerá-lo casado.
- QUANDO dois apelidos casam a mesma descrição, ENTÃO DEVE vencer o de **gatilho mais longo**; SE houver empate de comprimento, ENTÃO DEVE vencer o de `updatedAt` mais recente.
- QUANDO nenhum gatilho casa, ENTÃO `matchAlias` DEVE retornar `null` e nenhuma UI de apelido DEVE aparecer.

**ALIAS-01 — Aplicação manual (linha nova e edição)**
- QUANDO digito uma descrição que casa um apelido numa linha nova/em edição, ENTÃO o ícone `AutoFixHighOutlinedIcon` DEVE acender (fade-in, `accent.primary`) no fim do campo de descrição.
- QUANDO clico no ícone, ENTÃO o popover DEVE listar **só os campos que mudam** (atual riscado → novo); campos não definidos pelo apelido NÃO DEVEM aparecer.
- QUANDO clico "Aplicar", ENTÃO os campos definidos DEVEM ser sobrescritos no estado local e um snackbar DEVE oferecer "Desfazer" que restaura o estado anterior; nada DEVE ser persistido até eu Salvar a linha.
- QUANDO aplico um apelido que define ≥1 tag, ENTÃO o conjunto de tags da linha DEVE ser **substituído** pelo do apelido; SE o apelido não define tags, ENTÃO as tags da linha NÃO DEVEM mudar.
- QUANDO aplico (manual) um apelido que define `amountCents`, ENTÃO o valor DEVE ser gravado no estado local com o **sinal cru capturado** (verbatim, sem inversão), e o usuário DEVE ver o valor exibido na linha (WYSIWYG) antes de Salvar (DD-20).
- QUANDO aplico um apelido que define/troca a `categoryId` e a subcategoria vigente na linha **não** é filha da nova categoria, ENTÃO a subcategoria DEVE ser limpa (DD-18); SE a subcategoria vigente for filha da nova categoria, ENTÃO DEVE ser mantida.
- QUANDO abro uma transação já categorizada cuja descrição casa um apelido (mesmo sem tocar na descrição), ENTÃO o ícone de apelido **DEVE** acender já no mount (DD-23, revê o critério original que pedia o oposto).
- QUANDO uma linha **salva** (modo visualização, não em edição) tem a descrição casando um apelido, ENTÃO o ícone **DEVE** aparecer ao lado da descrição para não-viewers; clicar abre o popover; "Aplicar" **DEVE** persistir imediatamente (`updateTransactionAction`) e oferecer "Desfazer" que reverte; um **viewer** NÃO DEVE ver o ícone (DD-23).
- QUANDO estou editando uma linha e clico "criar apelido a partir desta transação" (na célula de ações do editor), ENTÃO o dialog DEVE abrir pré-preenchido com os **valores em edição** (não os salvos) e o gatilho vazio (DD-24).
- QUANDO clico o botão de troca no modal, ENTÃO os valores de **gatilho** e **descrição** DEVEM ser trocados (DD-25).
- QUANDO os callbacks de criação estão disponíveis e tenho permissão, ENTÃO os seletores de categoria/subcategoria/instituição do modal DEVEM oferecer "＋ Criar 'X'" e a opção criada DEVE ficar selecionada e visível (DD-26).
- QUANDO pressiono Enter **dentro** do popover, ENTÃO a linha **NÃO DEVE** ser salva; QUANDO pressiono Escape dentro do popover, ENTÃO a edição da linha **NÃO DEVE** ser descartada — o popover apenas fecha/confirma.

**ALIAS-03 — Criar a partir de transação**
- QUANDO clico "Criar apelido a partir desta transação" (bloco editor-only), ENTÃO DEVE abrir o `TransactionAliasFormDialog` com os campos pré-preenchidos a partir da transação e o **gatilho vazio**, usando o **mesmo** form do settings.

**ALIAS-02 — Import**
- QUANDO importo um CSV cujas descrições contêm `CEG`, ENTÃO cada transação criada DEVE receber os campos definidos pelo apelido (incl. tags, `expenseType`, categoria, descrição, responsável), e a proveniência DEVE ser gravada em `metadata`. O `amountCents` do apelido **NÃO DEVE** ser aplicado no import — o valor do extrato é preservado (DD-09).
- QUANDO reviso o preview, ENTÃO as colunas visíveis (Categoria/Descrição) DEVEM mostrar o **valor aplicado** (WYSIWYG); a coluna Valor DEVE manter o valor do extrato; as linhas afetadas DEVEM exibir a **marca/ícone clicável** com tooltip (original→aplicado + campos ocultos), **sem** colunas novas.
- QUANDO clico no ícone de apelido de uma linha no preview, ENTÃO o apelido DEVE alternar entre aplicar / não-aplicar naquela linha; SE desligado, as colunas visíveis DEVEM voltar aos valores crus do extrato e a linha DEVE continuar sendo importada (sem o payload do apelido), e o server DEVE respeitar o opt-out via `aliasIgnoreRows` (DD-16).
- QUANDO o CSV mapeou um valor para um campo (categoria/subcategoria/instituição/responsável/nota/descrição) **e** o apelido também define esse campo, ENTÃO o valor do apelido DEVE vencer (sobrescrever o do CSV) — exceto `amountCents`, que NUNCA é aplicado no import (DD-17/DD-09).
- DADA a **mesma lista de apelidos**, `matchAlias` DEVE casar cada linha de forma idêntica no client (preview) e no server (persistência). SE a lista de apelidos mudar entre abrir o preview e confirmar, ENTÃO o resultado **persistido** DEVE ser o do servidor (autoritativo) — o preview é indicativo.
- A UI (ícone/popover em light e dark; preview do import) DEVE ser validada em **light E dark mode** antes de fechar (`skills/dark-mode`).

---

## 5. Fora de Escopo

- **Motor de regras de auto-categorização (Spec 50)** — prioridade, `stopOnMatch`, `regex`, condições por instituição/faixa de valor, aplicação automática/silenciosa. Apelido é intencional e confirmado. **Não implementar nada da Spec 50 aqui.**
- **Aplicação retroativa** a transações já existentes (bulk "reprocessar histórico com apelidos") — fora de escopo.
- **Histórico/auditoria de sobrescritas** — a aplicação é destrutiva e sem histórico (decisão do dev). O snapshot de undo é apenas em memória, pré-persistência.
- **Limpar campos via apelido** — apelido só define valores, nunca seta um campo para vazio.
- **Merge de tags** — apelido com tags **substitui** o conjunto (não faz união com as tags existentes).
- **Criar responsável (`ResponsibleParty`) a partir do form do apelido** — criação inline de `ResponsibleParty` não passa por `OptionsContext` hoje e continua fora de escopo. (Categoria/subcategoria/instituição **passaram a ter** criação inline no modal — DD-26.)
- **`occurredOn` (data)** como campo do apelido — excluído por decisão do dev.
- **Regex / wildcards no gatilho** — só substring literal.
- **Toggle global de apelidos no import** — o opt-out é **por linha** (DD-16); não há um switch único "aplicar apelidos nesta importação".
- **Preservar a descrição crua do extrato** quando o apelido substitui a descrição no import — o texto original é **descartado** (DD-04; `metadata` guarda só `appliedAliasId`/`aliasTrigger`).
- **Bloquear gatilhos curtos** — gatilho < 3 chars só gera **aviso** (DD-19), não é rejeitado.
- **Derivar/inverter o sinal do valor** por convenção de seção ao aplicar — valor aplicado verbatim (DD-20).

---

## 6. Decisões de Design

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Nome da entidade / campo gatilho | `TransactionAlias`; campo `trigger` (display) + `triggerNormalized` (lowercase) | `alias.trigger` é mais claro que `alias.alias`. `triggerNormalized` habilita `@@unique` case-insensitive e match O(1) por chave pré-computada. |
| DD-02 | Match | Substring, case-insensitive | Pedido do dev; simples e previsível. Risco de falso positivo é responsabilidade do usuário (documentado). |
| DD-03 | Desempate | Gatilho mais longo → `updatedAt` mais recente | Determinístico; gatilho mais específico vence. |
| DD-04 | Sobrescrita | Patch parcial: só campos definidos; nunca limpa; descrição substitui **inteira**; tags substituem o conjunto (≥1) | Pedido do dev. `null` = "não define". Sem sentinel → schema simples. |
| DD-05 | Sem histórico | Sobrescrita destrutiva; undo só em memória pré-persistência | Decisão do dev; evita complexidade de auditoria. |
| DD-06 | Função de match | Pura em `src/lib/aliases/match.ts` (sem deps de server) | Reuso client (UI + preview) e server (import), garantindo paridade do dual-run. |
| DD-07 | Aplicação no import | Parser puro só marca `appliedAliasId`; payload aplicado no service (server) e no render (client) | Server re-parseia linhas cruas; só o **match** precisa ser idêntico. Evita resolver nome↔id no parser. |
| DD-08 | Exibição do preview | **Valor aplicado (WYSIWYG)** — colunas visíveis (Categoria/Descrição) mostram o que será salvo (rótulos vindos do serializer com **nomes denormalizados**, pois o wizard não recebe listas de opções — P1); ícone **clicável** (toggle, DD-16) + tooltip revelam original→aplicado + campos ocultos. Coluna Valor mantém o valor real do extrato (DD-09) | Resolvido na revisão; ajustado na entrevista (toggle DD-16 + nomes denormalizados P1). WYSIWYG evita "confirmo X, salvo Y". |
| DD-09 | Valor no import | **Import NÃO aplica `amountCents` do apelido** — o valor real do extrato é preservado. A entrada **manual** continua aplicando o valor do apelido | Resolvido na revisão. Import traz o valor real da transação (dado autoritativo); um valor fixo o corromperia silenciosamente. Assimetria intencional: manual = criação (apelido preenche); import = valor vem do extrato. |
| DD-10 | Carregamento dos apelidos | Uma vez por Account: **carga única na page RSC** (query em `src/lib/queries/`, `React.cache()` + `where accountId`). **Linha manual**: via **prop** para dentro da árvore do `TransactionTable` — **não** estender o `OptionsContext` (verificado: é callbacks-only + `canManageOptions`, sem listas de dados; adicionar dado quebraria sua forma — P2). **Import**: via **prop** (`SectionView`→`ImportWizard`), pois o wizard **não** está sob o `OptionsProvider`. Server: recarrega uma vez por import. | Performance ("não ser gargalo"). `@@index([accountId])`. Dois consumidores client em árvores distintas, ambos por prop → padrão único e simples (correção dos achados A1 + P2 da revisão/entrevista). |
| DD-11 | Precedência vs Spec 50 (futuro) | Apelido (intencional) tem precedência sobre regra automática quando ambos tocam o mesmo campo | Registrar para quando a Spec 50 for implementada. |
| DD-12 | Coluna `trigger` reservada | Mapear com `@map("trigger_text")` para `trigger` do domínio, evitando a palavra reservada do Postgres | Segurança em SQL cru. |
| DD-13 | Autoridade do dual-run | Servidor autoritativo (recarrega lista fresca e re-aplica); preview é indicativo | `matchAlias` determinística **dada a mesma lista**; listas podem divergir mid-sessão. Evita reivindicar paridade impossível de garantir. |
| DD-14 | `institutionId` vs `institutionText` | Mutuamente exclusivos, `institutionId` tem prioridade | Espelha a regra da `Transaction` (Spec 01 §3.9); `.refine` no Zod. |
| DD-15 | Escala do match | `matchAlias` é O(nº apelidos) por linha/descrição; sem paginação da lista de apelidos | Aceitável na escala esperada (dezenas de apelidos por Account). Decisão consciente; revisitar com Spec 56 se surgirem centenas. |
| DD-16 | Opt-out do apelido no import | **Toggle por linha**: ícone de apelido clicável em cada linha casada do preview alterna aplicar/não-aplicar (espelha o ícone de Status que já alterna importar/ignorar). Conjunto `aliasIgnoredRows` no wizard → `aliasIgnoreRows` no payload → server honra | Entrevista (2026-07-06). Import é a superfície de maior risco de falso-positivo (muitas linhas). Reusa a interação e a infra de toggle por linha (`onToggleRow`/`manualIgnoredRows`) já existentes. Sem toggle global. |
| DD-17 | Precedência apelido vs CSV (import) | **Apelido sobrescreve** o valor mapeado do CSV (categoria/subcat/instituição/responsável/nota/descrição); exceção: `amountCents` nunca (DD-09) | Entrevista. Consistente com o patch da entrada manual (DD-04) e com DD-11 (apelido intencional vence). Import raramente mapeia esses campos; quando mapeia, o apelido é a decisão deliberada. |
| DD-18 | Consistência categoria/subcategoria | **Espelhar a linha**: form escopa subcat à categoria (desabilita sem categoria; reseta ao trocar) + `.refine` backstop (`subcategoryId` ⇒ `categoryId` = pai); **ao aplicar** (manual e import), trocar categoria limpa a subcategoria que deixa de ser filha | Entrevista. O sistema **não** valida esse vínculo em lugar nenhum (verificado: nem DB, nem Zod, nem service). O patch parcial (DD-04) poderia orfanar a subcat; espelhar `NewTransactionRow.tsx:261-264` evita isso reusando lógica existente. |
| DD-19 | Gatilho curto | **Aviso não-bloqueante** no form quando `trigger.trim().length < 3`; Zod continua aceitando (`.trim().min(1)`) | Entrevista. Respeita DD-02 (risco é do usuário) e adiciona empurrão de UX barato; não bloqueia gatilhos curtos legítimos (ex.: "TV"). |
| DD-20 | Sinal do valor (manual) | **Verbatim + WYSIWYG**: aplica `amountCents` com o sinal cru capturado, sem lógica de inversão; usuário vê o resultado no estado local + undo antes de Salvar | Entrevista. O sinal é relativo à convenção da seção (`money.ts:5-11`), mas a aplicação manual é WYSIWYG e reversível — inverter automaticamente quebraria casos legítimos (ex.: estorno). O brief pediu valor como campo do apelido, então não removê-lo (import continua sem valor, DD-09). |
| DD-21 | Favorito no apelido | Coluna `isFavorite Boolean?` (tri-state: não definir / favorito / não favorito, como `isPending`). **Aplica no import** (flag, análogo a `isPending`); **não** entra no popover de aplicação manual | Revisão 2026-07-07 (extensão pós-Fase 6, escolha do dev "Favorito + moeda estrangeira"). Coerente com `isPending`. Popover manual mantém o subset curado — mesma decisão de escopo de `investmentType`/`cardInstallment`/`tags`, que também são só de import (§2.4). |
| DD-22 | Moeda estrangeira no apelido | Colunas `originalCurrency String?`, `originalAmountCents BigInt?`, `exchangeRate Decimal?@db.Decimal(18,6)`. **Import = fill-if-empty**: o apelido só preenche o trio FX quando o extrato **não** trouxe moeda estrangeira — guard `originalCurrency === null && originalAmountCents === null` (checa os dois porque um mapeamento pode trazer só o valor original sem coluna de moeda); se trouxe qualquer um, o extrato prevalece. No form, valor/câmbio exigem moeda (`superRefine`, só no create). **Não** entra no popover de aplicação manual | Revisão 2026-07-07. Generaliza DD-09 (valor/FX do extrato sempre vence) sem tornar o campo inútil: uma assinatura recorrente em USD sem coluna FX no CSV recebe a moeda do apelido. Não aplica no popover manual pela mesma razão de escopo do DD-21. |
| DD-23 | Quando o ícone acende + aplicação em visualização | Ícone acende **em qualquer match**, no mount e tanto em edição quanto em **visualização** (remove o gate `descriptionDirty`). No modo visualização, **Aplicar persiste imediatamente** (`updateTransactionAction` otimista + undo por snackbar que reverte pelo mesmo caminho); reusa `AliasSuggestionPopover` e `computeAliasApplication`. Só para não-viewers. | Pedido do dev (2026-07-07): a regra `descriptionDirty` original exigia "tirar uma letra e recolocar" para ver a sugestão numa transação já casada — fricção. Como a aplicação nunca é automática (sempre exige clique), acender no mount é affordance segura. Visualização persiste na hora porque não há passo "Salvar"; o undo cobre o engano. Contradiz e substitui a nota de escopo original de §2.4 ("nunca no mount"). |
| DD-24 | Criar apelido a partir da linha editável | O botão "criar apelido a partir desta transação" também aparece na célula de ações do `TransactionRowEditor`, capturando `editValues`+`localTags` (WYSIWYG). Dialog renderizado nos dois branches (leitura/edição) de `TransactionRow`. | Pedido do dev: capturar um padrão enquanto edita a linha, sem sair da edição e voltar. Usar os valores em edição (não os salvos) é o que o usuário vê. |
| DD-25 | Trocar gatilho ↔ descrição no modal | `IconButton` (`SwapVertIcon`) inline no `endAdornment` (canto direito) do campo Gatilho troca os valores no form. | Pedido do dev: ao criar-a-partir-de-transação a descrição já vem preenchida e o padrão é reusá-la como gatilho; o botão evita copiar/colar manual, feito "todas as vezes". Posição inline (não entre os campos) por feedback do dev — evita buraco no fluxo. |
| DD-26 | Criação inline no modal | `＋ Criar` habilitado nos 3 `CreatableEntitySelect` do modal via callbacks opcionais + `canCreateOptions`; **em todos os contextos** (a-partir-de-transação e Settings). Pai é dono da lista (mesmo padrão do `TransactionTable`). | Pedido do dev (escolha "em todo lugar"): a linha editável já permite criar categoria/subcat/instituição no próprio input; o modal do apelido não permitia, quebrando a paridade. Reverte a decisão de escopo da Fase 2.3 (`canCreate=false`). |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Modelo + join + migração | `prisma/schema.prisma` (novos `TransactionAlias`, `TransactionAliasTag`; back-relations em `Account`, `Tag`, `Category`, `Subcategory`, `Institution`, `ResponsibleParty`, `User`); migração `create_transaction_aliases` |
| Schema Zod (fonte única) | `src/lib/schemas/transaction-alias.ts` |
| Função de match pura | `src/lib/aliases/match.ts` |
| Serviço | `src/server/services/transaction-alias-service.ts` (espelha `responsible-party-service.ts`) |
| Actions | `src/actions/transaction-aliases.ts` (`defineAction`, `requireRoles:["owner","editor"]`) |
| Revalidate | `src/server/api/revalidate.ts` (novo `revalidateTransactionAliases`) |
| Serializer RSC→client | `src/lib/serializers/transaction-alias.ts` (`serializeTransactionAlias`: `amountCents`→string, datas→ISO UTC via `toISOString`, tags incluídas, **+ nomes denormalizados** `categoryName`/`subcategoryName`/`institutionName`/`responsiblePartyName` para o preview do import — P1). Query carrega com `include`/`select` das relações |
| Query de leitura | `src/server/queries/transaction-aliases.ts` (`React.cache()`, `where: { accountId, archivedAt: null }`) — alimenta a page RSC (linha manual) e o loader do import |
| Settings (page + manager) | `src/app/(app)/[accountId]/settings/aliases/{page.tsx,TransactionAliasesManager.tsx}` |
| Nav settings | `src/app/(app)/[accountId]/settings/layout.tsx` (`editorLinks`) |
| Form reutilizável | `src/components/transactions/aliases/TransactionAliasFormDialog.tsx` (deps por props — DD/§2.3, nunca `useOptions`; subcat escopada à categoria + reset — DD-18; aviso de gatilho curto — DD-19) |
| Aplicação manual | `src/components/transactions/NewTransactionRow.tsx`, `TransactionRowEditor.tsx` + novo `AliasSuggestionPopover.tsx` |
| Apelidos p/ a linha manual | **Prop** para dentro da árvore do `TransactionTable` — **não** estender `OptionsContext.tsx` (callbacks-only; P2/DD-10) |
| Criar-a-partir-de | `src/components/transactions/TransactionRowActions.tsx`, `TransactionRow.tsx` |
| Import — parser | `src/lib/csv-parser.ts` (`PreviewRow.parsed.appliedAliasId`, param `aliases = []` em `applyMappingToRows`; só marca quando `parsed` existe) |
| Import — service | `src/server/services/csv-import-service.ts` (carregar apelidos frescos via query; aplicar payload **sobrescrevendo o CSV** exceto `amountCents` — DD-17; honrar `aliasIgnoreRows` — DD-16; limpar subcat órfã — DD-18; cuid manual + 2× `createMany`; log Pino) |
| Import — schema do action | `src/lib/schemas/csv-import.ts` (novo campo `aliasIgnoreRows: number[]` no input do `executeImport`, análogo a `manualIgnoreRows`) |
| Import — preview + prop | `src/components/csv-import/StepPreview.tsx` (ícone **clicável** de toggle + tooltip; espelha `onToggleRow`), `ImportWizard.tsx` (receber `aliases` por prop; estado `aliasIgnoredRows`; enviar `aliasIgnoreRows` no `executeImportAction`), `src/components/transactions/SectionView.tsx` (repassar `aliases` ao wizard) |
| Labels | `src/lib/messages/pt-BR.ts` |
| Domínio | `specs/01-domain-model.md` (§3.20/§3.21 + diagrama + mudanças futuras); notas em `specs/09-transactions.md §8/§4.12` e `specs/10-csv-xlsx-import.md §5.5/§9` |

### Modelo Prisma (referência)

```prisma
model TransactionAlias {
  id                 String  @id @default(cuid())
  accountId          String  @map("account_id")
  trigger            String  @map("trigger_text")           // display (case original) — evita palavra reservada
  triggerNormalized  String  @map("trigger_normalized")     // lowercase — match + unicidade

  // payload — todos opcionais (patch parcial; null = "não define")
  description        String?
  notes              String?
  amountCents        BigInt?                   @map("amount_cents")   // aplica no manual; NÃO no import (DD-09)
  categoryId         String?                   @map("category_id")
  subcategoryId      String?                   @map("subcategory_id")
  institutionId      String?                   @map("institution_id")
  institutionText    String?                   @map("institution_text")
  responsiblePartyId String?                   @map("responsible_party_id")
  expenseType        TransactionExpenseType?   @map("expense_type")
  paymentMethod      TransactionPaymentMethod? @map("payment_method")
  investmentType     String?                   @map("investment_type")
  cardInstallment    String?                   @map("card_installment")
  isPending          Boolean?                  @map("is_pending")
  isFavorite          Boolean? @map("is_favorite")                       // aplica no import (DD-21)
  originalCurrency    String?  @map("original_currency")                 // FX fill-if-empty no import (DD-22)
  originalAmountCents BigInt?  @map("original_amount_cents")             // FX fill-if-empty (DD-22)
  exchangeRate        Decimal? @map("exchange_rate") @db.Decimal(18, 6)  // FX fill-if-empty (DD-22)

  archivedAt  DateTime? @map("archived_at")
  createdById String    @map("created_by_id")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  account          Account            @relation(fields: [accountId], references: [id], onDelete: Cascade)
  createdBy        User               @relation("TransactionAliasCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  category         Category?          @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  subcategory      Subcategory?       @relation(fields: [subcategoryId], references: [id], onDelete: SetNull)
  institution      Institution?       @relation(fields: [institutionId], references: [id], onDelete: SetNull)
  responsibleParty ResponsibleParty?  @relation(fields: [responsiblePartyId], references: [id], onDelete: SetNull)
  tags             TransactionAliasTag[]

  @@unique([accountId, triggerNormalized])
  @@index([accountId])
  @@map("transaction_aliases")
}

model TransactionAliasTag {
  aliasId String @map("alias_id")
  tagId   String @map("tag_id")
  alias   TransactionAlias @relation(fields: [aliasId], references: [id], onDelete: Cascade)
  tag     Tag              @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([aliasId, tagId])
  @@index([tagId])
  @@map("transaction_alias_tags")
}
```

### Função de match pura (referência)

```ts
// src/lib/aliases/match.ts — SEM imports de server (client + server importam)
// AliasCandidate é o SUBSET mínimo p/ o match. O tipo serializado completo
// (SerializedTransactionAlias, §7) é um superset: payload + nomes denormalizados
// (categoryName/…) p/ o preview WYSIWYG do import. matchAlias<T> aceita o superset.
export interface AliasCandidate {
  id: string;
  trigger: string;
  triggerNormalized: string; // já em lowercase (coluna)
  updatedAt: string;         // UTC ISO (Date.toISOString) — MESMO serializer nos dois lados, senão o desempate diverge
}

// ✅ uma passada, chaves pré-normalizadas, desempate determinístico
export function matchAlias<T extends AliasCandidate>(
  description: string | null | undefined,
  aliases: readonly T[],
): T | null {
  if (!description) return null;
  const haystack = description.toLowerCase();
  let best: T | null = null;
  for (const a of aliases) {
    if (!a.triggerNormalized || !haystack.includes(a.triggerNormalized)) continue;
    if (
      best === null ||
      a.triggerNormalized.length > best.triggerNormalized.length ||
      (a.triggerNormalized.length === best.triggerNormalized.length && a.updatedAt > best.updatedAt)
    ) {
      best = a;
    }
  }
  return best;
}
```

### Import — parser puro só marca o match (referência)

```ts
// src/lib/csv-parser.ts
export function applyMappingToRows(
  rows: ParsedRow[],
  mapping: ImportMapping,
  aliases: readonly AliasCandidate[] = [], // ✅ novo param opcional — dual-run idêntico
): PreviewRow[] {
  return rows.map((row) => {
    const parsed = /* ...objeto atual (:295-348)... */;
    // ✅ só o match é compartilhado; payload aplicado no service/render
    parsed.appliedAliasId = matchAlias(parsed.description, aliases)?.id ?? null;
    return { /* ...PreviewRow... */, parsed };
  });
}
```

### Import — persistir tags (createMany não aceita relação aninhada)

```ts
// src/server/services/csv-import-service.ts — dentro do $transaction (:280)
// ✅ gerar id manual p/ conhecer transactionId antes do insert em lote
const txData = previewRows.map((r) => ({ id: createId(), /* ...campos + payload do apelido... */ }));
await tx.transaction.createMany({ data: txData.map(toTransactionRow) }); // + expenseType, paymentMethod, isPending, institutionText
await tx.transactionTag.createMany({
  data: txData.flatMap((t) => t.tagIds.map((tagId) => ({ transactionId: t.id, tagId }))),
  skipDuplicates: true,
});
// ❌ tx.transaction.createMany({ data: [{ tags: { create: [...] } }] }) — createMany não suporta relações aninhadas
```

### Guard de teclado no popover (referência)

```tsx
// AliasSuggestionPopover — impede Enter/Escape de borbulhar até a TableRow
<Popover
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === "Escape") e.stopPropagation();
  }}
>
  {/* ... */}
</Popover>

// + na linha: onKeyDown={(e) => { if (aliasPopoverOpen) return; /* ...salvar/cancelar... */ }}
```

---

## 8. Cenários de Teste (mínimo)

Ver `skills/testing`. Teste ao lado do fonte, `.test.ts`. Threshold do projeto ≥ 60%.

**`matchAlias` (função pura — `src/lib/aliases/match.ts`)**
- Substring case-insensitive: "CEG" casa "pagamento ceg gas", "CEG SA", "Ceg".
- Sem match → `null`; descrição `null`/vazia → `null`.
- Desempate por **comprimento**: entre "CEG" e "CEG SA" numa descrição que contém ambos, vence "CEG SA".
- Empate de comprimento → **`updatedAt` mais recente** vence.
- Linha de erro sem `parsed` não é marcada.

**`transaction-alias-service` (mutations — multi-tenancy OBRIGATÓRIO)**
- CRUD (list/create/update/archive/delete) tenant-scoped por `ctx.accountId`.
- `it("não deve operar em dados de outra account")`: `findFirst` retorna `{ accountId: "acc-OUTRA" }` → `NotFoundError`.
- Ownership de **cada** FK do payload (`categoryId`, `subcategoryId`, `institutionId`, `responsiblePartyId`, cada `tagId`): FK de outra Account → rejeição.
- `trigger` vazio/só-espaços → erro de validação; `triggerNormalized` gravado em lowercase; `@@unique([accountId, triggerNormalized])` colide → `ConflictError`.
- `trigger` com < 3 chars (não-vazio) → **salva sem erro** (DD-19 é aviso de UI, não validação de service).
- `subcategoryId` cuja categoria-pai ≠ `categoryId` do apelido → rejeição (`.refine`, DD-18).
- `institutionId` + `institutionText` juntos → rejeição.

**Import (`csv-import-service` + `csv-parser`)**
- Dual-run: mesma lista + mesmas linhas ⇒ mesmo `appliedAliasId` por linha (client e server).
- Payload aplicado: tags gravadas via `TransactionTag` (2× `createMany`), `expenseType`/`paymentMethod`/`isPending`/`institutionText` gravados, `metadata` com `appliedAliasId`.
- `tagIds` do apelido **substitui** (não faz união) as tags; apelido com 0 tags não escreve `TransactionTag`.
- **`amountCents` do apelido NÃO é aplicado no import (DD-09)**: linha importada com valor real Y + apelido com valor Z ⇒ transação salva com Y (não Z); demais campos do apelido ainda aplicados.
- **Opt-out por linha (DD-16)**: linha casada presente em `aliasIgnoreRows` ⇒ transação criada com os valores crus do extrato (payload do apelido NÃO aplicado); linha casada ausente do set ⇒ payload aplicado.
- **Precedência apelido vs CSV (DD-17)**: CSV mapeia categoria X **e** apelido define categoria Y ⇒ salva Y (apelido vence); idem responsável/nota/descrição. `amountCents` é a única exceção (extrato vence).
- **Subcategoria órfã no apply (DD-18)**: apelido define `categoryId` diferente e a subcat da linha não é filha ⇒ subcat limpa na transação salva.
- Multi-tenancy: apelido de outra Account nunca casa (query filtra `accountId`).

**Aplicação manual (component/interaction)**
- Ícone acende só com match e só após editar a descrição (editor: flag dirty; não no mount).
- "Aplicar" sobrescreve estado local; snackbar "Desfazer" restaura snapshot; nada persiste até Salvar.
- Entrada manual aplica `amountCents` do apelido no estado local **com o sinal cru, sem inversão** (DD-20; assimetria com o import — DD-09).
- Apply que troca a categoria limpa a subcategoria vigente quando ela deixa de ser filha da nova categoria; mantém quando ainda é filha (DD-18).
- Enter/Escape dentro do popover não salvam/cancelam a linha (guard de teclado).

---

## 9. Plano de Implementação

> Plano faseado + rastreamento de progresso (CLAUDE.md §11). Marcar o checkbox de cada passo ao concluir. A spec (§1–§8) é a fonte da verdade; esta seção é o **como/ordem**.

### Convenções de execução

- Todo comando roda **no container**: `docker compose exec app pnpm <cmd>`.
- Cada fase termina com **gate**: `typecheck` + `lint` + `test` verdes + revisão `myaccountant-reviewer`.
- Multi-tenancy: teste obrigatório em toda mutation (§5.2/§5.12 do CLAUDE.md). Dinheiro: `BigInt` centavos. UI: MUI + tokens, `DialogShell`/`EmptyState`/`PageHeader`/`StatusBadge`, validar **light E dark**. Strings em `src/lib/messages/pt-BR.ts`.

### Grafo de dependências

```
Fase 1 (backend) ─┬─> Fase 2 (settings CRUD) ──> Fase 3 (criar-a-partir-de)
                  ├─> Fase 4 (aplicação manual)   [match + query + serializer + prop]
                  └─> Fase 5 (import)             [match + serializer c/ nomes + service apply]
Fase 6 (fechamento) ── após 2..5
```

Fase 1 é fundação. 2→3 sequencial (Fase 3 reusa o `TransactionAliasFormDialog`). 4 e 5 independentes após a 1.

### Fase 1 — Backend / dados · modelo Sonnet

Ordem obrigatória (schema antes de migrate; generate antes de tipar):

- [x] **1.1 Prisma** — `TransactionAlias` + `TransactionAliasTag` (modelo §7) + back-relations em `Account`, `Tag`, `Category`, `Subcategory`, `Institution`, `ResponsibleParty`, `User`. `prisma format` + `prisma validate`.
- [x] **1.2 Migração** — `prisma migrate dev --name create_transaction_aliases`; conferir SQL (índices `@@unique([accountId, triggerNormalized])`, `@@index([accountId])`, `@@index([tagId])`; FKs `SetNull`/`Cascade`). `prisma generate`.
- [x] **1.3 Zod** (`src/lib/schemas/transaction-alias.ts`) — `trigger` `.trim().min(1)`; payload opcional. `.refine`: (a) não `institutionId`+`institutionText` juntos (DD-14); (b) `subcategoryId` ⇒ `categoryId` presente (**só presença**; vínculo pai/filho é checado no service — 1.5). Schemas `create`/`update`/`archive`/`delete`, espelhando `responsible-party.ts`.
- [x] **1.4 Match puro** (`src/lib/aliases/match.ts`) — `AliasCandidate` + `matchAlias<T>` (§7). Sem imports de server. Teste unitário junto.
- [x] **1.5 Service** (`src/server/services/transaction-alias-service.ts`) — espelha `responsible-party-service.ts`. Tenant-scope por `ctx.accountId`. **IDOR**: cada FK (`categoryId`/`subcategoryId`/`institutionId`/`responsiblePartyId`/cada `tagId`) valida ownership. **Parent-check subcat (DD-18)**: buscar subcat e exigir `subcat.categoryId === input.categoryId` (DB, não Zod). `triggerNormalized = trigger.trim().toLowerCase()`; colisão `@@unique` → `ConflictError`. Delete hard (FKs `SetNull`); archive soft toggle.
- [x] **1.6 Actions** (`src/actions/transaction-aliases.ts`) — `defineAction({ requireRoles: EDITOR_ROLES })` + `revalidateTransactionAliases`. Espelha `responsible-parties.ts`.
- [x] **1.7 Revalidate** (`src/server/api/revalidate.ts`) — revalida `/${accountId}/settings/aliases` + `/${accountId}`.
- [x] **1.8 Serializer** (`src/lib/serializers/transaction-alias.ts`) — `amountCents`→string, datas→ISO UTC, tags, **+ nomes denormalizados** `categoryName`/`subcategoryName`/`institutionName`/`responsiblePartyName` (P1). `SerializedTransactionAlias` = superset de `AliasCandidate`.
- [x] **1.9 Query** (`src/server/queries/transaction-aliases.ts`) — `React.cache()`, `where {accountId, archivedAt:null}`, `include` das relações. Alimenta page RSC + loader do import. **Correção de path**: spec §7 apontava `src/lib/queries/` — convenção real do projeto é `src/server/queries/` (verificado nos arquivos existentes); corrigido em §7.
- **Testes**: `matchAlias` (5 casos §8); service (multi-tenancy, ownership de cada FK, `.refine` institution, parent-check subcat, trigger vazio→erro / <3→salva, colisão unique).
- **Riscos**: (1) **cuid manual** p/ Fase 5 — confirmar o gerador do `@default(cuid())` (importar o mesmo lib); (2) parent-check subcat é service, não `.refine` (já refletido em 1.3/1.5).
- **Revisão (`myaccountant-reviewer`)**: 2 bloqueadores encontrados e corrigidos — (a) DD-18: `updateTransactionAlias` não revalidava a subcategoria quando `categoryId` era limpo (`null`) deixando a subcategoria persistida órfã; `assertSubcategoryOwned` agora exige `expectedCategoryId` sempre que há `subcategoryId` efetivo. (b) DD-14: update parcial não resolvia o valor "efetivo" de `institutionId`/`institutionText` contra o registro existente, permitindo os dois coexistirem após dois updates sucessivos; adicionado `assertInstitutionExclusivity` com a mesma lógica de "efetivo" do DD-18. Also: `tagIds` deduplicados antes de persistir (create/update); testes de IDOR explícitos por FK adicionados ao `update` (antes só cobertos no `create`). 31 testes no service (era 23).

### Fase 2 — Settings CRUD · modelo Sonnet

- [x] **2.1 Page RSC** (`settings/aliases/page.tsx`) — espelha `responsibles/page.tsx`: auth + redirect viewer; carrega **todos** os apelidos (inclusive arquivados, ao contrário do `getActiveTransactionAliases` de Fase 1) + listas de opções (categorias/subcategorias, instituições, responsáveis, tags); serializa via `serializeTransactionAlias`; passa por props.
- [x] **2.2 Manager** (`.../TransactionAliasesManager.tsx`) — lista + `EmptyState` + `PageSettingsContainer` (`PageHeader` não é usado por nenhuma página irmã de Configurações — correção do texto original) + `StatusBadge` arquivado/pendência; criar/editar via form; arquivar/desarquivar/deletar via actions; `useSnackbar` + `useTransition`. Merge otimista local (`toDisplayAlias`) após create/update, cruzando o payload do form com as listas de opções já carregadas — evita round-trip, mesmo padrão de `ResponsiblePartiesManager`/`TableModelsManager`.
- [x] **2.3 Form** (`src/components/transactions/aliases/TransactionAliasFormDialog.tsx`) — base `DialogShell` + RHF + zodResolver contra `createTransactionAliasSchema`. **Deps por props** (nunca `useOptions`). Campos: `trigger` (+ **aviso <3 chars** DD-19, via `helperText`, nunca bloqueia); descrição; notas; valor BRL; `CreatableEntitySelect` cat/subcat (**subcat escopada + reset**, DD-18)/instituição (`canCreate=false` — criação inline fora de escopo desta tela, usuário já está em Configurações); `ResponsiblePartySelect`; `ToggleButtonGroup` expenseType; paymentMethod; isPending (tri-state: não definir/pendente/confirmado). Agrupado em 2 `FieldGroup` ("Classificação"/"Comportamento e valor").
  - **Correção de escopo (P3)**: o texto original citava `TagPopover`/`TagEditor` para tags — verificado que ambos exigem `transactionId` real (chamam `addTagToTransactionAction`/`removeTagFromTransactionAction` de uma transação existente), inutilizáveis para um registro de apelido. Substituído por um `Autocomplete` multi-select simples sobre a lista de tags da Account (prop `tags`, sem criação inline).
  - `investmentType`/`cardInstallment` (existem no schema/model) **não** têm campo nesta fase — decisão de escopo deliberada, mesma lacuna que `NewTransactionRow.tsx` tem para `cardInstallment`; valor é preservado em round-trip se já existir (edição), mas não é definível/visível no form.
- [x] **2.4 Nav** (`settings/layout.tsx`) — item `{ href: "aliases", label: m.settings.nav.aliases }` em `editorLinks`.
- [x] **2.5 Labels** (`pt-BR.ts`) — bloco `settings.transactionAliases` + `settings.nav.aliases`.
- **Gate**: `typecheck`/`lint`/`build`/`test` verdes (675/675, sem regressão) · `myaccountant-reviewer` · `ui-critique`.
- **Revisão (`ui-critique`)**: 1 bloqueador de acessibilidade corrigido — 4 campos (`amountCents`, `paymentMethod`, `isPending`, `tagIds`) usavam o wrapper `LabeledField` (legenda só visual, sem `label`/`aria-label` real) quando o controle interno (`TextField`/`Autocomplete`) já suporta `label` nativo; trocado para `label` nativo nesses 4 (mantendo `LabeledField` só onde é genuinamente necessário: `CreatableEntitySelect`/`ResponsiblePartySelect`/`ToggleButtonGroup`, que não aceitam `label`). Também aplicado: `FieldGroup` (padrão já existente no design system) no lugar de um `Divider`+caption manual reinventado; formulário reagrupado em "Classificação"/"Comportamento e valor"; `isPending` na lista virou `StatusBadge` (era `Chip` genérico, perdendo semântica de cor de estado financeiro); valor monetário na lista com fonte JetBrains Mono; cor da tag replicada na lista (antes só no form) via novo helper compartilhado `src/lib/tag-colors.ts`; aviso de "clique novamente para limpar" adicionado ao `ToggleButtonGroup` de `expenseType` (único campo opcional do form sem uma opção "não definir" explícita).
- **Revisão (`myaccountant-reviewer`)**: 1 ajuste corrigido — os 3 `CreatableEntitySelect` (categoria/subcategoria/instituição) herdavam `width: 150` fixo do uso original em célula de tabela estreita (primeiro uso deste componente fora de uma tabela); sem override renderizavam grudados à esquerda do grid do dialog. Adicionado `sx={{ width: "100%" }}`, igual ao que já era feito no `ResponsiblePartySelect` ao lado. Multi-tenancy, dinheiro (BigInt), `defineAction`, Zod/RHF, DD-18, DD-19 e design system: todos conformes, sem outros achados.

### Fase 3 — Criar apelido a partir de transação · modelo Sonnet

- [x] **3.1** Botão em `TransactionRowActions.tsx` (`BookmarkAddOutlinedIcon`, dentro do bloco `!isReadOnly`, ao lado de Duplicar/Deletar) + prop `onCreateAlias` no `Props`.
- [x] **3.2** Wiring em `TransactionRow.tsx` — handler `handleCreateAlias` (análogo a `handleDuplicate`) monta um `aliasPrefill` (todos os campos do payload exceto `trigger`, sempre vazio) e abre `TransactionAliasFormDialog` já montado condicionalmente (`{aliasDialogOpen && <TransactionAliasFormDialog .../>}`).
  - **Nova prop no form** (`TransactionAliasFormDialog.tsx`): `prefill?: Omit<Partial<CreateTransactionAliasInput>, "trigger">`, usada em `initDefaults()` só no modo criação (`!alias`) — `Omit<..., "trigger">` garante em nível de tipo que o gatilho nunca vem preenchido via este caminho.
  - **Escopo deliberado**: `investmentType`/`cardInstallment` da transação de origem **não** entram no prefill — mesma lacuna da Fase 2 (campos não visíveis/editáveis nesse form); incluí-los criaria um apelido com dado invisível ao usuário no momento de salvar.
  - **Tags**: `tags` do form é carregado via lazy-fetch (`listTagsAction(accountId)`, mesma técnica de `BulkActionBar.tsx`) disparado no clique do botão — não via prop drilling nem `OptionsContext`. Estado inicial já parte de `tx.tags` (não `[]`) e faz merge por `id` com o resultado do fetch quando chega, evitando os chips da transação "sumirem" durante o loading (achado do `ui-critique`, corrigido).
- **Gate**: `typecheck`/`lint`/`build`/`test` verdes (675/675, sem regressão) · `myaccountant-reviewer` · `ui-critique`.
- **Revisão (`myaccountant-reviewer`)**: 1 bug real encontrado e corrigido — `onSuccess` passado ao dialog em `TransactionRow.tsx` disparava um segundo `enqueueSnackbar(ta.created)`, duplicando o toast já mostrado internamente pelo próprio `TransactionAliasFormDialog` (`SnackbarProvider` não tem `preventDuplicate`); corrigido para `onSuccess={() => {}}` (não há lista local a sincronizar neste ponto). Multi-tenancy (`listTagsAction` escopado por `accountId`), restrição a não-viewer, BigInt/dinheiro, ausência de `console.log`, tipos `TxRow`→`CreateTransactionAliasInput` e reset do dialog entre usos: todos conformes.
- **Revisão (`ui-critique`)**: 1 achado real corrigido — o `Autocomplete` de tags do form depende do array assíncrono `tags` para resolver os chips já selecionados (`tags.filter(t => field.value.includes(t.id))`), então com `aliasTags` partindo de `[]` as tags da transação "desapareciam" visualmente até o fetch resolver; corrigido inicializando `aliasTags` com `tx.tags` e fazendo merge por `id` com o resultado do `listTagsAction`. Também adicionado `.catch` com snackbar de erro (fetch antes falhava em silêncio) e `aria-label` explícito no novo `IconButton` (o `Tooltip` sozinho não garante nome acessível). Demais achados (menu "⋮" para ações raras, foco visível via `:focus-within`, aria-label dos ícones irmãos) são pré-existentes na barra de ações, não introduzidos por esta fase — registrados como follow-up, não bloqueantes.

### Fase 4 — Aplicação manual · modelo Sonnet

- [x] **4.1** Apelidos **por prop**: `getActiveTransactionAliases(accountId)` (Fase 1) chamado em `SectionTab.tsx` (RSC) → `SectionView.tsx` → `FinanceTableCard.tsx` → `TransactionTable.tsx` → `NewTransactionRow.tsx`/`TransactionRow.tsx` → `TransactionRowEditor.tsx`. `OptionsContext` não tocado (P2/DD-10).
- [x] **4.2** `AliasSuggestionPopover.tsx` (novo, espelha `TagPopover`) — lista só os campos que mudam (atual riscado → novo); botões Aplicar/Cancelar; **guard de teclado** (`onKeyDown` com `stopPropagation` em Enter/Escape).
- [x] **4.3** Ícone no `endAdornment` do campo de descrição em `NewTransactionRow.tsx` e `TransactionRowEditor.tsx`: `AutoFixHighOutlinedIcon`, `<Fade>` (só opacity, `motion.duration.normal`), cor `accent.primary`.
- [x] **4.4** Detecção debounced (280ms, dentro da faixa 250–300ms pedida) via hook `useAliasMatch.ts`, 100% client. Editor: só após `descriptionDirty` (nunca no mount).
- [x] **4.5** Aplicar (`src/lib/aliases/apply.ts`, função pura `computeAliasApplication`): patch parcial (DD-04); **amount verbatim** (DD-20); **subcat limpa se órfã** (DD-18, com prioridade para subcategoria explícita do próprio apelido); recomputa match após aplicar (mesmo hook, mesma descrição atualizada). **Tags fora do escopo** desta função — ver nota de escopo abaixo.
- [x] **4.6** Undo: snapshot pré-aplicação (estado local completo) + `enqueueSnackbar` com ação "Desfazer" que restaura o snapshot. Nada persiste no servidor até o usuário clicar Salvar na linha.
- [x] **4.7** Guard na linha: `if (aliasAnchorEl) return` no `onKeyDown` da `TableRow`, antes do handler normal de Enter/Escape (defesa em profundidade com o guard do próprio popover).
- **Gate**: `typecheck`/`lint`/`build`/`test` verdes (691/691, sem regressão) · `myaccountant-reviewer` · `ui-critique`.
- **Nota de escopo — tags fora da aplicação manual**: `TagEditor`/`TagPopover` já persistem tag a tag imediatamente no servidor (`addTagToTransactionAction`/`removeTagFromTransactionAction`), diferente do resto do payload da linha, que só persiste ao Salvar — aplicar tags do apelido aqui violaria "nada persiste até Salvar" (§2.4) ou exigiria reescrever a persistência de tags. `computeAliasApplication`/`AliasApplicableFields` não incluem `tags`. Efeito colateral tratado: um apelido que só define tags ainda **acende o ícone** (o gate usa `matchedAlias !== null`, não "há mudança aplicável"), e o popover mostra uma mensagem explicando que não há campo aplicável nesta tela, com o botão Aplicar desabilitado — em vez de simplesmente nunca acender (o que o `myaccountant-reviewer` apontou como uma 4ª decisão de escopo implícita e não desejável).
- **Nota de escopo — `institutionText` nunca aplicado**: nem o form do apelido (Fase 2) nem os dois editores de linha expõem um campo de texto livre para instituição (só `CreatableEntitySelect` por id) — mesma categoria de exclusão de `investmentType`/`cardInstallment` da Fase 3.
- **Nota de escopo — `isPending` incluído sem controle de UI visível** em nenhum dos dois editores (só alternável via ícone em `TransactionRowActions.tsx`, fora do modo edição): incluído mesmo assim porque o próprio popover mostra a mudança como preview textual antes de confirmar; expôs um bug real (ver revisão abaixo), agora corrigido.
- **Validação light/dark**: não verificada em browser real (sem ambiente de dev disponível nesta sessão) — `ui-critique` calculou contraste real via os hex de `src/lib/design-tokens.ts` para os dois temas (ver revisão abaixo); recomenda-se uma verificação visual manual antes de considerar a fase 100% fechada.
- **Revisão (`myaccountant-reviewer`)**: 1 bloqueador real encontrado e corrigido — `NewTransactionRow.tsx` resetava todos os campos após Salvar (fluxo de entrada rápida) **exceto `isPending`**, então um apelido que define `isPending: true` vazava silenciosamente para o próximo lançamento da mesma sessão de entrada rápida (bug latente desde que `_setIsPending` virou `setIsPending` de verdade nesta fase); corrigido adicionando `setIsPending(false)` ao bloco de reset, com teste de regressão dedicado. Também corrigido: o ícone só acendia quando havia ≥1 mudança aplicável (`hasAliasChanges`), tornando apelidos só-de-tags inatingíveis no fluxo manual sem aviso — trocado para `matchedAlias !== null` com tratamento de 0-mudanças no popover (ver nota de escopo acima). Um artefato de formatação órfão (comentário `eslint-disable` removido de `TransactionTable.tsx` por um `eslint --fix` anterior, sem relação com esta fase) foi limpo. DD-18/DD-20 confirmados corretos e bem cobertos por `apply.test.ts` (9 casos). Prop drilling de `aliases` (DD-10) confirmado correto em toda a árvore, sem tocar `OptionsContext`. Sem `console.log`, sem `Float`/`Number` em dinheiro, mensagens centralizadas. Testes adicionados após a revisão: `useAliasMatch.test.ts` (debounce, `enabled`, mudança de lista de apelidos) e 3 testes de interação em `NewTransactionRow.test.tsx` (ícone→popover→aplicar, desfazer, regressão do vazamento de `isPending`).
- **Revisão (`ui-critique`)**: 3 achados reais corrigidos — (a) o valor riscado (atual) no popover usava `text.disabled`, com contraste calculado abaixo de WCAG AA nos dois temas (~2.1-2.3:1) para um conteúdo que o usuário precisa ler para decidir; trocado para `text.secondary` (~8.8-9.5:1); (b) lista de mudanças sem teto de altura — um apelido que define muitos campos podia estourar a viewport perto do rodapé da tabela; adicionado `maxHeight: 320` + `overflowY: "auto"`; (c) o ícone usava `unmountOnExit` dentro do `endAdornment` sem slot de largura reservado, causando um pequeno "respiro" de layout no campo de descrição exatamente ao digitar; envolvido num `Box` de largura fixa (24px) para que só a opacidade mude. Nitpicks não-bloqueantes registrados e parcialmente aplicados: tooltip com o nome completo do gatilho no popover (aplicado); flash de `aria-label` vazio durante ~200ms no fade-out (não aplicado, efeito mínimo); falta de suporte a `prefers-reduced-motion` em todo `Fade`/`Grow` do projeto (débito técnico pré-existente, transversal, não introduzido por esta fase — não corrigido aqui). Confirmado correto: cor `accent.primary` do ícone (affordance, não informação financeira), `aria-label` explícito nos `IconButton`s (lição da Fase 3), guard de teclado (verificado contra o código-fonte do `useModal` do MUI), motion nos tokens do projeto, hierarquia de botões, zero hex hardcoded.

### Fase 5 — Import · modelo Sonnet

- [x] **5.1** Parser (`csv-parser.ts`) — `applyMappingToRows(rows, mapping, aliases=[])` (3º parâmetro opcional, retrocompatível); marca só `parsed.appliedAliasId` via `matchAlias`, quando `parsed` existe (linhas `status:"error"` não são marcadas).
- [x] **5.2** Schema (`src/lib/schemas/csv-import.ts`) — `aliasIgnoreRows: number[]` (`.default([])`) no `executeImportSchema`, análogo a `manualIgnoreRows`.
- [x] **5.3** Service apply (`csv-import-service.ts`) — `executeImport` recarrega apelidos frescos (`prisma.transactionAlias.findMany({accountId, archivedAt:null}, include: ALIAS_INCLUDE)`, independente do cache de request da query RSC — DD-13) e serializa via `serializeTransactionAlias` (reuso, sem duplicar mapeamento). No loop por linha, se `row.parsed.appliedAliasId` resolve a um apelido carregado **e** a linha não está em `aliasIgnoreRows`, mescla o payload sobrescrevendo o CSV (DD-17) para **todos** os campos definidos (`description`, `notes`, `categoryId`, `institutionId`/`institutionText` como par atômico, `responsiblePartyId`, `cardInstallment`, `investmentType`, `expenseType`, `paymentMethod`, `isPending`), **exceto `amountCents`, nunca lido em nenhum ponto do fluxo (DD-09)**. Subcategoria segue DD-18 com a mesma prioridade da Fase 4: `subcategoryId` explícito do apelido vence incondicionalmente; senão, se o apelido troca `categoryId`, a subcategoria resolvida do CSV é limpa quando deixa de ser filha da categoria efetiva. `metadata: {appliedAliasId, aliasTrigger}` quando aplicado, `{}` quando não.
- [x] **5.4** `createMany` + tags — **correção de abordagem em relação ao texto original desta seção** (que previa `createManyAndReturn`, tentada primeiro e revertida — ver Revisão abaixo): `id` gerado explicitamente por transação (`generateTransactionId()`, `c${randomUUID().replace(/-/g,"")}` — passa em todo `z.string().cuid()` do app sem depender de nenhuma ordem de retorno de query em lote) e usado em `tx.transaction.createMany` normal; campos novos (`expenseType`/`paymentMethod`/`isPending`/`institutionText`) incluídos no `data`; `tx.transactionTag.createMany({data, skipDuplicates: true})` no mesmo `$transaction`, vinculando pelo `id` já conhecido (sem depender de índice/ordem de retorno).
- [x] **5.5** Log Pino (`log.info({accountId, tableId, aliasesApplied}, "CSV import concluído")`) ao fim do `executeImport`.
- [x] **5.6** `SectionView.tsx` (não `:242-249` — a prop `aliases` já chega nesta página desde a Fase 4, carregada uma vez via `getActiveTransactionAliases`) passa `aliases={aliases}` ao `<ImportWizard>`.
- [x] **5.7** `ImportWizard.tsx` — nova prop `aliases`; passada como 3º argumento de `applyMappingToRows` na transição step1→step2; novo estado `aliasIgnoredRows` (resetado em `openWizard`/recompute do preview/"importar outro"); enviado como `aliasIgnoreRows` no payload de `executeImportAction`.
- [x] **5.8** `StepPreview.tsx` — WYSIWYG (DD-08) nas colunas Descrição/Categoria via nova função pura `src/lib/aliases/import-preview.ts` (`describeAliasImportApplication`, reusa os label-helpers de `apply.ts` agora exportados); ícone clicável `AutoFixHighOutlinedIcon`/`AutoFixOffOutlinedIcon` (DD-16) prependido ao texto da célula Descrição, espelhando a interação de `onToggleRow`; tooltip com cabeçalho de estado + mudanças visíveis (original→aplicado) + "também define" para campos ocultos (notas, subcategoria, instituição, responsável, tipo, método, pendente, tags — nunca `amountCents`, DD-09); chip de resumo opcional "N linha(s) com apelido". Sem colunas novas.
- **Gate**: `typecheck`/`lint`/`build`/`test` verdes (711/711, sem regressão) · `myaccountant-reviewer` · `ui-critique`.
- **Nota de escopo — `createManyAndReturn` tentado e revertido**: a implementação inicial desta fase usou `tx.transaction.createManyAndReturn` (API pública do Prisma 6) para obter os ids gerados e vincular as tags do apelido, validado empiricamente contra o banco de dev real (transação com rollback). O `myaccountant-reviewer` apontou, corretamente, que essa API não aceita `orderBy` e que um import grande (até 5000 linhas × ~26 colunas, acima do limite de parâmetros de uma única query Postgres) pode ser chunkado pelo Prisma em múltiplos `INSERT`s — sem garantia documentada de que a ordem das linhas retornadas bate com a ordem do array de entrada. Vincular tags por índice posicional nesse cenário seria uma aposta em comportamento não-contratual sobre dados financeiros. Corrigido revertendo para `createMany` + `id` gerado explicitamente antes do insert (`generateTransactionId()`), eliminando por completo a dependência de qualquer ordem de retorno.
- **Nota de escopo — `id` gerado não é um cuid "de verdade"**: `generateTransactionId()` produz `c` + 32 hex chars de `crypto.randomUUID()` sem hífens — não roda o algoritmo real do cuid (que o Prisma usa internamente em `@default(cuid())`), mas satisfaz a regex que `z.string().cuid()` do Zod valida em todo o app (`/^c[^\s-]{8,}$/i`, verificada no source do Zod nesta sessão) e tem unicidade pelo menos tão forte quanto UUID v4. Suficiente porque nenhum lugar do app depende do formato exato do cuid, só da validação Zod passar.
- **Validação light/dark**: não verificada em browser real nesta sessão (sem ambiente de dev disponível) — `ui-critique` calculou contraste real via os hex de `src/lib/design-tokens.ts`/`theme.ts` para os dois temas (ver revisão abaixo); recomenda-se checagem visual manual antes de considerar a fase 100% fechada.
- **Revisão (`myaccountant-reviewer`)**: 1 bloqueador real encontrado e corrigido — dependência de ordem de `createManyAndReturn` (ver nota de escopo acima), incluindo a observação de que o teste original era circular (o mock já assumia a premissa que o código assumia). Também apontado e corrigido: cobertura de teste do DD-17 cobria só categoria — adicionados testes de instituição (par `institutionId`/`institutionText`) e de subcategoria explícita do apelido vencendo mesmo quando a subcategoria do CSV ainda seria válida. Sugestão de teste do log Pino (DD-05, única trilha observável) registrada mas não implementada — não é o padrão predominante nos demais services do projeto (só um service testa logger via mock em todo o repo) e o log em si segue o formato Pino padrão sem lógica própria a testar. Confirmado correto: multi-tenancy do `findMany` de apelidos, exclusão total de `amountCents` (DD-09), DD-17 para os demais campos, DD-18, BigInt/dinheiro, ausência de `console.log`.
- **Revisão (`ui-critique`)**: 5 achados reais corrigidos — (a) contraste do rodapé do tooltip (~1.6-1.9:1 nos dois temas) porque `color="text.secondary"` é calibrado pro fundo normal da app, não pro fundo invertido do `MuiTooltip`; trocado por herdar a cor do tooltip com `opacity: 0.75`; (b) ícone "desligado" com `text.disabled` abaixo do mínimo de 3:1 para controle interativo (é clicável, não só informativo); trocado para `text.tertiary`; (c) ícone/preview de apelido continuava ativo em linhas manualmente ignoradas (Status), confundindo o resumo com a tabela e piorando ainda mais o contraste sob a opacidade reduzida da linha; corrigido suprimindo o apelido inteiro (`alias`/`aliasOff`/`aliasApplying`/preview) quando a linha está manualmente ignorada; (d) alvo de toque do `IconButton` menor que os ícones-irmãos de Status (`fontSize="inherit"` + padding customizado reduzido); corrigido com `fontSize="small"` explícito e padding padrão do `IconButton size="small"`; (e) tooltip sem teto de altura para apelidos que definem muitos campos; adicionado `maxHeight: 320` + `overflowY: "auto"` (mesmo padrão já usado no `AliasSuggestionPopover` da Fase 4). Achados registrados como follow-up não-bloqueante, fora do escopo desta fase: assimetria de acessibilidade entre o novo ícone de apelido (`IconButton` + `aria-label`, focável) e o ícone de Status pré-existente (SVG cru, não focável) — o novo padrão é melhor, não pior, mas a spec os descreve como "espelhando" a mesma interação; leve squeeze de largura de texto na coluna Descrição nas linhas com ícone (~11-12% do orçamento de 200px, agora 220px); ausência de sinal visual próprio na coluna Categoria além do ícone (considerado over-design especular sem evidência de confusão real — DD-08 pede explicitamente "sem colunas novas").
- **Ambiente**: `pnpm-workspace.yaml` (untracked, fora do controle de versão) apareceu corrompido uma segunda vez nesta sessão com o mesmo conteúdo inválido (`allowBuilds:` de um prompt tipo `pnpm approve-builds`), quebrando todo comando `pnpm` no container — mesmo diagnóstico da Fase 4 (arquivo espúrio, sem uso legítimo no repo single-package). Removido novamente.



### Fase 6 — Fechamento · modelo Haiku/Sonnet

- [x] **6.1** Notas cross-spec — `specs/09-transactions.md §4.12` (metadata grava `{appliedAliasId, aliasTrigger}` no import) e `§8` (resumo da aplicação de apelidos no import, linkando spec 61); `specs/10-csv-xlsx-import.md §5.5` (ícone/tooltip/WYSIWYG/opt-out por linha/chip no preview) e `§9` (`aliasIgnoreRows` no `ExecuteImportInput`, recarga fresca de apelidos no server, gravação em `metadata`/tags).
- [x] **6.2** Confirmado `01-domain-model.md §3.20/§3.21` vs `prisma/schema.prisma` — sem drift: todos os campos, tipos, `@map`, FKs (`Cascade`/`SetNull`/`Restrict`), `@@unique([accountId, triggerNormalized])`, `@@index` e a PK composta de `TransactionAliasTag` batem exatamente com o schema final (`model TransactionAlias`/`model TransactionAliasTag`, `prisma/schema.prisma:723-772`). Nenhuma mudança necessária.
- [x] **6.3** `test:coverage` — **63.62%** statements/lines globais (branch 77.54%, funcs 79.18%), acima do piso de 60%. Config (`vitest.config.ts`) exclui deliberadamente `src/app/**`, `src/components/**`, `src/emails/**`, `src/hooks/**` e arquivos de design system/config — convenção já estabelecida do projeto (coverage mede lib/server, não UI). Todos os módulos novos da spec 61 ficam ≥ esse piso: `src/lib/aliases/*` 100% linhas, `src/lib/serializers/transaction-alias.ts` 100%, `src/server/queries/transaction-aliases.ts` 65% (ramo não coberto: cache-hit do `React.cache()`, não testável fora de um request real), `src/server/services/transaction-alias-service.ts` 97.57%, `src/server/services/csv-import-service.ts` 69.68% (nº herdado de antes da Fase 5 — a lógica de apelido em si está coberta pelas 10 novas suites de teste).
- [x] **6.4** Validação light/dark — **não verificada em browser real nesta sessão** (sem dev server/browser disponível no ambiente do agente, mesma limitação disclosed nas Fases 2/4/5). Mitigação aplicada: todas as cores usadas nas 3 fases de UI (2 Settings CRUD, 4 aplicação manual, 5 import) são tokens semânticos do tema (`accent.primary`, `text.tertiary`, `success/danger/warning.subtle`, etc.), nunca hex hardcoded, e o `ui-critique` calculou contraste real via os hex de `design-tokens.ts`/`theme.ts` para os dois temas em cada fase (achados de contraste encontrados foram para tokens usados incorretamente, não para valores hardcoded) — risco residual é de percepção visual/hierarquia, não de token errado. **Recomenda-se checagem manual num browser antes do próximo ciclo de UI tocar essas telas.**
- [x] **6.5** Verificação final — todos verdes: `prisma validate` (schema válido), `typecheck` (limpo), `lint` (0 erros, só warnings pré-existentes de `any` em testes/ordem de import), `test` (48 arquivos, **711/711**), `build` (rotas geradas com sucesso, incluindo `/[accountId]/settings/aliases`).

- **Revisão (`myaccountant-reviewer`)**: 2 achados 🟡 corrigidos — (a) `01-domain-model.md §3.20` e o bloco "Modelo Prisma (referência)" desta spec (§7) traziam a nota do `amountCents` com a semântica invertida ("override de valor no import"), quando DD-09 diz o oposto (nunca aplicado no import); reescrito nos dois lugares; (b) header desta spec continuava `Status: approved` mesmo com as 6 fases entregues — atualizado para `implemented`. 1 achado 🟢 corrigido — bloco de referência do §7 tinha `createdBy` sem o relation name `"TransactionAliasCreatedBy"`/`onDelete: Restrict` presentes no schema real (necessário pois `User` tem múltiplas relações). Confirmado correto pelo revisor: cross-spec notes em 09/10 (granularidade e precisão), domain-model §3.20/§3.21 sem drift de campo (na granularidade que a tabela documenta), riscos abertos das fases 1-5 corretamente carregados adiante em 6.4 em vez de dados como resolvidos.

**Spec 61 (Transaction Aliases) — todas as 6 fases concluídas.**

### Fase 7 — Melhorias de uso (extensão 2026-07-07 #2) · modelo Sonnet

Depende só de UI (fundação das Fases 1–6 intacta). Sem mudança de schema/service/action — reusa `updateTransactionAction`, `computeAliasApplication`, `matchAlias`, `AliasSuggestionPopover` e as actions de criação de opções.

- [x] **7.1 Mensagem** — `settings.transactionAliases.swapTriggerDescription` em `pt-BR.ts` (reusa `aliasSuggestion.*` e `actions.createAlias` já existentes).
- [x] **7.2 Dialog** (`TransactionAliasFormDialog.tsx`) — (a) botão `SwapVertIcon` entre Gatilho e Descrição (DD-25); (b) props opcionais `onCreateCategory`/`onCreateSubcategory`/`onCreateInstitution` + `canCreateOptions` ligadas aos 3 `CreatableEntitySelect`, `canCreate = canCreateOptions && !!onCreate*` (subcat também `&& !!categoryId`); fallback ao `noopCreate`/`canCreate=false` sem callbacks (DD-26).
- [x] **7.3 Editor** (`TransactionRowEditor.tsx`) — `useAliasMatch(..., true)` (remove `descriptionDirty` e o `setDescriptionDirty`; DD-23); prop `onCreateAlias` + botão `BookmarkAddOutlinedIcon` na célula de ações.
- [x] **7.4 View mode + wiring** (`TransactionRow.tsx`) — `matchAlias(tx.description, aliases)` no modo leitura (estático, sem debounce); ícone na célula de descrição (só não-viewer) + `AliasSuggestionPopover`; `handleApplyAliasView` persiste via `updateTransactionAction` (otimista) + snackbar "Desfazer" que reverte; `useOptions()` para os callbacks de criação; `openCreateAlias(src)` reusado por view (`tx`) e editor (`editValues`, que já carrega `tags`); dialog renderizado nos dois branches; passa callbacks + `canCreateOptions` ao editor e dialog. Helper puro `aliasPatchToUpdateInput` em `apply.ts` (amountCents string→BigInt; resto passthrough).
- [x] **7.5 Settings manager** (`TransactionAliasesManager.tsx`) — sobe `categories`/`institutions` para state; callbacks `onCreate*` (chamam `createCategoryAction`/`createSubcategoryAction`/`createInstitutionAction`, atualizam state, retornam id) + `canCreateOptions`; passa ao dialog. `toDisplayAlias` passa a resolver nomes das opções recém-criadas.
- [x] **7.6 Testes** — unit de `aliasPatchToUpdateInput` (`apply.test.ts`, 4 casos: vazio, BigInt, passthrough c/ null, patch parcial).
- **Gate**: `typecheck` (limpo) · `lint` (0 erros; só warnings pré-existentes) · `test` (48 arquivos, **720/720**) — verdes. **Validação light/dark do ícone em modo visualização não feita em browser nesta sessão** (mesma limitação das Fases 2/4/5); risco baixo — reusa `AliasSuggestionPopover` e o ícone `accent.primary` já validados na Fase 4. Recomenda-se checagem visual manual.
- **Revisão (`myaccountant-reviewer`)**: sem bloqueadores. 1 ajuste 🟡 corrigido — `TransactionAliasesManager` não tinha o `useEffect` de resync do state local `categories`/`institutions` contra as props (padrão de `TransactionTable.tsx:163-171`), podendo divergir do server numa revalidação com o componente montado; adicionado. Nota do helper `aliasPatchToUpdateInput` esclarecida sobre `institutionText` ficar fora de escopo (🟢). **Limitações aceitas (não corrigidas, coerentes com o resto do app)**: (a) o "Desfazer" da aplicação em visualização reaplica o snapshot pré-apelido sem checagem de concorrência — uma edição intermediária (mesma tx, outra sessão/aba) seria sobrescrita sem aviso; mesmo padrão do delete-undo e demais undos do app, não é regressão desta fase; (b) clique duplo rápido no ícone antes da 1ª `updateTransactionAction` resolver pode disparar 2 requisições/snackbars, igual a `toggleFavorite`/`togglePending` (sem lock) já existentes. Confirmado correto pelo revisor: multi-tenancy (nenhuma action nova; `accountId` sempre a prop do componente), BigInt (`"amountCents" in patch` evita o bug do valor `"0"`), `isReadOnly` esconde o ícone para viewer, DD-26 (dono da lista é o pai nos dois contextos), sem `console.log`/hex/`style` inline, mensagens centralizadas.

### Comandos

```bash
docker compose exec app pnpm prisma validate
docker compose exec app pnpm prisma migrate dev --name create_transaction_aliases   # Fase 1
docker compose exec app pnpm prisma generate
docker compose exec app pnpm typecheck
docker compose exec app pnpm lint
docker compose exec app pnpm test
docker compose exec app pnpm test:coverage    # Fase 6
```

### Revisores
- Antes da Fase 1: `architect-reviewer` (opcional — spec já revisada).
- Fim de cada fase: `myaccountant-reviewer`. Fases 2/4/5 (UI): `ui-critique`.
