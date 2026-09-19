import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { cacheManager } from '../lib/cacheManager';
import { syncQueueManager } from '../lib/syncQueue';
import { toast } from '../lib/toast';
import {
  Vehicle,
  VehicleFipeHistory,
  VehicleOdometerLog,
  VehicleMaintenanceRecord,
  Transaction,
  ReserveTransaction,
} from '../types';

export interface VehicleCategoryCostBreakdown {
  category: string;
  total: number;
}

export interface VehicleMetrics {
  vehicleId: string;
  totalIncome: number;
  totalCost: number;
  netProfit: number;
  marginPercent: number;
  fuelCost: number;
  maintenanceCost: number;
  tiresCost: number;
  oilCost: number;
  insuranceCost: number;
  taxCost: number;
  otherCost: number;
  categoryBreakdown: VehicleCategoryCostBreakdown[];
  totalKmRecorded: number;
  totalLiters: number;
  realizedKmPerLiter: number;
  costPerKm: number;
  fuelCostPerKm: number;
  revenuePerKm: number;
  profitPerKm: number;
  acquisitionValue: number;
  fipeValue: number;
  valueDifference: number; // FIPE - Acquisition
  percentageVariation: number;
  upcomingMaintenances: VehicleMaintenanceRecord[];
  overdueMaintenances: VehicleMaintenanceRecord[];
}

interface VehiclesContextType {
  vehicles: Vehicle[];
  activeVehicle: Vehicle | null;
  odometerLogs: Record<string, VehicleOdometerLog[]>;
  maintenanceRecords: Record<string, VehicleMaintenanceRecord[]>;
  fipeHistory: Record<string, VehicleFipeHistory[]>;
  isLoadingVehicles: boolean;

  // Actions
  addVehicle: (data: Omit<Vehicle, 'id' | 'user_id' | 'created_at'>) => Promise<Vehicle>;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  setActiveVehicle: (id: string) => Promise<void>;

  // Odometer
  addOdometerLog: (vehicleId: string, km: number, date?: string, notes?: string, source?: VehicleOdometerLog['source']) => Promise<void>;

  // Maintenance
  addMaintenanceRecord: (data: Omit<VehicleMaintenanceRecord, 'id' | 'user_id' | 'created_at'>) => Promise<VehicleMaintenanceRecord>;
  updateMaintenanceRecord: (id: string, updates: Partial<VehicleMaintenanceRecord>) => Promise<void>;
  deleteMaintenanceRecord: (id: string) => Promise<void>;

  // FIPE
  addFipeHistoryEntry: (vehicleId: string, fipeCode: string, fipeValue: number, refMonth: string) => Promise<void>;

  // Metrics helper
  getVehicleMetrics: (vehicleId: string, transactions?: Transaction[], reserveTransactions?: ReserveTransaction[]) => VehicleMetrics;
  refreshVehicles: () => Promise<void>;
}

const VehiclesContext = createContext<VehiclesContextType | undefined>(undefined);

