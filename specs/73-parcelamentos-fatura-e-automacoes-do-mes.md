# Spec 73 — Parcelamentos de Fatura e Automações do Mês

> Status: ready
> Insumo: relato de bug do desenvolvedor (2026-08-03) com faturas reais em `exemples/Faturas_erro_parcelamento/` (`Fatura_2026-07-05.csv` = competência junho/2026, `Fatura_2026-08-05.csv` = competência julho/2026); revisão de código em `src/server/services/csv-import-service.ts`, `src/server/services/installment-service.ts`, `src/server/services/month-service.ts`
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`design-system`](../skills/design-system/SKILL.md) · [`mui-patterns`](../skills/mui-patterns/SKILL.md) · [`testing`](../skills/testing/SKILL.md)
> Relacionado: [`spec 41`](41-aprimoramentos-objeto-transacao.md) (TRN-02 — `InstallmentGroup`/`PendingInstallment`) · [`spec 10`](10-csv-xlsx-import.md) (import CSV/XLSX) · [`spec 24`](24-recurring-transactions.md) (`TableTemplate.autoApply`) · [`spec 66`](66-reestruturacao-linha-transacao.md) §10 (painel do parcelamento)

---

## 1. Problema

Fatura de cartão traz uma parcela por competência (`"4/4"`), repetindo sempre a **data original da compra**. O parcelamento estruturado da spec 41 assume que a parcela 1 acontece na data da 1ª transação lançada — premissa que só vale para parcelamento criado à mão. Daí uma cascata de defeitos.

- **BUG-01 — cronograma ancorado na data da compra, não no mês da fatura**: em `src/server/services/csv-import-service.ts:458-461`, `startDate = addMonths(firstPresentTx.occurredOn, -(installmentNumber - 1))`. A linha `EINSCRICAO;4/4` da fatura de competência **junho/2026** tem `occurredOn = 2026-03-06` (data da compra), então `startDate = 2025-12-06` e as parcelas 1–3 nascem como previstas em **dez/2025, jan/2026, fev/2026** — meses em que a compra nem existia. O grupo (`csv-import-service.ts:426-428`) herda o mesmo `startDate` errado.
- **BUG-02 — painel rotula a parcela lançada pela data da compra**: em `src/server/services/installment-service.ts:411`, `date: tx.occurredOn.toISOString().slice(0,10)`, e `InstallmentSchedule.tsx:208` formata esse `date` como rótulo de mês. A parcela 4/4 lançada no mês **junho/2026** aparece como "março 2026". Os campos corretos (`monthYear`/`monthMonth`, de `tx.month`) já existem no DTO (`installment-service.ts:414-415`) e são ignorados pela UI.
- **BUG-03 — import nunca reaproveita `InstallmentGroup` existente**: em `src/server/services/csv-import-service.ts:420`, todo item de `acceptedInstallments` chama `installmentGroup.create()`. A spec 41 §3.13 (linha 265) exige "verificar se já existe um `InstallmentGroup` compatível para associar a parcela importada" — nunca implementado. Consequência com as faturas reais: `CYAN SHOES 2/3` (junho) cria o grupo A com pendentes 1 e 3; `CYAN SHOES 3/3` (julho) cria o grupo B em vez de consumir a pendente 3 do grupo A. Mesmo padrão em `ZP *COSTURES 61058` (2/4→3/4), `NOVA IGREJA BARRA` (2/3→3/3), `ATELIERCLARAROSAS` (1/2→2/2), `AMAZONMKTPLC*JOAORODRI` (1/10→2/10) e `Anuidade Diferenciada` (4/12→5/12).
- **BUG-04 — auto-conversão ao criar mês colide com o import**: `src/server/services/month-service.ts:49-55` chama `convertPendingInstallmentsForMonth` sem filtro nenhum. Se o mês julho/2026 é criado antes do import da fatura, a pendente `CYAN SHOES 3/3` já vira `Transaction`; ao importar o CSV a mesma parcela entra de novo → linha duplicada. O usuário não tem como escolher, nem enxergar, o que a criação do mês vai lançar (hoje só descobre pelo snackbar, depois do fato — vale também para modelos de tabela com `autoApply`, `month-service.ts:60-155`).
- **BUG-05 — não existe ação "marcar parcela prevista como paga"**: o painel só oferece `"Criar neste mês"` (`InstallmentSchedule.tsx:78-102`, exige o mês existir) e `settleInstallmentGroup` (`installment-service.ts:453`, quita N parcelas no **mês atual** com `occurredOn = today`). Parcelas anteriores à primeira fatura importada ficam eternamente "prevista · ainda não lançada", travando a barra de progresso e o total "R$ X pagos" (`InstallmentGroupPanel.tsx:117-125`).
- **BUG-06 — rodapé do painel quebra o rótulo do botão**: `InstallmentGroupPanel.tsx:322-348` põe três botões numa linha de ~348px (Drawer 380px − `px: 16px`×2). O do meio tem `flex: 1` + `startIcon={<AddIcon>}`; "Lançar próxima" não caber na largura restante faz o rótulo quebrar em duas linhas e o `+` ficar visualmente solto do texto.
- **BUG-07 — bucketing de `expectedDate` por mês usa getters locais**: `installment-service.ts:170-174` monta o range com `new Date(year, month-1, 1)` (local) e `:418-419` lê `pi.expectedDate.getFullYear()/getMonth()` (local). `expectedDate` é `@db.Date`, materializado como meia-noite **UTC** — em processo com fuso de offset negativo a parcela desloca para o mês anterior. `src/server/queries/cashflow-forecast.ts:173-199` já resolveu isso com `Date.UTC`/`getUTC*` e documenta a convenção; `installment-service` ficou fora.

