export type VehicleType = 'moto' | string;

export type ServiceType = 'express' | 'same_day' | 'scheduled' | 'multi_stop' | 'hourly';

export type FreightQuoteStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'completed';

export type PaymentMethod = 
  | 'pix' 
  | 'dinheiro' 
  | 'cartao_credito' 
  | 'cartao_debito' 
  | 'faturado_15d' 
  | 'faturado_30d' 
  | '50_50';

export interface RouteStop {
  id: string;
  address: string;
  neighborhood?: string;
  notes?: string;
}

export interface VehicleConfigItem {
  id: string;
  label: string;
  plate?: string;
  type?: 'moto' | 'car' | 'van' | 'truck' | string;
  iconName?: 'Bike' | 'Car' | 'Truck' | string;
  maxWeight: string;
  desc?: string;
  defaultPriceKm: number;
  defaultBase: number;
  stopFee?: number;
  kmPerLiter?: number;
  maintenancePerKm?: number;
  isDefault?: boolean;
  is_custom?: boolean;
}

export interface FreightClient {
  id: string;
  user_id?: string;
  name: string;
  phone?: string;
  company?: string;
  document?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FreightQuote {
  id: string;
  user_id: string;
  code: string; // Ex: FRT-2026-0001
  created_at: string;
  valid_until: string;
  status: FreightQuoteStatus;
  
  // Cliente
  client_name: string;
  client_phone: string; // WhatsApp
  client_company?: string;
  client_document?: string; // CPF / CNPJ
  client_email?: string;

  // Prestador / Emissor
  driver_name: string;
  driver_phone: string;
  driver_company?: string;
  driver_document?: string;
  pix_key: string;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

  // Rota e Logística
  vehicle_type: VehicleType;
  vehicle_label?: string; // Nome personalizado do veículo
  vehicle_capacity?: string; // Capacidade de carga (Até 50Kg Bauleto / amarração)
  service_type: ServiceType;
  origin_address: string;
  origin_neighborhood?: string;
  origin_city?: string;
  destination_address: string;
  destination_neighborhood?: string;
  destination_city?: string;
  additional_stops: RouteStop[];
  distance_km: number;
  is_round_trip: boolean; // Cobrar volta / retorno
  total_calculated_km: number;

  // Agendamento
  cargo_description?: string;
  cargo_weight_kg?: number;
  cargo_volume?: string;
  cargo_value?: number;
  scheduled_date?: string;
  scheduled_time?: string; // Horário do frete (Opcional)
  expected_payment_date?: string; // Previsão de recebimento (Opcional)

  // Precificação e Parâmetros
  base_fee: number; // Saída / Bandeirada (Padrão R$ 15,00)
  price_per_km: number; // Preço por KM (Padrão R$ 0,80)
  extra_stops_fee: number; // Parada extra (Padrão R$ 6,00)
  heavy_cargo_fee: number; // Taxa de peso / ajudante
  stairs_floor_fee: number; // Taxa de escadas / carregamento
  urgent_or_rain_fee: number; // Taxa de urgência / clima
  night_fee: number; // Adicional noturno
  tolls_fee: number; // Pedágios
  waiting_hours_fee: number; // Hora parada / espera
  discount: number; // Desconto concedido (valor R$ final calculado)
  discount_type?: 'fixed' | 'percent' | 'total_fixed'; // Tipo de desconto ('fixed' = R$, 'percent' = %, 'total_fixed' = Valor Total Fechado)
  discount_value?: number; // Valor bruto inserido

  // Custos Reais do Motorista (Visão Privada)
  fuel_price: number;
  km_per_liter: number;
  maintenance_cost_per_km: number;
  estimated_fuel_cost: number;
  estimated_maintenance_cost: number;
  total_driver_cost: number;

  // Resultados Finais
  total_price: number; // Valor final para o cliente
  driver_net_profit: number; // Lucro líquido do motorista
  profit_margin_percent: number; // Margem de lucro (%)

  // Condições e Observações
  payment_method: PaymentMethod;
  observations?: string;
  terms_and_conditions?: string;
  is_client_preset?: boolean;

  // Integração com o Financeiro
  converted_to_transaction_id?: string;
  converted_at?: string;
}

export interface DriverFreightPreset {
  driver_name: string;
  driver_phone: string;
  driver_company: string;
  driver_document: string;
  pix_key: string;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  default_vehicle: VehicleType;
  default_vehicle_label?: string; // Motocicleta (Frete Express)
  default_vehicle_capacity?: string; // Até 50Kg (Bauleto / amarração)
  default_vehicle_desc?: string;
  default_vehicle_icon?: 'Bike' | 'Car' | 'Truck' | string;
  default_km_per_liter?: number; // Consumo médio (obtido do perfil)
  default_price_per_km: number; // R$ 0,80
  default_base_fee: number; // R$ 15,00
  default_maintenance_per_km: number; // Obtido da reserva de manutenção
  default_stop_fee: number; // R$ 6,00
  default_terms: string;
  default_payment_method: PaymentMethod;
  vehicles?: VehicleConfigItem[];
}

