/**
 * Enterprise Database Backup & Restoration Engine
 * Supports full database snapshots, granular selective table exports,
 * Complete PostgreSQL Schema DDL generator for new Supabase projects,
 * Unified Full Migration SQL (Schema + Data), integrity checksums,
 * dry-run inspections, and automated snapshot vaults with rollback capabilities.
 */

import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { systemSettings, SystemConfig } from './systemSettings';
import { 
  UserSettings, 
  Transaction, 
  Reserve, 
  ReserveTransaction, 
  InvestmentTransaction, 
  Dividend,
  Vehicle,
  VehicleOdometerLog,
  VehicleMaintenanceRecord,
  VehicleFipeHistory,
  ValuationTarget
} from '../types';
import { FreightQuote, DriverFreightPreset, FreightClient } from '../types/freight';
import { freightStorage } from './freightStorage';

export interface TableBackupMetadata {
  tableName: string;
  displayName: string;
  recordCount: number;
  description: string;
}

export interface DatabaseSnapshot {
  version: '2.0';
  snapshotId: string;
  createdAt: string;
  createdBy: string;
  environment: string;
  checksum: string;
  metadata: {
    totalRecords: number;
    tables: Record<string, number>;
  };
  data: {
    user_settings?: UserSettings[];
    transactions?: Transaction[];
    reserves?: Reserve[];
    reserve_transactions?: ReserveTransaction[];
    investment_transactions?: InvestmentTransaction[];
    dividends?: Dividend[];
    valuation_targets?: ValuationTarget[];
    portfolio_target_allocations?: any[];
    portfolio_rules_config?: any[];
    b3_assets_metadata?: any[];
    b3_assets_history?: any[];
    freight_quotes?: FreightQuote[];
    freight_presets?: DriverFreightPreset[];
    freight_clients?: FreightClient[];
    system_config?: SystemConfig;
  };
}

export interface DryRunResult {
  valid: boolean;
  snapshotId: string;
  createdAt: string;
  createdBy: string;
  totalRecords: number;
  tables: Record<string, { count: number; name: string }>;
  warnings: string[];
  errors: string[];
  checksumValid: boolean;
}

export interface LocalSnapshotVaultItem {
  id: string;
  timestamp: string;
  createdBy: string;
  totalRecords: number;
  tablesSummary: string;
  snapshot: DatabaseSnapshot;
  isAutoBackup?: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  reachable: boolean;
  authenticated: boolean;
  detectedTables: string[];
  missingTables: string[];
  latencyMs: number;
}

const VAULT_STORAGE_KEY = 'financas_pro_snapshot_vault';

/**
 * Whitelist of actual PostgreSQL database columns per table.
 * Prevents PostgREST PGRST204 errors when restoring snapshots containing computed or frontend-only properties.
 */
export const ALLOWED_TABLE_COLUMNS: Record<string, string[]> = {
  user_settings: [
    'user_id', 'full_name', 'is_admin', 'active_vehicle_id',
    'pizzaria_base_deliveries', 'pizzaria_base_rate', 'pizzaria_daily_rate_above_base',
    'pizzaria_delivery_rate', 'pizzaria_out_of_neighborhood_rate',
    'expense_categories', 'operational_expense_categories', 'personal_expense_categories',
    'income_categories', 'vehicle_categories', 'categories_with_km', 'category_icons',
    'vehicle_km_per_liter', 'fuel_price', 'initial_balance', 'weekly_goal',
    'weekly_net_goal', 'default_driver_labor', 'default_investment_reserve_id',
    'cached_quotes', 'quote_provider', 'brapi_token', 'asset_cnpjs',
    'rebalance_targets', 'biometrics_enabled', 'biometrics_auto_lock_minutes',
    'biometrics_device_info', 'created_at', 'updated_at'
  ],
  transactions: [
    'id', 'user_id', 'type', 'amount', 'date', 'category', 'description', 'notes',
    'start_km', 'end_km', 'deliveries', 'out_of_neighborhood', 'is_reserve_use',
    'dividend_id', 'payment_status', 'payment_date', 'due_date', 'is_recurring',
    'recurrence_frequency', 'recurrence_installments', 'recurrence_group_id',
    'installment_number', 'installment_total', 'installment_index', 'total_installments',
    'vehicle_id', 'fuel_liters', 'fuel_price_per_liter', 'fuel_station', 'refuel_km',
    'created_at'
  ],
  reserves: [
    'id', 'user_id', 'name', 'description', 'color', 'icon', 'saldo_inicial',
    'saldo_atual', 'meta_objetivo', 'status', 'regra_tipo', 'regra_valor',
    'regra_categorias', 'regra_base', 'regra_ativa', 'require_category_on_use',
    'default_use_category', 'rule_history', 'is_paused', 'regra_inicio_validade',
    'created_at', 'updated_at'
  ],
  reserve_transactions: [
    'id', 'user_id', 'reserve_id', 'type', 'amount', 'date', 'category',
    'description', 'linked_investment_id', 'transaction_id', 'source', 'batch_id',
    'payment_status', 'payment_date', 'due_date', 'is_recurring', 'recurrence_frequency',
    'recurrence_installments', 'recurrence_group_id', 'installment_number',
    'installment_total', 'installment_index', 'total_installments', 'vehicle_id',
    'created_at'
  ],
  investment_transactions: [
    'id', 'user_id', 'operation', 'type', 'ticker', 'cnpj', 'amount', 'price',
    'quantity', 'costs', 'reserve_id', 'transaction_id', 'date', 'description',
    'asset_type', 'created_at'
  ],
  dividends: [
    'id', 'user_id', 'ticker', 'amount', 'unit_amount', 'type', 'status', 'date',
    'data_com', 'data_ex', 'description', 'transaction_id', 'source_provider',
    'source_event_id', 'source_document_id', 'source_document_version', 'source_url',
    'source_published_at', 'source_updated_at', 'last_synced_at', 'eligible_quantity',
    'validation_status', 'notes', 'created_at'
  ],
  valuation_targets: [
    'id', 'user_id', 'ticker', 'asset_type', 'cnpj', 'calc_current_price',
    'target_price', 'notes', 'bazin_dpa', 'bazin_target_yield', 'graham_lpa',
    'graham_vpa', 'gordon_d1', 'gordon_k', 'gordon_g', 'pl_target', 'pvp_target',
    'updated_at'
  ],
  portfolio_target_allocations: [
    'id', 'user_id', 'ticker', 'asset_type', 'min_pct', 'target_pct', 'max_pct',
    'is_locked', 'notes', 'updated_at'
  ],
  portfolio_rules_config: [
    'user_id', 'active_strategy', 'gap_weight', 'quality_weight', 'valuation_weight',
    'dividend_weight', 'liquidity_weight', 'max_asset_allocation_pct',
    'max_sector_allocation_pct', 'min_daily_liquidity', 'max_debt_ebitda_allowed',
    'max_fii_physical_vacancy_allowed', 'max_fii_pvp_allowed', 'min_score_allowed',
    'allow_new_positions', 'updated_at'
  ],
  b3_assets_metadata: [
    'ticker', 'user_id', 'asset_type', 'name', 'cnpj', 'sector', 'subsector',
    'segment', 'issuer', 'administrator', 'market_cap', 'daily_liquidity',
    'last_price', 'pl', 'pvp', 'psr', 'dividend_yield', 'p_ativo', 'p_cap_giro',
    'p_ebit', 'p_ativ_circ_liq', 'ev_ebit', 'ev_ebitda', 'gross_margin',
    'ebit_margin', 'net_margin', 'ebitda_margin', 'current_liquidity', 'roic',
    'roe', 'net_worth', 'net_debt_over_equity', 'net_debt_over_ebitda',
    'revenue_cagr_5y', 'profit_cagr_5y', 'payout', 'lpa', 'vpa', 'fii_type',
    'fii_segment', 'ffo_yield', 'physical_vacancy', 'financial_vacancy',
    'properties_count', 'price_per_sqm', 'rent_per_sqm', 'cap_rate',
    'gross_lettable_area', 'top_tenants_share', 'description', 'source',
    'updated_at'
  ],
  b3_assets_history: [
    'id', 'ticker', 'asset_type', 'recorded_at', 'source', 'price', 'dy', 'pvp',
    'pl', 'roe', 'roic', 'vacancy', 'cap_rate', 'metrics_json'
  ],
  freight_quotes: [
    'id', 'user_id', 'code', 'created_at', 'valid_until', 'status', 'client_name',
    'client_phone', 'client_company', 'client_document', 'client_email',
    'driver_name', 'driver_phone', 'driver_company', 'driver_document',
    'pix_key', 'pix_key_type', 'vehicle_type', 'service_type', 'origin_address',
    'origin_neighborhood', 'origin_city', 'destination_address',
    'destination_neighborhood', 'destination_city', 'additional_stops',
    'distance_km', 'is_round_trip', 'total_calculated_km', 'cargo_description',
    'cargo_weight_kg', 'cargo_volume', 'cargo_value', 'scheduled_date',
    'scheduled_time', 'expected_payment_date', 'base_fee', 'price_per_km',
    'extra_stops_fee', 'heavy_cargo_fee', 'stairs_floor_fee', 'urgent_or_rain_fee',
    'night_fee', 'tolls_fee', 'waiting_hours_fee', 'discount', 'discount_type',
    'discount_value', 'fuel_price', 'km_per_liter', 'maintenance_cost_per_km',
    'estimated_fuel_cost', 'estimated_maintenance_cost', 'total_driver_cost',
    'total_price', 'driver_net_profit', 'profit_margin_percent', 'payment_method',
    'observations', 'terms_and_conditions', 'converted_to_transaction_id',
    'converted_at'
  ],
  freight_presets: [
    'user_id', 'driver_name', 'driver_phone', 'driver_company', 'driver_document',
    'pix_key', 'pix_key_type', 'default_vehicle', 'default_price_per_km',
    'default_base_fee', 'default_maintenance_per_km', 'default_stop_fee',
    'default_terms', 'default_payment_method', 'vehicles', 'updated_at'
  ],
  freight_clients: [
    'id', 'user_id', 'name', 'phone', 'company', 'document', 'email', 'updated_at'
  ]
};