---

## 2. Solução

### 2.1 BUG-01 — ancorar o cronograma no mês de competência do import

O mês de destino escolhido no wizard (`executeImportSchema.monthId`) **é** a competência da fatura. O cronograma passa a ser derivado dele, não da `occurredOn`:

```
anchorNumber = max(installmentNumber das linhas presentes no CSV)
slot(n)      = mês do import + (n − anchorNumber)
```

`EINSCRICAO 4/4` importada em junho/2026 → parcela 4 = junho, 3 = maio, 2 = abril, 1 = março. `InstallmentGroup.startDate` = `slot(1)`. O dia usado em cada `expectedDate` é o dia da `occurredOn` da linha âncora, ajustado ao último dia válido do mês via `applyDayToMonth` (compra dia 31 → fevereiro dia 28).

`occurredOn` das transações importadas **não muda** — continua sendo a data real da compra que o extrato informa.

### 2.2 BUG-02 — rótulo de mês pela competência

`InstallmentPanelItem` passa a expor `monthYear`/`monthMonth` para **todos** os itens (lançados: de `tx.month`; previstos: de `expectedDate` em UTC). `InstallmentSchedule` monta o rótulo de mês a partir desses campos e usa `item.date` apenas como fallback.

### 2.3 BUG-03 — vincular a parcelamento existente no import (confirmado no preview)

Nova etapa de resolução, executada no servidor quando o wizard entra no passo de preview: para cada sugestão detectada, procurar `InstallmentGroup` compatível na mesma account.

Chave de casamento, em cascata (para na primeira que resolve para **exatamente um** grupo):
1. `(descrição normalizada, installmentCount, occurredOn)` — extrato repete a data da compra em toda parcela; cobre `CYAN SHOES`, `ZP *COSTURES`, `NOVA IGREJA BARRA`, `ATELIERCLARAROSAS`, `AMAZONMKTPLC*JOAORODRI`.
2. `(descrição normalizada, installmentCount)` + o grupo tem `PendingInstallment` com **o número exato** da linha importada — cobre `Anuidade Diferenciada` (a anuidade é re-datada a cada mês, então o sinal 1 falha).

Empate (mais de um candidato) → nenhum vínculo automático; a sugestão fica como "criar novo grupo" e informa que há candidatos ambíguos.

