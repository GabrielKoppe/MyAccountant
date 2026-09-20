import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  TableTypesManager,
  type SettingsTableType,
} from "@/app/(app)/[accountId]/settings/table-types/TableTypesManager";
import type { TableTypeModelUsage } from "@/components/settings/table-types/TableTypeUsedByTab";
import { generateSettingsMetadata } from "@/lib/generate-settings-metadata";
import {
  defaultSortSchema,
  groupBySchema,
  inheritOnNewRowSchema,
  parseHiddenColumns,
  pinnedColumnsSchema,
  type RowLayout,
} from "@/lib/schemas/settings";
import { parseVisibleColumns } from "@/lib/table-columns";
import { parseDensity } from "@/lib/table-density";
import { requireAccountAccess } from "@/server/auth/session";
import { prisma } from "@/server/prisma";

type Props = { params: Promise<{ accountId: string }> };

type MetaProps = { params: Promise<{ accountId: string }> };
export async function generateMetadata({ params }: MetaProps): Promise<Metadata> {
  const { accountId } = await params;
  return generateSettingsMetadata(accountId, "Tipos de tabela");
}

export default async function TableTypesPage({ params }: Props) {
  const { accountId } = await params;
  const { member } = await requireAccountAccess(accountId).catch(() => redirect("/home"));
  if (member.role === "viewer") redirect(`/${accountId}`);

  const [tableTypes, templates, sections] = await Promise.all([
    prisma.tableType.findMany({
      where: { accountId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        isDefault: true,
        hiddenColumns: true,
        visibleColumns: true,
        pinnedColumns: true,
        inheritOnNewRow: true,
        defaultSort: true,
        rowLayout: true,
        density: true,
        groupBy: true,
        showFooterTotal: true,
        showGroupSubtotal: true,
        allowBulkEdit: true,
        keepGhostRow: true,
        _count: { select: { financeTables: true } },
      },
    }),
    // Aba 3 · "contagem barata" (Spec 69 §2.1): quais modelos usam cada tipo. Não
    // toca `Transaction` — por isso vem pronta, sem o cartão "Contar".
    prisma.tableTemplate.findMany({
      where: { accountId, tableTypeId: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, tableTypeId: true, autoSectionId: true },
    }),
    // `TableTemplate.autoSectionId` não tem relação Prisma com `Section` (mesma
    // constatação do pacote P8), então o nome da seção é resolvido em memória.
    prisma.section.findMany({ where: { accountId }, select: { id: true, name: true } }),
  ]);

  const sectionNameById = new Map(sections.map((section) => [section.id, section.name]));

  const modelsByType = new Map<string, TableTypeModelUsage[]>();
  for (const template of templates) {
    if (!template.tableTypeId) continue;
    const list = modelsByType.get(template.tableTypeId) ?? [];
    list.push({
      id: template.id,
      name: template.name,
      sectionName: template.autoSectionId
        ? (sectionNameById.get(template.autoSectionId) ?? null)
        : null,
    });
    modelsByType.set(template.tableTypeId, list);
  }

  // Toda leitura de campo `Json` é tolerante (o banco pode ter linha anterior ao
  // backfill da Spec 69 P0): `visibleColumns` vazio cai no derivado de
  // `hiddenColumns`, e os demais têm `.catch(...)` no próprio schema.
  const initialTypes: SettingsTableType[] = tableTypes.map((type) => ({
    id: type.id,
    name: type.name,
    isDefault: type.isDefault,
    rowLayout: (type.rowLayout as RowLayout) ?? "columns",
    density: parseDensity(type.density),
    visibleColumns: parseVisibleColumns(
      type.visibleColumns,
      parseHiddenColumns(type.hiddenColumns),
    ),
    pinnedColumns: pinnedColumnsSchema.parse(type.pinnedColumns),
    inheritOnNewRow: inheritOnNewRowSchema.parse(type.inheritOnNewRow),
    defaultSort: defaultSortSchema.parse(type.defaultSort),
    groupBy: groupBySchema.catch(null).parse(type.groupBy),
    showFooterTotal: type.showFooterTotal,
    showGroupSubtotal: type.showGroupSubtotal,
    allowBulkEdit: type.allowBulkEdit,
    keepGhostRow: type.keepGhostRow,
    tableCount: type._count.financeTables,
    models: modelsByType.get(type.id) ?? [],
  }));

  // O título deixou de ser prop: quem o renderiza é o SettingsPageShell (Spec 67 §2.2).
  return <TableTypesManager accountId={accountId} initialTypes={initialTypes} />;
}
