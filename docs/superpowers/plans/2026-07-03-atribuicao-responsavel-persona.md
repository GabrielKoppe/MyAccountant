# Atribuição de Responsável por Persona — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan phase-by-phase. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o responsável de uma transação (hoje FK única para `User`) por uma entidade `ResponsibleParty` (persona) que representa um membro, um grupo de membros (responsabilidade conjunta) ou uma pessoa externa sem login, preservando cardinalidade 1 e o invariante da análise por membro.

**Architecture:** Nova entidade account-scoped `ResponsibleParty` + join `ResponsiblePartyMember`. `Transaction`/`TableTemplateItem`/`AccountSettings` trocam a FK `responsibleUserId`→`responsiblePartyId` (cardinalidade 1 mantida → `groupBy` e `sharePercent` inalterados algoritmicamente). Migração aditiva idempotente cria uma party `personal` por membro/responsável legado e faz backfill. UI ganha seletor de party + seção de settings "Responsáveis" com emoji.

**Tech Stack:** Next.js 15 (App Router), Prisma + PostgreSQL 16, Zod, React Hook Form, MUI v6, Vitest + vitest-mock-extended. Tudo roda em container: `docker compose exec app <cmd>`.

## Global Constraints

- Dinheiro sempre `BigInt` em centavos — esta feature NÃO toca em valor (atribuição, não rateio).
- Toda query Prisma que toca dados de Account filtra por `accountId` (multi-tenancy).
- Toda Server Action usa `defineAction()` de `src/server/api/define-action.ts`; lógica no service.
- Zod é fonte única (`src/lib/schemas/`); mesmo schema valida form + action.
- UI só MUI + tokens semânticos; `<DialogShell>`/`<PageHeader>`/`<EmptyState>`; sem hex hardcoded.
- Mensagens de UI centralizadas em `src/lib/messages/pt-BR.ts` (objeto `m`).
- Sem `console.log` — usar `logger` Pino (`src/server/logger`).
- Sem `process.env.X` direto — usar `env` de `src/lib/env.ts`.
- Comandos: `docker compose exec app pnpm <script>`. Migrations: `docker compose exec app pnpm prisma migrate dev --name <snake_case>`.
- Fronteira Spec 42: atribuição ≠ rateio. NÃO criar `ExpenseSplit` aqui. Group party NUNCA explode em membros na analytics.

---

## File Structure

| Arquivo | Responsabilidade | Fase |
|---|---|---|
| `prisma/schema.prisma` | enum `ResponsiblePartyKind`, models `ResponsibleParty`/`ResponsiblePartyMember`, `responsiblePartyId` em Transaction/TableTemplateItem/AccountSettings | 1 |
| `prisma/migrations/*/migration.sql` (backfill) | criação de parties personal + backfill idempotente | 1 |
| `src/lib/schemas/responsible-party.ts` (novo) | Zod: create/update/delete/archive party, `icon` = emoji único, membros por kind | 2 |
| `src/server/services/responsible-party-service.ts` (novo) | CRUD, invariantes de kind, multi-tenancy | 2 |
| `src/server/services/responsible-party-service.test.ts` (novo) | testes de kind/invariante/tenant | 2 |
| `src/actions/responsible-parties.ts` (novo) | actions `defineAction` | 2 |
| `src/server/api/revalidate.ts` (modif) | `revalidateResponsibleParties` | 2 |
| `src/lib/schemas/transaction.ts`, `settings.ts`, `table-template.ts`, `csv-import.ts` (modif) | rename campo | 3 |
| `src/server/queries/member-analytics.ts` (modif) | groupBy por party + resolução de nome | 3 |
| `src/server/queries/{kpi-custom,filtered-transactions,sandbox,budgets,month-page}.ts` (modif) | rename filtro | 3 |
| `src/server/services/{transaction,month,account-settings,finance-table,table-template,csv-import,budget}-service.ts` (modif) | rename campo | 3 |
| `src/lib/{csv-parser,serializers/transaction}.ts` (modif) | rename + party externa no mapping | 3 |
| `src/components/transactions/ResponsiblePartySelect.tsx` (novo) | seletor agrupado de party | 4 |
| `src/components/settings/ResponsiblePartiesManager.tsx` (novo) | CRUD UI + emoji picker | 4 |
| `src/app/(app)/[accountId]/settings/responsibles/page.tsx` (novo) | página settings | 4 |
| UI existente (`NewTransactionRow`, `TransactionRowEditor`, `TransactionRow`, `TransactionDetailDialog`, `GeneralSettingsForm`, filtros) (modif) | usar seletor/render party | 4 |
| `src/lib/messages/pt-BR.ts` (modif) | labels | 4 |

