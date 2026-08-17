-- SCRIPT DE ATUALIZAÇÃO DO BANCO: Adição do controle temporal e versionamento de regras
-- Acesse o seu console Supabase (https://supabase.com), abra o "SQL Editor", cole o script abaixo e clique em "Run".

-- 1. Adiciona a coluna regra_inicio_validade de forma segura e não destrutiva
ALTER TABLE reserves 
  ADD COLUMN IF NOT EXISTS regra_inicio_validade TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Atualiza as reservas existentes para que o início da validade inicial de suas regras atuais coincida com a data de sua criação histórica
UPDATE reserves 
SET regra_inicio_validade = created_at 
WHERE regra_inicio_validade IS NULL;
