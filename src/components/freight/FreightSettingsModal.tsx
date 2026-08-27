import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DecimalInput } from '@/components/ui/DecimalInput';
import { 
  Settings, 
  Save, 
  QrCode, 
  Bike, 
  Car, 
  Truck, 
  Weight, 
  Fuel, 
  Info, 
  Plus, 
  Trash2, 
  Check, 
  Copy, 
  Star,
  Layers,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { DriverFreightPreset, VehicleConfigItem } from '../../types/freight';
import { freightStorage, DEFAULT_PRESET, DEFAULT_VEHICLES } from '../../lib/freightStorage';
import { maskPhone, maskCpfCnpj, maskCpf, maskCnpj } from '../../lib/brazilianFormatters';

interface FreightSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onSaved?: (preset: DriverFreightPreset) => void;
}

export function FreightSettingsModal({ open, onOpenChange, userId = 'default', onSaved }: FreightSettingsModalProps) {
  const [formData, setFormData] = useState<DriverFreightPreset>(() => freightStorage.getPreset(userId));
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

  React.useEffect(() => {
    if (open) {
      freightStorage.syncPresetFromDatabase(userId).then(p => {
        setFormData(p);
        const defaultId = p.default_vehicle || p.vehicles?.[0]?.id || 'moto';
        setSelectedVehicleId(defaultId);
      });
    }
  }, [open, userId]);

  // Ensure vehicles array is never empty
  const vehicles: VehicleConfigItem[] = (formData.vehicles && formData.vehicles.length > 0)
    ? formData.vehicles
    : DEFAULT_VEHICLES;

  // Active selected vehicle
  const activeVehicle = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0] || DEFAULT_VEHICLES[0];

  const handleUpdateActiveVehicle = (updates: Partial<VehicleConfigItem>) => {
    const updatedVehicles = vehicles.map(v => {
      if (v.id === activeVehicle.id) {
        return { ...v, ...updates };
      }
      return v;
    });

    setFormData(prev => ({
      ...prev,
      vehicles: updatedVehicles,
    }));
  };

  const handleAddNewVehicle = () => {
    const newId = `veh_${Date.now()}`;
    const newVehicle: VehicleConfigItem = {
      id: newId,
      label: `Novo Veículo ${vehicles.length + 1}`,
      iconName: 'Car',
      maxWeight: 'Até 300kg',
      desc: 'Transporte de cargas médias, caixas e encomendas',
      defaultBase: 25.00,
      defaultPriceKm: 3.50,
      stopFee: 10.00,
      kmPerLiter: 14,
      maintenancePerKm: 0.40,
      isDefault: false,
      is_custom: true,
    };

    const updated = [...vehicles, newVehicle];
    setFormData(prev => ({
      ...prev,
      vehicles: updated,
    }));
    setSelectedVehicleId(newId);
    toast.success('Novo tipo de veículo adicionado!', {
      description: 'Personalize o nome, capacidade e tarifas deste veículo.',
    });
  };

  const handleDuplicateVehicle = () => {
    const newId = `veh_${Date.now()}`;
    const duplicated: VehicleConfigItem = {
      ...activeVehicle,
      id: newId,
      label: `${activeVehicle.label} (Cópia)`,
      isDefault: false,
      is_custom: true,
    };

    const updated = [...vehicles, duplicated];
    setFormData(prev => ({
      ...prev,
      vehicles: updated,
    }));
    setSelectedVehicleId(newId);
    toast.success(`Veículo "${activeVehicle.label}" duplicado com sucesso!`);
  };

  const handleDeleteVehicle = (idToDelete: string) => {
    if (vehicles.length <= 1) {
      toast.error('Você precisa manter pelo menos 1 veículo configurado.');
      return;
    }

    const remaining = vehicles.filter(v => v.id !== idToDelete);
    const wasDefault = formData.default_vehicle === idToDelete;
    const newDefaultId = wasDefault ? remaining[0].id : formData.default_vehicle;

    const normalized = remaining.map(v => ({
      ...v,
      isDefault: v.id === newDefaultId,
    }));

    setFormData(prev => ({
      ...prev,
      default_vehicle: newDefaultId,
      vehicles: normalized,
    }));

    setSelectedVehicleId(newDefaultId);
    toast.info('Veículo removido da sua frota.');
  };

  const handleSetAsDefault = (vehicleId: string) => {
    const updated = vehicles.map(v => ({
      ...v,
      isDefault: v.id === vehicleId,
    }));

    const targetVeh = vehicles.find(v => v.id === vehicleId);

    setFormData(prev => ({
      ...prev,
      default_vehicle: vehicleId,
      default_vehicle_label: targetVeh?.label,
      default_vehicle_capacity: targetVeh?.maxWeight,
      default_vehicle_desc: targetVeh?.desc,
      default_vehicle_icon: targetVeh?.iconName,
      default_price_per_km: targetVeh?.defaultPriceKm ?? prev.default_price_per_km,
      default_base_fee: targetVeh?.defaultBase ?? prev.default_base_fee,
      default_stop_fee: targetVeh?.stopFee ?? prev.default_stop_fee,
      default_km_per_liter: targetVeh?.kmPerLiter ?? prev.default_km_per_liter,
      default_maintenance_per_km: targetVeh?.maintenancePerKm ?? prev.default_maintenance_per_km,
      vehicles: updated,
    }));

    toast.success(`"${targetVeh?.label}" definido como veículo padrão para novos orçamentos!`);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = freightStorage.savePreset(formData, userId);
    toast.success('Configurações salvas no Supabase e localmente!', {
      description: 'Todos os veículos, capacidades e tarifas foram atualizados com sucesso.',
    });
    if (onSaved) onSaved(saved);
    onOpenChange(false);
  };

  const isCurrentDefault = formData.default_vehicle === activeVehicle.id || activeVehicle.isDefault;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-3xl p-0 overflow-hidden rounded-3xl border-border bg-card max-h-[88vh] sm:max-h-[92vh] flex flex-col shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 bg-muted/30 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  Configurações Comerciais & Frota
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Gerencie sua frota de veículos com capacidade de carga e tarifas individuais.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs">
          {/* Section 1: Transporter Profile */}
          <div className="space-y-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block border-b border-border/40 pb-1">
              1. Dados do Prestador / Empresa
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-foreground">Seu Nome / Razão:</label>
                <Input
                  value={formData.driver_name}
                  onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                  placeholder="Ex: Carlos Entregas Rápidas"
                  className="rounded-xl h-10 text-xs bg-muted/10"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">WhatsApp / Telefone:</label>
                <Input
                  value={formData.driver_phone}
                  onChange={(e) => setFormData({ ...formData, driver_phone: maskPhone(e.target.value) })}
                  placeholder="(11) 99999-9999"
                  className="rounded-xl h-10 text-xs bg-muted/10"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Nome Fantasia / Empresa (opcional):</label>
                <Input
                  value={formData.driver_company}
                  onChange={(e) => setFormData({ ...formData, driver_company: e.target.value })}
                  placeholder="Ex: Express Moto Fretes & Logística"
                  className="rounded-xl h-10 text-xs bg-muted/10"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">CPF ou CNPJ:</label>
                <Input
                  value={formData.driver_document}
                  onChange={(e) => setFormData({ ...formData, driver_document: maskCpfCnpj(e.target.value) })}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className="rounded-xl h-10 text-xs bg-muted/10"
                />
              </div>
            </div>
          </div>

          {/* Section 2: PIX & Payments */}
          <div className="space-y-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground block border-b border-border/40 pb-1">
              2. Pagamento & Chave PIX
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-1">
                <label className="font-bold text-foreground">Tipo de Chave:</label>
                <Select
                  value={formData.pix_key_type}
                  onValueChange={(val: any) => setFormData({ ...formData, pix_key_type: val })}
                >
                  <SelectTrigger className="rounded-xl h-10 text-xs bg-muted/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="random">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-foreground">Chave PIX:</label>
                <div className="relative">
                  <QrCode className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    value={formData.pix_key}
                    onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
                    placeholder="Sua chave PIX para recebimento"
                    className="rounded-xl h-10 pl-9 text-xs font-mono bg-muted/10"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: UNIFIED VEHICLES & SPECIFIC RATES (VEÍCULO, CAPACIDADE & TARIFAS JUNTOS) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-1.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  3. Veículos, Capacidades & Tarifas Integradas
                </span>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                  {vehicles.length} {vehicles.length === 1 ? 'veículo' : 'veículos'}
                </span>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddNewVehicle}
                className="h-8 px-3 rounded-xl text-xs font-bold gap-1.5 bg-primary/5 hover:bg-primary/10 text-primary border-primary/30 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Outro Veículo
              </Button>
            </div>

            {/* Vehicle Selection Carousel / Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
              {vehicles.map((v) => {
                const isSelected = v.id === activeVehicle.id;
                const isDef = formData.default_vehicle === v.id || v.isDefault;

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-left shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary shadow-xs'
                        : 'bg-muted/30 hover:bg-muted border-border/60 text-muted-foreground'
                    }`}
                  >
                    <div className={`p-1.5 rounded-xl shrink-0 ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {v.iconName === 'Car' ? (
                        <Car className="w-3.5 h-3.5" />
                      ) : v.iconName === 'Truck' ? (
                        <Truck className="w-3.5 h-3.5" />
                      ) : (
                        <Bike className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-extrabold line-clamp-1 ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {v.label || 'Sem Nome'}
                        </span>
                        {isDef && (
                          <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-black">
                            Padrão
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-semibold block">
                        R$ {v.defaultPriceKm?.toFixed(2)}/km • Saída R$ {v.defaultBase?.toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Vehicle Dedicated Configuration Box */}
            <div className="bg-muted/20 p-4 sm:p-5 rounded-3xl border border-border/70 space-y-5">
              {/* Header of the Active Vehicle */}
              <div className="flex items-center justify-between pb-3 border-b border-border/60 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-2xl bg-primary text-primary-foreground">
                    {activeVehicle.iconName === 'Car' ? (
                      <Car className="w-4 h-4" />
                    ) : activeVehicle.iconName === 'Truck' ? (
                      <Truck className="w-4 h-4" />
                    ) : (
                      <Bike className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-foreground">
                      {activeVehicle.label || 'Configurar Veículo'}
                    </h4>
                    <span className="text-[10px] text-muted-foreground">
                      Parâmetros comerciais e capacidade exclusivos deste veículo
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {!isCurrentDefault && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetAsDefault(activeVehicle.id)}
                      className="h-8 px-2.5 rounded-xl text-[11px] font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 gap-1 cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5" />
                      Definir como Padrão
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleDuplicateVehicle}
                    title="Duplicar este veículo"
                    className="h-8 px-2.5 rounded-xl text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline ml-1">Duplicar</span>
                  </Button>

                  {vehicles.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteVehicle(activeVehicle.id)}
                      title="Excluir este tipo de veículo"
                      className="h-8 px-2.5 rounded-xl text-[11px] text-destructive hover:bg-destructive/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline ml-1">Excluir</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Subsection A: Identificação & Capacidade do Veículo */}
              <div className="space-y-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Identificação & Capacidade de Carga
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-bold text-foreground">
                      Nome / Modelo do Veículo:
                    </label>
                    <Input
                      value={activeVehicle.label || ''}
                      onChange={(e) => handleUpdateActiveVehicle({ label: e.target.value })}
                      placeholder="Ex: Motocicleta Honda 160, Fiorino 1.4, Van Master..."
                      className="rounded-xl h-10 text-xs bg-background font-semibold"
                    />
                    <span className="text-[10px] text-muted-foreground">Exibido na proposta oficial e mensagem de WhatsApp</span>
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <label className="font-bold text-foreground">Categoria / Ícone:</label>
                    <div className="grid grid-cols-3 gap-1.5 h-10">
                      <button
                        type="button"
                        onClick={() => handleUpdateActiveVehicle({ iconName: 'Bike' })}
                        className={`flex flex-col items-center justify-center rounded-xl border transition-all cursor-pointer ${
                          activeVehicle.iconName === 'Bike'
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-background hover:bg-muted text-muted-foreground border-border'
                        }`}
                        title="Motocicleta / Bicicleta"
                      >
                        <Bike className="w-4 h-4" />
                        <span className="text-[9px] font-bold mt-0.5">Moto</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateActiveVehicle({ iconName: 'Car' })}
                        className={`flex flex-col items-center justify-center rounded-xl border transition-all cursor-pointer ${
                          activeVehicle.iconName === 'Car'
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-background hover:bg-muted text-muted-foreground border-border'
                        }`}
                        title="Carro / Utilitário / Fiorino"
                      >
                        <Car className="w-4 h-4" />
                        <span className="text-[9px] font-bold mt-0.5">Carro</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateActiveVehicle({ iconName: 'Truck' })}
                        className={`flex flex-col items-center justify-center rounded-xl border transition-all cursor-pointer ${
                          activeVehicle.iconName === 'Truck'
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-background hover:bg-muted text-muted-foreground border-border'
                        }`}
                        title="Van / Caminhão / Furgão Grande"
                      >
                        <Truck className="w-4 h-4" />
                        <span className="text-[9px] font-bold mt-0.5">Van/Truck</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-foreground flex items-center gap-1.5">
                      <Weight className="w-3.5 h-3.5 text-primary" />
                      Capacidade de Carga / Peso Máximo:
                    </label>
                    <Input
                      value={activeVehicle.maxWeight || ''}
                      onChange={(e) => handleUpdateActiveVehicle({ maxWeight: e.target.value })}
                      placeholder="Ex: Até 20kg (Baú / Mochila)"
                      className="rounded-xl h-10 text-xs bg-background font-semibold"
                    />
                    <span className="text-[10px] text-muted-foreground">Ex: "Até 25kg (Baú)", "Até 650kg (3.2m³)", "Até 1.500kg"</span>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-foreground flex items-center gap-1.5">
                      <Fuel className="w-3.5 h-3.5 text-primary" />
                      Consumo Médio (KM por Litro):
                    </label>
                    <DecimalInput
                      value={activeVehicle.kmPerLiter ?? 35}
                      onChange={(val) => handleUpdateActiveVehicle({ kmPerLiter: val })}
                      prefix=""
                      className="rounded-xl h-10 text-xs bg-background font-semibold"
                    />
                    <span className="text-[10px] text-muted-foreground">Usado para estimar o custo real de combustível do frete</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-primary" />
                    Descrição da Carga & Especialidade do Veículo:
                  </label>
                  <Input
                    value={activeVehicle.desc || ''}
                    onChange={(e) => handleUpdateActiveVehicle({ desc: e.target.value })}
                    placeholder="Ex: Documentos, pequenos pacotes, encomendas rápidas e caixas médias"
                    className="rounded-xl h-10 text-xs bg-background"
                  />
                  <span className="text-[10px] text-muted-foreground">Orienta o cliente sobre o porte ideal das encomendas aceitas</span>
                </div>
              </div>

              {/* Subsection B: Tarifas Padrão & Custos Deste Veículo */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                  Tarifas Padrão & Custos Deste Veículo
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-foreground block">
                      Taxa Base / Saída (R$):
                    </label>
                    <DecimalInput
                      value={activeVehicle.defaultBase}
                      onChange={(val) => handleUpdateActiveVehicle({ defaultBase: val })}
                      prefix="R$"
                      className="rounded-xl h-10 text-xs bg-background font-bold text-foreground"
                    />
                    <span className="text-[10px] text-muted-foreground">Valor fixo de partida</span>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-foreground block">
                      Preço por KM (R$/KM):
                    </label>
                    <DecimalInput
                      value={activeVehicle.defaultPriceKm}
                      onChange={(val) => handleUpdateActiveVehicle({ defaultPriceKm: val })}
                      prefix="R$"
                      className="rounded-xl h-10 text-xs bg-background text-primary font-black"
                    />
                    <span className="text-[10px] text-muted-foreground">Cobrado por km rodado</span>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-foreground block">
                      Parada Extra (R$):
                    </label>
                    <DecimalInput
                      value={activeVehicle.stopFee ?? 6}
                      onChange={(val) => handleUpdateActiveVehicle({ stopFee: val })}
                      prefix="R$"
                      className="rounded-xl h-10 text-xs bg-background"
                    />
                    <span className="text-[10px] text-muted-foreground">Adicional por ponto extra</span>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-foreground block">
                      Manutenção/KM (R$):
                    </label>
                    <DecimalInput
                      value={activeVehicle.maintenancePerKm ?? 0.25}
                      onChange={(val) => handleUpdateActiveVehicle({ maintenancePerKm: val })}
                      prefix="R$"
                      className="rounded-xl h-10 text-xs bg-background"
                    />
                    <span className="text-[10px] text-muted-foreground">Custo de pneus e revisões</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Terms & Conditions Template */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground flex items-center justify-between">
              <span>4. Termos & Regras Padrão (exibidos na proposta comercial):</span>
              <span className="text-[10px] text-muted-foreground font-normal">Editável por orçamento</span>
            </label>
            <Textarea
              value={formData.default_terms}
              onChange={(e) => setFormData({ ...formData, default_terms: e.target.value })}
              rows={3}
              className="rounded-2xl text-xs bg-muted/20 border-border resize-y"
              placeholder="Digite suas regras de espera, validade, cancelamento..."
            />
          </div>

          <DialogFooter className="pt-4 border-t border-border flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-2xl h-10 font-bold text-xs cursor-pointer w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="rounded-2xl h-10 font-extrabold text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-2 cursor-pointer shadow-sm w-full sm:w-auto"
            >
              <Save className="w-4 h-4" />
              Salvar Veículos & Tarifas no Banco
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
