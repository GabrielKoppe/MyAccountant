# Como criar cada variável do `.env`

Guia passo a passo para preencher **todas** as variáveis do `.env` em desenvolvimento. Copie o `.env.example` para `.env` e siga as seções abaixo. Ao final há o `.env` completo de referência.

```bash
cp .env.example .env
```

---

## 1. `DATABASE_URL` e `DIRECT_URL`

**Não precisa fazer nada** para dev local. Os valores já estão certos — apontam para o container `postgres` que sobe com o `docker compose up`. Só muda em produção (Neon/Railway).

---

## 2. `NEXTAUTH_URL` e `NEXT_PUBLIC_APP_URL`

**Não precisa fazer nada** em dev — ambos são `http://localhost:3000` (já vêm assim no `.env.example`). Em produção, troque para a URL pública do app (ex.: `https://app.myaccountant.com`).

---

## 3. `NEXTAUTH_SECRET`

Gere uma string aleatória segura. Rode **um** desses comandos no terminal:

```bash
# Opção A — openssl (recomendado, disponível no Mac/Linux/WSL)
openssl rand -base64 32

# Opção B — dentro do container Docker
docker compose exec app openssl rand -base64 32

# Opção C — Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Vai gerar algo como `K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=`. Cole isso no `.env`:

```bash
NEXTAUTH_SECRET="K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols="
```

---

## 4. `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`

### Passo 1 — Criar projeto no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. No topo, clique no seletor de projeto → **"Novo projeto"**
3. Nome: `MyAccountant` → **Criar**
4. Aguarde e certifique que o projeto novo está selecionado no topo

### Passo 2 — Ativar a API do Google+

1. No menu lateral: **APIs e serviços → Biblioteca**
2. Busque `Google+ API` → clique → **Ativar**
   *(ou busque "Google Identity" se não encontrar)*

### Passo 3 — Configurar tela de consentimento OAuth

1. Menu lateral: **APIs e serviços → Tela de consentimento OAuth**
2. User type: **Externo** → Criar
3. Preencha:
   - **Nome do app**: `MyAccountant`
   - **E-mail de suporte**: seu email
   - **E-mail do desenvolvedor** (lá embaixo): seu email
4. Clique **Salvar e continuar** nas próximas telas (Escopos e Usuários de teste podem ficar padrão por enquanto)
5. Na tela de Usuários de teste, **adicione seu próprio email** (necessário enquanto o app está em modo "Teste")

### Passo 4 — Criar credenciais OAuth

1. Menu lateral: **APIs e serviços → Credenciais**
2. Clique **+ Criar credenciais → ID do cliente OAuth**
3. Tipo: **Aplicativo da Web**
4. Nome: `MyAccountant Dev`
5. Em **Origens JavaScript autorizadas**, clique em **+ Adicionar URI**:
   ```
   http://localhost:3000
   ```
6. Em **URIs de redirecionamento autorizados**, adicione:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
7. Clique **Criar**

### Passo 5 — Copiar as credenciais

Vai aparecer um modal com os dois valores. Cole no `.env`:

```bash
GOOGLE_CLIENT_ID="123456789-abcdefghijklmnop.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxx"
```

> Quando for para produção, volte aqui e adicione a URL de prod também (ex: `https://app.myaccountant.com` e `https://app.myaccountant.com/api/auth/callback/google`).

---

## 5. `BREVO_API_KEY` e `EMAIL_FROM`

O envio de email (convites, recuperação de senha) usa o **Brevo** (antigo Sendinblue). O código posta em `https://api.brevo.com/v3/smtp/email` (`src/server/email/client.ts`).

### Passo 1 — Criar conta

