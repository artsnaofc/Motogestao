import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bike,
  Plus,
  ChevronRight,
  Gauge,
  DollarSign,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Wrench,
  Fuel,
  Scale,
  Calendar,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { useVehicles } from '../contexts/VehiclesContext';
import { useData } from '../contexts/DataContext';
import { VehicleFormModal } from '../components/VehicleFormModal';
import { OdometerLogModal } from '../components/OdometerLogModal';
import { VehiclesSkeleton } from '../components/vehicles/VehiclesSkeleton';
import { Vehicle } from '../types';
import { Button } from '@/components/ui/button';

export const Vehicles: React.FC = () => {
  const navigate = useNavigate();
  const { vehicles, activeVehicle, setActiveVehicle, addVehicle, getVehicleMetrics, addOdometerLog, isLoadingVehicles } = useVehicles();
  const { transactions, reserveTransactions, hideValues } = useData();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedVehicleForKm, setSelectedVehicleForKm] = useState<Vehicle | null>(null);

  const formatCurrency = (val: number) => {
    if (hideValues) return '••••••';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Precompute metrics map with useMemo so fleet rendering is instantaneous
  const metricsMap = React.useMemo(() => {
    const map: Record<string, ReturnType<typeof getVehicleMetrics>> = {};
    (vehicles || []).forEach(v => {
      map[v.id] = getVehicleMetrics(v.id, transactions, reserveTransactions);
    });
    return map;
  }, [vehicles, transactions, reserveTransactions, getVehicleMetrics]);

  // Consolidated fleet totals
  const fleetTotals = React.useMemo(() => {
    let totalIncome = 0;
    let totalCost = 0;
    let totalKm = 0;

    Object.values(metricsMap).forEach(m => {
      totalIncome += m.totalIncome || 0;
      totalCost += m.totalCost || 0;
      totalKm += m.totalKmRecorded || 0;
    });

    const netProfit = totalIncome - totalCost;
    const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const avgCostPerKm = totalKm > 0 ? totalCost / totalKm : 0;

    return { totalIncome, totalCost, netProfit, margin, totalKm, avgCostPerKm };
  }, [metricsMap]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-card/60 backdrop-blur-xl border border-border/60 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 shrink-0">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
              Minhas Motos & Garagem
              <span className="text-[10px] uppercase tracking-wider font-extrabold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
                {vehicles.length} {vehicles.length === 1 ? 'moto' : 'motos'}
              </span>
            </h1>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              Faturamento por moto, lucro líquido, tabela FIPE, manutenção e custo operacional por KM
            </p>
          </div>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="h-11 px-5 rounded-2xl text-xs font-bold bg-primary text-primary-foreground shadow-md hover:bg-primary/90 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Cadastrar Nova Moto
        </Button>
      </div>

      {/* Fleet Financial Overview Banner */}
      {vehicles.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 bg-card/90 border border-border/70 rounded-3xl space-y-1 shadow-xs">
            <span className="text-[10.5px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              Faturamento com Motos
            </span>
            <strong className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 block">
              {formatCurrency(fleetTotals.totalIncome)}
            </strong>
            <span className="text-[10px] text-muted-foreground block">
              Ganhos brutos vinculados
            </span>
          </div>

          <div className="p-4 bg-card/90 border border-border/70 rounded-3xl space-y-1 shadow-xs">
            <span className="text-[10.5px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-rose-500" />
              Custos Operacionais
            </span>
            <strong className="text-base sm:text-lg font-black text-rose-500 block">
              {formatCurrency(fleetTotals.totalCost)}
            </strong>
            <span className="text-[10px] text-muted-foreground block">
              Combustível, oficinas e taxas
            </span>
          </div>

          <div className="p-4 bg-card/90 border border-border/70 rounded-3xl space-y-1 shadow-xs">
            <span className="text-[10.5px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Lucro Líquido da Garagem
            </span>
            <strong className={`text-base sm:text-lg font-black block ${fleetTotals.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
              {formatCurrency(fleetTotals.netProfit)}
            </strong>
            <span className="text-[10px] font-bold text-muted-foreground block">
              Margem: {fleetTotals.margin.toFixed(1)}%
            </span>
          </div>

          <div className="p-4 bg-card/90 border border-border/70 rounded-3xl space-y-1 shadow-xs">
            <span className="text-[10.5px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-primary" />
              Custo Médio / KM
            </span>
            <strong className="text-base sm:text-lg font-black text-indigo-500 block">
              {fleetTotals.avgCostPerKm > 0 ? `R$ ${fleetTotals.avgCostPerKm.toFixed(2)}/km` : 'R$ 0,00'}
            </strong>
            <span className="text-[10px] text-muted-foreground block">
              {fleetTotals.totalKm.toLocaleString('pt-BR')} KM rodados
            </span>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoadingVehicles && vehicles.length === 0 && (
        <VehiclesSkeleton />
      )}

      {/* Empty State */}
      {!isLoadingVehicles && vehicles.length === 0 && (
        <div className="p-8 text-center bg-card border border-border/80 rounded-3xl space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Bike className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-black text-foreground">Sua garagem está vazia</h3>
            <p className="text-xs text-muted-foreground">
              Cadastre sua moto para acompanhar o faturamento, lucro líquido, custo por KM, dados da Tabela FIPE e manutenção preventiva.
            </p>
          </div>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="h-11 px-6 rounded-2xl text-xs font-bold bg-primary text-primary-foreground shadow-md cursor-pointer"
          >
            + Cadastrar Minha Primeira Moto
          </Button>
        </div>
      )}

      {/* Motorcycle Fleet Grid */}
      {vehicles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {vehicles.map(v => {
            const metrics = metricsMap[v.id] || getVehicleMetrics(v.id, transactions, reserveTransactions);
            const isSelected = activeVehicle?.id === v.id;

            return (
              <div
                key={v.id}
                className={`relative bg-card border rounded-3xl p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between ${
                  isSelected ? 'border-primary/60 ring-2 ring-primary/20 bg-primary/5' : 'border-border/70'
                }`}
              >
                {/* Active Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500 shrink-0">
                      <Bike className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-foreground">
                          {v.brand} {v.model}
                        </h3>
                        {v.is_active && (
                          <span className="text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Ativa
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {v.year_model ? `Ano ${v.year_model}` : ''} {v.plate ? `• Placa ${v.plate}` : ''} {v.fuel_type ? `• ${v.fuel_type}` : ''}
                      </p>
                    </div>
                  </div>

                  {!v.is_active && (
                    <button
                      onClick={() => setActiveVehicle(v.id)}
                      className="text-[10.5px] font-bold text-muted-foreground hover:text-primary bg-muted/40 hover:bg-primary/10 border border-border/60 rounded-xl px-2.5 py-1 transition-colors cursor-pointer"
                    >
                      Tornar Ativa
                    </button>
                  )}
                </div>

                {/* Financial & Operational KPI Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3 p-3 bg-card/80 border border-border/50 rounded-2xl">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Faturado</span>
                    <strong className="text-xs font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                      {formatCurrency(metrics.totalIncome)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Custo Total</span>
                    <strong className="text-xs font-extrabold text-rose-500 block mt-0.5">
                      {formatCurrency(metrics.totalCost)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Lucro Líquido</span>
                    <strong className={`text-xs font-black block mt-0.5 ${metrics.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                      {formatCurrency(metrics.netProfit)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Custo / KM</span>
                    <strong className="text-xs font-extrabold text-indigo-500 block mt-0.5">
                      {metrics.costPerKm > 0 ? `R$ ${metrics.costPerKm.toFixed(2)}/km` : 'R$ 0,00'}
                    </strong>
                  </div>
                </div>

                {/* Secondary details bar */}
                <div className="flex items-center justify-between px-1 py-1 text-[11px] text-muted-foreground font-medium mb-3">
                  <span>Hodômetro: <strong className="text-foreground">{v.current_km.toLocaleString('pt-BR')} km</strong></span>
                  <span>FIPE: <strong className="text-foreground">{v.fipe_value ? formatCurrency(v.fipe_value) : 'Consulte'}</strong></span>
                  {metrics.totalIncome > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Margem: {metrics.marginPercent.toFixed(0)}%</span>
                  )}
                </div>

                {/* Alerts summary if any */}
                {metrics.overdueMaintenances.length > 0 && (
                  <div className="mb-3 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{metrics.overdueMaintenances.length} manutenção(ões) pendente(s) / atrasada(s)!</span>
                  </div>
                )}

                {/* Card Actions */}
                <div className="pt-2 border-t border-border/40 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedVehicleForKm(v)}
                    className="flex-1 h-9 bg-muted/30 hover:bg-muted border border-border/60 rounded-xl text-xs font-bold text-foreground flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Gauge className="w-3.5 h-3.5 text-primary" />
                    + Registrar KM
                  </button>

                  <Link
                    to={`/vehicles/${v.id}`}
                    className="flex-1 h-9 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Ver Ficha
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comparison Section (If 2 or more motorcycles) */}
      {vehicles.length >= 2 && (
        <div className="p-5 bg-card border border-border/70 rounded-3xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-black text-foreground">Comparativo de Faturamento, Custos e Lucro entre Motos</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground uppercase text-[10px]">
                  <th className="py-2.5 px-3">Veículo</th>
                  <th className="py-2.5 px-3">KM Atual</th>
                  <th className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-black">Faturado (Bruto)</th>
                  <th className="py-2.5 px-3">Combustível</th>
                  <th className="py-2.5 px-3">Manutenção</th>
                  <th className="py-2.5 px-3 text-rose-500">Custo Total</th>
                  <th className="py-2.5 px-3 font-black">Lucro Líquido</th>
                  <th className="py-2.5 px-3">Custo/KM</th>
                  <th className="py-2.5 px-3">Valor FIPE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {vehicles.map(v => {
                  const m = getVehicleMetrics(v.id, transactions, reserveTransactions);
                  return (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 font-bold text-foreground flex items-center gap-2">
                        <Bike className="w-4 h-4 text-primary shrink-0" />
                        {v.brand} {v.model}
                      </td>
                      <td className="py-3 px-3 text-foreground font-semibold">{v.current_km.toLocaleString('pt-BR')} km</td>
                      <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-extrabold">{formatCurrency(m.totalIncome)}</td>
                      <td className="py-3 px-3 text-foreground">{formatCurrency(m.fuelCost)}</td>
                      <td className="py-3 px-3 text-foreground">{formatCurrency(m.maintenanceCost)}</td>
                      <td className="py-3 px-3 text-rose-500 font-bold">{formatCurrency(m.totalCost)}</td>
                      <td className={`py-3 px-3 font-black ${m.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        {formatCurrency(m.netProfit)}
                        {m.totalIncome > 0 && (
                          <span className="text-[10px] text-muted-foreground block font-normal">
                            ({m.marginPercent.toFixed(0)}% margem)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-indigo-500 font-bold">R$ {m.costPerKm.toFixed(2)}/km</td>
                      <td className="py-3 px-3 text-emerald-600 font-bold">{v.fipe_value ? formatCurrency(v.fipe_value) : 'N/A'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal */}
      <VehicleFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={async (data) => {
          await addVehicle(data);
        }}
      />

      {/* Register Odometer Modal */}
      {selectedVehicleForKm && (
        <OdometerLogModal
          isOpen={Boolean(selectedVehicleForKm)}
          onClose={() => setSelectedVehicleForKm(null)}
          currentKm={selectedVehicleForKm.current_km}
          onSave={async (km, date, notes) => {
            await addOdometerLog(selectedVehicleForKm.id, km, date, notes);
          }}
        />
      )}
    </div>
  );
};
