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
              Gestão operacional, tabela FIPE, manutenção preventivas e custo por KM
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
              Cadastre sua moto para acompanhar o custo por KM, dados da Tabela FIPE, manutenção e histórico de despesas sem duplicação financeira.
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
                        {v.year_model ? `Ano ${v.year_model}` : ''} {v.plate ? `• Placa ${v.plate}` : ''} {v.color ? `• ${v.color}` : ''}
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

                {/* Metrics Highlights */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3 p-3 bg-card/80 border border-border/50 rounded-2xl">
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block">KM Atual</span>
                    <strong className="text-xs font-extrabold text-foreground block mt-0.5">
                      {v.current_km.toLocaleString('pt-BR')} km
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Tabela FIPE</span>
                    <strong className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                      {v.fipe_value ? formatCurrency(v.fipe_value) : 'Consulte'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Custo Total</span>
                    <strong className="text-xs font-extrabold text-rose-500 block mt-0.5">
                      {formatCurrency(metrics.totalCost)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase block">Custo / KM</span>
                    <strong className="text-xs font-extrabold text-indigo-500 block mt-0.5">
                      {metrics.costPerKm > 0 ? `R$ ${metrics.costPerKm.toFixed(2)}/km` : 'R$ 0,00'}
                    </strong>
                  </div>
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
            <h3 className="text-sm font-black text-foreground">Comparativo de Desempenho e Custos entre Motos</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground uppercase text-[10px]">
                  <th className="py-2.5 px-3">Veículo</th>
                  <th className="py-2.5 px-3">KM Atual</th>
                  <th className="py-2.5 px-3">Combustível</th>
                  <th className="py-2.5 px-3">Manutenção</th>
                  <th className="py-2.5 px-3">Custo Total</th>
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
                      <td className="py-3 px-3 text-foreground">{formatCurrency(m.fuelCost)}</td>
                      <td className="py-3 px-3 text-foreground">{formatCurrency(m.maintenanceCost)}</td>
                      <td className="py-3 px-3 text-rose-500 font-bold">{formatCurrency(m.totalCost)}</td>
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