A seção "Parcelamentos detectados" do preview passa a mostrar o grupo casado e um seletor `vincular ao existente` / `criar novo grupo`, pré-selecionado em **vincular**. Ao executar o import com vínculo: a transação recebe `installmentGroupId`/`installmentNumber` do grupo existente, a `PendingInstallment` correspondente é deletada (foi materializada), e **nenhum** grupo/pendência nova é criada. Se o número já estiver lançado como `Transaction` naquele grupo, a linha é importada **sem vínculo** (evita dois itens com o mesmo `installmentNumber` no mesmo grupo) e contabilizada no resultado.

### 2.4 BUG-04 — flag por grupo + modal "Automações" na criação do mês

Duas partes complementares:

- `InstallmentGroup.autoCreateOnNewMonth` (novo, default `true`): grupo criado à mão nasce `true`; grupo criado pelo import nasce `false` (a fatura é a fonte da parcela). `convertPendingInstallmentsForMonth`, quando chamado **sem** seleção explícita, só converte pendentes de grupos com a flag ligada. Toggle visível no painel do parcelamento. Como o `DEFAULT true` da coluna também alcança os grupos que **já** existem — inclusive os criados por imports anteriores —, uma segunda migração faz o **backfill**: `false` para todo grupo com ao menos uma transação de origem `csv_import`/`xlsx_import` (mesmo critério do import novo).
- Criação de mês em **2 passos**. Passo 1 = mês/ano (dialog atual). Passo 2 = "Automações", que lista tudo que será criado junto com o mês, agrupado por tipo, com checkbox por item — pré-marcado por `TableTemplate.autoApply` (modelos) e por `InstallmentGroup.autoCreateOnNewMonth` (parcelas). O passo 2 **é omitido** quando não há nada a automatizar. Desmarcar vale **só para esta criação** — não altera a flag do grupo.

O contrato de preview é uma lista de grupos com `kind` discriminado (`table_template` | `pending_installment`), para que automações futuras (ex. assinaturas da spec 49) entrem como novo `kind` sem redesenhar a UI.

### 2.5 BUG-05 — marcar parcela prevista como paga (histórico)

`PendingInstallment.settledAt` (novo, `DateTime?`). Marcar preenche o campo: a parcela conta como paga no progresso e no total "R$ X pagos" do painel, **sem** criar `Transaction` — não altera total de nenhum mês. Reversível (desmarcar limpa o campo). Parcela marcada é ignorada por: conversão ao criar mês, quitação antecipada, projeção de fluxo de caixa e vínculo de import.

No cronograma, o ícone de relógio da parcela prevista vira controle clicável: marca como paga (histórico); no estado marcado, exibe check e permite desfazer. `"Criar neste mês"` continua disponível para quem quer a transação de verdade.

### 2.6 BUG-06 — rodapé do painel em uma linha, sem quebra

"Desfazer grupo" vira `IconButton` com `Tooltip` (ação destrutiva, menos proeminente), liberando largura. "Lançar próxima" perde o `flex: 1` que o esticava e ganha `whiteSpace: "nowrap"`, mantendo `startIcon` colado ao rótulo.

### 2.7 BUG-07 — datas de parcela em UTC

`convertPendingInstallmentsForMonth` e `getInstallmentGroupPanelData` passam a montar range e ler componentes de `expectedDate` em UTC (`Date.UTC`, `getUTCFullYear`, `getUTCMonth`), como já faz `cashflow-forecast.ts`. As `expectedDate` gravadas pelo import e pelo `createInstallmentGroup` também passam a ser construídas em UTC.

---

## 3. User Stories

- Como usuário que importa fatura de cartão, quero que a parcela `4/4` de junho apareça como a **última** do cronograma (jan→jun), não como a primeira, para que o painel do parcelamento reflita a realidade da compra.
- Como usuário que importa a fatura do mês seguinte, quero que a parcela `3/3` seja reconhecida como continuação do parcelamento já existente, para não acumular grupos duplicados da mesma compra.
- Como usuário, quero revisar e escolher o que será criado automaticamente antes de o mês ser criado, para não descobrir 14 transações inesperadas depois do fato.
- Como usuário, quero que parcelas que vêm da minha fatura não sejam lançadas automaticamente ao abrir o mês, para que o CSV continue sendo a única fonte daquela linha.
- Como usuário, quero marcar como paga uma parcela anterior à primeira fatura que importei, para que o progresso do parcelamento mostre o quanto já quitei.
- Como usuário, quero ler os botões do painel do parcelamento sem rótulo quebrado em duas linhas, para saber o que cada ação faz.

