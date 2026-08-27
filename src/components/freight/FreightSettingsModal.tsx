import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DecimalInput } from '@/components/ui/DecimalInput';
import { Settings, Save, QrCode, Bike, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { DriverFreightPreset } from '../../types/freight';
import { freightStorage, DEFAULT_PRESET } from '../../lib/freightStorage';

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

  const handleResetToDefault = () => {
    setFormData({
      ...DEFAULT_PRESET,
      driver_name: formData.driver_name,
      driver_phone: formData.driver_phone,
      driver_company: formData.driver_company,
      driver_document: formData.driver_document,
      pix_key: formData.pix_key,
      pix_key_type: formData.pix_key_type,
    });
    toast.info('Tarifas padrão restauradas para os valores iniciais.');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = freightStorage.savePreset(formData, userId);
    toast.success('Configurações salvas no banco de dados e localmente!', {
      description: 'Seus novos orçamentos utilizarão essas tarifas por padrão.',
    });
    if (onSaved) onSaved(saved);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl p-0 overflow-hidden rounded-3xl border-border bg-card max-h-[85vh] sm:max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 sm:p-6 bg-muted/20 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black tracking-tight">
                Configurações Comerciais & Tarifas
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Defina seus dados de contato, PIX e as tarifas padrão de frete (Motocicleta).
              </DialogDescription>
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
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">WhatsApp / Telefone:</label>
                <Input
                  value={formData.driver_phone}
                  onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Nome Fantasia / Empresa (opcional):</label>
                <Input
                  value={formData.driver_company}
                  onChange={(e) => setFormData({ ...formData, driver_company: e.target.value })}
                  placeholder="Ex: Express Moto Fretes"
                  className="rounded-xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">CPF ou CNPJ:</label>
                <Input
                  value={formData.driver_document}
                  onChange={(e) => setFormData({ ...formData, driver_document: e.target.value })}
                  placeholder="000.000.000-00"
                  className="rounded-xl h-10 text-xs"
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
                  <SelectTrigger className="rounded-xl h-10 text-xs">
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
                    className="rounded-xl h-10 pl-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: RATES & PRICING PRESETS FOR MOTOCICLETA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-primary" />
                3. Tarifas Padrão de Frete (Motocicleta)
              </span>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Restaurar Tarifas Padrão
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/20 p-3.5 rounded-2xl border border-border/60">
              <div className="space-y-1">
                <label className="font-bold text-foreground block">
                  Taxa Base / Saída (R$):
                </label>
                <DecimalInput
                  value={formData.default_base_fee}
                  onChange={(val) => setFormData({ ...formData, default_base_fee: val })}
                  prefix="R$"
                  className="rounded-xl h-10 text-xs bg-background"
                />
                <span className="text-[10px] text-muted-foreground">Valor fixo cobrado ao iniciar a corrida</span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground block">
                  Preço por Quilômetro (R$/KM):
                </label>
                <DecimalInput
                  value={formData.default_price_per_km}
                  onChange={(val) => setFormData({ ...formData, default_price_per_km: val })}
                  prefix="R$"
                  className="rounded-xl h-10 text-xs bg-background text-primary font-bold"
                />
                <span className="text-[10px] text-muted-foreground">Valor multiplicado pela distância da rota</span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground block">
                  Taxa por Parada Extra (R$):
                </label>
                <DecimalInput
                  value={formData.default_stop_fee}
                  onChange={(val) => setFormData({ ...formData, default_stop_fee: val })}
                  prefix="R$"
                  className="rounded-xl h-10 text-xs bg-background"
                />
                <span className="text-[10px] text-muted-foreground">Valor adicionado por ponto intermediário</span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground block">
                  Custo de Manutenção/KM (R$):
                </label>
                <DecimalInput
                  value={formData.default_maintenance_per_km}
                  onChange={(val) => setFormData({ ...formData, default_maintenance_per_km: val })}
                  prefix="R$"
                  className="rounded-xl h-10 text-xs bg-background"
                />
                <span className="text-[10px] text-muted-foreground">Usado no cálculo de lucro líquido real</span>
              </div>
            </div>
          </div>

          {/* Section 4: Terms & Conditions Template */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground flex items-center justify-between">
              <span>Termos & Regras Padrão (exibidos na proposta):</span>
              <span className="text-[10px] text-muted-foreground font-normal">Editável por orçamento</span>
            </label>
            <Textarea
              value={formData.default_terms}
              onChange={(e) => setFormData({ ...formData, default_terms: e.target.value })}
              rows={4}
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
              Salvar Configurações no Banco
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
