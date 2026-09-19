import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  MessageSquare, 
  FileText, 
  MoreVertical, 
  Edit, 
  RotateCcw, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  CheckCheck, 
  Bike, 
  Car, 
  Truck, 
  MapPin, 
  DollarSign, 
  ArrowUpRight, 
  Sparkles,
  Calendar,
  Layers,
  ChevronRight,
  ChevronDown,
  Share2,
  Loader2,
  Phone,
  ArrowRight,
  TrendingUp,
  Package,
  PlusCircle,
  AlertTriangle
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/lib/toast';
import { FreightQuote, FreightQuoteStatus } from '../../types/freight';
import { freightStorage } from '../../lib/freightStorage';
import { shareFreightQuotePDF } from '../../lib/freightPdfGenerator';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../lib/supabase';
import { getTodayLocalDateStr } from '../../lib/utils';

interface FreightQuotesListProps {
  quotes: FreightQuote[];
  onEditQuote: (quote: FreightQuote) => void;
  onUseAsBaseQuote: (quote: FreightQuote) => void;
  onOpenWhatsApp?: (quote: FreightQuote) => void;
  onOpenProposal: (quote: FreightQuote) => void;
  onQuotesChanged: () => void;
  onNewQuote?: () => void;
  userId?: string;
  highlightedQuoteId?: string | null;
}

