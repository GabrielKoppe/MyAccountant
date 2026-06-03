# Spec 29 — Notificações In-App

> Status: draft
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
- Como usuário, quero marcar notificações como lidas, para não ver sempre as mesmas.
- Como usuário, quero poder limpar todas as notificações de uma vez.

---

## 4. Critérios de Aceitação

**Geração de notificações:**
- QUANDO um membro (que não seja o próprio usuário) cria uma ou mais transações, UMA NOTIFICAÇÃO DEVE ser gerada para todos os outros membros da account com a descrição: "[Nome] adicionou X transação(ões) em [Seção]/[Mês]".
- QUANDO um convite é aceito, UMA NOTIFICAÇÃO DEVE ser gerada para o owner e editores com: "[Nome] entrou na conta como [papel]".
- QUANDO um membro deleta uma transação, UMA NOTIFICAÇÃO DEVE ser gerada para os outros membros.

**Visualização:**
- O AppBar DEVE ter um ícone de sino (`NotificationsOutlined`) com um badge numérico vermelho indicando o total de notificações não lidas.
- QUANDO o badge é 0, ELE NÃO DEVE ser exibido (ícone sem badge).
- AO CLICAR NO SINO, UM DROPDOWN/POPOVER DEVE abrir com a lista de notificações mais recentes (máximo 20).
- CADA NOTIFICAÇÃO DEVE exibir: ícone do tipo, texto descritivo, data/hora relativa (ex: "há 2 horas"), e indicador visual de lida/não-lida.
- QUANDO o usuário clica em uma notificação relevante (ex: nova transação), O SISTEMA DEVE navegar para o contexto correspondente (mês/seção).
- O USUÁRIO DEVE poder marcar uma notificação individual como lida clicando nela.
- O USUÁRIO DEVE poder marcar todas como lidas com um botão "Marcar todas como lidas".

**Polling:**
- O número de notificações não lidas DEVE ser atualizado periodicamente (polling a cada 60 segundos) sem recarregar a página.
- Alternativamente: atualizado ao focar na aba do browser.

---

## 5. Fora de Escopo

- Notificações por email (pode integrar com Resend em iteração futura).
- Push notifications via Service Worker/PWA (possível integração com spec 28 futuramente).
- Notificações em tempo real (WebSocket/SSE) — polling é suficiente para o público-alvo.
- Configurações granulares de quais eventos notificar (todos os eventos definidos nesta spec são sempre ativados).
- Notificações para o próprio usuário sobre suas próprias ações.

---

## 6. Referências Técnicas

**Schema — novo modelo `Notification`:**
```prisma
model Notification {
  id         String   @id @default(cuid())
  accountId  String   @map("account_id")
  userId     String   @map("user_id")
  type       String
  title      String
  body       String?
  link       String?
  isRead     Boolean  @default(false) @map("is_read")
  createdAt  DateTime @default(now()) @map("created_at")

  account Account @relation(...)
  user    User    @relation(...)

  @@index([userId, isRead])
  @@index([accountId])
  @@map("notifications")
}
```

| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Novo modelo `Notification` |
| `src/server/services/notification-service.ts` | Novo service para criar e marcar notificações |
| `src/actions/notifications.ts` | Actions para marcar lidas |
| `src/server/services/transaction-service.ts` | Chamar notification service após create/delete |
| `src/server/services/member-service.ts` | Chamar notification service após acceptInvite |
| `src/app/api/v1/notifications/route.ts` | Endpoint GET para polling do badge count |
| `src/components/ui/NotificationBell.tsx` | Novo componente (Client Component com polling) |
| `src/app/(app)/[accountId]/layout.tsx` | Incluir `NotificationBell` no AppBar |

- Tipos de notificação (`type`): `"transactions_added"`, `"transaction_deleted"`, `"invite_accepted"`.
- Geração de notificações deve ser **fire-and-forget** (não bloquear a action principal), assim como o envio de email já é.
- Manter no máximo 100 notificações por usuário por account (deletar as mais antigas ao inserir novas que ultrapassem o limite).