---

## Phase 1 — Schema, migração aditiva e backfill

**Deliverable:** schema com `ResponsibleParty` + colunas `responsiblePartyId` (mantendo `responsibleUserId`), migração aplicada, dados backfilled. Coluna legada preservada p/ rollback (DD-08).

**Interfaces produzidas:** models Prisma `ResponsibleParty { id, accountId, name, kind, icon, archivedAt, createdAt, updatedAt }`, `ResponsiblePartyMember { partyId, userId }`; campos `Transaction.responsiblePartyId?`, `TableTemplateItem.responsiblePartyId?`, `AccountSettings.defaultResponsiblePartyId?`.

- [ ] **Step 1: Adicionar enum + models ao schema**

Em `prisma/schema.prisma`, após o bloco `AccountSettings` (antes de `TableType`), adicionar:

```prisma
enum ResponsiblePartyKind {
  personal
  group
  external

  @@map("responsible_party_kind")
}

model ResponsibleParty {
  id         String               @id @default(cuid())
  accountId  String               @map("account_id")
  name       String
  kind       ResponsiblePartyKind
  icon       String?
  archivedAt DateTime?            @map("archived_at")
  createdAt  DateTime             @default(now()) @map("created_at")
  updatedAt  DateTime             @updatedAt @map("updated_at")

  account      Account                  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  members      ResponsiblePartyMember[]
  transactions Transaction[]            @relation("TransactionResponsibleParty")
  templateItems TableTemplateItem[]     @relation("TemplateItemResponsibleParty")
  settingsDefaultOf AccountSettings[]   @relation("SettingsDefaultResponsibleParty")

  @@unique([accountId, name])
  @@index([accountId])
  @@map("responsible_parties")
}

model ResponsiblePartyMember {
  partyId String @map("party_id")
  userId  String @map("user_id")

  party ResponsibleParty @relation(fields: [partyId], references: [id], onDelete: Cascade)
  user  User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([partyId, userId])
  @@index([userId])
  @@map("responsible_party_members")
}
```

- [ ] **Step 2: Adicionar coluna + relação em `Transaction`** (mantendo `responsibleUserId`)

No model `Transaction`, após `responsibleUserId String? @map("responsible_user_id")` (linha ~370) adicionar campo escalar:

```prisma
  responsiblePartyId  String?                 @map("responsible_party_id")
```

E na lista de relações (após `responsibleUser  User? @relation("TransactionResponsible", ...)`, ~linha 393):

```prisma
  responsibleParty ResponsibleParty? @relation("TransactionResponsibleParty", fields: [responsiblePartyId], references: [id], onDelete: SetNull)
```

Adicionar índice junto aos outros `@@index` do model:

```prisma
  @@index([responsiblePartyId])
```

- [ ] **Step 3: Adicionar coluna em `TableTemplateItem` e `AccountSettings`**

Em `TableTemplateItem` (após `responsibleUserId`, ~linha 512):

```prisma
  responsiblePartyId String? @map("responsible_party_id")
  responsibleParty   ResponsibleParty? @relation("TemplateItemResponsibleParty", fields: [responsiblePartyId], references: [id], onDelete: SetNull)
```

Em `AccountSettings` (após `defaultResponsibleUserId`, ~linha 239):

```prisma
  defaultResponsiblePartyId String? @map("default_responsible_party_id")
  defaultResponsibleParty   ResponsibleParty? @relation("SettingsDefaultResponsibleParty", fields: [defaultResponsiblePartyId], references: [id], onDelete: SetNull)
```

- [ ] **Step 4: Adicionar back-relation em `Account` e `User`**

Em `Account` (lista de relações, ~linha 190): `responsibleParties ResponsibleParty[]`
Em `User` (lista de relações): `responsiblePartyMemberships ResponsiblePartyMember[]`

- [ ] **Step 5: Validar e formatar o schema**

Run: `docker compose exec app pnpm prisma validate && docker compose exec app pnpm prisma format`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 6: Criar a migração (só DDL, ainda sem backfill)**

Run: `docker compose exec app pnpm prisma migrate dev --name add_responsible_party --create-only`
Expected: migração criada em `prisma/migrations/<ts>_add_responsible_party/migration.sql` (não aplicada ainda por causa do `--create-only`).

- [ ] **Step 7: Anexar backfill idempotente à migração**

