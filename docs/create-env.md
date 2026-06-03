
## 1. `DATABASE_URL` e `DIRECT_URL`

**Não precisa fazer nada** para dev local. Os valores já estão certos — apontam para o container `postgres` que sobe com o `docker compose up`. Só muda em produção (Neon/Railway).

---

## 2. `NEXTAUTH_SECRET`

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

## 3. `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`

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

## 4. `RESEND_API_KEY` e `EMAIL_FROM`

### Passo 1 — Criar conta

1. Acesse [resend.com](https://resend.com) → **Sign up** (pode usar Google)

### Passo 2 — Gerar API Key

1. No painel lateral: **API Keys**
2. Clique **+ Add API Key**
3. Nome: `MyAccountant Dev`
4. Permissão: **Full access**
5. **Criar** → copie o valor que aparece **agora** (não aparece de novo)

```bash
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### Passo 3 — `EMAIL_FROM` em desenvolvimento

Sem domínio verificado por enquanto, use o domínio de sandbox do Resend:

```bash
EMAIL_FROM="MyAccountant <onboarding@resend.dev>"
```

⚠️ Com este remetente, o Resend só permite enviar **para o email da sua conta Resend**. Suficiente para testar localmente.

### Passo 4 — Verificar domínio (quando tiver um domínio de prod)

1. Painel Resend → **Domains → Add Domain**
2. Digite seu domínio (ex: `myaccountant.app`)
3. O Resend mostra 3 registros DNS (SPF, DKIM, DMARC) para adicionar no seu provedor de domínio
4. Após propagação (~5min a 24h), fica verde
5. Aí pode usar `EMAIL_FROM="MyAccountant <noreply@myaccountant.app>"`

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

# Resend
RESEND_API_KEY="re_<sua key>"
EMAIL_FROM="MyAccountant <onboarding@resend.dev>"

# Logging
LOG_LEVEL="debug"

# Client
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Se travar em algum passo específico é só falar.