-- SEC-02: hasheia in-place os tokens de convite pendentes que ainda estao em plaintext.
-- pgcrypto fornece digest(); encode(..., 'hex') gera o SHA-256 em hex (64 chars),
-- batendo com hashToken() da aplicacao. Preserva convites pendentes ja enviados por email.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "account_invites"
SET "token" = encode(digest("token", 'sha256'), 'hex')
WHERE "status" = 'pending';
