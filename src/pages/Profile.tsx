import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserSettings } from '../types';
import { toast } from 'sonner';
import { 
  LogOut, 
  Save, 
  Loader2, 
  KeyRound, 
  Mail, 
  User, 
  X, 
  Plus,
  Bike, 
  Car, 
  Package, 
  Utensils, 
  Fuel, 
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
  DollarSign, 
  PiggyBank, 
  Hammer, 
  Shield, 
  MapPin, 
  Phone, 
  MessageSquare,
  Wallet, 
  CreditCard,
  ShoppingCart,
  Home,
  Settings,
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
  ChevronDown,
  ChevronUp,
  Sliders,
  Check,
  Sparkles,
  ShieldCheck,
  Layers,
  Gauge,
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff,
  Coins,
  CheckCircle2,
  Info,
  Terminal,
  Bug,
  RotateCcw,
  AlertCircle,
  Key
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { DebugConsoleModal } from '../components/DebugConsoleModal';
import { executeQuoteFetch, QuoteProvider, QuoteFetchResult } from '../lib/quoteService';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SettingsSnapshot {
  settings: UserSettings;
  personalCategories: string[];
  operationalCategories: string[];
  incomeCategories: string[];
  categoriesWithKm: string[];
  categoryIcons: Record<string, string>;
}

export function Profile() {
  const { settings: globalSettings, refreshData, loading: dataLoading, transactions, reserves } = useData();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingAuth, setSavingAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'account' | 'categories' | 'vehicle' | 'pizzaria' | 'financial'>('all');
  
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<{type: 'income' | 'personal' | 'operational', name: string} | null>(null);
  const [editCategoryData, setEditCategoryData] = useState<{type: 'income' | 'personal' | 'operational', oldName: string, newName: string} | null>(null);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  
  // Auth states
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Settings states
  const [settings, setSettings] = useState<UserSettings>({
    user_id: '',
    full_name: '',
    pizzaria_base_deliveries: 8,
    pizzaria_base_rate: 90,
    pizzaria_daily_rate_above_base: 50,
    pizzaria_delivery_rate: 5,
    pizzaria_out_of_neighborhood_rate: 4,
    expense_categories: ['Combustível', 'Pedágio', 'Manutenção', 'Alimentação', 'Plano de Internet', 'Equipamento', 'Outras Despesas', 'Outros'],
    operational_expense_categories: ['Combustível', 'Pedágio', 'Manutenção'],
    personal_expense_categories: ['Alimentação', 'Plano de Internet', 'Equipamento', 'Outras Despesas', 'Outros'],
    income_categories: ['iFood', 'Uber', '99Moto', 'Particular', 'Gorjeta', 'Frete do Dia', 'Pizzaria', 'Outros'],
    vehicle_km_per_liter: 30,
    fuel_price: 6,
    default_driver_labor: 100,
    initial_balance: 0,
  });

  const [personalCategories, setPersonalCategories] = useState<string[]>([]);
  const [operationalCategories, setOperationalCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [categoriesWithKm, setCategoriesWithKm] = useState<string[]>([]);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, string>>({});
  const [newPersonalCat, setNewPersonalCat] = useState('');
  const [newIncomeCat, setNewIncomeCat] = useState('');
  const [newOperationalCat, setNewOperationalCat] = useState('');

  // Quote testing in Profile
  const [testingProfileQuote, setTestingProfileQuote] = useState(false);
  const [profileQuoteTestResult, setProfileQuoteTestResult] = useState<QuoteFetchResult | null>(null);

  const handleTestQuotesInProfile = async (customTickers = 'PETR4, MXRF11, HGLG11, VALE3') => {
    setTestingProfileQuote(true);
    setProfileQuoteTestResult(null);
    try {
      const tickers = customTickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
      const res = await executeQuoteFetch(tickers, {
        provider: settings.quote_provider || 'auto',
        brapiToken: settings.brapi_token,
      });
      setProfileQuoteTestResult(res);
      if (res.successCount > 0) {
        toast.success(`${res.successCount} cotações obtidas com sucesso (${res.durationMs}ms)!`);
      } else {
        toast.error('Nenhuma cotação retornada.');
      }
    } catch (e: any) {
      toast.error('Falha no teste: ' + (e?.message || e));
    } finally {
      setTestingProfileQuote(false);
    }
  };

  // Initial snapshot to track dirty state
  const [initialSnapshot, setInitialSnapshot] = useState<SettingsSnapshot | null>(null);

  const AVAILABLE_ICONS = [
    { name: 'Bike', icon: Bike },
    { name: 'Car', icon: Car },
    { name: 'Package', icon: Package },
    { name: 'Utensils', icon: Utensils },
    { name: 'Fuel', icon: Fuel },
    { name: 'Wrench', icon: Wrench },
    { name: 'Wifi', icon: Wifi },
    { name: 'ShoppingBag', icon: ShoppingBag },
    { name: 'Landmark', icon: Landmark },
    { name: 'Briefcase', icon: Briefcase },
    { name: 'Zap', icon: Zap },
    { name: 'Heart', icon: Heart },
    { name: 'Camera', icon: Camera },
    { name: 'Gift', icon: Gift },
    { name: 'Coffee', icon: Coffee },
    { name: 'Pizza', icon: Pizza },
    { name: 'Beer', icon: Beer },
    { name: 'DollarSign', icon: DollarSign },
    { name: 'PiggyBank', icon: PiggyBank },
    { name: 'Hammer', icon: Hammer },
    { name: 'Shield', icon: Shield },
    { name: 'MapPin', icon: MapPin },
    { name: 'Phone', icon: Phone },
    { name: 'MessageSquare', icon: MessageSquare },
    { name: 'Wallet', icon: Wallet },
    { name: 'CreditCard', icon: CreditCard },
    { name: 'ShoppingCart', icon: ShoppingCart },
    { name: 'Home', icon: Home },
    { name: 'Settings', icon: Settings },
    { name: 'Scissors', icon: Scissors },
    { name: 'Music', icon: Music },
    { name: 'Video', icon: Video },
    { name: 'Gamepad', icon: Gamepad },
    { name: 'Globe', icon: Globe },
    { name: 'Plane', icon: Plane },
    { name: 'Train', icon: Train },
    { name: 'Bus', icon: Bus },
    { name: 'Truck', icon: Truck },
    { name: 'Hospital', icon: Hospital },
    { name: 'School', icon: School },
    { name: 'GraduationCap', icon: GraduationCap },
    { name: 'Users', icon: Users },
    { name: 'User', icon: User },
    { name: 'Smile', icon: Smile },
    { name: 'Frown', icon: Frown },
    { name: 'Star', icon: Star },
    { name: 'Bell', icon: Bell },
    { name: 'Clock', icon: Clock },
    { name: 'Calendar', icon: Calendar },
    { name: 'Filter', icon: Filter }
  ];

  const getIconByName = (name: string) => {
    const found = AVAILABLE_ICONS.find(i => i.name === name);
    return found ? found.icon : Landmark;
  };

  const loadSettings = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user && globalSettings) {
      setEmail(userData.user.email || '');
      setSettings(globalSettings);

      const pers = globalSettings.personal_expense_categories || ['Alimentação', 'Plano de Internet', 'Equipamento', 'Outras Despesas', 'Outros'];
      const oper = globalSettings.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];
      const inc = globalSettings.income_categories || [];
      const kmCats = globalSettings.categories_with_km || [];
      const icons = globalSettings.category_icons || {};

      setPersonalCategories(pers);
      setOperationalCategories(oper);
      setIncomeCategories(inc);
      setCategoriesWithKm(kmCats);
      setCategoryIcons(icons);

      setInitialSnapshot({
        settings: { ...globalSettings },
        personalCategories: [...pers],
        operationalCategories: [...oper],
        incomeCategories: [...inc],
        categoriesWithKm: [...kmCats],
        categoryIcons: { ...icons },
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!dataLoading && globalSettings) {
      loadSettings();
    }
  }, [dataLoading, globalSettings]);

  // DIRTY CHECK LOGIC
  const isDirty = useMemo(() => {
    if (!initialSnapshot) return false;

    // Check basic settings fields
    const s1 = settings;
    const s0 = initialSnapshot.settings;
    if (
      s1.full_name !== s0.full_name ||
      s1.vehicle_km_per_liter !== s0.vehicle_km_per_liter ||
      s1.fuel_price !== s0.fuel_price ||
      s1.default_driver_labor !== s0.default_driver_labor ||
      s1.initial_balance !== s0.initial_balance ||
      s1.default_investment_reserve_id !== s0.default_investment_reserve_id ||
      s1.pizzaria_base_deliveries !== s0.pizzaria_base_deliveries ||
      s1.pizzaria_base_rate !== s0.pizzaria_base_rate ||
      s1.pizzaria_daily_rate_above_base !== s0.pizzaria_daily_rate_above_base ||
      s1.pizzaria_delivery_rate !== s0.pizzaria_delivery_rate ||
      s1.pizzaria_out_of_neighborhood_rate !== s0.pizzaria_out_of_neighborhood_rate ||
      s1.quote_provider !== s0.quote_provider ||
      s1.brapi_token !== s0.brapi_token
    ) {
      return true;
    }

    // Check arrays
    if (JSON.stringify(personalCategories) !== JSON.stringify(initialSnapshot.personalCategories)) return true;
    if (JSON.stringify(operationalCategories) !== JSON.stringify(initialSnapshot.operationalCategories)) return true;
    if (JSON.stringify(incomeCategories) !== JSON.stringify(initialSnapshot.incomeCategories)) return true;
    if (JSON.stringify(categoriesWithKm) !== JSON.stringify(initialSnapshot.categoriesWithKm)) return true;
    if (JSON.stringify(categoryIcons) !== JSON.stringify(initialSnapshot.categoryIcons)) return true;

    return false;
  }, [
    settings,
    personalCategories,
    operationalCategories,
    incomeCategories,
    categoriesWithKm,
    categoryIcons,
    initialSnapshot
  ]);

  const handleDiscardChanges = () => {
    if (!initialSnapshot) return;
    setSettings({ ...initialSnapshot.settings });
    setPersonalCategories([...initialSnapshot.personalCategories]);
    setOperationalCategories([...initialSnapshot.operationalCategories]);
    setIncomeCategories([...initialSnapshot.incomeCategories]);
    setCategoriesWithKm([...initialSnapshot.categoriesWithKm]);
    setCategoryIcons({ ...initialSnapshot.categoryIcons });
    toast.info('Alterações descartadas.');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({
      ...settings,
      [e.target.name]: e.target.type === 'number' ? Number(e.target.value) : e.target.value,
    });
  };

  const confirmRemoveCategory = (type: 'income' | 'personal' | 'operational', cat: string) => {
    if (['Pizzaria', 'Frete do Dia', 'Combustível', 'Manutenção', 'Pedágio'].includes(cat)) {
      toast.error('Esta categoria é protegida pelo sistema.');
      return;
    }
    setDeleteCategoryConfirm({ type, name: cat });
  };

  const performDeleteCategory = async () => {
    if (!deleteCategoryConfirm) return;
    const { type, name } = deleteCategoryConfirm;

    const affected = transactions.filter(t => t.category === name);
    if (affected.length > 0) {
      toast.message(`Atualizando ${affected.length} lançamentos...`);
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { error } = await supabase.from('transactions').update({ category: 'Outros' }).eq('category', name).eq('user_id', userData.user.id);
        if (error) {
          toast.error('Erro ao atualizar lançamentos.');
        } else {
          refreshData(true);
        }
      }
    }

    if (type === 'income') {
      setIncomeCategories(prev => prev.filter(c => c !== name));
    } else if (type === 'personal') {
      setPersonalCategories(prev => prev.filter(c => c !== name));
    } else {
      setOperationalCategories(prev => prev.filter(c => c !== name));
    }
    setCategoriesWithKm(prev => prev.filter(c => c !== name));
    setDeleteCategoryConfirm(null);
  };

  const confirmEditCategory = (type: 'income' | 'personal' | 'operational', cat: string) => {
    if (['Pizzaria', 'Frete do Dia', 'Combustível', 'Manutenção', 'Pedágio'].includes(cat)) {
      toast.error('Esta categoria é protegida pelo sistema.');
      return;
    }
    setEditCategoryData({ type, oldName: cat, newName: cat });
  };

  const performEditCategory = async () => {
    if (!editCategoryData) return;
    const { type, oldName, newName } = editCategoryData;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditCategoryData(null);
      return;
    }

    if (type === 'income' && incomeCategories.includes(trimmed)) {
      toast.error('O novo nome da categoria já existe nos Ganhos.');
      return;
    }
    if (type === 'personal' && personalCategories.includes(trimmed)) {
      toast.error('O novo nome da categoria já existe nas Despesas Pessoais.');
      return;
    }
    if (type === 'operational' && operationalCategories.includes(trimmed)) {
      toast.error('O novo nome da categoria já existe nas Despesas Operacionais.');
      return;
    }

    const affected = transactions.filter(t => t.category === oldName);
    if (affected.length > 0) {
      toast.message(`Atualizando ${affected.length} confirmados...`);
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { error } = await supabase.from('transactions').update({ category: trimmed }).eq('category', oldName).eq('user_id', userData.user.id);
        if (error) {
          toast.error('Erro ao atualizar lançamentos: ' + error.message);
        } else {
          refreshData(true);
        }
      }
    }

    if (type === 'income') {
      setIncomeCategories(prev => prev.map(c => c === oldName ? trimmed : c));
    } else if (type === 'personal') {
      setPersonalCategories(prev => prev.map(c => c === oldName ? trimmed : c));
    } else {
      setOperationalCategories(prev => prev.map(c => c === oldName ? trimmed : c));
    }

    if (categoriesWithKm.includes(oldName)) {
      setCategoriesWithKm(prev => prev.map(c => c === oldName ? trimmed : c));
    }

    if (categoryIcons[oldName]) {
      setCategoryIcons(prev => {
        const next = { ...prev };
        next[trimmed] = next[oldName];
        delete next[oldName];
        return next;
      });
    }

    setEditCategoryData(null);
  };

  const moveCategory = (type: 'income' | 'personal' | 'operational', index: number, direction: 'up' | 'down') => {
    if (type === 'income') {
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === incomeCategories.length - 1)) return;
      const newArr = [...incomeCategories];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      [newArr[index], newArr[targetIdx]] = [newArr[targetIdx], newArr[index]];
      setIncomeCategories(newArr);
    } else if (type === 'personal') {
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === personalCategories.length - 1)) return;
      const newArr = [...personalCategories];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      [newArr[index], newArr[targetIdx]] = [newArr[targetIdx], newArr[index]];
      setPersonalCategories(newArr);
    } else {
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === operationalCategories.length - 1)) return;
      const newArr = [...operationalCategories];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      [newArr[index], newArr[targetIdx]] = [newArr[targetIdx], newArr[index]];
      setOperationalCategories(newArr);
    }
  };

  const addCategory = (type: 'income' | 'personal' | 'operational') => {
    if (type === 'income') {
      const val = newIncomeCat.trim();
      if (!val) return;
      if (incomeCategories.includes(val)) {
        toast.error('Categoria já existe!');
        return;
      }
      setIncomeCategories(prev => [...prev, val]);
      setNewIncomeCat('');
    } else if (type === 'personal') {
      const val = newPersonalCat.trim();
      if (!val) return;
      if (personalCategories.includes(val)) {
        toast.error('Categoria já existe!');
        return;
      }
      setPersonalCategories(prev => [...prev, val]);
      setNewPersonalCat('');
    } else {
      const val = newOperationalCat.trim();
      if (!val) return;
      if (operationalCategories.includes(val)) {
        toast.error('Categoria já existe!');
        return;
      }
      setOperationalCategories(prev => [...prev, val]);
      setNewOperationalCat('');
    }
  };

  const toggleCategoryKm = (cat: string) => {
    setCategoriesWithKm(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleUpdateIcon = (cat: string, iconName: string) => {
    setCategoryIcons(prev => ({
      ...prev,
      [cat]: iconName
    }));
  };

  const handleSaveSettings = async () => {
    if (!isDirty) {
      toast.info('Não há alterações pendentes para salvar.');
      return;
    }

    setSavingSettings(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    try {
      const payload = {
        user_id: userData.user.id,
        ...settings,
        default_investment_reserve_id: settings.default_investment_reserve_id || null,
        operational_expense_categories: operationalCategories,
        personal_expense_categories: personalCategories,
        expense_categories: [...operationalCategories, ...personalCategories],
        income_categories: incomeCategories,
        categories_with_km: categoriesWithKm,
        category_icons: categoryIcons,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('user_settings').upsert(payload);

      if (error) {
        console.warn('[Profile] Supabase save warning (saving locally):', error.message);
      }
      
      // Update local storage
      const localKey = `user_settings_${userData.user.id}`;
      try {
        localStorage.setItem(localKey, JSON.stringify(payload));
      } catch (err) {
        console.warn('LocalStorage error:', err);
      }

      // Update snapshot
      setInitialSnapshot({
        settings: { ...settings },
        personalCategories: [...personalCategories],
        operationalCategories: [...operationalCategories],
        incomeCategories: [...incomeCategories],
        categoriesWithKm: [...categoriesWithKm],
        categoryIcons: { ...categoryIcons },
      });

      toast.success('Configurações salvas com sucesso!');
      await refreshData(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar as configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAuth(true);
    try {
      const updates: { email?: string; password?: string, data?: { full_name?: string } } = {};
      if (email) updates.email = email;
      if (newPassword) updates.password = newPassword;
      if (settings.full_name !== globalSettings?.full_name) {
         updates.data = { full_name: settings.full_name };
      }
      
      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      if (settings.full_name !== globalSettings?.full_name) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await supabase.from('user_settings').update({ full_name: settings.full_name }).eq('user_id', userData.user.id);
          refreshData(true);
        }
      }
      
      toast.success('Dados da conta atualizados com sucesso!');
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar dados da conta.');
    } finally {
      setSavingAuth(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex-1 w-full flex flex-col justify-center items-center py-32 space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">Carregando perfil e configurações...</p>
      </div>
    );
  }

  // Visual calculations for previews
  const costPer100Km = settings.vehicle_km_per_liter > 0 
    ? (100 / settings.vehicle_km_per_liter) * (settings.fuel_price || 0)
    : 0;

  const pizzariaSimulatedDeliveries = 12;
  const pizzariaBaseDeliv = settings.pizzaria_base_deliveries || 8;
  const pizzariaBasePay = (settings.pizzaria_base_rate || 90);
  const pizzariaExtraCount = Math.max(0, pizzariaSimulatedDeliveries - pizzariaBaseDeliv);
  const pizzariaExtraPay = pizzariaExtraCount * (settings.pizzaria_delivery_rate || 5);
  const pizzariaTotalSimulated = pizzariaBasePay + pizzariaExtraPay;

  const totalCategoriesCount = incomeCategories.length + operationalCategories.length + personalCategories.length;

  const userInitials = (settings.full_name || email || 'M')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-3 sm:p-6 lg:p-8 space-y-6 pb-36 md:pb-32">
      
      {/* PROFILE HERO HEADER CARD (REDESIGNED FOR MODERN HIERARCHY) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-indigo-500/20">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-56 h-56 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          {/* User Info Avatar & Title */}
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-amber-400 p-0.5 shadow-xl">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-white font-black text-xl sm:text-2xl font-mono tracking-tight">
                  {userInitials || <User className="w-8 h-8 text-indigo-300" />}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-slate-950 shadow-md">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white truncate">
                  {settings.full_name || 'Motorista'}
                </h1>
                <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shrink-0 flex items-center gap-1 shadow-xs">
                  <Sparkles className="w-3 h-3 text-amber-300" /> Pro Gestão
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 font-medium truncate flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                {email || 'Não informado'}
              </p>

              {/* Stats badges */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[10px] bg-slate-800/90 text-slate-200 border border-slate-700/80 px-2.5 py-0.5 rounded-lg font-bold">
                  {totalCategoriesCount} Categorias
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg font-bold">
                  {reserves?.length || 0} Reservas
                </span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-0.5 rounded-lg font-bold">
                  Consumo: {settings.vehicle_km_per_liter} km/L
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Version */}
          <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 border-slate-800 pt-3 md:pt-0 gap-2.5 shrink-0">
            <Button 
              variant="destructive" 
              onClick={handleSignOut}
              className="h-10 px-4 rounded-xl font-extrabold text-xs bg-rose-500/20 hover:bg-rose-600 text-rose-200 border border-rose-500/30 transition-all cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </Button>
            <span className="text-[10px] font-mono text-slate-400">
              MotoGestão • v1.2.0
            </span>
          </div>

        </div>
      </div>

      {/* NAVIGATION TABS (SMOOTH RESPONSIVE PILLS) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none snap-x">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-md font-extrabold'
              : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Ver Tudo
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('account')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'account'
              ? 'bg-indigo-600 text-white shadow-md font-extrabold'
              : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Conta & Acesso
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'categories'
              ? 'bg-indigo-600 text-white shadow-md font-extrabold'
              : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Categorias ({totalCategoriesCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vehicle')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'vehicle'
              ? 'bg-indigo-600 text-white shadow-md font-extrabold'
              : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Bike className="w-3.5 h-3.5" />
          Veículo & Fretes
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pizzaria')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'pizzaria'
              ? 'bg-indigo-600 text-white shadow-md font-extrabold'
              : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Pizza className="w-3.5 h-3.5" />
          Pizzaria & Diárias
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('financial')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'financial'
              ? 'bg-indigo-600 text-white shadow-md font-extrabold'
              : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          Banca & Investimentos
        </button>
      </div>

      {/* MAIN FORM SECTIONS */}
      <div className="space-y-6">
        
        {/* SECTION 1: ACCOUNT & CREDENTIALS */}
        {(activeTab === 'all' || activeTab === 'account') && (
          <Card className="border border-border/80 shadow-md rounded-3xl overflow-hidden transition-all hover:border-indigo-500/30">
            <CardHeader className="bg-gradient-to-r from-card via-card to-muted/30 border-b border-border/60 p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-black tracking-tight">Dados da Conta & Credenciais</CardTitle>
                  <CardDescription className="text-xs">
                    Atualize seu nome completo, email de login e credenciais com segurança.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-5">
              <form onSubmit={handleUpdateAuth} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-500" /> Nome Completo
                    </label>
                    <Input
                      type="text"
                      name="full_name"
                      placeholder="Seu nome completo"
                      value={settings.full_name || ''}
                      onChange={handleChange}
                      className="h-11 rounded-xl font-semibold border-border bg-background focus-visible:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-500" /> Email de Acesso
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      required
                      className="h-11 rounded-xl font-semibold border-border bg-background focus-visible:ring-indigo-500"
                    />
                  </div>

                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" /> Nova Senha de Acesso
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Preencha apenas se quiser alterar sua senha atual"
                      className="h-11 rounded-xl font-semibold border-border pr-11 bg-background focus-visible:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Mantenha em branco para preservar a senha atual cadastrada.</p>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={savingAuth}
                    className="h-11 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    {savingAuth ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingAuth ? 'Atualizando...' : 'Atualizar Dados de Acesso'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* SECTION 2: CATEGORIES & ODOMETER */}
        {(activeTab === 'all' || activeTab === 'categories') && (
          <Card className="border border-border/80 shadow-md rounded-3xl overflow-hidden transition-all hover:border-indigo-500/30">
            <CardHeader className="bg-gradient-to-r from-card via-card to-muted/30 border-b border-border/60 p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-black tracking-tight">Gerenciamento de Categorias & Odômetro</CardTitle>
                  <CardDescription className="text-xs">
                    Personalize os nomes, ícones, posições e integração com o cálculo de KM rodado.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-5 sm:p-6 space-y-6">
              
              {/* CATEGORIAS DE GANHOS */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Categorias de Ganhos / Faturamento ({incomeCategories.length})
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-extrabold">
                    Entradas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {incomeCategories.map((cat, index) => {
                    const Icon = getIconByName(categoryIcons[cat]);
                    const isProtected = ['Pizzaria', 'Frete do Dia'].includes(cat);
                    return (
                      <div key={cat} className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border/80 shadow-2xs hover:border-emerald-500/40 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <Popover>
                            <PopoverTrigger className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 hover:bg-emerald-500/20 transition-colors cursor-pointer border border-emerald-500/20">
                              <Icon className="w-4 h-4" />
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 bg-popover border-border rounded-2xl shadow-xl" align="start">
                              <span className="text-[10px] font-extrabold uppercase text-muted-foreground block mb-2">Escolher Ícone para {cat}</span>
                              <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                {AVAILABLE_ICONS.map(i => {
                                  const IComp = i.icon;
                                  return (
                                    <button
                                      key={i.name}
                                      type="button"
                                      onClick={() => handleUpdateIcon(cat, i.name)}
                                      className={`p-2 rounded-lg flex items-center justify-center hover:bg-muted font-bold cursor-pointer transition-colors ${categoryIcons[cat] === i.name ? 'bg-emerald-500 text-white' : 'text-muted-foreground'}`}
                                    >
                                      <IComp className="w-4 h-4" />
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>

                          <div className="min-w-0">
                            <span className="text-xs font-extrabold text-foreground block truncate">{cat}</span>
                            {isProtected && (
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">Protegida do Sistema</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <div className="flex flex-col border-r pr-1 mr-1 border-border/50">
                            <button type="button" onClick={() => moveCategory('income', index, 'up')} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5 cursor-pointer">
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => moveCategory('income', index, 'down')} disabled={index === incomeCategories.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5 cursor-pointer">
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          {!isProtected && (
                            <>
                              <button type="button" onClick={() => confirmEditCategory('income', cat)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer" title="Renomear Categoria">
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => confirmRemoveCategory('income', cat)} className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer" title="Excluir Categoria">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1">
                  <Input
                    type="text"
                    className="h-11 rounded-xl text-xs font-semibold bg-background"
                    value={newIncomeCat}
                    onChange={(e) => setNewIncomeCat(e.target.value)}
                    placeholder="Adicionar nova categoria de ganho..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory('income'))}
                  />
                  <Button type="button" variant="secondary" className="h-11 rounded-xl px-5 cursor-pointer font-bold text-xs" onClick={() => addCategory('income')}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>

              {/* CATEGORIAS OPERACIONAIS */}
              <div className="space-y-3.5 pt-4 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Bike className="w-4 h-4" /> Despesas Operacionais / Veículo ({operationalCategories.length})
                  </span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-extrabold">
                    Custos de Trabalho
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {operationalCategories.map((cat, index) => {
                    const Icon = getIconByName(categoryIcons[cat]);
                    const isProtected = ['Combustível', 'Manutenção', 'Pedágio'].includes(cat);
                    return (
                      <div key={cat} className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border/80 shadow-2xs hover:border-amber-500/40 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <Popover>
                            <PopoverTrigger className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 hover:bg-amber-500/20 transition-colors cursor-pointer border border-amber-500/20">
                              <Icon className="w-4 h-4" />
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 bg-popover border-border rounded-2xl shadow-xl" align="start">
                              <span className="text-[10px] font-extrabold uppercase text-muted-foreground block mb-2">Escolher Ícone para {cat}</span>
                              <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                {AVAILABLE_ICONS.map(i => {
                                  const IComp = i.icon;
                                  return (
                                    <button
                                      key={i.name}
                                      type="button"
                                      onClick={() => handleUpdateIcon(cat, i.name)}
                                      className={`p-2 rounded-lg flex items-center justify-center hover:bg-muted font-bold cursor-pointer transition-colors ${categoryIcons[cat] === i.name ? 'bg-amber-500 text-white' : 'text-muted-foreground'}`}
                                    >
                                      <IComp className="w-4 h-4" />
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>

                          <div className="min-w-0">
                            <span className="text-xs font-extrabold text-foreground block truncate">{cat}</span>
                            {isProtected && (
                              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">Protegida do Sistema</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <div className="flex flex-col border-r pr-1 mr-1 border-border/50">
                            <button type="button" onClick={() => moveCategory('operational', index, 'up')} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5 cursor-pointer">
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => moveCategory('operational', index, 'down')} disabled={index === operationalCategories.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5 cursor-pointer">
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          {!isProtected && (
                            <>
                              <button type="button" onClick={() => confirmEditCategory('operational', cat)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer" title="Renomear Categoria">
                                <Settings className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => confirmRemoveCategory('operational', cat)} className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer" title="Excluir Categoria">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1">
                  <Input
                    type="text"
                    className="h-11 rounded-xl text-xs font-semibold bg-background focus-visible:ring-amber-500"
                    value={newOperationalCat}
                    onChange={(e) => setNewOperationalCat(e.target.value)}
                    placeholder="Adicionar nova categoria operacional..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory('operational'))}
                  />
                  <Button type="button" variant="secondary" className="h-11 rounded-xl px-5 text-amber-600 hover:bg-amber-500/10 cursor-pointer font-bold text-xs" onClick={() => addCategory('operational')}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>

              {/* CATEGORIAS PESSOAIS */}
              <div className="space-y-3.5 pt-4 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                    <Heart className="w-4 h-4" /> Despesas Pessoais ({personalCategories.length})
                  </span>
                  <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-300 px-2.5 py-0.5 rounded-full font-extrabold">
                    Gastos Pessoais
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {personalCategories.map((cat, index) => {
                    const Icon = getIconByName(categoryIcons[cat]);
                    return (
                      <div key={cat} className="flex items-center justify-between p-3 rounded-2xl bg-card border border-border/80 shadow-2xs hover:border-rose-500/40 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <Popover>
                            <PopoverTrigger className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 hover:bg-rose-500/20 transition-colors cursor-pointer border border-rose-500/20">
                              <Icon className="w-4 h-4" />
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 bg-popover border-border rounded-2xl shadow-xl" align="start">
                              <span className="text-[10px] font-extrabold uppercase text-muted-foreground block mb-2">Escolher Ícone para {cat}</span>
                              <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                {AVAILABLE_ICONS.map(i => {
                                  const IComp = i.icon;
                                  return (
                                    <button
                                      key={i.name}
                                      type="button"
                                      onClick={() => handleUpdateIcon(cat, i.name)}
                                      className={`p-2 rounded-lg flex items-center justify-center hover:bg-muted font-bold cursor-pointer transition-colors ${categoryIcons[cat] === i.name ? 'bg-rose-500 text-white' : 'text-muted-foreground'}`}
                                    >
                                      <IComp className="w-4 h-4" />
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>

                          <div className="min-w-0">
                            <span className="text-xs font-extrabold text-foreground block truncate">{cat}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <div className="flex flex-col border-r pr-1 mr-1 border-border/50">
                            <button type="button" onClick={() => moveCategory('personal', index, 'up')} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5 cursor-pointer">
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => moveCategory('personal', index, 'down')} disabled={index === personalCategories.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5 cursor-pointer">
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          <button type="button" onClick={() => confirmEditCategory('personal', cat)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer" title="Renomear Categoria">
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => confirmRemoveCategory('personal', cat)} className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer" title="Excluir Categoria">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1">
                  <Input
                    type="text"
                    className="h-11 rounded-xl text-xs font-semibold bg-background focus-visible:ring-rose-500"
                    value={newPersonalCat}
                    onChange={(e) => setNewPersonalCat(e.target.value)}
                    placeholder="Adicionar nova categoria pessoal..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory('personal'))}
                  />
                  <Button type="button" variant="secondary" className="h-11 rounded-xl px-5 text-rose-600 hover:bg-rose-500/10 cursor-pointer font-bold text-xs" onClick={() => addCategory('personal')}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>

              {/* SEÇÃO ODÔMETRO (KM INICIAL E FINAL) */}
              <div className="space-y-3 pt-4 border-t border-border/60 bg-muted/30 -mx-5 -mb-5 p-5 rounded-b-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-foreground block">
                      Uso do Odômetro (KM Inicial / Final)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Selecione quais categorias de ganho devem solicitar campos de odômetro para cálculo automático de km rodado e estimativa de combustível.
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {incomeCategories.map(cat => {
                    const isActive = categoriesWithKm.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategoryKm(cat)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-extrabold'
                            : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

            </CardContent>
          </Card>
        )}

        {/* SECTION 3: VEHICLE & FREIGHT SETTINGS */}
        {(activeTab === 'all' || activeTab === 'vehicle') && (
          <Card className="border border-border/80 shadow-md rounded-3xl overflow-hidden transition-all hover:border-indigo-500/30">
            <CardHeader className="bg-gradient-to-r from-card via-card to-muted/30 border-b border-border/60 p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-black tracking-tight">Veículo & Parâmetros do Frete</CardTitle>
                  <CardDescription className="text-xs">
                    Configure média de consumo por litro, valor do combustível e diária padrão do motorista.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                
                {/* Consumo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Fuel className="w-3.5 h-3.5 text-amber-500" /> Consumo (KM por Litro)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    name="vehicle_km_per_liter"
                    value={settings.vehicle_km_per_liter}
                    onChange={handleChange}
                    className="h-11 rounded-xl font-bold border-border bg-background"
                  />
                  <div className="flex gap-1 pt-1">
                    {[25, 30, 35, 40].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSettings({ ...settings, vehicle_km_per_liter: val })}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${settings.vehicle_km_per_liter === val ? 'bg-amber-500 text-white border-amber-500 shadow-2xs font-black' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
                      >
                        {val} km/L
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preço do Litro */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Preço do Combustível (R$/L)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    name="fuel_price"
                    value={settings.fuel_price}
                    onChange={handleChange}
                    className="h-11 rounded-xl font-bold border-border bg-background"
                  />
                  <span className="text-[11px] text-muted-foreground block">Utilizado na calculadora de combustível</span>
                </div>

                {/* Diária do Motorista */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-500" /> Diária do Motorista (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    name="default_driver_labor"
                    value={settings.default_driver_labor ?? 100}
                    onChange={handleChange}
                    className="h-11 rounded-xl font-bold border-border bg-background"
                  />
                  <span className="text-[11px] text-muted-foreground block">Valor base para orçamentos de frete</span>
                </div>

              </div>

              {/* Vehicle Cost Preview Banner */}
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-300 block">Estimativa de Custo por 100 KM</span>
                    <span className="text-[11px] text-muted-foreground">Com base na média de {settings.vehicle_km_per_liter} km/L e combustível a R$ {Number(settings.fuel_price || 0).toFixed(2)}/L</span>
                  </div>
                </div>

                <div className="text-right self-end sm:self-auto">
                  <span className="text-lg sm:text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                    R$ {costPer100Km.toFixed(2)} / 100km
                  </span>
                </div>
              </div>

            </CardContent>
          </Card>
        )}

        {/* SECTION 4: PIZZARIA RULES */}
        {(activeTab === 'all' || activeTab === 'pizzaria') && (
          <Card className="border border-border/80 shadow-md rounded-3xl overflow-hidden transition-all hover:border-indigo-500/30">
            <CardHeader className="bg-gradient-to-r from-card via-card to-muted/30 border-b border-border/60 p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <Pizza className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-black tracking-tight">Regras do Pagamento de Pizzaria & Diárias</CardTitle>
                  <CardDescription className="text-xs">
                    Defina o valor da diária base, limite de entregas inclusas e taxas adicionais para acerto automático.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Entregas na Diária Base (Mínimo)
                  </label>
                  <Input
                    type="number"
                    name="pizzaria_base_deliveries"
                    value={settings.pizzaria_base_deliveries}
                    onChange={handleChange}
                    className="h-11 rounded-xl font-bold border-border bg-background"
                  />
                  <span className="text-[11px] text-muted-foreground">Quantidade de entregas cobertas pela diária base</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Valor da Diária Base (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    name="pizzaria_base_rate"
                    value={settings.pizzaria_base_rate}
                    onChange={handleChange}
                    className="h-11 rounded-xl font-bold border-border bg-background"
                  />
                  <span className="text-[11px] text-muted-foreground">Pago ao realizar até o limite de entregas base</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Valor da Diária Acima da Base (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    name="pizzaria_daily_rate_above_base"
                    value={settings.pizzaria_daily_rate_above_base}
                    onChange={handleChange}
                    className="h-11 rounded-xl font-bold border-border bg-background"
                  />
                  <span className="text-[11px] text-muted-foreground">Diária garantida ao ultrapassar a quantidade base</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Valor Adicional por Entrega Extra (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    name="pizzaria_delivery_rate"
                    value={settings.pizzaria_delivery_rate}
                    onChange={handleChange}
                    className="h-11 rounded-xl font-bold border-border bg-background"
                  />
                  <span className="text-[11px] text-muted-foreground">Valor pago por cada entrega excedente</span>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                    Taxa Adicional para Entrega Fora do Bairro / Bairro Distante (R$)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    name="pizzaria_out_of_neighborhood_rate"
                    value={settings.pizzaria_out_of_neighborhood_rate}
                    onChange={handleChange}
                    className="h-11 rounded-xl font-bold border-border bg-background"
                  />
                </div>

              </div>

              {/* Pizzaria Simulation Banner */}
              <div className="bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                    <Pizza className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase text-rose-700 dark:text-rose-300 block">Simulação de Acerto ({pizzariaSimulatedDeliveries} entregas)</span>
                    <span className="text-[11px] text-muted-foreground">Diária base (R$ {settings.pizzaria_daily_rate_above_base}) + {pizzariaExtraCount} extras × R$ {settings.pizzaria_delivery_rate}</span>
                  </div>
                </div>

                <div className="text-right self-end sm:self-auto">
                  <span className="text-lg sm:text-xl font-black font-mono text-rose-600 dark:text-rose-400">
                    R$ {pizzariaTotalSimulated.toFixed(2)}
                  </span>
                </div>
              </div>

            </CardContent>
          </Card>
        )}

        {/* SECTION 5: FINANCIAL & INVESTMENT DEFAULT RESERVE */}
        {(activeTab === 'all' || activeTab === 'financial') && (
          <Card className="border border-border/80 shadow-md rounded-3xl overflow-hidden transition-all hover:border-indigo-500/30">
            <CardHeader className="bg-gradient-to-r from-card via-card to-muted/30 border-b border-border/60 p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-black tracking-tight">Banca Inicial & Reservas de Investimento</CardTitle>
                  <CardDescription className="text-xs">
                    Ajuste seu saldo inicial e vincule sua reserva preferida para aportes e proventos.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-500" /> Saldo Inicial (Banca Principal)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    name="initial_balance"
                    placeholder="0.00"
                    value={settings.initial_balance || ''}
                    onChange={handleChange}
                    className="h-11 rounded-xl font-bold border-border bg-background"
                  />
                  <span className="text-[11px] text-muted-foreground">Valor de partida da sua banca para relatórios globais de caixa</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <PiggyBank className="w-3.5 h-3.5 text-blue-500" /> Reserva Padrão para Investimentos
                  </label>
                  <select
                    name="default_investment_reserve_id"
                    value={settings.default_investment_reserve_id || ''}
                    onChange={(e) => setSettings({ ...settings, default_investment_reserve_id: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl h-11 px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Nenhuma (Usar Saldo da Banca Principal)</option>
                    {(reserves || []).map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} (Saldo: R$ {Number(r.saldo_atual || 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-muted-foreground">De onde saem os aportes de FIIs e Ações</span>
                </div>

              </div>

              {/* SEÇÃO PROVEDOR DE COTAÇÕES (AÇÕES & FIIS) */}
              <div className="pt-4 border-t border-border/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-500" /> Provedor de Cotações da B3 (Ações, FIIs, BDRs, ETFs)
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Arquitetura híbrida e tolerante a falhas com suporte nativo e em tempo real para Ações e Fundos Imobiliários.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      Provedor de Dados do Mercado
                    </label>
                    <select
                      value={settings.quote_provider || 'auto'}
                      onChange={(e) => setSettings({ ...settings, quote_provider: e.target.value as any })}
                      className="w-full bg-background border border-border rounded-xl h-11 px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="auto">⚡ Multi-Fonte Automático (Recomendado - Ações & FIIs)</option>
                      <option value="yahoo">Yahoo Finance B3 (Nativo Completo)</option>
                      <option value="mfinance">mFinance (Especialista em FIIs & Ações)</option>
                      <option value="brapi">Brapi API (Requer Token para FIIs)</option>
                      <option value="hgbrasil">HG Brasil Finance</option>
                    </select>
                    <span className="text-[10px] text-muted-foreground">
                      O modo <strong>Multi-Fonte</strong> busca dados sem bloqueio de CORS pelo servidor e alterna fontes automaticamente se alguma estiver fora do ar.
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-amber-500" /> Token Brapi.dev (Opcional)
                      </span>
                      <span className="text-[10px] text-muted-foreground">Opcional</span>
                    </label>
                    <Input
                      type="text"
                      name="brapi_token"
                      placeholder="Ex: token_exemplo_brapi..."
                      value={settings.brapi_token || ''}
                      onChange={handleChange}
                      className="h-11 rounded-xl font-mono text-xs border-border bg-background"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      Caso possua chave da Brapi, insira aqui para limites maiores.
                    </span>
                  </div>
                </div>

                {/* Instant Quote Tester in Profile */}
                <div className="bg-muted/40 p-4 rounded-2xl border border-border/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-black text-foreground block">
                        Teste Rápido de Cotações (Ações & FIIs)
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Verifique em tempo real a resposta das cotações para ativos como PETR4, MXRF11, HGLG11 e VALE3.
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleTestQuotesInProfile()}
                      disabled={testingProfileQuote}
                      className="h-9 px-4 rounded-xl text-xs font-bold bg-background border-border text-foreground hover:bg-muted cursor-pointer shrink-0"
                    >
                      {testingProfileQuote ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500 mr-1.5" />
                      )}
                      {testingProfileQuote ? 'Testando...' : 'Testar Cotação Agora'}
                    </Button>
                  </div>

                  {/* Results preview */}
                  {profileQuoteTestResult && (
                    <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-[11px] font-bold text-muted-foreground">
                        Fonte: <strong className="text-foreground">{profileQuoteTestResult.providerUsed}</strong> ({profileQuoteTestResult.durationMs}ms)
                      </span>
                      <div className="flex flex-wrap gap-1.5 ml-auto">
                        {profileQuoteTestResult.details.map((d) => (
                          <span
                            key={d.ticker}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black border flex items-center gap-1.5 ${
                              d.price > 0
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            }`}
                          >
                            <span>{d.ticker}:</span>
                            <span>{d.price > 0 ? `R$ ${d.price.toFixed(2)}` : 'Erro'}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </CardContent>
          </Card>
        )}

        {/* SECTION 6: DEBUG & DIAGNOSTICS */}
        <Card className="border border-indigo-500/25 bg-gradient-to-br from-card via-card to-indigo-500/5 shadow-md rounded-3xl overflow-hidden transition-all hover:border-indigo-500/40">
          <CardHeader className="p-5 sm:p-6 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                  <Bug className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-black tracking-tight">Ferramentas de Desenvolvedor & Debug</CardTitle>
                  <CardDescription className="text-xs">
                    Inspecione logs do console em tempo real, erros de rede, testes de cotações e diagnóstico do banco de dados.
                  </CardDescription>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setIsDebugModalOpen(true)}
                className="h-11 px-5 rounded-2xl font-extrabold text-xs uppercase tracking-wider bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0"
              >
                <Terminal className="w-4 h-4 text-emerald-400" />
                Abrir Console de Debug
              </Button>
            </div>
          </CardHeader>
        </Card>

      </div>

      {/* GLOBAL STICKY SAVE BAR (FIXED POSITIONING, Z-INDEX & DIRTY FORM CHECK) */}
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-2xl bg-slate-950/95 dark:bg-slate-900/95 text-white backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-3 sm:p-3.5 shadow-2xl flex items-center justify-between gap-3 transition-all animate-in slide-in-from-bottom duration-300">
        
        {/* Status indicator */}
        <div className="flex items-center gap-2.5 pl-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            isDirty ? 'bg-amber-400 animate-pulse ring-4 ring-amber-400/20' : 'bg-emerald-400'
          }`} />
          <div className="min-w-0">
            <span className="text-xs font-black text-white block truncate">
              {isDirty ? 'Alterações não salvas' : 'Tudo salvo'}
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:block truncate">
              {isDirty ? 'Clique em salvar para persistir os novos ajustes' : 'Configurações sincronizadas com a nuvem'}
            </span>
          </div>
        </div>

        {/* Buttons Group */}
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDiscardChanges}
              disabled={savingSettings}
              className="h-10 px-3.5 rounded-xl font-bold text-xs border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer flex items-center gap-1.5"
              title="Reverter para o estado original"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descartar</span>
            </Button>
          )}

          <Button 
            onClick={handleSaveSettings} 
            disabled={!isDirty || savingSettings}
            className={`h-10 px-5 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center gap-2 ${
              isDirty 
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white ring-2 ring-indigo-400/30'
                : 'bg-slate-800/80 text-slate-400 cursor-not-allowed opacity-75'
            }`}
          >
            {savingSettings ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isDirty ? (
              <Save className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            {savingSettings ? 'Salvando...' : isDirty ? 'Salvar Alterações' : 'Tudo Salvo'}
          </Button>
        </div>

      </div>

      {/* MODALS FOR CATEGORY ACTIONS */}
      <Dialog open={!!deleteCategoryConfirm} onOpenChange={(val) => !val && setDeleteCategoryConfirm(null)}>
        <DialogContent className="rounded-3xl max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-600">
              <X className="w-5 h-5" /> Excluir Categoria?
            </DialogTitle>
            <DialogDescription className="text-xs space-y-3 pt-2">
              {deleteCategoryConfirm && (
                <>
                  <p>Você está prestes a excluir a categoria <strong>{deleteCategoryConfirm.name}</strong>.</p>
                  {transactions.filter(t => t.category === deleteCategoryConfirm.name).length > 0 ? (
                    <p className="text-rose-500 font-bold bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20">
                      Atenção: Existem {transactions.filter(t => t.category === deleteCategoryConfirm.name).length} lançamentos usando esta categoria! Eles serão automaticamente reatribuídos para 'Outros'.
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Nenhum lançamento será afetado por esta exclusão.</p>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button variant="outline" className="rounded-xl text-xs font-bold cursor-pointer" onClick={() => setDeleteCategoryConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" className="rounded-xl text-xs font-bold cursor-pointer" onClick={performDeleteCategory}>Confirmar Exclusão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCategoryData} onOpenChange={(val) => !val && setEditCategoryData(null)}>
        <DialogContent className="rounded-3xl max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-500" /> Renomear Categoria
            </DialogTitle>
            <DialogDescription className="text-xs space-y-3 pt-2">
              {editCategoryData && (
                <>
                  <p>Insira o novo nome para a categoria <strong>{editCategoryData.oldName}</strong>.</p>
                  <Input 
                    autoFocus
                    value={editCategoryData.newName}
                    onChange={(e) => setEditCategoryData({ ...editCategoryData, newName: e.target.value })}
                    placeholder="Novo nome"
                    className="h-11 rounded-xl font-bold text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && performEditCategory()}
                  />
                  {transactions.filter(t => t.category === editCategoryData.oldName).length > 0 && editCategoryData.newName.trim() !== editCategoryData.oldName && (
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold text-xs bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20">
                      {transactions.filter(t => t.category === editCategoryData.oldName).length} lançamentos atuais serão atualizados para o novo nome.
                    </p>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button variant="outline" className="rounded-xl text-xs font-bold cursor-pointer" onClick={() => setEditCategoryData(null)}>Cancelar</Button>
            <Button className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer" onClick={performEditCategory}>Salvar Nome</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="text-center text-xs text-muted-foreground pt-4">
        MotoGestão v1.2.0 • Sistema Financeiro de Alta Performance
      </div>

      {/* DEBUG CONSOLE MODAL */}
      <DebugConsoleModal 
        open={isDebugModalOpen} 
        onOpenChange={setIsDebugModalOpen} 
      />
    </div>
  );
}
