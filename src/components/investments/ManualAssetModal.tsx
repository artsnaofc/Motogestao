import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Edit3, 
  X, 
  Save, 
  Building2, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  ShieldAlert, 
  Activity, 
  Layers 
} from 'lucide-react';
import { toast } from 'sonner';

interface ManualAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (assetData: any, source?: string) => Promise<void>;
  initialData?: any | null;
}

export const ManualAssetModal: React.FC<ManualAssetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [ticker, setTicker] = useState('');
  const [assetType, setAssetType] = useState<'Ação' | 'FII'>('Ação');
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [sector, setSector] = useState('');
  const [segment, setSegment] = useState('');
  const [lastPrice, setLastPrice] = useState<string>('');
  
  // Stock specific
  const [pl, setPl] = useState<string>('');
  const [pvp, setPvp] = useState<string>('');
  const [dividendYield, setDividendYield] = useState<string>('');
  const [roe, setRoe] = useState<string>('');
  const [roic, setRoic] = useState<string>('');
  const [netMargin, setNetMargin] = useState<string>('');
  const [netDebtOverEbitda, setNetDebtOverEbitda] = useState<string>('');
  const [revenueCagr5y, setRevenueCagr5y] = useState<string>('');
  const [dailyLiquidity, setDailyLiquidity] = useState<string>('');

  // FII specific
  const [fiiType, setFiiType] = useState<'Tijolo' | 'Papel' | 'FOF' | 'Híbrido' | 'Fiagro' | 'Infra' | 'Outros'>('Tijolo');
  const [ffoYield, setFfoYield] = useState<string>('');
  const [physicalVacancy, setPhysicalVacancy] = useState<string>('');
  const [propertiesCount, setPropertiesCount] = useState<string>('');
  const [capRate, setCapRate] = useState<string>('');
  const [netWorth, setNetWorth] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTicker(initialData.ticker || '');
      setAssetType(initialData.asset_type || initialData.type || (initialData.ticker?.endsWith('11') ? 'FII' : 'Ação'));
      setName(initialData.name || '');
      setCnpj(initialData.cnpj || '');
      setSector(initialData.sector || initialData.fii_segment || initialData.segment || '');
      setSegment(initialData.segment || initialData.subsector || '');
      setLastPrice(initialData.last_price ? String(initialData.last_price) : (initialData.lastPrice ? String(initialData.lastPrice) : ''));
      
      // Stocks
      setPl(initialData.pl !== undefined && initialData.pl !== null ? String(initialData.pl) : '');
      setPvp(initialData.pvp !== undefined && initialData.pvp !== null ? String(initialData.pvp) : '');
      setDividendYield(initialData.dividend_yield !== undefined && initialData.dividend_yield !== null ? String(initialData.dividend_yield) : (initialData.dividendYield ? String(initialData.dividendYield) : ''));
      setRoe(initialData.roe !== undefined && initialData.roe !== null ? String(initialData.roe) : '');
      setRoic(initialData.roic !== undefined && initialData.roic !== null ? String(initialData.roic) : '');
      setNetMargin(initialData.net_margin !== undefined && initialData.net_margin !== null ? String(initialData.net_margin) : (initialData.netMargin ? String(initialData.netMargin) : ''));
      setNetDebtOverEbitda(initialData.net_debt_over_ebitda !== undefined && initialData.net_debt_over_ebitda !== null ? String(initialData.net_debt_over_ebitda) : (initialData.netDebtOverEbitda ? String(initialData.netDebtOverEbitda) : ''));
      setRevenueCagr5y(initialData.revenue_cagr_5y !== undefined && initialData.revenue_cagr_5y !== null ? String(initialData.revenue_cagr_5y) : (initialData.revenueCagr5y ? String(initialData.revenueCagr5y) : ''));
      setDailyLiquidity(initialData.daily_liquidity !== undefined && initialData.daily_liquidity !== null ? String(initialData.daily_liquidity) : (initialData.dailyLiquidity ? String(initialData.dailyLiquidity) : ''));

      // FIIs
      setFiiType(initialData.fii_type || initialData.fiiType || 'Tijolo');
      setFfoYield(initialData.ffo_yield !== undefined && initialData.ffo_yield !== null ? String(initialData.ffo_yield) : (initialData.ffoYield ? String(initialData.ffoYield) : ''));
      setPhysicalVacancy(
        initialData.physical_vacancy !== undefined && initialData.physical_vacancy !== null ? String(initialData.physical_vacancy) :
        initialData.physicalVacancy !== undefined && initialData.physicalVacancy !== null ? String(initialData.physicalVacancy) :
        initialData.vacancia_media !== undefined && initialData.vacancia_media !== null ? String(initialData.vacancia_media) :
        initialData.vacancia !== undefined && initialData.vacancia !== null ? String(initialData.vacancia) : ''
      );
      setPropertiesCount(
        initialData.properties_count !== undefined && initialData.properties_count !== null ? String(initialData.properties_count) :
        initialData.propertiesCount !== undefined && initialData.propertiesCount !== null ? String(initialData.propertiesCount) :
        initialData.qtd_imoveis !== undefined && initialData.qtd_imoveis !== null ? String(initialData.qtd_imoveis) :
        initialData.imoveis !== undefined && initialData.imoveis !== null ? String(initialData.imoveis) : ''
      );
      setCapRate(
        initialData.cap_rate !== undefined && initialData.cap_rate !== null ? String(initialData.cap_rate) :
        initialData.capRate !== undefined && initialData.capRate !== null ? String(initialData.capRate) :
        initialData.caprate !== undefined && initialData.caprate !== null ? String(initialData.caprate) : ''
      );
      setNetWorth(initialData.net_worth !== undefined && initialData.net_worth !== null ? String(initialData.net_worth) : (initialData.netWorth ? String(initialData.netWorth) : ''));
    } else {
      setTicker('');
      setAssetType('Ação');
      setName('');
      setCnpj('');
      setSector('');
      setSegment('');
      setLastPrice('');
      setPl('');
      setPvp('');
      setDividendYield('');
      setRoe('');
      setRoic('');
      setNetMargin('');
      setNetDebtOverEbitda('');
      setRevenueCagr5y('');
      setDailyLiquidity('');
      setFiiType('Tijolo');
      setFfoYield('');
      setPhysicalVacancy('');
      setPropertiesCount('');
      setCapRate('');
      setNetWorth('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTicker = ticker.toUpperCase().trim();
    if (!cleanTicker) {
      toast.error('Informe o código do ticker (ex: PETR4, HGLG11).');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        ticker: cleanTicker,
        asset_type: assetType,
        name: name || cleanTicker,
        cnpj: cnpj || null,
        sector: sector || (assetType === 'FII' ? 'Imobiliário' : 'Outros'),
        segment: segment || null,
        last_price: lastPrice ? parseFloat(lastPrice.replace(',', '.')) : null,
        daily_liquidity: dailyLiquidity ? parseFloat(dailyLiquidity.replace(',', '.')) : null,
        pvp: pvp ? parseFloat(pvp.replace(',', '.')) : null,
        dividend_yield: dividendYield ? parseFloat(dividendYield.replace(',', '.')) : null,
      };

      if (assetType === 'Ação') {
        payload.pl = pl ? parseFloat(pl.replace(',', '.')) : null;
        payload.roe = roe ? parseFloat(roe.replace(',', '.')) : null;
        payload.roic = roic ? parseFloat(roic.replace(',', '.')) : null;
        payload.net_margin = netMargin ? parseFloat(netMargin.replace(',', '.')) : null;
        payload.net_debt_over_ebitda = netDebtOverEbitda ? parseFloat(netDebtOverEbitda.replace(',', '.')) : null;
        payload.revenue_cagr_5y = revenueCagr5y ? parseFloat(revenueCagr5y.replace(',', '.')) : null;
      } else {
        payload.fii_type = fiiType;
        payload.fii_segment = sector || 'Outros';
        payload.ffo_yield = ffoYield ? parseFloat(ffoYield.replace(',', '.')) : null;
        payload.physical_vacancy = physicalVacancy ? parseFloat(physicalVacancy.replace(',', '.')) : null;
        payload.properties_count = propertiesCount ? parseInt(propertiesCount, 10) : null;
        payload.cap_rate = capRate ? parseFloat(capRate.replace(',', '.')) : null;
        payload.net_worth = netWorth ? parseFloat(netWorth.replace(',', '.')) : null;
      }

      await onSave(payload, 'Manual');
      toast.success(`Ativo ${cleanTicker} salvo com sucesso!`);
      onClose();
    } catch (err) {
      console.error('Error saving manual asset:', err);
      toast.error('Erro ao salvar o ativo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              {initialData ? <Edit3 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">
                {initialData ? `Editar Indicadores de ${initialData.ticker}` : 'Cadastrar Ativo Manualmente'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Defina ou ajuste os fundamentos e parâmetros para análise e rebalanceamento.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ASSET TYPE & TICKER */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                Tipo do Ativo *
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/30 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => setAssetType('Ação')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    assetType === 'Ação'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📈 Ação
                </button>
                <button
                  type="button"
                  onClick={() => setAssetType('FII')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    assetType === 'FII'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🏢 FII
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                Código Ticker *
              </label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="Ex: PETR4, HGLG11"
                disabled={Boolean(initialData)}
                required
                className="w-full bg-card border border-border/70 rounded-xl px-3 py-2 text-xs font-black uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                Cotação Atual (R$)
              </label>
              <input
                type="text"
                value={lastPrice}
                onChange={(e) => setLastPrice(e.target.value)}
                placeholder="Ex: 38,50"
                className="w-full bg-card border border-border/70 rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* NAME & SECTOR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                Nome da Empresa / Fundo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Petrobras PN, CSHG Logística"
                className="w-full bg-card border border-border/70 rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                {assetType === 'FII' ? 'Segmento do FII' : 'Setor de Atuação'}
              </label>
              <input
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder={assetType === 'FII' ? 'Ex: Logística, Shoppings, Papel' : 'Ex: Petróleo, Bancos, Elétrica'}
                className="w-full bg-card border border-border/70 rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* FUNDAMENTAL METRICS */}
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Indicadores Fundamentalistas
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground block mb-1">P/VP</label>
                <input
                  type="text"
                  value={pvp}
                  onChange={(e) => setPvp(e.target.value)}
                  placeholder="Ex: 1,02"
                  className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground block mb-1">Dividend Yield (%)</label>
                <input
                  type="text"
                  value={dividendYield}
                  onChange={(e) => setDividendYield(e.target.value)}
                  placeholder="Ex: 9,5"
                  className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {assetType === 'Ação' ? (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">P/L (Preço / Lucro)</label>
                    <input
                      type="text"
                      value={pl}
                      onChange={(e) => setPl(e.target.value)}
                      placeholder="Ex: 6,4"
                      className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">ROE (%)</label>
                    <input
                      type="text"
                      value={roe}
                      onChange={(e) => setRoe(e.target.value)}
                      placeholder="Ex: 18,2"
                      className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">ROIC (%)</label>
                    <input
                      type="text"
                      value={roic}
                      onChange={(e) => setRoic(e.target.value)}
                      placeholder="Ex: 15,0"
                      className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Margem Líquida (%)</label>
                    <input
                      type="text"
                      value={netMargin}
                      onChange={(e) => setNetMargin(e.target.value)}
                      placeholder="Ex: 14,5"
                      className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Dívida Líq. / EBITDA</label>
                    <input
                      type="text"
                      value={netDebtOverEbitda}
                      onChange={(e) => setNetDebtOverEbitda(e.target.value)}
                      placeholder="Ex: 1,2"
                      className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Cresc. Receita 5a (%)</label>
                    <input
                      type="text"
                      value={revenueCagr5y}
                      onChange={(e) => setRevenueCagr5y(e.target.value)}
                      placeholder="Ex: 8,5"
                      className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">FFO Yield (%)</label>
                    <input
                      type="text"
                      value={ffoYield}
                      onChange={(e) => setFfoYield(e.target.value)}
                      placeholder="Ex: 9,2"
                      className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Vacância Média (%)</label>
                    <input
                      type="text"
                      value={physicalVacancy}
                      onChange={(e) => setPhysicalVacancy(e.target.value)}
                      placeholder="Ex: 4,5"
                      className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Cap Rate (%)</label>
                    <input
                      type="text"
                      value={capRate}
                      onChange={(e) => setCapRate(e.target.value)}
                      placeholder="Ex: 8,5"
                      className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Qtd de Imóveis</label>
                    <input
                      type="text"
                      value={propertiesCount}
                      onChange={(e) => setPropertiesCount(e.target.value)}
                      placeholder="Ex: 24"
                      className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Tipo de FII</label>
                    <select
                      value={fiiType}
                      onChange={(e) => setFiiType(e.target.value as any)}
                      className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="Tijolo">Tijolo (Imóveis Físicos)</option>
                      <option value="Papel">Papel (CRIs / Renda Fixa)</option>
                      <option value="FOF">FOF (Fundo de Fundos)</option>
                      <option value="Híbrido">Híbrido</option>
                      <option value="Fiagro">Fiagro</option>
                      <option value="Infra">Infraestrutura</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="text-[10px] font-bold text-muted-foreground block mb-1">Volume Médio Diário (R$)</label>
                <input
                  type="text"
                  value={dailyLiquidity}
                  onChange={(e) => setDailyLiquidity(e.target.value)}
                  placeholder="Ex: 5000000"
                  className="w-full bg-card border border-border/70 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Salvando...' : 'Salvar Ativo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