---

## 4. Critérios de Aceitação

**BUG-01 — ancoragem**

- QUANDO o import de um mês de competência `M` aceita uma sugestão cuja maior parcela presente é `k` de `N`, O SERVIÇO DEVE gravar a `expectedDate` de cada parcela ausente `n` no mês `M + (n − k)`.
- QUANDO a linha `EINSCRICAO;4/4;229,83` com `occurredOn = 2026-03-06` é importada no mês junho/2026, O CRONOGRAMA DEVE listar parcela 1 em março/2026, 2 em abril/2026, 3 em maio/2026 e 4 em junho/2026.
- QUANDO o grupo é criado pelo import, SEU `startDate` DEVE ser igual à `expectedDate` calculada para a parcela 1.
- O `occurredOn` das transações importadas NÃO DEVE ser alterado pelo cálculo de ancoragem.
- SE o dia da compra não existe no mês de destino (ex. dia 31 em fevereiro), A `expectedDate` DEVE usar o último dia daquele mês.

**BUG-02 — rótulo de competência**

- QUANDO uma parcela lançada é exibida no cronograma, O RÓTULO de mês DEVE vir do `Month` da transação, NÃO DEVE vir de `occurredOn`.
- QUANDO a parcela 4/4 tem `occurredOn = 2026-03-06` e está no mês junho/2026, O CRONOGRAMA DEVE exibir "junho 2026".

**BUG-03 — vínculo com grupo existente**

- QUANDO o preview do import detecta uma sugestão e existe exatamente um `InstallmentGroup` da mesma account com igual descrição normalizada, igual `installmentCount` e igual `occurredOn` de qualquer parcela sua, O PREVIEW DEVE oferecer o vínculo pré-selecionado.
- SE o sinal de data não resolve, QUANDO existe exatamente um grupo com igual descrição normalizada e `installmentCount` que possui `PendingInstallment` com o mesmo `installmentNumber` da linha, O PREVIEW DEVE oferecer o vínculo pré-selecionado.
- SE mais de um grupo casa pelos sinais acima, O PREVIEW NÃO DEVE pré-selecionar vínculo e DEVE indicar ambiguidade.
- QUANDO o import executa com vínculo confirmado, O SERVIÇO NÃO DEVE criar novo `InstallmentGroup` nem novas `PendingInstallment`, DEVE gravar `installmentGroupId`/`installmentNumber` na transação importada e DEVE deletar a `PendingInstallment` de mesmo número do grupo.
- SE o grupo já tem `Transaction` com o `installmentNumber` da linha importada, A LINHA DEVE ser importada sem vínculo e O RESULTADO DEVE reportar a quantidade de linhas não vinculadas por já estarem lançadas.
- O SERVIÇO NÃO DEVE vincular a grupo de outra account (`accountId` obrigatório na busca).
- UMA `PendingInstallment` com `settledAt` preenchido NÃO DEVE ser considerada disponível para vínculo.

**BUG-04 — flag e modal de automações**

- QUANDO o import cria um `InstallmentGroup`, `autoCreateOnNewMonth` DEVE ser `false`.
- QUANDO o usuário cria um parcelamento pelo dialog manual, `autoCreateOnNewMonth` DEVE ser `true`.
- APÓS a migração de backfill, TODO grupo pré-existente com transação de origem `csv_import`/`xlsx_import` DEVE ter `autoCreateOnNewMonth = false`, e os demais DEVEM permanecer `true`.
- QUANDO `createMonth` roda sem seleção explícita, ELE DEVE converter apenas pendentes de grupos com `autoCreateOnNewMonth = true` e `settledAt = null`.
- QUANDO `createMonth` recebe seleção explícita, ELE DEVE aplicar exatamente os `TableTemplate` e as `PendingInstallment` cujos ids foram enviados, ignorando a flag do grupo.
- QUANDO o usuário confirma mês/ano no passo 1 e existe ao menos um modelo `autoApply` ou uma pendente elegível naquele mês, O DIALOG DEVE exibir o passo "Automações" antes de criar.
- SE não há modelo `autoApply` nem pendente para o mês, O DIALOG NÃO DEVE exibir o passo 2 e DEVE criar o mês direto.
- A action de preview NÃO DEVE criar, alterar ou deletar nenhum registro.
- QUANDO o usuário desmarca uma parcela no passo 2, O `autoCreateOnNewMonth` do grupo NÃO DEVE ser alterado.
- QUANDO um modelo `autoApply` está mal configurado (sem `autoSectionId` ou `autoTableTypeId`), O PASSO 2 DEVE exibi-lo desmarcado, não selecionável, com o motivo.
- QUANDO o usuário liga/desliga o toggle no painel do parcelamento, A FLAG do grupo DEVE persistir e a action DEVE rejeitar grupo de outra account.