Ao final do `migration.sql` gerado, anexar (usa `gen_random_uuid()` do Postgres para ids; cuid não é obrigatório em dados legados):

```sql
-- Backfill: uma ResponsibleParty 'personal' por (account, user) responsável legado ou membro atual.
-- Idempotente: só cria party quando ainda não existe link personal para o par.
WITH candidate_pairs AS (
  SELECT DISTINCT account_id, user_id FROM (
    SELECT account_id, user_id FROM account_members
    UNION
    SELECT account_id, responsible_user_id AS user_id FROM transactions WHERE responsible_user_id IS NOT NULL
    UNION
    SELECT tti.account_id, tti.responsible_user_id AS user_id
      FROM table_template_items tti WHERE tti.responsible_user_id IS NOT NULL
    UNION
    SELECT account_id, default_responsible_user_id AS user_id FROM account_settings WHERE default_responsible_user_id IS NOT NULL
  ) s
),
new_parties AS (
  INSERT INTO responsible_parties (id, account_id, name, kind, created_at, updated_at)
  SELECT gen_random_uuid()::text, cp.account_id,
         COALESCE(u.name, u.email) AS name, 'personal', now(), now()
  FROM candidate_pairs cp
  JOIN users u ON u.id = cp.user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM responsible_party_members rpm
    JOIN responsible_parties rp ON rp.id = rpm.party_id
    WHERE rp.account_id = cp.account_id AND rpm.user_id = cp.user_id AND rp.kind = 'personal'
  )
  RETURNING id, account_id, name
)
INSERT INTO responsible_party_members (party_id, user_id)
SELECT np.id, cp.user_id
FROM new_parties np
JOIN candidate_pairs cp ON cp.account_id = np.account_id
JOIN users u ON u.id = cp.user_id AND COALESCE(u.name, u.email) = np.name;

-- Mapa (account, user) -> personal party id
-- Backfill transactions.responsible_party_id
UPDATE transactions t
SET responsible_party_id = rp.id
FROM responsible_party_members rpm
JOIN responsible_parties rp ON rp.id = rpm.party_id AND rp.kind = 'personal'
WHERE rpm.user_id = t.responsible_user_id
  AND rp.account_id = t.account_id
  AND t.responsible_user_id IS NOT NULL
  AND t.responsible_party_id IS NULL;

-- Backfill table_template_items.responsible_party_id
UPDATE table_template_items tti
SET responsible_party_id = rp.id
FROM responsible_party_members rpm
JOIN responsible_parties rp ON rp.id = rpm.party_id AND rp.kind = 'personal'
WHERE rpm.user_id = tti.responsible_user_id
  AND rp.account_id = tti.account_id
  AND tti.responsible_user_id IS NOT NULL
  AND tti.responsible_party_id IS NULL;

-- Backfill account_settings.default_responsible_party_id
UPDATE account_settings s
SET default_responsible_party_id = rp.id
FROM responsible_party_members rpm
JOIN responsible_parties rp ON rp.id = rpm.party_id AND rp.kind = 'personal'
WHERE rpm.user_id = s.default_responsible_user_id
  AND rp.account_id = s.account_id
  AND s.default_responsible_user_id IS NOT NULL
  AND s.default_responsible_party_id IS NULL;
```

> Nota: o `JOIN ... ON COALESCE(name)=np.name` liga o member recém-criado à party pela chave `(account_id, name)` que é `@@unique`. Como `name` é único por account, o join é seguro.

- [ ] **Step 8: Aplicar a migração**

Run: `docker compose exec app pnpm prisma migrate dev`
Expected: migração aplicada; `prisma generate` roda automaticamente.

- [ ] **Step 9 (TESTE DE FASE): Verificar backfill via query**

