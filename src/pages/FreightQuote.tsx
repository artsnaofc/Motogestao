import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Bike, 
  Car, 
  Truck, 
  FileText, 
  PlusCircle, 
  List, 
  Settings, 
  Sparkles, 
  DollarSign, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Layers, 
  ShieldCheck,
  Zap,
  RotateCcw,
  Users,
  Percent,
  X,
  ArrowLeft,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { FreightQuote, DriverFreightPreset, FreightClient } from '../types/freight';
import { freightStorage } from '../lib/freightStorage';
import { FreightQuoteForm } from '../components/freight/FreightQuoteForm';
import { FreightQuotesList } from '../components/freight/FreightQuotesList';
import { FreightClientsManager } from '../components/freight/FreightClientsManager';
import { FreightSettingsModal } from '../components/freight/FreightSettingsModal';
import { FreightProposalModal } from '../components/freight/FreightProposalModal';
import { useData } from '../contexts/DataContext';

export default function FreightQuotePage() {
  const { settings } = useData();
  const userId = settings?.user_id || 'default';

  const [activeTab, setActiveTab] = useState<'create' | 'list' | 'clients'>('list');
  const [highlightedQuoteId, setHighlightedQuoteId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<FreightQuote[]>([]);
  const [clientsCount, setClientsCount] = useState<number>(() => freightStorage.getClients(userId).length);
  const [editingQuote, setEditingQuote] = useState<Partial<FreightQuote> | null>(null);
  const [isBaseMode, setIsBaseMode] = useState(false);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [proposalModalQuote, setProposalModalQuote] = useState<FreightQuote | null>(null);

  // Load quotes and sync with database on mount
  const loadQuotes = () => {
    const loaded = freightStorage.getQuotes(userId);
    setQuotes(loaded);
    setClientsCount(freightStorage.getClients(userId).length);
  };

  useEffect(() => {
    loadQuotes();
    // Sync presets, vehicles, clients and quotes from Supabase on mount
    freightStorage.syncPresetFromDatabase(userId);
    freightStorage.syncClientsFromDatabase(userId).then(c => {
      if (c && c.length >= 0) setClientsCount(c.length);
    });
    freightStorage.syncQuotesFromDatabase(userId).then((synced) => {
      if (synced && synced.length > 0) {
        setQuotes(synced);
      }
    });

    const handleQuotesUpdated = () => {
      loadQuotes();
    };

    const handleClientsUpdated = () => {
      setClientsCount(freightStorage.getClients(userId).length);
    };

    window.addEventListener('freight_quotes_updated', handleQuotesUpdated);
    window.addEventListener('freight_clients_updated', handleClientsUpdated);
    return () => {
      window.removeEventListener('freight_quotes_updated', handleQuotesUpdated);
      window.removeEventListener('freight_clients_updated', handleClientsUpdated);
    };
  }, [userId]);

  // Handle Save
  const handleSaveQuote = (quote: FreightQuote) => {
    freightStorage.saveQuote(quote, userId);
    loadQuotes();
    setEditingQuote(null);
    setIsBaseMode(false);
    setHighlightedQuoteId(quote.id);
    setActiveTab('list');
  };

  const handleEditQuote = (quote: FreightQuote) => {
    setEditingQuote(quote);
    setIsBaseMode(false);
    setActiveTab('create');
  };

  const handleUseAsBaseQuote = (baseQuote: FreightQuote) => {
    const nextCode = freightStorage.generateNextCode(userId);
    const newQuote: FreightQuote = {
      ...baseQuote,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `frt_${Date.now()}`,
      code: nextCode,
      created_at: new Date().toISOString(),
      status: 'pending',
      scheduled_date: new Date().toISOString().split('T')[0],
      converted_to_transaction_id: undefined,
      converted_at: undefined,
    };
    setEditingQuote(newQuote);
    setIsBaseMode(true);
    setActiveTab('create');
    toast.info(`Orçamento ${baseQuote.code} carregado como base!`, {
      description: `Gerando novo orçamento ${nextCode}. Selecione a nova data da coleta.`,
    });
  };

  const handleSelectClientForQuote = (client: FreightClient) => {
    const newQuoteDraft: Partial<FreightQuote> = {
      client_name: client.name,
      client_phone: client.phone || '',
      client_company: client.company || '',
      client_document: client.document || '',
      client_email: client.email || '',
      is_client_preset: true,
    };
    setEditingQuote(newQuoteDraft);
    setIsBaseMode(false);
    setActiveTab('create');
    toast.info(`Cliente "${client.name}" selecionado para novo orçamento!`);
  };

  // KPIs
  const stats = useMemo(() => {
    const totalCount = quotes.length;
    const completedQuotes = quotes.filter(q => q.status === 'completed');
    const approvedQuotes = quotes.filter(q => q.status === 'approved' || q.status === 'completed');
    const pendingQuotes = quotes.filter(q => q.status === 'pending');

    const totalPipelineValue = pendingQuotes.reduce((acc, q) => acc + (q.total_price || 0), 0);
    const approvedRevenue = approvedQuotes.reduce((acc, q) => acc + (q.total_price || 0), 0);
    // Lucro Líquido Estimado: soma apenas dos orçamentos com status 'completed'
    const expectedProfit = completedQuotes.reduce((acc, q) => acc + (q.driver_net_profit || 0), 0);
    
    const conversionRate = totalCount > 0 ? (approvedQuotes.length / totalCount) * 100 : 0;
    const avgTicket = approvedQuotes.length > 0 ? approvedRevenue / approvedQuotes.length : 0;

    return {
      totalCount,
      completedCount: completedQuotes.length,
      approvedCount: approvedQuotes.length,
      pendingCount: pendingQuotes.length,
      totalPipelineValue,
      approvedRevenue,
      expectedProfit,
      conversionRate,
      avgTicket,
    };
  }, [quotes]);

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div className="w-full max-w-7xl mx-auto p-3.5 sm:p-6 lg:p-8 space-y-6">
      {/* HEADER WITH TITLE & PRIMARY ACTION BUTTONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 shrink-0">
            <Bike className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              Gestão & Emissão de Fretes
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                PRO
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Crie orçamentos comerciais, calcule lucros reais e exporte propostas formais em PDF com chave PIX e envio para WhatsApp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => {
              setEditingQuote(null);
              setIsBaseMode(false);
              setActiveTab('create');
            }}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold rounded-2xl h-11 px-5 text-xs gap-2 cursor-pointer shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02]"
          >
            <PlusCircle className="w-4 h-4" />
            Novo Orçamento
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-2xl h-11 px-4 text-xs font-bold border-border/80 hover:bg-muted gap-2 cursor-pointer shadow-2xs"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
            Tarifas & PIX
          </Button>
        </div>
      </div>

      {/* KPI STATS CARDS (FINANCIAL COCKPIT) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Total Quotes & Conversion */}
        <Card className="rounded-xl border-border/70 bg-card p-2.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[9px] font-extrabold uppercase tracking-wide text-muted-foreground truncate">
              Total Emitido
            </span>
            <div className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
              <FileText className="w-3 h-3" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <p className="text-base sm:text-lg font-black text-foreground leading-tight">
              {stats.totalCount} <span className="text-[10px] font-medium text-muted-foreground">prop.</span>
            </p>
            <span className="text-[9.5px] text-muted-foreground shrink-0">
              Conv: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{stats.conversionRate.toFixed(0)}%</strong>
            </span>
          </div>
        </Card>

        {/* Pending Pipeline */}
        <Card className="rounded-xl border-border/70 bg-card p-2.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[9px] font-extrabold uppercase tracking-wide text-amber-600 dark:text-amber-400 truncate">
              Pipeline Aberto
            </span>
            <div className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="w-3 h-3" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 leading-tight truncate">
              {formatBRL(stats.totalPipelineValue)}
            </p>
            <span className="text-[9.5px] text-muted-foreground shrink-0">
              {stats.pendingCount} pend.
            </span>
          </div>
        </Card>

        {/* Confirmed Revenue */}
        <Card className="rounded-xl border-border/70 bg-card p-2.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[9px] font-extrabold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 truncate">
              Receita Confirmada
            </span>
            <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <CheckCircle2 className="w-3 h-3" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <p className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 leading-tight truncate">
              {formatBRL(stats.approvedRevenue)}
            </p>
            <span className="text-[9.5px] text-muted-foreground shrink-0 truncate">
              Méd: <strong className="text-foreground">{formatBRL(stats.avgTicket)}</strong>
            </span>
          </div>
        </Card>

        {/* Net Driver Profit */}
        <Card className="rounded-xl border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 p-2.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[9px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 truncate">
              Lucro Estimado
            </span>
            <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 shrink-0">
              <TrendingUp className="w-3 h-3" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-1">
            <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 leading-tight truncate">
              {formatBRL(stats.expectedProfit)}
            </p>
            <span className="text-[9.5px] text-emerald-700/80 dark:text-emerald-300/80 font-semibold shrink-0">
              {stats.completedCount} conc.
            </span>
          </div>
        </Card>
      </div>

      {/* MODERN CONTROL & NAVIGATION BAR */}
      {activeTab === 'create' ? (
        /* CONTEXTUAL SLIM HEADER WHEN CREATING OR EDITING */
        <div className="flex items-center justify-between gap-3 bg-card border border-border/80 px-3.5 py-2.5 rounded-2xl shadow-2xs">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingQuote(null);
                setIsBaseMode(false);
                setActiveTab('list');
              }}
              className="rounded-xl h-8 px-2.5 text-xs font-bold gap-1.5 cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 border border-border/50"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-indigo-500" />
              <span>Voltar</span>
            </Button>

            <div className="h-4 w-px bg-border/60 shrink-0" />

            <span className="text-xs font-black truncate text-foreground flex items-center gap-1.5">
              {editingQuote ? (
                <>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {isBaseMode ? '📋 Novo com Base' : '✏️ Edição'}
                  </span>
                  <span className="text-muted-foreground font-mono text-[11px]">({editingQuote.code})</span>
                </>
              ) : (
                <span className="text-indigo-600 dark:text-indigo-400">✨ Emissão de Orçamento</span>
              )}
            </span>
          </div>

          {editingQuote && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingQuote(null);
                setIsBaseMode(false);
                setActiveTab('list');
                toast.info('Edição cancelada.');
              }}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl h-8 px-2.5 gap-1 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cancelar</span>
            </Button>
          )}
        </div>
      ) : activeTab === 'clients' ? (
        /* CONTEXTUAL SLIM HEADER WHEN MANAGING CLIENTS */
        <div className="flex items-center justify-between gap-3 bg-card border border-border/80 px-3.5 py-2.5 rounded-2xl shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab('list')}
              className="rounded-xl h-8 px-2.5 text-xs font-bold gap-1.5 cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 border border-border/50"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-500" />
              <span>Voltar</span>
            </Button>

            <div className="h-4 w-px bg-border/60 shrink-0" />

            <span className="text-xs font-black text-foreground flex items-center gap-1.5">
              👥 Gestão de Clientes
            </span>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setEditingQuote(null);
              setIsBaseMode(false);
              setActiveTab('create');
            }}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-extrabold rounded-xl h-8 px-3 text-xs gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Novo Orçamento</span>
          </Button>
        </div>
      ) : (
        /* SEGMENTED TOGGLE WHEN IN MAIN LIST VIEW */
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card/60 border border-border/70 p-2 rounded-3xl shadow-2xs">
          {/* SEGMENTED SWITCHER */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-2xl w-full sm:w-auto">
            <Button
              variant="ghost"
              onClick={() => setActiveTab('list')}
              className={`rounded-xl h-9 px-4 font-black text-xs cursor-pointer gap-2 transition-all flex-1 sm:flex-initial ${
                activeTab === 'list'
                  ? 'bg-background text-foreground shadow-xs ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-4 h-4 text-indigo-500" />
              Orçamentos Salvos
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                {quotes.length}
              </span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => setActiveTab('clients')}
              className={`rounded-xl h-9 px-4 font-black text-xs cursor-pointer gap-2 transition-all flex-1 sm:flex-initial ${
                activeTab === 'clients'
                  ? 'bg-background text-foreground shadow-xs ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-500" />
              Clientes
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {clientsCount}
              </span>
            </Button>
          </div>

          <div className="text-xs text-muted-foreground font-medium px-3 hidden md:block">
            Selecione ou edite orçamentos existentes ou emita uma nova proposta
          </div>
        </div>
      )}

      {/* VIEW CONTENT */}
      <AnimatePresence mode="wait">
        {activeTab === 'create' && (
          <motion.div
            key="create-form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <FreightQuoteForm
              initialQuote={editingQuote}
              isBaseMode={isBaseMode}
              userId={userId}
              onSaveQuote={handleSaveQuote}
              onOpenProposal={(quote) => setProposalModalQuote(quote)}
              onCancelEdit={editingQuote ? () => { setEditingQuote(null); setIsBaseMode(false); setActiveTab('list'); } : undefined}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </motion.div>
        )}

        {activeTab === 'list' && (
          <motion.div
            key="quotes-list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <FreightQuotesList
              quotes={quotes}
              userId={userId}
              highlightedQuoteId={highlightedQuoteId}
              onEditQuote={handleEditQuote}
              onUseAsBaseQuote={handleUseAsBaseQuote}
              onOpenProposal={(quote) => setProposalModalQuote(quote)}
              onQuotesChanged={loadQuotes}
              onNewQuote={() => {
                setEditingQuote(null);
                setIsBaseMode(false);
                setActiveTab('create');
              }}
            />
          </motion.div>
        )}

        {activeTab === 'clients' && (
          <motion.div
            key="clients-tab"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <FreightClientsManager
              userId={userId}
              quotes={quotes}
              onSelectClientForQuote={handleSelectClientForQuote}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* PROPOSAL FORMAL PRINTABLE MODAL */}
      <FreightProposalModal
        open={!!proposalModalQuote}
        onOpenChange={(open) => !open && setProposalModalQuote(null)}
        quote={proposalModalQuote}
      />

      {/* DRIVER PRESET SETTINGS MODAL */}
      <FreightSettingsModal
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        userId={userId}
        onSaved={() => {
          loadQuotes();
        }}
      />
    </div>
  );
}
