import { z } from "zod";

import { m } from "@/lib/messages";

import { partyIdSchema } from "./responsible-party";
import { accentColorKeySchema, cuidSchema } from "./shared";

// ─── Account General ──────────────────────────────────────────────

export const updateAccountSettingsSchema = z.object({
  accountName: z.string().min(1, "Nome obrigatório").max(80).trim(),
  currency: z.enum(["BRL"]),
  monthStartDay: z.number().int().min(1).max(28),
  defaultResponsiblePartyId: partyIdSchema.nullable().optional(),
  // Default de inversão de sinal ao mover transações entre seções (spec 59)
  invertSignOnMoveByDefault: z.boolean(),
});

export type UpdateAccountSettingsInput = z.infer<typeof updateAccountSettingsSchema>;

// ─── Sections ─────────────────────────────────────────────────────

/**
 * Spec 68 D1 — os quatro tipos de seção da coluna "Tipo" SÃO os quatro valores de
 * `SectionCountType`. Nenhum enum paralelo: este campo já decide o sinal do valor no
 * total do mês e é lido por ~55 arquivos; um segundo enum criaria duas fontes de
 * verdade para a mesma pergunta.
 */
export const SECTION_COUNT_TYPES = ["add", "subtract", "ignore", "neutral"] as const;
export const sectionCountTypeSchema = z.enum(SECTION_COUNT_TYPES);
export type SectionCountTypeValue = (typeof SECTION_COUNT_TYPES)[number];

const sectionNameSchema = z.string().min(1, "Nome obrigatório").max(40).trim();

export const createSectionSchema = z.object({
  name: sectionNameSchema,
  countType: sectionCountTypeSchema,
  isActive: z.boolean(),
  // Spec 68 §2.1 (D2) — chave de accent-colors, nunca hex. `null` = usa o fallback
  // da paleta por índice na apresentação.
  color: accentColorKeySchema.nullable().optional(),
});

export const updateSectionSchema = z.object({
  sectionId: cuidSchema,
  name: sectionNameSchema,
  countType: sectionCountTypeSchema,
  isActive: z.boolean(),
  color: accentColorKeySchema.nullable().optional(),
});

export const reorderSectionsSchema = z.object({
  orderedIds: z.array(cuidSchema).min(1),
});

