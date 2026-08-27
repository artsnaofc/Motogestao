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
    maxWeight: 'Até 20kg (Baú / Mochila)',
    desc: 'Documentos, pequenos pacotes, entregas rápidas e urgentes',
    defaultBase: 12.00,
    defaultPriceKm: 2.80,
    stopFee: 6.00,
    kmPerLiter: 35,
    maintenancePerKm: 0.25,
    isDefault: true,
    is_custom: false,
  },
  {
    id: 'fiorino',
    label: 'Utilitário / Fiorino / Furgão',
    iconName: 'Car',
    maxWeight: 'Até 650kg (3.2 m³)',
    desc: 'Caixas volumosas, pequenas mudanças, equipamentos e paletes',
    defaultBase: 40.00,
    defaultPriceKm: 4.50,
    stopFee: 15.00,
    kmPerLiter: 11,
    maintenancePerKm: 0.55,
    isDefault: false,
    is_custom: true,
  },
  {
    id: 'van',
    label: 'Van de Carga / Furgão Grande',
    iconName: 'Truck',
    maxWeight: 'Até 1.500kg (10 m³)',
    desc: 'Grandes cargas fracionadas, mudanças comerciais e móveis',
    defaultBase: 80.00,
    defaultPriceKm: 6.50,
    stopFee: 25.00,
    kmPerLiter: 8.5,
    maintenancePerKm: 0.85,
    isDefault: false,
    is_custom: true,
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
  default_vehicle_label: 'Motocicleta (Frete Express)',
  default_vehicle_capacity: 'Até 20kg (Baú / Mochila)',
  default_vehicle_desc: 'Documentos, pequenos pacotes, entregas rápidas e urgentes',
  default_vehicle_icon: 'Bike',
  default_km_per_liter: 35,
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

/**
 * Resolves the authenticated Supabase user ID if available
 */
async function getEffectiveUserId(fallbackId: string = 'default'): Promise<string> {
  if (fallbackId && fallbackId !== 'default' && fallbackId.length > 5) {
    return fallbackId;
  }
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) {
      return data.user.id;
    }
  } catch (e) {
    // fallback
  }
  return fallbackId || 'default';
}

