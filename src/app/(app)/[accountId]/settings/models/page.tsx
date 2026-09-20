import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  TableModelsManager,
  type ModelTableTypeOption,
  type SettingsModel,
} from "@/app/(app)/[accountId]/settings/models/TableModelsManager";
import {
  normalizeDensity,
  normalizeRowLayout,
} from "@/components/settings/models/model-item-draft";
import type { ModelUsage } from "@/components/settings/models/ModelUsedByTab";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import { m } from "@/lib/messages";
import { toResponsiblePartyOption } from "@/lib/party-display";
import { parseVisibleColumns } from "@/lib/table-columns";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";
import * as svc from "@/server/services/table-template-service";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Modelos de tabela");
}

export default async function TableModelsPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));

  // Carve-out do viewer (Spec 65 §10.5): esta página não tem guard próprio no
  // layout — só "Membros" fica aberto a todos os papéis.
  if (member.role === "viewer") redirect(`/${accountId}`);

  const [
    templates,
    categories,
    institutions,
    members,
    partiesRaw,
    tableTypes,
    sections,
    createdTables,
  ] = await Promise.all([
    svc.listTemplates(accountId),
    prisma.category.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, subcategories: { select: { id: true, name: true } } },
    }),
    prisma.institution.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.accountMember.findMany({
      where: { accountId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.responsibleParty.findMany({
      where: { accountId, archivedAt: null },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        icon: true,
        color: true,
        members: {
          select: { userId: true, user: { select: { name: true, email: true, image: true } } },
        },
      },
    }),
    prisma.tableType.findMany({
      where: { accountId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      // A apresentação inteira sobe junto: a aba "Transações do modelo" renderiza a
      // linha COM o tipo do modelo (layout, densidade e conjunto de colunas), não
      // com uma tabela genérica que só afirma ser a linha real.
      select: {
        id: true,
        name: true,
        isDefault: true,
        rowLayout: true,
        density: true,
        visibleColumns: true,
        hiddenColumns: true,
      },
    }),
    // TODAS as seções, inclusive as inativas (Spec 68 `isActive`). A aba Definição
    // precisa avisar que uma seção de destino inativa não criará tabela — filtrar
    // aqui esconderia justamente o caso que o aviso existe para mostrar.
    prisma.section.findMany({
      where: { accountId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, isActive: true },
    }),
    // Proveniência (Spec 69 D6): quais tabelas nasceram de qual modelo. Consulta
    // barata — o índice `[accountId, createdFromTemplateId]` cobre o filtro e nada
    // aqui toca `Transaction`, então não há custo a diferir para um botão "Contar".
    prisma.financeTable.findMany({
      where: { accountId, createdFromTemplateId: { not: null } },
      select: { createdFromTemplateId: true, monthId: true },
    }),
  ]);

  // `rowLayout`/`density` são `String` no banco (§14 P0 — a validação é do Zod, não
  // do Postgres) e `visibleColumns` é `Json`. A normalização acontece AQUI, na
  // fronteira: a UI nunca recebe um valor fora do domínio.
  const tableTypeOptions: ModelTableTypeOption[] = tableTypes.map((type) => ({
    id: type.id,
    name: type.name,
    isDefault: type.isDefault,
    rowLayout: normalizeRowLayout(type.rowLayout),
    density: normalizeDensity(type.density),
    visibleColumns: parseVisibleColumns(
      type.visibleColumns,
      type.hiddenColumns as Record<string, boolean> | null,
    ),
  }));

  // `amountCents` é BigInt e não atravessa a fronteira RSC → Client: vira string
  // aqui e volta a BigInt só na hora de somar/formatar.
  const models: SettingsModel[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    tableTypeId: template.tableTypeId,
    countInMonth: template.countInMonth,
    autoApply: template.autoApply,
    autoSectionId: template.autoSectionId,
    orderInSection: template.orderInSection,
    tableType: template.tableType,
    items: template.items.map((item) => ({
      ...item,
      amountCents: item.amountCents.toString(),
    })),
  }));

  // Tabelas por modelo + em quantos meses DISTINTOS — o `Set` é o que impede que
  // duas tabelas do mesmo mês contem como dois meses.
  const monthsByTemplate = new Map<string, Set<string>>();
  const tablesByTemplate = new Map<string, number>();
  for (const table of createdTables) {
    const templateId = table.createdFromTemplateId;
    if (!templateId) continue;
    tablesByTemplate.set(templateId, (tablesByTemplate.get(templateId) ?? 0) + 1);
    const months = monthsByTemplate.get(templateId) ?? new Set<string>();
    months.add(table.monthId);
    monthsByTemplate.set(templateId, months);
  }
  const usageByModel: Record<string, ModelUsage> = Object.fromEntries(
    [...tablesByTemplate].map(([templateId, tables]) => [
      templateId,
      { tables, months: monthsByTemplate.get(templateId)?.size ?? 0 },
    ]),
  );

  const currentMemberIds = new Set(members.map((mm) => mm.user.id));
  const parties = partiesRaw.map((p) => toResponsiblePartyOption(p, currentMemberIds));

  return (
    <TableModelsManager
      accountId={accountId}
      initialModels={models}
      categories={categories}
      institutions={institutions}
      parties={parties}
      tableTypes={tableTypeOptions}
      sections={sections}
      usageByModel={usageByModel}
      title={m.tableModels.title}
    />
  );
}