export function FreightQuotesList({
  quotes,
  onEditQuote,
  onUseAsBaseQuote,
  onOpenWhatsApp,
  onOpenProposal,
  onQuotesChanged,
  onNewQuote,
  userId = 'default',
  highlightedQuoteId,
}: FreightQuotesListProps) {
  const navigate = useNavigate();
  const { refreshData, settings } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSharingId, setIsSharingId] = useState<string | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<FreightQuote | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (highlightedQuoteId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`quote-card-${highlightedQuoteId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [highlightedQuoteId]);

  // Escutar atualizações globais de orçamentos para manter a lista 100% síncrona
  useEffect(() => {
    const handleGlobalUpdate = () => {
      onQuotesChanged();
    };
    window.addEventListener('freight_quotes_updated', handleGlobalUpdate);
    return () => {
      window.removeEventListener('freight_quotes_updated', handleGlobalUpdate);
    };
  }, [onQuotesChanged]);

  // Gastos operacionais lançados no caixa contabilizam estritamente os Adicionais & Taxas Extras
  const calcOperationalExpenses = (quote: FreightQuote): number => {
    return (
      (Number(quote.tolls_fee) || 0) +
      (Number(quote.extra_stops_fee) || 0) +
      (Number(quote.heavy_cargo_fee) || 0) +
      (Number(quote.stairs_floor_fee) || 0) +
      (Number(quote.urgent_or_rain_fee) || 0) +
      (Number(quote.night_fee) || 0) +
      (Number(quote.waiting_hours_fee) || 0)
    );
  };

  const handleSharePDF = async (quote: FreightQuote) => {
    try {
      setIsSharingId(quote.id);
      const shared = await shareFreightQuotePDF(quote, userId);
      if (shared) {
        toast.success(`Proposta comercial em PDF (${quote.code}) pronta para envio!`);
      }
    } catch (err: any) {
      toast.error('Erro ao compartilhar PDF: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setIsSharingId(null);
    }
  };

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const statusConfig: Record<FreightQuoteStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
    draft: { 
      label: 'Rascunho', 
      bg: 'bg-muted/60', 
      text: 'text-muted-foreground', 
      border: 'border-border/60',
      icon: Clock 
    },
    pending: { 
      label: 'Aguardando Aprovação', 
      bg: 'bg-amber-500/10', 
      text: 'text-amber-600 dark:text-amber-400', 
      border: 'border-amber-500/30',
      icon: Clock 
    },
    approved: { 
      label: 'Aprovado pelo Cliente', 
      bg: 'bg-indigo-500/10', 
      text: 'text-indigo-600 dark:text-indigo-400', 
      border: 'border-indigo-500/30',
      icon: CheckCircle2 
    },
    completed: { 
      label: 'Frete Concluído', 
      bg: 'bg-emerald-500/10', 
      text: 'text-emerald-600 dark:text-emerald-400', 
      border: 'border-emerald-500/30',
      icon: CheckCheck 
    },
    rejected: { 
      label: 'Cancelado / Recusado', 
      bg: 'bg-rose-500/10', 
      text: 'text-rose-600 dark:text-rose-400', 
      border: 'border-rose-500/30',
      icon: XCircle 
    },
  };

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = {
      all: quotes.length,
      pending: 0,
      approved: 0,
      completed: 0,
      rejected: 0,
      draft: 0,
    };
    quotes.forEach((q) => {
      if (counts[q.status] !== undefined) {
        counts[q.status]++;
      }
    });
    return counts;
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const matchSearch =
        q.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.client_company && q.client_company.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (q.client_phone && q.client_phone.includes(searchTerm)) ||
        q.origin_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.destination_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.cargo_description && q.cargo_description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'all' || q.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [quotes, searchTerm, statusFilter]);

  const handleStatusChange = (quote: FreightQuote, newStatus: FreightQuoteStatus) => {
    freightStorage.updateQuoteStatus(quote.id, newStatus, userId);
    toast.success(`Status de ${quote.code} alterado para "${statusConfig[newStatus].label}".`);
    onQuotesChanged();
  };

  const handlePromptDelete = (quote: FreightQuote) => {
    setQuoteToDelete(quote);
  };

  const confirmDeleteQuote = async () => {
    if (!quoteToDelete) return;
    try {
      setIsDeleting(true);
      freightStorage.deleteQuote(quoteToDelete.id, userId);
      toast.success(`Orçamento ${quoteToDelete.code} excluído permanentemente.`);
      setQuoteToDelete(null);
      onQuotesChanged();
    } catch (err: any) {
      toast.error('Erro ao excluir orçamento: ' + (err?.message || 'Falha desconhecida'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Redirect to add-transaction page with pre-filled Freight tab, total value, operational expenses, date & description
  const handleLaunchToCashier = (quote: FreightQuote) => {
    if (quote.converted_to_transaction_id) {
      toast.warning(`Este frete já foi lançado no caixa (Vínculo: ${quote.converted_to_transaction_id}).`);
      return;
    }
    const opExpenses = calcOperationalExpenses(quote);
    const description = `Frete ${quote.code} - ${quote.client_name} (${quote.origin_neighborhood || 'Origem'} ➔ ${quote.destination_neighborhood || 'Destino'})`;
    const quoteDate = quote.scheduled_date || (quote.created_at ? quote.created_at.split('T')[0] : getTodayLocalDateStr());

    const params = new URLSearchParams({
      tab: 'frete',
      amount: String(quote.total_price),
      operational_expenses: opExpenses > 0 ? String(Number(opExpenses.toFixed(2))) : '',
      description: description,
      date: quoteDate,
      distance_km: String(quote.total_calculated_km || quote.distance_km || 0),
      quote_id: quote.id,
    });

    navigate(`/add?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* STATUS TABS SELECTOR (QUICK FILTER PILLS) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/50">
        {[
          { id: 'all', label: 'Todos', count: statusCounts.all },
          { id: 'pending', label: 'Aguardando', count: statusCounts.pending, color: 'text-amber-600 dark:text-amber-400' },
          { id: 'approved', label: 'Aprovados', count: statusCounts.approved, color: 'text-indigo-600 dark:text-indigo-400' },
          { id: 'completed', label: 'Concluídos', count: statusCounts.completed, color: 'text-emerald-600 dark:text-emerald-400' },
          { id: 'rejected', label: 'Cancelados', count: statusCounts.rejected, color: 'text-rose-600 dark:text-rose-400' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer border ${
              statusFilter === tab.id
                ? 'bg-foreground text-background border-foreground shadow-xs'
                : 'bg-card hover:bg-muted text-muted-foreground border-border/60'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              statusFilter === tab.id 
                ? 'bg-background/20 text-background' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* SEARCH BAR */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, código, telefone, endereço ou carga..."
            className="rounded-2xl pl-10 h-10 text-xs bg-card border-border/80 shadow-2xs"
          />
        </div>

        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchTerm('')}
            className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-xl shrink-0"
          >
            Limpar Busca
          </Button>
        )}
      </div>

      {/* QUOTES LIST */}
      {filteredQuotes.length === 0 ? (
        <Card className="border-border/60 bg-muted/10 rounded-3xl p-8 sm:p-12 text-center space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-muted/40 text-muted-foreground mx-auto flex items-center justify-center">
            <Search className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Nenhum orçamento encontrado</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              {searchTerm || statusFilter !== 'all'
                ? 'Tente alterar os termos de busca ou filtros selecionados.'
                : 'Você ainda não possui orçamentos gerados. Crie uma nova proposta comercial em PDF agora.'}
            </p>
          </div>
          {onNewQuote && (
            <Button
              onClick={onNewQuote}
              size="sm"
              className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer mt-2 bg-primary text-primary-foreground"
            >
              <PlusCircle className="w-4 h-4" />
              Criar Primeiro Orçamento
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3.5">
          {filteredQuotes.map((quote) => {
            const statusInfo = statusConfig[quote.status] || statusConfig.pending;
            const StatusIcon = statusInfo.icon;
            const isHighlighted = highlightedQuoteId === quote.id;

            return (
              <Card
                key={quote.id}
                id={`quote-card-${quote.id}`}
                className={`border transition-all duration-500 rounded-3xl overflow-hidden group ${
                  isHighlighted
                    ? 'border-2 border-indigo-500 ring-4 ring-indigo-500/30 bg-indigo-500/10 dark:bg-indigo-950/40 shadow-xl scale-[1.01]'
                    : 'border-border/70 bg-card hover:border-border/90 shadow-2xs hover:shadow-xs'
                }`}
              >
                {isHighlighted && (
                  <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10.5px] font-black px-3 py-1 text-center flex items-center justify-center gap-1.5 tracking-wider uppercase shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                    Orçamento Salvo & Destacado
                  </div>
                )}
                <CardContent className="p-4 sm:p-5 space-y-3.5">
                  {/* Top Bar: Code, Status & Price */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                        <Bike className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-foreground tracking-tight">{quote.code}</span>
                          
                          {/* Interactive Status Selector Badge */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all hover:opacity-90 active:scale-95 ${statusInfo.bg} ${statusInfo.text} ${statusInfo.border}`}
                                title="Clique para alterar o status do orçamento"
                              >
                                <StatusIcon className="w-3 h-3" />
                                <span>{statusInfo.label}</span>
                                <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="rounded-2xl text-xs w-52 p-1.5 space-y-0.5">
                              <div className="px-2 py-1 text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                                Alterar Status:
                              </div>
                              <DropdownMenuItem onClick={() => handleStatusChange(quote, 'pending')} className="gap-2 cursor-pointer rounded-xl font-medium">
                                <Clock className="w-3.5 h-3.5 text-amber-500" /> Aguardando Aprovação
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(quote, 'approved')} className="gap-2 cursor-pointer rounded-xl font-bold text-indigo-600 dark:text-indigo-400">
                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> Aprovado pelo Cliente
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(quote, 'completed')} className="gap-2 cursor-pointer rounded-xl font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> Frete Concluído
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(quote, 'rejected')} className="gap-2 cursor-pointer text-rose-500 rounded-xl font-medium">
                                <XCircle className="w-3.5 h-3.5" /> Cancelado / Recusado
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {quote.converted_to_transaction_id && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                              ✓ Caixa Lançado
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Emitido em {new Date(quote.created_at).toLocaleDateString('pt-BR')} • {quote.scheduled_date ? `Coleta em ${new Date(quote.scheduled_date + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Sem data agendada'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3.5">
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">
                          Valor Total
                        </span>
                        <span className="text-lg sm:text-xl font-black text-primary tracking-tight">
                          {formatBRL(quote.total_price)}
                        </span>
                      </div>

                      {/* Dropdown Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8.5 w-8.5 rounded-xl cursor-pointer hover:bg-muted">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl text-xs w-56 p-1.5 space-y-0.5">
                          <DropdownMenuItem onClick={() => handleSharePDF(quote)} className="gap-2 cursor-pointer font-bold text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <Share2 className="w-3.5 h-3.5" />
                            Compartilhar PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onOpenProposal(quote)} className="gap-2 cursor-pointer font-medium rounded-xl">
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            Visualizar Proposta PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEditQuote(quote)} className="gap-2 cursor-pointer font-medium rounded-xl">
                            <Edit className="w-3.5 h-3.5 text-primary" />
                            Editar Orçamento
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onUseAsBaseQuote(quote)} className="gap-2 cursor-pointer font-bold text-primary rounded-xl">
                            <RotateCcw className="w-3.5 h-3.5" />
                            Usar como Base (Duplicar)
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <div className="px-2 py-1 text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                            Alterar Status:
                          </div>
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, 'pending')} className="gap-2 cursor-pointer rounded-xl">
                            <Clock className="w-3.5 h-3.5 text-amber-500" /> Aguardando Aprovação
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, 'approved')} className="gap-2 cursor-pointer rounded-xl font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> Aprovado pelo Cliente
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, 'completed')} className="gap-2 cursor-pointer rounded-xl font-semibold">
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> Frete Concluído
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, 'rejected')} className="gap-2 cursor-pointer text-rose-500 rounded-xl">
                            <XCircle className="w-3.5 h-3.5" /> Cancelado / Recusado
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {(quote.status === 'approved' || quote.status === 'completed') && !quote.converted_to_transaction_id && (
                            <>
                              <DropdownMenuItem onClick={() => handleLaunchToCashier(quote)} className="gap-2 cursor-pointer text-emerald-600 dark:text-emerald-400 rounded-xl font-bold">
                                <DollarSign className="w-3.5 h-3.5" />
                                Lançar no Caixa
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                            </>
                          )}

                          <DropdownMenuItem onClick={() => handlePromptDelete(quote)} className="gap-2 cursor-pointer text-rose-600 dark:text-rose-400 rounded-xl font-medium">
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir Orçamento
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Middle Section: Route & Client */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {/* Client Box */}
                    <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Cliente / Contratante
                      </span>
                      <p className="font-bold text-foreground truncate">{quote.client_name}</p>
                      {quote.client_phone && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-500" />
                          <span>{quote.client_phone}</span>
                        </p>
                      )}
                      {quote.client_company && (
                        <p className="text-[10px] text-muted-foreground truncate">{quote.client_company}</p>
                      )}
                    </div>

                    {/* Route Timeline Box */}
                    <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 md:col-span-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary" />
                          Itinerário • {quote.total_calculated_km.toFixed(1)} km {quote.is_round_trip ? '(Ida e Volta)' : ''}
                        </span>
                        {quote.additional_stops && quote.additional_stops.length > 0 && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            +{quote.additional_stops.length} parada(s)
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center gap-1.5 truncate">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-muted-foreground shrink-0 font-medium">De:</span>
                          <span className="text-foreground truncate font-semibold">{quote.origin_address}</span>
                          {quote.origin_neighborhood && <span className="text-muted-foreground shrink-0">({quote.origin_neighborhood})</span>}
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <div className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                          <span className="text-muted-foreground shrink-0 font-medium">Para:</span>
                          <span className="text-foreground truncate font-semibold">{quote.destination_address}</span>
                          {quote.destination_neighborhood && <span className="text-muted-foreground shrink-0">({quote.destination_neighborhood})</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Financial KPIs & Quick Actions */}
                  <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Lucro: {formatBRL(quote.driver_net_profit)}</span>
                        <span className="text-[10px] font-normal text-muted-foreground">({quote.profit_margin_percent.toFixed(0)}%)</span>
                      </div>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground text-[11px]">
                        Custo Combustível: {formatBRL(quote.estimated_fuel_cost || 0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 justify-end flex-wrap">
                      {/* Quick Approve button for pending quotes */}
                      {quote.status === 'pending' && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleStatusChange(quote, 'approved')}
                          className="rounded-xl h-8 px-2.5 text-[11px] font-black bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer shadow-xs"
                          title="Marcar orçamento como Aprovado pelo Cliente"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aprovar
                        </Button>
                      )}

                      {/* Convert to cashier transaction - For approved or completed status */}
                      {!quote.converted_to_transaction_id && (quote.status === 'approved' || quote.status === 'completed') && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleLaunchToCashier(quote)}
                          className="rounded-xl h-8 px-2.5 text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer shadow-xs"
                          title="Lançar valor do frete e adicionais operacionais no caixa"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Lançar no Caixa
                        </Button>
                      )}

                      {/* Quick Complete button for approved quotes */}
                      {quote.status === 'approved' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(quote, 'completed')}
                          className="rounded-xl h-8 px-2 text-[11px] font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1 cursor-pointer"
                          title="Marcar frete como realizado e concluído"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          Concluir
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onUseAsBaseQuote(quote)}
                        className="rounded-xl h-8 px-2.5 text-[11px] font-bold border-border/80 text-foreground hover:bg-muted gap-1.5 cursor-pointer"
                        title="Usar como modelo para novo frete"
                      >
                        <RotateCcw className="w-3 h-3 text-primary" />
                        <span className="hidden xs:inline">Duplicar</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSharePDF(quote)}
                        disabled={isSharingId === quote.id}
                        className="rounded-xl h-8 px-2.5 text-[11px] font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 cursor-pointer"
                        title="Compartilhar proposta em PDF no WhatsApp"
                      >
                        {isSharingId === quote.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Share2 className="w-3 h-3" />
                        )}
                        <span>PDF</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenProposal(quote)}
                        className="rounded-xl h-8 px-2.5 text-[11px] font-bold border-border/80 hover:bg-muted gap-1.5 cursor-pointer"
                        title="Visualizar proposta comercial formal"
                      >
                        <FileText className="w-3 h-3 text-indigo-500" />
                        <span>Visualizar</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE ORÇAMENTO */}
      <Dialog open={!!quoteToDelete} onOpenChange={(open) => {
        if (!open && !isDeleting) {
          setQuoteToDelete(null);
        }
      }}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-border bg-card shadow-2xl">
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground">
                  Excluir Orçamento?
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  Esta ação é irreversível e removerá este orçamento da listagem e do histórico comercial.
                </DialogDescription>
              </div>
            </div>

            {quoteToDelete && (
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-foreground">{quoteToDelete.code}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusConfig[quoteToDelete.status]?.border || ''} ${statusConfig[quoteToDelete.status]?.bg || ''} ${statusConfig[quoteToDelete.status]?.text || ''}`}>
                      {statusConfig[quoteToDelete.status]?.label || quoteToDelete.status}
                    </span>
                  </div>
                  <span className="font-black text-sm text-foreground bg-background px-2.5 py-1 rounded-xl border border-border/60 shadow-2xs">
                    {formatBRL(quoteToDelete.total_price)}
                  </span>
                </div>

                <div className="space-y-1 text-muted-foreground text-[11px] pt-2 border-t border-border/40">
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <span className="text-muted-foreground">Cliente:</span> {quoteToDelete.client_name}
                    {quoteToDelete.client_phone && (
                      <span className="text-muted-foreground font-normal">({quoteToDelete.client_phone})</span>
                    )}
                  </p>
                  <p className="truncate text-foreground/80">
                    <span className="text-muted-foreground">Itinerário:</span> {quoteToDelete.origin_neighborhood || quoteToDelete.origin_address.split(',')[0]} ➔ {quoteToDelete.destination_neighborhood || quoteToDelete.destination_address.split(',')[0]}
                  </p>
                  {quoteToDelete.cargo_description && (
                    <p className="truncate text-foreground/70">
                      <span className="text-muted-foreground">Carga:</span> {quoteToDelete.cargo_description}
                    </p>
                  )}
                </div>

                {quoteToDelete.converted_to_transaction_id && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300 font-medium space-y-0.5">
                    <div className="font-bold flex items-center gap-1">
                      <span>⚠️ Lançamento Financeiro Vinculado</span>
                    </div>
                    <p className="text-[10.5px] opacity-90">
                      Este frete já foi lançado no caixa financeiro. Excluir o orçamento aqui não apagará a receita/despesa já lançada no extrato.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setQuoteToDelete(null)}
              className="rounded-xl h-9 px-4 text-xs font-bold cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isDeleting}
              onClick={confirmDeleteQuote}
              className="rounded-xl h-9 px-4 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white gap-1.5 cursor-pointer shadow-xs"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Excluir Orçamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
