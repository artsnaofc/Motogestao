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
  RotateCcw
} from 'lucide-react';
import { FreightQuote, DriverFreightPreset, VehicleType } from '../types/freight';
import { freightStorage, VEHICLE_PRESETS } from '../lib/freightStorage';
import { FreightQuoteForm } from '../components/freight/FreightQuoteForm';
import { FreightQuotesList } from '../components/freight/FreightQuotesList';
import { FreightSettingsModal } from '../components/freight/FreightSettingsModal';
import { FreightWhatsAppPreviewModal } from '../components/freight/FreightWhatsAppPreviewModal';
import { FreightProposalModal } from '../components/freight/FreightProposalModal';
import { useData } from '../contexts/DataContext';

export default function FreightQuotePage() {
  const { settings } = useData();
  const userId = settings?.user_id || 'default';

  const [activeTab, setActiveTab] = useState<'create' | 'list' | 'rates'>('create');
  const [quotes, setQuotes] = useState<FreightQuote[]>([]);
  const [editingQuote, setEditingQuote] = useState<FreightQuote | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [whatsAppModalQuote, setWhatsAppModalQuote] = useState<FreightQuote | null>(null);
  const [proposalModalQuote, setProposalModalQuote] = useState<FreightQuote | null>(null);

  // Load quotes
  const loadQuotes = () => {
    const loaded = freightStorage.getQuotes(userId);
    setQuotes(loaded);
  };

  useEffect(() => {
    loadQuotes();
  }, [userId]);

  // Handle Save
  const handleSaveQuote = (quote: FreightQuote) => {
    freightStorage.saveQuote(quote, userId);
    loadQuotes();
    setEditingQuote(null);
  };

  const handleEditQuote = (quote: FreightQuote) => {
    setEditingQuote(quote);
    setActiveTab('create');
  };

  // KPIs
  const stats = useMemo(() => {
    const totalCount = quotes.length;
    const approvedQuotes = quotes.filter(q => q.status === 'approved' || q.status === 'completed');
    const pendingQuotes = quotes.filter(q => q.status === 'pending');

    const totalPipelineValue = quotes.reduce((acc, q) => acc + (q.total_price || 0), 0);
    const approvedRevenue = approvedQuotes.reduce((acc, q) => acc + (q.total_price || 0), 0);
    const expectedProfit = approvedQuotes.reduce((acc, q) => acc + (q.driver_net_profit || 0), 0);

    return {
      totalCount,
      approvedCount: approvedQuotes.length,
      pendingCount: pendingQuotes.length,
      totalPipelineValue,
      approvedRevenue,
      expectedProfit,
    };
  }, [quotes]);

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* HEADER WITH TITLE, STATS & SETTINGS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20 shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              Gerador de Orçamento de Frete
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                PRO
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Crie orçamentos comerciais, envie no WhatsApp e exporte propostas formais em PDF com 1 clique.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsSettingsOpen(true)}
            className="rounded-2xl h-10 px-3.5 text-xs font-bold border-border/70 hover:bg-muted gap-2 cursor-pointer shadow-2xs"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
            Configurar Padrões
          </Button>

          <Button
            onClick={() => {
              setEditingQuote(null);
              setActiveTab('create');
            }}
            className="rounded-2xl h-10 px-4 text-xs font-extrabold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 cursor-pointer shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Novo Orçamento
          </Button>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-border/60 bg-card/75 shadow-2xs rounded-3xl p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>Orçamentos Emitidos</span>
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-foreground">{stats.totalCount}</p>
          <p className="text-[11px] text-muted-foreground">{stats.pendingCount} aguardando resposta</p>
        </Card>

        <Card className="border-border/60 bg-card/75 shadow-2xs rounded-3xl p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>Aprovados / Fechados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.approvedCount}
          </p>
          <p className="text-[11px] text-muted-foreground">Taxa de conversão {(stats.totalCount > 0 ? (stats.approvedCount / stats.totalCount) * 100 : 0).toFixed(0)}%</p>
        </Card>

        <Card className="border-border/60 bg-card/75 shadow-2xs rounded-3xl p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
            <span>Receita Aprovada</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-foreground">
            {formatBRL(stats.approvedRevenue)}
          </p>
          <p className="text-[11px] text-muted-foreground">Pipeline: {formatBRL(stats.totalPipelineValue)}</p>
        </Card>

        <Card className="border-emerald-500/25 bg-emerald-500/5 shadow-2xs rounded-3xl p-4 space-y-1">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            <span>Lucro Líquido Estimado</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatBRL(stats.expectedProfit)}
          </p>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">Livre de combustível & manutenção</p>
        </Card>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-2 overflow-x-auto">
        <Button
          variant={activeTab === 'create' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('create')}
          className={`rounded-2xl h-10 px-4 font-extrabold text-xs cursor-pointer gap-2 ${
            activeTab === 'create' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          {editingQuote ? `Editando (${editingQuote.code})` : 'Novo Orçamento'}
        </Button>

        <Button
          variant={activeTab === 'list' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('list')}
          className={`rounded-2xl h-10 px-4 font-extrabold text-xs cursor-pointer gap-2 ${
            activeTab === 'list' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'
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
          variant={activeTab === 'rates' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('rates')}
          className={`rounded-2xl h-10 px-4 font-extrabold text-xs cursor-pointer gap-2 ${
            activeTab === 'rates' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-4 h-4" />
          Tabela de Tarifas por Veículo
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
              userId={userId}
              onSaveQuote={handleSaveQuote}
              onOpenWhatsApp={(quote) => setWhatsAppModalQuote(quote)}
              onOpenProposal={(quote) => setProposalModalQuote(quote)}
              onCancelEdit={editingQuote ? () => setEditingQuote(null) : undefined}
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
              onEditQuote={handleEditQuote}
              onOpenWhatsApp={(quote) => setWhatsAppModalQuote(quote)}
              onOpenProposal={(quote) => setProposalModalQuote(quote)}
              onQuotesChanged={loadQuotes}
            />
          </motion.div>
        )}

        {activeTab === 'rates' && (
          <motion.div
            key="rates-table"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 text-xs">
              <h3 className="font-black text-foreground text-sm">Tabela Referencial de Tarifas & Veículos</h3>
              <p className="text-muted-foreground text-xs mt-0.5">
                Consulte ou use como base para negociação direta de fretes fracionados, dedicados e lotação.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(Object.keys(VEHICLE_PRESETS) as VehicleType[]).map((vKey) => {
                const v = VEHICLE_PRESETS[vKey];
                return (
                  <Card key={vKey} className="border-border/60 bg-card rounded-3xl p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-border/40 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                          {vKey === 'fiorino' || vKey === 'carro' ? (
                            <Car className="w-5 h-5" />
                          ) : vKey === 'van' || vKey === 'caminhao' ? (
                            <Truck className="w-5 h-5" />
                          ) : (
                            <Bike className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-foreground">{v.label}</h4>
                          <span className="text-[11px] text-muted-foreground">{v.maxWeight}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-border/30">
                        <span className="text-muted-foreground">Taxa Base de Saída:</span>
                        <strong className="text-foreground">{formatBRL(v.defaultBase)}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/30">
                        <span className="text-muted-foreground">Preço Sugerido por KM:</span>
                        <strong className="text-primary font-bold">{formatBRL(v.defaultPriceKm)}/km</strong>
                      </div>
                      <p className="text-[11px] text-muted-foreground pt-1">{v.desc}</p>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingQuote(null);
                        setActiveTab('create');
                      }}
                      className="w-full rounded-xl h-9 text-xs font-bold border-border/60 hover:bg-muted cursor-pointer"
                    >
                      Criar Orçamento com este Veículo
                    </Button>
                  </Card>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WHATSAPP MODAL */}
      <FreightWhatsAppPreviewModal
        open={!!whatsAppModalQuote}
        onOpenChange={(open) => !open && setWhatsAppModalQuote(null)}
        quote={whatsAppModalQuote}
      />

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
      />
    </div>
  );
}
