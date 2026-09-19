import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  ShieldCheck, 
  DollarSign, 
  Target, 
  Fuel, 
  Gauge, 
  Pizza, 
  TrendingUp, 
  Briefcase,
  Save,
  RotateCcw
} from 'lucide-react';
import { UserSettings } from '../../types';
import { supabase } from '../../lib/supabase';
import { systemSettings } from '../../lib/systemSettings';
import { toast } from '@/lib/toast';

interface EditUserModalProps {
  user: UserSettings | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditUserModal({ user, open, onOpenChange, onSuccess }: EditUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'profile' | 'financial' | 'operational' | 'pizzaria' | 'market'>('profile');

  const [formData, setFormData] = useState<Partial<UserSettings>>({});

  useEffect(() => {
    if (user) {
      setFormData({
        user_id: user.user_id,
        full_name: user.full_name || '',
        is_admin: !!user.is_admin,
        initial_balance: user.initial_balance ?? 0,
        weekly_goal: user.weekly_goal ?? 1000,
        weekly_net_goal: user.weekly_net_goal ?? 700,
        default_driver_labor: user.default_driver_labor ?? 50,
        vehicle_km_per_liter: user.vehicle_km_per_liter ?? 35,
        fuel_price: user.fuel_price ?? 5.89,
        pizzaria_base_deliveries: user.pizzaria_base_deliveries ?? 10,
        pizzaria_base_rate: user.pizzaria_base_rate ?? 60,
        pizzaria_daily_rate_above_base: user.pizzaria_daily_rate_above_base ?? 70,
        pizzaria_delivery_rate: user.pizzaria_delivery_rate ?? 3.5,
        pizzaria_out_of_neighborhood_rate: user.pizzaria_out_of_neighborhood_rate ?? 5.0,
        quote_provider: user.quote_provider || 'auto',
        brapi_token: user.brapi_token || '',
      });
    }
  }, [user]);

  if (!user) return null;

  const handleChange = (field: keyof UserSettings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        full_name: formData.full_name,
        is_admin: formData.is_admin,
        initial_balance: Number(formData.initial_balance) || 0,
        weekly_goal: Number(formData.weekly_goal) || 0,
        weekly_net_goal: Number(formData.weekly_net_goal) || 0,
        default_driver_labor: Number(formData.default_driver_labor) || 0,
        vehicle_km_per_liter: Number(formData.vehicle_km_per_liter) || 0,
        fuel_price: Number(formData.fuel_price) || 0,
        pizzaria_base_deliveries: Number(formData.pizzaria_base_deliveries) || 0,
        pizzaria_base_rate: Number(formData.pizzaria_base_rate) || 0,
        pizzaria_daily_rate_above_base: Number(formData.pizzaria_daily_rate_above_base) || 0,
        pizzaria_delivery_rate: Number(formData.pizzaria_delivery_rate) || 0,
        pizzaria_out_of_neighborhood_rate: Number(formData.pizzaria_out_of_neighborhood_rate) || 0,
        quote_provider: formData.quote_provider || 'auto',
        brapi_token: formData.brapi_token || null,
      };

      const { error } = await supabase
        .from('user_settings')
        .update(payload)
        .eq('user_id', user.user_id);

      if (error) throw error;

      systemSettings.logAction(
        'Administrador',
        'Edição de Membro',
        `Dados do membro ${formData.full_name || user.user_id} foram atualizados com sucesso.`,
        'user',
        'success'
      );

      toast.success('Membro atualizado com sucesso!', {
        description: `As alterações para ${formData.full_name || 'o usuário'} já foram sincronizadas.`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao atualizar membro', {
        description: err.message || 'Falha na comunicação com o banco de dados.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-3xl p-0 overflow-hidden border-border/60 max-h-[90vh] flex flex-col text-left">
        <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/15 via-background to-background border-b border-border/40 shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 text-primary rounded-2xl flex items-center justify-center border border-primary/20 shadow-xs">
                <User className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black">Editar Parâmetros do Membro</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Altere privilégios, metas, veículos e parâmetros operacionais de {user.full_name || 'Usuário'}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Section Navigation Tabs */}
          <div className="flex overflow-x-auto hide-scrollbar gap-1.5 mt-4 pt-1">
            <button
              type="button"
              onClick={() => setActiveSection('profile')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeSection === 'profile'
                  ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <User className="w-3.5 h-3.5 text-primary" />
              Perfil & Acesso
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('financial')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeSection === 'financial'
                  ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              Finanças & Metas
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('operational')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeSection === 'operational'
                  ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <Fuel className="w-3.5 h-3.5 text-amber-500" />
              Veículo & Combustível
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('pizzaria')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeSection === 'pizzaria'
                  ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <Pizza className="w-3.5 h-3.5 text-rose-500" />
              Taxas de Pizzaria
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('market')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeSection === 'market'
                  ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
              Mercado & Cotações
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
            {/* Section 1: Profile & Access */}
            {activeSection === 'profile' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome Completo</label>
                  <Input
                    value={formData.full_name || ''}
                    onChange={e => handleChange('full_name', e.target.value)}
                    placeholder="Ex: Carlos Eduardo"
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ID do Usuário (Supabase Auth)</label>
                  <Input
                    value={user.user_id}
                    disabled
                    className="h-10 rounded-xl bg-muted/50 border-border/40 font-mono text-[11px] text-muted-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground">Identificador único gerado na autenticação.</p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-foreground block">Privilégios de Administrador</span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">
                      Concede acesso irrestrito ao painel admin e configurações do sistema.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChange('is_admin', !formData.is_admin)}
                    className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer relative ${
                      formData.is_admin ? 'bg-primary' : 'bg-muted border border-border/60'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-background shadow-xs transition-transform ${
                        formData.is_admin ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Section 2: Financial & Goals */}
            {activeSection === 'financial' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    Saldo Inicial (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.initial_balance ?? 0}
                    onChange={e => handleChange('initial_balance', parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">Saldo base antes dos lançamentos</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                    Mão de Obra Diária (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.default_driver_labor ?? 50}
                    onChange={e => handleChange('default_driver_labor', parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                  />
                  <p className="text-[10px] text-muted-foreground">Remuneração diária do motorista</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-amber-500" />
                    Meta Semanal Bruta (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.weekly_goal ?? 1000}
                    onChange={e => handleChange('weekly_goal', parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-emerald-500" />
                    Meta Semanal Líquida (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.weekly_net_goal ?? 700}
                    onChange={e => handleChange('weekly_net_goal', parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                  />
                </div>
              </div>
            )}

            {/* Section 3: Vehicle & Operational */}
            {activeSection === 'operational' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-indigo-500" />
                    Consumo Médio (km/L)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    value={formData.vehicle_km_per_liter ?? 35}
                    onChange={e => handleChange('vehicle_km_per_liter', parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Fuel className="w-3.5 h-3.5 text-amber-500" />
                    Preço Gasolina (R$/L)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.fuel_price ?? 5.89}
                    onChange={e => handleChange('fuel_price', parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                  />
                </div>
              </div>
            )}

            {/* Section 4: Pizzaria Rates */}
            {activeSection === 'pizzaria' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Entregas na Base (Franquia)</label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.pizzaria_base_deliveries ?? 10}
                    onChange={e => handleChange('pizzaria_base_deliveries', parseInt(e.target.value) || 0)}
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Valor Diária Base (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.pizzaria_base_rate ?? 60}
                    onChange={e => handleChange('pizzaria_base_rate', parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Diária Acima da Base (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.pizzaria_daily_rate_above_base ?? 70}
                    onChange={e => handleChange('pizzaria_daily_rate_above_base', parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Taxa por Entrega (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.pizzaria_delivery_rate ?? 3.5}
                    onChange={e => handleChange('pizzaria_delivery_rate', parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Adicional Fora do Bairro (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.pizzaria_out_of_neighborhood_rate ?? 5.0}
                    onChange={e => handleChange('pizzaria_out_of_neighborhood_rate', parseFloat(e.target.value) || 0)}
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                  />
                </div>
              </div>
            )}

            {/* Section 5: Market & Quotes */}
            {activeSection === 'market' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Provedor de Cotações</label>
                  <Select
                    value={formData.quote_provider || 'auto'}
                    onValueChange={(val: any) => handleChange('quote_provider', val)}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60">
                      <SelectValue placeholder="Selecione o provedor" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/60">
                      <SelectItem value="auto">Automático (Auto Failover)</SelectItem>
                      <SelectItem value="brapi">Brapi (B3 Oficial)</SelectItem>
                      <SelectItem value="yahoo">Yahoo Finance</SelectItem>
                      <SelectItem value="hgbrasil">HG Brasil Finance</SelectItem>
                      <SelectItem value="mfinance">MFinance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Token Brapi Pessoal</label>
                  <Input
                    type="password"
                    value={formData.brapi_token || ''}
                    onChange={e => handleChange('brapi_token', e.target.value)}
                    placeholder="Deixe em branco para usar token global do sistema"
                    className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/40 flex items-center justify-between shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-10 font-bold text-xs border-border/60 cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl h-10 font-bold text-xs shadow-md gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
