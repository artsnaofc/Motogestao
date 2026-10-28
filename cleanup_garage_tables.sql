-- ==============================================================================
-- SCRIPT DE LIMPEZA E OTIMIZAÇÃO DA BASE DE DADOS (SUPABASE)
-- Remove as tabelas desnecessárias da antiga Garagem e unifica a gestão de
-- veículos dentro do sistema de Orçamento de Fretes (freight_presets).
-- ==============================================================================

-- 1. Remove chaves estrangeiras vinculadas aos veículos se existirem
ALTER TABLE IF EXISTS public.transactions 
  DROP CONSTRAINT IF EXISTS transactions_vehicle_id_fkey;

ALTER TABLE IF EXISTS public.reserve_transactions 
  DROP CONSTRAINT IF EXISTS reserve_transactions_vehicle_id_fkey;

-- 2. Remove triggers ou funções legadas de atualização de odômetro se existirem
DROP TRIGGER IF EXISTS trigger_update_vehicle_odometer ON public.transactions;
DROP FUNCTION IF EXISTS public.update_vehicle_odometer();

-- 3. Remove as 4 tabelas legadas da garagem em cascata
DROP TABLE IF EXISTS public.vehicle_fipe_history CASCADE;
DROP TABLE IF EXISTS public.vehicle_maintenance CASCADE;
DROP TABLE IF EXISTS public.vehicle_odometer CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;

-- 4. Notificação de Sucesso
DO $$
BEGIN
  RAISE NOTICE 'Limpeza de tabelas da garagem concluída com sucesso! O banco de dados agora está mais limpo e otimizado.';
END $$;

SELECT 'Tabelas da Garagem removidas com sucesso! Veículos agora gerenciados via freight_presets.' AS status;
