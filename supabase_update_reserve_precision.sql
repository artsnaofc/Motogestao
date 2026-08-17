-- Migration to update reserves rule value (regra_valor) precision to 4 decimal places (numeric(12, 4))
-- This supports high-precision values such as R$ 0.085 per kilometer.

ALTER TABLE public.reserves 
  ALTER COLUMN regra_valor TYPE numeric(12, 4);

COMMENT ON COLUMN public.reserves.regra_valor IS 'Valor ou percentual da regra de cálculo (com precisão de até 4 casas decimais para suportar R$ 0.085/km, etc.)';
