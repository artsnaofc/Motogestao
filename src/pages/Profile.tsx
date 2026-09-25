import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserSettings } from '../types';
import { toast } from '@/lib/toast';
import { cacheManager } from '../lib/cacheManager';
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
  ChevronRight,
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
  RotateCcw,
  AlertCircle,
  Key,
  CarFront,
  Fingerprint,
  Smartphone,
  Lock,
  CheckCircle
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useVehicles } from '../contexts/VehiclesContext';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_VEHICLE_CATEGORIES } from '../lib/vehicleUtils';
import { executeQuoteFetch, QuoteProvider, QuoteFetchResult } from '../lib/quoteService';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  BiometricSettings,
  detectBiometricLabel,
  getBiometricSettings,
  saveBiometricSettings,
  registerBiometrics,
  removeBiometricsFromDevice,
  isPlatformAuthenticatorAvailable,
  isBiometricsConfiguredOnDevice,
  authenticateWithBiometrics,
  getFriendlyDeviceName
} from '../lib/biometrics';

interface SettingsSnapshot {
  settings: UserSettings;
  personalCategories: string[];
  operationalCategories: string[];
  incomeCategories: string[];
  categoriesWithKm: string[];
  vehicleCategories: string[];
  categoryIcons: Record<string, string>;
}

