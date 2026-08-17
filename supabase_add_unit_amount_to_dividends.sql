-- Migration: Add unit_amount to dividends table
-- Run this inside your Supabase SQL Editor

ALTER TABLE public.dividends ADD COLUMN IF NOT EXISTS unit_amount numeric;

COMMENT ON COLUMN public.dividends.unit_amount IS 'Valor unitário do provento (por cota) digitado no formulário';