export const deleteSectionSchema = z.object({
  sectionId: cuidSchema,
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>;
export type DeleteSectionInput = z.infer<typeof deleteSectionSchema>;

// ─── Categories ───────────────────────────────────────────────────

const categoryNameSchema = z.string().min(1, "Nome obrigatório").max(50).trim();

/** Spec 67 §7.4 (D2) — estado ativo/inativo. Alimenta o `Switch` do `StatusCell`. */
export const settingsStatusSchema = z.enum(["active", "inactive"]);

export const createCategorySchema = z.object({
  name: categoryNameSchema,
});

// `defaultSectionId` saiu (revisão de estilo — "essa coluna Seção Padrão não faz
// sentido nenhum", decisão do desenvolvedor): a UI abandonou "Seção padrão" nesta
// revisão. `Category.defaultSectionId` continua no schema do banco (deprecado, sem
// migração destrutiva — ver `prisma/schema.prisma`), mas o formulário e o service
// pararam de lê-lo/gravá-lo.
export const updateCategorySchema = z.object({
  categoryId: cuidSchema,
  name: categoryNameSchema,
  status: settingsStatusSchema.optional(),
});

export const deleteCategorySchema = z.object({
  categoryId: cuidSchema,
});

export const createSubcategorySchema = z.object({
  categoryId: cuidSchema,
  name: categoryNameSchema,
});

export const updateSubcategorySchema = z.object({
  subcategoryId: cuidSchema,
  name: categoryNameSchema,
  // Subcategoria NÃO tem seção própria — ela herda a do pai (§2.2). Por isso não há
  // `defaultSectionId` aqui: o campo simplesmente não existe nesse nível.
  status: settingsStatusSchema.optional(),
});

export const deleteSubcategorySchema = z.object({
  subcategoryId: cuidSchema,
});

/** Spec 68 §2.2 — arraste da árvore. Categorias de topo, na ordem final. */
export const reorderCategoriesSchema = z.object({
  orderedIds: z.array(cuidSchema).min(1),
});

/** Arraste dentro de um pai: as subcategorias de UMA categoria, na ordem final. */
export const reorderSubcategoriesSchema = z.object({
  categoryId: cuidSchema,
  orderedIds: z.array(cuidSchema).min(1),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;
export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;
export type UpdateSubcategoryInput = z.infer<typeof updateSubcategorySchema>;
export type DeleteSubcategoryInput = z.infer<typeof deleteSubcategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
export type ReorderSubcategoriesInput = z.infer<typeof reorderSubcategoriesSchema>;

// ─── Institutions ─────────────────────────────────────────────────

export const INSTITUTION_KINDS = ["bank", "card", "broker", "wallet", "company"] as const;
export const institutionKindSchema = z.enum(INSTITUTION_KINDS);
export type InstitutionKindValue = (typeof INSTITUTION_KINDS)[number];

const institutionNameSchema = z.string().min(1, "Nome obrigatório").max(80).trim();

/** Dia do mês. 28 é o teto (mesmo de `month_start_day`): 29–31 não existem em todo mês. */
const dayOfMonthSchema = z.coerce.number().int().min(1).max(28);

/**
 * Campos de detalhe (Spec 68 §2.3). Todos opcionais aqui: **quem decide quais valem é o
 * tipo**, e o descarte dos inaplicáveis acontece no service via `stripInapplicableDetails`
 * — em um lugar só, compartilhado por criação, edição inline e importação.
 *
 * `""` vira `null`: um <TextField> limpo entrega string vazia, e gravar `""` faria a
 * célula "Detalhes" renderizar um separador solto ("•••• · fecha").
 *
 * `undefined` NÃO vira `null` — os dois significam coisas diferentes na atualização:
 * `null` é "apagar este campo", `undefined` é "não mencionei" (o Prisma ignora e o
 * valor atual sobrevive). Um toggle de status que só manda `{ institutionId, name,
 * status }` não pode zerar o final do cartão de tabela.
 */
const emptyToNull = (v: unknown) => (v === "" ? null : v);

const institutionDetailFields = {
  // card
  last4: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}$/, "Informe os 4 últimos dígitos")
      .nullable()
      .optional(),
  ),
  closingDay: z.preprocess(emptyToNull, dayOfMonthSchema.nullable().optional()),
  dueDay: z.preprocess(emptyToNull, dayOfMonthSchema.nullable().optional()),
  // bank
  branch: z.preprocess(emptyToNull, z.string().max(20).trim().nullable().optional()),
  accountNo: z.preprocess(emptyToNull, z.string().max(30).trim().nullable().optional()),
  // company
  taxId: z.preprocess(emptyToNull, z.string().max(20).trim().nullable().optional()),
};

export const createInstitutionSchema = z.object({
  name: institutionNameSchema,
  // `null` = ainda não classificada. Nada é inferido do nome (§4).
  kind: institutionKindSchema.nullable().optional(),
  ...institutionDetailFields,
});

export const updateInstitutionSchema = z.object({
  institutionId: cuidSchema,
  name: institutionNameSchema,
  kind: institutionKindSchema.nullable().optional(),
  status: settingsStatusSchema.optional(),
  ...institutionDetailFields,
});

export const deleteInstitutionSchema = z.object({
  institutionId: cuidSchema,
});

export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;
export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>;
export type DeleteInstitutionInput = z.infer<typeof deleteInstitutionSchema>;

// ─── Importar categorias (Spec 68 §2.2 — modal M4) ────────────────

/**
 * Uma linha do arquivo, já com as colunas mapeadas.
 *
 * `color` é aceita para a planilha do desenho importar sem erro, mas **não tem
 * destino** (D2: categoria não tem cor própria) — a classificação a reporta como
 * ignorada, em vez de silenciar e deixar o usuário achar que foi aplicada. `section`
 * segue a MESMA regra desde a revisão de estilo que removeu "Seção padrão" da UI:
 * aceita para uma planilha antiga não quebrar, nunca validada, sempre ignorada.
 */
/**
 * Teto de SANIDADE do campo, não regra de produto.
 *
 * O bound apertado (50) que existia aqui rejeitava o arquivo INTEIRO quando uma única
 * linha passava do limite — e passava de verdade: o import de transações cria
 * categorias sem passar por `createCategorySchema`, então o banco tem nomes de 60
 * caracteres que o próprio app exporta. Reimportar o export do app dava "Dados
 * inválidos", sem dizer qual linha.
 *
 * Quem julga o conteúdo linha a linha é `classifyCategoryImport`, que marca a linha
 * como erro e deixa as outras passarem (§4). Este schema só barra payload absurdo.
 */
const IMPORT_FIELD_MAX = 500;

export const categoryImportRowSchema = z.object({
  name: z.string().max(IMPORT_FIELD_MAX),
  parent: z.string().max(IMPORT_FIELD_MAX).optional(),
  section: z.string().max(IMPORT_FIELD_MAX).optional(),
  color: z.string().max(IMPORT_FIELD_MAX).optional(),
});

/** Teto de linhas: o preview é lido na tela e a gravação cabe numa transação. */
const MAX_IMPORT_ROWS = 500;

export const categoryImportSchema = z.object({
  rows: z.array(categoryImportRowSchema).min(1, "Arquivo sem linhas").max(MAX_IMPORT_ROWS),
  deactivateMissing: z.boolean().optional(),
});

export type CategoryImportRowInput = z.infer<typeof categoryImportRowSchema>;
export type CategoryImportInput = z.infer<typeof categoryImportSchema>;

// ─── Mesclar / referências (Spec 68 §2.5 e §2.6) ──────────────────

/** Objetos que podem ser mesclados ou excluídos com realocação. Seção fica de fora. */
export const REFERENCED_ENTITIES = [
  "category",
  "subcategory",
  "institution",
  "responsibleParty",
] as const;
export const referencedEntitySchema = z.enum(REFERENCED_ENTITIES);

export const configReferencesSchema = z.object({
  entity: referencedEntitySchema,
  entityId: cuidSchema,
});

export const mergeEntitySchema = z
  .object({
    entity: referencedEntitySchema,
    /** Será excluída. */
    absorbedId: cuidSchema,
    /** Recebe tudo. */
    keptId: cuidSchema,
  })
  // Mesclar um objeto nele mesmo excluiria o objeto depois de mover tudo para ele —
  // ou seja, apagaria os dados. Barrado no schema, antes de chegar ao service.
  .refine((v) => v.absorbedId !== v.keptId, {
    message: "Escolha dois objetos diferentes para mesclar.",
    path: ["absorbedId"],
  });

export type ConfigReferencesInput = z.infer<typeof configReferencesSchema>;
export type MergeEntityInput = z.infer<typeof mergeEntitySchema>;

// ─── Table Types ──────────────────────────────────────────────────

export const TOGGLEABLE_COLUMNS = [
  { key: "category", label: m.transactions.fields.category },
  { key: "subcategory", label: m.transactions.fields.subcategory },
  { key: "institution", label: m.transactions.fields.institution },
  { key: "paymentMethod", label: m.transactions.fields.paymentMethod },
  { key: "responsibleUser", label: m.transactions.fields.responsibleUser },
  { key: "isPending", label: m.transactions.fields.isPending },
  { key: "notes", label: m.transactions.fields.notes },
  { key: "cardInstallment", label: m.transactions.fields.cardInstallment },
  { key: "investmentType", label: m.transactions.fields.investmentType },
  { key: "expenseType", label: m.transactions.fields.expenseType },
  { key: "tags", label: m.transactions.fields.tags },
] as const;

// Schema derivado das colunas configuráveis — strips chaves desconhecidas em inputs
const hiddenColumnsBaseSchema = z.object({
  category: z.boolean().optional(),
  subcategory: z.boolean().optional(),
  institution: z.boolean().optional(),
  paymentMethod: z.boolean().optional(),
  responsibleUser: z.boolean().optional(),
  isPending: z.boolean().optional(),
  notes: z.boolean().optional(),
  cardInstallment: z.boolean().optional(),
  investmentType: z.boolean().optional(),
  expenseType: z.boolean().optional(),
  tags: z.boolean().optional(),
});

// Para leituras do banco: fallback para {} se o JSON estiver corrompido ou com chaves desconhecidas
export const hiddenColumnsSchema = hiddenColumnsBaseSchema.catch({});
export type HiddenColumns = Record<string, boolean>;

export function parseHiddenColumns(raw: unknown): HiddenColumns {
  return hiddenColumnsSchema.parse(raw ?? {}) as HiddenColumns;
}

// Layout da linha por tipo de tabela (Spec 66 TX-04b): "columns" (A, default,
// colunas explícitas) × "rich" (B, descrição + pílulas). Default reproduz o
// comportamento atual.
export const ROW_LAYOUTS = ["columns", "rich"] as const;
export const rowLayoutSchema = z.enum(ROW_LAYOUTS);
export type RowLayout = z.infer<typeof rowLayoutSchema>;

export const createTableTypeSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(50).trim(),
  hiddenColumns: hiddenColumnsBaseSchema,
  rowLayout: rowLayoutSchema.optional(),
});

export const updateTableTypeSchema = z.object({
  tableTypeId: cuidSchema,
  name: z.string().min(1, "Nome obrigatório").max(50).trim().optional(),
  hiddenColumns: hiddenColumnsBaseSchema.optional(),
  rowLayout: rowLayoutSchema.optional(),
});

export const deleteTableTypeSchema = z.object({
  tableTypeId: cuidSchema,
});

export type CreateTableTypeInput = z.infer<typeof createTableTypeSchema>;
export type UpdateTableTypeInput = z.infer<typeof updateTableTypeSchema>;
export type DeleteTableTypeInput = z.infer<typeof deleteTableTypeSchema>;
