# Spec 54 — Relatório de Imposto de Renda

> Status: draft
> Insumo: levantamento estratégico e benchmark de mercado PFM (2026-06-29) — pilar Brasil & Agregação
> Skills: [`money-handling`](../skills/money-handling/SKILL.md) · [`date-timezone`](../skills/date-timezone/SKILL.md) · [`multitenancy`](../skills/multitenancy/SKILL.md)
> Relacionado: [`spec 22`](22-data-export.md) (export CSV/PDF genérico) · spec 44 (papel "contador" — futura) · spec 46 (patrimônio líquido / net worth — futura)

---

## 1. Problema

- **IR-01 — Export genérico não serve à declaração de IR**: existe export CSV/PDF (spec 22), mas é um dump genérico de transações, sem consolidação anual orientada à **declaração de Imposto de Renda brasileira** (rendimentos, despesas dedutíveis, evolução de bens). O usuário precisa montar tudo na mão na janela do IR (IR 2026: 16/mar a 29/mai).
- **IR-02 — Sem separação de despesas dedutíveis**: a declaração distingue despesas dedutíveis (saúde, educação) das demais. Hoje não há como marcar uma categoria/tag como dedutível nem agrupar gastos dedutíveis por categoria para o ano-base.
- **IR-03 — Sem consolidação de rendimentos**: não há visão anual das entradas (rendimentos) por Account agregadas para a declaração.
- **IR-04 — Sem evolução patrimonial e sem entrega ao contador**: a declaração pede evolução de bens; e é comum entregar tudo ao contador. Não há relatório que puxe patrimônio (quando a spec 46 existir) nem formato estruturado para o papel "contador" (spec 44).

---

## 2. Solução

> Relatório anual por Account, somente leitura, derivado dos dados existentes. Sem cálculo de imposto.

### 2.1 IR-01 / IR-03 — Relatório anual consolidado

- Novo relatório "Imposto de Renda" por Account e ano-base: agrupa **rendimentos** (transações de entrada, conforme `SectionCountType` que soma) e **despesas** do ano-base, em valores `BigInt` centavos, com totais por categoria.
- Período do ano-base respeita `date-timezone` e `account_settings` (mês civil de jan a dez do ano selecionado pela `occurredOn`).

### 2.2 IR-02 — Despesas dedutíveis marcáveis

- Categorias e/ou tags podem ser marcadas como **dedutíveis** (flag `isDeductible`), opcionalmente com um tipo de dedução (saúde, educação) para agrupamento. O relatório separa "despesas dedutíveis" das demais, agrupando por categoria/tipo.

```prisma
// Em Category (e análogo opcional em Tag):
isDeductible   Boolean         @default(false) @map("is_deductible")
deductionType  DeductionType?  @map("deduction_type")

enum DeductionType {
  health     // saúde
  education  // educação
  other

  @@map("deduction_type")
}
```

### 2.3 IR-04 — Evolução patrimonial e entrega ao contador

- Quando a spec 46 (net worth) existir, o relatório puxa a **evolução patrimonial** (saldo início vs fim do ano-base) dela; enquanto não existir, a seção é omitida graciosamente (sem quebrar o relatório).
- **Export estruturado PDF/CSV** voltado à declaração (rendimentos, dedutíveis por categoria/tipo, evolução de bens), reusando a infraestrutura de export da spec 22. O relatório se conecta ao papel "contador" (spec 44): quando esse papel existir, um contador com acesso à Account pode visualizar/exportar o relatório.

---

## 3. User Stories

- Como usuário brasileiro, quero um relatório anual de rendimentos e despesas dedutíveis, para preencher minha declaração de IR sem refazer as contas na mão.
- Como usuário, quero marcar categorias como dedutíveis (saúde, educação), para que o relatório separe automaticamente o que abate imposto.
- Como usuário, quero exportar o relatório em PDF/CSV estruturado, para entregar ao meu contador.

---

## 4. Critérios de Aceitação

**IR-01 / IR-03 (multi-tenancy):**
- QUANDO o relatório é gerado para um ano-base, ELE DEVE filtrar transações por `accountId` da Account ativa e pela `occurredOn` dentro do ano selecionado; NÃO DEVE incluir dados de outra Account.
- QUANDO há rendimentos no ano-base, O RELATÓRIO DEVE somá-los em `BigInt` centavos e exibi-los separados das despesas.

**IR-02:**
- QUANDO uma categoria tem `isDeductible = true`, SUAS despesas no ano-base DEVEM aparecer na seção "Despesas dedutíveis", agrupadas por `deductionType`.
- QUANDO uma categoria não é dedutível, SUAS despesas NÃO DEVEM aparecer na seção de dedutíveis.

**IR-04:**
- QUANDO a spec 46 (net worth) não estiver implementada, O RELATÓRIO DEVE omitir a seção de evolução patrimonial sem erro.
- QUANDO o usuário exporta, O SISTEMA DEVE gerar PDF e CSV estruturados reusando a infraestrutura da spec 22, em valores formatados na camada de apresentação (centavos → reais).

---

## 5. Fora de Escopo

- **Integração direta com o programa da Receita Federal / geração de arquivo `.DEC`** — fora do escopo.
- **Cálculo do imposto devido / simulação de restituição** — o relatório consolida dados, não calcula imposto.
- **Carnê-leão, malha fina, declaração pré-preenchida** — fora do escopo.
- **Classificação fiscal automática por ML** — marcação de dedutível é manual.
- **Implementar o papel "contador" (spec 44) ou o net worth (spec 46)** — esta spec apenas se conecta a eles quando existirem.

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Dedutibilidade | Flag `isDeductible` + `deductionType` em Category (e Tag) | Reaproveita categorização existente; manual e auditável |
| DD-02 | Evolução patrimonial | Puxar da spec 46 quando existir; omitir graciosamente senão | Não bloquear o relatório na dependência de outra spec |
| DD-03 | Export | Reusar infraestrutura da spec 22 (PDF/CSV) | Evita reimplementar geração de arquivo |
| DD-04 | Entrega ao contador | Conectar ao papel "contador" da spec 44 | Sem criar mecanismo de acesso próprio |
| DD-05 | Período | Ano civil (jan–dez) pela `occurredOn` | Alinha ao ano-base da declaração brasileira |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Flags `isDeductible`/`deductionType` em `Category` (e Tag), enum `DeductionType` | `prisma/schema.prisma` + nova migration |
| Serviço de relatório de IR (consolidação anual) | `src/server/services/tax-report-service.ts` (criar) |
| Export estruturado PDF/CSV | reusar `src/server/services/export-service.ts` (ver spec 22) |
| Agregação de rendimentos/despesas por `SectionCountType` | `prisma/schema.prisma` (`Section`, `Transaction`) · `skills/money-handling/SKILL.md` |
| Resolução de período por ano civil | `skills/date-timezone/SKILL.md` |
| Evolução patrimonial (quando existir) | spec 46 (net worth) |
| Acesso do contador (quando existir) | spec 44 (papel "contador") |
