import React, { useState, useEffect } from 'react';
import { X, Bike, Search, DollarSign, Gauge, Calendar, Palette, ShieldCheck, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { Vehicle } from '../types';
import { fipeService, FipeBrand, FipeModel, FipeYear, FipeResult } from '../lib/fipeService';
import { Button } from '@/components/ui/button';
import { toast } from '../lib/toast';

interface VehicleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Vehicle, 'id' | 'user_id' | 'created_at'>) => Promise<any>;
  initialData?: Vehicle;
}

export const VehicleFormModal: React.FC<VehicleFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [brand, setBrand] = useState(initialData?.brand || '');
  const [model, setModel] = useState(initialData?.model || '');
  const [version, setVersion] = useState(initialData?.version || '');
  const [yearModel, setYearModel] = useState<number>(initialData?.year_model || new Date().getFullYear());
  const [color, setColor] = useState(initialData?.color || 'Preta');
  const [plate, setPlate] = useState(initialData?.plate || '');
  const [renavam, setRenavam] = useState(initialData?.renavam || '');
  const [currentKm, setCurrentKm] = useState<number>(initialData?.current_km || 0);
  const [avgKmPerLiter, setAvgKmPerLiter] = useState<number>(initialData?.avg_km_per_liter || 30);
  const [defaultLoadCapacityKg, setDefaultLoadCapacityKg] = useState<number>(initialData?.default_load_capacity_kg || 50);
  const [baseFee, setBaseFee] = useState<number>(initialData?.base_fee ?? 15.00);
  const [pricePerKm, setPricePerKm] = useState<number>(initialData?.price_per_km ?? 0.80);
  const [extraStopFee, setExtraStopFee] = useState<number>(initialData?.extra_stop_fee ?? 6.00);
  const [fuelType, setFuelType] = useState(initialData?.fuel_type || 'Gasolina');
  const [acquisitionDate, setAcquisitionDate] = useState(initialData?.acquisition_date || new Date().toISOString().split('T')[0]);
  const [acquisitionValue, setAcquisitionValue] = useState<number>(initialData?.acquisition_value || 0);
  const [acquisitionType, setAcquisitionType] = useState(initialData?.acquisition_type || 'À Vista');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);

  // FIPE Integration State
  const [fipeBrands, setFipeBrands] = useState<FipeBrand[]>([]);
  const [selectedFipeBrand, setSelectedFipeBrand] = useState<string>('');
  const [fipeModels, setFipeModels] = useState<FipeModel[]>([]);
  const [selectedFipeModel, setSelectedFipeModel] = useState<string>('');
  const [fipeYears, setFipeYears] = useState<FipeYear[]>([]);
  const [selectedFipeYear, setSelectedFipeYear] = useState<string>('');
  const [fipeResult, setFipeResult] = useState<FipeResult | null>(null);
  const [isFetchingFipe, setIsFetchingFipe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load FIPE brands on mount
  useEffect(() => {
    if (isOpen) {
      fipeService.getBrands().then(brands => {
        setFipeBrands(brands);
        // Pre-select Yamaha if available
        const defaultBrand = brands.find(b => b.nome.toUpperCase().includes('YAMAHA')) || brands[0];
        if (defaultBrand && !selectedFipeBrand) {
          setSelectedFipeBrand(defaultBrand.codigo);
        }
      });
    }
  }, [isOpen]);

  // Load models when FIPE brand changes
  useEffect(() => {
    if (selectedFipeBrand) {
      fipeService.getModels(selectedFipeBrand).then(models => {
        setFipeModels(models);
        setSelectedFipeModel('');
        setFipeYears([]);
      });
    }
  }, [selectedFipeBrand]);

  // Load years when FIPE model changes
  useEffect(() => {
    if (selectedFipeBrand && selectedFipeModel) {
      fipeService.getYears(selectedFipeBrand, selectedFipeModel).then(years => {
        setFipeYears(years);
        setSelectedFipeYear('');
      });
    }
  }, [selectedFipeBrand, selectedFipeModel]);

  const handleConsultFipe = async () => {
    if (!selectedFipeBrand || !selectedFipeModel || !selectedFipeYear) {
      toast.error('Selecione Marca, Modelo e Ano para consultar a Tabela FIPE');
      return;
    }
    try {
      setIsFetchingFipe(true);
      const result = await fipeService.getFipePrice(selectedFipeBrand, selectedFipeModel, selectedFipeYear);
      if (result) {
        setFipeResult(result);
        setBrand(result.Marca);
        setModel(result.Modelo);
        setYearModel(result.AnoModelo);
        if (result.Combustivel) setFuelType(result.Combustivel);
        toast.success(`FIPE R$ ${result.numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} encontrada!`);
      } else {
        toast.error('Não foi possível obter os dados da FIPE no momento');
      }
    } catch (err) {
      toast.error('Erro na consulta FIPE');
    } finally {
      setIsFetchingFipe(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand || !model) {
      toast.error('Preencha ao menos Marca e Modelo do veículo');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        brand,
        model,
        version,
        year_model: Number(yearModel) || new Date().getFullYear(),
        color,
        plate: plate.toUpperCase(),
        renavam,
        initial_km: Number(currentKm) || 0,
        current_km: Number(currentKm) || 0,
        avg_km_per_liter: Number(avgKmPerLiter) || 30,
        default_load_capacity_kg: Number(defaultLoadCapacityKg) || 50,
        base_fee: Number(baseFee) >= 0 ? Number(baseFee) : 15.00,
        price_per_km: Number(pricePerKm) >= 0 ? Number(pricePerKm) : 0.80,
        extra_stop_fee: Number(extraStopFee) >= 0 ? Number(extraStopFee) : 6.00,
        fuel_type: fuelType,
        acquisition_date: acquisitionDate,
        acquisition_value: Number(acquisitionValue) || 0,
        acquisition_type: acquisitionType,
        notes,
        is_active: isActive,
        fipe_code: fipeResult?.CodigoFipe || initialData?.fipe_code,
        fipe_value: fipeResult?.numericValue || initialData?.fipe_value,
        fipe_ref_month: fipeResult?.MesReferencia || initialData?.fipe_ref_month,
        fipe_updated_at: fipeResult ? fipeResult.fetchedAt : initialData?.fipe_updated_at,
      });
      onClose();
    } catch (err) {
      toast.error('Erro ao salvar veículo');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">
                {initialData ? 'Editar Veículo' : 'Cadastrar Novo Veículo'}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Adicione o veículo à sua garagem com dados FIPE e custos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* FIPE Auto-Fill Box */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Busca Automática Tabela FIPE (Opcional)
              </span>
              {fipeResult?.isOfflineCache && (
                <span className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-bold">
                  Cache Offline
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Marca FIPE</label>
                <select
                  value={selectedFipeBrand}
                  onChange={e => setSelectedFipeBrand(e.target.value)}
                  className="w-full h-9 px-2 bg-card border border-border rounded-xl text-[11px] text-foreground"
                >
                  <option value="">Selecione...</option>
                  {fipeBrands.map(b => (
                    <option key={b.codigo} value={b.codigo}>{b.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Modelo FIPE</label>
                <select
                  value={selectedFipeModel}
                  onChange={e => setSelectedFipeModel(e.target.value)}
                  disabled={!selectedFipeBrand}
                  className="w-full h-9 px-2 bg-card border border-border rounded-xl text-[11px] text-foreground disabled:opacity-50"
                >
                  <option value="">Selecione...</option>
                  {fipeModels.map(m => (
                    <option key={m.codigo} value={m.codigo}>{m.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Ano Modelo</label>
                <select
                  value={selectedFipeYear}
                  onChange={e => setSelectedFipeYear(e.target.value)}
                  disabled={!selectedFipeModel}
                  className="w-full h-9 px-2 bg-card border border-border rounded-xl text-[11px] text-foreground disabled:opacity-50"
                >
                  <option value="">Selecione...</option>
                  {fipeYears.map(y => (
                    <option key={y.codigo} value={y.codigo}>{y.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleConsultFipe}
              disabled={isFetchingFipe || !selectedFipeYear}
              className="w-full h-9 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isFetchingFipe ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              {isFetchingFipe ? 'Consultando FIPE...' : 'Consultar e Preencher Dados FIPE'}
            </Button>

            {fipeResult && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs space-y-1">
                <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                  <span>FIPE: R$ {fipeResult.numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">{fipeResult.MesReferencia}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Código FIPE: <strong>{fipeResult.CodigoFipe}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Manual / General Identification */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Identificação do Veículo</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Marca *</label>
                <input
                  type="text"
                  placeholder="Ex: Yamaha"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Modelo *</label>
                <input
                  type="text"
                  placeholder="Ex: Factor 150"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Versão / Edição</label>
                <input
                  type="text"
                  placeholder="Ex: ED Link"
                  value={version}
                  onChange={e => setVersion(e.target.value)}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Ano Modelo *</label>
                <input
                  type="number"
                  placeholder="Ex: 2024"
                  value={yearModel}
                  onChange={e => setYearModel(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Placa</label>
                <input
                  type="text"
                  placeholder="Ex: ABC-1D23"
                  value={plate}
                  onChange={e => setPlate(e.target.value)}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium uppercase text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Cor</label>
                <input
                  type="text"
                  placeholder="Ex: Preta"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Operational Parameters */}
          <div className="space-y-3 pt-2 border-t border-border/40">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Parâmetros Operacionais</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">KM Inicial / Base *</label>
                <input
                  type="number"
                  placeholder="Ex: 12450 (ou 0 se nova)"
                  value={currentKm}
                  onChange={e => setCurrentKm(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Consumo Médio (km/L) *</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 35.5"
                  value={avgKmPerLiter}
                  onChange={e => setAvgKmPerLiter(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground"
                  required
                />
              </div>
            </div>
          </div>

          {/* Freight & Cargo Configuration (Orçamento de Fretes) */}
          <div className="space-y-3 pt-2 border-t border-border/40 p-3.5 bg-primary/5 border border-primary/20 rounded-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Configuração para Orçamento de Fretes
              </h4>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Estes valores serão carregados automaticamente ao gerar orçamentos de frete com esta moto.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Capacidade de Carga (kg)</label>
                <input
                  type="number"
                  placeholder="Ex: 50"
                  value={defaultLoadCapacityKg}
                  onChange={e => setDefaultLoadCapacityKg(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Taxa Base / Saída (R$)</label>
                <input
                  type="number"
                  step="0.50"
                  placeholder="Ex: 15.00"
                  value={baseFee}
                  onChange={e => setBaseFee(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Preço por KM (R$/KM)</label>
                <input
                  type="number"
                  step="0.05"
                  placeholder="Ex: 0.80"
                  value={pricePerKm}
                  onChange={e => setPricePerKm(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Parada Extra (R$)</label>
                <input
                  type="number"
                  step="0.50"
                  placeholder="Ex: 6.00"
                  value={extraStopFee}
                  onChange={e => setExtraStopFee(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Acquisition & Valuation */}
          <div className="space-y-3 pt-2 border-t border-border/40">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Aquisição & Valor</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Valor Pago (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 14500"
                  value={acquisitionValue}
                  onChange={e => setAcquisitionValue(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Data da Compra</label>
                <input
                  type="date"
                  value={acquisitionDate}
                  onChange={e => setAcquisitionDate(e.target.value)}
                  className="w-full h-10 px-3 bg-card border border-border rounded-xl text-xs font-medium text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Active Status Check */}
          <div className="p-3 bg-muted/20 border border-border/60 rounded-2xl flex items-center justify-between cursor-pointer" onClick={() => setIsActive(!isActive)}>
            <div>
              <div className="text-xs font-bold text-foreground">Veículo Ativo / Principal</div>
              <div className="text-[10.5px] text-muted-foreground">Aparece selecionado por padrão nos lançamentos de combustível e manutenção</div>
            </div>
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary"
            />
          </div>

          {/* Buttons */}
          <div className="pt-3 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11 rounded-2xl text-xs font-bold cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-11 rounded-2xl text-xs font-bold bg-primary text-primary-foreground shadow-md hover:bg-primary/90 cursor-pointer"
            >
              {isSubmitting ? 'Salvando...' : (initialData ? 'Atualizar Veículo' : 'Salvar Novo Veículo')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
