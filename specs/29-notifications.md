# Spec 29 — Notificações In-App

> Status: implemented (notification-service, NotificationBell, notifications.ts action, notifyTransactionMutation integrado nos services — 2026-07-11)
> Insumo: docs/v2-analysis.md §6 F-06
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`email-resend`](../skills/email-resend/SKILL.md) · [`logging`](../skills/logging/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

Em accounts colaborativas (casal, família, sócios), não há nenhuma forma de saber que outro membro fez algo relevante: adicionou transações, alterou um valor, aceitou um convite. O usuário só percebe mudanças se recarregar a página manualmente e comparar visualmente. Para uma ferramenta de uso compartilhado, isso remove o senso de co-presença e pode gerar conflitos quando dados são alterados por outro membro sem aviso.

---

## 2. Solução

Implementar um sistema de notificações in-app com:
- Ícone de sino no AppBar com badge de contagem não lida
- Dropdown ou drawer de notificações listando os eventos recentes
- Eventos gerados pelas ações de membros na account

As notificações são geradas no servidor (assincronamente, após mutações) e armazenadas no banco. Não há push notifications nesta spec — apenas notificações visíveis ao abrir o app ou recarregar.

---

## 3. User Stories

- Como membro de uma account colaborativa, quero ser notificado quando outro membro adicionar transações, para estar ciente das mudanças nos dados.
- Como owner de uma account, quero saber quando um convite foi aceito e um novo membro entrou.
- Como usuário, quero marcar notificações como lidas para não ver sempre as mesmas.

---

## 4. Critérios de Aceitação

**Geração de notificações:**

- QUANDO um membro (que não seja o próprio usuário) cria uma ou mais transações, UMA NOTIFICAÇÃO DEVE ser gerada ou atualizada para todos os outros membros da account (owner, editor e viewer).
  - A notificação é **agrupada por ator + mês**: se já existe uma notificação **não lida** do mesmo ator (`actorId`) para o mesmo mês (`link`) do tipo `transactions_added`, ela é atualizada (incrementa contagem no `title` + atualiza `createdAt`). Caso contrário, cria uma nova.
  - Se a notificação anterior já estava marcada como lida, cria uma **nova** notificação (não reutiliza a lida).
  - Notificações de atores diferentes no mesmo mês geram entradas **separadas**.
  - Texto: `"[Nome] adicionou X transação(ões) em [Mês] [Ano]"`.
  - O campo `link` armazena o `monthId`; o componente constrói a URL como `/${accountId}/months/${monthId}`.
- QUANDO um convite é aceito, UMA NOTIFICAÇÃO DEVE ser gerada para **todos** os membros da account (owner, editor e viewer) com: `"[Nome] entrou na conta como [papel]"`.
  - O campo `link` é `null` (notificação informativa, sem navegação).
  - Sem agrupamento — cada aceitação gera uma nova notificação.
- QUANDO um membro deleta uma transação, UMA NOTIFICAÇÃO DEVE ser gerada ou atualizada para os outros membros, com a **mesma lógica de agrupamento** de `transactions_added`.
  - Texto: `"[Nome] deletou X transação(ões) em [Mês] [Ano]"`.
  - O campo `link` armazena o `monthId` do mês onde a transação estava.

**Visualização:**

- O AppBar DEVE ter um ícone de sino (`NotificationsOutlined`) com um badge numérico vermelho indicando o total de notificações não lidas.
- QUANDO o badge é 0, ELE NÃO DEVE ser exibido (ícone sem badge).
- O count inicial é **server-side rendered** no layout — o `NotificationBell` recebe `initialUnreadCount` como prop via RSC.
- AO CLICAR NO SINO, UM DROPDOWN/POPOVER DEVE abrir com a lista de notificações mais recentes (máximo 20).
- CADA NOTIFICAÇÃO DEVE exibir: ícone do tipo, texto descritivo, data/hora relativa (ex: "há 2 horas") e indicador visual de lida/não-lida.
- QUANDO o usuário clica em uma notificação com `link`, O SISTEMA DEVE navegar para o mês correspondente.
- Notificações do tipo `invite_accepted` (link `null`) não são clicáveis.

**Marcação como lida:**

- AO ABRIR O DROPDOWN, **todas** as notificações do usuário nessa account são marcadas como lidas no banco (não apenas as 20 visíveis). O badge atualiza para 0 imediatamente.

**Polling:**

- O endpoint `GET /api/v1/notifications` retorna apenas `{ unreadCount: number }`.
- O badge DEVE ser atualizado periodicamente via polling a cada **60 segundos**.
- Alternativamente: atualizado ao focar na aba do browser.

---

## 5. Fora de Escopo

- Notificações por email (pode integrar com Resend em iteração futura).
- Push notifications via Service Worker/PWA (possível integração com spec 28 futuramente).
- Notificações em tempo real (WebSocket/SSE) — polling é suficiente para o público-alvo.
- Configurações granulares de quais eventos notificar (todos os eventos definidos nesta spec são sempre ativados).
- Notificações para o próprio usuário sobre suas próprias ações.
- Botão "Marcar todas como lidas" — substituído pelo comportamento de marcar todas ao abrir o dropdown.

---

## 6. Referências Técnicas

**Schema — novo modelo `Notification`:**
```prisma
model Notification {
  id        String   @id @default(cuid())
  accountId String   @map("account_id")
  userId    String   @map("user_id")    // destinatário
  actorId   String   @map("actor_id")   // quem realizou a ação
  type      String
  title     String
  body      String?
  link      String?                      // monthId para transactions_added/deleted; null para invite_accepted
  isRead    Boolean  @default(false) @map("is_read")
  createdAt DateTime @default(now()) @map("created_at")

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  user    User    @relation("NotificationRecipient", fields: [userId], references: [id], onDelete: Cascade)
  actor   User    @relation("NotificationActor", fields: [actorId], references: [id], onDelete: Cascade)

  @@index([userId, accountId, isRead])
  @@index([accountId])
  @@map("notifications")
}
```

**Lógica de agrupamento (upsert no service):**

A chave lógica de agrupamento para `transactions_added` e `transaction_deleted` é `(userId, accountId, type, link, actorId)` onde `isRead = false`. Como a condição inclui `isRead`, não é possível usar `@@unique` no schema — implementar via `findFirst` + `update`/`create` condicional no service:

```ts
// Pseudocódigo do notification-service
async function createOrUpdateNotification(params) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      accountId: params.accountId,
      type: params.type,
      link: params.link,
      actorId: params.actorId,
      isRead: false,
    },
  });

  if (existing) {
    await prisma.notification.update({
      where: { id: existing.id },
      data: { title: params.title, createdAt: new Date() },
    });
  } else {
    await prisma.notification.create({ data: params });
    await enforceNotificationLimit(params.userId, params.accountId);
  }
}
```

| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Novo modelo `Notification` com campos `actorId`, relações nomeadas |
| `src/server/services/notification-service.ts` | `createOrUpdateNotification`, `markAllReadForUser`, `listNotifications`, `getUnreadCount` |
| `src/actions/notifications.ts` | Action para buscar lista ao abrir dropdown + disparar `markAllReadForUser` |
| `src/server/services/transaction-service.ts` | Chamar notification service após create/delete (fire-and-forget) |
| `src/server/services/member-service.ts` | Chamar notification service após acceptInvite (fire-and-forget) |
| `src/app/api/v1/notifications/route.ts` | `GET` retorna `{ unreadCount: number }` |
| `src/components/ui/NotificationBell.tsx` | Client Component com polling; recebe `initialUnreadCount: number` como prop |
| `src/app/(app)/[accountId]/layout.tsx` | SSR do `unreadCount` inicial; inclui `NotificationBell` no AppBar |

- Tipos de notificação (`type`): `"transactions_added"`, `"transaction_deleted"`, `"invite_accepted"`.
- Geração de notificações deve ser **fire-and-forget** (não bloquear a action principal).
- Manter no máximo **100 notificações por usuário por account** — ao criar nova notificação que ultrapasse o limite, deletar as mais antigas.
- Todos os papéis (owner, editor, viewer) recebem **todos** os tipos de notificação.
