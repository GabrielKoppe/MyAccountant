# Como conectar uma IA ao MyAccountant (Conector MCP)

> Guia prático de teste do conector MCP (spec 63). Estado atual: implementado na branch `feat/63-mcp-connector`, **desligado por padrão** (`MCP_ENABLED=false`).

---

## Antes de tudo: o que cada parte faz

- **Página `Configurações → Connectors`** (a que você abriu): serve para **listar e revogar** os connectors que *você* já autorizou nesta Account. Ela **não** inicia a conexão.
- **Conectar** acontece do lado do **app de IA** (Claude/ChatGPT/MCP Inspector): você informa lá a **URL do servidor MCP** do MyAccountant, e o app te leva por um fluxo de login + consentimento.
- URL do servidor MCP: **`<origem>/api/mcp`** (local: `http://localhost:3000/api/mcp`).

⚠️ **Claude.ai (web) e ChatGPT rodam na nuvem e NÃO enxergam `localhost`.** Para testar na sua máquina, use o **MCP Inspector** (Caminho A). Para conectar o Claude.ai de verdade, você precisa de uma URL **HTTPS pública** (Caminho B: deploy ou túnel).

---

## Passo 0 — Ligar a feature (local)

1. No `.env`, ligue a flag:
   ```
   MCP_ENABLED="true"
   ```
   (Opcional: `MCP_ISSUER_URL="http://localhost:3000"` — se não setar, o servidor deduz a origem da requisição.)

2. Reinicie o app para carregar o env:
   ```bash
   docker compose restart app
   ```

3. Verifique que ficou no ar:
   ```bash
   # endpoint MCP agora exige auth (401), não mais 404:
   curl -s -o /dev/null -w "%{http_code}\n" -XPOST http://localhost:3000/api/mcp

   # metadados de descoberta OAuth respondem 200:
   curl -s http://localhost:3000/.well-known/oauth-authorization-server | jq .
   ```
   `401` no `/api/mcp` e `200` no `.well-known` = pronto. (Se `/api/mcp` der `404`, a flag não subiu — confira o `.env` e o restart.)

4. **Esteja logado no MyAccountant** em `http://localhost:3000` no seu navegador — o passo de autorização usa sua sessão para saber quem você é.

---

## Caminho A — Testar local com o MCP Inspector (recomendado)

O [MCP Inspector](https://github.com/modelcontextprotocol/inspector) é a ferramenta oficial para testar servidores MCP na sua máquina. Ele fala com `localhost` e sabe fazer o fluxo OAuth.

1. Rode o Inspector:
   ```bash
   npx @modelcontextprotocol/inspector
   ```
   Ele abre uma UI no navegador (porta ~6274).

2. Na UI do Inspector:
   - **Transport Type**: `Streamable HTTP`
   - **URL**: `http://localhost:3000/api/mcp`
   - Clique **Connect**.

3. O Inspector detecta que o servidor exige OAuth e dispara o fluxo automaticamente:
   - registra-se sozinho (Dynamic Client Registration);
   - abre a tela de **autorização** do MyAccountant no navegador;
   - você **faz login** (se ainda não estiver), **escolhe qual Account** conceder e vê o **aviso de LGPD** (os dados irão para o app de IA);
   - clica **Autorizar** → volta pro Inspector já com o token.

4. Agora explore:
   - **List Tools** → deve listar as 11 tools de leitura (ex.: `get_category_breakdown`, `get_month_deep_dive`, `get_comparison_data`, `get_institution_breakdown`, `get_year_overview`, `get_category_treemap`, `get_daily_totals`…).
   - Chame uma tool, ex. `get_month_deep_dive` passando um `monthId` real da sua Account (pegue um id em `Configurações` ou na URL de um mês). O resultado vem com os valores **reais** daquela Account.

> Só as tools de leitura da Account concedida aparecem — nada de escrita, e o `accountId` vem sempre da autorização, nunca do que a IA "pede".

---

## Caminho B — Conectar o Claude.ai (ou ChatGPT) de verdade

Requer que o MyAccountant esteja acessível numa **URL HTTPS pública** (não `localhost`).

### Opção 1 — Túnel para a máquina local (teste rápido)

1. Suba um túnel HTTPS para a porta 3000, por exemplo:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   # (ou: ngrok http 3000)
   ```
   Anote a URL pública gerada, ex.: `https://algo.trycloudflare.com`.

2. No `.env`, aponte o issuer para essa URL pública e reinicie:
   ```
   MCP_ENABLED="true"
   MCP_ISSUER_URL="https://algo.trycloudflare.com"
   ```
   ```bash
   docker compose restart app
   ```
   (O `MCP_ISSUER_URL` é importante aqui: os metadados OAuth precisam anunciar os endpoints com a URL **pública**, senão o Claude não consegue completar o login.)

### Opção 2 — Ambiente publicado (produção)

Use a URL real do deploy (ex.: `https://app.seudominio.com`) como `MCP_ISSUER_URL`, com `MCP_ENABLED=true`.

### No Claude.ai

1. **Settings → Connectors → Add custom connector**.
2. Cole a URL do MCP: `https://<sua-url-publica>/api/mcp`.
3. O Claude segue o mesmo fluxo: te manda ao MyAccountant → login → escolher Account → aviso LGPD → **Autorizar**.
4. Pronto: em qualquer conversa, pergunte *"quanto gastei com restaurante este mês?"* e o Claude chama as tools com seus dados reais.

> Suporte a conector MCP remoto é sólido no **Claude.ai** (Pro/Max/Team). No **ChatGPT** é mais recente (via Connectors/dev mode); no **Gemini** ainda imaturo.

---

## Gerenciar / revogar (a página que você abriu)

Em `Configurações → Connectors` você vê **os seus** connectors ativos naquela Account (qual app, quando concedeu, último uso) e pode **Revogar** — o que invalida na hora o acesso daquele app.

---

## Depois do teste

Se estava só testando local, **desligue a flag** para voltar ao estado padrão:
```
MCP_ENABLED="false"
```
```bash
docker compose restart app
```

---

## Se algo não funcionar

| Sintoma | Causa provável |
|---|---|
| `/api/mcp` responde `404` | `MCP_ENABLED` não está `true`, ou o app não reiniciou. |
| Claude.ai "não consegue conectar" | Está apontando pra `localhost` (a nuvem não alcança) — use túnel/deploy. |
| Login volta pro início / erro no authorize | `MCP_ISSUER_URL` não bate com a origem pública (os metadados anunciam URL errada). |
| Autorizou mas não lista tools | Confira que você fez login **no MyAccountant** antes de autorizar; o token é preso à Account escolhida. |
| Vê tools de escrita | Não deveria — o conector é **somente leitura** por design. |
| `401 invalid_token: No authorization provided` no Inspector após autorizar | O Inspector ficou com estado OAuth de uma tentativa que falhou. **Reinicie o Inspector** (Ctrl+C e `npx @modelcontextprotocol/inspector` de novo) ou limpe o OAuth dele para este servidor, e conecte outra vez. (O bug de servidor que causava isso — metadata RFC 9728 no path errado — já foi corrigido.) |

---

## Observações de estado (branch `feat/63-mcp-connector`)

- Catálogo atual = 11 tools sobre `dashboards.ts`. `get_sankey_data` e `get_weekly_spending` estão **fora do ar de propósito** (ajustes pendentes); demais módulos de query virão depois (Task 1.3b).
- Rate-limit é in-memory (base para a spec 23 SEC-01/Upstash).
- A feature está `ready` no spec, ainda não `approved`/mergeada.
