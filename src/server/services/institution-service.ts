import { ConflictError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import { stripInapplicableDetails } from "@/lib/institution-details";
import type {
  CreateInstitutionInput,
  DeleteInstitutionInput,
  UpdateInstitutionInput,
} from "@/lib/schemas/settings";

const log = logger.child({ module: "institution-service" });

/**
 * Spec 68 §2.3 — os campos de detalhe que o tipo aceita, com os demais zerados.
 *
 * O descarte é feito AQUI, e não só na UI: trocar Cartão → Corretora precisa apagar
 * fechamento/vencimento de verdade (critério da §4). Se ficasse só no componente, um
 * valor órfão sobreviveria na linha e reapareceria ao voltar o tipo para Cartão —
 * contradizendo o que a tela mostrou no momento da troca.
 *
 * ⚠️ `kind === undefined` significa "o chamador não mencionou o tipo", e é DIFERENTE
 * de `kind: null` ("esta instituição não tem tipo"). Sem essa distinção, um update
 * parcial — o toggle de status manda `{ institutionId, name, status }` — cairia no
 * ramo "nenhum campo se aplica" e apagaria em silêncio o final do cartão, a agência e
 * o CNPJ de qualquer instituição já classificada. Quando o tipo não vem, os campos de
 * detalhe passam intactos (os ausentes chegam `undefined` e o Prisma os ignora).
 */
function detailsFor(
  kind: CreateInstitutionInput["kind"] | undefined,
  input: CreateInstitutionInput | UpdateInstitutionInput,
) {
  const given = {
    last4: input.last4,
    closingDay: input.closingDay,
    dueDay: input.dueDay,
    branch: input.branch,
    accountNo: input.accountNo,
    taxId: input.taxId,
  };

  if (kind === undefined) return given;

  return stripInapplicableDetails(kind, given);
}

export async function createInstitution(input: CreateInstitutionInput, ctx: ActionContext) {
  const existing = await prisma.institution.findUnique({
    where: { accountId_name: { accountId: ctx.accountId, name: input.name } },
  });
  if (existing) throw new ConflictError("Já existe uma instituição com este nome.");

  const institution = await prisma.institution.create({
    data: {
      accountId: ctx.accountId,
      name: input.name,
      createdById: ctx.userId,
      // `null` = ainda não classificada; a lista mostra "—" e a célula Detalhes fica
      // vazia. Nada é inferido do nome (§4).
      kind: input.kind ?? null,
      // Na CRIAÇÃO, tipo ausente é o mesmo que "sem tipo": `null` explícito, para o
      // strip apagar detalhe que não se aplica a instituição nenhuma.
      ...detailsFor(input.kind ?? null, input),
    },
    select: { id: true },
  });

  log.info({ institutionId: institution.id, accountId: ctx.accountId }, "Institution created");
  return { institutionId: institution.id };
}

export async function updateInstitution(input: UpdateInstitutionInput, ctx: ActionContext) {
  const institution = await prisma.institution.findUnique({
    where: { id: input.institutionId },
    select: { accountId: true },
  });
  if (!institution || institution.accountId !== ctx.accountId)
    throw new NotFoundError("Instituição");

  const nameConflict = await prisma.institution.findFirst({
    where: {
      accountId: ctx.accountId,
      name: input.name,
      id: { not: input.institutionId },
    },
  });
  if (nameConflict) throw new ConflictError("Já existe uma instituição com este nome.");

  await prisma.institution.update({
    where: { id: input.institutionId },
    data: {
      name: input.name,
      kind: input.kind,
      status: input.status,
      // Na EDIÇÃO, tipo ausente é "não mencionei" — os detalhes atuais sobrevivem.
      ...detailsFor(input.kind, input),
    },
  });

  log.info({ institutionId: input.institutionId, accountId: ctx.accountId }, "Institution updated");
}

export async function deleteInstitution(input: DeleteInstitutionInput, ctx: ActionContext) {
  const institution = await prisma.institution.findUnique({
    where: { id: input.institutionId },
    select: { accountId: true },
  });
  if (!institution || institution.accountId !== ctx.accountId)
    throw new NotFoundError("Instituição");

  await prisma.institution.delete({ where: { id: input.institutionId } });

  log.info({ institutionId: input.institutionId, accountId: ctx.accountId }, "Institution deleted");
}
