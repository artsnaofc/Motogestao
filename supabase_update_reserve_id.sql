-- Adiciona coluna reserve_id para vincular investimentos a reservas
ALTER TABLE public.investment_transactions ADD COLUMN IF NOT EXISTS reserve_id uuid REFERENCES public.reserves(id) ON DELETE SET NULL;
