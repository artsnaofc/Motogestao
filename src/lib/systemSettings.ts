/**
 * System Settings & Administration Engine
 * Provides persistent global configurations, platform policies,
 * real-time broadcast banners, and admin audit logging.
 */

export interface SystemConfig {
  // 1. Platform & General
  appName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  publicSignupEnabled: boolean;
  defaultCurrency: 'BRL' | 'USD' | 'EUR';
  timezone: string;
  defaultLanguage: 'pt-BR' | 'en-US' | 'es-ES';

  // 2. Operational & Financial Policies (Global defaults)
  defaultFuelPrice: number;
  defaultKmPerLiter: number;
  defaultDriverLabor: number;
  defaultWeeklyGoal: number;
  defaultWeeklyNetGoal: number;
  pizzariaBaseDeliveries: number;
  pizzariaBaseRate: number;
  pizzariaDailyRateAboveBase: number;
  pizzariaDeliveryRate: number;
  pizzariaOutOfNeighborhoodRate: number;

  // 3. Market & Quotes Integration
  defaultQuoteProvider: 'auto' | 'brapi' | 'yahoo' | 'hgbrasil' | 'mfinance';
  brapiGlobalToken: string;
  quoteCacheTtlMinutes: number;
  autoRefreshMarketHours: boolean;
  batchSizeLimit: number;

  // 4. Security & Access Control
  sessionTimeoutMinutes: number;
  enforceStrongPassword: boolean;
  maxLoginAttempts: number;
  restrictDebugConsoleToSuperAdmin: boolean;
  auditLogLevel: 'verbose' | 'standard' | 'minimal';

  // 5. Broadcast Announcement Banner
  broadcastBanner: {
    enabled: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'critical';
    dismissible: boolean;
    updatedAt?: string;
  };

  updatedAt?: string;
  updatedBy?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  adminName: string;
  action: string;
  details: string;
  category: 'user' | 'settings' | 'security' | 'system' | 'cache';
  severity: 'info' | 'warn' | 'error' | 'success';
}

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  appName: 'Finanças Pro',
  maintenanceMode: false,
  maintenanceMessage: 'O sistema está temporariamente em manutenção preventiva. Retornaremos em breve.',
  publicSignupEnabled: true,
  defaultCurrency: 'BRL',
  timezone: 'America/Sao_Paulo',
  defaultLanguage: 'pt-BR',

  defaultFuelPrice: 5.89,
  defaultKmPerLiter: 35.0,
  defaultDriverLabor: 50.0,
  defaultWeeklyGoal: 1000.0,
  defaultWeeklyNetGoal: 700.0,
  pizzariaBaseDeliveries: 10,
  pizzariaBaseRate: 60.0,
  pizzariaDailyRateAboveBase: 70.0,
  pizzariaDeliveryRate: 3.5,
  pizzariaOutOfNeighborhoodRate: 5.0,

  defaultQuoteProvider: 'auto',
  brapiGlobalToken: '',
  quoteCacheTtlMinutes: 15,
  autoRefreshMarketHours: true,
  batchSizeLimit: 20,

  sessionTimeoutMinutes: 120,
  enforceStrongPassword: true,
  maxLoginAttempts: 5,
  restrictDebugConsoleToSuperAdmin: false,
  auditLogLevel: 'standard',

  broadcastBanner: {
    enabled: false,
    title: 'Aviso do Sistema',
    message: '',
    type: 'info',
    dismissible: true,
  },
  updatedAt: new Date().toISOString(),
};

const STORAGE_KEY = 'financas_pro_system_config';
const AUDIT_STORAGE_KEY = 'financas_pro_audit_logs';

class SystemSettingsManager {
  private config: SystemConfig;
  private auditLogs: AuditLog[] = [];

  constructor() {
    this.config = this.loadConfig();
    this.auditLogs = this.loadAuditLogs();
  }

