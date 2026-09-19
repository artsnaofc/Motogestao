import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Bike,
  ArrowLeft,
  Gauge,
  Wrench,
  Fuel,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Clock,
  Sparkles,
  Plus,
  ReceiptText,
  CheckCircle2,
  Edit,
  Trash2,
  Search,
  Filter,
} from 'lucide-react';
import { useVehicles } from '../contexts/VehiclesContext';
import { useData } from '../contexts/DataContext';
import { VehicleFormModal } from '../components/VehicleFormModal';
import { OdometerLogModal } from '../components/OdometerLogModal';
import { MaintenanceModal } from '../components/MaintenanceModal';
import { Button } from '@/components/ui/button';
import { fipeService } from '../lib/fipeService';
import { toast } from '../lib/toast';

export const VehicleDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    vehicles,
    activeVehicle,
    setActiveVehicle,
    updateVehicle,
    deleteVehicle,
    addOdometerLog,
    addMaintenanceRecord,
    addFipeHistoryEntry,
    getVehicleMetrics,
    fipeHistory,
    odometerLogs,
    isLoadingVehicles,
  } = useVehicles();

  const { transactions, reserveTransactions, hideValues } = useData();

  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'maintenance' | 'km_logs' | 'fipe'>('overview');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'income' | 'expense' | 'utilizacao'>('all');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isKmModalOpen, setIsKmModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isUpdatingFipe, setIsUpdatingFipe] = useState(false);

  const vehicle = vehicles.find(v => v.id === id);

  if (!vehicle) {
    if (isLoadingVehicles) {
      return (
        <div className="space-y-6 pb-12 animate-pulse">
          <div className="h-14 bg-card/60 rounded-3xl border border-border/50" />
          <div className="h-44 bg-card/60 rounded-3xl border border-border/50" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-card/60 rounded-2xl border border-border/40" />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-sm font-bold text-muted-foreground">Moto não encontrada na garagem.</p>
        <Button onClick={() => navigate('/vehicles')} variant="outline" className="rounded-2xl">
          Voltar para Minhas Motos
        </Button>
      </div>
    );
  }

  const metrics = getVehicleMetrics(vehicle.id, transactions, reserveTransactions);
  const vFipeHistory = fipeHistory[vehicle.id] || [];
  const vOdometerLogs = odometerLogs[vehicle.id] || [];

  const formatCurrency = (val: number) => {
    if (hideValues) return '••••••';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Compile unified financial records for this bike (Transactions + Reserve Utilizations)
  const unifiedHistory = React.useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      amount: number;
      category: string;
      description?: string;
      type: 'income' | 'expense' | 'utilizacao';
      isReserve?: boolean;
    }> = [];

    // Financial transactions
    transactions.filter(t => t.vehicle_id === vehicle.id).forEach(t => {
      list.push({
        id: t.id,
        date: t.date,
        amount: Number(t.amount) || 0,
        category: t.category,
        description: t.description,
        type: t.type === 'income' ? 'income' : 'expense',
      });
    });

    // Reserve utilizations (only those without duplicate transaction_id)
    reserveTransactions.filter(rt => rt.vehicle_id === vehicle.id && rt.type === 'utilizacao').forEach(rt => {
      if (!rt.transaction_id) {
        list.push({
          id: rt.id,
          date: rt.date,
          amount: Number(rt.amount) || 0,
          category: rt.category || 'Reserva Manutenção',
          description: rt.description || 'Uso da Reserva',
          type: 'utilizacao',
          isReserve: true,
        });
      }
    });

    // Sort by date desc
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, reserveTransactions, vehicle.id]);

  const filteredHistory = useMemo(() => {
    return unifiedHistory.filter(item => {
      // Type filter
      if (historyTypeFilter !== 'all') {
        if (historyTypeFilter === 'income' && item.type !== 'income') return false;
        if (historyTypeFilter === 'expense' && item.type !== 'expense') return false;
        if (historyTypeFilter === 'utilizacao' && item.type !== 'utilizacao') return false;
      }

      // Category filter
      if (historyCategoryFilter !== 'all') {
        if (!item.category.toLowerCase().includes(historyCategoryFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedHistory, historyTypeFilter, historyCategoryFilter]);

  const handleUpdateFipeNow = async () => {
    if (!vehicle.fipe_code) {
      toast.error('Edite a moto e selecione a Marca e Modelo FIPE para permitir atualização automática');
      setIsEditModalOpen(true);
      return;
    }
    try {
      setIsUpdatingFipe(true);
      toast.info('Consultando FIPE atualizada...');
      // search by brand/model code or fallback
      const result = await fipeService.getFipePrice('80', vehicle.fipe_code, `${vehicle.year_model}-1`);
      if (result) {
        await addFipeHistoryEntry(vehicle.id, result.CodigoFipe, result.numericValue, result.MesReferencia);
        toast.success(`FIPE atualizada para R$ ${result.numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}!`);
      } else {
        toast.error('Não foi possível obter a FIPE no momento');
      }
    } catch (err) {
      toast.error('Erro ao atualizar FIPE');
    } finally {
      setIsUpdatingFipe(false);
    }
  };

  const handleDeleteBike = async () => {
    if (window.confirm(`Tem certeza que deseja remover a moto ${vehicle.brand} ${vehicle.model} da sua garagem? Os lançamentos financeiros no extrato serão preservados.`)) {
      await deleteVehicle(vehicle.id);
      navigate('/vehicles');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/vehicles')}
          className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Garagem
        </button>

        <div className="flex items-center gap-2">
          {!vehicle.is_active && (
            <Button
              variant="outline"
              onClick={() => setActiveVehicle(vehicle.id)}
              className="h-9 px-3 rounded-xl text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
            >
              Tornar Moto Ativa
            </Button>
          )}

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted/50 text-foreground text-xs font-bold transition-colors cursor-pointer"
            title="Editar cadastro"
          >
            <Edit className="w-4 h-4" />
          </button>

          <button
            onClick={handleDeleteBike}
            className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-bold transition-colors cursor-pointer"
            title="Excluir moto"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Motorcycle Header Sheet */}
      <div className="relative p-6 bg-card border border-border/80 rounded-3xl shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-3xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 shrink-0">
              <Bike className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-foreground tracking-tight">
                  {vehicle.brand} {vehicle.model}
                </h1>
                {vehicle.is_active && (
                  <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ativa
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">
                {vehicle.version ? `${vehicle.version} • ` : ''}Ano {vehicle.year_model} {vehicle.plate ? `• Placa ${vehicle.plate}` : ''} {vehicle.color ? `• ${vehicle.color}` : ''}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setIsKmModalOpen(true)}
              variant="outline"
              className="h-10 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Gauge className="w-4 h-4 text-primary" />
              + Atualizar KM
            </Button>

            <Button
              onClick={() => navigate(`/add?vehicle_id=${vehicle.id}&category=Combust%C3%ADvel`)}
              variant="outline"
              className="h-10 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Fuel className="w-4 h-4 text-indigo-500" />
              + Abastecimento
            </Button>

            <Button
              onClick={() => setIsMaintenanceModalOpen(true)}
              className="h-10 px-4 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Wrench className="w-4 h-4" />
              + Manutenção
            </Button>
          </div>
        </div>

        {/* Valuation & Depreciation Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/20 border border-border/50 rounded-2xl">
          <div>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Hodômetro Atual</span>
            <strong className="text-sm font-black text-foreground block mt-0.5">
              {metrics.currentOdometer.toLocaleString('pt-BR')} km
            </strong>
            <span className="text-[9.5px] text-muted-foreground block">
              {metrics.totalKmRecorded.toLocaleString('pt-BR')} km rodados (lançamentos)
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Valor FIPE Atual</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400 block">
                {vehicle.fipe_value ? formatCurrency(vehicle.fipe_value) : 'Consulte'}
              </strong>
              <button
                onClick={handleUpdateFipeNow}
                disabled={isUpdatingFipe}
                className="text-[10px] text-primary hover:underline font-bold"
                title="Buscar FIPE atualizada"
              >
                {isUpdatingFipe ? '...' : <Search className="w-3 h-3 inline" />}
              </button>
            </div>
            {vehicle.fipe_ref_month && (
              <span className="text-[9.5px] text-muted-foreground block">{vehicle.fipe_ref_month}</span>
            )}
          </div>

          <div>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Valor Pago (Aquisição)</span>
            <strong className="text-sm font-black text-foreground block mt-0.5">
              {vehicle.acquisition_value ? formatCurrency(vehicle.acquisition_value) : 'Não informado'}
            </strong>
          </div>

          <div>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Variação de Patrimônio</span>
            {metrics.valueDifference !== 0 ? (
              <strong className={`text-sm font-black block mt-0.5 ${metrics.valueDifference >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {metrics.valueDifference >= 0 ? '+' : ''}{formatCurrency(metrics.valueDifference)} ({metrics.percentageVariation.toFixed(1)}%)
              </strong>
            ) : (
              <strong className="text-sm font-black text-muted-foreground block mt-0.5">-</strong>
            )}
          </div>
        </div>

        {/* Overdue / Preventive Alerts Banner */}
        {metrics.overdueMaintenances.length > 0 && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 animate-bounce" />
            <div className="text-xs">
              <span className="font-extrabold text-rose-600 dark:text-rose-400 block">
                {metrics.overdueMaintenances.length} Alerta(s) de Manutenção em Atraso ou Próximo do Limite!
              </span>
              <span className="text-muted-foreground">
                Verifique o óleo, pneus ou freios na aba Manutenção para garantir o bom estado da moto.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-border/60 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
          }`}
        >
          Resumo Operacional & Custos
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'history'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
          }`}
        >
          Histórico Financeiro ({unifiedHistory.length})
        </button>

        <button
          onClick={() => setActiveTab('maintenance')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'maintenance'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
          }`}
        >
          Manutenção Preventiva
        </button>

        <button
          onClick={() => setActiveTab('km_logs')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'km_logs'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
          }`}
        >
          Registros de Hodômetro
        </button>

        <button
          onClick={() => setActiveTab('fipe')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'fipe'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
          }`}
        >
          Histórico FIPE
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Financial KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 bg-card border border-border/70 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Faturamento da Moto
              </span>
              <strong className="text-lg font-black text-emerald-600 dark:text-emerald-400 block">
                {formatCurrency(metrics.totalIncome)}
              </strong>
              <span className="text-[10.5px] text-muted-foreground block">
                {metrics.revenuePerKm > 0 ? `R$ ${metrics.revenuePerKm.toFixed(2)}/km gerado` : 'Ganhos vinculados'}
              </span>
            </div>

            <div className="p-4 bg-card border border-border/70 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10.5px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-rose-500" />
                Custo Operacional Total
              </span>
              <strong className="text-lg font-black text-rose-500 block">
                {formatCurrency(metrics.totalCost)}
              </strong>
              <span className="text-[10.5px] text-muted-foreground block">
                {metrics.costPerKm > 0 ? `R$ ${metrics.costPerKm.toFixed(2)}/km rodado` : 'Despesas da moto'}
              </span>
            </div>

            <div className="p-4 bg-card border border-border/70 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10.5px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Lucro Líquido
              </span>
              <strong className={`text-lg font-black block ${metrics.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                {formatCurrency(metrics.netProfit)}
              </strong>
              <span className="text-[10.5px] font-bold text-muted-foreground block">
                {metrics.totalIncome > 0 ? `Margem: ${metrics.marginPercent.toFixed(1)}%` : 'Receita menos custos'}
              </span>
            </div>

            <div className="p-4 bg-card border border-border/70 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[10.5px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-primary" />
                Custo / KM
              </span>
              <strong className="text-lg font-black text-indigo-500 block">
                {metrics.costPerKm > 0 ? `R$ ${metrics.costPerKm.toFixed(2)}/km` : 'R$ 0,00'}
              </strong>
              <span className="text-[10.5px] text-muted-foreground block">
                Combustível: {metrics.fuelCostPerKm > 0 ? `R$ ${metrics.fuelCostPerKm.toFixed(2)}/km` : '0,00'}
              </span>
            </div>
          </div>

          {/* Operational Expenses Subgrid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-card/70 border border-border/60 rounded-2xl space-y-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Fuel className="w-3 h-3 text-indigo-500" />
                Combustível
              </span>
              <strong className="text-sm font-black text-foreground block">
                {formatCurrency(metrics.fuelCost)}
              </strong>
              <span className="text-[9.5px] text-muted-foreground block">
                {metrics.totalLiters > 0 ? `${metrics.totalLiters.toFixed(1)} L (${metrics.realizedKmPerLiter.toFixed(1)} km/l)` : '0 L'}
              </span>
            </div>

            <div className="p-3.5 bg-card/70 border border-border/60 rounded-2xl space-y-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Wrench className="w-3 h-3 text-amber-500" />
                Oficina & Revisões
              </span>
              <strong className="text-sm font-black text-foreground block">
                {formatCurrency(metrics.maintenanceCost)}
              </strong>
              <span className="text-[9.5px] text-muted-foreground block">Serviços mecânicos</span>
            </div>

            <div className="p-3.5 bg-card/70 border border-border/60 rounded-2xl space-y-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-500" />
                Óleo & Pneus
              </span>
              <strong className="text-sm font-black text-foreground block">
                {formatCurrency(metrics.oilCost + metrics.tiresCost)}
              </strong>
              <span className="text-[9.5px] text-muted-foreground block">Desgaste rápido</span>
            </div>

            <div className="p-3.5 bg-card/70 border border-border/60 rounded-2xl space-y-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <ReceiptText className="w-3 h-3 text-rose-500" />
                Taxas & Seguro
              </span>
              <strong className="text-sm font-black text-foreground block">
                {formatCurrency(metrics.taxCost + metrics.insuranceCost)}
              </strong>
              <span className="text-[9.5px] text-muted-foreground block">IPVA, licença, multas</span>
            </div>
          </div>

          {/* Breakdown by Category */}
          <div className="p-5 bg-card border border-border/70 rounded-3xl space-y-4 shadow-xs">
            <h3 className="text-sm font-black text-foreground">Detalhamento de Custos por Categoria</h3>

            {metrics.categoryBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum custo registrado para este veículo ainda.</p>
            ) : (
              <div className="space-y-2.5">
                {metrics.categoryBreakdown.map(item => {
                  const pct = metrics.totalCost > 0 ? (item.total / metrics.totalCost) * 100 : 0;
                  return (
                    <div key={item.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-foreground">{item.category}</span>
                        <span className="text-foreground">{formatCurrency(item.total)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full h-2 bg-muted/40 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Summary Balance Strip */}
          <div className="p-4 bg-card border border-border/70 rounded-3xl grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Faturamento Vinculado</span>
                <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(metrics.totalIncome)}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Despesas & Utilizações</span>
                <strong className="text-sm font-black text-rose-500">
                  -{formatCurrency(metrics.totalCost)}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Resultado Líquido</span>
                <strong className={`text-sm font-black ${metrics.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {metrics.netProfit >= 0 ? '+' : ''}{formatCurrency(metrics.netProfit)}
                </strong>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-card border border-border/70 rounded-2xl">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs font-bold text-foreground">Filtros:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter */}
              <select
                value={historyTypeFilter}
                onChange={e => setHistoryTypeFilter(e.target.value as any)}
                className="h-8 px-2.5 bg-muted/40 border border-border rounded-xl text-xs font-semibold text-foreground cursor-pointer"
              >
                <option value="all">Todos os Tipos</option>
                <option value="income">Apenas Entradas (Faturamento)</option>
                <option value="expense">Apenas Despesas</option>
                <option value="utilizacao">Apenas Resgates de Reserva</option>
              </select>

              {/* Category Filter */}
              <select
                value={historyCategoryFilter}
                onChange={e => setHistoryCategoryFilter(e.target.value)}
                className="h-8 px-2.5 bg-muted/40 border border-border rounded-xl text-xs font-semibold text-foreground cursor-pointer"
              >
                <option value="all">Todas as Categorias</option>
                <option value="frete">Frete do Dia</option>
                <option value="pizzaria">Pizzaria</option>
                <option value="uber">Uber</option>
                <option value="trabalho">Trabalho</option>
                <option value="combustível">Combustível</option>
                <option value="manutenção">Manutenção</option>
                <option value="pneu">Pneus</option>
                <option value="óleo">Óleo</option>
                <option value="seguro">Seguro</option>
                <option value="ipva">IPVA / Taxas</option>
              </select>
            </div>
          </div>

          {/* Transactions List */}
          {filteredHistory.length === 0 ? (
            <div className="p-8 text-center bg-card border border-border/70 rounded-3xl space-y-1">
              <p className="text-xs font-bold text-muted-foreground">Nenhum lançamento encontrado para os filtros selecionados.</p>
              <p className="text-[11px] text-muted-foreground">Adicione transações ou faturamentos vinculando este veículo.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map(item => {
                const isIncome = item.type === 'income';
                const isReserve = item.type === 'utilizacao';

                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-card border border-border/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isIncome
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : isReserve
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        {isIncome ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : isReserve ? (
                          <Wrench className="w-4 h-4" />
                        ) : (
                          <DollarSign className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground truncate">{item.category}</span>
                          <span
                            className={`text-[9px] uppercase font-extrabold px-2 py-0.2 rounded-full border ${
                              isIncome
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : isReserve
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {isIncome ? 'Entrada' : isReserve ? 'Reserva' : 'Saída'}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-muted-foreground truncate">{item.description || item.date}</div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <strong
                        className={`text-xs sm:text-sm font-black block ${
                          isIncome
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isReserve
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-500'
                        }`}
                      >
                        {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
                      </strong>
                      <span className="text-[10px] text-muted-foreground block">{item.date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PREVENTIVE MAINTENANCE */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground">Programa de Manutenção Preventiva</h3>
            <Button onClick={() => setIsMaintenanceModalOpen(true)} className="h-9 text-xs font-bold rounded-xl">
              + Nova Manutenção
            </Button>
          </div>

          {metrics.upcomingMaintenances.length === 0 && metrics.overdueMaintenances.length === 0 ? (
            <div className="p-8 text-center bg-card border border-border/70 rounded-3xl">
              <p className="text-xs text-muted-foreground">Nenhuma manutenção programada para este veículo.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.overdueMaintenances.map(m => (
                <div key={m.id} className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-rose-600 dark:text-rose-400">{m.type} - {m.description}</div>
                      <div className="text-[10.5px] text-muted-foreground">
                        {m.next_due_km ? `Próximo KM Alerta: ${m.next_due_km.toLocaleString('pt-BR')} km` : ''} {m.next_due_date ? `• Próxima Data: ${m.next_due_date}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold bg-rose-500 text-white px-2 py-0.5 rounded-full uppercase">Atrasado</span>
                </div>
              ))}

              {metrics.upcomingMaintenances.map(m => (
                <div key={m.id} className="p-4 bg-card border border-border/70 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Wrench className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-foreground">{m.type} - {m.description}</div>
                      <div className="text-[10.5px] text-muted-foreground">
                        {m.next_due_km ? `Próximo KM Alerta: ${m.next_due_km.toLocaleString('pt-BR')} km` : ''} {m.next_due_date ? `• Próxima Data: ${m.next_due_date}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full uppercase">Em dia</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: KM LOGS */}
      {activeTab === 'km_logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground">Histórico de Leitura de Hodômetro</h3>
            <Button onClick={() => setIsKmModalOpen(true)} className="h-9 text-xs font-bold rounded-xl">
              + Registrar KM
            </Button>
          </div>

          {vOdometerLogs.length === 0 ? (
            <div className="p-8 text-center bg-card border border-border/70 rounded-3xl">
              <p className="text-xs text-muted-foreground">Nenhum registro individual de KM salvo ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vOdometerLogs.map(log => (
                <div key={log.id} className="p-3 bg-card border border-border/60 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Gauge className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <strong className="text-xs font-extrabold text-foreground">{log.km.toLocaleString('pt-BR')} km</strong>
                      <span className="text-[10.5px] text-muted-foreground block">{log.notes || 'Registro manual'}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">{log.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: FIPE HISTORY */}
      {activeTab === 'fipe' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground">Histórico da Tabela FIPE</h3>
            <Button onClick={handleUpdateFipeNow} disabled={isUpdatingFipe} className="h-9 text-xs font-bold rounded-xl">
              {isUpdatingFipe ? 'Consultando...' : 'Atualizar FIPE Agora'}
            </Button>
          </div>

          {vFipeHistory.length === 0 ? (
            <div className="p-8 text-center bg-card border border-border/70 rounded-3xl">
              <p className="text-xs text-muted-foreground">Nenhum histórico de FIPE salvo para este veículo.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vFipeHistory.map(f => (
                <div key={f.id} className="p-3 bg-card border border-border/60 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-foreground block">{f.ref_month}</span>
                    <span className="text-[10px] text-muted-foreground">Código: {f.fipe_code}</span>
                  </div>
                  <strong className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(f.fipe_value)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <VehicleFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialData={vehicle}
        onSave={async (data) => {
          await updateVehicle(vehicle.id, data);
        }}
      />

      <OdometerLogModal
        isOpen={isKmModalOpen}
        onClose={() => setIsKmModalOpen(false)}
        currentKm={metrics.currentOdometer}
        onSave={async (km, date, notes) => {
          await addOdometerLog(vehicle.id, km, date, notes);
        }}
      />

      <MaintenanceModal
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        vehicleId={vehicle.id}
        currentKm={metrics.currentOdometer}
        onSave={async (record) => {
          await addMaintenanceRecord(record);
        }}
      />
    </div>
  );
};
