import { FreightQuote, DriverFreightPreset, VehicleType, VehicleConfigItem, FreightClient } from '../types/freight';
import { supabase } from './supabase';

const STORAGE_KEY_PREFIX = 'financas_pro_freight_quotes_';
const PRESET_KEY_PREFIX = 'financas_pro_freight_preset_';
const CLIENTS_KEY_PREFIX = 'financas_pro_freight_clients_';

export const DEFAULT_TERMS = 
  '• Orçamento válido por 48 horas a partir da emissão.\n' +
  '• Inclui tempo de espera de até 15 minutos na coleta e na entrega.\n' +
  '• Carga transportada com total zelo, segurança e amarração adequada.\n' +
  '• Cancelamentos com menos de 1 hora da partida estão sujeitos a taxa de deslocamento.';

export const DEFAULT_VEHICLES: VehicleConfigItem[] = [
  {
    id: 'moto',
    label: 'Motocicleta (Frete Express)',
    iconName: 'Bike',
    defaultPriceKm: 2.80,
    defaultBase: 12.00,
    maxWeight: 'Até 20kg (Baú / Mochila)',
    desc: 'Documentos, pequenos pacotes, entregas rápidas e urgentes',
    is_custom: false,
  },
];

export const DEFAULT_PRESET: DriverFreightPreset = {
  driver_name: '',
  driver_phone: '',
  driver_company: '',
  driver_document: '',
  pix_key: '',
  pix_key_type: 'phone',
  default_vehicle: 'moto',
  default_price_per_km: 2.80,
  default_base_fee: 12.00,
  default_maintenance_per_km: 0.25,
  default_stop_fee: 6.00,
  default_terms: DEFAULT_TERMS,
  default_payment_method: 'pix',
  vehicles: DEFAULT_VEHICLES,
};

// Map legacy object to array or function
export const VEHICLE_PRESETS: Record<string, VehicleConfigItem> = DEFAULT_VEHICLES.reduce((acc, v) => {
  acc[v.id] = v;
  return acc;
}, {} as Record<string, VehicleConfigItem>);