**BUG-05 — marcar como paga (histórico)**

- QUANDO o usuário marca uma parcela prevista como paga, O SERVIÇO DEVE gravar `settledAt` e NÃO DEVE criar `Transaction`.
- QUANDO uma parcela tem `settledAt` preenchido, O PAINEL DEVE contá-la em "lançadas" e somá-la em "R$ X pagos", e O CRONOGRAMA DEVE exibi-la com ícone de concluída e rótulo de histórico.
- QUANDO o usuário desfaz a marcação, `settledAt` DEVE voltar a `null` e a parcela DEVE voltar ao estado previsto.
- UMA parcela com `settledAt` preenchido NÃO DEVE ser convertida em `Transaction` ao criar mês, NÃO DEVE entrar em `settleInstallmentGroup` e NÃO DEVE somar na projeção de fluxo de caixa.
- A action de marcar/desmarcar DEVE exigir papel `owner` ou `editor` e DEVE rejeitar parcela de outra account.

**BUG-06 — rodapé**

- QUANDO o painel é aberto num Drawer de 380px, O RÓTULO "Lançar próxima" DEVE ocupar uma única linha, com o ícone `+` adjacente ao texto.
- A ação "Desfazer grupo" DEVE continuar acessível e DEVE expor rótulo textual acessível (`aria-label` + `Tooltip`).

**BUG-07 — UTC**

- QUANDO `convertPendingInstallmentsForMonth` seleciona pendentes de um mês, O RANGE DEVE ser construído com `Date.UTC`.
- QUANDO o painel deriva ano/mês de `expectedDate`, ELE DEVE usar `getUTCFullYear`/`getUTCMonth`.

---

## 5. Fora de Escopo

- **Modelo de fatura/cartão de crédito de primeira classe** (`CreditCard`/`CardInvoice`, dia de fechamento e vencimento) — é a spec 53, ainda `draft`. Aqui o mês de destino escolhido no wizard continua sendo o proxy da competência.
- **Reconciliação retroativa dos grupos duplicados já criados** por imports anteriores. O casamento vale para imports novos; grupos duplicados existentes se resolvem com "Desfazer grupo" manualmente.
- **Detecção de linha duplicada em geral no import** (mesma transação importada duas vezes) — o escopo aqui é só a colisão com parcela de `InstallmentGroup`.
- **Toggle "não perguntar de novo"** para o passo de automações (avaliado e recusado: o passo já se omite quando não há nada a automatizar).
- **Aviso de "mês já importado"** no passo de automações (caso raro, só em recriação de mês).
- **Editar valor/data de `PendingInstallment`** pelo painel.
- **Marcar parcela como paga em lote** — a ação é por parcela.
- **Recalcular `totalCents` do grupo** quando o vínculo de import revela valor de parcela diferente do estimado (`AMAZONMKTPLC*JOAORODRI` 250,06 → 250,01). O total estimado do grupo permanece; só a transação lançada carrega o valor real.
- **Novas automações no passo 2** além de modelos de tabela e parcelas (assinaturas/spec 49 entram depois, como novo `kind`).

---

