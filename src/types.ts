export type TransactionType = 'income' | 'expense';

export type PaymentStatus = 'paid' | 'pending';

export type RecurrenceFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  date: string; // ISO format YYYY-MM-DD
  category: string;
  description?: string;
  start_km?: number | null;
  end_km?: number | null;
  deliveries?: number | null;
  out_of_neighborhood?: number | null;
  is_reserve_use?: boolean;
  notes?: string;
  dividend_id?: string;
  isInvestmentTx?: boolean;
  isReserveAporte?: boolean;
  isDividendTx?: boolean;

  // Status de Pagamento e Vencimento
  payment_status?: PaymentStatus;
  payment_date?: string | null;
  due_date?: string | null;

  // Sistema de Recorrência e Parcelamento
  is_recurring?: boolean;
  recurrence_frequency?: RecurrenceFrequency;
  recurrence_installments?: number | null;
  recurrence_group_id?: string | null;
  installment_number?: number | null;
  installment_total?: number | null;
  installment_index?: number | null;
  total_installments?: number | null;

  // Vínculo com Garagem / Veículo
  vehicle_id?: string;
  fuel_liters?: number | null;
  fuel_price_per_liter?: number | null;
  fuel_station?: string;
  refuel_km?: number | null;

  created_at?: string;
}

export interface UserSettings {
  user_id: string;
  full_name?: string;
  is_admin?: boolean;
  active_vehicle_id?: string;
  pizzaria_base_deliveries: number;
  pizzaria_base_rate: number;
  pizzaria_daily_rate_above_base: number;
  pizzaria_delivery_rate: number;
  pizzaria_out_of_neighborhood_rate: number;
  expense_categories?: string[];
  operational_expense_categories?: string[];
  personal_expense_categories?: string[];
  income_categories?: string[];
  vehicle_categories?: string[];
  vehicle_km_per_liter?: number;
  fuel_price?: number;
  initial_balance?: number;
  categories_with_km?: string[];
  category_icons?: Record<string, string>;
  default_investment_reserve_id?: string;
  cached_quotes?: Record<string, number>;
  quote_provider?: 'auto' | 'brapi' | 'yahoo' | 'hgbrasil' | 'mfinance';
  brapi_token?: string;
  asset_cnpjs?: Record<string, string>;
  rebalance_targets?: Record<string, number>;
  weekly_goal?: number;
  weekly_net_goal?: number;
  default_driver_labor?: number;
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  incomeTrend: number;   // percentage vs last month
  expenseTrend: number;  // percentage vs last month
  profitTrend: number;   // percentage vs last month
}

export interface Reserve {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  saldo_inicial: number;
  saldo_atual?: number;
  meta_objetivo?: number | null;
  status: 'active' | 'inactive';
  regra_tipo?: 'km' | 'bruto' | 'liquido' | 'fixo' | 'personalizado' | null;
  regra_valor?: number;
  regra_categorias?: string[];
  regra_base?: 'bruto' | 'liquido' | 'lucro';
  regra_ativa?: boolean;
  require_category_on_use?: boolean;
  default_use_category?: string;
  rule_history?: any[];
  is_paused?: boolean;
  regra_inicio_validade?: string;
  created_at?: string;
  updated_at?: string;
}

export type ReserveTransactionType = 'aporte' | 'utilizacao' | 'rendimento';

export interface ReserveTransaction {
  id: string;
  user_id: string;
  reserve_id: string;
  type: ReserveTransactionType;
  amount: number;
  date: string; // YYYY-MM-DD
  category?: string; // used in 'utilizacao'
  description?: string;
  linked_investment_id?: string;
  transaction_id?: string;
  source?: 'manual' | 'mass_contribution' | 'automation' | 'investment';
  batch_id?: string;

  // Status de Pagamento e Vencimento
  payment_status?: PaymentStatus;
  payment_date?: string | null;
  due_date?: string | null;