export function Profile() {
  const navigate = useNavigate();
  const { settings: globalSettings, refreshData, loading: dataLoading, transactions, reserves } = useData();
  const { vehicles, activeVehicle, setActiveVehicle } = useVehicles();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingAuth, setSavingAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'security' | 'account' | 'categories' | 'vehicle' | 'pizzaria' | 'financial'>('all');
  
  // Biometrics states
  const [bioSupported, setBioSupported] = useState(false);
  const [bioConfigured, setBioConfigured] = useState(false);
  const [bioSettings, setBioSettings] = useState<BiometricSettings>({
    enabled: false,
    autoLockMinutes: 5,
  });
  const [bioLabel, setBioLabel] = useState({ name: 'Biometria', type: 'generic' as 'face' | 'fingerprint' | 'generic' });
  const [enrollingBio, setEnrollingBio] = useState(false);
  const [testingBio, setTestingBio] = useState(false);

  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<{type: 'income' | 'personal' | 'operational', name: string} | null>(null);
  const [editCategoryData, setEditCategoryData] = useState<{type: 'income' | 'personal' | 'operational', oldName: string, newName: string} | null>(null);
  
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
    brapi_token: '',
    quote_provider: 'auto',
  });

  const [personalCategories, setPersonalCategories] = useState<string[]>([]);
  const [operationalCategories, setOperationalCategories] = useState<string[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
  const [categoriesWithKm, setCategoriesWithKm] = useState<string[]>([]);
  const [vehicleCategories, setVehicleCategories] = useState<string[]>(DEFAULT_VEHICLE_CATEGORIES);
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

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Load auth user email in background
    supabase.auth.getUser().then(({ data }) => {
      if (isMounted && data?.user?.email) {
        setEmail(data.user.email);
      }
    }).catch(err => {
      console.warn('Could not fetch user email in Profile:', err);
    });

    if (globalSettings) {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        setSettings(globalSettings);

        const pers = globalSettings.personal_expense_categories || ['Alimentação', 'Plano de Internet', 'Equipamento', 'Outras Despesas', 'Outros'];
        const oper = globalSettings.operational_expense_categories || ['Combustível', 'Pedágio', 'Manutenção'];
        const inc = globalSettings.income_categories || [];
        const kmCats = globalSettings.categories_with_km || [];
        const vehCats = globalSettings.vehicle_categories || DEFAULT_VEHICLE_CATEGORIES;
        const icons = globalSettings.category_icons || {};

        setPersonalCategories(pers);
        setOperationalCategories(oper);
        setIncomeCategories(inc);
        setCategoriesWithKm(kmCats);
        setVehicleCategories(vehCats);
        setCategoryIcons(icons);

        setInitialSnapshot({
          settings: { ...globalSettings },
          personalCategories: [...pers],
          operationalCategories: [...oper],
          incomeCategories: [...inc],
          categoriesWithKm: [...kmCats],
          vehicleCategories: [...vehCats],
          categoryIcons: { ...icons },
        });
      }
      setLoading(false);
    } else if (!dataLoading) {
      // If data loading is completed and no settings exist, stop loading
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
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
      s1.active_vehicle_id !== s0.active_vehicle_id ||
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
    if (JSON.stringify(vehicleCategories) !== JSON.stringify(initialSnapshot.vehicleCategories)) return true;
    if (JSON.stringify(categoryIcons) !== JSON.stringify(initialSnapshot.categoryIcons)) return true;

    return false;
  }, [
    settings,
    personalCategories,
    operationalCategories,
    incomeCategories,
    categoriesWithKm,
    vehicleCategories,
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
    setVehicleCategories([...initialSnapshot.vehicleCategories]);
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

  const toggleVehicleCategory = (cat: string) => {
    setVehicleCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleResetVehicleCategories = () => {
    setVehicleCategories([...DEFAULT_VEHICLE_CATEGORIES]);
    toast.info('Categorias de veículo restauradas para o padrão do sistema.');
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
        pizzaria_base_deliveries: Number(settings.pizzaria_base_deliveries) || 0,
        pizzaria_base_rate: Number(settings.pizzaria_base_rate) || 0,
        pizzaria_daily_rate_above_base: Number(settings.pizzaria_daily_rate_above_base) || 0,
        pizzaria_delivery_rate: Number(settings.pizzaria_delivery_rate) || 0,
        pizzaria_out_of_neighborhood_rate: Number(settings.pizzaria_out_of_neighborhood_rate) || 0,
        vehicle_km_per_liter: Number(settings.vehicle_km_per_liter) || 0,
        fuel_price: Number(settings.fuel_price) || 0,
        weekly_goal: Number(settings.weekly_goal) || 0,
        weekly_net_goal: Number(settings.weekly_net_goal) || 0,
        default_driver_labor: Number(settings.default_driver_labor) || 0,
        initial_balance: Number(settings.initial_balance) || 0,
        brapi_token: settings.brapi_token || '',
        quote_provider: settings.quote_provider || 'auto',
        default_investment_reserve_id: settings.default_investment_reserve_id || null,
        operational_expense_categories: operationalCategories,
        personal_expense_categories: personalCategories,
        expense_categories: [...operationalCategories, ...personalCategories],
        income_categories: incomeCategories,
        categories_with_km: categoriesWithKm,
        vehicle_categories: vehicleCategories,
        active_vehicle_id: settings.active_vehicle_id || null,
        category_icons: categoryIcons,
        asset_cnpjs: settings.asset_cnpjs || {},
        rebalance_targets: settings.rebalance_targets || {},
        biometrics_enabled: bioConfigured || Boolean(globalSettings?.biometrics_enabled),
        biometrics_auto_lock_minutes: bioConfigured ? (bioSettings.autoLockMinutes ?? 0) : (globalSettings?.biometrics_auto_lock_minutes ?? 0),
        biometrics_device_info: bioConfigured ? {
          credential_id: bioSettings.credentialId || globalSettings?.biometrics_device_info?.credential_id || null,
          device_name: bioSettings.deviceName || globalSettings?.biometrics_device_info?.device_name || 'Este Dispositivo',
          last_used_at: new Date().toISOString(),
          registered_at: bioSettings.registeredAt || globalSettings?.biometrics_device_info?.registered_at || new Date().toISOString(),
          type: bioSettings.biometricType || globalSettings?.biometrics_device_info?.type || 'generic',
        } : (globalSettings?.biometrics_device_info || {}),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('user_settings').upsert(payload);

      if (error) {
        console.warn('[Profile] Supabase save warning (saving locally):', error.message);
      }
      
      // Update cache
      const localKey = `user_settings_${userData.user.id}`;
      cacheManager.set(localKey, payload, undefined, 'settings');

      if (settings.active_vehicle_id && setActiveVehicle) {
        await setActiveVehicle(settings.active_vehicle_id);
      }

      // Update snapshot
      setInitialSnapshot({
        settings: { ...settings },
        personalCategories: [...personalCategories],
        operationalCategories: [...operationalCategories],
        incomeCategories: [...incomeCategories],
        categoriesWithKm: [...categoriesWithKm],
        vehicleCategories: [...vehicleCategories],
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

  // Biometrics handlers
  useEffect(() => {
    const loadBioState = async () => {
      const label = detectBiometricLabel();
      setBioLabel(label);
      const available = await isPlatformAuthenticatorAvailable();
      setBioSupported(available);

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || globalSettings?.user_id;
      
      let conf = Boolean(isBiometricsConfiguredOnDevice(uid));
      let bs = getBiometricSettings(uid);

      // If local device didn't have it in user key, but Supabase globalSettings has biometrics_enabled
      if (!conf && globalSettings?.biometrics_enabled) {
        conf = true;
        bs = {
          enabled: true,
          autoLockMinutes: globalSettings.biometrics_auto_lock_minutes ?? 0,
          credentialId: globalSettings.biometrics_device_info?.credential_id || 'bio_synced',
          deviceName: globalSettings.biometrics_device_info?.device_name || getFriendlyDeviceName(),
          registeredAt: globalSettings.biometrics_device_info?.registered_at || new Date().toISOString(),
          lastUsedAt: globalSettings.biometrics_device_info?.last_used_at || new Date().toISOString(),
          biometricType: globalSettings.biometrics_device_info?.type || label.type,
        };
        if (uid) {
          saveBiometricSettings(uid, bs);
        }
      }

      setBioConfigured(conf);
      setBioSettings(bs);
    };

    loadBioState();
  }, [globalSettings?.user_id, globalSettings?.biometrics_enabled]);

  const handleToggleBiometrics = async () => {
    if (enrollingBio) return;
    setEnrollingBio(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id || globalSettings?.user_id || 'current_user';
      const uEmail = user?.email || email || 'usuario@financaspro.com';

      if (!bioConfigured) {
        // Enrolling biometrics
        const { data: { session } } = await supabase.auth.getSession();

        await registerBiometrics(
          {
            id: uid,
            email: uEmail,
            name: settings.full_name || undefined,
          },
          session
        );

        // Guarantee persistent enable state immediately
        saveBiometricSettings(uid, {
          enabled: true,
          autoLockMinutes: 0,
        });

        setBioConfigured(true);
        const updated = getBiometricSettings(uid);
        setBioSettings(updated);

        // Refresh DataContext in background
        refreshData(true).catch(() => {});

        toast.success(`${bioLabel.name} ativado com sucesso! O app solicitará confirmação ao abrir.`);
      } else {
        // Disabling biometrics
        await removeBiometricsFromDevice(uid);
        setBioConfigured(false);
        setBioSettings({ enabled: false, autoLockMinutes: 0 });

        refreshData(true).catch(() => {});
        toast.success('Biometria desativada deste dispositivo.');
      }
    } catch (err: any) {
      toast.error('Erro na configuração biométrica: ' + (err?.message || err));
    } finally {
      setEnrollingBio(false);
    }
  };

  const handleUpdateAutoLock = async (minutes: number) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id || globalSettings?.user_id || 'current_user';
    saveBiometricSettings(uid, { autoLockMinutes: minutes });
    setBioSettings(prev => ({ ...prev, autoLockMinutes: minutes }));
    toast.success(minutes === 0 ? 'Configurado para pedir sempre ao abrir ou alternar o app!' : 'Tempo de bloqueio automático atualizado!');
  };

  const handleTestBiometrics = async () => {
    if (testingBio) return;
    setTestingBio(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await authenticateWithBiometrics(user?.id);
      if (res.success) {
        toast.success(`Leitura biométrica confirmada com sucesso (${bioLabel.name})!`);
      } else {
        toast.error(res.error || 'Leitura não reconhecida.');
      }
    } catch (err: any) {
      toast.error('Falha no teste biométrico: ' + (err?.message || err));
    } finally {
      setTestingBio(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 w-full flex flex-col justify-center items-center py-32 space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">Carregando perfil e configurações...</p>
      </div>
    );
  }

  // Active vehicle consumption or fallback
  const activeConsumption = activeVehicle?.avg_km_per_liter || settings.vehicle_km_per_liter || 30;

  // Visual calculations for previews
  const costPer100Km = activeConsumption > 0 
    ? (100 / activeConsumption) * (settings.fuel_price || 0)
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
      
      {/* PROFILE HERO HEADER CARD - PREMIUM ARCHETYPE */}
      <div className="relative overflow-hidden bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800/80">
        {/* Subtle, premium organic blurs */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 -mb-16 w-64 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          {/* User Info Avatar & Title */}
          <div className="flex items-center gap-5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 p-[2px] shadow-lg">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-white font-mono font-black text-xl sm:text-2xl tracking-wider">
                  {userInitials || <User className="w-8 h-8 text-indigo-300" />}
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-slate-950 shadow-md flex items-center justify-center">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white truncate">
                  {settings.full_name || 'Motorista'}
                </h1>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" /> Pro Gestão
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 font-medium truncate flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                {email || 'Não informado'}
              </p>

              {/* Stats badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1.5">
                <span className="text-[10px] font-bold bg-slate-800/80 text-slate-200 border border-slate-700/60 px-2.5 py-1 rounded-lg">
                  {totalCategoriesCount} Categorias
                </span>
                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  {reserves?.length || 0} Reservas
                </span>
                <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                  Consumo: {activeConsumption} km/L
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Version */}
          <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 border-slate-800/80 pt-4 md:pt-0 gap-3 shrink-0">
            <Button 
              variant="destructive" 
              onClick={handleSignOut}
              className="h-10 px-4 rounded-xl font-extrabold text-xs uppercase tracking-wider bg-rose-500/10 hover:bg-rose-600/30 text-rose-300 border border-rose-500/20 transition-all cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </Button>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
              MotoGestão • v1.2.0
            </span>
          </div>

        </div>
      </div>

      {/* NAVIGATION TABS (PREMIUM AND TACTILE RESPONSIVE ROW) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-none snap-x">
        {[
          { id: 'all', label: 'Visão Geral', icon: Layers },
          { id: 'security', label: 'Segurança & Biometria', icon: Fingerprint },
          { id: 'account', label: 'Conta & Login', icon: User },
          { id: 'categories', label: 'Categorias', icon: Sliders },
          { id: 'vehicle', label: 'Veículo & Combustível', icon: Bike },
          { id: 'pizzaria', label: 'Pizzaria & Diárias', icon: Pizza },
          { id: 'financial', label: 'Banca & Mercado', icon: Landmark }
        ].map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 snap-center border ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10 font-extrabold'
                  : 'bg-card border-border/80 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <IconComponent className={`w-4 h-4 ${isActive ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'}`} />
              {tab.label}
              {tab.id === 'categories' && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${isActive ? 'bg-indigo-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {totalCategoriesCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* MAIN FORM SECTIONS */}
      <div className="space-y-6">

        {/* SECTION 0: VISÃO GERAL DASHBOARD */}
        {activeTab === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in duration-300">
            
            {/* CARD 0: SEGURANÇA & BIOMETRIA */}
            <div 
              onClick={() => setActiveTab('security')}
              className="group p-5 rounded-2xl border border-border/80 bg-card hover:border-indigo-500/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">Segurança & Biometria</h3>
                    <p className="text-[11px] text-muted-foreground">{bioLabel.name} e bloqueio de tela</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                <div>Status: <strong className={bioConfigured ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-amber-600 dark:text-amber-400 font-bold"}>{bioConfigured ? 'Ativo neste Aparelho' : 'Desativado'}</strong></div>
                <div className="text-right">Sensor: <strong className="text-foreground">{bioSupported ? 'Disponível' : 'Indisponível'}</strong></div>
              </div>
            </div>

            {/* CARD 1: CONTA & LOGIN */}
            <div 
              onClick={() => setActiveTab('account')}
              className="group p-5 rounded-2xl border border-border/80 bg-card hover:border-indigo-500/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">Conta & Credenciais</h3>
                    <p className="text-[11px] text-muted-foreground">Nome, email e senha de acesso</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground space-y-1">
                <div>Nome: <strong className="text-foreground">{settings.full_name || 'Não informado'}</strong></div>
                <div>Email: <strong className="text-foreground">{email}</strong></div>
              </div>
            </div>

            {/* CARD 2: CATEGORIAS */}
            <div 
              onClick={() => setActiveTab('categories')}
              className="group p-5 rounded-2xl border border-border/80 bg-card hover:border-indigo-500/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-500/20 transition-colors">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">Categorias de Lançamentos</h3>
                    <p className="text-[11px] text-muted-foreground">Personalização e regras de KM</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="pt-2 border-t border-border/50 grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="bg-emerald-500/5 p-1.5 rounded-lg border border-emerald-500/10">
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold block">Ganhos</span>
                  <strong className="text-foreground text-sm">{incomeCategories.length}</strong>
                </div>
                <div className="bg-amber-500/5 p-1.5 rounded-lg border border-amber-500/10">
                  <span className="text-amber-600 dark:text-amber-400 font-extrabold block">Operac.</span>
                  <strong className="text-foreground text-sm">{operationalCategories.length}</strong>
                </div>
                <div className="bg-rose-500/5 p-1.5 rounded-lg border border-rose-500/10">
                  <span className="text-rose-600 dark:text-rose-400 font-extrabold block">Pessoais</span>
                  <strong className="text-foreground text-sm">{personalCategories.length}</strong>
                </div>
              </div>
            </div>

            {/* CARD 3: VEÍCULO & COMBUSTÍVEL */}
            <div 
              onClick={() => setActiveTab('vehicle')}
              className="group p-5 rounded-2xl border border-border/80 bg-card hover:border-indigo-500/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">Veículo & Autonomia</h3>
                    <p className="text-[11px] text-muted-foreground">Consumo de combustível e custos por KM</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                <div>Consumo: <strong className="text-foreground">{activeConsumption} km/L</strong></div>
                <div className="text-right">R$ / 100 KM: <strong className="text-amber-600 dark:text-amber-400 font-bold">R$ {costPer100Km.toFixed(2)}</strong></div>
              </div>
            </div>

            {/* CARD 4: PIZZARIA & DIÁRIAS */}
            <div 
              onClick={() => setActiveTab('pizzaria')}
              className="group p-5 rounded-2xl border border-border/80 bg-card hover:border-indigo-500/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500/20 transition-colors">
                    <Pizza className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">Diárias & Pizzarias</h3>
                    <p className="text-[11px] text-muted-foreground">Acerto de taxas de entrega e diárias bases</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                <div>Entregas Base: <strong className="text-foreground">{settings.pizzaria_base_deliveries}</strong></div>
                <div className="text-right">Diária Base: <strong className="text-foreground">R$ {Number(settings.pizzaria_base_rate).toFixed(2)}</strong></div>
              </div>
            </div>

            {/* CARD 5: BANCA & MERCADO */}
            <div 
              onClick={() => setActiveTab('financial')}
              className="group p-5 rounded-2xl border border-border/80 bg-card hover:border-indigo-500/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">Banca & Provedor de Mercado</h3>
                    <p className="text-[11px] text-muted-foreground">Saldo inicial, reservas e cotações B3</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                <div>Saldo Inicial: <strong className="text-foreground">R$ {Number(settings.initial_balance || 0).toFixed(2)}</strong></div>
                <div className="text-right">Cotações: <strong className="text-cyan-600 dark:text-cyan-400 uppercase font-bold">{settings.quote_provider || 'auto'}</strong></div>
              </div>
            </div>

          </div>
        )}
        
        {/* SECTION -1: SECURITY & BIOMETRICS - FINTECH GRADE CARD */}
        {activeTab === 'security' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="border border-border/80 shadow-sm rounded-3xl overflow-hidden bg-card">
              <CardHeader className="border-b border-border/50 p-5 sm:p-6 bg-muted/20">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-sm">
                      <Fingerprint className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-black tracking-tight text-foreground">
                        Segurança & Autenticação Biométrica
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground pt-0.5">
                        Configure o acesso por <strong>{bioLabel.name}</strong> para entrar no sistema com 1 toque e proteger seus dados financeiros.
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 space-y-6">
                {/* 1. Device Hardware Diagnostic Banner */}
                <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                  bioSupported 
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-950 dark:text-emerald-200' 
                    : 'bg-amber-500/5 border-amber-500/20 text-amber-950 dark:text-amber-200'
                }`}>
                  <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                    bioSupported 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {bioSupported ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="font-black flex items-center gap-2">
                      <span>Status do Sensor no Navegador:</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10.5px] ${
                        bioSupported 
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
                          : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      }`}>
                        {bioSupported ? `Sensor ${bioLabel.name} Reconhecido` : 'Sensor Não Detectado'}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {bioSupported 
                        ? `Seu navegador e sistema operacional suportam autenticação biométrica via WebAuthn Platform Authenticator (${bioLabel.name}). Suas credenciais são protegidas pelo chip de segurança física do seu dispositivo (Secure Enclave / TPM / KeyStore).`
                        : 'Seu navegador atual ou sistema operacional não informou suporte à API de autenticação biométrica nativa de plataforma.'}
                    </p>
                  </div>
                </div>

                {/* 2. Main Biometric Enrollment Switch */}
                <div className="p-5 rounded-2xl bg-muted/30 border border-border/70 space-y-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="space-y-1 max-w-md">
                      <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                        <Fingerprint className="w-4 h-4 text-indigo-500" />
                        <span>Login com {bioLabel.name}</span>
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Permite autenticação instantânea na tela de login sem digitar email e senha a cada sessão.
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={handleToggleBiometrics}
                      disabled={enrollingBio || (!bioSupported && !bioConfigured)}
                      className={`h-11 px-6 rounded-2xl font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-2 ${
                        bioConfigured
                          ? 'bg-rose-500/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25'
                      }`}
                    >
                      {enrollingBio ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processando...</span>
                        </>
                      ) : bioConfigured ? (
                        <>
                          <X className="w-4 h-4" />
                          <span>Desativar neste Aparelho</span>
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-4 h-4" />
                          <span>Ativar {bioLabel.name}</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {bioConfigured && (
                    <div className="pt-3 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Dispositivo</span>
                        <strong className="text-foreground font-bold">{bioSettings.deviceName || 'Este Aparelho'}</strong>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Vinculado em</span>
                        <strong className="text-foreground font-bold">
                          {bioSettings.registeredAt 
                            ? new Date(bioSettings.registeredAt).toLocaleDateString('pt-BR') 
                            : 'Hoje'}
                        </strong>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Último Acesso</span>
                        <strong className="text-foreground font-bold">
                          {bioSettings.lastUsedAt 
                            ? new Date(bioSettings.lastUsedAt).toLocaleDateString('pt-BR') 
                            : 'Agora'}
                        </strong>
                      </div>
                    </div>
                  )}

                  {!bioConfigured && globalSettings?.biometrics_device_info?.device_name && (
                    <div className="pt-3 border-t border-border/60 flex items-center gap-2.5 text-xs text-muted-foreground bg-muted/20 p-3 rounded-xl">
                      <Smartphone className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>
                        Sua conta possui biometria cadastrada no <strong>{globalSettings.biometrics_device_info.device_name}</strong>. Para habilitar também neste aparelho de forma independente, clique em <strong>Ativar {bioLabel.name}</strong> acima.
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. App Lock & Privacy Screen Settings */}
                {bioConfigured && (
                  <div className="space-y-3">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Bloqueio Automático do App (Privacidade Financeira)</span>
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Exige leitura de {bioLabel.name} quando o aplicativo ficar em segundo plano ou inativo.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {[
                        { minutes: 0, label: 'Sempre ao abrir', desc: 'Ao abrir o app e ao alternar' },
                        { minutes: 1, label: '1 minuto', desc: 'Após 1 min em 2º plano' },
                        { minutes: 5, label: '5 minutos', desc: 'Após 5 min em 2º plano' },
                        { minutes: 15, label: '15 minutos', desc: 'Após 15 min em 2º plano' },
                        { minutes: -1, label: 'Desativado', desc: 'Apenas no login da conta' },
                      ].map((item) => {
                        const isSelected = bioSettings.autoLockMinutes === item.minutes;
                        return (
                          <button
                            key={item.minutes}
                            type="button"
                            onClick={() => handleUpdateAutoLock(item.minutes)}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                              isSelected
                                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-extrabold shadow-xs'
                                : 'bg-card border-border/70 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">{item.label}</span>
                              {isSelected && <CheckCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-medium">{item.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Sensor Diagnostic Test Action */}
                {bioConfigured && (
                  <div className="pt-2 flex items-center justify-between flex-wrap gap-3 border-t border-border/60">
                    <div className="text-xs text-muted-foreground">
                      Deseja testar se o sensor está respondendo corretamente?
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestBiometrics}
                      disabled={testingBio}
                      className="h-10 px-4 rounded-xl font-bold text-xs gap-2 border-border/80 hover:bg-muted cursor-pointer"
                    >
                      {testingBio ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Lendo sensor...</span>
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Testar Leitura de {bioLabel.name}</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* SECTION 1: ACCOUNT & CREDENTIALS - CLEAN INTUITIVE CARD */}
        {activeTab === 'account' && (
          <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden transition-all hover:border-indigo-500/20 bg-card">
            <CardHeader className="border-b border-border/50 p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black tracking-tight text-foreground">Dados da Conta & Credenciais</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Gerencie suas credenciais de acesso e informações básicas de identificação.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-6">
              <form onSubmit={handleUpdateAuth} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      Nome Completo
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 text-muted-foreground/80">
                        <User className="w-4 h-4" />
                      </div>
                      <Input
                        type="text"
                        name="full_name"
                        placeholder="Ex: Arthur Sena"
                        value={settings.full_name || ''}
                        onChange={handleChange}
                        className="h-11 pl-10 rounded-xl font-semibold border-border/80 bg-background focus-visible:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      Email de Acesso
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 text-muted-foreground/80">
                        <Mail className="w-4 h-4" />
                      </div>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seuemail@exemplo.com"
                        required
                        className="h-11 pl-10 rounded-xl font-semibold border-border/80 bg-background focus-visible:ring-indigo-500"
                      />
                    </div>
                  </div>

                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    Nova Senha de Acesso
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-muted-foreground/80">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Preencha apenas se desejar redefinir sua senha"
                      className="h-11 pl-10 pr-11 rounded-xl font-semibold border-border/80 bg-background focus-visible:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Mantenha este campo em branco se não desejar alterar sua senha atual.</p>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={savingAuth}
                    className="h-10 px-5 rounded-xl font-extrabold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer flex items-center gap-2"
                  >
                    {savingAuth ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingAuth ? 'Atualizando...' : 'Atualizar Credenciais'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* SECTION 2: CATEGORIES & ODOMETER - STELLAR MANAGEMENT CARD */}
        {activeTab === 'categories' && (
          <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden transition-all hover:border-indigo-500/20 bg-card">
            <CardHeader className="border-b border-border/50 p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black tracking-tight text-foreground">Gerenciamento de Categorias & Odômetro</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Personalize os nomes, ícones, ordem de exibição e controle quais categorias exigem campos de quilometragem.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-5 sm:p-6 space-y-8">
              
              {/* CATEGORIAS DE GANHOS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Ganhos / Entradas ({incomeCategories.length})
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                    Faturamento
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {incomeCategories.map((cat, index) => {
                    const Icon = getIconByName(categoryIcons[cat]);
                    const isProtected = ['Pizzaria', 'Frete do Dia'].includes(cat);
                    return (
                      <div key={cat} className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/60 hover:bg-muted/50 hover:border-emerald-500/25 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <Popover>
                            <PopoverTrigger className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 hover:bg-emerald-500/20 transition-colors cursor-pointer border border-emerald-500/10" title="Alterar ícone">
                              <Icon className="w-4.5 h-4.5" />
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 bg-popover border-border rounded-xl shadow-xl" align="start">
                              <span className="text-[10px] font-black uppercase text-muted-foreground block mb-2 tracking-wider">Escolher Ícone</span>
                              <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                {AVAILABLE_ICONS.map(i => {
                                  const IComp = i.icon;
                                  return (
                                    <button
                                      key={i.name}
                                      type="button"
                                      onClick={() => handleUpdateIcon(cat, i.name)}
                                      className={`p-2.5 rounded-lg flex items-center justify-center hover:bg-muted font-bold cursor-pointer transition-colors ${categoryIcons[cat] === i.name ? 'bg-emerald-500 text-white' : 'text-muted-foreground'}`}
                                    >
                                      <IComp className="w-4 h-4" />
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
 
                          <div className="min-w-0">
                            <span className="text-xs font-black text-foreground block truncate">{cat}</span>
                            {isProtected && (
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Sistema</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center border-r pr-2 border-border/80 gap-1">
                            <button 
                              type="button" 
                              onClick={() => moveCategory('income', index, 'up')} 
                              disabled={index === 0} 
                              className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-2 hover:bg-background rounded-lg cursor-pointer transition-all min-w-[32px] min-h-[32px] flex items-center justify-center"
                              title="Mover para cima"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => moveCategory('income', index, 'down')} 
                              disabled={index === incomeCategories.length - 1} 
                              className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-2 hover:bg-background rounded-lg cursor-pointer transition-all min-w-[32px] min-h-[32px] flex items-center justify-center"
                              title="Mover para baixo"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {!isProtected && (
                            <div className="flex items-center gap-1">
                              <button 
                                type="button" 
                                onClick={() => confirmEditCategory('income', cat)} 
                                className="p-2 text-muted-foreground hover:text-primary hover:bg-background rounded-lg transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center" 
                                title="Renomear Categoria"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button 
                                type="button" 
                                onClick={() => confirmRemoveCategory('income', cat)} 
                                className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center" 
                                title="Excluir Categoria"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1.5 max-w-md">
                  <Input
                    type="text"
                    className="h-10 rounded-xl text-xs font-semibold bg-background border-border/80 focus-visible:ring-emerald-500"
                    value={newIncomeCat}
                    onChange={(e) => setNewIncomeCat(e.target.value)}
                    placeholder="Nova categoria de ganho..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory('income'))}
                  />
                  <Button type="button" variant="secondary" className="h-10 rounded-xl px-4 cursor-pointer font-extrabold text-xs flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0" onClick={() => addCategory('income')}>
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </Button>
                </div>
              </div>

              {/* CATEGORIAS OPERACIONAIS */}
              <div className="space-y-4 pt-6 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Bike className="w-4 h-4" /> Despesas Operacionais / Veículo ({operationalCategories.length})
                  </span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-300 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                    Trabalho
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {operationalCategories.map((cat, index) => {
                    const Icon = getIconByName(categoryIcons[cat]);
                    const isProtected = ['Combustível', 'Manutenção', 'Pedágio'].includes(cat);
                    return (
                      <div key={cat} className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/60 hover:bg-muted/50 hover:border-amber-500/25 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <Popover>
                            <PopoverTrigger className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 hover:bg-amber-500/20 transition-colors cursor-pointer border border-amber-500/10" title="Alterar ícone">
                              <Icon className="w-4.5 h-4.5" />
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 bg-popover border-border rounded-xl shadow-xl" align="start">
                              <span className="text-[10px] font-black uppercase text-muted-foreground block mb-2 tracking-wider">Escolher Ícone</span>
                              <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                {AVAILABLE_ICONS.map(i => {
                                  const IComp = i.icon;
                                  return (
                                    <button
                                      key={i.name}
                                      type="button"
                                      onClick={() => handleUpdateIcon(cat, i.name)}
                                      className={`p-2.5 rounded-lg flex items-center justify-center hover:bg-muted font-bold cursor-pointer transition-colors ${categoryIcons[cat] === i.name ? 'bg-amber-500 text-white' : 'text-muted-foreground'}`}
                                    >
                                      <IComp className="w-4 h-4" />
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
 
                          <div className="min-w-0">
                            <span className="text-xs font-black text-foreground block truncate">{cat}</span>
                            {isProtected && (
                              <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Sistema</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center border-r pr-2 border-border/80 gap-1">
                            <button 
                              type="button" 
                              onClick={() => moveCategory('operational', index, 'up')} 
                              disabled={index === 0} 
                              className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-2 hover:bg-background rounded-lg cursor-pointer transition-all min-w-[32px] min-h-[32px] flex items-center justify-center"
                              title="Mover para cima"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => moveCategory('operational', index, 'down')} 
                              disabled={index === operationalCategories.length - 1} 
                              className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-2 hover:bg-background rounded-lg cursor-pointer transition-all min-w-[32px] min-h-[32px] flex items-center justify-center"
                              title="Mover para baixo"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {!isProtected && (
                            <div className="flex items-center gap-1">
                              <button 
                                type="button" 
                                onClick={() => confirmEditCategory('operational', cat)} 
                                className="p-2 text-muted-foreground hover:text-primary hover:bg-background rounded-lg transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center" 
                                title="Renomear Categoria"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button 
                                type="button" 
                                onClick={() => confirmRemoveCategory('operational', cat)} 
                                className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center" 
                                title="Excluir Categoria"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1.5 max-w-md">
                  <Input
                    type="text"
                    className="h-10 rounded-xl text-xs font-semibold bg-background border-border/80 focus-visible:ring-amber-500"
                    value={newOperationalCat}
                    onChange={(e) => setNewOperationalCat(e.target.value)}
                    placeholder="Nova categoria operacional..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory('operational'))}
                  />
                  <Button type="button" variant="secondary" className="h-10 rounded-xl px-4 cursor-pointer font-extrabold text-xs flex items-center gap-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-0" onClick={() => addCategory('operational')}>
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </Button>
                </div>
              </div>

              {/* CATEGORIAS PESSOAIS */}
              <div className="space-y-4 pt-6 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-2">
                    <Heart className="w-4 h-4" /> Despesas Pessoais ({personalCategories.length})
                  </span>
                  <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-300 px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                    Vida Pessoal
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {personalCategories.map((cat, index) => {
                    const Icon = getIconByName(categoryIcons[cat]);
                    return (
                      <div key={cat} className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/60 hover:bg-muted/50 hover:border-rose-500/25 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <Popover>
                            <PopoverTrigger className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 hover:bg-rose-500/20 transition-colors cursor-pointer border border-rose-500/10" title="Alterar ícone">
                              <Icon className="w-4.5 h-4.5" />
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 bg-popover border-border rounded-xl shadow-xl" align="start">
                              <span className="text-[10px] font-black uppercase text-muted-foreground block mb-2 tracking-wider">Escolher Ícone</span>
                              <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                {AVAILABLE_ICONS.map(i => {
                                  const IComp = i.icon;
                                  return (
                                    <button
                                      key={i.name}
                                      type="button"
                                      onClick={() => handleUpdateIcon(cat, i.name)}
                                      className={`p-2.5 rounded-lg flex items-center justify-center hover:bg-muted font-bold cursor-pointer transition-colors ${categoryIcons[cat] === i.name ? 'bg-rose-500 text-white' : 'text-muted-foreground'}`}
                                    >
                                      <IComp className="w-4 h-4" />
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
 
                          <div className="min-w-0">
                            <span className="text-xs font-black text-foreground block truncate">{cat}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center border-r pr-2 border-border/80 gap-1">
                            <button 
                              type="button" 
                              onClick={() => moveCategory('personal', index, 'up')} 
                              disabled={index === 0} 
                              className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-2 hover:bg-background rounded-lg cursor-pointer transition-all min-w-[32px] min-h-[32px] flex items-center justify-center"
                              title="Mover para cima"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => moveCategory('personal', index, 'down')} 
                              disabled={index === personalCategories.length - 1} 
                              className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-2 hover:bg-background rounded-lg cursor-pointer transition-all min-w-[32px] min-h-[32px] flex items-center justify-center"
                              title="Mover para baixo"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button 
                              type="button" 
                              onClick={() => confirmEditCategory('personal', cat)} 
                              className="p-2 text-muted-foreground hover:text-primary hover:bg-background rounded-lg transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center" 
                              title="Renomear Categoria"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => confirmRemoveCategory('personal', cat)} 
                              className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center" 
                              title="Excluir Categoria"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1.5 max-w-md">
                  <Input
                    type="text"
                    className="h-10 rounded-xl text-xs font-semibold bg-background border-border/80 focus-visible:ring-rose-500"
                    value={newPersonalCat}
                    onChange={(e) => setNewPersonalCat(e.target.value)}
                    placeholder="Nova categoria pessoal..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory('personal'))}
                  />
                  <Button type="button" variant="secondary" className="h-10 rounded-xl px-4 cursor-pointer font-extrabold text-xs flex items-center gap-1.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-0" onClick={() => addCategory('personal')}>
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </Button>
                </div>
              </div>

              {/* SEÇÃO ODÔMETRO (KM INICIAL E FINAL) */}
              <div className="space-y-4 pt-6 border-t border-border/50 bg-muted/20 -mx-5 -mb-5 p-5 rounded-b-2xl">
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

                <div className="flex flex-wrap gap-2 pt-1">
                  {incomeCategories.map(cat => {
                    const isActive = categoriesWithKm.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategoryKm(cat)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-extrabold'
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

        {/* SECTION 3: VEHICLE & FREIGHT SETTINGS - SLEEK DASHBOARD ARCHETYPE */}
        {activeTab === 'vehicle' && (
          <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden transition-all hover:border-indigo-500/20 bg-card">
            <CardHeader className="border-b border-border/50 p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black tracking-tight text-foreground">Veículo & Parâmetros de Combustível</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    O consumo médio é configurado individualmente na Garagem para cada veículo. Aqui você define o preço de referência do combustível.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Consumo Médio - Configuração Individual na Garagem */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Fuel className="w-4 h-4 text-amber-500" />
                        Consumo Médio do Veículo
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        Configurado na Garagem
                      </span>
                    </div>
                    
                    {activeVehicle ? (
                      <div className="p-3 bg-card rounded-xl border border-border/60 space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-xs font-black text-foreground">
                            {activeVehicle.nickname || `${activeVehicle.brand} ${activeVehicle.model}`}
                          </strong>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold px-2 py-0.5 rounded-full">
                            Veículo Ativo
                          </span>
                        </div>
                        {activeVehicle.nickname && (
                          <span className="text-[11px] text-muted-foreground block">
                            {activeVehicle.brand} {activeVehicle.model} {activeVehicle.plate ? `• ${activeVehicle.plate}` : ''}
                          </span>
                        )}
                        <div className="text-xs text-muted-foreground pt-1 flex items-center justify-between">
                          <span>Consumo cadastrado:</span>
                          <strong className="text-sm font-black text-amber-600 dark:text-amber-400">
                            {activeVehicle.avg_km_per_liter || 30} km/L
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-card rounded-xl border border-border/60 text-xs text-muted-foreground">
                        Nenhum veículo ativo definido. Acesse a Garagem para cadastrar e definir o consumo da sua moto.
                      </div>
                    )}

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Cada veículo possui seu próprio consumo médio para garantir cálculos exatos de custo por KM, autonomia e abastecimentos.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(activeVehicle ? `/vehicles/${activeVehicle.id}` : '/vehicles')}
                    className="w-full h-10 rounded-xl text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    <Bike className="w-4 h-4" />
                    <span>{activeVehicle ? 'Ajustar Consumo na Garagem' : 'Acessar Garagem'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Preço do Litro */}
                <div className="space-y-3 flex flex-col justify-between p-4 rounded-2xl bg-card border border-border/80">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      Preço de Referência do Combustível
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 text-xs font-black text-muted-foreground">
                        R$
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        name="fuel_price"
                        value={settings.fuel_price}
                        onChange={handleChange}
                        className="h-11 pl-10 pr-12 rounded-xl font-mono font-bold border-border/80 bg-background focus-visible:ring-indigo-500"
                      />
                      <div className="absolute right-3.5 text-xs font-bold text-muted-foreground">
                        / L
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground block">
                      Preço médio pago por litro para cálculo automático de autonomia e custos operacionais por KM.
                    </span>
                  </div>

                  {/* Preset buttons for common prices */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Atalhos Rápidos de Preço:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {[5.49, 5.79, 5.99, 6.29].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setSettings({ ...settings, fuel_price: val })}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                            settings.fuel_price === val 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                              : 'bg-muted/40 border-border/80 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          R$ {val.toFixed(2)}/L
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* Vehicle Cost Preview Banner - Aesthetic and Clean */}
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-lg shrink-0">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-300 block tracking-wider">
                      Custo Estimado por 100 KM ({activeVehicle?.nickname || activeVehicle?.model || 'Veículo Ativo'})
                    </span>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Consumo da moto: {activeConsumption} km/L • Combustível: R$ {Number(settings.fuel_price || 0).toFixed(2)}/L
                    </span>
                  </div>
                </div>

                <div className="text-right self-end sm:self-auto shrink-0">
                  <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3.5 py-1.5 rounded-xl border border-amber-500/20">
                    R$ {costPer100Km.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* SEÇÃO 1: VEÍCULO PADRÃO DO SISTEMA */}
              <div className="space-y-4 pt-6 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-foreground block flex items-center gap-2">
                      <CarFront className="w-4 h-4 text-primary" /> Veículo Padrão (Padrão para Novos Lançamentos)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      O veículo selecionado será preenchido automaticamente ao criar novos ganhos ou despesas veiculares.
                    </span>
                  </div>
                </div>

                {vehicles && vehicles.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                    {/* Opção Nenhum Veículo Automático */}
                    <button
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, active_vehicle_id: '' }))}
                      className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        !settings.active_vehicle_id
                          ? 'bg-primary/10 border-primary text-foreground shadow-xs ring-1 ring-primary'
                          : 'bg-card text-muted-foreground border-border hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-black text-foreground">Sem Veículo Padrão</span>
                        {!settings.active_vehicle_id && (
                          <span className="text-[9px] font-black uppercase bg-primary text-primary-foreground px-2 py-0.5 rounded-md">
                            Selecionado
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Exige selecionar o veículo manualmente a cada lançamento ou deixar em branco.
                      </p>
                    </button>

                    {/* Lista de Veículos Cadastrados */}
                    {vehicles.map((v) => {
                      const isSelected = settings.active_vehicle_id === v.id || (!settings.active_vehicle_id && v.is_active);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSettings(prev => ({ ...prev, active_vehicle_id: v.id }))}
                          className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'bg-primary/10 border-primary text-foreground shadow-xs ring-1 ring-primary'
                              : 'bg-card text-muted-foreground border-border hover:bg-muted/60'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                <Car className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-black text-foreground">{v.brand} {v.model}</span>
                            </div>
                            {isSelected && (
                              <span className="text-[9px] font-black uppercase bg-primary text-primary-foreground px-2 py-0.5 rounded-md">
                                Padrão
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center justify-between font-mono">
                            <span className="font-bold text-foreground">{v.plate || 'Sem Placa'}</span>
                            <span>{v.year_model ? `${v.year_model} • ` : ''}{v.fuel_type || 'Flex'}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Você ainda não cadastrou veículos no sistema.
                    </p>
                  </div>
                )}
              </div>

              {/* SEÇÃO 2: CATEGORIAS COM SELEÇÃO DE VEÍCULO */}
              <div className="space-y-4 pt-6 border-t border-border/50 bg-muted/20 -mx-5 -mb-5 p-5 rounded-b-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-foreground block flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-primary" /> Categorias que Utilizam Veículo
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Selecione em quais categorias o campo de seleção de veículo deve aparecer logo abaixo do valor.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetVehicleCategories}
                    className="text-[10px] font-extrabold text-primary hover:underline self-start sm:self-auto flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Restaurar Padrões
                  </button>
                </div>

                {/* Nota explicativa sobre a regra da categoria Trabalho */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5 text-blue-900 dark:text-blue-200">
                  <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Regra Especial:</strong> Na categoria <strong>Trabalho</strong>, a seleção de veículo é opcional e vem desmarcada por padrão no formulário para não poluir os lançamentos comuns. Em resgates de reserva associados a despesas veiculares, o seletor também é exibido.
                  </p>
                </div>

                {/* Grid com todas as categorias disponíveis no sistema */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Ganhos & Entradas
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set([...incomeCategories, 'Frete do Dia', 'Pizzaria', 'Uber', 'Trabalho'])).map(cat => {
                        const isActive = vehicleCategories.includes(cat);
                        return (
                          <button
                            key={`veh-inc-${cat}`}
                            type="button"
                            onClick={() => toggleVehicleCategory(cat)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              isActive
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-extrabold'
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

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Despesas Operacionais & Gerais
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set([...operationalCategories, ...personalCategories, 'Combustível', 'Manutenção', 'Pedágio'])).map(cat => {
                        const isActive = vehicleCategories.includes(cat);
                        return (
                          <button
                            key={`veh-exp-${cat}`}
                            type="button"
                            onClick={() => toggleVehicleCategory(cat)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              isActive
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-extrabold'
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
                </div>
              </div>

            </CardContent>
          </Card>
        )}

        {/* SECTION 4: PIZZARIA RULES - PROFESSIONAL DRIVER SETTINGS */}
        {activeTab === 'pizzaria' && (
          <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden transition-all hover:border-indigo-500/20 bg-card">
            <CardHeader className="border-b border-border-50 p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10">
                  <Pizza className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black tracking-tight text-foreground">Acerto de Diárias & Pizzarias</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Defina taxas básicas, quantidade mínima de entregas cobertas e valores adicionais por entrega extra.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Entregas na Diária Base (Mínimo)
                  </label>
                  <div className="relative flex items-center">
                    <Input
                      type="number"
                      name="pizzaria_base_deliveries"
                      value={settings.pizzaria_base_deliveries}
                      onChange={handleChange}
                      className="h-11 pr-24 rounded-xl font-mono font-bold border-border/80 bg-background focus-visible:ring-indigo-500"
                    />
                    <div className="absolute right-3.5 text-[10px] font-black uppercase text-muted-foreground">
                      Entregas
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground block">Quantidade mínima inclusa no valor da diária básica</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Valor da Diária Base
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-xs font-black text-muted-foreground">
                      R$
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      name="pizzaria_base_rate"
                      value={settings.pizzaria_base_rate}
                      onChange={handleChange}
                      className="h-11 pl-10 rounded-xl font-mono font-bold border-border/80 bg-background focus-visible:ring-indigo-500"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground block">Valor fixo pago por fazer até o número mínimo de entregas</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Valor da Diária Acima da Base
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-xs font-black text-muted-foreground">
                      R$
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      name="pizzaria_daily_rate_above_base"
                      value={settings.pizzaria_daily_rate_above_base}
                      onChange={handleChange}
                      className="h-11 pl-10 rounded-xl font-mono font-bold border-border/80 bg-background focus-visible:ring-indigo-500"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground block">Diária mínima garantida caso ultrapasse as entregas base</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Adicional por Entrega Extra
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-xs font-black text-muted-foreground">
                      R$
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      name="pizzaria_delivery_rate"
                      value={settings.pizzaria_delivery_rate}
                      onChange={handleChange}
                      className="h-11 pl-10 pr-16 rounded-xl font-mono font-bold border-border/80 bg-background focus-visible:ring-indigo-500"
                    />
                    <div className="absolute right-3.5 text-[10px] font-black uppercase text-muted-foreground">
                      / Extra
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground block">Valor pago a cada entrega excedente realizada</span>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Adicional por Entrega Fora do Bairro (Bairro Distante)
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-xs font-black text-muted-foreground">
                      R$
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      name="pizzaria_out_of_neighborhood_rate"
                      value={settings.pizzaria_out_of_neighborhood_rate}
                      onChange={handleChange}
                      className="h-11 pl-10 rounded-xl font-mono font-bold border-border/80 bg-background focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>

              </div>

              {/* Pizzaria Simulation Banner - Aesthetic and Clean */}
              <div className="bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-lg shrink-0">
                    <Pizza className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase text-rose-700 dark:text-rose-300 block tracking-wider">Simulação do Acerto da Pizzaria</span>
                    <span className="text-[11px] text-muted-foreground font-medium">Considerando {pizzariaSimulatedDeliveries} entregas ({pizzariaExtraCount} extras) • Taxa Base: R$ {Number(settings.pizzaria_daily_rate_above_base || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-right self-end sm:self-auto shrink-0">
                  <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 bg-rose-500/10 px-3.5 py-1.5 rounded-xl border border-rose-500/20">
                    R$ {pizzariaTotalSimulated.toFixed(2)}
                  </span>
                </div>
              </div>

            </CardContent>
          </Card>
        )}

        {/* SECTION 5: FINANCIAL & INVESTMENT DEFAULT RESERVE - WEALTH MANAGEMENT */}
        {activeTab === 'financial' && (
          <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden transition-all hover:border-indigo-500/20 bg-card">
            <CardHeader className="border-b border-border/50 p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/10">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black tracking-tight text-foreground">Banca & Reservas de Investimento</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Ajuste o seu saldo inicial principal e configure a integração com reservas de investimento e provedores de cotações B3.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Saldo Inicial */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    Saldo Inicial (Banca Principal)
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-xs font-black text-muted-foreground">
                      R$
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      name="initial_balance"
                      placeholder="0.00"
                      value={settings.initial_balance ?? ''}
                      onChange={handleChange}
                      className="h-11 pl-10 rounded-xl font-mono font-bold border-border/80 bg-background focus-visible:ring-indigo-500"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground block">Balanço de partida para relatórios globais de caixa</span>
                </div>

                {/* Reserva Padrão */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    Reserva de Ativos Padrão
                  </label>
                  <div className="relative flex items-center">
                    <select
                      name="default_investment_reserve_id"
                      value={settings.default_investment_reserve_id || ''}
                      onChange={(e) => setSettings({ ...settings, default_investment_reserve_id: e.target.value })}
                      className="w-full bg-background border border-border/80 rounded-xl h-11 px-3 py-2 text-xs font-extrabold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none"
                    >
                      <option value="">Nenhuma (Usar Saldo da Banca Principal)</option>
                      {(reserves || []).map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} (Saldo: R$ {Number(r.saldo_atual || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 pointer-events-none text-muted-foreground">
                      <PiggyBank className="w-4 h-4 text-blue-500" />
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground block">Origem de recursos automática para aportes e proventos de investimentos</span>
                </div>

              </div>

              {/* SEÇÃO PROVEDOR DE COTAÇÕES (AÇÕES & FIIS) */}
              <div className="pt-6 border-t border-border/50 space-y-5">
                <div className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-500" /> Provedor de Cotações da B3
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Arquitetura tolerante a falhas com suporte em tempo real para ações, fundos imobiliários, BDRs e ETFs brasileiras.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Provedor Ativo
                    </label>
                    <div className="relative flex items-center">
                      <select
                        value={settings.quote_provider || 'auto'}
                        onChange={(e) => setSettings({ ...settings, quote_provider: e.target.value as any })}
                        className="w-full bg-background border border-border/80 rounded-xl h-11 px-3 py-2 text-xs font-extrabold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none"
                      >
                        <option value="auto">⚡ Multi-Fonte Automático (Recomendado)</option>
                        <option value="yahoo">Yahoo Finance B3 (Nativo Completo)</option>
                        <option value="mfinance">mFinance (Ações & FIIs)</option>
                        <option value="brapi">Brapi API (Requer Token para FIIs)</option>
                        <option value="hgbrasil">HG Brasil Finance</option>
                      </select>
                    </div>
                    <span className="text-[10px] text-muted-foreground block">
                      O modo <strong>Multi-Fonte</strong> busca dados sem bloqueio de CORS pelo servidor e alterna fontes automaticamente se alguma estiver fora do ar.
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Token Brapi.dev</span>
                      <span className="text-[10px] text-muted-foreground font-normal lowercase tracking-normal">Opcional</span>
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 text-muted-foreground">
                        <Key className="w-4 h-4 text-amber-500" />
                      </div>
                      <Input
                        type="text"
                        name="brapi_token"
                        placeholder="Ex: token_exemplo_brapi..."
                        value={settings.brapi_token || ''}
                        onChange={handleChange}
                        className="h-11 pl-10 rounded-xl font-mono text-xs border-border/80 bg-background focus-visible:ring-indigo-500"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground block">
                      Caso possua chave da Brapi, insira aqui para limites maiores de requisições.
                    </span>
                  </div>
                </div>

                {/* Instant Quote Tester in Profile */}
                <div className="bg-muted/40 p-4.5 rounded-xl border border-border/60 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-black text-foreground block">
                        Teste Rápido de Conectividade
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        Verifique em tempo real as respostas das cotações de ativos simulados (PETR4, MXRF11, HGLG11, VALE3).
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleTestQuotesInProfile()}
                      disabled={testingProfileQuote}
                      className="h-10 px-4 rounded-xl text-xs font-bold bg-background border-border text-foreground hover:bg-muted cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      {testingProfileQuote ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      )}
                      {testingProfileQuote ? 'Testando...' : 'Testar Agora'}
                    </Button>
                  </div>

                  {/* Results preview */}
                  {profileQuoteTestResult && (
                    <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <span className="text-[11px] font-bold text-muted-foreground">
                        Fonte utilizada: <strong className="text-foreground">{profileQuoteTestResult.providerUsed}</strong> ({profileQuoteTestResult.durationMs}ms)
                      </span>
                      <div className="flex flex-wrap gap-1.5 sm:ml-auto">
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

      </div>

      {/* GLOBAL STICKY SAVE BAR (FIXED POSITIONING, Z-INDEX & DIRTY FORM CHECK) */}
      {isDirty && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-2xl bg-slate-950/95 dark:bg-slate-900/95 text-white backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-3 sm:p-3.5 shadow-2xl flex items-center justify-between gap-3 transition-all animate-in slide-in-from-bottom duration-300">
          
          {/* Status indicator */}
          <div className="flex items-center gap-2.5 pl-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-amber-400 animate-pulse ring-4 ring-amber-400/20" />
            <div className="min-w-0">
              <span className="text-xs font-black text-white block truncate">
                Alterações não salvas
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:block truncate">
                Clique em salvar para persistir os novos ajustes
              </span>
            </div>
          </div>

          {/* Buttons Group */}
          <div className="flex items-center gap-2 shrink-0">
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

            <Button 
              onClick={handleSaveSettings} 
              disabled={savingSettings}
              className="h-10 px-5 rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white ring-2 ring-indigo-400/30"
            >
              {savingSettings ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {savingSettings ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>

        </div>
      )}

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
    </div>
  );
}