Run:
```bash
docker compose exec app node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const orphTx=await p.transaction.count({where:{responsibleUserId:{not:null},responsiblePartyId:null}});const dup=await p.\$queryRawUnsafe('SELECT rp.account_id, rpm.user_id, count(*) c FROM responsible_party_members rpm JOIN responsible_parties rp ON rp.id=rpm.party_id WHERE rp.kind=\'personal\' GROUP BY 1,2 HAVING count(*)>1');console.log('tx sem party (deve ser 0):',orphTx);console.log('pares personal duplicados (deve ser []):',dup);process.exit(orphTx===0&&dup.length===0?0:1)})()"
```
Expected: `tx sem party (deve ser 0): 0` e `pares personal duplicados (deve ser []): []`, exit 0.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): add ResponsibleParty entity + additive backfill migration"
```

---

## Phase 2 — Zod schema, service e actions

**Deliverable:** CRUD de parties com invariantes de kind e multi-tenancy, coberto por testes unitários (o teste de fase).

**Interfaces produzidas:**
- `src/lib/schemas/responsible-party.ts`: `createResponsiblePartySchema`, `updateResponsiblePartySchema`, `deleteResponsiblePartySchema`, `archiveResponsiblePartySchema`, tipos `CreateResponsiblePartyInput` etc. `icon: emojiSchema` (1 grapheme emoji, opcional).
- `src/server/services/responsible-party-service.ts`: `createResponsibleParty(input, ctx)`, `updateResponsibleParty(input, ctx)`, `archiveResponsibleParty(input, ctx)`, `deleteResponsibleParty(input, ctx)`, `listResponsibleParties(accountId)`.
- `src/actions/responsible-parties.ts`: `create/update/archive/deleteResponsiblePartyAction`.

- [ ] **Step 1: Escrever o schema Zod**

Create `src/lib/schemas/responsible-party.ts`:

```ts
import { z } from "zod";

// Emoji único: 1 a 8 code points, sem espaço/ascii de controle. Regex pragmática de emoji.
export const emojiSchema = z
  .string()
  .trim()
  .refine((s) => s.length > 0 && /\p{Extended_Pictographic}/u.test(s), "Escolha um emoji")
  .refine((s) => [...new Intl.Segmenter().segment(s)].length === 1, "Apenas um emoji");

const nameSchema = z.string().min(1, "Nome obrigatório").max(40).trim();

export const createResponsiblePartySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("group"),
    name: nameSchema,
    icon: emojiSchema.nullable().optional(),
    memberUserIds: z.array(z.string().cuid("ID inválido")).min(2, "Grupo exige ao menos 2 membros"),
  }),
  z.object({
    kind: z.literal("external"),
    name: nameSchema,
    icon: emojiSchema.nullable().optional(),
  }),
]);

export const updateResponsiblePartySchema = z.object({
  partyId: z.string().cuid("ID inválido"),
  name: nameSchema.optional(),
  icon: emojiSchema.nullable().optional(),
  memberUserIds: z.array(z.string().cuid("ID inválido")).min(2).optional(),
});

export const archiveResponsiblePartySchema = z.object({
  partyId: z.string().cuid("ID inválido"),
  archived: z.boolean(),
});

export const deleteResponsiblePartySchema = z.object({
  partyId: z.string().cuid("ID inválido"),
});

export type CreateResponsiblePartyInput = z.infer<typeof createResponsiblePartySchema>;
export type UpdateResponsiblePartyInput = z.infer<typeof updateResponsiblePartySchema>;
export type ArchiveResponsiblePartyInput = z.infer<typeof archiveResponsiblePartySchema>;
export type DeleteResponsiblePartyInput = z.infer<typeof deleteResponsiblePartySchema>;
```

> `personal` não é criável via UI (auto-gerido). Só `group`/`external` no discriminated union de create.

- [ ] **Step 2: Escrever o teste do service (FALHA primeiro)**

Create `src/server/services/responsible-party-service.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

