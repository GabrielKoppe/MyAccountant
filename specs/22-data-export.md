# Spec 22 — Exportação de Dados

> Status: approved
> Insumo: docs/v2-analysis.md §6 F-01, §7 DT-01 (único item da lista "não entregue no V1" classificado como bloqueador de adoção)
> Skills: [`multitenancy`](../skills/multitenancy/SKILL.md) · [`money-handling`](../skills/money-handling/SKILL.md) · [`server-actions`](../skills/server-actions/SKILL.md) · [`prisma-conventions`](../skills/prisma-conventions/SKILL.md) · [`logging`](../skills/logging/SKILL.md)

---

## 1. Problema

O MyAccountant não possui nenhuma forma de exportar dados. Para um app de gestão financeira pessoal e colaborativa, isso representa um bloqueador de adoção:

- Usuários que querem compartilhar dados com contador ou planilha não conseguem sem copiar manualmente.
- Não há forma de fazer backup dos próprios dados fora do banco.
- Relatórios precisam ser visualizados dentro do app — não podem ser enviados por email ou impressos de forma legível.

---

## 2. Solução

Adicionar botões de exportação em três pontos da interface, todos usando `<ExpandableIconButton>` com `direction="left"` e um `<Menu>` do MUI ao clicar:

1. **Dashboard anual** — `ExpandableIconButton` no lado oposto ao seletor de ano. Ao clicar, abre menu com um item: **"CSV — Ano inteiro"**.

2. **Dashboard mensal** — `ExpandableIconButton` ao lado do botão "Ver Mês" (lado oposto ao seletor de mês). Ao clicar, abre menu com dois itens: **"CSV"** e **"PDF"**.

3. **Tela de resumo do mês (MonthHeader)** — `ExpandableIconButton` ao lado do botão "Ver Dashboard do Mês". Ao clicar, abre menu com dois itens: **"CSV"** e **"PDF"**.

### Formatos disponíveis

- **CSV de transações do mês**: todas as transações do mês, ordenadas por seção → tabela → data (ascendente).
- **PDF resumo mensal**: documento com total do mês, totais por seção, top 8 categorias e lista de transações agrupada por seção/tabela.
- **CSV anual**: todas as transações do ano, mesmo formato do CSV mensal com coluna "Mês" adicionada como primeira coluna.

---

## 3. User Stories

- Como usuário, quero exportar as transações do mês em CSV, para abrir no Excel ou enviar para meu contador.
- Como usuário, quero exportar um resumo mensal em PDF, para compartilhar ou arquivar.
- Como usuário, quero exportar todas as transações do ano em um único CSV, para análise histórica ou backup.

---

## 4. Critérios de Aceitação

**Acesso:**
- Qualquer membro da Account (`owner`, `editor` ou `viewer`) pode exportar dados.

**CSV de transações do mês:**
- QUANDO o usuário clica em "Exportar → CSV", O SISTEMA DEVE verificar se há transações no mês. SE não houver, DEVE exibir mensagem "Sem transações para exportar neste período" e não gerar arquivo.
- SE houver transações, O SISTEMA DEVE gerar e baixar um arquivo `.csv`.
- O arquivo DEVE incluir as colunas na seguinte ordem: Data, Descrição, Valor, Seção, Tabela, Categoria, Subcategoria, Instituição, Responsável, Pendente, Favorita, Notas.
- **Data**: formato `DD/MM/YYYY`.
- **Valor**: numérico com 2 casas decimais. Sinal financeiro: positivo para seções `add`, negativo para seções `subtract`, valor bruto (do banco) para seções `neutral` e `ignore`. Convertido de centavos para reais.
- **Seção / Tabela / Categoria / Subcategoria / Instituição**: nome textual (não ID). Campos sem valor ficam como célula vazia.
- **Responsável**: nome completo do usuário responsável. Célula vazia se não atribuído.
- **Pendente / Favorita**: `Sim` ou `Não`.
- As transações DEVEM ser ordenadas por: ordem de exibição da seção → ordem de exibição da tabela → data ascendente (mais antiga primeiro).
- O nome do arquivo DEVE ser: `[slug-da-account]_[ano]-[mes].csv` (ex: `familia-silva_2026-01.csv`), onde o slug é o nome da account em lowercase, sem acentos, espaços substituídos por hífens.
- A codificação DEVE ser UTF-8 com BOM para compatibilidade com Excel em Windows.

