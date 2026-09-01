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
  X
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
  const [editingQuote, setEditingQuote] = useState<Partial<FreightQuote> | null>(null);
  const [isBaseMode, setIsBaseMode] = useState(false);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [proposalModalQuote, setProposalModalQuote] = useState<FreightQuote | null>(null);

  // Load quotes and sync with database on mount
  const loadQuotes = () => {
    const loaded = freightStorage.getQuotes(userId);
    setQuotes(loaded);
  };

  useEffect(() => {
    loadQuotes();
    // Sync presets, vehicles, clients and quotes from Supabase on mount
    freightStorage.syncPresetFromDatabase(userId);
    freightStorage.syncClientsFromDatabase(userId);
    freightStorage.syncQuotesFromDatabase(userId).then((synced) => {
      if (synced && synced.length > 0) {
        setQuotes(synced);
      }
    });

    const handleQuotesUpdated = () => {
      loadQuotes();
    };

    window.addEventListener('freight_quotes_updated', handleQuotesUpdated);
    return () => {
      window.removeEventListener('freight_quotes_updated', handleQuotesUpdated);
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
      {/* HEADER WITH TITLE & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-2xl h-10 px-4 text-xs font-bold border-border/80 hover:bg-muted gap-2 cursor-pointer shadow-2xs"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
            Configurar Tarifas & PIX
          </Button>
        </div>
      </div>

      {/* KPI STATS CARDS (FINANCIAL COCKPIT) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Quotes & Conversion */}
        <Card className="rounded-3xl border-border/70 bg-card p-4 sm:p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Total Emitido
            </span>
            <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-foreground">
            {stats.totalCount} <span className="text-xs font-semibold text-muted-foreground">propostas</span>
          </p>
          <span className="text-[11px] text-muted-foreground block">
            Taxa de Conversão: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{stats.conversionRate.toFixed(0)}%</strong>
          </span>
        </Card>

        {/* Pending Pipeline */}
        <Card className="rounded-3xl border-border/70 bg-card p-4 sm:p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pipeline Aberto
            </span>
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
            {formatBRL(stats.totalPipelineValue)}
          </p>
          <span className="text-[11px] text-muted-foreground block">
            {stats.pendingCount} proposta(s) aguardando
          </span>
        </Card>

        {/* Confirmed Revenue */}
        <Card className="rounded-3xl border-border/70 bg-card p-4 sm:p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Receita Confirmada
            </span>
            <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {formatBRL(stats.approvedRevenue)}
          </p>
          <span className="text-[11px] text-muted-foreground block">
            Ticket médio: <strong className="text-foreground">{formatBRL(stats.avgTicket)}</strong>
          </span>
        </Card>

        {/* Net Driver Profit */}
        <Card className="rounded-3xl border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 p-4 sm:p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Lucro Líquido Estimado
            </span>
            <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatBRL(stats.expectedProfit)}
          </p>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-semibold block">
            {stats.completedCount} frete(s) concluído(s)
          </span>
        </Card>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-2 overflow-x-auto">
        <Button
          variant={activeTab === 'create' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('create')}
          className={`rounded-2xl h-10 px-4 font-extrabold text-xs cursor-pointer gap-2 shrink-0 ${
            activeTab === 'create' ? 'shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          {editingQuote ? (isBaseMode ? `Base (${editingQuote.code})` : `Editando (${editingQuote.code})`) : 'Novo Orçamento'}
        </Button>

        {editingQuote && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingQuote(null);
              setIsBaseMode(false);
              toast.info('Edição cancelada. Modo novo orçamento ativado.');
            }}
            className="rounded-2xl h-10 px-3 text-xs font-bold text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer gap-1.5 shrink-0"
            title="Cancelar edição e voltar ao modo Novo Orçamento"
          >
            <X className="w-4 h-4" />
            Cancelar Edição
          </Button>
        )}

        <Button
          variant={activeTab === 'list' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('list')}
          className={`rounded-2xl h-10 px-4 font-extrabold text-xs cursor-pointer gap-2 shrink-0 ${
            activeTab === 'list' ? 'shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <List className="w-4 h-4" />
          Orçamentos Salvos
          {quotes.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'list' ? 'bg-primary-foreground text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {quotes.length}
            </span>
          )}
        </Button>

        <Button
          variant={activeTab === 'clients' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('clients')}
          className={`rounded-2xl h-10 px-4 font-extrabold text-xs cursor-pointer gap-2 shrink-0 ${
            activeTab === 'clients' ? 'shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4" />
          Clientes Frequentes
        </Button>
      </div>

      {/* TAB CONTENT */}
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
              onCancelEdit={editingQuote ? () => { setEditingQuote(null); setIsBaseMode(false); } : undefined}
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
