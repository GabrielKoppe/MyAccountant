-- Extensões usadas pelo projeto
CREATE EXTENSION IF NOT EXISTS "citext";

-- Servidor sempre em UTC; conversão de timezone acontece no app
ALTER DATABASE myaccountant SET timezone TO 'UTC';