  // Sistema de Recorrência e Parcelamento
  is_recurring?: boolean;
  recurrence_frequency?: RecurrenceFrequency;
  recurrence_installments?: number | null;
  recurrence_group_id?: string | null;
  installment_number?: number | null;
  installment_total?: number | null;
  installment_index?: number | null;
  total_installments?: number | null;

  // Vínculo com Garagem / Veículo
  vehicle_id?: string;

  created_at?: string;
}

export type InvestmentType = 'Ação' | 'FII' | 'BDR' | 'ETF' | 'Renda Fixa' | 'Cripto' | string;

export interface InvestmentTransaction {
  id: string;
  user_id: string;
  operation: 'buy' | 'sell';
  type: InvestmentType;
  ticker: string;
  cnpj?: string;
  amount: number;
  price: number;
  quantity: number;
  costs?: number;
  reserve_id?: string;
  transaction_id?: string;
  date: string;
  description?: string;
  asset_type?: string;
  created_at?: string;
}

export type DividendType = 'Dividendo' | 'JCP' | 'Rendimento';
export type DividendStatus = 'received' | 'provisioned';
export type DividendAnalysisMode = 'received_only' | 'include_provisioned';

export interface Dividend {
  id: string;
  user_id: string;
  ticker: string;
  amount: number;
  unit_amount?: number;
  type: DividendType;
  status: DividendStatus;
  date: string; // Payment date
  data_com?: string;
  data_ex?: string;
  description?: string;
  transaction_id?: string;
  created_at?: string;
}

export interface ValuationTarget {
  id?: string;
  user_id?: string;
  ticker: string;
  asset_type?: 'Ação' | 'FII';
  cnpj?: string;
  calc_current_price?: number;
  targetPrice?: number;
  notes?: string;
  bazin_dpa?: number;
  bazin_target_yield?: number;
  graham_lpa?: number;
  graham_vpa?: number;
  gordon_d1?: number;
  gordon_k?: number;
  gordon_g?: number;
  pl_target?: number;
  pvp_target?: number;
  updated_at?: string;
}

export interface Vehicle {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  version?: string;
  year_manufacture?: number;
  year_model: number;
  color?: string;
  plate?: string;
  renavam?: string;
  chassis?: string;
  acquisition_date?: string;
  acquisition_value?: number;
  acquisition_type?: string;
  notes?: string;
  current_km: number;
  avg_km_per_liter?: number;
  fuel_type?: string;
  is_active?: boolean;
  photo_url?: string;
  fipe_code?: string;
  fipe_value?: number;
  fipe_updated_at?: string;
  fipe_ref_month?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VehicleFipeHistory {
  id: string;
  user_id: string;
  vehicle_id: string;
  fipe_code: string;
  fipe_value: number;
  ref_month: string;
  fetched_at: string;
  created_at?: string;
}

export interface VehicleOdometerLog {
  id: string;
  user_id: string;
  vehicle_id: string;
  date: string;
  km: number;
  notes?: string;
  source?: 'manual' | 'abastecimento' | 'manutencao' | 'frete';
  created_at?: string;
}

export type MaintenanceType =
  | 'Óleo'
  | 'Filtro de Óleo'
  | 'Filtro de Ar'
  | 'Pneus'
  | 'Relação'
  | 'Freios / Pastilhas'
  | 'Vela'
  | 'Bateria'
  | 'Suspensão'
  | 'Motor'
  | 'Elétrica'
  | 'Revisão Geral'
  | 'Outros';

export interface VehicleMaintenanceRecord {
  id: string;
  user_id: string;
  vehicle_id: string;
  type: MaintenanceType | string;
  description?: string;
  last_service_date?: string;
  last_service_km?: number;
  cost?: number;
  workshop?: string;
  next_due_date?: string;
  next_due_km?: number;
  status?: 'ok' | 'warning' | 'overdue' | 'completed';
  notes?: string;
  created_at?: string;
}