export const VehiclesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => cacheManager.get<Vehicle[]>('vehicles_cache') || []);
  const [odometerLogs, setOdometerLogs] = useState<Record<string, VehicleOdometerLog[]>>(() => cacheManager.get<Record<string, VehicleOdometerLog[]>>('vehicle_odometer_cache') || {});
  const [maintenanceRecords, setMaintenanceRecords] = useState<Record<string, VehicleMaintenanceRecord[]>>(() => cacheManager.get<Record<string, VehicleMaintenanceRecord[]>>('vehicle_maintenance_cache') || {});
  const [fipeHistory, setFipeHistory] = useState<Record<string, VehicleFipeHistory[]>>(() => cacheManager.get<Record<string, VehicleFipeHistory[]>>('vehicle_fipe_cache') || {});
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);

  // Active Vehicle based on is_active flag or first vehicle
  const activeVehicle = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return null;
    const active = vehicles.find(v => v.is_active);
    return active || vehicles[0];
  }, [vehicles]);

  // Sync state to multi-tier cache
  useEffect(() => {
    cacheManager.set('vehicles_cache', vehicles, undefined, 'vehicles');
  }, [vehicles]);

  useEffect(() => {
    cacheManager.set('vehicle_odometer_cache', odometerLogs, undefined, 'vehicles');
  }, [odometerLogs]);

  useEffect(() => {
    cacheManager.set('vehicle_maintenance_cache', maintenanceRecords, undefined, 'vehicles');
  }, [maintenanceRecords]);

  useEffect(() => {
    cacheManager.set('vehicle_fipe_cache', fipeHistory, undefined, 'vehicles');
  }, [fipeHistory]);

  const refreshVehicles = useCallback(async () => {
    try {
      setIsLoadingVehicles(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      const userId = authData.user.id;

      // Parallel fetch for all vehicle collections
      const [vRes, oRes, mRes, fRes] = await Promise.allSettled([
        supabase.from('vehicles').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('vehicle_odometer').select('*').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from('vehicle_maintenance').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('vehicle_fipe_history').select('*').eq('user_id', userId).order('fetched_at', { ascending: false }),
      ]);

      if (vRes.status === 'fulfilled' && vRes.value.data) {
        setVehicles(vRes.value.data as Vehicle[]);
      }

      if (oRes.status === 'fulfilled' && oRes.value.data) {
        const logsGrouped: Record<string, VehicleOdometerLog[]> = {};
        (oRes.value.data as VehicleOdometerLog[]).forEach(log => {
          if (!logsGrouped[log.vehicle_id]) logsGrouped[log.vehicle_id] = [];
          logsGrouped[log.vehicle_id].push(log);
        });
        setOdometerLogs(logsGrouped);
      }

      if (mRes.status === 'fulfilled' && mRes.value.data) {
        const mainGrouped: Record<string, VehicleMaintenanceRecord[]> = {};
        (mRes.value.data as VehicleMaintenanceRecord[]).forEach(item => {
          if (!mainGrouped[item.vehicle_id]) mainGrouped[item.vehicle_id] = [];
          mainGrouped[item.vehicle_id].push(item);
        });
        setMaintenanceRecords(mainGrouped);
      }

      if (fRes.status === 'fulfilled' && fRes.value.data) {
        const fipeGrouped: Record<string, VehicleFipeHistory[]> = {};
        (fRes.value.data as VehicleFipeHistory[]).forEach(fipe => {
          if (!fipeGrouped[fipe.vehicle_id]) fipeGrouped[fipe.vehicle_id] = [];
          fipeGrouped[fipe.vehicle_id].push(fipe);
        });
        setFipeHistory(fipeGrouped);
      }
    } catch (err) {
      console.warn('[VehiclesContext] Erro ao carregar dados da frota:', err);
    } finally {
      setIsLoadingVehicles(false);
    }
  }, []);

  useEffect(() => {
    refreshVehicles();
  }, [refreshVehicles]);

  // Add Vehicle
  const addVehicle = async (data: Omit<Vehicle, 'id' | 'user_id' | 'created_at'>): Promise<Vehicle> => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id || 'offline_user';
    const newId = crypto.randomUUID();

    const isFirstVehicle = vehicles.length === 0;
    const newVehicle: Vehicle = {
      ...data,
      id: newId,
      user_id: userId,
      is_active: isFirstVehicle || Boolean(data.is_active),
      current_km: Number(data.current_km) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setVehicles(prev => {
      const updated = isFirstVehicle || newVehicle.is_active
        ? prev.map(v => ({ ...v, is_active: false }))
        : [...prev];
      return [...updated, newVehicle];
    });

    // Enqueue for offline sync
    syncQueueManager.enqueue('vehicles', 'insert', newId, newVehicle);
    toast.success(`Moto ${newVehicle.brand} ${newVehicle.model} adicionada com sucesso!`);
    return newVehicle;
  };

  // Update Vehicle
  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updates, updated_at: new Date().toISOString() } : v));
    syncQueueManager.enqueue('vehicles', 'update', id, updates);
  };

  // Delete Vehicle
  const deleteVehicle = async (id: string) => {
    setVehicles(prev => {
      const filtered = prev.filter(v => v.id !== id);
      if (filtered.length > 0 && !filtered.some(v => v.is_active)) {
        filtered[0].is_active = true;
      }
      return filtered;
    });
    syncQueueManager.enqueue('vehicles', 'delete', id);
    toast.success('Veículo removido com sucesso!');
  };

  // Set Active Vehicle
  const setActiveVehicle = async (id: string) => {
    setVehicles(prev => prev.map(v => ({ ...v, is_active: v.id === id })));
    const target = vehicles.find(v => v.id === id);
    if (target) {
      syncQueueManager.enqueue('vehicles', 'update', id, { is_active: true });
      toast.info(`Moto ativa alterada para ${target.brand} ${target.model}`);
    }
  };

  // Odometer log
  const addOdometerLog = async (
    vehicleId: string,
    km: number,
    date?: string,
    notes?: string,
    source: VehicleOdometerLog['source'] = 'manual'
  ) => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id || 'offline_user';
    const newId = crypto.randomUUID();

    const log: VehicleOdometerLog = {
      id: newId,
      user_id: userId,
      vehicle_id: vehicleId,
      km: Number(km),
      date: date || new Date().toISOString().split('T')[0],
      notes,
      source,
      created_at: new Date().toISOString(),
    };

    setOdometerLogs(prev => {
      const currentList = prev[vehicleId] || [];
      return { ...prev, [vehicleId]: [log, ...currentList] };
    });

    // Update current_km on vehicle if higher
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle && Number(km) > (vehicle.current_km || 0)) {
      updateVehicle(vehicleId, { current_km: Number(km) });
    }

    syncQueueManager.enqueue('vehicle_odometer', 'insert', newId, log);
  };

  // Maintenance record
  const addMaintenanceRecord = async (
    data: Omit<VehicleMaintenanceRecord, 'id' | 'user_id' | 'created_at'>
  ): Promise<VehicleMaintenanceRecord> => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id || 'offline_user';
    const newId = crypto.randomUUID();

    const record: VehicleMaintenanceRecord = {
      ...data,
      id: newId,
      user_id: userId,
      status: data.status || 'ok',
      created_at: new Date().toISOString(),
    };

    setMaintenanceRecords(prev => {
      const current = prev[data.vehicle_id] || [];
      return { ...prev, [data.vehicle_id]: [record, ...current] };
    });

    syncQueueManager.enqueue('vehicle_maintenance', 'insert', newId, record);
    toast.success('Registro de manutenção salvo!');
    return record;
  };

  const updateMaintenanceRecord = async (id: string, updates: Partial<VehicleMaintenanceRecord>) => {
    setMaintenanceRecords(prev => {
      const updatedMap: Record<string, VehicleMaintenanceRecord[]> = {};
      Object.keys(prev).forEach(vId => {
        updatedMap[vId] = prev[vId].map(r => r.id === id ? { ...r, ...updates } : r);
      });
      return updatedMap;
    });
    syncQueueManager.enqueue('vehicle_maintenance', 'update', id, updates);
  };

  const deleteMaintenanceRecord = async (id: string) => {
    setMaintenanceRecords(prev => {
      const updatedMap: Record<string, VehicleMaintenanceRecord[]> = {};
      Object.keys(prev).forEach(vId => {
        updatedMap[vId] = prev[vId].filter(r => r.id !== id);
      });
      return updatedMap;
    });
    syncQueueManager.enqueue('vehicle_maintenance', 'delete', id);
  };

  // Add FIPE history
  const addFipeHistoryEntry = async (
    vehicleId: string,
    fipeCode: string,
    fipeValue: number,
    refMonth: string
  ) => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id || 'offline_user';
    const newId = crypto.randomUUID();

    const entry: VehicleFipeHistory = {
      id: newId,
      user_id: userId,
      vehicle_id: vehicleId,
      fipe_code: fipeCode,
      fipe_value: fipeValue,
      ref_month: refMonth,
      fetched_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    setFipeHistory(prev => {
      const list = prev[vehicleId] || [];
      // avoid duplicates for same ref_month
      if (list.some(item => item.ref_month === refMonth && item.fipe_value === fipeValue)) {
        return prev;
      }
      return { ...prev, [vehicleId]: [entry, ...list] };
    });

    // Also update vehicle's current FIPE value
    updateVehicle(vehicleId, {
      fipe_code: fipeCode,
      fipe_value: fipeValue,
      fipe_ref_month: refMonth,
      fipe_updated_at: new Date().toISOString(),
    });

    syncQueueManager.enqueue('vehicle_fipe_history', 'insert', newId, entry);
  };

  /**
   * Consolidated metric calculations for a vehicle based on real financial records
   */
  const getVehicleMetrics = useCallback((
    vehicleId: string,
    transactions: Transaction[] = [],
    reserveTransactions: ReserveTransaction[] = []
  ): VehicleMetrics => {
    const vehicle = vehicles.find(v => v.id === vehicleId);

    // Filter financial transactions linked to this vehicle
    const vehicleExpenseTxList = transactions.filter(t => t.vehicle_id === vehicleId && t.type === 'expense');
    const vehicleIncomeTxList = transactions.filter(t => t.vehicle_id === vehicleId && t.type === 'income');

    // Calculate total income (faturamento) linked to this vehicle
    const totalIncome = vehicleIncomeTxList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // Filter reserve usages linked to this vehicle
    const vehicleReserveUsages = reserveTransactions.filter(rt => rt.vehicle_id === vehicleId && rt.type === 'utilizacao');

    let fuelCost = 0;
    let maintenanceCost = 0;
    let tiresCost = 0;
    let oilCost = 0;
    let insuranceCost = 0;
    let taxCost = 0;
    let otherCost = 0;
    let totalLiters = 0;

    const catTotalsMap: Record<string, number> = {};

    // Helper to categorize
    const categorizeExpense = (categoryName: string, amount: number) => {
      const cat = (categoryName || 'Outros').trim();
      catTotalsMap[cat] = (catTotalsMap[cat] || 0) + amount;

      const catLower = cat.toLowerCase();
      if (catLower.includes('combustível') || catLower.includes('gasolina') || catLower.includes('etanol') || catLower.includes('abastecimento')) {
        fuelCost += amount;
      } else if (catLower.includes('manutenção') || catLower.includes('oficina') || catLower.includes('mecanico') || catLower.includes('revisão')) {
        maintenanceCost += amount;
      } else if (catLower.includes('pneu') || catLower.includes('pneus') || catLower.includes('borracharia')) {
        tiresCost += amount;
      } else if (catLower.includes('óleo') || catLower.includes('oleo') || catLower.includes('troca de óleo')) {
        oilCost += amount;
      } else if (catLower.includes('seguro')) {
        insuranceCost += amount;
      } else if (catLower.includes('ipva') || catLower.includes('licenciamento') || catLower.includes('multa') || catLower.includes('taxa')) {
        taxCost += amount;
      } else {
        otherCost += amount;
      }
    };

    // Process transactions (normal expenses)
    vehicleExpenseTxList.forEach(t => {
      const amt = Number(t.amount) || 0;
      categorizeExpense(t.category, amt);
      if (t.fuel_liters && Number(t.fuel_liters) > 0) {
        totalLiters += Number(t.fuel_liters);
      }
    });

    // Process reserve utilizations (avoiding double counting if linked to a transaction_id)
    vehicleReserveUsages.forEach(rt => {
      if (!rt.transaction_id) { // if not already counted as a transaction
        const amt = Number(rt.amount) || 0;
        categorizeExpense(rt.category || 'Manutenção', amt);
      }
    });

    const categoryBreakdown: VehicleCategoryCostBreakdown[] = Object.entries(catTotalsMap)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    const totalCost = fuelCost + maintenanceCost + tiresCost + oilCost + insuranceCost + taxCost + otherCost;
    const netProfit = totalIncome - totalCost;
    const marginPercent = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    // KM calculation from odometer logs & transactions
    const logs = odometerLogs[vehicleId] || [];
    const maxLogKm = logs.length > 0 ? Math.max(...logs.map(l => Number(l.km) || 0)) : 0;
    const minLogKm = logs.length > 0 ? Math.min(...logs.map(l => Number(l.km) || 0)) : 0;

    const currentVehicleKm = vehicle ? (vehicle.current_km || 0) : maxLogKm;
    const initialVehicleKm = minLogKm > 0 ? minLogKm : (vehicle?.current_km || 0);

    const totalKmRecorded = Math.max(0, currentVehicleKm - (minLogKm > 0 ? minLogKm : 0));

    // Realized km/l
    const avgKmPerLiter = vehicle?.avg_km_per_liter || 30;
    const realizedKmPerLiter = totalLiters > 0 && totalKmRecorded > 0
      ? totalKmRecorded / totalLiters
      : avgKmPerLiter;

    // Cost and Profit per KM
    const costPerKm = totalKmRecorded > 0 ? totalCost / totalKmRecorded : 0;
    const fuelCostPerKm = totalKmRecorded > 0 ? fuelCost / totalKmRecorded : 0;
    const revenuePerKm = totalKmRecorded > 0 ? totalIncome / totalKmRecorded : 0;
    const profitPerKm = totalKmRecorded > 0 ? netProfit / totalKmRecorded : 0;

    // FIPE vs Acquisition
    const acquisitionValue = vehicle?.acquisition_value || 0;
    const fipeValue = vehicle?.fipe_value || 0;
    const valueDifference = fipeValue && acquisitionValue ? fipeValue - acquisitionValue : 0;
    const percentageVariation = acquisitionValue > 0 ? (valueDifference / acquisitionValue) * 100 : 0;

    // Maintenances
    const mainList = maintenanceRecords[vehicleId] || [];
    const upcomingMaintenances: VehicleMaintenanceRecord[] = [];
    const overdueMaintenances: VehicleMaintenanceRecord[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    mainList.forEach(m => {
      const isOverdueKm = m.next_due_km && currentVehicleKm >= m.next_due_km;
      const isOverdueData = m.next_due_date && m.next_due_date < todayStr;

      if (isOverdueKm || isOverdueData) {
        overdueMaintenances.push(m);
      } else if (m.next_due_km || m.next_due_date) {
        upcomingMaintenances.push(m);
      }
    });

    return {
      vehicleId,
      totalIncome,
      totalCost,
      netProfit,
      marginPercent,
      fuelCost,
      maintenanceCost,
      tiresCost,
      oilCost,
      insuranceCost,
      taxCost,
      otherCost,
      categoryBreakdown,
      totalKmRecorded,
      totalLiters,
      realizedKmPerLiter,
      costPerKm,
      fuelCostPerKm,
      revenuePerKm,
      profitPerKm,
      acquisitionValue,
      fipeValue,
      valueDifference,
      percentageVariation,
      upcomingMaintenances,
      overdueMaintenances,
    };
  }, [vehicles, odometerLogs, maintenanceRecords]);

  return (
    <VehiclesContext.Provider
      value={{
        vehicles,
        activeVehicle,
        odometerLogs,
        maintenanceRecords,
        fipeHistory,
        isLoadingVehicles,
        addVehicle,
        updateVehicle,
        deleteVehicle,
        setActiveVehicle,
        addOdometerLog,
        addMaintenanceRecord,
        updateMaintenanceRecord,
        deleteMaintenanceRecord,
        addFipeHistoryEntry,
        getVehicleMetrics,
        refreshVehicles,
      }}
    >
      {children}
    </VehiclesContext.Provider>
  );
};

export const useVehicles = () => {
  const ctx = useContext(VehiclesContext);
  if (!ctx) {
    throw new Error('useVehicles must be used within a VehiclesProvider');
  }
  return ctx;
};