vi.mock("@/server/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
import { prisma } from "@/server/prisma";
import * as svc from "./responsible-party-service";
import { AppError } from "@/server/api/errors";

const p = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;
const ctx = { userId: "u1", accountId: "acc1", role: "owner" as const };

beforeEach(() => mockReset(p));

describe("createResponsibleParty", () => {
  it("cria party group com >= 2 membros e o link", async () => {
    p.responsibleParty.create.mockResolvedValue({ id: "party1" } as never);
    const r = await svc.createResponsibleParty(
      { kind: "group", name: "Casal", icon: "🏠", memberUserIds: ["u1", "u2"] },
      ctx,
    );
    expect(r.id).toBe("party1");
    const arg = p.responsibleParty.create.mock.calls[0][0];
    expect(arg.data.accountId).toBe("acc1"); // multi-tenancy
    expect(arg.data.kind).toBe("group");
    expect(arg.data.members.create).toHaveLength(2);
  });

  it("cria party external sem membros", async () => {
    p.responsibleParty.create.mockResolvedValue({ id: "party2" } as never);
    await svc.createResponsibleParty({ kind: "external", name: "Filho", icon: "👶" }, ctx);
    const arg = p.responsibleParty.create.mock.calls[0][0];
    expect(arg.data.kind).toBe("external");
    expect(arg.data.members).toBeUndefined();
  });
});

describe("updateResponsibleParty multi-tenancy", () => {
  it("rejeita party de outra Account", async () => {
    p.responsibleParty.findFirst.mockResolvedValue(null); // filtro accountId não achou
    await expect(
      svc.updateResponsibleParty({ partyId: "other", name: "x" }, ctx),
    ).rejects.toBeInstanceOf(AppError);
  });
});
```

- [ ] **Step 3: Rodar o teste — deve FALHAR**

Run: `docker compose exec app pnpm test src/server/services/responsible-party-service.test.ts`
Expected: FAIL (`createResponsibleParty is not a function`).

- [ ] **Step 4: Implementar o service**

Create `src/server/services/responsible-party-service.ts`:

```ts
import type { ActionContext } from "@/server/api/define-action";
import { AppError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  CreateResponsiblePartyInput,
  UpdateResponsiblePartyInput,
  ArchiveResponsiblePartyInput,
  DeleteResponsiblePartyInput,
} from "@/lib/schemas/responsible-party";

const log = logger.child({ module: "responsible-party-service" });

// Garante que todos os userIds são membros atuais da Account (tenant + integridade)
async function assertMembers(accountId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const count = await prisma.accountMember.count({
    where: { accountId, userId: { in: userIds } },
  });
  if (count !== new Set(userIds).size) {
    throw new AppError("VALIDATION", "Todos os membros do grupo devem pertencer à Account");
  }
}

export async function listResponsibleParties(accountId: string) {
  return prisma.responsibleParty.findMany({
    where: { accountId },
    include: { members: { select: { userId: true } } },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
}

export async function createResponsibleParty(
  input: CreateResponsiblePartyInput,
  ctx: ActionContext,
) {
  if (input.kind === "group") {
    await assertMembers(ctx.accountId, input.memberUserIds);
  }
  const party = await prisma.responsibleParty.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      kind: input.kind,
      icon: input.icon ?? null,
      ...(input.kind === "group"
        ? { members: { create: input.memberUserIds.map((userId) => ({ userId })) } }
        : {}),
    },
    select: { id: true },
  });
  log.info({ accountId: ctx.accountId, partyId: party.id, kind: input.kind }, "Party created");
  return party;
}

export async function updateResponsibleParty(
  input: UpdateResponsiblePartyInput,
  ctx: ActionContext,
) {
  const existing = await prisma.responsibleParty.findFirst({
    where: { id: input.partyId, accountId: ctx.accountId },
    select: { id: true, kind: true },
  });
  if (!existing) throw new AppError("NOT_FOUND", "Responsável não encontrado");

  if (input.memberUserIds) {
    if (existing.kind !== "group") {
      throw new AppError("VALIDATION", "Só grupos têm membros");
    }
    await assertMembers(ctx.accountId, input.memberUserIds);
  }

  await prisma.$transaction(async (tx) => {
    await tx.responsibleParty.update({
      where: { id: input.partyId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
      },
    });
    if (input.memberUserIds) {
      await tx.responsiblePartyMember.deleteMany({ where: { partyId: input.partyId } });
      await tx.responsiblePartyMember.createMany({
        data: input.memberUserIds.map((userId) => ({ partyId: input.partyId, userId })),
      });
    }
  });
  log.info({ accountId: ctx.accountId, partyId: input.partyId }, "Party updated");
}

export async function archiveResponsibleParty(
  input: ArchiveResponsiblePartyInput,
  ctx: ActionContext,
) {
  const { count } = await prisma.responsibleParty.updateMany({
    where: { id: input.partyId, accountId: ctx.accountId },
    data: { archivedAt: input.archived ? new Date() : null },
  });
  if (count === 0) throw new AppError("NOT_FOUND", "Responsável não encontrado");
}

export async function deleteResponsibleParty(
  input: DeleteResponsiblePartyInput,
  ctx: ActionContext,
) {
  const party = await prisma.responsibleParty.findFirst({
    where: { id: input.partyId, accountId: ctx.accountId },
    select: { kind: true },
  });
  if (!party) throw new AppError("NOT_FOUND", "Responsável não encontrado");
  if (party.kind === "personal") {
    throw new AppError("VALIDATION", "Responsáveis pessoais não podem ser excluídos");
  }
  // onDelete: SetNull nas transações preserva histórico
  await prisma.responsibleParty.delete({ where: { id: input.partyId } });
  log.info({ accountId: ctx.accountId, partyId: input.partyId }, "Party deleted");
}
```

- [ ] **Step 5: Rodar o teste — deve PASSAR**

Run: `docker compose exec app pnpm test src/server/services/responsible-party-service.test.ts`
Expected: PASS (todos os testes verdes).

- [ ] **Step 6: Adicionar revalidate helper**

Em `src/server/api/revalidate.ts`, adicionar (seguindo o padrão dos outros `revalidate*`):

```ts
export function revalidateResponsibleParties(accountId: string) {
  revalidatePath(`/${accountId}/settings/responsibles`);
  revalidatePath(`/${accountId}`, "layout");
}
```

- [ ] **Step 7: Escrever as actions**

Create `src/actions/responsible-parties.ts`:

```ts
"use server";