## 6. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Âncora do cronograma no import | Mês de competência do import, na **maior** parcela presente | A parcela mais recente do arquivo é a que pertence à fatura sendo importada; ancorar na menor jogaria as futuras para frente demais em arquivo com múltiplas competências |
| Parcelas anteriores à importada | Criadas como `PendingInstallment` previstas (não como pagas) | Escolha do desenvolvedor: prefere marcar manualmente o que de fato pagou a assumir histórico |
| "Marcar como paga" | Só `settledAt`, sem `Transaction` | Dinheiro saiu antes do rastreio ou já está lançado em outra linha; criar transação alteraria total de mês fechado e poderia duplicar linha de fatura já importada |
| Vínculo no import | Confirmado no preview, pré-selecionado | Reusa a seção "Parcelamentos detectados" que já existe; casamento por heurística não deve escrever sem o usuário ver |
| Ambiguidade no casamento | Não vincular, sinalizar | Vincular ao grupo errado é pior que criar grupo novo (o segundo é reversível com "Desfazer grupo") |
| Colisão de `installmentNumber` já lançado | Importa sem vínculo e reporta | Dois itens com o mesmo `installmentNumber` quebram o cronograma (chave de render duplicada) e a barra de progresso |
| Controle da auto-criação | Flag por grupo **e** modal de automações | Flag define o padrão (import ⇒ desligado); o modal dá a palavra final e expõe o que hoje é caixa-preta |
| Escopo do desmarcar no modal | Só a criação corrente | Modal é decisão pontual; efeito colateral persistente sem pedido explícito surpreende |
| Passo 2 quando não há automação | Omitido | Evita fricção em conta nova / mês sem recorrência |
| `selection` em `createMonth` | Opcional; ausente ⇒ comportamento por flag | Não quebra a rota REST `/api/v1` nem os testes existentes de `createMonth` |
| Contrato de preview | Lista com `kind` discriminado | Automação futura entra como novo `kind` sem redesenhar UI nem action |
| "Desfazer grupo" no rodapé | `IconButton` + `Tooltip` | Libera a largura que fazia "Lançar próxima" quebrar; ação destrutiva não precisa de rótulo permanente |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| BUG-01, BUG-03 (execução), BUG-04 (flag no import) | `src/server/services/csv-import-service.ts` · `src/lib/schemas/csv-import.ts` |
| BUG-03 (casamento) | `src/server/services/installment-service.ts` (`findInstallmentGroupMatchesForImport`) · `src/actions/installments.ts` |
| BUG-03 (UI de preview) | `src/components/import/InstallmentDetectionSection.tsx` · `src/components/csv-import/ImportWizard.tsx` · `src/components/csv-import/StepPreview.tsx` |
| BUG-02, BUG-05, BUG-07 | `src/server/services/installment-service.ts` · `src/components/installments/InstallmentSchedule.tsx` |
| BUG-04 (schema + serviço) | `prisma/schema.prisma` · nova migração · `src/server/services/month-service.ts` · `src/lib/schemas/months.ts` · `src/actions/months.ts` |
| BUG-04 (UI) | `src/components/months/CreateMonthModal.tsx` · novo `src/components/months/MonthAutomationsStep.tsx` |
| BUG-04 (toggle no painel), BUG-06 | `src/components/installments/InstallmentGroupPanel.tsx` · `src/actions/installments.ts` |
| BUG-05 (consumidores) | `src/server/queries/cashflow-forecast.ts` |
| Backup/restore dos campos novos | `src/lib/schemas/account-backup.ts` · `src/server/services/account-backup-service.ts` |
| Mensagens | `src/lib/messages/pt-BR.ts` |
| Testes | `installment-service.test.ts` · `csv-import-service.test.ts` · `month-service.test.ts` · `InstallmentSchedule.test.tsx` · `InstallmentGroupPanel.test.tsx` · `cashflow-forecast.test.ts` · `account-backup.test.ts` |

### 7.1 Schema (migração aditiva única)

```prisma
model InstallmentGroup {
  // ...
  /// Parcelas deste grupo entram automaticamente ao criar um mês novo.
  /// false para grupo criado por import: a fatura é a fonte da parcela.
  autoCreateOnNewMonth Boolean @default(true) @map("auto_create_on_new_month")
}

model PendingInstallment {
  // ...
  /// Marcada como paga fora do app (histórico). Conta no progresso do grupo,
  /// mas não gera Transaction nem altera total de mês.
  settledAt DateTime? @map("settled_at")
}
```