export const freightStorage = {
  // QUOTES
  getQuotes(userId: string = 'default'): FreightQuote[] {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
      if (!raw) {
        if (userId !== 'default') {
          const fallbackRaw = localStorage.getItem(`${STORAGE_KEY_PREFIX}default`);
          if (fallbackRaw) {
            const parsedFallback = JSON.parse(fallbackRaw);
            return Array.isArray(parsedFallback) ? parsedFallback : [];
          }
        }
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Erro ao ler orçamentos de frete:', e);
      return [];
    }
  },

  async syncQuotesFromDatabase(userId: string = 'default'): Promise<FreightQuote[]> {
    try {
      const effectiveId = await getEffectiveUserId(userId);
      const query = supabase
        .from('freight_quotes')
        .select('*');

      if (effectiveId && effectiveId !== 'default') {
        query.eq('user_id', effectiveId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.warn('[freightStorage] Supabase sync error for freight_quotes:', error.message);
      } else if (data) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(data));
        if (effectiveId !== userId) {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}${effectiveId}`, JSON.stringify(data));
        }
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

    // Async save to Supabase with precise payload mapping
    (async () => {
      try {
        const effectiveId = await getEffectiveUserId(userId);
        const quotePayload = {
          id: quote.id,
          user_id: effectiveId,
          code: quote.code,
          created_at: quote.created_at || new Date().toISOString(),
          valid_until: quote.valid_until || null,
          status: quote.status || 'pending',

          client_name: quote.client_name || 'Cliente',
          client_phone: quote.client_phone || '',
          client_company: quote.client_company || '',
          client_document: quote.client_document || '',
          client_email: quote.client_email || '',

          driver_name: quote.driver_name || '',
          driver_phone: quote.driver_phone || '',
          driver_company: quote.driver_company || '',
          driver_document: quote.driver_document || '',
          pix_key: quote.pix_key || '',
          pix_key_type: quote.pix_key_type || 'phone',

          vehicle_type: quote.vehicle_type || 'moto',
          vehicle_label: quote.vehicle_label || '',
          vehicle_capacity: quote.vehicle_capacity || '',
          service_type: quote.service_type || 'express',
          origin_address: quote.origin_address,
          origin_neighborhood: quote.origin_neighborhood || '',
          origin_city: quote.origin_city || '',
          destination_address: quote.destination_address,
          destination_neighborhood: quote.destination_neighborhood || '',
          destination_city: quote.destination_city || '',
          additional_stops: quote.additional_stops || [],
          distance_km: Number(quote.distance_km) || 0,
          is_round_trip: Boolean(quote.is_round_trip),
          total_calculated_km: Number(quote.total_calculated_km) || 0,

          cargo_description: quote.cargo_description || '',
          cargo_weight_kg: quote.cargo_weight_kg !== undefined ? Number(quote.cargo_weight_kg) : null,
          cargo_volume: quote.cargo_volume || null,
          cargo_value: quote.cargo_value !== undefined ? Number(quote.cargo_value) : null,
          scheduled_date: quote.scheduled_date || null,
          scheduled_time: quote.scheduled_time || null,
          expected_payment_date: quote.expected_payment_date || null,

          base_fee: Number(quote.base_fee) || 0,
          price_per_km: Number(quote.price_per_km) || 0,
          extra_stops_fee: Number(quote.extra_stops_fee) || 0,
          heavy_cargo_fee: Number(quote.heavy_cargo_fee) || 0,
          stairs_floor_fee: Number(quote.stairs_floor_fee) || 0,
          urgent_or_rain_fee: Number(quote.urgent_or_rain_fee) || 0,
          night_fee: Number(quote.night_fee) || 0,
          tolls_fee: Number(quote.tolls_fee) || 0,
          waiting_hours_fee: Number(quote.waiting_hours_fee) || 0,
          discount: Number(quote.discount) || 0,
          discount_type: quote.discount_type || 'fixed',
          discount_value: Number(quote.discount_value) || 0,

          fuel_price: Number(quote.fuel_price) || 0,
          km_per_liter: Number(quote.km_per_liter) || 0,
          maintenance_cost_per_km: Number(quote.maintenance_cost_per_km) || 0,
          estimated_fuel_cost: Number(quote.estimated_fuel_cost) || 0,
          estimated_maintenance_cost: Number(quote.estimated_maintenance_cost) || 0,
          total_driver_cost: Number(quote.total_driver_cost) || 0,

          total_price: Number(quote.total_price) || 0,
          driver_net_profit: Number(quote.driver_net_profit) || 0,
          profit_margin_percent: Number(quote.profit_margin_percent) || 0,

          payment_method: quote.payment_method || 'pix',
          observations: quote.observations || '',
          terms_and_conditions: quote.terms_and_conditions || '',
          converted_to_transaction_id: quote.converted_to_transaction_id || null,
          converted_at: quote.converted_at || null,
        };

        const { error } = await supabase
          .from('freight_quotes')
          .upsert(quotePayload);

        if (error) {
          console.warn('[freightStorage] Supabase save error for freight_quotes:', error.message, error.details);
        } else {
          console.log(`[freightStorage] Quote ${quote.code} successfully saved to Supabase.`);
        }
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
        const { error } = await supabase
          .from('freight_quotes')
          .delete()
          .eq('id', id);

        if (error) {
          console.warn('[freightStorage] Supabase delete error for freight_quotes:', error.message);
        }
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
      let raw = localStorage.getItem(`${PRESET_KEY_PREFIX}${userId}`);
      if (!raw && userId !== 'default') {
        raw = localStorage.getItem(`${PRESET_KEY_PREFIX}default`);
      }
      if (!raw) return DEFAULT_PRESET;
      const parsed = JSON.parse(raw);

      const rawVehicles: VehicleConfigItem[] = Array.isArray(parsed.vehicles) && parsed.vehicles.length > 0
        ? parsed.vehicles
        : DEFAULT_VEHICLES;

      // Find active default vehicle
      const defaultVehId = parsed.default_vehicle || rawVehicles.find(v => v.isDefault)?.id || rawVehicles[0]?.id || 'moto';
      const activeVehicle = rawVehicles.find(v => v.id === defaultVehId) || rawVehicles[0] || DEFAULT_VEHICLES[0];

      const vehicleLabel = parsed.default_vehicle_label || activeVehicle.label || DEFAULT_PRESET.default_vehicle_label;
      const vehicleCapacity = parsed.default_vehicle_capacity || activeVehicle.maxWeight || DEFAULT_PRESET.default_vehicle_capacity;
      const vehicleDesc = parsed.default_vehicle_desc || activeVehicle.desc || DEFAULT_PRESET.default_vehicle_desc;
      const vehicleIcon = parsed.default_vehicle_icon || activeVehicle.iconName || DEFAULT_PRESET.default_vehicle_icon;

      const normalizedVehicles = rawVehicles.map(v => ({
        ...v,
        isDefault: v.id === defaultVehId,
      }));

      return {
        ...DEFAULT_PRESET,
        ...parsed,
        default_vehicle: defaultVehId,
        default_vehicle_label: vehicleLabel,
        default_vehicle_capacity: vehicleCapacity,
        default_vehicle_desc: vehicleDesc,
        default_vehicle_icon: vehicleIcon,
        default_km_per_liter: activeVehicle.kmPerLiter ?? parsed.default_km_per_liter ?? 35,
        default_price_per_km: activeVehicle.defaultPriceKm ?? parsed.default_price_per_km ?? 2.80,
        default_base_fee: activeVehicle.defaultBase ?? parsed.default_base_fee ?? 12.00,
        default_maintenance_per_km: activeVehicle.maintenancePerKm ?? parsed.default_maintenance_per_km ?? 0.25,
        default_stop_fee: activeVehicle.stopFee ?? parsed.default_stop_fee ?? 6.00,
        vehicles: normalizedVehicles,
      };
    } catch (e) {
      return DEFAULT_PRESET;
    }
  },

  async syncPresetFromDatabase(userId: string = 'default'): Promise<DriverFreightPreset> {
    try {
      const effectiveId = await getEffectiveUserId(userId);
      const { data, error } = await supabase
        .from('freight_presets')
        .select('*')
        .eq('user_id', effectiveId)
        .maybeSingle();

      if (error) {
        console.warn('[freightStorage] Supabase preset sync warning:', error.message);
      } else if (data) {
        const rawVehicles: VehicleConfigItem[] = Array.isArray(data.vehicles) && data.vehicles.length > 0
          ? data.vehicles
          : DEFAULT_VEHICLES;

        const defaultVehId = data.default_vehicle || rawVehicles.find(v => v.isDefault)?.id || rawVehicles[0]?.id || 'moto';
        const activeVehicle = rawVehicles.find(v => v.id === defaultVehId) || rawVehicles[0] || DEFAULT_VEHICLES[0];

        const vehicleLabel = data.default_vehicle_label || activeVehicle.label || DEFAULT_PRESET.default_vehicle_label;
        const vehicleCapacity = data.default_vehicle_capacity || activeVehicle.maxWeight || DEFAULT_PRESET.default_vehicle_capacity;
        const vehicleDesc = data.default_vehicle_desc || activeVehicle.desc || DEFAULT_PRESET.default_vehicle_desc;
        const vehicleIcon = data.default_vehicle_icon || activeVehicle.iconName || DEFAULT_PRESET.default_vehicle_icon;

        const normalizedVehicles = rawVehicles.map(v => ({
          ...v,
          isDefault: v.id === defaultVehId,
        }));

        const preset: DriverFreightPreset = {
          driver_name: data.driver_name || '',
          driver_phone: data.driver_phone || '',
          driver_company: data.driver_company || '',
          driver_document: data.driver_document || '',
          pix_key: data.pix_key || '',
          pix_key_type: data.pix_key_type || 'phone',
          default_vehicle: defaultVehId,
          default_vehicle_label: vehicleLabel,
          default_vehicle_capacity: vehicleCapacity,
          default_vehicle_desc: vehicleDesc,
          default_vehicle_icon: vehicleIcon,
          default_km_per_liter: activeVehicle.kmPerLiter ?? data.default_km_per_liter ?? 35,
          default_price_per_km: activeVehicle.defaultPriceKm ?? data.default_price_per_km ?? 2.80,
          default_base_fee: activeVehicle.defaultBase ?? data.default_base_fee ?? 12.00,
          default_maintenance_per_km: activeVehicle.maintenancePerKm ?? data.default_maintenance_per_km ?? 0.25,
          default_stop_fee: activeVehicle.stopFee ?? data.default_stop_fee ?? 6.00,
          default_terms: data.default_terms || DEFAULT_TERMS,
          default_payment_method: data.default_payment_method || 'pix',
          vehicles: normalizedVehicles,
        };
        localStorage.setItem(`${PRESET_KEY_PREFIX}${userId}`, JSON.stringify(preset));
        if (effectiveId !== userId) {
          localStorage.setItem(`${PRESET_KEY_PREFIX}${effectiveId}`, JSON.stringify(preset));
        }
        return preset;
      }
    } catch (err) {
      console.warn('[freightStorage] Supabase preset sync fallback:', err);
    }
    return this.getPreset(userId);
  },

  savePreset(preset: Partial<DriverFreightPreset>, userId: string = 'default'): DriverFreightPreset {
    const current = this.getPreset(userId);

    const vehiclesList: VehicleConfigItem[] = Array.isArray(preset.vehicles) && preset.vehicles.length > 0
      ? preset.vehicles
      : (current.vehicles && current.vehicles.length > 0 ? current.vehicles : DEFAULT_VEHICLES);

    const defaultVehId = preset.default_vehicle || vehiclesList.find(v => v.isDefault)?.id || vehiclesList[0]?.id || 'moto';
    const activeVehicle = vehiclesList.find(v => v.id === defaultVehId) || vehiclesList[0] || DEFAULT_VEHICLES[0];

    const normalizedVehicles = vehiclesList.map(v => ({
      ...v,
      isDefault: v.id === defaultVehId,
    }));

    const vehicleLabel = activeVehicle.label || preset.default_vehicle_label || current.default_vehicle_label || 'Motocicleta (Frete Express)';
    const vehicleCapacity = activeVehicle.maxWeight || preset.default_vehicle_capacity || current.default_vehicle_capacity || 'Até 20kg (Baú / Mochila)';
    const vehicleDesc = activeVehicle.desc || preset.default_vehicle_desc || current.default_vehicle_desc || 'Documentos, pequenos pacotes, entregas rápidas e urgentes';
    const vehicleIcon = activeVehicle.iconName || preset.default_vehicle_icon || current.default_vehicle_icon || 'Bike';

    const merged: DriverFreightPreset = { 
      ...current, 
      ...preset,
      default_vehicle: defaultVehId,
      default_vehicle_label: vehicleLabel,
      default_vehicle_capacity: vehicleCapacity,
      default_vehicle_desc: vehicleDesc,
      default_vehicle_icon: vehicleIcon,
      default_price_per_km: activeVehicle.defaultPriceKm ?? preset.default_price_per_km ?? current.default_price_per_km ?? 2.80,
      default_base_fee: activeVehicle.defaultBase ?? preset.default_base_fee ?? current.default_base_fee ?? 12.00,
      default_stop_fee: activeVehicle.stopFee ?? preset.default_stop_fee ?? current.default_stop_fee ?? 6.00,
      default_km_per_liter: activeVehicle.kmPerLiter ?? preset.default_km_per_liter ?? current.default_km_per_liter ?? 35,
      default_maintenance_per_km: activeVehicle.maintenancePerKm ?? preset.default_maintenance_per_km ?? current.default_maintenance_per_km ?? 0.25,
      vehicles: normalizedVehicles,
    };

    try {
      localStorage.setItem(`${PRESET_KEY_PREFIX}${userId}`, JSON.stringify(merged));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('freight_preset_updated', { detail: merged }));
      }
    } catch (e) {
      console.error('Erro ao salvar preset do motorista:', e);
    }

    // Async save to Supabase
    (async () => {
      try {
        const effectiveId = await getEffectiveUserId(userId);
        const { error } = await supabase
          .from('freight_presets')
          .upsert({
            user_id: effectiveId,
            driver_name: merged.driver_name || '',
            driver_phone: merged.driver_phone || '',
            driver_company: merged.driver_company || '',
            driver_document: merged.driver_document || '',
            pix_key: merged.pix_key || '',
            pix_key_type: merged.pix_key_type || 'phone',
            default_vehicle: merged.default_vehicle,
            default_vehicle_label: merged.default_vehicle_label,
            default_vehicle_capacity: merged.default_vehicle_capacity,
            default_vehicle_desc: merged.default_vehicle_desc,
            default_vehicle_icon: merged.default_vehicle_icon,
            default_km_per_liter: merged.default_km_per_liter,
            default_price_per_km: merged.default_price_per_km,
            default_base_fee: merged.default_base_fee,
            default_maintenance_per_km: merged.default_maintenance_per_km,
            default_stop_fee: merged.default_stop_fee,
            default_terms: merged.default_terms || '',
            default_payment_method: merged.default_payment_method || 'pix',
            vehicles: merged.vehicles || [],
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });

        if (error) {
          console.warn('[freightStorage] Supabase preset save error:', error.message, error.details);
        } else {
          console.log('[freightStorage] Preset successfully saved to Supabase.');
        }
      } catch (err) {
        console.warn('[freightStorage] Supabase preset save exception:', err);
      }
    })();

    return merged;
  },

  // CLIENTS & AUTOCOMPLETE
  getClients(userId: string = 'default'): FreightClient[] {
    try {
      let raw = localStorage.getItem(`${CLIENTS_KEY_PREFIX}${userId}`);
      if (!raw && userId !== 'default') {
        raw = localStorage.getItem(`${CLIENTS_KEY_PREFIX}default`);
      }
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  },

  async syncClientsFromDatabase(userId: string = 'default'): Promise<FreightClient[]> {
    try {
      const effectiveId = await getEffectiveUserId(userId);
      const query = supabase
        .from('freight_clients')
        .select('*');

      if (effectiveId && effectiveId !== 'default') {
        query.eq('user_id', effectiveId);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) {
        console.warn('[freightStorage] Supabase clients sync warning:', error.message);
      } else if (data) {
        localStorage.setItem(`${CLIENTS_KEY_PREFIX}${userId}`, JSON.stringify(data));
        if (effectiveId !== userId) {
          localStorage.setItem(`${CLIENTS_KEY_PREFIX}${effectiveId}`, JSON.stringify(data));
        }
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
        const effectiveId = await getEffectiveUserId(userId);
        const { error } = await supabase
          .from('freight_clients')
          .upsert({
            ...updatedClient,
            user_id: effectiveId,
          });

        if (error) {
          console.warn('[freightStorage] Supabase client save error:', error.message);
        }
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
        const { error } = await supabase
          .from('freight_clients')
          .delete()
          .eq('id', id);

        if (error) {
          console.warn('[freightStorage] Supabase client delete error:', error.message);
        }
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

  getVehicleInfo(quoteOrType?: FreightQuote | string | null, userId: string = 'default'): {
    id: string;
    label: string;
    maxWeight: string;
    desc: string;
    iconName: string;
    defaultPriceKm: number;
    defaultBase: number;
    stopFee: number;
    kmPerLiter: number;
    maintenancePerKm: number;
  } {
    const preset = this.getPreset(userId);

    // If a full quote is passed with explicit vehicle_label / vehicle_capacity
    if (quoteOrType && typeof quoteOrType === 'object') {
      const q = quoteOrType as FreightQuote;
      const vehicleType = q.vehicle_type || 'moto';
      const vMatch = (preset.vehicles || []).find(v => v.id === vehicleType);

      return {
        id: vehicleType,
        label: q.vehicle_label || vMatch?.label || preset.default_vehicle_label || 'Motocicleta (Frete Express)',
        maxWeight: q.vehicle_capacity || vMatch?.maxWeight || preset.default_vehicle_capacity || 'Até 20kg (Baú / Mochila)',
        desc: vMatch?.desc || preset.default_vehicle_desc || 'Documentos, pequenos pacotes, entregas rápidas e urgentes',
        iconName: vMatch?.iconName || preset.default_vehicle_icon || 'Bike',
        defaultPriceKm: vMatch?.defaultPriceKm ?? preset.default_price_per_km ?? 2.80,
        defaultBase: vMatch?.defaultBase ?? preset.default_base_fee ?? 12.00,
        stopFee: vMatch?.stopFee ?? preset.default_stop_fee ?? 6.00,
        kmPerLiter: vMatch?.kmPerLiter ?? preset.default_km_per_liter ?? 35,
        maintenancePerKm: vMatch?.maintenancePerKm ?? preset.default_maintenance_per_km ?? 0.25,
      };
    }

    const typeStr = typeof quoteOrType === 'string' ? quoteOrType : preset.default_vehicle || 'moto';
    const vMatch = (preset.vehicles || []).find(v => v.id === typeStr);

    return {
      id: typeStr,
      label: vMatch?.label || preset.default_vehicle_label || 'Motocicleta (Frete Express)',
      maxWeight: vMatch?.maxWeight || preset.default_vehicle_capacity || 'Até 20kg (Baú / Mochila)',
      desc: vMatch?.desc || preset.default_vehicle_desc || 'Documentos, pequenos pacotes, entregas rápidas e urgentes',
      iconName: vMatch?.iconName || preset.default_vehicle_icon || 'Bike',
      defaultPriceKm: vMatch?.defaultPriceKm ?? preset.default_price_per_km ?? 2.80,
      defaultBase: vMatch?.defaultBase ?? preset.default_base_fee ?? 12.00,
      stopFee: vMatch?.stopFee ?? preset.default_stop_fee ?? 6.00,
      kmPerLiter: vMatch?.kmPerLiter ?? preset.default_km_per_liter ?? 35,
      maintenancePerKm: vMatch?.maintenancePerKm ?? preset.default_maintenance_per_km ?? 0.25,
    };
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
    const vehicleInfo = this.getVehicleInfo(quote, userId);
    const iconEmoji = vehicleInfo.iconName === 'Car' ? '🚗' : vehicleInfo.iconName === 'Truck' ? '🚚' : '🛵';
    
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
    msg += `${iconEmoji} *Veículo:* ${vehicleInfo.label}${vehicleInfo.maxWeight ? ` (${vehicleInfo.maxWeight})` : ''}\n`;
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
