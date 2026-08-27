import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  Download, 
  Upload, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  FileCode, 
  FileJson, 
  Layers, 
  HardDrive, 
  Clock, 
  RefreshCw,
  Trash2,
  Lock,
  Search,
  ArrowRight,
  Eye,
  Info
} from 'lucide-react';
import { 
  databaseBackupEngine, 
  DatabaseSnapshot, 
  DryRunResult, 
  LocalSnapshotVaultItem,
  TableBackupMetadata
} from '../../lib/databaseBackup';
import { systemSettings } from '../../lib/systemSettings';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export function DatabaseBackupSuite() {
  const [activeView, setActiveView] = useState<'export' | 'restore' | 'vault'>('export');
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
            Central de Backup & Restauração da Database
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Crie snapshots integrais do banco de dados, exporte scripts SQL e restaure dados com rollback de segurança.
          </p>
        </div>

        <div className="flex items-center gap-2 p-1 bg-muted/40 rounded-2xl border border-border/50">
          <button
            type="button"
            onClick={() => setActiveView('export')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeView === 'restore'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Restaurar Base
          </button>
          <button
            type="button"
            onClick={() => setActiveView('vault')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
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
          {/* Table Selector Card */}
          <Card className="border-border/50 bg-background/60 shadow-xs">
            <CardContent className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
                <div>
                  <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    Seleção de Tabelas para Extração
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
          {/* Upload Card */}
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

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/40">
                      <span className="text-[10px] text-muted-foreground font-bold block uppercase">Snapshot ID</span>
                      <span className="font-mono font-bold text-foreground truncate block">{dryRunResult.snapshotId}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/40">
                      <span className="text-[10px] text-muted-foreground font-bold block uppercase">Data de Criação</span>
                      <span className="font-bold text-foreground truncate block">{new Date(dryRunResult.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/40">
                      <span className="text-[10px] text-muted-foreground font-bold block uppercase">Autor</span>
                      <span className="font-bold text-foreground truncate block">{dryRunResult.createdBy}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/40">
                      <span className="text-[10px] text-muted-foreground font-bold block uppercase">Total de Linhas</span>
                      <span className="font-black text-primary truncate block">{dryRunResult.totalRecords} registros</span>
                    </div>
                  </div>

                  {/* Tables Breakdown */}
                  <div className="p-3.5 rounded-2xl bg-muted/10 border border-border/50 space-y-2">
                    <span className="text-[11px] font-black text-foreground block">
                      Detalhamento de Linhas por Tabela no Snapshot:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(dryRunResult.tables).map(([key, info]) => (
                        <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/40 text-[11px]">
                          <span className="font-medium text-muted-foreground">{info.name}</span>
                          <span className="font-black text-foreground font-mono">{info.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Warnings & Errors */}
                  {dryRunResult.warnings.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                      {dryRunResult.warnings.map((w, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Restoration Mode Selector */}
                  <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-3">
                    <span className="text-xs font-black text-foreground block">Estratégia de Restauração:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        onClick={() => setRestoreMode('merge')}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          restoreMode === 'merge'
                            ? 'border-primary bg-primary/10 shadow-xs'
                            : 'border-border/60 bg-background opacity-70'
                        }`}
                      >
                        <span className="font-bold text-xs text-foreground block">Mesclagem / Upsert (Recomendado)</span>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">
                          Insere novos registros e atualiza os existentes pela chave primária (ID), sem apagar outros registros não presentes no backup.
                        </span>
                      </div>

                      <div
                        onClick={() => setRestoreMode('replace')}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          restoreMode === 'replace'
                            ? 'border-rose-500 bg-rose-500/10 shadow-xs'
                            : 'border-border/60 bg-background opacity-70'
                        }`}
                      >
                        <span className="font-bold text-xs text-foreground block text-rose-500">Substituição Completa</span>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">
                          Aplica os registros sobrescrevendo as tabelas selecionadas. Um ponto de restauração automático será gerado previamente.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Execute Button */}
                  {isRestoring ? (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-emerald-600">{restoreProgress.status}</span>
                        <span className="font-mono">{restoreProgress.percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-emerald-500/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-300 rounded-full" 
                          style={{ width: `${restoreProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setUploadedSnapshot(null);
                          setDryRunResult(null);
                        }}
                        className="rounded-xl h-10 font-bold text-xs border-border/60 cursor-pointer"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={() => setConfirmRestoreOpen(true)}
                        disabled={!dryRunResult.valid}
                        className="rounded-xl h-10 font-bold text-xs shadow-md gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Upload className="w-4 h-4" />
                        Executar Restauração no Banco de Dados
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW 3: LOCAL SNAPSHOT VAULT */}
      {activeView === 'vault' && (
        <Card className="border-border/50 bg-background/60 shadow-xs">
          <CardContent className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
              <div>
                <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Cofre Local de Snapshots & Rollback
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Pontos de restauração recentes gerados automaticamente antes de alterações críticas ou exportações manuais.
                </p>
              </div>

              {vaultItems.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Deseja limpar todo o cofre de snapshots locais?')) {
                      databaseBackupEngine.clearVault();
                      setVaultItems([]);
                      toast.success('Cofre limpo com sucesso.');
                    }
                  }}
                  className="h-8 rounded-xl font-bold text-xs text-rose-500 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar Cofre
                </Button>
              )}
            </div>

            {vaultItems.length === 0 ? (
              <div className="p-8 text-center space-y-2 rounded-2xl bg-muted/10 border border-border/40">
                <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                <p className="text-xs font-bold text-foreground">Nenhum snapshot no cofre local</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  Gere um novo backup na aba &quot;Exportar / Snapshot&quot; para que uma cópia de segurança seja armazenada aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {vaultItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-muted/20 border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-muted/30"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-foreground font-mono">{item.id}</span>
                        {item.isAutoBackup ? (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            Auto-Rollback
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
                            Manual
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(item.timestamp).toLocaleString('pt-BR')} • por {item.createdBy}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">
                        {item.totalRecords} registros • {item.tablesSummary}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