`DEFAULT true` reproduz o comportamento atual para todo grupo já existente — daí a necessidade do backfill numa **segunda** migração (não editar a primeira depois de aplicada: o Prisma guarda checksum):

```sql
UPDATE "installment_groups" g SET "auto_create_on_new_month" = false
WHERE EXISTS (
  SELECT 1 FROM "transactions" t
  WHERE t."installment_group_id" = g."id" AND t."source" IN ('csv_import', 'xlsx_import')
);
```

Após `migrate dev`/`generate`, **reiniciar o app** (`docker compose restart app`) — singleton do Prisma Client, CLAUDE §8.

### 7.2 Ancoragem no mês de competência (BUG-01)

```ts
// ✅ Correto — âncora = mês do import, na maior parcela presente
const anchor = [...suggestion.lines].sort((a, b) => b.installmentNumber - a.installmentNumber)[0];
const anchorTx = transactionData.find((t) => t.rowIndex === anchor.rowIndex);
// month.year / month.month vêm do Month de destino já validado no início do executeImport
const expectedDateFor = (n: number) => {
  const offset = n - anchor.installmentNumber;
  const slot = addUTCMonths(month.year, month.month, offset); // { year, month }
  const day = anchorTx.occurredOn.getUTCDate();
  return utcDateOnly(slot.year, slot.month, Math.min(day, daysInMonthUTC(slot.year, slot.month)));
};

// ❌ Anti-padrão (código atual) — data da compra como âncora
const startDate = addMonths(firstPresentTx.occurredOn, -(firstPresent.installmentNumber - 1));
```

### 7.3 Casamento com grupo existente (BUG-03)

```ts
export type ImportGroupMatchCandidate = {
  suggestionId: string;
  normalizedDescription: string;
  installmentCount: number;
  occurredOn: string; // YYYY-MM-DD da linha âncora
  installmentNumbers: number[];
};

export type ImportGroupMatch = {
  suggestionId: string;
  groupId: string;
  description: string;
  installmentCount: number;
  /** Parcelas ainda pendentes (settledAt = null) no grupo */
  pendingNumbers: number[];
  /** Parcelas já lançadas como Transaction no grupo */
  launchedNumbers: number[];
  matchedBy: "purchase_date" | "installment_number";
} | {
  suggestionId: string;
  ambiguous: true;
  candidateCount: number;
};

// ✅ multi-tenancy: accountId sempre no where da busca de grupos
```

### 7.4 Preview de automações do mês (BUG-04)

```ts
export type MonthAutomationItem = {
  id: string;                       // templateId | pendingInstallmentId
  label: string;                    // nome do modelo | descrição da parcela
  detail: string;                   // "Gastos › Cartão · 12 itens" | "6/12 · vem da fatura"
  amountCents: string;              // serializado (RSC boundary)
  defaultSelected: boolean;
  disabledReason: string | null;    // modelo mal configurado
};

export type MonthAutomationGroup = {
  kind: "table_template" | "pending_installment";
  items: MonthAutomationItem[];
};

// createMonthSchema ganha:
//   selection: z.object({
//     templateIds: z.array(cuidSchema),
//     pendingInstallmentIds: z.array(cuidSchema),
//   }).optional()
// Ausente ⇒ comportamento atual (aplica todos os autoApply + pendentes com flag ligada).
```

### 7.5 Ordem de implementação

| Pacote | Cobre | Depende |
|---|---|---|
| P1 — migração + UTC + ancoragem | BUG-01, BUG-07, schema | — |
| P2 — cronograma: competência e "paga (histórico)" | BUG-02, BUG-05 | P1 |
| P3 — vínculo com grupo existente no import | BUG-03 | P1 |
| P4 — flag + modal de automações do mês | BUG-04 | P1 |
| P5 — rodapé do painel + toggle da flag | BUG-06, BUG-04 (UI) | P2, P4 |

Cada pacote fecha em um commit verde (`pnpm typecheck` + `pnpm test`).