**PDF resumo mensal:**
- QUANDO o usuário clica em "Exportar → PDF", O SISTEMA DEVE verificar se há transações no mês. SE não houver, DEVE exibir mensagem "Sem transações para exportar neste período" e não gerar arquivo.
- SE houver transações, O SISTEMA DEVE gerar e baixar um arquivo `.pdf`.
- O PDF DEVE conter: nome da account, mês de referência, total do mês, totais por seção, top 8 categorias com valores (se houver menos de 8, exibe as que existem), lista completa de transações agrupada por seção/tabela.
- O campo "Responsável" no PDF usa o nome completo do usuário.
- O PDF DEVE ser gerado no servidor (route handler) usando `@react-pdf/renderer`.

**CSV anual:**
- QUANDO o usuário clica em "Exportar — Ano inteiro", O SISTEMA DEVE verificar se há transações no ano. SE não houver, DEVE exibir mensagem "Sem transações para exportar neste período".
- SE houver transações, O SISTEMA DEVE gerar um CSV com todas as transações do ano selecionado.
- A primeira coluna DEVE ser **Mês** (número inteiro: `1` a `12`), seguida das demais colunas idênticas ao CSV mensal.
- O nome do arquivo DEVE ser: `[slug-da-account]_[ano].csv` (ex: `familia-silva_2026.csv`).

**Interação e feedback:**
- ENQUANTO o arquivo está sendo gerado, O SISTEMA DEVE desabilitar o botão e exibir indicador de carregamento. Aplicável a CSV e PDF.
- SE a exportação falhar por erro de servidor, O SISTEMA DEVE exibir uma mensagem de erro ao usuário via snackbar.

---

## 5. Fora de Escopo

- Exportação em XLSX (formato Excel nativo) — CSV é suficiente para V2.0; XLSX pode entrar em iteração futura.
- Exportação de dados de configuração (seções, categorias, etc.).
- Agendamento automático de exportações.
- Exportação de dashboards como imagem.
- Importação reversa dos arquivos exportados.

---

## 6. Referências Técnicas

| Item | Arquivo(s) a tocar |
|------|-------------------|
| CSV mensal | `src/app/api/v1/` — novo route handler `GET /accounts/:id/months/:monthId/export/csv` |
| PDF mensal | Novo route handler `GET /accounts/:id/months/:monthId/export/pdf` |
| CSV anual | Novo route handler `GET /accounts/:id/years/:year/export/csv` |
| Botão no dashboard anual | Componente pai do `YearSelector` (dashboard page) |
| Botão no dashboard mensal | Componente que contém o seletor de mês e o botão "Ver Mês" |
| Botão no MonthHeader | `src/components/months/MonthHeader.tsx` |
| Componente de botão | `src/components/ui/ExpandableIconButton.tsx` + `Menu` do MUI |

**Decisões técnicas:**
- Biblioteca PDF: `@react-pdf/renderer` (server-side, compatível com Vercel e VPS Docker).
- Geração acontece em route handlers (não Server Actions) pois precisa retornar stream de arquivo.
- Multi-tenancy: `requireAccountAccess(accountId)` no início de cada route handler. Qualquer role é aceita (sem `requireRoles`).
- Valores monetários no CSV convertidos de centavos para reais com `centsToReais()` de `src/lib/money.ts`. Sinal aplicado conforme `countType` da seção.
- Slug do nome da account: lowercase + remoção de acentos (`normalize('NFD').replace(/\p{Mn}/gu, '')`) + substituição de espaços e caracteres especiais por hífens.
- Ordenação das transações: por `section.position` → `table.position` → `transaction.occurredOn ASC`.
