-- Cria UserSettings padrão para usuários que não possuem registro (backfill pós-migração accent_color)
-- Seguro para re-execução: INSERT ... WHERE NOT EXISTS não duplica registros
INSERT INTO user_settings (user_id, theme, accent_color, locale, timezone, created_at, updated_at)
SELECT
  u.id,
  'system',
  'indigo',
  'pt-BR',
  'America/Sao_Paulo',
  NOW(),
  NOW()
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_settings us WHERE us.user_id = u.id
);