import { defineAction } from "@/server/api/define-action";
import {
  createResponsiblePartySchema,
  updateResponsiblePartySchema,
  archiveResponsiblePartySchema,
  deleteResponsiblePartySchema,
} from "@/lib/schemas/responsible-party";
import * as svc from "@/server/services/responsible-party-service";
import { revalidateResponsibleParties } from "@/server/api/revalidate";

const EDITOR_ROLES = ["owner", "editor"] as const;

export const createResponsiblePartyAction = defineAction({
  schema: createResponsiblePartySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    const r = await svc.createResponsibleParty(input, ctx);
    revalidateResponsibleParties(ctx.accountId);
    return r;
  },
});

export const updateResponsiblePartyAction = defineAction({
  schema: updateResponsiblePartySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.updateResponsibleParty(input, ctx);
    revalidateResponsibleParties(ctx.accountId);
  },
});

export const archiveResponsiblePartyAction = defineAction({
  schema: archiveResponsiblePartySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.archiveResponsibleParty(input, ctx);
    revalidateResponsibleParties(ctx.accountId);
  },
});

export const deleteResponsiblePartyAction = defineAction({
  schema: deleteResponsiblePartySchema,
  requireRoles: [...EDITOR_ROLES],
  handler: async (input, ctx) => {
    await svc.deleteResponsibleParty(input, ctx);
    revalidateResponsibleParties(ctx.accountId);
  },
});
```

- [ ] **Step 8 (TESTE DE FASE): rodar suite do service + typecheck**

Run: `docker compose exec app pnpm test src/server/services/responsible-party-service.test.ts && docker compose exec app pnpm typecheck`
Expected: testes PASS, typecheck sem erros.

- [ ] **Step 9: Commit**

```bash
git add src/lib/schemas/responsible-party.ts src/server/services/responsible-party-service.ts src/server/services/responsible-party-service.test.ts src/actions/responsible-parties.ts src/server/api/revalidate.ts
git commit -m "feat(responsible-party): zod schema, service (kind invariants + tenant), actions"
```

---

## Phase 3 — Ligar leituras/escritas ao `responsiblePartyId`

**Deliverable:** todo o backend passa a ler/gravar `responsiblePartyId`; analytics agrupa por party com resolução de nome (2.4). `responsibleUserId` continua sendo gravado em paralelo (dual-write) até a Fase 5. Teste de fase = `member-analytics.test.ts` atualizado + typecheck.

**Interface consumida:** models da Fase 1. **Produz:** helper `resolvePartyIdentities(accountId, partyIds)` em `member-analytics.ts`.

- [ ] **Step 1: Atualizar Zod da transação, settings, template, csv**

`src/lib/schemas/transaction.ts:34` — adicionar (mantendo o antigo por compat de API até Fase 5):
```ts
  responsiblePartyId: z.string().cuid("ID inválido").nullable().optional(),