  private loadConfig(): SystemConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SYSTEM_CONFIG,
          ...parsed,
          broadcastBanner: {
            ...DEFAULT_SYSTEM_CONFIG.broadcastBanner,
            ...(parsed.broadcastBanner || {}),
          },
        };
      }
    } catch (e) {
      console.warn('[SystemSettings] Erro ao carregar configurações locais:', e);
    }
    return { ...DEFAULT_SYSTEM_CONFIG };
  }

  private loadAuditLogs(): AuditLog[] {
    try {
      const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[SystemSettings] Erro ao carregar logs de auditoria:', e);
    }
    return [
      {
        id: 'init-log',
        timestamp: new Date().toISOString(),
        adminName: 'Sistema',
        action: 'Inicialização do Painel',
        details: 'Módulo de administração e auditoria carregado com sucesso.',
        category: 'system',
        severity: 'info',
      }
    ];
  }

  public getConfig(): SystemConfig {
    return { ...this.config };
  }

  public updateConfig(patch: Partial<SystemConfig>, adminName: string = 'Administrador'): SystemConfig {
    const updated: SystemConfig = {
      ...this.config,
      ...patch,
      broadcastBanner: {
        ...this.config.broadcastBanner,
        ...(patch.broadcastBanner || {}),
      },
      updatedAt: new Date().toISOString(),
      updatedBy: adminName,
    };

    this.config = updated;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('system-config-changed', { detail: updated }));
    } catch (e) {
      console.error('[SystemSettings] Falha ao persistir configurações:', e);
    }

    this.logAction(
      adminName,
      'Atualização de Configurações',
      `Parâmetros alterados: ${Object.keys(patch).join(', ')}`,
      'settings',
      'success'
    );

    return updated;
  }

  public resetToDefaults(adminName: string = 'Administrador'): SystemConfig {
    this.config = { ...DEFAULT_SYSTEM_CONFIG, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      window.dispatchEvent(new CustomEvent('system-config-changed', { detail: this.config }));
    } catch (e) {
      console.error('[SystemSettings] Falha ao redefinir configurações:', e);
    }

    this.logAction(
      adminName,
      'Redefinição Geral',
      'Configurações do sistema restauradas para os padrões de fábrica.',
      'settings',
      'warn'
    );

    return this.config;
  }

  public exportConfigJSON(): string {
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      config: this.config,
    }, null, 2);
  }

  public importConfigJSON(jsonStr: string, adminName: string = 'Administrador'): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      const importedConfig = parsed.config || parsed;
      if (typeof importedConfig !== 'object' || !importedConfig.appName) {
        throw new Error('Formato de arquivo inválido');
      }

      this.updateConfig(importedConfig, adminName);
      this.logAction(
        adminName,
        'Importação de Backup',
        'Configurações restauradas a partir de arquivo de backup JSON.',
        'system',
        'success'
      );
      return true;
    } catch (e: any) {
      console.error('[SystemSettings] Erro na importação:', e);
      return false;
    }
  }

  // Audit Logging
  public logAction(
    adminName: string,
    action: string,
    details: string,
    category: AuditLog['category'] = 'system',
    severity: AuditLog['severity'] = 'info'
  ) {
    const newLog: AuditLog = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      adminName: adminName || 'Administrador',
      action,
      details,
      category,
      severity,
    };

    this.auditLogs = [newLog, ...this.auditLogs].slice(0, 500); // keep up to 500 logs
    try {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(this.auditLogs));
      window.dispatchEvent(new CustomEvent('system-audit-updated', { detail: this.auditLogs }));
    } catch (e) {
      console.warn('[SystemSettings] Falha ao persistir log:', e);
    }
  }

  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }

  public clearAuditLogs(adminName: string = 'Administrador') {
    this.auditLogs = [];
    try {
      localStorage.removeItem(AUDIT_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('system-audit-updated', { detail: [] }));
    } catch (e) {
      console.warn('[SystemSettings] Falha ao limpar logs:', e);
    }

    this.logAction(adminName, 'Limpeza de Logs', 'Histórico de auditoria foi zerado pelo administrador.', 'security', 'warn');
  }
}

export const systemSettings = new SystemSettingsManager();
