-- CreateEnum
CREATE TYPE "mcp_token_type" AS ENUM ('access', 'refresh');

-- CreateTable
CREATE TABLE "mcp_client" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_grant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'read',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "mcp_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_token" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "type" "mcp_token_type" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_auth_code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'read',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_auth_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_client_clientId_key" ON "mcp_client"("clientId");

-- CreateIndex
CREATE INDEX "mcp_grant_accountId_idx" ON "mcp_grant"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_grant_userId_accountId_clientId_key" ON "mcp_grant"("userId", "accountId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_token_tokenHash_key" ON "mcp_token"("tokenHash");

-- CreateIndex
CREATE INDEX "mcp_token_grantId_idx" ON "mcp_token"("grantId");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_auth_code_code_key" ON "mcp_auth_code"("code");

-- AddForeignKey
ALTER TABLE "mcp_grant" ADD CONSTRAINT "mcp_grant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_grant" ADD CONSTRAINT "mcp_grant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_grant" ADD CONSTRAINT "mcp_grant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "mcp_client"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_token" ADD CONSTRAINT "mcp_token_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "mcp_grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