```
`src/lib/schemas/settings.ts:9` — adicionar `defaultResponsiblePartyId: z.string().cuid("ID inválido").nullable().optional(),`
`src/lib/schemas/table-template.ts:15` — adicionar `responsiblePartyId: z.string().cuid("ID inválido").nullable().optional(),`
`src/lib/schemas/csv-import.ts:25,31` — adicionar `responsibleParty: z.string().optional()` em `columns` e `responsiblePartyMappings` análogo a `responsibleUserMappings`.

- [ ] **Step 2: Dual-write nos services de escrita**

`transaction-service.ts:60,101-102,189` — onde grava `responsibleUserId: input... ?? null`, adicionar `responsiblePartyId: input.responsiblePartyId ?? null`.
`month-service.ts:127` — na cópia template→tx, passar `responsiblePartyId: item.responsiblePartyId`.
`account-settings-service.ts:27` — adicionar `defaultResponsiblePartyId: input.defaultResponsiblePartyId ?? null`.
`table-template-service.ts:46,76,104,217,297` — incluir `responsiblePartyId` no select/create.
`csv-import-service.ts:148,262,374` — inserir `responsiblePartyId: row.parsed.responsiblePartyId`.

- [ ] **Step 3: Atualizar `member-analytics.ts` (groupBy por party + nome)**

Trocar as 5 `groupBy(["responsibleUserId", ...])` (`:115,120,271,373,378`) por `["responsiblePartyId", ...]`. Substituir a resolução de identidade (`resolveResponsibleIdentities`, `identityFor`, queries em `account_members`/`users`) por um novo helper que:
1. Carrega as parties (`prisma.responsibleParty.findMany({ where: { accountId, id: { in: partyIds } }, include: { members: { select: { userId: true, user: { select: { name, email } } } } } })`).
2. Para `personal` com 1 membro que **é** `AccountMember` atual → nome ao vivo (`user.name ?? user.email`), `isFormerMember=false`.
3. Para `personal` cujo membro saiu → `party.name` + `isFormerMember=true`.
4. Para `group`/`external` → `party.name`, `isFormerMember=false`, `icon` incluído.
5. `null` → bucket "Sem responsável".

Renomear chaves internas de `responsibleUserId`→`responsiblePartyId` e `UNASSIGNED_KEY` permanece. `sharePercent`/`grandTotal` inalterados. Expor `icon` em `MemberBreakdownRow`.

- [ ] **Step 4: Atualizar filtros/queries**

`kpi-custom.ts:38`, `filtered-transactions.ts:26`, `sandbox.ts:201,257`, `budgets.ts:218`, `budget-service.ts:132`, `month-page.ts:57,368` — trocar `responsibleUserId`→`responsiblePartyId` no filtro/dimensão/select. `widget-config.ts:57` filtro `responsible` passa a conter partyIds.

- [ ] **Step 5: Atualizar export, csv-parser, serializer**

`export-service.ts:56,101` select `responsibleParty: { select: { name, kind, members: { include: { user } } } }`; `:70,116,151` resolver nome via precedência 2.4.
`csv-parser.ts:317-321` — `responsiblePartyMappings` texto→partyId (permite mapear p/ party externa).
`serializers/transaction.ts:24,61` — expor `responsibleParty` novo (manter `responsibleUserId` até Fase 5, DD-08).

- [ ] **Step 6: Atualizar o teste `member-analytics.test.ts` (FALHA→PASS)**

Em `src/server/queries/member-analytics.test.ts:28-236`, trocar os mocks de `groupBy` para chavear por `responsiblePartyId`, mockar `prisma.responsibleParty.findMany` com parties personal/group/external, e manter as asserções de `sharePercent` (66.7/22.2/11.1 somando 100). Adicionar um caso: party `group` "Casal" aparece como **uma linha** com total integral (não distribuído).

- [ ] **Step 7 (TESTE DE FASE): rodar analytics + services + typecheck**

Run: `docker compose exec app pnpm test src/server/queries/member-analytics.test.ts src/server/services && docker compose exec app pnpm typecheck`
Expected: PASS; typecheck limpo.

- [ ] **Step 8: Commit**

```bash
git add src/lib/schemas src/server/queries src/server/services src/lib/csv-parser.ts src/lib/serializers
git commit -m "feat(responsible-party): wire reads/writes to responsiblePartyId (dual-write), analytics by party"
```

---

## Phase 4 — UI (seletor de party, settings, emoji, display)

**Deliverable:** usuário cria/edita parties com emoji, seleciona party na transação, vê emoji/avatar em listas/chips. Teste de fase = typecheck + lint (+ interação onde houver harness).

- [ ] **Step 1: Mensagens pt-BR**

Em `src/lib/messages/pt-BR.ts`, adicionar bloco `responsibleParties` com: `title:"Responsáveis"`, `kindPersonal/Group/External`, `createGroup:"Criar grupo"`, `createExternal:"Criar pessoa externa"`, `addResponsible:"+ Criar responsável"`, `emojiLabel:"Ícone"`, `membersLabel:"Membros do grupo"`, `archived:"Arquivado"`, `deleteConfirm`, `emptyState`. Ajustar `:651,741` se necessário.

- [ ] **Step 2: Componente `ResponsiblePartySelect`**

Create `src/components/transactions/ResponsiblePartySelect.tsx` — MUI `Select`/`Autocomplete` agrupado (pessoais → grupos → externas), item = emoji/avatar + nome, com rodapé "+ Criar responsável" abrindo `DialogShell` (form de group/external via RHF + `createResponsiblePartySchema`). Props: `value: string|null`, `onChange`, `parties` (do RSC), `accountId`.

- [ ] **Step 3: Trocar o seletor nas transações**

`NewTransactionRow.tsx:289`, `TransactionRowEditor.tsx:279`, `TransactionDetailDialog.tsx:296-298` — usar `<ResponsiblePartySelect>` com `responsiblePartyId`. Threading do `defaultResponsiblePartyId` (substitui `defaultResponsibleUserId` em `SectionView`/`SectionTab`/`FinanceTableCard`/`TransactionTable`).

- [ ] **Step 4: Display + chips**

`TransactionRow.tsx:391-402` — render emoji da party (fallback avatar/inicial). `ActiveFilterChips.tsx` + `TransactionFilterDrawer.tsx:408-435` — chips/filtro por party com emoji. `MonthFilterContext.tsx:72-73` — predicado `row.responsiblePartyId`.

- [ ] **Step 5: Página de settings "Responsáveis"**

Create `src/app/(app)/[accountId]/settings/responsibles/page.tsx` (RSC: `listResponsibleParties`) + `src/components/settings/ResponsiblePartiesManager.tsx` (client): `<PageHeader>`, lista com `<EmptyState>`, criar/editar/arquivar/excluir via actions, emoji picker (`<DialogShell>`). Adicionar link no nav de settings.

- [ ] **Step 6: Default em GeneralSettingsForm**

`GeneralSettingsForm.tsx:107` — Select de party (usa `defaultResponsiblePartyId`).

- [ ] **Step 7 (TESTE DE FASE): typecheck + lint + build de tipos**

Run: `docker compose exec app pnpm typecheck && docker compose exec app pnpm lint`
Expected: sem erros. (Verificar manualmente em light E dark mode conforme CLAUDE.md §7.)

- [ ] **Step 8: Commit**

```bash
git add src/components src/app src/lib/messages/pt-BR.ts
git commit -m "feat(responsible-party): UI selector, settings manager, emoji, display + filters"
```

---

## Phase 5 — Cleanup: drop coluna legada + deprecação de API

**Deliverable:** `responsibleUserId` removido do domínio; API `/api/v1` com campo depreciado documentado. Teste de fase = suite completa.

- [ ] **Step 1: Remover dual-write** — tirar `responsibleUserId` dos writes em `transaction-service`, `csv-import-service`, `table-template-service`, `account-settings-service`, `month-service`.

- [ ] **Step 2: Remover campos do schema** — remover `responsibleUserId`/`responsibleUser` de `Transaction`, `TableTemplateItem`, `AccountSettings.defaultResponsibleUserId`, e a relação `User.transResponsible`. Rodar `pnpm prisma validate && pnpm prisma format`.

- [ ] **Step 3: Migração de drop** — `docker compose exec app pnpm prisma migrate dev --name drop_responsible_user_id`. Expected: colunas removidas.

- [ ] **Step 4: API deprecation** — em `serializers/transaction.ts` e rotas `/api/v1` (Spec 14), remover `responsibleUserId` do output e documentar `responsibleParty` como substituto no OpenAPI registry (nota de breaking change/versão).

- [ ] **Step 5: Atualizar specs** — mudar `specs/60-...md` status para `approved`; remover os blocos "Delta pendente" das specs 01/05/09/35 (agora implementado) ou marcá-los como aplicados.

- [ ] **Step 6 (TESTE DE FASE): suite completa + typecheck + lint**

Run: `docker compose exec app pnpm test && docker compose exec app pnpm typecheck && docker compose exec app pnpm lint`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(responsible-party): drop legacy responsibleUserId, deprecate API field"
```

---

## Self-Review (cobertura da spec)

- RESP-01 (conjunta) → Fase 1 (schema group), Fase 2 (invariante N≥2), Fase 3 (analytics 1 linha), Fase 4 (criar grupo). ✅
- RESP-02 (não-membros) → Fase 2 (external, 0 links), Fase 3/4 (exibe/analisa). ✅
- RESP-03 (identidade) → Fase 3 Step 3 (precedência 2.4). ✅
- RESP-04 (rename + invariantes) → Fase 1 (colunas), Fase 2 (invariantes), Fase 3 (rename sweep). ✅
- RESP-05 (emoji) → Fase 1 (`icon`), Fase 2 (`emojiSchema`), Fase 4 (picker/render). ✅
- Multi-tenancy → Fase 2 (`assertMembers`, `findFirst`/`updateMany` por accountId). ✅
- Migração idempotente → Fase 1 Step 7-9. ✅
- Fronteira Spec 42 → Global Constraints + non-goal na Fase 3. ✅
