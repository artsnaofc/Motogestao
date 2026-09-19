import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  Download, 
  Upload, 
  Radio, 
  ShieldCheck, 
  Fuel, 
  Gauge, 
  Target, 
  Pizza, 
  TrendingUp, 
  Lock, 
  Globe, 
  AlertTriangle,
  Info,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
  Layers,
  Clock,
  Eye
} from 'lucide-react';
import { systemSettings, SystemConfig } from '../../lib/systemSettings';
import { toast } from '@/lib/toast';
import { DatabaseBackupSuite } from './DatabaseBackupSuite';

export function SystemSettingsTab() {
  const [config, setConfig] = useState<SystemConfig>(() => systemSettings.getConfig());
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'operational' | 'market' | 'security' | 'broadcast' | 'backup'>('general');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) {
        setConfig(e.detail);
      }
    };
    window.addEventListener('system-config-changed', handleUpdate);
    return () => window.removeEventListener('system-config-changed', handleUpdate);
  }, []);

  const handleChange = <K extends keyof SystemConfig>(key: K, value: SystemConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleBannerChange = (field: keyof SystemConfig['broadcastBanner'], value: any) => {
    setConfig(prev => ({
      ...prev,
      broadcastBanner: {
        ...prev.broadcastBanner,
        [field]: value,
      }
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      systemSettings.updateConfig(config, 'Administrador');
      toast.success('Configurações salvas e aplicadas!', {
        description: 'Os parâmetros globais do sistema foram atualizados com sucesso.',
      });
    } catch (e: any) {
      toast.error('Erro ao salvar configurações', { description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Tem certeza que deseja redefinir todas as configurações do sistema para os padrões originais?')) {
      const def = systemSettings.resetToDefaults('Administrador');
      setConfig(def);
      toast.success('Configurações redefinidas para o padrão.');
    }
  };

  const handleExport = () => {
    const jsonStr = systemSettings.exportConfigJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `configuracao_sistema_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Arquivo de configuração exportado!');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (systemSettings.importConfigJSON(content, 'Administrador')) {
        setConfig(systemSettings.getConfig());
        toast.success('Configurações importadas e aplicadas!');
      } else {
        toast.error('Falha ao importar: arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Configurações Globais do Sistema
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie políticas globais, parâmetros operacionais padrão, integrações e comunicados.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="rounded-xl h-10 font-bold text-xs border-border/60 hover:bg-muted gap-1.5 cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Redefinir Padrões
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl h-10 font-bold text-xs shadow-md gap-1.5 cursor-pointer bg-primary text-primary-foreground"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-1.5 p-1 bg-muted/20 border border-border/50 rounded-2xl">
        <button
          onClick={() => setActiveSubTab('general')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'general'
              ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-primary" />
          Plataforma & Geral
        </button>

        <button
          onClick={() => setActiveSubTab('operational')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'operational'
              ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <Fuel className="w-3.5 h-3.5 text-amber-500" />
          Políticas Operacionais
        </button>

        <button
          onClick={() => setActiveSubTab('market')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'market'
              ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
          Mercado & Cotações
        </button>

        <button
          onClick={() => setActiveSubTab('security')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'security'
              ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-emerald-500" />
          Segurança & Acessos
        </button>

        <button
          onClick={() => setActiveSubTab('broadcast')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'broadcast'
              ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-rose-500" />
          Comunicado Global
        </button>

        <button
          onClick={() => setActiveSubTab('backup')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'backup'
              ? 'bg-background text-foreground shadow-xs border border-border/60 font-black'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
          Backup & Restauração
        </button>
      </div>

      {/* Tab 1: General & Platform */}
      {activeSubTab === 'general' && (
        <Card className="border-border/50 bg-background/60 shadow-xs">
          <CardContent className="p-6 space-y-5 text-xs">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-sm font-black text-foreground">Identidade & Ambiente da Aplicação</h3>
              <p className="text-muted-foreground text-[11px]">Parâmetros gerais de identificação e internacionalização.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome da Instância</label>
                <Input
                  value={config.appName}
                  onChange={e => handleChange('appName', e.target.value)}
                  className="h-10 rounded-xl bg-muted/30 border-border/60 font-bold"
                  placeholder="Finanças Pro"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Moeda Padrão</label>
                <Select
                  value={config.defaultCurrency}
                  onValueChange={(val: any) => handleChange('defaultCurrency', val)}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60 font-bold">
                    <SelectValue placeholder="Selecione a moeda" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60">
                    <SelectItem value="BRL">BRL - Real Brasileiro (R$)</SelectItem>
                    <SelectItem value="USD">USD - Dólar Americano ($)</SelectItem>
                    <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fuso Horário Padrão</label>
                <Select
                  value={config.timezone}
                  onValueChange={val => handleChange('timezone', val)}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono">
                    <SelectValue placeholder="Selecione o fuso" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60">
                    <SelectItem value="America/Sao_Paulo">America/Sao_Paulo (GMT-3)</SelectItem>
                    <SelectItem value="America/Manaus">America/Manaus (GMT-4)</SelectItem>
                    <SelectItem value="America/Fortaleza">America/Fortaleza (GMT-3)</SelectItem>
                    <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                    <SelectItem value="UTC">UTC Universal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Idioma do Sistema</label>
                <Select
                  value={config.defaultLanguage}
                  onValueChange={(val: any) => handleChange('defaultLanguage', val)}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60 font-bold">
                    <SelectValue placeholder="Selecione o idioma" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60">
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="es-ES">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Maintenance Mode & Public Signups Switches */}
            <div className="pt-4 border-t border-border/40 space-y-3">
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-foreground block">Modo de Manutenção do Sistema</span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    Quando ativado, restringe o acesso para usuários não-administradores exibindo mensagem informativa.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange('maintenanceMode', !config.maintenanceMode)}
                  className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer relative ${
                    config.maintenanceMode ? 'bg-amber-500' : 'bg-muted border border-border/60'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-background shadow-xs transition-transform ${
                      config.maintenanceMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {config.maintenanceMode && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 animate-in fade-in">
                  <label className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                    Mensagem de Manutenção Exibida aos Usuários:
                  </label>
                  <Input
                    value={config.maintenanceMessage}
                    onChange={e => handleChange('maintenanceMessage', e.target.value)}
                    className="h-10 rounded-xl bg-background border-amber-500/40 text-xs font-medium"
                    placeholder="Descreva a manutenção..."
                  />
                </div>
              )}

              <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-foreground block">Cadastro Público Liberado</span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    Permite que novos motoristas criem contas livremente na tela inicial sem necessidade de convite prévio.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange('publicSignupEnabled', !config.publicSignupEnabled)}
                  className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer relative ${
                    config.publicSignupEnabled ? 'bg-primary' : 'bg-muted border border-border/60'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-background shadow-xs transition-transform ${
                      config.publicSignupEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Operational Policies */}
      {activeSubTab === 'operational' && (
        <Card className="border-border/50 bg-background/60 shadow-xs">
          <CardContent className="p-6 space-y-5 text-xs">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-sm font-black text-foreground">Parâmetros Operacionais Globais (Fallbacks Padrão)</h3>
              <p className="text-muted-foreground text-[11px]">
                Valores de referência sugeridos automaticamente para novos membros que não customizarem seus perfis.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Fuel className="w-3.5 h-3.5 text-amber-500" />
                  Preço Gasolina Padrão (R$/L)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.defaultFuelPrice}
                  onChange={e => handleChange('defaultFuelPrice', parseFloat(e.target.value) || 0)}
                  className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-indigo-500" />
                  Autonomia Média (km/L)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={config.defaultKmPerLiter}
                  onChange={e => handleChange('defaultKmPerLiter', parseFloat(e.target.value) || 0)}
                  className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  Mão de Obra Diária (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.defaultDriverLabor}
                  onChange={e => handleChange('defaultDriverLabor', parseFloat(e.target.value) || 0)}
                  className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-amber-500" />
                  Meta Semanal Bruta Padrão (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.defaultWeeklyGoal}
                  onChange={e => handleChange('defaultWeeklyGoal', parseFloat(e.target.value) || 0)}
                  className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-emerald-500" />
                  Meta Semanal Líquida (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={config.defaultWeeklyNetGoal}
                  onChange={e => handleChange('defaultWeeklyNetGoal', parseFloat(e.target.value) || 0)}
                  className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                />
              </div>
            </div>

            {/* Pizzaria Default Rates */}
            <div className="pt-4 border-t border-border/40 space-y-3">
              <div className="flex items-center gap-2">
                <Pizza className="w-4 h-4 text-rose-500" />
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider">Tabela Global de Pizzaria</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Entregas na Base (Franquia)</label>
                  <Input
                    type="number"
                    value={config.pizzariaBaseDeliveries}
                    onChange={e => handleChange('pizzariaBaseDeliveries', parseInt(e.target.value) || 0)}
                    className="h-9 rounded-xl bg-muted/30 border-border/60 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Diária Base (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.pizzariaBaseRate}
                    onChange={e => handleChange('pizzariaBaseRate', parseFloat(e.target.value) || 0)}
                    className="h-9 rounded-xl bg-muted/30 border-border/60 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Diária Acima da Base (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.pizzariaDailyRateAboveBase}
                    onChange={e => handleChange('pizzariaDailyRateAboveBase', parseFloat(e.target.value) || 0)}
                    className="h-9 rounded-xl bg-muted/30 border-border/60 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Taxa por Entrega (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.pizzariaDeliveryRate}
                    onChange={e => handleChange('pizzariaDeliveryRate', parseFloat(e.target.value) || 0)}
                    className="h-9 rounded-xl bg-muted/30 border-border/60 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Adicional Fora do Bairro (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.pizzariaOutOfNeighborhoodRate}
                    onChange={e => handleChange('pizzariaOutOfNeighborhoodRate', parseFloat(e.target.value) || 0)}
                    className="h-9 rounded-xl bg-muted/30 border-border/60 font-mono"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Market & Quotes */}
      {activeSubTab === 'market' && (
        <Card className="border-border/50 bg-background/60 shadow-xs">
          <CardContent className="p-6 space-y-5 text-xs">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-sm font-black text-foreground">Integração com Mercado & Cotações B3</h3>
              <p className="text-muted-foreground text-[11px]">
                Definições de provedores de cotações em tempo real para ações, fundos imobiliários e BDRs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Provedor Padrão do Sistema</label>
                <Select
                  value={config.defaultQuoteProvider}
                  onValueChange={(val: any) => handleChange('defaultQuoteProvider', val)}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60 font-bold">
                    <SelectValue placeholder="Selecione o provedor" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60">
                    <SelectItem value="auto">Automático (Auto Failover Inteligente)</SelectItem>
                    <SelectItem value="brapi">Brapi (API B3 Oficial)</SelectItem>
                    <SelectItem value="yahoo">Yahoo Finance Global</SelectItem>
                    <SelectItem value="hgbrasil">HG Brasil Finance</SelectItem>
                    <SelectItem value="mfinance">MFinance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Token Brapi Global (Fallback)</label>
                <Input
                  type="password"
                  value={config.brapiGlobalToken}
                  onChange={e => handleChange('brapiGlobalToken', e.target.value)}
                  placeholder="Chave API mestra da plataforma"
                  className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tempo de Cache das Cotações (Minutos)</label>
                <Input
                  type="number"
                  min="1"
                  max="1440"
                  value={config.quoteCacheTtlMinutes}
                  onChange={e => handleChange('quoteCacheTtlMinutes', parseInt(e.target.value) || 15)}
                  className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                />
                <p className="text-[10px] text-muted-foreground">Evita excesso de requisições às APIs de mercado.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Limite de Tickers por Requisição em Lote</label>
                <Input
                  type="number"
                  min="5"
                  max="50"
                  value={config.batchSizeLimit}
                  onChange={e => handleChange('batchSizeLimit', parseInt(e.target.value) || 20)}
                  className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border/40">
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-foreground block">Atualização Automática em Horário de Pregão</span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    Permite atualização suave de preços entre 10:00 e 17:00 (dias úteis) ao visitar a tela de investimentos.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange('autoRefreshMarketHours', !config.autoRefreshMarketHours)}
                  className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer relative ${
                    config.autoRefreshMarketHours ? 'bg-primary' : 'bg-muted border border-border/60'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-background shadow-xs transition-transform ${
                      config.autoRefreshMarketHours ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Security & Access */}
      {activeSubTab === 'security' && (
        <Card className="border-border/50 bg-background/60 shadow-xs">
          <CardContent className="p-6 space-y-5 text-xs">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-sm font-black text-foreground">Políticas de Segurança & Auditoria</h3>
              <p className="text-muted-foreground text-[11px]">
                Definição de parâmetros de sessão, proteção contra tentativas excessivas e níveis de auditoria.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Timeout de Sessão Inativa (Minutos)</label>
                <Input
                  type="number"
                  min="15"
                  max="1440"
                  value={config.sessionTimeoutMinutes}
                  onChange={e => handleChange('sessionTimeoutMinutes', parseInt(e.target.value) || 120)}
                  className="h-10 rounded-xl bg-muted/30 border-border/60 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nível de Detalhamento dos Logs</label>
                <Select
                  value={config.auditLogLevel}
                  onValueChange={(val: any) => handleChange('auditLogLevel', val)}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60 font-bold">
                    <SelectValue placeholder="Selecione o nível" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60">
                    <SelectItem value="verbose">Verbose (Audita tudo)</SelectItem>
                    <SelectItem value="standard">Padrão (Ações críticas & alterações)</SelectItem>
                    <SelectItem value="minimal">Mínimo (Apenas erros e bloqueios)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-4 border-t border-border/40 space-y-3">
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-foreground block">Exigir Senhas Fortes</span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    Obriga o uso de ao menos 8 caracteres com letras e números no cadastro de membros.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange('enforceStrongPassword', !config.enforceStrongPassword)}
                  className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer relative ${
                    config.enforceStrongPassword ? 'bg-primary' : 'bg-muted border border-border/60'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-background shadow-xs transition-transform ${
                      config.enforceStrongPassword ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-foreground block">Restringir Console de Debug a Super Admins</span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    Bloqueia o atalho secreto (3 cliques na logo) para usuários sem privilégio administrativo.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleChange('restrictDebugConsoleToSuperAdmin', !config.restrictDebugConsoleToSuperAdmin)}
                  className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer relative ${
                    config.restrictDebugConsoleToSuperAdmin ? 'bg-primary' : 'bg-muted border border-border/60'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-background shadow-xs transition-transform ${
                      config.restrictDebugConsoleToSuperAdmin ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Broadcast Announcement Banner */}
      {activeSubTab === 'broadcast' && (
        <Card className="border-border/50 bg-background/60 shadow-xs">
          <CardContent className="p-6 space-y-5 text-xs">
            <div className="border-b border-border/40 pb-3">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-500" />
                Comunicado & Alerta Global em Tempo Real
              </h3>
              <p className="text-muted-foreground text-[11px]">
                Exibe um banner de aviso no topo da aplicação para todos os membros ativos.
              </p>
            </div>

            {/* Toggle Banner Active */}
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-foreground block">Status do Banner de Comunicado</span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  Ative para tornar o comunicado visível imediatamente em todas as telas.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleBannerChange('enabled', !config.broadcastBanner.enabled)}
                className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer relative ${
                  config.broadcastBanner.enabled ? 'bg-emerald-500' : 'bg-muted border border-border/60'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-background shadow-xs transition-transform ${
                    config.broadcastBanner.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de Alerta</label>
                <Select
                  value={config.broadcastBanner.type}
                  onValueChange={(val: any) => handleBannerChange('type', val)}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60 font-bold">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60">
                    <SelectItem value="info">Informativo (Azul/Índigo)</SelectItem>
                    <SelectItem value="warning">Aviso / Manutenção (Âmbar)</SelectItem>
                    <SelectItem value="success">Sucesso / Novidade (Verde)</SelectItem>
                    <SelectItem value="critical">Crítico / Urgente (Vermelho)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Título do Aviso</label>
                <Input
                  value={config.broadcastBanner.title}
                  onChange={e => handleBannerChange('title', e.target.value)}
                  placeholder="Ex: Atualização Programada"
                  className="h-10 rounded-xl bg-muted/30 border-border/60 font-bold"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mensagem do Comunicado</label>
                <Input
                  value={config.broadcastBanner.message}
                  onChange={e => handleBannerChange('message', e.target.value)}
                  placeholder="Ex: Nova funcionalidade de cálculo automático de reservas liberada!"
                  className="h-10 rounded-xl bg-muted/30 border-border/60 font-medium"
                />
              </div>
            </div>

            {/* Live Preview Box */}
            <div className="pt-4 border-t border-border/40 space-y-2">
              <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-primary" />
                Pré-visualização do Banner
              </span>

              <div className={`p-3.5 rounded-2xl border ${
                config.broadcastBanner.type === 'warning' ? 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-200' :
                config.broadcastBanner.type === 'critical' ? 'bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-200' :
                config.broadcastBanner.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-200' :
                'bg-indigo-500/15 border-indigo-500/30 text-indigo-800 dark:text-indigo-200'
              } flex items-center justify-between gap-3`}>
                <div className="flex items-center gap-2 min-w-0">
                  {config.broadcastBanner.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                  {config.broadcastBanner.type === 'critical' && <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0" />}
                  {config.broadcastBanner.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                  {config.broadcastBanner.type === 'info' && <Info className="w-4 h-4 text-indigo-500 shrink-0" />}
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {config.broadcastBanner.title && (
                      <span className="font-black uppercase text-[10px] px-1.5 py-0.5 rounded bg-background/50 border border-current/20">
                        {config.broadcastBanner.title}
                      </span>
                    )}
                    <span className="font-medium text-xs">
                      {config.broadcastBanner.message || 'Digite uma mensagem acima para visualizar...'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] opacity-60 font-bold">Preview</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 6: Backup & Restoration */}
      {activeSubTab === 'backup' && (
        <div className="space-y-6">
          <DatabaseBackupSuite />
        </div>
      )}
    </div>
  );
}
