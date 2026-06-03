# Spec 22 — Exportação de Dados

> Status: draft
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

Adicionar opções de exportação em dois pontos da interface:

1. **Cabeçalho do mês** (`MonthHeader`): botão "Exportar" com opções para o mês atual.
   - **CSV de transações**: todas as transações do mês com todos os campos em colunas (data, descrição, valor, categoria, subcategoria, instituição, responsável, seção, tabela, pendente, favorita, notas).
   - **PDF resumo mensal**: documento com total do mês, totais por seção, distribuição por categoria e lista de transações.

2. **Dashboard anual**: botão "Exportar ano" com opção de CSV consolidado do ano inteiro.

---

## 3. User Stories

- Como usuário, quero exportar as transações do mês em CSV, para abrir no Excel ou enviar para meu contador.
- Como usuário, quero exportar um resumo mensal em PDF, para compartilhar ou arquivar.
- Como usuário, quero exportar todas as transações do ano em um único CSV, para análise histórica ou backup.

---

## 4. Critérios de Aceitação

**CSV de transações do mês:**
- QUANDO o usuário clica em "Exportar → CSV", O SISTEMA DEVE gerar e baixar um arquivo `.csv` com todas as transações do mês.
- O arquivo DEVE incluir as colunas: Data, Descrição, Valor (em reais, formato numérico), Seção, Tabela, Categoria, Subcategoria, Instituição, Responsável, Pendente (Sim/Não), Favorita (Sim/Não), Notas.
- O nome do arquivo DEVE ser: `[nome-da-account]_[ano]-[mes].csv` (ex: `familia-silva_2026-01.csv`).
- Os valores DEVEM estar em formato numérico (não formatado como moeda) para facilitar importação em planilhas.
- A codificação DEVE ser UTF-8 com BOM para compatibilidade com Excel em Windows.

**PDF resumo mensal:**
- QUANDO o usuário clica em "Exportar → PDF", O SISTEMA DEVE gerar e baixar um arquivo `.pdf`.
- O PDF DEVE conter: nome da account, mês de referência, total do mês, totais por seção, top 8 categorias com valores, lista completa de transações agrupada por seção/tabela.
- O PDF DEVE ser gerado no servidor (route handler), não no cliente.

**CSV anual:**
- QUANDO o usuário clica em "Exportar ano" no dashboard anual, O SISTEMA DEVE gerar um CSV com todas as transações do ano selecionado.
- O formato das colunas DEVE ser idêntico ao CSV mensal, com coluna adicional "Mês".

**Geral:**
- SE a exportação falhar, O SISTEMA DEVE exibir uma mensagem de erro ao usuário.
- ENQUANTO o arquivo está sendo gerado (especialmente o PDF), O SISTEMA DEVE mostrar um indicador de carregamento no botão.

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
| PDF mensal | Novo route handler + biblioteca de geração PDF server-side |
| CSV anual | Novo route handler `GET /accounts/:id/years/:year/export/csv` |
| Botão de exportação | `src/components/months/MonthHeader.tsx`, `src/components/dashboards/YearSelector.tsx` ou dashboard page |

- Biblioteca sugerida para CSV: geração manual (simples string building) ou `papaparse` no servidor.
- Biblioteca sugerida para PDF: `@react-pdf/renderer` (React-based, server-side) ou `puppeteer` (screenshot de componente HTML).
- A geração acontece em route handlers (não em Server Actions) pois precisa retornar um stream de arquivo.
- Multi-tenancy: garantir `requireAccountAccess(accountId)` no início de cada route handler de exportação.
- Todos os valores monetários no CSV DEVEM ser convertidos de centavos para reais (dividir por 100, 2 casas decimais).
