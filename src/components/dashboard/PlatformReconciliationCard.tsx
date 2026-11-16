import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '../CurrencyInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Transaction } from '../../types';
import {
  planningStorage,
  PlatformReconciliation,
} from '../../lib/planningStorage';
import { generateUUID } from '../../lib/recurrenceUtils';
import { getTodayLocalDateStr } from '../../lib/utils';
import { syncQueueManager } from '../../lib/syncQueue';
import { cacheManager } from '../../lib/cacheManager';
import { toast } from '@/lib/toast';
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth } from 'date-fns';
import {
  CheckCircle2,
  Scale,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface PlatformReconciliationCardProps {
  userId: string;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  incomeCategories: string[];
  hideValues: boolean;
  formatCurrency: (val: number) => string;
  defaultExpanded?: boolean;
}

export const PlatformReconciliationCard: React.FC<PlatformReconciliationCardProps> = ({
  userId,
  transactions,
  setTransactions,
  incomeCategories,
  hideValues,
  formatCurrency,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [platformCategory, setPlatformCategory] = useState<string>(
    incomeCategories.includes('Pizzaria')
      ? 'Pizzaria'
      : incomeCategories[0] || 'iFood'
  );
  const [periodPreset, setPeriodPreset] = useState<'this_week' | 'last_week' | 'this_month' | 'custom'>('last_week');

  const today = new Date();
  const initialRange = useMemo(() => {
    const lastWStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
    const lastWEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
    return {
      start: format(lastWStart, 'yyyy-MM-dd'),
      end: format(lastWEnd, 'yyyy-MM-dd'),
    };
  }, []);

  const [customStart, setCustomStart] = useState(initialRange.start);
  const [customEnd, setCustomEnd] = useState(initialRange.end);
  const [actualPaidStr, setActualPaidStr] = useState('');
  const [notes, setNotes] = useState('');
  const [reconciliations, setReconciliations] = useState<PlatformReconciliation[]>(() =>
    planningStorage.getReconciliations(userId)
  );

  React.useEffect(() => {
    setReconciliations(planningStorage.getReconciliations(userId));
    const handleSync = (e: Event) => {
      const detailUid = (e as CustomEvent)?.detail?.userId;
      if (!detailUid || detailUid === userId) {
        setReconciliations(planningStorage.getReconciliations(userId));
      }
    };
    window.addEventListener('planning_data_synced', handleSync);
    return () => window.removeEventListener('planning_data_synced', handleSync);
  }, [userId]);

  const activeRange = useMemo(() => {
    const now = new Date();
    if (periodPreset === 'this_week') {
      return {
        start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    }
    if (periodPreset === 'last_week') {
      const lw = subWeeks(now, 1);
      return {
        start: format(startOfWeek(lw, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(lw, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    }
    if (periodPreset === 'this_month') {
      return {
        start: format(startOfMonth(now), 'yyyy-MM-dd'),
        end: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    }
    return { start: customStart, end: customEnd };
  }, [periodPreset, customStart, customEnd]);

  const expectedSummary = useMemo(() => {
    const matching = (transactions || []).filter(t => {
      if (t.type !== 'income') return false;
      if (t.payment_status === 'pending') return false;
      if (t.category !== platformCategory) return false;
      const d = (t.date || '').split('T')[0];
      return d >= activeRange.start && d <= activeRange.end;
    });
    const total = matching.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    return { count: matching.length, total: Math.round(total * 100) / 100 };
  }, [transactions, platformCategory, activeRange]);

  const actualPaidNum = Number(actualPaidStr) || 0;
  const difference = Math.round((actualPaidNum - expectedSummary.total) * 100) / 100;

  const handleSaveReconciliation = (createAdjustmentTx: boolean) => {
    if (!actualPaidStr || actualPaidNum < 0) {
      toast.error('Informe o valor real depositado na conta.');
      return;
    }

    let adjTxId: string | undefined;
    if (createAdjustmentTx && Math.abs(difference) >= 0.01) {
      adjTxId = generateUUID();
      const todayStr = getTodayLocalDateStr();
      const isPositive = difference > 0;
      const adjPayload: Transaction = {
        id: adjTxId,
        user_id: userId,
        type: isPositive ? 'income' : 'expense',
        amount: Math.abs(difference),
        date: todayStr,
        category: isPositive ? platformCategory : 'Outras Despesas',
        description: `[Conferência ${platformCategory}] ${
          isPositive ? 'Bônus / Acréscimo de repasse' : 'Taxa / Desconto de repasse'
        } (${activeRange.start.slice(5)} a ${activeRange.end.slice(5)})`,
        payment_status: 'paid',
        payment_date: todayStr,
        due_date: todayStr,
        is_recurring: false,
        created_at: new Date().toISOString(),
      };

      setTransactions(prev => {
        const next = [adjPayload, ...prev];
        cacheManager.set(`transactions_${userId}`, next, undefined, 'transactions');
        cacheManager.set('last_known_transactions', next, undefined, 'transactions');
        return next;
      });
      syncQueueManager.enqueue('transactions', 'insert', adjTxId, adjPayload);
    }

    const record: PlatformReconciliation = {
      id: generateUUID(),
      platformCategory,
      periodStart: activeRange.start,
      periodEnd: activeRange.end,
      expectedAmount: expectedSummary.total,
      actualPaidAmount: actualPaidNum,
      difference,
      reconciledAt: getTodayLocalDateStr(),
      notes: notes.trim() || undefined,
      adjustmentTxId: adjTxId,
    };

    const nextList = [record, ...reconciliations].slice(0, 30);
    setReconciliations(nextList);
    planningStorage.saveReconciliations(userId, nextList);
    setActualPaidStr('');
    setNotes('');
    toast.success(
      createAdjustmentTx && adjTxId
        ? 'Conferência salva e ajuste lançado no extrato!'
        : 'Conferência de repasse registrada!'
    );
  };

  const handleDeleteRecord = (id: string) => {
    const nextList = reconciliations.filter(r => r.id !== id);
    setReconciliations(nextList);
    planningStorage.saveReconciliations(userId, nextList);
    toast.success('Registro de conferência removido.');
  };

  const availableCategories = useMemo(() => {
    const base = new Set<string>(incomeCategories);
    ['Pizzaria', 'Frete do Dia', 'iFood', 'Uber', '99Moto', 'Particular'].forEach(c => base.add(c));
    return Array.from(base);
  }, [incomeCategories]);

  return (
    <Card className="border border-border/80 shadow-xs rounded-2xl bg-card/95 overflow-hidden">
      <CardHeader
        onClick={() => setIsExpanded(prev => !prev)}
        className="pb-3 cursor-pointer hover:bg-muted/20 transition-colors select-none"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 text-cyan-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xs sm:text-sm font-black uppercase tracking-wider text-foreground">
                  Conferência de Repasses por Plataforma
                </CardTitle>
                {reconciliations.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                    {reconciliations.length} conferida(s)
                  </span>
                )}
              </div>
              <CardDescription className="text-[11px]">
                Compare o total registrado no app (Pizzaria, Frete, iFood, Uber) com o valor real depositado no banco.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground shrink-0">
            <span className="hidden sm:inline">{isExpanded ? 'Recolher' : 'Conferir Repasse'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-4 sm:p-5 pt-2 border-t border-border/40 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Plataforma / Categoria
              </label>
              <Select value={platformCategory} onValueChange={setPlatformCategory}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Período do Repasse
              </label>
              <Select value={periodPreset} onValueChange={(v: any) => setPeriodPreset(v)}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_week">Semana Passada</SelectItem>
                  <SelectItem value="this_week">Esta Semana</SelectItem>
                  <SelectItem value="this_month">Mês Atual</SelectItem>
                  <SelectItem value="custom">Datas Personalizadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Registrado no App ({expectedSummary.count}x)
              </label>
              <div className="h-10 px-3 rounded-xl border border-border/60 bg-muted/30 flex items-center justify-between text-xs font-black font-mono text-foreground">
                <span>{hideValues ? 'R$ •••••' : formatCurrency(expectedSummary.total)}</span>
                <span className="text-[9.5px] font-semibold text-muted-foreground">
                  {activeRange.start.slice(5)}..{activeRange.end.slice(5)}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                Valor Real Recebido (R$)
              </label>
              <CurrencyInput
                value={actualPaidStr}
                onChange={setActualPaidStr}
                placeholder="0,00"
                className="h-10 rounded-xl font-bold"
              />
            </div>
          </div>

          {periodPreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-muted-foreground">De:</span>
              <Input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="h-9 w-auto rounded-xl text-xs"
              />
              <span className="font-bold text-muted-foreground">Até:</span>
              <Input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="h-9 w-auto rounded-xl text-xs"
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/60 bg-muted/20">
            <div className="flex items-center gap-2.5">
              {actualPaidStr ? (
                Math.abs(difference) < 0.01 ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-emerald-500">Repasse 100% Conferido!</p>
                      <p className="text-[10.5px] text-muted-foreground">
                        Valor depositado bate exatamente com o registrado no app.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle
                      className={`w-5 h-5 shrink-0 ${difference > 0 ? 'text-emerald-500' : 'text-amber-500'}`}
                    />
                    <div>
                      <p
                        className={`text-xs font-black ${
                          difference > 0 ? 'text-emerald-500' : 'text-amber-500'
                        }`}
                      >
                        Diferença de {difference > 0 ? '+' : ''}
                        {hideValues ? 'R$ •••' : formatCurrency(difference)}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground">
                        {difference > 0
                          ? 'Você recebeu a mais (bônus, gorjeta ou entrega extra).'
                          : 'Valor recebido menor que o anotado (desconto, taxa ou pendência).'}
                      </p>
                    </div>
                  </>
                )
              ) : (
                <p className="text-xs text-muted-foreground font-medium">
                  Digite o valor real recebido para calcular divergências ou bônus automaticamente.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Input
                type="text"
                placeholder="Obs. opcional..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="h-9 w-36 rounded-xl text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSaveReconciliation(false)}
                disabled={!actualPaidStr}
                className="h-9 rounded-xl text-xs font-bold cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Registrar
              </Button>
              {actualPaidStr && Math.abs(difference) >= 0.01 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSaveReconciliation(true)}
                  className="h-9 rounded-xl text-xs font-black bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Registrar + Lançar Ajuste
                </Button>
              )}
            </div>
          </div>

          {reconciliations.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                Últimas Conferências
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {reconciliations.slice(0, 6).map(rec => (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-border/50 bg-card/80 p-2.5 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-foreground truncate">{rec.platformCategory}</span>
                        <span
                          className={`text-[9.5px] font-mono font-black px-1.5 py-0.2 rounded ${
                            Math.abs(rec.difference) < 0.01
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : rec.difference > 0
                                ? 'bg-cyan-500/10 text-cyan-500'
                                : 'bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          {Math.abs(rec.difference) < 0.01
                            ? 'Bateu 100%'
                            : `${rec.difference > 0 ? '+' : ''}${hideValues ? '•••' : formatCurrency(rec.difference)}`}
                        </span>
                      </div>
                      <p className="text-[9.5px] text-muted-foreground truncate mt-0.5">
                        {rec.periodStart.slice(5)}..{rec.periodEnd.slice(5)} • Pago:{' '}
                        {hideValues ? '•••' : formatCurrency(rec.actualPaidAmount)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRecord(rec.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                      title="Excluir conferência"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
