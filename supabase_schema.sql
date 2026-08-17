-- Habilita a extensão UUID caso não esteja habilitada
create extension if not exists "uuid-ossp";

-- Cria a tabela transactions
create table transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(10, 2) not null check (amount > 0),
  date date not null default current_date,
  category text not null,
  description text,
  start_km numeric(10, 2),
  end_km numeric(10, 2),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativa RLS (Row Level Security)
alter table transactions enable row level security;

-- Política de RLS: O usuário só pode ver as próprias transações
create policy "Users can view their own transactions"
  on transactions for select
  using (auth.uid() = user_id);

-- Política de RLS: O usuário só pode inserir as próprias transações
create policy "Users can insert their own transactions"
  on transactions for insert
  with check (auth.uid() = user_id);

-- Política de RLS: O usuário só pode atualizar as próprias transações
create policy "Users can update their own transactions"
  on transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Política de RLS: O usuário só pode deletar as próprias transações
create policy "Users can delete their own transactions"
  on transactions for delete
  using (auth.uid() = user_id);


-- Cria a tabela user_settings
create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade not null,
  full_name text,
  pizzaria_base_deliveries int default 8,
  pizzaria_base_rate numeric(10, 2) default 90.00,
  pizzaria_daily_rate_above_base numeric(10, 2) default 50.00,
  pizzaria_delivery_rate numeric(10, 2) default 5.00,
  pizzaria_out_of_neighborhood_rate numeric(10, 2) default 4.00,
  expense_categories text[] default '{"Combustível", "Manutenção", "Alimentação", "Plano de Internet", "Equipamento", "Outras Despesas", "Outros"}'::text[],
  income_categories text[] default '{"iFood", "Uber", "99Moto", "Particular", "Gorjeta", "Frete do Dia", "Pizzaria", "Outros"}'::text[],
  vehicle_km_per_liter numeric(10, 2) default 30.00,
  fuel_price numeric(10, 2) default 6.00,
  default_driver_labor numeric(10, 2) default 100.00,
  initial_balance numeric(10, 2) default 0.00,
  categories_with_km text[] default '{"iFood", "Uber", "99Moto", "Pizzaria", "Frete do Dia"}'::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativa RLS (Row Level Security)
alter table user_settings enable row level security;

-- Políticas para user_settings
create policy "Users can view their own settings"
  on user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- Cria a tabela reserves
create table reserves (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  color text default '#e11d48' not null,
  icon text default 'PiggyBank' not null,
  saldo_inicial numeric(10, 2) default 0.00 not null,
  status text check (status in ('active', 'inactive')) default 'active' not null,
  regra_tipo text check (regra_tipo in ('km', 'bruto', 'liquido', 'fixo', 'personalizado')),
  regra_valor numeric(12, 4),
  regra_categorias text[],
  regra_base text check (regra_base in ('bruto', 'liquido', 'lucro')),
  regra_ativa boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativa RLS
alter table reserves enable row level security;

-- Políticas RLS para reserves
create policy "Users can view their own reserves"
  on reserves for select
  using (auth.uid() = user_id);

create policy "Users can insert their own reserves"
  on reserves for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own reserves"
  on reserves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own reserves"
  on reserves for delete
  using (auth.uid() = user_id);


-- Cria a tabela reserve_transactions
create table reserve_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  reserve_id uuid references reserves(id) on delete cascade not null,
  type text not null check (type in ('aporte', 'utilizacao')),
  amount numeric(10, 2) not null check (amount > 0),
  date date not null default current_date,
  category text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativa RLS
alter table reserve_transactions enable row level security;

-- Políticas RLS para reserve_transactions
create policy "Users can view their own reserve transactions"
  on reserve_transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own reserve transactions"
  on reserve_transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own reserve transactions"
  on reserve_transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own reserve transactions"
  on reserve_transactions for delete
  using (auth.uid() = user_id);