export const freightStorage = {
  // QUOTES
  getQuotes(userId: string = 'default'): FreightQuote[] {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Erro ao ler orçamentos de frete:', e);
      return [];
    }
  },

  async syncQuotesFromDatabase(userId: string = 'default'): Promise<FreightQuote[]> {
    try {
      const { data, error } = await supabase
        .from('freight_quotes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(data));
        return data as FreightQuote[];
      }
    } catch (err) {
      console.warn('[freightStorage] Supabase sync fallback:', err);
    }
    return this.getQuotes(userId);
  },

  saveQuote(quote: FreightQuote, userId: string = 'default'): FreightQuote {
    const list = this.getQuotes(userId);
    const existingIndex = list.findIndex(q => q.id === quote.id);
    let updated: FreightQuote[];
    
    if (existingIndex >= 0) {
      updated = [...list];
      updated[existingIndex] = { ...quote };
    } else {
      updated = [quote, ...list];
    }

    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Erro ao salvar orçamento de frete:', e);
    }

    // Auto save client
    if (quote.client_name?.trim()) {
      this.autoSaveClient({
        id: quote.client_name.trim().toLowerCase().replace(/\s+/g, '_'),
        name: quote.client_name.trim(),
        phone: quote.client_phone?.trim(),
        company: quote.client_company?.trim(),
        document: quote.client_document?.trim(),
        email: quote.client_email?.trim(),
      }, userId);
    }

    // Async save to Supabase
    (async () => {
      try {
        await supabase
          .from('freight_quotes')
          .upsert({
            ...quote,
            user_id: userId,
          });
      } catch (err) {
        console.warn('[freightStorage] Supabase save exception:', err);
      }
    })();

    return quote;
  },

  deleteQuote(id: string, userId: string = 'default'): void {
    const list = this.getQuotes(userId);
    const updated = list.filter(q => q.id !== id);
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Erro ao excluir orçamento:', e);
    }

    // Async delete from Supabase
    (async () => {
      try {
        await supabase
          .from('freight_quotes')
          .delete()
          .eq('id', id);
      } catch (err) {
        console.warn('[freightStorage] Supabase delete exception:', err);
      }
    })();
  },

  updateQuoteStatus(id: string, status: FreightQuote['status'], userId: string = 'default'): FreightQuote | null {
    const list = this.getQuotes(userId);
    const target = list.find(q => q.id === id);
    if (!target) return null;

    const updatedQuote: FreightQuote = {
      ...target,
      status,
    };

    this.saveQuote(updatedQuote, userId);
    return updatedQuote;
  },

  // PRESETS & DRIVER CONFIGS
  getPreset(userId: string = 'default'): DriverFreightPreset {
    try {
      const raw = localStorage.getItem(`${PRESET_KEY_PREFIX}${userId}`);
      if (!raw) return DEFAULT_PRESET;
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PRESET,
        ...parsed,
        vehicles: parsed.vehicles && parsed.vehicles.length > 0 ? parsed.vehicles : DEFAULT_VEHICLES,
      };
    } catch (e) {
      return DEFAULT_PRESET;
    }
  },

  async syncPresetFromDatabase(userId: string = 'default'): Promise<DriverFreightPreset> {
    try {
      const { data, error } = await supabase
        .from('freight_presets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        const preset: DriverFreightPreset = {
          driver_name: data.driver_name || '',
          driver_phone: data.driver_phone || '',
          driver_company: data.driver_company || '',
          driver_document: data.driver_document || '',
          pix_key: data.pix_key || '',
          pix_key_type: data.pix_key_type || 'phone',
          default_vehicle: data.default_vehicle || 'moto',
          default_price_per_km: data.default_price_per_km ?? 2.80,
          default_base_fee: data.default_base_fee ?? 12.00,
          default_maintenance_per_km: data.default_maintenance_per_km ?? 0.25,
          default_stop_fee: data.default_stop_fee ?? 6.00,
          default_terms: data.default_terms || DEFAULT_TERMS,
          default_payment_method: data.default_payment_method || 'pix',
          vehicles: Array.isArray(data.vehicles) && data.vehicles.length > 0 ? data.vehicles : DEFAULT_VEHICLES,
        };
        localStorage.setItem(`${PRESET_KEY_PREFIX}${userId}`, JSON.stringify(preset));
        return preset;
      }
    } catch (err) {
      console.warn('[freightStorage] Supabase preset sync fallback:', err);
    }
    return this.getPreset(userId);
  },

  savePreset(preset: Partial<DriverFreightPreset>, userId: string = 'default'): DriverFreightPreset {
    const current = this.getPreset(userId);
    const merged: DriverFreightPreset = { 
      ...current, 
      ...preset,
      vehicles: preset.vehicles && preset.vehicles.length > 0 ? preset.vehicles : (current.vehicles || DEFAULT_VEHICLES),
    };

    try {
      localStorage.setItem(`${PRESET_KEY_PREFIX}${userId}`, JSON.stringify(merged));
    } catch (e) {
      console.error('Erro ao salvar preset do motorista:', e);
    }

    // Async save to Supabase
    (async () => {
      try {
        await supabase
          .from('freight_presets')
          .upsert({
            user_id: userId,
            driver_name: merged.driver_name,
            driver_phone: merged.driver_phone,
            driver_company: merged.driver_company,
            driver_document: merged.driver_document,
            pix_key: merged.pix_key,
            pix_key_type: merged.pix_key_type,
            default_vehicle: merged.default_vehicle,
            default_price_per_km: merged.default_price_per_km,
            default_base_fee: merged.default_base_fee,
            default_maintenance_per_km: merged.default_maintenance_per_km,
            default_stop_fee: merged.default_stop_fee,
            default_terms: merged.default_terms,
            default_payment_method: merged.default_payment_method,
            vehicles: merged.vehicles,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      } catch (err) {
        console.warn('[freightStorage] Supabase preset save exception:', err);
      }
    })();

    return merged;
  },

  // CLIENTS & AUTOCOMPLETE
  getClients(userId: string = 'default'): FreightClient[] {
    try {
      const raw = localStorage.getItem(`${CLIENTS_KEY_PREFIX}${userId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  async syncClientsFromDatabase(userId: string = 'default'): Promise<FreightClient[]> {
    try {
      const { data, error } = await supabase
        .from('freight_clients')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (!error && data) {
        localStorage.setItem(`${CLIENTS_KEY_PREFIX}${userId}`, JSON.stringify(data));
        return data as FreightClient[];
      }
    } catch (err) {
      console.warn('[freightStorage] Supabase clients sync fallback:', err);
    }
    return this.getClients(userId);
  },

  autoSaveClient(client: Partial<FreightClient> & { name: string }, userId: string = 'default'): FreightClient {
    const list = this.getClients(userId);
    const existingIndex = list.findIndex(
      c => c.name.toLowerCase().trim() === client.name.toLowerCase().trim()
    );

    const updatedClient: FreightClient = {
      id: existingIndex >= 0 ? list[existingIndex].id : (client.id || `cli_${Date.now()}`),
      user_id: userId,
      name: client.name.trim(),
      phone: client.phone?.trim() || (existingIndex >= 0 ? list[existingIndex].phone : ''),
      company: client.company?.trim() || (existingIndex >= 0 ? list[existingIndex].company : ''),
      document: client.document?.trim() || (existingIndex >= 0 ? list[existingIndex].document : ''),
      email: client.email?.trim() || (existingIndex >= 0 ? list[existingIndex].email : ''),
      updated_at: new Date().toISOString(),
    };

    let newList: FreightClient[];
    if (existingIndex >= 0) {
      newList = [...list];
      newList[existingIndex] = updatedClient;
    } else {
      newList = [updatedClient, ...list];
    }

    try {
      localStorage.setItem(`${CLIENTS_KEY_PREFIX}${userId}`, JSON.stringify(newList));
    } catch (e) {
      console.error('Erro ao salvar cliente local:', e);
    }

    // Async save to Supabase
    (async () => {
      try {
        await supabase
          .from('freight_clients')
          .upsert({
            ...updatedClient,
            user_id: userId,
          });
      } catch (err) {
        console.warn('[freightStorage] Supabase client save exception:', err);
      }
    })();

    return updatedClient;
  },

  deleteClient(id: string, userId: string = 'default'): void {
    const list = this.getClients(userId);
    const updated = list.filter(c => c.id !== id);
    try {
      localStorage.setItem(`${CLIENTS_KEY_PREFIX}${userId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Erro ao excluir cliente:', e);
    }

    (async () => {
      try {
        await supabase
          .from('freight_clients')
          .delete()
          .eq('id', id);
      } catch (err) {
        console.warn('[freightStorage] Supabase client delete exception:', err);
      }
    })();
  },

  // VEHICLES MANAGE
  getVehicles(userId: string = 'default'): VehicleConfigItem[] {
    const preset = this.getPreset(userId);
    return preset.vehicles && preset.vehicles.length > 0 ? preset.vehicles : DEFAULT_VEHICLES;
  },

  generateNextCode(userId: string = 'default'): string {
    const year = new Date().getFullYear();
    const list = this.getQuotes(userId);
    const thisYearQuotes = list.filter(q => q.code && q.code.includes(`FRT-${year}-`));
    const nextSeq = thisYearQuotes.length + 1;
    const padded = String(nextSeq).padStart(4, '0');
    return `FRT-${year}-${padded}`;
  },

  formatWhatsAppMessage(quote: FreightQuote, userId: string = 'default'): string {
    const vehiclesList = this.getVehicles(userId);
    const vMatch = vehiclesList.find(v => v.id === quote.vehicle_type);
    const vehicleLabel = vMatch ? vMatch.label : (VEHICLE_PRESETS[quote.vehicle_type]?.label || quote.vehicle_type);
    
    const formatBRL = (val: number) => 
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const stopsCount = quote.additional_stops?.length || 0;
    const validUntilDate = quote.valid_until 
      ? new Date(quote.valid_until).toLocaleDateString('pt-BR') 
      : '48 horas';

    let msg = `📦 *ORÇAMENTO DE FRETE / TRANSPORTE*\n`;
    msg += `📄 *Ref.:* ${quote.code}\n`;
    msg += `📅 *Data da Emissão:* ${new Date(quote.created_at).toLocaleDateString('pt-BR')}\n`;
    msg += `─────────────────────────\n\n`;

    msg += `👤 *Cliente:* ${quote.client_name || 'Prezado(a) Cliente'}\n`;
    if (quote.client_company) {
      msg += `🏢 *Empresa:* ${quote.client_company}\n`;
    }
    msg += `🛵 *Veículo:* Motocicleta (Frete Express)\n`;
    msg += `📋 *Carga:* ${quote.cargo_description || 'Volumes diversos'}\n`;

    if (quote.scheduled_date) {
      const formattedDate = new Date(quote.scheduled_date + 'T00:00:00').toLocaleDateString('pt-BR');
      msg += `🗓️ *Data do Frete:* ${formattedDate}${quote.scheduled_time ? ` às ${quote.scheduled_time}` : ''}\n`;
    } else if (quote.scheduled_time) {
      msg += `⏰ *Horário do Frete:* ${quote.scheduled_time}\n`;
    }

    msg += `\n📍 *ROTA & DETALHES*\n`;
    msg += `🟢 *Coleta:* ${quote.origin_address}${quote.origin_neighborhood ? ` - ${quote.origin_neighborhood}` : ''}\n`;
    
    if (stopsCount > 0) {
      quote.additional_stops.forEach((stop, idx) => {
        msg += `🟡 *Parada ${idx + 1}:* ${stop.address}${stop.neighborhood ? ` - ${stop.neighborhood}` : ''}\n`;
      });
    }

    msg += `🔴 *Entrega:* ${quote.destination_address}${quote.destination_neighborhood ? ` - ${quote.destination_neighborhood}` : ''}\n`;
    msg += `🛣️ *Distância Total:* ${quote.total_calculated_km.toFixed(1)} km ${quote.is_round_trip ? '(Ida e Volta)' : '(Apenas Ida)'}\n\n`;

    msg += `💰 *INVESTIMENTO & CONDIÇÕES*\n`;
    if (quote.discount && quote.discount > 0) {
      const originalSubtotal = quote.total_price + quote.discount;
      msg += `🏷️ *Subtotal:* ~${formatBRL(originalSubtotal)}~\n`;
      if (quote.discount_type === 'total_fixed') {
        msg += `🎯 *Ajuste (Valor Fechado):* -${formatBRL(quote.discount)}\n`;
      } else if (quote.discount_type === 'percent') {
        msg += `🎉 *Desconto (${quote.discount_value}%):* -${formatBRL(quote.discount)}\n`;
      } else {
        msg += `🎉 *Desconto Fixo:* -${formatBRL(quote.discount)}\n`;
      }
    }
    msg += `💵 *VALOR FINAL: ${formatBRL(quote.total_price)}*\n`;
    
    const paymentLabels: Record<string, string> = {
      pix: 'PIX (À Vista / Chave Direta)',
      dinheiro: 'Dinheiro na Entrega',
      cartao_credito: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito',
      faturado_15d: 'Boleto / Faturado 15 Dias',
      faturado_30d: 'Boleto / Faturado 30 Dias',
      '50_50': '50% no Carregamento + 50% na Entrega',
    };
    msg += `💳 *Forma de Pagamento:* ${paymentLabels[quote.payment_method] || quote.payment_method}\n`;

    if (quote.pix_key) {
      msg += `🔑 *Chave PIX:* ${quote.pix_key} (${quote.pix_key_type.toUpperCase()})\n`;
    }

    msg += `⏳ *Validade da Proposta:* até ${validUntilDate}\n\n`;

    if (quote.observations?.trim()) {
      msg += `ℹ️ *Observações:* ${quote.observations.trim()}\n\n`;
    }

    msg += `─────────────────────────\n`;
    msg += `✨ *Para aprovar o frete e agendar seu horário, basta responder com "APROVADO"!*\n\n`;
    msg += `👤 *Prestador:* ${quote.driver_name || 'Transportador Especializado'}\n`;
    if (quote.driver_phone) {
      msg += `📱 *Contato:* ${quote.driver_phone}\n`;
    }

    return msg;
  }
};
