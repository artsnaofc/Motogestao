import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  User, 
  ShieldCheck, 
  ShieldAlert, 
  Mail, 
  Calendar, 
  DollarSign, 
  Target, 
  Fuel, 
  Gauge, 
  Pizza, 
  Layers, 
  Code2, 
  Copy, 
  Check, 
  Edit3, 
  Trash2,
  TrendingUp,
  Activity,
  Briefcase
} from 'lucide-react';
import { UserSettings } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { toast } from '@/lib/toast';

interface UserDetailModalProps {
  user: UserSettings | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditClick: (user: UserSettings) => void;
  onToggleAdmin: (userId: string, currentStatus: boolean) => void;
  onDeleteClick?: (userId: string) => void;
}

type TabKey = 'financial' | 'operational' | 'pizzaria' | 'categories' | 'raw';

export function UserDetailModal({
  user,
  open,
  onOpenChange,
  onEditClick,
  onToggleAdmin,
  onDeleteClick,
}: UserDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('financial');
  const [copiedId, setCopiedId] = useState(false);

  if (!user) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.user_id);
    setCopiedId(true);
    toast.success('ID do usuário copiado!');
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Fuel calculations
  const fuelPrice = user.fuel_price || 0;
  const kmPerLiter = user.vehicle_km_per_liter || 0;
  const costPerKm = (kmPerLiter > 0 && fuelPrice > 0) ? (fuelPrice / kmPerLiter) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-3xl p-0 overflow-hidden border-border/60 max-h-[90vh] flex flex-col text-left">
        {/* Header with gradient & Avatar */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/15 via-background to-background border-b border-border/40 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-md ${
                user.is_admin 
                  ? 'bg-primary/20 border-primary/30 text-primary font-black text-xl' 
                  : 'bg-muted/80 border-border/60 text-muted-foreground font-bold text-lg'
              }`}>
                {user.full_name ? user.full_name.substring(0, 2).toUpperCase() : <User className="w-7 h-7" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-foreground truncate">
                    {user.full_name || 'Usuário Sem Nome'}
                  </h3>
                  {user.is_admin ? (
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider border border-primary/20">
                      Administrador
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-black uppercase tracking-wider border border-border/40">
                      Membro Padrão
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span className="flex items-center gap-1 font-mono text-[11px] bg-muted/60 px-2 py-0.5 rounded-lg border border-border/40">
                    ID: {user.user_id.substring(0, 12)}...
                    <button
                      onClick={handleCopyId}
                      className="ml-1 hover:text-foreground transition-colors cursor-pointer"
                      title="Copiar ID Completo"
                    >
                      {copiedId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions in Header */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEditClick(user);
                }}
                className="rounded-xl h-9 font-bold text-xs border-border/60 hover:bg-primary/10 hover:text-primary gap-1.5 cursor-pointer shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleAdmin(user.user_id, !!user.is_admin)}
                className={`rounded-xl h-9 font-bold text-xs gap-1.5 cursor-pointer shadow-xs ${
                  user.is_admin 
                    ? 'border-amber-500/30 text-amber-600 hover:bg-amber-500/10' 
                    : 'border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10'
                }`}
              >
                {user.is_admin ? (
                  <><ShieldAlert className="w-3.5 h-3.5" /> Remover Admin</>
                ) : (
                  <><ShieldCheck className="w-3.5 h-3.5" /> Tornar Admin</>
                )}
              </Button>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex overflow-x-auto hide-scrollbar gap-1.5 mt-5 pt-1">
            <button
              onClick={() => setActiveTab('financial')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'financial'
                  ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              Financeiro & Metas
            </button>

            <button
              onClick={() => setActiveTab('operational')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'operational'
                  ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <Fuel className="w-3.5 h-3.5 text-amber-500" />
              Veículo & Combustível
            </button>

            <button
              onClick={() => setActiveTab('pizzaria')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pizzaria'
                  ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <Pizza className="w-3.5 h-3.5 text-rose-500" />
              Taxas de Pizzaria
            </button>

            <button
              onClick={() => setActiveTab('categories')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'categories'
                  ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              Categorias
            </button>

            <button
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'raw'
                  ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
              Raw JSON
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {activeTab === 'financial' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    Saldo Inicial Registrado
                  </span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(user.initial_balance || 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Ponto de partida do fluxo de caixa</p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                    Mão de Obra Diária Padrão
                  </span>
                  <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                    {formatCurrency(user.default_driver_labor || 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Custo diário reservado para o motorista</p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-amber-500" />
                    Meta Semanal Bruta
                  </span>
                  <p className="text-xl font-black text-foreground font-mono">
                    {user.weekly_goal ? formatCurrency(user.weekly_goal) : 'Não configurada'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Alvo de faturamento semanal bruto</p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-emerald-500" />
                    Meta Semanal Líquida
                  </span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {user.weekly_net_goal ? formatCurrency(user.weekly_net_goal) : 'Não configurada'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Alvo semanal após dedução de despesas</p>
                </div>
              </div>

              {/* Market & Quotes configuration */}
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Integração com Mercado & Cotações
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[10px] font-bold uppercase">
                    {user.quote_provider || 'auto'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground pt-1">
                  <div>
                    <span className="text-[10px] uppercase font-black block">Provedor Selecionado:</span>
                    <span className="text-xs font-semibold text-foreground">{user.quote_provider || 'Automático (Auto)'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black block">Token Brapi Personalizado:</span>
                    <span className="text-xs font-mono text-foreground">
                      {user.brapi_token ? `${user.brapi_token.substring(0, 6)}••••••••` : 'Não configurado (usa fallback global)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'operational' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-indigo-500" />
                    Consumo Médio
                  </span>
                  <p className="text-xl font-black text-foreground font-mono">
                    {user.vehicle_km_per_liter ? `${user.vehicle_km_per_liter} km/L` : '35.0 km/L'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Autonomia padrão do veículo</p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1">
                    <Fuel className="w-3.5 h-3.5 text-amber-500" />
                    Preço da Gasolina
                  </span>
                  <p className="text-xl font-black text-foreground font-mono">
                    {user.fuel_price ? formatCurrency(user.fuel_price) : 'R$ 5,89/L'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Valor por litro para cálculos</p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                    Custo por KM
                  </span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(costPerKm || 0.17)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Custo combustível por km rodado</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-2">
                <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground block">
                  Categorias com KM Obrigatório
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(user.categories_with_km && user.categories_with_km.length > 0) ? (
                    user.categories_with_km.map((cat, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-background border border-border/60 text-xs font-semibold">
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      Todas as corridas e fretes calculam KM por padrão.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pizzaria' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-1 mb-2">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                  <Pizza className="w-4 h-4 text-rose-500" />
                  Tabela de Remuneração e Diárias de Pizzaria
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Parâmetros aplicados automaticamente ao registrar diárias na categoria Pizzaria.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">
                    Entregas na Base (Franquia)
                  </span>
                  <p className="text-lg font-black text-foreground font-mono">
                    {user.pizzaria_base_deliveries || 10} entregas
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">
                    Valor Diária Base
                  </span>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(user.pizzaria_base_rate || 60)}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">
                    Diária Acima da Base
                  </span>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(user.pizzaria_daily_rate_above_base || 70)}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">
                    Taxa por Entrega
                  </span>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(user.pizzaria_delivery_rate || 3.5)}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 space-y-1 sm:col-span-2">
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">
                    Adicional Fora do Bairro
                  </span>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(user.pizzaria_out_of_neighborhood_rate || 5.0)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  Categorias de Receitas ({user.income_categories?.length || 0})
                </span>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-muted/20 border border-border/50">
                  {(user.income_categories && user.income_categories.length > 0) ? (
                    user.income_categories.map((cat, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-semibold">
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground italic">Nenhuma categoria de receita cadastrada</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400 block">
                  Despesas Operacionais ({user.operational_expense_categories?.length || 0})
                </span>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-muted/20 border border-border/50">
                  {(user.operational_expense_categories && user.operational_expense_categories.length > 0) ? (
                    user.operational_expense_categories.map((cat, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-semibold">
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground italic">Nenhuma despesa operacional cadastrada</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600 dark:text-indigo-400 block">
                  Despesas Pessoais ({user.personal_expense_categories?.length || 0})
                </span>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-muted/20 border border-border/50">
                  {(user.personal_expense_categories && user.personal_expense_categories.length > 0) ? (
                    user.personal_expense_categories.map((cat, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-xs font-semibold">
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground italic">Nenhuma despesa pessoal cadastrada</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black text-muted-foreground">Payload Completo do Usuário</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(user, null, 2));
                    toast.success('JSON copiado!');
                  }}
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Copiar JSON
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-muted/50 border border-border/60 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-72">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted/20 border-t border-border/40 flex items-center justify-between shrink-0">
          {onDeleteClick ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onDeleteClick(user.user_id);
              }}
              className="rounded-xl h-9 font-bold text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir Usuário
            </Button>
          ) : <div />}

          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-9 px-5 font-bold text-xs cursor-pointer shadow-xs"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
