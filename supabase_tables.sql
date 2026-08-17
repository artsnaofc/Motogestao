-- Run this in your Supabase SQL Editor to create the investment transactions table

-- Caso a tabela já exista e falte apenas a coluna 'costs', execute o comando abaixo:
-- ALTER TABLE public.investment_transactions ADD COLUMN IF NOT EXISTS costs numeric DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.investment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('buy', 'sell')),
  type text NOT NULL CHECK (type IN ('Ação', 'FII')),
  ticker text NOT NULL,
  amount numeric NOT NULL,
  price numeric NOT NULL,
  quantity numeric NOT NULL,
  costs numeric DEFAULT 0,
  reserve_id uuid REFERENCES public.reserves(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.reserve_transactions(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view their own investment transactions"
ON public.investment_transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own investment transactions"
ON public.investment_transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own investment transactions"
ON public.investment_transactions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own investment transactions"
ON public.investment_transactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Optional: Create index on user_id and ticker for faster querying
CREATE INDEX IF NOT EXISTS investment_transactions_user_id_idx ON public.investment_transactions (user_id);
CREATE INDEX IF NOT EXISTS investment_transactions_ticker_idx ON public.investment_transactions (ticker);
