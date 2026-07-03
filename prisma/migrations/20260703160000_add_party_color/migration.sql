-- Persona: ícones agora são chaves de set curado (não emoji) + cor accent opcional.
ALTER TABLE "responsible_parties" ADD COLUMN "color" TEXT;

-- Ícones antigos eram emojis livres; limpa os que não pertencem ao novo set de chaves.
UPDATE "responsible_parties"
SET "icon" = NULL
WHERE "icon" IS NOT NULL
  AND "icon" NOT IN (
    'person','people','family','child','pet','home','heart','star',
    'work','school','savings','shopping','travel','restaurant','car','gift'
  );
