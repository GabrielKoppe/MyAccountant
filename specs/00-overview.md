# Spec 00 — Visão Geral

## 1. Propósito

Este documento é o ponto de entrada das specs. Aqui está a visão do produto, o roadmap de fases e o glossário de termos. Cada feature detalhada tem seu próprio spec numerado.

## 2. Visão do produto

**Problema**: Aplicativos financeiros existentes são engessados (categorias fixas, formato único de visualização) ou genéricos demais (planilhas em branco). Pessoas que organizam finanças em casal, família ou compartilhamento de gastos precisam de uma ferramenta colaborativa com estrutura flexível.

**Solução**: Um sistema onde múltiplos usuários colaboram em uma **Account**, organizam dados financeiros por **Mês**, e dentro de cada mês criam **Seções** customizadas (entradas, cartão, investimentos, etc.) com **Tabelas Financeiras** que contêm **Transações**.

**Diferenciais**:
- Colaboração multi-usuário com papéis (owner/editor/viewer).
- Seções configuráveis por Account com regras de contagem (adicionar/subtrair/ignorar/neutro).
- Importação flexível de CSV/XLSX com templates salvos.
- Dashboards comparativos entre meses, seções e tabelas.

## 3. Princípios

1. **Dados são imutáveis em essência**: registros financeiros não são deletados em silêncio. Soft-delete onde for relevante.
2. **Multi-tenancy desde o dia 1**: toda query é filtrada por Account.
3. **Type-safety end-to-end**: Zod no input, Prisma no banco, TypeScript no meio.
4. **Specs são a fonte da verdade**: código segue spec, não o contrário.
5. **Build em fases testáveis**: cada fase entrega valor isolado e pode ser validada.

## 4. Stack (resumo)

Detalhada no `CLAUDE.md` e em `specs/02-database-prisma.md` + `specs/12-deployment-and-docker.md`.

- **Next.js 15** (App Router) — Server Actions para mutações, RSC para reads
- **PostgreSQL 16 + Prisma** — schema declarativo, migrations versionadas
- **NextAuth v5** — auth com Prisma adapter
- **Zod + React Hook Form** — validação compartilhada
- **Material UI v6 + Emotion** — UI consistente
- **Docker + Docker Compose** — ambiente unificado dev/prod

## 5. Roadmap de fases

Cada fase é uma entrega completa e testável. **Não comece a próxima sem fechar a anterior.**

### Fase 0 — Setup (foundation)
**Spec**: `02-database-prisma.md`, `03-authentication.md`, `12-deployment-and-docker.md`
- Docker Compose (postgres + app + adminer opcional)
- Next.js 15 + TypeScript
- Prisma + Postgres rodando no container
- NextAuth v5 (configuração base, sem providers ainda)
- Material UI v6 + tema base + AppRouterCacheProvider
- Estrutura de pastas e convenções

**Entrega**: `docker compose up -d` sobe tudo, app rodando, sem features.

### Fase 1 — Autenticação
**Spec**: `03-authentication.md`
- Cadastro com email/senha
- Login com email/senha
- Login com Google OAuth
- Página de configurações do usuário (`user_settings`)

**Entrega**: usuário consegue criar conta, fazer login, ver perfil.

### Fase 2 — Accounts e Membros
**Spec**: `04-accounts-and-members.md`
- Criar Account
- Tela de seleção de Account (estilo Netflix) ao logar
- Convidar membros por email (owner only)
- Aceitar/recusar convite
- Gerenciar papéis (owner/editor/viewer)

**Entrega**: múltiplos usuários conseguem compartilhar uma Account.

### Fase 3 — Configurações da Account
**Spec**: `05-account-settings.md`
- Sections (criar, editar, ativar/desativar, deletar)
- Categories + Subcategories
- Institutions
- Columns (visibilidade)
- AccountSettings (currency, month_start_day, etc.)

**Entrega**: dono da Account consegue configurar a estrutura antes de adicionar dados.

