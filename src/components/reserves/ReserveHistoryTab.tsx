import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingUp, 
  Search, 
  Filter, 
  Calendar, 
  Trash2, 
  Edit3, 
  Zap, 
  Layers, 
  PiggyBank, 
  AlertCircle,
  Tag,
  DollarSign,
  ChevronDown
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Reserve, ReserveTransaction } from '../../types';
import { 
  formatCurrency, 
  formatDateDisplay, 
  iconOptions, 
  isTxInPeriod,
  PERIOD_OPTIONS
} from './reserveUtils';

interface ReserveHistoryTabProps {
  reserves: Reserve[];
  reserveTransactions: ReserveTransaction[];
  onDeleteTransaction: (id: string) => Promise<void>;
  onEditTransaction?: (tx: ReserveTransaction) => void;
  hideValues?: boolean;
}

export function ReserveHistoryTab({
  reserves,
  reserveTransactions,
  onDeleteTransaction,
  onEditTransaction,
  hideValues
}: ReserveHistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReserveId, setSelectedReserveId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all'); // all, manual_aporte, mass_aporte, utilizacao, rendimento
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [txToDelete, setTxToDelete] = useState<ReserveTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Period filter states (matching Dashboard and History)
  const [historyPeriod, setHistoryPeriod] = useState<string>('month');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(null);

  // Chunked loading / pagination state (10 items per page/chunk)
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // Map reserves by id for quick lookup
  const reserveMap = useMemo(() => {
    const map: Record<string, Reserve> = {};
    reserves.forEach(r => { map[r.id] = r; });
    return map;
  }, [reserves]);

  // Helper to categorize transaction source
  const getTxCategoryInfo = (tx: ReserveTransaction) => {
    const isMass = tx.source === 'mass_contribution' || 
                   (tx.description && (tx.description.includes('[Aporte em Massa]') || tx.description.includes('[Consolidador]')));
    
    if (tx.type === 'aporte') {
      if (isMass) {
        return {
          label: 'Aporte em Massa',
          categoryKey: 'mass_aporte',
          badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          icon: Zap,
          color: 'text-indigo-600 dark:text-indigo-400'
        };
      }
      return {
        label: 'Aporte Manual',
        categoryKey: 'manual_aporte',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        icon: ArrowDownLeft,
        color: 'text-emerald-600 dark:text-emerald-400'
      };
    }

    if (tx.type === 'utilizacao') {
      return {
        label: 'Utilização / Resgate',
        categoryKey: 'utilizacao',
        badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        icon: ArrowUpRight,
        color: 'text-rose-600 dark:text-rose-400'
      };
    }

    if (tx.type === 'rendimento') {
      return {
        label: 'Rendimento',
        categoryKey: 'rendimento',
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        icon: TrendingUp,
        color: 'text-blue-600 dark:text-blue-400'
      };
    }

    return {
      label: 'Movimentação',
      categoryKey: 'other',
      badgeClass: 'bg-muted text-muted-foreground border-border',
      icon: DollarSign,
      color: 'text-foreground'
    };
  };

  // Filter and sort transactions (filtered by active period, selected reserve, type, and search term)
  const filteredTransactions = useMemo(() => {
    return (reserveTransactions || [])
      .filter(tx => {
        // Filter by period
        if (!isTxInPeriod(tx.date, historyPeriod, customDateRange)) {
          return false;
        }

        // Filter by reserve
        if (selectedReserveId !== 'all' && tx.reserve_id !== selectedReserveId) {
          return false;
        }

        const info = getTxCategoryInfo(tx);

        // Filter by type
        if (selectedType !== 'all') {
          if (selectedType === 'manual_aporte' && info.categoryKey !== 'manual_aporte') return false;
          if (selectedType === 'mass_aporte' && info.categoryKey !== 'mass_aporte') return false;
          if (selectedType === 'utilizacao' && info.categoryKey !== 'utilizacao') return false;
          if (selectedType === 'rendimento' && info.categoryKey !== 'rendimento') return false;
        }

        // Search text
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const res = reserveMap[tx.reserve_id];
          const resName = res?.name?.toLowerCase() || '';
          const desc = (tx.description || '').toLowerCase();
          const cat = (tx.category || '').toLowerCase();
          const amountStr = String(tx.amount || '');

          if (!resName.includes(term) && !desc.includes(term) && !cat.includes(term) && !amountStr.includes(term)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (sortOrder === 'desc') {
          return dateB.localeCompare(dateA);
        }
        return dateA.localeCompare(dateB);
      });
  }, [reserveTransactions, historyPeriod, customDateRange, selectedReserveId, selectedType, searchTerm, sortOrder, reserveMap]);

  // Aggregate Metrics for filtered view based on selected period and filters
  const summary = useMemo(() => {
    let totalAportesManuais = 0;
    let totalAportesMassa = 0;
    let totalUtilizacoes = 0;
    let totalRendimentos = 0;

    filteredTransactions.forEach(tx => {
      const info = getTxCategoryInfo(tx);
      const amount = Number(tx.amount || 0);

      if (info.categoryKey === 'manual_aporte') totalAportesManuais += amount;
      else if (info.categoryKey === 'mass_aporte') totalAportesMassa += amount;
      else if (info.categoryKey === 'utilizacao') totalUtilizacoes += amount;
      else if (info.categoryKey === 'rendimento') totalRendimentos += amount;
    });

    return {
      totalAportesManuais: Math.round(totalAportesManuais * 100) / 100,
      totalAportesMassa: Math.round(totalAportesMassa * 100) / 100,
      totalAportesTotal: Math.round((totalAportesManuais + totalAportesMassa) * 100) / 100,
      totalUtilizacoes: Math.round(totalUtilizacoes * 100) / 100,
      totalRendimentos: Math.round(totalRendimentos * 100) / 100,
      netFlow: Math.round(((totalAportesManuais + totalAportesMassa + totalRendimentos) - totalUtilizacoes) * 100) / 100
    };
  }, [filteredTransactions]);

  // Slice displayed transactions based on visibleCount chunk
  const visibleTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleCount);
  }, [filteredTransactions, visibleCount]);

  return (
    <div className="space-y-4 text-left">
      {/* Period Selection Segmented Pill Bar - Exclusive to Extrato & Movimentações */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex overflow-x-auto scrollbar-none gap-1 p-1 bg-muted/30 border border-border/40 rounded-full w-full max-w-full">
            {[
              { id: 'last30Days', label: '30 dias' },
              { id: 'last90Days', label: '90 dias' },
              { id: 'month', label: 'Mês Atual' },
              { id: 'lastMonth', label: 'Mês Passado' },
              { id: 'thisYear', label: 'Este Ano' },
              { id: 'lastYear', label: 'Ano Passado' },
              { id: 'custom', label: 'Personalizado' }
            ].map((period) => {
              const isSelected = historyPeriod === period.id;
              return (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => {
                    setHistoryPeriod(period.id);
                    setVisibleCount(10); // Reset chunk count on period change
                  }}
                  className="relative px-3.5 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap focus:outline-none text-center flex-1 sm:flex-initial cursor-pointer active:scale-95"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="reserve-history-active-period"
                      className="absolute inset-0 bg-background border border-border/60 shadow-2xs rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    />
                  )}
                  <span className={`relative z-10 transition-colors duration-200 ${isSelected ? 'text-foreground font-black' : 'text-muted-foreground hover:text-foreground'}`}>
                    {period.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Date Range Picker when 'custom' is active */}
        {historyPeriod === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-top-1 bg-card/80 p-2 rounded-xl border border-border/60 mx-0.5">
            <span className="text-muted-foreground text-xs font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              Intervalo Personalizado:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <input
                type="date"
                className="bg-background border border-border/60 rounded-lg px-2.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-indigo-500 outline-none max-w-[130px] font-mono cursor-pointer"
                value={customDateRange?.start || ''}
                onChange={(e) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  setCustomDateRange({
                    start: e.target.value,
                    end: customDateRange?.end || todayStr
                  });
                  setVisibleCount(10);
                }}
              />
              <span className="text-muted-foreground text-xs font-medium">até</span>
              <input
                type="date"
                className="bg-background border border-border/60 rounded-lg px-2.5 py-1 text-xs text-foreground focus:ring-1 focus:ring-indigo-500 outline-none max-w-[130px] font-mono cursor-pointer"
                value={customDateRange?.end || ''}
                onChange={(e) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  setCustomDateRange({
                    start: customDateRange?.start || todayStr,
                    end: e.target.value
                  });
                  setVisibleCount(10);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Extrato Summary Cards - Dynamic to selected period */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              📥 Aportes Manuais
            </span>
          </div>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {hideValues ? 'R$ •••••' : formatCurrency(summary.totalAportesManuais)}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
              ⚡ Aportes em Massa
            </span>
          </div>
          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {hideValues ? 'R$ •••••' : formatCurrency(summary.totalAportesMassa)}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              📤 Utilizações
            </span>
          </div>
          <p className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono">
            {hideValues ? 'R$ •••••' : formatCurrency(summary.totalUtilizacoes)}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              📈 Rendimentos
            </span>
          </div>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
            {hideValues ? 'R$ •••••' : `+${formatCurrency(summary.totalRendimentos)}`}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/80 shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, valor ou categoria..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setVisibleCount(10);
            }}
            className="pl-8 h-8 text-xs rounded-xl"
          />
        </div>

        {/* Filter Pills / Selects */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Select Reserve */}
          <Select 
            value={selectedReserveId} 
            onValueChange={v => {
              setSelectedReserveId(v);
              setVisibleCount(10);
            }}
          >
            <SelectTrigger className="h-8 text-xs font-semibold rounded-xl min-w-[150px]">
              <SelectValue placeholder="Todas as Reservas" />
            </SelectTrigger>
            <SelectContent align="end" className="text-xs">
              <SelectItem value="all">Todas as Reservas</SelectItem>
              {reserves.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Select Type */}
          <Select 
            value={selectedType} 
            onValueChange={v => {
              setSelectedType(v);
              setVisibleCount(10);
            }}
          >
            <SelectTrigger className="h-8 text-xs font-semibold rounded-xl min-w-[160px]">
              <SelectValue placeholder="Todos os Tipos" />
            </SelectTrigger>
            <SelectContent align="end" className="text-xs">
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="manual_aporte">📥 Aportes Manuais</SelectItem>
              <SelectItem value="mass_aporte">⚡ Aportes em Massa</SelectItem>
              <SelectItem value="utilizacao">📤 Utilizações / Resgates</SelectItem>
              <SelectItem value="rendimento">📈 Rendimentos</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Order */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
            className="h-8 px-2.5 text-xs font-bold rounded-xl cursor-pointer"
          >
            {sortOrder === 'desc' ? 'Recentes' : 'Antigos'}
          </Button>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-2">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center bg-card border border-dashed border-border rounded-3xl space-y-2">
            <div className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center mx-auto">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-foreground">Nenhuma movimentação encontrada</h4>
            <p className="text-xs text-muted-foreground">
              {searchTerm || selectedReserveId !== 'all' || selectedType !== 'all'
                ? 'Tente ajustar os filtros acima para visualizar registros.'
                : 'Suas movimentações e aportes aparecerão aqui organizados cronologicamente.'}
            </p>
          </div>
        ) : (
          visibleTransactions.map(tx => {
            const res = reserveMap[tx.reserve_id];
            const info = getTxCategoryInfo(tx);
            const ResIcon = res ? (iconOptions[res.icon] || PiggyBank) : PiggyBank;
            const resColor = res?.color || '#6366f1';
            const IconComp = info.icon;

            return (
              <div
                key={tx.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border/80 hover:border-border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                {/* Left: Icons, Reserve Identity, Date & Description */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  {/* Reserve Badge Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: resColor }}
                  >
                    <ResIcon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-foreground truncate">
                        {res?.name || 'Reserva Desconhecida'}
                      </span>

                      {/* Type Badge */}
                      <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border flex items-center gap-1 ${info.badgeClass}`}>
                        <IconComp className="w-3 h-3" />
                        {info.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted-foreground/80" />
                        {formatDateDisplay(tx.date)}
                      </span>
                      {tx.category && (
                        <span>• Categoria: <strong>{tx.category}</strong></span>
                      )}
                      {tx.description && (
                        <span className="truncate text-foreground/80 font-medium">
                          • {tx.description}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                  <div className="text-left sm:text-right">
                    <div className={`text-sm sm:text-base font-black font-mono tracking-tight ${
                      tx.type === 'utilizacao' 
                        ? 'text-rose-600 dark:text-rose-400' 
                        : tx.type === 'rendimento'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {tx.type === 'utilizacao' ? '-' : '+'}
                      {hideValues ? 'R$ •••••' : formatCurrency(tx.amount)}
                    </div>
                  </div>

                  {/* Delete / Actions */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTxToDelete(tx)}
                    className="w-8 h-8 p-0 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                    title="Excluir movimentação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}

        {/* Chunked Loading / Carregar Mais Button */}
        {filteredTransactions.length > visibleCount && (
          <div className="flex flex-col items-center justify-center pt-3 pb-6 space-y-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider gap-2 hover:bg-indigo-500/5 hover:text-indigo-600 border border-border/80 shadow-xs transition-all duration-200 cursor-pointer"
              onClick={() => setVisibleCount(prev => prev + 10)}
            >
              <ChevronDown className="w-4 h-4 text-indigo-500 animate-bounce" />
              Carregar Mais Movimentações ({filteredTransactions.length - visibleCount} restantes)
            </Button>
            <p className="text-[10px] text-muted-foreground font-semibold">
              Exibindo {visibleTransactions.length} de {filteredTransactions.length} movimentações no período
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-md my-auto rounded-3xl border border-border/80 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Excluir Movimentação?</h3>
                <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reserva:</span>
                <span className="font-bold text-foreground">{reserveMap[txToDelete.reserve_id]?.name || 'Reserva'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-bold capitalize">{txToDelete.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data:</span>
                <span className="font-medium">{formatDateDisplay(txToDelete.date)}</span>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-1.5">
                <span className="font-bold text-foreground">Valor:</span>
                <span className="font-mono font-black text-sm text-foreground">
                  {hideValues ? 'R$ •••••' : formatCurrency(txToDelete.amount)}
                </span>
              </div>
              {txToDelete.description && (
                <div className="text-[11px] text-muted-foreground pt-1 italic">
                  &quot;{txToDelete.description}&quot;
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              O saldo da reserva será recalculado automaticamente com base nas movimentações restantes.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setTxToDelete(null)}
                disabled={isDeleting}
                className="h-10 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={async () => {
                  if (!txToDelete) return;
                  try {
                    setIsDeleting(true);
                    await onDeleteTransaction(txToDelete.id);
                    setTxToDelete(null);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="h-10 px-5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-500/20 cursor-pointer"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
