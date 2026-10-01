import React from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction, UserSettings, Reserve, ReserveTransaction, Dividend } from '../../types';
import { Button } from '@/components/ui/button';
import { 
  PiggyBank, 
  Wrench, 
  Shield, 
  Car, 
  Coins, 
  Fuel, 
  Gauge, 
  Sparkles, 
  Heart, 
  TrendingUp, 
  TrendingDown, 
  Briefcase, 
  Bike, 
  Package, 
  ShoppingBag, 
  Coffee, 
  Wifi, 
  Utensils, 
  Gift, 
  Plane, 
  GraduationCap, 
  Laptop, 
  Stethoscope, 
  Hammer, 
  Home, 
  Award, 
  FileText, 
  Edit2, 
  Trash, 
  CheckCircle2, 
  Clock, 
  Navigation, 
  Percent, 
  BarChart2, 
  Layers, 
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  DollarSign,
  Building2,
  Info,
  CalendarClock,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { getPaymentStatusMeta, formatRecurrenceFrequency } from '../../lib/recurrenceUtils';

const iconOptions = {
  PiggyBank,
  Wrench,
  Shield,
  Car,
  Coins,
  Fuel,
  Gauge,
  Sparkles,
  Heart,
  TrendingUp,
  Briefcase,
  Bike,
  Package,
  ShoppingBag,
  Coffee,
  Wifi,
  Utensils,
  Gift,
  Plane,
  GraduationCap,
  Laptop,
  Stethoscope,
  Hammer,
  Home,
  Award,
};

interface TransactionDetailViewProps {
  transaction: Transaction;
  settings: UserSettings | null;
  reserves: Reserve[];
  reserveTransactions: ReserveTransaction[];
  quotes?: Record<string, number>;
  dividends?: Dividend[];
  formatCurrency: (val: number) => string;
  openEdit: (t: Transaction) => void;
  askDelete: (id: string, type: 'transaction' | 'reserve_transaction' | 'investment_transaction' | 'dividend') => void;
  calculateFuel: (start: string | number | null, end: string | number | null) => number;
  getTransactionReserveContributions: (t: Transaction) => { reserve: Reserve; amount: number }[];
  onSettlePending?: (t: Transaction) => void;
}

export function TransactionDetailView({
  transaction: t,
  settings,
  reserves,
  reserveTransactions,
  quotes,
  dividends,
  formatCurrency,
  openEdit,
  askDelete,
  calculateFuel,
  getTransactionReserveContributions,
  onSettlePending,
}: TransactionDetailViewProps) {
  const isReserveTx = (t as any).isReserveTx;
  const isInvestmentTx = (t as any).isInvestmentTx;
  const isDividendTx = (t as any).isDividendTx;
  
  const isAporte = isReserveTx ? ((t as any).reserveTxType === 'aporte') : false;
  const isRendimento = isReserveTx ? ((t as any).reserveTxType === 'rendimento') : false;
  const isUtilizacao = isReserveTx ? ((t as any).reserveTxType === 'utilizacao') : false;

  const isReserveUseEx = false;

  const isIncome = t.type === 'income';
  const displayAmount = (t as any).rawAmount !== undefined ? (t as any).rawAmount : t.amount;

  const matchedReserveInfo = isReserveUseEx ? (() => {
    const matchRt = (reserveTransactions || []).find(
      rt => rt.type === 'utilizacao' && 
            rt.date === t.date && 
            Math.abs(Number(rt.amount) - Number(displayAmount)) < 0.01
    );
    if (matchRt) {
      const res = reserves.find(r => r.id === matchRt.reserve_id);
      return { reserve: res, rt: matchRt };
    }
    return null;
  })() : null;

  const matchedReserve = isReserveTx 
    ? reserves.find(r => r.id === (t as any).reserveId)
    : matchedReserveInfo?.reserve;

  const fuelCost = isReserveTx ? 0 : calculateFuel(t.start_km, t.end_km);
  const contributions = isReserveTx ? [] : getTransactionReserveContributions(t);
  const sumContributions = contributions.reduce((sum, item) => sum + item.amount, 0);

  const transactionNet = Number((isIncome ? (displayAmount - fuelCost) : -displayAmount).toFixed(2));
  const pocketRest = Number((isIncome ? (displayAmount - fuelCost - sumContributions) : -displayAmount).toFixed(2));

  // Pizzaria breakdown calculations
  const isPizzaria = !isReserveTx && t.category === 'Pizzaria';
  const pizzariaBreakdown = isPizzaria ? (() => {
    const dels = t.deliveries ?? 0;
    const out = t.out_of_neighborhood ?? 0;
    const baseDels = settings?.pizzaria_base_deliveries ?? 8;
    const baseRate = settings?.pizzaria_base_rate ?? 90;
    const aboveBaseRate = settings?.pizzaria_daily_rate_above_base ?? 50;
    const delRate = settings?.pizzaria_delivery_rate ?? 5;
    const outRate = settings?.pizzaria_out_of_neighborhood_rate ?? 4;

    let diaria = 0;
    let valorEntregas = 0;
    let valorForaBairro = out * outRate;

    if (dels <= baseDels) {
      diaria = baseRate;
      valorEntregas = 0;
    } else {
      diaria = aboveBaseRate;
      valorEntregas = dels * delRate;
    }

    return {
      dels,
      out,
      baseDels,
      baseRate,
      aboveBaseRate,
      delRate,
      outRate,
      diaria,
      valorEntregas,
      valorForaBairro,
      totalCalculado: diaria + valorEntregas + valorForaBairro
    };
  })() : null;

  const opCats = settings?.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];
  const isOpExpense = !isIncome && !isReserveTx && !isInvestmentTx && (opCats.includes(t.category) || t.category === 'Pedágio');

  // Determine which custom layout to render based on transaction type
  const renderCustomTypeContent = () => {
    // 1. DIVIDEND TRANSACTION
    if (isDividendTx) {
      const ticker = (t as any).ticker || 'ATIVO';
      const rawDivType = (t as any).dividendType || 'Dividendo';
      const divType = rawDivType === 'JCP' ? 'JSCP' : rawDivType;
      const unitAmt = (t as any).unitAmount;
      const divStatus = (t as any).dividendStatus || 'received';

      return (
        <div className="space-y-2.5">
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-card border border-amber-500/20 space-y-2.5">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 rounded-lg bg-amber-500 text-white font-black text-[11px] shadow-xs">
                  {ticker}
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                    Provento de Ativo
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-foreground">{divType} de {ticker}</h4>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                divStatus === 'provisioned'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}>
                {divStatus === 'provisioned' ? 'A Receber' : 'Recebido'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <span className="text-[9px] text-muted-foreground uppercase font-extrabold block">Valor Total</span>
                <span className={`font-mono font-black text-xs sm:text-sm ${
                  divStatus === 'provisioned' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>+{formatCurrency(displayAmount)}</span>
              </div>
              {unitAmt && (
                <div className="p-2 rounded-lg bg-card border border-border/60">
                  <span className="text-[9px] text-muted-foreground uppercase font-extrabold block">Valor por Cota</span>
                  <span className="font-mono font-bold text-xs text-foreground">{formatCurrency(unitAmt)} / cota</span>
                </div>
              )}
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <span className="text-[9px] text-muted-foreground uppercase font-extrabold block">Data Pagamento</span>
                <span className="font-mono font-bold text-xs text-foreground">{format(parseISO(t.date), "dd/MM/yyyy")}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 2. INVESTMENT TRANSACTION (Buy / Sell Asset)
    if (isInvestmentTx) {
      const ticker = (t as any).ticker || 'ATIVO';
      const isBuy = (t as any).investmentTxType === 'buy' || t.type === 'expense';
      const qty = (t as any).quantity || 0;
      const price = (t as any).price || 0;
      const costs = (t as any).costs || 0;
      const assetType = (t as any).investmentType || 'Ativo';
      const quotePrice = quotes?.[ticker];

      return (
        <div className="space-y-2.5">
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-card border border-indigo-500/20 space-y-2.5">
            <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 rounded-lg bg-indigo-600 text-white font-black text-[11px] shadow-xs">
                  {ticker}
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                    {assetType} • Mercado
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-foreground">
                    {isBuy ? 'Compra' : 'Venda'} de Ativo ({ticker})
                  </h4>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                isBuy 
                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' 
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}>
                {isBuy ? 'Aporte Patrimonial' : 'Liquidação'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <span className="text-[9px] text-muted-foreground uppercase font-extrabold block">Quantidade</span>
                <span className="font-mono font-black text-xs text-foreground">{qty} un</span>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <span className="text-[9px] text-muted-foreground uppercase font-extrabold block">Preço Unitário</span>
                <span className="font-mono font-bold text-xs text-foreground">{formatCurrency(price)}</span>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <span className="text-[9px] text-muted-foreground uppercase font-extrabold block">Taxas / B3</span>
                <span className="font-mono font-bold text-xs text-rose-500">{formatCurrency(costs)}</span>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <span className="text-[9px] text-muted-foreground uppercase font-extrabold block">Total Operação</span>
                <span className={`font-mono font-black text-xs ${isBuy ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatCurrency(displayAmount)}
                </span>
              </div>
            </div>

            {quotePrice && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-xs font-medium">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-500" /> Cotação Atual ({ticker}):
                </span>
                <span className="font-mono font-black text-foreground text-xs">{formatCurrency(quotePrice)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 3. RESERVE APORTE / DEPOSIT
    if (isReserveTx && isAporte) {
      const ReserveIconComponent = matchedReserve?.icon ? (iconOptions[matchedReserve.icon as keyof typeof iconOptions] || PiggyBank) : PiggyBank;

      return (
        <div className="space-y-2.5">
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-card border border-pink-500/20 space-y-2.5">
            <div className="flex items-center justify-between border-b border-pink-500/20 pb-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-xs font-bold shrink-0"
                  style={{ backgroundColor: matchedReserve?.color || '#ec4899' }}
                >
                  <ReserveIconComponent className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 block">
                    Aporte • Cofrinho
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-foreground">
                    Depósito em {matchedReserve?.name || (t as any).reserveName || 'Reserva'}
                  </h4>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                + Aporte Realizado
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <span className="text-[9px] text-muted-foreground uppercase font-extrabold block">Valor do Depósito</span>
                <span className="font-mono font-black text-xs sm:text-sm text-pink-600 dark:text-pink-400">
                  +{formatCurrency(displayAmount)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <span className="text-[9px] text-muted-foreground uppercase font-extrabold block">Saldo Atual Reserva</span>
                <span className="font-mono font-bold text-xs text-foreground">
                  {formatCurrency(matchedReserve?.saldo_atual || 0)}
                </span>
              </div>
            </div>

            {matchedReserve?.meta_objetivo && matchedReserve.meta_objetivo > 0 && (
              <div className="space-y-1 p-2 bg-card/60 rounded-lg border border-border/40">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-muted-foreground">Progresso Meta ({matchedReserve.name}):</span>
                  <span className="text-pink-600 dark:text-pink-400 font-mono">
                    {(((matchedReserve.saldo_atual || 0) / matchedReserve.meta_objetivo) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-pink-500 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, ((matchedReserve.saldo_atual || 0) / matchedReserve.meta_objetivo) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 4. RESERVE UTILIZAÇÃO / USE
    if (isReserveTx && isUtilizacao || isReserveUseEx) {
      const ReserveIconComponent = matchedReserve?.icon ? (iconOptions[matchedReserve.icon as keyof typeof iconOptions] || PiggyBank) : Wrench;

      return (
        <div className="space-y-2.5">
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-card border border-amber-500/20 space-y-2.5">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-xs font-bold shrink-0"
                  style={{ backgroundColor: matchedReserve?.color || '#f59e0b' }}
                >
                  <ReserveIconComponent className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                    Resgate Coberto • Cofrinho
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-foreground">
                    Resgate de {matchedReserve?.name || 'Reserva'}
                  </h4>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Resgate Coberto
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <span className="text-[9px] text-muted-foreground uppercase font-extrabold block">Valor Resgatado</span>
                <span className="font-mono font-black text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                  -{formatCurrency(displayAmount)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border/60">
                <span className="text-[9px] text-muted-foreground uppercase font-extrabold block">Categoria Gasto</span>
                <span className="font-bold text-xs text-foreground">
                  {t.category}
                </span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/15 text-[11px] text-muted-foreground leading-snug">
              🛡️ Pago com saldo da reserva <strong>{matchedReserve?.name || 'Reserva'}</strong>, sem afetar o faturamento livre.
            </div>
          </div>
        </div>
      );
    }

    // 5. RESERVE RENDIMENTO / YIELD
    if (isReserveTx && isRendimento) {
      return (
        <div className="space-y-2.5">
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/10 via-blue-500/5 to-card border border-emerald-500/20 space-y-2.5">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500 text-white font-bold shrink-0 shadow-xs">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                    Rendimento de Aplicação
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-foreground">
                    Juros/Rendimento em {matchedReserve?.name || (t as any).reserveName || 'Reserva'}
                  </h4>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Rendimento Passivo
              </span>
            </div>

            <div className="p-2 rounded-lg bg-card border border-border/60">
              <span className="text-[9px] text-muted-foreground uppercase font-extrabold block">Rendimento Injetado</span>
              <span className="font-mono font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(displayAmount)}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // 6. STANDARD INCOME (Receita de Corridas / Entregas / Pizzaria / iFood / Uber)
    if (isIncome) {
      const isKmTracked = t.start_km != null && t.end_km != null;
      const distance = isKmTracked ? (Number(t.end_km) - Number(t.start_km)) : 0;
      const fuelLiters = (isKmTracked && settings?.vehicle_km_per_liter) ? (distance / settings.vehicle_km_per_liter) : 0;
      const grossPerKm = (isKmTracked && distance > 0) ? (displayAmount / distance) : 0;
      const netPerKm = (isKmTracked && distance > 0) ? (transactionNet / distance) : 0;

      return (
        <div className="space-y-2.5">
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-card border border-emerald-500/20 space-y-2.5">
            {/* Header banner */}
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500 text-white font-black shrink-0 shadow-xs">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                    Receita de Trabalho
                  </span>
                  <h4 className="font-extrabold text-xs sm:text-sm text-foreground">{t.category}</h4>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                +{formatCurrency(displayAmount)}
              </span>
            </div>

            {/* Pizzaria detailed Breakdown */}
            {pizzariaBreakdown && (
              <div className="p-2.5 bg-card rounded-lg border border-indigo-500/20 space-y-1.5">
                <div className="flex items-center justify-between border-b border-border/40 pb-1">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    <Bike className="w-3.5 h-3.5 text-indigo-500" /> Cálculo Detalhado Pizzaria
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full">
                    {pizzariaBreakdown.dels + pizzariaBreakdown.out} entregas
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs font-mono">
                  <div className="p-1.5 bg-muted/20 rounded">
                    <span className="text-[8.5px] text-muted-foreground block font-sans">Diária Apoio</span>
                    <span className="font-bold text-foreground text-[11px]">{formatCurrency(pizzariaBreakdown.diaria)}</span>
                  </div>
                  <div className="p-1.5 bg-muted/20 rounded">
                    <span className="text-[8.5px] text-muted-foreground block font-sans">Entregas Bairro ({pizzariaBreakdown.dels}x)</span>
                    <span className="font-bold text-foreground text-[11px]">
                      {pizzariaBreakdown.dels <= pizzariaBreakdown.baseDels ? 'Inclusas' : `+${formatCurrency(pizzariaBreakdown.valorEntregas)}`}
                    </span>
                  </div>
                  {pizzariaBreakdown.out > 0 && (
                    <div className="p-1.5 bg-indigo-500/10 rounded">
                      <span className="text-[8.5px] text-indigo-600 dark:text-indigo-400 block font-sans">Fora Bairro ({pizzariaBreakdown.out}x)</span>
                      <span className="font-bold text-indigo-500 text-[11px]">+{formatCurrency(pizzariaBreakdown.valorForaBairro)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mileage & Performance Grid */}
            {isKmTracked ? (
              <div className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground block">
                  Odômetro & Métricas KM
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <div className="p-2 rounded-lg bg-card border border-border/60">
                    <span className="text-[8.5px] text-muted-foreground uppercase font-bold block">Distância</span>
                    <span className="font-mono font-black text-xs text-foreground">{distance} km</span>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border/60">
                    <span className="text-[8.5px] text-muted-foreground uppercase font-bold block">Combustível Est.</span>
                    <span className="font-mono font-bold text-[11px] text-rose-500">
                      {formatCurrency(fuelCost)} <span className="text-[8.5px] opacity-75">({fuelLiters.toFixed(1)}L)</span>
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border/60">
                    <span className="text-[8.5px] text-muted-foreground uppercase font-bold block">Bruto / KM</span>
                    <span className="font-mono font-bold text-[11px] text-foreground">{formatCurrency(grossPerKm)}/km</span>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border/60">
                    <span className="text-[8.5px] text-muted-foreground uppercase font-bold block">Líquido / KM</span>
                    <span className="font-mono font-black text-[11px] text-emerald-600 dark:text-emerald-400">{formatCurrency(netPerKm)}/km</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Financial Result Pipeline */}
            <div className="p-2.5 bg-card rounded-lg border border-border/60 space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground block">
                Demonstrativo de Resultado
              </span>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between items-center text-foreground font-medium text-[11px]">
                  <span className="text-muted-foreground font-sans">1. Bruto:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">+{formatCurrency(displayAmount)}</span>
                </div>
                {fuelCost > 0 && (
                  <div className="flex justify-between items-center text-foreground font-medium text-[11px]">
                    <span className="text-muted-foreground font-sans">2. (-) Combustível Est.:</span>
                    <span className="font-extrabold text-rose-500">-{formatCurrency(fuelCost)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center p-1.5 rounded bg-blue-500/5 border border-blue-500/15 font-bold text-[11px]">
                  <span className="text-blue-600 dark:text-blue-400 font-sans">3. (=) Lucro Líquido Real:</span>
                  <span className="font-extrabold text-blue-600 dark:text-blue-400">{formatCurrency(transactionNet)}</span>
                </div>
                {sumContributions > 0 && (
                  <>
                    <div className="flex justify-between items-center text-foreground font-medium text-[11px]">
                      <span className="text-muted-foreground font-sans">4. (-) Retenção Reservas:</span>
                      <span className="font-extrabold text-pink-500">-{formatCurrency(sumContributions)}</span>
                    </div>
                    <div className="flex justify-between items-center p-1.5 rounded bg-amber-500/5 border border-amber-500/15 font-bold text-[11px]">
                      <span className="text-amber-600 dark:text-amber-400 font-sans">5. (=) Sobra Livre no Bolso:</span>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400">{formatCurrency(pocketRest)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 7. STANDARD EXPENSE (Operational or Personal Expense)
    return (
      <div className="space-y-2.5">
        <div className={`p-3 sm:p-3.5 rounded-xl border space-y-2.5 ${
          isOpExpense 
            ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-card border-amber-500/20' 
            : 'bg-gradient-to-br from-rose-500/10 via-purple-500/5 to-card border-rose-500/20'
        }`}>
          <div className="flex items-center justify-between border-b pb-2 border-border/40">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg text-white font-bold shrink-0 shadow-xs ${
                isOpExpense ? 'bg-amber-500' : 'bg-rose-500'
              }`}>
                {isOpExpense ? <Fuel className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
              </div>
              <div>
                <span className={`text-[9px] font-black uppercase tracking-wider block ${
                  isOpExpense ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {isOpExpense ? 'Despesa Operacional' : 'Despesa Pessoal'}
                </span>
                <h4 className="font-extrabold text-xs sm:text-sm text-foreground">{t.category}</h4>
              </div>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-black border ${
              isOpExpense 
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20' 
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20'
            }`}>
              -{formatCurrency(displayAmount)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-card border border-border/60">
              <span className="text-[8.5px] text-muted-foreground uppercase font-extrabold block">Classificação</span>
              <span className="font-bold text-xs text-foreground mt-0.5 block">
                {isOpExpense ? 'Custo de Operação' : 'Gasto Pessoal'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-card border border-border/60">
              <span className="text-[8.5px] text-muted-foreground uppercase font-extrabold block">Data Registro</span>
              <span className="font-mono font-bold text-xs text-foreground mt-0.5 block">
                {format(parseISO(t.date), "dd/MM/yyyy")}
              </span>
            </div>
          </div>

          {t.description && (
            <div className="p-2 rounded-lg bg-card border border-border/60 space-y-0.5">
              <span className="text-[8.5px] text-muted-foreground uppercase font-extrabold block">Descrição / Notas</span>
              <p className="text-xs text-foreground font-medium leading-relaxed whitespace-pre-wrap">
                {t.description}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* Custom layout for specific transaction type */}
      {renderCustomTypeContent()}

      {/* Payment Status & Recurrence Card (For Expenses & Reserves) */}
      {(t.type === 'expense' || isReserveTx) && (
        <div className="p-2.5 rounded-xl bg-card border border-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Situação do Pagamento
              </span>
            </div>
            {(() => {
              const meta = getPaymentStatusMeta(t.payment_status, t.due_date);
              const StatusIcon = t.payment_status === 'pending' ? (meta.isOverdue ? AlertCircle : Clock) : CheckCircle2;
              return (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border ${meta.bgColor} ${meta.color} ${meta.borderColor}`}>
                  <StatusIcon className="w-3 h-3" />
                  {meta.label}
                </span>
              );
            })()}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-1.5 rounded-lg bg-muted/20 border border-border/40">
              <span className="text-[8.5px] text-muted-foreground uppercase font-bold block">Status</span>
              <span className="font-bold text-foreground">
                {t.payment_status === 'pending' ? 'Pendente de Pagamento' : 'Pago / Liquidado'}
              </span>
            </div>

            {t.payment_status === 'pending' ? (
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-[8.5px] text-amber-700 dark:text-amber-300 uppercase font-bold block">Vencimento</span>
                <span className="font-bold font-mono text-amber-700 dark:text-amber-300">
                  {t.due_date ? format(parseISO(t.due_date), "dd/MM/yyyy") : format(parseISO(t.date), "dd/MM/yyyy")}
                </span>
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[8.5px] text-emerald-700 dark:text-emerald-300 uppercase font-bold block">Data Pagamento</span>
                <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  {t.payment_date ? format(parseISO(t.payment_date), "dd/MM/yyyy") : format(parseISO(t.date), "dd/MM/yyyy")}
                </span>
              </div>
            )}

            {t.is_recurring && (
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 col-span-2 sm:col-span-1">
                <span className="text-[8.5px] text-primary uppercase font-bold block flex items-center gap-1">
                  <RefreshCw className="w-2.5 h-2.5" /> Recorrência
                </span>
                <span className="font-bold text-primary">
                  {t.installment_number && t.installment_total ? `${t.installment_number}/${t.installment_total} ` : ''}
                  ({formatRecurrenceFrequency(t.recurrence_frequency)})
                </span>
              </div>
            )}
          </div>

          {t.payment_status === 'pending' && onSettlePending && (
            <div className="pt-1 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => onSettlePending(t)}
                className="h-7 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Quitar / Marcar como Pago</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Common Footer Actions Bar */}
      <div className="flex items-center justify-between border-t border-border/40 pt-2.5">
        <span className="text-[10px] text-muted-foreground font-mono">
          ID: {t.id.slice(0, 8)}
        </span>
        <div className="flex items-center gap-1.5">
          {!isInvestmentTx && !isDividendTx ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => openEdit(t)} 
              className="h-7 border-border bg-card text-foreground font-semibold px-2.5 text-[11px] flex items-center gap-1 hover:bg-muted/10 cursor-pointer"
            >
              <Edit2 className="w-3 h-3 text-muted-foreground" />
              Editar
            </Button>
          ) : (
            <span className="text-[10px] text-muted-foreground font-medium italic">
              Gerenciável em Investimentos
            </span>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              const deleteType = isInvestmentTx 
                ? 'investment_transaction' 
                : isDividendTx 
                  ? 'dividend' 
                  : isReserveTx 
                    ? 'reserve_transaction' 
                    : 'transaction';
              askDelete(t.id, deleteType);
            }} 
            className="h-7 text-rose-500 font-bold px-2.5 text-[11px] flex items-center gap-1 hover:bg-rose-500/10 hover:text-rose-600 border border-transparent hover:border-rose-200 cursor-pointer"
          >
            <Trash className="w-3 h-3" />
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}
