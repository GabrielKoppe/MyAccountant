/*
  Warnings:

  - You are about to drop the `mcp_auth_code` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mcp_client` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mcp_grant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mcp_token` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "mcp_grant" DROP CONSTRAINT "mcp_grant_accountId_fkey";

-- DropForeignKey
ALTER TABLE "mcp_grant" DROP CONSTRAINT "mcp_grant_clientId_fkey";

-- DropForeignKey
ALTER TABLE "mcp_grant" DROP CONSTRAINT "mcp_grant_userId_fkey";

-- DropForeignKey
ALTER TABLE "mcp_token" DROP CONSTRAINT "mcp_token_grantId_fkey";

-- DropTable
DROP TABLE "mcp_auth_code";

-- DropTable
DROP TABLE "mcp_client";

-- DropTable
DROP TABLE "mcp_grant";

-- DropTable
DROP TABLE "mcp_token";

-- CreateTable
CREATE TABLE "mcp_clients" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "redirect_uris" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_grants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'read',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "mcp_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_tokens" (
    "id" TEXT NOT NULL,
    "grant_id" TEXT NOT NULL,
    "type" "mcp_token_type" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_auth_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "code_challenge" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'read',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_clients_client_id_key" ON "mcp_clients"("client_id");

-- CreateIndex
CREATE INDEX "mcp_grants_account_id_idx" ON "mcp_grants"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_grants_user_id_account_id_client_id_key" ON "mcp_grants"("user_id", "account_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tokens_token_hash_key" ON "mcp_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "mcp_tokens_grant_id_idx" ON "mcp_tokens"("grant_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_auth_codes_code_key" ON "mcp_auth_codes"("code");

-- AddForeignKey
ALTER TABLE "mcp_grants" ADD CONSTRAINT "mcp_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_grants" ADD CONSTRAINT "mcp_grants_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_grants" ADD CONSTRAINT "mcp_grants_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "mcp_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "mcp_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