### Fase 4 — Meses e Seções
**Spec**: `06-months.md`, `07-sections.md`
- Criar Mês (próximo mês como sugestão default)
- Navegação entre meses
- Exibição das seções configuradas
- Resumos de seção

**Entrega**: navegação por meses funcionando, mesmo sem dados.

### Fase 5 — Tabelas Financeiras
**Spec**: `08-finance-tables.md`
- CRUD de Tabela Financeira
- Source method: empty
- Source method: copy (de outro mês/seção)
- Header com nome, soma, ellipsis menu
- Colapsar/expandir tabela

**Entrega**: usuário consegue criar tabelas vazias ou copiadas de meses anteriores.

### Fase 6 — Transações
**Spec**: `09-transactions.md`
- CRUD de Transação (todos os campos)
- Duplicar transação
- Categoria, subcategoria, instituição
- Bulk actions (selecionar várias)

**Entrega**: usuário consegue lançar transações completas.

### Fase 7 — Import CSV/XLSX
**Spec**: `10-csv-xlsx-import.md`
- Source method: import
- Mapeamento de colunas (de → para)
- Preview obrigatório antes de salvar
- Templates salvos por Account

**Entrega**: usuário consegue importar extratos.

### Fase 8 — Dashboards
**Spec**: `11-dashboards.md`
- Visualização por mês
- Visualização por ano
- Comparações entre meses/seções/tabelas
- Criação de dashboards customizados

**Entrega**: usuário consegue analisar os dados ao longo do tempo.

## 6. Glossário

| Termo | Significado |
|---|---|
| **Account** | Grupo de usuários que compartilham dados financeiros. Equivalente ao conceito de "workspace" ou "espaço" em outros apps. |
| **Member** | Usuário pertencente a uma Account, com um role (owner/editor/viewer). |
| **Invite** | Convite enviado por email para um usuário entrar em uma Account. |
| **Month** | Competência financeira (ano + mês). Estrutura dentro da Account. |
| **Section** | Categoria de organização configurada na Account (ex: "Cartão", "Entradas", "Investimentos"). Aparece em todos os meses. |
| **Finance Table** | Tabela de transações dentro de uma seção de um mês. |
| **Transaction** | Linha de dado financeiro (data, valor, descrição, etc.). |
| **Section count type** | Regra de como uma seção contribui para o total do mês: `add` / `subtract` / `ignore` / `neutral`. |
| **Source method** | Forma de inicializar uma tabela: `empty` / `copy` / `import`. |
| **Template** | Mapeamento salvo de colunas para importação de CSV/XLSX. |
| **owner / editor / viewer** | Papéis dentro de uma Account com permissões diferentes. |

## 7. Decisões em aberto

> Atualizar conforme decidir. Quando uma decisão sair daqui, vai para o spec correspondente.

- [ ] **Soft-delete vs hard-delete**: por enquanto, hard-delete em tudo exceto Months e Transactions (a definir).
- [ ] **i18n**: começar em pt-BR. Estrutura preparada para multi-idioma, mas sem implementar EN no MVP.
- [ ] **Currency**: BRL hardcoded no MVP. Schema preparado para multi-currency, mas conversão fica para v2.
- [ ] **Notificações**: convites por email (resend.com?), notificações in-app ficam para v2.
- [ ] **Realtime**: não no MVP. Refresh manual é aceitável.
- [ ] **Mobile**: web responsivo no MVP. App nativo fica para depois.

## 8. Métricas de sucesso do MVP

- Usuário consegue criar uma Account, configurar 3+ seções, criar 3 meses e lançar 50+ transações em < 30 minutos.
- Importar um extrato de CSV de 100+ linhas funciona em < 5 minutos (incluindo mapeamento).
- Tempo de resposta para operações de leitura < 500ms (P95).
- Zero vazamento de dados entre Accounts (testar com 2 Accounts e usuários distintos).
