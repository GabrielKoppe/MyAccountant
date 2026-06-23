import { ConflictError, NotFoundError } from "@/server/api/errors";
import type { ActionContext } from "@/server/api/define-action";
import { logger } from "@/server/logger";
import { prisma } from "@/server/prisma";
import type {
  CreateInstitutionInput,
  DeleteInstitutionInput,
  UpdateInstitutionInput,
} from "@/lib/schemas/settings";

const log = logger.child({ module: "institution-service" });

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
    data: { name: input.name },
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
