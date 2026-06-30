# Spec 45 — Feed de Atividade e Menções

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Colaboração
> Skills: [`server-actions`](../skills/server-actions/SKILL.md) · [`ui-feedback`](../skills/ui-feedback/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md)

---

## 1. Problema

- **FEED-01**: Já existem notificações in-app (Spec 29, model `Notification` em `prisma/schema.prisma:590-610`, com `type` String e `actorId`) e comentários/anexos (Spec 30, models `TransactionComment` / `TransactionAttachment`), mas não há um **feed cronológico consolidado** de atividade da Account. O membro não tem onde ver "o que aconteceu nesta Account" — quem lançou/editou/deletou transações em lote, quem comentou, quem aceitou convite — numa única linha do tempo filtrável.
- **FEED-02**: Não há **@menções** de membros nos comentários. Hoje um comentário (`TransactionComment`) é texto livre; escrever "@maria confere isso?" não resolve o membro nem dispara notificação direcionada a ela. A menção deveria gerar uma `Notification` para o membro citado.

---

## 2. Solução

### 2.1 Feed de atividade consolidado (FEED-01)

Novo modelo `ActivityEvent`: um registro append-only por evento relevante da Account, gravado pela camada de serviço quando a ação ocorre.

```prisma
enum ActivityEventType {
  transactions_created   // 1+ transações criadas (lote)
  transactions_updated   // 1+ transações editadas (lote)
  transactions_deleted   // 1+ transações deletadas (lote)
  comment_added          // comentário em transação (Spec 30)
  invite_accepted        // membro aceitou convite (Spec 04)

  @@map("activity_event_type")
}

model ActivityEvent {
  id        String            @id @default(cuid())
  accountId String            @map("account_id")
  actorId   String            @map("actor_id")   // quem fez a ação
  type      ActivityEventType
  summary   String                               // texto pré-renderizado ("João criou 5 transações")
  link      String?                              // deep-link para o alvo
  metadata  Json              @default("{}")     // ids/contagens do evento (ex: { count: 5, tableId })
  createdAt DateTime          @default(now()) @map("created_at")

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  actor   User    @relation("ActivityEventActor", fields: [actorId], references: [id], onDelete: Cascade)

  @@index([accountId, createdAt])
  @@index([accountId, type])
  @@map("activity_events")
}
```

- O feed é **separado** de `Notification`: notificação é "preciso agir/saber sobre algo meu"; atividade é "histórico do que aconteceu na Account". Operações em lote viram **um** evento agregado (`count` no metadata), não N eventos.
- Tela de feed cronológica (DESC) com filtros por `type` e por membro (`actorId`).

### 2.2 @Menções em comentários (FEED-02)

- Parser de `@menção` no corpo do `TransactionComment`: ao salvar, o serviço extrai tokens `@nome`/`@email`, resolve contra `AccountMember` da Account e, para cada membro resolvido, dispara uma `Notification` direcionada (reusando `notification-service` da Spec 29) com `type = "mention"` e `link` para a transação comentada.
- Tokens que não resolvem para um membro da Account são ignorados (texto literal permanece).

## 3. User Stories

- Como membro de uma Account, quero ver um feed cronológico do que aconteceu (lançamentos em lote, comentários, convites aceitos), para acompanhar a atividade sem revisar cada tela.
- Como membro, quero filtrar o feed por tipo de evento e por quem fez, para encontrar rapidamente "o que a Maria mexeu".
- Como membro, quero mencionar @outro-membro num comentário, para chamar a atenção dele com uma notificação direcionada.
- Como membro mencionado, quero receber uma notificação com link para o comentário, para responder no contexto certo.

## 4. Critérios de Aceitação

**FEED-01 (feed):**
- QUANDO uma transação é criada/editada/deletada (individual ou em lote), comentada, ou um convite é aceito, O SERVIÇO DEVE gravar um `ActivityEvent` com `type`, `actorId`, `summary` e `createdAt` correspondentes.
- QUANDO uma operação afeta N transações de uma vez, O SERVIÇO DEVE gravar **um** `ActivityEvent` agregado com a contagem no `metadata`, não N eventos.
- QUANDO o usuário abre o feed, OS EVENTOS DEVEM vir em ordem cronológica decrescente e DEVEM ser filtráveis por `type` e por `actorId`.

**FEED-02 (menções):**
- QUANDO um comentário contém `@token` que resolve para um membro da Account, O SERVIÇO DEVE criar uma `Notification` (`type = "mention"`) direcionada a esse membro com `link` para a transação.
- QUANDO um `@token` não resolve para nenhum membro da Account, O SISTEMA NÃO DEVE criar notificação e DEVE manter o texto literal.
- QUANDO um comentário menciona o próprio autor, O SISTEMA NÃO DEVE notificar o autor de si mesmo.

**Multi-tenancy:**
- QUANDO o feed é consultado ou um evento é gravado, A ACTION DEVE começar com `requireAccountAccess(accountId)` e toda query DEVE filtrar por `accountId`.
- QUANDO uma menção resolve um usuário que pertence a outra Account, O SISTEMA NÃO DEVE notificá-lo (só membros da Account corrente são alvos válidos).
- QUANDO o feed de uma Account é carregado, ELE NÃO DEVE conter eventos de outra Account.

## 5. Fora de Escopo

- Comentários em entidades além de transação (seção, mês) — menção e feed cobrem o que a Spec 30 já modela (transação).
- Renderização rica de Markdown no comentário — apenas o realce/linkagem da `@menção`; o resto do parser fica para spec futura.
- E-mail de menção (além da notificação in-app) — pode reusar `email-resend` depois; não nesta spec.
- Reações/likes em eventos do feed.
- Edição/exclusão de `ActivityEvent` — feed é append-only (histórico imutável).
- Configuração granular de quais tipos de evento geram entrada no feed — todos os tipos do enum sempre registram.

## 6. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| FEED-01 schema | `prisma/schema.prisma` (enum `ActivityEventType`, model `ActivityEvent`, relações em `Account`, `User`) |
| Migration | `prisma/migrations/` (`add_activity_events`) |
| Gravação de eventos | `src/server/services/activity-service.ts` (`recordActivity`), chamado por `transaction-service.ts`, `comment-service.ts` (Spec 30), `invite-service.ts` (Spec 04) |
| Leitura do feed | `src/server/services/activity-service.ts` (`listActivity` com filtros `type` / `actorId`) |
| FEED-02 parser de menção | `src/lib/mentions.ts` (extrai `@token`), `src/server/services/comment-service.ts` (resolve membro + dispara notificação) |
| Reuso de notificação | `src/server/services/notification-service.ts` (Spec 29) — `type = "mention"` |
| Actions | `src/actions/activity.ts` (`listActivityAction`) com `defineAction` |
| UI feed | `src/components/activity/ActivityFeed.tsx` (lista + filtros) |
| Mensagens | `src/lib/messages/pt-BR.ts` (rótulos de tipo de evento, "Feed de atividade", texto de menção) |
| Testes | `src/server/services/activity-service.test.ts` (agregação em lote, filtros, multi-tenancy), `src/lib/mentions.test.ts` (parser), menção dispara notificação |
