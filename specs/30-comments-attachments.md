# Spec 30 — Comentários e Anexos em Transações

> Status: draft
> Insumo: docs/v2-analysis.md §6 F-07, F-08
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`forms-zod-rhf`](../skills/forms-zod-rhf/SKILL.md) · [`env-validation`](../skills/env-validation/SKILL.md) · [`testing`](../skills/testing/SKILL.md)

---

## 1. Problema

Em contas colaborativas, o campo `notes` de uma transação serve para anotações do criador, mas não permite diálogo entre membros. Não há como um membro perguntar "o que foi isso?" e outro responder contextualmente dentro da transação. Além disso, não existe forma de anexar um comprovante ou foto de recibo a uma transação — os usuários que precisam manter documentação financeira não têm alternativa dentro do app.

---

## 2. Solução

**Comentários**: Adicionar uma thread de comentários por transação, acessível através do Painel de Detalhes (spec 27). Cada comentário tem autor, texto e data.

**Anexos**: Permitir o upload de arquivos (imagem ou PDF) como comprovante de uma transação, também acessível via Painel de Detalhes. Os arquivos são armazenados em object storage (S3 ou Cloudflare R2).

Ambas as funcionalidades ficam dentro do Painel de Detalhes da transação (spec 27), mantendo a tabela principal limpa e sem sobrecarga visual.

---

## 3. User Stories

- Como membro de uma account, quero adicionar um comentário em uma transação para dar contexto ou fazer uma pergunta para os outros membros.
- Como membro, quero ver os comentários de outros membros em uma transação, para entender o contexto sem precisar perguntar fora do app.
- Como usuário, quero fazer upload do comprovante/recibo de uma transação, para ter documentação financeira centralizada.
- Como usuário, quero visualizar os anexos de uma transação diretamente no app, sem precisar baixar.

---

## 4. Critérios de Aceitação

**Comentários:**
- O Painel de Detalhes (spec 27) DEVE ter uma seção "Comentários" com a thread de comentários da transação.
- QUANDO não há comentários, A SEÇÃO DEVE exibir o estado vazio "Nenhum comentário ainda".
- O USUÁRIO DEVE poder adicionar um comentário digitando no campo de texto e pressionando Enter ou clicando "Enviar".
- CADA COMENTÁRIO DEVE exibir: avatar + nome do autor, texto, data/hora relativa.
- O AUTOR do comentário DEVE poder deletar seu próprio comentário.
- Um owner/editor DEVE poder deletar qualquer comentário da account.
- Comentários DEVEM ser ordenados cronologicamente (mais antigo primeiro).
- QUANDO um comentário é adicionado, O ÍCONE DE COMENTÁRIO na linha da transação na tabela DEVE ser exibido (similar ao ícone de notas, spec 20 UX-08).

**Anexos:**
- O Painel de Detalhes DEVE ter uma seção "Anexos" com a lista de arquivos vinculados à transação.
- O USUÁRIO DEVE poder fazer upload de um arquivo (imagem JPG/PNG ou PDF) clicando em "Adicionar anexo" ou arrastando o arquivo.
- O tamanho máximo por arquivo DEVE ser 10MB.
- CADA ANEXO DEVE exibir: miniatura (para imagens) ou ícone PDF, nome do arquivo, tamanho.
- Imagens DEVEM ser visualizáveis inline (lightbox simples) sem download.
- PDFs DEVEM ser abertos em nova aba para visualização.
- O USUÁRIO DEVE poder deletar um anexo.
- SE o storage não estiver configurado (`STORAGE_PROVIDER` env var ausente), O BOTÃO DE UPLOAD não DEVE ser exibido e a feature deve degradar graciosamente.

---

## 5. Fora de Escopo

- Edição de comentários (apenas criação e deleção).
- Menções a membros em comentários (`@nome`).
- Reações a comentários (emoji reactions).
- Versioning de anexos.
- Compressão automática de imagens (upload direto sem processamento).
- Limite de número de anexos por transação na V2 (pode ser adicionado se necessário).

---

## 6. Referências Técnicas

**Schema — novos modelos:**
```prisma
model TransactionComment {
  id            String   @id @default(cuid())
  transactionId String   @map("transaction_id")
  accountId     String   @map("account_id")
  userId        String   @map("user_id")
  text          String
  createdAt     DateTime @default(now()) @map("created_at")

  transaction Transaction @relation(...)
  account     Account     @relation(...)
  user        User        @relation(...)

  @@index([transactionId])
  @@map("transaction_comments")
}

model TransactionAttachment {
  id            String   @id @default(cuid())
  transactionId String   @map("transaction_id")
  accountId     String   @map("account_id")
  userId        String   @map("user_id")
  fileName      String   @map("file_name")
  fileSize      Int      @map("file_size")
  mimeType      String   @map("mime_type")
  storageKey    String   @map("storage_key")
  createdAt     DateTime @default(now()) @map("created_at")

  transaction Transaction @relation(...)
  account     Account     @relation(...)

  @@index([transactionId])
  @@map("transaction_attachments")
}
```

| Arquivo | Mudança |
|---------|---------|
| `prisma/schema.prisma` | Novos modelos acima |
| `src/server/services/comment-service.ts` | CRUD de comentários |
| `src/server/services/attachment-service.ts` | Upload/delete de anexos + presigned URLs |
| `src/actions/comments.ts`, `src/actions/attachments.ts` | Actions |
| `src/app/api/v1/attachments/upload/route.ts` | Route handler para upload (multipart) |
| `src/components/transactions/TransactionDetailDrawer.tsx` | Adicionar seções de comentários e anexos (spec 27) |

**Storage:**
- Suportar dois providers via env: `STORAGE_PROVIDER=s3` ou `STORAGE_PROVIDER=r2`
- Variáveis: `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_ENDPOINT` (para R2)
- Usar SDK `@aws-sdk/client-s3` com `getSignedUrl` para download seguro
- Chave de storage: `accounts/{accountId}/transactions/{transactionId}/{uuid}.{ext}`
