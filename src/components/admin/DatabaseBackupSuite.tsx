import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  Download, 
  Upload, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  FileCode, 
  Layers, 
  HardDrive, 
  Clock, 
  RefreshCw,
  Trash2,
  Server,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  Zap
} from 'lucide-react';
import { 
  databaseBackupEngine, 
  DatabaseSnapshot, 
  DryRunResult, 
  LocalSnapshotVaultItem,
  TableBackupMetadata,
  ConnectionTestResult
} from '../../lib/databaseBackup';
import { systemSettings } from '../../lib/systemSettings';
import { toast } from '@/lib/toast';
import { motion, AnimatePresence } from 'motion/react';

export function DatabaseBackupSuite() {
  const [activeView, setActiveView] = useState<'export' | 'restore' | 'vault' | 'migration'>('export');
  const [tables, setTables] = useState<TableBackupMetadata[]>(() => databaseBackupEngine.getAvailableTables());
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [selectedTables, setSelectedTables] = useState<string[]>(() => 
    databaseBackupEngine.getAvailableTables().map(t => t.tableName)
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ percent: number; status: string }>({ percent: 0, status: '' });
  
  // Restore State
  const [isInspecting, setIsInspecting] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [uploadedSnapshot, setUploadedSnapshot] = useState<DatabaseSnapshot | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ percent: number; status: string }>({ percent: 0, status: '' });
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

  // Vault State
  const [vaultItems, setVaultItems] = useState<LocalSnapshotVaultItem[]>(() => databaseBackupEngine.getVaultSnapshots());
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  // Migration View State
  const [copiedDDL, setCopiedDDL] = useState(false);
  const [isGeneratingFullMigration, setIsGeneratingFullMigration] = useState(false);
  const [newSupabaseUrl, setNewSupabaseUrl] = useState('');
  const [newSupabaseAnonKey, setNewSupabaseAnonKey] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<ConnectionTestResult | null>(null);

  const fetchCounts = async () => {
    setIsLoadingCounts(true);
    try {
      const counts = await databaseBackupEngine.getTableLiveCounts();
      setLiveCounts(counts);
      setTables(prev => prev.map(t => ({
        ...t,
        recordCount: counts[t.tableName] || 0,
      })));
    } catch (e) {
      console.warn('Erro ao buscar contagens:', e);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    setVaultItems(databaseBackupEngine.getVaultSnapshots());
  }, []);

  const handleToggleTable = (tblName: string) => {
    setSelectedTables(prev => 
      prev.includes(tblName) ? prev.filter(t => t !== tblName) : [...prev, tblName]
    );
  };

  const handleSelectAll = () => {
    if (selectedTables.length === tables.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(tables.map(t => t.tableName));
    }
  };

  // Export handlers
  const handleExportJSON = async () => {
    if (selectedTables.length === 0) {
      toast.error('Selecione ao menos uma tabela para exportar.');
      return;
    }

    setIsExporting(true);
    try {
      const snapshot = await databaseBackupEngine.createSnapshot(
        selectedTables,
        'Administrador',
        (percent, status) => setExportProgress({ percent, status })
      );

      databaseBackupEngine.downloadSnapshotJSON(snapshot);
      setVaultItems(databaseBackupEngine.getVaultSnapshots());
      toast.success('Backup JSON da base de dados gerado com sucesso!');
    } catch (e: any) {
      toast.error('Erro ao gerar backup', { description: e.message });
    } finally {
      setIsExporting(false);
      setExportProgress({ percent: 0, status: '' });
    }
  };

  const handleExportSQL = async () => {
    if (selectedTables.length === 0) {
      toast.error('Selecione ao menos uma tabela para exportar.');
      return;
    }

    setIsExporting(true);
    try {
      const snapshot = await databaseBackupEngine.createSnapshot(
        selectedTables,
        'Administrador',
        (percent, status) => setExportProgress({ percent, status })
      );

      databaseBackupEngine.downloadSQLDump(snapshot);
      setVaultItems(databaseBackupEngine.getVaultSnapshots());
      toast.success('Script SQL de exportação gerado com sucesso!');
    } catch (e: any) {
      toast.error('Erro ao gerar script SQL', { description: e.message });
    } finally {
      setIsExporting(false);
      setExportProgress({ percent: 0, status: '' });
    }
  };

  // Migration View Handlers
  const handleCopyDDL = async () => {
    try {
      const ddl = databaseBackupEngine.generateCompleteSchemaDDL();
      await navigator.clipboard.writeText(ddl);
      setCopiedDDL(true);
      toast.success('Schema DDL completo copiado para a área de transferência!');
      setTimeout(() => setCopiedDDL(false), 3000);
    } catch {
      toast.error('Não foi possível copiar automaticamente para a área de transferência.');
    }
  };

  const handleDownloadDDL = () => {
    try {
      databaseBackupEngine.downloadSchemaDDL();
      toast.success('Arquivo setup_supabase_schema.sql baixado com sucesso!');
    } catch (e: any) {
      toast.error('Erro ao baixar script DDL', { description: e.message });
    }
  };

  const handleDownloadFullMigration = async () => {
    setIsGeneratingFullMigration(true);
    try {
      const snapshot = await databaseBackupEngine.createSnapshot(
        undefined,
        'Migrador Supabase',
        (percent, status) => setExportProgress({ percent, status })
      );
      databaseBackupEngine.downloadFullMigrationSQL(snapshot);
      setVaultItems(databaseBackupEngine.getVaultSnapshots());
      toast.success('Pacote completo de migração (Schema + Dados) gerado e baixado!');
    } catch (e: any) {
      toast.error('Erro ao gerar pacote de migração', { description: e.message });
    } finally {
      setIsGeneratingFullMigration(false);
      setExportProgress({ percent: 0, status: '' });
    }
  };

  const handleTestNewConnection = async () => {
    if (!newSupabaseUrl.trim() || !newSupabaseAnonKey.trim()) {
      toast.error('Preencha a URL e a Anon Public Key do novo Supabase.');
      return;
    }

    setIsTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const result = await databaseBackupEngine.testSupabaseConnection(
        newSupabaseUrl.trim(),
        newSupabaseAnonKey.trim()
      );
      setConnectionTestResult(result);
      if (result.success) {
        toast.success('Conexão com novo Supabase verificada com sucesso!');
      } else {
        toast.warning(result.message);
      }
    } catch (err: any) {
      toast.error('Erro ao testar conexão', { description: err.message });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Restore Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsInspecting(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = ev.target?.result as string;
        const dryRun = await databaseBackupEngine.inspectBackupFile(content);
        setDryRunResult(dryRun);

        if (dryRun.valid) {
          const parsed = JSON.parse(content);
          setUploadedSnapshot(parsed);
          toast.success('Arquivo de backup validado com sucesso!');
        } else {
          toast.error('O arquivo de backup contém inconsistências críticas.');
        }
      } catch (err: any) {
        toast.error('Erro ao processar arquivo', { description: err.message });
      } finally {
        setIsInspecting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeRestore = async () => {
    if (!uploadedSnapshot) return;

    setConfirmRestoreOpen(false);
    setIsRestoring(true);
    try {
      const result = await databaseBackupEngine.restoreDatabase(
        uploadedSnapshot,
        restoreMode,
        undefined,
        'Administrador',
        (percent, status) => setRestoreProgress({ percent, status })
      );

      toast.success(result.message, {
        description: 'Os dados foram restaurados e sincronizados com a base de dados.',
      });

      fetchCounts();
      setVaultItems(databaseBackupEngine.getVaultSnapshots());
      setUploadedSnapshot(null);
      setDryRunResult(null);
    } catch (err: any) {
      toast.error('Falha na restauração do banco', { description: err.message });
    } finally {
      setIsRestoring(false);
      setRestoreProgress({ percent: 0, status: '' });
    }
  };

  const handleRestoreVaultItem = async (item: LocalSnapshotVaultItem) => {
    setUploadedSnapshot(item.snapshot);
    const dryRun = await databaseBackupEngine.inspectBackupFile(JSON.stringify(item.snapshot));
    setDryRunResult(dryRun);
    setActiveView('restore');
    toast.info('Snapshot carregado no inspetor de restauração.');
  };

  const handleDeleteVaultItem = (id: string) => {
    if (confirm('Deseja excluir este snapshot do histórico local?')) {
      databaseBackupEngine.deleteVaultSnapshot(id);
      setVaultItems(databaseBackupEngine.getVaultSnapshots());
      toast.success('Snapshot removido.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-foreground flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Central de Backup & Migração da Database
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Crie snapshots integrais, exporte scripts SQL prontos e realize migrações zero-data-loss para novas contas Supabase.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-2xl border border-border/50 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveView('export')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeView === 'export'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Exportar / Snapshot
          </button>
          <button
            type="button"
            onClick={() => setActiveView('restore')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeView === 'restore'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Restaurar Base
          </button>
          <button
            type="button"
            onClick={() => setActiveView('migration')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeView === 'migration'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Migração Novo Supabase
          </button>
          <button
            type="button"
            onClick={() => setActiveView('vault')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeView === 'vault'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Histórico ({vaultItems.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: EXPORT & SNAPSHOT GENERATOR */}
      {activeView === 'export' && (
        <div className="space-y-6">
          <Card className="border-border/50 bg-background/60 shadow-xs">
            <CardContent className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
                <div>
                  <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    Seleção de Tabelas para Extração ({tables.length} tabelas suportadas)
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Selecione todas as tabelas para um backup integral ou marque módulos específicos.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchCounts}
                    disabled={isLoadingCounts}
                    className="h-8 rounded-xl font-bold text-xs border-border/60 hover:bg-muted gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCounts ? 'animate-spin' : ''}`} />
                    Atualizar Linhas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="h-8 rounded-xl font-bold text-xs border-border/60 hover:bg-muted cursor-pointer"
                  >
                    {selectedTables.length === tables.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                  </Button>
                </div>
              </div>

              {/* Table Checkbox Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {tables.map((t) => {
                  const isChecked = selectedTables.includes(t.tableName);
                  return (
                    <div
                      key={t.tableName}
                      onClick={() => handleToggleTable(t.tableName)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                        isChecked 
                          ? 'border-primary/50 bg-primary/5 shadow-2xs' 
                          : 'border-border/50 bg-muted/10 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-xs text-foreground leading-tight">
                          {t.displayName}
                        </span>
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center border text-[10px] shrink-0 ${
                          isChecked 
                            ? 'bg-primary border-primary text-primary-foreground font-black' 
                            : 'border-border/60 bg-background'
                        }`}>
                          {isChecked && '✓'}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px]">
                        <code className="text-[10px] text-muted-foreground font-mono bg-muted/40 px-1 py-0.5 rounded">
                          {t.tableName}
                        </code>
                        <span className="font-black text-foreground">
                          {liveCounts[t.tableName] ?? '...'} rows
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons & Progress */}
              {isExporting ? (
                <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-primary">{exportProgress.status}</span>
                    <span className="font-mono">{exportProgress.percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-primary/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300 rounded-full" 
                      style={{ width: `${exportProgress.percent}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="pt-3 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">{selectedTables.length}</span> de {tables.length} tabelas selecionadas para o snapshot.
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={handleExportSQL}
                      disabled={isExporting}
                      className="rounded-xl h-10 font-bold text-xs border-border/60 hover:bg-muted gap-1.5 cursor-pointer flex-1 sm:flex-none"
                    >
                      <FileCode className="w-4 h-4 text-amber-500" />
                      Gerar Script SQL (.sql)
                    </Button>

                    <Button
                      onClick={handleExportJSON}
                      disabled={isExporting}
                      className="rounded-xl h-10 font-bold text-xs shadow-md gap-1.5 cursor-pointer bg-primary text-primary-foreground flex-1 sm:flex-none"
                    >
                      <Download className="w-4 h-4" />
                      Baixar Snapshot JSON (.json)
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW 2: RESTORE & DRY RUN INSPECTOR */}
      {activeView === 'restore' && (
        <div className="space-y-6">
          <Card className="border-border/50 bg-background/60 shadow-xs">
            <CardContent className="p-6 space-y-5">
              <div>
                <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-500" />
                  Carregar Arquivo de Backup para Restauração
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Faça o upload do snapshot JSON. O sistema fará a inspeção preventiva de integridade antes de aplicar qualquer alteração.
                </p>
              </div>

              <div>
                <label className="w-full flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs cursor-pointer transition-all gap-2 text-center">
                  <HardDrive className="w-8 h-8 opacity-80" />
                  <span className="text-sm">Clique ou arraste o arquivo de backup (.json)</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    Formatos suportados: Snapshot v2.0 (Completo) ou Config v1.0
                  </span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Dry Run Inspector Panel */}
              {isInspecting && (
                <div className="p-4 rounded-2xl bg-muted/30 text-center text-xs font-bold text-muted-foreground animate-pulse">
                  Inspecionando integridade criptográfica e estrutura de dados...
                </div>
              )}

              {dryRunResult && (
                <div className="space-y-4 pt-4 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <h5 className="font-black text-sm text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      Diagnóstico Pré-Restauração (Dry Run)
                    </h5>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      dryRunResult.valid 
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                    }`}>
                      {dryRunResult.valid ? 'Arquivo Íntegro & Válido' : 'Incompatível / Erro'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                      <span className="text-muted-foreground text-[10px] block">Snapshot ID</span>
                      <span className="font-mono font-bold text-foreground truncate block">{dryRunResult.snapshotId}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                      <span className="text-muted-foreground text-[10px] block">Data do Backup</span>
                      <span className="font-bold text-foreground block">{new Date(dryRunResult.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                      <span className="text-muted-foreground text-[10px] block">Total de Registros</span>
                      <span className="font-black text-primary text-sm block">{dryRunResult.totalRecords}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/50">
                      <span className="text-muted-foreground text-[10px] block">Assinatura SHA-256</span>
                      <span className={`font-bold block ${dryRunResult.checksumValid ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {dryRunResult.checksumValid ? 'Válida' : 'Sem Assinatura / Modificado'}
                      </span>
                    </div>
                  </div>

                  {/* Table summary breakdown */}
                  <div>
                    <h6 className="text-xs font-bold text-muted-foreground mb-2">Tabelas Identificadas no Arquivo:</h6>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(dryRunResult.tables).map(([k, info]) => (
                        <div key={k} className="p-2.5 rounded-xl border border-border/40 bg-background/40 flex items-center justify-between text-xs">
                          <span className="truncate text-foreground font-medium pr-1">{info.name}</span>
                          <span className="font-mono font-black text-primary shrink-0">{info.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mode Selector & Execution Button */}
                  <div className="pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <span className="text-xs font-bold text-foreground">Modo de Restauração:</span>
                      <div className="flex items-center gap-1.5 p-1 bg-muted/30 rounded-xl border border-border/50">
                        <button
                          type="button"
                          onClick={() => setRestoreMode('merge')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                            restoreMode === 'merge' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
                          }`}
                        >
                          Mesclagem (Upsert)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestoreMode('replace')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                            restoreMode === 'replace' ? 'bg-rose-600 text-white shadow-xs' : 'text-muted-foreground'
                          }`}
                        >
                          Substituição
                        </button>
                      </div>
                    </div>

                    <Button
                      disabled={!dryRunResult.valid || isRestoring}
                      onClick={() => setConfirmRestoreOpen(true)}
                      className="rounded-xl h-10 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md gap-1.5 w-full sm:w-auto"
                    >
                      <RotateCcwIcon className="w-4 h-4" />
                      Iniciar Restauração Segura
                    </Button>
                  </div>
                </div>
              )}

              {/* Restore Progress Bar */}
              {isRestoring && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-emerald-600">{restoreProgress.status}</span>
                    <span className="font-mono">{restoreProgress.percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-emerald-500/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-600 transition-all duration-300 rounded-full" 
                      style={{ width: `${restoreProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW 3: NEW SUPABASE MIGRATION WIZARD */}
      {activeView === 'migration' && (
        <div className="space-y-6">
          {/* Card 1: Turnkey One-Click Migration Assets */}
          <Card className="border-border/50 bg-background/60 shadow-xs">
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/40">
                <div>
                  <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    Scripts de Migração para Novo Supabase (Setup do Zero)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gere o Schema DDL e o pacote completo de migração (18 tabelas, colunas, chaves primárias, índices e regras RLS).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold">
                    Zero Data Loss Engine v2.5
                  </span>
                </div>
              </div>

              {/* Fast Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* DDL Schema Option */}
                <div className="p-5 rounded-2xl border border-border/50 bg-muted/15 space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-primary" />
                        1. Schema DDL Limpo (Estrutura)
                      </span>
                      <code className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                        setup_supabase_schema.sql
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cria as 18 tabelas do zero, habilita UUIDs, adiciona índices de alta performance, ativa RLS e concede permissões universais. Ideal para rodar no novo projeto antes de importar dados.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyDDL}
                      className="rounded-xl font-bold text-xs border-border/60 hover:bg-muted gap-1.5 cursor-pointer flex-1"
                    >
                      {copiedDDL ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedDDL ? 'Copiado!' : 'Copiar DDL'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleDownloadDDL}
                      className="rounded-xl font-bold text-xs bg-primary text-primary-foreground gap-1.5 cursor-pointer flex-1 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar .sql
                    </Button>
                  </div>
                </div>

                {/* Unified All-in-One Migration Bundle */}
                <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Server className="w-4 h-4 text-emerald-600" />
                        2. Pacote Unificado (Schema + Dados Atuais)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Extrai instantaneamente toda a base atual e combina a criação do Schema DDL com os comandos de inserção idempotentes (<code className="text-[10px] font-mono">ON CONFLICT DO UPDATE</code>).
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-emerald-500/20">
                    <Button
                      size="sm"
                      disabled={isGeneratingFullMigration}
                      onClick={handleDownloadFullMigration}
                      className="rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer w-full shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {isGeneratingFullMigration ? 'Extraindo e Gerando...' : 'Baixar Migração Completa (.sql)'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Interactive Connection Tester */}
          <Card className="border-border/50 bg-background/60 shadow-xs">
            <CardContent className="p-6 space-y-5">
              <div className="pb-3 border-b border-border/40">
                <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Validador de Conexão com o Novo Supabase
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Teste as credenciais da nova conta/servidor antes de aplicar no arquivo de ambiente (<code className="text-[11px] font-mono">.env</code>).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Nova Supabase URL</label>
                  <input
                    type="text"
                    value={newSupabaseUrl}
                    onChange={(e) => setNewSupabaseUrl(e.target.value)}
                    placeholder="https://exemplo-novo-projeto.supabase.co"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Nova Anon Public Key</label>
                  <input
                    type="password"
                    value={newSupabaseAnonKey}
                    onChange={(e) => setNewSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-muted-foreground">
                  As chaves são testadas exclusivamente no navegador do seu dispositivo e nunca são salvas sem sua autorização.
                </span>
                <Button
                  onClick={handleTestNewConnection}
                  disabled={isTestingConnection}
                  className="rounded-xl h-9 font-bold text-xs bg-primary text-primary-foreground gap-1.5 cursor-pointer shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
                  {isTestingConnection ? 'Verificando...' : 'Testar Conexão Agora'}
                </Button>
              </div>

              {/* Connection Diagnostics Output */}
              {connectionTestResult && (
                <div className={`p-4 rounded-2xl border text-xs space-y-3 ${
                  connectionTestResult.success 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                }`}>
                  <div className="flex items-start gap-2">
                    {connectionTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-black block">{connectionTestResult.message}</span>
                      <span className="text-[11px] opacity-80 mt-0.5 block">
                        Latência: {connectionTestResult.latencyMs}ms | Tabelas detectadas: {connectionTestResult.detectedTables.length} / {connectionTestResult.detectedTables.length + connectionTestResult.missingTables.length}
                      </span>
                    </div>
                  </div>

                  {connectionTestResult.missingTables.length > 0 && (
                    <div className="pt-2 border-t border-border/30">
                      <span className="font-bold text-[11px] block mb-1">Tabelas pendentes de criação no novo banco:</span>
                      <div className="flex flex-wrap gap-1">
                        {connectionTestResult.missingTables.map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-background/50 font-mono text-[10px]">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: 6-Phase Step-by-Step Migration Guide */}
          <Card className="border-border/50 bg-background/60 shadow-xs">
            <CardContent className="p-6 space-y-5">
              <div>
                <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Plano Passo a Passo para Migração Sem Perda de Dados
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Siga esta sequência rigorosa para trocar o servidor do banco de dados com segurança total.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl border border-border/50 bg-background/40 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-xs text-foreground block">
                      Extração e Salvamento do Backup da Base Atual
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Baixe o <strong>Pacote Unificado (.sql)</strong> e o <strong>Snapshot JSON (.json)</strong> clicando nos botões acima. Salve ambos em uma pasta segura ou no seu Google Drive.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-border/50 bg-background/40 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-xs text-foreground block">
                      Criação do Novo Projeto no Supabase
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Acesse <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold inline-flex items-center gap-1">supabase.com/dashboard <ExternalLink className="w-3 h-3" /></a>, crie um novo projeto, defina uma senha forte de banco de dados e selecione a região desejada (ex: São Paulo <code className="text-[10px] font-mono">sa-east-1</code>).
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-border/50 bg-background/40 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-xs text-foreground block">
                      Executar o Script no SQL Editor do Novo Supabase
                    </span>
                    <p className="text-xs text-muted-foreground">
                      No painel do novo projeto, vá no menu lateral em <strong>SQL Editor</strong> &rarr; <strong>New query</strong>. Cole o conteúdo de <code className="text-[10px] font-mono bg-muted/40 px-1 py-0.5 rounded">setup_supabase_schema.sql</code> (ou do pacote completo de migração) e clique em <strong>RUN</strong>. Isso criará todas as 18 tabelas, índices e políticas de segurança.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-border/50 bg-background/40 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-xs text-foreground block">
                      Importar os Dados (Caso tenha rodado apenas o DDL)
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Se você executou apenas o Schema DDL no passo 3, basta rodar o arquivo de dados <code className="text-[10px] font-mono bg-muted/40 px-1 py-0.5 rounded">dump_dados_postgresql.sql</code> no SQL Editor ou usar a aba <strong>Restaurar Base</strong> carregando o arquivo JSON.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-border/50 bg-background/40 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    5
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-xs text-foreground block">
                      Testar a Nova Base no Validador
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Copie a <strong>Project URL</strong> e a <strong>anon public key</strong> em <i>Project Settings &rarr; API</i> do novo Supabase, cole no validador desta tela e confirme se todas as 18 tabelas respondem com sucesso.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-border/50 bg-background/40 flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    6
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-xs text-foreground block">
                      Apontar a Aplicação para a Nova Database
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Atualize as variáveis <code className="text-[10px] font-mono bg-muted/40 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> e <code className="text-[10px] font-mono bg-muted/40 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> no seu arquivo <code className="text-[10px] font-mono">.env</code> de produção. Pronto! Sua aplicação estará rodando no novo servidor com 100% dos dados intactos.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW 4: SNAPSHOT VAULT & HISTORY */}
      {activeView === 'vault' && (
        <Card className="border-border/50 bg-background/60 shadow-xs">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div>
                <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Cofre Local de Snapshots de Segurança ({vaultItems.length})
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Snapshots retidos no navegador para restauração rápida e rollback instantâneo.
                </p>
              </div>

              {vaultItems.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Deseja limpar todos os snapshots do histórico local?')) {
                      databaseBackupEngine.clearVault();
                      setVaultItems([]);
                      toast.success('Cofre limpo com sucesso.');
                    }
                  }}
                  className="h-8 rounded-xl font-bold text-xs border-border/60 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                >
                  Limpar Cofre
                </Button>
              )}
            </div>

            {vaultItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Nenhum snapshot armazenado no cofre local. Exporte um snapshot para começar o histórico.
              </div>
            ) : (
              <div className="space-y-3">
                {vaultItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-border/50 bg-background/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-primary/40"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground">
                          {new Date(item.timestamp).toLocaleString('pt-BR')}
                        </span>
                        {item.isAutoBackup && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold">
                            Auto Rollback
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                          {item.totalRecords} registros
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate max-w-lg">
                        {item.tablesSummary || 'Todas as tabelas'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => databaseBackupEngine.downloadSnapshotJSON(item.snapshot)}
                        className="h-8 rounded-xl font-bold text-xs border-border/60 hover:bg-muted gap-1 cursor-pointer"
                        title="Baixar Arquivo JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                        JSON
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => databaseBackupEngine.downloadSQLDump(item.snapshot)}
                        className="h-8 rounded-xl font-bold text-xs border-border/60 hover:bg-muted gap-1 cursor-pointer"
                        title="Baixar Script SQL"
                      >
                        <FileCode className="w-3.5 h-3.5 text-amber-500" />
                        SQL
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleRestoreVaultItem(item)}
                        className="h-8 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 cursor-pointer shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Restaurar
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteVaultItem(item.id)}
                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmRestoreOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background border border-border/60 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1.5">
                <h4 className="text-base font-black text-foreground">Confirmar Restauração do Banco?</h4>
                <p className="text-xs text-muted-foreground">
                  Esta operação sincronizará {dryRunResult?.totalRecords} registros diretamente no cluster Supabase no modo{' '}
                  <span className="font-bold text-foreground">
                    [{restoreMode === 'merge' ? 'Mesclagem / Upsert' : 'Substituição'}]
                  </span>.
                  Um ponto de rollback de segurança será criado automaticamente.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirmRestoreOpen(false)}
                  className="flex-1 rounded-xl h-10 font-bold text-xs border-border/60 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={executeRestore}
                  className="flex-1 rounded-xl h-10 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md"
                >
                  Confirmar & Restaurar
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RotateCcwIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
