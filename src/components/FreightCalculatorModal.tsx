import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calculator, 
  Truck, 
  Fuel, 
  Wrench, 
  CreditCard, 
  Percent, 
  Check, 
  DollarSign, 
  RotateCcw,
  Sparkles,
  ShieldAlert,
  UserCheck,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from './CurrencyInput';

interface FreightCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFreight: (data: {
    freightPrice: number;
    tollExpense: number;
    totalKm: number;
    descriptionSummary: string;
  }) => void;
  defaultKm?: number;
  vehicleKmPerLiter?: number;
  fuelPrice?: number;
  maintenanceRatePerKm?: number;
  defaultDriverLabor?: number;
}

export function FreightCalculatorModal({
  isOpen,
  onClose,
  onApplyFreight,
  defaultKm = 0,
  vehicleKmPerLiter = 10,
  fuelPrice = 6.00,
  maintenanceRatePerKm = 0.30,
  defaultDriverLabor = 100
}: FreightCalculatorModalProps) {
  // Inputs
  const [km, setKm] = useState<string>(defaultKm > 0 ? String(defaultKm) : '');
  const [isRoundTrip, setIsRoundTrip] = useState<boolean>(false);
  
  // Fuel & Vehicle (Pegos da configuração)
  const [kml, setKml] = useState<string>(String(vehicleKmPerLiter || 10));
  const [fuelCostPerLiter, setFuelCostPerLiter] = useState<string>(String(fuelPrice || 6.00));
  
  // Additional Expenses
  const [tolls, setTolls] = useState<string>('');
  const [otherExpenses, setOtherExpenses] = useState<string>('');
  const [extraExpenses, setExtraExpenses] = useState<string>('');
  
  // Driver Labor / Diária (Configurável no perfil)
  const [driverLabor, setDriverLabor] = useState<string>(String(defaultDriverLabor || 100));
  
  // Profit & Markup Mode
  const [marginPercent, setMarginPercent] = useState<number>(30); // 30% default
  const [emptyReturnFactor, setEmptyReturnFactor] = useState<boolean>(false); // Se volta vazio +50% de km no combustível/manutenção

  useEffect(() => {
    if (isOpen) {
      if (defaultKm > 0 && (!km || km === '0')) {
        setKm(String(defaultKm));
      }
      if (vehicleKmPerLiter) {
        setKml(String(vehicleKmPerLiter));
      }
      if (fuelPrice) {
        setFuelCostPerLiter(String(fuelPrice));
      }
      if (defaultDriverLabor !== undefined) {
        setDriverLabor(String(defaultDriverLabor));
      }
    }
  }, [isOpen, defaultKm, vehicleKmPerLiter, fuelPrice, defaultDriverLabor]);

  if (!isOpen) return null;

  // Numeric Calculations
  const rawKm = Math.max(0, Number(km) || 0);
  const effectiveKm = isRoundTrip ? rawKm * 2 : rawKm;
  const wearKm = emptyReturnFactor ? effectiveKm * 1.5 : effectiveKm;

  const numKml = Math.max(0.1, Number(kml) || 10);
  const numFuelPrice = Math.max(0, Number(fuelCostPerLiter) || 0);
  // O valor de desgaste é fixo baseado na regra da reserva de manutenção
  const numMaintPerKm = Math.max(0, Number(maintenanceRatePerKm) || 0.30);
  
  const numTolls = Math.max(0, Number(tolls) || 0);
  const numOther = Math.max(0, Number(otherExpenses) || 0);
  const numExtra = Math.max(0, Number(extraExpenses) || 0);
  const numDriverLabor = Math.max(0, Number(driverLabor) || 0);

  // Costs
  const fuelTotalCost = (wearKm / numKml) * numFuelPrice;
  const maintenanceTotalCost = wearKm * numMaintPerKm;
  const additionalDirectCosts = numTolls + numOther + numExtra;
  
  const totalBaseCosts = fuelTotalCost + maintenanceTotalCost + additionalDirectCosts + numDriverLabor;

  // Pricing with Margin
  const marginMultiplier = 1 + (marginPercent / 100);
  const suggestedFreightPrice = totalBaseCosts * marginMultiplier;
  
  const estimatedNetProfit = suggestedFreightPrice - (fuelTotalCost + maintenanceTotalCost + additionalDirectCosts);
  const pricePerKm = effectiveKm > 0 ? suggestedFreightPrice / effectiveKm : 0;
  const costPerKm = effectiveKm > 0 ? totalBaseCosts / effectiveKm : 0;

  const handleApply = () => {
    const summary = `Frete ${effectiveKm}km | Pedágio: R$${numTolls.toFixed(2)} | Margem: ${marginPercent}%`;
    onApplyFreight({
      freightPrice: Number(suggestedFreightPrice.toFixed(2)),
      tollExpense: Number(numTolls.toFixed(2)),
      totalKm: Math.round(effectiveKm),
      descriptionSummary: summary
    });
    onClose();
  };

  const presetMargins = [15, 25, 35, 50, 75, 100];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <Calculator className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                Calculadora de Precificação de Frete
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              </h2>
              <p className="text-xs text-indigo-100/80 font-medium">
                Precificação baseada na sua regra de manutenção e dados do veículo
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 text-foreground text-sm flex-1">
          
          {/* Section 1: Distância e Rota */}
          <div className="bg-muted/30 border border-border/70 rounded-xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-indigo-500" /> Distância do Frete (KM)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRoundTrip(!isRoundTrip)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                    isRoundTrip 
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 font-extrabold' 
                      : 'bg-card border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" /> Ida e Volta ({isRoundTrip ? 'Ativo 2x' : 'Só Ida'})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold">Quilometragem (Apenas Ida)</span>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Ex: 80"
                    value={km}
                    onChange={(e) => setKm(e.target.value)}
                    className="h-11 rounded-xl font-bold text-base border-border pr-12"
                  />
                  <span className="absolute right-3.5 top-3 text-xs font-extrabold text-muted-foreground">KM</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold">Distância Total Considerada</span>
                <div className="h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-3.5 flex items-center justify-between font-mono font-black text-indigo-600 dark:text-indigo-400 text-base">
                  <span>{effectiveKm} KM</span>
                  {isRoundTrip && <span className="text-[10px] bg-indigo-500/20 px-1.5 py-0.5 rounded uppercase font-extrabold text-indigo-500">2x Ida/Volta</span>}
                </div>
              </div>
            </div>

            {/* Empty Return Option */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setEmptyReturnFactor(!emptyReturnFactor)}
                className={`w-full text-left p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  emptyReturnFactor 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400' 
                    : 'bg-card border-border/80 text-muted-foreground hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Considerar risco de Volta Vazia (+50% desgaste/combustível)</span>
                </div>
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${emptyReturnFactor ? 'bg-amber-500 border-amber-500 text-white' : 'border-border'}`}>
                  {emptyReturnFactor && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Consumo, Combustível e Manutenção */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Fuel className="w-3.5 h-3.5 text-amber-500" /> Consumo (KM/L)
              </label>
              <Input
                type="number"
                step="0.1"
                placeholder="10"
                value={kml}
                onChange={(e) => setKml(e.target.value)}
                className="h-10 rounded-xl font-bold border-border"
              />
              <span className="text-[9px] text-muted-foreground block">Perfil: {vehicleKmPerLiter} km/L</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Combustível (R$/L)
              </label>
              <CurrencyInput
                placeholder="6,00"
                value={fuelCostPerLiter}
                onChange={setFuelCostPerLiter}
                className="h-10 rounded-xl font-bold border-border"
              />
              <span className="text-[9px] text-muted-foreground block">Perfil: R$ {fuelPrice?.toFixed(2)}/L</span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5 text-blue-500" /> Desgaste (R$/KM)
              </label>
              <div className="h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 px-3 flex items-center justify-between font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                <span>R$ {numMaintPerKm.toFixed(2)}/km</span>
                <span className="text-[8px] bg-blue-500/20 px-1.5 py-0.5 rounded font-extrabold text-blue-600 dark:text-blue-300 uppercase">
                  Reserva
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground block">Regra da Reserva de Manutenção</span>
            </div>
          </div>

          {/* Section 3: Despesas Adicionais (Pedágios, Outros, Valor do Motorista) */}
          <div className="bg-muted/20 border border-border/60 rounded-xl p-3.5 space-y-3">
            <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-purple-500" /> Pedágios, Outros & Valor do Motorista
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Pedágios (R$)</span>
                <CurrencyInput
                  placeholder="0,00"
                  value={tolls}
                  onChange={setTolls}
                  className="h-10 rounded-xl font-bold border-border"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Outros / Diversos (R$)</span>
                <CurrencyInput
                  placeholder="0,00"
                  value={otherExpenses}
                  onChange={setOtherExpenses}
                  className="h-10 rounded-xl font-bold border-border"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Valor do Motorista / Diária (R$)</span>
                <CurrencyInput
                  placeholder="100,00"
                  value={driverLabor}
                  onChange={setDriverLabor}
                  className="h-10 rounded-xl font-bold border-border"
                />
                <span className="text-[9px] text-muted-foreground block">Perfil: R$ {Number(defaultDriverLabor || 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Margem de Lucro Desejada */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-emerald-500" /> Margem de Lucro Desejada sobre Custos
              </label>
              <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">
                +{marginPercent}%
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {presetMargins.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMarginPercent(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    marginPercent === m
                      ? 'bg-emerald-500 text-white shadow-xs font-black scale-105'
                      : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  +{m}%
                </button>
              ))}
              <div className="flex-1 min-w-[120px] ml-1">
                <Input
                  type="number"
                  placeholder="Personalizado"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(Math.max(0, Number(e.target.value) || 0))}
                  className="h-9 rounded-lg text-xs font-bold border-border"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Resumo e Resultado Final */}
          <div className="bg-gradient-to-br from-indigo-950/20 via-background to-indigo-900/10 border-2 border-indigo-500/30 rounded-2xl p-4 space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 block">Preço Sugerido Final do Frete</span>
                <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono tracking-tight leading-tight">
                  R$ {suggestedFreightPrice.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block">Lucro Estimado</span>
                <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  +R$ {estimatedNetProfit.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-card/80 p-2.5 rounded-xl border border-border/60">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Combustível Est.</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">R$ {fuelTotalCost.toFixed(2)}</span>
              </div>

              <div className="bg-card/80 p-2.5 rounded-xl border border-border/60">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Manutenção Est.</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">R$ {maintenanceTotalCost.toFixed(2)}</span>
              </div>

              <div className="bg-card/80 p-2.5 rounded-xl border border-border/60">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Custo por KM</span>
                <span className="font-mono font-bold text-rose-500">R$ {costPerKm.toFixed(2)}/km</span>
              </div>

              <div className="bg-card/80 p-2.5 rounded-xl border border-border/60">
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Valor por KM</span>
                <span className="font-mono font-bold text-indigo-500">R$ {pricePerKm.toFixed(2)}/km</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-muted/40 border-t border-border flex items-center justify-between gap-3 shrink-0">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="rounded-xl font-bold cursor-pointer h-11"
          >
            Cancelar
          </Button>

          <Button 
            onClick={handleApply}
            className="rounded-xl font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all h-11 px-6 cursor-pointer flex items-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Aplicar ao Lançamento
          </Button>
        </div>

      </div>
    </div>
  );
}
