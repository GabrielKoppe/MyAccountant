import { z } from "zod";

// Aceita cuid (dados novos — `@default(cuid())`) OU uuid (dados LEGADOS do MVP: muitas
// entidades do usuário — categorias, instituições, tipos de tabela, etc. criadas antes da
// migração para cuid — têm id no formato uuid). O `z.string().cuid()` estrito rejeitava os
// uuid com "ID inválido", quebrando SILENCIOSAMENTE qualquer form ao selecionar uma entidade
// legada (Meta/Orçamento não salvavam — o botão "morria" porque o zodResolver falhava e o
// campo de dimensão não tem slot de erro visível). A POSSE do id (multi-tenancy/IDOR) é
// garantida pelas checagens de ownership no service — aqui só validamos o FORMATO, e os dois
// formatos coexistem no banco. Mesma tolerância já adotada por `partyIdSchema`
// (responsible-party.ts). Continua rejeitando lixo (ex: "abc"), mantendo valor de validação.
const CUID_RE = /^c[^\s-]{8,}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const cuidSchema = z
  .string()
  .refine((v) => CUID_RE.test(v) || UUID_RE.test(v), { message: "ID inválido" });
export const emailSchema = z.string().email("Email inválido").toLowerCase().trim();
export const dateSchema = z.coerce.date({ message: "Data inválida" });
export const amountCentsSchema = z.coerce.bigint({ message: "Valor inválido" });

// ID de dimensão OPCIONAL vindo de um <Select>/Autocomplete de form. O MUI/RHF pode
// entregar "ausência de valor" de três formas: `undefined`, `null` OU `""` (string vazia —
// a opção "Nenhum"/"Nenhuma" de um <Select>, ou um Autocomplete limpo). O `.optional()` do
// Zod só ignora `undefined`; em `""` o `.cuid()` roda e falha com "ID inválido" (bug real
// nos forms de Meta/Orçamento). Estes helpers normalizam "vazio" para ausência ANTES do
// `.cuid()`, então só validamos o formato quando há de fato um id. Fonte única (CLAUDE.md
// §5.4): vale para o client (zodResolver) e para o server (defineAction).

/** `string | undefined` — para schemas que representam "sem dimensão" como `undefined` (ex: Budget). */
export const optionalDimensionId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  cuidSchema.optional(),
);

/** `string | null | undefined` — para schemas que representam "sem dimensão" como `null` (ex: Goal). */
export const optionalDimensionIdNullable = z.preprocess(
  (v) => (v === "" ? null : v),
  cuidSchema.optional().nullable(),
);
