import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Zap,
  Check,
  Key,
  RefreshCw,
  Sparkles,
  Activity,
  ShieldCheck,
  ExternalLink,
  Globe,
  Layers,
  Info,
  CheckCircle2,
  X,
  SlidersHorizontal,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { QuoteProvider, QuoteFetchResult } from '../../lib/quoteService';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface QuoteProviderSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuoteProviderSelectorModal({ open, onOpenChange }: QuoteProviderSelectorModalProps) {
  const { settings, fetchQuotes, isFetchingQuotes, lastQuoteFetchResult, refreshData } = useData();
  const [selectedProvider, setSelectedProvider] = useState<QuoteProvider>(settings?.quote_provider || 'auto');
  const [brapiToken, setBrapiToken] = useState<string>(settings?.brapi_token || '');
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState(false);
  const [localTestResult, setLocalTestResult] = useState<QuoteFetchResult | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'recommended' | 'no_token'>('all');

  // Keep local modal state synchronized with settings whenever modal opens or settings change
  useEffect(() => {
    if (open) {
      setSelectedProvider(settings?.quote_provider || 'auto');
      setBrapiToken(settings?.brapi_token || '');
      setLocalTestResult(null);
    }
  }, [open, settings]);

  const providersList: {
    id: QuoteProvider;
    name: string;
    tag: string;
    description: string;
    badge: string;
    speed: string;
    features: string[];
    isRecommended?: boolean;
    requiresTokenForFii?: boolean;
  }[] = [
    {
      id: 'auto',
      name: 'Multi-Fonte Automático',
      tag: 'RECOMENDADO',
      description: 'Arquitetura híbrida no servidor sem bloqueios de CORS. Unifica dados de múltiplos servidores com alternância automática em caso de oscilação.',
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      speed: 'Instantâneo (~0.2s)',
      features: ['Ações B3', 'FIIs (MXRF11, HGLG11, etc)', 'BDRs & ETFs', 'Fallback Inteligente'],
      isRecommended: true,
    },
    {
      id: 'yahoo',
      name: 'Yahoo Finance B3',
      tag: 'GLOBAL & ILIMITADO',
      description: 'Fonte global de alta precisão para todo o mercado B3 (.SA). Suporte nativo e completo para Ações, FIIs e ETFs sem necessidade de API Key.',
      badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
      speed: 'Rápido (~0.3s)',
      features: ['Ações B3', 'Fundos Imobiliários', 'BDRs & ETFs', 'Sem Limites'],
      isRecommended: true,
    },
    {
      id: 'mfinance',
      name: 'mFinance API',
      tag: 'ESPECIALISTA FIIs',
      description: 'API brasileira focada no mercado nacional com altíssima taxa de acerto para Fundos Imobiliários e Ações.',
      badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
      speed: 'Rápido (~0.5s)',
      features: ['Ações B3', 'Fundos Imobiliários (FIIs)', 'Respostas Diretas'],
    },
    {
      id: 'brapi',
      name: 'Brapi API (Brapi.dev)',
      tag: 'API NACIONAL',
      description: 'API rápida para Ações brasileiras. Para consultar FIIs com a Brapi, basta informar seu token gratuito do site brapi.dev.',
      badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
      speed: 'Rápido (~0.6s)',
      features: ['Ações B3', 'FIIs (Requer Token)', 'Suporte a Token'],
      requiresTokenForFii: true,
    },
    {
      id: 'hgbrasil',
      name: 'HG Brasil Finance',
      tag: 'NACIONAL',
      description: 'Serviço tradicional de dados financeiros para Ações do mercado B3.',
      badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      speed: 'Moderado (~1.2s)',
      features: ['Ações B3', 'Mercado Financeiro'],
    },
  ];

  const filteredProviders = providersList.filter((p) => {
    if (filterCategory === 'recommended') return p.isRecommended;
    if (filterCategory === 'no_token') return !p.requiresTokenForFii;
    return true;
  });

  const handleTestConnection = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTestingProvider(true);
    try {
      const cleanToken = brapiToken.trim();
      toast.info(`Testando conexão via ${selectedProvider.toUpperCase()}...`);
      
      // Execute test quote fetch passing current selected provider and token
      const res = await fetchQuotes(selectedProvider, cleanToken);
      if (res) {
        setLocalTestResult(res);
        if (res.successCount > 0) {
          toast.success(`Teste concluído! ${res.successCount} cotação(ões) obtida(s) em ${res.durationMs}ms via ${res.providerUsed}`);
        } else {
          toast.warning(`Teste finalizado. Nenhuma cotação obtida via ${selectedProvider.toUpperCase()}. Verifique se o token Brapi é necessário.`);
        }
      }
    } catch (err: any) {
      toast.error('Falha ao testar fonte de cotações: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setTestingProvider(false);
    }
  };

  const handleSaveAndFetch = async () => {
    setSaving(true);
    try {
      const cleanToken = brapiToken.trim() || null;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (userId) {
        const newSettingsPayload = {
          ...(settings || {}),
          user_id: userId,
          quote_provider: selectedProvider,
          brapi_token: cleanToken,
          updated_at: new Date().toISOString(),
        };

        // 1. Save to Supabase
        const { error } = await supabase
          .from('user_settings')
          .upsert(newSettingsPayload, { onConflict: 'user_id' });

        if (error) {
          console.warn('[QuoteProviderModal] Supabase save warning (fallback to local):', error.message);
        }

        // 2. Unconditionally update LocalStorage for reliable client persistence
        const localKey = `user_settings_${userId}`;
        try {
          const existing = localStorage.getItem(localKey);
          const parsed = existing ? JSON.parse(existing) : {};
          localStorage.setItem(localKey, JSON.stringify({ ...parsed, ...newSettingsPayload }));
        } catch (err) {
          console.warn('[QuoteProviderModal] LocalStorage error:', err);
        }

        // 3. Refresh React Context settings state
        await refreshData(true);
      }

      toast.success('Fonte de cotações salva! Atualizando preços...');
      await fetchQuotes(selectedProvider, brapiToken.trim());
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao salvar preferências de cotação: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const activeTestResult = localTestResult || lastQuoteFetchResult;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1.25rem)] sm:max-w-2xl w-full max-h-[92vh] sm:max-h-[85vh] h-auto p-0 gap-0 flex flex-col rounded-2xl sm:rounded-3xl bg-card border-border shadow-2xl overflow-hidden focus:outline-none">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 pb-3.5 border-b border-border/80 bg-muted/20 shrink-0 relative">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shrink-0">
                <Zap className="w-5 h-5 fill-cyan-500/20" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                  Fonte de Cotações dos Investimentos
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Escolha o provedor para obter preços em tempo real de Ações, FIIs, BDRs e ETFs
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/40 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground shrink-0 flex items-center gap-1 mr-1">
              <SlidersHorizontal className="w-3 h-3 text-cyan-500" /> Filtrar:
            </span>
            <button
              type="button"
              onClick={() => setFilterCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                filterCategory === 'all'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              Todas ({providersList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('recommended')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                filterCategory === 'recommended'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              ✨ Recomendadas
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('no_token')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                filterCategory === 'no_token'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              🚀 Sem Token
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0 [scrollbar-width:thin]">
          
          {/* PROVIDERS LIST */}
          <div className="space-y-3">
            {filteredProviders.map((p) => {
              const isSelected = selectedProvider === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col sm:flex-row items-start gap-3 sm:gap-4 ${
                    isSelected
                      ? 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                      : 'bg-card/80 hover:bg-muted/40 border-border/80 hover:border-indigo-500/30'
                  }`}
                >
                  {/* Selection Radio Circle */}
                  <div className="flex items-center justify-between w-full sm:w-auto">
                    <div className="flex items-center gap-2.5 sm:gap-0">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600 text-white scale-105'
                            : 'border-muted-foreground/40'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      {/* Mobile Header Title on same line as radio */}
                      <span className="sm:hidden text-xs sm:text-sm font-black text-foreground">
                        {p.name}
                      </span>
                    </div>

                    {/* Mobile Tags */}
                    <div className="sm:hidden flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground">{p.speed}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${p.badge}`}>
                        {p.tag}
                      </span>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="flex-1 space-y-2 w-full">
                    {/* Desktop Title & Badges */}
                    <div className="hidden sm:flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black text-foreground">
                          {p.name}
                        </span>
                        {p.isRecommended && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase">
                            Recomendado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground">{p.speed}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${p.badge}`}>
                          {p.tag}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {p.description}
                    </p>

                    {/* Feature Chips */}
                    <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                      {p.features.map((feat, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                            isSelected
                              ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20'
                              : 'bg-muted/50 text-muted-foreground border-border/60'
                          }`}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                          {feat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* BRAPI TOKEN FIELD SECTION */}
          {(selectedProvider === 'brapi' || selectedProvider === 'auto') && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" /> Token de Acesso Brapi.dev
                </label>
                <a
                  href="https://brapi.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                >
                  Criar conta grátis <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>

              <div className="relative">
                <Input
                  type="text"
                  placeholder="Cole seu token do brapi.dev aqui..."
                  value={brapiToken}
                  onChange={(e) => setBrapiToken(e.target.value)}
                  className="h-10 text-xs rounded-xl font-mono border-border bg-background pr-20"
                />
                {brapiToken && (
                  <button
                    type="button"
                    onClick={() => setBrapiToken('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {selectedProvider === 'auto' ? (
                  <>
                    💡 No modo <strong>Multi-Fonte Automático</strong>, o servidor já obtém cotações de FIIs sem token. Caso insira seu token pessoal da Brapi acima, ele será utilizado como chave prioritária.
                  </>
                ) : (
                  <>
                    ⚠️ Para consultar Fundos Imobiliários (FIIs) diretamente via Brapi, insira seu token gratuito criado em brapi.dev.
                  </>
                )}
              </p>
            </div>
          )}

          {/* LAST FETCH STATS & INTERACTIVE TEST SECTION */}
          <div className="p-3.5 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Activity className="w-4 h-4 animate-pulse" />
                </div>
                <div className="space-y-0.5">
                  <span className="font-bold text-foreground block text-xs">
                    {activeTestResult ? (
                      <>Fonte testada: <strong className="text-indigo-600 dark:text-indigo-400">{activeTestResult.providerUsed}</strong></>
                    ) : (
                      <>Pronto para testar a fonte selecionada em tempo real</>
                    )}
                  </span>
                  {activeTestResult && (
                    <span className="text-[11px] text-muted-foreground block">
                      {activeTestResult.successCount} cotações obtidas em <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{activeTestResult.durationMs}ms</strong>
                    </span>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testingProvider || isFetchingQuotes}
                onClick={handleTestConnection}
                className="w-full sm:w-auto h-8 px-3.5 rounded-xl text-[11px] font-bold border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                {testingProvider || isFetchingQuotes ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-indigo-500" />
                )}
                {testingProvider || isFetchingQuotes ? 'Testando...' : 'Testar Conexão Agora'}
              </Button>
            </div>

            {/* DETAILED TEST TICKER BREAKDOWN */}
            {activeTestResult && activeTestResult.details && activeTestResult.details.length > 0 && (
              <div className="pt-2.5 border-t border-indigo-500/15 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-indigo-500" /> Detalhes dos Ativos Testados:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {activeTestResult.details.map((item, idx) => {
                    const hasPrice = item.price && item.price > 0;
                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-xl border flex flex-col justify-between text-[11px] ${
                          hasPrice
                            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-500/5 border-rose-500/20 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        <div className="flex items-center justify-between font-black">
                          <span>{item.ticker}</span>
                          {hasPrice ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-rose-500" />
                          )}
                        </div>
                        <div className="text-[10px] font-bold mt-1">
                          {hasPrice
                            ? `R$ ${item.price.toFixed(2).replace('.', ',')}`
                            : 'Sem retorno'}
                        </div>
                        <div className="text-[9px] text-muted-foreground truncate mt-0.5">
                          {item.provider || activeTestResult.providerUsed}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-4 sm:p-5 border-t border-border/80 bg-muted/30 shrink-0 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto rounded-xl text-xs font-bold hover:bg-muted cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleSaveAndFetch}
            disabled={saving || isFetchingQuotes}
            className="w-full sm:w-auto rounded-xl text-xs font-extrabold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 cursor-pointer flex items-center justify-center gap-2 h-11 sm:h-10 px-5"
          >
            {saving || isFetchingQuotes ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {saving || isFetchingQuotes ? 'Atualizando...' : 'Salvar & Buscar Cotações'}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
