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
  Weight, 
  Layers
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { DriverFreightPreset, VehicleConfigItem } from '../../types/freight';
import { freightStorage, DEFAULT_PRESET, DEFAULT_VEHICLES } from '../../lib/freightStorage';
import { maskPhone, maskCpfCnpj } from '../../lib/brazilianFormatters';

interface FreightSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  onSaved?: (preset: DriverFreightPreset) => void;
}

export function FreightSettingsModal({ open, onOpenChange, userId = 'default', onSaved }: FreightSettingsModalProps) {
  const [formData, setFormData] = useState<DriverFreightPreset>(() => freightStorage.getPreset(userId));

  React.useEffect(() => {
    if (open) {
      freightStorage.syncPresetFromDatabase(userId).then(p => {
        setFormData(p);
      });
    }
  }, [open, userId]);

  const activeVehicle: VehicleConfigItem = formData.vehicles?.[0] || DEFAULT_VEHICLES[0];

  const handleUpdateActiveVehicle = (updates: Partial<VehicleConfigItem>) => {
    const updatedVehicle = { ...activeVehicle, ...updates };
    setFormData(prev => ({
      ...prev,
      default_vehicle: 'moto',
      default_vehicle_label: updatedVehicle.label,
      default_vehicle_capacity: updatedVehicle.maxWeight,
      default_base_fee: updatedVehicle.defaultBase,
      default_price_per_km: updatedVehicle.defaultPriceKm,
      default_stop_fee: updatedVehicle.stopFee,
      vehicles: [updatedVehicle],
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = freightStorage.savePreset(formData, userId);
    toast.success('Configurações salvas no Supabase e localmente!', {
      description: 'Tarifas e parâmetros do frete foram atualizados com sucesso.',
    });
    if (onSaved) onSaved(saved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-2xl p-0 overflow-hidden rounded-3xl border-border bg-card max-h-[88vh] sm:max-h-[92vh] flex flex-col shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 bg-muted/30 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  Configurações Comerciais do Frete
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Ajuste suas tarifas padrão, dados do prestador e chave PIX para envio de propostas.
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

          {/* Section 3: MOTOCICLETA RATES & PARAMETERS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-1.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  3. Veículo & Tarifas Padrão (Motocicleta)
                </span>
              </div>
            </div>

            <div className="bg-muted/20 p-4 sm:p-5 rounded-3xl border border-border/70 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border/60">
                <div className="p-2.5 rounded-2xl bg-primary text-primary-foreground">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-foreground">
                    Motocicleta (Frete Express)
                  </h4>
                  <span className="text-[10px] text-muted-foreground">
                    Veículo padrão para entregas e fretes rápidos.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <Weight className="w-3.5 h-3.5 text-primary" />
                    Capacidade de Carga Padrão:
                  </label>
                  <Input
                    value={activeVehicle.maxWeight || 'Até 50Kg (Bauleto / amarração)'}
                    onChange={(e) => handleUpdateActiveVehicle({ maxWeight: e.target.value })}
                    placeholder="Até 50Kg (Bauleto / amarração)"
                    className="rounded-xl h-10 text-xs bg-background font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground block">
                    Taxa Base / Saída (R$):
                  </label>
                  <DecimalInput
                    value={activeVehicle.defaultBase ?? 15.00}
                    onChange={(val) => handleUpdateActiveVehicle({ defaultBase: val })}
                    prefix="R$"
                    className="rounded-xl h-10 text-xs bg-background font-bold text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
                <div className="space-y-1">
                  <label className="font-bold text-foreground block">
                    Preço por KM (R$/KM):
                  </label>
                  <DecimalInput
                    value={activeVehicle.defaultPriceKm ?? 0.80}
                    onChange={(val) => handleUpdateActiveVehicle({ defaultPriceKm: val })}
                    prefix="R$"
                    className="rounded-xl h-10 text-xs bg-background text-primary font-black"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground block">
                    Parada Extra (R$):
                  </label>
                  <DecimalInput
                    value={activeVehicle.stopFee ?? 6.00}
                    onChange={(val) => handleUpdateActiveVehicle({ stopFee: val })}
                    prefix="R$"
                    className="rounded-xl h-10 text-xs bg-background font-semibold"
                  />
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
              Salvar Tarifas no Banco
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

