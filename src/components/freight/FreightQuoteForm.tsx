import React, { useState, useEffect, useMemo } from 'react';
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
  RotateCcw, 
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
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { FreightQuote, VehicleType, ServiceType, PaymentMethod, RouteStop, DriverFreightPreset, FreightClient, VehicleConfigItem } from '../../types/freight';
import { freightStorage } from '../../lib/freightStorage';
import { useData } from '../../contexts/DataContext';

interface FreightQuoteFormProps {
  initialQuote?: FreightQuote | null;
  onSaveQuote: (quote: FreightQuote) => void;
  onOpenWhatsApp: (quote: FreightQuote) => void;
  onOpenProposal: (quote: FreightQuote) => void;
  onCancelEdit?: () => void;
  userId?: string;
}

export function FreightQuoteForm({
  initialQuote,
  onSaveQuote,
  onOpenWhatsApp,
  onOpenProposal,
  onCancelEdit,
  userId = 'default',
}: FreightQuoteFormProps) {
  const { settings } = useData();

  // Load driver preset & sync from database
  const [preset, setPreset] = useState<DriverFreightPreset>(() => freightStorage.getPreset(userId));

  useEffect(() => {
    freightStorage.syncPresetFromDatabase(userId).then(loadedPreset => {
      setPreset(loadedPreset);
      if (!initialQuote) {
        setBaseFee(loadedPreset.default_base_fee ?? 12);
        setPricePerKm(loadedPreset.default_price_per_km ?? 2.8);
        setPaymentMethod(loadedPreset.default_payment_method || 'pix');
        setPixKey(loadedPreset.pix_key || '');
        setPixKeyType(loadedPreset.pix_key_type || 'phone');
        setDriverName(loadedPreset.driver_name || settings?.full_name || '');
        setDriverPhone(loadedPreset.driver_phone || '');
        setDriverCompany(loadedPreset.driver_company || '');
        setDriverDocument(loadedPreset.driver_document || '');
        setTermsAndConditions(loadedPreset.default_terms || '');
      }
    });
  }, [userId, initialQuote, settings?.full_name]);

  // Load saved clients for autocomplete
  const [savedClients, setSavedClients] = useState<FreightClient[]>(() => freightStorage.getClients(userId));

  useEffect(() => {
    freightStorage.syncClientsFromDatabase(userId).then(clients => {
      setSavedClients(clients);
    });
  }, [userId]);

  // Form State (Vehicle is strictly Motocicleta)
  const vehicleType: VehicleType = 'moto';
  const [serviceType, setServiceType] = useState<ServiceType>(initialQuote?.service_type || 'express');
  const [status, setStatus] = useState<FreightQuote['status']>(initialQuote?.status || 'pending');

  // Client Info
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientName, setClientName] = useState(initialQuote?.client_name || '');
  const [clientPhone, setClientPhone] = useState(initialQuote?.client_phone || '');
  const [clientCompany, setClientCompany] = useState(initialQuote?.client_company || '');
  const [clientDocument, setClientDocument] = useState(initialQuote?.client_document || '');
  const [clientEmail, setClientEmail] = useState(initialQuote?.client_email || '');

  // Route & Stops
  const [originAddress, setOriginAddress] = useState(initialQuote?.origin_address || '');
  const [originNeighborhood, setOriginNeighborhood] = useState(initialQuote?.origin_neighborhood || '');
  const [destinationAddress, setDestinationAddress] = useState(initialQuote?.destination_address || '');
  const [destinationNeighborhood, setDestinationNeighborhood] = useState(initialQuote?.destination_neighborhood || '');
  const [additionalStops, setAdditionalStops] = useState<RouteStop[]>(initialQuote?.additional_stops || []);
  const [distanceKm, setDistanceKm] = useState<number>(initialQuote?.distance_km || 10);
  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(initialQuote?.is_round_trip || false);

  // Cargo & Scheduling
  const [cargoDescription, setCargoDescription] = useState(initialQuote?.cargo_description || 'Encomendas / Volumes gerais');
  const [cargoWeightKg, setCargoWeightKg] = useState<number | undefined>(initialQuote?.cargo_weight_kg);
  const [cargoValue, setCargoValue] = useState<number | undefined>(initialQuote?.cargo_value);
  const [scheduledDate, setScheduledDate] = useState(initialQuote?.scheduled_date || new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState(initialQuote?.scheduled_time || ''); // Horário do frete (Opcional)

  // Pricing & Fees (Loads preset defaults properly)
  const [baseFee, setBaseFee] = useState<number>(initialQuote?.base_fee ?? preset.default_base_fee ?? 12);
  const [pricePerKm, setPricePerKm] = useState<number>(initialQuote?.price_per_km ?? preset.default_price_per_km ?? 2.8);
  const [extraStopsFee, setExtraStopsFee] = useState<number>(initialQuote?.extra_stops_fee || 0);
  const [heavyCargoFee, setHeavyCargoFee] = useState<number>(initialQuote?.heavy_cargo_fee || 0);
  const [stairsFloorFee, setStairsFloorFee] = useState<number>(initialQuote?.stairs_floor_fee || 0);
  const [urgentOrRainFee, setUrgentOrRainFee] = useState<number>(initialQuote?.urgent_or_rain_fee || 0);
  const [nightFee, setNightFee] = useState<number>(initialQuote?.night_fee || 0);
  const [tollsFee, setTollsFee] = useState<number>(initialQuote?.tolls_fee || 0);
  const [waitingHoursFee, setWaitingHoursFee] = useState<number>(initialQuote?.waiting_hours_fee || 0);

  // Price Adjustment State: Valor Fixo (R$), Porcentagem (%), ou Total Fixo (Preço Fechado)
  const [discountType, setDiscountType] = useState<'fixed' | 'percent' | 'total_fixed'>(initialQuote?.discount_type || 'fixed');
  const [discountValue, setDiscountValue] = useState<number>(initialQuote?.discount_value ?? initialQuote?.discount ?? 0);

  // Driver Cost & Fuel Params (From Settings / Presets)
  const fuelPrice = settings?.fuel_price || 5.89;
  const kmPerLiter = settings?.vehicle_km_per_liter || 35;
  const maintenanceCostPerKm = preset.default_maintenance_per_km || 0.25;

  // Payment & Terms
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialQuote?.payment_method || preset.default_payment_method || 'pix');
  const [pixKey, setPixKey] = useState(initialQuote?.pix_key || preset.pix_key || '');
  const [pixKeyType, setPixKeyType] = useState(initialQuote?.pix_key_type || preset.pix_key_type || 'phone');
  const [driverName, setDriverName] = useState(initialQuote?.driver_name || preset.driver_name || settings?.full_name || '');
  const [driverPhone, setDriverPhone] = useState(initialQuote?.driver_phone || preset.driver_phone || '');
  const [driverCompany, setDriverCompany] = useState(initialQuote?.driver_company || preset.driver_company || '');
  const [driverDocument, setDriverDocument] = useState(initialQuote?.driver_document || preset.driver_document || '');
  const [observations, setObservations] = useState(initialQuote?.observations || '');
  const [termsAndConditions, setTermsAndConditions] = useState(initialQuote?.terms_and_conditions || preset.default_terms || '');
  const [validDays, setValidDays] = useState<number>(2);

  // Accordion for advanced fees
  const [showAdvancedFees, setShowAdvancedFees] = useState(false);

  // Client Autocomplete selection handler
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) return;
    const client = savedClients.find(c => c.id === clientId);
    if (client) {
      setClientName(client.name || '');
      setClientPhone(client.phone || '');
      setClientCompany(client.company || '');
      setClientDocument(client.document || '');
      setClientEmail(client.email || '');
      toast.success(`Cliente "${client.name}" selecionado!`);
    }
  };

  // Re-apply preset rates handler
  const handleApplyPresetRates = () => {
    const currentPreset = freightStorage.getPreset(userId);
    setBaseFee(currentPreset.default_base_fee ?? 12);
    setPricePerKm(currentPreset.default_price_per_km ?? 2.8);
    setExtraStopsFee(additionalStops.length * (currentPreset.default_stop_fee ?? 6));
    toast.success('Tarifas padrão aplicadas no orçamento!', {
      description: `Taxa Saída: R$ ${(currentPreset.default_base_fee ?? 12).toFixed(2)} | KM: R$ ${(currentPreset.default_price_per_km ?? 2.8).toFixed(2)}/km`,
    });
  };

  // Auto-calculate extra stops fee if count changes
  useEffect(() => {
    if (additionalStops.length > 0 && extraStopsFee === 0) {
      setExtraStopsFee(additionalStops.length * (preset.default_stop_fee || 6));
    }
  }, [additionalStops.length]);

  // Real-time calculations
  const totalCalculatedKm = useMemo(() => {
    const base = Number(distanceKm) || 0;
    return isRoundTrip ? base * 2 : base;
  }, [distanceKm, isRoundTrip]);

  const financialCalculations = useMemo(() => {
    const km = totalCalculatedKm;
    const kmTotalRevenue = km * (Number(pricePerKm) || 0);
    const subtotal = 
      (Number(baseFee) || 0) +
      kmTotalRevenue +
      (Number(extraStopsFee) || 0) +
      (Number(heavyCargoFee) || 0) +
      (Number(stairsFloorFee) || 0) +
      (Number(urgentOrRainFee) || 0) +
      (Number(nightFee) || 0) +
      (Number(tollsFee) || 0) +
      (Number(waitingHoursFee) || 0);

    let finalTotalPrice = 0;
    let calculatedDiscount = 0;

    if (discountType === 'total_fixed') {
      // PREÇO TOTAL FECHADO (Determine final total directly)
      finalTotalPrice = Math.max(0, Number(discountValue) || 0);
      calculatedDiscount = Math.max(0, subtotal - finalTotalPrice);
    } else if (discountType === 'percent') {
      // DESCONTO EM %
      calculatedDiscount = (subtotal * (Number(discountValue) || 0)) / 100;
      finalTotalPrice = Math.max(0, subtotal - calculatedDiscount);
    } else {
      // DESCONTO FIXO EM R$
      calculatedDiscount = Number(discountValue) || 0;
      finalTotalPrice = Math.max(0, subtotal - calculatedDiscount);
    }

    // Real Driver Costs
    const fuelCost = kmPerLiter > 0 ? (km / kmPerLiter) * fuelPrice : 0;
    const maintenanceCost = km * maintenanceCostPerKm;
    const directDriverCosts = fuelCost + maintenanceCost + (Number(tollsFee) || 0);
    const netProfit = Math.max(0, finalTotalPrice - directDriverCosts);
    const marginPercent = finalTotalPrice > 0 ? (netProfit / finalTotalPrice) * 100 : 0;

    return {
      subtotal,
      calculatedDiscount,
      finalTotalPrice,
      fuelCost,
      maintenanceCost,
      directDriverCosts,
      netProfit,
      marginPercent,
      kmTotalRevenue,
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

  const handleClearDiscount = () => {
    setDiscountValue(0);
    toast.info('Ajuste de preço resetado.');
  };

  // Add stop
  const handleAddStop = () => {
    const newStop: RouteStop = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      address: '',
    };
    setAdditionalStops([...additionalStops, newStop]);
  };

  const handleUpdateStop = (id: string, address: string) => {
    setAdditionalStops(additionalStops.map(s => s.id === id ? { ...s, address } : s));
  };

  const handleRemoveStop = (id: string) => {
    setAdditionalStops(additionalStops.filter(s => s.id !== id));
  };

  // Build Quote Object
  const buildQuoteObject = (): FreightQuote => {
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + (validDays || 2));

    const quoteId = initialQuote?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `frt_${Date.now()}`);
    const code = initialQuote?.code || freightStorage.generateNextCode(userId);

    return {
      id: quoteId,
      user_id: userId,
      code,
      created_at: initialQuote?.created_at || new Date().toISOString(),
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

      vehicle_type: vehicleType,
      service_type: serviceType,
      origin_address: originAddress.trim() || 'Ponto de Coleta',
      origin_neighborhood: originNeighborhood.trim(),
      destination_address: destinationAddress.trim() || 'Ponto de Entrega',
      destination_neighborhood: destinationNeighborhood.trim(),
      additional_stops: additionalStops.filter(s => s.address.trim().length > 0),
      distance_km: Number(distanceKm) || 0,
      is_round_trip: isRoundTrip,
      total_calculated_km: totalCalculatedKm,

      cargo_description: cargoDescription.trim() || 'Volumes diversos',
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

  const handleQuickWhatsApp = () => {
    if (!originAddress || !destinationAddress) {
      toast.error('Preencha ao menos a rota para gerar a mensagem de WhatsApp.');
      return;
    }
    const quote = buildQuoteObject();
    onSaveQuote(quote);
    onOpenWhatsApp(quote);
  };

  const handleQuickProposal = () => {
    if (!originAddress || !destinationAddress) {
      toast.error('Preencha ao menos a rota para visualizar a proposta formal.');
      return;
    }
    const quote = buildQuoteObject();
    onSaveQuote(quote);
    onOpenProposal(quote);
  };

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {/* VEHICLE INFO BANNER (MOTOCICLETA EXCLUSIVA) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-3xl bg-card border border-border/80 shadow-xs gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Bike className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-foreground">
                Modalidade: Motocicleta (Frete Express)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Ativo
              </span>
            </div>
            <span className="text-xs text-muted-foreground block mt-0.5">
              Ideal para documentos, pequenos/médios pacotes e transporte ágil.
            </span>
          </div>
        </div>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleApplyPresetRates}
          className="rounded-2xl h-9 text-xs font-extrabold gap-1.5 cursor-pointer text-primary border-primary/30 hover:bg-primary/10 shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Recarregar Tarifas Padrão
        </Button>
      </div>

      {/* FORM BODY GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: CLIENT & ROUTE & CARGO (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* CLIENT INFO CARD WITH AUTOCOMPLETE */}
          <Card className="border-border/60 bg-card/75 shadow-xs rounded-3xl overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Dados do Cliente
              </CardTitle>

              {/* AUTOCOMPLETE CLIENT SELECTOR */}
              {savedClients.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <Select value={selectedClientId} onValueChange={handleSelectClient}>
                    <SelectTrigger className="h-8 text-xs rounded-xl bg-background border-border/80 w-full sm:w-48">
                      <SelectValue placeholder="Autocompletar Cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none_clear">Nenhum (Limpar)</SelectItem>
                      {savedClients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-foreground flex items-center justify-between">
                    <span>Nome do Cliente / Contato *</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Salvo automaticamente</span>
                  </label>
                  <Input
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Carlos Silva ou Empresa ABC"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">WhatsApp / Telefone:</label>
                  <Input
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(11) 98888-8888"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Empresa (opcional):</label>
                  <Input
                    value={clientCompany}
                    onChange={(e) => setClientCompany(e.target.value)}
                    placeholder="Razão Social"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">CPF ou CNPJ (opcional):</label>
                  <Input
                    value={clientDocument}
                    onChange={(e) => setClientDocument(e.target.value)}
                    placeholder="000.000.000-00"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">E-mail (opcional):</label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ROUTE & ITINERARY CARD */}
          <Card className="border-border/60 bg-card/75 shadow-xs rounded-3xl overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Itinerário & Rota
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Endereço de coleta, entrega e paradas adicionais
                </CardDescription>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddStop}
                className="rounded-xl h-8 text-[11px] font-bold border-border/80 gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                Add Parada
              </Button>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Coleta */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-[11px] uppercase tracking-wider">
                    Ponto de Coleta (Origem) *
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <Input
                      required
                      value={originAddress}
                      onChange={(e) => setOriginAddress(e.target.value)}
                      placeholder="Rua, Número, Bairro, Cidade"
                      className="rounded-xl h-9 text-xs bg-background"
                    />
                  </div>
                  <div>
                    <Input
                      value={originNeighborhood}
                      onChange={(e) => setOriginNeighborhood(e.target.value)}
                      placeholder="Bairro / Referência"
                      className="rounded-xl h-9 text-xs bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Paradas Adicionais */}
              {additionalStops.map((stop, idx) => (
                <div key={stop.id} className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px] uppercase">
                        Parada Intermediária #{idx + 1}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveStop(stop.id)}
                      className="text-muted-foreground hover:text-rose-500 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Input
                    value={stop.address}
                    onChange={(e) => handleUpdateStop(stop.id, e.target.value)}
                    placeholder="Endereço da parada intermediária"
                    className="rounded-xl h-9 text-xs bg-background"
                  />
                </div>
              ))}

              {/* Entrega */}
              <div className="p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/20" />
                  <span className="font-black text-rose-600 dark:text-rose-400 text-[11px] uppercase tracking-wider">
                    Ponto de Entrega (Destino Final) *
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <Input
                      required
                      value={destinationAddress}
                      onChange={(e) => setDestinationAddress(e.target.value)}
                      placeholder="Rua, Número, Bairro, Cidade"
                      className="rounded-xl h-9 text-xs bg-background"
                    />
                  </div>
                  <div>
                    <Input
                      value={destinationNeighborhood}
                      onChange={(e) => setDestinationNeighborhood(e.target.value)}
                      placeholder="Bairro / Referência"
                      className="rounded-xl h-9 text-xs bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Distância e Opção Ida e Volta */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-foreground flex items-center justify-between">
                    <span>Distância Estimada (KM):</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Ex: 12,5</span>
                  </label>
                  <DecimalInput
                    value={distanceKm}
                    onChange={(val) => setDistanceKm(val)}
                    suffix="KM"
                    className="rounded-xl h-10 text-xs font-black text-primary"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border/60">
                  <div>
                    <span className="font-bold text-foreground block text-xs">Cobrar Retorno (Ida e Volta)</span>
                    <span className="text-[10px] text-muted-foreground">
                      Total: {totalCalculatedKm.toFixed(1)} km rodados
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isRoundTrip}
                    onChange={(e) => setIsRoundTrip(e.target.checked)}
                    className="h-5 w-5 rounded-md border-border text-primary cursor-pointer accent-primary"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CARGO & SCHEDULE CARD */}
          <Card className="border-border/60 bg-card/75 shadow-xs rounded-3xl overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/20">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Carga & Agendamento
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-foreground flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Descrição da Mercadoria / Volumes:</span>
                </label>
                <Input
                  value={cargoDescription}
                  onChange={(e) => setCargoDescription(e.target.value)}
                  placeholder="Ex: 3 Caixas de calçados (peso total aprox 15kg)"
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 min-[440px]:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block truncate">
                    Peso (kg):
                  </label>
                  <DecimalInput
                    value={cargoWeightKg}
                    onChange={(val) => setCargoWeightKg(val > 0 ? val : undefined)}
                    suffix="kg"
                    placeholder="Ex: 12,5"
                    className="rounded-xl h-10 text-xs w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground block truncate">
                    Valor Declarado (R$):
                  </label>
                  <DecimalInput
                    value={cargoValue}
                    onChange={(val) => setCargoValue(val > 0 ? val : undefined)}
                    prefix="R$"
                    placeholder="Ex: 500,00"
                    className="rounded-xl h-10 text-xs w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground flex items-center gap-1 block truncate">
                    <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Data do Frete:</span>
                  </label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="rounded-xl h-10 text-xs w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground flex items-center gap-1 block truncate">
                    <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Horário (Opcional):</span>
                  </label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="rounded-xl h-10 text-xs w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: PRICING & PRICE ADJUSTMENT MODES (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* PRICING BREAKDOWN CARD */}
          <Card className="border-border/80 bg-card shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
              <CardTitle className="text-sm font-black flex items-center justify-between">
                <span>Composição de Preço & Tarifas</span>
                <span className="text-[11px] font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                  {formatBRL(financialCalculations.finalTotalPrice)}
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-foreground">Taxa Base / Saída (R$):</label>
                  <DecimalInput
                    value={baseFee}
                    onChange={(val) => setBaseFee(val)}
                    prefix="R$"
                    className="rounded-xl h-10 text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Preço por KM (R$):</label>
                  <DecimalInput
                    value={pricePerKm}
                    onChange={(val) => setPricePerKm(val)}
                    prefix="R$"
                    suffix="/km"
                    className="rounded-xl h-10 text-xs font-bold text-primary"
                  />
                </div>
              </div>

              {/* Subtotal da KM */}
              <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Deslocamento ({totalCalculatedKm.toFixed(1)} km × {formatBRL(pricePerKm)}):
                </span>
                <span className="font-black text-foreground">
                  {formatBRL(financialCalculations.kmTotalRevenue)}
                </span>
              </div>

              {/* TOGGLE ADVANCED FEES */}
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAdvancedFees(!showAdvancedFees)}
                  className="w-full justify-between h-9 px-2 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    Taxas Adicionais & Paradas {showAdvancedFees ? '(Ocultar)' : '(Expandir)'}
                  </span>
                  {showAdvancedFees ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>

                {showAdvancedFees && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-muted/20 border border-border/60 space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">Paradas Extras (R$):</label>
                        <DecimalInput
                          value={extraStopsFee}
                          onChange={(val) => setExtraStopsFee(val)}
                          prefix="R$"
                          className="rounded-xl h-8 text-xs bg-background"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">Ajudante / Peso (R$):</label>
                        <DecimalInput
                          value={heavyCargoFee}
                          onChange={(val) => setHeavyCargoFee(val)}
                          prefix="R$"
                          className="rounded-xl h-8 text-xs bg-background"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">Escadas / Andares (R$):</label>
                        <DecimalInput
                          value={stairsFloorFee}
                          onChange={(val) => setStairsFloorFee(val)}
                          prefix="R$"
                          className="rounded-xl h-8 text-xs bg-background"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">Urgência / Chuva (R$):</label>
                        <DecimalInput
                          value={urgentOrRainFee}
                          onChange={(val) => setUrgentOrRainFee(val)}
                          prefix="R$"
                          className="rounded-xl h-8 text-xs bg-background"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">Adicional Noturno (R$):</label>
                        <DecimalInput
                          value={nightFee}
                          onChange={(val) => setNightFee(val)}
                          prefix="R$"
                          className="rounded-xl h-8 text-xs bg-background"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">Pedágios (R$):</label>
                        <DecimalInput
                          value={tollsFee}
                          onChange={(val) => setTollsFee(val)}
                          prefix="R$"
                          className="rounded-xl h-8 text-xs bg-background"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/40">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">Hora Parada / Espera (R$):</label>
                        <DecimalInput
                          value={waitingHoursFee}
                          onChange={(val) => setWaitingHoursFee(val)}
                          prefix="R$"
                          className="rounded-xl h-8 text-xs bg-background"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PRICE ADJUSTMENT MODES: VALOR FIXO (R$), PORCENTAGEM (%), OU VALOR TOTAL FECHADO */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Ajuste de Preço & Desconto
                  </span>
                  {(discountValue > 0 || discountType === 'total_fixed') && (
                    <button
                      type="button"
                      onClick={handleClearDiscount}
                      className="text-[10px] text-rose-500 font-bold hover:underline cursor-pointer"
                    >
                      Resetar
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5 sm:col-span-5">
                    <Select value={discountType} onValueChange={(val: any) => setDiscountType(val)}>
                      <SelectTrigger className="rounded-xl h-9 text-[11px] bg-background font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Desconto R$</SelectItem>
                        <SelectItem value="percent">Desconto %</SelectItem>
                        <SelectItem value="total_fixed">Preço Fechado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-7 sm:col-span-7">
                    <DecimalInput
                      value={discountValue}
                      onChange={(val) => setDiscountValue(val)}
                      prefix={discountType === 'percent' ? '%' : 'R$'}
                      placeholder={discountType === 'total_fixed' ? 'Valor Final R$' : 'Desconto'}
                      className="rounded-xl h-9 text-xs bg-background text-emerald-600 font-bold"
                    />
                  </div>
                </div>

                {/* Explanatory helper badge */}
                <div className="text-[10px] text-muted-foreground">
                  {discountType === 'total_fixed' && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold block">
                      🎯 Preço Fechado Ativo: O orçamento custará exatamente {formatBRL(financialCalculations.finalTotalPrice)}.
                    </span>
                  )}
                  {discountType === 'percent' && (
                    <span>Aplica um desconto percentual sobre o subtotal ({formatBRL(financialCalculations.subtotal)}).</span>
                  )}
                  {discountType === 'fixed' && (
                    <span>Subtrai um valor em dinheiro (R$) diretamente do subtotal.</span>
                  )}
                </div>

                {/* Summary banner */}
                {financialCalculations.calculatedDiscount > 0 && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center justify-between">
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                      {discountType === 'total_fixed' ? 'Diferença / Ajuste:' : 'Desconto Concedido:'}
                    </span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                      -{formatBRL(financialCalculations.calculatedDiscount)}
                    </span>
                  </div>
                )}
              </div>

              {/* PAYMENT METHOD & VALIDADE */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40">
                <div className="space-y-1">
                  <label className="font-bold text-foreground">Forma de Pagamento:</label>
                  <Select value={paymentMethod} onValueChange={(val: any) => setPaymentMethod(val)}>
                    <SelectTrigger className="rounded-xl h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX (À Vista)</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro na Entrega</SelectItem>
                      <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                      <SelectItem value="50_50">50% Saída + 50% Chegada</SelectItem>
                      <SelectItem value="faturado_15d">Faturado 15 Dias</SelectItem>
                      <SelectItem value="faturado_30d">Faturado 30 Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Validade da Proposta:</label>
                  <Select value={String(validDays)} onValueChange={(val) => setValidDays(parseInt(val))}>
                    <SelectTrigger className="rounded-xl h-10 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">24 Horas (1 dia)</SelectItem>
                      <SelectItem value="2">48 Horas (2 dias)</SelectItem>
                      <SelectItem value="5">5 Dias</SelectItem>
                      <SelectItem value="7">7 Dias (1 semana)</SelectItem>
                      <SelectItem value="15">15 Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DRIVER VIABILITY & PROFIT SIMULATOR (EXCLUSIVE PRIVACY VIEW) */}
          <Card className="border-emerald-500/30 bg-gradient-to-br from-card via-card to-emerald-500/5 shadow-xs rounded-3xl overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-emerald-500/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Simulador de Viabilidade & Lucro
                </CardTitle>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  Visão Privada
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                  <span className="text-[11px] font-medium text-muted-foreground block">Combustível Estimado</span>
                  <span className="text-sm font-black text-foreground block mt-0.5">
                    {formatBRL(financialCalculations.fuelCost)}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    ({kmPerLiter} km/L @ R$ {fuelPrice.toFixed(2)})
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-muted/30 border border-border/60">
                  <span className="text-[11px] font-medium text-muted-foreground block">Manutenção & Pneus</span>
                  <span className="text-sm font-black text-foreground block mt-0.5">
                    {formatBRL(financialCalculations.maintenanceCost)}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    (R$ {maintenanceCostPerKm.toFixed(2)}/km)
                  </span>
                </div>
              </div>

              {/* LUCRO LÍQUIDO FINAL */}
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 block">
                    Lucro Líquido no Bolso
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                    Margem de Lucro: {financialCalculations.marginPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block">
                    {formatBRL(financialCalculations.netProfit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ACTION BUTTONS BAR */}
          <div className="space-y-2.5 pt-2">
            <Button
              type="submit"
              className="w-full h-12 rounded-2xl font-black text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-md gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Salvar Orçamento Comercial
            </Button>

            <div className="grid grid-cols-2 gap-2.5">
              <Button
                type="button"
                onClick={handleQuickWhatsApp}
                className="h-11 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                Gerar WhatsApp
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleQuickProposal}
                className="h-11 rounded-2xl font-bold text-xs border-border/80 hover:bg-muted gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-primary" />
                Proposta PDF
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
