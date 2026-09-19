import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DecimalInput } from '@/components/ui/DecimalInput';
import { 
  Bike, 
  Car, 
  Truck, 
  MapPin, 
  Plus, 
  Trash2, 
  DollarSign, 
  Fuel, 
  TrendingUp, 
  MessageSquare, 
  FileText, 
  Save, 
  ShieldCheck, 
  Clock, 
  Calendar,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  Tag,
  Check,
  User,
  Users,
  Search,
  Settings,
  ArrowUpDown,
  Navigation,
  Sparkles,
  Zap,
  Percent,
  Weight,
  Phone,
  Building,
  CreditCard,
  QrCode,
  Banknote,
  RotateCcw,
  Sliders,
  AlertCircle,
  Edit,
  Share2,
  Loader2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  FreightQuote, 
  VehicleType, 
  ServiceType, 
  PaymentMethod, 
  RouteStop, 
  DriverFreightPreset, 
  FreightClient, 
  VehicleConfigItem 
} from '../../types/freight';
import { freightStorage, DEFAULT_VEHICLES, DEFAULT_PRESET } from '../../lib/freightStorage';
import { shareFreightQuotePDF } from '../../lib/freightPdfGenerator';
import { useData } from '../../contexts/DataContext';
import { AddressAutocompleteInput } from './AddressAutocompleteInput';
import { ClientAutocompleteInput } from './ClientAutocompleteInput';
import { maskPhone, maskCpfCnpj } from '@/lib/brazilianFormatters';
import { getTodayLocalDateStr } from '../../lib/utils';

interface FreightQuoteFormProps {
  initialQuote?: Partial<FreightQuote> | null;
  isBaseMode?: boolean;
  onSaveQuote: (quote: FreightQuote) => void;
  onOpenWhatsApp?: (quote: FreightQuote) => void;
  onOpenProposal: (quote: FreightQuote) => void;
  onCancelEdit?: () => void;
  onOpenSettings?: () => void;
  userId?: string;
}

const CARGO_PRESETS = [
  'Documentos / Envelopes',
  'Pacotes / Caixas Médias',
  'Peças Automotivas / Ferramentas',
  'Móveis / Eletrodomésticos',
  'Materiais de Construção / Tintas',
  'Equipamentos / Eletrônicos',
  'Alimentos / Bebidas',
  'Mudança Residencial / Comercial',
];

const DISTANCE_PRESETS = [3, 5, 10, 15, 25, 40, 60, 100];