1. Acesse [brevo.com](https://www.brevo.com) → **Sign up free** (pode usar Google)
2. Confirme o email e faça o onboarding básico

### Passo 2 — Verificar um remetente (sender)

O Brevo só envia a partir de um remetente verificado.

1. Menu (canto superior direito, nome da conta) → **Senders, Domains & Dedicated IPs**
   *(ou acesse diretamente [app.brevo.com/senders](https://app.brevo.com/senders))*
2. Aba **Senders** → **Add a sender**
3. Preencha **Nome** (ex: `MyAccountant`) e **Email** (um email seu que você controla)
4. **Save** → o Brevo envia um email de confirmação para esse endereço → clique no link para verificar
5. Esse email verificado é o que vai no `EMAIL_FROM`

### Passo 3 — Gerar a API Key

1. Menu (nome da conta) → **SMTP & API**
   *(ou [app.brevo.com/settings/keys/api](https://app.brevo.com/settings/keys/api))*
2. Aba **API Keys** → **Generate a new API key**
3. Nome: `MyAccountant Dev` → **Generate**
4. Copie o valor **agora** (não aparece de novo)

```bash
BREVO_API_KEY="xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
EMAIL_FROM="MyAccountant <seu-remetente-verificado@gmail.com>"
```

> `EMAIL_FROM` aceita `Nome <email@dominio.com>` ou só `email@dominio.com`. O email **precisa** ser um remetente verificado (Passo 2), senão o envio falha.
>
> **Produção:** verifique um **domínio** inteiro em **Domains** (adiciona registros DNS SPF/DKIM) para enviar de `noreply@seudominio.com` com boa entregabilidade.

---

## 6. `ALLOWED_EMAILS` (opcional)

Controla quem pode **criar conta** (allowlist de cadastro). Deixe **vazio** para permitir qualquer email:

```bash
# Vazio = qualquer um pode se cadastrar (útil em dev)
ALLOWED_EMAILS=""

# Ou restrinja a emails específicos (separados por vírgula):
# ALLOWED_EMAILS="voce@email.com,amigo@email.com"
```

> Quem tem convite pendente para uma Account consegue se cadastrar mesmo fora da allowlist.

---

## 7. `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`

Backend do **rate limiting** (SEC-01: proteção de login, cadastro, convites e recuperação de senha).

- **Em dev:** **opcional**. Se ficar vazio, o rate limiting é **no-op** (não limita nada) — o app funciona normal. Só preencha se quiser **testar o rate limiting**.
- **Em produção:** **obrigatório** — o app **não sobe** sem essas duas variáveis (falha proposital, por segurança).

O Upstash é um Redis gerenciado via REST (funciona no deploy Docker sem adicionar serviço ao stack).

### Passo 1 — Criar conta

1. Acesse [upstash.com](https://upstash.com) → **Sign Up** (pode usar Google/GitHub)

### Passo 2 — Criar o banco Redis

1. No console, aba **Redis** → **Create Database**
2. Preencha:
   - **Name**: `myaccountant-dev`
   - **Type**: **Regional** (mais barato/simples; suficiente para dev)
   - **Region**: escolha a mais próxima de você (ex.: `sa-east-1` / `us-east-1`)
   - **TLS**: deixe ligado (padrão)
   - Eviction pode ficar no padrão
3. Clique **Create**

### Passo 3 — Copiar as credenciais REST

1. Abra o banco recém-criado
2. Role até a seção **REST API**
3. A forma mais fácil: clique na aba **`.env`** dessa seção — ela mostra as duas variáveis já prontas:
   ```
   UPSTASH_REDIS_REST_URL="https://xxxx-yyyy.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="AXXXaSJHFxxxxxxxxxxxxxxxxxxxxxxxx"
   ```
4. Copie os dois valores para o seu `.env`.

### Passo 4 — Reiniciar o app

```bash
docker compose restart app
```

> **Testar:** com o Upstash configurado, faça 11 tentativas de login com senha errada em <15min do mesmo IP → a 11ª deve retornar HTTP 429. Limites atuais: login 10/15min, cadastro 5/h, convites 5/h, reset 3/h.

---

## 8. `MCP_*` — Conector MCP (opcional, spec 63)

Habilita o conector MCP para IA pessoal. **Em dev, deixe desligado** a menos que esteja testando essa feature — os defaults já bastam:

```bash
MCP_ENABLED="false"                       # "true" para habilitar o conector
MCP_ISSUER_URL="http://localhost:3000"    # URL base do app (só usada se MCP_ENABLED=true)
MCP_ACCESS_TOKEN_TTL_SECONDS=3600         # opcional (default 3600 = 1h)
MCP_REFRESH_TOKEN_TTL_DAYS=90             # opcional (default 90 dias)
```

> Se `MCP_ENABLED="false"`, as demais podem ficar como estão — não afetam nada.

---

## 9. `LOG_LEVEL`

Nível de log do Pino. Em dev, `debug` é o mais útil:

```bash
LOG_LEVEL="debug"   # trace | debug | info | warn | error | fatal
```

---

## Resultado final do `.env`

```bash
# Database (dev — não mudar)
DATABASE_URL="postgresql://myaccountant:dev_password@postgres:5432/myaccountant?schema=public"
DIRECT_URL="postgresql://myaccountant:dev_password@postgres:5432/myaccountant?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<saída do openssl rand -base64 32>"

# Google OAuth
GOOGLE_CLIENT_ID="<seu client id>.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-<seu secret>"

# Email (Brevo)
BREVO_API_KEY="xkeysib-<sua key>"
EMAIL_FROM="MyAccountant <seu-remetente-verificado@gmail.com>"

# Controle de cadastro (vazio = qualquer um)
ALLOWED_EMAILS=""

# Rate limiting (Upstash) — opcional em dev, obrigatório em prod
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# MCP Connector (opcional — spec 63)
MCP_ENABLED="false"
MCP_ISSUER_URL="http://localhost:3000"
MCP_ACCESS_TOKEN_TTL_SECONDS=3600
MCP_REFRESH_TOKEN_TTL_DAYS=90

# Logging
LOG_LEVEL="debug"

# Client
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Se travar em algum passo específico é só falar.
