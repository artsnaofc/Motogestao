import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '../components/CurrencyInput';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Bike, 
  Package, 
  DollarSign, 
  Loader2, 
  TrendingDown, 
  TrendingUp, 
  Fuel, 
  PiggyBank,
  Car,
  Utensils,
  Wrench,
  Wifi,
  ShoppingBag,
  Landmark,
  Briefcase,
  Zap,
  Heart,
  Camera,
  Gift,
  Coffee,
  Pizza,
  Beer,
  Shield,
  MapPin,
  Phone,
  MessageSquare,
  Hammer,
  Wallet,
  CreditCard,
  ShoppingCart,
  Home,
  Settings,
  User,
  Scissors,
  Music,
  Video,
  Gamepad,
  Globe,
  Plane,
  Train,
  Bus,
  Truck,
  Hospital,
  School,
  GraduationCap,
  Users,
  Smile,
  Frown,
  Star,
  Bell,
  Clock,
  Calendar,
  Filter,
  Calculator
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { FreightCalculatorModal } from '../components/FreightCalculatorModal';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';

export function AddTransaction() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const paramType = searchParams.get('type') as 'aporte' | 'utilizacao' | null;
  const paramReserveId = searchParams.get('reserve_id') || '';
  const paramAmountRaw = searchParams.get('amount') || '';
  const parsedAmount = Number(paramAmountRaw);
  const paramAmount = (!isNaN(parsedAmount) && paramAmountRaw !== '') ? String(Number(parsedAmount.toFixed(2))) : '';

  const { transactions, settings, refreshData, globalPeriod, reserves, addReserveTransaction, hideValues } = useData();

  // Find active maintenance reserve rule rate
  const maintenanceReserve = reserves?.find(r => 
    r.status !== 'inactive' && 
    (r.name.toLowerCase().includes('manuten') || r.icon === 'Wrench')
  );
  let maintenanceRatePerKm = 0.30;
  if (maintenanceReserve?.regra_ativa && maintenanceReserve?.regra_tipo === 'km' && maintenanceReserve?.regra_valor != null) {
    maintenanceRatePerKm = Number(maintenanceReserve.regra_valor);
  }
  const [activeTab, setActiveTab] = useState<'pizzaria' | 'frete' | 'despesa' | 'avulso' | 'reserva'>(
    paramType ? 'reserva' : 'pizzaria'
  );
  
  const expenseCategories = settings?.expense_categories || ['Combustível', 'Manutenção', 'Alimentação', 'Plano de Internet', 'Equipamento', 'Outras Despesas', 'Outros'];
  const incomeCategoriesRaw = settings?.income_categories || ['iFood', 'Uber', '99Moto', 'Particular', 'Gorjeta', 'Frete do Dia', 'Pizzaria', 'Outros'];
  const incomeCategories = incomeCategoriesRaw.filter(c => c !== 'Pizzaria' && c !== 'Frete do Dia');

  // Common Fields
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startKm, setStartKm] = useState('');
  const [endKm, setEndKm] = useState('');
  const [description, setDescription] = useState(
    paramType === 'aporte' && paramReserveId ? 'Aporte sugerido por lançamentos' : ''
  );
  
  // Pizzaria Fields starting with 0 deliveries initialized (as requested)
  const [deliveries, setDeliveries] = useState('0');
  const [outOfNeighborhood, setOutOfNeighborhood] = useState('0');

  // Frete/Despesa/Avulso Fields
  const [amount, setAmount] = useState(paramAmount || '');
  const [category, setCategory] = useState('');
  const [tollExpense, setTollExpense] = useState('');
  const [showFreightCalc, setShowFreightCalc] = useState(false);

  const handleApplyFreight = ({
    freightPrice,
    tollExpense: calcToll,
    totalKm,
    descriptionSummary
  }: {
    freightPrice: number;
    tollExpense: number;
    totalKm: number;
    descriptionSummary: string;
  }) => {
    setAmount(String(freightPrice));
    if (calcToll > 0) {
      setTollExpense(String(calcToll));
    }
    if (totalKm > 0 && startKm && !isNaN(Number(startKm))) {
      setEndKm(String(Number(startKm) + totalKm));
    }
    if (descriptionSummary) {
      setDescription(prev => prev ? `${prev} | ${descriptionSummary}` : descriptionSummary);
    }
    toast.success(`Preço do frete (R$ ${freightPrice.toFixed(2)}) aplicado com sucesso!`);
  };

  // Reserves Tab specific state
  const [rtType, setRtType] = useState<'aporte' | 'utilizacao'>(
    paramType === 'utilizacao' ? 'utilizacao' : 'aporte'
  );
  const [reserveId, setReserveId] = useState(paramReserveId);
  const [rtCategory, setRtCategory] = useState('Combustível');

  // Robust effect to pre-fill the initial kilometer from the last registered final kilometer
  useEffect(() => {
    if (!paramType && transactions && transactions.length > 0 && !startKm) {
      const txsWithKm = transactions.filter(t => t.end_km !== null && t.end_km !== undefined);
      if (txsWithKm.length > 0) {
        const sorted = [...txsWithKm].sort((a, b) => {
          // Robust sorting: prioritize actual transaction date, then fallback to creation time
          if (a.date !== b.date) {
            return b.date.localeCompare(a.date);
          }
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          if (timeA !== timeB) {
            return timeB - timeA;
          }
          // Secondary fallback to highest odometer to stay robust
          return (b.end_km || 0) - (a.end_km || 0);
        });
        if (sorted.length > 0 && sorted[0].end_km !== null && sorted[0].end_km !== undefined) {
          setStartKm(String(sorted[0].end_km));
        }
      }
    }
  }, [transactions, paramType, startKm]);

  useEffect(() => {
    if (paramType) {
      setActiveTab('reserva');
      setRtType(paramType);
      if (paramReserveId) setReserveId(paramReserveId);
      if (paramAmount) setAmount(paramAmount);
      if (paramType === 'aporte' && paramReserveId) {
        setDescription('Aporte sugerido por lançamentos');
      }
    }
  }, [paramType, paramReserveId, paramAmount]);

  const resetForm = () => {
     setDeliveries('0');
     setOutOfNeighborhood('0');
     setAmount('');
     setDescription('');
     setStartKm('');
     setEndKm('');
     setTollExpense('');
  };


  const calcPizzariaEarnings = () => {
    if (!settings) return 0;
    
    const d = Number(deliveries) || 0;
    const o = Number(outOfNeighborhood) || 0;
    
    let total = 0;
    
    // Out of neighborhood goes on top anyway
    total += o * settings.pizzaria_out_of_neighborhood_rate;
    
    // Base rule
    if (d <= settings.pizzaria_base_deliveries) {
      total += settings.pizzaria_base_rate;
    } else {
      total += settings.pizzaria_daily_rate_above_base + (d * settings.pizzaria_delivery_rate);
    }
    
    return total; // Return numeric
  };

  const getCategoryPeriodTotal = (catName: string) => {
    if (!catName || globalPeriod === 'all') return null;
    
    const now = new Date();
    let currentStart = new Date();
    let currentEnd = new Date();
    
    if (globalPeriod === 'today') {
      currentStart = startOfDay(now);
      currentEnd = endOfDay(now);
    } else if (globalPeriod === 'week') {
      currentStart = startOfWeek(now, { weekStartsOn: 0 });
      currentEnd = endOfWeek(now, { weekStartsOn: 0 });
    } else if (globalPeriod === 'lastMonth') {
      const lastM = subMonths(now, 1);
      currentStart = startOfMonth(lastM);
      currentEnd = endOfMonth(lastM);
    } else if (globalPeriod === 'month') {
      currentStart = startOfMonth(now);
      currentEnd = endOfMonth(now);
    }

    const type = activeTab === 'despesa' ? 'expense' : 'income';

    const periodTotal = transactions
      .filter(t => t.type === type && t.category === catName)
      .filter(t => isWithinInterval(parseISO(t.date), { start: currentStart, end: currentEnd }))
      .reduce((acc, t) => acc + Number(t.amount), 0);

    return periodTotal;
  };

  const formatCurrency = (val: number) => {
    if (hideValues) return 'R$ •••••';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const globalIconMap: Record<string, any> = {
    Bike, Car, Package, Utensils, Fuel, Wrench, Wifi, ShoppingBag, Landmark, 
    Briefcase, Zap, Heart, Camera, Gift, Coffee, Pizza, Beer, DollarSign, 
    PiggyBank, Hammer, Shield, MapPin, Phone, MessageSquare, TrendingUp, TrendingDown,
    Wallet, CreditCard, ShoppingCart, Home, Settings, User, Scissors, Music, Video, 
    Gamepad, Globe, Plane, Train, Bus, Truck, Hospital, School, GraduationCap, 
    Users, Smile, Frown, Star, Bell, Clock, Calendar, Filter
  };

  const getCategoryIcon = (catName: string) => {
    // Check settings first
    if (settings?.category_icons && settings.category_icons[catName]) {
      const iconName = settings.category_icons[catName];
      return globalIconMap[iconName] || TrendingUp;
    }

    // Default fallbacks based on name
    const normalized = catName.toLowerCase();
    if (normalized.includes('combustível') || normalized.includes('gasolina')) return Fuel;
    if (normalized.includes('manutenção') || normalized.includes('oficina') || normalized.includes('peça')) return Wrench;
    if (normalized.includes('aliment') || normalized.includes('almoço')) return Utensils;
    if (normalized.includes('internet') || normalized.includes('celular')) return Wifi;
    if (normalized.includes('ifood') || normalized.includes('shopee')) return ShoppingBag;
    if (normalized.includes('uber') || normalized.includes('99')) return Car;
    if (normalized.includes('transporte') || normalized.includes('viagem')) return MapPin;
    if (normalized.includes('moto')) return Bike;
    if (normalized.includes('particular')) return Landmark;
    
    return activeTab === 'despesa' ? TrendingDown : TrendingUp;
  };

  const calculateFuel = () => {
    if (!settings || !settings.vehicle_km_per_liter || !settings.fuel_price) return 0;
    const sKm = Number(startKm) || 0;
    const eKm = Number(endKm) || 0;
    if (eKm <= sKm) return 0;
    const distance = eKm - sKm;
    return (distance / settings.vehicle_km_per_liter) * settings.fuel_price;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error('Usuário não autenticado.');

      let finalType = 'income';
      let finalAmount = 0;
      let finalCategory = '';

      if (activeTab === 'reserva') {
        if (!reserveId) {
          toast.error('Selecione uma reserva.');
          setLoading(false);
          return;
        }
        const finalAmt = Number(amount);
        if (isNaN(finalAmt) || finalAmt <= 0) {
          toast.error('Informe um valor válido maior que zero.');
          setLoading(false);
          return;
        }

        const selectedRes = reserves.find(r => r.id === reserveId);

        // Determine correct category for 'utilizacao'
        let finalRtCategory = rtCategory;
        if (selectedRes && selectedRes.require_category_on_use === false) {
          finalRtCategory = selectedRes.default_use_category || selectedRes.name;
        }

        // Record the reserve transaction
        const rtId = await addReserveTransaction({
          reserve_id: reserveId,
          type: rtType,
          amount: finalAmt,
          date: date,
          category: rtType === 'utilizacao' ? finalRtCategory : 'Aporte Extra',
          description: description || (rtType === 'aporte' ? `Aporte para ${selectedRes?.name}` : `Uso da reserva ${selectedRes?.name}`),
        });

        let targetHighlightId = rtId;

        // For UTILIZACAO (Usage), we also record a regular expense so it appears in standard ledger
        if (rtType === 'utilizacao') {
          const { data: insertedTxs, error: expenseError } = await supabase.from('transactions').insert({
            user_id: userData.user.id,
            type: 'expense',
            amount: finalAmt,
            date: date,
            category: finalRtCategory || 'Manutenção',
            description: description || `Uso da reserva ${selectedRes?.name}`,
            is_reserve_use: true,
          }).select();

          if (!expenseError && insertedTxs && insertedTxs.length > 0) {
            targetHighlightId = insertedTxs[0].id;
          }
        }

        toast.success(rtType === 'aporte' ? 'Aporte efetuado com sucesso!' : 'Resgate efetuado com sucesso!');
        resetForm();
        await refreshData(true);
        navigate(`/history?highlight=${targetHighlightId}`);
        return;
      }

      if (activeTab === 'pizzaria') {
        finalAmount = calcPizzariaEarnings();
        finalCategory = 'Pizzaria';
        if (finalAmount <= 0) {
          toast.error('Ganhos não calculados corretamente.');
          setLoading(false);
          return;
        }
      } else if (activeTab === 'frete') {
        finalAmount = Number(amount);
        finalCategory = 'Frete do Dia';
      } else if (activeTab === 'avulso') {
        finalAmount = Number(amount);
        finalCategory = category || 'Ganho Diversos';
      } else if (activeTab === 'despesa') {
        finalAmount = Number(amount);
        finalType = 'expense';
        finalCategory = category || 'Outras Despesas';
      }

      if (activeTab !== 'pizzaria' && finalAmount <= 0) {
        toast.error('Informe um valor válido.');
        setLoading(false);
        return;
      }

      const { data: insertedTxs, error } = await supabase.from('transactions').insert({
        user_id: userData.user.id,
        type: finalType,
        amount: finalAmount,
        date: date,
        category: finalCategory,
        description: description,
        start_km: startKm ? Number(startKm) : null,
        end_km: endKm ? Number(endKm) : null,
        deliveries: finalCategory === 'Pizzaria' && deliveries ? Number(deliveries) : null,
        out_of_neighborhood: finalCategory === 'Pizzaria' && outOfNeighborhood ? Number(outOfNeighborhood) : null,
      }).select();

      if (error) throw error;

      let targetHighlightId = insertedTxs && insertedTxs.length > 0 ? insertedTxs[0].id : '';

      if (activeTab === 'frete' && tollExpense) {
        const tollVal = Number(tollExpense);
        if (!isNaN(tollVal) && tollVal > 0) {
          const { error: tollError } = await supabase.from('transactions').insert({
            user_id: userData.user.id,
            type: 'expense',
            amount: tollVal,
            date: date,
            category: 'Pedágio',
            description: description ? `[Pedágio] ${description}` : 'Pedágio (Viagem/Frete)',
          });
          if (tollError) {
            console.error('Erro ao salvar pedágio:', tollError);
          }
        }
      }

      toast.success('Lançamento salvo com sucesso!');
      resetForm();
      await refreshData(true);
      if (targetHighlightId) {
        navigate(`/history?highlight=${targetHighlightId}`);
      } else {
        navigate('/history');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar o lançamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-8 space-y-6 animate-fade-in">
      <header className="border-b border-border/55 pb-5">
        <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
          Registrar Atividade
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm font-medium mt-0.5">
          Escolha a modalidade e preencha os dados abaixo de forma rápida e segura.
        </p>
      </header>

      {/* Tabs list with premium and custom-themed hover and active styles */}
      <div className="grid grid-cols-5 gap-1 md:gap-2">
        <button
          type="button"
          onClick={() => { setActiveTab('pizzaria'); resetForm(); }}
          className={`py-3 flex flex-col items-center justify-center rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === 'pizzaria' ? 'bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/35 border border-indigo-500/15 shadow-xs' : 'bg-muted/30 text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground border border-transparent'}`}
        >
          <Bike className="w-4 h-4 sm:w-5 sm:h-5 mb-1.5 transition-transform duration-200 hover:scale-105" /> Pizzaria
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('frete'); resetForm(); }}
          className={`py-3 flex flex-col items-center justify-center rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === 'frete' ? 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/35 border border-blue-500/15 shadow-xs' : 'bg-muted/30 text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground border border-transparent'}`}
        >
          <Package className="w-4 h-4 sm:w-5 sm:h-5 mb-1.5 transition-transform duration-200 hover:scale-105" /> Frete
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('avulso'); resetForm(); }}
          className={`py-3 flex flex-col items-center justify-center rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === 'avulso' ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/35 border border-emerald-500/15 shadow-xs' : 'bg-muted/30 text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground border border-transparent'}`}
        >
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mb-1.5 transition-transform duration-200 hover:scale-105" /> Ganho
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('despesa'); resetForm(); }}
          className={`py-3 flex flex-col items-center justify-center rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === 'despesa' ? 'bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/35 border border-rose-500/15 shadow-xs' : 'bg-muted/30 text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground border border-transparent'}`}
        >
          <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 mb-1.5 transition-transform duration-200 hover:scale-105" /> Despesa
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('reserva'); resetForm(); }}
          className={`py-3 flex flex-col items-center justify-center rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === 'reserva' ? 'bg-pink-500/10 text-pink-500 ring-1 ring-pink-500/35 border border-pink-500/15 shadow-xs' : 'bg-muted/30 text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground border border-transparent'}`}
        >
          <PiggyBank className="w-4 h-4 sm:w-5 sm:h-5 mb-1.5 transition-transform duration-200 hover:scale-105" /> Reserva
        </button>
      </div>

      <Card className="w-full border border-border/80 shadow-md rounded-2xl">
        <CardContent className="w-full p-5 sm:p-6 md:p-8">
          <form onSubmit={handleSave} className="w-full space-y-5">
            
            {/* Common Top */}
            <div className="space-y-2 max-w-[220px]">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Data da Transação</label>
              <Input
                type="date"
                value={date}
                className="h-11 rounded-xl border-border font-semibold focus:ring-1 focus:ring-primary focus-visible:ring-primary"
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* ==== RESERVA TAB ==== */}
            {activeTab === 'reserva' && (
              <>
                <div className="space-y-3 p-4 bg-pink-500/[0.02] border border-pink-500/10 rounded-xl">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Tipo de Movimentação</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRtType('aporte')}
                      className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${rtType === 'aporte' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-xs' : 'bg-card border-border text-muted-foreground hover:bg-muted/20'}`}
                    >
                      Aporte (Adicionar)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRtType('utilizacao')}
                      className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${rtType === 'utilizacao' ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-xs' : 'bg-card border-border text-muted-foreground hover:bg-muted/20'}`}
                    >
                      Utilização (Resgatar)
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Reserva Alvo</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {reserves.map(r => {
                      const isSelected = reserveId === r.id;
                      const Icon = globalIconMap[r.icon] || PiggyBank;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setReserveId(r.id)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 cursor-pointer gap-2 ${
                            isSelected 
                              ? 'bg-primary/10 border-primary text-primary shadow-sm scale-[1.02]' 
                              : 'bg-card border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                          }`}
                        >
                          <div 
                            className="p-2 rounded-lg flex items-center justify-center text-white"
                            style={{ backgroundColor: isSelected ? r.color : `${r.color}99` }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="text-center">
                            <span className="block text-[10px] font-bold line-clamp-1">{r.name}</span>
                            <span className="block text-[9px] font-semibold opacity-75 mt-0.5">{formatCurrency(r.saldo_atual || 0)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!reserveId && <p className="text-[10px] text-rose-500 font-semibold px-1">Por favor, selecione uma reserva para continuar.</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Valor do Lançamento</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground/75 font-bold text-sm">
                      R$
                    </div>
                    <CurrencyInput
                      placeholder="0,00"
                      className="pl-9 h-11 rounded-xl font-bold border-border"
                      value={amount}
                      onChange={setAmount}
                      required
                    />
                  </div>
                </div>

                {rtType === 'utilizacao' && (!reserveId || reserves.find(r => r.id === reserveId)?.require_category_on_use !== false) && (
                  <div className="space-y-3 animate-fade-in">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Categoria de Saída Secundária</label>
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2">
                      {expenseCategories.map(cat => {
                        const Icon = getCategoryIcon(cat);
                        const isSelected = rtCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setRtCategory(cat)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 cursor-pointer gap-2 ${
                              isSelected 
                                ? 'bg-primary/10 border-primary text-primary shadow-sm scale-[1.02]' 
                                : 'bg-card border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                            }`}
                          >
                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-muted/50'}`}>
                              <Icon className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                            <span className="text-[10px] font-bold text-center line-clamp-1">{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ==== PIZZARIA TAB ==== */}
            {activeTab === 'pizzaria' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5 bg-indigo-500/[0.02] border border-indigo-500/15 rounded-xl">
                  <div className="space-y-3">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90 flex items-end">Qtd. Entregas (Bairro)</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setDeliveries(String(Math.max(0, (Number(deliveries) || 0) - 1)))} className="h-12 w-12 shrink-0 rounded-xl bg-background text-foreground flex items-center justify-center border border-border shadow-sm hover:bg-muted transition-colors font-black text-xl cursor-pointer">
                        -
                      </button>
                      <Input
                        type="number"
                        placeholder="0"
                        className="h-12 rounded-xl font-black text-lg text-center border-border shadow-sm min-w-0 w-full"
                        value={deliveries}
                        onChange={(e) => setDeliveries(e.target.value)}
                        required
                      />
                      <button type="button" onClick={() => setDeliveries(String((Number(deliveries) || 0) + 1))} className="h-12 w-12 shrink-0 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-md hover:bg-indigo-600 transition-colors font-black text-xl cursor-pointer">
                        +
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90 flex items-end">Qtd. Fora de Área</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setOutOfNeighborhood(String(Math.max(0, (Number(outOfNeighborhood) || 0) - 1)))} className="h-12 w-12 shrink-0 rounded-xl bg-background text-foreground flex items-center justify-center border border-border shadow-sm hover:bg-muted transition-colors font-black text-xl cursor-pointer">
                        -
                      </button>
                      <Input
                        type="number"
                        placeholder="0"
                        className="h-12 rounded-xl font-black text-lg text-center border-border shadow-sm min-w-0 w-full"
                        value={outOfNeighborhood}
                        onChange={(e) => setOutOfNeighborhood(e.target.value)}
                      />
                      <button type="button" onClick={() => setOutOfNeighborhood(String((Number(outOfNeighborhood) || 0) + 1))} className="h-12 w-12 shrink-0 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-md hover:bg-indigo-600 transition-colors font-black text-xl cursor-pointer">
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-indigo-500/10 border border-indigo-500/15 rounded-xl flex justify-between items-center mt-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="p-1 px-2 bg-indigo-500/20 rounded text-[9px] uppercase font-black text-indigo-500 tracking-wider">Acordo</div>
                    <span className="text-xs sm:text-sm font-bold text-foreground leading-tight">Total Estimado de Ganho:</span>
                  </div>
                  <span className="text-xl sm:text-2xl font-black text-indigo-500 font-mono shrink-0">
                    R$ {calcPizzariaEarnings().toFixed(2)}
                  </span>
                </div>
              </>
            )}

            {/* ==== FRETE TAB ==== */}
            {activeTab === 'frete' && (
              <div className="space-y-4">
                {/* Freight Calculator Action Banner */}
                <div className="p-3 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-indigo-500/5 border border-indigo-500/25 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Calculator className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black text-foreground block truncate">Calculadora de Precificação</span>
                      <span className="text-[10px] text-muted-foreground block truncate">Precifique por KM, consumo, manutenção e margem</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowFreightCalc(true)}
                    className="shrink-0 h-9 px-3.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    Calcular
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Valor Líquido do Frete</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground/75 font-bold text-sm">
                      R$
                    </div>
                    <CurrencyInput
                      placeholder="0,00"
                      className="pl-9 h-11 rounded-xl font-bold border-border"
                      value={amount}
                      onChange={setAmount}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2 p-4 bg-rose-500/[0.01] border border-rose-500/10 rounded-xl">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500/90 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Gasto com Pedágio (Rio)
                    </label>
                    <span className="text-[9px] text-muted-foreground bg-muted/65 px-1.5 py-0.5 rounded font-medium">Opcional</span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground/75 font-bold text-sm">
                      R$
                    </div>
                    <CurrencyInput
                      placeholder="0,00"
                      className="pl-9 h-11 rounded-xl font-bold border-border fill-background"
                      value={tollExpense}
                      onChange={setTollExpense}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ==== DESPESA / AVULSO TABS ==== */}
            {(activeTab === 'despesa' || activeTab === 'avulso') && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Valor (R$)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground/75 font-bold text-sm">
                      R$
                    </div>
                    <CurrencyInput
                      placeholder="0,00"
                      className="pl-9 h-11 rounded-xl font-bold border-border"
                      value={amount}
                      onChange={setAmount}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-1 mb-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Escolha a Categoria</label>
                    {category && globalPeriod !== 'all' && (
                      <span className="text-[10px] text-muted-foreground bg-muted p-1 px-2 rounded-md font-semibold">
                        Gasto {globalPeriod === 'today' ? 'hoje' : globalPeriod === 'week' ? 'na semana' : 'no mês'}: <span className="font-extrabold text-foreground">{formatCurrency(getCategoryPeriodTotal(category) || 0)}</span>
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 gap-2">
                    {(activeTab === 'despesa' ? expenseCategories : incomeCategories).map(cat => {
                      const Icon = getCategoryIcon(cat);
                      const isSelected = category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 cursor-pointer gap-2 ${
                            isSelected 
                              ? 'bg-primary/10 border-primary text-primary shadow-sm scale-[1.02]' 
                              : 'bg-card border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-muted/50'}`}>
                            <Icon className="w-5 h-5 md:w-6 md:h-6" />
                          </div>
                          <span className="text-[10px] font-bold text-center line-clamp-1">{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Odometer & Desc (Common Bottom) */}
            {(() => {
              const currentCategoryName =
                activeTab === 'pizzaria' ? 'Pizzaria' :
                activeTab === 'frete' ? 'Frete do Dia' :
                category;
              
              const requiresKm = settings?.categories_with_km?.includes(currentCategoryName);

              if (!requiresKm) return null;

              return (
                <div className="space-y-4 pt-2">
                  <hr className="border-border/60" />
                  <div className="grid grid-cols-2 gap-4 bg-muted/10 p-4 border border-border/80 rounded-xl relative overflow-hidden">
                    <div className="space-y-2">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90 h-8 flex items-end">KM Registrado Inicial</label>
                      <Input
                        type="number"
                        placeholder="Ex: 15300"
                        className="h-11 rounded-xl font-semibold border-border bg-card"
                        value={startKm}
                        onChange={(e) => setStartKm(e.target.value)}
                        required={requiresKm}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90 h-8 flex items-end">KM Registrado Final</label>
                      <Input
                        type="number"
                        placeholder="Ex: 15450"
                        className="h-11 rounded-xl font-semibold border-border bg-card"
                        value={endKm}
                        onChange={(e) => setEndKm(e.target.value)}
                        required={requiresKm}
                      />
                    </div>

                    {Number(startKm) >= 0 && Number(endKm) > Number(startKm) && (
                      <div className="col-span-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/15 p-3 rounded-lg font-semibold mt-2 shadow-xs">
                        <Fuel className="w-4 h-4 shrink-0 text-amber-500 animate-pulse" />
                        <span className="leading-tight">
                          Gasto Estimado: <strong className="font-extrabold text-amber-700">R$ {calculateFuel().toFixed(2)}</strong> ({Number(endKm) - Number(startKm)} km percorridos)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/90">Descrição / Observações</label>
              <Input
                type="text"
                placeholder="Ex: Frete pra região X, pneu furou..."
                className="h-11 rounded-xl border-border"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full h-12 text-sm sm:text-base font-black uppercase tracking-wider bg-primary hover:bg-primary/95 text-primary-foreground focus:ring-1 focus:ring-offset-1 focus:ring-primary shadow-xs hover:shadow-md transition-all duration-200 mt-6 rounded-xl cursor-pointer" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {loading ? 'Sincronizando...' : 'Salvar no Faturamento'}
            </Button>
            
          </form>
        </CardContent>
      </Card>

      <FreightCalculatorModal
        isOpen={showFreightCalc}
        onClose={() => setShowFreightCalc(false)}
        onApplyFreight={handleApplyFreight}
        defaultKm={startKm && endKm ? Math.max(0, Number(endKm) - Number(startKm)) : 0}
        vehicleKmPerLiter={settings?.vehicle_km_per_liter ?? 10}
        fuelPrice={settings?.fuel_price ?? 6.00}
        maintenanceRatePerKm={maintenanceRatePerKm}
        defaultDriverLabor={settings?.default_driver_labor ?? 100}
      />
    </div>
  );
}
