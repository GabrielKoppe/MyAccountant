# Spec 58 — Testes End-to-End

> Status: draft
> Insumo: revisão de código em `tests/` e `src/` (2026-06-29)
> Skills: [`testing`](../skills/testing/SKILL.md)
> Relacionado: [`spec 13`](13-testing.md) (estratégia de testes) · [`spec 16`](16-ci-cd.md) (CI/CD)

---

## 1. Problema

- **E2E-01**: A suíte atual cobre **services e queries** com Vitest — ~463 casos de teste (`it`/`test`) em ~31 arquivos de teste — mas **não há nenhum teste end-to-end**. Não existe Playwright nem qualquer driver de browser no projeto (`package.json` não lista nenhum). Os testes exercitam unidades isoladas (mockando Prisma com `vitest-mock-extended`), nunca o fluxo real do usuário através de páginas, Server Actions, banco e navegação.
- **E2E-02**: Os fluxos críticos ponta-a-ponta **não têm cobertura**. Não há teste que verifique: criar Account → adicionar membros → criar mês → lançar transações → exportar; import de CSV; navegação entre dashboards. Uma regressão que quebre a sequência (ex.: Server Action de criação de mês que falha após mudança de schema) só seria detectada manualmente.

---

## 2. Solução

### 2.1 Introduzir Playwright (E2E-01)

- Adicionar **Playwright** como ferramenta de teste E2E, com configuração própria (`playwright.config.ts`) separada da config do Vitest (specs 13).
- Os testes E2E rodam contra a aplicação real subida em container, com banco PostgreSQL dedicado de teste (seed determinístico). Documentar o comando de execução via `docker compose` (alinhado à seção 8 do `CLAUDE.md`).

### 2.2 Cenários críticos (E2E-02)

Implementar **5–10 cenários** cobrindo os fluxos de maior valor. Cada cenário é um critério verificável na §4.

### 2.3 Pipeline (spec 16)

- Incluir a execução dos testes E2E no pipeline de CI (spec 16 — `ci.yml`), como job que sobe a stack e roda Playwright. Falha no E2E falha o pipeline.

---

## 3. User Stories

- Como desenvolvedor, quero testes E2E dos fluxos críticos, para detectar quebras de ponta-a-ponta antes do deploy, e não em produção.
- Como mantenedor, quero o E2E rodando no CI, para que um PR que quebre o fluxo de lançar/exportar transações não seja mesclado.
- Como novo contribuidor, quero documentação de como rodar o E2E via docker compose, para executar localmente sem montar o ambiente do zero.

---

## 4. Critérios de Aceitação

**E2E-01 (infra):**
- Playwright DEVE estar instalado e configurado (`playwright.config.ts`), separado da config Vitest.
- OS testes E2E DEVEM rodar contra a aplicação real com banco de teste dedicado e seed determinístico.
- A forma de rodar os testes via `docker compose` DEVE estar documentada.

**E2E-02 (cenários — cada bullet é um teste que DEVE passar):**
- QUANDO o usuário cria uma Account, adiciona um membro (convite), cria um mês, lança transações e exporta, O FLUXO completo DEVE concluir sem erro e o arquivo exportado DEVE conter as transações lançadas.
- QUANDO o usuário importa um arquivo CSV válido, AS TRANSAÇÕES DEVEM aparecer na tabela do mês após confirmar o preview.
- QUANDO o usuário navega entre os dashboards (mensal e anual), AS PÁGINAS DEVEM carregar e renderizar os widgets sem erro.
- QUANDO um usuário não autenticado acessa uma rota protegida, ELE DEVE ser redirecionado para o login.
- QUANDO um membro `viewer` abre uma tabela, OS controles de edição/ações de escrita NÃO DEVEM estar disponíveis.

**Pipeline:**
- O job E2E DEVE rodar no CI (spec 16); falha no E2E DEVE falhar o pipeline.

---

## 5. Fora de Escopo

- Testes E2E de **todos** os fluxos do app — esta spec entrega os 5–10 cenários críticos; cobertura ampla é incremental.
- Testes de carga / performance (P95/P99 sob volume) — é tema da spec 56.
- Testes visuais/snapshot de pixel — fora do escopo; verifica-se comportamento, não pixels.
- Testes cross-browser exaustivos (Safari/Firefox/Edge) — começar com Chromium; ampliar depois se necessário.
- Substituir os testes unitários/integração de Vitest — E2E é complementar, não substituto (spec 13 permanece).

---

## 6. Decisões de Design

| ID | Decisão | Escolha | Motivo |
|---|---|---|---|
| DD-01 | Ferramenta E2E | Playwright | Padrão maduro para Next.js; suporte a auto-wait, traces e CI |
| DD-02 | Banco do E2E | PostgreSQL dedicado com seed determinístico | Isola o E2E dos dados de dev; resultados reproduzíveis |
| DD-03 | Escopo inicial | 5–10 cenários críticos, Chromium | Cobertura de maior valor primeiro; ampliar incrementalmente |

---

## 7. Referências Técnicas

| Item | Arquivo(s) a tocar |
|---|---|
| Config Playwright | `playwright.config.ts` (novo) |
| Cenários E2E | `e2e/` (novo — ex.: `account-flow.spec.ts`, `csv-import.spec.ts`, `dashboards.spec.ts`) |
| Seed de teste | `e2e/fixtures/seed.ts` (novo) |
| Pipeline CI | `.github/workflows/ci.yml` (spec 16) |
| Documentação de execução | `CLAUDE.md` §8 / `specs/13-testing.md` |
| Estratégia de testes existente | `tests/` · `specs/13-testing.md` |
