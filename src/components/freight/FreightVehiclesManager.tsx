import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DecimalInput } from '@/components/ui/DecimalInput';
import { 
  Bike, 
  Car, 
  Truck, 
  PlusCircle, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  Star, 
  Fuel, 
  Wrench, 
  DollarSign, 
  Weight, 
  Layers, 
  Sliders, 
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { VehicleConfigItem, DriverFreightPreset } from '../../types/freight';
import { freightStorage, DEFAULT_VEHICLES } from '../../lib/freightStorage';

interface FreightVehiclesManagerProps {
  userId?: string;
  onSelectVehicleForQuote?: (vehicle: VehicleConfigItem) => void;
}

const VEHICLE_TYPE_OPTIONS = [
  { id: 'moto', label: 'Motocicleta (Express)', icon: Bike, defaultIcon: 'Bike', defaultCapacity: 'Até 50kg (Baú / Amarração)' },
  { id: 'car', label: 'Carro de Passeio / Sedan', icon: Car, defaultIcon: 'Car', defaultCapacity: 'Até 250kg (Porta-malas)' },
  { id: 'van', label: 'Furgão / Utilitário (Fiorino)', icon: Truck, defaultIcon: 'Truck', defaultCapacity: 'Até 650kg (Volume Médio)' },
  { id: 'truck', label: 'Caminhonete / Baú Médio', icon: Truck, defaultIcon: 'Truck', defaultCapacity: 'Até 1.500kg (Carga Seca)' },
];

export function FreightVehiclesManager({ userId = 'default', onSelectVehicleForQuote }: FreightVehiclesManagerProps) {
  const [preset, setPreset] = useState<DriverFreightPreset>(() => freightStorage.getPreset(userId));
  const [vehicles, setVehicles] = useState<VehicleConfigItem[]>(() => {
    const p = freightStorage.getPreset(userId);
    return Array.isArray(p.vehicles) && p.vehicles.length > 0 ? p.vehicles : DEFAULT_VEHICLES;
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);

  // Form State
  const [label, setLabel] = useState('');
  const [type, setType] = useState<string>('moto');
  const [plate, setPlate] = useState('');
  const [maxWeight, setMaxWeight] = useState('');
  const [desc, setDesc] = useState('');
  const [defaultBase, setDefaultBase] = useState<number>(15);
  const [defaultPriceKm, setDefaultPriceKm] = useState<number>(0.80);
  const [stopFee, setStopFee] = useState<number>(6.00);
  const [kmPerLiter, setKmPerLiter] = useState<number>(35);
  const [maintenancePerKm, setMaintenancePerKm] = useState<number>(0.15);
  const [isDefault, setIsDefault] = useState<boolean>(false);

  // Sync on mount and events
  useEffect(() => {
    const p = freightStorage.getPreset(userId);
    setPreset(p);
    setVehicles(Array.isArray(p.vehicles) && p.vehicles.length > 0 ? p.vehicles : DEFAULT_VEHICLES);

    const handlePresetUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<DriverFreightPreset>;
      if (customEvent.detail) {
        setPreset(customEvent.detail);
        setVehicles(customEvent.detail.vehicles || DEFAULT_VEHICLES);
      }
    };

    window.addEventListener('freight_preset_updated', handlePresetUpdated);
    return () => window.removeEventListener('freight_preset_updated', handlePresetUpdated);
  }, [userId]);

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const getVehicleIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Car':
        return <Car className="w-5 h-5" />;
      case 'Truck':
        return <Truck className="w-5 h-5" />;
      case 'Bike':
      default:
        return <Bike className="w-5 h-5" />;
    }
  };

  const handleOpenAddModal = () => {
    setEditingVehicleId(null);
    setLabel('');
    setType('moto');
    setPlate('');
    setMaxWeight('Até 50kg (Baú / Mochila)');
    setDesc('Entregas rápidas de documentos e encomendas');
    setDefaultBase(15.00);
    setDefaultPriceKm(0.80);
    setStopFee(6.00);
    setKmPerLiter(35);
    setMaintenancePerKm(0.15);
    setIsDefault(vehicles.length === 0);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (v: VehicleConfigItem) => {
    setEditingVehicleId(v.id);
    setLabel(v.label);
    setType(v.type || (v.iconName === 'Car' ? 'car' : v.iconName === 'Truck' ? 'truck' : 'moto'));
    setPlate(v.plate || '');
    setMaxWeight(v.maxWeight);
    setDesc(v.desc || '');
    setDefaultBase(v.defaultBase);
    setDefaultPriceKm(v.defaultPriceKm);
    setStopFee(v.stopFee ?? 6.00);
    setKmPerLiter(v.kmPerLiter ?? 35);
    setMaintenancePerKm(v.maintenancePerKm ?? 0.15);
    setIsDefault(v.isDefault ?? false);
    setIsModalOpen(true);
  };

  const handleTypeChange = (selectedType: string) => {
    setType(selectedType);
    const opt = VEHICLE_TYPE_OPTIONS.find(o => o.id === selectedType);
    if (!editingVehicleId && opt) {
      setMaxWeight(opt.defaultCapacity);
      if (selectedType === 'moto') {
        setDefaultBase(15.00);
        setDefaultPriceKm(0.80);
        setKmPerLiter(35);
        setMaintenancePerKm(0.15);
      } else if (selectedType === 'car') {
        setDefaultBase(25.00);
        setDefaultPriceKm(1.50);
        setKmPerLiter(12);
        setMaintenancePerKm(0.35);
      } else if (selectedType === 'van') {
        setDefaultBase(45.00);
        setDefaultPriceKm(2.20);
        setKmPerLiter(10);
        setMaintenancePerKm(0.45);
      } else if (selectedType === 'truck') {
        setDefaultBase(60.00);
        setDefaultPriceKm(3.00);
        setKmPerLiter(8);
        setMaintenancePerKm(0.60);
      }
    }
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error('Informe o nome ou modelo do veículo.');
      return;
    }

    const iconName = type === 'car' ? 'Car' : type === 'van' || type === 'truck' ? 'Truck' : 'Bike';
    const cleanPlate = plate.trim().toUpperCase();

    let updatedList: VehicleConfigItem[] = [];

    if (editingVehicleId) {
      updatedList = vehicles.map(v => {
        if (v.id === editingVehicleId) {
          return {
            ...v,
            label: label.trim(),
            type,
            plate: cleanPlate || undefined,
            iconName,
            maxWeight: maxWeight.trim() || 'Carga compatível',
            desc: desc.trim() || undefined,
            defaultBase: Number(defaultBase) || 0,
            defaultPriceKm: Number(defaultPriceKm) || 0,
            stopFee: Number(stopFee) || 0,
            kmPerLiter: Number(kmPerLiter) || 35,
            maintenancePerKm: Number(maintenancePerKm) || 0,
            isDefault: isDefault || (vehicles.length === 1),
          };
        }
        // If this vehicle is set as default, remove default from others
        return isDefault ? { ...v, isDefault: false } : v;
      });
    } else {
      const newVehicle: VehicleConfigItem = {
        id: `veh_${Date.now()}`,
        label: label.trim(),
        type,
        plate: cleanPlate || undefined,
        iconName,
        maxWeight: maxWeight.trim() || 'Carga compatível',
        desc: desc.trim() || undefined,
        defaultBase: Number(defaultBase) || 0,
        defaultPriceKm: Number(defaultPriceKm) || 0,
        stopFee: Number(stopFee) || 0,
        kmPerLiter: Number(kmPerLiter) || 35,
        maintenancePerKm: Number(maintenancePerKm) || 0,
        isDefault: isDefault || vehicles.length === 0,
        is_custom: true,
      };

      updatedList = isDefault 
        ? [...vehicles.map(v => ({ ...v, isDefault: false })), newVehicle]
        : [...vehicles, newVehicle];
    }

    // Ensure at least one default
    if (!updatedList.some(v => v.isDefault) && updatedList.length > 0) {
      updatedList[0].isDefault = true;
    }

    const defaultVeh = updatedList.find(v => v.isDefault) || updatedList[0];

    const updatedPreset: DriverFreightPreset = {
      ...preset,
      default_vehicle: defaultVeh.id,
      default_vehicle_label: defaultVeh.label,
      default_vehicle_capacity: defaultVeh.maxWeight,
      default_vehicle_icon: defaultVeh.iconName,
      default_base_fee: defaultVeh.defaultBase,
      default_price_per_km: defaultVeh.defaultPriceKm,
      default_stop_fee: defaultVeh.stopFee ?? 6.00,
      default_km_per_liter: defaultVeh.kmPerLiter,
      default_maintenance_per_km: defaultVeh.maintenancePerKm,
      vehicles: updatedList,
    };

    freightStorage.savePreset(updatedPreset, userId);
    setPreset(updatedPreset);
    setVehicles(updatedList);
    setIsModalOpen(false);

    toast.success(editingVehicleId ? 'Veículo atualizado com sucesso!' : 'Novo veículo cadastrado na frota!');
  };

  const handleSetDefault = (vehicleId: string) => {
    const updatedList = vehicles.map(v => ({
      ...v,
      isDefault: v.id === vehicleId,
    }));

    const defaultVeh = updatedList.find(v => v.id === vehicleId);
    if (!defaultVeh) return;

    const updatedPreset: DriverFreightPreset = {
      ...preset,
      default_vehicle: defaultVeh.id,
      default_vehicle_label: defaultVeh.label,
      default_vehicle_capacity: defaultVeh.maxWeight,
      default_vehicle_icon: defaultVeh.iconName,
      default_base_fee: defaultVeh.defaultBase,
      default_price_per_km: defaultVeh.defaultPriceKm,
      default_stop_fee: defaultVeh.stopFee ?? 6.00,
      default_km_per_liter: defaultVeh.kmPerLiter,
      default_maintenance_per_km: defaultVeh.maintenancePerKm,
      vehicles: updatedList,
    };

    freightStorage.savePreset(updatedPreset, userId);
    setPreset(updatedPreset);
    setVehicles(updatedList);

    toast.success(`"${defaultVeh.label}" agora é o veículo padrão para novos orçamentos!`);
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    if (vehicles.length <= 1) {
      toast.error('Você deve manter pelo menos um veículo cadastrado na frota.');
      return;
    }

    const vehicleToDelete = vehicles.find(v => v.id === vehicleId);
    const updatedList = vehicles.filter(v => v.id !== vehicleId);

    // If deleting the default vehicle, make the first remaining vehicle the default
    if (vehicleToDelete?.isDefault && updatedList.length > 0) {
      updatedList[0].isDefault = true;
    }

    const defaultVeh = updatedList.find(v => v.isDefault) || updatedList[0];

    const updatedPreset: DriverFreightPreset = {
      ...preset,
      default_vehicle: defaultVeh.id,
      default_vehicle_label: defaultVeh.label,
      default_vehicle_capacity: defaultVeh.maxWeight,
      default_vehicle_icon: defaultVeh.iconName,
      default_base_fee: defaultVeh.defaultBase,
      default_price_per_km: defaultVeh.defaultPriceKm,
      default_stop_fee: defaultVeh.stopFee ?? 6.00,
      default_km_per_liter: defaultVeh.kmPerLiter,
      default_maintenance_per_km: defaultVeh.maintenancePerKm,
      vehicles: updatedList,
    };

    freightStorage.savePreset(updatedPreset, userId);
    setPreset(updatedPreset);
    setVehicles(updatedList);

    toast.success('Veículo removido com sucesso!');
  };

  const activeVehicle = vehicles.find(v => v.isDefault) || vehicles[0];

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* COCKPIT BANNER */}
      <div className="bg-card border border-border/70 rounded-3xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              Frota & Veículos de Frete
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-extrabold uppercase">
                {vehicles.length} {vehicles.length === 1 ? 'veículo' : 'veículos'}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cadastre suas motos, carros e utilitários com tarifas personalizadas, consumo e custos de manutenção integrados.
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenAddModal}
          className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-extrabold rounded-2xl h-10 px-4 text-xs gap-2 cursor-pointer shadow-md shadow-cyan-500/20 shrink-0 transition-all hover:scale-[1.02]"
        >
          <PlusCircle className="w-4 h-4" />
          Adicionar Veículo
        </Button>
      </div>

      {/* QUICK SUMMARY PILLS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="rounded-2xl border-border/70 bg-card p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Veículo Padrão Ativo</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <p className="text-sm font-black text-foreground mt-1 truncate">
            {activeVehicle?.label || 'Nenhum'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Usado automaticamente ao abrir um novo orçamento
          </p>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Tarifa KM Padrão</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatBRL(activeVehicle?.defaultPriceKm || 0)}/km
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Saída base: {formatBRL(activeVehicle?.defaultBase || 0)}
          </p>
        </Card>

        <Card className="rounded-2xl border-border/70 bg-card p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Consumo Médio Padrão</span>
            <Fuel className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {activeVehicle?.kmPerLiter || 35} km/L
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Manutenção: {formatBRL(activeVehicle?.maintenancePerKm || 0)}/km
          </p>
        </Card>
      </div>

      {/* VEHICLES CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map((v) => {
          const isCurrentDefault = v.isDefault;
          return (
            <Card 
              key={v.id} 
              className={`rounded-3xl border transition-all shadow-xs flex flex-col justify-between overflow-hidden ${
                isCurrentDefault 
                  ? 'border-cyan-500/50 bg-gradient-to-b from-cyan-500/5 to-background shadow-cyan-500/5 ring-1 ring-cyan-500/30' 
                  : 'border-border/70 bg-card hover:border-border'
              }`}
            >
              <CardContent className="p-4 sm:p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-2xl shrink-0 ${
                      isCurrentDefault 
                        ? 'bg-cyan-500 text-white shadow-xs' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {getVehicleIcon(v.iconName)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-foreground truncate flex items-center gap-1.5">
                        {v.label}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {v.plate && (
                          <span className="px-2 py-0.5 rounded-md bg-muted/80 text-foreground font-mono text-[10px] font-bold border border-border/60">
                            {v.plate}
                          </span>
                        )}
                        <span className="text-[10.5px] text-muted-foreground font-medium truncate">
                          {v.maxWeight}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isCurrentDefault ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-[10px] font-black uppercase shrink-0 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-cyan-500 text-cyan-500" />
                      Padrão
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(v.id)}
                      className="h-7 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground rounded-lg cursor-pointer hover:bg-muted"
                      title="Tornar este veículo o padrão para novos orçamentos"
                    >
                      Tornar Padrão
                    </Button>
                  )}
                </div>

                {v.desc && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {v.desc}
                  </p>
                )}

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-2xl border border-border/50 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-bold">Saída Base:</span>
                    <strong className="text-foreground text-xs">{formatBRL(v.defaultBase)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-bold">Preço / KM:</span>
                    <strong className="text-primary text-xs">{formatBRL(v.defaultPriceKm)}/km</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-bold">Consumo:</span>
                    <span className="font-semibold text-foreground">{v.kmPerLiter || 35} km/L</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-bold">Custo Manutenção:</span>
                    <span className="font-semibold text-foreground">{formatBRL(v.maintenancePerKm || 0)}/km</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-border/30 flex items-center justify-between">
                    <span className="text-muted-foreground text-[10px]">Parada adicional:</span>
                    <span className="font-bold text-foreground">{formatBRL(v.stopFee ?? 6.00)}</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditModal(v)}
                      className="h-8 rounded-xl px-2.5 text-xs font-bold border-border/70 hover:bg-muted gap-1 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5 text-indigo-500" />
                      Editar
                    </Button>

                    {vehicles.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteVehicle(v.id)}
                        className="h-8 rounded-xl px-2 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                        title="Excluir veículo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  {onSelectVehicleForQuote && (
                    <Button
                      size="sm"
                      onClick={() => onSelectVehicleForQuote(v)}
                      className="h-8 rounded-xl px-3 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-2xs"
                    >
                      Usar no Orçamento
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* MODAL: ADD / EDIT VEHICLE */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[96vw] sm:max-w-lg p-0 overflow-hidden rounded-3xl border-border bg-card shadow-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="p-4 sm:p-5 bg-muted/30 border-b border-border/60 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              {editingVehicleId ? <Edit className="w-5 h-5 text-indigo-500" /> : <PlusCircle className="w-5 h-5 text-cyan-500" />}
              {editingVehicleId ? 'Editar Veículo da Frota' : 'Cadastrar Novo Veículo'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Defina as tarifas e custos operacionais que serão usados no cálculo automático de orçamentos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveVehicle} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
            {/* Category / Type Selector */}
            <div className="space-y-1">
              <label className="font-bold text-foreground">Categoria do Veículo:</label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger className="rounded-xl h-10 text-xs bg-muted/10">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {VEHICLE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Label & Plate */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-foreground">Apelido / Modelo do Veículo *:</label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Honda CG 160 Fan, Fiorino 1.4"
                  className="rounded-xl h-10 text-xs bg-muted/10"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Placa (opcional):</label>
                <Input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="ABC1D23"
                  maxLength={8}
                  className="rounded-xl h-10 text-xs uppercase font-mono bg-muted/10"
                />
              </div>
            </div>

            {/* Capacity & Description */}
            <div className="space-y-1">
              <label className="font-bold text-foreground">Capacidade de Carga / Espaço:</label>
              <Input
                value={maxWeight}
                onChange={(e) => setMaxWeight(e.target.value)}
                placeholder="Ex: Até 50kg Baú, 650kg Caçamba, 4 passageiros"
                className="rounded-xl h-10 text-xs bg-muted/10"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">Descrição / Notas do Veículo:</label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Ex: Veículo econômico para entregas ágeis no centro da cidade"
                rows={2}
                className="rounded-xl text-xs bg-muted/10 resize-none"
              />
            </div>

            {/* Commercial Rates */}
            <div className="pt-2 border-t border-border/40 space-y-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                Tarifas Comerciais para o Cliente
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-foreground">Saída / Bandeirada (R$):</label>
                  <DecimalInput
                    value={defaultBase}
                    onChange={setDefaultBase}
                    className="rounded-xl h-10 text-xs bg-muted/10 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Preço por KM (R$):</label>
                  <DecimalInput
                    value={defaultPriceKm}
                    onChange={setDefaultPriceKm}
                    className="rounded-xl h-10 text-xs bg-muted/10 font-bold text-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Parada Extra (R$):</label>
                  <DecimalInput
                    value={stopFee}
                    onChange={setStopFee}
                    className="rounded-xl h-10 text-xs bg-muted/10 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Operating Costs */}
            <div className="pt-2 border-t border-border/40 space-y-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block">
                Custos Operacionais do Veículo (Cálculo de Lucro Real)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-foreground">Consumo Médio (KM/L):</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="1"
                    value={kmPerLiter}
                    onChange={(e) => setKmPerLiter(parseFloat(e.target.value) || 0)}
                    placeholder="35"
                    className="rounded-xl h-10 text-xs bg-muted/10 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Custo Manutenção (R$/KM):</label>
                  <DecimalInput
                    value={maintenancePerKm}
                    onChange={setMaintenancePerKm}
                    className="rounded-xl h-10 text-xs bg-muted/10 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Default Checkbox */}
            <div className="pt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefaultVehicle"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <label htmlFor="isDefaultVehicle" className="text-xs font-bold text-foreground cursor-pointer select-none">
                Definir como veículo padrão para novos orçamentos
              </label>
            </div>

            <DialogFooter className="pt-4 border-t border-border/60 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl h-10 text-xs font-bold border-border/80 hover:bg-muted cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-10 text-xs font-bold gap-2 cursor-pointer shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                Salvar Veículo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
