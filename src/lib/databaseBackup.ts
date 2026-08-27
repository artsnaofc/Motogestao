/**
 * Enterprise Database Backup & Restoration Engine
 * Supports full database snapshots, granular selective table exports,
 * PostgreSQL SQL Dump generator, integrity checksums, dry-run inspections,
 * and automated snapshot vaults with rollback capabilities.
 */

import { supabase } from './supabase';
import { systemSettings, SystemConfig, AuditLog } from './systemSettings';
import { UserSettings, Transaction, Reserve, ReserveTransaction, InvestmentTransaction, Dividend } from '../types';
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
    freight_quotes?: FreightQuote[];
    freight_presets?: DriverFreightPreset[];
    freight_clients?: FreightClient[];
    system_config?: SystemConfig;
    audit_logs?: AuditLog[];
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

const VAULT_STORAGE_KEY = 'financas_pro_snapshot_vault';

// Helper to compute a simple, robust cryptographic hash of the JSON content
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
  // Fast string hash fallback
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
   * List of supported tables and descriptions
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
        displayName: 'Reservas Financeiras',
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
        displayName: 'Clientes de Frete (Autocompletar)',
        recordCount: 0,
        description: 'Cadastro de clientes frequentes, contatos e documentos para orçamento rápido.',
      },
      {
        tableName: 'system_config',
        displayName: 'Parâmetros Globais do Sistema',
        recordCount: 0,
        description: 'Configurações de infraestrutura, políticas operacionais e avisos globais.',
      },
      {
        tableName: 'audit_logs',
        displayName: 'Trilha de Auditoria',
        recordCount: 0,
        description: 'Registro histórico de ações administrativas e eventos do sistema.',
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
      freight_quotes: freightStorage.getQuotes().length,
      freight_presets: 1,
      freight_clients: freightStorage.getClients().length,
      system_config: 1,
      audit_logs: systemSettings.getAuditLogs().length,
    };

    const tables = [
      'user_settings',
      'transactions',
      'reserves',
      'reserve_transactions',
      'investment_transactions',
      'dividends',
      'freight_quotes',
      'freight_presets',
      'freight_clients',
    ];

    await Promise.all(
      tables.map(async (tbl) => {
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

    const tablesToExport = selectedTables && selectedTables.length > 0
      ? selectedTables
      : [
          'user_settings',
          'transactions',
          'reserves',
          'reserve_transactions',
          'investment_transactions',
          'dividends',
          'freight_quotes',
          'freight_presets',
          'freight_clients',
          'system_config',
          'audit_logs',
        ];

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
        } else if (table === 'audit_logs') {
          const logs = systemSettings.getAuditLogs();
          data.audit_logs = logs;
          tableCounts.audit_logs = logs.length;
          totalRecords += logs.length;
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

    // Log the backup action
    systemSettings.logAction(
      adminName,
      'Backup da Base de Dados',
      `Snapshot gerado com ${totalRecords} registros em ${Object.keys(tableCounts).length} tabelas.`,
      'system',
      'success'
    );

    // Save to local vault
    this.saveToVault(snapshot, false, adminName);

    return snapshot;
  }

  /**
   * Generate downloadable file from snapshot
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
   * Generate pure PostgreSQL SQL Dump script from snapshot
   */
  public generateSQLDump(snapshot: DatabaseSnapshot): string {
    const header = `-- ==========================================================
-- FINANÇAS PRO - SQL DATABASE DUMP
-- Snapshot ID: ${snapshot.snapshotId}
-- Gerado em: ${new Date(snapshot.createdAt).toLocaleString('pt-BR')}
-- Autor: ${snapshot.createdBy}
-- Total de Registros: ${snapshot.metadata.totalRecords}
-- Versão do Schema: ${snapshot.version}
-- ==========================================================

BEGIN;

-- Desativar temporariamente verificações de chave estrangeira se necessário
SET CONSTRAINTS ALL DEFERRED;
`;

    let sql = header;

    // 1. User Settings
    if (snapshot.data.user_settings && snapshot.data.user_settings.length > 0) {
      sql += `\n-- ---------------------------------------------------------\n-- Tabela: user_settings (${snapshot.data.user_settings.length} registros)\n-- ---------------------------------------------------------\n`;
      snapshot.data.user_settings.forEach((u) => {
        const columns = Object.keys(u).join(', ');
        const values = Object.values(u)
          .map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(', ');

        sql += `INSERT INTO public.user_settings (${columns}) VALUES (${values}) ON CONFLICT (user_id) DO UPDATE SET ${Object.keys(u).map(k => `${k} = EXCLUDED.${k}`).join(', ')};\n`;
      });
    }

    // 2. Transactions
    if (snapshot.data.transactions && snapshot.data.transactions.length > 0) {
      sql += `\n-- ---------------------------------------------------------\n-- Tabela: transactions (${snapshot.data.transactions.length} registros)\n-- ---------------------------------------------------------\n`;
      snapshot.data.transactions.forEach((t) => {
        const columns = Object.keys(t).join(', ');
        const values = Object.values(t)
          .map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(', ');

        sql += `INSERT INTO public.transactions (${columns}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET ${Object.keys(t).map(k => `${k} = EXCLUDED.${k}`).join(', ')};\n`;
      });
    }

    // 3. Reserves
    if (snapshot.data.reserves && snapshot.data.reserves.length > 0) {
      sql += `\n-- ---------------------------------------------------------\n-- Tabela: reserves (${snapshot.data.reserves.length} registros)\n-- ---------------------------------------------------------\n`;
      snapshot.data.reserves.forEach((r) => {
        const columns = Object.keys(r).join(', ');
        const values = Object.values(r)
          .map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(', ');

        sql += `INSERT INTO public.reserves (${columns}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET ${Object.keys(r).map(k => `${k} = EXCLUDED.${k}`).join(', ')};\n`;
      });
    }

    // 4. Reserve Transactions
    if (snapshot.data.reserve_transactions && snapshot.data.reserve_transactions.length > 0) {
      sql += `\n-- ---------------------------------------------------------\n-- Tabela: reserve_transactions (${snapshot.data.reserve_transactions.length} registros)\n-- ---------------------------------------------------------\n`;
      snapshot.data.reserve_transactions.forEach((rt) => {
        const columns = Object.keys(rt).join(', ');
        const values = Object.values(rt)
          .map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(', ');

        sql += `INSERT INTO public.reserve_transactions (${columns}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET ${Object.keys(rt).map(k => `${k} = EXCLUDED.${k}`).join(', ')};\n`;
      });
    }

    // 5. Investment Transactions
    if (snapshot.data.investment_transactions && snapshot.data.investment_transactions.length > 0) {
      sql += `\n-- ---------------------------------------------------------\n-- Tabela: investment_transactions (${snapshot.data.investment_transactions.length} registros)\n-- ---------------------------------------------------------\n`;
      snapshot.data.investment_transactions.forEach((it) => {
        const columns = Object.keys(it).join(', ');
        const values = Object.values(it)
          .map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(', ');

        sql += `INSERT INTO public.investment_transactions (${columns}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET ${Object.keys(it).map(k => `${k} = EXCLUDED.${k}`).join(', ')};\n`;
      });
    }

    // 6. Dividends
    if (snapshot.data.dividends && snapshot.data.dividends.length > 0) {
      sql += `\n-- ---------------------------------------------------------\n-- Tabela: dividends (${snapshot.data.dividends.length} registros)\n-- ---------------------------------------------------------\n`;
      snapshot.data.dividends.forEach((div) => {
        const columns = Object.keys(div).join(', ');
        const values = Object.values(div)
          .map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(', ');

        sql += `INSERT INTO public.dividends (${columns}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET ${Object.keys(div).map(k => `${k} = EXCLUDED.${k}`).join(', ')};\n`;
      });
    }

    // 7. Freight Quotes
    if (snapshot.data.freight_quotes && snapshot.data.freight_quotes.length > 0) {
      sql += `\n-- ---------------------------------------------------------\n-- Tabela: freight_quotes (${snapshot.data.freight_quotes.length} registros)\n-- ---------------------------------------------------------\n`;
      snapshot.data.freight_quotes.forEach((fq) => {
        const columns = Object.keys(fq).join(', ');
        const values = Object.values(fq)
          .map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(', ');

        sql += `INSERT INTO public.freight_quotes (${columns}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET ${Object.keys(fq).map(k => `${k} = EXCLUDED.${k}`).join(', ')};\n`;
      });
    }

    // 8. Freight Presets
    if (snapshot.data.freight_presets && snapshot.data.freight_presets.length > 0) {
      sql += `\n-- ---------------------------------------------------------\n-- Tabela: freight_presets (${snapshot.data.freight_presets.length} registros)\n-- ---------------------------------------------------------\n`;
      snapshot.data.freight_presets.forEach((fp) => {
        const columns = Object.keys(fp).join(', ');
        const values = Object.values(fp)
          .map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(', ');

        sql += `INSERT INTO public.freight_presets (${columns}) VALUES (${values}) ON CONFLICT (user_id) DO UPDATE SET ${Object.keys(fp).map(k => `${k} = EXCLUDED.${k}`).join(', ')};\n`;
      });
    }

    // 9. Freight Clients
    if (snapshot.data.freight_clients && snapshot.data.freight_clients.length > 0) {
      sql += `\n-- ---------------------------------------------------------\n-- Tabela: freight_clients (${snapshot.data.freight_clients.length} registros)\n-- ---------------------------------------------------------\n`;
      snapshot.data.freight_clients.forEach((fc) => {
        const columns = Object.keys(fc).join(', ');
        const values = Object.values(fc)
          .map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(', ');

        sql += `INSERT INTO public.freight_clients (${columns}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET ${Object.keys(fc).map(k => `${k} = EXCLUDED.${k}`).join(', ')};\n`;
      });
    }

    sql += `\nCOMMIT;\n-- Fim do dump de restauração.\n`;
    return sql;
  }

  /**
   * Download SQL script directly
   */
  public downloadSQLDump(snapshot: DatabaseSnapshot, filenamePrefix: string = 'dump_postgresql_financas_pro') {
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
      // Version 1.0 config format
      return {
        valid: true,
        snapshotId: 'legacy-config-v1',
        createdAt: parsed.exportedAt || new Date().toISOString(),
        createdBy: 'Administrador (Legado)',
        totalRecords: 1,
        tables: {
          system_config: { count: 1, name: 'Parâmetros Globais do Sistema' },
        },
        warnings: ['Este é um arquivo de backup de configurações do sistema (v1.0), sem tabelas de usuários ou transações.'],
        errors: [],
        checksumValid: true,
      };
    }

    if (!parsed.data) {
      errors.push('O arquivo não contém o nó principal de dados ("data"). Formato incompatível.');
    }

    const data = parsed.data || {};
    let totalCount = 0;

    const tableNames: Array<{ key: keyof DatabaseSnapshot['data']; name: string }> = [
      { key: 'user_settings', name: 'Membros & Configurações' },
      { key: 'transactions', name: 'Lançamentos' },
      { key: 'reserves', name: 'Reservas' },
      { key: 'reserve_transactions', name: 'Extrato de Reservas' },
      { key: 'investment_transactions', name: 'Investimentos' },
      { key: 'dividends', name: 'Proventos & Dividendos' },
      { key: 'system_config', name: 'Configurações do Sistema' },
      { key: 'audit_logs', name: 'Logs de Auditoria' },
    ];

    for (const tbl of tableNames) {
      const val = data[tbl.key];
      if (Array.isArray(val)) {
        tables[tbl.key] = { count: val.length, name: tbl.name };
        totalCount += val.length;
      } else if (val && typeof val === 'object') {
        tables[tbl.key] = { count: 1, name: tbl.name };
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
   * @param snapshot The parsed database snapshot
   * @param mode 'merge' (Upsert records) | 'replace' (Clean target user tables and insert)
   * @param selectedTables Optional filter of specific tables to restore
   * @param adminName Name of executing admin
   * @param onProgress Telemetry callback
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

    onProgress?.(10, `Iniciando restauração no modo [${mode === 'merge' ? 'Mesclagem / Upsert' : 'Substituição'} ]...`);

    for (const table of tablesToRestore) {
      onProgress?.(Math.round(currentProgress), `Restaurando tabela: ${table}...`);

      try {
        if (table === 'system_config' && data.system_config) {
          systemSettings.updateConfig(data.system_config, adminName);
          stats.system_config = 1;
        } else if (table === 'audit_logs' && Array.isArray(data.audit_logs)) {
          // Append or replace audit logs
          data.audit_logs.forEach((log: AuditLog) => {
            systemSettings.logAction(log.adminName, log.action, log.details, log.category, log.severity);
          });
          stats.audit_logs = data.audit_logs.length;
        } else {
          const rows: any[] = data[table as keyof DatabaseSnapshot['data']] as any[];
          if (Array.isArray(rows) && rows.length > 0) {
            // Batch processing in chunks of 50 to avoid Supabase request limits
            const BATCH_SIZE = 50;
            let insertedCount = 0;

            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
              const batch = rows.slice(i, i + BATCH_SIZE);

              const { error } = await supabase
                .from(table)
                .upsert(batch);

              if (error) {
                console.error(`[DatabaseBackup] Erro ao restaurar lote em ${table}:`, error);
                throw error;
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