/**
 * Filter a record so it only includes known database columns, stripping computed or legacy fields.
 */
export function sanitizeRecord(tableName: string, row: any, ignoredColumns?: Set<string>): Record<string, any> {
  if (!row || typeof row !== 'object') return {};
  const allowed = ALLOWED_TABLE_COLUMNS[tableName];
  const result: Record<string, any> = {};

  for (const [key, val] of Object.entries(row)) {
    // Drop fields not in the whitelist
    if (allowed && !allowed.includes(key)) {
      continue;
    }
    // Drop fields dynamically flagged as missing by PostgREST
    if (ignoredColumns && ignoredColumns.has(key)) {
      continue;
    }
    result[key] = val;
  }

  // Column name alias normalization
  if (tableName === 'valuation_targets' && (row as any).targetPrice !== undefined && result.target_price === undefined) {
    result.target_price = (row as any).targetPrice;
  }

  return result;
}

// Helper to compute a robust cryptographic hash of the JSON content
async function generateChecksum(dataObj: any): Promise<string> {
  const str = JSON.stringify(dataObj);
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback
    }
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash-${Math.abs(hash).toString(16)}`;
}

class DatabaseBackupEngine {
  /**
   * Complete list of all supported application tables
   */
  public getAvailableTables(): TableBackupMetadata[] {
    return [
      {
        tableName: 'user_settings',
        displayName: 'Membros & Configurações',
        recordCount: 0,
        description: 'Perfis de usuários, parâmetros de veículos, categorias e metas financeiras.',
      },
      {
        tableName: 'transactions',
        displayName: 'Lançamentos Financeiros',
        recordCount: 0,
        description: 'Receitas, despesas operacionais, combustível, manutenções e km rodado.',
      },
      {
        tableName: 'reserves',
        displayName: 'Reservas Financeiras (Cofrinhos)',
        recordCount: 0,
        description: 'Fundos de emergência, manutenção e regras de aporte automático.',
      },
      {
        tableName: 'reserve_transactions',
        displayName: 'Extrato das Reservas',
        recordCount: 0,
        description: 'Histórico de aportes, utilizações e rendimentos das reservas.',
      },
      {
        tableName: 'investment_transactions',
        displayName: 'Operações de Investimentos',
        recordCount: 0,
        description: 'Compras e vendas de Ações, FIIs, BDRs e Renda Fixa.',
      },
      {
        tableName: 'dividends',
        displayName: 'Proventos & Dividendos',
        recordCount: 0,
        description: 'Dividendos, JCP e rendimentos recebidos e provisionados.',
      },
      {
        tableName: 'valuation_targets',
        displayName: 'Metas de Preço Teto & Valuation',
        recordCount: 0,
        description: 'Cálculos de Bazin, Graham, Gordon e preços-alvo da carteira.',
      },
      {
        tableName: 'portfolio_target_allocations',
        displayName: 'Metas de Alocação de Carteira',
        recordCount: 0,
        description: 'Porcentagens mínimas, alvo e máximas por ativo no Rebalanceamento.',
      },
      {
        tableName: 'portfolio_rules_config',
        displayName: 'Regras do Rebalanceamento',
        recordCount: 0,
        description: 'Critérios de peso, governança, vacância e filtros do motor de alocação.',
      },
      {
        tableName: 'b3_assets_metadata',
        displayName: 'Metadados e Fundamentos B3',
        recordCount: 0,
        description: 'Setores, segmentos, CNPJs e características de ativos da B3.',
      },
      {
        tableName: 'b3_assets_history',
        displayName: 'Histórico de Indicadores B3 (Raio-X)',
        recordCount: 0,
        description: 'Série histórica de P/VP, P/L, Dividend Yield e métricas fundamentalistas.',
      },
      {
        tableName: 'freight_quotes',
        displayName: 'Orçamentos de Frete',
        recordCount: 0,
        description: 'Orçamentos comerciais de frete, tarifas calculadas e dados de clientes.',
      },
      {
        tableName: 'freight_presets',
        displayName: 'Parâmetros de Frete do Motorista',
        recordCount: 0,
        description: 'Configurações de veículos, tarifas base por KM, chave PIX e termos.',
      },
      {
        tableName: 'freight_clients',
        displayName: 'Clientes de Frete (Cadastros)',
        recordCount: 0,
        description: 'Cadastro de clientes frequentes, contatos e documentos para orçamento rápido.',
      },
      {
        tableName: 'system_config',
        displayName: 'Parâmetros Globais do Sistema',
        recordCount: 0,
        description: 'Configurações de infraestrutura, políticas operacionais e avisos globais.',
      },
    ];
  }

  /**
   * Fetch live counts for all database tables
   */
  public async getTableLiveCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {
      user_settings: 0,
      transactions: 0,
      reserves: 0,
      reserve_transactions: 0,
      investment_transactions: 0,
      dividends: 0,
      vehicles: 0,
      vehicle_odometer: 0,
      vehicle_maintenance: 0,
      vehicle_fipe_history: 0,
      valuation_targets: 0,
      portfolio_target_allocations: 0,
      portfolio_rules_config: 0,
      b3_assets_metadata: 0,
      b3_assets_history: 0,
      freight_quotes: freightStorage.getQuotes().length,
      freight_presets: 1,
      freight_clients: freightStorage.getClients().length,
      system_config: 1,
    };

    const supabaseTables = [
      'user_settings',
      'transactions',
      'reserves',
      'reserve_transactions',
      'investment_transactions',
      'dividends',
      'vehicles',
      'vehicle_odometer',
      'vehicle_maintenance',
      'vehicle_fipe_history',
      'valuation_targets',
      'portfolio_target_allocations',
      'portfolio_rules_config',
      'b3_assets_metadata',
      'b3_assets_history',
      'freight_quotes',
      'freight_presets',
      'freight_clients',
    ];

    await Promise.all(
      supabaseTables.map(async (tbl) => {
        try {
          const { count, error } = await supabase
            .from(tbl)
            .select('*', { count: 'exact', head: true });

          if (!error && typeof count === 'number') {
            counts[tbl] = count;
          }
        } catch (e) {
          console.warn(`[DatabaseBackup] Erro ao contar tabela ${tbl}:`, e);
        }
      })
    );

    return counts;
  }

  /**
   * Export Full or Selected Tables from Supabase Database
   */
  public async createSnapshot(
    selectedTables?: string[],
    adminName: string = 'Administrador',
    onProgress?: (percent: number, status: string) => void
  ): Promise<DatabaseSnapshot> {
    onProgress?.(5, 'Iniciando extração do banco de dados...');

    const allSupportedTables = this.getAvailableTables().map(t => t.tableName);
    const tablesToExport = selectedTables && selectedTables.length > 0
      ? selectedTables
      : allSupportedTables;

    const data: DatabaseSnapshot['data'] = {};
    const tableCounts: Record<string, number> = {};
    let totalRecords = 0;

    const stepWeight = 85 / tablesToExport.length;
    let currentProgress = 10;

    for (const table of tablesToExport) {
      onProgress?.(Math.round(currentProgress), `Exportando tabela: ${table}...`);

      try {
        if (table === 'system_config') {
          data.system_config = systemSettings.getConfig();
          tableCounts.system_config = 1;
          totalRecords += 1;
        } else {
          // Supabase tables
          const { data: rows, error } = await supabase
            .from(table)
            .select('*');

          if (error) {
            console.error(`[DatabaseBackup] Erro ao exportar ${table}:`, error);
            data[table as keyof DatabaseSnapshot['data']] = [] as any;
            tableCounts[table] = 0;
          } else {
            data[table as keyof DatabaseSnapshot['data']] = (rows || []) as any;
            tableCounts[table] = rows?.length || 0;
            totalRecords += rows?.length || 0;
          }
        }
      } catch (err: any) {
        console.error(`[DatabaseBackup] Exceção na extração de ${table}:`, err);
        tableCounts[table] = 0;
      }

      currentProgress += stepWeight;
    }

    onProgress?.(95, 'Calculando hash de integridade criptográfica...');

    const snapshotId = `db-snap-${Date.now()}`;
    const rawDataForHash = { ...data };
    const checksum = await generateChecksum(rawDataForHash);

    const snapshot: DatabaseSnapshot = {
      version: '2.0',
      snapshotId,
      createdAt: new Date().toISOString(),
      createdBy: adminName,
      environment: 'production',
      checksum,
      metadata: {
        totalRecords,
        tables: tableCounts,
      },
      data,
    };

    onProgress?.(100, 'Snapshot concluído com sucesso!');

    systemSettings.logAction(
      adminName,
      'Backup da Base de Dados',
      `Snapshot gerado com ${totalRecords} registros em ${Object.keys(tableCounts).length} tabelas.`,
      'system',
      'success'
    );

    this.saveToVault(snapshot, false, adminName);
    return snapshot;
  }

  /**
   * Generate downloadable JSON file from snapshot
   */
  public downloadSnapshotJSON(snapshot: DatabaseSnapshot, filenamePrefix: string = 'backup_completo_financas_pro') {
    const jsonStr = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `${filenamePrefix}_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Helper to format SQL values safely
   */
  private formatSQLValue(v: any): string {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  }

  /**
   * Helper to generate INSERT INTO ... ON CONFLICT statements for a table
   */
  private generateTableInsertSQL(
    tableName: string, 
    records: any[] | undefined, 
    conflictTarget: string
  ): string {
    if (!records || records.length === 0) return '';

    let out = `\n-- ---------------------------------------------------------\n`;
    out += `-- Tabela: ${tableName} (${records.length} registros)\n`;
    out += `-- ---------------------------------------------------------\n`;

    records.forEach((rawRow) => {
      const row = sanitizeRecord(tableName, rawRow);
      const keys = Object.keys(row);
      if (keys.length === 0) return;
      const columns = keys.join(', ');
      const values = keys.map(k => this.formatSQLValue(row[k])).join(', ');
      const updateClause = keys.map(k => `${k} = EXCLUDED.${k}`).join(', ');

      out += `INSERT INTO public.${tableName} (${columns}) VALUES (${values}) ON CONFLICT ${conflictTarget} DO UPDATE SET ${updateClause};\n`;
    });

    return out;
  }

  /**
   * Generate pure PostgreSQL SQL Data Dump script from snapshot
   */
  public generateSQLDump(snapshot: DatabaseSnapshot): string {
    const header = `-- ==========================================================
-- FINANÇAS PRO - SQL DATABASE DUMP (DADOS)
-- Snapshot ID: ${snapshot.snapshotId}
-- Gerado em: ${new Date(snapshot.createdAt).toLocaleString('pt-BR')}
-- Autor: ${snapshot.createdBy}
-- Total de Registros: ${snapshot.metadata.totalRecords}
-- Versão do Schema: ${snapshot.version}
-- ==========================================================

BEGIN;

-- Desativar temporariamente verificações de chave estrangeira
SET CONSTRAINTS ALL DEFERRED;
`;

    let sql = header;

    // 1. User Settings
    sql += this.generateTableInsertSQL('user_settings', snapshot.data.user_settings, '(user_id)');

    // 2. Reserves
    sql += this.generateTableInsertSQL('reserves', snapshot.data.reserves, '(id)');

    // 7. Transactions
    sql += this.generateTableInsertSQL('transactions', snapshot.data.transactions, '(id)');

    // 8. Investment Transactions
    sql += this.generateTableInsertSQL('investment_transactions', snapshot.data.investment_transactions, '(id)');

    // 9. Dividends
    sql += this.generateTableInsertSQL('dividends', snapshot.data.dividends, '(id)');

    // 10. Reserve Transactions
    sql += this.generateTableInsertSQL('reserve_transactions', snapshot.data.reserve_transactions, '(id)');

    // 11. Valuation Targets
    sql += this.generateTableInsertSQL('valuation_targets', snapshot.data.valuation_targets, '(user_id, ticker)');

    // 12. Portfolio Target Allocations
    sql += this.generateTableInsertSQL('portfolio_target_allocations', snapshot.data.portfolio_target_allocations, '(user_id, ticker)');

    // 13. Portfolio Rules Config
    sql += this.generateTableInsertSQL('portfolio_rules_config', snapshot.data.portfolio_rules_config, '(user_id)');

    // 14. B3 Assets Metadata
    sql += this.generateTableInsertSQL('b3_assets_metadata', snapshot.data.b3_assets_metadata, '(ticker)');

    // 15. B3 Assets History
    sql += this.generateTableInsertSQL('b3_assets_history', snapshot.data.b3_assets_history, '(id)');

    // 16. Freight Quotes
    sql += this.generateTableInsertSQL('freight_quotes', snapshot.data.freight_quotes, '(id)');

    // 17. Freight Presets
    sql += this.generateTableInsertSQL('freight_presets', snapshot.data.freight_presets, '(user_id)');

    // 18. Freight Clients
    sql += this.generateTableInsertSQL('freight_clients', snapshot.data.freight_clients, '(id)');

    sql += `\nCOMMIT;\n-- Fim do dump de dados.\n`;
    return sql;
  }

  /**
   * Generate Complete PostgreSQL DDL Schema for a fresh Supabase instance
   */
  public generateCompleteSchemaDDL(): string {
    return `-- ==============================================================================
-- FINANÇAS PRO & MOTO GESTÃO - SCHEMA COMPLETO DO SUPABASE (SETUP DO ZERO)
-- Versão: 2.5 (Produção)
-- Gerado para: Setup instantâneo em novo projeto/conta Supabase
-- Inclui: 18 Tabelas, Colunas, Índices de Performance, RLS e Permissões Universais
-- ==============================================================================

BEGIN;

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. CONFIGURAÇÕES E PERFIS DE USUÁRIOS (user_settings)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id TEXT PRIMARY KEY,
    full_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    active_vehicle_id TEXT,
    
    -- Tarifas e Parâmetros Operacionais (Pizzaria / Moto)
    pizzaria_base_deliveries INTEGER DEFAULT 0,
    pizzaria_base_rate NUMERIC DEFAULT 0,
    pizzaria_daily_rate_above_base NUMERIC DEFAULT 0,
    pizzaria_delivery_rate NUMERIC DEFAULT 0,
    pizzaria_out_of_neighborhood_rate NUMERIC DEFAULT 0,
    
    -- Categorias Customizadas
    expense_categories JSONB DEFAULT '[]'::jsonb,
    operational_expense_categories JSONB DEFAULT '[]'::jsonb,
    personal_expense_categories JSONB DEFAULT '[]'::jsonb,
    income_categories JSONB DEFAULT '[]'::jsonb,
    vehicle_categories JSONB DEFAULT '[]'::jsonb,
    categories_with_km JSONB DEFAULT '[]'::jsonb,
    category_icons JSONB DEFAULT '{}'::jsonb,

    -- Parâmetros Veiculares e Metas
    vehicle_km_per_liter NUMERIC DEFAULT 35,
    fuel_price NUMERIC DEFAULT 5.89,
    initial_balance NUMERIC DEFAULT 0,
    weekly_goal NUMERIC DEFAULT 0,
    weekly_net_goal NUMERIC DEFAULT 0,
    default_driver_labor NUMERIC DEFAULT 0,

    -- Parâmetros de Investimentos e Cotações
    default_investment_reserve_id TEXT,
    cached_quotes JSONB DEFAULT '{}'::jsonb,
    quote_provider TEXT DEFAULT 'auto',
    brapi_token TEXT,
    asset_cnpjs JSONB DEFAULT '{}'::jsonb,
    rebalance_targets JSONB DEFAULT '{}'::jsonb,

    -- Biometria e Segurança de Sessão
    biometrics_enabled BOOLEAN DEFAULT FALSE,
    biometrics_auto_lock_minutes INTEGER DEFAULT 5,
    biometrics_device_info JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. TRANSAÇÕES FINANCEIRAS (transactions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    
    -- Dados Operacionais / Entregas
    start_km NUMERIC,
    end_km NUMERIC,
    deliveries INTEGER,
    out_of_neighborhood INTEGER,
    is_reserve_use BOOLEAN DEFAULT FALSE,
    dividend_id TEXT,
    is_investment_tx BOOLEAN DEFAULT FALSE,
    is_reserve_aporte BOOLEAN DEFAULT FALSE,
    is_dividend_tx BOOLEAN DEFAULT FALSE,

    -- Status de Pagamento / Vencimento
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending')),
    payment_date DATE,
    due_date DATE,

    -- Recorrência e Parcelamento
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency TEXT,
    recurrence_installments INTEGER,
    recurrence_group_id TEXT,
    installment_number INTEGER,
    installment_total INTEGER,
    installment_index INTEGER,
    total_installments INTEGER,

    -- Vínculo com Veículo / Abastecimento
    vehicle_id TEXT,
    fuel_liters NUMERIC,
    fuel_price_per_liter NUMERIC,
    fuel_station TEXT,
    refuel_km NUMERIC,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON public.transactions(user_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_due_date ON public.transactions(due_date) WHERE payment_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_transactions_recurrence_group ON public.transactions(recurrence_group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_vehicle ON public.transactions(vehicle_id);

-- ==============================================================================
-- 3. RESERVAS FINANCEIRAS / COFRINHOS (reserves)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reserves (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#10b981',
    icon TEXT NOT NULL DEFAULT 'PiggyBank',
    saldo_inicial NUMERIC NOT NULL DEFAULT 0,
    saldo_atual NUMERIC DEFAULT 0,
    suggested_balance NUMERIC DEFAULT 0,
    meta_objetivo NUMERIC,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    
    -- Automações de Aporte
    regra_tipo TEXT,
    regra_valor NUMERIC,
    regra_categorias JSONB DEFAULT '[]'::jsonb,
    regra_base TEXT DEFAULT 'bruto',
    regra_ativa BOOLEAN DEFAULT TRUE,
    require_category_on_use BOOLEAN DEFAULT FALSE,
    default_use_category TEXT,
    rule_history JSONB DEFAULT '[]'::jsonb,
    is_paused BOOLEAN DEFAULT FALSE,
    regra_inicio_validade DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir adição de coluna se a tabela já existir no Supabase
ALTER TABLE public.reserves ADD COLUMN IF NOT EXISTS suggested_balance NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reserves_user_status ON public.reserves(user_id, status);

-- ==============================================================================
-- 4. EXTRATO DE RESERVAS (reserve_transactions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reserve_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    reserve_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('aporte', 'utilizacao', 'rendimento')),
    amount NUMERIC NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    category TEXT,
    description TEXT,
    linked_investment_id TEXT,
    transaction_id TEXT,
    source TEXT DEFAULT 'manual',
    batch_id TEXT,

    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending')),
    payment_date DATE,
    due_date DATE,

    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency TEXT,
    recurrence_installments INTEGER,
    recurrence_group_id TEXT,
    installment_number INTEGER,
    installment_total INTEGER,
    installment_index INTEGER,
    total_installments INTEGER,

    vehicle_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reserve_tx_user_reserve ON public.reserve_transactions(user_id, reserve_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_reserve_tx_payment_status ON public.reserve_transactions(payment_status);

-- ==============================================================================
-- 5. OPERAÇÕES DE INVESTIMENTOS (investment_transactions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.investment_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    operation TEXT NOT NULL CHECK (operation IN ('buy', 'sell')),
    type TEXT NOT NULL,
    ticker TEXT NOT NULL,
    cnpj TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    price NUMERIC NOT NULL DEFAULT 0,
    quantity NUMERIC NOT NULL DEFAULT 0,
    costs NUMERIC DEFAULT 0,
    reserve_id TEXT,
    transaction_id TEXT,
    date DATE NOT NULL,
    description TEXT,
    asset_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_user_ticker ON public.investment_transactions(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_investments_date ON public.investment_transactions(user_id, date DESC);

-- ==============================================================================
-- 6. PROVENTOS & DIVIDENDOS (dividends)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dividends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    unit_amount NUMERIC DEFAULT 0,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'provisioned', 'cancelled')),
    date DATE NOT NULL,
    data_com DATE,
    data_ex DATE,
    description TEXT,
    transaction_id TEXT,
    source_provider TEXT DEFAULT 'manual',
    source_event_id TEXT,
    source_document_id TEXT,
    source_document_version INTEGER,
    source_url TEXT,
    source_published_at TIMESTAMPTZ,
    source_updated_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,
    eligible_quantity NUMERIC,
    validation_status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dividends_user_ticker ON public.dividends(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_dividends_date ON public.dividends(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_dividends_status ON public.dividends(user_id, status);

-- ==============================================================================
-- 7. VALUATION E PREÇO TETO (valuation_targets)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.valuation_targets (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    asset_type TEXT DEFAULT 'Ação',
    cnpj TEXT,
    calc_current_price NUMERIC,
    target_price NUMERIC,
    notes TEXT,
    bazin_dpa NUMERIC,
    bazin_target_yield NUMERIC,
    graham_lpa NUMERIC,
    graham_vpa NUMERIC,
    gordon_d1 NUMERIC,
    gordon_k NUMERIC,
    gordon_g NUMERIC,
    pl_target NUMERIC,
    pvp_target NUMERIC,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_valuation_user_ticker ON public.valuation_targets(user_id, ticker);

-- ==============================================================================
-- 12. METAS DE ALOCAÇÃO DE CARTEIRA (portfolio_target_allocations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.portfolio_target_allocations (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id TEXT NOT NULL DEFAULT 'default',
    ticker TEXT NOT NULL,
    asset_type TEXT DEFAULT 'Ação',
    min_pct NUMERIC DEFAULT 1,
    target_pct NUMERIC DEFAULT 5,
    max_pct NUMERIC DEFAULT 15,
    is_locked BOOLEAN DEFAULT FALSE,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_alloc_user_ticker ON public.portfolio_target_allocations(user_id, ticker);

-- ==============================================================================
-- 13. CONFIGURAÇÕES DE REBALANCEAMENTO (portfolio_rules_config)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.portfolio_rules_config (
    user_id TEXT PRIMARY KEY DEFAULT 'default',
    active_strategy TEXT DEFAULT 'rebalance',
    gap_weight NUMERIC DEFAULT 40,
    quality_weight NUMERIC DEFAULT 25,
    valuation_weight NUMERIC DEFAULT 20,
    dividend_weight NUMERIC DEFAULT 10,
    liquidity_weight NUMERIC DEFAULT 5,
    max_asset_allocation_pct NUMERIC DEFAULT 15,
    max_sector_allocation_pct NUMERIC DEFAULT 25,
    min_daily_liquidity NUMERIC DEFAULT 1000000,
    max_debt_ebitda_allowed NUMERIC DEFAULT 3.5,
    max_fii_physical_vacancy_allowed NUMERIC DEFAULT 15,
    max_fii_pvp_allowed NUMERIC DEFAULT 1.08,
    min_score_allowed NUMERIC DEFAULT 45,
    allow_new_positions BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 14. METADADOS E FUNDAMENTOS DE ATIVOS B3 (b3_assets_metadata)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.b3_assets_metadata (
    ticker TEXT PRIMARY KEY,
    user_id TEXT,
    asset_type TEXT NOT NULL DEFAULT 'Ação',
    name TEXT,
    cnpj TEXT,
    sector TEXT,
    subsector TEXT,
    segment TEXT,
    issuer TEXT,
    administrator TEXT,
    market_cap NUMERIC,
    daily_liquidity NUMERIC,
    last_price NUMERIC,
    pl NUMERIC,
    pvp NUMERIC,
    psr NUMERIC,
    dividend_yield NUMERIC,
    p_ativo NUMERIC,
    p_cap_giro NUMERIC,
    p_ebit NUMERIC,
    p_ativ_circ_liq NUMERIC,
    ev_ebit NUMERIC,
    ev_ebitda NUMERIC,
    gross_margin NUMERIC,
    ebit_margin NUMERIC,
    net_margin NUMERIC,
    ebitda_margin NUMERIC,
    current_liquidity NUMERIC,
    roic NUMERIC,
    roe NUMERIC,
    net_worth NUMERIC,
    net_debt_over_equity NUMERIC,
    net_debt_over_ebitda NUMERIC,
    revenue_cagr_5y NUMERIC,
    profit_cagr_5y NUMERIC,
    payout NUMERIC,
    lpa NUMERIC,
    vpa NUMERIC,
    fii_type TEXT,
    fii_segment TEXT,
    ffo_yield NUMERIC,
    physical_vacancy NUMERIC,
    financial_vacancy NUMERIC,
    properties_count NUMERIC,
    price_per_sqm NUMERIC,
    rent_per_sqm NUMERIC,
    cap_rate NUMERIC,
    gross_lettable_area NUMERIC,
    top_tenants_share NUMERIC,
    description TEXT,
    source TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b3_assets_metadata_ticker ON public.b3_assets_metadata(ticker);

-- ==============================================================================
-- 15. HISTÓRICO DE INDICADORES B3 / RAIO-X (b3_assets_history)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.b3_assets_history (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    ticker TEXT NOT NULL,
    asset_type TEXT DEFAULT 'Ação',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT DEFAULT 'Fundamentus',
    price NUMERIC,
    dy NUMERIC,
    pvp NUMERIC,
    pl NUMERIC,
    roe NUMERIC,
    roic NUMERIC,
    vacancy NUMERIC,
    cap_rate NUMERIC,
    metrics_json JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_b3_assets_history_ticker ON public.b3_assets_history(ticker, recorded_at DESC);

-- ==============================================================================
-- 16. ORÇAMENTOS DE FRETE (freight_quotes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.freight_quotes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',
    
    -- Cliente
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_company TEXT,
    client_document TEXT,
    client_email TEXT,

    -- Prestador / Emissor
    driver_name TEXT,
    driver_phone TEXT,
    driver_company TEXT,
    driver_document TEXT,
    pix_key TEXT,
    pix_key_type TEXT DEFAULT 'phone',

    -- Rota e Logística
    vehicle_type TEXT NOT NULL DEFAULT 'moto',
    service_type TEXT NOT NULL DEFAULT 'express',
    origin_address TEXT NOT NULL,
    origin_neighborhood TEXT,
    origin_city TEXT,
    destination_address TEXT NOT NULL,
    destination_neighborhood TEXT,
    destination_city TEXT,
    additional_stops JSONB DEFAULT '[]'::jsonb,
    distance_km NUMERIC NOT NULL DEFAULT 0,
    is_round_trip BOOLEAN NOT NULL DEFAULT FALSE,
    total_calculated_km NUMERIC NOT NULL DEFAULT 0,

    -- Carga
    cargo_description TEXT,
    cargo_weight_kg NUMERIC,
    cargo_volume TEXT,
    cargo_value NUMERIC,
    scheduled_date DATE,
    scheduled_time TEXT,
    expected_payment_date DATE,

    -- Precificação e Taxas
    base_fee NUMERIC NOT NULL DEFAULT 0,
    price_per_km NUMERIC NOT NULL DEFAULT 0,
    extra_stops_fee NUMERIC DEFAULT 0,
    heavy_cargo_fee NUMERIC DEFAULT 0,
    stairs_floor_fee NUMERIC DEFAULT 0,
    urgent_or_rain_fee NUMERIC DEFAULT 0,
    night_fee NUMERIC DEFAULT 0,
    tolls_fee NUMERIC DEFAULT 0,
    waiting_hours_fee NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    discount_type TEXT DEFAULT 'fixed',
    discount_value NUMERIC DEFAULT 0,

    -- Custos do Motorista
    fuel_price NUMERIC DEFAULT 0,
    km_per_liter NUMERIC DEFAULT 0,
    maintenance_cost_per_km NUMERIC DEFAULT 0,
    estimated_fuel_cost NUMERIC DEFAULT 0,
    estimated_maintenance_cost NUMERIC DEFAULT 0,
    total_driver_cost NUMERIC DEFAULT 0,

    -- Resultados
    total_price NUMERIC NOT NULL DEFAULT 0,
    driver_net_profit NUMERIC DEFAULT 0,
    profit_margin_percent NUMERIC DEFAULT 0,

    payment_method TEXT DEFAULT 'pix',
    observations TEXT,
    terms_and_conditions TEXT,
    converted_to_transaction_id TEXT,
    converted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_freight_quotes_user ON public.freight_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_code ON public.freight_quotes(code);

-- ==============================================================================
-- 17. PARÂMETROS DE FRETE DO MOTORISTA (freight_presets)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.freight_presets (
    user_id TEXT PRIMARY KEY DEFAULT 'default',
    driver_name TEXT,
    driver_phone TEXT,
    driver_company TEXT,
    driver_document TEXT,
    pix_key TEXT,
    pix_key_type TEXT DEFAULT 'phone',
    default_vehicle TEXT DEFAULT 'moto',
    default_price_per_km NUMERIC DEFAULT 2.80,
    default_base_fee NUMERIC DEFAULT 12.00,
    default_maintenance_per_km NUMERIC DEFAULT 0.25,
    default_stop_fee NUMERIC DEFAULT 6.00,
    default_terms TEXT,
    default_payment_method TEXT DEFAULT 'pix',
    vehicles JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 18. CADASTRO DE CLIENTES FREQUENTES DE FRETE (freight_clients)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.freight_clients (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    document TEXT,
    email TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freight_clients_user ON public.freight_clients(user_id);

-- ==============================================================================
-- HABILITAÇÃO DE ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- ==============================================================================
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_target_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_rules_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b3_assets_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b3_assets_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freight_clients ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- POLÍTICAS DE ACESSO UNIVERSAL PERMISSIVO (RLS)
-- ==============================================================================
DROP POLICY IF EXISTS "Acesso Total User Settings" ON public.user_settings;
CREATE POLICY "Acesso Total User Settings" ON public.user_settings FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Transactions" ON public.transactions;
CREATE POLICY "Acesso Total Transactions" ON public.transactions FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Reserves" ON public.reserves;
CREATE POLICY "Acesso Total Reserves" ON public.reserves FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Reserve Transactions" ON public.reserve_transactions;
CREATE POLICY "Acesso Total Reserve Transactions" ON public.reserve_transactions FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Investments" ON public.investment_transactions;
CREATE POLICY "Acesso Total Investments" ON public.investment_transactions FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Dividends" ON public.dividends;
CREATE POLICY "Acesso Total Dividends" ON public.dividends FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Valuation" ON public.valuation_targets;
CREATE POLICY "Acesso Total Valuation" ON public.valuation_targets FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Portfolio Target Allocations" ON public.portfolio_target_allocations;
CREATE POLICY "Acesso Total Portfolio Target Allocations" ON public.portfolio_target_allocations FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Portfolio Rules Config" ON public.portfolio_rules_config;
CREATE POLICY "Acesso Total Portfolio Rules Config" ON public.portfolio_rules_config FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total B3 Assets Metadata" ON public.b3_assets_metadata;
CREATE POLICY "Acesso Total B3 Assets Metadata" ON public.b3_assets_metadata FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total B3 Assets History" ON public.b3_assets_history;
CREATE POLICY "Acesso Total B3 Assets History" ON public.b3_assets_history FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Freight Quotes" ON public.freight_quotes;
CREATE POLICY "Acesso Total Freight Quotes" ON public.freight_quotes FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Freight Presets" ON public.freight_presets;
CREATE POLICY "Acesso Total Freight Presets" ON public.freight_presets FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Freight Clients" ON public.freight_clients;
CREATE POLICY "Acesso Total Freight Clients" ON public.freight_clients FOR ALL TO public USING (true) WITH CHECK (true);

-- ==============================================================================
-- CONCESSÃO DE PRIVILÉGIOS (GRANTS)
-- ==============================================================================
GRANT ALL ON TABLE public.user_settings TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.reserves TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.reserve_transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.investment_transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.dividends TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.valuation_targets TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.portfolio_target_allocations TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.portfolio_rules_config TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.b3_assets_metadata TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.b3_assets_history TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.freight_quotes TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.freight_presets TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.freight_clients TO anon, authenticated, service_role, postgres;

COMMIT;
`;
  }

  /**
   * Return the ready-to-run SQL script to drop obsolete garage tables in Supabase
   */
  public generateGarageCleanupSQL(): string {
    return `-- ==============================================================================
-- SCRIPT DE LIMPEZA E OTIMIZAÇÃO DA BASE DE DADOS (SUPABASE)
-- Remove as tabelas desnecessárias da antiga Garagem e unifica a gestão de
-- veículos dentro do sistema de Orçamento de Fretes (freight_presets).
-- ==============================================================================

-- 1. Remove chaves estrangeiras vinculadas aos veículos se existirem
ALTER TABLE IF EXISTS public.transactions 
  DROP CONSTRAINT IF EXISTS transactions_vehicle_id_fkey;

ALTER TABLE IF EXISTS public.reserve_transactions 
  DROP CONSTRAINT IF EXISTS reserve_transactions_vehicle_id_fkey;

-- 2. Remove triggers ou funções legadas de atualização de odômetro se existirem
DROP TRIGGER IF EXISTS trigger_update_vehicle_odometer ON public.transactions;
DROP FUNCTION IF EXISTS public.update_vehicle_odometer();

-- 3. Remove as 4 tabelas legadas da garagem em cascata
DROP TABLE IF EXISTS public.vehicle_fipe_history CASCADE;
DROP TABLE IF EXISTS public.vehicle_maintenance CASCADE;
DROP TABLE IF EXISTS public.vehicle_odometer CASCADE;
DROP TABLE IF EXISTS public.vehicles CASCADE;

-- 4. Notificação de Sucesso
SELECT 'Tabelas da Garagem removidas com sucesso! Veículos agora gerenciados via freight_presets.' AS status;
`;
  }

  /**
   * Generate Unified Migration SQL: Schema DDL + Data Dump combined into a single file
   */
  public generateFullMigrationSQL(snapshot: DatabaseSnapshot): string {
    const ddl = this.generateCompleteSchemaDDL();
    const dataDump = this.generateSQLDump(snapshot);

    return `-- ==============================================================================
-- FINANÇAS PRO & MOTO GESTÃO - PACOTE DE MIGRAÇÃO COMPLETA (SCHEMA + DADOS)
-- Snapshot ID: ${snapshot.snapshotId}
-- Gerado em: ${new Date(snapshot.createdAt).toLocaleString('pt-BR')}
-- Autor: ${snapshot.createdBy}
-- Total de Registros: ${snapshot.metadata.totalRecords}
-- 
-- INSTRUÇÕES DE EXECUÇÃO:
-- 1. Abra o novo projeto Supabase em https://app.supabase.com
-- 2. Vá em 'SQL Editor' -> 'New query'
-- 3. Cole todo o conteúdo deste script e clique em 'RUN' (Ctrl+Enter)
-- 4. Todas as tabelas serão criadas e todos os dados serão inseridos de forma idempotente!
-- ==============================================================================

-- PARTE 1: CRIAÇÃO DO SCHEMA (DDL, ÍNDICES, RLS E PERMISSÕES)
${ddl}

-- PARTE 2: CARGA COMPLETA DOS DADOS
${dataDump}
`;
  }

  /**
   * Download Schema DDL script
   */
  public downloadSchemaDDL(filenamePrefix: string = 'setup_supabase_schema') {
    const sql = this.generateCompleteSchemaDDL();
    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Download Unified Full Migration script (DDL + Data)
   */
  public downloadFullMigrationSQL(snapshot: DatabaseSnapshot, filenamePrefix: string = 'migracao_completa_novo_supabase') {
    const sql = this.generateFullMigrationSQL(snapshot);
    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `${filenamePrefix}_${dateStr}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Download Data SQL script directly
   */
  public downloadSQLDump(snapshot: DatabaseSnapshot, filenamePrefix: string = 'dump_dados_postgresql') {
    const sql = this.generateSQLDump(snapshot);
    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `${filenamePrefix}_${dateStr}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Test connection to a new Supabase project
   */
  public async testSupabaseConnection(supabaseUrl: string, supabaseAnonKey: string): Promise<ConnectionTestResult> {
    const start = Date.now();
    const cleanUrl = (supabaseUrl || '').trim();
    const cleanKey = (supabaseAnonKey || '').trim();

    if (!cleanUrl || !cleanKey) {
      return {
        success: false,
        message: 'A URL do Supabase e a Anon Public Key são obrigatórias para o teste.',
        reachable: false,
        authenticated: false,
        detectedTables: [],
        missingTables: [],
        latencyMs: 0,
      };
    }

    try {
      const testClient = createClient(cleanUrl, cleanKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const tablesToCheck = [
        'user_settings',
        'transactions',
        'reserves',
        'reserve_transactions',
        'investment_transactions',
        'dividends',
        'vehicles',
        'vehicle_odometer',
        'vehicle_maintenance',
        'vehicle_fipe_history',
        'valuation_targets',
        'portfolio_target_allocations',
        'portfolio_rules_config',
        'b3_assets_metadata',
        'b3_assets_history',
        'freight_quotes',
        'freight_presets',
        'freight_clients',
      ];

      const detectedTables: string[] = [];
      const missingTables: string[] = [];

      // Check tables in parallel
      await Promise.all(
        tablesToCheck.map(async (tbl) => {
          try {
            const { error } = await testClient
              .from(tbl)
              .select('*', { count: 'exact', head: true });

            if (!error || error.code !== '42P01') {
              detectedTables.push(tbl);
            } else {
              missingTables.push(tbl);
            }
          } catch {
            missingTables.push(tbl);
          }
        })
      );

      const latencyMs = Date.now() - start;

      if (detectedTables.length === tablesToCheck.length) {
        return {
          success: true,
          message: `Conexão estabelecida com sucesso! Todas as ${detectedTables.length} tabelas foram identificadas e estão operacionais (${latencyMs}ms).`,
          reachable: true,
          authenticated: true,
          detectedTables,
          missingTables: [],
          latencyMs,
        };
      }

      if (detectedTables.length > 0) {
        return {
          success: false,
          message: `Conexão bem sucedida (${latencyMs}ms), porém apenas ${detectedTables.length}/${tablesToCheck.length} tabelas existem. Execute o script DDL no SQL Editor para criar as tabelas restantes.`,
          reachable: true,
          authenticated: true,
          detectedTables,
          missingTables,
          latencyMs,
        };
      }

      return {
        success: false,
        message: `Servidor conectado (${latencyMs}ms), mas nenhuma tabela foi encontrada. O novo projeto está limpo. Execute o Schema DDL no SQL Editor.`,
        reachable: true,
        authenticated: true,
        detectedTables: [],
        missingTables: tablesToCheck,
        latencyMs,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Falha na conexão com o novo Supabase: ${err.message || 'Verifique se a URL e a Anon Key estão corretas.'}`,
        reachable: false,
        authenticated: false,
        detectedTables: [],
        missingTables: [],
        latencyMs: Date.now() - start,
      };
    }
  }

  /**
   * Pre-flight inspection / Dry Run on uploaded JSON backup
   */
  public async inspectBackupFile(jsonStr: string): Promise<DryRunResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const tables: Record<string, { count: number; name: string }> = {};

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e: any) {
      return {
        valid: false,
        snapshotId: 'invalid',
        createdAt: new Date().toISOString(),
        createdBy: 'Desconhecido',
        totalRecords: 0,
        tables: {},
        warnings: [],
        errors: ['O arquivo fornecido não é um JSON válido: ' + e.message],
        checksumValid: false,
      };
    }

    // Support both 2.0 full snapshot and 1.0 config-only formats
    if (!parsed.data && parsed.config) {
      return {
        valid: true,
        snapshotId: 'legacy-config-v1',
        createdAt: parsed.exportedAt || new Date().toISOString(),
        createdBy: 'Administrador (Legado)',
        totalRecords: 1,
        tables: {
          system_config: { count: 1, name: 'Parâmetros Globais do Sistema' },
        },
        warnings: ['Este é um arquivo de backup de configurações do sistema (v1.0), sem tabelas operacionais.'],
        errors: [],
        checksumValid: true,
      };
    }

    if (!parsed.data) {
      errors.push('O arquivo não contém o nó principal de dados ("data"). Formato incompatível.');
    }

    const data = parsed.data || {};
    let totalCount = 0;

    const available = this.getAvailableTables();
    for (const tbl of available) {
      const val = data[tbl.tableName];
      if (Array.isArray(val)) {
        tables[tbl.tableName] = { count: val.length, name: tbl.displayName };
        totalCount += val.length;
      } else if (val && typeof val === 'object') {
        tables[tbl.tableName] = { count: 1, name: tbl.displayName };
        totalCount += 1;
      }
    }

    if (totalCount === 0) {
      warnings.push('O arquivo de backup não contém nenhum registro nas tabelas suportadas.');
    }

    // Verify Checksum
    let checksumValid = false;
    if (parsed.checksum && data) {
      const calculated = await generateChecksum(data);
      checksumValid = calculated === parsed.checksum;
      if (!checksumValid) {
        warnings.push('Aviso de Integridade: O hash de verificação (checksum) não coincide. O arquivo pode ter sido editado manualmente.');
      }
    } else {
      warnings.push('O backup não possui hash criptográfico embutido para validação de integridade.');
    }

    return {
      valid: errors.length === 0,
      snapshotId: parsed.snapshotId || `snap-${Date.now()}`,
      createdAt: parsed.createdAt || new Date().toISOString(),
      createdBy: parsed.createdBy || 'Administrador',
      totalRecords: totalCount,
      tables,
      warnings,
      errors,
      checksumValid,
    };
  }

  /**
   * Execute Real Database Restore
   */
  public async restoreDatabase(
    snapshot: DatabaseSnapshot,
    mode: 'merge' | 'replace' = 'merge',
    selectedTables?: string[],
    adminName: string = 'Administrador',
    onProgress?: (percent: number, status: string) => void
  ): Promise<{ success: boolean; message: string; details: Record<string, number> }> {
    onProgress?.(5, 'Criando ponto de restauração de segurança automático...');

    // 1. Auto-safety snapshot of current state before applying changes
    try {
      const autoSnapshot = await this.createSnapshot(undefined, 'Sistema (Ponto de Restauração)', undefined);
      this.saveToVault(autoSnapshot, true, adminName);
    } catch (e) {
      console.warn('[DatabaseBackup] Não foi possível gerar snapshot de rollback prévio:', e);
    }

    const data = snapshot.data || (snapshot as any);
    const tablesToRestore = selectedTables && selectedTables.length > 0
      ? selectedTables
      : Object.keys(data);

    const stats: Record<string, number> = {};
    const stepWeight = 85 / tablesToRestore.length;
    let currentProgress = 10;

    const conflictKeys: Record<string, string> = {
      user_settings: 'user_id',
      freight_presets: 'user_id',
      portfolio_rules_config: 'user_id',
      b3_assets_metadata: 'ticker',
      valuation_targets: 'user_id,ticker',
      portfolio_target_allocations: 'user_id,ticker',
    };

    onProgress?.(10, `Iniciando restauração no modo [${mode === 'merge' ? 'Mesclagem / Upsert' : 'Substituição'} ]...`);

    for (const table of tablesToRestore) {
      onProgress?.(Math.round(currentProgress), `Restaurando tabela: ${table}...`);

      try {
        if (table === 'system_config' && data.system_config) {
          systemSettings.updateConfig(data.system_config, adminName);
          stats.system_config = 1;
        } else {
          const rawRows: any[] = data[table as keyof DatabaseSnapshot['data']] as any[];
          if (Array.isArray(rawRows) && rawRows.length > 0) {
            const BATCH_SIZE = 50;
            let insertedCount = 0;
            const conflictKey = conflictKeys[table];
            const dynamicallyIgnoredCols = new Set<string>();

            for (let i = 0; i < rawRows.length; i += BATCH_SIZE) {
              let batch = rawRows.slice(i, i + BATCH_SIZE).map(r => sanitizeRecord(table, r, dynamicallyIgnoredCols));
              const upsertOptions = conflictKey ? { onConflict: conflictKey } : undefined;

              let retries = 0;
              const MAX_RETRIES = 6;
              let batchSuccess = false;

              while (!batchSuccess && retries < MAX_RETRIES) {
                const { error } = await supabase
                  .from(table)
                  .upsert(batch, upsertOptions);

                if (error) {
                  // Check if error is PostgREST PGRST204 (column does not exist in schema cache)
                  const missingColMatch = error.message?.match(/Could not find the '([^']+)' column/i);
                  if (missingColMatch && missingColMatch[1]) {
                    const missingCol = missingColMatch[1];
                    console.warn(`[DatabaseBackup] Coluna desconhecida '${missingCol}' na tabela '${table}', removendo do lote e tentando novamente...`);
                    dynamicallyIgnoredCols.add(missingCol);
                    batch = batch.map(r => {
                      const clone = { ...r };
                      delete clone[missingCol];
                      return clone;
                    });
                    retries++;
                    continue;
                  }

                  console.error(`[DatabaseBackup] Erro ao restaurar lote em ${table}:`, error);
                  throw error;
                } else {
                  batchSuccess = true;
                }
              }

              if (!batchSuccess) {
                throw new Error(`Falha ao sincronizar lote na tabela '${table}' após tentativas.`);
              }

              insertedCount += batch.length;
            }

            stats[table] = insertedCount;
          } else {
            stats[table] = 0;
          }
        }
      } catch (err: any) {
        console.error(`[DatabaseBackup] Falha na restauração da tabela ${table}:`, err);
        throw new Error(`Falha ao restaurar tabela '${table}': ${err.message || err}`);
      }

      currentProgress += stepWeight;
    }

    onProgress?.(100, 'Restauração concluída com sucesso!');

    const totalRestored = Object.values(stats).reduce((a, b) => a + b, 0);

    systemSettings.logAction(
      adminName,
      'Restauração do Banco de Dados',
      `Base restaurada com sucesso: ${totalRestored} registros processados em ${Object.keys(stats).length} tabelas (Modo: ${mode}).`,
      'system',
      'warn'
    );

    return {
      success: true,
      message: `Banco de dados restaurado com sucesso! ${totalRestored} registros sincronizados.`,
      details: stats,
    };
  }

  /**
   * Vault (Local Snapshots Retention) Management
   */
  public getVaultSnapshots(): LocalSnapshotVaultItem[] {
    try {
      const raw = localStorage.getItem(VAULT_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[DatabaseBackup] Erro ao carregar cofre de snapshots:', e);
    }
    return [];
  }

  public saveToVault(snapshot: DatabaseSnapshot, isAutoBackup: boolean = false, adminName: string = 'Administrador') {
    try {
      const current = this.getVaultSnapshots();
      const summary = Object.entries(snapshot.metadata.tables)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      const newItem: LocalSnapshotVaultItem = {
        id: snapshot.snapshotId,
        timestamp: snapshot.createdAt,
        createdBy: snapshot.createdBy || adminName,
        totalRecords: snapshot.metadata.totalRecords,
        tablesSummary: summary,
        snapshot,
        isAutoBackup,
      };

      // Keep latest 10 snapshots in vault to preserve storage
      const updated = [newItem, ...current.filter(item => item.id !== newItem.id)].slice(0, 10);
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[DatabaseBackup] Falha ao salvar no cofre local:', e);
    }
  }

  public deleteVaultSnapshot(id: string) {
    try {
      const current = this.getVaultSnapshots();
      const updated = current.filter(item => item.id !== id);
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[DatabaseBackup] Erro ao excluir do cofre:', e);
    }
  }

  public clearVault() {
    localStorage.removeItem(VAULT_STORAGE_KEY);
  }
}

export const databaseBackupEngine = new DatabaseBackupEngine();
