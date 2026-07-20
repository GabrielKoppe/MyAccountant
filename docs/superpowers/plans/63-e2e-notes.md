# Validação e2e do fluxo OAuth + MCP (Task 3.6 do spec 63)

> Data: 2026-07-20 · Verificação, sem mudança de código de produção.
> Objetivo: exercitar ao vivo (não mockado) o `/api/oauth/token` e o `/api/mcp` — o handshake que
> a Task 2.2 deixou adiado. Brief completo em `.superpowers/sdd/task-3.6-brief.md`, relatório em
> `.superpowers/sdd/task-3.6-report.md` (este arquivo é o transcript resumido).

---

## Ambiente

- `docker compose exec -T app` / `docker compose exec -T postgres psql -U myaccountant -d
  myaccountant` contra o Postgres de dev com dados reais (2 usuários, 2 accounts, 833
  transações). Nenhum `migrate reset`/`TRUNCATE` executado.
- Flag ligada temporariamente: `.env` ganhou `MCP_ENABLED="true"` → `docker compose restart app`
  → revertida para `"false"` ao final → restart de novo → confirmado `Ready` e `/api/mcp` de
  volta a 404.

## Contas usadas (reais, pré-existentes)

| Papel no teste | account_id | Sections | Months (2026) | Transações |
|---|---|---|---|---|
| mainAccount ("Minha Família") | `cmpvnt4l3001fpl10byp79cs8` | 7 | 8 | 833 |
| otherAccount ("Minha Conta") | `cmpvfkx4h0002plwdmxkcah3o` | 4 | 0 | 0 |

## Passo a passo (comandos reais, resumidos)

1. **Gate da flag**: `POST /api/mcp` sem auth → `404` (flag off) → `401` (flag on, mesmo body,
   sem token) — confirma que ligar `MCP_ENABLED` troca o handler real (`withMcpAuth`), não só a
   resposta de erro.
2. **`.well-known/*` e `/api/oauth/register`**: `200`/`200`/`400` (invalid_client_metadata em
   body vazio) — nenhum `Location` de redirect de login. Matcher do `middleware.ts` não editado,
   só confirmado (o ponto em `.well-known` já cai no `.*\..*` do lookahead de exclusão).
3. **Client registration** (`POST /api/oauth/register`) → `client_id` real emitido
   (`8bL7Nbm2D2OeKEV-iZ-cnw`, deletado no cleanup).
4. **Consent simulado**: como `/api/oauth/authorize` exige sessão de browser (fora do alcance de
   curl puro), o "sim" do usuário foi simulado com um INSERT direto em `mcp_auth_codes` — PKCE
   S256 e hash sha256-hex gerados via `docker compose exec -T app node -e '...crypto...'`, nunca
   à mão. Duas linhas inseridas (uma por account), ambas deletadas no cleanup.
5. **Token endpoint, troca real** (`grant_type=authorization_code`): `200` com `access_token`,
   `refresh_token`, `token_type:"Bearer"`, `scope:"read"` — para as duas contas.
6. **Replay do mesmo `code`**: `400 {"error":"invalid_grant"}` — uso único provado em runtime
   (não só em mock), via o `updateMany({ where: { code, consumedAt: null } })` de
   `consumeAuthCode`.
7. **`/api/mcp` com Bearer**:
   - Bearer inválido → `401 {"error":"invalid_token",...}`.
   - Bearer válido, `tools/list` → `200`, exatamente as 11 tools esperadas (as duas
     `DEFERRED_TOOLS` — `get_sankey_data`, `get_weekly_spending` — de fora, como no código).
   - Nenhum handshake `initialize` foi necessário: a lib (`mcp-handler` + SDK) cria um
     `McpServer`/transporte **novo a cada POST**, com `sessionIdGenerator` indefinido → modo
     stateless da SDK, sem validação de sessão. Resposta chega como SSE de request único
     (`Content-Type: text/event-stream`, um evento `message` com o JSON-RPC completo) — isso é
     ortogonal ao `disableSse:true` do route (que só desativa o endpoint standalone `/sse`).
   - `tools/call get_month_deep_dive` com token da mainAccount + `monthId` real → `200`, dado de
     produção genuíno (7 sections, `monthTotal:"-785158"`, categorias/transações reais).
8. **Multi-tenancy live**: token da `otherAccount` chamando `get_month_deep_dive` com um
   `monthId` **real da mainAccount** devolveu as sections da própria `otherAccount` e
   `topTransactions:[]`/`monthTotal:"0"` — nenhuma das 833 transações da outra conta vazou.
   `get_year_overview({year:2026})` reforçou o isolamento: token OTHER → `monthSummaries:[]`
   (conta vazia); token MAIN → 8 meses reais com totais batendo o DB.
9. **Cleanup**: deletadas por id as 4 linhas de `mcp_tokens`, 2 de `mcp_grants`, 2 de
   `mcp_auth_codes` e 1 de `mcp_clients` (todas do client de teste). Confirmado `count(*)=0` nas
   4 tabelas para esse client, e `transactions`/`accounts` intactos (833 / 2).

## Resultado

Todos os itens do brief passaram, incluindo o bônus opcional (`tools/list` + `tools/call` reais,
não só o fallback de 401 inválido/válido). Nenhum bug de runtime encontrado — o comportamento ao
vivo bate com o que os testes unitários mockados já garantiam.