export function FreightQuoteForm({
  initialQuote,
  isBaseMode = false,
  onSaveQuote,
  onOpenWhatsApp,
  onOpenProposal,
  onCancelEdit,
  onOpenSettings,
  userId = 'default',
}: FreightQuoteFormProps) {
  const { settings, reserves } = useData();

  // Load driver preset & sync from database
  const [preset, setPreset] = useState<DriverFreightPreset>(() => freightStorage.getPreset(userId));

  // Vehicle is strictly Motorcycle
  const [vehicleType] = useState<string>('moto');

  // Compute kmPerLiter from profile config (settings)
  const profileKmPerLiter = useMemo(() => {
    if (settings?.vehicle_km_per_liter && settings.vehicle_km_per_liter > 0) {
      return settings.vehicle_km_per_liter;
    }
    return preset.default_km_per_liter ?? 35;
  }, [settings?.vehicle_km_per_liter, preset.default_km_per_liter]);

  // Compute maintenanceCostPerKm from Maintenance Reserve rule
  const maintenanceReserveKmCost = useMemo(() => {
    if (reserves && reserves.length > 0) {
      const maintRes = reserves.find(
        r => (r.regra_tipo === 'km' && r.regra_valor && r.regra_valor > 0) ||
             (r.name.toLowerCase().includes('manutenção') && r.regra_valor && r.regra_valor > 0)
      );
      if (maintRes?.regra_valor) {
        return maintRes.regra_valor;
      }
    }
    return preset.default_maintenance_per_km ?? 0.15;
  }, [reserves, preset.default_maintenance_per_km]);

  // Service Type & Status
  const [serviceType, setServiceType] = useState<ServiceType>(initialQuote?.service_type || 'express');
  const [status, setStatus] = useState<FreightQuote['status']>(initialQuote?.status || 'pending');

  // Client Info
  const [savedClients, setSavedClients] = useState<FreightClient[]>(() => freightStorage.getClients(userId));
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientName, setClientName] = useState(initialQuote?.client_name || '');
  const [clientPhone, setClientPhone] = useState(initialQuote?.client_phone ? maskPhone(initialQuote.client_phone) : '');
  const [clientCompany, setClientCompany] = useState(initialQuote?.client_company || '');
  const [clientDocument, setClientDocument] = useState(initialQuote?.client_document ? maskCpfCnpj(initialQuote.client_document) : '');
  const [clientEmail, setClientEmail] = useState(initialQuote?.client_email || '');

  // All clients (explicitly saved + extracted from past quotes history)
  const allClients = useMemo(() => {
    const map = new Map<string, FreightClient>();
    savedClients.forEach((c) => {
      if (c.name && c.name.trim()) {
        map.set(c.name.trim().toLowerCase(), c);
      }
    });

    try {
      const quotes = freightStorage.getQuotes(userId);
      quotes.forEach((q) => {
        if (q.client_name && q.client_name.trim()) {
          const key = q.client_name.trim().toLowerCase();
          if (!map.has(key)) {
            const histClient: FreightClient = {
              id: `hist_${q.id}`,
              user_id: userId,
              name: q.client_name.trim(),
              phone: q.client_phone || '',
              company: q.client_company || '',
              document: q.client_document || '',
              email: q.client_email || '',
              updated_at: q.created_at,
            };
            map.set(key, histClient);
          }
        }
      });
    } catch (e) {
      // fallback to savedClients
    }

    return Array.from(map.values());
  }, [userId, savedClients]);

  // History Addresses from previous quotes for instant autocomplete
  const historyAddresses = useMemo(() => {
    try {
      const quotes = freightStorage.getQuotes(userId);
      const map = new Map<string, { address: string; neighborhood?: string }>();
      quotes.forEach((q) => {
        if (q.origin_address && q.origin_address.trim().length > 2) {
          map.set(q.origin_address.trim().toLowerCase(), {
            address: q.origin_address.trim(),
            neighborhood: q.origin_neighborhood?.trim(),
          });
        }
        if (q.destination_address && q.destination_address.trim().length > 2) {
          map.set(q.destination_address.trim().toLowerCase(), {
            address: q.destination_address.trim(),
            neighborhood: q.destination_neighborhood?.trim(),
          });
        }
        if (Array.isArray(q.additional_stops)) {
          q.additional_stops.forEach((s) => {
            if (s.address && s.address.trim().length > 2) {
              map.set(s.address.trim().toLowerCase(), {
                address: s.address.trim(),
                neighborhood: s.neighborhood?.trim(),
              });
            }
          });
        }
      });
      return Array.from(map.values());
    } catch (e) {
      return [];
    }
  }, [userId]);

  // Route & Stops
  const [originAddress, setOriginAddress] = useState(initialQuote?.origin_address || '');
  const [originNeighborhood, setOriginNeighborhood] = useState(initialQuote?.origin_neighborhood || '');
  const [destinationAddress, setDestinationAddress] = useState(initialQuote?.destination_address || '');
  const [destinationNeighborhood, setDestinationNeighborhood] = useState(initialQuote?.destination_neighborhood || '');
  const [additionalStops, setAdditionalStops] = useState<RouteStop[]>(initialQuote?.additional_stops || []);
  const [distanceKm, setDistanceKm] = useState<number>(initialQuote?.distance_km ?? 10);
  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(initialQuote?.is_round_trip || false);

  // Scheduling
  const [cargoWeightKg, setCargoWeightKg] = useState<number | undefined>(initialQuote?.cargo_weight_kg);
  const [cargoValue, setCargoValue] = useState<number | undefined>(initialQuote?.cargo_value);
  const [scheduledDate, setScheduledDate] = useState(initialQuote?.scheduled_date || getTodayLocalDateStr());
  const [scheduledTime, setScheduledTime] = useState(initialQuote?.scheduled_time || '');

  // Pricing & Fees (Base R$ 15,00, Price/km R$ 0,80, Stop fee R$ 6,00)
  const [baseFee, setBaseFee] = useState<number>(
    initialQuote?.base_fee ?? preset.default_base_fee ?? 15.00
  );
  const [pricePerKm, setPricePerKm] = useState<number>(
    initialQuote?.price_per_km ?? preset.default_price_per_km ?? 0.80
  );
  const [extraStopsFee, setExtraStopsFee] = useState<number>(
    initialQuote?.extra_stops_fee ?? (preset.default_stop_fee ? preset.default_stop_fee * (initialQuote?.additional_stops?.length || 0) : 0)
  );

  // Extra Surcharges (Quick add-ons)
  const [heavyCargoFee, setHeavyCargoFee] = useState<number>(initialQuote?.heavy_cargo_fee || 0);
  const [stairsFloorFee, setStairsFloorFee] = useState<number>(initialQuote?.stairs_floor_fee || 0);
  const [urgentOrRainFee, setUrgentOrRainFee] = useState<number>(initialQuote?.urgent_or_rain_fee || 0);
  const [nightFee, setNightFee] = useState<number>(initialQuote?.night_fee || 0);
  const [tollsFee, setTollsFee] = useState<number>(initialQuote?.tolls_fee || 0);
  const [waitingHoursFee, setWaitingHoursFee] = useState<number>(initialQuote?.waiting_hours_fee || 0);

  // Discounts
  const [discountType, setDiscountType] = useState<'fixed' | 'percent' | 'total_fixed'>(
    initialQuote?.discount_type || 'fixed'
  );
  const [discountValue, setDiscountValue] = useState<number>(initialQuote?.discount_value || 0);

  // Operational Fuel & Vehicle Wear
  const [fuelPrice, setFuelPrice] = useState<number>(initialQuote?.fuel_price || 5.89);
  const [kmPerLiter, setKmPerLiter] = useState<number>(
    initialQuote?.km_per_liter ?? profileKmPerLiter
  );
  const [maintenanceCostPerKm, setMaintenanceCostPerKm] = useState<number>(
    initialQuote?.maintenance_cost_per_km ?? maintenanceReserveKmCost
  );

  // Update operational consumption & maintenance cost reactively when settings or reserves change
  useEffect(() => {
    if (!initialQuote) {
      setKmPerLiter(profileKmPerLiter);
      setMaintenanceCostPerKm(maintenanceReserveKmCost);
    }
  }, [profileKmPerLiter, maintenanceReserveKmCost, initialQuote]);

  // Reactive Sync on initialQuote prop update
  useEffect(() => {
    if (initialQuote) {
      setServiceType(initialQuote.service_type || 'express');
      setStatus(initialQuote.status || 'pending');
      setClientName(initialQuote.client_name || '');
      setClientPhone(initialQuote.client_phone ? maskPhone(initialQuote.client_phone) : '');
      setClientCompany(initialQuote.client_company || '');
      setClientDocument(initialQuote.client_document ? maskCpfCnpj(initialQuote.client_document) : '');
      setClientEmail(initialQuote.client_email || '');

      setOriginAddress(initialQuote.origin_address || '');
      setOriginNeighborhood(initialQuote.origin_neighborhood || '');
      setDestinationAddress(initialQuote.destination_address || '');
      setDestinationNeighborhood(initialQuote.destination_neighborhood || '');
      setAdditionalStops(initialQuote.additional_stops || []);
      setDistanceKm(initialQuote.distance_km ?? 10);
      setIsRoundTrip(initialQuote.is_round_trip || false);

      setCargoWeightKg(initialQuote.cargo_weight_kg);
      setCargoValue(initialQuote.cargo_value);
      setScheduledDate(initialQuote.scheduled_date || getTodayLocalDateStr());
      setScheduledTime(initialQuote.scheduled_time || '');

      setBaseFee(initialQuote.base_fee ?? preset.default_base_fee ?? 15.00);
      setPricePerKm(initialQuote.price_per_km ?? preset.default_price_per_km ?? 0.80);
      setExtraStopsFee(initialQuote.extra_stops_fee ?? 0);

      setHeavyCargoFee(initialQuote.heavy_cargo_fee || 0);
      setStairsFloorFee(initialQuote.stairs_floor_fee || 0);
      setUrgentOrRainFee(initialQuote.urgent_or_rain_fee || 0);
      setNightFee(initialQuote.night_fee || 0);
      setTollsFee(initialQuote.tolls_fee || 0);
      setWaitingHoursFee(initialQuote.waiting_hours_fee || 0);

      setDiscountType(initialQuote.discount_type || 'fixed');
      setDiscountValue(initialQuote.discount_value || 0);

      setFuelPrice(initialQuote.fuel_price || 5.89);
      setKmPerLiter(initialQuote.km_per_liter || profileKmPerLiter);
      setMaintenanceCostPerKm(initialQuote.maintenance_cost_per_km || maintenanceReserveKmCost);

      setDriverName(initialQuote.driver_name || preset.driver_name || settings?.full_name || '');
      setDriverPhone(initialQuote.driver_phone || preset.driver_phone || '');
      setDriverCompany(initialQuote.driver_company || preset.driver_company || '');
      setDriverDocument(initialQuote.driver_document || preset.driver_document || '');
      setPixKey(initialQuote.pix_key || preset.pix_key || '');
      setPixKeyType(initialQuote.pix_key_type || preset.pix_key_type || 'phone');
      setPaymentMethod(initialQuote.payment_method || preset.default_payment_method || 'pix');

      setObservations(initialQuote.observations || '');
      setTermsAndConditions(initialQuote.terms_and_conditions || preset.default_terms || '');
    }
  }, [initialQuote, profileKmPerLiter, maintenanceReserveKmCost, preset, settings?.full_name]);

  // Driver & Payment Info
  const [driverName, setDriverName] = useState(initialQuote?.driver_name || preset.driver_name || settings?.full_name || '');
  const [driverPhone, setDriverPhone] = useState(initialQuote?.driver_phone || preset.driver_phone || '');
  const [driverCompany, setDriverCompany] = useState(initialQuote?.driver_company || preset.driver_company || '');
  const [driverDocument, setDriverDocument] = useState(initialQuote?.driver_document || preset.driver_document || '');
  const [pixKey, setPixKey] = useState(initialQuote?.pix_key || preset.pix_key || '');
  const [pixKeyType, setPixKeyType] = useState<string>(initialQuote?.pix_key_type || preset.pix_key_type || 'phone');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialQuote?.payment_method || preset.default_payment_method || 'pix');

  // Terms & Validity
  const [observations, setObservations] = useState(initialQuote?.observations || '');
  const [termsAndConditions, setTermsAndConditions] = useState(initialQuote?.terms_and_conditions || preset.default_terms || '');
  const [validDays, setValidDays] = useState<number>(2);

  // UI state for accordion sections
  const [showAdvancedPricing, setShowAdvancedPricing] = useState(false);
  const [showDriverDetails, setShowDriverDetails] = useState(false);

  // 1. Reactive Sync on Preset Update (From Settings Modal or CustomEvent)
  const applyPresetData = useCallback((p: DriverFreightPreset, forceRates: boolean = false) => {
    setPreset(p);
    if (!initialQuote || forceRates) {
      setBaseFee(p.default_base_fee ?? 15.00);
      setPricePerKm(p.default_price_per_km ?? 0.80);
      setPaymentMethod(p.default_payment_method || 'pix');
      setPixKey(p.pix_key || '');
      setPixKeyType(p.pix_key_type || 'phone');
      setDriverName(p.driver_name || settings?.full_name || '');
      setDriverPhone(p.driver_phone || '');
      setDriverCompany(p.driver_company || '');
      setDriverDocument(p.driver_document || '');
      setTermsAndConditions(p.default_terms || '');
    }
  }, [initialQuote, settings?.full_name]);

  // Listen to preset updates dispatched across the app
  useEffect(() => {
    const handlePresetUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<DriverFreightPreset>;
      if (customEvent.detail) {
        applyPresetData(customEvent.detail, !initialQuote);
      }
    };

    window.addEventListener('freight_preset_updated', handlePresetUpdated);
    return () => {
      window.removeEventListener('freight_preset_updated', handlePresetUpdated);
    };
  }, [applyPresetData, initialQuote]);

  // Initial load & database sync
  useEffect(() => {
    freightStorage.syncPresetFromDatabase(userId).then(loadedPreset => {
      applyPresetData(loadedPreset, false);
    });
    freightStorage.syncClientsFromDatabase(userId).then(clients => {
      setSavedClients(clients);
    });

    const handleClientsUpdated = () => {
      setSavedClients(freightStorage.getClients(userId));
    };
    window.addEventListener('freight_clients_updated', handleClientsUpdated);
    return () => {
      window.removeEventListener('freight_clients_updated', handleClientsUpdated);
    };
  }, [userId, applyPresetData]);

  // Client Selection Handler
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) return;
    const found = allClients.find(c => c.id === clientId);
    if (found) {
      setClientName(found.name);
      setClientPhone(maskPhone(found.phone || ''));
      setClientCompany(found.company || '');
      setClientDocument(maskCpfCnpj(found.document || ''));
      setClientEmail(found.email || '');
      toast.success(`Cliente ${found.name} carregado.`);
    }
  };

  const handleSelectClientFromAutocomplete = (client: FreightClient) => {
    setSelectedClientId(client.id);
    setClientName(client.name);
    setClientPhone(maskPhone(client.phone || ''));
    setClientCompany(client.company || '');
    setClientDocument(maskCpfCnpj(client.document || ''));
    setClientEmail(client.email || '');
    toast.success(`Cliente ${client.name} selecionado.`);
  };

  // Invert Origin and Destination
  const handleSwapAddresses = () => {
    const tempAddr = originAddress;
    const tempNeigh = originNeighborhood;
    setOriginAddress(destinationAddress);
    setOriginNeighborhood(destinationNeighborhood);
    setDestinationAddress(tempAddr);
    setDestinationNeighborhood(tempNeigh);
    toast.info('Origem e destino invertidos com sucesso.');
  };

  // Manage Multiple Stops
  const handleAddStop = () => {
    const stopFeeUnit = preset.default_stop_fee || 6.00;
    const newStop: RouteStop = {
      id: `stop_${Date.now()}`,
      address: '',
      neighborhood: '',
      notes: '',
    };
    const updatedStops = [...additionalStops, newStop];
    setAdditionalStops(updatedStops);
    setExtraStopsFee(updatedStops.length * stopFeeUnit);
    toast.info(`Parada ${updatedStops.length} adicionada (+R$ ${stopFeeUnit.toFixed(2)}/parada).`);
  };

  const handleRemoveStop = (index: number) => {
    const stopFeeUnit = preset.default_stop_fee || 6.00;
    const updated = additionalStops.filter((_, i) => i !== index);
    setAdditionalStops(updated);
    setExtraStopsFee(updated.length * stopFeeUnit);
  };

  const handleUpdateStop = (index: number, field: keyof RouteStop, value: string) => {
    const updated = [...additionalStops];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalStops(updated);
  };

  // Total Calculated KM
  const totalCalculatedKm = useMemo(() => {
    const base = Number(distanceKm) || 0;
    return isRoundTrip ? base * 2 : base;
  }, [distanceKm, isRoundTrip]);

  // Financial Calculations & Profit Margins (Reactive Cockpit)
  const financialCalculations = useMemo(() => {
    const distanceCost = totalCalculatedKm * (Number(pricePerKm) || 0);
    const subtotal = 
      (Number(baseFee) || 0) +
      distanceCost +
      (Number(extraStopsFee) || 0) +
      (Number(heavyCargoFee) || 0) +
      (Number(stairsFloorFee) || 0) +
      (Number(urgentOrRainFee) || 0) +
      (Number(nightFee) || 0) +
      (Number(tollsFee) || 0) +
      (Number(waitingHoursFee) || 0);

    let calculatedDiscount = 0;
    let finalTotalPrice = subtotal;

    if (discountType === 'total_fixed') {
      // Preço Fechado: o usuário define diretamente o valor final do frete
      const fixedFinal = Number(discountValue) || 0;
      if (fixedFinal > 0) {
        finalTotalPrice = fixedFinal;
        calculatedDiscount = Math.max(0, subtotal - fixedFinal);
      } else {
        finalTotalPrice = subtotal;
        calculatedDiscount = 0;
      }
    } else if (discountType === 'percent') {
      calculatedDiscount = (subtotal * (Number(discountValue) || 0)) / 100;
      finalTotalPrice = Math.max(0, subtotal - calculatedDiscount);
    } else {
      calculatedDiscount = Number(discountValue) || 0;
      finalTotalPrice = Math.max(0, subtotal - calculatedDiscount);
    }

    // Direct Operating Costs
    const effectiveKmPerLiter = Number(kmPerLiter) > 0 ? Number(kmPerLiter) : 35;
    const litersNeeded = totalCalculatedKm / effectiveKmPerLiter;
    const fuelCost = litersNeeded * (Number(fuelPrice) || 0);
    const maintenanceCost = totalCalculatedKm * (Number(maintenanceCostPerKm) || 0);
    const directDriverCosts = fuelCost + maintenanceCost + (Number(tollsFee) || 0);

    const netProfit = finalTotalPrice - directDriverCosts;
    const marginPercent = finalTotalPrice > 0 ? (netProfit / finalTotalPrice) * 100 : 0;

    return {
      subtotal,
      calculatedDiscount,
      finalTotalPrice,
      litersNeeded,
      fuelCost,
      maintenanceCost,
      directDriverCosts,
      netProfit,
      marginPercent,
    };
  }, [
    totalCalculatedKm,
    pricePerKm,
    baseFee,
    extraStopsFee,
    heavyCargoFee,
    stairsFloorFee,
    urgentOrRainFee,
    nightFee,
    tollsFee,
    waitingHoursFee,
    discountType,
    discountValue,
    kmPerLiter,
    fuelPrice,
    maintenanceCostPerKm,
  ]);

  // Build Quote Object
  const buildQuoteObject = (): FreightQuote => {
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + (validDays || 2));

    const isEditMode = !isBaseMode && !!initialQuote?.id && !initialQuote?.is_client_preset;
    const quoteId = isEditMode && initialQuote?.id ? initialQuote.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `frt_${Date.now()}`);
    const code = isEditMode && initialQuote?.code ? initialQuote.code : freightStorage.generateNextCode(userId);

    return {
      id: quoteId,
      user_id: userId,
      code,
      created_at: isEditMode && initialQuote?.created_at ? initialQuote.created_at : new Date().toISOString(),
      valid_until: validUntilDate.toISOString(),
      status,

      client_name: clientName.trim() || 'Cliente',
      client_phone: clientPhone.trim(),
      client_company: clientCompany.trim(),
      client_document: clientDocument.trim(),
      client_email: clientEmail.trim(),

      driver_name: driverName.trim() || 'Transportador Especializado',
      driver_phone: driverPhone.trim(),
      driver_company: driverCompany.trim(),
      driver_document: driverDocument.trim(),
      pix_key: pixKey.trim(),
      pix_key_type: pixKeyType as any,

      vehicle_type: 'moto',
      vehicle_label: 'Motocicleta (Frete Express)',
      vehicle_capacity: 'Até 50Kg (Bauleto / amarração)',
      service_type: serviceType,
      origin_address: originAddress.trim() || 'Ponto de Coleta',
      origin_neighborhood: originNeighborhood.trim(),
      destination_address: destinationAddress.trim() || 'Ponto de Entrega',
      destination_neighborhood: destinationNeighborhood.trim(),
      additional_stops: additionalStops.filter(s => s.address.trim().length > 0),
      distance_km: Number(distanceKm) || 0,
      is_round_trip: isRoundTrip,
      total_calculated_km: totalCalculatedKm,

      cargo_description: 'Encomendas / Entregas Rápidas',
      cargo_weight_kg: cargoWeightKg ? Number(cargoWeightKg) : undefined,
      cargo_value: cargoValue ? Number(cargoValue) : undefined,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime.trim() || undefined,

      base_fee: Number(baseFee) || 0,
      price_per_km: Number(pricePerKm) || 0,
      extra_stops_fee: Number(extraStopsFee) || 0,
      heavy_cargo_fee: Number(heavyCargoFee) || 0,
      stairs_floor_fee: Number(stairsFloorFee) || 0,
      urgent_or_rain_fee: Number(urgentOrRainFee) || 0,
      night_fee: Number(nightFee) || 0,
      tolls_fee: Number(tollsFee) || 0,
      waiting_hours_fee: Number(waitingHoursFee) || 0,
      
      discount: financialCalculations.calculatedDiscount,
      discount_type: discountType,
      discount_value: Number(discountValue) || 0,

      fuel_price: fuelPrice,
      km_per_liter: kmPerLiter,
      maintenance_cost_per_km: maintenanceCostPerKm,
      estimated_fuel_cost: financialCalculations.fuelCost,
      estimated_maintenance_cost: financialCalculations.maintenanceCost,
      total_driver_cost: financialCalculations.directDriverCosts,

      total_price: financialCalculations.finalTotalPrice,
      driver_net_profit: financialCalculations.netProfit,
      profit_margin_percent: financialCalculations.marginPercent,

      payment_method: paymentMethod,
      observations: observations.trim(),
      terms_and_conditions: termsAndConditions.trim(),
    };
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originAddress || !destinationAddress) {
      toast.error('Preencha os endereços de coleta e entrega para gerar o orçamento.');
      return;
    }

    const quote = buildQuoteObject();
    onSaveQuote(quote);
    toast.success(`Orçamento ${quote.code} salvo com sucesso!`);
  };

  const [isSharingPdf, setIsSharingPdf] = useState(false);

  const handleQuickSharePDF = async () => {
    if (!originAddress || !destinationAddress) {
      toast.error('Preencha ao menos os endereços de coleta e entrega.');
      return;
    }
    const quote = buildQuoteObject();
    onSaveQuote(quote);
    try {
      setIsSharingPdf(true);
      const shared = await shareFreightQuotePDF(quote, userId);
      if (shared) {
        toast.success(`Proposta comercial em PDF (${quote.code}) pronta para envio com mensagem de anexo!`);
      }
    } catch (err: any) {
      toast.error('Erro ao compartilhar PDF: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setIsSharingPdf(false);
    }
  };

  const handleQuickProposal = () => {
    if (!originAddress || !destinationAddress) {
      toast.error('Preencha ao menos os endereços de coleta e entrega.');
      return;
    }
    const quote = buildQuoteObject();
    onSaveQuote(quote);
    onOpenProposal(quote);
  };

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6 pb-36 sm:pb-24">
      {/* BASE QUOTE BANNER */}
      {isBaseMode && initialQuote && (
        <div className="bg-primary/10 border border-primary/30 rounded-3xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary text-primary-foreground shrink-0 shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-foreground text-sm flex items-center gap-2">
                Novo Orçamento com Base em {initialQuote.code}
                <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-extrabold uppercase">
                  Modelo: {initialQuote.code}
                </span>
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Os dados do orçamento foram carregados como modelo. Defina a nova data e salve a proposta.
              </p>
            </div>
          </div>
          {onCancelEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelEdit}
              className="rounded-xl text-xs font-bold h-9 border-border/80 hover:bg-muted shrink-0 cursor-pointer gap-1.5"
            >
              <X className="w-4 h-4 text-rose-500" />
              Cancelar Edição
            </Button>
          )}
        </div>
      )}

      {/* STANDARD EDIT MODE BANNER */}
      {!isBaseMode && initialQuote && !initialQuote.is_client_preset && initialQuote.id && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-white shrink-0 shadow-xs">
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-foreground text-sm flex items-center gap-2">
                Editando Orçamento {initialQuote.code}
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold uppercase">
                  Modo Edição
                </span>
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Você está alterando as informações do orçamento <strong>{initialQuote.code}</strong>.
              </p>
            </div>
          </div>
          {onCancelEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelEdit}
              className="rounded-xl text-xs font-bold h-9 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 shrink-0 cursor-pointer gap-1.5"
            >
              <X className="w-4 h-4" />
              Cancelar Edição
            </Button>
          )}
        </div>
      )}

      {/* CLIENT PRESET BANNER */}
      {initialQuote?.is_client_preset && (
        <div className="bg-primary/10 border border-primary/30 rounded-3xl p-3.5 sm:p-4 flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in-50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-primary text-primary-foreground shrink-0 shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-foreground text-xs sm:text-sm flex items-center gap-2">
                Novo Orçamento para: <span className="text-primary">{clientName || initialQuote.client_name}</span>
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Os dados do cliente foram preenchidos automaticamente. Insira os endereços e taxas para calcular a proposta.
              </p>
            </div>
          </div>
          {onCancelEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelEdit}
              className="rounded-xl text-xs font-bold h-8 px-2.5 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
            >
              Limpar
            </Button>
          )}
        </div>
      )}

      {/* 1. VEHICLE & SERVICE TYPE BAR */}
      <div className="bg-card border border-border/80 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-primary text-primary-foreground shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground flex items-center gap-2 flex-wrap">
                Motocicleta (Frete Express)
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold">
                  Veículo Ativo
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Capacidade: <strong className="text-foreground">Até 50Kg (Bauleto / amarração)</strong> • Saída: <strong className="text-foreground">{formatBRL(baseFee)}</strong> • KM: <strong className="text-primary">{formatBRL(pricePerKm)}/km</strong>
              </p>
            </div>
          </div>
          {onOpenSettings && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenSettings}
              className="rounded-xl text-xs font-bold gap-1.5 h-8.5 shrink-0 border-border/70 hover:bg-muted cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Configurar Tarifas</span>
            </Button>
          )}
        </div>

        {/* Service Type Pills */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1">
          <span className="text-[11px] font-bold text-muted-foreground shrink-0 flex items-center gap-1 mr-1">
            <Sliders className="w-3 h-3" /> Modalidade:
          </span>
          {[
            { id: 'express', label: '⚡ Expresso (Direto)' },
            { id: 'scheduled', label: '🕒 Programado' },
            { id: 'return_trip', label: '📦 Retorno / Fracionado' },
            { id: 'corporate', label: '🏢 Corporativo / B2B' },
          ].map((srv) => (
            <button
              key={srv.id}
              type="button"
              onClick={() => setServiceType(srv.id as ServiceType)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 border ${
                serviceType === srv.id
                  ? 'bg-foreground text-background border-foreground shadow-xs'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/60'
              }`}
            >
              {srv.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. CLIENT & SCHEDULING (AGILE & SMART) */}
      <div className="bg-card border border-border/80 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
              <User className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground truncate">
                2. Cliente & Agendamento
              </h2>
              <p className="text-[11px] text-muted-foreground truncate">
                Digite o nome para buscar ou cadastrar os dados do cliente.
              </p>
            </div>
          </div>

          {clientName && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedClientId('');
                setClientName('');
                setClientPhone('');
                setClientCompany('');
                setClientDocument('');
                setClientEmail('');
              }}
              className="text-xs text-muted-foreground hover:text-destructive h-7 px-2 shrink-0 rounded-lg cursor-pointer"
              title="Limpar campos do cliente"
            >
              Limpar Cliente
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-bold text-foreground flex items-center gap-1">
              <User className="w-3 h-3 text-muted-foreground" /> Nome do Cliente *
            </label>
            <ClientAutocompleteInput
              value={clientName}
              onChange={setClientName}
              clients={allClients}
              onSelectClient={handleSelectClientFromAutocomplete}
              placeholder="Ex: Carlos Silva / Loja Central"
              className="rounded-xl h-9.5 text-xs bg-background border-border/70 font-semibold"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground flex items-center gap-1">
              <Phone className="w-3 h-3 text-muted-foreground" /> WhatsApp / Telefone
            </label>
            <Input
              value={clientPhone}
              onChange={(e) => setClientPhone(maskPhone(e.target.value))}
              placeholder="(00) 90000-0000"
              className="rounded-xl h-9.5 text-xs bg-background border-border/70 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground flex items-center gap-1">
              <Building className="w-3 h-3 text-muted-foreground" /> Empresa / Fantasia (Opcional)
            </label>
            <Input
              value={clientCompany}
              onChange={(e) => setClientCompany(e.target.value)}
              placeholder="Ex: Mercado Central Ltda"
              className="rounded-xl h-9.5 text-xs bg-background border-border/70"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-muted-foreground" /> CPF ou CNPJ (Opcional)
            </label>
            <Input
              value={clientDocument}
              onChange={(e) => setClientDocument(maskCpfCnpj(e.target.value))}
              placeholder="000.000.000-00 ou CNPJ"
              className="rounded-xl h-9.5 text-xs bg-background border-border/70 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/40">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-foreground" /> Data da Coleta
            </label>
            <div className="flex gap-1.5">
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-xl h-9.5 text-xs bg-background border-border/70 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScheduledDate(getTodayLocalDateStr())}
                className="h-9.5 px-2.5 text-[10px] font-bold rounded-xl border-border/60"
              >
                Hoje
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" /> Horário / Janela de Entrega
            </label>
            <Input
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              placeholder="Ex: 09:30, Manhã, Imediato..."
              className="rounded-xl h-9.5 text-xs bg-background border-border/70"
            />
          </div>
        </div>
      </div>

      {/* 3. ROUTE, DISTANCE & STOPS (FAST DISPATCH COCKPIT) */}
      <div className="bg-card border border-border/80 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground">
                3. Rota, Distância & Paradas
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Autocomplete integrado de endereços, CEPs e histórico de rotas anteriores.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSwapAddresses}
            className="rounded-xl h-8 text-xs font-bold gap-1.5 border-border hover:bg-muted cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Inverter Rota
          </Button>
        </div>

        {/* Origin & Destination */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Origin */}
          <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
              PONTO A (COLETA / ORIGEM)
            </div>
            <AddressAutocompleteInput
              value={originAddress}
              onChange={setOriginAddress}
              neighborhoodValue={originNeighborhood}
              onNeighborhoodChange={setOriginNeighborhood}
              historyAddresses={historyAddresses}
              placeholder="Digite rua, avenida, número ou CEP..."
              className="rounded-xl h-9.5 text-xs bg-background border-border/70 font-medium"
              required
            />
            <Input
              value={originNeighborhood}
              onChange={(e) => setOriginNeighborhood(e.target.value)}
              placeholder="Bairro / Cidade de Coleta"
              className="rounded-xl h-8.5 text-xs bg-background border-border/70"
            />
          </div>

          {/* Destination */}
          <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-rose-600 dark:text-rose-400">
              <div className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />
              PONTO B (ENTREGA / DESTINO)
            </div>
            <AddressAutocompleteInput
              value={destinationAddress}
              onChange={setDestinationAddress}
              neighborhoodValue={destinationNeighborhood}
              onNeighborhoodChange={setDestinationNeighborhood}
              historyAddresses={historyAddresses}
              placeholder="Digite rua, avenida, número ou CEP..."
              className="rounded-xl h-9.5 text-xs bg-background border-border/70 font-medium"
              required
            />
            <Input
              value={destinationNeighborhood}
              onChange={(e) => setDestinationNeighborhood(e.target.value)}
              placeholder="Bairro / Cidade de Entrega"
              className="rounded-xl h-8.5 text-xs bg-background border-border/70"
            />
          </div>
        </div>

        {/* Distance Controls & Quick Presets */}
        <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/15 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-foreground">Distância do Trajeto:</span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={distanceKm || ''}
                  onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 0)}
                  className="w-24 h-9 rounded-xl text-center font-black text-sm bg-background border-primary/40 focus-visible:ring-primary"
                />
                <span className="text-xs font-bold text-primary">KM</span>
              </div>
            </div>

            {/* Round Trip Toggle */}
            <button
              type="button"
              onClick={() => setIsRoundTrip(!isRoundTrip)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isRoundTrip
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-background hover:bg-muted text-muted-foreground border-border/70'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Ida e Volta ({isRoundTrip ? 'Ativo 2x' : 'Somente Ida'})
            </button>
          </div>

          {/* Quick Distance Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
              Atalhos KM:
            </span>
            {DISTANCE_PRESETS.map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => setDistanceKm(km)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors border cursor-pointer ${
                  distanceKm === km
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted text-foreground border-border/60'
                }`}
              >
                {km} km
              </button>
            ))}
          </div>

          {/* Total calculated km tag */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-primary/10">
            <span className="text-muted-foreground">
              Total Faturado: <strong className="text-foreground">{totalCalculatedKm.toFixed(1)} km</strong>
              {isRoundTrip && ' (Ida + Retorno)'}
            </span>
            <span className="text-muted-foreground font-medium">
              Tarifa KM: <strong className="text-primary">{formatBRL(pricePerKm * totalCalculatedKm)}</strong>
            </span>
          </div>
        </div>

        {/* Additional Stops (Multi-Entregas) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              Paradas Extras / Entregas Fracionadas ({additionalStops.length})
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddStop}
              className="rounded-xl h-7.5 px-2.5 text-xs font-bold gap-1 border-border/80 hover:bg-muted cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Parada
            </Button>
          </div>

          {additionalStops.map((stop, idx) => (
            <div key={stop.id || idx} className="p-3 rounded-2xl bg-muted/20 border border-border/60 flex items-start gap-2.5">
              <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0 mt-1">
                {idx + 1}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                <div className="sm:col-span-2">
                  <AddressAutocompleteInput
                    value={stop.address}
                    onChange={(val) => handleUpdateStop(idx, 'address', val)}
                    neighborhoodValue={stop.neighborhood}
                    onNeighborhoodChange={(val) => handleUpdateStop(idx, 'neighborhood', val)}
                    historyAddresses={historyAddresses}
                    placeholder="Endereço da parada / CEP..."
                    className="rounded-xl h-8.5 text-xs bg-background border-border/70"
                  />
                </div>
                <Input
                  value={stop.neighborhood || ''}
                  onChange={(e) => handleUpdateStop(idx, 'neighborhood', e.target.value)}
                  placeholder="Bairro / Observação"
                  className="rounded-xl h-8.5 text-xs bg-background border-border/70"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveStop(idx)}
                className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. ESPECIFICAÇÕES DA CARGA (OPCIONAL) */}
      <div className="bg-card border border-border/80 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground">
              4. Peso e Valor Declarado (Opcional)
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Capacidade máxima suportada: Até 50Kg (Bauleto / amarração).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground flex items-center gap-1">
              <Weight className="w-3 h-3 text-muted-foreground" /> Peso Estimado (kg):
            </label>
            <Input
              type="number"
              step="1"
              value={cargoWeightKg || ''}
              onChange={(e) => setCargoWeightKg(parseFloat(e.target.value) || undefined)}
              placeholder="Ex: 15 (Capacidade máx: 50kg)"
              className="rounded-xl h-9.5 text-xs bg-background border-border/70"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-muted-foreground" /> Valor Declarado da Mercadoria (R$):
            </label>
            <DecimalInput
              value={cargoValue || 0}
              onChange={(v) => setCargoValue(v > 0 ? v : undefined)}
              placeholder="0,00"
              className="rounded-xl h-9.5 text-xs bg-background border-border/70 font-semibold text-foreground"
            />
          </div>
        </div>
      </div>

      {/* 5. QUICK ADD-ONS & EXTRA FEES GRID (1-CLICK TOTAL ADJUSTERS) */}
      <div className="bg-card border border-border/80 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground">
                5. Adicionais & Taxas Extras
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Adicione serviços complementares com valores pré-calculados ou personalizados.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Ajudante / Carga Pesada */}
          <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                📦 Carga Pesada / Ajudante
              </span>
              <DecimalInput
                value={heavyCargoFee}
                onChange={setHeavyCargoFee}
                className="w-24 h-8 text-xs text-right font-black rounded-xl bg-background"
              />
            </div>
            <div className="flex gap-1">
              {[0, 30, 50, 80].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setHeavyCargoFee(v)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    heavyCargoFee === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border/60 hover:bg-muted'
                  }`}
                >
                  {v === 0 ? 'Sem' : `R$${v}`}
                </button>
              ))}
            </div>
          </div>

          {/* Subida de Escadas */}
          <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                🪜 Escadas / Sem Elevador
              </span>
              <DecimalInput
                value={stairsFloorFee}
                onChange={setStairsFloorFee}
                className="w-24 h-8 text-xs text-right font-black rounded-xl bg-background"
              />
            </div>
            <div className="flex gap-1">
              {[0, 15, 30, 50].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStairsFloorFee(v)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    stairsFloorFee === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border/60 hover:bg-muted'
                  }`}
                >
                  {v === 0 ? 'Sem' : `R$${v}`}
                </button>
              ))}
            </div>
          </div>

          {/* Urgência / Chuva */}
          <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                ⚡ Taxa de Urgência
              </span>
              <DecimalInput
                value={urgentOrRainFee}
                onChange={setUrgentOrRainFee}
                className="w-24 h-8 text-xs text-right font-black rounded-xl bg-background"
              />
            </div>
            <div className="flex gap-1">
              {[0, 15, 25, 40].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setUrgentOrRainFee(v)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    urgentOrRainFee === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border/60 hover:bg-muted'
                  }`}
                >
                  {v === 0 ? 'Sem' : `R$${v}`}
                </button>
              ))}
            </div>
          </div>

          {/* Noturno / Fim de Semana */}
          <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                🌙 Noturno / Domingo
              </span>
              <DecimalInput
                value={nightFee}
                onChange={setNightFee}
                className="w-24 h-8 text-xs text-right font-black rounded-xl bg-background"
              />
            </div>
            <div className="flex gap-1">
              {[0, 20, 35, 50].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setNightFee(v)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    nightFee === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border/60 hover:bg-muted'
                  }`}
                >
                  {v === 0 ? 'Sem' : `R$${v}`}
                </button>
              ))}
            </div>
          </div>

          {/* Pedágio / Balsas */}
          <div className="p-3 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                🛣️ Pedágio / Balsa
              </span>
              <DecimalInput
                value={tollsFee}
                onChange={setTollsFee}
                className="w-24 h-8 text-xs text-right font-black rounded-xl bg-background"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {[
                { label: 'Sem', val: 0 },
                { label: 'R$ 3,30', val: 3.30 },
                { label: 'R$ 9,20', val: 9.20 },
                { label: 'R$ 18,40', val: 18.40 },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setTollsFee(item.val)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    tollsFee === item.val
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border/60 hover:bg-muted'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Pricing Accordion Toggle */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAdvancedPricing(!showAdvancedPricing)}
            className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer py-1"
          >
            {showAdvancedPricing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showAdvancedPricing ? 'Ocultar Detalhes das Tarifas Base' : 'Ajustar Tarifas Base deste Orçamento (Taxa Saída, R$/KM, Consumo)'}
          </button>

          {showAdvancedPricing && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 p-3.5 rounded-2xl bg-muted/30 border border-border/60 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-foreground">Taxa Base de Saída:</label>
                <DecimalInput
                  value={baseFee}
                  onChange={setBaseFee}
                  className="h-8.5 rounded-xl bg-background font-bold text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-foreground">Preço por KM:</label>
                <DecimalInput
                  value={pricePerKm}
                  onChange={setPricePerKm}
                  className="h-8.5 rounded-xl bg-background font-bold text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-foreground">Consumo (KM/L):</label>
                <Input
                  type="number"
                  step="0.5"
                  value={kmPerLiter}
                  onChange={(e) => setKmPerLiter(parseFloat(e.target.value) || 35)}
                  className="h-8.5 rounded-xl bg-background font-bold text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-foreground">Preço Gasolina/Litro:</label>
                <DecimalInput
                  value={fuelPrice}
                  onChange={setFuelPrice}
                  className="h-8.5 rounded-xl bg-background font-bold text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. DEDICATED DISCOUNT & CLOSED PRICE (AJUSTE COMERCIAL) */}
      <div className="bg-card border border-border/80 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground">
                6. Desconto Comercial & Preço Fechado
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Aplique desconto percentual, abatimento em reais ou defina um preço final fechado.
              </p>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex items-center bg-muted/50 p-1 rounded-2xl border border-border/60 shrink-0">
            <button
              type="button"
              onClick={() => {
                setDiscountType('percent');
                if (discountType === 'total_fixed') setDiscountValue(0);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                discountType === 'percent'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Porcentagem (%)
            </button>
            <button
              type="button"
              onClick={() => {
                setDiscountType('fixed');
                if (discountType === 'total_fixed') setDiscountValue(0);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                discountType === 'fixed'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Valor Fixo (R$)
            </button>
            <button
              type="button"
              onClick={() => {
                setDiscountType('total_fixed');
                if (!discountValue || discountValue === 0) {
                  setDiscountValue(financialCalculations.subtotal);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                discountType === 'total_fixed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🔒 Preço Fechado
            </button>
          </div>
        </div>

        {/* Discount Input Area according to Mode */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-center">
          <div className="md:col-span-2 space-y-2">
            {discountType === 'percent' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">
                    Desconto em Porcentagem (% sobre o subtotal de {formatBRL(financialCalculations.subtotal)}):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={discountValue || ''}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-24 h-9 rounded-xl text-center font-black text-sm bg-background border-border/80"
                    />
                    <span className="text-xs font-bold text-muted-foreground">%</span>
                  </div>
                </div>

                {/* Shortcuts */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Atalhos:</span>
                  {[0, 5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountValue(pct)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        discountValue === pct
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/60'
                      }`}
                    >
                      {pct === 0 ? 'Sem Desconto' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {discountType === 'fixed' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">
                    Abatimento Fixo em Reais (R$):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <DecimalInput
                      value={discountValue}
                      onChange={setDiscountValue}
                      className="w-32 h-9 rounded-xl text-right font-black text-sm bg-background border-border/80"
                    />
                  </div>
                </div>

                {/* Shortcuts */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Atalhos:</span>
                  {[0, 5, 10, 20, 50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDiscountValue(val)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        discountValue === val
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/60'
                      }`}
                    >
                      {val === 0 ? 'Sem Desconto' : `- R$ ${val}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {discountType === 'total_fixed' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-foreground block">
                      Valor Final Fechado (Acordo Comercial):
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Subtotal calculado: {formatBRL(financialCalculations.subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DecimalInput
                      value={discountValue}
                      onChange={setDiscountValue}
                      placeholder={financialCalculations.subtotal.toFixed(2)}
                      className="w-36 h-9 rounded-xl text-right font-black text-base bg-background text-emerald-600 dark:text-emerald-400 border-emerald-500/50 focus-visible:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Shortcuts */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Arredondar:</span>
                  {[
                    Math.floor(financialCalculations.subtotal),
                    Math.round(financialCalculations.subtotal / 10) * 10,
                    Math.ceil(financialCalculations.subtotal / 50) * 50,
                  ].filter((v, idx, arr) => v > 0 && arr.indexOf(v) === idx).map((rnd) => (
                    <button
                      key={rnd}
                      type="button"
                      onClick={() => setDiscountValue(rnd)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        discountValue === rnd
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border/60'
                      }`}
                    >
                      {formatBRL(rnd)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('fixed');
                      setDiscountValue(0);
                    }}
                    className="px-2.5 py-1 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 border border-border/60 cursor-pointer ml-auto"
                  >
                    Remover Fechado
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Summary Box */}
          <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 text-xs space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal Inicial:</span>
              <span className="font-semibold text-foreground">{formatBRL(financialCalculations.subtotal)}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>Desconto Aplicado:</span>
              <span>- {formatBRL(financialCalculations.calculatedDiscount)}</span>
            </div>
            <div className="flex justify-between font-black text-sm text-foreground pt-1.5 border-t border-border/40">
              <span>Valor Faturado:</span>
              <span className="text-primary">{formatBRL(financialCalculations.finalTotalPrice)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. FINANCIAL TELEMETRY COCKPIT & PROFITABILITY HUD */}
      <div className="bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-foreground">
                7. Demonstração Financeira & Lucratividade Real
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Cálculo instantâneo de faturamento, consumo de combustível, desgaste e margem líquida.
              </p>
            </div>
          </div>

          {/* Profit Margin Pill */}
          <div className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 border ${
            financialCalculations.marginPercent >= 60
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : financialCalculations.marginPercent >= 35
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
          }`}>
            <Percent className="w-3.5 h-3.5" />
            {financialCalculations.marginPercent.toFixed(0)}% Margem Líquida
          </div>
        </div>

        {/* Financial KPIs 4-Card Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-card border border-border/60 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
              Valor Bruto do Frete
            </span>
            <p className="text-xl sm:text-2xl font-black text-primary">
              {formatBRL(financialCalculations.finalTotalPrice)}
            </p>
            <span className="text-[10px] text-muted-foreground">Preço final ao cliente</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-card border border-border/60 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
              Combustível Estimado
            </span>
            <p className="text-xl sm:text-2xl font-black text-foreground">
              {formatBRL(financialCalculations.fuelCost)}
            </p>
            <span className="text-[10px] text-muted-foreground">
              {financialCalculations.litersNeeded.toFixed(1)} L ({kmPerLiter} km/l)
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-card border border-border/60 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
              Desgaste / Manutenção
            </span>
            <p className="text-xl sm:text-2xl font-black text-muted-foreground">
              {formatBRL(financialCalculations.maintenanceCost)}
            </p>
            <span className="text-[10px] text-muted-foreground">Pneus, óleo e revisão</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
              Lucro Líquido Real
            </span>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatBRL(financialCalculations.netProfit)}
            </p>
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-semibold">
              Fica no seu bolso
            </span>
          </div>
        </div>

        {/* Payment and Terms */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-foreground flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-muted-foreground" /> Forma de Pagamento Sugerida:
            </label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <SelectTrigger className="h-9.5 rounded-xl bg-background border-border/70 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX (Chave Cadastrada)</SelectItem>
                <SelectItem value="cash">Dinheiro na Entrega</SelectItem>
                <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                <SelectItem value="invoice_15">Faturado 15 Dias (B2B)</SelectItem>
                <SelectItem value="invoice_30">Faturado 30 Dias (B2B)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-foreground flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" /> Validade do Orçamento:
            </label>
            <Select value={String(validDays)} onValueChange={(v) => setValidDays(parseInt(v) || 2)}>
              <SelectTrigger className="h-9.5 rounded-xl bg-background border-border/70 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Válido por 24 horas</SelectItem>
                <SelectItem value="2">Válido por 48 horas (Padrão)</SelectItem>
                <SelectItem value="7">Válido por 7 dias</SelectItem>
                <SelectItem value="15">Válido por 15 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 7. FLOATING / STICKY HIGH-CONVERSION ACTIONS COCKPIT */}
      <div className="fixed bottom-14 md:bottom-0 left-0 right-0 md:left-64 lg:left-72 z-30 bg-background/95 backdrop-blur-md border-t border-border/80 px-3 py-2 sm:px-4 sm:py-2.5 shadow-xl transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5 sm:gap-3">
          {/* Left Price preview */}
          <div className="flex items-center gap-3 shrink-0">
            <div>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground font-bold uppercase tracking-wider block leading-none">
                Total do Frete
              </span>
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                  {formatBRL(financialCalculations.finalTotalPrice)}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">
                  ({totalCalculatedKm.toFixed(1)} km)
                </span>
              </div>
            </div>

            <div className="hidden lg:block border-l border-border/60 pl-3">
              <span className="text-[9px] text-muted-foreground block font-medium">Lucro Líquido</span>
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatBRL(financialCalculations.netProfit)} ({financialCalculations.marginPercent.toFixed(0)}%)
              </span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onCancelEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancelEdit}
                className="rounded-xl h-8.5 px-2 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancelar
              </Button>
            )}

            <Button
              type="button"
              onClick={handleQuickSharePDF}
              disabled={isSharingPdf}
              size="sm"
              className="rounded-xl h-8.5 sm:h-9 px-2.5 sm:px-3.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer shadow-xs"
              title="Compartilhar Proposta PDF com mensagem de anexo"
            >
              {isSharingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden xs:inline">{isSharingPdf ? 'Gerando...' : 'Compartilhar PDF'}</span>
            </Button>

            <Button
              type="button"
              onClick={handleQuickProposal}
              size="sm"
              className="rounded-xl h-8.5 sm:h-9 px-2.5 sm:px-3.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer shadow-xs"
              title="Visualizar Proposta Comercial em PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Ver PDF</span>
            </Button>

            <Button
              type="submit"
              size="sm"
              className="rounded-xl h-8.5 sm:h-9 px-3 sm:px-4 text-xs font-black bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar</span>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
